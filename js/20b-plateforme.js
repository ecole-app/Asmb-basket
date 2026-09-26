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
  modal.className="gm-sheet";
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
var GM_INTRO="Créez les clubs et invitez leur dirigeant. Les données internes d'un club ne sont visibles qu'avec un code d'accès support fourni par le club.";

function openPlateforme(){
  if(!isSuperAdmin()) return;
  var s=gmSheet("Plateforme General Manager");
  var intro=document.createElement("div");
  intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px";
  intro.textContent=GM_INTRO;
  s.body.appendChild(intro);
  var list=document.createElement("div");
  s.body.appendChild(gmBtn("+ Créer un club","primary",function(){ createClubFlow(list); }));
  list.style.marginTop="14px";
  s.body.appendChild(list);
  loadClubsList(list);
}

// Diagnostic affiché quand l'accès plateforme est demandé par un compte non reconnu.
function gmDiagCard(){
  var seen=(window.ASMB_USER&&window.ASMB_USER.uid)||"(aucun utilisateur chargé)";
  var d=document.createElement("div");
  d.style.cssText="margin:14px 12px;padding:14px 16px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);font-size:12px;color:var(--txt2);line-height:1.5";
  d.innerHTML='<div style="font-weight:800;color:var(--txt);margin-bottom:8px">Accès plateforme refusé</div>'
    +"Ce compte n'est pas reconnu comme super admin."
    +'<div style="margin-top:10px"><b>UID du compte connecté :</b><br><code style="word-break:break-all">'+authEsc(seen)+'</code></div>'
    +'<div style="margin-top:8px"><b>UID attendu :</b><br><code style="word-break:break-all">'+authEsc(BOOTSTRAP_DIRIGEANT_UID)+'</code></div>';
  return d;
}

// Accueil du super admin : la plateforme, pas l'espace d'un club.
// opts.force : affiche l'écran même si le compte n'est pas super admin, avec le
// diagnostic d'UID (accès manuel par ?plateforme, pour ne jamais rester bloqué).
function showPlateformeHome(opts){
  opts=opts||{};
  var el=document.getElementById("plateforme-content");
  if(!el) return false;
  if(!isSuperAdmin()){
    if(!opts.force) return false;
    el.innerHTML="";
    el.appendChild(gmDiagCard());
    stack=["plateforme"];
    showScr("plateforme");
    return false;
  }
  el.innerHTML="";
  var intro=document.createElement("div");
  intro.style.cssText="margin:14px 12px 0;padding:14px 16px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);font-size:12px;color:var(--txt2);line-height:1.45";
  intro.textContent=GM_INTRO;
  el.appendChild(intro);
  var list=document.createElement("div");
  var act=document.createElement("div");
  act.style.cssText="margin:12px 12px 0";
  act.appendChild(gmBtn("+ Créer un club","primary",function(){ createClubFlow(list); }));
  el.appendChild(act);
  list.style.cssText="margin:14px 12px 24px";
  el.appendChild(list);
  loadClubsList(list);
  stack=["plateforme"];
  showScr("plateforme");
  return true;
}

