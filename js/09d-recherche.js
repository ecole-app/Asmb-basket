// ═══ RECHERCHE PARTOUT ═════════════════════════════════════════════
// Loupe de l'en-tête (#hdr-search-btn) et Ctrl+K / Cmd+K sur ordinateur : une seule
// recherche dans ce que le compte voit déjà (données locales synchronisées, rien de
// nouveau n'est lu sur le serveur) : licences et parents, joueurs, équipes, événements,
// comptabilité, sponsors, écrans de l'Espace Admin. Dirigeant et coach seulement ; chaque
// groupe suit le même droit que son écran (hasModulePermission, Premium pour la compta).
// Téléphone : plein écran. Ordinateur (html.gm-desk) : fenêtre au milieu, flèches + Entrée.
var RECH_MAX_GROUPE=5;
var rechEtat={q:"", filtre:"tout", sel:0, items:[]};

function rechAutorise(){
  var p=localStorage.getItem("asmb_profile");
  return (p==="dirigeant"||p==="coach") && !!window.CURRENT_CLUB && window.CURRENT_CLUB.type!=="independant";
}
// Appelé à chaque changement d'écran : la loupe n'existe que dans les écrans du club.
function rechMajBouton(id){
  var b=document.getElementById("hdr-search-btn"); if(!b) return;
  var hors=(typeof GM_SCR_HORS_CLUB!=="undefined"&&GM_SCR_HORS_CLUB.indexOf(id)>=0)||(typeof SCR_PUBLICS!=="undefined"&&SCR_PUBLICS.indexOf(id)>=0)||id==="club-suspendu";
  b.style.display=(!hors&&rechAutorise())?"flex":"none";
}
// Minuscules sans accents, même longueur que le texte d'origine (pour surligner au bon endroit).
function rechNorm(s){
  s=String(s||""); var o="";
  for(var i=0;i<s.length;i++){ var c=s[i].normalize("NFD")[0]||s[i]; o+=c.toLowerCase().length===1?c.toLowerCase():c; }
  return o;
}
function rechSurligner(txt,q){
  txt=String(txt||""); if(!q) return authEsc(txt);
  var n=rechNorm(txt), mots=rechNorm(q).split(/\s+/).filter(Boolean), marque=new Array(txt.length).fill(false);
  mots.forEach(function(m){ var i=n.indexOf(m); while(i>=0){ for(var k=i;k<i+m.length;k++) marque[k]=true; i=n.indexOf(m,i+m.length); } });
  var out="", dans=false;
  for(var i=0;i<txt.length;i++){
    if(marque[i]&&!dans){ out+='<b class="rech-hl">'; dans=true; }
    if(!marque[i]&&dans){ out+='</b>'; dans=false; }
    out+=authEsc(txt[i]);
  }
  return out+(dans?'</b>':'');
}
function rechPerm(id){ return typeof hasModulePermission==="function"&&hasModulePermission(id); }
function rechDateFr(d){ return (typeof plJourCourt==="function"&&d)?plJourCourt(d):(d||""); }

