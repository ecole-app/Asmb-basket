/* ===== 20c-demo.js — Données fictives du mode démo (?demo=1) =====
   Chargé juste avant 21-main.js. Ne fait rien hors mode démo.
   Voir 00-demo.js : le stockage est en mémoire, rien n'est écrit sur le
   navigateur ni dans Firebase. */
(function(){
  if(window.GM_DEMO_REFUSEE){
    // Stockage non remplaçable : on n'affiche pas la démo plutôt que de risquer des vraies données.
    window.addEventListener("load",function(){
      document.body.innerHTML='<div style="font-family:system-ui;padding:32px;text-align:center;color:#1a2438">La démo n\'est pas disponible sur ce navigateur.<br><a href="https://generalmanagerapp.fr">Ouvrir l\'appli</a></div>';
    });
    window.initAuthGate=function(){};
    return;
  }
  if(!window.GM_DEMO) return;

  var jour=function(dec){ var d=new Date(); d.setDate(d.getDate()+dec); return d.toISOString().slice(0,10); };
  var saison=(typeof getCurrentSeason==="function")?getCurrentSeason():"";

  window.CURRENT_CLUB={id:"demo",name:"Club Démo",plan:"premium",status:"active"};
  window.CURRENT_CLUB_ID="demo";
  window.ASMB_USER={uid:"demo",roles:["dirigeant"],clubId:"demo",email:"demo@generalmanagerapp.fr"};
  localStorage.setItem("asmb_profile","dirigeant");
  localStorage.setItem("asmb_visual_theme","classique");

  // Équipes, joueurs et événements : les générateurs de démonstration de l'appli.
  var alerte=window.askAlert, toast=window.showToast;
  window.askAlert=function(){ return Promise.resolve(); };
  window.showToast=function(){};
  try{ loadDemoDataConfirmed(); }catch(e){ console.log("démo équipes",e); }
  try{ loadDemoEventsConfirmed(); }catch(e){ console.log("démo événements",e); }
  window.askAlert=alerte; window.showToast=toast;

  // Noms uniques : les générateurs de l'appli réutilisent les mêmes noms d'une
  // équipe à l'autre, ce qui déclencherait l'alerte « homonymes détectés ».
  var pf=["Léa","Chloé","Emma","Sarah","Manon","Julie","Camille","Inès","Anaïs","Clara","Lola","Jade","Alice","Louise","Nina","Eva","Maya","Lina","Zoé","Romane"];
  var pm=["Nathan","Enzo","Rayan","Mathis","Lucas","Adam","Karim","Thomas","Yanis","Hugo","Noah","Léo","Gabriel","Tom","Ethan","Maxime","Théo","Axel","Louis","Sacha"];
  var nm=["Martin","Bernard","Dubois","Petit","Girard","Fontaine","Lefèvre","Robin","Faure","Blanc","Durand","Leroy","Morel","Simon","Laurent","Michel","Garnier","Chevalier","François","Mercier","Boyer","Gauthier","Perrin","Roche","Colin","Masson","Marchand","Vidal","Renard","Joly","Aubert","Collet","Prevost","Carpentier","Brun","Meyer","Barre","Fabre","Rey","Huet"];
  var nF=0,nM=0;
  var jou=getPlayers();
  jou.forEach(function(p,i){
    if(p.genre==="F"){ p.prenom=pf[nF%pf.length]; nF++; } else { p.prenom=pm[nM%pm.length]; nM++; }
    p.nom=nm[i%nm.length];
    p.naissance=(p.cat==="U13"?"2015-":"1998-")+("0"+(1+i%9)).slice(-2)+"-1"+(i%9);
  });
  localStorage.setItem("asmb_players",JSON.stringify(jou));
  var eq=getTeams();
  eq.forEach(function(t){ t.name=String(t.name).replace(" (Démo)",""); t.coach="Sam Laurent"; });
  localStorage.setItem("asmb_teams",JSON.stringify(eq));
  var evs=getEvents();
  evs.forEach(function(e){ Object.keys(e).forEach(function(k){ if(typeof e[k]==="string") e[k]=e[k].replace(" (Démo)",""); }); });
  localStorage.setItem("asmb_events",JSON.stringify(evs));
  localStorage.setItem("asmb_roster",JSON.stringify(rosterDepuisJoueurs(jou)));

  // Licences à différents stades, avec un cas payé et un impayé.
  var fiches=[
    ["Jade","Moreau","2015-04-18","U13","F"],["Hugo","Lambert","2013-09-02","U15","M"],
    ["Camille","Garcia","2017-02-11","U11","F"],["Yanis","Benali","2015-06-23","U13","M"],
    ["Zoé","Fournier","2013-12-05","U15","F"]
  ];
  var lics=getLicences().filter(function(l){ return l.code==="DEMO01"; });
  lics.forEach(function(l){ l.email="famille0@exemple.fr"; l.nomDest="Famille Martin"; if(l.fiche){ l.fiche.emailLic="famille0@exemple.fr"; l.fiche.respNom="Parent Martin"; l.fiche.notes=""; } l.saison=saison; });
  var statuts=["validee","validee","recue","en_cours","envoyee"];
  fiches.forEach(function(f,i){
    var lic={
      code:(i===4?"DEMO-TEST-0001":"CLUB-"+(1001+i)),email:"famille"+(i+1)+"@exemple.fr",nomDest:"Famille "+f[1],
      statut:statuts[i],createdAt:Date.now()-i*86400000,ouvertLe:i<4?jour(-i-1):null,
      categorie:f[3],saison:saison,typeLicence:i%2?"loisir":"competition",
      fiche:i<3?{prenom:f[0],nom:f[1],naissance:f[2],genre:f[4],telephone:"",respTel:"06 12 34 56 7"+i,resp2Tel:"",adresse:"12 rue des Lilas",emailLic:"famille"+(i+1)+"@exemple.fr",respNom:"Parent "+f[1],urgenceNom:"",urgenceTel:"",notes:""}:null
    };
    if(i===0) lic.paiement={montant:120,date:jour(-9),moyen:"Chèque"};
    if(i===1) lic.montantAttendu=120;
    lics.push(lic);
  });
  localStorage.setItem("asmb_licences",JSON.stringify(lics));

  var cmp=[
    ["recette","Cotisations/Licences","Licence Jade Moreau","Parent Moreau","Chèque",120,-9,"Banque"],
    ["recette","Buvette/Événements","Buvette match du samedi","","Espèces",186.5,-6,"Caisse buvette"],
    ["recette","Sponsors/Partenaires","Partenariat saison","Boulangerie Dupont","Virement",600,-20,"Banque"],
    ["recette","Subventions","Subvention municipale","Mairie","Virement",1500,-35,"Banque"],
    ["depense","Location salle","Salle de sport, trimestre","Mairie","Virement",420,-14,"Banque"],
    ["depense","Matériel","Ballons taille 6","Sport 2000","CB",96.8,-11,"Banque"],
    ["depense","Achats buvette","Boissons et sandwichs","Grossiste","Espèces",74.3,-7,"Caisse buvette"],
    ["depense","Arbitrage/Formations","Formation arbitre","Comité","Virement",60,-3,"Banque"]
  ].map(function(c,i){
    return {id:"demo-c"+i,date:jour(c[6]),type:c[0],categorie:c[1],motif:c[2],tiers:c[3],moyen:c[4],montant:c[5],compte:c[7],reference:"",pointe:i<5,justificatif:null};
  });
  localStorage.setItem("asmb_comptabilite",JSON.stringify(cmp));

  var inv=[
    ["Canettes 33cl","buvette",48,"unité",12,0.6,1.5],["Sandwichs jambon-beurre","buvette",10,"unité",12,1.6,3],
    ["Café","buvette",200,"dose",50,0.1,1],["Gaufres","buvette",30,"unité",10,0.5,2],
    ["Ballons taille 6","materiel",14,"unité",6,null,null],["Chasubles","materiel",30,"unité",10,null,null],
    ["Plots","materiel",40,"unité",15,null,null]
  ].map(function(x,i){
    return {id:"demo-i"+i,nom:x[0],categorie:x[1],qte:x[2],unite:x[3],seuil:x[4],prixAchat:x[5],prixVente:x[6],emplacement:"",notes:""};
  });
  localStorage.setItem("asmb_inventaire",JSON.stringify(inv));

  var sp=[
    ["Boulangerie Dupont","actif",600,"M. Dupont"],["Garage Martin","actif",400,"Mme Martin"],
    ["Pharmacie du Centre","prospect",null,"M. Roche"]
  ].map(function(x,i){
    return {id:"demo-s"+i,nom:x[0],statut:x[1],contactNom:x[3],contactTel:"04 77 00 00 0"+i,contactEmail:"",montant:x[2],
            dateDebut:jour(-120),dateFin:jour(240),relance:x[1]==="prospect"?jour(4):"",logo:null,document:null,notes:""};
  });
  localStorage.setItem("asmb_sponsors",JSON.stringify(sp));


  // ── Mini Firestore en mémoire ──────────────────────────────────────
  // Sert à la Communauté (canaux et messages), qui lit tout en temps réel.
  // Rien ne sort de la page : pas de réseau, pas de compte.
  var FS={}, LST=[];
  function Ts(ms){ this.ms=ms; this.seconds=Math.floor(ms/1000); }
  Ts.prototype.toMillis=function(){ return this.ms; };
  Ts.prototype.toDate=function(){ return new Date(this.ms); };
  var segs=function(a){ return Array.prototype.slice.call(a,1).filter(function(x){ return typeof x==="string"; }); };
  var parentOf=function(path){ return path.slice(0,path.lastIndexOf("/")); };
  var copy=function(o){ return Object.assign({},o); };
  function docsOf(col,ord){
    var arr=Object.keys(FS).filter(function(k){ return parentOf(k)===col; }).map(function(k){
      var data=FS[k], id=k.slice(k.lastIndexOf("/")+1);
      return {id:id,exists:function(){return true;},data:function(){return copy(data);},ref:{kind:"doc",path:k}};
    });
    if(ord){ arr.sort(function(a,b){
      var x=a.data()[ord], y=b.data()[ord];
      x=x&&x.toMillis?x.toMillis():x; y=y&&y.toMillis?y.toMillis():y;
      return x>y?1:x<y?-1:0; }); }
    return arr;
  }
  function snapOf(l){
    if(l.kind==="doc"){
      var d=FS[l.path];
      return {id:l.path.slice(l.path.lastIndexOf("/")+1),exists:function(){return !!d;},data:function(){return d?copy(d):undefined;}};
    }
    var docs=docsOf(l.path,l.ord);
    return {docs:docs,size:docs.length,empty:!docs.length,forEach:function(fn){docs.forEach(fn);},docChanges:function(){return [];}};
  }
  function notify(path){
    LST.forEach(function(l){ if(l.path===path||l.path===parentOf(path)) setTimeout(function(){ l.cb(snapOf(l)); },0); });
  }
  function put(path,data,merge){
    FS[path]=merge&&FS[path]?Object.assign({},FS[path],data):copy(data);
    notify(path);
  }
  window.fbDb={demo:true};
  window.fbReady=true;
  window.fbCollection=function(){ return {kind:"col",path:segs(arguments).join("/")}; };
  window.fbDoc=function(){ return {kind:"doc",path:segs(arguments).join("/")}; };
  window.fbQuery=function(ref){ var q={kind:"col",path:ref.path}; Array.prototype.slice.call(arguments,1).forEach(function(c){ if(c&&c.ord) q.ord=c.ord; }); return q; };
  window.fbOrderBy=function(f){ return {ord:f}; };
  window.fbWhere=function(){ return {}; };
  window.fbServerTimestamp=function(){ return new Ts(Date.now()); };
  window.fbOnSnapshot=function(ref,cb){
    var l={kind:ref.kind,path:ref.path,ord:ref.ord,cb:cb}; LST.push(l);
    setTimeout(function(){ cb(snapOf(l)); },0);
    return function(){ LST=LST.filter(function(x){ return x!==l; }); };
  };
  window.fbAddDoc=function(col,data){ var id="m"+Date.now().toString(36)+Math.random().toString(36).slice(2,6); put(col.path+"/"+id,data); return Promise.resolve({id:id}); };
  window.fbSetDoc=function(ref,data,opts){ put(ref.path,data,!!(opts&&opts.merge)); return Promise.resolve(); };
  window.fbUpdateDoc=function(ref,data){ put(ref.path,data,true); return Promise.resolve(); };
  window.fbDeleteDoc=function(ref){
    Object.keys(FS).forEach(function(k){ if(k===ref.path||k.indexOf(ref.path+"/")===0) delete FS[k]; });
    notify(ref.path); return Promise.resolve();
  };
  window.fbGetDoc=function(ref){ return Promise.resolve(snapOf({kind:"doc",path:ref.path})); };
  window.fbGetDocs=function(ref){ return Promise.resolve(snapOf(ref)); };
  window.fbArrayUnion=function(){ return Array.prototype.slice.call(arguments); };
  window.fbArrayRemove=function(){ return []; };

  var hh=function(h){ return new Ts(Date.now()-h*3600000); };
  var equipes=getTeams();
  var chans=[
    {id:"annonces-club",name:"Annonces du club",icon:"📣",desc:"Infos pour tout le club",clubWide:true,teamId:""},
    {id:"bureau",name:"Bureau",icon:"🏛️",desc:"Organisation et décisions",clubWide:false,teamId:""}
  ];
  equipes.slice(0,2).forEach(function(t){ chans.push({id:"equipe-"+t.id,name:t.name,icon:"🏀",desc:"Canal de l'équipe",clubWide:false,teamId:t.id}); });
  chans.forEach(function(c){ c.members=[]; put("channels/"+c.id,c); });
  var msgs={
    "annonces-club":[["Sam Laurent","Bienvenue sur la saison 2026-2027 ! Les convocations du week-end sont en ligne.",30],["Bureau","Tournoi de Noël : on cherche des bénévoles pour la buvette.",5]],
    "bureau":[["Karim","Les factures sponsors sont envoyées.",52],["Sam Laurent","Parfait. On valide le budget salle jeudi.",20]]
  };
  msgs["equipe-"+(equipes[0]||{}).id]=[["Sam Laurent","Entraînement mercredi 18h, pensez à vos gourdes.",9],["Léa","Je serai là !",8]];
  Object.keys(msgs).forEach(function(cid){
    msgs[cid].forEach(function(m,i){ put("channels/"+cid+"/messages/seed"+i,{text:m[1],pseudo:m[0],ts:hh(m[2]),likeUsers:[],heartUsers:[]}); });
  });
  try{ myPhone="0612345678"; localStorage.setItem("asmb_phone",myPhone); }catch(e){}
  try{ savedPseudo="Sam Laurent"; localStorage.setItem("asmb_pseudo",savedPseudo); }catch(e){}

  // Pas de connexion : on entre directement dans l'espace dirigeant.
  window.initAuthGate=function(){ initProfile(); };

  // Pastille « Démo » : rappelle que rien n'est enregistré.
  window.addEventListener("load",function(){
    var b=document.createElement("div");
    b.textContent="DÉMO · rien n'est enregistré";
    b.style.cssText="position:fixed;top:1px;left:50%;transform:translateX(-50%);white-space:nowrap;z-index:99999;pointer-events:none;font:700 8.5px system-ui,sans-serif;letter-spacing:.4px;color:#0b1630;background:#D4AF37;border-radius:999px;padding:1px 8px";
    document.body.appendChild(b);
  });
})();
