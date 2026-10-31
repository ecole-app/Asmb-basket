/* ===== 00b-erreurs.js — Alerte des bugs =====
   Chargé en premier : attrape les erreurs JavaScript non gérées (et les promesses rejetées)
   chez les utilisateurs et les envoie dans erreurs_app (collection globale, création seule).
   La fonction onErreurApp (functions/index.js) les regroupe par signature dans erreurs_sig
   et prévient le super admin (au plus une alerte par bug et par jour) ; la Plateforme les liste.
   Bornes : 5 erreurs par ouverture de l'appli, une seule fois chaque erreur, bruit ignoré
   (réseau coupé, extensions du navigateur, « Script error. » sans détail). */
(function(){
  var envoyes=0, vus={}, file=[], essais=0;
  function txt(s,n){ return String(s==null?"":s).slice(0,n); }
  function bruit(m,src){
    return !m || /Script error\.?$|ResizeObserver loop|Failed to fetch|Load failed|NetworkError|network ?error|net::ERR|AbortError|The operation was aborted|chrome-extension:|moz-extension:|safari-(web-)?extension:|webkit-masked-url/i.test(m+" "+(src||""));
  }
  function role(){ var r=window.ASMB_USER&&window.ASMB_USER.roles; return txt(r&&r[0]||"",20); }
  function vider(){
    if(!file.length) return;
    if(!window.fbAddDoc||!window.fbDb||!window.fbCollection){ if(++essais<12) setTimeout(vider,5000); return; }
    while(file.length){
      var e=file.shift();
      e.v=txt(window.APP_VERSION||"",20); e.club=txt(window.CURRENT_CLUB_ID||"",60); e.role=role();
      e.ua=txt(navigator.userAgent,200); e.at=window.fbServerTimestamp();
      try{ window.fbAddDoc(window.fbCollection(window.fbDb,"erreurs_app"),e).catch(function(){}); }catch(x){}
    }
  }
  function noter(m,src,l,c,pile){
    m=txt(m,300); src=txt(String(src||"").replace(location.origin,""),200);
    if(bruit(m,src)) return;
    var cle=m+"|"+src+"|"+l;
    if(vus[cle]||envoyes>=5) return;
    vus[cle]=1; envoyes++;
    file.push({msg:m,src:src,ligne:Math.max(0,Math.min(1e7,Number(l)||0)),col:Math.max(0,Math.min(1e7,Number(c)||0)),
      pile:txt(pile,1500),page:txt(location.pathname+location.hash,200)});
    setTimeout(vider,0);
  }
  window.addEventListener("error",function(ev){
    if(ev.target&&ev.target!==window) return; // image ou script qui ne charge pas : pas un bug de code
    noter(ev.message,ev.filename,ev.lineno,ev.colno,ev.error&&ev.error.stack);
  },true);
  window.addEventListener("unhandledrejection",function(ev){
    var r=ev.reason; noter((r&&(r.message||r.code))||String(r),"",0,0,r&&r.stack);
  });
  // Pour signaler à la main une erreur attrapée par un try/catch : gmSignalerErreur(e, "contexte").
  window.gmSignalerErreur=function(e,ou){ noter((ou?ou+" : ":"")+((e&&(e.message||e.code))||String(e)),"",0,0,e&&e.stack); };
})();
