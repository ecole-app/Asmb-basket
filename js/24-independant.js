/* ===== 24-independant.js — Version Indépendant (micro-entreprise) ===== */
// Une structure « indépendant » est une fiche clubs/{id} avec type:"independant"
// (posé par le super admin). Elle n'utilise PAS l'interface du club : deux applis
// à part, plein écran (#scr-indep), pensées pour remplacer le groupe WhatsApp.
//  - L'indépendant (compte « dirigeant » de la structure) : Accueil, Séances, Clients.
//  - Ses clients (rôle « client », compte créé avec le lien ?rejoindre=CODE) :
//    Accueil (je viens / je ne peux pas), Réserver.
// Données (sous clubs/{id}/, voir firestore.rules) :
//  indep_creneaux/{id}  créneau hebdomadaire {titre, jour 0-6, heure, duree, lieu,
//                       places, prix, ouvert, habitues:[uid], actif, debut}
//  indep_seances/{id}   exception d'un créneau (id = creneau_AAAA-MM-JJ : annulee, motif)
//                       ou séance ponctuelle (id = p_xxx, creneauId null)
//  indep_resas/{seance__uid}  {seance, date, uid, statut:"vient"|"absent", present, nom}
//                       un habitué est compté présent sauf réservation « absent »
//  indep_clients/{uid}  fiche du client (lui et l'indépendant seulement)
//  indep_clients/e_xxx  fiche d'un ENFANT MINEUR, sans compte : créée par son parent
//                       {prenom, nom, naissance, note, parentUid, mineur:true, autorisation:true}.
//                       Le compte reste toujours celui d'un adulte ; un parent qui n'inscrit que
//                       ses enfants a parentSeul:true sur sa propre fiche (il n'est pas « client »).
//                       Un enfant est une « personne » comme une autre : son id sert dans les
//                       habitués d'un créneau et dans les réservations (seance__e_xxx).
//  indep_annonces/{id} annonce de l'indépendant {texte, cible:"tous"|creneauId, seance?, seanceDate?, createdAt}
//  indep_reactions/{annonce__personne}  réponse 👍🏼/👎🏼 {annonce, uid (personne), owner (compte), val:"up"|"down", nom}
//  indep_discussions/{uid}  fil privé client ↔ indépendant (uid = compte du client ; un parent écrit pour ses enfants)
//                       {nom, dernier, dernierTs, dernierDe:"client"|"coach", luClient, luCoach}
//    └ messages/{id}  {de, auteur, texte?, img? (JPEG réduit en data:), createdAt}
//  indep_notes/{uid}    notes privées de l'indépendant
//  indep_liens/{CODE}   (global) lien d'invitation réutilisable, désactivable

var IND={role:null, uid:null, clubId:null, club:{}, tab:"accueil", creneaux:[], seances:{}, resas:{},
  clients:{}, clientsCharges:false, fiche:null, ficheChargee:false, enfants:{}, liens:[], unsubs:[], feuille:null, rendu:false,
  annonces:[], reacs:{}, lu:null, luAvant:null, disc:null, discs:{}, msgVue:"annonces", lignes:{}};
var IND_COULEUR="#0E7C7B";
var IND_HORIZON=28;   // jours de séances affichés à l'avance
var IND_PASSE=14;     // jours d'historique chargés
var IND_ANNONCES_JOURS=90; // annonces gardées à l'écran
var IND_JOURS=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
var IND_JOURS_C=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
var IND_MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
var IND_MOIS_C=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
var IND_ICONES={
  accueil:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  seances:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 7M21 20c0-2.5-1.5-4.6-3.6-5.5"/></svg>',
  reserver:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v4M10 15h4"/></svg>',
  messages:'<svg viewBox="0 0 24 24"><path d="M4 5h16v11H9l-5 4z"/></svg>'
};

