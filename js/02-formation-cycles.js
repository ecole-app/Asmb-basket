/* ===== 02-formation-cycles.js — Donnees et accesseurs des cycles du Pole Formation ===== */
// ── CYCLES MODIFIABLES (point 4) ────────────────────────────────────
// Le contenu pedagogique d'origine reste dans le code (CYCLES / CYCLES_U9 / CYCLES_U11).
// Les ajouts et modifications du dirigeant sont stockes a part et fusionnes par-dessus,
// ce qui permet d'editer sans jamais perdre le contenu de reference.
function builtinCyclesForCat(catId){
 if(catId==="u9")return CYCLES_U9;
 if(catId==="u11")return CYCLES_U11;
 if(catId==="u15")return CYCLES_U15;
 return CYCLES;
}
function getCycleOverrides(){try{return JSON.parse(localStorage.getItem("asmb_cycles_custom")||"{}");}catch(e){return {};}}
function saveCycleOverrides(o){
  localStorage.setItem("asmb_cycles_custom",JSON.stringify(o));
  if(window.fbDb&&window.fbSetDoc){
    window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","cycles_custom"),{data:JSON.stringify(o)},{merge:true}).catch(function(){});
  }
}
function fetchCycleOverridesFromCloud(){
  if(!window.fbDb||!window.fbGetDoc)return;
  window.fbGetDoc(window.fbDoc(window.fbDb,"app_data","cycles_custom")).then(function(snap){
    if(snap&&snap.exists()&&snap.data().data){
      localStorage.setItem("asmb_cycles_custom",snap.data().data);
      if(document.getElementById("scr-u13home")&&document.querySelector("#scr-u13home.on")) buildU13Home();
    }
  }).catch(function(){});
}
function getCyclesForCat(catId){
 var ov=getCycleOverrides();
 var base=builtinCyclesForCat(catId).map(function(cy){
   var patch=ov.edits&&ov.edits[cy.id];
   if(!patch)return cy;
   var merged=Object.assign({},cy,patch);
   var seas=cy.seas.slice();
   // Modifications ciblees de seances d'origine (titre / objectif / duree)
   if(patch.seaPatches){
     seas=seas.map(function(s){
       var sp=patch.seaPatches[s.num];
       return sp?Object.assign({},s,sp):s;
     });
   }
   // Seances d'origine masquees
   if(patch.hiddenSeas&&patch.hiddenSeas.length){
     seas=seas.filter(function(s){return patch.hiddenSeas.indexOf(s.num)<0;});
   }
   // Seances ajoutees par le dirigeant
   if(patch.extraSeas&&patch.extraSeas.length){
     seas=seas.concat(patch.extraSeas);
   }
   merged.seas=seas;
   merged.s=seas.length;
   delete merged.extraSeas;
   delete merged.seaPatches;
   delete merged.hiddenSeas;
   return merged;
 });
 // Retire les cycles d'origine masques
 if(ov.hidden&&ov.hidden.length){
   base=base.filter(function(cy){return ov.hidden.indexOf(cy.id)<0;});
 }
 // Ajoute les cycles crees de toutes pieces pour cette categorie
 var customs=(ov.custom||[]).filter(function(cy){return cy.cat===catId;});
 return base.concat(customs);
}
// Toutes les categories declarees, jamais une liste figee : une categorie
// ajoutee a ELITE_CATS doit etre trouvable sans toucher a ce code.
function allCyclesFlat(){
 return ELITE_CATS.reduce(function(acc,c){ return acc.concat(getCyclesForCat(c.id)); },[]);
}
function activeCycles(){return getCyclesForCat(activeCatId);}
// Cherche d'abord dans la categorie affichee. Deux categories peuvent porter le
// meme identifiant de cycle : renvoyer celui d'une autre categorie afficherait
// silencieusement le mauvais contenu, sans que rien ne le signale a l'ecran.
function findCycle(cyId){
 var inCat=getCyclesForCat(activeCatId).find(function(c){return c.id==cyId;});
 if(inCat) return inCat;
 return allCyclesFlat().find(function(c){return c.id==cyId;});
}
// Garde-fou de developpement : signale des identifiants de cycle en double
// entre categories, cause d'affichage silencieux du mauvais contenu.
function checkCycleIdCollisions(){
 var seen={}, dup=[];
 ELITE_CATS.forEach(function(cat){
   getCyclesForCat(cat.id).forEach(function(cy){
     if(seen[cy.id] && seen[cy.id]!==cat.id) dup.push(cy.id+" ("+seen[cy.id]+" et "+cat.id+")");
     else seen[cy.id]=cat.id;
   });
 });
 if(dup.length) console.warn("Cycles en double entre categories :",dup.join(", "));
 return dup;
}

const CYCLES_U9=[
 {id:101,n:"Decouverte et motricite",sh:"Motricite",p:"Sept. - mi-oct.",s:6,c:"#E8670A",e:"",
 objs:["Se reperer dans l'espace de jeu","Coordonner course, arret, saut","Apprivoiser le ballon (porter, rouler, lancer)","Respecter les regles simples et les autres","Prendre plaisir a jouer"],
 seas:[
 {num:"101.1",t:"Je decouvre le gymnase et le ballon",dur:"1h30",obj:"Se familiariser avec l'espace et le ballon",sits:[
 {ti:"Les demenageurs",dur:"20 min",desc:"Deux equipes transportent un maximum de ballons d'un cerceau a l'autre en courant, un ballon a la fois.",org:"2 cerceaux par equipe. 10 ballons au centre.",axes:["Varier le deplacement : a cloche-pied, en arriere","Transporter le ballon en le faisant rouler"],kws:["Courir","Poser","Vite","Chacun son tour"],ch:null},
 {ti:"Le ballon voyageur",dur:"20 min",desc:"En cercle, le ballon passe de main en main le plus vite possible. Puis dans l'autre sens, puis deux ballons.",org:"Cercle de 8 a 10 joueurs. 1 puis 2 ballons.",axes:["Passer par-dessus la tete","Passer entre les jambes"],kws:["Regarder","Tendre les mains","Attention","Rythme"],ch:null},
 {ti:"Jeu libre au panier",dur:"25 min",desc:"Paniers abaisses. Chaque joueur essaie de marquer comme il veut, sans consigne technique.",org:"Paniers a 2m60. 1 ballon pour 2.",axes:["Se rapprocher du panier","Compter les paniers en equipe"],kws:["Essayer","Viser","Recommencer","S'amuser"],ch:null}]},
 {num:"101.2",t:"Courir, s'arreter, changer de direction",dur:"1h30",obj:"Developper la motricite de base",sits:[
 {ti:"Feu rouge feu vert",dur:"20 min",desc:"Les joueurs courent avec un ballon dans les mains. Au signal rouge, arret immediat sur deux pieds.",org:"Zone delimitee. 1 ballon par joueur.",axes:["Ajouter feu orange : marcher","Arret sur un pied"],kws:["Ecouter","Freiner","Equilibre","Genoux flechis"],ch:null},
 {ti:"Les dechets",dur:"25 min",desc:"Des plots sont renverses. Une equipe les releve, l'autre les renverse. Duree 1 minute puis on compte.",org:"20 plots repartis. 2 equipes.",axes:["Se deplacer en dribble","Uniquement avec la main gauche"],kws:["Vite","Se baisser","Repartir","Chercher"],ch:null},
 {ti:"Parcours moteur",dur:"30 min",desc:"Slalom entre plots, saut par-dessus une haie basse, course arriere, tir au panier.",org:"2 parcours identiques. Depart en relais.",axes:["Ajouter un ballon a porter","Chronometrer l'equipe"],kws:["Enchainer","Sauter","Reculer","Finir"],ch:null}]},
 {num:"101.3",t:"Premiers dribbles",dur:"1h30",obj:"Decouvrir le rebond du ballon",sits:[
 {ti:"Le ballon qui rebondit",dur:"20 min",desc:"Assis puis a genoux puis debout : faire rebondir le ballon avec une main, puis l'autre.",org:"Joueurs espaces. 1 ballon chacun.",axes:["Compter le nombre de rebonds sans perdre","Alterner droite gauche"],kws:["Pousser","Souple","Doigts","Regarder devant"],ch:null},
 {ti:"Dribble promenade",dur:"25 min",desc:"Se deplacer librement dans la salle en dribblant, sans toucher les autres.",org:"Toute la surface. 1 ballon par joueur.",axes:["Reduire l'espace","Au signal : changer de main"],kws:["Tete haute","Eviter","Controler","Doucement"],ch:null},
 {ti:"L'epervier dribbleur",dur:"30 min",desc:"Traverser la salle en dribblant sans se faire toucher par l'epervier au centre.",org:"2 lignes de fond. 1 puis 2 eperviers.",axes:["Epervier sans ballon","Ajouter des eperviers a chaque tour"],kws:["Proteger","Accelerer","Esquiver","Traverser"],ch:null}]},
 {num:"101.4",t:"Lancer et attraper",dur:"1h30",obj:"Coordonner lancer et reception",sits:[
 {ti:"Passe a dix",dur:"25 min",desc:"Deux equipes. Faire dix passes de suite sans que l'adversaire touche le ballon.",org:"Demi-terrain. Equipes de 4.",axes:["Interdire de courir avec le ballon","Compter jusqu'a cinq seulement"],kws:["Appeler","Regarder","Se demarquer","Passer"],ch:null},
 {ti:"Les balles brulantes",dur:"20 min",desc:"Renvoyer tous les ballons dans le camp adverse. Au signal stop, l'equipe avec le moins de ballons gagne.",org:"Terrain separe en deux. 12 ballons.",axes:["Lancer a une main","Faire rouler uniquement"],kws:["Vite","Lancer loin","Ramasser","Ne pas s'arreter"],ch:null},
 {ti:"Panier en groupe",dur:"30 min",desc:"Par trois, se faire deux passes minimum avant de tirer au panier.",org:"3 joueurs par panier. 1 ballon.",axes:["Passe obligatoire a chacun","Depart de plus loin"],kws:["Partager","Compter","Viser","Encourager"],ch:null}]},
 {num:"101.5",t:"Premiers matchs 3 contre 3",dur:"1h30",obj:"Jouer ensemble avec des regles simples",sits:[
 {ti:"Rappel des regles",dur:"15 min",desc:"Explication ludique : marcher, reprise de dribble, sortie. Demonstration par les joueurs.",org:"Groupe assis autour du coach.",axes:["Faire arbitrer un joueur","Mimer les fautes"],kws:["Comprendre","Ecouter","Respecter","Demander"],ch:null},
 {ti:"3c3 tournoi",dur:"35 min",desc:"Matchs de 4 minutes en 3 contre 3 sur demi-terrain. Rotation des equipes.",org:"3 equipes de 3. Chronometre.",axes:["Tous doivent toucher le ballon avant de tirer","Panier a 2 points si passe decisive"],kws:["Jouer","S'entraider","Defendre","Marquer"],ch:"ok:3c3 - format recommande mini-basket FFBB"},
 {ti:"Bilan et concours de tirs",dur:"20 min",desc:"Chaque joueur tire 5 fois depuis sa position preferee. On additionne par equipe.",org:"Par equipe a un panier.",axes:["Reculer d'un pas a chaque panier","Tir a une main obligatoire"],kws:["Viser","Respirer","Applaudir","Progresser"],ch:null}]},
 {num:"101.6",t:"Seance bilan et jeux",dur:"1h30",obj:"Evaluer les acquis en s'amusant",sits:[
 {ti:"Circuit d'evaluation",dur:"30 min",desc:"Quatre ateliers : dribble slalom, passes au mur, tirs, parcours moteur. Le coach observe et note.",org:"4 ateliers de 5 min. Groupes de 3.",axes:["Refaire un atelier rate","Binome qui encourage"],kws:["Montrer","Essayer","Progres","Confiance"],ch:null},
 {ti:"Le beret basket",dur:"25 min",desc:"Deux equipes numerotees. Au numero appele, les deux joueurs courent chercher le ballon et vont marquer.",org:"2 lignes face a face. Ballon au centre.",axes:["Appeler deux numeros","Ajouter un dribble obligatoire"],kws:["Reagir","Sprint","Attraper","Marquer"],ch:null},
 {ti:"Match final",dur:"30 min",desc:"3c3 libre, coach en soutien. Objectif : plaisir et application des acquis.",org:"Demi-terrain. Equipes equilibrees.",axes:["Coach joue avec les plus timides","Silence coach : autonomie"],kws:["Plaisir","Ensemble","Oser","Feliciter"],ch:"ok:3c3 - format recommande mini-basket FFBB"}]}
 ]},
 {id:102,n:"Manipulation et adresse",sh:"Adresse",p:"Nov. - dec.",s:5,c:"#8E44AD",e:"",
 objs:["Dribbler en avancant sans regarder le ballon","Realiser une passe precise a 4 metres","Tirer pres du panier avec une bonne posture","Se demarquer pour recevoir","Occuper l'espace de jeu"],
 seas:[
 {num:"102.1",t:"Dribble en mouvement",dur:"1h30",obj:"Dribbler en se deplacant vite",sits:[
 {ti:"Dribble aveugle",dur:"20 min",desc:"Dribbler sur place en regardant le coach qui montre des chiffres avec les doigts.",org:"Joueurs en demi-cercle face au coach.",axes:["Changer de main au signal","Dribble bas puis haut"],kws:["Tete haute","Sentir","Compter","Controler"],ch:null},
 {ti:"Course relais dribble",dur:"25 min",desc:"Relais par equipe : aller en dribble main droite, retour main gauche.",org:"4 equipes. 1 ballon par equipe.",axes:["Slalom au retour","Passer sous les jambes a l'arrivee"],kws:["Vitesse","Changer","Transmettre","Encourager"],ch:null},
 {ti:"Roi du dribble",dur:"30 min",desc:"Tous dribblent dans une zone. Chacun protege son ballon et tente de sortir celui des autres.",org:"Zone reduite. 1 ballon par joueur.",axes:["Eliminer = refaire 10 dribbles pour revenir","Zone qui retrecit"],kws:["Proteger","Corps","Regarder","Resister"],ch:null}]},
 {num:"102.2",t:"La passe qui arrive",dur:"1h30",obj:"Passer avec precision",sits:[
 {ti:"Cibles murales",dur:"20 min",desc:"Passes contre le mur sur des cibles dessinees, a differentes distances.",org:"Binomes face au mur. Cibles scotchees.",axes:["Reculer d'un metre","Passe a rebond obligatoire"],kws:["Viser","Pousser","Bras tendus","Precision"],ch:null},
 {ti:"L'etoile",dur:"25 min",desc:"Cinq joueurs en etoile. Le ballon circule selon un ordre fixe. On accelere progressivement.",org:"Groupes de 5 en cercle.",axes:["Ajouter un 2e ballon","Changer de sens au signal"],kws:["Anticiper","Regarder","Rythme","Concentration"],ch:null},
 {ti:"2c1 vers le panier",dur:"30 min",desc:"Deux attaquants montent contre un defenseur. Objectif : marquer apres au moins une passe.",org:"File d'attaquants. Defenseur au centre.",axes:["Defenseur passif","Interdire le dribble"],kws:["Lire","Decider","Passer","Conclure"],ch:"ok:Surnombre 2c1 - progressivite adaptee"}]},
 {num:"102.3",t:"Tirer pres du cercle",dur:"1h30",obj:"Construire un tir efficace",sits:[
 {ti:"Tir sans ballon",dur:"15 min",desc:"Reproduire le geste de tir face au coach, pieds bien places, coude sous le ballon imaginaire.",org:"En ligne face au coach.",axes:["Avec un ballon leger","Yeux fermes pour sentir"],kws:["Pieds","Coude","Poignet","Regard"],ch:null},
 {ti:"Le tour du panier",dur:"30 min",desc:"Cinq positions autour du panier. Marquer pour passer a la suivante.",org:"3 joueurs par panier. Paniers abaisses.",axes:["Se rapprocher si difficile","Deux paniers d'affilee pour avancer"],kws:["Position","Fluidite","Patience","Reussir"],ch:null},
 {ti:"Concours par equipe",dur:"25 min",desc:"Chaque equipe cumule ses paniers en 5 minutes. Rebond assure par un partenaire.",org:"Equipes de 4 par panier.",axes:["Points doubles a mi-distance","Chacun doit marquer une fois"],kws:["Enchainer","Rebond","Compter","Equipe"],ch:null}]},
 {num:"102.4",t:"Se demarquer",dur:"1h30",obj:"Bouger pour recevoir le ballon",sits:[
 {ti:"Le mouchoir demarque",dur:"20 min",desc:"Le porteur ne peut pas bouger. Les partenaires doivent se rendre disponibles pour recevoir.",org:"Groupes de 4 dans une zone.",axes:["Ajouter un defenseur","Passe interdite en arriere"],kws:["Bouger","Appeler","Espace","Voir"],ch:null},
 {ti:"Passe et va",dur:"30 min",desc:"Je passe puis je cours vers le panier pour recevoir en retour et marquer.",org:"2 files. 1 ballon.",axes:["Sans dribble","Ajouter un defenseur passif"],kws:["Passer","Courir","Recevoir","Marquer"],ch:null},
 {ti:"4c4 tout terrain",dur:"30 min",desc:"Match avec obligation de trois passes avant de tirer.",org:"Terrain complet. 2 equipes de 4.",axes:["Reduire a deux passes","Panier double si tout le monde a touche"],kws:["Circuler","Partager","Espacer","Jouer"],ch:"ok:Jeu 4c4 - developpement du jeu collectif"}]},
 {num:"102.5",t:"Tournoi de Noel",dur:"1h30",obj:"Mettre en application dans le jeu",sits:[
 {ti:"Echauffement en musique",dur:"15 min",desc:"Deplacements varies avec ballon sur rythme musical.",org:"Toute la salle. Musique.",axes:["Suivre un meneur","Inventer un mouvement"],kws:["Bouger","Rythme","Sourire","Ensemble"],ch:null},
 {ti:"Ateliers concours",dur:"30 min",desc:"Trois defis : dribble chrono, passes en 30 secondes, tirs en 1 minute.",org:"3 ateliers tournants.",axes:["Refaire son meilleur score","Defi par equipe"],kws:["Defi","Record","Precision","Vitesse"],ch:null},
 {ti:"Tournoi 3c3",dur:"35 min",desc:"Mini-tournoi avec toutes les equipes. Chaque match dure 5 minutes.",org:"Equipes de 3. Tableau de matchs.",axes:["Rotation obligatoire des joueurs","Arbitrage par les joueurs"],kws:["Competition","Fair-play","Effort","Fete"],ch:"ok:3c3 - format recommande mini-basket FFBB"}]}
 ]},
 {id:103,n:"Jeu collectif et opposition",sh:"Collectif",p:"Janv. - mars",s:5,c:"#1A2E5A",e:"",
 objs:["Defendre sur son adversaire direct","Monter le ballon en contre-attaque","Prendre le rebond","Choisir entre tirer, passer, dribbler","Jouer en respectant l'arbitre et l'adversaire"],
 seas:[
 {num:"103.1",t:"Je defends",dur:"1h30",obj:"Decouvrir la defense individuelle",sits:[
 {ti:"L'ombre",dur:"20 min",desc:"Par deux, le defenseur reproduit les deplacements de l'attaquant sans ballon, en restant face a lui.",org:"Binomes espaces. Zone 4m.",axes:["Attaquant plus rapide","Ajouter le ballon"],kws:["Face","Glisser","Distance","Bras"],ch:"ok:Defense individuelle - conforme charte"},
 {ti:"1c1 depart ligne",dur:"30 min",desc:"L'attaquant part de la ligne mediane, le defenseur du lancer-franc. Objectif attaquant : marquer.",org:"2 files. Rotation attaque defense.",axes:["Defenseur recule d'abord","Limiter a 3 dribbles"],kws:["Position basse","Reculer","Genou","Ne pas croiser"],ch:"ok:Defense individuelle 1v1 - conforme charte"},
 {ti:"Match a theme defense",dur:"30 min",desc:"4c4. Un point supplementaire a chaque ballon recupere proprement.",org:"Demi-terrain. 2 equipes.",axes:["Compter les interceptions","Defense stricte sans contact"],kws:["Anticiper","Intercepter","Aider","Communiquer"],ch:"ok:Defense individuelle stricte - charte respectee"}]},
 {num:"103.2",t:"Le rebond",dur:"1h30",obj:"Aller chercher le ballon apres le tir",sits:[
 {ti:"Sauter et attraper",dur:"20 min",desc:"Le coach lance le ballon sur la planche, le joueur saute pour l'attraper a deux mains.",org:"File sous le panier.",axes:["Attraper en l'air obligatoire","Enchainer avec un tir"],kws:["Sauter","Deux mains","Proteger","Redescendre"],ch:null},
 {ti:"Rebond 1c1",dur:"30 min",desc:"Apres un tir du coach, deux joueurs se disputent le rebond puis jouent 1c1.",org:"Binomes. Coach tireur.",axes:["Placer le defenseur devant","Marquer obligatoirement en 5 secondes"],kws:["Ecran","Se placer","Vouloir","Conclure"],ch:null},
 {ti:"Match rebond compte double",dur:"30 min",desc:"4c4. Chaque rebond offensif rapporte un point a l'equipe.",org:"Demi-terrain.",axes:["Rebond defensif aussi compte","Tir obligatoire en 10 secondes"],kws:["Attaquer","Insister","Second effort","Equipe"],ch:null}]},
 {num:"103.3",t:"La contre-attaque",dur:"1h30",obj:"Monter vite le ballon",sits:[
 {ti:"Course au panier",dur:"20 min",desc:"Depart ligne de fond, monter en dribble le plus vite possible et marquer.",org:"Files. Chronometre.",axes:["Maximum 4 dribbles","Finir en lay-up"],kws:["Sprint","Pousser loin","Controle","Finir"],ch:null},
 {ti:"3c2 en montee",dur:"30 min",desc:"Trois attaquants partent en contre-attaque contre deux defenseurs.",org:"Rotation attaque defense. Terrain complet.",axes:["Passer obligatoirement une fois","Defenseurs partent en retard"],kws:["Courir","Ecarter","Lire","Choisir"],ch:"ok:Surnombre 3c2 - developpement lecture de jeu"},
 {ti:"Match transitions",dur:"30 min",desc:"4c4 avec obligation de tirer dans les 8 secondes apres recuperation.",org:"Terrain complet. Chrono visible.",axes:["Allonger a 12 secondes","Panier en contre = 3 points"],kws:["Vite","Regarder devant","Decider","Oser"],ch:null}]},
 {num:"103.4",t:"Choisir la bonne solution",dur:"1h30",obj:"Prendre la bonne decision",sits:[
 {ti:"Le feu tricolore",dur:"20 min",desc:"Selon la couleur brandie par le coach : tirer, passer ou dribbler.",org:"Joueurs avec ballon face au panier.",axes:["Deux couleurs en meme temps","Ajouter un defenseur"],kws:["Voir","Choisir","Agir","Rapidite"],ch:null},
 {ti:"2c2 lecture",dur:"30 min",desc:"Deux attaquants contre deux defenseurs. L'attaquant doit choisir selon la reaction de la defense.",org:"Demi-terrain. Rotation.",axes:["Defense qui aide fort","Interdire le dribble"],kws:["Observer","Fixer","Servir","Conclure"],ch:"ok:2c2 - defense individuelle uniquement"},
 {ti:"Match libre coache",dur:"30 min",desc:"4c4. Le coach arrete le jeu pour poser des questions sur les choix effectues.",org:"Terrain complet.",axes:["Un joueur explique son choix","Silence total du coach"],kws:["Reflechir","Expliquer","Comprendre","Repeter"],ch:null}]},
 {num:"103.5",t:"Plateau et bilan",dur:"1h30",obj:"Jouer un plateau dans l'esprit mini-basket",sits:[
 {ti:"Echauffement collectif",dur:"20 min",desc:"Ateliers courts : dribble, passes, tirs. Tous les joueurs tournent.",org:"3 ateliers.",axes:["En musique","Avec un binome"],kws:["Preparer","Ensemble","Concentration","Energie"],ch:null},
 {ti:"Matchs de plateau",dur:"40 min",desc:"Serie de matchs 4c4 de 6 minutes contre les autres equipes du club.",org:"2 terrains. Rotation.",axes:["Tous jouent le meme temps","Arbitrage partage"],kws:["Fair-play","Effort","Respect","Plaisir"],ch:"ok:Plateau mini-basket - format FFBB"},
 {ti:"Gouter et bilan",dur:"25 min",desc:"Retour au calme, discussion sur les progres de chacun, remise de diplomes.",org:"Groupe assis en cercle.",axes:["Chacun cite un progres","Elire le meilleur esprit d'equipe"],kws:["Bilan","Fierte","Progres","Convivialite"],ch:null}]}
 ]}
];

