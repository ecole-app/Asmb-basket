/* ===== 20b-plateforme.js — Plateforme (super admin), invitations, accès support ===== */
//
// Trois niveaux d'accès :
//  1. Super admin (éditeur de General Manager) : crée les clubs et invite leur dirigeant.
//  2. Dirigeant d'un club : invite ses coachs / co-dirigeants, gère l'accès support.
//  3. Membres : coachs, parents, joueurs.
//
// Le super admin ne voit AUCUNE donnée interne d'un club, sauf si le dirigeant lui
// génère un code d'accès support (48 h, lecture seule, révocable). Cette règle est
// garantie côté serveur par firestore.rules, pas seulement par l'interface.

function isSuperAdmin(){
  return !!(window.ASMB_USER && window.ASMB_USER.uid===BOOTSTRAP_DIRIGEANT_UID);
}

// Code aléatoire cryptographique (32 caractères non ambigus : pas de 0/O ni 1/I).
function genSecureCode(groups, size){
  var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789", out=[];
  var arr=new Uint32Array(groups*size);
  crypto.getRandomValues(arr);
  for(var g=0; g<groups; g++){
    var s="";
    for(var i=0; i<size; i++) s+=chars[arr[g*size+i]%chars.length];
    out.push(s);
  }
  return out.join("-");
}

function gmSlug(s){
  return (s||"club").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"").slice(0,24) || "club";
}

function gmFmtDate(ts){
  var d=ts&&ts.toDate?ts.toDate():(ts instanceof Date?ts:null);
  return d?d.toLocaleDateString("fr-FR")+" "+d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):"";
}

// ── Petits composants d'interface ────────────────────────────────────
function gmSheet(title){
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:88vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var t=document.createElement("div");
  t.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  t.textContent=title;
  var x=document.createElement("button");
  x.textContent="\u2715";
  x.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  x.addEventListener("click",function(){modal.remove();});
  hdr.appendChild(t); hdr.appendChild(x);
  var body=document.createElement("div");
  inner.appendChild(hdr); inner.appendChild(body); modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  return {modal:modal, body:body};
}
function gmBtn(label, kind, onClick){
  var b=document.createElement("button");
  b.textContent=label;
  var styles={
    primary:"background:var(--dkg);color:#fff",
    soft:"background:rgba(212,175,55,.12);color:var(--dkg)",
    danger:"background:rgba(192,57,43,.1);color:var(--red)",
    ghost:"background:var(--bdr);color:var(--mut)"
  };
  b.style.cssText="padding:9px 14px;border-radius:20px;font-size:12px;font-weight:700;border:none;cursor:pointer;"+(styles[kind]||styles.ghost);
  b.addEventListener("click",function(e){e.stopPropagation();onClick(b);});
  return b;
}
function gmSection(parent, title, hint){
  var h=document.createElement("div");
  h.style.cssText="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);margin:18px 0 6px";
  h.textContent=title;
  parent.appendChild(h);
  if(hint){
    var p=document.createElement("div");
    p.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
    p.textContent=hint;
    parent.appendChild(p);
  }
}
function gmCard(){
  var c=document.createElement("div");
  c.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px";
  return c;
}
function gmRow(parent){
  var r=document.createElement("div");
  r.style.cssText="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px";
  parent.appendChild(r);
  return r;
}

