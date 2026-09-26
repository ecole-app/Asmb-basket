/* ===== 03-nav-portal.js — Navigation, routage entre ecrans, portail d'accueil ===== */
// ═══ COMPLETION ══════════════════════════════════════════════════
function getDone(){try{return JSON.parse(localStorage.getItem("asmb_done")||"{}");}catch(e){return {};}}
function isDone(cyId,sNum){return !!getDone()[cyId+"-"+sNum];}
function toggleDone(cyId,sNum){
 var d=getDone();d[cyId+"-"+sNum]=!d[cyId+"-"+sNum];
 localStorage.setItem("asmb_done",JSON.stringify(d));
 buildCycle(findCycle(cyId));
 var btn=document.getElementById("done-btn");
 if(btn){var done=isDone(cyId,sNum);btn.textContent=done?"✓ Séance terminée":"○ Marquer comme terminée";btn.className="done-btn"+(done?" active":"");}
}
function cycleProgress(cyId){
 var cy=findCycle(cyId);if(!cy)return null;
 var d=getDone(),done=0;
 cy.seas.forEach(function(s){if(d[cyId+"-"+s.num])done++;});
 return {done:done,total:cy.seas.length};
}

// ═══ NAV ═════════════════════════════════════════════════════════
var stack=["portal"],curCy=null,curSea=null;
// Couleurs et libellés partages pour differencier visuellement les types d'evenement
// (utilise partout ou des evenements sont affiches : Calendrier, onglet Evenements, etc.)
var EVENT_TYPE_COLORS={"match":"#C0392B","entrainement":"#1A2E5A","tournoi":"#E8670A","stage":"#8E44AD","formation":"#0B7285","autre":"#8E44AD"};
var EVENT_TYPE_LABELS={"match":"Match","entrainement":"Entraînement","tournoi":"Tournoi","stage":"Stage/Camp","formation":"Formation","autre":"Événement"};
function eventTypeColor(type){ return EVENT_TYPE_COLORS[type]||"#8E44AD"; }
function eventTypeLabel(type){ return EVENT_TYPE_LABELS[type]||(type?type.charAt(0).toUpperCase()+type.slice(1):"Événement"); }

var ROOTS=["portal","plan","admin-login","inscription","communaute","auth","role-select","team-picker","parent-home","parent-equipe","parent-events","parent-stats","coach-equipe","elite","tutoriel","joueur","plateforme"];

function showScr(id){
 document.querySelectorAll(".scr").forEach(function(s){s.classList.remove("on");});
 var el=document.getElementById("scr-"+id);
 if(el)el.classList.add("on");
 document.querySelectorAll(".bni").forEach(function(b){b.classList.remove("on");});
 var profile=localStorage.getItem("asmb_profile");
 var navKey=null;
 if(profile==="parent"){
   var parentMap={"parent-home":"portal",portal:"portal","parent-equipe":"eq","parent-events":"ev","parent-stats":"stats",communaute:"p-communaute",chat:"p-communaute"};
   navKey=parentMap[id]||"portal";
 } else if(profile==="coach"){
   var coachMap={"coach-equipe":"c-equipe","player-history":"c-equipe",elite:"c-formation",u13home:"c-formation",cycle:"c-formation",seance:"c-formation","pole-competition":"c-competition","pole-evenement":"c-evenements",communaute:"c-communaute",chat:"c-communaute"};
   navKey=coachMap[id]||"c-equipe";
 } else {
   var map={"auth":"auth","role-select":"role-select","team-picker":"team-picker","parent-equipe":"portal","parent-events":"portal","parent-stats":"portal",portal:"portal",plan:"plan",elite:"plan",u13home:"plan",cycle:"plan",seance:"plan","communaute":"communaute","chat":"communaute","admin-comm":"admin","channel-detail":"admin","parametres":"admin","pole-elite":"portal","pole-competition":"portal","pole-3x3":"portal","pole-evenement":"portal","pole-basketpourtous":"portal","admin-login":"admin",admin:"admin",licences:"admin","licence-detail":"admin",inscriptions:"admin",equipes:"admin",planning:"admin",documents:"admin","live-eval":"admin",inscription:"inscription"};
   navKey=map[id]||"portal";
 }
 var nb=navKey?document.getElementById("bni-"+navKey):null;
 if(nb)nb.classList.add("on");
 document.getElementById("hbk").classList.toggle("show", stack.length>1 && !ROOTS.includes(id));
 var navEl=document.getElementById("bnav-main");
 if(navEl)navEl.style.display=(id==="role-select"||id==="auth"||id==="plateforme")?"none":"flex";
 document.querySelector(".main").scrollTop=0;
 refreshHeaderProfileBtn();
 updateHdr(id);
 if(id==="portal"||id==="parent-home"||id==="coach-equipe"){
   setTimeout(maybeShowDailyThemeAnimation, 60);
 }
}
// Nom du club actif : jamais de nom de club écrit en dur dans l'interface,
// sinon un autre club verrait « ASMB » dans son propre header.
function clubTitle(){ return (window.CURRENT_CLUB && window.CURRENT_CLUB.name) || ""; }
function clubSubtitle(){ return (window.CURRENT_CLUB && window.CURRENT_CLUB.subtitle) || ""; }

