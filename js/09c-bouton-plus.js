// ═══ BOUTON « + » DES GESTES DU QUOTIDIEN ═══════════════════════════
// Téléphone seulement (pas en version ordinateur, html.gm-desk) : rond en bas à droite
// sur l'accueil du dirigeant (portal), « Mon équipe » du coach (coach-equipe) et l'Espace
// Admin. Un appui ouvre jusqu'à 4 gestes ; chacun choisit les siens dans Paramètres ›
// « Bouton + » (mémoire de l'appareil : gm_plus_<clubId>_<profil>). Un geste n'apparaît que
// si le compte y a droit (mêmes contrôles que l'écran d'origine : hasModulePermission,
// accès limité, Premium), il ne contourne rien.
var PLUS_MAX=4;
var PLUS_ECRANS=["portal","coach-equipe","admin"];
var PLUS_IC={
  licence:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  convocation:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  presences:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  depense:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  recette:'<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  message:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>',
  annonce:'<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"/>',
  evenement:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M12 14v4M10 16h4"/>',
  notefrais:'<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  fermer:'<path d="M6 6l12 12M18 6L6 18"/>'
};
function plusSvg(k,taille){ return '<svg width="'+(taille||22)+'" height="'+(taille||22)+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(PLUS_IC[k]||"")+'</svg>'; }
function plusProfil(){ return localStorage.getItem("asmb_profile")||""; }
function plusPerm(id){ return typeof hasModulePermission==="function" && hasModulePermission(id); }

// Catalogue : pour = profils qui peuvent l'avoir, ok() = droit réel au moment de l'affichage.
var PLUS_GESTES=[
  {id:"licence", label:"Nouvelle licence", pour:["dirigeant","coach"], ok:function(){ return plusPerm("licences"); }, go:function(){
    openAdminModule("licences");
    if(document.getElementById("scr-licences").classList.contains("on")) showNewLicence();
  }},
  {id:"convocation", label:"Convocation", pour:["dirigeant","coach"], go:function(){ plusChoisirEvt("match", 14, 0, showConvocation, "Aucun match dans les 14 prochains jours."); }},
  {id:"presences", label:"Pointer les présences", pour:["dirigeant","coach"], go:function(){ plusChoisirEvt(["entrainement","match"], 0, 3, openPresences, "Aucun entraînement ni match aujourd'hui ou ces 3 derniers jours."); }},
  {id:"depense", label:"Dépense en photo", pour:["dirigeant","coach"], ok:function(){ return plusPerm("comptabilite"); }, go:function(){
    openAdminModule("comptabilite");
    if(document.getElementById("scr-comptabilite").classList.contains("on")) comptaTicketNouveau();
  }},
  {id:"recette", label:"Nouvelle recette", pour:["dirigeant","coach"], ok:function(){ return plusPerm("comptabilite"); }, go:function(){
    openAdminModule("comptabilite");
    if(document.getElementById("scr-comptabilite").classList.contains("on")){ showAddComptaLine(); setComptaType("recette"); }
  }},
  {id:"message", label:"Message à une équipe", pour:["dirigeant","coach"], ok:function(){ return typeof limiteOuvert!=="function"||limiteOuvert("messagerie"); }, go:function(){ plusCanal(true); }},
  {id:"annonce", label:"Annonce dans le Général", pour:["dirigeant","coach"], ok:function(){ return typeof limiteOuvert!=="function"||limiteOuvert("messagerie"); }, go:function(){ plusCanal(false); }},
  {id:"evenement", label:"Nouvel événement", pour:["dirigeant","coach"], go:function(){ showAddEvent(); }},
  {id:"notefrais", label:"Note de frais", pour:["coach"], go:function(){ openNotesFrais(); }}
];
var PLUS_DEFAUT={dirigeant:["licence","convocation","depense","message"], coach:["convocation","presences","message","evenement"]};

function plusCle(){ return "gm_plus_"+((window.CURRENT_CLUB&&window.CURRENT_CLUB.id)||window.CLUB_ID||"club")+"_"+plusProfil(); }
function plusDisponibles(){
  var p=plusProfil();
  return PLUS_GESTES.filter(function(g){ return g.pour.indexOf(p)>=0 && (!g.ok||g.ok()); });
}
function plusChoix(){
  var ids=null;
  try{ ids=JSON.parse(localStorage.getItem(plusCle())||"null"); }catch(e){}
  if(!Array.isArray(ids)) ids=PLUS_DEFAUT[plusProfil()]||[];
  var dispo=plusDisponibles().map(function(g){ return g.id; });
  return ids.filter(function(id){ return dispo.indexOf(id)>=0; }).slice(0,PLUS_MAX);
}
function plusEnregistrer(ids){ try{ localStorage.setItem(plusCle(),JSON.stringify(ids.slice(0,PLUS_MAX))); }catch(e){} }

