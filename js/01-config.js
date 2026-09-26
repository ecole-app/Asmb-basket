/* ===== 01-config.js — Constantes globales : poles, categories, couleurs, saison ===== */

// ═══ IDENTITE DU CLUB ACTIF ══════════════════════════════════════
// Aucun nom de club ne doit etre ecrit en dur dans l'application : tout texte
// visible (e-mails, PDF, notifications, recus) passe par ces fonctions, sinon
// un club verrait le nom d'un autre club chez lui.

// Nom du club actif. fallback sert quand aucun club n'est encore charge
// (ecran de connexion, demarrage) : passer "" pour ne rien afficher.
function clubLabel(fallback){
  var n=(window.CURRENT_CLUB && window.CURRENT_CLUB.name) || "";
  return n || (fallback===undefined ? "Le club" : fallback);
}

// Auteur affiche pour les messages automatiques ("Admin", "Convocation"...).
function clubPseudo(prefix){
  var n=clubLabel("");
  if(!n) return prefix || "Club";
  return (prefix ? prefix+" " : "")+n;
}

// Prefixe des codes licence : TOUJOURS 4 caracteres, car le masque de saisie
// (formatCodeInput) decoupe en blocs de 4. Stocke sur la fiche du club pour
// rester stable dans le temps, sinon derive du nom.
// Derive un prefixe depuis un nom de club (utilise aussi a la creation d'un club,
// pour figer le prefixe sur sa fiche plutot que de le recalculer a chaque fois).
function clubCodePrefixFrom(name){
  var p="";
  // accents retires d'abord, sinon "Élite" donnerait "L" comme initiale
  var n=String(name||"").normalize("NFD").replace(/[̀-ͯ]/g,"");
  var words=n.replace(/[^A-Za-z0-9 ]/g," ").split(/\s+/).filter(Boolean);
  // un sigle deja present dans le nom prime ("ASMB Basket" -> ASMB)
  for(var i=0;i<words.length;i++){
    var w=words[i];
    if(w.length>=3 && w.length<=4 && w===w.toUpperCase() && /[A-Z]/.test(w)){ p=w; break; }
  }
  if(!p){
    if(words.length>=2){ words.forEach(function(w){ if(p.length<4) p+=w.charAt(0); }); }
    else if(words.length===1){ p=words[0].slice(0,4); }
  }
  p=p.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,4);
  while(p.length<4) p+="X";           // toujours 4 : le masque de saisie en depend
  return p || "CLUB";
}

function clubCodePrefix(){
  var c=window.CURRENT_CLUB;
  if(c && c.codePrefix) return clubCodePrefixFrom(c.codePrefix);
  return clubCodePrefixFrom((c&&c.name)||"");
}

// Nom utilisable dans un nom de fichier (export PDF...).
function clubSlug(){
  return clubLabel("club").normalize("NFD").replace(/[̀-ͯ]/g,"")
    .replace(/[^A-Za-z0-9]+/g,"_").replace(/^_+|_+$/g,"") || "club";
}

// ═══ POLES ACTIFS PAR CLUB ═══════════════════════════════════════
// Socle de base, propose a tout club. L'assiduite (pointage, stats, historique
// joueur) n'est pas un pole : c'est une brique transverse du socle, jamais
// retiree. Elite Academy reste propre au club d'origine : le suivi
// individualise demande une autre structure, il n'est pas proposable en option.
const BASE_POLES=["formation","competition","evenement"];
const OPTION_POLES=["3x3","basketpourtous"];   // activables plus tard, club par club

// Poles reellement affiches pour le club actif.
function activePoles(){
  var c=window.CURRENT_CLUB;
  var ids=(c && Array.isArray(c.poles) && c.poles.length) ? c.poles : null;
  if(!ids){
    // Club d'origine cree avant ce reglage : il conserve tous ses poles.
    var boot=(typeof BOOTSTRAP_CLUB_ID!=="undefined") ? BOOTSTRAP_CLUB_ID : "asmb";
    ids = (c && c.id===boot) ? POLES.map(function(p){ return p.id; }) : BASE_POLES;
  }
  return POLES.filter(function(p){ return ids.indexOf(p.id)>=0; });
}

function isPoleActive(poleId){
  return activePoles().some(function(p){ return p.id===poleId; });
}