// Remplit les emplacements du nom du club (.js-club-name) et rafraîchit le
// header. Appelé quand la fiche du club est chargée : elle arrive en asynchrone,
// donc ces emplacements restent vides jusque-là plutôt que d'afficher un nom figé.
function applyClubLabels(){
  var n=clubTitle();
  try{
    document.querySelectorAll(".js-club-name").forEach(function(el){ el.textContent=n; });
    if(typeof stack!=="undefined" && stack.length) updateHdr(stack[stack.length-1]);
  }catch(e){}
}

function updateHdr(id){
 var t=document.getElementById("htit"),s=document.getElementById("hsub");
 var club=clubTitle();
 var map={"auth":["Connexion",""],"plateforme":["Plateforme","General Manager · Clubs"],"role-select":["Bienvenue",""],"joueur":["Espace Joueur","Pointage du jour"],"team-picker":["Mes équipes","Sélection"],"parent-equipe":["Équipe",""],"parent-events":["Événements",""],"parent-stats":["Stats",""],"parent-params":["Paramètres","Mes préférences"],"coach-equipe":["Mon équipe",""],"parent-home":[club,clubSubtitle()],"matchday":["Jour de match",""],"annuaire":["Annuaire","Contacts du club"],"galerie":["Galerie","Photos du club"],"calendrier":["Calendrier","Semaine · Entraînements et matchs"],"classement":["Classement","Poule · Position du club"],portal:[club,clubSubtitle()],elite:["Pôle Formation","Planification"],u13home:["U13 Féminin","Saison "+getCurrentSeason()],cycle:curCy?[curCy.sh,curCy.p]:["Cycle",""],seance:curSea?["Séance "+curSea.num,curSea.t]:["Séance",""],"pole-elite":["Élite Academy","Sessions · Participants"],"pole-competition":["Compétition 5x5","Équipes · Matchs · Joueurs"],"pole-3x3":["3x3","Équipes · Tournois"],"pole-evenement":["Événements","Organisation · Tournois"],"pole-basketpourtous":["Basket Pour Tous","Groupes · Séances"],"parametres":["Paramètres","Configuration"],"admin-comm":["Communauté","Gestion des canaux"],"channel-detail":["Membres","Gestion des accès"],"communaute":["Communauté",club?(club+" · Messagerie"):"Messagerie"],"chat":[currentChannelData?currentChannelData.name:"Chat",currentChannelData?currentChannelData.desc:""],"admin-login":["Connexion","Espace Responsables"],admin:["Espace Admin",club?(club+" · Responsables"):"Responsables"],licences:["Licences","Suivi des fiches"],"licence-detail":["Détail fiche","Licence du club"],inscriptions:["Inscriptions","Gestion des joueurs"],equipes:["Équipes","Composition et staff"],planning:["Planning","Salles · Créneaux · Matchs"],"live-eval":["Évaluation",""],"player-history":["Historique joueur",""],documents:["Documents","Fichiers et formulaires"],comptabilite:["Comptabilité","Recettes · Dépenses"],inventaire:["Inventaire","Buvette · Matériel"]};
 var v=map[id]||[club,""];t.textContent=v[0];s.textContent=v[1];
}
function goBack(){
 stack.pop();var prev=stack[stack.length-1];
 if(prev==="cycle"){showScr("cycle");buildCycle(curCy);}
 else if(prev==="admin"){buildAdminHome();showScr("admin");}
 else if(prev==="admin-comm"){buildAdminComm();showScr("admin-comm");}
 else if(prev==="parametres"){buildParametres();showScr("parametres");}
 else if(prev&&prev.startsWith("pole-")){showScr(prev);}
 else if(prev==="communaute"){buildCommunaute();showScr("communaute");if(chatUnsubscribe){chatUnsubscribe();chatUnsubscribe=null;}if(typingUnsubscribe){typingUnsubscribe();typingUnsubscribe=null;}}
 else showScr(prev);
}
function navTo(id){
 stack=["portal"];
 if(id==="admin"){stack.push("admin");buildAdminHome();showScr("admin");}
 else if(id==="inscription"){stack.push("inscription");showScr("inscription");buildInscriptionPublic();}
 else if(id==="communaute"){stack.push("communaute");showScr("communaute");buildCommunaute();}
 else{stack.push(id);showScr(id);}
}

