/* ===== 21-main.js — Theme, initialisation et demarrage de l'application ===== */
function toggleTheme(){
  var dark=document.documentElement.getAttribute("data-theme")==="dark";
  if(dark){document.documentElement.removeAttribute("data-theme");localStorage.setItem("asmb_theme","light");}
  else{document.documentElement.setAttribute("data-theme","dark");localStorage.setItem("asmb_theme","dark");}
  var pd=document.getElementById("pp-dark");if(pd)pd.checked=!dark;
  var gd=document.getElementById("gp-dark");if(gd)gd.checked=!dark;
}

// ═══ Thème visuel (ensemble complet : couleurs + formes + nav) ════
var VISUAL_THEMES={
  moderne:{label:"Moderne",emoji:"🟣",desc:"Le thème par défaut de l'appli"},
  classique:{label:"Classique",emoji:"🟡",desc:"Doré/marine, habillage d'origine"},
  epure:{label:"Épuré",emoji:"⬜",desc:"Minimal, lignes fines, sans ombre"},
  bento:{label:"Bento Glass",emoji:"🟪",desc:"Fond violet, cartes en verre, nav sur le côté"},
  feuille:{label:"Feuille de match",emoji:"🟠",desc:"Look carnet/scoresheet, onglets en haut"},
  carnet:{label:"Carnet illustré",emoji:"🌸",desc:"Pastel, cartes rondes, nav flottante"},
  editorial:{label:"Éditorial",emoji:"🟧",desc:"Bloc couleur, gros chiffres, nav en pilule"}
};
function applyVisualTheme(t){
  if(!VISUAL_THEMES[t]) t="moderne";
  if(t==="moderne") document.documentElement.removeAttribute("data-visual-theme");
  else document.documentElement.setAttribute("data-visual-theme",t);
  localStorage.setItem("asmb_visual_theme",t);
  document.querySelectorAll(".vt-swatch").forEach(function(el){
    el.classList.toggle("on",el.getAttribute("data-vt")===t);
  });
}
function buildVisualThemePicker(){
  var box=document.getElementById("vt-picker");
  if(!box) return;
  var current=localStorage.getItem("asmb_visual_theme")||"moderne";
  box.innerHTML="";
  box.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
  Object.keys(VISUAL_THEMES).forEach(function(key){
    var th=VISUAL_THEMES[key];
    var sw=document.createElement("div");
    sw.className="vt-swatch"+(key===current?" on":"");
    sw.setAttribute("data-vt",key);
    sw.style.cssText="padding:10px;border-radius:12px;border:2px solid "+(key===current?"var(--dkg)":"var(--bdr)")+";background:var(--bg);cursor:pointer;display:flex;flex-direction:column;gap:2px";
    sw.innerHTML='<div style="font-size:18px">'+th.emoji+'</div><div style="font-size:12px;font-weight:700;color:var(--txt)">'+th.label+'</div><div style="font-size:10px;color:var(--mut);line-height:1.3">'+th.desc+'</div>';
    sw.onclick=function(){
      applyVisualTheme(key);
      box.querySelectorAll(".vt-swatch").forEach(function(el){
        el.style.borderColor=el.getAttribute("data-vt")===key?"var(--dkg)":"var(--bdr)";
      });
    };
    box.appendChild(sw);
  });
}

