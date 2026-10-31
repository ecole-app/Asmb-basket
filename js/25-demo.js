/* ===== 25-demo.js — Mode démo (lien « Voir la démo » du site : ?demo) =====
   L'appli s'ouvre en dirigeant d'un faux club « Club Démo », sans compte. Tout reste sur
   l'appareil : les fonctions Firestore sont remplacées par des versions vides (lecture = rien,
   écriture = rien d'envoyé), fsWriteCollection ne fait rien (GM_DEMO). Chaque visiteur a sa
   propre démo, il peut tout modifier sans gêner personne. Les données fictives (équipes,
   joueurs, licences, planning, comptabilité, sponsors, buvette) portent « Démo ».
   Le mode tient dans l'onglet (sessionStorage gm_demo) ; « Quitter la démo » vide les données
   locales et revient à l'écran de connexion. Le club actif « demo » fait purger ces données
   au prochain vrai club (setActiveClub). Lancé par initAuthGate (js/18-auth.js). */
var GM_DEMO=false;

function demoDemande(){
  try{ return new URLSearchParams(location.search).has("demo")||sessionStorage.getItem("gm_demo")==="1"; }catch(e){ return false; }
}

function demoStubsFirestore(){
  // Références factices : la démo ne dépend pas du chargement de Firebase.
  window.fbDb=window.fbDb||{demo:true};
  window.fbCollection=function(){ var a=[].slice.call(arguments,1); return {path:a.join("/"),id:a[a.length-1]}; };
  window.fbDoc=function(){ var a=[].slice.call(arguments,1); return {path:a.join("/"),id:a[a.length-1]}; };
  window.fbQuery=function(r){ return r; };
  window.fbWhere=window.fbOrderBy=window.fbLimit=function(){ return null; };
  window.fbServerTimestamp=function(){ return new Date(); };
  window.fbArrayUnion=window.fbArrayRemove=function(){ return [].slice.call(arguments); };
  var vide={docs:[],empty:true,size:0,forEach:function(){},docChanges:function(){ return []; }};
  window.fbGetDoc=function(r){ return Promise.resolve({exists:function(){ return false; },data:function(){ return undefined; },id:(r&&r.id)||"",ref:r}); };
  window.fbGetDocs=function(){ return Promise.resolve(vide); };
  window.fbOnSnapshot=function(){ return function(){}; };
  window.fbAddDoc=function(){ return Promise.resolve({id:"demo"+Date.now()}); };
  window.fbSetDoc=function(){ return Promise.resolve(); };
  window.fbUpdateDoc=function(){ return Promise.resolve(); };
  window.fbDeleteDoc=function(){ return Promise.resolve(); };
  window.fbWriteBatch=function(){ var b={set:function(){ return b; },update:function(){ return b; },delete:function(){ return b; },commit:function(){ return Promise.resolve(); }}; return b; };
}

function demoDemarrer(){
  GM_DEMO=true; window.GM_DEMO=true;
  try{ sessionStorage.setItem("gm_demo","1"); }catch(e){}
  try{ if(location.search) history.replaceState(null,"",location.pathname); }catch(e){}
  demoStubsFirestore();
  // firebase-init (module) peut finir de charger après : on remet les versions vides.
  var n=0, t=setInterval(function(){ demoStubsFirestore(); if(++n>=30) clearInterval(t); },1000);
  setActiveClub("demo");
  window.ASMB_USER={uid:"demo-dirigeant",roles:["dirigeant"],prenom:"Alex",nom:"Démo",email:"",clubId:"demo",permissions:{}};
  window.CURRENT_CLUB=clubNormaliserCouleurs({id:"demo",name:"Club Démo",sport:"basket",ville:"Démoville",plan:"premium",couleur:"#1A2E5A",couleur2:"#D4AF37"});
  localStorage.setItem("asmb_profile","dirigeant");
  if(!localStorage.getItem("asmb_teams")) demoDonnees();
  if(typeof applyClubLabels==="function") applyClubLabels();
  initProfile();
  if(typeof applySeasonLabels==="function") applySeasonLabels();
  demoBandeau();
}

