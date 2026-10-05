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

var ROOTS=["portal","plan","admin-login","inscription","communaute","auth","role-select","parent-home","parent-equipe","parent-events","parent-stats","coach-equipe","elite","tutoriel","joueur","plateforme","club-suspendu"];

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
// Tous les emplacements de logo de l'application, avec leur taille.
var CLUB_LOGO_CIBLES=[["home-logo",44],["hlogo",38],["role-logo",90],
  ["parent-hero-logo",44],["parent-eq-logo",80],["coach-eq-logo",44]];
function applyClubLogo(){
  try{
    CLUB_LOGO_CIBLES.forEach(function(c){
      var el=document.getElementById(c[0]);
      if(el) el.innerHTML=clubLogoHtml(c[1]);
    });
  }catch(e){}
  applyClubColor();
}

// Couleur du club : une feuille de style ajoutée après la principale. Chaque
// thème visuel a son propre rôle pour ses variables : la couleur du club
// remplace seulement la teinte de marque du thème, jamais ses neutres, ses
// formes ni son fond de base. Ainsi Épuré reste noir et blanc avec un accent,
// Éditorial garde son encre, Feuille son papier crème, etc.
//   --dkg = couleur principale (boutons, sélection)   --ltg = accent
//   --hdrgrad = fond de l'en-tête
// Chaque entrée : [variables en clair, variables en mode sombre]. Les règles
// "sombre" doivent exister même quand rien ne change, car les thèmes ont leurs
// propres valeurs sombres qui, sinon, reprendraient le dessus.
function clubThemeVars(c){
  var cl=gmMix(c,0.42), h=gmHsl(c)[0], T=gmFromHsl;
  var bentoBg=T(h,0.5,0.15);
  return {
    "moderne":[ "--dkg:"+c+";--ltg:"+c+";--hdrgrad:"+clubDegrade(c), "--dkg:"+c+";--ltg:"+cl+";--hdrgrad:"+clubDegrade(c) ],
    // Marine/doré : la couleur remplace le marine (boutons, en-tête, fonds et textes
    // teintés) ; l'or reste la signature du thème.
    "classique":[ "--dkg:"+c+";--bg:"+T(h,0.25,0.96)+";--bdr:"+T(h,0.2,0.84)+";--txt:"+T(h,0.3,0.14)+";--txt2:"+T(h,0.12,0.4)+";--mut:"+T(h,0.12,0.4)+";--hdrgrad:linear-gradient(135deg,"+gmShade(c,0.9)+","+gmShade(c,0.78)+")",
                  "--dkg:"+gmMix(c,0.3)+";--bg:"+T(h,0.3,0.08)+";--sf:"+T(h,0.28,0.11)+";--card:"+T(h,0.28,0.13)+";--bdr:"+T(h,0.25,0.2)+";--txt:"+T(h,0.3,0.95)+";--txt2:"+T(h,0.2,0.82)+";--mut:"+T(h,0.15,0.62)+";--hdrgrad:linear-gradient(135deg,"+gmShade(c,0.9)+","+gmShade(c,0.78)+")" ],
    // Minimal : barre du haut blanche, fond et cartes neutres ; la couleur du club fait les
    // boutons, l'accent et le bandeau d'accueil (texte blanc dessus, comme les autres thèmes).
    "epure":[ "--dkg:"+c+";--ltg:"+c+";--hdrgrad:"+c, "--ltg:"+cl+";--hdrgrad:"+c ],
    // Verre sur fond sombre : fond (le body reprend --hdrgrad), en-tête et boutons teintés.
    "bento":[ "--bg:"+bentoBg+";--dkg:"+gmMix(c,0.25)+";--ltg:"+gmMix(c,0.55)+";--hdrgrad:linear-gradient(160deg,"+T(h,0.43,0.27)+","+bentoBg+" 55%,"+T(h,0.52,0.22)+")", null ],
    // Papier et encre : le papier crème, l'encre et l'en-tête prennent la teinte du club.
    "feuille":[ "--dkg:"+c+";--ltg:"+gmMix(c,0.25)+";--hdrgrad:"+gmShade(c,0.82)+";--bg:"+T(h,0.4,0.91)+";--sf:"+T(h,0.4,0.985)+";--card:"+T(h,0.4,0.985)+";--bdr:"+T(h,0.5,0.08)+";--txt:"+T(h,0.5,0.08)+";--txt2:"+T(h,0.5,0.08)+";--mut:"+T(h,0.2,0.35),
                "--dkg:"+cl+";--ltg:"+cl+";--bg:"+T(h,0.3,0.07)+";--sf:"+T(h,0.3,0.10)+";--card:"+T(h,0.3,0.10)+";--bdr:"+T(h,0.3,0.18)+";--txt:"+T(h,0.3,0.93)+";--txt2:"+T(h,0.3,0.93)+";--mut:"+T(h,0.2,0.7)+";--hdrgrad:"+T(h,0.3,0.05) ],
    // Pastel : couleur et accent adoucis, fond dégradé teinté (clair) ou fonds sombres teintés.
    "carnet":[ "--dkg:"+gmMix(c,0.4)+";--ltg:"+gmMix(c,0.5)+";--carnet-body:linear-gradient(180deg,"+T(h,0.6,0.95)+","+T(h+25,0.5,0.96)+" 45%,#fdf6f0)",
               "--dkg:"+gmMix(c,0.5)+";--ltg:"+gmMix(c,0.6)+";--bg:"+T(h,0.2,0.10)+";--sf:"+T(h,0.2,0.14)+";--card:"+T(h,0.2,0.14)+";--bdr:"+T(h,0.2,0.2)+";--hdrgrad:"+T(h,0.2,0.14) ],
    // Bloc couleur : l'en-tête et l'accent prennent la couleur, l'encre reste.
    "editorial":[ "--ltg:"+c+";--hdrgrad:"+c, "--ltg:"+cl+";--hdrgrad:"+c ]
  };
}
function applyClubColor(){
  try{
    var old=document.getElementById("club-colors");
    var c=clubCouleur();
    if(!c){ if(old) old.remove(); return; }
    var st=old||document.createElement("style");
    st.id="club-colors";
    var css="", tv=clubThemeVars(c);
    Object.keys(tv).forEach(function(t){
      var sel=(t==="moderne")?'html:not([data-visual-theme])':'html[data-visual-theme="'+t+'"]';
      if(tv[t][0]) css+=sel+'{'+tv[t][0]+'}';
      if(tv[t][1]) css+=sel.replace('html','html[data-theme="dark"]')+'{'+tv[t][1]+'}';
    });
    st.textContent=css;
    if(!old) document.head.appendChild(st);
  }catch(e){}
}

