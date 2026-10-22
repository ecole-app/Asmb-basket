// ── Activation des accès famille : rappels à 3 jours et 7 jours ─────────────
// Une famille « en attente » = accès envoyé (lic.accesEnvoyeLe) mais aucun compte du club avec son numéro.
// Rien ne part tout seul : le dirigeant relance par SMS pré-rempli (lien sms:).
var ACT_RELANCE_J=3, ACT_EXPIRE_J=7;
var ACT_CACHE={t:0, liste:[]};

function actTel(t){ return telNorm(t).replace(/^\+33/,"0"); }
function actJours(ts){ return Math.floor((Date.now()-Number(ts||0))/86400000); }

// Liste des familles à qui l'accès a été envoyé et qui n'ont pas encore de compte.
function actEnAttente(){
  if(ACT_CACHE.liste && Date.now()-ACT_CACHE.t<30000 && ACT_CACHE.p) return ACT_CACHE.p;
  var p=actCalculer(); ACT_CACHE.p=p; ACT_CACHE.t=Date.now();
  return p.then(function(l){ ACT_CACHE.liste=l; return l; });
}
function actCalculer(){
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.indexOf("dirigeant")<0 || !window.fbGetDocs || !window.fbQuery || !window.CURRENT_CLUB_ID) return Promise.resolve([]);
  var lics=(getLicences()||[]).filter(function(l){ return l&&l.fiche&&l.accesEnvoyeLe&&!l.accesActive; });
  if(!lics.length) return Promise.resolve([]);
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(sn){
    var tels={}; sn.forEach(function(d){ var t=actTel((d.data()||{}).phone||""); if(t) tels[t]=true; });
    var res=[];
    lics.forEach(function(l){
      var f=l.fiche, liste=[f.respTel,f.telephone,f.resp2Tel].filter(Boolean).map(actTel);
      if(liste.some(function(t){ return tels[t]; })) return; // compte créé : plus rien à relancer
      res.push({lic:l, jours:actJours(l.accesEnvoyeLe), tel:liste[0]||""});
    });
    res.sort(function(a,b){ return b.jours-a.jours; });
    return res;
  }).catch(function(){ return []; });
}

function actTexte(x, lien){
  var club=(typeof clubLabel==="function"?clubLabel(""):"")||"Votre club";
  var prenom=(x.lic.fiche.prenom||"votre enfant");
  return club+" : petit rappel, créez votre compte pour suivre "+prenom+" (matchs, convocations) : "+lien;
}
// Lien à renvoyer : le même s'il est encore valable, sinon une nouvelle invitation.
function actLien(x){
  if(x.lic.accesCode && x.jours<ACT_EXPIRE_J) return Promise.resolve(inviteLink(x.lic.accesCode));
  return creerInvitationParent(x.lic).then(function(code){ marquerAccesEnvoye(x.lic.code, code); return inviteLink(code); });
}
function actRelancer(x, bouton){
  if(!x.tel){ askAlert("Aucun téléphone sur cette fiche."); return; }
  if(bouton){ bouton.disabled=true; }
  actLien(x).then(function(lien){
    window.location.href="sms:"+x.tel+"?&body="+encodeURIComponent(actTexte(x,lien));
  }).catch(function(e){ if(bouton) bouton.disabled=false; askAlert(e&&e.message?e.message:"Erreur : "+((e&&e.code)||e)); });
}

function actOuvrir(){
  var s=gmSheet("Accès famille non activés");
  s.body.innerHTML='<div style="color:var(--mut);font-size:12px;padding:8px 0">Chargement…</div>';
  actEnAttente().then(function(l){
    s.body.innerHTML="";
    if(!l.length){ s.body.innerHTML='<div style="color:var(--mut);font-size:13px;padding:10px 0">Toutes les familles ont activé leur accès.</div>'; return; }
    var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);line-height:1.45;margin-bottom:10px";
    info.textContent="Rappel conseillé après "+ACT_RELANCE_J+" jours. Le lien expire après "+ACT_EXPIRE_J+" jours : on en envoie alors un nouveau. Le SMS part de ton téléphone.";
    s.body.appendChild(info);
    l.forEach(function(x){
      var f=x.lic.fiche, card=gmCard();
      var etat=x.jours>=ACT_EXPIRE_J?["Lien expiré","#C0392B"]:(x.jours>=ACT_RELANCE_J?["À relancer","#E8670A"]:["En attente","var(--mut)"]);
      card.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:13px">'+authEsc(f.respNom||((f.prenom||"")+" "+(f.nom||"")).trim())+'</b>'
        +'<span style="font-size:10px;font-weight:800;color:'+etat[1]+'">'+etat[0]+'</span></div>'
        +'<div style="font-size:11px;color:var(--mut);margin:2px 0 8px">Famille de '+authEsc(((f.prenom||"")+" "+(f.nom||"")).trim())+' · envoyé il y a '+x.jours+' jour'+(x.jours>1?"s":"")+'</div>';
      if(x.jours>=ACT_RELANCE_J){
        card.appendChild(gmBtn(x.jours>=ACT_EXPIRE_J?"Renvoyer un nouveau lien par SMS":"Relancer par SMS","primary",function(){ actRelancer(x, null); }));
      }
      s.body.appendChild(card);
    });
  });
}

// Bandeau de l'accueil du dirigeant, seulement s'il y a au moins une famille à relancer.
function actBandeau(refId){
  var ref=document.getElementById(refId); if(!ref||!ref.parentNode) return;
  actEnAttente().then(function(l){
    var id="act-"+refId, box=document.getElementById(id);
    var a=l.filter(function(x){ return x.jours>=ACT_RELANCE_J; });
    if(!a.length){ if(box) box.remove(); return; }
    if(!box){
      box=document.createElement("div"); box.id=id;
      var avant=document.getElementById("ben-"+refId)||ref.previousElementSibling;
      if(!(avant&&avant.parentNode===ref.parentNode)) avant=ref;
      if(avant===ref.previousElementSibling && !(avant.classList&&avant.classList.contains("sec"))) avant=ref;
      ref.parentNode.insertBefore(box,avant);
    }
    var exp=a.filter(function(x){ return x.jours>=ACT_EXPIRE_J; }).length;
    box.style.cssText="margin:12px 12px 0;padding:12px 14px;border-radius:var(--rs);background:color-mix(in srgb, #E8670A 10%, var(--card));border:1.5px solid #E8670A;cursor:pointer";
    box.setAttribute("role","button");
    box.onclick=actOuvrir;
    box.innerHTML='<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#E8670A">📲 Accès famille à relancer</div>'
      +'<div style="font-size:14px;font-weight:800;margin-top:4px">'+a.length+' famille'+(a.length>1?"s":"")+' n\'a'+(a.length>1?"ont":"")+' pas encore créé son compte</div>'
      +'<div style="font-size:12px;color:var(--mut);margin-top:2px">'+(exp?exp+' lien'+(exp>1?"s":"")+' expiré'+(exp>1?"s":"")+' · ':"")+'Appuie pour relancer par SMS</div>';
  });
}
