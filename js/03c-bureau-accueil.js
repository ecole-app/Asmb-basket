/* ===== 03c-bureau-accueil.js — Version ordinateur : accueil du dirigeant ===== */
// Sur grand écran (html.gm-desk), l'Accueil devient un tableau de bord pleine
// largeur : chiffres clés, « À faire », événements à inscription, prochains
// rendez-vous, raccourcis. Sur téléphone, l'accueil habituel ne change pas.
// Rendu dans #desk-home (scr-portal) ; le reste de l'écran est masqué en CSS.

function deskJour(iso){ var d=new Date(iso+"T12:00:00"); return isNaN(d)?{j:"",n:""}:{j:["DIM","LUN","MAR","MER","JEU","VEN","SAM"][d.getDay()],n:d.getDate(),m:d.toLocaleDateString("fr-FR",{month:"short"})}; }
function deskCarte(titre, val, sous, onclick, ton){
  return '<button type="button" class="dk-kpi" onclick="'+onclick+'">'+
    '<div class="dk-kpi-t">'+authEsc(titre)+'</div>'+
    '<div class="dk-kpi-v"'+(ton?' style="color:'+ton+'"':'')+'>'+authEsc(String(val))+'</div>'+
    '<div class="dk-kpi-s">'+sous+'</div></button>';
}
function renderDeskHome(){
  var box=document.getElementById("desk-home"); if(!box) return;
  if(!document.documentElement.classList.contains("gm-desk")){ box.innerHTML=""; return; }
  var auj=new Date().toISOString().slice(0,10), saison=getCurrentSeason();
  var club=(typeof clubLabel==="function")?clubLabel(""):"";
  var players=(typeof getPlayers==="function")?getPlayers():[];
  var lics=(typeof getLicences==="function")?getLicences().filter(function(l){ return !l.saison||l.saison>=saison; }):[];
  var aValider=lics.filter(function(l){return l.statut==="recue";}).length;
  var envoyees=lics.filter(function(l){return l.statut==="envoyee"||l.statut==="ouverte";}).length;
  var impayes=lics.filter(function(l){ var s=(typeof licenceStatutPaiement==="function")?licenceStatutPaiement(l):null; return s==="impaye"||s==="partiel"; });
  var aRelancer=impayes.filter(function(l){ return typeof licencePeutRelancer==="function"&&licencePeutRelancer(l); }).length;
  var chq=(typeof chqTous==="function")?chqTous().filter(function(x){ return x.c.statut!=="depose"&&x.c.encaissement<=auj; }):[];
  var events=(typeof getVisibleEvents==="function")?getVisibleEvents():[];
  var in7=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  var semaine=events.filter(function(e){ return !e.cancelled&&e.date>=auj&&e.date<=in7; });
  var matchs=semaine.filter(function(e){return e.type==="match";}).length;
  var attente=(typeof getPendingEvents==="function")?getPendingEvents().length:0;
  var essais=(typeof ESSAIS_NOUVEAUX!=="undefined")?ESSAIS_NOUVEAUX:0;
  var dir=((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0;
  var premium=typeof hasPremium==="function"&&hasPremium();

  // Chiffres clés
  var k='<div class="dk-kpis">';
  k+=deskCarte("Licenciés",players.length,aValider?'<b style="color:#E8670A">'+aValider+' fiche'+(aValider>1?'s':'')+' à valider</b>':(envoyees?envoyees+" fiche"+(envoyees>1?"s":"")+" en cours":"Saison "+authEsc(saison)),"gmDeskOuvrir('licences')");
  k+=deskCarte("Paiements en attente",impayes.length,(aRelancer?'<b style="color:#b45309">'+aRelancer+' relance'+(aRelancer>1?'s':'')+' possible'+(aRelancer>1?'s':'')+'</b>':"Licences suivies")+(chq.length?' · '+chq.length+' chèque'+(chq.length>1?'s':'')+' à déposer':''),"gmDeskOuvrir('licences')",impayes.length?"#b45309":null);
  k+=deskCarte("Demandes d'essai",essais,essais?"à rappeler par SMS":"Aucune nouvelle demande","ouvrirListeEssais()",essais?"#E8670A":null);
  k+=deskCarte("Cette semaine",semaine.length,matchs?matchs+" match"+(matchs>1?"s":"")+" · "+(semaine.length-matchs)+" autre"+(semaine.length-matchs>1?"s":""):"rendez-vous au planning","gmDeskOuvrir('planning')");
  if(dir&&premium&&typeof getComptabilite==="function"){
    var exD=(typeof comptaExerciceCourant==="function")?comptaExerciceCourant():null;
    var y=exD?exD.label:new Date().getFullYear().toString(), r=0, d=0;
    getComptabilite().forEach(function(l){ var dt=l.date||""; if(l.horsPremium||(exD?(dt<exD.debut||dt>exD.fin):dt.indexOf(y)!==0)) return; if(l.type==="depense") d+=l.montant||0; else r+=l.montant||0; });
    k+=deskCarte("Résultat "+y,(r-d).toFixed(0)+" €",(r).toFixed(0)+" € de recettes · "+d.toFixed(0)+" € de dépenses","gmDeskOuvrir('comptabilite')",(r-d)<0?"var(--red)":null);
  }
  k+='</div>';

  // À faire
  var todo=[];
  if(aValider) todo.push(["#E8670A",aValider+" fiche"+(aValider>1?"s":"")+" d'inscription à valider","Valider","gmDeskOuvrir('licences')"]);
  if(essais) todo.push(["#E8670A",essais+" demande"+(essais>1?"s":"")+" de séance d'essai","Répondre","ouvrirListeEssais()"]);
  if(chq.length) todo.push(["#1A2E5A",chq.length+" chèque"+(chq.length>1?"s":"")+" à déposer en banque ("+chq.reduce(function(s,x){return s+x.c.montant;},0).toFixed(0)+" €)","Remise","ouvrirRemiseBanque()"]);
  if(aRelancer) todo.push(["#b45309",aRelancer+" famille"+(aRelancer>1?"s":"")+" à relancer pour un paiement","Voir","gmDeskOuvrir('licences')"]);
  if(attente) todo.push(["#8E44AD",attente+" événement"+(attente>1?"s":"")+" proposé"+(attente>1?"s":"")+" par un coach","Valider","gmDeskOuvrir('planning')"]);
  var t='<section class="dk-card"><h2>À faire</h2>';
  t+=todo.length?todo.map(function(x){
    return '<div class="dk-todo"><span class="dk-dot" style="background:'+x[0]+'"></span><span class="dk-todo-t">'+authEsc(x[1])+'</span><button type="button" class="dk-btn" onclick="'+x[3]+'">'+authEsc(x[2])+'</button></div>';
  }).join(""):'<div class="dk-vide">Rien en attente. Tout est à jour.</div>';
  t+='</section>';

  // Événements à inscription
  var ins=events.filter(function(e){ return e.inscr&&e.inscr.actif&&(e.dateFin||e.date)>=auj; }).sort(function(a,b){return a.date>b.date?1:-1;}).slice(0,4);
  var ev='';
  if(ins.length){
    ev='<section class="dk-card"><h2>Inscriptions en cours</h2>'+ins.map(function(e){
      return '<div class="dk-evt"><div style="min-width:0;flex:1"><div class="dk-evt-t">'+authEsc(e.titre||"")+'</div>'+
        '<div class="dk-evt-s">'+authEsc(typeof evtDateTxt==="function"?evtDateTxt(e):e.date)+' · <span class="dk-nb" data-eid="'+authEsc(e.id)+'">…</span></div></div>'+
        '<button type="button" class="dk-btn" onclick="evtTableau(\''+authEsc(e.id)+'\')">Inscrits</button>'+
        '<button type="button" class="dk-btn dk-btn-ghost" onclick="evtAffiche(\''+authEsc(e.id)+'\')">Affiche</button></div>';
    }).join("")+'</section>';
  }

  // Prochains rendez-vous
  var proch=events.filter(function(e){ return !e.cancelled&&e.date>=auj; }).sort(function(a,b){ return a.date>b.date?1:a.date<b.date?-1:String(a.heure||"").localeCompare(String(b.heure||"")); }).slice(0,7);
  var rv='<section class="dk-card"><h2>Prochains rendez-vous</h2>';
  rv+=proch.length?proch.map(function(e){
    var j=deskJour(e.date);
    return '<button type="button" class="dk-rv" onclick="gmDeskOuvrir(\'planning\')"><div class="dk-rv-d"><div class="dk-rv-j">'+j.j+'</div><div class="dk-rv-n">'+j.n+'</div><div class="dk-rv-m">'+authEsc(j.m||"")+'</div></div>'+
      '<div style="min-width:0;flex:1;text-align:left"><div class="dk-rv-t"><span class="dk-tag" style="background:'+eventTypeColor(e.type)+'">'+authEsc(eventTypeLabel(e.type))+'</span>'+authEsc(e.titre||"")+'</div>'+
      '<div class="dk-rv-s">'+authEsc([e.heure,e.lieu,e.equipe].filter(Boolean).join(" · "))+'</div></div></button>';
  }).join(""):'<div class="dk-vide">Aucun rendez-vous à venir.</div>';
  rv+='<button type="button" class="dk-lien" onclick="gmDeskOuvrir(\'planning\')">Tout le planning →</button></section>';

  var rac='<section class="dk-card"><h2>Raccourcis</h2><div class="dk-rac">'+
    '<button type="button" onclick="showNewLicence()">+ Fiche d\'inscription</button>'+
    '<button type="button" onclick="gmDeskOuvrir(\'planning\');setTimeout(function(){if(typeof showAddEvent===\'function\')showAddEvent();},50)">+ Événement</button>'+
    '<button type="button" onclick="openCalendrier()">Calendrier</button>'+
    '<button type="button" onclick="openAnnuaire()">Annuaire</button>'+
    '<button type="button" onclick="openGalerie()">Galerie photos</button>'+
    '<button type="button" onclick="gmDeskOuvrir(\'formation\')">Formation</button>'+
  '</div></section>';

  var date=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  box.innerHTML=
    '<div class="dk-head"><div><h1>Accueil</h1><div class="dk-sub">'+authEsc(club)+' · saison '+authEsc(saison)+' · '+authEsc(date)+'</div></div>'+
      '<div class="dk-head-act"><button type="button" class="dk-cta" onclick="gmDeskOuvrir(\'planning\');setTimeout(function(){if(typeof showAddEvent===\'function\')showAddEvent();},50)">+ Événement</button>'+
      '<button type="button" class="dk-cta dk-cta-main" onclick="showNewLicence()">+ Fiche d\'inscription</button></div></div>'+
    k+
    '<div class="dk-cols"><div class="dk-col-a">'+t+ev+rac+'</div><div class="dk-col-b">'+rv+'</div></div>';

  // Compteurs d'inscrits (lecture des pages publiques)
  if(window.fbGetDoc&&typeof evtPageId==="function"){
    Array.prototype.forEach.call(box.querySelectorAll(".dk-nb"),function(sp){
      var e=ins.find(function(x){return String(x.id)===sp.dataset.eid;});
      window.fbGetDoc(window.fbDoc(window.fbDb,"evt_pages",evtPageId(sp.dataset.eid))).then(function(s){
        var nb=s.exists()?(s.data().nb||0):0, pl=(e&&!e.inscr.parJour&&e.inscr.places)||0;
        sp.textContent=nb+(pl?" / "+pl:"")+" inscrit"+(nb>1?"s":"");
      }).catch(function(){ sp.textContent=""; });
    });
  }
  // Nombre de demandes d'essai (chargé à part)
  if(typeof ESSAIS_TS!=="undefined"&&Date.now()-ESSAIS_TS>60000&&window.fbGetDocs&&window.fbQuery){
    ESSAIS_TS=Date.now();
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"essais"),window.fbWhere("statut","==","nouvelle")))
      .then(function(s){ var n=0; s.forEach(function(){n++;}); if(n!==ESSAIS_NOUVEAUX){ ESSAIS_NOUVEAUX=n; renderDeskHome(); } }).catch(function(){});
  }
}