// ── Petits outils ────────────────────────────────────────────────────
function indEsc(v){ return v===0?"0":authEsc(v==null?"":String(v)); }
function indIso(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function indDate(iso){ var p=String(iso||"").split("-"); return new Date(+p[0],(+p[1]||1)-1,+p[2]||1); }
function indAuj(){ return indIso(new Date()); }
function indAjout(iso,n){ var d=indDate(iso); d.setDate(d.getDate()+n); return indIso(d); }
function indDateTxt(iso){ var d=indDate(iso); return IND_JOURS_C[d.getDay()]+" "+d.getDate()+" "+IND_MOIS_C[d.getMonth()]; }
function indDateLong(iso){ var d=indDate(iso); return IND_JOURS[d.getDay()]+" "+d.getDate()+" "+IND_MOIS[d.getMonth()]; }
function indQuand(iso){ var a=indAuj(); if(iso===a) return "Aujourd'hui"; if(iso===indAjout(a,1)) return "Demain"; return indDateTxt(iso); }
function indMaintenant(){ var d=new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function indAge(naissance){
  if(!naissance) return null; var n=indDate(naissance), d=new Date();
  var a=d.getFullYear()-n.getFullYear(); if(d.getMonth()<n.getMonth()||(d.getMonth()===n.getMonth()&&d.getDate()<n.getDate())) a--;
  return (a>=0&&a<120)?a:null;
}
function indInitiales(prenom,nom){ return ((prenom||"").charAt(0)+(nom||"").charAt(0))||"?"; }
function indPrix(p){ var n=Number(p); if(!n) return ""; return (Math.round(n*100)/100).toString().replace(".",",")+" €"; }
function indCouleur(){ var c=(IND.club&&IND.club.couleur)||""; return /^#[0-9a-fA-F]{6}$/.test(c)?c:IND_COULEUR; }
function indId(prefixe){ return prefixe+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function indLienUrl(code){ return location.origin+location.pathname+"?rejoindre="+encodeURIComponent(code); }
function indDb(){ return window.fbDb; }
function indErr(e){ console.log("indépendant:",e&&e.code||e); askAlert("Enregistrement impossible : vérifiez la connexion et réessayez."); }

// ── Routage : appelé par finishAuthedUser (js/18-auth.js) avant le routage du club ──
// Retourne true quand l'appli Indépendant prend la main (ou va la prendre).
function indRoute(u, isUpdate, suite){
  if(window.SUPPORT_MODE || (typeof isSuperAdmin==="function" && isSuperAdmin())) return false;
  if(IND.role) return true; // déjà ouverte : une mise à jour du compte ne la redessine pas
  var roles=u.roles||[], cle="gm_type_"+u.clubId, t=null;
  try{ t=localStorage.getItem(cle); }catch(e){}
  if(roles.indexOf("client")>=0){ indDemarrer("client",u); return true; }
  if(t==="independant"){ indDemarrer("coach",u); return true; }
  if(t==="club") return false;
  if(IND.attente) return true;
  IND.attente=true;
  // Première ouverture sur cet appareil : on lit la fiche pour savoir quelle appli ouvrir.
  window.fbGetDoc(window.fbDoc(indDb(),"clubs",u.clubId)).then(function(s){
    var ty=(s&&s.exists()&&s.data().type)||"club";
    try{ localStorage.setItem(cle,ty); }catch(e){}
    IND.attente=false;
    if(ty==="independant") indDemarrer("coach",u); else suite();
  }).catch(function(){ IND.attente=false; suite(); });
  return true;
}

function indDemarrer(role,u){
  IND.role=role; IND.uid=(u&&u.uid)||(window.ASMB_USER&&window.ASMB_USER.uid); IND.clubId=window.CURRENT_CLUB_ID||(u&&u.clubId);
  IND.tab="accueil";
  try{ localStorage.setItem("asmb_profile",role==="client"?"client":"dirigeant"); }catch(e){}
  stack=["indep"];
  showScr("indep");
  var root=document.getElementById("indep-root");
  if(root && !root.__indLie){ root.__indLie=true; root.addEventListener("click",indClic); }
  indRendre();
  indEcouter();
}

function indStop(){ IND.unsubs.forEach(function(f){ try{ f(); }catch(e){} }); IND.unsubs=[]; }

function indEcouter(){
  indStop();
  var db=indDb(), debut=indAjout(indAuj(),-IND_PASSE);
  function ecoute(ref,fn){ IND.unsubs.push(window.fbOnSnapshot(ref,fn,function(e){ console.log("indépendant (écoute):",e&&e.code); })); }
  ecoute(window.fbDoc(db,"clubs",IND.clubId),function(s){ IND.club=s.exists()?s.data():{}; indRendre(); });
  ecoute(window.fbCollection(db,"indep_creneaux"),function(sn){
    var l=[]; sn.forEach(function(d){ l.push(Object.assign({id:d.id},d.data())); }); IND.creneaux=l; indRendre();
  });
  ecoute(window.fbQuery(window.fbCollection(db,"indep_seances"),window.fbWhere("date",">=",debut)),function(sn){
    var m={}; sn.forEach(function(d){ m[d.id]=Object.assign({id:d.id},d.data()); }); IND.seances=m; indRendre();
  });
  ecoute(window.fbQuery(window.fbCollection(db,"indep_resas"),window.fbWhere("date",">=",debut)),function(sn){
    var m={}; sn.forEach(function(d){ m[d.id]=d.data(); }); IND.resas=m; indRendre();
  });
  ecoute(window.fbQuery(window.fbCollection(db,"indep_annonces"),window.fbWhere("createdAt",">=",new Date(Date.now()-IND_ANNONCES_JOURS*86400000))),function(sn){
    var l=[]; sn.forEach(function(d){ l.push(Object.assign({id:d.id},d.data({serverTimestamps:"estimate"}))); }); IND.annonces=l; indRendre();
  });
  ecoute(IND.role==="coach"?window.fbCollection(db,"indep_reactions"):window.fbQuery(window.fbCollection(db,"indep_reactions"),window.fbWhere("owner","==",IND.uid)),function(sn){
    var m={}; sn.forEach(function(d){ m[d.id]=d.data(); }); IND.reacs=m; indRendre();
  });
  if(typeof indArgentEcouter==="function") indArgentEcouter(ecoute,db);
  if(IND.role==="coach"){
    ecoute(window.fbCollection(db,"indep_discussions"),function(sn){
      var m={}; sn.forEach(function(d){ m[d.id]=d.data({serverTimestamps:"estimate"}); }); IND.discs=m; indRendre();
    });
    ecoute(window.fbCollection(db,"indep_clients"),function(sn){
      var m={}; sn.forEach(function(d){ m[d.id]=Object.assign({uid:d.id},d.data()); }); IND.clients=m; IND.clientsCharges=true; indRendre();
    });
    ecoute(window.fbQuery(window.fbCollection(db,"indep_liens"),window.fbWhere("clubId","==",IND.clubId)),function(sn){
      var l=[]; sn.forEach(function(d){ l.push(Object.assign({code:d.id},d.data())); }); IND.liens=l; indRendre();
    });
  } else {
    ecoute(window.fbDoc(db,"indep_discussions",IND.uid),function(s){ IND.disc=s.exists()?s.data({serverTimestamps:"estimate"}):null; indRendre(); });
    ecoute(window.fbDoc(db,"indep_clients",IND.uid),function(s){
      IND.fiche=s.exists()?s.data():null; IND.ficheChargee=true; indRendre();
    });
    ecoute(window.fbQuery(window.fbCollection(db,"indep_clients"),window.fbWhere("parentUid","==",IND.uid)),function(sn){
      var m={}; sn.forEach(function(d){ m[d.id]=Object.assign({id:d.id},d.data()); }); IND.enfants=m; indRendre();
    });
  }
}

// ── Séances : créneaux hebdomadaires + exceptions + ponctuelles ─────
function indSeances(de,a){
  var out=[], vues={};
  IND.creneaux.forEach(function(c){
    if(c.actif===false) return;
    for(var iso=de; iso<=a; iso=indAjout(iso,1)){
      if(indDate(iso).getDay()!==Number(c.jour)) continue;
      if(c.debut && iso<c.debut) continue;
      var id=c.id+"_"+iso, ex=IND.seances[id]||{};
      vues[id]=1;
      out.push({id:id, creneauId:c.id, date:iso, titre:c.titre||"Séance", heure:c.heure||"", duree:c.duree||0, lieu:c.lieu||"",
        places:Number(c.places)||0, prix:c.prix||0, ouvert:!!c.ouvert, habitues:c.habitues||[], annulee:!!ex.annulee, motif:ex.motif||""});
    }
  });
  Object.keys(IND.seances).forEach(function(id){
    var s=IND.seances[id];
    if(vues[id] || s.creneauId || !s.date || s.date<de || s.date>a) return;
    out.push({id:id, creneauId:null, date:s.date, titre:s.titre||"Séance", heure:s.heure||"", duree:s.duree||0, lieu:s.lieu||"",
      places:Number(s.places)||0, prix:s.prix||0, ouvert:s.ouvert!==false, habitues:[], annulee:!!s.annulee, motif:s.motif||"", ponctuelle:true});
  });
  out.sort(function(x,y){ return (x.date+x.heure).localeCompare(y.date+y.heure); });
  return out;
}
function indSeanceParId(id){
  var l=indSeances(indAjout(indAuj(),-IND_PASSE),indAjout(indAuj(),IND_HORIZON+7));
  for(var i=0;i<l.length;i++) if(l[i].id===id) return l[i];
  return null;
}
// Personnes attendues : habitués (sauf « absent ») + réservations « vient ».
function indInscrits(s){
  var l=[], vus={};
  (s.habitues||[]).forEach(function(uid){
    var r=IND.resas[s.id+"__"+uid]||{};
    l.push({uid:uid, habitue:true, statut:r.statut||"vient", present:r.present, nom:r.nom||""}); vus[uid]=1;
  });
  Object.keys(IND.resas).forEach(function(k){
    var r=IND.resas[k];
    if(r.seance!==s.id || vus[r.uid]) return;
    if(r.statut!=="vient" && r.present!==true) return;
    l.push({uid:r.uid, habitue:false, statut:r.statut, present:r.present, nom:r.nom||""}); vus[r.uid]=1;
  });
  return l;
}
function indNbVenants(s){ return indInscrits(s).filter(function(x){ return x.statut==="vient"; }).length; }
function indComplet(s){ return s.places>0 && indNbVenants(s)>=s.places; }
function indCommencee(s){ var a=indAuj(); return s.date<a || (s.date===a && s.heure && s.heure<=indMaintenant()); }
function indNom(uid,secours){
  var c=IND.clients[uid];
  if(c&&c.prenom) return c.prenom+(c.nom?" "+c.nom.charAt(0)+".":"");
  return secours||"Client";
}
function indMonNom(){ var f=IND.fiche||{}; return ((f.prenom||"")+(f.nom?" "+f.nom.charAt(0)+".":"")).trim().slice(0,60); }
// Participants de l'indépendant : adultes + enfants mineurs. Un parent qui n'inscrit que
// ses enfants (parentSeul) n'est pas un participant : il apparaît sous la fiche de l'enfant.
function indClientsActifs(){
  return Object.keys(IND.clients).map(function(k){ return IND.clients[k]; }).filter(function(c){ return c.actif!==false && !c.parentSeul; })
    .sort(function(a,b){ return ((a.prenom||"")+(a.nom||"")).localeCompare((b.prenom||"")+(b.nom||"")); });
}
function indEstMineur(c){ return !!(c && c.mineur); }
function indParentDe(c){ return (c && c.parentUid && IND.clients[c.parentUid]) || null; }
function indEnfantsDe(uid){
  return Object.keys(IND.clients).map(function(k){ return IND.clients[k]; }).filter(function(c){ return c.parentUid===uid && c.actif!==false; });
}
// Côté client (parent) : les personnes pour qui il réserve = lui (sauf compte « parent seul ») + ses enfants.
function indPersonnes(){
  var l=[], f=IND.fiche;
  if(f && !f.parentSeul) l.push({id:IND.uid, prenom:f.prenom||"Moi", nom:f.nom||"", moi:true});
  Object.keys(IND.enfants).map(function(k){ return IND.enfants[k]; })
    .filter(function(e){ return e.actif!==false; })
    .sort(function(a,b){ return (a.prenom||"").localeCompare(b.prenom||""); })
    .forEach(function(e){ l.push({id:e.id, prenom:e.prenom||"Enfant", nom:e.nom||"", enfant:true}); });
  return l;
}
function indPersonne(pid){
  var l=indPersonnes();
  for(var i=0;i<l.length;i++) if(l[i].id===pid) return l[i];
  return null;
}
function indNomPersonne(pid){
  var p=indPersonne(pid); if(!p) return indMonNom()||"Client";
  return (p.prenom+(p.nom?" "+p.nom.charAt(0)+".":"")).trim().slice(0,60);
}

// ── Rendu ────────────────────────────────────────────────────────────
var __indRaf=null;
function indRendre(){
  if(__indRaf) return;
  __indRaf=requestAnimationFrame(function(){ __indRaf=null; indPeindre(); });
}
function indPeindre(){
  var root=document.getElementById("indep-root"); if(!root||!IND.role) return;
  var coach=IND.role==="coach", h="", tabs;
  var nom=(IND.club&&IND.club.name)||"Mon activité";
  if(coach){
    tabs=[["accueil","Accueil"],["seances","Séances"],["clients","Clients"],["messages","Messages"],["argent","Argent"]];
    var sur={accueil:indDateLong(indAuj()), seances:"Séances", clients:"Mes clients", messages:"Annonces", argent:"Paiements et pass"}[IND.tab]||"";
    h+=indTop(sur, nom, '<button type="button" data-act="reglages" aria-label="Réglages de mon activité">⚙</button>');
    h+='<div class="ind-body">'+(IND.tab==="seances"?indVueSeances():IND.tab==="clients"?indVueClients():IND.tab==="messages"?indVueMessages():IND.tab==="argent"?indArgentVue():indVueAccueil())+'</div>';
  } else {
    tabs=[["accueil","Accueil"],["reserver","Réserver"],["messages","Messages"]];
    var f=IND.fiche||{};
    if(IND.tab==="messages"){ if(IND.luAvant==null) IND.luAvant=indLuLire(); indMarquerLu(); }
    h+=indTop(nom, IND.tab==="reserver"?"Réserver":IND.tab==="messages"?"Messages":"Bonjour"+(f.prenom?" "+f.prenom:""),
      '<button type="button" data-act="ma-fiche" aria-label="Ma fiche">'+indEsc(indInitiales(f.prenom,f.nom))+'</button>');
    if(IND.ficheChargee && !IND.fiche){ h+='<div class="ind-body">'+indVueFicheManquante()+'</div>'; tabs=null; }
    else h+='<div class="ind-body">'+(IND.tab==="reserver"?indVueReserver():IND.tab==="messages"?indVueMessagesClient():indVueAccueilClient()+indArgentClientBloc())+'</div>';
  }
  if(tabs){
    var nbLus=coach?indNbDiscNonLues():indNbNonLus()+(indDiscNonLueClient()?1:0);
    h+='<nav class="ind-nav" style="grid-template-columns:repeat('+tabs.length+',1fr)">'+tabs.map(function(t){
      var bdg=(t[0]==="messages"&&nbLus>0)?'<i class="bdg" aria-label="'+nbLus+' non lu'+(nbLus>1?"s":"")+'">'+nbLus+'</i>':'';
      return '<button type="button" data-act="tab" data-v="'+t[0]+'" class="'+(IND.tab===t[0]?"on":"")+'"'+(IND.tab===t[0]?' aria-current="page"':'')+'>'+IND_ICONES[t[0]]+t[1]+bdg+'</button>';
    }).join("")+'</nav>';
  }
  root.innerHTML='<div class="ind" style="--ia:'+indCouleur()+'">'+h+'</div>';
  if(coach && IND.tab==="clients") indDessinerQr();
  if(IND.feuille && IND.feuille.peindre){
    if(document.body.contains(IND.feuille.s.modal)) IND.feuille.peindre(); else IND.feuille=null;
  }
}
function indTop(sur, titre, bouton){
  return '<header class="ind-top"><div class="ind-tt"><small>'+indEsc(sur)+'</small><b>'+indEsc(titre)+'</b></div>'+(bouton||'')+'</header>';
}
function indCarteSeance(s, opts){
  opts=opts||{};
  var n=indNbVenants(s), pl=s.places, pill;
  if(s.annulee) pill='<span class="ind-pill no">Annulée</span>';
  else if(pl) pill='<span class="ind-pill '+(n>=pl?"w":"a")+'">'+n+' / '+pl+'</span>';
  else pill='<span class="ind-pill a">'+n+' inscrit'+(n>1?"s":"")+'</span>';
  var sous=[s.lieu, s.ponctuelle?"Séance ponctuelle":(s.ouvert?"Habitués + inscriptions":"Habitués")].filter(Boolean).join(" · ");
  var barre=(pl&&!s.annulee)?'<div class="ind-bar"><i style="width:'+Math.min(100,Math.round(n*100/pl))+'%"></i></div>':'';
  return '<div class="ind-c tap" data-act="seance" data-id="'+indEsc(s.id)+'" role="button" tabindex="0"><div class="ind-row"><div class="t"><strong>'
    +indEsc((opts.jour?indQuand(s.date)+" · ":"")+(s.heure||"")+" · "+s.titre)+'</strong><span>'+indEsc(sous)+'</span></div>'+pill+'</div>'+barre+'</div>';
}

// ── Indépendant : Accueil ───────────────────────────────────────────
function indVueAccueil(){
  var a=indAuj(), auj=indSeances(a,a), semaine=indSeances(indAjout(a,1),indAjout(a,7));
  var clients=indClientsActifs(), h="";
  if(!IND.creneaux.length && !Object.keys(IND.seances).length){
    h+='<div class="ind-c"><div class="ind-row"><div class="t"><strong>Bienvenue dans ton appli</strong><span>Deux étapes pour remplacer ton groupe WhatsApp :</span></div></div>'
      +'<div class="ind-list" style="margin-top:8px">'
      +'<div class="ind-row"><div class="ind-av">1</div><div class="t"><strong>Crée tes créneaux</strong><span>Tes séances de chaque semaine (jour, heure, lieu, places).</span></div></div>'
      +'<div class="ind-row"><div class="ind-av">2</div><div class="t"><strong>Invite tes clients</strong><span>Un lien ou un QR code : ils créent leur accès en 1 minute.</span></div></div>'
      +'</div><div class="ind-btns" style="margin-top:12px"><button type="button" class="ind-btn p" data-act="creneau">+ Créneau</button><button type="button" class="ind-btn s" data-act="tab" data-v="clients">Inviter</button></div></div>';
  }
  h+='<div class="ind-k">Aujourd\'hui</div>';
  h+=auj.length?auj.map(function(s){ return indCarteSeance(s); }).join(""):'<div class="ind-c ind-vide">Pas de séance aujourd\'hui.</div>';
  var nbSem=semaine.filter(function(s){ return !s.annulee; }).length;
  h+='<div class="ind-stats"><div class="ind-c tap" data-act="tab" data-v="clients" role="button" tabindex="0"><div class="ind-big">'+clients.length+'</div><span>client'+(clients.length>1?"s":"")+'</span></div>'
    +'<div class="ind-c tap" data-act="tab" data-v="seances" role="button" tabindex="0"><div class="ind-big">'+nbSem+'</div><span>séance'+(nbSem>1?"s":"")+' les 7 prochains jours</span></div></div>';
  if(semaine.length){
    h+='<div class="ind-k">À venir</div>'+semaine.slice(0,6).map(function(s){ return indCarteSeance(s,{jour:true}); }).join("");
  }
  h+='<div class="ind-btns"><button type="button" class="ind-btn p" data-act="creneau">+ Créneau hebdo</button><button type="button" class="ind-btn s" data-act="ponctuelle">+ Séance ponctuelle</button></div>';
  return h;
}

// ── Indépendant : Séances ───────────────────────────────────────────
function indVueSeances(){
  var h='<div class="ind-k">Mes créneaux de la semaine</div>';
  var cr=IND.creneaux.filter(function(c){ return c.actif!==false; })
    .sort(function(x,y){ return (((Number(x.jour)+6)%7)+(x.heure||"")).localeCompare(((Number(y.jour)+6)%7)+(y.heure||"")); });
  if(!cr.length) h+='<div class="ind-c ind-vide">Aucun créneau. Un créneau revient chaque semaine : tes habitués y sont inscrits d\'office.</div>';
  else h+='<div class="ind-c ind-list">'+cr.map(function(c){
    var nb=(c.habitues||[]).length;
    return '<div class="ind-row tap" data-act="creneau" data-id="'+indEsc(c.id)+'" role="button" tabindex="0" style="cursor:pointer"><div class="t"><strong>'
      +indEsc(IND_JOURS[Number(c.jour)]+" "+(c.heure||"")+" · "+(c.titre||"Séance"))+'</strong><span>'
      +indEsc([c.lieu, (c.places?c.places+" places":"places illimitées"), nb+" habitué"+(nb>1?"s":""), indPrix(c.prix)].filter(Boolean).join(" · "))+'</span></div>'
      +(c.ouvert?'<span class="ind-pill ok">Ouvert</span>':'')+'</div>';
  }).join("")+'</div>';
  h+='<div class="ind-btns"><button type="button" class="ind-btn p" data-act="creneau">+ Créneau hebdo</button><button type="button" class="ind-btn s" data-act="ponctuelle">+ Séance ponctuelle</button></div>';
  var a=indAuj(), l=indSeances(a,indAjout(a,IND_HORIZON)), jour="";
  h+='<div class="ind-k">Prochaines séances</div>';
  if(!l.length) h+='<div class="ind-c ind-vide">Rien de prévu sur les 4 prochaines semaines.</div>';
  l.forEach(function(s){
    if(s.date!==jour){ jour=s.date; h+='<div class="ind-k" style="margin-top:2px;text-transform:none;letter-spacing:0;font-size:12.5px">'+indEsc(indQuand(s.date)===indDateTxt(s.date)?indDateLong(s.date):indQuand(s.date)+" · "+indDateLong(s.date))+'</div>'; }
    h+=indCarteSeance(s);
  });
  var passees=indSeances(indAjout(a,-IND_PASSE),indAjout(a,-1)).reverse();
  if(passees.length){
    h+='<div class="ind-k">Dernières séances</div>'+passees.slice(0,6).map(function(s){ return indCarteSeance(s,{jour:true}); }).join("");
  }
  return h;
}

// Détail d'une séance (fenêtre du bas, mise à jour en direct)
function indOuvrirSeance(id){
  var s0=indSeanceParId(id); if(!s0) return;
  var sh=gmSheet(indQuand(s0.date)+" · "+(s0.heure||"")+" · "+s0.titre);
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.addEventListener("click",indClic);
  IND.feuille={s:sh, peindre:function(){
    var s=indSeanceParId(id); if(!s){ sh.modal.remove(); return; }
    sh.body.innerHTML=IND.role==="coach"?indSeanceCoach(s):indSeanceClient(s);
  }};
  IND.feuille.peindre();
}
function indSeanceCoach(s){
  var ins=indInscrits(s), n=indNbVenants(s), passe=s.date<=indAuj(), h="";
  h+='<div class="ind-c"><div class="ind-row"><div class="t"><strong>'+indEsc(indDateLong(s.date)+" · "+(s.heure||"")+(s.duree?" · "+s.duree+" min":""))+'</strong><span>'
    +indEsc([s.lieu, indPrix(s.prix)?indPrix(s.prix)+" la séance":"", s.ponctuelle?"Séance ponctuelle":""].filter(Boolean).join(" · "))+'</span></div>'
    +(s.annulee?'<span class="ind-pill no">Annulée</span>':'<span class="ind-pill a">'+n+(s.places?' / '+s.places:'')+'</span>')+'</div>'
    +(s.annulee&&s.motif?'<p class="ind-note" style="margin-top:8px">Motif : '+indEsc(s.motif)+'</p>':'')+'</div>';
  var hab=ins.filter(function(x){ return x.habitue; }), aut=ins.filter(function(x){ return !x.habitue; });
  function ligne(x){
    var droite;
    var pil=(typeof indArgentPill==="function"&&passe&&x.present===true)?indArgentPill(s.id,x.uid):"";
    if(passe && !s.annulee) droite=pil+'<button type="button" class="ind-chk'+(x.present===true?" on":"")+'" data-act="presence" data-id="'+indEsc(s.id)+'" data-uid="'+indEsc(x.uid)+'" aria-pressed="'+(x.present===true)+'" aria-label="Présent : '+indEsc(indNom(x.uid,x.nom))+'">✓</button>';
    else droite=x.statut==="vient"?'<span class="ind-pill ok">Vient</span>':'<span class="ind-pill no">Absent</span>';
    var c=IND.clients[x.uid]||{};
    return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(c.prenom||x.nom,c.nom))+'</div><div class="t"><strong>'+indEsc(indNom(x.uid,x.nom))+'</strong><span>'
      +(x.statut==="absent"?"A prévenu de son absence":(x.habitue?"Habitué":"Inscrit à cette séance"))+(indEstMineur(c)?" · Mineur":"")+'</span></div>'+droite+'</div>';
  }
  h+='<div class="ind-k">'+(passe?"Présences · habitués":"Habitués")+'</div>';
  h+=hab.length?'<div class="ind-c ind-list">'+hab.map(ligne).join("")+'</div>':'<div class="ind-c ind-vide">Aucun habitué sur ce créneau.</div>';
  h+='<div class="ind-k">Inscrits à cette séance</div>';
  h+=aut.length?'<div class="ind-c ind-list">'+aut.map(ligne).join("")+'</div>':'<div class="ind-c ind-vide">'+(s.ouvert?"Personne pour l'instant. Tes clients réservent depuis leur appli.":"Ce créneau n'est pas ouvert aux inscriptions.")+'</div>';
  h+='<div class="ind-btns" style="margin-top:4px">';
  if(!s.annulee) h+='<button type="button" class="ind-btn s" data-act="ajout-seance" data-id="'+indEsc(s.id)+'">+ Ajouter un client</button>'
    +'<button type="button" class="ind-btn s" data-act="annoncer-seance" data-id="'+indEsc(s.id)+'">Annoncer cette séance</button>'
    +'<button type="button" class="ind-btn d" data-act="annuler-seance" data-id="'+indEsc(s.id)+'" style="grid-column:1/-1">Annuler la séance</button>';
  else h+='<button type="button" class="ind-btn s" data-act="retablir-seance" data-id="'+indEsc(s.id)+'">Rétablir la séance</button>'
    +(s.ponctuelle?'<button type="button" class="ind-btn d" data-act="suppr-seance" data-id="'+indEsc(s.id)+'">Supprimer</button>':'<span></span>');
  h+='</div>';
  if(!s.annulee) h+='<p class="ind-note" style="margin-top:8px">Annuler : la séance passe en « Annulée » dans l\'appli de tes clients, avec ton motif.</p>';
  return h;
}

function indPresence(sid,uid){
  var s=indSeanceParId(sid); if(!s) return;
  var k=sid+"__"+uid, r=IND.resas[k]||{}, val=!(r.present===true);
  var d={seance:sid, date:s.date, uid:uid, statut:r.statut||"vient", present:val, nom:indNom(uid,r.nom)};
  IND.resas[k]=Object.assign({},r,d); indRendre();
  window.fbSetDoc(window.fbDoc(indDb(),"indep_resas",k),d,{merge:true}).catch(indErr);
  if(typeof indArgentPresence==="function") indArgentPresence(s,uid,val);
}
function indAnnulerSeance(sid){
  var s=indSeanceParId(sid); if(!s) return;
  askPrompt("Motif de l'annulation (facultatif)",{placeholder:"Ex. : pluie, gymnase fermé",confirmText:"Annuler la séance"}).then(function(m){
    if(m===null) return;
    var d={date:s.date, annulee:true, motif:String(m||"").trim().slice(0,120)};
    if(s.creneauId) d.creneauId=s.creneauId;
    window.fbSetDoc(window.fbDoc(indDb(),"indep_seances",sid),d,{merge:true}).then(function(){
      showToast("Séance annulée"); indProposerAnnonceAnnulation(s,d.motif);
    }).catch(indErr);
  });
}
function indProposerAnnonceAnnulation(s,motif){
  askConfirm("Veux-tu prévenir tes clients par une annonce ?",{title:"Séance annulée",confirmText:"Écrire l'annonce",cancelText:"Plus tard"}).then(function(ok){
    if(!ok) return;
    indAnnonceForm({texte:"Séance du "+indDateLong(s.date)+(s.heure?" à "+s.heure:"")+" annulée"+(motif?" ("+motif+")":"")+".", cible:s.creneauId||"tous", seance:s.id});
  });
}
function indRetablirSeance(sid){
  window.fbSetDoc(window.fbDoc(indDb(),"indep_seances",sid),{annulee:false, motif:""},{merge:true}).then(function(){ showToast("Séance rétablie"); }).catch(indErr);
}
function indSupprSeance(sid){
  askConfirm("Supprimer définitivement cette séance ponctuelle ?",{title:"Supprimer",confirmText:"Supprimer",danger:true}).then(function(ok){
    if(!ok) return;
    window.fbDeleteDoc(window.fbDoc(indDb(),"indep_seances",sid)).then(function(){ if(IND.feuille) IND.feuille.s.modal.remove(); showToast("Séance supprimée"); }).catch(indErr);
  });
}
function indAjoutSeance(sid){
  var s=indSeanceParId(sid); if(!s) return;
  var deja={}; indInscrits(s).forEach(function(x){ if(x.statut==="vient") deja[x.uid]=1; });
  var l=indClientsActifs().filter(function(c){ return !deja[c.uid]; });
  var sh=gmSheet("Ajouter à la séance");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  if(!l.length){ sh.body.innerHTML='<div class="ind-c ind-vide">Tous tes clients sont déjà inscrits, ou tu n\'as pas encore de client.</div>'; return; }
  sh.body.innerHTML='<div class="ind-c ind-list">'+l.map(function(c){
    return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(c.prenom,c.nom))+'</div><div class="t"><strong>'+indEsc((c.prenom||"")+" "+(c.nom||""))+'</strong>'+(c.mineur?'<span>Mineur</span>':'')+'</div>'
      +'<button type="button" class="ind-btn p mini" data-uid="'+indEsc(c.uid)+'">Ajouter</button></div>';
  }).join("")+'</div>';
  sh.body.addEventListener("click",function(e){
    var b=e.target.closest("button[data-uid]"); if(!b) return;
    var uid=b.dataset.uid, k=sid+"__"+uid;
    b.disabled=true;
    window.fbSetDoc(window.fbDoc(indDb(),"indep_resas",k),{seance:sid, date:s.date, uid:uid, statut:"vient", nom:indNom(uid)},{merge:true})
      .then(function(){ b.textContent="Ajouté"; }).catch(function(e2){ b.disabled=false; indErr(e2); });
  });
}

// Créneau hebdomadaire (création / modification)
function indCreneauForm(id){
  var c=id?(IND.creneaux.filter(function(x){ return x.id===id; })[0]||{}):{jour:new Date().getDay(), heure:"18:30", duree:60, places:12, ouvert:true, habitues:[]};
  var sh=gmSheet(id?"Modifier le créneau":"Nouveau créneau hebdo");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var clients=indClientsActifs(), hab={}; (c.habitues||[]).forEach(function(u){ hab[u]=1; });
  sh.body.innerHTML='<form class="ind-f" id="ind-cr-f" novalidate>'
    +'<label>Nom de la séance<input id="ind-cr-titre" maxlength="60" required value="'+indEsc(c.titre||"")+'" placeholder="Ex. : Cross-training"></label>'
    +'<div class="deux"><label>Jour<select id="ind-cr-jour">'+[1,2,3,4,5,6,0].map(function(j){ return '<option value="'+j+'"'+(Number(c.jour)===j?" selected":"")+'>'+IND_JOURS[j]+'</option>'; }).join("")+'</select></label>'
    +'<label>Heure<input id="ind-cr-heure" type="time" value="'+indEsc(c.heure||"18:30")+'"></label></div>'
    +'<div class="deux"><label>Durée (min)<input id="ind-cr-duree" type="number" inputmode="numeric" min="0" max="600" value="'+indEsc(c.duree||"")+'"></label>'
    +'<label>Places (vide = illimité)<input id="ind-cr-places" type="number" inputmode="numeric" min="0" max="500" value="'+indEsc(c.places||"")+'"></label></div>'
    +'<div class="deux"><label>Lieu<input id="ind-cr-lieu" maxlength="80" value="'+indEsc(c.lieu||"")+'" placeholder="Ex. : Parc de l\'Europe"></label>'
    +'<label>Prix de la séance (€)<input id="ind-cr-prix" type="number" inputmode="decimal" min="0" step="0.5" value="'+indEsc(c.prix||"")+'"></label></div>'
    +'<label class="case"><input type="checkbox" id="ind-cr-ouvert"'+(c.ouvert?" checked":"")+'>Ouvert aux inscriptions à la séance (en plus des habitués)</label>'
    +'<div style="font-size:12px;font-weight:800;color:var(--txt2);margin-top:4px">Habitués (inscrits d\'office chaque semaine)</div>'
    +(clients.length?clients.map(function(x){ return '<label class="case"><input type="checkbox" class="ind-cr-hab" value="'+indEsc(x.uid)+'"'+(hab[x.uid]?" checked":"")+'>'+indEsc((x.prenom||"")+" "+(x.nom||"")+(x.mineur?" (mineur)":""))+'</label>'; }).join("")
      :'<p class="ind-note">Invite d\'abord tes clients (onglet Clients) : tu pourras ensuite les cocher ici.</p>')
    +'<div class="err" id="ind-cr-err"></div>'
    +'<div class="actions">'+(id?'<button type="button" class="rouge" id="ind-cr-stop">Arrêter ce créneau</button>':'<button type="button" class="non" id="ind-cr-annul">Annuler</button>')
    +'<button type="submit" class="ok">Enregistrer</button></div></form>';
  var f=sh.body.querySelector("#ind-cr-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var titre=f.querySelector("#ind-cr-titre").value.trim(), heure=f.querySelector("#ind-cr-heure").value;
    if(!titre){ f.querySelector("#ind-cr-err").textContent="Donne un nom à la séance."; return; }
    if(!/^\d{2}:\d{2}$/.test(heure)){ f.querySelector("#ind-cr-err").textContent="Indique l'heure de début."; return; }
    var d={titre:titre.slice(0,60), jour:Number(f.querySelector("#ind-cr-jour").value), heure:heure,
      duree:Math.max(0,Math.min(600,parseInt(f.querySelector("#ind-cr-duree").value,10)||0)),
      places:Math.max(0,Math.min(500,parseInt(f.querySelector("#ind-cr-places").value,10)||0)),
      lieu:f.querySelector("#ind-cr-lieu").value.trim().slice(0,80),
      prix:Math.max(0,Math.round((parseFloat(String(f.querySelector("#ind-cr-prix").value).replace(",","."))||0)*100)/100),
      ouvert:f.querySelector("#ind-cr-ouvert").checked,
      habitues:[].slice.call(f.querySelectorAll(".ind-cr-hab:checked")).map(function(x){ return x.value; }),
      actif:true, majLe:Date.now()};
    if(!id) d.debut=indAuj();
    var cid=id||indId("c");
    window.fbSetDoc(window.fbDoc(indDb(),"indep_creneaux",cid),d,{merge:true}).then(function(){ sh.modal.remove(); showToast(id?"Créneau modifié":"Créneau créé"); }).catch(indErr);
  });
  var an=sh.body.querySelector("#ind-cr-annul"); if(an) an.addEventListener("click",function(){ sh.modal.remove(); });
  var st=sh.body.querySelector("#ind-cr-stop");
  if(st) st.addEventListener("click",function(){
    askConfirm("Les prochaines séances de ce créneau disparaissent. Tes clients ne pourront plus s'y inscrire.",{title:"Arrêter ce créneau ?",confirmText:"Arrêter",danger:true}).then(function(ok){
      if(!ok) return;
      window.fbUpdateDoc(window.fbDoc(indDb(),"indep_creneaux",id),{actif:false, majLe:Date.now()}).then(function(){ sh.modal.remove(); showToast("Créneau arrêté"); }).catch(indErr);
    });
  });
}

// Séance ponctuelle (une seule date, ouverte aux inscriptions)
function indPonctuelleForm(){
  var sh=gmSheet("Nouvelle séance ponctuelle");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.innerHTML='<form class="ind-f" id="ind-pc-f" novalidate>'
    +'<label>Nom de la séance<input id="ind-pc-titre" maxlength="60" placeholder="Ex. : Running du dimanche"></label>'
    +'<div class="deux"><label>Date<input id="ind-pc-date" type="date" min="'+indAuj()+'" value="'+indAjout(indAuj(),1)+'"></label>'
    +'<label>Heure<input id="ind-pc-heure" type="time" value="10:00"></label></div>'
    +'<div class="deux"><label>Durée (min)<input id="ind-pc-duree" type="number" inputmode="numeric" min="0" max="600" value="60"></label>'
    +'<label>Places (vide = illimité)<input id="ind-pc-places" type="number" inputmode="numeric" min="0" max="500" value="12"></label></div>'
    +'<div class="deux"><label>Lieu<input id="ind-pc-lieu" maxlength="80"></label>'
    +'<label>Prix (€)<input id="ind-pc-prix" type="number" inputmode="decimal" min="0" step="0.5"></label></div>'
    +'<p class="ind-note">Tes clients la voient dans « Réserver » et s\'y inscrivent jusqu\'au début.</p>'
    +'<div class="err" id="ind-pc-err"></div>'
    +'<div class="actions"><button type="button" class="non" id="ind-pc-annul">Annuler</button><button type="submit" class="ok">Créer</button></div></form>';
  var f=sh.body.querySelector("#ind-pc-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var titre=f.querySelector("#ind-pc-titre").value.trim(), date=f.querySelector("#ind-pc-date").value, heure=f.querySelector("#ind-pc-heure").value;
    var err=f.querySelector("#ind-pc-err");
    if(!titre){ err.textContent="Donne un nom à la séance."; return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<indAuj()){ err.textContent="Choisis une date à venir."; return; }
    if(!/^\d{2}:\d{2}$/.test(heure)){ err.textContent="Indique l'heure de début."; return; }
    var d={creneauId:null, date:date, heure:heure, titre:titre.slice(0,60),
      duree:Math.max(0,Math.min(600,parseInt(f.querySelector("#ind-pc-duree").value,10)||0)),
      places:Math.max(0,Math.min(500,parseInt(f.querySelector("#ind-pc-places").value,10)||0)),
      lieu:f.querySelector("#ind-pc-lieu").value.trim().slice(0,80),
      prix:Math.max(0,Math.round((parseFloat(String(f.querySelector("#ind-pc-prix").value).replace(",","."))||0)*100)/100),
      ouvert:true, annulee:false, majLe:Date.now()};
    window.fbSetDoc(window.fbDoc(indDb(),"indep_seances",indId("p")),d).then(function(){ sh.modal.remove(); showToast("Séance créée"); }).catch(indErr);
  });
  sh.body.querySelector("#ind-pc-annul").addEventListener("click",function(){ sh.modal.remove(); });
}

// ── Indépendant : Clients ───────────────────────────────────────────
function indLienActif(){ return IND.liens.filter(function(l){ return l.actif; })[0]||null; }
function indVueClients(){
  var l=indLienActif(), h='<div class="ind-c">';
  if(l){
    var url=indLienUrl(l.code), txt="Rejoins "+((IND.club&&IND.club.name)||"mes séances")+" sur l'appli : "+url;
    h+='<div class="ind-row"><div class="t"><strong>Inviter un client</strong><span>Il ouvre le lien ou scanne le QR code, puis crée son accès.</span></div></div>'
      +'<div class="ind-qr" id="ind-qr" data-url="'+indEsc(url)+'"></div><div class="ind-lien">'+indEsc(url)+'</div>'
      +'<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn p" data-act="lien-copier">Copier le lien</button>'
      +'<a class="ind-btn s" style="text-align:center;text-decoration:none;box-sizing:border-box" target="_blank" rel="noopener" href="https://wa.me/?text='+encodeURIComponent(txt)+'">Envoyer par WhatsApp</a></div>'
      +'<button type="button" class="ind-btn s" style="margin-top:8px;font-size:12.5px;padding:9px" data-act="lien-couper">Désactiver ce lien et en créer un nouveau</button>';
  } else {
    h+='<div class="ind-row"><div class="t"><strong>Inviter tes clients</strong><span>Crée ton lien : un seul lien (et son QR code) pour tous tes clients. Tu peux le changer à tout moment.</span></div></div>'
      +'<button type="button" class="ind-btn p" style="margin-top:10px" data-act="lien-creer">Créer mon lien d\'invitation</button>';
  }
  h+='</div>';
  var cl=indClientsActifs();
  h+='<div class="ind-k">Mes clients · '+cl.length+'</div>';
  if(!IND.clientsCharges) h+='<div class="ind-c ind-vide">Chargement…</div>';
  else if(!cl.length) h+='<div class="ind-c ind-vide">Pas encore de client. Partage ton lien : ils apparaissent ici dès qu\'ils ont créé leur accès.</div>';
  else h+='<div class="ind-c ind-list">'+cl.map(function(c){
    var age=indAge(c.naissance), crs=IND.creneaux.filter(function(x){ return x.actif!==false && (x.habitues||[]).indexOf(c.uid)>=0; });
    var par=indParentDe(c);
    var sous=[age!==null?age+" ans":"", c.mineur?"Mineur"+(par?" · parent : "+(par.prenom||"")+" "+(par.nom||""):""):"",
      crs.length?crs.map(function(x){ return IND_JOURS_C[Number(x.jour)]+" "+(x.heure||""); }).join(", "):"Pas d'habitude"].filter(Boolean).join(" · ");
    return '<div class="ind-row tap" data-act="client" data-uid="'+indEsc(c.uid)+'" role="button" tabindex="0" style="cursor:pointer"><div class="ind-av">'+indEsc(indInitiales(c.prenom,c.nom))+'</div>'
      +'<div class="t"><strong>'+indEsc((c.prenom||"")+" "+(c.nom||""))+'</strong><span>'+indEsc(sous)+'</span></div><span aria-hidden="true" style="color:var(--im)">›</span></div>';
  }).join("")+'</div>';
  return h;
}
function indDessinerQr(){
  var el=document.getElementById("ind-qr"); if(!el||el.firstChild) return;
  if(typeof QRCode==="undefined"){ el.style.display="none"; return; }
  try{ new QRCode(el,{text:el.dataset.url, width:168, height:168, colorDark:"#0b1630", colorLight:"#ffffff", correctLevel:QRCode.CorrectLevel.M}); }catch(e){ el.style.display="none"; }
}
function indCreerLien(){
  var code=genSecureCode(2,4);
  return window.fbSetDoc(window.fbDoc(indDb(),"indep_liens",code),{clubId:IND.clubId, clubName:String((IND.club&&IND.club.name)||"").slice(0,80),
    couleur:indCouleur(), actif:true, createdBy:IND.uid, createdAt:window.fbServerTimestamp()}).catch(indErr);
}
function indCouperLien(){
  var l=indLienActif(); if(!l) return;
  askConfirm("L'ancien lien et son QR code ne fonctionneront plus. Les clients déjà inscrits gardent leur accès.",{title:"Changer de lien ?",confirmText:"Changer"}).then(function(ok){
    if(!ok) return;
    window.fbUpdateDoc(window.fbDoc(indDb(),"indep_liens",l.code),{actif:false}).then(indCreerLien).then(function(){ showToast("Nouveau lien créé"); }).catch(indErr);
  });
}