// Tout ce qui peut être trouvé : {grp, titre, sous, droite, cherche, go}
function rechIndex(){
  var l=[], p=localStorage.getItem("asmb_profile");
  var lic=rechPerm("licences");
  if(lic){
    (typeof getLicences==="function"?getLicences():[]).forEach(function(x){
      var f=x.fiche||{}, nom=((f.nom||"")+" "+(f.prenom||"")).trim();
      if(!nom) nom=x.nomDest||x.email||x.code;
      var st=(typeof STATUTS!=="undefined"?STATUTS.filter(function(s){ return s.id===x.statut; })[0]:null);
      var ouvrir=function(){ openAdminModule("licences"); openLicenceDetail(x.code); };
      l.push({grp:"licences", titre:nom, sous:[x.categorie,st&&gmT(st.label)].filter(Boolean).join(" · "),
        cherche:[nom,f.prenom+" "+f.nom,x.code,x.email,f.emailLic,String(f.telephone||"").replace(/\D/g,"")].join(" "), go:ouvrir});
      [[f.respNom,f.respTel],[f.resp2Nom,f.resp2Tel]].forEach(function(r){
        if(!r[0]) return;
        l.push({grp:"parents", titre:r[0], sous:gmT("Parent de")+" "+((f.prenom||"")+" "+(f.nom||"")).trim(), tel:r[1]||"",
          cherche:[r[0],String(r[1]||"").replace(/\D/g,""),f.prenom,f.nom].join(" "), go:ouvrir});
      });
    });
  }
  // Joueurs : ceux qui n'ont pas déjà leur licence dans les résultats.
  var dejaLic={}; l.forEach(function(it){ if(it.grp==="licences") dejaLic[rechNorm(it.titre)]=true; });
  {
    (typeof getPlayers==="function"?getPlayers():[]).forEach(function(x){
      var nom=((x.nom||"")+" "+(x.prenom||"")).trim(); if(!nom||dejaLic[rechNorm(nom)]) return;
      l.push({grp:"joueurs", titre:nom, sous:x.categorie||x.cat||"", cherche:nom+" "+(x.prenom||"")+" "+(x.nom||""), go:function(){ openPlayerHistory(x.id); }});
    });
  }
  if(rechPerm("equipes")){
    (typeof getTeams==="function"?getTeams():[]).forEach(function(t){
      l.push({grp:"equipes", titre:t.name||"", sous:((t.members||[]).length)+" "+gmT("joueurs"), cherche:(t.name||"")+" "+(t.cat||""), go:function(){ openAdminModule("equipes"); }});
    });
  }
  var auj=new Date().toISOString().slice(0,10);
  (typeof getEvents==="function"?getEvents():[]).forEach(function(e){
    if(!e.titre) return;
    l.push({grp:"evenements", titre:e.titre, sous:[rechDateFr(e.date)+(e.heure?" · "+e.heure:""),e.lieu].filter(Boolean).join(" · "),
      cherche:[e.titre,e.lieu,e.equipe].join(" "), tri:Math.abs((Date.parse(e.date||auj)-Date.parse(auj))||0),
      go:function(){ editEventDateTime(e.id); }});
  });
  if(rechPerm("comptabilite")&&(typeof hasPremium!=="function"||hasPremium())){
    (typeof getComptabilite==="function"?getComptabilite():[]).forEach(function(c){
      var dep=c.type==="depense", m=Number(c.montant)||0;
      l.push({grp:"compta", titre:c.motif||c.categorie||c.tiers||gmT("Ligne"), sous:[gmT(dep?"Dépense":"Recette"),c.date?gmDateCourte(c.date):"",c.tiers].filter(Boolean).join(" · "),
        droite:(dep?"− ":"+ ")+m.toFixed(2).replace(".",",")+" €", droiteCls:dep?"dep":"rec",
        cherche:[c.motif,c.categorie,c.tiers,c.piece,c.reference,String(m)].join(" "), tri:-Date.parse(c.date||"2000-01-01"),
        go:function(){ openAdminModule("comptabilite"); showAddComptaLine(c.id); }});
    });
  }
  if(rechPerm("sponsors")){
    (typeof getSponsors==="function"?getSponsors():[]).forEach(function(s){
      l.push({grp:"sponsors", titre:s.nom||"", sous:s.contactNom||"", cherche:[s.nom,s.contactNom].join(" "), go:function(){ openAdminModule("sponsors"); showEditSponsor(s.id); }});
    });
  }
  if(typeof ADMIN_MODULES!=="undefined"){
    ADMIN_MODULES.forEach(function(m){
      if(!rechPerm(m.id)) return;
      l.push({grp:"ecrans", titre:gmT(m.name), sous:gmT(m.sub), cherche:m.name+" "+m.sub, titreTr:true, go:function(){ openAdminModule(m.id); }});
    });
  }
  return l;
}
function gmDateCourte(d){ var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||""); return m?m[3]+"/"+m[2]+"/"+m[1]:d; }
var RECH_GROUPES=[["licences","Licences"],["parents","Parents"],["joueurs","Joueurs"],["equipes","Équipes"],["evenements","Événements"],["compta","Comptabilité"],["sponsors","Sponsors"],["ecrans","Aller à"]];