// ═══ Barre de navigation en rail (Bento Glass, Carnet illustré) : ═
// appui long dessus pour l'élargir/réduire (icônes seules <-> icônes + libellés)
function toggleBnavExpanded(){
  var bnav=document.getElementById("bnav-main");
  if(!bnav) return;
  var exp=bnav.classList.toggle("expanded");
  document.documentElement.classList.toggle("bnav-expanded",exp);
  localStorage.setItem("asmb_bnav_expanded",exp?"on":"off");
  if(navigator.vibrate) navigator.vibrate(12);
}
(function(){
  var bnav=document.getElementById("bnav-main");
  if(!bnav) return;
  if(localStorage.getItem("asmb_bnav_expanded")==="on"){
    bnav.classList.add("expanded");
    document.documentElement.classList.add("bnav-expanded");
  }
  var LONG_PRESS_MS=480, MOVE_TOL=10;
  var pressTimer=null, longPressed=false, sx=0, sy=0;
  function isRailTheme(){
    var vt=document.documentElement.getAttribute("data-visual-theme");
    return vt==="bento"||vt==="carnet";
  }
  function down(e){
    if(!isRailTheme()) return;
    longPressed=false;
    var pt=e.touches?e.touches[0]:e;
    sx=pt.clientX; sy=pt.clientY;
    pressTimer=setTimeout(function(){ longPressed=true; toggleBnavExpanded(); },LONG_PRESS_MS);
  }
  function move(e){
    if(!pressTimer) return;
    var pt=e.touches?e.touches[0]:e;
    if(Math.abs(pt.clientX-sx)>MOVE_TOL||Math.abs(pt.clientY-sy)>MOVE_TOL){clearTimeout(pressTimer);pressTimer=null;}
  }
  function up(){ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} }
  function clickCapture(e){
    if(longPressed){ e.preventDefault(); e.stopPropagation(); longPressed=false; }
  }
  bnav.addEventListener("mousedown",down);
  bnav.addEventListener("touchstart",down,{passive:true});
  bnav.addEventListener("mousemove",move);
  bnav.addEventListener("touchmove",move,{passive:true});
  bnav.addEventListener("mouseup",up);
  bnav.addEventListener("mouseleave",up);
  bnav.addEventListener("touchend",up);
  bnav.addEventListener("touchcancel",up);
  bnav.addEventListener("click",clickCapture,true);
}());

// ═══ INIT ════════════════════════════════════════════════════════
// Les fenêtres (modal-*) sont écrites dans la zone qui défile (#main-scroll). Sur
// iPhone (Safari), cette zone forme une « couche » à part : la barre du bas de
// l'appli passait PAR-DESSUS la fenêtre et cachait son bouton « Enregistrer ».
// On les sort de la zone qui défile, directement dans <body>.
(function(){
  var zone=document.getElementById("main-scroll"); if(!zone) return;
  Array.prototype.slice.call(zone.querySelectorAll('[id^="modal-"]')).forEach(function(m){
    if(m.style.position==="fixed") document.body.appendChild(m);
  });
}());
(function(){var t=localStorage.getItem("asmb_theme");if(t==="dark"){document.documentElement.setAttribute("data-theme","dark");}}());
(function(){var vt=localStorage.getItem("asmb_visual_theme");if(vt&&vt!=="moderne"&&VISUAL_THEMES[vt]){document.documentElement.setAttribute("data-visual-theme",vt);}}());

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
// Filet de sécurité : l'écran de démarrage ne reste jamais plus de 10 s.
setTimeout(function(){ document.documentElement.classList.remove("gm-boot"); },10000);