function applyClubLabels(){
  var n=clubTitle();
  try{
    document.querySelectorAll(".js-club-name").forEach(function(el){ el.textContent=n; });
    applyClubLogo();
    if(typeof stack!=="undefined" && stack.length) updateHdr(stack[stack.length-1]);
  }catch(e){}
}

function updateHdr(id){
 var t=document.getElementById("htit"),s=document.getElementById("hsub");
 var club=clubTitle();
 var map={"auth":["Connexion",""],"plateforme":["Plateforme","General Manager · Clubs"],"club-suspendu":["Accès suspendu",""],"role-select":["Bienvenue",""],"joueur":["Espace Joueur","Pointage du jour"],"team-picker":["Mes équipes","Sélection"],"parent-equipe":["Équipe",""],"parent-events":["Événements",""],"parent-stats":["Stats",""],"parent-params":["Paramètres","Mes préférences"],"coach-equipe":["Mon équipe",""],"parent-home":[club,clubSubtitle()],"matchday":["Jour de match",""],"annuaire":["Annuaire","Contacts du club"],"galerie":["Galerie","Photos du club"],"calendrier":["Calendrier","Semaine · Entraînements et matchs"],"classement":["Classement","Poule · Position du club"],portal:[club,clubSubtitle()],elite:["Pôle Formation","Planification"],u13home:["U13 Féminin","Saison "+getCurrentSeason()],cycle:curCy?[curCy.sh,curCy.p]:["Cycle",""],seance:curSea?["Séance "+curSea.num,curSea.t]:["Séance",""],"pole-elite":["Élite Academy","Sessions · Participants"],"pole-competition":["Compétition 5x5","Équipes · Matchs · Joueurs"],"pole-3x3":["3x3","Équipes · Tournois"],"pole-evenement":["Événements","Organisation · Tournois"],"pole-basketpourtous":["Basket Pour Tous","Groupes · Séances"],"parametres":["Paramètres","Configuration"],"admin-comm":["Communauté","Gestion des canaux"],"channel-detail":["Membres","Gestion des accès"],"communaute":["Communauté",club?(club+" · Messagerie"):"Messagerie"],"chat":[currentChannelData?currentChannelData.name:"Chat",currentChannelData?currentChannelData.desc:""],"admin-login":["Connexion","Espace Responsables"],admin:["Espace Admin",club?(club+" · Responsables"):"Responsables"],licences:["Licences","Suivi des fiches"],"licence-detail":["Détail fiche","Licence du club"],inscriptions:["Inscriptions","Gestion des joueurs"],equipes:["Équipes","Composition et staff"],planning:["Planning","Salles · Créneaux · Matchs"],"live-eval":["Évaluation",""],"player-history":["Historique joueur",""],documents:["Documents","Fichiers et formulaires"],comptabilite:["Comptabilité","Recettes · Dépenses"],inventaire:["Inventaire","Buvette · Matériel"]};
 var v=map[id]||[club,""];t.textContent=v[0];s.textContent=v[1];
 // La Plateforme n'appartient à aucun club : le logo générique du header
 // (celui du club "maison" du super admin) n'a rien à y faire, sinon on
 // dirait que c'est le logo de la plateforme elle-même.
 var hlogoEl=document.getElementById("hlogo");
 if(hlogoEl) hlogoEl.style.display=(id==="plateforme")?"none":"";
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
  activePoles().forEach(function(p){el.appendChild(makeCard(p,function(){openPole(p.id);}));});
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
    el.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:13px;font-weight:600">Aucun événement à venir pour '+authEsc(team.name)+'</div></div>';
    return;
  }

  var typeLabels={match:"Prochain match",entrainement:"Prochain entraînement",tournoi:"Prochain tournoi"};
  var upLabel=typeLabels[upcoming.type]||"Prochain événement";
  var dp=upcoming.date.split("-");
  var dateFr=dp.length===3?(dp[2]+"/"+dp[1]+"/"+dp[0]):upcoming.date;

  el.innerHTML=loadingHtml("Chargement des présences…");

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
      var colBg=st==="present"?"color-mix(in srgb, var(--ltg) 12%, transparent)":(st==="absent"||st==="retard"?"rgba(192,57,43,.12)":"rgba(232,103,10,.12)");
      var colTxt=st==="present"?"var(--ltg)":(st==="absent"||st==="retard"?"#C0392B":"#E8670A");
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
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:color-mix(in srgb, var(--ltg) 12%, transparent);color:var(--ltg)"><b style="display:block;font-size:18px">'+present.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Présents</span></div>'+
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:rgba(192,57,43,.12);color:#C0392B"><b style="display:block;font-size:18px">'+absent.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Absents</span></div>'+
        '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;font-weight:800;background:rgba(232,103,10,.12);color:#E8670A"><b style="display:block;font-size:18px">'+noResponse.length+'</b><span style="font-size:9.5px;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Sans réponse</span></div>'+
      '</div>'+
      '<div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">'+rows+'</div>'+
      relanceBtn+
    '</div>';
  }).catch(function(e){
    el.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:13px;font-weight:600;color:#C0392B">Erreur de chargement des présences</div></div>';
    console.log("buildCoachDashboard:",e);
  });
}

