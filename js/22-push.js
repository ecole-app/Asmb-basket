/* ===== 22-push.js — Notifications push (nouveaux messages Communauté) =====
   Chaîne : navigateur s'abonne (VAPID) → abonnement stocké dans Firestore
   (clubs/{clubId}/push_subscriptions/{uid}) → au moment d'envoyer un message,
   l'app appelle l'API Vercel GM_PUSH_API_URL, qui lit ces abonnements et
   pousse la notif via web-push. Rien de tout ça ne touche Firestore côté
   lecture pour les autres membres : un abonnement n'est lisible que par son
   propriétaire et par le serveur (clé Admin, hors règles).
*/

// Clé publique VAPID (publique par nature, sans risque dans le code client).
// La clé privée ne vit QUE côté Vercel (variable d'environnement).
var GM_VAPID_PUBLIC_KEY = "BI0Fd28SysaS1MT6jS_EOjlSG80abhtrte9cS2bPfgIrLvLghBmmyaOj1QfS5ovTdYuVj9Gl3KC6tvpKXMTRjDI";
// URL de la fonction Vercel qui envoie les push (à remplacer une fois le
// projet Vercel créé — voir PUSH_SETUP.md à la racine du repo).
var GM_PUSH_API_URL = "https://REMPLACER-vercel-app.vercel.app/api/send-push";

function urlBase64ToUint8Array(base64String){
  var padding="=".repeat((4-base64String.length%4)%4);
  var base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
  var raw=atob(base64), out=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++) out[i]=raw.charCodeAt(i);
  return out;
}

function pushSupported(){
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// État affiché dans Paramètres / Communauté (bouton "Activer les notifications").
function pushStatus(){
  if(!pushSupported()) return "unsupported";
  return (typeof Notification!=="undefined") ? Notification.permission : "unsupported"; // "granted"|"denied"|"default"
}

async function enablePushNotifications(){
  if(!pushSupported()){ askAlert("Les notifications ne sont pas disponibles sur cet appareil/navigateur."); return; }
  if(!window.CURRENT_CLUB_ID || !window.ASMB_USER){ askAlert("Connexion en cours, réessayez dans un instant."); return; }
  try{
    var perm=await Notification.requestPermission();
    if(perm!=="granted"){ showToast(perm==="denied"?"Notifications refusées (modifiable dans les réglages du navigateur).":"Notifications non activées."); return; }
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.subscribe({
      userVisibleOnly:true,
      applicationServerKey:urlBase64ToUint8Array(GM_VAPID_PUBLIC_KEY)
    });
    await window.fbSetDoc(window.fbDoc(window.fbDb,"push_subscriptions",window.ASMB_USER.uid), {
      subscription: sub.toJSON(),
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
    var reg=await navigator.serviceWorker.ready;
    var sub=await reg.pushManager.getSubscription();
    if(sub) await sub.unsubscribe();
    await window.fbDeleteDoc(window.fbDoc(window.fbDb,"push_subscriptions",window.ASMB_USER.uid)).catch(function(){});
    showToast("Notifications désactivées");
    refreshPushButton();
  }catch(e){ console.log("disablePushNotifications:",e); }
}

// Repeint le bouton là où il est affiché (voir buildParametres / Communauté).
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

// Appelée juste après l'écriture d'un message en base (voir sendMsg/16-communaute.js).
// Fire-and-forget : un échec réseau ici ne doit jamais bloquer l'envoi du message.
function notifyChannelPush(channelId, text, authorUid){
  if(!GM_PUSH_API_URL || GM_PUSH_API_URL.indexOf("REMPLACER")>=0) return; // pas encore configuré
  if(!window.CURRENT_CLUB_ID) return;
  fetch(GM_PUSH_API_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      clubId:window.CURRENT_CLUB_ID,
      channelId:channelId,
      excludeUid:authorUid||null,
      title:clubLabel("Nouveau message"),
      body:(text||"").slice(0,120)
    })
  }).catch(function(e){ console.log("notifyChannelPush:",e); });
}
