/* ASMB Basket — Service Worker
   Objectif : permettre le lancement hors-ligne SANS jamais bloquer sur une vieille version.
   Stratégie :
     - index.html + version.json : network-first (on prend le réseau si dispo, sinon le cache).
       Comme ça une nouvelle version est toujours récupérée quand il y a du réseau.
     - le reste (manifest, cdn) : cache-first (rapide, et suffisant hors-ligne).
   Le cache est versionné : à chaque nouvelle version poussée, on change CACHE_NAME
   (via le paramètre ?v= transmis à l'enregistrement), ce qui purge l'ancien cache. */

const VERSION = new URL(self.location).searchParams.get('v') || 'base';
const CACHE_NAME = 'asmb-' + VERSION;

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './version.json'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll échoue si une ressource manque ; on précache une par une pour être tolérant
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(url).catch(function () { /* ignore une ressource absente */ });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
             .map(function (n) { return caches.delete(n); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

function isHtmlOrVersion(url) {
  return url.pathname.endsWith('/') ||
         url.pathname.endsWith('/index.html') ||
         url.pathname.endsWith('index.html') ||
         url.pathname.endsWith('version.json');
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);

  // On ne gère que le même origine ; le reste (Firebase, gstatic, cdn) passe au réseau direct.
  var sameOrigin = url.origin === self.location.origin;

  // Ne jamais mettre en cache Firebase / Firestore (données live)
  if (/firestore|googleapis|firebaseio|gstatic/.test(url.hostname)) {
    return; // laisse le navigateur gérer
  }

  if (sameOrigin && isHtmlOrVersion(url)) {
    // network-first : évite de rester bloqué sur une vieille version
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // cache-first pour le reste des ressources same-origin + cdn statiques
  event.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && res.status === 200 && (sameOrigin || url.protocol === 'https:')) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return hit; });
    })
  );
});
