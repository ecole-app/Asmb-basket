/* ===== sw-register.js — Enregistrement du service worker (hors-ligne) ===== */
// Service worker : lancement hors-ligne, piloté par la version (jamais bloqué sur une vieille version)
if('serviceWorker' in navigator){
  // Aucun rechargement automatique : quand une nouvelle version existe, le bandeau
  // « Nouvelle version disponible » reste affiché (js/21-main.js) et c'est la personne
  // qui choisit de mettre à jour (bouton) ou de masquer le message (croix).
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