const CYCLES_U11=[
 {id:201,n:"Technique individuelle",sh:"Technique",p:"Sept. - mi-oct.",s:5,c:"#16A085",e:"",
 objs:["Dribbler des deux mains en avancant","Realiser un tir en course (lay-up)","Passer avec precision a 6 metres","Adopter une position defensive correcte","Connaitre les regles de base (marcher, reprise)"],
 seas:[
 {num:"201.1",t:"Dribble des deux mains",dur:"1h30",obj:"Maitriser le dribble main faible",sits:[
 {ti:"Dribble stationnaire varie",dur:"20 min",desc:"Dribble bas, haut, croise devant, tour de taille. 30 secondes par exercice, les deux mains.",org:"Joueurs espaces, 1 ballon chacun.",axes:["Yeux fermes 10 secondes","Deux ballons simultanes"],kws:["Bout des doigts","Poignet","Tete haute","Main faible"],ch:null},
 {ti:"Slalom chronometre",dur:"25 min",desc:"Parcours de 6 plots en slalom avec changement de main a chaque plot, puis tir.",org:"2 parcours. Chrono individuel.",axes:["Changement dans le dos","Retour en dribble arriere"],kws:["Changer","Proteger","Accelerer","Finir"],ch:null},
 {ti:"1c1 depart lateral",dur:"30 min",desc:"Attaquant part du cote, defenseur le contraint vers l'exterieur. Trois dribbles maximum.",org:"Files des deux cotes. Rotation.",axes:["Limiter a deux dribbles","Defenseur passif au depart"],kws:["Premier appui","Vitesse","Lecture","Conclusion"],ch:"ok:Defense individuelle 1v1 - conforme charte"}]},
 {num:"201.2",t:"Le tir en course",dur:"1h30",obj:"Acquerir le lay-up des deux cotes",sits:[
 {ti:"Pas chasses sans ballon",dur:"15 min",desc:"Travail du rythme deux appuis : droite-gauche-saut cote droit, puis inverse.",org:"Files sous le panier, sans ballon.",axes:["Avec ballon porte","Depart plus loin"],kws:["Rythme","Genou leve","Impulsion","Planche"],ch:null},
 {ti:"Lay-up avec dribble",dur:"30 min",desc:"Depart de la ligne des 3 points, deux dribbles puis tir en course sur la planche.",org:"File droite puis file gauche. Rebondeur.",axes:["Cote gauche obligatoire","Depart en course"],kws:["Deux appuis","Banque","Main haute","Continuite"],ch:null},
 {ti:"Course-poursuite",dur:"30 min",desc:"Deux joueurs partent, celui devant doit marquer en lay-up, celui derriere tente de rattraper.",org:"Depart ligne de fond decale de 2m.",axes:["Reduire l'ecart de depart","Defenseur part en meme temps"],kws:["Sprint","Sang-froid","Protection","Reussite"],ch:null}]},
 {num:"201.3",t:"Passes precises et variees",dur:"1h30",obj:"Diversifier les types de passe",sits:[
 {ti:"Les 4 passes",dur:"20 min",desc:"Poitrine, rebond, au-dessus de la tete, a une main. 10 repetitions de chaque par binome.",org:"Binomes a 5m. 1 ballon.",axes:["Augmenter a 7m","Sous pression d'un defenseur"],kws:["Extension","Poignets","Cible poitrine","Choix"],ch:null},
 {ti:"Passes en mouvement",dur:"25 min",desc:"Monter le terrain a deux en se faisant des passes, sans dribble, et conclure au panier.",org:"Binomes, terrain complet.",axes:["A trois joueurs","Chronometrer la montee"],kws:["Timing","Course","Devant soi","Conclure"],ch:null},
 {ti:"Ballon capitaine",dur:"30 min",desc:"Match 4c4 ou il faut passer au capitaine place derriere la ligne de fond adverse pour marquer.",org:"Terrain complet. 2 capitaines.",axes:["Interdire le dribble","Deux capitaines par equipe"],kws:["Ouvrir","Voir loin","Se demarquer","Patience"],ch:null}]},
 {num:"201.4",t:"Position defensive",dur:"1h30",obj:"Defendre sans faire faute",sits:[
 {ti:"Glissades defensives",dur:"20 min",desc:"Deplacement lateral en position basse sans croiser les pieds, sur signal du coach.",org:"En ligne sur la largeur.",axes:["Signaux aleatoires","Ajouter un sprint retour"],kws:["Pas chasses","Bassin bas","Bras ecartes","Regard"],ch:"ok:Defense individuelle - base charte CD42"},
 {ti:"Miroir avec ballon",dur:"25 min",desc:"L'attaquant dribble lentement, le defenseur reste face a lui a un bras de distance.",org:"Binomes dans un couloir.",axes:["Attaquant plus rapide","Autoriser l'interception"],kws:["Distance","Anticiper","Ne pas croiser","Main basse"],ch:"ok:Defense individuelle stricte"},
 {ti:"Shell drill simplifie",dur:"30 min",desc:"4 attaquants font circuler le ballon, 4 defenseurs ajustent leur position a chaque passe.",org:"Demi-terrain, positions fixes.",axes:["Ajouter une coupe","Autoriser le tir apres 4 passes"],kws:["Ajuster","Communiquer","Voir ballon et joueur","Ensemble"],ch:"ok:Defense individuelle - pas de zone en U11"}]},
 {num:"201.5",t:"Les regles du jeu",dur:"1h30",obj:"Comprendre et appliquer les regles",sits:[
 {ti:"Atelier regles",dur:"20 min",desc:"Le coach mime des actions, les joueurs disent si c'est faute, marcher, reprise ou correct.",org:"Groupe assis. Demonstrations.",axes:["Les joueurs miment a leur tour","Quiz par equipe"],kws:["Marcher","Reprise","Faute","Sortie"],ch:null},
 {ti:"Match arbitre par les joueurs",dur:"35 min",desc:"4c4 ou deux joueurs arbitrent en alternance avec le coach en soutien.",org:"Demi-terrain. Sifflets.",axes:["Arbitre unique","Expliquer chaque coup de sifflet"],kws:["Observer","Decider","Assumer","Respecter"],ch:null},
 {ti:"Concours lancers-francs",dur:"25 min",desc:"Serie de 5 lancers-francs par joueur, avec la vraie procedure et le respect du rituel.",org:"Par panier, groupes de 4.",axes:["Sous pression du groupe","Match nul = mort subite"],kws:["Rituel","Respirer","Routine","Concentration"],ch:null}]}
 ]},
 {id:202,n:"Jeu a deux et lecture",sh:"Jeu a deux",p:"Nov. - dec.",s:5,c:"#8E44AD",e:"",
 objs:["Realiser un passe-et-va efficace","Exploiter le surnombre 2c1 et 3c2","Se demarquer sur porteur en difficulte","Prendre le rebond offensif et defensif","Choisir entre tir, passe et dribble"],
 seas:[
 {num:"202.1",t:"Passe et va",dur:"1h30",obj:"Enchainer passe et coupe au panier",sits:[
 {ti:"Passe et va a vide",dur:"20 min",desc:"Je passe au coach, je coupe vers le panier, je recois et je marque en lay-up.",org:"File unique. Coach relayeur.",axes:["Coupe devant puis derriere","Ajouter un defenseur passif"],kws:["Passer","Couper vite","Demander","Finir"],ch:null},
 {ti:"Passe et va 2c2",dur:"30 min",desc:"Deux attaquants contre deux defenseurs, obligation de jouer un passe-et-va avant de conclure.",org:"Demi-terrain. Rotation.",axes:["Defense stricte","Ajouter un ecran"],kws:["Fixer","Couper","Servir","Marquer"],ch:"ok:2c2 defense individuelle"},
 {ti:"Match a theme",dur:"30 min",desc:"5c5 ou le panier compte double s'il vient d'un passe-et-va.",org:"Terrain complet.",axes:["Compter les coupes reussies","Sans dribble apres la passe"],kws:["Mouvement","Timing","Recompense","Repetition"],ch:null}]},
 {num:"202.2",t:"Le surnombre",dur:"1h30",obj:"Exploiter la superiorite numerique",sits:[
 {ti:"2c1 en montee",dur:"25 min",desc:"Deux attaquants montent contre un defenseur. Lire la position du defenseur pour choisir.",org:"Terrain complet, rotation rapide.",axes:["Interdire le dribble","Defenseur agressif"],kws:["Ecarter","Fixer","Lire","Servir"],ch:"ok:Surnombre 2c1 - progressivite adaptee"},
 {ti:"3c2 organise",dur:"30 min",desc:"Trois attaquants en triangle contre deux defenseurs, conclure en moins de 6 secondes.",org:"Demi-terrain. Chrono.",axes:["4c3","Defenseurs en ligne puis en triangle"],kws:["Largeur","Vision","Extra-passe","Vitesse"],ch:"ok:Surnombre 3c2 - lecture de jeu"},
 {ti:"Transition continue",dur:"25 min",desc:"Apres chaque conclusion, les defenseurs repartent en attaque avec un partenaire supplementaire.",org:"Terrain complet, flux continu.",axes:["Panier obligatoire pour repartir","Ajouter un ballon"],kws:["Enchainer","Courir","Communiquer","Endurance"],ch:null}]},
 {num:"202.3",t:"Se rendre disponible",dur:"1h30",obj:"Aider le porteur en difficulte",sits:[
 {ti:"Porteur bloque",dur:"20 min",desc:"Le porteur est sous pression et immobile. Les partenaires doivent venir a lui pour le liberer.",org:"Groupes de 4 dans une zone.",axes:["Ajouter un second defenseur","Chronometrer la sortie de balle"],kws:["Venir","Appeler","Angle","Sauver"],ch:null},
 {ti:"Remise en jeu sous pression",dur:"25 min",desc:"Remise en jeu depuis la ligne de fond avec defense sur tous les receveurs.",org:"Demi-terrain, 4c4.",axes:["5 secondes strictes","Defense tout terrain"],kws:["Bouger","Se croiser","Feinter","Recevoir"],ch:null},
 {ti:"Match sans dribble",dur:"35 min",desc:"5c5 avec dribble interdit, obligeant le mouvement permanent sans ballon.",org:"Terrain complet.",axes:["Autoriser un dribble","Compter les passes reussies"],kws:["Bouger","Anticiper","Espacer","Collectif"],ch:null}]},
 {num:"202.4",t:"Le rebond",dur:"1h30",obj:"Gagner la bataille du rebond",sits:[
 {ti:"Ecran retard",dur:"20 min",desc:"Au tir, le defenseur se retourne et bloque son adversaire avant d'aller au ballon.",org:"Binomes sous le panier. Coach tireur.",axes:["Attaquant tres actif","Compter les rebonds gagnes"],kws:["Se retourner","Contact","Pousser","Chercher"],ch:null},
 {ti:"Rebond 3c3",dur:"30 min",desc:"Trois contre trois, seul le rebond offensif rapporte des points pendant 5 minutes.",org:"Un panier. Coach tireur.",axes:["Rebond defensif aussi","Deuxieme chance obligatoire"],kws:["Volonte","Placement","Timing","Second effort"],ch:null},
 {ti:"Match rebond valorise",dur:"30 min",desc:"5c5 classique, chaque rebond offensif rapporte un point bonus.",org:"Terrain complet.",axes:["Bonus double en fin de match","Compter par equipe"],kws:["Agressivite","Anticiper","Sauter","Conclure"],ch:null}]},
 {num:"202.5",t:"Tournoi de fin d annee",dur:"1h30",obj:"Appliquer les acquis en competition",sits:[
 {ti:"Echauffement autonome",dur:"20 min",desc:"Les joueurs conduisent eux-memes leur echauffement, par groupes de 4.",org:"Groupes autonomes.",axes:["Un capitaine par groupe","Coach observe seulement"],kws:["Autonomie","Serieux","Prepare","Responsable"],ch:null},
 {ti:"Ateliers defis",dur:"25 min",desc:"Trois defis techniques : lay-up chrono, passes precises, lancers-francs.",org:"3 ateliers tournants.",axes:["Score cumule par equipe","Battre son record"],kws:["Precision","Regularite","Defi","Progres"],ch:null},
 {ti:"Tournoi 4c4",dur:"40 min",desc:"Matchs de 8 minutes entre toutes les equipes, avec arbitrage partage.",org:"2 terrains. Tableau.",axes:["Tous jouent le meme temps","Bonus fair-play"],kws:["Competition","Respect","Effort","Plaisir"],ch:"ok:Format 4c4 - adapte U11"}]}
 ]},
 {id:203,n:"Jeu collectif et competition",sh:"Collectif",p:"Janv. - mars",s:5,c:"#1A2E5A",e:"",
 objs:["Occuper les 5 postes sur le terrain","Organiser une contre-attaque a 3 couloirs","Defendre collectivement en individuelle","Gerer les temps forts et faibles d un match","Representer le club en plateau"],
 seas:[
 {num:"203.1",t:"Occuper l espace",dur:"1h30",obj:"Comprendre le placement collectif",sits:[
 {ti:"Les 5 zones",dur:"20 min",desc:"Cinq plots marquent les positions. Les joueurs occupent une zone chacun et font circuler le ballon.",org:"Demi-terrain, 5 plots.",axes:["Changer de zone apres la passe","Ajouter une defense"],kws:["Ecarter","Occuper","Voir","Circuler"],ch:null},
 {ti:"Circulation 5c0",dur:"30 min",desc:"Cinq attaquants font circuler le ballon en respectant les espaces, conclusion apres 6 passes.",org:"Demi-terrain, sans defense.",axes:["Ajouter des coupes","Chronometrer"],kws:["Espacement","Rythme","Continuite","Discipline"],ch:null},
 {ti:"Match espaces valorises",dur:"30 min",desc:"5c5. Le coach arrete le jeu quand deux joueurs sont trop proches.",org:"Terrain complet.",axes:["Zone interdite a deux joueurs","Bonus si tir apres circulation"],kws:["Distance","Lecture","Corriger","Repeter"],ch:null}]},
 {num:"203.2",t:"La contre-attaque a 3 couloirs",dur:"1h30",obj:"Organiser la remontee rapide",sits:[
 {ti:"3 couloirs a vide",dur:"20 min",desc:"Trois joueurs remontent le terrain, un par couloir, en se faisant des passes.",org:"Terrain complet. Vagues de 3.",axes:["Sans dribble","Chronometrer la remontee"],kws:["Couloirs","Largeur","Vitesse","Conclusion"],ch:null},
 {ti:"Rebond puis contre",dur:"30 min",desc:"Apres un rebond defensif, l'equipe declenche immediatement la contre-attaque a 3.",org:"Terrain complet. Coach tireur.",axes:["Ajouter un defenseur de retard","Limiter a 8 secondes"],kws:["Premier relais","Courir","Devancer","Finir"],ch:null},
 {ti:"Match transitions rapides",dur:"30 min",desc:"5c5 avec obligation de tirer dans les 10 secondes suivant une recuperation.",org:"Terrain complet. Chrono visible.",axes:["Reduire a 8 secondes","Panier en contre = 3 points"],kws:["Reactivite","Anticiper","Decider","Oser"],ch:null}]},
 {num:"203.3",t:"Defense collective",dur:"1h30",obj:"Defendre ensemble en individuelle",sits:[
 {ti:"Aide et recuperation",dur:"25 min",desc:"Sur penetration, un partenaire vient aider puis chacun retrouve son joueur.",org:"3c3 demi-terrain.",axes:["Deux aides possibles","Communication obligatoire a voix haute"],kws:["Aider","Parler","Revenir","Solidarite"],ch:"ok:Defense individuelle avec aide - conforme U11"},
 {ti:"Defense tout terrain",dur:"25 min",desc:"Chaque defenseur prend son adversaire des la remise en jeu.",org:"Terrain complet, 4c4.",axes:["Sur une moitie seulement","Interdire l'interception"],kws:["Pression","Endurance","Individuel","Discipline"],ch:"ok:Individuelle tout terrain - pas de zone"},
 {ti:"Match defense valorisee",dur:"30 min",desc:"5c5. Chaque arret defensif (stop) rapporte un point.",org:"Terrain complet.",axes:["Compter les stops consecutifs","Objectif : 3 stops de suite"],kws:["Concentration","Effort","Ensemble","Fierte"],ch:null}]},
 {num:"203.4",t:"Gerer un match",dur:"1h30",obj:"Comprendre les temps forts et faibles",sits:[
 {ti:"Situations de fin de match",dur:"25 min",desc:"Scenarios : mener de 2 a 1 minute, etre mene de 4. Les equipes doivent adapter leur jeu.",org:"5c5. Chrono et score affiches.",axes:["Faute obligatoire si mene","Gerer le temps si devant"],kws:["Lucidite","Choix","Calme","Strategie"],ch:null},
 {ti:"Temps morts joueurs",dur:"20 min",desc:"Les joueurs prennent eux-memes un temps mort et decident de la consigne.",org:"Match arrete par les capitaines.",axes:["Coach silencieux","Un joueur different a chaque fois"],kws:["Parler","Ecouter","Decider","Leadership"],ch:null},
 {ti:"Match complet",dur:"35 min",desc:"Match 5c5 en 4 periodes de 6 minutes avec feuille de match et arbitrage.",org:"Terrain complet. Table de marque.",axes:["Rotation obligatoire","Statistiques tenues par les remplacants"],kws:["Format reel","Rythme","Serieux","Equipe"],ch:"ok:5c5 - format competition U11"}]},
 {num:"203.5",t:"Plateau et bilan",dur:"1h30",obj:"Representer le club en competition",sits:[
 {ti:"Preparation collective",dur:"20 min",desc:"Echauffement type match, rappel des consignes et du role de chacun.",org:"Groupe complet.",axes:["Mene par les capitaines","Rituel d'avant-match"],kws:["Preparer","Concentrer","Motiver","Rituel"],ch:null},
 {ti:"Matchs de plateau",dur:"45 min",desc:"Trois matchs de 4 periodes contre les clubs invites.",org:"2 terrains. Feuilles de match.",axes:["Temps de jeu equitable","Chacun essaie un poste different"],kws:["Competition","Fair-play","Adaptation","Progres"],ch:"ok:Plateau U11 - format FFBB"},
 {ti:"Bilan et projection",dur:"25 min",desc:"Retour collectif sur la saison, objectifs individuels pour la suite, remise de recompenses.",org:"Groupe assis en cercle.",axes:["Chacun fixe un objectif","Vote du meilleur coequipier"],kws:["Bilan","Objectif","Reconnaissance","Avenir"],ch:null}]}
 ]}
];