function indClientFiche(uid){
  var c=IND.clients[uid]; if(!c) return;
  var sh=gmSheet((c.prenom||"")+" "+(c.nom||""));
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var age=indAge(c.naissance), tel=String(c.tel||"").replace(/[^+0-9]/g,"");
  var crs=IND.creneaux.filter(function(x){ return x.actif!==false; });
  var par=indParentDe(c), ptel=par?String(par.tel||"").replace(/[^+0-9]/g,""):"";
  var lignes='<div class="ind-row"><div class="t"><strong>Âge</strong><span>'+(age!==null?age+" ans · né(e) le "+indEsc(indDate(c.naissance).toLocaleDateString("fr-FR")):"Non renseigné")+(c.mineur?" · mineur":"")+'</span></div></div>';
  if(c.mineur){
    // Enfant sans compte : on joint son parent (téléphone, e-mail) et on rappelle l'autorisation parentale.
    var ts=c.createdAt&&c.createdAt.toDate?c.createdAt.toDate():null;
    lignes+='<div class="ind-row"><div class="t"><strong>Parent</strong><span>'+indEsc(par?((par.prenom||"")+" "+(par.nom||"")+(par.tel?" · "+par.tel:"")):"Fiche du parent introuvable")+'</span>'
      +(par&&par.email?'<span>'+indEsc(par.email)+'</span>':'')+'</div>'
      +(ptel?'<a class="ind-btn s mini" style="text-decoration:none" href="tel:'+indEsc(ptel)+'">Appeler</a>':'')+'</div>'
      +'<div class="ind-row"><div class="t"><strong>Autorisation parentale</strong><span>Donnée par le parent'+(ts?" le "+indEsc(ts.toLocaleDateString("fr-FR")):"")+'</span></div></div>';
  } else {
    lignes+='<div class="ind-row"><div class="t"><strong>Téléphone</strong><span>'+indEsc(c.tel||"Non renseigné")+'</span></div>'
      +(tel?'<a class="ind-btn s mini" style="text-decoration:none" href="tel:'+indEsc(tel)+'">Appeler</a>':'')+'</div>'
      +'<div class="ind-row"><div class="t"><strong>E-mail</strong><span>'+indEsc(c.email||"Non renseigné")+'</span></div></div>';
    var enf=indEnfantsDe(uid);
    if(enf.length) lignes+='<div class="ind-row"><div class="t"><strong>Ses enfants</strong><span>'+indEsc(enf.map(function(e){ return (e.prenom||"")+(indAge(e.naissance)!==null?" ("+indAge(e.naissance)+" ans)":""); }).join(", "))+'</span></div></div>';
  }
  if(c.note) lignes+='<div class="ind-row"><div class="t"><strong>À savoir ('+(c.mineur?"écrit par le parent":"écrit par le client")+')</strong><span>'+indEsc(c.note)+'</span></div></div>';
  sh.body.innerHTML='<div class="ind-c ind-list">'+lignes+'</div>'
    +'<button type="button" class="ind-btn s" id="ind-cl-argent" style="margin-top:10px">Argent et pass</button>'
    +'<button type="button" class="ind-btn s" id="ind-cl-ecrire" style="margin-top:8px">'+(c.mineur?"Écrire au parent":"Écrire à ce client")+'</button>'
    +'<div class="ind-k">Habitué de</div>'
    +(crs.length?'<div class="ind-c ind-f" style="gap:6px">'+crs.map(function(x){
      return '<label class="case"><input type="checkbox" data-cr="'+indEsc(x.id)+'"'+((x.habitues||[]).indexOf(uid)>=0?" checked":"")+'>'+indEsc(IND_JOURS[Number(x.jour)]+" "+(x.heure||"")+" · "+(x.titre||""))+'</label>';
    }).join("")+'</div>':'<div class="ind-c ind-vide">Aucun créneau pour l\'instant.</div>')
    +'<div class="ind-k">Notes privées (lui ne les voit pas)</div>'
    +'<div class="ind-f"><textarea id="ind-cl-notes" maxlength="1000" placeholder="Objectifs, niveau, blessures…"></textarea>'
    +'<div class="actions"><button type="button" class="ok" id="ind-cl-save">Enregistrer les notes</button></div></div>'
    +'<button type="button" class="ind-btn d" style="margin-top:14px" id="ind-cl-retirer">'+(c.mineur?"Retirer cet enfant":"Retirer ce client")+'</button>';
  sh.body.querySelector("#ind-cl-argent").addEventListener("click",function(){
    sh.modal.remove(); indArgentFiche(c.mineur&&c.parentUid?c.parentUid:uid);
  });
  sh.body.querySelector("#ind-cl-ecrire").addEventListener("click",function(){
    var compte=c.mineur?c.parentUid:uid; if(!compte) return askAlert("Compte du parent introuvable.");
    sh.modal.remove(); indOuvrirDiscussion(compte);
  });
  var ta=sh.body.querySelector("#ind-cl-notes");
  window.fbGetDoc(window.fbDoc(indDb(),"indep_notes",uid)).then(function(s){ if(s.exists()&&!ta.value) ta.value=s.data().texte||""; }).catch(function(){});
  sh.body.querySelector("#ind-cl-save").addEventListener("click",function(){
    window.fbSetDoc(window.fbDoc(indDb(),"indep_notes",uid),{texte:ta.value.slice(0,1000), majLe:Date.now()}).then(function(){ showToast("Notes enregistrées"); }).catch(indErr);
  });
  sh.body.querySelectorAll("input[data-cr]").forEach(function(cb){
    cb.addEventListener("change",function(){
      window.fbUpdateDoc(window.fbDoc(indDb(),"indep_creneaux",cb.dataset.cr),{habitues:cb.checked?window.fbArrayUnion(uid):window.fbArrayRemove(uid)})
        .then(function(){ showToast(cb.checked?"Ajouté au créneau":"Retiré du créneau"); }).catch(indErr);
    });
  });
  sh.body.querySelector("#ind-cl-retirer").addEventListener("click",function(){
    // Personnes retirées : le client + ses enfants ; un enfant seul, sauf si c'était le dernier d'un
    // compte « parent seul » (alors le compte du parent n'a plus d'objet et est retiré avec lui).
    var retirees=[uid], compteAretirer=null;
    if(c.mineur){
      var pr=indParentDe(c);
      if(pr && pr.parentSeul && indEnfantsDe(c.parentUid).filter(function(e){ return e.uid!==uid; }).length===0){ compteAretirer=c.parentUid; }
    } else {
      indEnfantsDe(uid).forEach(function(e){ retirees.push(e.uid); }); compteAretirer=uid;
    }
    var texte=c.mineur
      ?("Il sort de tes créneaux. Sa fiche est gardée dans ton historique."+(compteAretirer?" Son parent n'a plus d'enfant inscrit : son accès à l'appli est aussi supprimé.":""))
      :("Son accès à l'appli est supprimé et il sort de tes créneaux."+(retirees.length>1?" Ses enfants inscrits sont retirés aussi.":"")+" Sa fiche est gardée dans ton historique.");
    askConfirm(texte,{title:"Retirer "+(c.prenom||(c.mineur?"cet enfant":"ce client"))+" ?",confirmText:"Retirer",danger:true}).then(function(ok){
      if(!ok) return;
      var b=window.fbWriteBatch();
      IND.creneaux.forEach(function(x){
        var dedans=retirees.filter(function(p){ return (x.habitues||[]).indexOf(p)>=0; });
        if(dedans.length) b.update(window.fbDoc(indDb(),"indep_creneaux",x.id),{habitues:window.fbArrayRemove.apply(null,dedans)});
      });
      retirees.forEach(function(p){ b.update(window.fbDoc(indDb(),"indep_clients",p),{actif:false, retireLe:Date.now()}); });
      if(compteAretirer){
        if(compteAretirer!==uid) b.update(window.fbDoc(indDb(),"indep_clients",compteAretirer),{actif:false, retireLe:Date.now()});
        b.delete(window.fbDoc(indDb(),"users",compteAretirer));
      }
      b.commit().then(function(){ sh.modal.remove(); showToast(c.mineur?"Enfant retiré":"Client retiré"); }).catch(indErr);
    });
  });
}