function demoQuitter(){
  try{ sessionStorage.removeItem("gm_demo"); }catch(e){}
  if(typeof purgeClubLocalData==="function") purgeClubLocalData();
  try{ localStorage.removeItem("gm_pp_demo"); }catch(e){}
  location.href=location.pathname;
}

function demoBandeau(){
  if(document.getElementById("gm-demo-band")) return;
  var b=document.createElement("div"); b.id="gm-demo-band";
  b.title="Mode démo : rien n'est enregistré";
  b.innerHTML='<span>🧪 Démo</span>'+
    '<a href="https://accueil.generalmanagerapp.fr/#essai" target="_blank" rel="noopener">Créer mon club</a>'+
    '<button type="button" onclick="demoQuitter()">Quitter</button>';
  document.body.appendChild(b);
}

// ── Données fictives ──────────────────────────────────────────────
function demoJour(dec){ var d=new Date(); d.setDate(d.getDate()+dec); return d.toISOString().slice(0,10); }
function demoProchain(jourSemaine,semaines){ // 1 = lundi … 6 = samedi
  var d=new Date(); var ecart=(jourSemaine-d.getDay()+7)%7; d.setDate(d.getDate()+ecart+7*(semaines||0)); return d.toISOString().slice(0,10);
}
function demoDonnees(){
  var saisonDebut=parseInt(String(getCurrentSeason()).slice(0,4),10)||new Date().getFullYear();
  var equipes=[
    {id:"demo-u9",name:"U9 Mixte (Démo)",cat:"U9",ne:saisonDebut-8,g:"M"},
    {id:"demo-u11",name:"U11 Garçons (Démo)",cat:"U11",ne:saisonDebut-10,g:"M"},
    {id:"demo-u13",name:"U13 Filles (Démo)",cat:"U13",ne:saisonDebut-12,g:"F"},
    {id:"demo-u15",name:"U15 Garçons (Démo)",cat:"U15",ne:saisonDebut-14,g:"M"},
    {id:"demo-sf",name:"Seniors Filles (Démo)",cat:"Senior",ne:1998,g:"F"},
    {id:"demo-sm",name:"Seniors Garçons (Démo)",cat:"Senior",ne:1996,g:"M"}
  ];
  var pf=["Léa","Chloé","Emma","Sarah","Manon","Jade","Camille","Inès","Lina","Clara"];
  var pm=["Nathan","Enzo","Rayan","Mathis","Lucas","Adam","Noah","Thomas","Yanis","Hugo"];
  var noms=["Martin","Bernard","Durand","Petit","Girard","Fontaine","Lefèvre","Robin","Faure","Blanc","Moreau","Laurent","Simon","Michel","Garcia","Roux","Vincent","Muller","Mercier","Bonnet"];
  var postes=["Meneur","Arrière","Ailier","Ailier fort","Pivot"];
  var teams=[], players=[], lics=[], vus={};
  equipes.forEach(function(e,ti){
    var ids=[];
    for(var i=0;i<9;i++){
      var pid=e.id+"-j"+i, pr=(e.g==="F"?pf:pm)[(i+ti)%10], k=(i*3+ti)%10, nm=noms[k];
      while(vus[pr+"|"+nm]){ k=(k+1)%noms.length; nm=noms[k]; } // pas d'homonymes
      vus[pr+"|"+nm]=1;
      ids.push(pid);
      players.push({id:pid,prenom:pr,nom:nm,naissance:e.ne+"-0"+(1+i%9)+"-1"+(i%9),cat:e.cat,genre:e.g,poste:postes[i%5],maillot:String(4+i),
        licence:"ok",typeLicence:"competition",numLicence:"DEMO"+ti+i,contact:"06 00 00 00 00",telEnfant:"",notes:"",demo:true});
    }
    teams.push({id:e.id,name:e.name,cat:e.cat,coach:"Coach Démo",notes:"",demo:true,members:ids});
  });
  // Fiches d'inscription à différentes étapes (à valider, en cours, validées)
  [["Léa","Martin","U13","recue"],["Hugo","Faure","U11","recue"],["Jade","Robin","U13","envoyee"],["Adam","Petit","U9","ouverte"],["Inès","Durand","U13","validee"],["Noah","Girard","U15","validee"]].forEach(function(x,i){
    lics.push({code:"DEMO"+(10+i),email:"",nomDest:"Famille "+x[1]+" (Démo)",statut:x[3],createdAt:Date.now()-i*86400000,
      ouvertLe:new Date(Date.now()-i*86400000).toLocaleDateString("fr-FR"),categorie:x[2],demo:true,
      fiche:{prenom:x[0],nom:x[1],naissance:"",telephone:"",respTel:"",resp2Tel:"",adresse:"Démoville",emailLic:"",respNom:"Parent "+x[1]+" (Démo)",urgenceNom:"",urgenceTel:"",notes:"Fiche de démonstration"}});
  });
  // Planning : 2 entraînements par équipe et par semaine sur 3 semaines + matchs le samedi
  var events=[], creneaux=[[1,"17h30 - 19h00"],[2,"18h00 - 19h30"],[3,"17h00 - 18h30"],[4,"18h30 - 20h00"],[5,"19h00 - 20h30"]];
  var adv=["BC Exemple","Union Fictive","AS Modèle","Basket Imaginaire","ES Démoville"];
  teams.forEach(function(t,ti){
    for(var s=0;s<3;s++){
      [creneaux[ti%5],creneaux[(ti+2)%5]].forEach(function(c,k){
        events.push({id:"demo-e-"+ti+"-"+s+"-"+k,titre:"Entraînement "+t.name,type:"entrainement",date:demoProchain(c[0],s),heure:c[1],lieu:"Gymnase Démo",equipe:t.name,presences:{},demo:true});
      });
      events.push({id:"demo-m-"+ti+"-"+s,titre:t.name+" vs "+adv[(ti+s)%5]+" (Démo)",type:"match",date:demoProchain(ti%2?0:6,s+1),heure:(10+ti)+"h00",lieu:s%2?"Extérieur":"Domicile",equipe:t.name,presences:{},demo:true});
    }
  });
  events.push({id:"demo-stage",titre:"Stage des vacances (Démo)",type:"stage",date:demoJour(16),dateFin:demoJour(18),heure:"9h00 - 16h00",lieu:"Gymnase Démo",equipe:"",presences:{},demo:true});
  events.push({id:"demo-tournoi",titre:"Tournoi de Noël (Démo)",type:"tournoi",date:demoJour(30),heure:"8h30 - 18h00",lieu:"Gymnase Démo",equipe:"",presences:{},demo:true});
  // Comptabilité de la saison
  var compta=[], n=0;
  function ligne(dec,type,cat,montant,motif,tiers,moyen){
    compta.push({id:"demo-c"+(n++),date:demoJour(dec),montant:montant,type:type,categorie:cat,motif:motif,tiers:tiers,moyen:moyen||"Virement",compte:"Banque",reference:"",pointe:dec<-20,justificatif:null,demo:true});
  }
  ligne(-60,"recette","Cotisations/Licences",4850,"Licences saison (Démo)","Familles","Virement");
  ligne(-55,"depense","Affiliation/Licences fédérales",2140,"Licences fédérales (Démo)","Fédération (Démo)");
  ligne(-50,"recette","Subventions",1500,"Subvention de fonctionnement (Démo)","Mairie de Démoville");
  ligne(-45,"depense","Location salle",600,"Créneaux gymnase (Démo)","Mairie de Démoville");
  ligne(-40,"recette","Sponsors/Partenaires",800,"Partenariat maillots (Démo)","Boulangerie Démo");
  ligne(-35,"depense","Matériel",420.5,"Ballons et chasubles (Démo)","Magasin Sport Démo","CB");
  ligne(-21,"recette","Buvette/Événements",365,"Buvette match à domicile (Démo)","","Espèces");
  ligne(-21,"depense","Achats buvette",142.8,"Boissons et gâteaux (Démo)","Supermarché Démo","CB");
  ligne(-14,"depense","Arbitrage/Formations",180,"Arbitrage du mois (Démo)","Comité (Démo)");
  ligne(-7,"recette","Dons",150,"Don d'un parent (Démo)","Famille Durand (Démo)","Chèque");
  ligne(-3,"depense","Déplacements",96,"Minibus match extérieur (Démo)","Loueur Démo","CB");
  // Sponsors et buvette
  var sponsors=[
    {id:"demo-s1",nom:"Boulangerie Démo",statut:"actif",contactNom:"Mme Démo",contactTel:"",contactEmail:"",montant:800,dateDebut:demoJour(-40),dateFin:demoJour(325),relance:"",logo:null,document:null,notes:"Logo sur les maillots",typePart:"sponsoring",contreparties:"Logo maillots + panneau salle",formule:""},
    {id:"demo-s2",nom:"Garage du Centre (Démo)",statut:"actif",contactNom:"",contactTel:"",contactEmail:"",montant:500,dateDebut:demoJour(-20),dateFin:demoJour(345),relance:"",logo:null,document:null,notes:"",typePart:"sponsoring",contreparties:"Panneau salle",formule:""},
    {id:"demo-s3",nom:"Pharmacie Démo",statut:"prospect",contactNom:"",contactTel:"",contactEmail:"",montant:300,dateDebut:"",dateFin:"",relance:demoJour(5),logo:null,document:null,notes:"À rappeler",typePart:"mecenat",contreparties:"",formule:""}
  ];
  var inv=[
    {id:"demo-i1",nom:"Canette (Démo)",categorie:"buvette",qte:48,unite:"canettes",seuil:24,prixAchat:0.45,prixVente:1.5,emplacement:"Réserve",notes:""},
    {id:"demo-i2",nom:"Eau 50 cl (Démo)",categorie:"buvette",qte:12,unite:"bouteilles",seuil:24,prixAchat:0.25,prixVente:1,emplacement:"Réserve",notes:""},
    {id:"demo-i3",nom:"Crêpe (Démo)",categorie:"buvette",qte:30,unite:"crêpes",seuil:10,prixAchat:0.3,prixVente:1.5,emplacement:"Congélateur",notes:""},
    {id:"demo-i4",nom:"Ballons taille 7 (Démo)",categorie:"materiel",qte:18,unite:"ballons",seuil:10,prixAchat:22,prixVente:null,emplacement:"Local matériel",notes:""},
    {id:"demo-i5",nom:"Chasubles (Démo)",categorie:"materiel",qte:24,unite:"chasubles",seuil:12,prixAchat:4,prixVente:null,emplacement:"Local matériel",notes:""}
  ];
  localStorage.setItem("asmb_teams",JSON.stringify(teams));
  localStorage.setItem("asmb_players",JSON.stringify(players));
  localStorage.setItem("asmb_roster",JSON.stringify(players.map(function(p){ return {id:p.id,prenom:p.prenom,nom:p.nom,cat:p.cat,genre:p.genre,maillot:p.maillot,poste:p.poste}; })));
  localStorage.setItem("asmb_licences",JSON.stringify(lics));
  localStorage.setItem("asmb_events",JSON.stringify(events));
  localStorage.setItem("asmb_comptabilite",JSON.stringify(compta));
  localStorage.setItem("asmb_sponsors",JSON.stringify(sponsors));
  localStorage.setItem("asmb_inventaire",JSON.stringify(inv));
}
