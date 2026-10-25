/* ===== 00-i18n.js — Langue de l'appli (français, anglais, arabe, espagnol, italien, allemand) =====
   Chargé en tout premier (dans <head>). Principe :
   - le texte de l'appli reste écrit en français dans le code ;
   - i18n/<langue>.json est un dictionnaire « texte français → traduction » ;
   - à l'affichage, chaque texte de l'écran (et placeholder, title, aria-label, alt) qui est
     dans le dictionnaire est remplacé ; un observateur suit tout ce que l'appli affiche ensuite.
   - Jamais traduit : ce que les gens écrivent (messages, noms...), les champs de saisie,
     et tout ce qui est marqué data-notr / class="notr".
   - Arabe : écran de droite à gauche (dir="rtl").
   Langue : celle choisie (Paramètres, connexion, fiche d'inscription), sinon celle du
   téléphone si elle est proposée, sinon le français. Enregistrée sur l'appareil
   (gm_langue) et sur le compte (users/{uid}.langue).
   Outil : node outils/i18n.js (voir i18n/LISEZMOI.md). */
(function(){
  var LANGUES=[
    {code:"fr",nom:"Français",locale:"fr-FR"},
    {code:"en",nom:"English",locale:"en-GB"},
    {code:"ar",nom:"العربية",locale:"ar-u-nu-latn",rtl:true},
    {code:"es",nom:"Español",locale:"es-ES"},
    {code:"it",nom:"Italiano",locale:"it-IT"},
    {code:"de",nom:"Deutsch",locale:"de-DE"}
  ];
  var CODES=LANGUES.map(function(l){return l.code;});
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function duTelephone(){
    var l=(navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||"fr"]);
    for(var i=0;i<l.length;i++){ var c=String(l[i]||"").slice(0,2).toLowerCase(); if(CODES.indexOf(c)>=0) return c; }
    return "fr";
  }
  var choisie=lsGet("gm_langue");
  var LANG=CODES.indexOf(choisie)>=0?choisie:duTelephone();
  var INFO=LANGUES[CODES.indexOf(LANG)];
  window.GM_LANGUES=LANGUES;
  window.GM_LANG=LANG;
  document.documentElement.lang=LANG;
  // L'appli se traduit elle-même : on interdit la traduction automatique du navigateur
  // (Chrome traduisait « Accueil » en « Maison », « Basket » en « Panier »...).
  document.documentElement.setAttribute("translate","no");
  document.documentElement.classList.add("notranslate");
  document.documentElement.dir=INFO.rtl?"rtl":"ltr";

  // ── Dates : les formats écrits en toutes lettres (jour, mois) suivent la langue.
  // Les formats chiffrés restent en français : certains sont enregistrés tels quels dans les données.
  if(LANG!=="fr"){
    var texte=function(o){ return !!(o&&(o.weekday||o.month==="long"||o.month==="short"||o.era)); };
    var loc=function(l,o){ return (!l||/^fr/i.test(String(l)))&&texte(o)?INFO.locale:l; };
    ["toLocaleDateString","toLocaleString"].forEach(function(m){
      var orig=Date.prototype[m];
      Date.prototype[m]=function(l,o){ return orig.call(this,loc(l,o),o); };
    });
  }

  // ── Dictionnaire
  var DICT={};
  window.gmT=function(s){
    if(LANG==="fr"||s==null) return s;
    var k=String(s).replace(/\s+/g," ").trim();
    return Object.prototype.hasOwnProperty.call(DICT,k)?DICT[k]:s;
  };
  // Traduction d'un texte affiché : correspondance exacte, puis morceaux séparés par « · »,
  // puis texte suivi de « : » ou d'un nombre.
  function traduire(s){
    var brut=String(s), k=brut.replace(/\s+/g," ").trim();
    if(!k||!/[A-Za-zÀ-ÿ]/.test(k)) return null;
    var avant=brut.match(/^\s*/)[0], apres=brut.match(/\s*$/)[0];
    if(Object.prototype.hasOwnProperty.call(DICT,k)) return avant+DICT[k]+apres;
    if(k.indexOf(" · ")>0){
      var parts=k.split(" · "), ok=false;
      parts=parts.map(function(p){ if(Object.prototype.hasOwnProperty.call(DICT,p)){ ok=true; return DICT[p]; } return p; });
      if(ok) return avant+parts.join(" · ")+apres;
    }
    var m=k.match(/^(.*?)(\s*[:：]\s*|\s+)(\d[\d\s.,/\-hH:]*)$/);
    if(m&&Object.prototype.hasOwnProperty.call(DICT,m[1])) return avant+DICT[m[1]]+m[2]+m[3]+apres;
    m=k.match(/^(.*?)\s*:$/);
    if(m&&Object.prototype.hasOwnProperty.call(DICT,m[1])) return avant+DICT[m[1]]+" :"+apres;
    // Texte avec des nombres (« 3 joueurs inscrits », « Match 2 sur 5 ») : on traduit
    // chaque morceau de texte entre les nombres s'il est dans le dictionnaire.
    if(/\d/.test(k)){
      var bouts=k.split(/(\d[\d.,:\/hH]*)/), trouve=false;
      bouts=bouts.map(function(b,i){
        if(i%2) return b;
        var mm=b.match(/^([\s()\[\]«»"'·—–\-:,;.!?]*)(.*?)([\s()\[\]«»"'·—–\-:,;.!?]*)$/);
        if(!mm||!mm[2]||!/[A-Za-zÀ-ÿ]/.test(mm[2])) return b;
        if(Object.prototype.hasOwnProperty.call(DICT,mm[2])){ trouve=true; return mm[1]+DICT[mm[2]]+mm[3]; }
        return b;
      });
      if(trouve) return avant+bouts.join("")+apres;
    }
    return null;
  }
  window.gmTraduireTexte=function(s){ var t=LANG==="fr"?null:traduire(s); return t==null?s:t; };

  var NOTR="[data-notr],.notr,.msg-bubble,.msg-pseudo,textarea,script,style,code,pre,[contenteditable=\"true\"]";
  var ATTRS=["placeholder","title","aria-label","alt"];
  var poses=new WeakMap();   // nœud texte -> dernière valeur posée par nous (évite de boucler)
  function exclu(el){ return !el||!el.closest||!!el.closest(NOTR); }
  function noeudTexte(n){
    var v=n.nodeValue; if(!v||v.length>600) return;
    if(poses.get(n)===v) return;
    var p=n.parentElement; if(!p||exclu(p)) return;
    var t=traduire(v);
    if(t!=null&&t!==v){ poses.set(n,t); n.nodeValue=t; }
  }
  function element(el){
    if(el.nodeType!==1||exclu(el)) return;
    for(var i=0;i<ATTRS.length;i++){
      var a=ATTRS[i], v=el.getAttribute(a);
      if(v&&el.getAttribute("data-tr-"+a)!==v){ var t=traduire(v); if(t!=null&&t!==v){ el.setAttribute("data-tr-"+a,t); el.setAttribute(a,t); } }
    }
    if(el.tagName==="INPUT"&&/^(button|submit)$/i.test(el.type)&&el.value){ var tv=traduire(el.value); if(tv!=null) el.value=tv; }
  }
  function parcourir(racine){
    if(!racine) return;
    if(racine.nodeType===3){ noeudTexte(racine); return; }
    if(racine.nodeType!==1&&racine.nodeType!==9&&racine.nodeType!==11) return;
    if(racine.nodeType===1){ if(exclu(racine)) return; element(racine); }
    var w=document.createTreeWalker(racine,5,null), n;   // éléments + textes
    while((n=w.nextNode())){ if(n.nodeType===3) noeudTexte(n); else element(n); }
  }
  window.gmTraduireDom=function(r){ if(LANG!=="fr") parcourir(r||document.body); };

  if(LANG!=="fr"){
    var pret=false, enAttente=[];
    var obs=new MutationObserver(function(muts){
      if(!pret){ return; }
      for(var i=0;i<muts.length;i++){
        var m=muts[i];
        if(m.type==="characterData") noeudTexte(m.target);
        else if(m.type==="attributes") element(m.target);
        else for(var j=0;j<m.addedNodes.length;j++) parcourir(m.addedNodes[j]);
      }
    });
    obs.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    var v=(window.APP_VERSION_I18N||"");
    fetch("i18n/"+LANG+".json"+(v?"?v="+v:""),{cache:"no-cache"}).then(function(r){ return r.ok?r.json():{}; }).catch(function(){ return {}; })
      .then(function(d){
        DICT=d||{}; pret=true;
        var go=function(){ parcourir(document.body); };
        if(document.body) go(); else document.addEventListener("DOMContentLoaded",go);
      });
  }

  // ── Choix de la langue
  window.gmLangueChoisir=function(code){
    if(CODES.indexOf(code)<0) return;
    lsSet("gm_langue",code); lsSet("gm_langue_choix","1");
    var u=window.ASMB_USER, fini=function(){ location.reload(); };
    if(u&&u.uid&&window.fbUpdateDoc&&window.fbDoc&&window.fbDb){
      var t=setTimeout(fini,1500);
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",u.uid),{langue:code}).catch(function(){}).then(function(){ clearTimeout(t); fini(); });
    } else fini();
  };
  // Compte connecté : la langue du compte suit la personne d'un appareil à l'autre,
  // sauf si elle a choisi une autre langue sur cet appareil (elle est alors recopiée sur le compte).
  window.gmLangueCompte=function(u){
    if(!u||!window.ASMB_USER) return;
    var compte=u.langue, ici=lsGet("gm_langue"), choix=lsGet("gm_langue_choix")==="1";
    if(choix&&ici&&ici!==compte&&window.fbUpdateDoc){
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",window.ASMB_USER.uid),{langue:ici}).catch(function(){});
    } else if(!choix&&CODES.indexOf(compte)>=0&&compte!==LANG){
      lsSet("gm_langue",compte); location.reload();
    } else if(!compte&&window.fbUpdateDoc){
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",window.ASMB_USER.uid),{langue:LANG}).catch(function(){});
    }
  };
  // Menu de choix (liste déroulante). Les noms des langues ne sont jamais traduits.
  window.gmLangueMenu=function(style){
    var s=document.createElement("select");
    s.setAttribute("data-notr",""); s.setAttribute("aria-label","Langue / Language");
    s.className="gm-lang-select";
    if(style) s.style.cssText=style;
    LANGUES.forEach(function(l){ var o=document.createElement("option"); o.value=l.code; o.textContent=l.nom; if(l.code===LANG) o.selected=true; s.appendChild(o); });
    s.addEventListener("change",function(){ window.gmLangueChoisir(s.value); });
    return s;
  };
  // Petit sélecteur flottant (écran de connexion, fiche d'inscription publique)
  window.gmLanguePoser=function(conteneur,enBas){
    if(!conteneur||conteneur.querySelector(".gm-lang-flottant")) return;
    var w=document.createElement("div"); w.className="gm-lang-flottant"; w.setAttribute("data-notr","");
    w.style.cssText=(enBas?"position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));":"position:absolute;top:calc(10px + env(safe-area-inset-top,0px));")+(INFO.rtl?"left":"right")+":12px;z-index:6;display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.92);border:1px solid rgba(0,0,0,.12);border-radius:20px;padding:2px 4px 2px 10px;box-shadow:0 2px 8px rgba(0,0,0,.12)";
    var g=document.createElement("span"); g.textContent="🌐"; g.setAttribute("aria-hidden","true"); g.style.fontSize="14px";
    w.appendChild(g);
    w.appendChild(window.gmLangueMenu("border:0;background:transparent;color:#1a1a1a;font-size:14px;font-weight:700;padding:6px 4px;max-width:140px"));
    if(getComputedStyle(conteneur).position==="static") conteneur.style.position="relative";
    conteneur.insertBefore(w,conteneur.firstChild);
  };
  // Au démarrage : sélecteur flottant sur la connexion (et la création de compte par lien)
  // et sur la fiche d'inscription publique ; liste dans les Paramètres (dirigeant, coach, parent).
  function poserPartout(){
    window.gmLanguePoser(document.getElementById("scr-auth"),true);
    window.gmLanguePoser(document.getElementById("scr-inscription"));
    var cs=document.querySelectorAll(".gm-lang-param");
    for(var i=0;i<cs.length;i++) if(!cs[i].firstChild) cs[i].appendChild(window.gmLangueMenu("width:100%;box-sizing:border-box;padding:11px 12px;border-radius:12px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:16px;font-weight:600"));
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",poserPartout); else poserPartout();
})();
