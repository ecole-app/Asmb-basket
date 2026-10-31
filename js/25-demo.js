/* ===== 25-demo.js — Mode démo (lien « Voir la démo » du site : ?demo) =====
   L'appli s'ouvre sur un faux club « Club Démo », sans compte, en dirigeant, coach ou parent
   (?demo=coach / ?demo=parent, ou le menu du bandeau ; sert aussi au robot tests/robot).
   Saison fictive complète (septembre → juin) datée par rapport à aujourd'hui, effacée et recréée
   chaque jour : rien de ce que le visiteur saisit ne dure plus d'une journée. Tout reste sur
   l'appareil : les fonctions Firestore sont remplacées par des versions vides (lecture = rien,
   écriture = rien d'envoyé), fsWriteCollection ne fait rien (GM_DEMO). Chaque visiteur a sa
   propre démo, il peut tout modifier sans gêner personne. Les données fictives (équipes,
   joueurs, licences, planning, comptabilité, sponsors, buvette) portent « Démo ».
   Le mode tient dans l'onglet (sessionStorage gm_demo) ; « Quitter la démo » vide les données
   locales et revient à l'écran de connexion. Le club actif « demo » fait purger ces données
   au prochain vrai club (setActiveClub). Lancé par initAuthGate (js/18-auth.js). */
var GM_DEMO=false;

// Profil joué dans la démo : dirigeant (par défaut), coach ou parent (?demo=coach, ?demo=parent,
// ou le menu du bandeau). Coach = U13 Filles (Démo) ; parent = une famille de cette équipe.
var DEMO_PROFILS={dirigeant:"Dirigeant",coach:"Coach",parent:"Parent"};
function demoProfil(){
  var p="";
  try{ p=new URLSearchParams(location.search).get("demo")||sessionStorage.getItem("gm_demo_profil")||""; }catch(e){}
  return DEMO_PROFILS[p]?p:"dirigeant";
}
function demoChangerProfil(p){
  if(!DEMO_PROFILS[p]) return;
  try{ sessionStorage.setItem("gm_demo_profil",p); }catch(e){}
  location.reload();
}

function demoDemande(){
  try{ return new URLSearchParams(location.search).has("demo")||sessionStorage.getItem("gm_demo")==="1"; }catch(e){ return false; }
}