// ═══ DETECTION NOUVELLE VERSION ═══════════════════════════════════
var APP_VERSION="1792504486";
// Principe : la mise à jour se prépare et s'installe toute seule en arrière-plan, mais le
// bandeau reste affiché jusqu'à ce que la personne l'ait vu (« Voir le contenu de la mise à
// jour ») et appuyé sur le bouton. Le bouton ne fait que retirer le bandeau si la
// nouvelle version tourne déjà ; sinon il recharge l'appli sur la nouvelle version.
// gm_maj_vue = dernière version dont la personne a pris connaissance.
function majVue(){ try{ return localStorage.getItem("gm_maj_vue"); }catch(e){ return null; } }
function majMarquerVue(v){ try{ if(v) localStorage.setItem("gm_maj_vue",v); }catch(e){} }
function majBandeau(etat){
 var b=document.getElementById("update-banner"); if(!b) return;
 var t=document.getElementById("update-banner-txt"), bt=document.getElementById("update-banner-btn");
 if(etat==="termine"){ if(t) t.textContent="L'application a été mise à jour"; if(bt) bt.textContent="Compris"; }
 else { if(t) t.textContent="Nouvelle version disponible"; if(bt) bt.textContent="Mettre à jour"; }
 b.style.display=etat?"flex":"none";
}
// La nouvelle version tourne-t-elle déjà ? (sinon une version plus récente attend)
function majEnAttente(){ return !!window.GM_MAJ_VERSION && window.GM_MAJ_VERSION!==APP_VERSION; }
// Démarrage : première installation = rien à annoncer ; sinon, version jamais vue = bandeau.
(function(){
 var vue=majVue();
 if(vue===null) majMarquerVue(APP_VERSION);
 else if(vue!==APP_VERSION) majBandeau("termine");
})();
// Installation silencieuse de la nouvelle version (nouveau service worker, nouveaux fichiers),
// sans recharger la page : l'écran en cours n'est pas interrompu.
function majPreparer(v){
 if(window.GM_MAJ_PREPAREE===v) return;
 window.GM_MAJ_PREPAREE=v;
 if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v='+v).catch(function(){});
}
function checkForUpdate(){
 fetch("./version.json?t="+Date.now(),{cache:"no-store"})
 .then(function(r){return r.json();})
 .then(function(data){
 if(data.v&&data.v!==APP_VERSION){
 window.GM_MAJ_VERSION=data.v;
 majPreparer(data.v);
 // Déjà pris connaissance de cette version : pas de bandeau.
 if(majVue()===data.v) return;
 // Il reste affiché jusqu'à ce que la personne le retire : rien ne le cache tout seul.
 majBandeau("attente");
 }
 })
 .catch(function(){});
}
// Bouton : si la nouvelle version tourne déjà, on retire juste le bandeau ; sinon on
// force le téléchargement des fichiers frais, on vide les caches et on recharge.
function applyUpdate(){
 if(!majEnAttente()){ majMarquerVue(APP_VERSION); majBandeau(""); return; }
 majMarquerVue(window.GM_MAJ_VERSION);
 majBandeau("");
 var dest=location.href.split("?")[0]+"?v="+Date.now();
 var fichiers=[].slice.call(document.querySelectorAll("script[src],link[rel=stylesheet][href]")).map(function(el){ return el.src||el.href; })
   .filter(function(u){ return u&&u.indexOf(location.origin)===0; });
 fichiers.push(location.origin+location.pathname.replace(/[^/]*$/,"")+"sw.js");
 var frais=Promise.all(fichiers.map(function(u){ return fetch(u,{cache:"reload"}).catch(function(){}); }));
 var vider=(window.caches&&caches.keys)?caches.keys().then(function(k){ return Promise.all(k.map(function(n){ return caches.delete(n); })); }).catch(function(){}):Promise.resolve();
 var desinscrire=('serviceWorker' in navigator)?navigator.serviceWorker.getRegistrations().then(function(regs){ return Promise.all(regs.map(function(r){ return r.unregister(); })); }).catch(function(){}):Promise.resolve();
 Promise.all([frais,vider,desinscrire])
   .then(function(){ location.href=dest; }, function(){ location.href=dest; });
}
// Retour dans l'appli après une longue absence (≥ 3 min) : on passe sur la nouvelle version
// en silence ; le bandeau « L'application a été mise à jour » s'affiche alors à l'ouverture.
var majMasqueDepuis=0;
document.addEventListener("visibilitychange",function(){
 if(document.visibilityState==="hidden"){ majMasqueDepuis=Date.now(); return; }
 if(majEnAttente()&&majMasqueDepuis&&Date.now()-majMasqueDepuis>180000){
  var dest=location.href.split("?")[0]+"?v="+Date.now(); location.replace(dest);
 }
});
setTimeout(checkForUpdate,4000);
setInterval(checkForUpdate,120000);