// ═══ BUILD ═══════════════════════════════════════════════════════
function cycleNum(cy){return cy.id>=100?(cy.id%10):cy.id;}

function makeCard(p,onclick){
 var d=document.createElement("div");
 d.className="card"+(p.ready?"":" locked");
 d.style.borderLeftColor=p.color||"var(--dkg)";
 if(p.ready&&onclick)d.onclick=onclick;
 var ic=(p.icon&&p.icon.trim())?p.icon:((p.name||p.title||"?").trim().charAt(0).toUpperCase());
 d.innerHTML='<div class="ci"><div class="cicon" style="background:'+(p.color||"var(--dkg)")+'">'+ic+'</div><div class="cinfo"><div class="ctit">'+(p.name||p.title)+'</div><div class="csub">'+(p.sub||"")+'</div><div class="cdsc">'+(p.desc||"")+'</div></div><div class="carr">'+(p.ready?"›":"")+'</div></div>';
  return d;
}

function buildPortal(){
  var el=document.getElementById("poleCards");if(!el)return;el.innerHTML="";
  POLES.forEach(function(p){el.appendChild(makeCard(p,function(){openPole(p.id);}));});
  buildDashboard();
}

function updateCountdownBanner(bannerId){
  var el=document.getElementById(bannerId);if(!el)return;
  var events=getEvents();
  var todayStr=new Date().toISOString().slice(0,10);
  var in14=new Date(Date.now()+14*86400000).toISOString().slice(0,10);
  var big=events.filter(function(e){return e.type==="tournoi"&&e.date>=todayStr&&e.date<=in14;}).sort(function(a,b){return a.date>b.date?1:-1;})[0];
  if(!big){el.style.display="none";return;}
  var diffDays=Math.ceil((new Date(big.date)-new Date(todayStr))/86400000);
  var txt=diffDays===0?"Aujourd'hui : "+big.titre:(diffDays===1?"Demain : "+big.titre:"J-"+diffDays+" avant "+big.titre);
 el.textContent=txt;
 el.style.display="block";
}

