// Service worker de la page /fil : reçoit les notifications push (FCM) d'une personne sans compte.
// Aucune mise en cache ici. Les envois contiennent déjà un bloc « notification » avec le lien du fil :
// Firebase l'affiche et ouvre le lien au toucher.
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey: "AIzaSyAv5azCx_NU0kgRflnFBetaqqWN7ahi8TQ",
  authDomain: "asmb-app.firebaseapp.com",
  projectId: "asmb-app",
  storageBucket: "asmb-app.firebasestorage.app",
  messagingSenderId: "786817375628",
  appId: "1:786817375628:web:3db013af1adab9e8ab8aa9"
});
try { firebase.messaging(); } catch (e) {}
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });
