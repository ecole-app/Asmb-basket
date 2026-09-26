/* ===== sw-register.js — Enregistrement du service worker (hors-ligne) ===== */
// Service worker : lancement hors-ligne, piloté par la version (jamais bloqué sur une vieille version)
if('serviceWorker' in navigator){
  // Quand un nouveau service worker prend la main, la page affiche encore les fichiers
  // de l'ancienne version : on recharge une fois pour repartir sur les nouveaux.
  var hadController = !!navigator.serviceWorker.controller, reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', function(){
    if(!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  window.addEventListener('load', function(){
    fetch('./version.json?t='+Date.now(),{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(d){
        var v=(d&&d.v)?d.v:'base';
        navigator.serviceWorker.register('./sw.js?v='+v).catch(function(){});
      })
      .catch(function(){
        // hors-ligne au premier chargement : on tente quand meme d'enregistrer
        navigator.serviceWorker.register('./sw.js').catch(function(){});
      });
  });
}