function buildCoachDashboard(el){
  el=el||document.getElementById("coach-presence-summary")||document.getElementById("dashboard-dirigeant");
  if(!el)return;
  var teamId=getCoachTeam();
  var team=getTeams().find(function(t){return t.id===teamId;});
  if(!team){el.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:13px;font-weight:600">Aucune équipe assignée</div></div>';return;}

  var players=(team.members&&team.members.length)?getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;}):getPlayers().filter(function(p){return p.cat===team.cat;});

  var todayStr=new Date().toISOString().slice(0,10);
  var upcoming=getEvents().filter(function(e){
    if(e.cancelled||e.date<todayStr)return false;
    var eq=(e.equipe||"").toUpperCase();
    return eq.indexOf(team.name.toUpperCase())>=0;
  }).sort(function(a,b){return a.date>b.date?1:-1;})[0];

  if(!upcoming){
    el.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:13px;font-weight:600">Aucun événement à venir pour '+team.name+'</div></div>';
    return;
  }

  var typeLabels={match:"Prochain match",entrainement:"Prochain entraînement",tournoi:"Prochain tournoi"};
  var upLabel=typeLabels[upcoming.type]||"Prochain événement";
  var dp=upcoming.date.split("-");
  var dateFr=dp.length===3?(dp[2]+"/"+dp[1]+"/"+dp[0]):upcoming.date;

  el.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:12px;color:var(--mut)">Chargement des présences…</div></div>';

  if(!window.fbReady){window.addEventListener("fb-ready",function(){buildCoachDashboard(el);},{once:true});return;}

  window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
    var statusByPlayer={};
    snap.forEach(function(d){
      var data=d.data();
      if(data.eventId===upcoming.id)statusByPlayer[data.playerId]=data.status;
    });
    var present=[],absent=[],noResponse=[];
    players.forEach(function(p){
      var st=statusByPlayer[p.id];
      if(st==="present")present.push(p);
      else if(st==="absent"||st==="retard")absent.push(p);
      else noResponse.push(p);
    });

    var rows=players.map(function(p){
      var st=statusByPlayer[p.id];
      var lbl=st==="present"?"Présent(e)":(st==="absent"?"Absent(e)":(st==="retard"?"En retard":"Sans réponse"));
      var cls=st==="present"?"st-ok":(st==="absent"||st==="retard"?"st-no":"st-wait");
      var colBg=st==="present"?"rgba(212,175,55,.12)":(st==="absent"||st==="retard"?"rgba(192,57,43,.12)":"rgba(232,103,10,.12)");
      var colTxt=st==="present"?"#D4AF37":(st==="absent"||st==="retard"?"#C0392B":"#E8670A");
      var initials=(p.prenom||"?").charAt(0).toUpperCase()+(p.nom||"?").charAt(0).toUpperCase();
      return '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:var(--rx);background:var(--bg)">'+
        '<div style="width:32px;height:32px;border-radius:50%;background:var(--dkg);color:#fff;font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+initials+'</div>'+
        '<div style="flex:1;font-size:12.5px;font-weight:700;color:var(--txt)">'+p.prenom+' '+p.nom+'</div>'+
        '<div style="font-size:10.5px;font-weight:700;padding:4px 9px;border-radius:20px;background:'+colBg+';color:'+colTxt+'">'+lbl+'</div></div>';
    }).join("");

    var relanceBtn=noResponse.length?('<button onclick="relancerSansReponse(\''+upcoming.id+'\')" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(232,103,10,.1);color:#E8670A;font-size:12px;font-weight:700;border:none;cursor:pointer;margin-top:12px">🔔 Relancer les sans réponse ('+noResponse.length+')</button>'):"";

    el.innerHTML='<div style="margin:0 0 10px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid var(--dkg);border-radius:var(--r);padding:14px;box-shadow:0 2px 12px var(--shadow)">'+
      '<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">'+upLabel+'</div>'+
      '<div style="font-size:14px;font-weight:800;color:var(--txt)">'+upcoming.titre+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+dateFr+(upcoming.heure?" · "+upcoming.heure:"")+'</div>'+
      '<div style="display:flex;gap:8px;margin-top:12px">'+
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:rgba(212,175,55,.12);color:#D4AF37"><b style="display:block;font-size:18px">'+present.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Présents</span></div>'+
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:rgba(192,57,43,.12);color:#C0392B"><b style="display:block;font-size:18px">'+absent.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Absents</span></div>'+
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:rgba(232,103,10,.12);color:#E8670A"><b style="display:block;font-size:18px">'+noResponse.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Sans réponse</span></div>'+
      '</div>'+
      '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">'+rows+'</div>'+
      relanceBtn+
    '</div>';
  });
}

function relancerSansReponse(eventId){
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  var ev=getEvents().find(function(e){return e.id===eventId;});
  if(!ev)return;
  var teamId=getCoachTeam();
  var team=getTeams().find(function(t){return t.id===teamId;});
  if(!team)return;
  var players=(team.members&&team.members.length)?getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;}):getPlayers().filter(function(p){return p.cat===team.cat;});

  window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
    var responded={};
    snap.forEach(function(d){var data=d.data();if(data.eventId===eventId)responded[data.playerId]=true;});
    var noResponse=players.filter(function(p){return !responded[p.id];});
    if(!noResponse.length){alert("Tout le monde a répondu !");buildCoachDashboard();return;}
    var noms=noResponse.map(function(p){return p.prenom+" "+p.nom;}).join(", ");
    var channelId=findChannelForTeamText(ev.equipe);
    if(!channelId){alert("Aucun canal trouvé pour cette équipe");return;}
    var msg="🔔 <b>Rappel de présence</b><br>Merci de confirmer votre présence à \""+ev.titre+"\" ("+ev.date+(ev.heure?" · "+ev.heure:"")+").<br>En attente de réponse : "+noms;
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
      text:msg,pseudo:clubPseudo("Coach"),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
    }).then(function(){
      alert("Relance envoyée dans le canal !");
    });
  });
}

