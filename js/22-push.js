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
var GM_FCM_VAPID_KEY = "REMPLACER_PAR_LA_CLE_WEB_PUSH_FIREBASE";

function pushSupported(){
  return "serviceWorker" in navigator && "Notification" in window && !!window.fbMsgGetToken;
}

// État affiché dans Paramètres (bouton "Activer les notifications").
function pushStatus(){
  if(!("Notification" in window)) return "unsupported";
  return Notification.permission; // "granted"|"denied"|"default"
}

async function enablePushNotifications(){
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