// ── Annonces (l'indépendant écrit, les clients répondent 👍🏼 ou 👎🏼) ──
// Réserver reste « Je viens / Je ne peux pas » sur la séance : une annonce n'inscrit personne.
function indAnnMs(a){ var c=a&&a.createdAt; return (c&&c.toMillis)?c.toMillis():Date.now(); }
function indHeure(d){ return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
function indAnnQuand(a){ var d=new Date(indAnnMs(a)); return indDateTxt(indIso(d))+" · "+indHeure(d); }
function indAnnoncesTriees(){ return IND.annonces.slice().sort(function(x,y){ return indAnnMs(y)-indAnnMs(x); }); }
function indAnnonceParId(id){ for(var i=0;i<IND.annonces.length;i++) if(IND.annonces[i].id===id) return IND.annonces[i]; return null; }
function indCreneauParId(id){ for(var i=0;i<IND.creneaux.length;i++) if(IND.creneaux[i].id===id) return IND.creneaux[i]; return null; }
function indAnnVisible(a,pid){
  if(a.cible==="tous") return true;
  var c=indCreneauParId(a.cible); return !!c && (c.habitues||[]).indexOf(pid)>=0;
}
function indAnnoncesPourMoi(){
  var pers=indPersonnes();
  return indAnnoncesTriees().filter(function(a){ return pers.some(function(p){ return indAnnVisible(a,p.id); }); });
}
function indCibleTxt(a){
  if(a.cible==="tous") return "Tous mes clients";
  var c=indCreneauParId(a.cible);
  return c?"Habitués · "+IND_JOURS_C[Number(c.jour)]+" "+(c.heure||"")+" "+(c.titre||""):"Habitués d'un créneau";
}
// Dernière annonce vue par ce compte sur cet appareil (la pastille « non lu » du client).
function indCleLu(){ return "ind_lu_"+IND.clubId+"_"+IND.uid; }
function indLuLire(){
  if(IND.lu!=null) return IND.lu;
  var v=null; try{ v=localStorage.getItem(indCleLu()); }catch(e){}
  if(v===null){ v=String(Date.now()); try{ localStorage.setItem(indCleLu(),v); }catch(e){} }
  IND.lu=Number(v)||0; return IND.lu;
}
function indMarquerLu(){
  var max=indLuLire();
  indAnnoncesPourMoi().forEach(function(a){ max=Math.max(max,indAnnMs(a)); });
  if(max>IND.lu){ IND.lu=max; try{ localStorage.setItem(indCleLu(),String(max)); }catch(e){} }
}
function indNbNonLus(){ var lu=indLuLire(); return indAnnoncesPourMoi().filter(function(a){ return indAnnMs(a)>lu; }).length; }

function indDestinataires(a){
  if(a.cible==="tous") return indClientsActifs().map(function(c){ return c.uid; });
  var c=indCreneauParId(a.cible);
  return ((c&&c.habitues)||[]).filter(function(uid){ var f=IND.clients[uid]; return f && f.actif!==false; });
}
function indCompteReac(a){
  var r={up:[], down:[], aucune:[]};
  indDestinataires(a).forEach(function(uid){
    var x=IND.reacs[a.id+"__"+uid];
    if(x&&x.val==="up") r.up.push(uid); else if(x&&x.val==="down") r.down.push(uid); else r.aucune.push(uid);
  });
  return r;
}
// Séance jointe à une annonce : un clic ouvre la séance (c'est là qu'on réserve).
function indMiniSeance(a){
  if(!a.seance) return "";
  var s=indSeanceParId(a.seance);
  if(!s) return '<div class="ind-mini"><div class="t"><strong>'+indEsc("Séance du "+indDateTxt(a.seanceDate||indAuj()))+'</strong></div></div>';
  var sous=s.annulee?"":[s.lieu, s.places?indNbVenants(s)+" / "+s.places+" inscrits":""].filter(Boolean).join(" · ");
  return '<div class="ind-mini tap" data-act="seance" data-id="'+indEsc(s.id)+'" role="button" tabindex="0"><div class="t"><strong>'
    +indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong>'+(sous?'<span>'+indEsc(sous)+'</span>':'')+'</div>'
    +(s.annulee?'<span class="ind-pill no">Annulée</span>':'<span aria-hidden="true">›</span>')+'</div>';
}
function indVueMessages(){
  var nbD=indNbDiscNonLues();
  var seg='<div class="ind-seg" role="tablist">'
    +'<button type="button" role="tab" data-act="msgvue" data-v="annonces" class="'+(IND.msgVue!=="discussions"?"on":"")+'">Annonces</button>'
    +'<button type="button" role="tab" data-act="msgvue" data-v="discussions" class="'+(IND.msgVue==="discussions"?"on":"")+'">Discussions'+(nbD?' <i class="bdg2">'+nbD+'</i>':'')+'</button></div>';
  if(IND.msgVue==="discussions") return seg+indVueDiscussions();
  return seg+indVueAnnonces();
}
function indVueAnnonces(){
  var l=indAnnoncesTriees(), h='<button type="button" class="ind-btn p" data-act="annonce-new">+ Nouvelle annonce</button>';
  if(!l.length) return h+'<div class="ind-c ind-vide">Aucune annonce pour l\'instant.<br>Écris à tous tes clients, ou seulement aux habitués d\'un créneau : ils répondent d\'un 👍🏼 ou d\'un 👎🏼.</div>';
  return h+l.map(function(a){
    var c=indCompteReac(a);
    return '<div class="ind-c tap" data-act="annonce" data-id="'+indEsc(a.id)+'" role="button" tabindex="0">'
      +'<div class="ind-ann-h"><span>'+indEsc(indCibleTxt(a))+'</span><span>'+indEsc(indAnnQuand(a))+'</span></div>'
      +'<p class="ind-ann-t">'+indEsc(a.texte)+'</p>'+indMiniSeance(a)
      +'<div class="ind-reacs"><span class="ind-pill ok">👍🏼 '+c.up.length+'</span><span class="ind-pill no">👎🏼 '+c.down.length+'</span><span class="ind-pill a">'+c.aucune.length+' sans réponse</span></div></div>';
  }).join("");
}
function indOuvrirAnnonce(id){
  if(!indAnnonceParId(id)) return;
  var sh=gmSheet("Annonce");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.addEventListener("click",indClic);
  IND.feuille={s:sh, peindre:function(){
    var a=indAnnonceParId(id); if(!a){ sh.modal.remove(); return; }
    var c=indCompteReac(a);
    function liste(titre,uids){
      return '<div class="ind-k">'+titre+' · '+uids.length+'</div>'+(uids.length?'<div class="ind-c ind-list">'+uids.map(function(uid){
        var f=IND.clients[uid]||{}, par=indParentDe(f);
        return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(f.prenom,f.nom))+'</div><div class="t"><strong>'+indEsc(indNom(uid))+'</strong>'
          +(indEstMineur(f)?'<span>Mineur'+(par?" · parent : "+indEsc(par.prenom||""):"")+'</span>':'')+'</div></div>';
      }).join("")+'</div>':'<div class="ind-c ind-vide">Personne.</div>');
    }
    sh.body.innerHTML='<div class="ind-c"><div class="ind-ann-h"><span>'+indEsc(indCibleTxt(a))+'</span><span>'+indEsc(indAnnQuand(a))+'</span></div>'
      +'<p class="ind-ann-t">'+indEsc(a.texte)+'</p>'+indMiniSeance(a)+'</div>'
      +liste("👍🏼 D'accord",c.up)+liste("👎🏼 Pas d'accord",c.down)+liste("Sans réponse",c.aucune)
      +'<button type="button" class="ind-btn d" data-act="annonce-suppr" data-id="'+indEsc(a.id)+'" style="margin-top:6px">Supprimer l\'annonce</button>';
  }};
  IND.feuille.peindre();
}
function indSupprAnnonce(id){
  askConfirm("Supprimer cette annonce et les réponses de tes clients ?",{title:"Supprimer",confirmText:"Supprimer",danger:true}).then(function(ok){
    if(!ok) return;
    var b=window.fbWriteBatch();
    Object.keys(IND.reacs).forEach(function(k){ if(IND.reacs[k].annonce===id) b.delete(window.fbDoc(indDb(),"indep_reactions",k)); });
    b.delete(window.fbDoc(indDb(),"indep_annonces",id));
    b.commit().then(function(){ if(IND.feuille&&IND.feuille.s.modal) IND.feuille.s.modal.remove(); showToast("Annonce supprimée"); }).catch(indErr);
  });
}
// Rédaction : texte, destinataires (tous / habitués d'un créneau), séance jointe en option.
// opts : {texte, cible, seance}
function indAnnonceForm(opts){
  opts=opts||{};
  var sh=gmSheet("Nouvelle annonce");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var cr=IND.creneaux.filter(function(c){ return c.actif!==false; })
    .sort(function(x,y){ return (((Number(x.jour)+6)%7)+(x.heure||"")).localeCompare(((Number(y.jour)+6)%7)+(y.heure||"")); });
  var a=indAuj(), ss=indSeances(a,indAjout(a,IND_HORIZON));
  if(opts.seance && !ss.some(function(x){ return x.id===opts.seance; })){ var x0=indSeanceParId(opts.seance); if(x0) ss.unshift(x0); }
  sh.body.innerHTML='<form class="ind-f" id="ind-an-f" novalidate>'
    +'<label>Message<textarea id="ind-an-txt" maxlength="1000" rows="4" placeholder="Ex. : Pluie jeudi, on passe en salle.">'+indEsc(opts.texte||"")+'</textarea></label>'
    +'<label>Pour qui<select id="ind-an-cible"><option value="tous">Tous mes clients</option>'
    +cr.map(function(c){ return '<option value="'+indEsc(c.id)+'">Habitués · '+indEsc(IND_JOURS_C[Number(c.jour)]+" "+(c.heure||"")+" "+(c.titre||"Séance"))+'</option>'; }).join("")+'</select></label>'
    +'<label>Séance jointe (facultatif)<select id="ind-an-seance"><option value="">Aucune</option>'
    +ss.map(function(x){ return '<option value="'+indEsc(x.id)+'">'+indEsc(indDateTxt(x.date)+" · "+(x.heure||"")+" · "+x.titre)+'</option>'; }).join("")+'</select></label>'
    +'<p class="ind-note">Tes clients répondent d\'un 👍🏼 ou d\'un 👎🏼. Pour s\'inscrire à une séance, ils passent par « Je viens » sur la séance.</p>'
    +'<div class="err" id="ind-an-err"></div><div class="actions"><button type="submit" class="ok">Publier</button></div></form>';
  var f=sh.body.querySelector("#ind-an-f");
  f.querySelector("#ind-an-cible").value=opts.cible||"tous";
  if(f.querySelector("#ind-an-cible").value!==(opts.cible||"tous")) f.querySelector("#ind-an-cible").value="tous";
  f.querySelector("#ind-an-seance").value=opts.seance||"";
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var txt=f.querySelector("#ind-an-txt").value.trim();
    if(!txt){ f.querySelector("#ind-an-err").textContent="Écris ton message."; return; }
    var d={texte:txt.slice(0,1000), cible:f.querySelector("#ind-an-cible").value||"tous", createdAt:window.fbServerTimestamp()};
    var sid=f.querySelector("#ind-an-seance").value;
    if(sid){ var s=indSeanceParId(sid); d.seance=sid; d.seanceDate=s?s.date:""; }
    var btn=f.querySelector("button[type=submit]"); btn.disabled=true;
    window.fbSetDoc(window.fbDoc(indDb(),"indep_annonces",indId("a_")),d)
      .then(function(){ sh.modal.remove(); showToast("Annonce publiée"); })
      .catch(function(e2){ btn.disabled=false; indErr(e2); });
  });
}
// Client : annonces reçues, avec 👍🏼 / 👎🏼 (une réponse par personne : moi, puis chaque enfant concerné).
function indVueMessagesClient(){
  var l=indAnnoncesPourMoi(), d=IND.disc, nonLue=indDiscNonLueClient();
  var carte='<div class="ind-c tap" data-act="disc" role="button" tabindex="0"><div class="ind-row"><div class="ind-av">💬</div><div class="t"><strong>'
    +indEsc(d?"Discussion avec "+((IND.club&&IND.club.name)||"ton coach"):"Écrire à "+((IND.club&&IND.club.name)||"ton coach"))+'</strong><span>'
    +indEsc(d?((d.dernierDe==="client"?"Toi : ":"")+(d.dernier||"")):"Une question ? Ouvre une discussion privée.")+'</span></div>'
    +(nonLue?'<span class="ind-pill ok">Nouveau</span>':'<span aria-hidden="true">›</span>')+'</div></div>';
  if(!l.length) return carte+'<div class="ind-c ind-vide">Pas encore d\'annonce de ton coach.<br>Elles apparaîtront ici.</div>';
  return carte+indListeAnnoncesClient(l);
}
function indListeAnnoncesClient(l){
  var avant=IND.luAvant==null?indLuLire():IND.luAvant, tous=indPersonnes(), multi=tous.length>1;
  return l.map(function(a){
    var pers=tous.filter(function(p){ return indAnnVisible(a,p.id); }), nouveau=indAnnMs(a)>avant;
    return '<div class="ind-c"><div class="ind-ann-h"><span>'+(nouveau?'<span class="ind-pill ok">Nouveau</span>':'')+'</span><span>'+indEsc(indAnnQuand(a))+'</span></div>'
      +'<p class="ind-ann-t">'+indEsc(a.texte)+'</p>'+indMiniSeance(a)
      +'<div class="ind-reacs c">'+pers.map(function(p){
        var r=IND.reacs[a.id+"__"+p.id], v=r&&r.val;
        function bt(val,emoji,lib){
          return '<button type="button" class="ind-rb'+(v===val?" on":"")+'" data-act="reac" data-v="'+val+'" data-id="'+indEsc(a.id)+'" data-pid="'+indEsc(p.id)+'" aria-pressed="'+(v===val)+'" aria-label="'+lib+(multi?" pour "+indEsc(p.prenom):"")+'">'+emoji+'</button>';
        }
        return '<div class="ind-row"><div class="t"><span>'+(multi?'<b>'+indEsc(p.prenom)+'</b>':'Ta réponse')+'</span></div>'+bt("up","👍🏼","D'accord")+bt("down","👎🏼","Pas d'accord")+'</div>';
      }).join("")+'</div></div>';
  }).join("");
}
function indReac(aid,v,pid){
  pid=pid||IND.uid;
  if(v!=="up" && v!=="down") return;
  if(!indAnnonceParId(aid)) return;
  if(pid!==IND.uid && !IND.enfants[pid]) return;
  var k=aid+"__"+pid, avant=IND.reacs[k];
  var d={annonce:aid, uid:pid, owner:IND.uid, val:v, nom:indNomPersonne(pid), at:window.fbServerTimestamp()};
  IND.reacs[k]=Object.assign({},avant||{},{annonce:aid, uid:pid, owner:IND.uid, val:v}); indRendre();
  window.fbSetDoc(window.fbDoc(indDb(),"indep_reactions",k),d,{merge:true}).then(function(){
    showToast(v==="up"?"Réponse envoyée 👍🏼":"Réponse envoyée 👎🏼");
  }).catch(function(e){ if(avant) IND.reacs[k]=avant; else delete IND.reacs[k]; indRendre(); indErr(e); });
}

