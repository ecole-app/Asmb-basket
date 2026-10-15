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
    showToast("Notifications désactivées");
    refreshPushButton();
  }catch(e){ console.log("disablePushNotifications:",e); }
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
    await window.fbSetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid),{token:token,uid:window.ASMB_USER.uid,updatedAt:window.fbServerTimestamp()});
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
    await window.fbSetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid),{token:token,uid:window.ASMB_USER.uid,updatedAt:window.fbServerTimestamp()});
  }catch(e){ console.log("pfPushSync:",e); }
}

// Diagnostic affiché sous la cloche : l'appareil est-il enregistré côté Plateforme ?
// « Tester » demande à la fonction d'envoyer une vraie notif et affiche son résultat.
async function pfPushDiag(el){
  if(!el) return;
  var etat="";
  try{
    var s=await window.fbGetDoc(window.fbDoc(window.fbDb,"plateforme_push",window.ASMB_USER.uid));
    etat=(s&&s.exists&&s.exists())?"Un appareil est enregistré pour les alertes.":"Aucun appareil enregistré : appuie sur « Activer les alertes ».";
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