// Appelé à chaque changement d'écran (showScr) : montre ou cache le rond.
function plusCreer(){
  var b=document.getElementById("gm-plus-fab"); if(b) return b;
  if(!document.body) return null;
  b=document.createElement("button");
  b.id="gm-plus-fab"; b.type="button"; b.className="gm-plus-fab"; b.style.display="none";
  b.setAttribute("aria-label","Gestes rapides");
  b.innerHTML=plusSvg("plus",28);
  b.addEventListener("click",function(){ document.getElementById("gm-plus-menu")?plusFermer():plusOuvrir(); });
  document.body.appendChild(b);
  return b;
}
// Créé dès le chargement (caché), pour faire partie de la page comme la barre du bas.
if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",plusCreer); else plusCreer();
function plusMaj(id){
  var b=document.getElementById("gm-plus-fab");
  var p=plusProfil();
  var voir=PLUS_ECRANS.indexOf(id)>=0 && (p==="dirigeant"||p==="coach")
    && !document.documentElement.classList.contains("gm-desk")
    && !(window.CURRENT_CLUB&&window.CURRENT_CLUB.type==="independant")
    && plusChoix().length>0;
  if(!voir){ if(b) b.style.display="none"; plusFermer(); return; }
  b=b||plusCreer(); if(!b) return;
  plusFermer();
  b.style.display="flex";
}
function plusOuvrir(){
  plusFermer();
  var choix=plusChoix(); if(!choix.length) return;
  var ov=document.createElement("div");
  ov.id="gm-plus-menu"; ov.className="gm-plus-ov";
  ov.addEventListener("click",function(e){ if(e.target===ov) plusFermer(); });
  var liste=document.createElement("div"); liste.className="gm-plus-liste";
  choix.slice().reverse().forEach(function(id){
    var g=PLUS_GESTES.filter(function(x){ return x.id===id; })[0]; if(!g) return;
    var l=document.createElement("button"); l.type="button"; l.className="gm-plus-geste";
    l.innerHTML='<span class="gm-plus-lbl">'+g.label+'</span><span class="gm-plus-ic">'+plusSvg(g.id)+'</span>';
    l.addEventListener("click",function(){ plusFermer(); try{ g.go(); }catch(e){ if(typeof gmSignalerErreur==="function") gmSignalerErreur(e,"plus:"+g.id); } });
    liste.appendChild(l);
  });
  ov.appendChild(liste);
  document.body.appendChild(ov);
  var b=document.getElementById("gm-plus-fab");
  if(b){ b.classList.add("ouvert"); b.innerHTML=plusSvg("fermer",26); b.setAttribute("aria-label","Fermer"); }
}
function plusFermer(){
  var m=document.getElementById("gm-plus-menu"); if(m) m.remove();
  var b=document.getElementById("gm-plus-fab");
  if(b&&b.classList.contains("ouvert")){ b.classList.remove("ouvert"); b.innerHTML=plusSvg("plus",28); b.setAttribute("aria-label","Gestes rapides"); }
}

// Matchs / entraînements proches. Coach : seulement ceux de ses équipes.
function plusEvts(types, joursApres, joursAvant){
  types=[].concat(types);
  var d0=new Date(Date.now()-joursAvant*86400000).toISOString().slice(0,10);
  var d1=new Date(Date.now()+joursApres*86400000).toISOString().slice(0,10);
  var coach=plusProfil()==="coach", mesEq=[];
  if(coach&&typeof getCoachTeams==="function"){ var ids=getCoachTeams(); mesEq=getTeams().filter(function(t){ return ids.indexOf(t.id)>=0; }); }
  return getEvents().filter(function(e){
    if(types.indexOf(e.type)<0||e.cancelled||!e.date||e.date<d0||e.date>d1) return false;
    if(coach&&mesEq.length&&typeof assidMatchEquipe==="function") return mesEq.some(function(t){ return assidMatchEquipe(e,t); });
    return true;
  }).sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
}
function plusChoisirEvt(types, joursApres, joursAvant, ouvrir, vide){
  var l=plusEvts(types,joursApres,joursAvant);
  if(!l.length){ askAlert(vide); return; }
  if(l.length===1){ ouvrir(l[0].id); return; }
  var s=gmSheet("Choisir");
  l.slice(0,12).forEach(function(e){
    var b=document.createElement("button"); b.type="button"; b.className="gm-plus-choix";
    var jour=(typeof plJourCourt==="function"?plJourCourt(e.date):e.date)+(e.heure?" · "+e.heure:"");
    b.innerHTML='<span style="display:block;font-weight:800" data-notr>'+authEsc(e.titre||"")+'</span><span style="display:block;font-size:12px;color:var(--mut)">'+authEsc(jour)+(e.equipe?' · <span data-notr>'+authEsc(e.equipe)+'</span>':'')+'</span>';
    b.addEventListener("click",function(){ s.modal.remove(); ouvrir(e.id); });
    s.body.appendChild(b);
  });
}

