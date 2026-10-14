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
//  indep_notes/{uid}    notes privées de l'indépendant
//  indep_liens/{CODE}   (global) lien d'invitation réutilisable, désactivable

var IND={role:null, uid:null, clubId:null, club:{}, tab:"accueil", creneaux:[], seances:{}, resas:{},
  clients:{}, clientsCharges:false, fiche:null, ficheChargee:false, liens:[], unsubs:[], feuille:null, rendu:false};
var IND_COULEUR="#0E7C7B";
var IND_HORIZON=28;   // jours de séances affichés à l'avance
var IND_PASSE=14;     // jours d'historique chargés
var IND_JOURS=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
var IND_JOURS_C=["dim.","lun.","mar.","mer.","jeu.","ven.","sam."];
var IND_MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
var IND_MOIS_C=["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
var IND_ICONES={
  accueil:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9H3z"/></svg>',
  seances:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  clients:'<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 4.5a3.5 3.5 0 010 7M21 20c0-2.5-1.5-4.6-3.6-5.5"/></svg>',
  reserver:'<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M12 13v4M10 15h4"/></svg>'
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
  if(IND.role==="coach"){
    ecoute(window.fbCollection(db,"indep_clients"),function(sn){
      var m={}; sn.forEach(function(d){ m[d.id]=Object.assign({uid:d.id},d.data()); }); IND.clients=m; IND.clientsCharges=true; indRendre();
    });
    ecoute(window.fbQuery(window.fbCollection(db,"indep_liens"),window.fbWhere("clubId","==",IND.clubId)),function(sn){
      var l=[]; sn.forEach(function(d){ l.push(Object.assign({code:d.id},d.data())); }); IND.liens=l; indRendre();
    });
  } else {
    ecoute(window.fbDoc(db,"indep_clients",IND.uid),function(s){
      IND.fiche=s.exists()?s.data():null; IND.ficheChargee=true; indRendre();
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
function indClientsActifs(){
  return Object.keys(IND.clients).map(function(k){ return IND.clients[k]; }).filter(function(c){ return c.actif!==false; })
    .sort(function(a,b){ return ((a.prenom||"")+(a.nom||"")).localeCompare((b.prenom||"")+(b.nom||"")); });
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
    tabs=[["accueil","Accueil"],["seances","Séances"],["clients","Clients"]];
    var sur={accueil:indDateLong(indAuj()), seances:"Séances", clients:"Mes clients"}[IND.tab]||"";
    h+=indTop(sur, nom, '<button type="button" data-act="reglages" aria-label="Réglages de mon activité">⚙</button>');
    h+='<div class="ind-body">'+(IND.tab==="seances"?indVueSeances():IND.tab==="clients"?indVueClients():indVueAccueil())+'</div>';
  } else {
    tabs=[["accueil","Accueil"],["reserver","Réserver"]];
    var f=IND.fiche||{};
    h+=indTop(nom, IND.tab==="reserver"?"Réserver":"Bonjour"+(f.prenom?" "+f.prenom:""),
      '<button type="button" data-act="ma-fiche" aria-label="Ma fiche">'+indEsc(indInitiales(f.prenom,f.nom))+'</button>');
    if(IND.ficheChargee && !IND.fiche){ h+='<div class="ind-body">'+indVueFicheManquante()+'</div>'; tabs=null; }
    else h+='<div class="ind-body">'+(IND.tab==="reserver"?indVueReserver():indVueAccueilClient())+'</div>';
  }
  if(tabs){
    h+='<nav class="ind-nav" style="grid-template-columns:repeat('+tabs.length+',1fr)">'+tabs.map(function(t){
      return '<button type="button" data-act="tab" data-v="'+t[0]+'" class="'+(IND.tab===t[0]?"on":"")+'"'+(IND.tab===t[0]?' aria-current="page"':'')+'>'+IND_ICONES[t[0]]+t[1]+'</button>';
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
    if(passe && !s.annulee) droite='<button type="button" class="ind-chk'+(x.present===true?" on":"")+'" data-act="presence" data-id="'+indEsc(s.id)+'" data-uid="'+indEsc(x.uid)+'" aria-pressed="'+(x.present===true)+'" aria-label="Présent : '+indEsc(indNom(x.uid,x.nom))+'">✓</button>';
    else droite=x.statut==="vient"?'<span class="ind-pill ok">Vient</span>':'<span class="ind-pill no">Absent</span>';
    var c=IND.clients[x.uid]||{};
    return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(c.prenom||x.nom,c.nom))+'</div><div class="t"><strong>'+indEsc(indNom(x.uid,x.nom))+'</strong><span>'
      +(x.statut==="absent"?"A prévenu de son absence":(x.habitue?"Habitué":"Inscrit à cette séance"))+'</span></div>'+droite+'</div>';
  }
  h+='<div class="ind-k">'+(passe?"Présences · habitués":"Habitués")+'</div>';
  h+=hab.length?'<div class="ind-c ind-list">'+hab.map(ligne).join("")+'</div>':'<div class="ind-c ind-vide">Aucun habitué sur ce créneau.</div>';
  h+='<div class="ind-k">Inscrits à cette séance</div>';
  h+=aut.length?'<div class="ind-c ind-list">'+aut.map(ligne).join("")+'</div>':'<div class="ind-c ind-vide">'+(s.ouvert?"Personne pour l'instant. Tes clients réservent depuis leur appli.":"Ce créneau n'est pas ouvert aux inscriptions.")+'</div>';
  h+='<div class="ind-btns" style="margin-top:4px">';
  if(!s.annulee) h+='<button type="button" class="ind-btn s" data-act="ajout-seance" data-id="'+indEsc(s.id)+'">+ Ajouter un client</button>'
    +'<button type="button" class="ind-btn d" data-act="annuler-seance" data-id="'+indEsc(s.id)+'">Annuler la séance</button>';
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
}
function indAnnulerSeance(sid){
  var s=indSeanceParId(sid); if(!s) return;
  askPrompt("Motif de l'annulation (facultatif)",{placeholder:"Ex. : pluie, gymnase fermé",confirmText:"Annuler la séance"}).then(function(m){
    if(m===null) return;
    var d={date:s.date, annulee:true, motif:String(m||"").trim().slice(0,120)};
    if(s.creneauId) d.creneauId=s.creneauId;
    window.fbSetDoc(window.fbDoc(indDb(),"indep_seances",sid),d,{merge:true}).then(function(){ showToast("Séance annulée"); }).catch(indErr);
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
    return '<div class="ind-row"><div class="ind-av">'+indEsc(indInitiales(c.prenom,c.nom))+'</div><div class="t"><strong>'+indEsc((c.prenom||"")+" "+(c.nom||""))+'</strong></div>'
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
    +(clients.length?clients.map(function(x){ return '<label class="case"><input type="checkbox" class="ind-cr-hab" value="'+indEsc(x.uid)+'"'+(hab[x.uid]?" checked":"")+'>'+indEsc((x.prenom||"")+" "+(x.nom||""))+'</label>'; }).join("")
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
    var sous=[age!==null?age+" ans":"", crs.length?crs.map(function(x){ return IND_JOURS_C[Number(x.jour)]+" "+(x.heure||""); }).join(", "):"Pas d'habitude"].filter(Boolean).join(" · ");
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
  sh.body.innerHTML='<div class="ind-c ind-list">'
    +'<div class="ind-row"><div class="t"><strong>Âge</strong><span>'+(age!==null?age+" ans · né(e) le "+indEsc(indDate(c.naissance).toLocaleDateString("fr-FR")):"Non renseigné")+'</span></div></div>'
    +'<div class="ind-row"><div class="t"><strong>Téléphone</strong><span>'+indEsc(c.tel||"Non renseigné")+'</span></div>'
      +(tel?'<a class="ind-btn s mini" style="text-decoration:none" href="tel:'+indEsc(tel)+'">Appeler</a>':'')+'</div>'
    +'<div class="ind-row"><div class="t"><strong>E-mail</strong><span>'+indEsc(c.email||"Non renseigné")+'</span></div></div>'
    +(c.note?'<div class="ind-row"><div class="t"><strong>À savoir (écrit par le client)</strong><span>'+indEsc(c.note)+'</span></div></div>':'')
    +'</div>'
    +'<div class="ind-k">Habitué de</div>'
    +(crs.length?'<div class="ind-c ind-f" style="gap:6px">'+crs.map(function(x){
      return '<label class="case"><input type="checkbox" data-cr="'+indEsc(x.id)+'"'+((x.habitues||[]).indexOf(uid)>=0?" checked":"")+'>'+indEsc(IND_JOURS[Number(x.jour)]+" "+(x.heure||"")+" · "+(x.titre||""))+'</label>';
    }).join("")+'</div>':'<div class="ind-c ind-vide">Aucun créneau pour l\'instant.</div>')
    +'<div class="ind-k">Notes privées (lui ne les voit pas)</div>'
    +'<div class="ind-f"><textarea id="ind-cl-notes" maxlength="1000" placeholder="Objectifs, niveau, blessures…"></textarea>'
    +'<div class="actions"><button type="button" class="ok" id="ind-cl-save">Enregistrer les notes</button></div></div>'
    +'<button type="button" class="ind-btn d" style="margin-top:14px" id="ind-cl-retirer">Retirer ce client</button>';
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
    askConfirm("Son accès à l'appli est supprimé et il sort de tes créneaux. Sa fiche est gardée dans ton historique.",{title:"Retirer "+(c.prenom||"ce client")+" ?",confirmText:"Retirer",danger:true}).then(function(ok){
      if(!ok) return;
      var b=window.fbWriteBatch();
      IND.creneaux.forEach(function(x){ if((x.habitues||[]).indexOf(uid)>=0) b.update(window.fbDoc(indDb(),"indep_creneaux",x.id),{habitues:window.fbArrayRemove(uid)}); });
      b.update(window.fbDoc(indDb(),"indep_clients",uid),{actif:false, retireLe:Date.now()});
      b.delete(window.fbDoc(indDb(),"users",uid));
      b.commit().then(function(){ sh.modal.remove(); showToast("Client retiré"); }).catch(indErr);
    });
  });
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
function indMesSeances(de,a){
  return indSeances(de,a).filter(function(s){
    if((s.habitues||[]).indexOf(IND.uid)>=0) return true;
    var r=IND.resas[s.id+"__"+IND.uid]; return !!(r && r.statut==="vient");
  });
}
function indMonStatut(s){
  var r=IND.resas[s.id+"__"+IND.uid];
  if(r) return r.statut;
  return (s.habitues||[]).indexOf(IND.uid)>=0?"vient":null;
}
function indBlocMaSeance(s, grand){
  var st=indMonStatut(s), fini=indCommencee(s), n=indNbVenants(s);
  var h='<div class="ind-c"><div class="ind-row"><div class="t"><strong>'+indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong><span>'
    +indEsc([s.lieu, s.places?n+" / "+s.places+" inscrits":n+" inscrit"+(n>1?"s":"")].filter(Boolean).join(" · "))+'</span></div>'
    +(s.annulee?'<span class="ind-pill no">Annulée</span>':(fini?(st==="vient"?'<span class="ind-pill ok">Je viens</span>':st==="absent"?'<span class="ind-pill no">Absent</span>':''):''))+'</div>';
  if(s.annulee) h+=(s.motif?'<p class="ind-note" style="margin-top:8px">Motif : '+indEsc(s.motif)+'</p>':'');
  else if(!fini && (grand||st)){
    h+='<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn '+(st==="vient"?"p":"s")+'" data-act="resa" data-v="vient" data-id="'+indEsc(s.id)+'" aria-pressed="'+(st==="vient")+'">'+(st==="vient"?"✓ Je viens":"Je viens")+'</button>'
      +'<button type="button" class="ind-btn '+(st==="absent"?"d":"s")+'" data-act="resa" data-v="absent" data-id="'+indEsc(s.id)+'" aria-pressed="'+(st==="absent")+'">'+(st==="absent"?"✕ Je ne peux pas":"Je ne peux pas")+'</button></div>';
  }
  return h+'</div>';
}
function indVueAccueilClient(){
  var a=indAuj(), mes=indMesSeances(a,indAjout(a,21)).filter(function(s){ return !indCommencee(s)||s.date===a; }), h="";
  if(!mes.length){
    h+='<div class="ind-c ind-vide">Aucune séance prévue pour toi.<br>Réserve une séance ouverte, ou demande à ton coach de t\'ajouter comme habitué.</div>'
      +'<button type="button" class="ind-btn p" data-act="tab" data-v="reserver">Réserver une séance</button>';
    return h;
  }
  h+='<div class="ind-k">Ma prochaine séance</div>'+indBlocMaSeance(mes[0],true);
  if(mes.length>1) h+='<div class="ind-k">Ensuite</div>'+mes.slice(1,8).map(function(s){ return indBlocMaSeance(s,false); }).join("");
  h+='<p class="ind-note">Tu ne peux pas venir ? Préviens ici avant le début : ta place est libérée pour un autre client.</p>';
  return h;
}
// ── Client : Réserver ───────────────────────────────────────────────
function indVueReserver(){
  var a=indAuj(), l=indSeances(a,indAjout(a,IND_HORIZON)).filter(function(s){
    return s.ouvert && !s.annulee && !indCommencee(s) && (s.habitues||[]).indexOf(IND.uid)<0;
  });
  if(!l.length) return '<div class="ind-c ind-vide">Aucune séance ouverte à la réservation pour l\'instant.</div>';
  return '<div class="ind-k">Séances ouvertes</div><div class="ind-c ind-list">'+l.map(function(s){
    var st=indMonStatut(s), n=indNbVenants(s), reste=s.places?s.places-n:null, btn;
    if(st==="vient") btn='<button type="button" class="ind-btn s mini" data-act="resa" data-v="absent" data-id="'+indEsc(s.id)+'">Annuler</button>';
    else if(reste!==null && reste<=0) btn='<span class="ind-pill no">Complet</span>';
    else btn='<button type="button" class="ind-btn p mini" data-act="resa" data-v="vient" data-id="'+indEsc(s.id)+'">Réserver</button>';
    var sous=[s.lieu, (reste!==null&&reste>0)?reste+" place"+(reste>1?"s":"")+" restante"+(reste>1?"s":""):"", indPrix(s.prix)].filter(Boolean).join(" · ");
    return '<div class="ind-row"><div class="t"><strong>'+indEsc(indQuand(s.date)+" · "+(s.heure||"")+" · "+s.titre)+'</strong><span>'+indEsc(sous)+'</span></div>'
      +(st==="vient"?'<span class="ind-pill ok">Réservé</span>':'')+btn+'</div>';
  }).join("")+'</div>';
}
function indResa(sid,statut){
  var s=indSeanceParId(sid); if(!s) return;
  if(s.annulee) return askAlert("Cette séance est annulée.");
  if(indCommencee(s)) return askAlert("La séance a déjà commencé : préviens ton coach directement.");
  if(statut==="vient" && indMonStatut(s)!=="vient" && indComplet(s)) return askAlert("Désolé, la séance est complète.");
  var k=sid+"__"+IND.uid, d={seance:sid, date:s.date, uid:IND.uid, statut:statut, nom:indMonNom()||"Client", at:window.fbServerTimestamp()};
  var avant=IND.resas[k];
  IND.resas[k]=Object.assign({},avant||{},{seance:sid, date:s.date, uid:IND.uid, statut:statut}); indRendre();
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
    +'<div class="deux"><label>Date de naissance<input id="ind-fi-naiss" type="date" max="'+indAuj()+'" value="'+indEsc(f.naissance||"")+'"></label>'
    +'<label>Téléphone<input id="ind-fi-tel" type="tel" maxlength="20" autocomplete="tel" value="'+indEsc(f.tel||"")+'"></label></div>'
    +'<label>À savoir pour le coach (facultatif)<textarea id="ind-fi-note" maxlength="300" placeholder="Blessure, objectif, niveau…">'+indEsc(f.note||"")+'</textarea></label>';
}
function indFicheLire(f,email){
  var d={prenom:f.querySelector("#ind-fi-prenom").value.trim().slice(0,40), nom:f.querySelector("#ind-fi-nom").value.trim().slice(0,40),
    naissance:f.querySelector("#ind-fi-naiss").value||"", tel:f.querySelector("#ind-fi-tel").value.trim().slice(0,20),
    email:String(email||"").slice(0,100), note:f.querySelector("#ind-fi-note").value.trim().slice(0,300)};
  if(!d.prenom||!d.nom) return {err:"Indique ton prénom et ton nom."};
  if(!d.naissance) return {err:"Indique ta date de naissance."};
  if(d.tel.replace(/[^0-9]/g,"").length<9) return {err:"Indique un numéro de téléphone valide."};
  return {d:d};
}
function indMaFiche(){
  var f0=IND.fiche, sh=gmSheet(f0?"Ma fiche":"Complète ta fiche");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var email=(window.ASMB_USER&&window.ASMB_USER.email)||"";
  sh.body.innerHTML='<form class="ind-f" id="ind-fi-f" novalidate>'+indFicheChamps(f0)
    +'<p class="ind-note">Connexion : '+indEsc(email)+'</p><div class="err" id="ind-fi-err"></div>'
    +'<div class="actions"><button type="submit" class="ok">Enregistrer</button></div>'
    +'<button type="button" class="ind-btn s" id="ind-fi-out" style="margin-top:8px">Se déconnecter</button></form>';
  var f=sh.body.querySelector("#ind-fi-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var r=indFicheLire(f,email); if(r.err){ f.querySelector("#ind-fi-err").textContent=r.err; return; }
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
  if(act==="tab"){ IND.tab=el.dataset.v; indRendre(); var m=document.querySelector(".main"); if(m) m.scrollTop=0; window.scrollTo(0,0); return; }
  if(act==="seance") return indOuvrirSeance(id);
  if(act==="creneau") return indCreneauForm(id||null);
  if(act==="ponctuelle") return indPonctuelleForm();
  if(act==="client") return indClientFiche(el.dataset.uid);
  if(act==="reglages") return indReglages();
  if(act==="ma-fiche") return indMaFiche();
  if(act==="presence") return indPresence(id, el.dataset.uid);
  if(act==="annuler-seance") return indAnnulerSeance(id);
  if(act==="retablir-seance") return indRetablirSeance(id);
  if(act==="suppr-seance") return indSupprSeance(id);
  if(act==="ajout-seance") return indAjoutSeance(id);
  if(act==="resa") return indResa(id, el.dataset.v);
  if(act==="lien-creer") return indCreerLien();
  if(act==="lien-couper") return indCouperLien();
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
        '<div class="ind-c"><div class="ind-row"><div class="ind-av">'+indEsc(indInitiales((l.clubName||"").split(" ")[0],(l.clubName||"").split(" ")[1]))+'</div><div class="t"><strong>'+indEsc(l.clubName||"Ton coach")+' t\'invite</strong><span>Crée ton accès pour réserver tes séances et prévenir ton coach si tu ne peux pas venir.</span></div></div></div>'
        +'<form class="ind-f ind-c" id="ind-rj-f" novalidate>'+indFicheChamps({})
        +'<label>E-mail (pour te connecter)<input id="ind-rj-mail" type="email" inputmode="email" autocapitalize="off" autocomplete="email" maxlength="100"></label>'
        +'<label>Mot de passe<input id="ind-rj-pass" type="password" autocomplete="new-password" minlength="6" placeholder="6 caractères minimum"></label>'
        +'<div class="err" id="ind-rj-err" role="alert"></div>'
        +'<div class="actions"><button type="submit" class="ok" style="background:var(--ia)" id="ind-rj-btn">Créer mon accès</button></div>'
        +'<p class="ind-note" style="text-align:center">Déjà un accès ? <a href="'+indEsc(location.origin+location.pathname)+'" style="color:inherit;font-weight:800">Me connecter</a></p></form>');
      var f=document.getElementById("ind-rj-f");
      f.addEventListener("submit",function(e){ e.preventDefault(); indRejoindreEnvoyer(f, code, l); });
    }).catch(function(){ cadre("","Invitation","Oups",'<div class="ind-c ind-vide">Impossible de vérifier le lien. Réessaie dans un instant.</div>'); });
  })();
}
function indRejoindreEnvoyer(f, code, l){
  var err=f.querySelector("#ind-rj-err"), btn=f.querySelector("#ind-rj-btn");
  var email=f.querySelector("#ind-rj-mail").value.trim(), pass=f.querySelector("#ind-rj-pass").value;
  var r=indFicheLire(f,email);
  if(r.err){ err.textContent=r.err; return; }
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
      .catch(function(e){ console.log("fiche client (sera complétée dans l'appli):",e&&e.code); });
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