// ── Discussions privées (client ↔ indépendant), texte + photos ──────
function indTs(t){ return (t&&t.toMillis)?t.toMillis():0; }
// « Non lu » = le dernier message vient de l'autre côté et date d'après ma dernière lecture.
function indDiscNonLue(d,moi){
  if(!d) return false;
  return d.dernierDe===(moi==="coach"?"client":"coach") && indTs(d.dernierTs)>indTs(moi==="coach"?d.luCoach:d.luClient);
}
function indDiscNonLueClient(){ return indDiscNonLue(IND.disc,"client"); }
function indNbDiscNonLues(){ return Object.keys(IND.discs).filter(function(k){ return indDiscNonLue(IND.discs[k],"coach"); }).length; }
function indDiscHeure(t){
  var ms=indTs(t); if(!ms) return "";
  var d=new Date(ms), a=indAuj();
  return indIso(d)===a?indHeure(d):indDateTxt(indIso(d));
}
function indVueDiscussions(){
  var l=Object.keys(IND.discs).map(function(k){ return Object.assign({uid:k},IND.discs[k]); })
    .sort(function(x,y){ return indTs(y.dernierTs)-indTs(x.dernierTs); });
  if(!l.length) return '<div class="ind-c ind-vide">Aucune discussion pour l\'instant.<br>Un client peut t\'écrire depuis son onglet Messages. Pour écrire en premier : Clients › fiche du client › « Écrire ».</div>';
  return '<div class="ind-c ind-list">'+l.map(function(d){
    var nl=indDiscNonLue(d,"coach"), nom=(IND.clients[d.uid]&&indNom(d.uid))||d.nom||"Client";
    return '<div class="ind-row tap" data-act="disc" data-uid="'+indEsc(d.uid)+'" role="button" tabindex="0" style="cursor:pointer"><div class="ind-av">'
      +indEsc(indInitiales((nom.split(" ")[0]||""),(nom.split(" ")[1]||"")))+'</div><div class="t"><strong>'+indEsc(nom)+'</strong><span>'
      +indEsc((d.dernierDe==="coach"?"Toi : ":"")+(d.dernier||""))+'</span></div><div style="text-align:right"><small style="color:var(--im);font-size:11px">'
      +indEsc(indDiscHeure(d.dernierTs))+'</small>'+(nl?'<div><span class="ind-pill ok">Nouveau</span></div>':'')+'</div></div>';
  }).join("")+'</div>';
}
// Photo : réduite et enregistrée dans le message (data:image/jpeg), 350 000 caractères maximum.
function indPhotoPrete(file){
  return compressImageFile(file,900,0.6).then(function(u){
    if(u.length>340000) return compressImageFile(file,640,0.5);
    return u;
  }).then(function(u){ if(u.length>340000) throw new Error("trop lourde"); return u; });
}
function indImgSure(u){ return /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(String(u||"")) ? u : ""; }
function indOuvrirDiscussion(uid){
  uid=uid||IND.uid;
  var coach=IND.role==="coach", moi=coach?"coach":"client";
  var nomAutre=coach?(IND.clients[uid]?indNom(uid):((IND.discs[uid]&&IND.discs[uid].nom)||"Client")):((IND.club&&IND.club.name)||"Mon coach");
  var sh=gmSheet(nomAutre);
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.innerHTML='<div class="ind-msgs" id="ind-ms" aria-live="polite"><div class="ind-vide">Chargement…</div></div>'
    +'<div id="ind-ms-img" class="ind-note" hidden></div>'
    +'<form class="ind-comp" id="ind-ms-f" novalidate>'
    +'<label class="ind-ph" aria-label="Joindre une photo">📷<input type="file" accept="image/*" id="ind-ms-file" class="ind-hid"></label>'
    +'<textarea id="ind-ms-t" rows="1" maxlength="1000" placeholder="Écrire un message…" aria-label="Message"></textarea>'
    +'<button type="submit" class="ind-btn p mini" id="ind-ms-ok">Envoyer</button></form>';
  var zone=sh.body.querySelector("#ind-ms"), ta=sh.body.querySelector("#ind-ms-t"), f=sh.body.querySelector("#ind-ms-f");
  var info=sh.body.querySelector("#ind-ms-img"), photo=null, msgs=[], unsub=null;
  function threadRef(){ return window.fbDoc(indDb(),"indep_discussions",uid); }
  function marquerLu(){
    var d=coach?IND.discs[uid]:IND.disc;
    if(!indDiscNonLue(d,moi)) return;
    var champ=coach?"luCoach":"luClient", maj={}; maj[champ]=window.fbServerTimestamp();
    // Evite une boucle : on se marque lu localement tout de suite.
    if(coach) IND.discs[uid]=Object.assign({},d,{luCoach:{toMillis:function(){ return Date.now()+1000; }}});
    else IND.disc=Object.assign({},d,{luClient:{toMillis:function(){ return Date.now()+1000; }}});
    window.fbUpdateDoc(threadRef(),maj).catch(function(){});
  }
  function peindre(){
    if(!msgs.length){ zone.innerHTML='<div class="ind-vide">'+(coach?"Aucun message. Écris le premier.":"Pose ta question à ton coach, il te répondra ici.")+'</div>'; return; }
    var jour="";
    zone.innerHTML=msgs.map(function(m){
      var ms=indTs(m.createdAt)||Date.now(), d=new Date(ms), iso=indIso(d), sep="";
      if(iso!==jour){ jour=iso; sep='<div class="ind-jour">'+indEsc(indQuand(iso)===indDateTxt(iso)?indDateLong(iso):indQuand(iso))+'</div>'; }
      var img=indImgSure(m.img);
      return sep+'<div class="ind-bulle '+(m.de===moi?"moi":"autre")+'">'
        +(m.texte?'<div class="tx">'+indEsc(m.texte)+'</div>':'')
        +(img?'<img src="'+img+'" alt="Photo envoyée">':'')
        +'<small>'+indEsc(indHeure(d))+'</small></div>';
    }).join("");
    zone.scrollTop=zone.scrollHeight;
  }
  var refMsgs=window.fbQuery(window.fbCollection(indDb(),"indep_discussions",uid,"messages"),
    window.fbWhere("createdAt",">=",new Date(Date.now()-120*86400000)), window.fbOrderBy("createdAt"));
  unsub=window.fbOnSnapshot(refMsgs,function(sn){
    if(!document.body.contains(sh.modal)){ if(unsub) unsub(); return; }
    var l=[]; sn.forEach(function(d){ l.push(d.data({serverTimestamps:"estimate"})); }); msgs=l; peindre(); marquerLu();
  },function(e){ console.log("indépendant (discussion):",e&&e.code); zone.innerHTML='<div class="ind-vide">Discussion indisponible pour l\'instant.</div>'; });
  IND.unsubs.push(function(){ if(unsub) unsub(); });
  sh.body.querySelector("#ind-ms-file").addEventListener("change",function(e){
    var fi=e.target.files&&e.target.files[0]; e.target.value=""; if(!fi) return;
    info.hidden=false; info.textContent="Préparation de la photo…";
    indPhotoPrete(fi).then(function(u){ photo=u; info.innerHTML='Photo prête · <a href="#" id="ind-ms-x" style="color:inherit;font-weight:800">Retirer</a>';
      var x=info.querySelector("#ind-ms-x"); if(x) x.addEventListener("click",function(ev){ ev.preventDefault(); photo=null; info.hidden=true; });
    }).catch(function(){ photo=null; info.textContent="Photo impossible à envoyer (image invalide ou trop lourde)."; });
  });
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var txt=ta.value.trim().slice(0,1000);
    if(!txt && !photo) return;
    var btn=f.querySelector("#ind-ms-ok"); btn.disabled=true;
    var b=window.fbWriteBatch(), mref=window.fbDoc(indDb(),"indep_discussions",uid,"messages",indId("m_"));
    var m={de:moi, auteur:IND.uid, createdAt:window.fbServerTimestamp()};
    if(txt) m.texte=txt;
    if(photo) m.img=photo;
    var fil={nom:coach?(IND.clients[uid]?indNom(uid):((IND.discs[uid]&&IND.discs[uid].nom)||"Client")).slice(0,60):indMonNom(),
      dernier:(txt||"📷 Photo").slice(0,80), dernierTs:window.fbServerTimestamp(), dernierDe:moi};
    b.set(mref,m);
    b.set(threadRef(),fil,{merge:true});
    b.commit().then(function(){ ta.value=""; photo=null; info.hidden=true; btn.disabled=false; })
      .catch(function(e2){ btn.disabled=false; indErr(e2); });
  });
  setTimeout(function(){ try{ ta.focus(); }catch(e){} },50);
}

// ── Réglages de l'activité (nom, couleur) ───────────────────────────
function indReglages(){
  var sh=gmSheet("Mon activité");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var choix=indCouleur().toLowerCase();
  var pal=(typeof CLUB_PALETTE!=="undefined"?CLUB_PALETTE:[]).slice();
  if(pal.map(function(x){ return x.toLowerCase(); }).indexOf(IND_COULEUR.toLowerCase())<0) pal.unshift(IND_COULEUR);
  sh.body.innerHTML='<form class="ind-f" id="ind-rg-f" novalidate>'
    +'<label>Nom de ton activité<input id="ind-rg-nom" maxlength="60" value="'+indEsc((IND.club&&IND.club.name)||"")+'"></label>'
    +'<div style="font-size:12px;font-weight:800;color:var(--txt2)">Couleur de ton appli</div>'
    +'<div class="ind-pal" id="ind-rg-pal">'+pal.map(function(c){ return '<button type="button" data-c="'+indEsc(c)+'" class="'+(c.toLowerCase()===choix?"on":"")+'" style="background:'+indEsc(c)+'" aria-label="Couleur '+indEsc(c)+'"></button>'; }).join("")+'</div>'
    +'<div class="err" id="ind-rg-err"></div>'
    +'<div class="actions"><button type="submit" class="ok">Enregistrer</button></div>'
    +'<button type="button" class="ind-btn s" id="ind-rg-out" style="margin-top:8px">Se déconnecter</button></form>';
  var f=sh.body.querySelector("#ind-rg-f");
  sh.body.querySelector("#ind-rg-pal").addEventListener("click",function(e){
    var b=e.target.closest("button[data-c]"); if(!b) return;
    choix=b.dataset.c.toLowerCase();
    sh.body.querySelectorAll("#ind-rg-pal button").forEach(function(x){ x.classList.toggle("on",x===b); });
    sh.body.style.setProperty("--ia",b.dataset.c);
  });
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var nom=f.querySelector("#ind-rg-nom").value.trim();
    if(nom.length<2){ f.querySelector("#ind-rg-err").textContent="Le nom doit faire au moins 2 caractères."; return; }
    var b=window.fbWriteBatch();
    b.update(window.fbDoc(indDb(),"clubs",IND.clubId),{name:nom.slice(0,60), couleur:choix});
    IND.liens.forEach(function(l){ if(l.actif) b.update(window.fbDoc(indDb(),"indep_liens",l.code),{clubName:nom.slice(0,60), couleur:choix}); });
    b.commit().then(function(){ sh.modal.remove(); showToast("Enregistré"); }).catch(indErr);
  });
  sh.body.querySelector("#ind-rg-out").addEventListener("click",function(){ indStop(); authLogout(); });
}