// ═══ INVITATIONS (usage unique, 7 jours) ══════════════════════════════
function createClubInvite(clubId, clubName, role){
  var code=genSecureCode(3,4);
  return window.fbSetDoc(window.fbDoc(window.fbDb,"club_invites",code),{
    clubId:clubId, clubName:clubName||"", role:role, usedBy:null,
    createdBy:window.ASMB_USER.uid, createdAt:window.fbServerTimestamp(),
    expiresAt:new Date(Date.now()+7*86400000)
  }).then(function(){ return code; });
}
function inviteLink(code){
  return location.origin+location.pathname+"?invite="+encodeURIComponent(code);
}
function showInviteResult(code, role, clubName){
  var link=inviteLink(code);
  var s=gmSheet("Invitation créée");
  var info=document.createElement("div");
  info.style.cssText="font-size:13px;color:var(--txt2);line-height:1.5;margin-bottom:12px";
  info.textContent="Envoyez ce lien au "+(role==="dirigeant"?"dirigeant":"coach")+(clubName?" de "+clubName:"")
    +". Il crée son compte en l'ouvrant. Valable 7 jours, utilisable une seule fois.";
  var box=document.createElement("div");
  box.style.cssText="background:var(--card);border:1.5px dashed var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;word-break:break-all;color:var(--txt);font-family:monospace";
  box.textContent=link;
  s.body.appendChild(info); s.body.appendChild(box);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Partager","primary",function(){
    var txt="Invitation General Manager"+(clubName?" — "+clubName:"")+" :\n"+link+"\n(valable 7 jours, usage unique)";
    if(navigator.share){ navigator.share({title:"Invitation General Manager", text:txt}).catch(function(){}); }
    else copyToClipboard(link);
  }));
  row.appendChild(gmBtn("Copier le lien","soft",function(){ copyToClipboard(link); }));
}
function copyToClipboard(txt){
  if(navigator.clipboard){ navigator.clipboard.writeText(txt).then(function(){ askAlert("Lien copié."); }).catch(function(){ askAlert(txt); }); }
  else askAlert(txt);
}

// ── Page publique d'acceptation (?invite=CODE) ──
function showInviteScreen(code){
  stack=["auth"]; showScr("auth");
  var el=document.getElementById("auth-content"); if(!el) return;
  el.innerHTML=authHero("Invitation","General Manager")+'<div style="padding:26px 18px;text-align:center;color:var(--mut)">Vérification de l\'invitation…</div>';
  var tries=0;
  (function waitFb(){
    if(!window.fbGetDoc || !window.fbAuth){
      if(tries++<60){ setTimeout(waitFb,100); return; }
      return inviteError(el,"Connexion impossible. Réessayez.");
    }
    window.fbGetDoc(window.fbDoc(window.fbDb,"club_invites",code)).then(function(snap){
      if(!snap.exists()) return inviteError(el,"Invitation introuvable. Vérifiez le lien reçu.");
      var inv=snap.data();
      if(inv.usedBy) return inviteError(el,"Cette invitation a déjà été utilisée.");
      var exp=inv.expiresAt&&inv.expiresAt.toDate?inv.expiresAt.toDate():null;
      if(exp && exp<new Date()) return inviteError(el,"Cette invitation a expiré. Demandez-en une nouvelle.");
      renderInviteForm(el, code, inv);
    }).catch(function(){ inviteError(el,"Impossible de vérifier l'invitation."); });
  })();
}
function inviteError(el,msg){
  el.innerHTML=authHero("Invitation","General Manager")
    +'<div style="padding:22px 18px"><div style="background:rgba(192,57,43,.1);color:var(--red);font-size:13px;font-weight:600;padding:14px;border-radius:var(--rs);text-align:center;line-height:1.45">'+authEsc(msg)+'</div></div>';
}
function renderInviteForm(el, code, inv){
  var roleLbl=inv.role==="dirigeant"?"Dirigeant":"Coach";
  el.innerHTML=authHero(authEsc(inv.clubName||"Votre club"), roleLbl)
    +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
    +'<p style="font-size:13px;color:var(--txt2);text-align:center;line-height:1.45;margin-bottom:4px">Vous êtes invité(e) comme <b>'+roleLbl.toLowerCase()+'</b>. Créez votre compte pour accéder au club.</p>'
    +'<label style="'+AUTH_LBL+'">E-mail</label>'
    +'<input id="auth-email" type="email" inputmode="email" autocapitalize="off" style="'+AUTH_INP+'" placeholder="prenom@email.fr">'
    +'<label style="'+AUTH_LBL+'">Mot de passe</label>'
    +authPassField("auth-pass","6 caractères minimum")
    +'<div id="auth-err" style="display:none;color:var(--red);font-size:12px;font-weight:600;margin-top:12px;text-align:center"></div>'
    +'<button id="invite-accept-btn" style="'+AUTH_BTN+'">Créer mon compte</button>'
    +'</div>';
  authWirePassToggles();
  document.getElementById("invite-accept-btn").addEventListener("click",function(){ acceptInvite(code, inv); });
}
function acceptInvite(code, inv){
  var email=((document.getElementById("auth-email")||{}).value||"").trim();
  var pass=(document.getElementById("auth-pass")||{}).value||"";
  if(email.indexOf("@")<1){ authErr("E-mail invalide"); return; }
  if(pass.length<6){ authErr("Mot de passe : 6 caractères minimum"); return; }
  var btn=document.getElementById("invite-accept-btn");
  if(btn){ btn.disabled=true; btn.textContent="Création du compte…"; }
  var createdUser=null;
  window.fbCreateUser(window.fbAuth, email, pass).then(function(cred){
    createdUser=cred.user;
    // Création du compte ET consommation de l'invitation dans la même opération
    // atomique : une invitation ne peut servir qu'une fois (vérifié par les règles).
    var b=window.fbWriteBatch();
    b.set(window.fbDoc(window.fbDb,"users",cred.user.uid),{
      email:email, phone:"", roles:[inv.role], clubId:inv.clubId, inviteCode:code,
      linkedPlayerIds:[], linkedTeamIds:[], createdAt:window.fbServerTimestamp()
    });
    b.update(window.fbDoc(window.fbDb,"club_invites",code),{usedBy:cred.user.uid, usedAt:window.fbServerTimestamp()});
    return b.commit();
  }).then(function(){
    location.href=location.origin+location.pathname; // retour à l'app, déjà connecté
  }).catch(function(e){
    var c=e&&e.code||"";
    // Compte d'authentification créé mais invitation refusée : on le supprime
    // pour ne pas laisser de compte orphelin.
    if(createdUser && c!=="auth/email-already-in-use"){ createdUser.delete().catch(function(){}); }
    if(btn){ btn.disabled=false; btn.textContent="Créer mon compte"; }
    if(c==="auth/email-already-in-use") authErr("Cet e-mail a déjà un compte. Utilisez une autre adresse, ou demandez au dirigeant de vous ajouter depuis « Accès coach ».");
    else if(c==="auth/weak-password") authErr("Mot de passe trop faible (6 caractères min.)");
    else if(c==="auth/invalid-email") authErr("E-mail invalide");
    else if(c==="permission-denied") authErr("Invitation déjà utilisée ou expirée.");
    else authErr("Erreur : "+(c||e.message||"inconnue"));
  });
}

