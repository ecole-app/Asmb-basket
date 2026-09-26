/* ===== firebase-init.js — Initialisation Firebase (module ES6) ===== */
// ═══ FIREBASE CONFIG ══════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, enableIndexedDbPersistence, writeBatch } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
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
enableIndexedDbPersistence(db).catch(function(err){
  console.log("Persistance hors-ligne indisponible:", err.code);
});

// Expose to window for use in main script
window.fbDb = db;
window.fbGetDoc = getDoc;
window.fbWhere = where;
window.fbAddDoc = addDoc;
window.fbQuery = query;
window.fbOrderBy = orderBy;
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
// Collections GLOBALES (hors club) : users, clubs, phone_index, inscription_codes,
// club_invites (invitations), support_grants (codes d'accès support).
// Toute autre collection est traitée comme donnée de club.
const GLOBAL_COLLECTIONS = new Set(["users","clubs","phone_index","inscription_codes","club_invites","support_grants"]);

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

window.dispatchEvent(new Event("fb-ready"));