// ── Client : Accueil ────────────────────────────────────────────────
// Un parent réserve pour lui et pour chacun de ses enfants : ces fonctions prennent
// l'identifiant de la personne (pid), par défaut le compte lui-même.
function indMesSeances(de,a,pid){
  pid=pid||IND.uid;
  return indSeances(de,a).filter(function(s){
    if((s.habitues||[]).indexOf(pid)>=0) return true;
    var r=IND.resas[s.id+"__"+pid]; return !!(r && r.statut==="vient");
  });
}
function indMonStatut(s,pid){
  pid=pid||IND.uid;
  var r=IND.resas[s.id+"__"+pid];
  if(r) return r.statut;
  return (s.habitues||[]).indexOf(pid)>=0?"vient":null;
}
function indBlocMaSeance(s, grand, pid){
  pid=pid||IND.uid;
  var st=indMonStatut(s,pid), fini=indCommencee(s), n=indNbVenants(s);
  var h='<div class="ind-c"><div class="ind-row"><div class="t"><strong>'+indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong><span>'
    +indEsc([s.lieu, s.places?n+" / "+s.places+" inscrits":n+" inscrit"+(n>1?"s":"")].filter(Boolean).join(" · "))+'</span></div>'
    +(s.annulee?'<span class="ind-pill no">Annulée</span>':(fini?(st==="vient"?'<span class="ind-pill ok">Je viens</span>':st==="absent"?'<span class="ind-pill no">Absent</span>':''):''))+'</div>';
  if(s.annulee) h+=(s.motif?'<p class="ind-note" style="margin-top:8px">Motif : '+indEsc(s.motif)+'</p>':'');
  else if(!fini && (grand||st)){
    h+='<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn '+(st==="vient"?"p":"s")+'" data-act="resa" data-v="vient" data-pid="'+indEsc(pid)+'" data-id="'+indEsc(s.id)+'" aria-pressed="'+(st==="vient")+'">'+(st==="vient"?"✓ Je viens":"Je viens")+'</button>'
      +'<button type="button" class="ind-btn '+(st==="absent"?"d":"s")+'" data-act="resa" data-v="absent" data-pid="'+indEsc(pid)+'" data-id="'+indEsc(s.id)+'" aria-pressed="'+(st==="absent")+'">'+(st==="absent"?"✕ Je ne peux pas":"Je ne peux pas")+'</button></div>';
  }
  return h+'</div>';
}
function indVueAccueilClient(){
  var a=indAuj(), pers=indPersonnes(), multi=pers.length>1, h="", total=0;
  if(!pers.length){
    return '<div class="ind-c ind-vide">Aucun enfant inscrit pour l\'instant.</div>'
      +'<button type="button" class="ind-btn p" data-act="enfant-ajout">Inscrire un enfant</button>';
  }
  pers.forEach(function(p){
    var mes=indMesSeances(a,indAjout(a,21),p.id).filter(function(s){ return !indCommencee(s)||s.date===a; });
    if(!mes.length){ if(multi) h+='<div class="ind-k">'+indEsc(p.prenom)+'</div><div class="ind-c ind-vide">Aucune séance prévue.</div>'; return; }
    total+=mes.length;
    h+='<div class="ind-k">'+(multi?indEsc(p.prenom)+' · prochaine séance':'Ma prochaine séance')+'</div>'+indBlocMaSeance(mes[0],true,p.id);
    if(mes.length>1) h+='<div class="ind-k">Ensuite'+(multi?' · '+indEsc(p.prenom):'')+'</div>'+mes.slice(1,multi?4:8).map(function(s){ return indBlocMaSeance(s,false,p.id); }).join("");
  });
  if(!total){
    return '<div class="ind-c ind-vide">Aucune séance prévue'+(multi?'':' pour toi')+'.<br>Réserve une séance ouverte, ou demande à ton coach d\'ajouter '+(multi?'vos participants':'comme habitué')+'.</div>'
      +'<button type="button" class="ind-btn p" data-act="tab" data-v="reserver">Réserver une séance</button>';
  }
  h+='<p class="ind-note">Un empêchement ? Préviens ici avant le début : la place est libérée pour un autre client.</p>';
  return h;
}
// ── Client : Réserver ───────────────────────────────────────────────
function indVueReserver(){
  var a=indAuj(), pers=indPersonnes(), multi=pers.length>1;
  if(!pers.length) return '<div class="ind-c ind-vide">Inscris d\'abord un enfant (bouton en haut à droite › Ma fiche) pour réserver une séance.</div>';
  var l=indSeances(a,indAjout(a,IND_HORIZON)).filter(function(s){
    return s.ouvert && !s.annulee && !indCommencee(s) && pers.some(function(p){ return (s.habitues||[]).indexOf(p.id)<0; });
  });
  if(!l.length) return '<div class="ind-c ind-vide">Aucune séance ouverte à la réservation pour l\'instant.</div>';
  function bouton(s,p,reste){
    var st=indMonStatut(s,p.id);
    if(st==="vient") return '<span class="ind-pill ok">Réservé</span><button type="button" class="ind-btn s mini" data-act="resa" data-v="absent" data-pid="'+indEsc(p.id)+'" data-id="'+indEsc(s.id)+'">Annuler</button>';
    if(reste!==null && reste<=0) return '<span class="ind-pill no">Complet</span>';
    return '<button type="button" class="ind-btn p mini" data-act="resa" data-v="vient" data-pid="'+indEsc(p.id)+'" data-id="'+indEsc(s.id)+'">Réserver</button>';
  }
  function sousTitre(s,reste){
    return [s.lieu, (reste!==null&&reste>0)?reste+" place"+(reste>1?"s":"")+" restante"+(reste>1?"s":""):"", indPrix(s.prix)].filter(Boolean).join(" · ");
  }
  var h='<div class="ind-k">Séances ouvertes</div>';
  if(!multi){
    return h+'<div class="ind-c ind-list">'+l.map(function(s){
      var n=indNbVenants(s), reste=s.places?s.places-n:null;
      return '<div class="ind-row"><div class="t"><strong>'+indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong><span>'+indEsc(sousTitre(s,reste))+'</span></div>'+bouton(s,pers[0],reste)+'</div>';
    }).join("")+'</div>';
  }
  // Plusieurs personnes (parent + enfants) : une ligne par personne sous chaque séance.
  return h+l.map(function(s){
    var n=indNbVenants(s), reste=s.places?s.places-n:null;
    return '<div class="ind-c"><div class="ind-row"><div class="t"><strong>'+indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong><span>'+indEsc(sousTitre(s,reste))+'</span></div></div>'
      +pers.filter(function(p){ return (s.habitues||[]).indexOf(p.id)<0; }).map(function(p){
        return '<div class="ind-row" style="margin-top:8px"><div class="t"><strong style="font-weight:700">'+indEsc(p.prenom)+'</strong></div>'+bouton(s,p,reste)+'</div>';
      }).join("")+'</div>';
  }).join("");
}
function indResa(sid,statut,pid){
  pid=pid||IND.uid;
  var s=indSeanceParId(sid); if(!s) return;
  if(pid!==IND.uid && !IND.enfants[pid]) return;
  if(s.annulee) return askAlert("Cette séance est annulée.");
  if(indCommencee(s)) return askAlert("La séance a déjà commencé : préviens ton coach directement.");
  if(statut==="vient" && indMonStatut(s,pid)!=="vient" && indComplet(s)) return askAlert("Désolé, la séance est complète.");
  var k=sid+"__"+pid, d={seance:sid, date:s.date, uid:pid, statut:statut, nom:indNomPersonne(pid), at:window.fbServerTimestamp()};
  var avant=IND.resas[k];
  IND.resas[k]=Object.assign({},avant||{},{seance:sid, date:s.date, uid:pid, statut:statut}); indRendre();
  window.fbSetDoc(window.fbDoc(indDb(),"indep_resas",k),d,{merge:true}).then(function(){
    showToast(statut==="vient"?"C'est noté, à bientôt !":"Ton coach est prévenu");
  }).catch(function(e){ if(avant) IND.resas[k]=avant; else delete IND.resas[k]; indRendre(); indErr(e); });
}
function indSeanceClient(s){ return indBlocMaSeance(s,true); }

// ── Client : fiche (première fois, ou depuis le bouton du haut) ─────
function indVueFicheManquante(){
  return '<div class="ind-c"><div class="ind-row"><div class="t"><strong>Complète ta fiche</strong><span>Ton coach a besoin de ces infos pour t\'inscrire à ses séances.</span></div></div></div>'
    +'<button type="button" class="ind-btn p" data-act="ma-fiche">Remplir ma fiche</button>';
}
function indFicheChamps(f){
  f=f||{};
  return '<div class="deux"><label>Prénom<input id="ind-fi-prenom" maxlength="40" autocomplete="given-name" value="'+indEsc(f.prenom||"")+'"></label>'
    +'<label>Nom<input id="ind-fi-nom" maxlength="40" autocomplete="family-name" value="'+indEsc(f.nom||"")+'"></label></div>'
    +'<div class="deux"><label><span id="ind-fi-naiss-l">Date de naissance</span><input id="ind-fi-naiss" type="date" max="'+indAuj()+'" value="'+indEsc(f.naissance||"")+'"></label>'
    +'<label>Téléphone<input id="ind-fi-tel" type="tel" maxlength="20" autocomplete="tel" value="'+indEsc(f.tel||"")+'"></label></div>'
    +'<label>À savoir pour le coach (facultatif)<textarea id="ind-fi-note" maxlength="300" placeholder="Blessure, objectif, niveau…">'+indEsc(f.note||"")+'</textarea></label>';
}
// opts.moi === false : compte de parent qui n'inscrit que ses enfants (date de naissance facultative).
function indFicheLire(f,email,opts){
  var moi=!(opts&&opts.moi===false);
  var d={prenom:f.querySelector("#ind-fi-prenom").value.trim().slice(0,40), nom:f.querySelector("#ind-fi-nom").value.trim().slice(0,40),
    naissance:f.querySelector("#ind-fi-naiss").value||"", tel:f.querySelector("#ind-fi-tel").value.trim().slice(0,20),
    email:String(email||"").slice(0,100), note:f.querySelector("#ind-fi-note").value.trim().slice(0,300), parentSeul:!moi};
  if(!d.prenom||!d.nom) return {err:"Indique ton prénom et ton nom."};
  if(moi && !d.naissance) return {err:"Indique ta date de naissance."};
  if(d.naissance){
    var a=indAge(d.naissance);
    if(a===null) return {err:"Date de naissance invalide."};
    if(a<18) return {err:"Les moins de 18 ans sont inscrits par leur parent : demande-lui de créer l'accès et de t'inscrire."};
  }
  if(d.tel.replace(/[^0-9]/g,"").length<9) return {err:"Indique un numéro de téléphone valide."};
  return {d:d};
}
// Fiche d'un enfant mineur (inscrit par son parent).
function indEnfantChamps(e, avecAutorisation){
  e=e||{};
  return '<div class="deux"><label>Prénom de l\'enfant<input id="ind-en-prenom" maxlength="40" value="'+indEsc(e.prenom||"")+'"></label>'
    +'<label>Nom<input id="ind-en-nom" maxlength="40" value="'+indEsc(e.nom||"")+'"></label></div>'
    +'<label>Date de naissance de l\'enfant<input id="ind-en-naiss" type="date" max="'+indAuj()+'" value="'+indEsc(e.naissance||"")+'"></label>'
    +'<label>À savoir pour le coach (facultatif)<textarea id="ind-en-note" maxlength="300" placeholder="Blessure, allergie, niveau…">'+indEsc(e.note||"")+'</textarea></label>'
    +(avecAutorisation?'<label class="case"><input type="checkbox" id="ind-en-auto">Je suis le parent ou le représentant légal de cet enfant et je l\'autorise à participer aux séances. Les informations saisies ne sont visibles que par le coach.</label>':'');
}
function indEnfantLire(f, exigerAutorisation){
  var d={prenom:f.querySelector("#ind-en-prenom").value.trim().slice(0,40), nom:f.querySelector("#ind-en-nom").value.trim().slice(0,40),
    naissance:f.querySelector("#ind-en-naiss").value||"", note:f.querySelector("#ind-en-note").value.trim().slice(0,300)};
  if(!d.prenom||!d.nom) return {err:"Indique le prénom et le nom de l'enfant."};
  if(!d.naissance) return {err:"Indique la date de naissance de l'enfant."};
  var a=indAge(d.naissance);
  if(a===null) return {err:"Date de naissance de l'enfant invalide."};
  if(a>=18) return {err:"À partir de 18 ans, la personne crée son propre accès avec le lien de son coach."};
  if(exigerAutorisation){
    var c=f.querySelector("#ind-en-auto");
    if(!c||!c.checked) return {err:"L'autorisation parentale est obligatoire pour inscrire un enfant."};
  }
  return {d:d};
}
function indCreerEnfant(parentUid, d){
  var id=indId("e_");
  return window.fbSetDoc(window.fbDoc(indDb(),"indep_clients",id),{prenom:d.prenom, nom:d.nom, naissance:d.naissance, note:d.note,
    parentUid:parentUid, mineur:true, autorisation:true, createdAt:window.fbServerTimestamp()});
}
function indEnfantForm(id){
  var e=id?IND.enfants[id]:null;
  if(id&&!e) return;
  var sh=gmSheet(e?"Fiche de "+(e.prenom||"mon enfant"):"Inscrire un enfant");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var f0=IND.fiche||{};
  sh.body.innerHTML='<form class="ind-f" id="ind-en-f" novalidate>'+indEnfantChamps(e||{nom:f0.nom||""}, !e)
    +'<p class="ind-note">'+(e?'Pour retirer un enfant, préviens ton coach.':'Ton enfant n\'a pas de compte : c\'est toi qui réserves ses séances et qui préviens en cas d\'absence.')+'</p>'
    +'<div class="err" id="ind-en-err"></div><div class="actions"><button type="submit" class="ok">Enregistrer</button></div></form>';
  var f=sh.body.querySelector("#ind-en-f");
  f.addEventListener("submit",function(ev){
    ev.preventDefault();
    var r=indEnfantLire(f,!e); if(r.err){ f.querySelector("#ind-en-err").textContent=r.err; return; }
    var p=e?window.fbUpdateDoc(window.fbDoc(indDb(),"indep_clients",id),r.d):indCreerEnfant(IND.uid,r.d);
    p.then(function(){ sh.modal.remove(); showToast(e?"Fiche enregistrée":"Enfant inscrit"); }).catch(indErr);
  });
}
function indMesEnfantsHtml(){
  var l=Object.keys(IND.enfants).map(function(k){ return IND.enfants[k]; }).filter(function(e){ return e.actif!==false; });
  var h='<div class="ind-k">Mes enfants</div>';
  if(l.length) h+='<div class="ind-c ind-list">'+l.map(function(e){
    var a=indAge(e.naissance);
    return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(e.prenom,e.nom))+'</div><div class="t"><strong>'+indEsc((e.prenom||"")+" "+(e.nom||""))+'</strong><span>'+(a!==null?a+" ans":"")+'</span></div>'
      +'<button type="button" class="ind-btn s mini" data-act="enfant-edit" data-id="'+indEsc(e.id)+'">Modifier</button></div>';
  }).join("")+'</div>';
  return h+'<button type="button" class="ind-btn s" data-act="enfant-ajout">+ Inscrire un enfant</button>';
}
function indMaFiche(){
  var f0=IND.fiche, sh=gmSheet(f0?"Ma fiche":"Complète ta fiche");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.addEventListener("click",indClic);
  var email=(window.ASMB_USER&&window.ASMB_USER.email)||"";
  sh.body.innerHTML='<form class="ind-f" id="ind-fi-f" novalidate>'+indFicheChamps(f0)
    +'<label class="case"><input type="checkbox" id="ind-fi-moi"'+(f0&&f0.parentSeul?"":" checked")+'>Je participe aux séances moi-même</label>'
    +'<p class="ind-note">Connexion : '+indEsc(email)+'</p><div class="err" id="ind-fi-err"></div>'
    +'<div class="actions"><button type="submit" class="ok">Enregistrer</button></div></form>'
    +'<div id="ind-fi-enfants" class="ind-f" style="margin-top:14px"></div>'
    +'<button type="button" class="ind-btn s" id="ind-fi-out" style="margin-top:8px">Se déconnecter</button>';
  var zone=sh.body.querySelector("#ind-fi-enfants");
  function peindreEnfants(){ if(f0) zone.innerHTML=indMesEnfantsHtml(); else zone.innerHTML=""; }
  peindreEnfants();
  if(f0) IND.feuille={s:sh, peindre:peindreEnfants};
  var f=sh.body.querySelector("#ind-fi-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var moi=f.querySelector("#ind-fi-moi").checked;
    var r=indFicheLire(f,email,{moi:moi}); if(r.err){ f.querySelector("#ind-fi-err").textContent=r.err; return; }
    var ref=window.fbDoc(indDb(),"indep_clients",IND.uid);
    var p=f0?window.fbUpdateDoc(ref,r.d):window.fbSetDoc(ref,Object.assign({},r.d,{createdAt:window.fbServerTimestamp()}));
    p.then(function(){ sh.modal.remove(); showToast("Fiche enregistrée"); }).catch(indErr);
  });
  sh.body.querySelector("#ind-fi-out").addEventListener("click",function(){ indStop(); authLogout(); });
}

