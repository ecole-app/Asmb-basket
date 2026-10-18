/* ===== 09b-saisie-dates.js — saisie libre des dates (JJ/MM/AAAA) en plus du calendrier ===== */
// Chaque <input type="date"> reçoit, juste après lui, un champ texte « JJ/MM/AAAA » (les barres
// s'ajoutent toutes seules) et un bouton calendrier. L'input d'origine reste la source de vérité,
// caché : sa valeur est toujours « AAAA-MM-JJ », donc tout le code existant (lecture, écriture
// de .value, événements input/change, attributs min/max) marche sans modification.
//  - date complète et valide (dans min/max) → l'input d'origine prend la valeur et émet input + change ;
//  - date incomplète ou invalide → l'input d'origine est vide (les contrôles « date obligatoire » jouent)
//    et le champ passe en rouge.
// Les inputs créés plus tard (fenêtres, createElement…) sont repris par un MutationObserver.
(function(){
  // Désactivé (19/10/2026) : l'affichage en 2 champs cassait la mise en page. Remettre true pour réactiver.
  var GM_DATES_LIBRES=false;
  if(!GM_DATES_LIBRES) return;
  if(typeof document==="undefined" || typeof MutationObserver==="undefined") return;
  var desc=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value");
  var fait=new WeakMap();

  function iso2fr(iso){ var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||""); return m?m[3]+"/"+m[2]+"/"+m[1]:""; }
  // « 30/09/2016 » → « 2016-09-30 » ; vide si la date n'existe pas (31/02, mois 13…).
  function fr2iso(t){
    var m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(t||"").trim()); if(!m) return "";
    var j=+m[1], mo=+m[2], a=+m[3];
    if(a<1000 || mo<1 || mo>12 || j<1) return "";
    var d=new Date(a,mo-1,j);
    if(d.getFullYear()!==a || d.getMonth()!==mo-1 || d.getDate()!==j) return "";
    return m[3]+"-"+m[2]+"-"+m[1];
  }
  // Ne garde que les chiffres et remet les barres ; accepte aussi un collage « 2016-09-30 ».
  function masque(brut){
    brut=String(brut||"");
    var iso=/^(\d{4})-(\d{2})-(\d{2})$/.exec(brut.trim());
    if(iso) return iso[3]+"/"+iso[2]+"/"+iso[1];
    var ch=brut.replace(/\D/g,"").slice(0,8);
    if(ch.length>4) return ch.slice(0,2)+"/"+ch.slice(2,4)+"/"+ch.slice(4);
    if(ch.length>2) return ch.slice(0,2)+"/"+ch.slice(2);
    return ch;
  }
  function dansLimites(el,iso){
    var mn=el.getAttribute("min"), mx=el.getAttribute("max");
    return !((mn && iso<mn) || (mx && iso>mx));
  }
  window.gmDateFr2Iso=fr2iso; window.gmDateIso2Fr=iso2fr;

  function ameliorer(el){
    if(fait.has(el) || el.type!=="date" || !el.parentNode) return;
    var txt=document.createElement("input");
    txt.type="text"; txt.className=(el.className?el.className+" ":"")+"date-txt";
    txt.setAttribute("inputmode","numeric"); txt.setAttribute("autocomplete","off");
    txt.maxLength=10; txt.placeholder="JJ/MM/AAAA";
    var nomChamp=el.getAttribute("aria-label") || ((el.labels && el.labels[0] && el.labels[0].textContent)||"").trim().slice(0,60) || "Date";
    txt.setAttribute("aria-label",nomChamp+" (JJ/MM/AAAA)");
    if(el.disabled) txt.disabled=true;
    if(el.readOnly) txt.readOnly=true;
    var btn=document.createElement("button");
    btn.type="button"; btn.className="date-cal"; btn.textContent="📅";
    btn.setAttribute("aria-label","Ouvrir le calendrier"); btn.title="Calendrier";
    if(!el.showPicker) btn.hidden=true;
    var wrap=document.createElement("span");
    wrap.className="date-wrap";
    ["flex","width","maxWidth","minWidth","marginTop","marginBottom","marginLeft","marginRight"].forEach(function(k){ if(el.style[k]) wrap.style[k]=el.style[k]; });
    wrap.appendChild(txt); wrap.appendChild(btn);
    el.insertAdjacentElement("afterend",wrap);
    // L'input d'origine reste dans le DOM (il porte la valeur) mais n'est plus visible ni focusable.
    el.setAttribute("tabindex","-1"); el.setAttribute("aria-hidden","true");
    el.style.cssText+=";position:absolute;opacity:0;pointer-events:none;width:1px;height:1px;margin:0;padding:0;border:0;overflow:hidden";
    fait.set(el,{wrap:wrap});

    var syncing=false;
    function majTxt(){ txt.value=iso2fr(desc.get.call(el)); txt.classList.remove("err"); txt.removeAttribute("title"); }
    function emettre(){
      syncing=true;
      try{ ["input","change"].forEach(function(t){ el.dispatchEvent(new Event(t,{bubbles:true})); }); }
      finally{ syncing=false; }
    }
    // .value = "AAAA-MM-JJ" dans le code existant : le champ texte suit.
    Object.defineProperty(el,"value",{
      configurable:true,
      get:function(){ return desc.get.call(el); },
      set:function(v){ desc.set.call(el,v); majTxt(); }
    });
    el.focus=function(o){ txt.focus(o); };

    txt.addEventListener("input",function(){
      var m=masque(txt.value);
      if(m!==txt.value) txt.value=m;
      var iso=m.length===10?fr2iso(m):"";
      var ok=!!iso && dansLimites(el,iso);
      var nouveau=ok?iso:"";
      var complet=m.length===10;
      txt.classList.toggle("err",complet && !ok);
      if(complet && !ok) txt.title=iso?"Date hors des limites autorisées":"Cette date n'existe pas";
      else txt.removeAttribute("title");
      if(desc.get.call(el)!==nouveau){ desc.set.call(el,nouveau); emettre(); }
    });
    txt.addEventListener("blur",function(){
      if(txt.value && !desc.get.call(el)) txt.classList.add("err");
    });
    // Choix dans le calendrier : le champ texte suit.
    function depuisCalendrier(){ if(!syncing) majTxt(); }
    el.addEventListener("input",depuisCalendrier);
    el.addEventListener("change",depuisCalendrier);
    btn.addEventListener("click",function(){
      if(el.disabled || el.readOnly) return;
      try{ el.showPicker(); }catch(e){}
    });
    new MutationObserver(function(){
      txt.disabled=el.disabled; btn.disabled=el.disabled; txt.readOnly=el.readOnly;
    }).observe(el,{attributes:true,attributeFilter:["disabled","readonly"]});
    if(el.form) el.form.addEventListener("reset",function(){ setTimeout(majTxt,0); });
    majTxt();
  }

  function balayer(n){
    if(n.nodeType!==1) return;
    if(n.matches && n.matches('input[type="date"]')) ameliorer(n);
    if(n.querySelectorAll) n.querySelectorAll('input[type="date"]').forEach(ameliorer);
  }
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      m.addedNodes.forEach(balayer);
      // Un input retiré seul du DOM laisserait son champ texte orphelin : on le retire aussi.
      m.removedNodes.forEach(function(n){
        if(n.nodeType!==1 || !fait.has(n)) return;
        setTimeout(function(){
          if(n.isConnected) return;
          var w=fait.get(n).wrap;
          if(w && w.parentNode) w.parentNode.removeChild(w);
          fait.delete(n);
        },0);
      });
    });
  }).observe(document.documentElement,{childList:true,subtree:true});
  document.querySelectorAll('input[type="date"]').forEach(ameliorer);
})();
