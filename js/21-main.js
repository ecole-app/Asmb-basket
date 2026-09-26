/* ===== 21-main.js — Theme, initialisation et demarrage de l'application ===== */
function toggleTheme(){
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  if(dark){document.documentElement.removeAttribute("data-theme");localStorage.setItem("asmb_theme","light");}
  else{document.documentElement.setAttribute("data-theme","dark");localStorage.setItem("asmb_theme","dark");}
  var pd=document.getElementById("pp-dark");if(pd)pd.checked=!dark;
  var gd=document.getElementById("gp-dark");if(gd)gd.checked=!dark;
}

// ═══ INIT ════════════════════════════════════════════════════════
(function(){var t=localStorage.getItem("asmb_theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}());

// Demo : injecter une fiche de test si aucune n'existe
(function(){
 var lics = getLicences();
 if(!lics.find(function(l){return l.code==="DEMO-TEST-0001";})){
 lics.push({code:"DEMO-TEST-0001",email:"demo@asmb.fr",nomDest:"Demo",statut:"envoyee",createdAt:Date.now(),ouvertLe:null,fiche:null,categorie:null});
 saveLicences(lics);
 }
}());

// Le HTML affiche le portail (ASMB) par défaut au tout premier rendu, pour que
// l'app paraisse instantanée sur un club normal. Mais pour le compte super
// admin, dont l'écran normal est la Plateforme (pas le portail d'un club), ça
// ferait flasher un club avant que l'authentification ne redirige : on saute
// ce premier rendu quand un indice local (posé au login précédent) l'indique.
// Purement un choix d'affichage, jamais de sécurité : le routage réel n'est
// décidé qu'après confirmation Firebase, dans finishAuthedUser().
if(localStorage.getItem("gm_is_su")==="1"){
  var __scrPortal=document.getElementById("scr-portal");
  if(__scrPortal) __scrPortal.classList.remove("on");
} else {
  buildPortal();
}
setTimeout(initAuthGate,80);

// ═══ DETECTION NOUVELLE VERSION ═══════════════════════════════════
var APP_VERSION="1790432182";
function checkForUpdate(){
 fetch("./version.json?t="+Date.now(),{cache:"no-store"})
 .then(function(r){return r.json();})
 .then(function(data){
 if(data.v&&data.v!==APP_VERSION){
 var banner=document.getElementById("update-banner");
 if(banner)banner.style.display="flex";
 }
 })
 .catch(function(){});
}
function applyUpdate(){
 // Signale a sw-register.js que le rechargement est volontaire, pour qu'il
 // n'en ajoute pas un second quand le nouveau service worker prendra la main.
 try{ sessionStorage.setItem("gm_manual_update","1"); }catch(e){}
 var dest=location.href.split("?")[0]+"?v="+Date.now();
 if('serviceWorker' in navigator){
   navigator.serviceWorker.getRegistrations().then(function(regs){
     regs.forEach(function(r){r.unregister();});
     location.href=dest;
   }).catch(function(){ location.href=dest; });
 } else {
   location.href=dest;
 }
}
setTimeout(checkForUpdate,4000);
setInterval(checkForUpdate,120000);

function checkTomorrowReminders(){
 if(!window.fbReady)return;
 if(ppGet("asmb_pp_match","on")!=="on")return;
 var tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
 var tomorrowStr=tomorrow.toISOString().slice(0,10);
 fetchEventsFromCloud().then(function(events){
 var matches=events.filter(function(e){return e.date===tomorrowStr&&e.type==="match"&&!e.cancelled;});
 if(!matches.length)return;
 // Verrou PARTAGE (Firestore) : evite que chaque appareil poste le meme rappel
 window.fbGetDocs(window.fbCollection(window.fbDb,"reminders_sent")).then(function(snap){
 var already={};
 snap.forEach(function(d){already[d.id]=true;});
 matches.forEach(function(m){
 var key=m.id+"_"+tomorrowStr;
 if(already[key])return;
 window.fbSetDoc(window.fbDoc(window.fbDb,"reminders_sent",key),{eventId:m.id,date:tomorrowStr,ts:window.fbServerTimestamp()}).then(function(){
 var channelId=findChannelForTeamText(m.equipe);
 window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
 text:" <b>Rappel</b> : demain \""+m.titre+"\""+(m.heure?" a "+m.heure:"")+(m.lieu?" · "+m.lieu:""),
 pseudo:clubPseudo(""),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
 });
 }).catch(function(){});
 });
 }).catch(function(){});
 });
}
whenClubReady(function(){ setTimeout(checkTomorrowReminders,4000); });
setInterval(function(){ if(window.CURRENT_CLUB_ID) checkTomorrowReminders(); },3600000);
document.addEventListener("visibilitychange",function(){
 if(document.visibilityState==="visible")checkForUpdate();
});

// ═══ PULL-TO-REFRESH ═══════════════════════════════════════════════
function refreshCurrentScreen(){
 var id=stack[stack.length-1];
 try{
 if(id==="portal")buildPortal();
 else if(id==="parent-home")buildParentHome();
 else if(id==="parent-equipe")buildParentEquipe();
 else if(id==="parent-events")buildParentEvents();
 else if(id==="parent-stats")buildParentStats();
 else if(id==="coach-equipe")buildCoachEquipe();
 else if(id==="communaute")buildCommunaute();
 else if(id==="admin")buildAdminHome();
 else if(id==="inscriptions")renderPlayers();
 else if(id==="equipes")buildTeams();
 else if(id==="planning")buildPlanning();
 else if(id==="documents")buildDocs();
 else if(id==="licences")buildLicences();
 else if(id==="annuaire")buildAnnuaire();
 else if(id==="galerie")buildGalerie();
 else if(id==="parametres")buildParametres();
 else if(id==="elite")buildElite();
 else if(id&&id.startsWith("pole-")&&typeof currentPoleId!=="undefined")buildPoleScreen(currentPoleId);
 }catch(e){}
}

(function(){
 var mainEl=document.getElementById("main-scroll");
 var indicator=document.getElementById("ptr-indicator");
 var spinner=document.getElementById("ptr-spinner");
 if(!mainEl||!indicator||!spinner)return;
 var startY=0,pulling=false,triggered=false;
 var THRESHOLD=70;

 mainEl.addEventListener("touchstart",function(e){
 if(mainEl.scrollTop<=0){
 startY=e.touches[0].clientY;
 pulling=true;triggered=false;
 }
 },{passive:true});

 mainEl.addEventListener("touchmove",function(e){
 if(!pulling)return;
 var dy=e.touches[0].clientY-startY;
 if(dy>0&&mainEl.scrollTop<=0){
 var pull=Math.min(dy*0.5,90);
 indicator.style.opacity=Math.min(pull/THRESHOLD,1);
 spinner.style.transform="translateY("+pull+"px) rotate("+(pull*3)+"deg)";
 if(pull>=THRESHOLD&&!triggered){triggered=true;spinner.style.borderTopColor="#D4AF37";}
 else if(pull<THRESHOLD&&triggered){triggered=false;spinner.style.borderTopColor="var(--dkg)";}
 }
 },{passive:true});

 mainEl.addEventListener("touchend",function(){
 if(!pulling)return;
 pulling=false;
 if(triggered){
 spinner.classList.add("ptr-spinning");
 spinner.style.transform="translateY(50px)";
 indicator.style.opacity="1";
 checkForUpdate();
 refreshCurrentScreen();
 setTimeout(function(){
 indicator.style.opacity="0";
 spinner.classList.remove("ptr-spinning");
 spinner.style.transform="translateY(0)";
 },700);
 } else {
 indicator.style.opacity="0";
 spinner.style.transform="translateY(0)";
 }
 },{passive:true});
})();

// ═══ DETECTION MODE HORS-LIGNE ═══════════════════════════════════
function updateOfflineBanner(){
 var banner=document.getElementById("offline-banner");
 if(!banner)return;
 banner.style.display=navigator.onLine?"none":"block";
}
window.addEventListener("online",updateOfflineBanner);
window.addEventListener("offline",updateOfflineBanner);
updateOfflineBanner();

// ═══ RAPPELS AUTOMATIQUES AVANT EVENEMENT ═══════════════════════
function checkEventReminders(){
 if(localStorage.getItem("asmb_notif")!=="on")return;
 if(!("Notification" in window)||Notification.permission!=="granted")return;
 var events=getEvents();
 var now=new Date();
 var notified=JSON.parse(localStorage.getItem("asmb_reminded")||"{}");
 events.forEach(function(e){
 if(!localStorage.getItem("asmb_notif")==="on")return;
 var typeKey=e.type==="match"?"match":(e.type==="entrainement"?"entrainement":"evenement");
 if(localStorage.getItem("asmb_notif_"+typeKey)==="off")return;
 var evDate=new Date(e.date+(e.heure?" "+e.heure.replace("h",":"):" 00:00"));
 var diffH=(evDate-now)/3600000;
 // Fenetre de rappel : entre 20h et 24h avant (vérifié a chaque ouverture de l'app)
    if(diffH>0&&diffH<=24&&!notified[e.id]){
      try{
        var icon=e.type==="match"?"":(e.type==="entrainement"?"":"");
        new Notification(icon+" "+clubLabel()+" - "+e.titre,{body:"Demain"+(e.heure?" a "+e.heure:"")+(e.lieu?" · "+e.lieu:""),tag:"asmb-reminder-"+e.id});
        notified[e.id]=true;
        localStorage.setItem("asmb_reminded",JSON.stringify(notified));
      }catch(err){}
    }
  });
}
// Multi-club : ces tâches lisent/écrivent des données de club, elles attendent
// donc que le club de l'utilisateur soit connu (sinon elles échoueraient au
// démarrage, et l'écoute des demandes d'adhésion ne serait jamais installée).
whenClubReady(function(){
  setTimeout(checkEventReminders,2000);
  setTimeout(checkWeatherAlerts,3000);
  setTimeout(backupToCloud,5000);
  setTimeout(listenJoinRequestsGlobal,3500);
});
setInterval(function(){ if(window.CURRENT_CLUB_ID) backupToCloud(); },300000);
document.addEventListener("DOMContentLoaded",function(){
  var home=document.getElementById("home-logo");
  if(home)home.innerHTML='<img src="img/logo.png" style="width:44px;height:44px;object-fit:contain;display:block">';
  var hd=document.getElementById("hlogo");
  if(hd)hd.innerHTML='<img src="img/logo.png" style="width:38px;height:38px;object-fit:contain;display:block">';
});