// Une ligne de classement designe-t-elle notre propre equipe ?
// (les noms sont saisis librement par le club, on compare au nom du club)
function isOurTeamName(name){
  if(!name) return false;
  var n=String(name).toUpperCase();
  var club=clubLabel("").toUpperCase();
  if(club){
    var words=club.replace(/[^A-Z0-9 ]/g," ").split(/\s+/).filter(function(w){ return w.length>2; });
    for(var i=0;i<words.length;i++){ if(n.indexOf(words[i])>=0) return true; }
  }
  return n.indexOf(clubCodePrefix())>=0;
}
// Helpers de saison places ici volontairement : ELITE_CATS ci-dessous
// appelle getCurrentSeason() des sa declaration.
function computeNaturalSeason(d){
  d=d||new Date();
  var y=d.getFullYear();
  return (d.getMonth()>=6) ? (y+"-"+(y+1)) : ((y-1)+"-"+y);
}
function getCurrentSeason(){
  return localStorage.getItem("asmb_current_season") || computeNaturalSeason();
}

const POLES=[
 {id:"formation",name:"Pôle Formation",sub:"Planification des entraînements",desc:"Cycles · Séances · Animations",icon:"📋",color:"#1A2E5A",ready:true,
 about:"Structurer et developper la pratique du basket a tous les niveaux. Entraîneurs diplomes, suivi individualise, methodologie structuree.",
 items:["École de basket · Catégories jeunes","Accès au niveau compétition","Suivi individualise · Progression continue","Formation des educateurs en continu"]},
 {id:"elite",name:"Élite Academy",sub:"Accompagner les jeunes talents",desc:"Formation · Scolaire · Personnel",icon:"⭐",color:"#1a6b30",ready:true,
 about:"Accompagner les jeunes joueurs dans leur progression sportive, scolaire et personnelle. Plus qu'une formation sportive, une école de la vie.",
 items:["Entraînements adaptes aux academiciens","Développement technique tactique et physique","Aide aux devoirs et suivi scolaire","Apprentissage de l'autonomie et responsabilité"]},
 {id:"competition",name:"Compétition 5x5",sub:"Le coeur du projet sportif",desc:"Compétitions · Entraînements · Équipes",icon:"🏆",color:"#C0392B",ready:true,
 about:"Le basket 5x5 structure notre projet sportif. De l'initiation aux seniors, chaque joueur progresse dans un cadre exigeant et bienveillant.",
 items:["Championnats locaux et regionaux","Développement des équipes par catégorie","Encadrement de qualité · Educateurs formes","Esprit d'équipe · Respect · Engagement"]},
 {id:"3x3",name:"3x3",sub:"Rapide · Urbain · Accessible",desc:"Compétitions · Événements · Détection",icon:"🏀",color:"#E8670A",ready:true,
 about:"Le 3x3 est une pratique dynamique qui complète notre projet. Plus rapide, plus libre, il permet a chacun de s'exprimer dans un format moderne.",
 items:["Compétitions 3x3 · Tournois locaux","Détection et formation des talents","Événements et animations urbaines","Mixite et inclusion favorisees"]},
 {id:"evenement",name:"Événements",sub:"Des rendez-vous qui nous rassemblent",desc:"Tournois · Soirees · Journees club",icon:"🎉",color:"#8E44AD",ready:true,
 about:"Le club organise des événements tout au long de la saison pour faire vivre notre passion, creer du lien et faire rayonner notre territoire.",
 items:["Creation de tournois 3x3 et 5x5","Soirees et journees club","Echanges inter-clubs · Tournoi international","Journees formation et arbitrage"]},
 {id:"basketpourtous",name:"Basket Pour Tous",sub:"Un club où chacun trouve sa place",desc:"Basket santé · Loisir · Inclusif · Adapte",icon:"🤝",color:"#16A085",ready:true,
 about:"Le basket accessible a toutes et tous, sans distinction. Des séances adaptees, inclusives et bienveillantes pour partager le plaisir du jeu ensemble.",
 items:["Basket Santé · Basket Handicap","Basket Loisir · Basket Adapte","Tous ages · Tous niveaux · Debutants bienvenus","Séances adaptees et bienveillantes"]}
];
// Chaque categorie porte son titre et ses chips : ajouter une categorie ne
// demande plus de toucher au code d'ouverture (openCat etait une liste blanche).
const ELITE_CATS=[
 {id:"u9",name:"U9",desc:"3 cycles · 16 séances · Decouverte",icon:"",color:"#E8670A",ready:true,
  title:"U9 Decouverte",chips:["1 séance / semaine","1h30 par séance","Decouverte FFBB"]},
 {id:"u11",name:"U11",desc:"3 cycles · 15 séances · Mini-basket",icon:"",color:"#16A085",ready:true,
  title:"U11 Mini-basket",chips:["2 séances / semaine","1h30 par séance","Mini-basket FFBB"]},
 {id:"u13",name:"U13 (Filles et Garcons)",desc:"5 cycles · 47 séances · "+getCurrentSeason(),icon:"",color:"#D4AF37",ready:true,
  title:"U13 Filles et Garcons",chips:["2 séances / semaine","1h30 par séance"],zoneChip:true},
 {id:"u15",name:"U15",desc:"5 cycles · 45 séances · "+getCurrentSeason(),icon:"",color:"#C0392B",ready:true,
  title:"U15",chips:["2 séances / semaine","1h30 par séance"],zoneChip:true},
 {id:"u17m",name:"U17 Masculins",desc:"5 cycles · 45 séances · "+getCurrentSeason(),icon:"",color:"#8E44AD",ready:true,
  title:"U17 Masculins",chips:["2 à 3 séances / semaine","1h45 par séance"],zoneChip:true},
 {id:"u18f",name:"U18 Féminines",desc:"5 cycles · 45 séances · "+getCurrentSeason(),icon:"",color:"#16A085",ready:true,
  title:"U18 Féminines",chips:["2 à 3 séances / semaine","1h45 par séance","Protocole prévention"],zoneChip:true},
 {id:"u21m",name:"U21 Masculins",desc:"5 cycles · 45 séances · "+getCurrentSeason(),icon:"",color:"#0B7285",ready:true,
  title:"U21 Masculins",chips:["3 à 4 séances / semaine","2h par séance","Renforcement planifié"],zoneChip:true}
];
// ═══ VACANCES SCOLAIRES ══════════════════════════════════════════
// Dates officielles 2026-2027. Toussaint et Noel sont communes aux trois
// zones ; hiver et printemps different. Le club choisit sa zone et peut
// surcharger n'importe quelle date (calendrier propre, stage, etc.).
const VAC_COMMUNES=[
 {n:"Toussaint",d:"17 oct. - 2 nov. 2026",imp:"4 séances",c:"#E8670A"},
 {n:"Noel",d:"19 dec. 2026 - 4 janv. 2027",imp:"5 séances",c:"#8E44AD"}
];
const VACS_BY_ZONE={
 A:VAC_COMMUNES.concat([
  {n:"Hiver",d:"13 fev. - 1 mars 2027",imp:"4 séances",c:"#1A2E5A"},
  {n:"Printemps",d:"10 avr. - 26 avr. 2027",imp:"4 séances",c:"#D4AF37"}]),
 B:VAC_COMMUNES.concat([
  {n:"Hiver",d:"20 fev. - 8 mars 2027",imp:"4 séances",c:"#1A2E5A"},
  {n:"Printemps",d:"17 avr. - 3 mai 2027",imp:"4 séances",c:"#D4AF37"}]),
 C:VAC_COMMUNES.concat([
  {n:"Hiver",d:"6 fev. - 22 fev. 2027",imp:"4 séances",c:"#1A2E5A"},
  {n:"Printemps",d:"3 avr. - 19 avr. 2027",imp:"4 séances",c:"#D4AF37"}])
};

// Zone du club (A par defaut). Saint-Etienne est en zone A.
function getClubZone(){
  var z=(window.CURRENT_CLUB && window.CURRENT_CLUB.zone) || "A";
  return VACS_BY_ZONE[z] ? z : "A";
}
// Dates personnalisees du club, si le dirigeant en a saisi.
function getVacancesOverride(){
  try{ return JSON.parse(localStorage.getItem("asmb_vacances_custom")||"null"); }catch(e){ return null; }
}
function saveVacancesOverride(list){
  if(list===null) localStorage.removeItem("asmb_vacances_custom");
  else localStorage.setItem("asmb_vacances_custom",JSON.stringify(list));
  if(window.fbDb&&window.fbSetDoc&&window.CURRENT_CLUB_ID){
    window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","vacances"),
      {data:list===null?"":JSON.stringify(list),zone:getClubZone()},{merge:true}).catch(function(){});
  }
}
// Vacances effectivement affichees : surcharge du club sinon zone officielle.
function getVacances(){
  var c=getVacancesOverride();
  if(c && c.length) return c;
  return VACS_BY_ZONE[getClubZone()];
}
const KC=["#16A085","#8E44AD","#D4AF37","#1A2E5A","#E8670A"];

var activeCatId="u13";