function demoStubsFirestore(){
  // Références factices : la démo ne dépend pas du chargement de Firebase.
  window.fbDb=window.fbDb||{demo:true};
  window.fbCollection=function(){ var a=[].slice.call(arguments,1); return {path:a.join("/"),id:a[a.length-1]}; };
  window.fbDoc=function(){ var a=[].slice.call(arguments,1); return {path:a.join("/"),id:a[a.length-1]}; };
  // Petite base en mémoire (inscrits et pages des événements de la démo, puis ce que le visiteur
  // ajoute) : lue par fbGetDoc / fbGetDocs, oubliée à la fermeture de l'onglet.
  if(!window.GM_DEMO_DB){ try{ window.GM_DEMO_DB=JSON.parse(localStorage.getItem("gm_demo_db")||"{}")||{}; }catch(e){ window.GM_DEMO_DB={}; } }
  var DB=window.GM_DEMO_DB;
  var coll=function(p){ return DB[p]||(DB[p]={}); };
  var ts=function(v){ return v&&typeof v==="number"?{toMillis:function(){ return v; },toDate:function(){ return new Date(v); },seconds:Math.floor(v/1000)}:v; };
  var lire=function(d){ var o={}; Object.keys(d||{}).forEach(function(k){ o[k]=k==="at"?ts(d[k]):d[k]; }); return o; };
  var snapDoc=function(path,id,d){ return {id:id,exists:function(){ return !!d; },data:function(){ return d?lire(d):undefined; },ref:{path:path+"/"+id,id:id}}; };
  var ecrire=function(ref,data,fusion){ var p=ref.path.split("/"), id=p.pop(), c=coll(p.join("/")), v={};
    Object.keys(data||{}).forEach(function(k){ var x=data[k]; v[k]=x&&x.toMillis?x.toMillis():x; });
    c[id]=fusion&&c[id]?Object.assign({},c[id],v):v; };
  window.fbQuery=function(r){ return {path:r.path,w:[].slice.call(arguments,1).filter(function(x){ return x&&x.f; })}; };
  window.fbWhere=function(f,op,v){ return {f:f,op:op,v:v}; };
  window.fbOrderBy=window.fbLimit=function(){ return null; };
  window.fbServerTimestamp=function(){ return ts(Date.now()); };
  window.fbArrayUnion=window.fbArrayRemove=function(){ return [].slice.call(arguments); };
  window.fbGetDoc=function(r){ var p=r.path.split("/"), id=p.pop(); return Promise.resolve(snapDoc(p.join("/"),id,coll(p.join("/"))[id])); };
  window.fbGetDocs=function(q){
    var c=coll(q.path), docs=Object.keys(c).filter(function(id){ return (q.w||[]).every(function(w){ var v=c[id][w.f];
      return w.op==="=="?v===w.v:(w.op==="in"?(w.v||[]).indexOf(v)>=0:(w.op==="array-contains"?(v||[]).indexOf(w.v)>=0:true)); }); })
      .map(function(id){ return snapDoc(q.path,id,c[id]); });
    return Promise.resolve({docs:docs,empty:!docs.length,size:docs.length,forEach:function(f){ docs.forEach(f); },docChanges:function(){ return []; }});
  };
  window.fbOnSnapshot=function(){ return function(){}; };
  window.fbAddDoc=function(c,d){ var id="demo"+Date.now()+Math.floor(Math.random()*1000); ecrire({path:c.path+"/"+id},d); return Promise.resolve({id:id}); };
  window.fbSetDoc=function(r,d,o){ ecrire(r,d,o&&o.merge); return Promise.resolve(); };
  window.fbUpdateDoc=function(r,d){ ecrire(r,d,true); return Promise.resolve(); };
  window.fbDeleteDoc=function(r){ var p=r.path.split("/"), id=p.pop(); delete coll(p.join("/"))[id]; return Promise.resolve(); };
  window.fbWriteBatch=function(){ var ops=[], b={set:function(r,d,o){ ops.push(function(){ ecrire(r,d,o&&o.merge); }); return b; },update:function(r,d){ ops.push(function(){ ecrire(r,d,true); }); return b; },
    delete:function(r){ ops.push(function(){ window.fbDeleteDoc(r); }); return b; },commit:function(){ ops.forEach(function(f){ f(); }); return Promise.resolve(); }}; return b; };
}

function demoDemarrer(){
  GM_DEMO=true; window.GM_DEMO=true;
  var profil=demoProfil();
  try{ sessionStorage.setItem("gm_demo","1"); sessionStorage.setItem("gm_demo_profil",profil); }catch(e){}
  try{ if(location.search) history.replaceState(null,"",location.pathname); }catch(e){}
  demoStubsFirestore();
  // firebase-init (module) peut finir de charger après : on remet les versions vides.
  var n=0, t=setInterval(function(){ demoStubsFirestore(); if(++n>=30) clearInterval(t); },1000);
  setActiveClub("demo");
  var qui={dirigeant:["Alex","Démo"],coach:["Sam","Coach Démo"],parent:["Camille","Parent Démo"]}[profil];
  window.ASMB_USER={uid:"demo-"+profil,roles:[profil],prenom:qui[0],nom:qui[1],email:"",clubId:"demo",permissions:{}};
  window.CURRENT_CLUB=clubNormaliserCouleurs({id:"demo",name:"Club Démo",sport:"basket",ville:"Démoville",plan:"premium",couleur:"#1A2E5A",couleur2:"#D4AF37"});
  // Remise à zéro chaque jour : tout ce que le visiteur a saisi ou modifié est effacé et la saison
  // fictive est recréée à partir de la date du jour. La démo ne peut donc pas servir de vraie appli.
  var auj=new Date().toISOString().slice(0,10);
  if(!localStorage.getItem("asmb_teams")||localStorage.getItem("gm_demo_jour")!==auj){
    if(typeof purgeClubLocalData==="function") purgeClubLocalData();
    ["gm_demo_db","asmb_match_stats","gm_pp_demo"].forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
    demoDonnees(); localStorage.setItem("gm_demo_jour",auj); window.GM_DEMO_DB=null; demoStubsFirestore(); }
  localStorage.setItem("asmb_profile",profil);
  if(profil==="coach") localStorage.setItem("asmb_coach_teams",JSON.stringify(["demo-u13"]));
  if(profil==="parent"){
    localStorage.setItem("asmb_phone","0600000000"); if(typeof myPhone!=="undefined") myPhone="0600000000";
    localStorage.setItem("asmb_parent_teams",JSON.stringify(["demo-u13"]));
    localStorage.setItem("asmb_parent_active_team","demo-u13");
    localStorage.setItem("asmb_tuto_done","1");
  }
  if(typeof applyClubLabels==="function") applyClubLabels();
  initProfile();
  if(typeof applySeasonLabels==="function") applySeasonLabels();
  demoBandeau();
}

