/* ===== firebase-init.js — Initialisation Firebase (module ES6) ===== */
// ═══ FIREBASE CONFIG ══════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, getToken as acGetToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app-check.js";
import { getFirestore, collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, enableMultiTabIndexedDbPersistence, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { getMessaging, getToken as fbMsgGetToken, deleteToken as fbMsgDeleteToken, isSupported as fbMsgIsSupported, onMessage as fbMsgOnMessage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged, signOut, updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAv5azCx_NU0kgRflnFBetaqqWN7ahi8TQ",
  authDomain: "asmb-app.firebaseapp.com",
  projectId: "asmb-app",
  storageBucket: "asmb-app.firebasestorage.app",
  messagingSenderId: "786817375628",
  appId: "1:786817375628:web:3db013af1adab9e8ab8aa9"
};

const fbApp = initializeApp(firebaseConfig);
window.fbApiKey = firebaseConfig.apiKey;
window.fbProjectId = firebaseConfig.projectId;

// ═══ APP CHECK (anti-bot / anti-brute-force) ══════════════════════
// Protège Firestore contre les scripts qui n'exécutent pas l'appli réelle
// (brute-force de codes buvette/invitation, spam du formulaire d'inscription).
// Clé "Fraud Defense" (ex-reCAPTCHA Enterprise, seule option proposée par la
// console Firebase désormais) à récupérer dans Firebase Console > App Check
// > Apps > Web app. Ne PAS activer le mode "Enforced" sur Firestore côté
// console avant d'avoir vérifié en mode "Monitor" que le trafic légitime
// passe bien (voir APP_CHECK_SETUP.md).
const GM_APPCHECK_SITE_KEY = "6Le30N8tAAAAAGUJks6zaN09Rbn8B6L-cQRC5Jwp";
try{
  if(GM_APPCHECK_SITE_KEY && GM_APPCHECK_SITE_KEY.indexOf("REMPLACER")!==0){
    // Si la vérification reCAPTCHA reste bloquée (appli installée, réseau lent), Firestore attendait
    // sans fin son jeton : écran vide. On abandonne la vérification après 6 s et la requête part quand même.
    class GmProvider extends ReCaptchaEnterpriseProvider {
      getToken(){
        const vrai = super.getToken();
        return Promise.race([vrai, new Promise(function(_, rejeter){
          setTimeout(function(){ window.__gmDiag=(window.__gmDiag||"")+" appcheck-delai"; rejeter(new Error("App Check : délai dépassé")); }, 6000);
        })]);
      }
    }
    const gmAppCheck = initializeAppCheck(fbApp, {
      provider: new GmProvider(GM_APPCHECK_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
    // Jeton App Check pour les appels REST (Gemini via Firebase AI Logic).
    window.fbAppCheckToken = function(){ return acGetToken(gmAppCheck,false).then(function(r){ return r&&r.token||""; }).catch(function(){ return ""; }); };
  } else {
    console.log("App Check inactif : clé Fraud Defense non configurée (voir APP_CHECK_SETUP.md)");
  }
}catch(e){ console.log("App Check init:", e&&e.code||e); }

const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
window.fbStorageRef = storageRef;
window.fbUploadBytes = uploadBytes;
window.fbGetDownloadURL = getDownloadURL;
window.fbStorage = storage;

// ── Authentification (comptes réels e-mail/mot de passe) ──
const auth = getAuth(fbApp);
setPersistence(auth, browserLocalPersistence).catch(function(e){console.log("Persistance auth:",e&&e.code);});
window.fbAuth = auth;
window.fbCreateUser = createUserWithEmailAndPassword;
window.fbSignIn = signInWithEmailAndPassword;
window.fbSendReset = sendPasswordResetEmail;
window.fbOnAuthState = onAuthStateChanged;
window.fbSignOut = signOut;
window.fbUpdatePassword = updatePassword;
window.fbUpdateEmail = updateEmail;
window.fbReauth = reauthenticateWithCredential;
window.fbEmailAuthProvider = EmailAuthProvider;
window.fbAuthReady = true;

// Persistance hors-ligne : garde les derniers messages/canaux consultes visibles sans reseau
// Multi-onglets : le site dans Chrome et l'appli installée partagent la même copie locale.
// Avec la version mono-onglet, le 2e à s'ouvrir restait sans réponse de la base (écran vide).
enableMultiTabIndexedDbPersistence(db).catch(function(err){
  window.__gmDiag=(window.__gmDiag||"")+" persistance("+err.code+")";
  console.log("Persistance hors-ligne indisponible:", err.code);
});

// Expose to window for use in main script
window.fbDb = db;
window.fbGetDoc = getDoc;
window.fbWhere = where;
window.fbAddDoc = addDoc;
window.fbQuery = query;
window.fbOrderBy = orderBy;
window.fbLimit = limit;
window.fbOnSnapshot = onSnapshot;
window.fbServerTimestamp = serverTimestamp;
window.fbSetDoc = setDoc;
window.fbGetDocs = getDocs;
window.fbUpdateDoc = updateDoc;
window.fbDeleteDoc = deleteDoc;
window.fbArrayUnion = arrayUnion;
window.fbArrayRemove = arrayRemove;
// Ecriture groupée atomique (tout passe ou rien) — utilisée pour les invitations à usage unique
window.fbWriteBatch = function(){ return writeBatch(db); };

// ═══ MULTI-CLUB : cloisonnement automatique des données ══════════════
// Toutes les données d'un club vivent sous clubs/{clubId}/... .
// Plutôt que de modifier chaque appel dans l'application (~110), les deux points
// d'entrée fbCollection/fbDoc préfixent eux-mêmes le chemin quand la collection
// demandée appartient à un club. Oublier un appel est donc impossible.
//
// Collections GLOBALES (hors club) : users, clubs, inscription_codes,
// club_invites (invitations), support_grants (codes d'accès support),
// buvette_codes (codes d'accès caisse buvette).
// Toute autre collection est traitée comme donnée de club.
const GLOBAL_COLLECTIONS = new Set(["users","clubs","inscription_codes","club_invites","support_grants","buvette_codes","comptes_a_supprimer","plateforme_push","plateforme_config","plateforme_ping","demandes_essai","avis_plateforme","essai_pages","evt_pages","evt_entrees","trn_pages","trn_matchs","trn_inscriptions","trn_live","trn_equipes","indep_liens","ben_pass","pf_compta"]);

function requireClubId(coll){
  const id = window.CURRENT_CLUB_ID;
  if(!id){
    // Echec volontairement bruyant : écrire sans club actif risquerait de mélanger
    // les données de plusieurs clubs.
    throw new Error("Aucun club actif pour accéder à '"+coll+"'");
  }
  return id;
}
window.fbCollection = function(dbRef, coll, ...rest){
  if(GLOBAL_COLLECTIONS.has(coll)) return collection(dbRef, coll, ...rest);
  return collection(dbRef, "clubs", requireClubId(coll), coll, ...rest);
};
window.fbDoc = function(dbRef, coll, ...rest){
  if(GLOBAL_COLLECTIONS.has(coll)) return doc(dbRef, coll, ...rest);
  return doc(dbRef, "clubs", requireClubId(coll), coll, ...rest);
};
window.fbHasClub = function(){ return !!window.CURRENT_CLUB_ID; };
window.fbGlobalCollectionNames = GLOBAL_COLLECTIONS;
window.fbReady = true;

// Canaux par défaut, créés une seule fois pour chaque club (génériques :
// les canaux d'équipe sont créés à la création des équipes, pas ici).
window.fbInitClubChannels = async function(clubId){
  if(!clubId) return;
  const channels = [
    {id:"general",    name:"Général",    icon:"", desc:"Canal principal du club", clubWide:true},
    {id:"coaches",    name:"Coachs",     icon:"", desc:"Staff et encadrants"},
    {id:"evenements", name:"Événements", icon:"", desc:"Annonces et événements", clubWide:true},
  ];
  try{
    for(const ch of channels){
      const ref = doc(db,"clubs",clubId,"channels",ch.id);
      const snap = await getDoc(ref);
      if(!snap.exists()) await setDoc(ref, ch);
    }
  }catch(e){ console.log("Init canaux club:", e&&e.code||e); }
};

// ═══ NOTIFICATIONS PUSH (Firebase Cloud Messaging) — voir js/22-push.js ═══
// isSupported() : false sur Safari/iOS < 16.4, navigation privée Firefox, etc.
// On ne tente getMessaging() que si c'est supporté pour éviter une exception
// qui casserait l'initialisation Firebase pour tout le reste de l'app.
fbMsgIsSupported().then(function(ok){
  if(!ok) return;
  var messaging=getMessaging(fbApp);
  window.fbMessaging=messaging;
  window.fbMsgGetToken=function(swReg,vapidKey){
    return fbMsgGetToken(messaging,{vapidKey:vapidKey,serviceWorkerRegistration:swReg});
  };
  window.fbMsgDeleteToken=function(){ return fbMsgDeleteToken(messaging); };
  // Appli ouverte au premier plan : FCM ne montre rien tout seul. Les alertes Plateforme
  // (test, demande d'essai, compte dirigeant validé) s'affichent quand même comme notification.
  fbMsgOnMessage(messaging,function(payload){
    try{
      var n=(payload&&payload.notification)||{};
      // Message d'une conversation : pas de bannière si on est déjà dedans à l'écran.
      var conv=payload&&payload.data&&payload.data.conv;
      if(conv && window.currentChannelId===conv && document.visibilityState==="visible") return;
      navigator.serviceWorker.ready.then(function(reg){
        reg.showNotification(n.title,{body:n.body||"",icon:"./icon-192.png",badge:"./badge-96.png",data:{url:"./"}});
      });
    }catch(e){}
  });
}).catch(function(e){ console.log("FCM isSupported:",e); });

window.dispatchEvent(new Event("fb-ready"));