// Canal d'une équipe (equipe=true) ou canal Général.
async function plusCanal(equipe){
  var chs=(window.__chatChannelsCache||[]).filter(function(c){ return !c.evt; });
  if(!chs.length && window.fbReady){
    try{
      var snap=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels"));
      snap.forEach(function(d){ var c=d.data(); c.id=d.id; if(!c.deleted&&!c.evt&&(typeof channelVisibleToMe!=="function"||channelVisibleToMe(c))) chs.push(c); });
    }catch(e){}
  }
  var aller=function(){ if(plusProfil()==="coach") navToCoach("communaute"); else navTo("communaute"); };
  var cibles=equipe?chs.filter(function(c){ return typeof canalEquipeId==="function"&&canalEquipeId(c); }):chs.filter(function(c){ return c.id==="general"; });
  if(!cibles.length){ aller(); return; }
  if(cibles.length===1){ aller(); openChannel(cibles[0]); return; }
  cibles.sort(function(a,b){ return String(a.name||"").localeCompare(String(b.name||"")); });
  var s=gmSheet("Message à une équipe");
  cibles.forEach(function(c){
    var b=document.createElement("button"); b.type="button"; b.className="gm-plus-choix";
    b.innerHTML='<span style="font-weight:800" data-notr>'+authEsc((c.icon?c.icon+" ":"")+(c.name||""))+'</span>';
    b.addEventListener("click",function(){ s.modal.remove(); aller(); openChannel(c); });
    s.body.appendChild(b);
  });
}

// Paramètres › « Bouton + » : jusqu'à 4 gestes cochés, dans l'ordre du catalogue.
function plusBlocParam(){
  var box=document.createElement("div");
  box.className="param-block"; box.setAttribute("data-sec","plus");
  plusPeindreParam(box);
  return box;
}
function plusPeindreParam(box){
  box=box||document.querySelector('.param-block[data-sec="plus"]'); if(!box) return;
  var choix=plusChoix(), dispo=plusDisponibles();
  box.innerHTML='<div style="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:12px;color:var(--mut);margin-bottom:4px">Le bouton + en bas de l\'accueil ouvre vos gestes du quotidien. Choisissez-en 4 au maximum.</div>'+
    '<div style="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:8px"><span data-notr>'+choix.length+' / '+PLUS_MAX+'</span> choisis</div>'+
    '<div class="gm-plus-params"></div>'+
    '<div style="font-size:11px;color:var(--mut);margin-top:8px">Réglage de ce téléphone.</div></div>';
  var zone=box.querySelector(".gm-plus-params");
  dispo.forEach(function(g){
    var on=choix.indexOf(g.id)>=0, plein=choix.length>=PLUS_MAX&&!on;
    var lab=document.createElement("label"); lab.className="gm-plus-param"+(plein?" plein":"");
    lab.innerHTML='<input type="checkbox"'+(on?" checked":"")+(plein?" disabled":"")+'><span class="gm-plus-ic petit">'+plusSvg(g.id,18)+'</span><span style="flex:1">'+g.label+'</span>';
    lab.querySelector("input").addEventListener("change",function(ev){
      var c=plusChoix();
      if(ev.target.checked){ if(c.length>=PLUS_MAX){ ev.target.checked=false; return; } c.push(g.id); }
      else c=c.filter(function(x){ return x!==g.id; });
      // Ordre du catalogue, comme dans le menu.
      c=PLUS_GESTES.map(function(x){ return x.id; }).filter(function(id){ return c.indexOf(id)>=0; });
      plusEnregistrer(c);
      plusPeindreParam(box);
      var r=document.querySelector('[data-grp="plus"] .pgrp-res'); if(r) r.textContent=plusResume();
    });
    zone.appendChild(lab);
  });
}
function plusResume(){
  var c=plusChoix();
  if(!c.length) return "Aucun geste : le bouton est caché";
  return c.map(function(id){ var g=PLUS_GESTES.filter(function(x){ return x.id===id; })[0]; return g?g.label:""; }).join(" · ");
}
