/* ===== 01-config.js — Constantes globales : poles, categories, couleurs, saison ===== */
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
 {id:"competition",name:"Compétition 5x5",sub:"Le coeur du projet sportif ASMB",desc:"Compétitions · Entraînements · Équipes",icon:"🏆",color:"#C0392B",ready:true,
 about:"Le basket 5x5 structure notre projet sportif. De l'initiation aux seniors, chaque joueur progresse dans un cadre exigeant et bienveillant.",
 items:["Championnats locaux et regionaux","Développement des équipes par catégorie","Encadrement de qualité · Educateurs formes","Esprit d'équipe · Respect · Engagement"]},
 {id:"3x3",name:"3x3",sub:"Rapide · Urbain · Accessible",desc:"Compétitions · Événements · Détection",icon:"🏀",color:"#E8670A",ready:true,
 about:"Le 3x3 est une pratique dynamique qui complète notre projet. Plus rapide, plus libre, il permet a chacun de s'exprimer dans un format moderne.",
 items:["Compétitions 3x3 · Tournois locaux","Détection et formation des talents","Événements et animations urbaines","Mixite et inclusion favorisees"]},
 {id:"evenement",name:"Événements",sub:"Des rendez-vous qui nous rassemblent",desc:"Tournois · Soirees · Journees club",icon:"🎉",color:"#8E44AD",ready:true,
 about:"L'ASMB organise des événements tout au long de la saison pour faire vivre notre passion, creer du lien et faire rayonner notre territoire.",
 items:["Creation de tournois 3x3 et 5x5","Soirees et journees club","Echanges inter-clubs · Tournoi international","Journees formation et arbitrage"]},
 {id:"basketpourtous",name:"Basket Pour Tous",sub:"Un club où chacun trouve sa place",desc:"Basket santé · Loisir · Inclusif · Adapte",icon:"🤝",color:"#16A085",ready:true,
 about:"Le basket accessible a toutes et tous, sans distinction. Des séances adaptees, inclusives et bienveillantes pour partager le plaisir du jeu ensemble.",
 items:["Basket Santé · Basket Handicap","Basket Loisir · Basket Adapte","Tous ages · Tous niveaux · Debutants bienvenus","Séances adaptees et bienveillantes"]}
];
const ELITE_CATS=[
 {id:"u9",name:"U9",desc:"3 cycles · 16 séances · Decouverte",icon:"",color:"#E8670A",ready:true},
 {id:"u11",name:"U11",desc:"3 cycles · 15 séances · Mini-basket",icon:"",color:"#16A085",ready:true},
 {id:"u13",name:"U13 (Filles et Garcons)",desc:"5 cycles · 47 séances · "+getCurrentSeason(),icon:"",color:"#D4AF37",ready:true}
];
const VACS=[
 {n:"Toussaint",d:"17 oct. - 2 nov. 2026",imp:"4 séances",c:"#E8670A"},
 {n:"Noel",d:"19 dec. 2026 - 4 janv. 2027",imp:"5 séances",c:"#8E44AD"},
 {n:"Hiver",d:"21 fev. - 9 mars 2026",imp:"4 séances",c:"#1A2E5A"},
 {n:"Printemps",d:"25 avr. - 11 mai 2026",imp:"4 séances",c:"#D4AF37"}
];
const KC=["#16A085","#8E44AD","#D4AF37","#1A2E5A","#E8670A"];

var activeCatId="u13";

