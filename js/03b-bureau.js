/* ===== 03b-bureau.js — Version ordinateur : menu latéral du dirigeant ===== */
// Sur un grand écran (≥ 1024 px), le dirigeant a un menu fixe à gauche au lieu
// de la barre du bas, et le contenu prend la largeur disponible. Sur téléphone,
// rien ne change. Les rubriques ouvrent les écrans existants (mêmes fonctions
// que les tuiles de l'Admin) : il n'y a pas de second écran à maintenir.
// Activé par la classe html.gm-desk (voir css/style.css).

var GM_DESK_MQ=(window.matchMedia?window.matchMedia("(min-width: 1024px)"):null);
var GM_DESK_ACTIF="accueil";

// Rubriques du menu. mod = module admin (droits et accès limité vérifiés par
// openAdminModule) ; scr = écrans qui allument la rubrique.
var GM_DESK_ITEMS=[
  {id:"accueil", label:"Accueil", grp:"Club", ic:"home", scr:["portal"], go:function(){ navTo("portal"); }},
  {id:"communaute", label:"Communauté", grp:"Club", ic:"chat", scr:["communaute","chat"], go:function(){ navTo("communaute"); }},
  {id:"planning", label:"Planning", grp:"Club", ic:"cal", mod:"planning", scr:["planning"]},
  {id:"equipes", label:"Équipes", grp:"Sportif", ic:"team", mod:"equipes", scr:["equipes"]},
  {id:"inscriptions", label:"Joueurs", grp:"Sportif", ic:"users", mod:"inscriptions", scr:["inscriptions","player-history"]},
  {id:"formation", label:"Formation", grp:"Sportif", ic:"book", scr:["elite","u13home","cycle","seance"], go:function(){ stack=["portal"]; openPole("formation"); }},
  {id:"licences", label:"Licences", grp:"Membres", ic:"card", mod:"licences", scr:["licences","licence-detail"]},
  {id:"invitations", label:"Accès & invitations", grp:"Membres", ic:"key", mod:"invitations", scr:[]},
  {id:"comptabilite", label:"Comptabilité", grp:"Gestion", ic:"euro", mod:"comptabilite", scr:["comptabilite"]},
  {id:"inventaire", label:"Buvette & stock", grp:"Gestion", ic:"cup", mod:"inventaire", scr:["inventaire"]},
  {id:"sponsors", label:"Sponsors", grp:"Gestion", ic:"star", mod:"sponsors", scr:["sponsors"]},
  {id:"documents", label:"Documents", grp:"Gestion", ic:"file", mod:"documents", scr:["documents"]},
  {id:"notesfrais", label:"Notes de frais", grp:"Gestion", ic:"receipt", mod:"notesfrais", scr:[]},
  {id:"admin", label:"Toutes les rubriques", grp:"Réglages", ic:"grid", scr:["admin","admin-comm","channel-detail"], go:function(){ navTo("admin"); }},
  {id:"parametres", label:"Paramètres", grp:"Réglages", ic:"gear", scr:["parametres"], go:function(){ stack=["portal"]; openParametres(); }}
];
var GM_DESK_SVG={
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  chat:'<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  team:'<path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.7-3.3 3.3-5 6.5-5s5.8 1.7 6.5 5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 15c2 .6 3.2 2.3 3.5 5"/>',
  book:'<path d="M12 3 2 8l10 5 10-5-10-5z"/><path d="M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5"/>',
  card:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.6-1.5 1.7-2 3-2s2.4.5 3 2M15 10h3M15 13h3"/>',
  key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14 9l2 2"/>',
  euro:'<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>',
  cup:'<path d="M5 8h12v6a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V8z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3v2M12 3v2"/>',
  star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3z"/>',
  file:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z"/><path d="M9 8h6M9 12h6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'
};

