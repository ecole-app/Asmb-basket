/* ===== 00-demo.js — Mode démo (?demo=1), chargé en tout premier =====
   Le mode démo fait tourner la vraie appli sur un club fictif, sans Firebase :
   - le stockage local est remplacé par une copie en mémoire, pour ne jamais
     lire ni écraser les données réelles du navigateur ;
   - Firebase, le service worker et les notifications ne sont pas chargés ;
   - tout disparaît à la fermeture de la page.
   Les données fictives sont créées par js/20c-demo.js. */
(function(){
  if(!/[?&]demo(=|&|$)/.test(location.search)) return;
  var m={};
  var shim={
    getItem:function(k){ return Object.prototype.hasOwnProperty.call(m,k)?m[k]:null; },
    setItem:function(k,v){ m[k]=String(v); },
    removeItem:function(k){ delete m[k]; },
    clear:function(){ m={}; },
    key:function(i){ return Object.keys(m)[i]||null; }
  };
  Object.defineProperty(shim,"length",{get:function(){ return Object.keys(m).length; }});
  try{ Object.defineProperty(window,"localStorage",{configurable:true,get:function(){ return shim; }}); }catch(e){}
  // Si le navigateur refuse de remplacer le stockage, on ne lance PAS la démo :
  // elle écraserait les vraies données du club sur cet appareil.
  var ok=false;
  try{ ok=(window.localStorage===shim); }catch(e){}
  window.GM_DEMO=ok;
  window.GM_DEMO_REFUSEE=!ok;
})();
