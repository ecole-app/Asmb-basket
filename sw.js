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
  './version.json',
  './css/style.css',
  './img/logo.png',
  './favicon.ico',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon-180.png',
  './js/sw-register.js',
  './js/firebase-init.js',
  './js/01-config.js',
  './js/02-formation-cycles.js',
  './js/02b-formation-u15.js',
  './js/03-nav-portal.js',
  './js/04-formation-ui.js',
  './js/05-animations.js',
  './js/06-licences.js',
  './js/07-presences.js',
  './js/08-parametres.js',
  './js/09-ui-modales.js',
  './js/10-annuaire-galerie.js',
  './js/11-admin.js',
  './js/12-equipes-planning.js',
  './js/13-firestore-sync.js',
  './js/14-evenements.js',
  './js/15-compta-inventaire.js',
  './js/16-communaute.js',
  './js/17-poles.js',
  './js/18-auth.js',
  './js/19-profils.js',
  './js/20-parent-tabs.js',
  './js/20b-plateforme.js',
  './js/21-main.js'
];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // addAll échoue si une ressource manque ; on précache une par une pour être tolérant.
      // cache:'reload' contourne le cache HTTP du navigateur : sans ça, une nouvelle version
      // peut se precacher avec les anciens fichiers encore valides cote HTTP.
      return Promise.all(PRECACHE.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' }))
          .catch(function () { return cache.add(url).catch(function () { /* ressource absente */ }); });
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