// Le club d'origine est le seul à s'ouvrir directement : le super admin en est le dirigeant.
// Tout autre club passe par un code d'accès support fourni par son dirigeant.
function enterOwnClub(c){
  if(!isSuperAdmin() || !c || c.id!==BOOTSTRAP_CLUB_ID) return;
  document.querySelectorAll(".gm-sheet").forEach(function(m){ m.remove(); });
  initProfile();
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
  var supprime=(c.status==="deleted");
  var jr=joursRestants(c);
  var etat=supprime?"supprime":(suspended?"suspendu":"actif");
  var etatCol=(supprime||suspended)?"var(--red)":"var(--dkg)";
  var delai="";
  if(suspended && jr!==null){
    delai=(jr>0) ? ' \u00b7 <span style="color:#E8670A">'+jr+' j pour regulariser</span>'
                 : ' \u00b7 <span style="color:var(--red)">delai depasse</span>';
  }
  card.innerHTML='<div style="font-size:14px;font-weight:800;color:var(--txt)">'+authEsc(c.name||c.id)+'</div>'
    +'<div style="font-size:11px;color:var(--mut);margin-top:2px">'+authEsc(c.sport||"")+' \u00b7 '+authEsc(c.id)
    +' \u00b7 <b style="color:'+etatCol+'">'+etat+'</b>'+delai+'</div>'
    +(c.suspendMotif?'<div style="font-size:11px;color:var(--txt2);margin-top:4px;font-style:italic">'+authEsc(c.suspendMotif)+'</div>':'');
  var row=gmRow(card);
  var own=(c.id===BOOTSTRAP_CLUB_ID);
  if(own){
    row.appendChild(gmBtn("Entrer dans le club","primary",function(){ enterOwnClub(c); }));
  }
  row.appendChild(gmBtn("Inviter un dirigeant",own?"soft":"primary",function(){
    createClubInvite(c.id, c.name, "dirigeant").then(function(code){ showInviteResult(code,"dirigeant",c.name); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
  if(!own){ row.appendChild(gmBtn("Accès support","soft",function(){ enterSupportFlow(c); })); }
  // Suppression proposee seulement sur un club deja suspendu : deux gestes
  // distincts valent mieux qu'un bouton definitif a cote des actions courantes.
  // Supprimer n'apparait qu'une fois le delai de regularisation ecoule :
  // le club doit avoir eu ses 7 jours pour reagir.
  if(!own && suspended && delaiDepasse(c)){
    row.appendChild(gmBtn("Supprimer","danger",function(){ deleteClubFlow(c, list); }));
  }
  row.appendChild(gmBtn(suspended?"Réactiver":"Suspendre", suspended?"soft":"danger", function(){
    if(suspended) reactiverClub(c, list); else suspendreClub(c, list);
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
      codePrefix:clubCodePrefixFrom(name), poles:BASE_POLES.slice(),
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

// ── SUPPRESSION D'UN CLUB (super admin) ────────────────────────
// Limite assumee : le super admin n'a, par conception, aucun droit sur les
// sous-collections d'un club (allow write: if staff(clubId)). Il ne peut donc
// pas effacer leur contenu depuis le navigateur. Supprimer la fiche du club
// coupe tout acces -- les regles exigent un club existant -- mais les documents
// restent stockes, inaccessibles a tous, y compris a la plateforme.
// Un effacement reel demande un mecanisme dedie, a choisir (voir README).
async function deleteClubFlow(c, list){
  if(!isSuperAdmin() || !c) return;
  if(c.id===BOOTSTRAP_CLUB_ID){ askAlert("Le club d'origine ne peut pas etre supprime."); return; }
  if(c.status!=="suspended"){ askAlert("Suspendre le club avant de le supprimer."); return; }
  if(!delaiDepasse(c)){
    var j=joursRestants(c);
    askAlert("Delai de regularisation en cours"+(j!==null?" : "+j+" jour"+(j>1?"s":"")+" restant"+(j>1?"s":""):"")+
      ".\n\nLa suppression ne sera possible qu'a son echeance.");
    return;
  }
  var avert="Cette suppression est definitive.\n\n"+
    "L'acces du club et de tous ses membres sera coupe immediatement.\n\n"+
    "A savoir : les donnees du club restent stockees chez Firebase, inaccessibles a tous, y compris a la plateforme. "+
    "Leur effacement reel demande un mecanisme dedie, pas encore en place.\n\n"+
    "Pour confirmer, saisir exactement le nom du club :\n"+(c.name||c.id);
  var saisi=await askPrompt(avert,{placeholder:c.name||c.id,confirmText:"Supprimer definitivement"});
  if(saisi===null) return;
  if(String(saisi).trim()!==String(c.name||c.id).trim()){ askAlert("Nom incorrect : suppression annulee."); return; }

  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Suppression en cours\u2026</div>';
  var invites=0;
  try{
    // Invitations en attente : seules entrees liees au club que le super admin
    // peut reellement effacer. Les laisser permettrait de creer un compte sur
    // un club disparu.
    var q=window.fbQuery(window.fbCollection(window.fbDb,"club_invites"), window.fbWhere("clubId","==",c.id));
    var snap=await window.fbGetDocs(q);
    var ids=[]; snap.forEach(function(d){ ids.push(d.id); });
    for(var i=0;i<ids.length;i+=400){
      var b=window.fbWriteBatch();
      ids.slice(i,i+400).forEach(function(id){ b.delete(window.fbDoc(window.fbDb,"club_invites",id)); });
      await b.commit();
      invites+=Math.min(400,ids.length-i);
    }
  }catch(e){ console.log("purge invitations:", e&&e.code||e); }

  try{
    await window.fbDeleteDoc(window.fbDoc(window.fbDb,"clubs",c.id));
    loadClubsList(list);
    askAlert("Club supprime."+(invites?"\n\n"+invites+" invitation(s) en attente effacee(s).":"")+
      "\n\nLes comptes de connexion restent a supprimer dans la console Firebase, "+
      "et les donnees du club y restent stockees.");
  }catch(e){
    loadClubsList(list);
    askAlert("Suppression impossible : "+((e&&e.code)||e));
  }
}

// ── CYCLE SUSPENSION -> REGULARISATION -> SUPPRESSION ───────────────
// Un club suspendu n'est pas ejecte : il voit le motif et le delai qui lui
// reste pour regulariser. Passe ce delai, la suppression devient possible.
var GM_DELAI_REGUL_JOURS=7;

function gmDate(v){
  if(!v) return null;
  if(v.toDate) return v.toDate();
  if(v instanceof Date) return v;
  var d=new Date(v);
  return isNaN(d.getTime())?null:d;
}
// Jours restants avant echeance : negatif si le delai est depasse.
function joursRestants(club){
  var d=gmDate(club&&club.graceUntil);
  if(!d) return null;
  return Math.ceil((d.getTime()-Date.now())/86400000);
}
function delaiDepasse(club){
  var j=joursRestants(club);
  return j!==null && j<=0;
}

// Ecran vu par un club suspendu ou supprime.
function showClubSuspendu(club){
  var el=document.getElementById("club-suspendu-content");
  if(!el) return;
  club=club||window.CURRENT_CLUB||{};
  var supprime=(club.status==="deleted");
  var j=joursRestants(club);
  var ech=gmDate(club.graceUntil);
  el.innerHTML="";

  var box=document.createElement("div");
  box.style.cssText="margin:18px 12px;padding:18px 16px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+(supprime?"var(--red)":"#E8670A")+";border-radius:var(--rs)";

  var titre=document.createElement("div");
  titre.style.cssText="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:8px";
  titre.textContent=supprime?"Acces supprime":"Acces suspendu";
  box.appendChild(titre);

  var corps=document.createElement("div");
  corps.style.cssText="font-size:13px;color:var(--txt2);line-height:1.55";
  if(supprime){
    corps.textContent="L'acces de "+(club.name||"votre club")+" a General Manager a ete supprime. Les donnees ne sont plus consultables depuis l'application.";
  } else if(j===null){
    corps.textContent="L'acces de "+(club.name||"votre club")+" est suspendu. Contactez General Manager pour regulariser la situation.";
  } else if(j>0){
    corps.textContent="L'acces de "+(club.name||"votre club")+" est suspendu. Vous disposez de "+j+" jour"+(j>1?"s":"")+
      " pour regulariser la situation"+(ech?", soit jusqu'au "+ech.toLocaleDateString("fr-FR"):"")+
      ". Passe ce delai, le compte du club et ses donnees pourront etre supprimes definitivement.";
  } else {
    corps.textContent="L'acces de "+(club.name||"votre club")+" est suspendu et le delai de regularisation est depasse"+
      (ech?" depuis le "+ech.toLocaleDateString("fr-FR"):"")+
      ". Le compte peut etre supprime definitivement a tout moment. Contactez General Manager sans tarder.";
  }
  box.appendChild(corps);

  if(club.suspendMotif){
    var motif=document.createElement("div");
    motif.style.cssText="margin-top:12px;padding:10px 12px;background:var(--bg);border-radius:var(--rx);font-size:12px;color:var(--txt2);line-height:1.45";
    motif.innerHTML='<b style="color:var(--txt)">Motif</b><br>'+authEsc(club.suspendMotif);
    box.appendChild(motif);
  }

  if(!supprime && j!==null && j>0){
    var jauge=document.createElement("div");
    jauge.style.cssText="margin-top:14px";
    var pct=Math.max(0,Math.min(100,Math.round(j/GM_DELAI_REGUL_JOURS*100)));
    jauge.innerHTML='<div style="height:6px;background:var(--bdr);border-radius:4px;overflow:hidden">'+
      '<div style="height:100%;width:'+pct+'%;background:#E8670A"></div></div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:6px">'+j+' jour'+(j>1?'s':'')+' restant'+(j>1?'s':'')+' sur '+GM_DELAI_REGUL_JOURS+'</div>';
    box.appendChild(jauge);
  }
  el.appendChild(box);

  var out=document.createElement("button");
  out.textContent="Se deconnecter";
  out.style.cssText="width:calc(100% - 24px);margin:0 12px;padding:13px;border-radius:var(--rs);background:var(--card);border:1.5px solid var(--bdr);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
  out.addEventListener("click",function(){ window.fbSignOut(window.fbAuth); showAuth("entry"); });
  el.appendChild(out);

  var nav=document.getElementById("bnav-main");
  if(nav) nav.style.display="none";
  stack=["club-suspendu"];
  showScr("club-suspendu");
}

// Suspension : date de depart et echeance posees en meme temps que le statut.
async function suspendreClub(c, list){
  var motif=await askPrompt("Motif communique au club (facultatif)",
    {defaultValue:c.suspendMotif||"",placeholder:"Ex : cotisation non reglee",confirmText:"Suivant"});
  if(motif===null) return;
  var ok=await askConfirm("Suspendre "+(c.name||c.id)+" ?\n\nSes membres ne pourront plus acceder a leurs donnees. Ils verront le motif et disposeront de "+GM_DELAI_REGUL_JOURS+" jours pour regulariser avant que la suppression ne devienne possible.",
    {danger:true,confirmText:"Suspendre"});
  if(!ok) return;
  var now=new Date();
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),{
    status:"suspended",
    suspendedAt:now,
    graceUntil:new Date(now.getTime()+GM_DELAI_REGUL_JOURS*86400000),
    suspendMotif:String(motif).trim()||null
  }).then(function(){ loadClubsList(list); })
    .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}

// Reactivation : le delai est efface, le club repart sans compte a rebours.
function reactiverClub(c, list){
  askConfirm("Reactiver l'acces de "+(c.name||c.id)+" ?",{confirmText:"Reactiver"}).then(function(ok){
    if(!ok) return;
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),{
      status:"active", suspendedAt:null, graceUntil:null, suspendMotif:null
    }).then(function(){ loadClubsList(list); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  });
}