function demoQuitter(){
  try{ sessionStorage.removeItem("gm_demo"); sessionStorage.removeItem("gm_demo_profil"); }catch(e){}
  try{ ["asmb_coach_teams","asmb_parent_teams","asmb_parent_active_team","asmb_phone","asmb_profile"].forEach(function(k){ localStorage.removeItem(k); }); }catch(e){}
  if(typeof purgeClubLocalData==="function") purgeClubLocalData();
  try{ localStorage.removeItem("gm_pp_demo"); localStorage.removeItem("gm_demo_jour"); localStorage.removeItem("gm_demo_db"); localStorage.removeItem("asmb_match_stats"); }catch(e){}
  location.href=location.pathname;
}

function demoBandeau(){
  if(document.getElementById("gm-demo-band")) return;
  var b=document.createElement("div"); b.id="gm-demo-band";
  b.title="Mode démo : rien n'est enregistré";
  var p=demoProfil(), opts=Object.keys(DEMO_PROFILS).map(function(k){ return '<option value="'+k+'"'+(k===p?' selected':'')+'>'+DEMO_PROFILS[k]+'</option>'; }).join("");
  b.innerHTML='<span>🧪 Démo</span>'+
    '<select aria-label="Voir la démo en tant que" onchange="demoChangerProfil(this.value)">'+opts+'</select>'+
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
  // ── Saison complète, datée par rapport à aujourd'hui (recréée chaque jour) ──
  var alea=demoAlea(saisonDebut*31+7), auj=demoJour(0);
  var S0=new Date(saisonDebut,8,1), S1=new Date(saisonDebut+1,5,30);
  var iso=function(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
  var plus=function(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; };
  // Vacances scolaires approchées (zone A) : la démo ne place ni entraînement ni match dedans.
  var vac=[[new Date(saisonDebut,9,17),new Date(saisonDebut,10,2)],[new Date(saisonDebut,11,19),new Date(saisonDebut+1,0,4)],
    [new Date(saisonDebut+1,1,6),new Date(saisonDebut+1,1,22)],[new Date(saisonDebut+1,3,10),new Date(saisonDebut+1,3,26)]];
  var enVac=function(d){ return vac.some(function(v){ return d>=v[0]&&d<=v[1]; }); };

  // Licences : une fiche validée et payée par joueur, quelques-unes à valider, en cours ou à relancer.
  var tarifCat={U9:120,U11:140,U13:160,U15:170,Senior:190};
  players.forEach(function(pl,i){
    var d=plus(S0,(i*3)%40), impaye=i%17===5;
    var lic={code:"DEMO"+(100+i),email:"",nomDest:"Famille "+pl.nom+" (Démo)",statut:"validee",createdAt:+d,
      ouvertLe:d.toLocaleDateString("fr-FR"),categorie:pl.cat,demo:true,playerId:pl.id,saison:getCurrentSeason(),
      fiche:{prenom:pl.prenom,nom:pl.nom,naissance:pl.naissance,telephone:"",respTel:"",resp2Tel:"",adresse:"Démoville",emailLic:"",respNom:"Parent "+pl.nom+" (Démo)",urgenceNom:"",urgenceTel:"",notes:""},
      paiement:{moyen:["Virement","Chèque","Espèces","HelloAsso"][i%4],montant:impaye?60:tarifCat[pl.cat],date:iso(plus(d,3))}};
    if(impaye){ lic.montantAttendu=tarifCat[pl.cat]; lic.relances=[{date:iso(plus(d,25)),canal:"sms"}]; }
    lics.push(lic);
  });
  [["Léa","Martin","U13","recue"],["Hugo","Faure","U11","recue"],["Jade","Robin","U13","envoyee"],["Adam","Petit","U9","ouverte"],["Zoé","Lambert","U9","recue"]].forEach(function(x,i){
    lics.push({code:"DEMO"+(10+i),email:"",nomDest:"Famille "+x[1]+" (Démo)",statut:x[3],createdAt:Date.now()-i*86400000,
      ouvertLe:new Date(Date.now()-i*86400000).toLocaleDateString("fr-FR"),categorie:x[2],demo:true,
      fiche:{prenom:x[0],nom:x[1],naissance:"",telephone:"",respTel:"",resp2Tel:"",adresse:"Démoville",emailLic:"",respNom:"Parent "+x[1]+" (Démo)",urgenceNom:"",urgenceTel:"",notes:"Fiche de démonstration"}});
  });

  // Planning : 2 entraînements par semaine et par équipe, de septembre à juin (hors vacances).
  var events=[], jours=[[1,3],[2,4],[1,4],[2,5],[3,5],[1,3]], horaires=["17h00 - 18h15","18h15 - 19h30","19h30 - 21h00"];
  teams.forEach(function(t,ti){
    for(var d=new Date(S0); d<=S1; d=plus(d,1)){
      if(jours[ti].indexOf(d.getDay())<0||enVac(d)||d<plus(S0,7)) continue;
      events.push({id:"demo-e-"+ti+"-"+iso(d),titre:"Entraînement "+t.name,type:"entrainement",date:iso(d),heure:horaires[ti%3],
        lieu:ti<3?"Gymnase Démo":"Salle Démo 2",equipe:t.name,presences:{},demo:true});
    }
  });
  // Championnat : un match par week-end d'octobre à mai, aller puis retour, domicile / extérieur.
  var adv=["BC Exemple","Union Fictive","AS Modèle","Basket Imaginaire","ES Démoville","Étoile Fictive","CS Exemplaire","Olympique Démo","Avenir Modèle"];
  var matchsJoues={};
  teams.forEach(function(t,ti){
    var n=0, premier=plus(new Date(saisonDebut,9,1),(6-new Date(saisonDebut,9,1).getDay()+7)%7);
    for(var d=new Date(premier); d<=new Date(saisonDebut+1,4,31); d=plus(d,7)){
      if(enVac(d)) continue;
      var a=adv[(n+ti)%adv.length], dom=(n+ti)%2===0, jour=ti%2?plus(d,1):d;
      var ev={id:"demo-m-"+ti+"-"+n,titre:t.name+" vs "+a+" (Démo)",type:"match",date:iso(jour),heure:(10+ti)+"h00",
        lieu:dom?"Gymnase Démo":"Extérieur",equipe:t.name,presences:{},demo:true};
      if(iso(jour)<auj){
        var nous=34+Math.floor(alea()*36), eux=nous+Math.floor(alea()*30)-(alea()<.62?20:4);
        if(eux===nous) eux--;
        ev.score={adversaire:a,asmb:nous,adv:Math.max(18,eux)};
        (matchsJoues[t.id]=matchsJoues[t.id]||[]).push(ev);
      }
      events.push(ev); n++;
    }
  });
  // Stats avancées sur les 3 derniers matchs joués des U13 Filles et des U15 Garçons.
  var stats=[];
  ["demo-u13","demo-u15"].forEach(function(tid){
    var t=teams.filter(function(x){ return x.id===tid; })[0];
    (matchsJoues[tid]||[]).slice(-3).forEach(function(ev){ stats.push(demoStatsMatch(ev,t.members,alea)); });
  });

  // Événements de la saison, avec inscrits (billets) et bénévoles placés.
  var evts=[
    {id:"demo-stage-ts",titre:"Stage de la Toussaint (Démo)",type:"stage",date:iso(plus(vac[0][0],3)),dateFin:iso(plus(vac[0][0],5)),heure:"9h00 - 16h00",nb:22,places:24,tarifs:[["Licencié du club",60,"lic"],["Extérieur",80,"ext"]]},
    {id:"demo-tournoi",titre:"Tournoi de Noël (Démo)",type:"tournoi",date:iso(plus(vac[1][0],-1)),heure:"8h30 - 18h00",nb:0,ben:true},
    {id:"demo-loto",titre:"Loto du club (Démo)",type:"soiree",date:iso(new Date(saisonDebut+1,0,24)),heure:"19h00 - 23h00",nb:34,places:120,resa:true,tarifs:[["Adulte",10,"tous"],["Enfant (moins de 12 ans)",5,"tous"]],ben:true},
    {id:"demo-stage-pq",titre:"Stage de Pâques (Démo)",type:"stage",date:iso(plus(vac[3][0],2)),dateFin:iso(plus(vac[3][0],4)),heure:"9h00 - 16h00",nb:15,places:24,tarifs:[["Licencié du club",60,"lic"],["Extérieur",80,"ext"]]},
    {id:"demo-ag",titre:"Assemblée générale (Démo)",type:"autre",date:iso(new Date(saisonDebut+1,5,13)),heure:"10h00 - 12h00",nb:0}
  ];
  var db={evt_inscrits:{},evt_pages:{}}, prenoms=pf.concat(pm);
  evts.forEach(function(x,k){
    var e={id:x.id,titre:x.titre,type:x.type,date:x.date,heure:x.heure,lieu:"Gymnase Démo",equipe:"",presences:{},demo:true};
    if(x.dateFin) e.dateFin=x.dateFin;
    if(x.ben) e.benevoles=[["Buvette","Camille Durand (Démo)"],["Accueil","Karim Petit (Démo)"],["Table de marque","Julie Martin (Démo)"],["Rangement","Paul Robin (Démo)"]].map(function(b,i){ return {id:"demo-b"+k+i,poste:b[0],heure:"",nom:b[1]}; });
    if(x.tarifs){
      e.inscr={actif:true,tarifs:x.tarifs.map(function(t){ return {nom:t[0],prix:String(t[1]),pour:t[2]}; }),modes:["especes","cheque","cb"],places:x.places,parJour:false};
      if(x.resa) e.resa=true;
      var pid="demo__"+x.id, nb=0;
      for(var i=0;i<x.nb;i++){
        var t=x.tarifs[i%x.tarifs.length], pers=x.resa?1+(i%3):1, code=(x.resa?"SOI":"STG")+"-"+(10000+k*1000+i)+"-DEMO";
        nb+=pers;
        db.evt_inscrits[code]={eventId:x.id,prenom:prenoms[(i*7+k)%prenoms.length],nom:noms[(i*3+k)%noms.length]+" (Démo)",tel:"",tarifIdx:i%x.tarifs.length,tarifNom:t[0],
          montant:t[1]*pers,personnes:pers,mode:["especes","cheque","cb"][i%3],statut:"inscrit",paye:i%4!==3,present:x.date<auj,source:"public",at:+plus(new Date(x.date),-20+i%15)};
      }
      db.evt_pages[pid]={clubId:"demo",eventId:x.id,actif:true,type:x.type,titre:x.titre,date:x.date,dateFin:x.dateFin||"",heure:x.heure,lieu:"Gymnase Démo",
        tarifs:e.inscr.tarifs,parJour:false,resa:!!x.resa,jours:[],modes:e.inscr.modes,places:x.places,nb:nb,nom:"Club Démo"};
    }
    events.push(e);
  });
  events.sort(function(a,b){ return a.date<b.date?-1:(a.date>b.date?1:0); });

  // Comptabilité : chaque mois de la saison jusqu'à aujourd'hui (jamais dans le futur).
  var compta=[], n=0;
  function ligne(d,type,cat,montant,motif,tiers,moyen){
    var j=typeof d==="string"?d:iso(d); if(j>auj) return;
    compta.push({id:"demo-c"+(n++),date:j,montant:Math.round(montant*100)/100,type:type,categorie:cat,motif:motif,tiers:tiers||"",moyen:moyen||"Virement",compte:"Banque",reference:"",pointe:j<demoJour(-20),justificatif:null,demo:true});
  }
  ligne(plus(S0,10),"recette","Cotisations/Licences",lics.filter(function(l){ return l.paiement; }).reduce(function(s,l){ return s+l.paiement.montant; },0),"Licences de la saison (Démo)","Familles");
  ligne(plus(S0,14),"depense","Affiliation/Licences fédérales",2140,"Licences fédérales (Démo)","Fédération (Démo)");
  ligne(plus(S0,20),"recette","Sponsors/Partenaires",800,"Partenariat maillots (Démo)","Boulangerie Démo");
  ligne(plus(S0,25),"depense","Matériel",420.5,"Ballons et chasubles (Démo)","Magasin Sport Démo","CB");
  ligne(new Date(saisonDebut,9,15),"recette","Subventions",1500,"Subvention de fonctionnement (Démo)","Mairie de Démoville");
  ligne(new Date(saisonDebut+1,2,20),"recette","Subventions",900,"Aide au projet jeunes (Démo)","Département (Démo)");
  ligne(new Date(saisonDebut,10,5),"recette","Sponsors/Partenaires",500,"Panneau salle (Démo)","Garage du Centre (Démo)");
  for(var m=0;m<10;m++){
    var mois=new Date(saisonDebut,8+m,1);
    ligne(plus(mois,4),"depense","Location salle",300,"Créneaux gymnase (Démo)","Mairie de Démoville");
    if(m>0) ligne(plus(mois,12),"depense","Arbitrage/Formations",120+Math.round(alea()*90),"Arbitrage du mois (Démo)","Comité (Démo)");
    if(m>0) ligne(plus(mois,18),"depense","Déplacements",60+Math.round(alea()*80),"Minibus matchs extérieurs (Démo)","Loueur Démo","CB");
  }
  events.filter(function(e){ return e.type==="match"&&e.score&&e.lieu!=="Extérieur"&&/U15|Seniors/.test(e.equipe); }).forEach(function(e){
    ligne(e.date,"recette","Buvette/Événements",140+Math.round(alea()*160),"Buvette "+e.titre,"","Espèces");
    ligne(e.date,"depense","Achats buvette",55+Math.round(alea()*40),"Boissons et gâteaux (Démo)","Supermarché Démo","CB");
  });
  evts.forEach(function(x){
    if(!x.tarifs||x.date>=auj) return;
    var tot=0; Object.keys(db.evt_inscrits).forEach(function(c){ var r=db.evt_inscrits[c]; if(r.eventId===x.id&&r.paye) tot+=r.montant; });
    ligne(x.dateFin||x.date,"recette","Buvette/Événements",tot,"Inscriptions "+x.titre,"Participants","Espèces");
    ligne(x.date,"depense","Matériel",x.type==="stage"?180:90,"Goûters et lots "+x.titre,"Supermarché Démo","CB");
  });
  ligne(demoJour(-9),"recette","Dons",150,"Don d'un parent (Démo)","Famille Durand (Démo)","Chèque");
  compta.sort(function(a,b){ return a.date<b.date?-1:1; });

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
  localStorage.setItem("asmb_match_stats",JSON.stringify(stats));
  localStorage.setItem("gm_demo_db",JSON.stringify(db));
}

// Hasard reproductible : la démo d'un même jour est toujours la même.
function demoAlea(graine){ var x=graine||1; return function(){ x=(x*16807)%2147483647; return (x-1)/2147483646; }; }

// Feuille de stats d'un match joué (format de js/14j) ; le score du match devient celui de la feuille.
function demoStatsMatch(ev,membres,alea){
  var j=membres.slice(0,8), m=msNouveau(ev,j,getCurrentSeason(),10,4,5), s=0;
  j.slice(0,5).forEach(function(p){ m.evts.push({a:"in",p:p,q:1,s:0}); });
  var surT=j.slice(0,5), banc=j.slice(5), acts=["p2","p2","p2x","p2x","p3","p3x","lf1","lfx","rd","rd","ro","pd","int","bp","fc","ct","fp"];
  for(var q=1;q<=4;q++){
    if(q>1) m.qDebut[q-1]=(q-1)*600;
    for(var k=0;k<24;k++){
      s=(q-1)*600+Math.floor((k+1)*600/25);
      if(alea()<.42){ m.evts.push({a:["a2","a2","a3","a1"][Math.floor(alea()*4)],p:null,q:q,s:s}); continue; }
      m.evts.push({a:acts[Math.floor(alea()*acts.length)],p:surT[Math.floor(alea()*surT.length)],q:q,s:s});
      if(k===12&&banc.length){ var i=Math.floor(alea()*5), sort=surT[i], entre=banc.shift(); m.evts.push({a:"out",p:sort,q:q,s:s},{a:"in",p:entre,q:q,s:s}); surT[i]=entre; banc.push(sort); }
    }
  }
  m.q=4; m.chrono={sec:2400,depuis:null}; m.statut="termine"; m.sFin=2400;
  var c=msCalcul(m);
  ev.score={adversaire:ev.score.adversaire,asmb:c.score.nous,adv:c.score.eux};
  m.adversaire=ev.score.adversaire;
  return m;
}