function buildDashboard(){
 var el=document.getElementById("dashboard-dirigeant");if(!el)return;
 updateCountdownBanner("portal-countdown");
 if(localStorage.getItem("asmb_profile")==="coach"){buildCoachDashboard(el);return;}

 var players=getPlayers();
 var CATS_ALL=["U7","U9","U11","U13","U15","U17","U18","U21","Senior","Loisir","3x3"];
 var byCat={};
 CATS_ALL.forEach(function(c){byCat[c]=0;});
 players.forEach(function(p){if(byCat.hasOwnProperty(p.cat))byCat[p.cat]++;});
 var topCat=CATS_ALL.reduce(function(a,b){return byCat[a]>byCat[b]?a:b;},CATS_ALL[0]);

 var licences=getLicences();
 var licencesEnAttente=licences.filter(function(l){return l.statut&&l.statut!=="validee";}).length;

 var teams=getTeams();

 var events=getEvents();
 var todayStr=new Date().toISOString().slice(0,10);
 var upcoming=events.filter(function(e){return e.date>=todayStr;}).sort(function(a,b){return a.date>b.date?1:-1;})[0];

 var d30=new Date();d30.setDate(d30.getDate()-30);
 var d30str=d30.toISOString().slice(0,10);
 var recentEvents=events.filter(function(e){return e.presences&&Object.keys(e.presences).length&&e.date>=d30str&&e.date<=todayStr;});
 var totPres=0,totSlots=0;
 recentEvents.forEach(function(e){Object.keys(e.presences).forEach(function(k){totSlots++;if(e.presences[k]==="present")totPres++;});});
 var avgPresence=totSlots?Math.round(totPres/totSlots*100):null;

 var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">';

  html+='<div onclick="showLicenciesList()" style="cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:22px;font-weight:900;color:var(--dkg)">'+players.length+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:2px">Licenciés'+(topCat&&byCat[topCat]>0?" · "+topCat+" majoritaire":"")+'</div></div>';

  html+='<div onclick="showPendingLicences()" style="cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:22px;font-weight:900;color:'+(licencesEnAttente>0?"#E8670A":"#D4AF37")+'">'+licencesEnAttente+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:2px">Licences en attente</div></div>';

  html+='<div onclick="showTeamsList()" style="cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:22px;font-weight:900;color:var(--txt)">'+teams.length+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:2px">Équipes actives</div></div>';

  html+='<div onclick="showAssiduiteChart()" style="cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:22px;font-weight:900;color:var(--txt)">'+(avgPresence!==null?avgPresence+"%":"—")+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:2px">Assiduité 30 derniers jours</div></div>';

  html+='</div>';

  if(upcoming){
    var typeLabels={match:"Prochain match",entrainement:"Prochain entraînement",tournoi:"Prochain tournoi"};
    var upcomingLabel=typeLabels[upcoming.type]||"Prochain événement";
    var upDateParts=upcoming.date.split("-");
    var upDateFr=upDateParts.length===3?(upDateParts[2]+"/"+upDateParts[1]+"/"+upDateParts[0]):upcoming.date;
    html+='<div style="margin-top:10px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid var(--dkg);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)">'+
      '<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">'+upcomingLabel+'</div>'+
      '<div style="font-size:13px;font-weight:700;color:var(--txt)">'+upcoming.titre+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+upDateFr+(upcoming.heure?" · "+upcoming.heure:"")+'</div></div>';
  }

  el.innerHTML=html;

  fillTodayHero("portal-next-event","portal-no-event",null);
}

function fillTodayHero(eventElId,noEventElId,teamFilter,fallbackLine1,fallbackLine2){
  var heroEvent=document.getElementById(eventElId);
  var heroNoEvent=document.getElementById(noEventElId);
  if(!heroEvent||!heroNoEvent)return;
  var todayStr=new Date().toISOString().slice(0,10);
  var todaysEvents=getEvents().filter(function(e){
    if(e.date!==todayStr||e.cancelled)return false;
    if(teamFilter){
      var eq=(e.equipe||"").toUpperCase();
      return eq.indexOf(teamFilter.name.toUpperCase())>=0;
    }
    return true;
  });
  var todayLabel=new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  todayLabel=todayLabel.charAt(0).toUpperCase()+todayLabel.slice(1);
  if(todaysEvents.length){
    var titlesHtml=todaysEvents.map(function(e){return e.titre;}).join(" · ");
    var subHtml=todaysEvents.map(function(e){return (e.heure||"")+(e.lieu?" ("+e.lieu+")":"");}).join(" · ");
    var titleEl=heroEvent.querySelector("[id$='-title']");
    var subEl=heroEvent.querySelector("[id$='-sub']");
    if(titleEl)titleEl.textContent=titlesHtml;
    if(subEl)subEl.textContent="AUJOURD'HUI · "+subHtml;
    heroEvent.style.display="flex";
    heroNoEvent.style.display="none";
  } else {
    heroEvent.style.display="none";
    heroNoEvent.style.display="block";
    var line1El=heroNoEvent.querySelector("[data-line1]");
    var line2El=heroNoEvent.querySelector("[data-line2]");
    if(line1El)line1El.textContent=fallbackLine1||todayLabel;
    if(line2El)line2El.textContent=fallbackLine2||"Aucun entraînement aujourd'hui";
    if(!line1El&&!line2El)heroNoEvent.textContent=(fallbackLine1||todayLabel)+(fallbackLine2?" · "+fallbackLine2:"");
  }
}

