/* ===== 22-push.js — Notifications push (Firebase Cloud Messaging) =====
   Chaîne : navigateur s'abonne (FCM, via getToken) → le token obtenu est
   stocké dans Firestore (clubs/{clubId}/push_subscriptions/{uid}) → une
   Cloud Function (functions/index.js) se déclenche automatiquement à chaque
   nouveau message et envoie la notif à tous les tokens du club sauf
   l'auteur. Rien côté client n'a besoin d'appeler une API externe : c'est
   le trigger Firestore qui fait le travail, même si le posteur ferme
   l'app juste après avoir envoyé son message.
*/

// Clé VAPID "Web Push certificate" du projet Firebase — PAS une clé qu'on
// génère soi-même : Firebase Console → ⚙️ Paramètres du projet → Cloud
// Messaging → onglet "Web configuration" → "Générer une paire de clés".
// À remplacer une fois générée (voir PUSH_SETUP.md).
var GM_FCM_VAPID_KEY = "BN47W4jilNVt6DpQF25IlUsIbgduMQFjO84WEN2LGbdjUY1uRaun3wpRzuuh2U6TUNCXDdx398W9LA1zX1zP9B0";

// iPhone/iPad : les notifications n'existent que si l'appli est installée sur
// l'écran d'accueil (iOS 16.4+). Dans Safari « normal », on explique comment faire.
function pushIosAInstaller(){
  var ua=navigator.userAgent||"";
  var ios=/iPad|iPhone|iPod/.test(ua)||(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(!ios) return false;
  var installee=window.navigator.standalone===true||(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches);
  return !installee;
}
try{ if(pushIosAInstaller()) document.documentElement.classList.add("gm-ios-web"); }catch(e){}

function pushTutoIphone(){
  var modal=document.createElement("div");
  modal.className="alert-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto";
  var box=document.createElement("div");
  box.style.cssText="background:#fff;border-radius:18px;padding:20px 18px 16px;width:100%;max-width:360px;box-shadow:0 10px 30px rgba(0,0,0,.25)";
  box.addEventListener("click",function(e){ e.stopPropagation(); });
  box.innerHTML='<div style="font-size:16px;font-weight:800;color:var(--txt);text-align:center;margin-bottom:4px">📲 Installer l\'appli sur ton iPhone</div>'+
    '<div style="font-size:12px;color:var(--txt2);text-align:center;line-height:1.45;margin-bottom:14px">Sur iPhone, les notifications ne marchent que si l\'appli est sur ton écran d\'accueil. 30 secondes :</div>'+
    '<ol class="ios-tuto">'+
    '<li>Ouvre cette page dans <b>Safari</b> (pas dans WhatsApp, Instagram ou un autre navigateur).</li>'+
    '<li>Touche le bouton <b>Partager</b> : le carré avec une flèche vers le haut, en bas de l\'écran.</li>'+
    '<li>Fais défiler le menu et touche <b>Sur l\'écran d\'accueil</b>.</li>'+
    '<li>Touche <b>Ajouter</b> en haut à droite.</li>'+
    '<li>Ferme Safari et ouvre l\'appli <b>depuis l\'icône</b> sur ton écran d\'accueil.</li>'+
    '<li>Va dans <b>Paramètres › Notifications</b> et touche <b>Autoriser</b>.</li>'+
    '</ol>'+
    '<div style="font-size:11px;color:var(--mut);margin:10px 0 14px;line-height:1.4">Il faut iOS 16.4 ou plus récent. Si « Sur l\'écran d\'accueil » n\'apparaît pas, mets à jour ton iPhone.</div>';
  var ok=document.createElement("button");
  ok.textContent="J'ai compris";
  ok.style.cssText="width:100%;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;color:#fff;cursor:pointer;background:var(--dkg)";
  function fin(){ modal.remove(); }
  ok.addEventListener("click",fin); modal.addEventListener("click",fin);
  box.appendChild(ok); modal.appendChild(box); document.body.appendChild(modal);
}

function pushSupported(){
  return "serviceWorker" in navigator && "Notification" in window && !!window.fbMsgGetToken;
}

// État affiché dans Paramètres (bouton "Activer les notifications").
function pushStatus(){
  if(!("Notification" in window)) return "unsupported";
  return Notification.permission; // "granted"|"denied"|"default"
}

async function enablePushNotifications(){
  if(pushIosAInstaller()){ pushTutoIphone(); return; }
  if(GM_FCM_VAPID_KEY.indexOf("REMPLACER")>=0){ askAlert("Notifications pas encore configurées côté serveur."); return; }
  if(!("serviceWorker" in navigator) || !("Notification" in window)){ askAlert("Les notifications ne sont pas disponibles sur cet appareil/navigateur."); return; }
  if(!window.CURRENT_CLUB_ID || !window.ASMB_USER){ askAlert("Connexion en cours, réessayez dans un instant."); return; }
  try{
    var perm=await Notification.requestPermission();
    if(perm!=="granted"){ showToast(perm==="denied"?"Notifications refusées (modifiable dans les réglages du navigateur).":"Notifications non activées."); return; }
    if(!window.fbMsgGetToken){ askAlert("Notifications non supportées sur ce navigateur."); return; }
    var reg=await navigator.serviceWorker.ready;
    var token=await window.fbMsgGetToken(reg,GM_FCM_VAPID_KEY);
    if(!token){ askAlert("Impossible d'obtenir un abonnement push."); return; }
    await window.fbSetDoc(window.fbDoc(window.fbDb,"push_subscriptions",window.ASMB_USER.uid), {
      token: token,
      uid: window.ASMB_USER.uid,
      updatedAt: window.fbServerTimestamp()
    });
    try{ localStorage.removeItem("gm_push_off"); }catch(e){}
    showToast("Notifications activées ✓");
    refreshPushButton();
  }catch(e){
    console.log("enablePushNotifications:",e);
    askAlert("Impossible d'activer les notifications : "+((e&&e.message)||e));
  }
}

async function disablePushNotifications(){
  if(!window.ASMB_USER) return;
  try{
    if(window.fbMsgDeleteToken) await window.fbMsgDeleteToken().catch(function(){});
    await window.fbDeleteDoc(window.fbDoc(window.fbDb,"push_subscriptions",window.ASMB_USER.uid)).catch(function(){});
    try{ localStorage.setItem("gm_push_off","1"); }catch(e){}
    showToast("Notifications désactivées");
    refreshPushButton();
  }catch(e){ console.log("disablePushNotifications:",e); }
}

// ── Abonnement du club : automatique, sans que la personne ait à le chercher ──
// Cas réel : la permission du navigateur est déjà accordée (autre alerte, autre
// compte) mais aucun abonnement n'existe pour CE club, donc aucun message ne
// part. À chaque ouverture, si la permission est accordée et que la personne
// n'a pas désactivé volontairement, on (ré)enregistre l'appareil. Sinon, une
// seule invitation à activer, jamais répétée plus d'une fois par semaine.
async function pushAutoClub(){
  try{
    if(!pushSupported()||!window.ASMB_USER||!window.CURRENT_CLUB_ID||window.SUPPORT_MODE) return;
    if(GM_FCM_VAPID_KEY.indexOf("REMPLACER")>=0) return;
    if(localStorage.getItem("gm_push_off")) return;
    var st=pushStatus();
    if(st==="granted"){
      var reg=await navigator.serviceWorker.ready;
      var token=await window.fbMsgGetToken(reg,GM_FCM_VAPID_KEY);
      if(!token) return;
      await window.fbSetDoc(window.fbDoc(window.fbDb,"push_subscriptions",window.ASMB_USER.uid),
        {token:token,uid:window.ASMB_USER.uid,updatedAt:window.fbServerTimestamp()});
      refreshPushButton();
    } else if(st==="default"||pushIosAInstaller()){
      var vu=parseInt(localStorage.getItem("gm_push_invite")||"0",10);
      if(Date.now()-vu<7*24*3600*1000) return;
      localStorage.setItem("gm_push_invite",String(Date.now()));
      pushInviter();
    }
  }catch(e){ console.log("pushAutoClub:",e); }
}
function pushInviter(){
  var modal=document.createElement("div");
  modal.className="alert-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:20px";
  var box=document.createElement("div");
  box.style.cssText="background:#fff;border-radius:18px;padding:20px 18px 16px;width:100%;max-width:340px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center";
  box.innerHTML='<div style="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:6px">Reçois les messages du club</div>'+
    '<div style="font-size:12.5px;color:var(--txt2);line-height:1.45;margin-bottom:14px">Active les notifications pour être prévenu d\'un nouveau message, même quand ton téléphone est verrouillé.</div>';
  var ok=document.createElement("button");
  ok.textContent="Activer les notifications";
  ok.style.cssText="width:100%;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;color:#fff;cursor:pointer;background:var(--dkg)";
  var non=document.createElement("button");
  non.textContent="Plus tard";
  non.style.cssText="width:100%;margin-top:6px;padding:10px;background:none;border:none;color:var(--mut);font-size:12px;font-weight:700;cursor:pointer";
  ok.addEventListener("click",function(){ modal.remove(); enablePushNotifications(); });
  non.addEventListener("click",function(){ modal.remove(); });
  box.appendChild(ok); box.appendChild(non); modal.appendChild(box); document.body.appendChild(modal);
}

// Repeint le bouton là où il est affiché (voir buildParametres).
function refreshPushButton(){
  var btn=document.getElementById("push-toggle-btn");
  if(!btn) return;
  var st=pushStatus();
  if(st==="granted"){
    btn.textContent="🔕 Désactiver les notifications";
    btn.onclick=disablePushNotifications;
  } else if(st==="denied"){
    btn.textContent="Notifications bloquées (réglages du navigateur)";
    btn.disabled=true;
  } else {
    btn.textContent="🔔 Activer les notifications";
    btn.disabled=false;
    btn.onclick=enablePushNotifications;
  }
}

// ── Alertes Plateforme (super admin) ────────────────────────────────
// Abonnement push rattaché à la Plateforme (collection globale plateforme_push),
// pas à un club : les demandes d'essai arrivent même hors du club ASMB.
function pfPushEtat(btn){
  var st=pushStatus();
  if(st==="granted"){ btn.textContent="🔕 Couper"; btn.onclick=pfPushOff; pfPushSync(); }
  else if(st==="denied"){ btn.textContent="Bloquées"; btn.disabled=true; }
  else { btn.textContent="Activer les alertes"; btn.onclick=pfPushOn; }
}
async function pfPushOn(){
  if(pushIosAInstaller()){ pushTutoIphone(); return; }
  if(!pushSupported()){ askAlert("Les notifications ne sont pas disponibles sur cet appareil/navigateur."); return; }
  if(!window.ASMB_USER){ askAlert("Connexion en cours, réessayez dans un instant."); return; }
  try{
    var perm=await Notification.requestPermission();
    if(perm!=="granted"){ showToast("Notifications non activées."); return; }
    var reg=await navigator.serviceWorker.ready;
    var token=await window.fbMsgGetToken(reg,GM_FCM_VAPID_KEY);
    if(!token){ askAlert("Impossible d'obtenir un abonnement push."); return; }
    await window.fbSetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid),{token:token,uid:window.ASMB_USER.uid,ua:(navigator.userAgent||"").slice(0,200),updatedAt:window.fbServerTimestamp()});
    showToast("Alertes Plateforme activées ✓");
    var b=document.getElementById("pf-push-btn"); if(b) pfPushEtat(b);
  }catch(e){ askAlert("Impossible d'activer les alertes : "+((e&&e.message)||e)); }
}
async function pfPushOff(){
  try{
    await window.fbDeleteDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid)).catch(function(){});
    showToast("Alertes Plateforme coupées");
    var b=document.getElementById("pf-push-btn"); if(b){ b.textContent="Activer les alertes"; b.onclick=pfPushOn; }
  }catch(e){}
}