// ── Clics (délégation : appli et fenêtres du bas) ───────────────────
function indClic(e){
  var el=e.target.closest("[data-act]"); if(!el) return;
  var act=el.dataset.act, id=el.dataset.id;
  if(act==="tab"){ IND.tab=el.dataset.v; IND.luAvant=null; indRendre(); var m=document.querySelector(".main"); if(m) m.scrollTop=0; window.scrollTo(0,0); return; }
  if(act==="seance") return indOuvrirSeance(id);
  if(act==="creneau") return indCreneauForm(id||null);
  if(act==="ponctuelle") return indPonctuelleForm();
  if(act==="client") return indClientFiche(el.dataset.uid);
  if(act==="reglages") return indReglages();
  if(act==="ma-fiche") return indMaFiche();
  if(act==="enfant-ajout") return indEnfantForm(null);
  if(act==="enfant-edit") return indEnfantForm(id);
  if(act==="presence") return indPresence(id, el.dataset.uid);
  if(act==="annuler-seance") return indAnnulerSeance(id);
  if(act==="retablir-seance") return indRetablirSeance(id);
  if(act==="suppr-seance") return indSupprSeance(id);
  if(act==="ajout-seance") return indAjoutSeance(id);
  if(act==="resa") return indResa(id, el.dataset.v, el.dataset.pid);
  if(act==="reac") return indReac(id, el.dataset.v, el.dataset.pid);
  if(act==="disc") return indOuvrirDiscussion(el.dataset.uid||IND.uid);
  if(act==="msgvue"){ IND.msgVue=el.dataset.v; return indRendre(); }
  if(act==="annonce") return indOuvrirAnnonce(id);
  if(act==="annonce-new") return indAnnonceForm();
  if(act==="annonce-suppr") return indSupprAnnonce(id);
  if(act==="annoncer-seance"){ var sa=indSeanceParId(id); return indAnnonceForm({seance:id, cible:(sa&&sa.creneauId)||"tous"}); }
  if(act==="lien-creer") return indCreerLien();
  if(act==="lien-couper") return indCouperLien();
  if(typeof indArgentClic==="function" && indArgentClic(act,el)) return;
  if(act==="lien-copier"){ var l=indLienActif(); if(l) copyToClipboard(indLienUrl(l.code)); return; }
}
document.addEventListener("keydown",function(e){
  if((e.key==="Enter"||e.key===" ") && e.target && e.target.matches && e.target.matches(".ind [role=button][data-act],.ind-t [role=button][data-act]")){ e.preventDefault(); e.target.click(); }
});

// ── Page publique « rejoindre » (?rejoindre=CODE) : création du compte client ──
function indRejoindre(code){
  code=String(code||"").trim().toUpperCase();
  stack=["indep"]; showScr("indep");
  var root=document.getElementById("indep-root"); if(!root) return;
  function cadre(couleur, sur, titre, corps){
    root.innerHTML='<div class="ind" style="--ia:'+(/^#[0-9a-fA-F]{6}$/.test(couleur||"")?couleur:IND_COULEUR)+'">'+indTop(sur,titre,'')
      +'<div class="ind-body" style="padding-bottom:30px">'+corps+'</div></div>';
  }
  cadre("", "Invitation", "Chargement…", '<div class="ind-c ind-vide">Vérification du lien…</div>');
  var essais=0;
  (function attendre(){
    if(!window.fbGetDoc||!window.fbAuth||!window.fbDb){ if(essais++<60) return setTimeout(attendre,100); return cadre("","Invitation","Oups",'<div class="ind-c ind-vide">Connexion impossible. Réessaie dans un instant.</div>'); }
    window.fbGetDoc(window.fbDoc(window.fbDb,"indep_liens",code)).then(function(s){
      if(!s.exists()||!s.data().actif) return cadre("","Invitation","Lien expiré",'<div class="ind-c ind-vide">Ce lien n\'est plus valable. Demande le nouveau lien à ton coach.</div>');
      var l=s.data();
      cadre(l.couleur,"Rejoindre",l.clubName||"Mes séances",
        '<div class="ind-c"><div class="ind-row"><div class="ind-av">'+indEsc(indInitiales((l.clubName||"").split(" ")[0],(l.clubName||"").split(" ")[1]))+'</div><div class="t"><strong>'+indEsc(l.clubName||"Ton coach")+' t\'invite</strong><span>Crée ton accès pour réserver les séances et prévenir ton coach en cas d\'absence. Parent : tu peux inscrire ton enfant.</span></div></div></div>'
        +'<form class="ind-f ind-c" id="ind-rj-f" novalidate>'
        +'<div style="font-size:12px;font-weight:800;color:var(--txt2)">Je m\'inscris pour</div>'
        +'<label class="case"><input type="radio" name="ind-qui" value="moi" checked>Moi</label>'
        +'<label class="case"><input type="radio" name="ind-qui" value="enfant">Mon enfant (moins de 18 ans)</label>'
        +'<label class="case"><input type="radio" name="ind-qui" value="les2">Moi et mon enfant</label>'
        +'<div style="font-size:12px;font-weight:800;color:var(--txt2);margin-top:4px" id="ind-rj-t1">Tes informations</div>'
        +indFicheChamps({})
        +'<div id="ind-rj-enfant" hidden class="ind-f"><div style="font-size:12px;font-weight:800;color:var(--txt2);margin-top:4px">Ton enfant</div>'+indEnfantChamps({}, true)
        +'<p class="ind-note">Tu pourras ajouter d\'autres enfants ensuite, dans « Ma fiche ».</p></div>'
        +'<label>E-mail (pour te connecter)<input id="ind-rj-mail" type="email" inputmode="email" autocapitalize="off" autocomplete="email" maxlength="100"></label>'
        +'<label>Mot de passe<input id="ind-rj-pass" type="password" autocomplete="new-password" minlength="6" placeholder="6 caractères minimum"></label>'
        +'<div class="err" id="ind-rj-err" role="alert"></div>'
        +'<div class="actions"><button type="submit" class="ok" style="background:var(--ia)" id="ind-rj-btn">Créer mon accès</button></div>'
        +'<p class="ind-note" style="text-align:center">Déjà un accès ? <a href="'+indEsc(location.origin+location.pathname)+'" style="color:inherit;font-weight:800">Me connecter</a></p></form>');
      var f=document.getElementById("ind-rj-f");
      function majQui(){
        var qui=f.querySelector("input[name=ind-qui]:checked").value;
        f.querySelector("#ind-rj-enfant").hidden=(qui==="moi");
        f.querySelector("#ind-rj-t1").textContent=qui==="enfant"?"Tes informations (parent)":"Tes informations";
        f.querySelector("#ind-fi-naiss-l").textContent=qui==="enfant"?"Ta date de naissance (facultatif)":"Date de naissance";
      }
      f.querySelectorAll("input[name=ind-qui]").forEach(function(r){ r.addEventListener("change",majQui); });
      majQui();
      f.addEventListener("submit",function(e){ e.preventDefault(); indRejoindreEnvoyer(f, code, l); });
    }).catch(function(){ cadre("","Invitation","Oups",'<div class="ind-c ind-vide">Impossible de vérifier le lien. Réessaie dans un instant.</div>'); });
  })();
}
function indRejoindreEnvoyer(f, code, l){
  var err=f.querySelector("#ind-rj-err"), btn=f.querySelector("#ind-rj-btn");
  var email=f.querySelector("#ind-rj-mail").value.trim(), pass=f.querySelector("#ind-rj-pass").value;
  var qui=f.querySelector("input[name=ind-qui]:checked").value;
  var r=indFicheLire(f,email,{moi:qui!=="enfant"});
  if(r.err){ err.textContent=r.err; return; }
  var enf=null;
  if(qui!=="moi"){ enf=indEnfantLire(f,true); if(enf.err){ err.textContent=enf.err; return; } }
  if(email.indexOf("@")<1){ err.textContent="Indique une adresse e-mail valide."; return; }
  if(pass.length<6){ err.textContent="Mot de passe : 6 caractères minimum."; return; }
  err.textContent=""; btn.disabled=true; btn.textContent="Création de ton accès…";
  var cree=null, compteOk=false;
  window.fbCreateUser(window.fbAuth,email,pass).then(function(cred){
    cree=cred.user;
    return window.fbSetDoc(window.fbDoc(window.fbDb,"users",cred.user.uid),{email:email, phone:"", roles:["client"], clubId:l.clubId, joinCode:code,
      linkedPlayerIds:[], linkedTeamIds:[], permissions:{}, titre:null, createdAt:window.fbServerTimestamp()});
  }).then(function(){
    compteOk=true;
    window.CURRENT_CLUB_ID=l.clubId;
    return window.fbSetDoc(window.fbDoc(window.fbDb,"indep_clients",cree.uid),Object.assign({},r.d,{createdAt:window.fbServerTimestamp()}))
      .then(function(){
        if(!enf) return;
        // L'enfant est inscrit par son parent (autorisation parentale cochée) ; sans compte.
        var id=indId("e_");
        return window.fbSetDoc(window.fbDoc(window.fbDb,"indep_clients",id),{prenom:enf.d.prenom, nom:enf.d.nom, naissance:enf.d.naissance, note:enf.d.note,
          parentUid:cree.uid, mineur:true, autorisation:true, createdAt:window.fbServerTimestamp()});
      })
      .catch(function(e){ console.log("fiche (sera complétée dans l'appli):",e&&e.code); });
  }).then(function(){
    try{ localStorage.setItem("gm_type_"+l.clubId,"independant"); }catch(e){}
    location.href=location.origin+location.pathname;
  }).catch(function(e){
    var c=e&&e.code||"";
    if(cree && !compteOk && c!=="auth/email-already-in-use"){ cree.delete().catch(function(){}); }
    btn.disabled=false; btn.textContent="Créer mon accès";
    if(c==="auth/email-already-in-use") err.textContent="Cette adresse a déjà un accès. Connecte-toi avec, ou utilise une autre adresse.";
    else if(c==="auth/invalid-email") err.textContent="Adresse e-mail invalide.";
    else if(c==="auth/weak-password") err.textContent="Mot de passe trop faible (6 caractères minimum).";
    else if(c==="permission-denied") err.textContent="Ce lien n'est plus valable. Demande le nouveau lien à ton coach.";
    else err.textContent="Création impossible : "+(c||"vérifie ta connexion")+".";
  });
}

// ── Plateforme (super admin) : créer un indépendant ─────────────────
async function createIndepFlow(list){
  var name=await askPrompt("Nom de l'activité de l'indépendant",{placeholder:"Ex. : KS Training",confirmText:"Suivant"});
  if(!name||!name.trim()) return;
  var sport=await askPrompt("Discipline",{defaultValue:"coaching sportif",confirmText:"Créer l'indépendant"});
  if(sport===null) return;
  name=name.trim();
  try{
    var id=await creerClub(name, sport, {type:"independant", couleur:IND_COULEUR.toLowerCase()});
    var code=await createClubInvite(id, name, "dirigeant", null, {structure:"independant"});
    loadClubsList(list);
    showInviteResult(code,"independant",name);
  }catch(e){ askAlert("Erreur lors de la création : "+((e&&e.code)||e)); }
}