// ═══ ESPACE PLATEFORME (super admin) ══════════════════════════════════
function openPlateforme(){
  if(!isSuperAdmin()) return;
  var s=gmSheet("Plateforme General Manager");
  var intro=document.createElement("div");
  intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px";
  intro.textContent="Créez les clubs et invitez leur dirigeant. Les données internes d'un club ne sont visibles qu'avec un code d'accès support fourni par le club.";
  s.body.appendChild(intro);
  s.body.appendChild(gmBtn("+ Créer un club","primary",function(){ createClubFlow(list); }));
  var list=document.createElement("div");
  list.style.marginTop="14px";
  s.body.appendChild(list);
  loadClubsList(list);
}
function loadClubsList(list){
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Chargement…</div>';
  window.fbGetDocs(window.fbCollection(window.fbDb,"clubs")).then(function(snap){
    var clubs=[];
    snap.forEach(function(d){ clubs.push(Object.assign({id:d.id}, d.data())); });
    clubs.sort(function(a,b){ return (a.name||"").localeCompare(b.name||""); });
    list.innerHTML="";
    if(!clubs.length){ list.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Aucun club.</div>'; return; }
    clubs.forEach(function(c){ list.appendChild(renderClubCard(c, list)); });
  }).catch(function(e){
    list.innerHTML='<div style="color:var(--red);padding:20px;text-align:center;font-size:12px">Erreur : '+((e&&e.code)||e)+'</div>';
  });
}
function renderClubCard(c, list){
  var card=gmCard();
  var suspended=c.status==="suspended";
  card.innerHTML='<div style="font-size:14px;font-weight:800;color:var(--txt)">'+authEsc(c.name||c.id)+'</div>'
    +'<div style="font-size:11px;color:var(--mut);margin-top:2px">'+authEsc(c.sport||"")+' · '+authEsc(c.id)
    +' · <b style="color:'+(suspended?"var(--red)":"var(--dkg)")+'">'+(suspended?"suspendu":"actif")+'</b></div>';
  var row=gmRow(card);
  row.appendChild(gmBtn("Inviter un dirigeant","primary",function(){
    createClubInvite(c.id, c.name, "dirigeant").then(function(code){ showInviteResult(code,"dirigeant",c.name); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
  row.appendChild(gmBtn("Accès support","soft",function(){ enterSupportFlow(c); }));
  row.appendChild(gmBtn(suspended?"Réactiver":"Suspendre", suspended?"soft":"danger", function(){
    askConfirm(suspended?"Réactiver l'accès de ce club ?":"Suspendre ce club ? Ses membres ne pourront plus accéder à l'application.",
      {danger:!suspended, confirmText:suspended?"Réactiver":"Suspendre"}).then(function(ok){
      if(!ok) return;
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),{status:suspended?"active":"suspended"})
        .then(function(){ loadClubsList(list); })
        .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
    });
  }));
  return card;
}
async function createClubFlow(list){
  var name=await askPrompt("Nom du club",{placeholder:"Ex : BC Saint-Chamond",confirmText:"Suivant"});
  if(!name||!name.trim()) return;
  var sport=await askPrompt("Sport du club",{defaultValue:"basket",confirmText:"Créer le club"});
  if(sport===null) return;
  name=name.trim();
  var id=gmSlug(name)+"-"+genSecureCode(1,4).toLowerCase();
  try{
    await window.fbSetDoc(window.fbDoc(window.fbDb,"clubs",id),{
      name:name, sport:(sport||"basket").trim().toLowerCase(), status:"active", plan:"trial",
      createdBy:window.ASMB_USER.uid, createdAt:window.fbServerTimestamp()
    });
    var code=await createClubInvite(id, name, "dirigeant");
    loadClubsList(list);
    showInviteResult(code,"dirigeant",name);
  }catch(e){ askAlert("Erreur lors de la création : "+((e&&e.code)||e)); }
}

// ═══ ACCÈS SUPPORT (côté super admin) ═════════════════════════════════
function getSupportSession(){
  try{ return JSON.parse(sessionStorage.getItem("gm_support")||"null"); }catch(e){ return null; }
}
async function enterSupportFlow(c){
  var code=await askPrompt("Code d'accès support fourni par le club",{placeholder:"XXXX-XXXX",confirmText:"Accéder"});
  if(!code) return;
  code=code.trim().toUpperCase();
  try{
    var g=await window.fbGetDoc(window.fbDoc(window.fbDb,"support_grants",code));
    if(!g.exists() || g.data().clubId!==c.id){ askAlert("Code invalide pour ce club."); return; }
    var exp=g.data().expiresAt;
    if(exp && exp.toDate && exp.toDate()<new Date()){ askAlert("Ce code a expiré."); return; }
    await window.fbSetDoc(window.fbDoc(window.fbDb,"clubs",c.id,"support_sessions",window.ASMB_USER.uid),
      {code:code, expiresAt:exp, createdAt:window.fbServerTimestamp()});
    sessionStorage.setItem("gm_support", JSON.stringify({clubId:c.id, name:c.name||c.id, code:code}));
    location.reload();
  }catch(e){
    askAlert((e&&e.code)==="permission-denied" ? "Code invalide ou expiré." : "Erreur : "+((e&&e.code)||e));
  }
}
function exitSupportMode(){
  var sup=getSupportSession();
  sessionStorage.removeItem("gm_support");
  var done=function(){ location.reload(); };
  if(sup && window.fbDeleteDoc && window.ASMB_USER){
    window.fbDeleteDoc(window.fbDoc(window.fbDb,"clubs",sup.clubId,"support_sessions",window.ASMB_USER.uid)).then(done,done);
  } else done();
}
function applySupportModeUI(sup){
  if(document.getElementById("gm-support-banner")) return;
  var b=document.createElement("div");
  b.id="gm-support-banner";
  b.style.cssText="position:fixed;top:0;left:0;right:0;z-index:500;background:#E8670A;color:#fff;font-size:12px;font-weight:700;padding:calc(6px + env(safe-area-inset-top,0px)) 12px 6px;display:flex;align-items:center;gap:10px";
  var t=document.createElement("span");
  t.style.flex="1";
  t.textContent="Mode support · lecture seule · "+(sup.name||sup.clubId);
  var x=document.createElement("button");
  x.textContent="Quitter";
  x.style.cssText="background:#fff;color:#E8670A;border:none;border-radius:14px;padding:5px 12px;font-size:11px;font-weight:800;cursor:pointer";
  x.addEventListener("click",exitSupportMode);
  b.appendChild(t); b.appendChild(x);
  document.body.appendChild(b);
}

// ═══ ACCÈS & INVITATIONS (côté dirigeant du club) ═════════════════════
function openClubAccessSettings(){
  var clubId=window.CURRENT_CLUB_ID;
  if(!clubId) return;
  var clubName=(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"";
  var s=gmSheet("Accès & invitations");

  gmSection(s.body,"Inviter un membre du staff","Génère un lien à usage unique (7 jours). La personne crée son compte en l'ouvrant et arrive directement dans votre club.");
  var row=gmRow(s.body);
  ["coach","dirigeant"].forEach(function(role){
    row.appendChild(gmBtn(role==="coach"?"Inviter un coach":"Inviter un dirigeant", role==="coach"?"primary":"soft", function(){
      createClubInvite(clubId, clubName, role).then(function(code){ showInviteResult(code, role, clubName); })
        .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
    }));
  });

  gmSection(s.body,"Accès support General Manager","Par défaut, l'équipe General Manager n'a aucun accès aux données de votre club. Pour un dépannage, générez un code et communiquez-le : il donne un accès en lecture seule pendant 48 h, révocable à tout moment.");
  var grants=document.createElement("div");
  s.body.appendChild(grants);
  s.body.appendChild(gmBtn("Générer un code d'accès (48 h)","primary",function(){
    var code=genSecureCode(2,4);
    window.fbSetDoc(window.fbDoc(window.fbDb,"support_grants",code),{
      clubId:clubId, createdBy:window.ASMB_USER.uid, createdAt:window.fbServerTimestamp(),
      expiresAt:new Date(Date.now()+48*3600000)
    }).then(function(){
      askAlert("Code d'accès support :\n\n"+code+"\n\nValable 48 h. Communiquez-le à l'équipe General Manager.");
      loadSupportGrants(grants, clubId);
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
  loadSupportGrants(grants, clubId);
}
function loadSupportGrants(el, clubId){
  el.innerHTML="";
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"support_grants"), window.fbWhere("clubId","==",clubId)))
    .then(function(snap){
      var now=new Date(), active=[];
      snap.forEach(function(d){
        var e=d.data().expiresAt, dt=e&&e.toDate?e.toDate():null;
        if(!dt || dt>now) active.push({code:d.id, exp:e});
      });
      if(!active.length){
        el.innerHTML='<div style="font-size:12px;color:var(--mut);margin-bottom:10px">Aucun accès support actif.</div>';
        return;
      }
      active.forEach(function(g){
        var card=gmCard();
        card.innerHTML='<div style="font-family:monospace;font-size:15px;font-weight:800;color:var(--txt);letter-spacing:1px">'+authEsc(g.code)+'</div>'
          +'<div style="font-size:11px;color:var(--mut);margin-top:2px">Expire le '+gmFmtDate(g.exp)+'</div>';
        gmRow(card).appendChild(gmBtn("Révoquer maintenant","danger",function(){
          revokeSupportGrant(g.code, clubId).then(function(){ loadSupportGrants(el, clubId); });
        }));
        el.appendChild(card);
      });
    }).catch(function(e){ el.innerHTML='<div style="font-size:12px;color:var(--red)">Erreur : '+((e&&e.code)||e)+'</div>'; });
}
function revokeSupportGrant(code, clubId){
  // Supprimer le code suffit à couper l'accès (les règles exigent qu'il existe) ;
  // on ferme aussi les sessions ouvertes pour faire propre.
  return window.fbDeleteDoc(window.fbDoc(window.fbDb,"support_grants",code)).then(function(){
    return window.fbGetDocs(window.fbCollection(window.fbDb,"clubs",clubId,"support_sessions"));
  }).then(function(snap){
    var dels=[];
    snap.forEach(function(d){ if(d.data().code===code) dels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,"clubs",clubId,"support_sessions",d.id))); });
    return Promise.all(dels);
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