// Permission déjà accordée (ex. pour le club) : on enregistre quand même cet appareil
// côté Plateforme, et on rafraîchit le jeton à chaque ouverture.
async function pfPushSync(){
  try{
    if(!pushSupported()||!window.ASMB_USER||GM_FCM_VAPID_KEY.indexOf("REMPLACER")>=0) return;
    var reg=await navigator.serviceWorker.ready;
    var token=await window.fbMsgGetToken(reg,GM_FCM_VAPID_KEY);
    if(!token) return;
    await window.fbSetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid),{token:token,uid:window.ASMB_USER.uid,ua:(navigator.userAgent||"").slice(0,200),updatedAt:window.fbServerTimestamp()});
  }catch(e){ console.log("pfPushSync:",e); }
}

// Diagnostic affiché sous la cloche : l'appareil est-il enregistré côté Plateforme ?
// « Tester » demande à la fonction d'envoyer une vraie notif et affiche son résultat.
async function pfPushDiag(el){
  if(!el) return;
  var etat="";
  try{
    var s=await window.fbGetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid));
    if(s&&s.exists&&s.exists()){
      var d=s.data()||{}, ua=d.ua||"", t=d.updatedAt&&d.updatedAt.toMillis?d.updatedAt.toMillis():0;
      var os=/Android/i.test(ua)?"Android":/iPhone|iPad/i.test(ua)?"iPhone/iPad":/Windows/i.test(ua)?"Windows":/Mac/i.test(ua)?"Mac":"appareil inconnu";
      var nav=/Brave/i.test(ua)?"Brave":/Edg\//i.test(ua)?"Edge":/Firefox/i.test(ua)?"Firefox":/Chrome/i.test(ua)?"Chrome":/Safari/i.test(ua)?"Safari":"";
      var min=t?Math.max(0,Math.round((Date.now()-t)/60000)):null;
      etat="Appareil enregistré : "+os+(nav?" · "+nav:"")+(min!==null?" · il y a "+(min<60?min+" min":Math.round(min/60)+" h"):"")+".";
    } else etat="Aucun appareil enregistré : appuie sur « Activer les alertes ».";
  }catch(e){ etat="Lecture impossible (règles Firestore publiées ?)."; }
  el.textContent=etat;
}
async function pfPushTester(btn){
  var el=document.getElementById("pf-push-diag");
  btn.disabled=true; var txt=btn.textContent; btn.textContent="Envoi…";
  try{
    var ref=await window.fbAddDoc(window.fbCollection(window.fbDb,"plateforme_ping"),{at:new Date()});
    var res=null;
    for(var i=0;i<10&&!res;i++){
      await new Promise(function(r){ setTimeout(r,1000); });
      var s=await window.fbGetDoc(ref);
      var d=s&&s.exists&&s.exists()?s.data():null;
      if(d&&typeof d.ok==="boolean") res=d;
    }
    if(!res) el.textContent="Pas de réponse du serveur : les fonctions sont-elles déployées (firebase deploy --only functions) ?";
    else if(res.ok) el.textContent="Envoyé ✓ : la notif doit apparaître sur l'appareil enregistré. Si rien n'arrive, c'est le téléphone (notifications du navigateur ou de l'appli bloquées).";
    else el.textContent="Échec : "+res.erreur;
  }catch(e){ el.textContent="Erreur : "+((e&&e.code)||e); }
  btn.disabled=false; btn.textContent=txt;
}