function relancerSansReponse(eventId){
  if(!window.fbReady){askAlert("Connexion en cours, patientez et réessayez");return;}
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
    if(!noResponse.length){showToast("Tout le monde a répondu !");buildCoachDashboard();return;}
    var noms=noResponse.map(function(p){return p.prenom+" "+p.nom;}).join(", ");
    var channelId=findChannelForTeamText(ev.equipe);
    if(!channelId){askAlert("Aucun canal trouvé pour cette équipe");return;}
    // Texte brut + \n : le chat échappe le HTML (authEsc) et affiche les retours à la ligne.
    var msg="🔔 Rappel de présence\nMerci de confirmer votre présence à \""+ev.titre+"\" ("+ev.date+(ev.heure?" · "+ev.heure:"")+").\nEn attente de réponse : "+noms;
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
      text:msg,pseudo:clubPseudo("Coach"),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
    }).then(function(){
      showToast("Relance envoyée dans le canal !");
    }).catch(function(e){
      askAlert("La relance n'a pas pu être envoyée : "+((e&&e.code)||e));
    });
  }).catch(function(e){
    askAlert("Impossible de vérifier les réponses : "+((e&&e.code)||e));
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
    '<div style="font-size:22px;font-weight:900;color:'+(licencesEnAttente>0?"#E8670A":"var(--ltg)")+'">'+licencesEnAttente+'</div>'+
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
    html+='<div style="margin-top:10px;background:var(--card);border:1px solid var(--bdr);border-radius:18px;padding:14px;box-shadow:0 2px 8px var(--shadow);display:flex;align-items:center;gap:12px">'+
      '<div style="width:44px;height:44px;border-radius:14px;background:linear-gradient(135deg,var(--dkg),#2a4680);display:flex;align-items:center;justify-content:center;flex-shrink:0">'+
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg></div>'+
      '<div style="flex:1;min-width:0">'+
        '<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:3px">'+upcomingLabel+'</div>'+
        '<div style="font-size:13px;font-weight:700;color:var(--txt)">'+upcoming.titre+'</div>'+
        '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+upDateFr+(upcoming.heure?" · "+upcoming.heure:"")+'</div></div></div>';
  }

  html+=buildAssiduiteChartCard();

  var homonymes=(typeof detecterHomonymes==="function")?detecterHomonymes():[];
  if(homonymes.length){
    var noms=homonymes.map(function(g){return g[0].prenom+" "+g[0].nom+" ("+g.length+")";}).join(", ");
    html='<div onclick="showLicenciesList()" style="cursor:pointer;margin-bottom:10px;background:rgba(232,103,10,.1);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:12px 14px">'+
      '<div style="font-size:11.5px;font-weight:700;color:#E8670A">⚠️ '+homonymes.length+' homonyme'+(homonymes.length>1?"s":"")+' détecté'+(homonymes.length>1?"s":"")+' dans les licenciés</div>'+
      '<div style="font-size:10.5px;color:var(--mut);margin-top:3px">'+noms+' — vérifiez que les rattachements (photo, téléphone, accès parent) correspondent à la bonne personne.</div></div>'+html;
  }

  el.innerHTML=html;

  fillTodayHero("portal-next-event","portal-no-event",null);
}