function gmDeskEstDirigeant(){
  return localStorage.getItem("asmb_profile")==="dirigeant" && !!window.ASMB_USER;
}
function gmDeskOn(){ return document.documentElement.classList.contains("gm-desk"); }
// Écrans qui ont une présentation en tableau sur ordinateur : on les redessine
// quand on passe d'un mode à l'autre (fenêtre agrandie ou réduite).
var GM_DESK_REDESSIN={comptabilite:"buildComptabilite",licences:"buildLicences",inscriptions:"renderPlayers"};
// Allume ou éteint la version ordinateur selon la largeur et le profil.
function gmDeskSync(){
  var on=!!(GM_DESK_MQ&&GM_DESK_MQ.matches) && gmDeskEstDirigeant();
  var avant=gmDeskOn();
  document.documentElement.classList.toggle("gm-desk", on);
  if(avant!==on){
    var scr=document.querySelector(".scr.on"), f=scr&&GM_DESK_REDESSIN[scr.id.replace(/^scr-/,"")];
    if(f&&typeof window[f]==="function") try{ window[f](); }catch(e){}
  }
  var side=document.getElementById("gm-side");
  if(!side) return;
  if(on) gmDeskRender(); else side.innerHTML="";
  if(typeof renderDeskHome==="function") renderDeskHome();
}
if(GM_DESK_MQ){
  if(GM_DESK_MQ.addEventListener) GM_DESK_MQ.addEventListener("change", gmDeskSync);
  else if(GM_DESK_MQ.addListener) GM_DESK_MQ.addListener(gmDeskSync);
}

function gmDeskVisible(it){
  if(it.mod){
    if(typeof ADMIN_MODULES==="undefined" || !ADMIN_MODULES.some(function(m){return m.id===it.mod;})) return false;
    if(typeof hasModulePermission==="function" && !hasModulePermission(it.mod)) return false;
  }
  return true;
}
function gmDeskBadge(it){
  try{
    if(it.id==="licences" && typeof getLicences==="function"){
      var cur=getCurrentSeason();
      return getLicences().filter(function(l){ return l.statut==="recue" && (!l.saison||l.saison>=cur); }).length;
    }
  }catch(e){}
  return 0;
}
function gmDeskOuvrir(id){
  var it=GM_DESK_ITEMS.find(function(x){return x.id===id;}); if(!it) return;
  GM_DESK_ACTIF=id;
  if(it.go) it.go();
  else { stack=["portal"]; openAdminModule(it.mod); }
  gmDeskRender();
}
// Appelé par showScr : la rubrique de l'écran affiché s'allume.
function gmDeskEcran(scr){
  if(!document.documentElement.classList.contains("gm-desk")) return;
  var it=GM_DESK_ITEMS.find(function(x){ return x.scr.indexOf(scr)>=0; });
  if(it) GM_DESK_ACTIF=it.id;
  gmDeskRender();
  if(scr==="portal"&&typeof renderDeskHome==="function") renderDeskHome(); // badges et nom du club à jour à chaque écran
}
function gmDeskRender(){
  var side=document.getElementById("gm-side"); if(!side) return;
  var nom=(typeof clubLabel==="function")?clubLabel(""):"";
  var h='<div class="gs-club">'+(typeof clubLogoHtml==="function"?clubLogoHtml(44):"")+
    '<div class="gs-club-txt"><div class="gs-club-nom">'+authEsc(nom||"Mon club")+'</div>'+
    '<div class="gs-club-sub">Saison '+authEsc((typeof getCurrentSeason==="function")?getCurrentSeason():"")+'</div></div></div><nav class="gs-nav" aria-label="Menu du club">';
  var grp=null;
  GM_DESK_ITEMS.filter(gmDeskVisible).forEach(function(it){
    if(it.grp!==grp){ grp=it.grp; h+='<div class="gs-grp">'+authEsc(grp)+'</div>'; }
    var n=gmDeskBadge(it);
    h+='<button type="button" class="gs-item'+(it.id===GM_DESK_ACTIF?" on":"")+'" onclick="gmDeskOuvrir(\''+it.id+'\')"'+(it.id===GM_DESK_ACTIF?' aria-current="page"':'')+'>'+
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(GM_DESK_SVG[it.ic]||"")+'</svg>'+
      '<span class="gs-lbl">'+authEsc(it.label)+'</span>'+(n?'<span class="gs-badge">'+n+'</span>':'')+'</button>';
  });
  h+='</nav>';
  side.innerHTML=h;
}