const CYCLES=[
 {id:1,n:"Fondamentaux Individuels",sh:"Fondamentaux",p:"Sept. - mi-oct. 2026",s:10,c:"#D4AF37",e:"",
 objs:["Maitriser le dribble en deplacement","Passes precises : poitrine rebond une main","Acquerir le tir BEEF et le lay-up","Position défensive individuelle de base","Automatiser le pied-pivot"],
 seas:[
 {num:"1.1",t:"Prise en main et dribble",dur:"1h30",obj:"Evaluer le niveau et decouvrir le dribble",sits:[
 {ti:"Circuit de dribble slalom",dur:"20 min",desc:"En file, chaque joueur dribble en slalom autour de plots. Depart toutes les 5 secondes.",org:"4 colonnes. 4 plots par couloir. 1 ballon par joueur.",axes:["Simplifier : ligne droite","Complexifier : changer de main a chaque plot","Relais équipe"],kws:["Regard haut","Main souple","Genou flechi","Rythme","Controle"],ch:null},
 {ti:"Jeu du requin",dur:"15 min",desc:"2 requins cherchent a intercepter les ballons des dribbleurs libres dans la zone.",org:"Zone delimitee. 1 ballon par joueur sauf requins.",axes:["Reduire la zone","Ajouter un 3e requin"],kws:["Proteger le ballon","Vision peripherique","Changement direction","Feinte"],ch:null},
 {ti:"Tir libre - Bombe",dur:"15 min",desc:"Groupes de 3 par panier. Tir depuis la LF. Si raté : tir depuis le rebond. Si marqué : avancer.",org:"Groupes de 3. 1 ballon.",axes:["Raquette uniquement","Mi-distance","Tournoi équipe"],kws:["BEEF","Armer le bras","Regard panier","Geste fluide"],ch:null}]},
 {num:"1.2",t:"Dribble vitesse et changement de main",dur:"1h30",obj:"Progresser dans la maitrise du dribble",sits:[
 {ti:"Dribble miroir",dur:"15 min",desc:"Par binômes face a face. A dribble en imitant les deplacements de B. Changement de role toutes les 2 min.",org:"Binômes. 1 ballon. Zone 3m x 3m.",axes:["B se deplace lateral","Chrono : max changements en 30 sec"],kws:["Regard adverse","Anticipation","Reactivite","Main non-directrice"],ch:null},
 {ti:"Navettes dribble",dur:"20 min",desc:"Aller main droite retour main gauche. Relais par équipe de 4.",org:"4 équipes sur la largeur.",axes:["Dribble simple pour debutants","Sprint avant passe finale"],kws:["Acceleration","Protection balle","Coordination","Regularite"],ch:null},
 {ti:"1c1 attaque défense",dur:"20 min",desc:"A dribble depuis la ligne mediane. D part du poteau. Objectif A : atteindre la ligne de fond.",org:"Files attaquants et defenseurs. 3 possessions chacune.",axes:["D demarre 2m plus pres","A peut tirer si il passe D"],kws:["Pivot pied fort","Changement rythme","Feinte","Position basse"],ch:"ok:Défense individuelle 1v1 - conforme charte"}]},
 {num:"1.3",t:"La passe - precision et timing",dur:"1h30",obj:"Maitriser les 3 passes fondamentales",sits:[
 {ti:"Mur de passes",dur:"15 min",desc:"Par binômes face au mur. Passe de poitrine 10x rebond 10x une main 10x.",org:"1 ballon par binome. Distance 3-4m.",axes:["Augmenter la distance","Alterner les types au signal"],kws:["Extension des bras","Rotation poignets","Cible","Precision"],ch:null},
 {ti:"Triangles - passe et deplacement",dur:"20 min",desc:"Groupes de 3 en triangle. A passe a B et se deplace vers B. Le triangle tourne.",org:"Groupes de 3. Triangle 4m. 1 ballon.",axes:["Agrandir le triangle","Passe tendue et rebond alternance"],kws:["Appel de balle","Communication","Démarquage"],ch:null},
 {ti:"2c0 - montée collective",dur:"20 min",desc:"Deux joueurs montent en se faisant des passes sans dribble depuis la ligne mediane.",org:"Binômes. File de depart.",axes:["Autoriser le dribble","Ajouter une defenseuse (2v1)"],kws:["Lecture partenaire","Timing","Course interieure","Decision"],ch:null}]},
 {num:"1.4",t:"Tir - BEEF et lay-up",dur:"1h30",obj:"Acquerir la mecanique BEEF et le lay-up",sits:[
 {ti:"BEEF sans ballon",dur:"10 min",desc:"En ligne face au coach. Travail en miroir du geste de tir sans ballon.",org:"En ligne face au coach.",axes:["Avec ballon leger ensuite","Tir depuis 2m puis 3m"],kws:["Balance","Eyes","Elbow","Follow-through"],ch:null},
 {ti:"5 spots de tir",dur:"20 min",desc:"5 positions autour de la raquette. 2 tirs par spot. Partenaire fait le rebond.",org:"3 joueurs par panier. 1 ballon.",axes:["2 spots pour debutants","Compétition : max paniers en 3 min"],kws:["Arc de tir","Pieds largeur epaules","Regard cible"],ch:null},
 {ti:"Lay-up droit puis gauche",dur:"25 min",desc:"Dribble depuis la ligne des 3 pts 2 derniers pas tir banque sur la planche.",org:"File unique. Rebondeur sous le panier.",axes:["Sans dribble : marcher","Dribble lent puis vitesse"],kws:["Pas appel","Genou leve","Banque planche","Tempo"],ch:null}]},
 {num:"1.5",t:"Défense individuelle et pivot",dur:"1h30",obj:"Position défensive et pied-pivot",sits:[
 {ti:"Glissades defensives",dur:"15 min",desc:"Sur signal : glissade gauche 3 pas droite 3 pas retraite sprint. Ne jamais croiser les pieds.",org:"Joueurs en ligne sur ligne de LF.",axes:["Signaux aleatoires","1v1 : A sans dribble"],kws:["Pas chasse","Position basse","Bras actif","Regard nombril"],ch:"ok:Défense individuelle - base charte CD42"},
 {ti:"Pivot",dur:"15 min",desc:"Pied pivot choisi. Coach pointe une direction : le joueur pivote sans lever le pied.",org:"Joueurs espacees avec ballon.",axes:["Ajouter un defenseur","Pivot pour tir passe ou dribble"],kws:["Pied ancre","Rotation hanche","Protection balle"],ch:null},
 {ti:"3v3 défense individuelle",dur:"25 min",desc:"3v3 sur demi-terrain. Défense individuelle obligatoire. Conserver 10 secondes = 1 point.",org:"Équipes de 3. Terrain réduit.",axes:["2 dribbles max","Full court défense"],kws:["Pression sur balle","Individuelle tout terrain","Conservation"],ch:"ok:Défense individuelle - conforme charte"}]},
 {num:"1.6",t:"Lay-up des deux cotes",dur:"1h30",obj:"Finir en course a droite comme a gauche",sits:[
 {ti:"Rythme des appuis sans ballon",dur:"15 min",desc:"Travail du rythme droite-gauche-saut cote droit, puis gauche-droite-saut cote gauche.",org:"Files sous le panier, sans ballon.",axes:["Ajouter le ballon porte","Depart en course"],kws:["Deux appuis","Genou leve","Impulsion","Equilibre"],ch:null},
 {ti:"Lay-up main faible",dur:"30 min",desc:"Depart aile gauche, deux dribbles main gauche, tir en course main gauche sur la planche.",org:"File cote gauche. Rebondeur sous le panier.",axes:["Sans dribble d abord","Depart plus loin"],kws:["Main faible","Banque","Protection","Regularite"],ch:null},
 {ti:"Concours des deux cotes",dur:"30 min",desc:"Alterner un lay-up droite puis un lay-up gauche. Premier a 10 reussites gagne.",org:"Deux files. Chrono.",axes:["Enchainer sans temps mort","Sous pression d un defenseur"],kws:["Alternance","Vitesse","Sang-froid","Reussite"],ch:null}]},
 {num:"1.7",t:"Tir a mi-distance",dur:"1h30",obj:"Construire un tir stable a 4-5 metres",sits:[
 {ti:"Forme de tir rapprochee",dur:"20 min",desc:"Tirs a 1 metre du panier, une main, pour verrouiller la mecanique avant de reculer.",org:"Par binome, un tireur un rebondeur.",axes:["Reculer d un pas tous les 3 paniers","Yeux fermes pour sentir le geste"],kws:["Coude aligne","Poignet casse","Arc","Follow-through"],ch:null},
 {ti:"Les 5 spots",dur:"30 min",desc:"Cinq positions a mi-distance. Deux tirs par spot, on tourne quand les deux sont marques.",org:"3 joueurs par panier.",axes:["Un seul tir par spot","Depart apres un dribble"],kws:["Equilibre","Pieds au sol","Rythme","Constance"],ch:null},
 {ti:"Tir apres passe",dur:"25 min",desc:"Reception d une passe puis tir immediat en position de tir (mains pretes).",org:"Passeur fixe, tireur qui se deplace.",axes:["Tir apres un dribble lateral","Ajouter un contest defensif"],kws:["Mains pretes","Pieds prets","Rapidite","Fluidite"],ch:null}]},
 {num:"1.8",t:"Rebond et protection de balle",dur:"1h30",obj:"Gagner et proteger le ballon",sits:[
 {ti:"Rebond a deux mains",dur:"20 min",desc:"Le coach lance au panneau, le joueur saute et attrape a deux mains puis protege coudes ecartes.",org:"File sous le panier.",axes:["Enchainer avec un tir","Attraper obligatoirement en l air"],kws:["Sauter","Deux mains","Coudes","Menton"],ch:null},
 {ti:"Boxout 1c1",dur:"30 min",desc:"Au tir du coach, le defenseur se retourne, bloque son adversaire puis va au ballon.",org:"Binomes sous le panier.",axes:["Attaquant tres actif","Compter les rebonds gagnes"],kws:["Se retourner","Contact","Pousser","Chercher"],ch:null},
 {ti:"3c3 rebond compte double",dur:"30 min",desc:"Trois contre trois, chaque rebond offensif rapporte un point supplementaire.",org:"Un panier. Rotation.",axes:["Deuxieme chance obligatoire","Tir impose en 8 secondes"],kws:["Volonte","Placement","Second effort","Equipe"],ch:null}]},
 {num:"1.9",t:"Changements de direction et de rythme",dur:"1h30",obj:"Prendre l avantage sur son adversaire",sits:[
 {ti:"Les 4 changements",dur:"20 min",desc:"Devant, entre les jambes, dans le dos, reverse. 30 secondes chacun en deplacement.",org:"Couloirs delimites, 1 ballon par joueur.",axes:["Enchainer deux changements","Au signal sonore"],kws:["Bas","Rapide","Protege","Repetition"],ch:null},
 {ti:"Stop and go",dur:"25 min",desc:"Dribble vitesse, arret net, redemarrage explosif. Trois series par couloir.",org:"Files sur la longueur.",axes:["Arret sur un pied","Ajouter un defenseur passif"],kws:["Freiner","Repartir","Explosivite","Controle"],ch:null},
 {ti:"1c1 avec contrainte",dur:"35 min",desc:"Un contre un ou l attaquant doit utiliser au moins un changement de direction avant de conclure.",org:"Files attaque defense. 3 possessions.",axes:["Deux changements imposes","Limiter a 4 dribbles"],kws:["Feinte","Rythme","Depassement","Finition"],ch:"ok:Défense individuelle 1v1 - conforme charte"}]},
 {num:"1.10",t:"Bilan du cycle 1",dur:"1h30",obj:"Evaluer les fondamentaux acquis",sits:[
 {ti:"Circuit d evaluation",dur:"30 min",desc:"Quatre ateliers notes : dribble slalom chrono, passes precises, lay-up des deux cotes, tirs mi-distance.",org:"4 ateliers. Fiche individuelle.",axes:["Deuxieme tentative autorisee","Binome observateur"],kws:["Concentration","Application","Progres","Honnetete"],ch:null},
 {ti:"Defis par equipe",dur:"25 min",desc:"Les scores individuels sont cumules par equipe. Classement affiche.",org:"Equipes equilibrees.",axes:["Handicap pour les plus forts","Bonus fair-play"],kws:["Cohesion","Encouragement","Depassement","Esprit"],ch:null},
 {ti:"Match bilan",dur:"30 min",desc:"5c5 libre, le coach observe l application des fondamentaux travailles.",org:"Terrain complet.",axes:["Arret sur image pedagogique","Bonus si fondamental bien execute"],kws:["Transfert","Automatisme","Lucidite","Plaisir"],ch:null}]}
 ]},
 {id:2,n:"Jeu Collectif en Attaque",sh:"Jeu Collectif",p:"Nov. - mi-dec. 2026",s:8,c:"#16A085",e:"",
 objs:["Maitriser le jeu a 2 (passe-et-va 2v1)","Comprendre et appliquer le démarquage","Developper le 3v2","Organiser la remontee rapide","Creer des decalages sans ecran"],
 seas:[
 {num:"2.1",t:"Passe-et-va et surnombre 2v1",dur:"1h30",obj:"Creer le surnombre avec le passe-et-va",sits:[
 {ti:"Passe-et-va",dur:"15 min",desc:"A passe a B et coupe vers le panier. B redonne dans la course. A terminé en lay-up.",org:"Trinomes : A B rebondeur C.",axes:["B peut garder et couper","Ajouter un defenseur sur A"],kws:["Passe puis Deplacement","Timing","Course interieure"],ch:null},
 {ti:"Surnombre 2v1",dur:"20 min",desc:"A et B face a 1 defenseur. Travailler la decision : qui tire qui passe.",org:"Files de 2 attaquants et 1 file de defenseurs.",axes:["D repart avec 2s de retard","2v1 full court"],kws:["Decision rapide","Attirer et passer","Penetration"],ch:null},
 {ti:"3v2 demi-terrain",dur:"20 min",desc:"3 attaquants contre 2 defenseurs. 8 secondes pour tirer. Rotation continue.",org:"Groupes de 5. Chrono visible.",axes:["Reduire a 6 secondes","3v3 avec rebond offensif"],kws:["Surnombre","Largeur","Décalage","Circulation"],ch:null}]},
 {num:"2.2",t:"Démarquage et appel de balle",dur:"1h30",obj:"Realiser un démarquage efficace",sits:[
 {ti:"Tag et démarquage",dur:"15 min",desc:"1 requin cherche a toucher ses 2 attaquants avec un foulard dans la zone.",org:"Zones de 5m x 5m. Chrono 20 sec.",axes:["Agrandir la zone","Introduire le ballon"],kws:["Changer de direction","Espace libre","Vitesse de depart"],ch:null},
 {ti:"3v3 sans dribble",dur:"25 min",desc:"3v3 SANS dribble. Seulement pivoter et passer. 1 point = passe dans la raquette adverse.",org:"Équipes de 3. Demi-terrain.",axes:["Autoriser 1 dribble max","Passer a chaque joueur avant de tirer"],kws:["Mobilite permanente","Communication","Vision du jeu"],ch:null},
 {ti:"Match 4v4",dur:"20 min",desc:"Match 4v4 terrain réduit. Défense individuelle obligatoire.",org:"2 équipes de 4.",axes:["Bonus si tir vient d'un démarquage"],kws:["Lecture du jeu","Espaces","Application"],ch:"ok:Défense individuelle - conforme charte"}]},
 {num:"2.3",t:"Remontee de balle rapide",dur:"1h30",obj:"Monter rapidement après récupération",sits:[
 {ti:"Remontee 3 couloirs",dur:"15 min",desc:"3 joueurs dans 3 couloirs. Meneuse dribble aileres courent. Passe exterieure pour lay-up.",org:"Groupes de 3. Depart ligne de fond.",axes:["Ajouter 1 defenseur en retard","3v2 full court"],kws:["Couloirs de jeu","Vitesse","Largeur","Premier tir rapide"],ch:null},
 {ti:"Rebond défensif et contre-attaque",dur:"20 min",desc:"Coach tire. Les 3 D prennent le rebond (boxout) et lancent la contre-attaque immédiatement.",org:"Groupes de 6.",axes:["Boxout obligatoire","5 secondes pour tirer"],kws:["Boxout","Outlet pass","Transition","Sprint"],ch:null},
 {ti:"Match : contre-attaque valorisee",dur:"20 min",desc:"Match 4v4. Paniers en moins de 5 secondes après récupération = x2.",org:"2 équipes. Chrono 5s.",axes:["Retour défensif obligatoire"],kws:["Jeu rapide","Transition","Efficacite"],ch:null}]},
 {num:"2.4",t:"Passe et va, passe et suit",dur:"1h30",obj:"Enchainer passe et deplacement",sits:[
 {ti:"Passe et va au coach",dur:"20 min",desc:"Je passe au coach, je coupe vers le panier, je recois en retour et je conclus.",org:"File unique. Coach relayeur.",axes:["Coupe devant puis derriere le defenseur","Ajouter un defenseur passif"],kws:["Passer","Couper","Demander","Finir"],ch:null},
 {ti:"Passe et suit en triangle",dur:"25 min",desc:"Trois joueurs, je passe et je vais prendre la place de celui a qui j ai passe.",org:"Groupes de 3 en triangle de 5m.",axes:["Agrandir le triangle","Deux ballons simultanes"],kws:["Enchainement","Rythme","Vision","Continuite"],ch:null},
 {ti:"2c2 avec passe et va impose",dur:"35 min",desc:"Deux contre deux ou la conclusion doit venir d un passe-et-va.",org:"Demi-terrain. Rotation.",axes:["Defense stricte","Sans dribble"],kws:["Fixer","Couper","Servir","Marquer"],ch:"ok:2c2 defense individuelle"}]},
 {num:"2.5",t:"Jeu a deux : ecran sur porteur",dur:"1h30",obj:"Poser et utiliser un ecran",sits:[
 {ti:"Poser un ecran",dur:"20 min",desc:"Position d ecran : pieds larges, mains protegees, immobile. Demonstration puis repetition a vide.",org:"Binomes, sans defense.",axes:["Angle d ecran variable","Ecran suivi d un roule"],kws:["Immobile","Solide","Angle","Timing"],ch:null},
 {ti:"Utiliser l ecran",dur:"25 min",desc:"L utilisateur frotte l ecran epaule contre epaule puis attaque le panier.",org:"Binomes avec defenseur passif.",axes:["Defenseur actif","Choix : tir ou penetration"],kws:["Attendre","Frotter","Exploser","Lire"],ch:null},
 {ti:"2c2 sur ecran",dur:"35 min",desc:"Deux contre deux avec ecran obligatoire avant conclusion.",org:"Demi-terrain. Defense individuelle.",axes:["Ecran exterieur puis interieur","Bonus si le poseur marque"],kws:["Coordination","Communication","Lecture","Decision"],ch:"ok:2c2 - defense individuelle uniquement"}]},
 {num:"2.6",t:"Le surnombre",dur:"1h30",obj:"Exploiter la superiorite numerique",sits:[
 {ti:"2c1 en montee",dur:"25 min",desc:"Deux attaquants montent contre un defenseur. Lire sa position pour choisir.",org:"Terrain complet. Rotation rapide.",axes:["Interdire le dribble","Defenseur agressif"],kws:["Ecarter","Fixer","Lire","Servir"],ch:"ok:Surnombre 2c1 - progressivite adaptee"},
 {ti:"3c2 organise",dur:"30 min",desc:"Trois attaquants en triangle contre deux defenseurs. Conclure en moins de 6 secondes.",org:"Demi-terrain. Chrono.",axes:["4c3","Defenseurs en triangle"],kws:["Largeur","Vision","Extra-passe","Vitesse"],ch:"ok:Surnombre 3c2 - lecture de jeu"},
 {ti:"Transition continue",dur:"25 min",desc:"Apres chaque conclusion, les defenseurs repartent en attaque avec un partenaire en plus.",org:"Terrain complet, flux continu.",axes:["Panier obligatoire pour repartir","Deux ballons"],kws:["Enchainer","Courir","Communiquer","Endurance"],ch:null}]},
 {num:"2.7",t:"Occupation des espaces",dur:"1h30",obj:"Organiser l attaque a cinq",sits:[
 {ti:"Les 5 postes",dur:"20 min",desc:"Cinq positions marquees. Chacun occupe un poste, le ballon circule sans dribble.",org:"Demi-terrain, 5 plots.",axes:["Changer de poste apres la passe","Ajouter une defense passive"],kws:["Ecarter","Occuper","Voir","Circuler"],ch:null},
 {ti:"Circulation 5c0",dur:"30 min",desc:"Cinq attaquants font circuler avec coupes et remplacements, conclusion apres 6 passes.",org:"Demi-terrain sans defense.",axes:["Chronometrer","Imposer un renversement"],kws:["Espacement","Rythme","Continuite","Discipline"],ch:null},
 {ti:"5c5 espaces valorises",dur:"30 min",desc:"Match ou le coach arrete le jeu si deux joueurs sont trop proches.",org:"Terrain complet.",axes:["Zone interdite a deux","Bonus apres circulation complete"],kws:["Distance","Lecture","Corriger","Repeter"],ch:null}]},
 {num:"2.8",t:"Bilan attaque",dur:"1h30",obj:"Valider les acquis offensifs",sits:[
 {ti:"Ateliers offensifs",dur:"25 min",desc:"Trois ateliers notes : passe et va, ecran, surnombre 3c2.",org:"3 ateliers tournants.",axes:["Score par binome","Refaire si rate"],kws:["Application","Precision","Coordination","Progres"],ch:null},
 {ti:"Match a theme",dur:"30 min",desc:"5c5 : le panier compte double s il resulte d un jeu a deux identifie.",org:"Terrain complet.",axes:["Compter les jeux a deux reussis","Coach silencieux"],kws:["Transfert","Initiative","Collectif","Lucidite"],ch:null},
 {ti:"Debrief video mental",dur:"25 min",desc:"Retour collectif : chaque joueur cite une action collective reussie et une a ameliorer.",org:"Groupe assis en cercle.",axes:["Dessiner l action au tableau","Rejouer l action au ralenti"],kws:["Analyse","Ecoute","Progres","Objectif"],ch:null}]}
 ]},
 {id:3,n:"Défense Individuelle et Transition",sh:"Défense",p:"Janv. - mi-fev. 2026",s:9,c:"#C0392B",e:"",
 objs:["Défense individuelle fille a fille sur TOUT le terrain","Pression sur le porteur de balle","Transition défense-attaque","Retour défensif systematique","Boxout et prise de rebond"],
 seas:[
 {num:"3.1",t:"1v1 Full Court",dur:"1h30",obj:"Pression défensive sur tout le terrain",sits:[
 {ti:"1v1 full court",dur:"15 min",desc:"D suit A depuis la remise en jeu sur tout le terrain. A tente des changements de direction.",org:"Binômes. Rotation après 2 possessions.",axes:["A max 3 changements","Sprint rattrapage si D perd A"],kws:["Pied avance sur balle","Distance bras tendu","Pas chasse","Position basse"],ch:"ok:Défense individuelle full court - charte obligatoire"},
 {ti:"1v1 avec tir",dur:"20 min",desc:"1v1 demi-terrain. A part de la ligne mediane. D conteste le tir.",org:"3 possessions en attaque puis 3 en défense.",axes:["A a 5 secondes pour tirer","D doit toucher le ballon"],kws:["Contest de tir","Main haute","Ne pas sauter trop tot"],ch:"ok:Pression individuelle - conforme charte"},
 {ti:"Boxout et rebond 2v2",dur:"15 min",desc:"Coach tire. D pivote et bloque son adversaire (boxout). A essaie de passer devant. D saisit.",org:"Groupes de 5.",axes:["1 dribble rebond offensif","D score si rebond défensif"],kws:["Fesses contre ventre","Bras en aile","Saisir a 2 mains"],ch:"ok:Boxout = action défensive individuelle legale"}]},
 {num:"3.2",t:"Retour défensif et transition",dur:"1h30",obj:"Reflexe de retour défensif systematique",sits:[
 {ti:"Sprint retour",dur:"10 min",desc:"Sur signal toutes les joueurs en zone offensive sprintent sous leur panier en 3 secondes.",org:"Joueurs sur ligne des 3/4.",axes:["Signal surprise","Dernière arrivée : 5 squats"],kws:["Reaction","Sprint","Priorité défensive"],ch:null},
 {ti:"Transition 3v3",dur:"25 min",desc:"3 A partent. 3 D reviennent avec 2 secondes de retard. Organisation en inferiorite temporaire.",org:"Demi-terrain. Coach declenche.",axes:["3v3 reel","2 defendent 1 remonte"],kws:["Priorites defensives","Communication","Organisation rapide"],ch:null},
 {ti:"Match - retour obligatoire",dur:"20 min",desc:"Match 4v4. Après chaque tir les 3 joueurs les plus avancées reviennent avant de defendre.",org:"Match complet. Arbitre.",axes:["Reduire a 2 joueurs"],kws:["Discipline collective","Effort défensif","Engagement"],ch:"ok:Retour pour retablir la défense individuelle"}]},
 {num:"3.3",t:"Situations defensives specifiques",dur:"1h30",obj:"Defendre en 1v1 dans des situations variees",sits:[
 {ti:"Contest de tir",dur:"15 min",desc:"A recoit a mi-distance. D ferme en glissade. D leve la main haute sans sauter trop tot.",org:"Trinomes. Rotation toutes les 3 tentatives.",axes:["A peut driver si D saute trop tot","Match 5 possessions"],kws:["Fermeture en glissade","Main haute","Ne pas sauter trop tot"],ch:"ok:Pression individuelle - conforme charte"},
 {ti:"Défense sur poste bas",dur:"20 min",desc:"Attaquante poste bas. D se positionne entre elle et le panier. Coupe la ligne de passe.",org:"Trinomes.",axes:["D peut intercepter la passe","Pivot face au panier"],kws:["3/4 cote ballon","Bras coupe ligne de passe","Anticipation"],ch:"ok:Défense individuelle directe"},
 {ti:"Match 5v5 évaluation",dur:"25 min",desc:"Match 5v5 complet. Défense individuelle full court obligatoire. 2 observatrices designees.",org:"Match 2 x 10 min.",axes:["Interception = 2 points","MVP défensif designee"],kws:["Défense individuelle","Full court","Application"],ch:"ok:Défense individuelle full court - conforme charte"}]},
 {num:"3.4",t:"Defense sur non-porteur",dur:"1h30",obj:"Defendre sans ballon",sits:[
 {ti:"Position de reglage",dur:"20 min",desc:"Voir ballon et adversaire : bras de deflexion vers le ballon, corps ouvert.",org:"Binomes places a l aile.",axes:["Le coach deplace le ballon","Attaquant qui se demarque"],kws:["Voir les deux","Bras","Ouvert","Ajuster"],ch:"ok:Défense individuelle - base charte CD42"},
 {ti:"Denier la ligne de passe",dur:"25 min",desc:"Empecher la reception sur l aile pendant 5 secondes.",org:"Passeur fixe, binomes en 1c1.",axes:["Attaquant qui coupe","Autoriser la coupe backdoor"],kws:["Anticiper","Main active","Deplacement","Vigilance"],ch:"ok:Défense individuelle stricte"},
 {ti:"Shell drill 4c4",dur:"35 min",desc:"Quatre attaquants font circuler, les quatre defenseurs ajustent a chaque passe.",org:"Demi-terrain, positions fixes.",axes:["Ajouter une coupe","Tir autorise apres 4 passes"],kws:["Ajuster","Communiquer","Ensemble","Rigueur"],ch:"ok:Défense individuelle - pas de zone"}]},
 {num:"3.5",t:"Aide et recuperation",dur:"1h30",obj:"Defendre collectivement",sits:[
 {ti:"Aide sur penetration",dur:"25 min",desc:"Sur penetration, le defenseur du cote faible vient aider puis chacun retrouve son joueur.",org:"3c3 demi-terrain.",axes:["Deux aides possibles","Communication a voix haute obligatoire"],kws:["Aider","Parler","Revenir","Solidarite"],ch:"ok:Défense individuelle avec aide"},
 {ti:"Rotation defensive",dur:"30 min",desc:"Apres l aide, les defenseurs tournent pour couvrir le joueur laisse libre.",org:"4c4 demi-terrain.",axes:["Ajouter un renversement","Interdire le tir apres 2 passes"],kws:["Rotation","Anticiper","Couvrir","Discipline"],ch:"ok:Défense individuelle avec rotations"},
 {ti:"Match defense valorisee",dur:"25 min",desc:"5c5, chaque arret defensif rapporte un point.",org:"Terrain complet.",axes:["Stops consecutifs","Objectif 3 stops de suite"],kws:["Concentration","Effort","Ensemble","Fierte"],ch:null}]},
 {num:"3.6",t:"Defense sur ecran",dur:"1h30",obj:"Reagir a un ecran",sits:[
 {ti:"Passer en dessous",dur:"20 min",desc:"Le defenseur du porteur passe sous l ecran quand le tireur est loin.",org:"Binomes avec poseur d ecran.",axes:["Varier la distance","Ecran des deux cotes"],kws:["Lire","Anticiper","Glisser","Recoller"],ch:null},
 {ti:"Passer au-dessus",dur:"25 min",desc:"Le defenseur suit son joueur au-dessus de l ecran quand le tireur est adroit.",org:"Meme organisation.",axes:["Ajouter le contact","Aide du poseur"],kws:["Contact","Suivre","Vitesse","Ne pas subir"],ch:null},
 {ti:"2c2 sur ecran defense libre",dur:"35 min",desc:"Deux contre deux, la defense choisit dessus ou dessous et annonce a voix haute.",org:"Demi-terrain. Rotation.",axes:["Imposer un choix","Bonus si annonce correcte"],kws:["Choisir","Annoncer","Coordonner","Assumer"],ch:"ok:Défense individuelle sur ecran"}]},
 {num:"3.7",t:"Rebond defensif et premier relais",dur:"1h30",obj:"Securiser puis relancer",sits:[
 {ti:"Boxout systematique",dur:"20 min",desc:"A chaque tir, tous les defenseurs bloquent avant d aller au ballon.",org:"4c4 demi-terrain. Coach tireur.",axes:["Compter les rebonds concedes","Aucun rebond offensif tolere"],kws:["Se retourner","Contact","Chercher","Securiser"],ch:null},
 {ti:"Rebond puis premier relais",dur:"30 min",desc:"Apres le rebond, passe immediate au relayeur place sur l aile.",org:"Rebondeur + 2 relayeurs.",axes:["Relais des deux cotes","Sous pression d un defenseur"],kws:["Proteger","Pivoter","Voir","Relancer"],ch:null},
 {ti:"Rebond et contre-attaque",dur:"30 min",desc:"Le rebond declenche une contre-attaque a trois joueurs.",org:"Terrain complet, vagues.",axes:["Ajouter un defenseur de retard","Limiter a 8 secondes"],kws:["Enchainer","Courir","Devancer","Finir"],ch:null}]},
 {num:"3.8",t:"Contre-attaque a trois couloirs",dur:"1h30",obj:"Remonter vite et bien",sits:[
 {ti:"Trois couloirs a vide",dur:"20 min",desc:"Trois joueurs remontent, un par couloir, en se faisant des passes.",org:"Terrain complet. Vagues de 3.",axes:["Sans dribble","Chronometrer"],kws:["Couloirs","Largeur","Vitesse","Conclusion"],ch:null},
 {ti:"3c1 puis 3c2",dur:"30 min",desc:"Contre-attaque a trois contre un puis deux defenseurs qui reviennent.",org:"Terrain complet. Rotation.",axes:["Defenseurs partent en retard","Conclusion imposee en lay-up"],kws:["Lire","Ecarter","Servir","Conclure"],ch:"ok:Surnombre - lecture de jeu"},
 {ti:"Match transitions",dur:"30 min",desc:"5c5 avec obligation de tirer dans les 10 secondes suivant une recuperation.",org:"Terrain complet. Chrono visible.",axes:["Reduire a 8 secondes","Panier en contre = 3 points"],kws:["Reactivite","Anticiper","Decider","Oser"],ch:null}]},
 {num:"3.9",t:"Bilan defense et transition",dur:"1h30",obj:"Valider les acquis defensifs",sits:[
 {ti:"Ateliers defensifs",dur:"25 min",desc:"Trois ateliers : glissades chrono, 1c1 defensif, boxout.",org:"3 ateliers tournants. Notation.",axes:["Deuxieme essai","Binome evaluateur"],kws:["Technique","Intensite","Rigueur","Progres"],ch:null},
 {ti:"Match a theme defense",dur:"35 min",desc:"5c5 ou seuls les points issus d une recuperation comptent.",org:"Terrain complet.",axes:["Compter les stops","Coach silencieux"],kws:["Transfert","Agressivite","Collectif","Lucidite"],ch:null},
 {ti:"Debrief et objectifs",dur:"20 min",desc:"Chaque joueur identifie son point fort et son axe de progres defensif.",org:"Groupe en cercle.",axes:["Fixer un objectif ecrit","Binome referent"],kws:["Analyse","Honnetete","Objectif","Engagement"],ch:null}]}
 ]},
 {id:4,n:"Jeu en Équipe",sh:"Systemes",p:"Mars - mi-avr. 2026",s:10,c:"#1A2E5A",e:"",
 objs:["Jeu collectif offensif en mouvement","Fixation-passe sans ecran","Jeu interieur-exterieur","Défense individuelle 4v4 et 5v5","Roles definis : meneur ailiere pivot"],
 seas:[
 {num:"4.1",t:"Fixation-passe et interieur-exterieur",dur:"1h30",obj:"Creer des decalages sans ecran",sits:[
 {ti:"Fixation-passe",dur:"15 min",desc:"A dribble vers D pour le fixer. D reagit sur A puis A passe a B demarquee. B attaque.",org:"Trinomes. Demi-terrain.",axes:["Sans defenseur abord","2v2 avec fixation-passe"],kws:["Fixation","Attirer le defenseur","Timing passe","Démarquage"],ch:"ok:Pas d ecran - fixation-passe conforme charte"},
 {ti:"Jeu interieur-exterieur",dur:"20 min",desc:"Poste bas recoit. Exterieure coupe. Poste peut tirer passer au coupeur ou ressortir.",org:"Par 3. Rotation des roles.",axes:["Defenseuse sur le poste","Passage obligatoire par le poste"],kws:["Ancrage poste","Demande de balle","Coupeur","Options"],ch:null},
 {ti:"3v3 décalage par deplacement",dur:"20 min",desc:"3v3. Bonus si le tir vient d'un décalage créé par une coupe.",org:"Équipes de 3.",axes:["3 passes minimum avant le tir"],kws:["Mouvement sans ballon","Coupe","Décalage"],ch:"ok:Défense individuelle - conforme charte"}]},
 {num:"4.2",t:"Roles et systeme 5v5",dur:"1h30",obj:"Jouer avec des roles definis",sits:[
 {ti:"Les 5 postes",dur:"15 min",desc:"Coach présente les 5 postes. Les joueurs marchent les deplacements sans adversaire.",org:"5 joueurs et coach.",axes:["Varier les initiations","Ajouter la défense progressivement"],kws:["Postes de jeu","Lecture","Automatisme","Replacement"],ch:null},
 {ti:"4v4 avec roles",dur:"25 min",desc:"4v4 demi-terrain. Chaque joueur a un role. Défense individuelle.",org:"Équipes de 4.",axes:["Pivot doit toucher la balle a chaque possession"],kws:["Roles definis","Lecture","Initiative","Collectif"],ch:"ok:Défense individuelle - conforme charte"},
 {ti:"5v5 pression full court",dur:"25 min",desc:"Match 5v5. Équipe défensive presse toute la montee en défense individuelle.",org:"5v5 complet.",axes:["Pression remise en jeu uniquement abord"],kws:["Pression","Interception","Briser la pression","Tempo"],ch:"ok:Pression individuelle full court - conforme charte"}]},
 {num:"4.3",t:"Transition attaque-défense",dur:"1h30",obj:"Maitriser le passage rapide A/D",sits:[
 {ti:"3v3 transition alternance",dur:"20 min",desc:"3v3 terrain entier. Après chaque panier l'équipe qui vient de defendre repart en attaque.",org:"Équipes de 3. Match continu.",axes:["5 sec pour traverser la ligne mediane"],kws:["Transition instantanee","Lecture","Vitesse de decision"],ch:null},
 {ti:"Signal de transition",dur:"15 min",desc:"Coach siffle : équipe en attaque defend immédiatement et inversement.",org:"4v4. Sifflet coach.",axes:["Signaux de plus en plus frequents"],kws:["Reaction","Adaptation","Vigilance"],ch:null},
 {ti:"Match 5v5 évaluation",dur:"25 min",desc:"Match 5v5 règles officielles. Coach note les transitions et retours défensifs.",org:"2 x 10 min.",axes:["Bonus si transition en moins de 3 secondes"],kws:["Match reel","Application","Cohésion"],ch:"ok:Défense individuelle full court - conforme charte"}]},
 {num:"4.4",t:"Circulation et renversement",dur:"1h30",obj:"Faire changer le ballon de cote",sits:[
 {ti:"Renversement a 5",dur:"20 min",desc:"Le ballon doit passer d une aile a l autre en trois passes maximum.",org:"Demi-terrain, 5 postes.",axes:["Deux passes maximum","Ajouter une defense passive"],kws:["Vitesse de balle","Ecarter","Voir loin","Precision"],ch:null},
 {ti:"Renversement sous pression",dur:"30 min",desc:"4c4, obligation de renverser avant de conclure.",org:"Demi-terrain.",axes:["Deux renversements imposes","Chrono de possession"],kws:["Patience","Circulation","Lecture","Timing"],ch:null},
 {ti:"Match renversement valorise",dur:"30 min",desc:"5c5, panier double apres un renversement complet.",org:"Terrain complet.",axes:["Compter les renversements","Interdire le dribble en renversement"],kws:["Collectif","Discipline","Recompense","Repetition"],ch:null}]},
 {num:"4.5",t:"Jeu interieur-exterieur",dur:"1h30",obj:"Relier les postes exterieurs et interieurs",sits:[
 {ti:"Passe a l interieur",dur:"20 min",desc:"Depuis l aile, passer au joueur poste dans la raquette avec un angle correct.",org:"Binomes aile-poste.",axes:["Ajouter un defenseur devant","Passe a rebond obligatoire"],kws:["Angle","Timing","Precision","Securite"],ch:null},
 {ti:"Jeu du poste",dur:"25 min",desc:"Le joueur interieur recoit dos au panier, pivote et conclut.",org:"Un panier, files.",axes:["Ajouter un defenseur","Ressortir si double"],kws:["Position","Pivot","Protection","Finition"],ch:null},
 {ti:"Inside-out",dur:"35 min",desc:"5c5 : la balle doit toucher l interieur avant tout tir exterieur.",org:"Terrain complet.",axes:["Ressortie obligatoire","Bonus si tir apres ressortie"],kws:["Lecture","Patience","Confiance","Equilibre"],ch:null}]},
 {num:"4.6",t:"Attaquer la defense individuelle",dur:"1h30",obj:"Creer des decalages",sits:[
 {ti:"Penetration et kick-out",dur:"25 min",desc:"Penetrer dans la raquette et ressortir sur un partenaire demarque.",org:"4c4 demi-terrain.",axes:["Deux passes apres la penetration","Interdire le tir en penetration"],kws:["Fixer","Attirer","Ressortir","Punir"],ch:null},
 {ti:"Coupes et remplacements",dur:"25 min",desc:"Apres chaque passe, le passeur coupe et un partenaire remplace sa position.",org:"5c0 puis 5c5.",axes:["Ajouter une defense","Chronometrer la circulation"],kws:["Mouvement","Occuper","Remplacer","Continuite"],ch:null},
 {ti:"Match decalages",dur:"35 min",desc:"5c5, le coach compte les decalages crees plutot que les points.",org:"Terrain complet.",axes:["Objectif 10 decalages","Bonus tir ouvert"],kws:["Initiative","Collectif","Lecture","Efficacite"],ch:null}]},
 {num:"4.7",t:"Remises en jeu offensives",dur:"1h30",obj:"Exploiter les situations arretees",sits:[
 {ti:"Remise ligne de fond",dur:"25 min",desc:"Systeme simple a quatre joueurs pour liberer un tireur pres du panier.",org:"Demi-terrain, 5 joueurs.",axes:["Ajouter une defense","5 secondes strictes"],kws:["Timing","Ecran","Appel","Precision"],ch:null},
 {ti:"Remise touche",dur:"25 min",desc:"Sortie de balle propre face a une defense tout terrain.",org:"Demi-terrain puis terrain complet.",axes:["Defense agressive","Interdire la passe en arriere"],kws:["Bouger","Se croiser","Feinter","Recevoir"],ch:null},
 {ti:"Match avec remises",dur:"30 min",desc:"5c5 avec arret systematique sur chaque sortie pour rejouer la remise.",org:"Terrain complet.",axes:["Point bonus si panier sur remise","Alterner les systemes"],kws:["Application","Rigueur","Concentration","Repetition"],ch:null}]},
 {num:"4.8",t:"Fins de possession",dur:"1h30",obj:"Conclure sous contrainte de temps",sits:[
 {ti:"Tir sous pression temps",dur:"20 min",desc:"Dix secondes pour marquer depuis la remise en jeu.",org:"Groupes de 3. Chrono.",axes:["Reduire a 7 secondes","Ajouter un defenseur"],kws:["Urgence","Lucidite","Choix","Execution"],ch:null},
 {ti:"Derniere possession",dur:"30 min",desc:"5c5, une seule possession de 12 secondes, l equipe qui marque gagne.",org:"Terrain complet. Chrono visible.",axes:["Temps mort autorise","Remise en jeu a mi-terrain"],kws:["Strategie","Sang-froid","Communication","Decision"],ch:null},
 {ti:"Lancers-francs decisifs",dur:"25 min",desc:"Chaque joueur tire deux lancers avec le groupe qui observe en silence puis qui chambre.",org:"Un panier.",axes:["Match nul = mort subite","Consequence collective si rate"],kws:["Routine","Respirer","Concentration","Resilience"],ch:null}]},
 {num:"4.9",t:"Roles et postes",dur:"1h30",obj:"Comprendre son role dans l equipe",sits:[
 {ti:"Decouverte des 5 postes",dur:"25 min",desc:"Chaque joueur essaie successivement les postes 1 a 5 sur une meme situation.",org:"5c0 puis 5c5.",axes:["Tourner a chaque possession","Expliquer son role"],kws:["Comprendre","Adapter","Polyvalence","Curiosite"],ch:null},
 {ti:"Situations par poste",dur:"30 min",desc:"Ateliers specifiques : meneur, ailier, interieur.",org:"3 ateliers tournants.",axes:["Consigne technique par poste","Binome du meme poste"],kws:["Specificite","Technique","Identite","Progres"],ch:null},
 {ti:"Match roles definis",dur:"30 min",desc:"5c5 avec un role attribue a chacun et une consigne individuelle.",org:"Terrain complet.",axes:["Changer de role en cours","Auto-evaluation apres le match"],kws:["Responsabilite","Discipline","Complementarite","Equipe"],ch:null}]},
 {num:"4.10",t:"Bilan jeu en equipe",dur:"1h30",obj:"Valider les acquis collectifs",sits:[
 {ti:"Ateliers collectifs",dur:"25 min",desc:"Trois ateliers notes : renversement, inside-out, remise en jeu.",org:"3 ateliers tournants.",axes:["Score par equipe","Refaire si rate"],kws:["Coordination","Application","Precision","Cohesion"],ch:null},
 {ti:"Match complet",dur:"40 min",desc:"5c5 en quatre periodes avec feuille de match et arbitrage.",org:"Terrain complet. Table de marque.",axes:["Rotation obligatoire","Statistiques tenues par les remplacants"],kws:["Format reel","Rythme","Serieux","Equipe"],ch:"ok:5c5 - format competition"},
 {ti:"Debrief collectif",dur:"20 min",desc:"Analyse des sequences reussies et des axes de progres pour le cycle competition.",org:"Groupe en cercle.",axes:["Chacun cite une action","Objectifs pour le cycle 5"],kws:["Analyse","Ecoute","Projection","Ambition"],ch:null}]}
 ]},
 {id:5,n:"Compétition et Bilan",sh:"Compétition",p:"Mai - juin 2026",s:10,c:"#E8670A",e:"",
 objs:["Integrer tous les acquis en match reel","Cohésion équipe et communication","Situations specifiques : remise en jeu fin de match","Evaluer les progres individuels","Terminer la saison positivement"],
 seas:[
 {num:"5.1",t:"Situations de fin de match",dur:"1h30",obj:"Gerer la pression en fin de match",sits:[
 {ti:"Dernière action 10 secondes",dur:"20 min",desc:"Score serré 10 secondes. L'équipe prépare et exécute la dernière action.",org:"Équipes de 5. Chrono 10 sec visible.",axes:["Qui decide ? Le capitaine","Faute volontaire pour stopper le chrono"],kws:["Pression","Clarte tactique","Confiance","Decision"],ch:"ok:Défense individuelle - conforme charte"},
 {ti:"Remise en jeu rapide",dur:"15 min",desc:"Remise en jeu sous son panier. Decrochage du meneur passe immediate montee rapide.",org:"5 joueurs et coach.",axes:["Pression défensive sur la remise en jeu"],kws:["Remise en jeu rapide","Timing","Signal de depart"],ch:"ok:Défense individuelle - conforme charte"},
 {ti:"Communication a voix haute",dur:"20 min",desc:"Match 5v5. Toute action annoncee a voix haute. Penalite si silence.",org:"Match complet.",axes:["Communication défensive uniquement abord"],kws:["Communication","Vocabulaire basket","Leader de jeu"],ch:"ok:Défense individuelle - conforme charte"}]},
 {num:"5.2",t:"Tournoi interne et bilan",dur:"1h30",obj:"Cloture festive et bilan de saison",sits:[
 {ti:"Tournoi 3v3 FIBA",dur:"45 min",desc:"Tournoi 3v3 sur deux paniers. Format poule puis finale. FIBA 3x3.",org:"Équipes de 3 tirées au sort.",axes:["Équipes mixtes niveaux"],kws:["Compétition positive","3x3","Esprit sportif","Plaisir"],ch:"ok:Défense individuelle - conforme charte"},
 {ti:"Bilan individuel",dur:"20 min",desc:"Test : 10 lancers francs relais dribble auto-évaluation. Comparer avec septembre.",org:"Stations tournantes.",axes:["Valoriser tous les progres"],kws:["Progres","Auto-évaluation","Objectifs","Fierte"],ch:null}]},
 {num:"5.3",t:"Preparation physique specifique",dur:"1h30",obj:"Developper les qualites du basketteur",sits:[
 {ti:"Echauffement dynamique",dur:"20 min",desc:"Mobilite articulaire, montees de genoux, talons-fesses, pas chasses, accelerations progressives.",org:"Sur la largeur du terrain.",axes:["Avec ballon","En binome miroir"],kws:["Progressif","Amplitude","Rythme","Serieux"],ch:null},
 {ti:"Circuit force-vitesse",dur:"30 min",desc:"Six ateliers de 40 secondes : gainage, fentes, sauts, sprints, appuis, coordination.",org:"6 stations. Recuperation 20 secondes.",axes:["Deux tours","Ajouter un ballon"],kws:["Intensite","Technique","Respiration","Regularite"],ch:null},
 {ti:"Jeu physique",dur:"25 min",desc:"5c5 avec contact autorise et intensite elevee, periodes courtes.",org:"Terrain complet. 4 minutes par periode.",axes:["Rotation rapide","Score au sprint"],kws:["Engagement","Duel","Endurance","Recuperation"],ch:null}]},
 {num:"5.4",t:"Scenarios de fin de match",dur:"1h30",obj:"Gerer les moments decisifs",sits:[
 {ti:"Mener de deux a une minute",dur:"25 min",desc:"L equipe en avance doit gerer le temps et les fautes.",org:"5c5. Chrono et score affiches.",axes:["Gerer les remises en jeu","Faute strategique interdite"],kws:["Lucidite","Calme","Gestion","Communication"],ch:null},
 {ti:"Etre mene de quatre",dur:"25 min",desc:"L equipe en retard doit accelerer et provoquer des fautes.",org:"5c5. Chrono et score.",axes:["Deux possessions seulement","Presse tout terrain"],kws:["Urgence","Strategie","Solidarite","Espoir"],ch:null},
 {ti:"Prolongation",dur:"30 min",desc:"Match nul, prolongation de trois minutes, gestion complete par les joueurs.",org:"Terrain complet. Temps morts joueurs.",axes:["Coach silencieux","Capitaine decide"],kws:["Leadership","Sang-froid","Decision","Mental"],ch:null}]},
 {num:"5.5",t:"Lancers-francs sous pression",dur:"1h30",obj:"Reussir dans le moment important",sits:[
 {ti:"Routine individuelle",dur:"20 min",desc:"Chaque joueur construit et repete sa routine avant le tir.",org:"Par panier, groupes de 3.",axes:["Chronometrer la routine","Verbaliser les etapes"],kws:["Rituel","Respirer","Regard","Constance"],ch:null},
 {ti:"Serie sous fatigue",dur:"30 min",desc:"Sprint aller-retour puis deux lancers-francs. Cinq series.",org:"Panier + ligne de fond.",axes:["Ajouter un troisieme sprint","Objectif de reussite collectif"],kws:["Recuperer","Se recentrer","Precision","Resilience"],ch:null},
 {ti:"Concours a enjeu",dur:"30 min",desc:"Chaque rate entraine une consequence collective (sprint, gainage). Ambiance de match.",org:"Un panier, tout le groupe.",axes:["Le groupe fait du bruit","Mort subite finale"],kws:["Pression","Concentration","Responsabilite","Mental"],ch:null}]},
 {num:"5.6",t:"Lecture de jeu",dur:"1h30",obj:"Analyser et decider vite",sits:[
 {ti:"Arret sur image",dur:"25 min",desc:"Le coach arrete le jeu, les joueurs doivent enoncer la meilleure solution.",org:"5c5 avec arrets frequents.",axes:["Un joueur designe repond","Reprendre l action corrigee"],kws:["Observer","Analyser","Verbaliser","Corriger"],ch:null},
 {ti:"Situations aveugles",dur:"25 min",desc:"Le joueur recoit le ballon dos au jeu, se retourne et doit decider en 2 secondes.",org:"Files avec passeur.",axes:["Varier le nombre de defenseurs","Ajouter du bruit"],kws:["Scanner","Decider","Executer","Rapidite"],ch:null},
 {ti:"Match sans coaching",dur:"35 min",desc:"5c5 complet, le coach n intervient pas. Les joueurs s auto-organisent.",org:"Terrain complet.",axes:["Temps morts joueurs uniquement","Debrief entre joueurs"],kws:["Autonomie","Communication","Leadership","Confiance"],ch:null}]},
 {num:"5.7",t:"Match a enjeu",dur:"1h30",obj:"Reproduire les conditions de competition",sits:[
 {ti:"Preparation d avant-match",dur:"20 min",desc:"Echauffement type match, annonce des cinq de depart, consignes tactiques.",org:"Groupe complet.",axes:["Mene par le capitaine","Rituel collectif"],kws:["Preparer","Concentrer","Motiver","Rituel"],ch:null},
 {ti:"Match officiel interne",dur:"45 min",desc:"Quatre periodes de 8 minutes avec table de marque, arbitres et feuille de match.",org:"Terrain complet. Officiels designes.",axes:["Statistiques completes","Temps de jeu equitable"],kws:["Format reel","Serieux","Intensite","Equipe"],ch:"ok:5c5 - format competition officiel"},
 {ti:"Debrief a chaud",dur:"15 min",desc:"Analyse immediate : ce qui a fonctionne, ce qui doit progresser.",org:"Groupe assis.",axes:["Chacun s exprime","Statistiques commentees"],kws:["Recul","Honnetete","Ecoute","Progres"],ch:null}]},
 {num:"5.8",t:"Tournoi interne",dur:"1h30",obj:"Jouer avec plaisir et exigence",sits:[
 {ti:"Echauffement autonome",dur:"15 min",desc:"Les equipes conduisent elles-memes leur preparation.",org:"Groupes autonomes.",axes:["Capitaine responsable","Coach observateur"],kws:["Autonomie","Serieux","Responsabilite","Cohesion"],ch:null},
 {ti:"Phase de poules",dur:"40 min",desc:"Matchs de 8 minutes entre toutes les equipes constituees.",org:"2 terrains. Tableau affiche.",axes:["Rotation obligatoire","Bonus fair-play"],kws:["Competition","Respect","Effort","Plaisir"],ch:"ok:Format tournoi - competition interne"},
 {ti:"Finales et remise",dur:"25 min",desc:"Petite finale et finale, puis remise des recompenses.",org:"Terrain principal.",axes:["Public des autres equipes","Elire le meilleur esprit"],kws:["Enjeu","Emotion","Reconnaissance","Fete"],ch:null}]},
 {num:"5.9",t:"Plateau final",dur:"1h30",obj:"Representer le club",sits:[
 {ti:"Preparation collective",dur:"20 min",desc:"Echauffement complet, rappel des roles et des consignes de saison.",org:"Groupe complet.",axes:["Rituel d avant-match","Discours du capitaine"],kws:["Preparer","Unir","Motiver","Concentrer"],ch:null},
 {ti:"Matchs de plateau",dur:"50 min",desc:"Serie de matchs contre les equipes invitees, format officiel.",org:"2 terrains. Feuilles de match.",axes:["Temps de jeu equitable","Chacun essaie un poste different"],kws:["Competition","Fair-play","Adaptation","Representation"],ch:"ok:Plateau - format FFBB"},
 {ti:"Retour au calme",dur:"15 min",desc:"Etirements, hydratation, echanges avec les equipes adverses.",org:"Groupe complet.",axes:["Troisieme mi-temps","Remerciements aux officiels"],kws:["Recuperation","Convivialite","Respect","Partage"],ch:null}]},
 {num:"5.10",t:"Bilan de saison",dur:"1h30",obj:"Mesurer le chemin parcouru et projeter",sits:[
 {ti:"Evaluation finale",dur:"30 min",desc:"Reprise du circuit d evaluation du cycle 1 pour mesurer la progression.",org:"4 ateliers identiques au cycle 1.",axes:["Comparer avec les scores de septembre","Graphique de progression"],kws:["Mesure","Progres","Fierte","Objectivite"],ch:null},
 {ti:"Entretiens individuels",dur:"25 min",desc:"Chaque joueur echange avec le coach sur sa saison pendant que les autres jouent.",org:"Coin calme + jeu libre.",axes:["Fiche de progression remise","Objectif ecrit pour l an prochain"],kws:["Ecoute","Reconnaissance","Projection","Confiance"],ch:null},
 {ti:"Match des familles",dur:"35 min",desc:"Match convivial joueurs contre parents et encadrants.",org:"Terrain complet. Regles allegees.",axes:["Equipes mixtes","Arbitrage par les joueurs"],kws:["Plaisir","Partage","Club","Convivialite"],ch:null}]}
 ]}
];