// Carte "Évolution de l'assiduité" : % de présence par semaine sur les 8
// dernières semaines, calculé à partir des vraies présences enregistrées
// (jamais de données inventées : si moins de 2 semaines ont des données,
// on affiche un état vide plutôt qu'un graphique trompeur).
function assiduiteHebdo(nbSemaines){
  var events=getEvents().filter(function(e){return e.presences&&Object.keys(e.presences).length;});
  var now=new Date();
  var jour=now.getDay()||7; // lundi=1 ... dimanche=7
  var lundiCourant=new Date(now);lundiCourant.setDate(now.getDate()-jour+1);lundiCourant.setHours(0,0,0,0);
  var semaines=[];
  for(var i=nbSemaines-1;i>=0;i--){
    var deb=new Date(lundiCourant);deb.setDate(lundiCourant.getDate()-i*7);
    var fin=new Date(deb);fin.setDate(deb.getDate()+6);
    var numSemaine=Math.ceil((((deb-new Date(deb.getFullYear(),0,1))/86400000)+new Date(deb.getFullYear(),0,1).getDay()+1)/7);
    semaines.push({deb:deb,fin:fin,num:numSemaine,present:0,total:0});
  }
  events.forEach(function(e){
    var ed=new Date(e.date+"T00:00:00");
    semaines.forEach(function(s){
      if(ed>=s.deb&&ed<=s.fin){
        Object.keys(e.presences).forEach(function(k){s.total++;if(e.presences[k]==="present")s.present++;});
      }
    });
  });
  return semaines.map(function(s){return {num:s.num,pct:s.total?Math.round(s.present/s.total*100):null};});
}

function buildAssiduiteChartCard(){
  var pts=assiduiteHebdo(8).filter(function(p){return p.pct!==null;});
  var card='<div style="margin-top:10px;background:var(--card);border:1px solid var(--bdr);border-radius:18px;padding:16px">'+
    '<div style="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:2px">Évolution de l\'assiduité</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-bottom:10px">% de présence par semaine</div>';
  if(pts.length<2){
    card+='<div style="text-align:center;padding:18px 10px;font-size:11.5px;color:var(--mut);font-style:italic">Pas assez d\'historique pour tracer une courbe</div>';
  } else {
    var w=320,h=84,n=pts.length;
    var coords=pts.map(function(p,i){return {x:n>1?(i/(n-1))*w:0,y:h-(p.pct/100*h)};});
    var poly=coords.map(function(c){return c.x.toFixed(1)+","+c.y.toFixed(1);}).join(" ");
    var area=poly+" "+w+","+h+" 0,"+h;
    var last=coords[coords.length-1];
    card+='<svg width="100%" height="'+h+'" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">'+
      '<polygon points="'+area+'" fill="var(--dkg)" opacity=".08"/>'+
      '<polyline points="'+poly+'" fill="none" stroke="var(--dkg)" stroke-width="2.5"/>'+
      '<circle cx="'+last.x.toFixed(1)+'" cy="'+last.y.toFixed(1)+'" r="4.5" fill="var(--ltg)"/>'+
      '</svg>'+
      '<div style="display:flex;justify-content:space-between;font-size:9px;color:var(--mut);margin-top:4px">'+
      '<span>Sem. '+pts[0].num+'</span><span>Sem. '+pts[pts.length-1].num+'</span></div>';
  }
  card+='</div>';
  return card;
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