// ═══ CONTENU DE LA MISE A JOUR ═══════════════════════════════════
// changelog.json : liste (plus recente en premier) de {v, titre, points}.
// Alimente uniquement pour les changements visibles par un dirigeant/coach/
// parent — pas un doublon du log Git, qui reste technique.
function showChangelog(historique){
  // Filtre par profil actif : un point sans "roles" (ou roles vide) est visible
  // par tout le monde ; sinon seulement par les profils listes. Le super admin
  // (plateforme) voit tout, sans filtre -- ces points ne le concernent pas
  // directement mais rien ne doit lui etre cache.
  var profil=localStorage.getItem("asmb_profile")||"";
  var voitTout=(typeof isSuperAdmin==="function"&&isSuperAdmin());
  fetch("./changelog.json?t="+Date.now(),{cache:"no-store"})
    .then(function(r){return r.json();})
    .then(function(list){
      if(historique===true){   // Paramètres › Nouveautés : les 15 dernières mises à jour
        var sh=gmSheet("Nouveautés"), n=0;
        (list||[]).forEach(function(en){
          if(n>=15) return;
          var pts=(en.points||[]).filter(function(pt){ return voitTout||typeof pt==="string"||!pt.roles||!pt.roles.length||pt.roles.indexOf(profil)>=0; });
          if(!pts.length) return;
          n++;
          var h=document.createElement("div");
          h.style.cssText="font-size:13.5px;font-weight:800;color:var(--txt);margin:"+(n>1?"16px":"0")+" 0 4px";
          var dt=new Date(Number(en.v)*1000);
          h.textContent=(isNaN(dt)?"":dt.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" · ")+(en.titre||"Mise à jour");
          sh.body.appendChild(h);
          var ul2=document.createElement("ul");
          ul2.style.cssText="margin:0;padding-left:20px;font-size:13px;color:var(--txt2);line-height:1.55";
          pts.forEach(function(pt){ var li2=document.createElement("li"); li2.textContent=(typeof pt==="string")?pt:pt.texte; li2.style.marginBottom="4px"; ul2.appendChild(li2); });
          sh.body.appendChild(ul2);
        });
        if(!n){ var vide=document.createElement("div"); vide.style.cssText="font-size:13px;color:var(--txt2)"; vide.textContent="Rien à afficher pour le moment."; sh.body.appendChild(vide); }
        return;
      }
      var entry=(list&&list[0])||null;
      var s=gmSheet(entry&&entry.titre?entry.titre:"Dernière mise à jour");
      var points=((entry&&entry.points)||[]).filter(function(pt){
        if(voitTout) return true;
        if(typeof pt==="string") return true; // ancien format, sans roles
        return !pt.roles || !pt.roles.length || pt.roles.indexOf(profil)>=0;
      });
      if(!points.length){
        var p=document.createElement("div");
        p.style.cssText="font-size:13px;color:var(--txt2)";
        p.textContent="Rien de nouveau ne vous concerne dans cette mise à jour.";
        s.body.appendChild(p);
        return;
      }
      var ul=document.createElement("ul");
      ul.style.cssText="margin:0;padding-left:20px;font-size:13.5px;color:var(--txt2);line-height:1.6";
      points.forEach(function(pt){
        var li=document.createElement("li");
        li.textContent=(typeof pt==="string")?pt:pt.texte;
        li.style.marginBottom="6px";
        ul.appendChild(li);
      });
      s.body.appendChild(ul);
    })
    .catch(function(){
      if(typeof askAlert==="function") askAlert("Impossible de charger le détail de la mise à jour.");
    });
}

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
 text:" Rappel : demain \""+m.titre+"\""+(m.heure?" à "+m.heure:"")+(m.lieu?" · "+m.lieu:""),
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
 if(pull>=THRESHOLD&&!triggered){triggered=true;spinner.style.borderTopColor="var(--ltg)";}
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
 var todayStr=now.toISOString().slice(0,10);
 var demain=new Date(now);demain.setDate(demain.getDate()+1);
 var tomorrowStr=demain.toISOString().slice(0,10);
 events.forEach(function(e){
 var typeKey=e.type==="match"?"match":(e.type==="entrainement"?"entrainement":"evenement");
 if(localStorage.getItem("asmb_notif_"+typeKey)==="off")return;
 var evDate=new Date(e.date+(e.heure?" "+e.heure.replace("h",":"):" 00:00"));
 var diffH=(evDate-now)/3600000;
 // Fenetre large (jusqu'a 24h avant) car l'app n'est pas forcement rouverte
 // dans un creneau precis -- mieux vaut prevenir un peu en avance que jamais.
 // Le libelle "Demain"/"Aujourd'hui" est calcule a part : un evenement ajouté
 // seulement 3h avant, par exemple, est bien "aujourd'hui", pas "demain".
    if(diffH>0&&diffH<=24&&!notified[e.id]){
      var jour=(e.date===tomorrowStr)?"Demain":(e.date===todayStr?"Aujourd'hui":"Bientôt");
      try{
        var icon=e.type==="match"?"":(e.type==="entrainement"?"":"");
        new Notification(icon+" "+clubLabel()+" - "+e.titre,{body:jour+(e.heure?" à "+e.heure:"")+(e.lieu?" · "+e.lieu:""),tag:"asmb-reminder-"+e.id});
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
// Le logo vient de la fiche du club, qui arrive en asynchrone : on pose les
// initiales tout de suite, applyClubLabels() remplacera par le vrai logo.
document.addEventListener("DOMContentLoaded",function(){
  if(typeof applyClubLogo==="function") applyClubLogo();
});


