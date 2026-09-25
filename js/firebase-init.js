/* ===== firebase-init.js — Initialisation Firebase (module ES6) ===== */
// ═══ FIREBASE CONFIG ══════════════════════════════════════════════
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc, getDocs, updateDoc, deleteDoc, arrayUnion, arrayRemove, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
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
window.fbCollection = collection;
window.fbAddDoc = addDoc;
window.fbQuery = query;
window.fbOrderBy = orderBy;
window.fbOnSnapshot = onSnapshot;
window.fbServerTimestamp = serverTimestamp;
window.fbDoc = doc;
window.fbSetDoc = setDoc;
window.fbGetDocs = getDocs;
window.fbUpdateDoc = updateDoc;
window.fbDeleteDoc = deleteDoc;
window.fbArrayUnion = arrayUnion;
window.fbArrayRemove = arrayRemove;
window.fbReady = true;

// Init default channels if needed
async function initChannels(){
  const channels = [
    {id:"general", name:"Général", icon:"", desc:"Canal principal ASMB"},
    {id:"u13f", name:"U13 Féminin", icon:"🏀", desc:"Équipe U13F"},
    {id:"u15", name:"U15", icon:"🏀", desc:"Équipe U15"},
    {id:"seniors", name:"Seniors", icon:"🏀", desc:"Équipe Seniors"},
    {id:"coaches", name:"Coachs", icon:"", desc:"Staff et encadrants"},
    {id:"evenements", name:"Evénements", icon:"", desc:"Annonces et événements"},
  ];
  for(const ch of channels){
    await setDoc(doc(db,"channels",ch.id), ch, {merge:true});
  }
  // Migration: ballon pour les canaux d'equipe, rien pour les canaux generaux
  // (on matche par id ET par nom, pour aussi corriger d'anciens doublons crees avec un id different)
  const noEmojiIds=["general","coaches","evenements"];
  const noEmojiNames=["général","general","coachs","coaches","evenements","evénements","evenement","événement"];
  try{
    const allSnap=await getDocs(collection(db,"channels"));
    for(const d of allSnap.docs){
      const nameNorm=(d.data().name||"").toLowerCase().trim();
      const isGeneral=noEmojiIds.includes(d.id)||noEmojiNames.includes(nameNorm);
      const wanted=isGeneral?"":"🏀";
      if((d.data().icon||"")!==wanted){
        await setDoc(doc(db,"channels",d.id), {icon:wanted}, {merge:true});
      }
    }
  }catch(e){}
  window.dispatchEvent(new Event("fb-ready"));
}
initChannels();