function rechOuvrir(){
  if(!rechAutorise()) return;
  if(document.getElementById("gm-rech")){ var i0=document.getElementById("rech-input"); if(i0) i0.focus(); return; }
  if(typeof plusFermer==="function") plusFermer();
  rechEtat={q:"", filtre:"tout", sel:0, items:[], index:rechIndex()};
  var ov=document.createElement("div"); ov.id="gm-rech"; ov.className="gm-rech";
  ov.setAttribute("role","dialog"); ov.setAttribute("aria-modal","true"); ov.setAttribute("aria-label","Rechercher");
  ov.innerHTML='<div class="rech-panneau">'+
    '<div class="rech-tete">'+
      '<button type="button" class="rech-retour" aria-label="Fermer" onclick="rechFermer()"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg></button>'+
      '<label class="rech-champ"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'+
        '<input id="rech-input" type="search" autocomplete="off" enterkeyhint="search" placeholder="Nom, équipe, montant…" aria-label="Rechercher"></label>'+
      '<span class="rech-echap">Échap</span>'+
    '</div>'+
    '<div class="rech-filtres" id="rech-filtres"></div>'+
    '<div class="rech-res" id="rech-res"></div>'+
    '<div class="rech-aide">↑ ↓ pour choisir · Entrée pour ouvrir · Échap pour fermer</div>'+
  '</div>';
  ov.addEventListener("click",function(e){ if(e.target===ov) rechFermer(); });
  document.body.appendChild(ov);
  var inp=document.getElementById("rech-input");
  inp.addEventListener("input",function(){ rechEtat.q=inp.value; rechEtat.sel=0; rechPeindre(); });
  inp.addEventListener("keydown",rechClavier);
  rechPeindre();
  inp.focus(); setTimeout(function(){ inp.focus(); },30);
}
function rechFermer(){ var o=document.getElementById("gm-rech"); if(o) o.remove(); }
function rechClavier(e){
  var n=rechEtat.items.length;
  if(e.key==="Escape"){ e.preventDefault(); rechFermer(); }
  else if(e.key==="ArrowDown"&&n){ e.preventDefault(); rechEtat.sel=(rechEtat.sel+1)%n; rechSel(); }
  else if(e.key==="ArrowUp"&&n){ e.preventDefault(); rechEtat.sel=(rechEtat.sel-1+n)%n; rechSel(); }
  else if(e.key==="Enter"&&n){ e.preventDefault(); rechAller(rechEtat.sel); }
}
function rechSel(){
  var els=document.querySelectorAll("#rech-res .rech-item");
  els.forEach(function(el,i){ el.classList.toggle("sel",i===rechEtat.sel); if(i===rechEtat.sel) el.scrollIntoView({block:"nearest"}); });
}
function rechAller(i){
  var it=rechEtat.items[i]; if(!it) return;
  rechFermer();
  try{ it.go(); }catch(e){ if(typeof gmSignalerErreur==="function") gmSignalerErreur(e,"recherche:"+it.grp); }
}
function rechFiltre(f){ rechEtat.filtre=f; rechEtat.sel=0; rechPeindre(); var i=document.getElementById("rech-input"); if(i) i.focus(); }
function rechTrouver(q){
  var mots=rechNorm(q).split(/\s+/).filter(Boolean); if(!mots.length) return [];
  return rechEtat.index.filter(function(it){
    var h=rechNorm(it.titre+" "+(it.cherche||""));
    return mots.every(function(m){ return h.indexOf(m)>=0; });
  }).map(function(it){
    // Le titre qui commence par la recherche passe devant.
    var t=rechNorm(it.titre), d=t.indexOf(mots[0])===0?0:(t.indexOf(" "+mots[0])>=0?1:2);
    return {it:it, rang:d};
  }).sort(function(a,b){ return a.rang-b.rang||((a.it.tri||0)-(b.it.tri||0))||String(a.it.titre).localeCompare(String(b.it.titre)); })
    .map(function(x){ return x.it; });
}
function rechPeindre(){
  var res=document.getElementById("rech-res"), fz=document.getElementById("rech-filtres"); if(!res) return;
  var q=rechEtat.q.trim();
  if(q.length<2){
    fz.innerHTML="";
    res.innerHTML='<div class="rech-vide">Tapez au moins 2 lettres : un nom, une équipe, un événement, un montant…</div>';
    rechEtat.items=[]; return;
  }
  var tous=rechTrouver(q), par={};
  tous.forEach(function(it){ (par[it.grp]=par[it.grp]||[]).push(it); });
  var f='<button type="button" class="rech-chip'+(rechEtat.filtre==="tout"?" on":"")+'" onclick="rechFiltre(\'tout\')">Tout · <span data-notr>'+tous.length+'</span></button>';
  RECH_GROUPES.forEach(function(g){ if(par[g[0]]) f+='<button type="button" class="rech-chip'+(rechEtat.filtre===g[0]?" on":"")+'" onclick="rechFiltre(\''+gmJs(g[0])+'\')">'+g[1]+' · <span data-notr>'+par[g[0]].length+'</span></button>'; });
  fz.innerHTML=f;
  if(!tous.length){ res.innerHTML='<div class="rech-vide">Aucun résultat pour « <span data-notr>'+authEsc(q)+'</span> ».</div>'; rechEtat.items=[]; return; }
  var h="", items=[];
  RECH_GROUPES.forEach(function(g){
    var l=par[g[0]]; if(!l) return;
    if(rechEtat.filtre!=="tout"&&rechEtat.filtre!==g[0]) return;
    var montrer=rechEtat.filtre==="tout"?l.slice(0,RECH_MAX_GROUPE):l.slice(0,60);
    h+='<div class="rech-grp"><div class="rech-grp-tit">'+g[1]+'</div><div class="rech-carte">';
    montrer.forEach(function(it){
      var i=items.length; items.push(it);
      var tel=it.tel?String(it.tel).replace(/[^\d+]/g,""):"";
      h+='<div class="rech-item" data-i="'+i+'"><button type="button" class="rech-ouvrir" onclick="rechAller('+i+')">'+
        '<span class="rech-t" data-notr>'+rechSurligner(it.titre,q)+'</span>'+
        (it.sous?'<span class="rech-s" data-notr>'+rechSurligner(it.sous,q)+'</span>':'')+'</button>'+
        (it.droite?'<span class="rech-d '+(authEsc(it.droiteCls||""))+'" data-notr>'+authEsc(it.droite)+'</span>':'')+
        (tel?'<a class="rech-tel" href="tel:'+authEsc(tel)+'" aria-label="Appeler"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg></a>':'')+
      '</div>';
    });
    if(rechEtat.filtre==="tout"&&l.length>RECH_MAX_GROUPE) h+='<button type="button" class="rech-plus" onclick="rechFiltre(\''+gmJs(g[0])+'\')">Voir les <span data-notr>'+l.length+'</span></button>';
    h+='</div></div>';
  });
  res.innerHTML=h; rechEtat.items=items;
  if(rechEtat.sel>=items.length) rechEtat.sel=0;
  if(document.documentElement.classList.contains("gm-desk")) rechSel();
}
// Ctrl+K / Cmd+K : ouvre la recherche (ordinateur).
document.addEventListener("keydown",function(e){
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&(e.key==="k"||e.key==="K")){
    if(!rechAutorise()||document.querySelector(".gm-sheet")) return;
    e.preventDefault(); rechOuvrir();
  }
});