// Test des notifications du club sur CET appareil : le serveur cherche l'abonnement
// de la personne, envoie une vraie notification et dit précisément ce qui bloque.
async function pushTesterClub(btn){
  var el=document.getElementById("push-club-diag");
  if(!el||!window.ASMB_USER) return;
  btn.disabled=true; var txt=btn.textContent; btn.textContent="Envoi…";
  var etape="";
  try{
    etape="1/4 abonnement de cet appareil";
    await pushAutoClub();
    var uid=window.ASMB_USER.uid;
    etape="2/4 lecture de l'abonnement";
    var sub=await window.fbGetDoc(window.fbDoc(window.fbDb,"push_subscriptions",uid));
    if(!(sub&&sub.exists&&sub.exists())){ el.textContent="Aucun abonnement enregistré pour ce compte : active les notifications (autorise-les sur le téléphone) puis relance."; btn.disabled=false; btn.textContent=txt; return; }
    etape="3/4 envoi du test (push_ping)";
    var ref=await window.fbAddDoc(window.fbCollection(window.fbDb,"push_ping"),{at:new Date(),uid:uid});
    etape="4/4 réponse du serveur";
    var res=null;
    for(var i=0;i<12&&!res;i++){
      await new Promise(function(r){ setTimeout(r,1000); });
      var s=await window.fbGetDoc(ref);
      var d=s&&s.exists&&s.exists()?s.data():null;
      if(d&&typeof d.ok==="boolean") res=d;
    }
    if(!res) el.textContent="Pas de réponse du serveur : les fonctions sont-elles déployées ?";
    else if(res.ok) el.textContent="Envoyé ✓ Si rien n'apparaît sur cet appareil, regarde les réglages de notifications du téléphone pour cette appli.";
    else el.textContent="Échec : "+res.erreur;
  }catch(e){ el.textContent="Erreur à l'étape "+etape+" : "+((e&&e.code)||e); }
  btn.disabled=false; btn.textContent=txt;
}
