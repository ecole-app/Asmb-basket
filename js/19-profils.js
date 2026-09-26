/* ===== 19-profils.js — Profils parent/coach/joueur, themes animes ===== */
// ═══ SYSTEME PROFIL PARENT / COACH ═══════════════════════════════
var ASMB_LOGO_B64_REF = null; // will reuse existing home-logo html via cloning

// ═══ THEME ANIME (meteo du jour / saisonnier) ══════════════════════
function taGetSettings(){
  return {
    enabled: localStorage.getItem("asmb_theme_anim_enabled")!=="off",
    style: localStorage.getItem("asmb_theme_anim_style")||"meteo",
    city: localStorage.getItem("asmb_theme_anim_city")||"Saint-Étienne",
    duration: localStorage.getItem("asmb_theme_anim_duration")||"10"
  };
}
function taSaveSetting(key,val){ localStorage.setItem("asmb_theme_anim_"+key, val); }

function taTodayStr(){ var d=new Date(); return d.getFullYear()+"-"+(d.getMonth()+1)+"-"+d.getDate(); }
function taIsNight(){ var h=new Date().getHours(); return h<7||h>=21; }

// Code meteo Open-Meteo -> type d'animation
function taWeatherCodeToType(code, isDay){
  if(code===0||code===1) return isDay?"soleil":"nuit";
  if(code===2||code===3||code===45||code===48) return "nuages";
  if((code>=51&&code<=67)||(code>=80&&code<=82)||(code>=95&&code<=99)) return "pluie";
  if((code>=71&&code<=77)||code===85||code===86) return "neige";
  return "nuages";
}
function taSeasonType(){
  var m=new Date().getMonth(); // 0=jan
  if(m===11||m===0||m===1) return "neige";
  if(m>=2&&m<=4) return "printemps";
  if(m>=5&&m<=7) return taIsNight()?"nuit":"soleil";
  return "automne";
}

// Recupere (avec cache journalier) le type d'animation meteo pour la ville reglee
function taGetWeatherType(city){
  var cacheRaw=localStorage.getItem("asmb_theme_weather_cache");
  var today=taTodayStr();
  try{
    var cache=cacheRaw?JSON.parse(cacheRaw):null;
    if(cache && cache.date===today && cache.city===city){
      return Promise.resolve(cache.type);
    }
  }catch(e){}
  return fetch("https://geocoding-api.open-meteo.com/v1/search?name="+encodeURIComponent(city)+"&count=1&language=fr&format=json")
    .then(function(r){return r.json();})
    .then(function(geo){
      if(!geo.results||!geo.results.length) throw new Error("ville introuvable");
      var lat=geo.results[0].latitude, lon=geo.results[0].longitude;
      return fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&current_weather=true&timezone=auto");
    })
    .then(function(r){return r.json();})
    .then(function(data){
      var cw=data.current_weather;
      var type=taWeatherCodeToType(cw.weathercode, cw.is_day===1);
      localStorage.setItem("asmb_theme_weather_cache", JSON.stringify({date:today,city:city,type:type}));
      return type;
    })
    .catch(function(){ return taSeasonType(); }); // repli silencieux sur le thème saisonnier si la météo échoue
}

function taGetVisibleHomeHero(){
  var ids=["home-hero-portal","home-hero-parent","home-hero-coach"];
  for(var i=0;i<ids.length;i++){
    var el=document.getElementById(ids[i]);
    if(el){
      var scr=el.closest(".scr");
      if(scr && scr.classList.contains("on")) return el;
    }
  }
  return null;
}

function taSpawnAnimation(hero,type){
  if(!hero||hero.dataset.taSpawned)return;
  hero.dataset.taSpawned="1";
  var nodes=[];
  function add(el){ nodes.push(el); hero.appendChild(el); }
  if(type==="neige"){
    for(var i=0;i<24;i++){
      var f=document.createElement("div");f.className="ta-flake";
      var size=2+Math.random()*4;
      f.style.width=size+"px";f.style.height=size+"px";
      f.style.left=Math.random()*100+"%";
      f.style.setProperty("--ta-drift",(Math.random()*40-20)+"px");
      f.style.animationDuration=(3+Math.random()*3)+"s";
      f.style.animationDelay=(Math.random()*3)+"s";
      add(f);
    }
  } else if(type==="soleil"){
    var s=document.createElement("div");s.className="ta-sun";add(s);
  } else if(type==="nuit"){
    var m=document.createElement("div");m.className="ta-moon";add(m);
    for(var i=0;i<20;i++){
      var st=document.createElement("div");st.className="ta-star";
      var size=1+Math.random()*2;
      st.style.width=size+"px";st.style.height=size+"px";
      st.style.left=Math.random()*100+"%";
      st.style.top=Math.random()*70+"%";
      st.style.animationDuration=(1.5+Math.random()*2)+"s";
      st.style.animationDelay=(Math.random()*3)+"s";
      add(st);
    }
  } else if(type==="nuages"){
    ["☁️","☁️","☁️"].forEach(function(c,i){
      var el=document.createElement("div");el.className="ta-cloud";el.textContent=c;
      el.style.fontSize=(20+i*7)+"px";
      el.style.top=(8+i*16)+"px";
      el.style.animationDuration=(14+i*4)+"s";
      el.style.animationDelay=(i*3)+"s";
      add(el);
    });
  } else if(type==="pluie"){
    for(var i=0;i<28;i++){
      var d=document.createElement("div");d.className="ta-drop";
      d.style.left=Math.random()*100+"%";
      d.style.animationDuration=(0.5+Math.random()*0.4)+"s";
      d.style.animationDelay=(Math.random()*1.5)+"s";
      add(d);
    }
  } else if(type==="automne"){
    var leaves=["🍁","🍂"];
    for(var i=0;i<12;i++){
      var l=document.createElement("div");l.className="ta-leaf";l.textContent=leaves[i%2];
      l.style.left=Math.random()*100+"%";
      l.style.animationDuration=(3.5+Math.random()*2)+"s";
      l.style.animationDelay=(Math.random()*3)+"s";
      add(l);
    }
  } else if(type==="printemps"){
    for(var i=0;i<16;i++){
      var p=document.createElement("div");p.className="ta-petal";
      p.style.left=Math.random()*100+"%";
      p.style.animationDuration=(3+Math.random()*2)+"s";
      p.style.animationDelay=(Math.random()*3)+"s";
      add(p);
    }
  }
  var settings=taGetSettings();
  if(settings.duration!=="continu"){
    setTimeout(function(){
      nodes.forEach(function(n){ if(n.parentNode) n.parentNode.removeChild(n); });
    }, parseInt(settings.duration,10)*1000);
  }
}

function maybeShowDailyThemeAnimation(){
  var settings=taGetSettings();
  if(!settings.enabled) return;
  var already = localStorage.getItem("asmb_theme_anim_shown_date")===taTodayStr();
  if(already && settings.duration!=="continu") return; // deja joue aujourd'hui (mode duree fixe)
  var hero=taGetVisibleHomeHero();
  if(!hero) return;
  if(already && settings.duration==="continu" && hero.dataset.taSpawned) return; // deja affiche cette visite
  function spawnWith(type){
    localStorage.setItem("asmb_theme_anim_shown_date", taTodayStr());
    taSpawnAnimation(hero, type);
  }
  if(settings.style==="saison"){
    spawnWith(taSeasonType());
  } else {
    taGetWeatherType(settings.city).then(spawnWith);
  }
}

function initProfile(){
  var urlParams=new URLSearchParams(window.location.search);
  if(urlParams.has("inscription")){
    stack=["inscription"];
    var nav=document.getElementById("bnav-main");
    if(nav){
      nav.innerHTML='<button class="bni on" id="bni-inscription"><span class="bni-ic">'+NAV_ICONS.inscription+'</span>Inscription</button>';
    }
    var setBtn=document.getElementById("hdr-settings-btn");
    if(setBtn) setBtn.style.display="none";
    var profBtn=document.getElementById("hdr-profile-btn");
    if(profBtn) profBtn.style.display="none";
    showScr("inscription");
    buildInscriptionPublic();
    return;
  }
  var profile = localStorage.getItem("asmb_profile");
  injectRoleLogo();
  if(profile==="parent"&&!myPhone){
    // Sans numéro enregistré, on considere que c'est une nouvelle arrivee a chaque fois
    localStorage.removeItem("asmb_profile");
    localStorage.removeItem("asmb_parent_teams");
    localStorage.removeItem("asmb_parent_active_team");
    profile=null;
  }
  if(!profile){
    ROOTS.push("role-select");
    stack=["role-select"];
    showScr("role-select");
    return;
  }
  if(profile==="dirigeant"){
    buildBottomNav("dirigeant");
    stack=["portal"];
    showScr("portal");
    buildPortal();
  } else if(profile==="coach"){
    buildBottomNav("coach");
    if(!getCoachTeam()){
      openCoachTeamPicker();
    } else {
      navToCoach("equipe");
    }
  } else {
    buildBottomNav("parent");
    var teams=getParentTeams();
    if(!teams.length){
      openTeamPicker(false);
    } else {
      stack=["parent-home"];
      showScr("parent-home");
      buildParentHome();
    }
  }
}

function injectRoleLogo(){
  var el=document.getElementById("role-logo");
  if(!el)return;
  var homeLogo=document.getElementById("home-logo");
  if(homeLogo&&homeLogo.innerHTML){el.innerHTML=homeLogo.innerHTML.replace(/width="140"/,'width="90"').replace(/height="175"/,'height="112"');}
}

async function chooseRole(role){
  if(role==="dirigeant"){
    var code=await askPrompt("Code dirigeant", {confirmText:"Valider"});
    if(code===null)return;
    var validCode=localStorage.getItem("asmb_coach_code")||"ASMB2025";
    if(code.trim().toUpperCase()!==validCode.toUpperCase()){
      alert("Code incorrect");
      return;
    }
    localStorage.setItem("asmb_profile","dirigeant");
    buildBottomNav("dirigeant");
    stack=["portal"];
    showScr("portal");
    buildPortal();
  } else if(role==="coach"){
    localStorage.setItem("asmb_profile","coach");
    buildBottomNav("coach");
    if(!getCoachTeam()){
      openCoachTeamPicker();
    } else {
      navToCoach("equipe");
    }
  } else if(role==="joueur"){
    openJoueurCheckin();
  } else {
    localStorage.setItem("asmb_profile","parent");
    buildBottomNav("parent");
    registerParentPhone();
  }
}

// ── ESPACE JOUEUR (auto-pointage) ──────────────────────────────────
var joueurIdentifiedPlayer=null;

async function openJoueurCheckin(){
  var saved=localStorage.getItem("asmb_joueur_phone")||"";
  var phone=await askPrompt("Ton numéro de téléphone", {defaultValue:saved, placeholder:"Celui donné au club", confirmText:"Valider"});
  if(!phone)return;
  phone=phone.trim().replace(/\s+/g,"");
  var player=getPlayers().find(function(p){return p.telEnfant&&p.telEnfant.replace(/\s+/g,"")===phone;});
  if(!player){
    alert("Numéro non reconnu. Demande a ton coach ou dirigeant de l'ajouter dans ta fiche.");
    return;
  }
  localStorage.setItem("asmb_joueur_phone",phone);
  joueurIdentifiedPlayer=player;
  stack=["joueur"];
  showScr("joueur");
  buildJoueurScreen(player);
}

function getLinkedPlayerForCheckin(){
  if(joueurIdentifiedPlayer)return joueurIdentifiedPlayer;
  if(localStorage.getItem("asmb_profile")==="parent"&&myPhone){
    var myP=myPhone.replace(/\s+/g,"");
    var lics=getLicences();
    var lic=lics.find(function(l){
      if(!l.fiche)return false;
      var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(p){return p.replace(/\s+/g,"");});
      return phones.indexOf(myP)>=0;
    });
    if(lic&&lic.fiche){
      return getPlayers().find(function(p){return p.prenom===lic.fiche.prenom&&p.nom===lic.fiche.nom;})||null;
    }
  }
  return null;
}

// ── REGLAGES JOUEUR (modale legere, pas de compte) ────────────────
async function joueurNotMe(){
  var ok=await askConfirm("Ta fiche sera oubliée sur cet appareil. Tu pourras te réidentifier avec ton numéro.", {title:"Ce n'est pas moi ?", confirmText:"Confirmer", danger:true});
  if(!ok) return;
  localStorage.removeItem("asmb_joueur_phone");
  joueurIdentifiedPlayer=null;
  var m=document.querySelector(".joueur-settings-modal");
  if(m) m.remove();
  showAuth("entry");
}
async function joueurChangePhone(){
  var saved=localStorage.getItem("asmb_joueur_phone")||"";
  var phone=await askPrompt("Ton numéro de téléphone", {defaultValue:saved, placeholder:"Celui donné au club", confirmText:"Valider"});
  if(!phone) return;
  phone=phone.trim().replace(/\s+/g,"");
  var player=getPlayers().find(function(p){return p.telEnfant&&p.telEnfant.replace(/\s+/g,"")===phone;});
  if(!player){ alert("Numéro non reconnu. Demande à ton coach ou dirigeant de l'ajouter dans ta fiche."); return; }
  localStorage.setItem("asmb_joueur_phone",phone);
  joueurIdentifiedPlayer=player;
  var m=document.querySelector(".joueur-settings-modal");
  if(m) m.remove();
  buildJoueurScreen(player);
}
function openJoueurSettings(){
  var modal=document.createElement("div");
  modal.className="joueur-settings-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">Réglages</div>'+
      '<button id="pj-close-btn" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div class="sec" style="padding:0 0 8px">Affichage</div>'+
    '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);overflow:hidden;margin-bottom:16px">'+
      '<label style="display:flex;align-items:center;justify-content:space-between;padding:14px">'+
        '<span style="font-size:13px;font-weight:700;color:var(--txt)">Mode sombre</span>'+
        '<input type="checkbox" id="pj-dark" style="width:20px;height:20px;accent-color:var(--dkg)">'+
      '</label>'+
    '</div>'+
    '<div class="sec" style="padding:0 0 8px">Thèmes animés</div>'+
    '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);overflow:hidden;padding:14px;margin-bottom:16px">'+
      '<label style="display:flex;align-items:center;justify-content:space-between;padding:4px 0 12px;border-bottom:1px solid var(--bdr);margin-bottom:12px">'+
        '<span style="font-size:13px;font-weight:700;color:var(--txt)">Activer les thèmes animés</span>'+
        '<input type="checkbox" id="pj-ta-enabled" style="width:20px;height:20px;accent-color:var(--dkg)">'+
      '</label>'+
      '<div style="font-size:10px;font-weight:800;color:var(--ltg);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Style</div>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-style" value="meteo" id="pj-ta-style-meteo"> Météo du jour</label>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:5px 0 12px;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-style" value="saison" id="pj-ta-style-saison"> Saisonnier</label>'+
      '<div id="pj-ta-city-wrap">'+
        '<div style="font-size:10px;font-weight:800;color:var(--ltg);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Ville (météo)</div>'+
        '<input type="text" id="pj-ta-city" placeholder="Nom de la ville" style="width:100%;padding:9px 10px;border:1.5px solid var(--bdr);border-radius:10px;font-size:13px;background:var(--bg);color:var(--txt);margin-bottom:12px">'+
      '</div>'+
      '<div style="font-size:10px;font-weight:800;color:var(--ltg);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">Durée de l\'animation</div>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-dur" value="5" id="pj-ta-dur-5"> 5 secondes</label>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-dur" value="10" id="pj-ta-dur-10"> 10 secondes</label>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-dur" value="15" id="pj-ta-dur-15"> 15 secondes</label>'+
      '<label style="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;color:var(--txt)"><input type="radio" name="pj-ta-dur" value="continu" id="pj-ta-dur-continu"> Continu en fond (écran d\'accueil)</label>'+
    '</div>'+
    '<div class="sec" style="padding:0 0 8px">Mon numéro</div>'+
    '<button id="pj-change-phone-btn" style="width:100%;padding:12px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:13px;font-weight:700;border:none;cursor:pointer;margin-bottom:10px">Changer mon numéro</button>'+
    '<button id="pj-not-me-btn" style="width:100%;padding:12px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:#C0392B;font-size:13px;font-weight:700;border:none;cursor:pointer">Ce n\'est pas moi</button>';
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);

  var darkInp=document.getElementById("pj-dark");
  darkInp.checked=document.documentElement.getAttribute("data-theme")==="dark";
  darkInp.addEventListener("change",function(){ toggleTheme(); });
  document.getElementById("pj-close-btn").addEventListener("click",function(){modal.remove();});
  document.getElementById("pj-change-phone-btn").addEventListener("click",joueurChangePhone);
  document.getElementById("pj-not-me-btn").addEventListener("click",joueurNotMe);
  wireThemeAnimSettings("pj-");
}

function buildJoueurScreen(player){
  var el=document.getElementById("joueur-content");
  el.innerHTML='<div style="text-align:center;padding:20px 0"><div style="font-size:13px;color:var(--mut)">Chargement...</div></div>';

  fetchEventsFromCloud().then(function(events){
    var todayStr=new Date().toISOString().slice(0,10);
    var teams=getTeams();
    var myTeam=teams.find(function(t){return (t.members&&t.members.indexOf(player.id)>=0)||t.cat===player.cat;});
    var todaysEvents=events.filter(function(e){
      if(e.date!==todayStr||e.cancelled)return false;
      var eq=(e.equipe||"").toUpperCase();
      return eventMatchesPlayer(e,player);
    });

    var html='<div style="text-align:center;margin-bottom:24px;position:relative">'+
      '<button onclick="openJoueurSettings()" aria-label="Parametres" style="position:absolute;top:0;right:0;width:34px;height:34px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:16px;color:var(--mut);display:flex;align-items:center;justify-content:center">⚙️</button>'+
      '<div style="width:56px;height:56px;border-radius:50%;background:var(--dkg);display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;margin:0 auto 10px;font-weight:800">'+player.prenom[0]+player.nom[0]+'</div>'+
      '<div style="font-size:17px;font-weight:900;color:var(--txt)">'+player.prenom+' '+player.nom+'</div>'+
      '<div style="font-size:12px;color:var(--mut);margin-top:2px">'+player.cat+(myTeam?" · "+myTeam.name:"")+'</div>'+
    '</div>';

    var mdMatch=getTodayMatchForTeams(myTeam?[myTeam.name]:[player.cat]);
    if(mdMatch){
      var mdSeen=localStorage.getItem("asmb_md_seen_"+mdMatch.id)==="1";
      html+='<div style="margin-bottom:20px">'+matchdayBannerHtml(mdMatch,mdSeen)+'</div>';
    }

    var exitBtn='<button onclick="logoutUser()" style="margin-top:24px;width:100%;padding:12px;border-radius:var(--rx);background:#C0392B;color:#fff;font-size:12px;font-weight:800;border:none;cursor:pointer"> Se déconnecter</button>';

    if(!todaysEvents.length){
      html+='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun entraînement aujourd\'hui</div></div>'+exitBtn;
      el.innerHTML=html;
      return;
    }

    var container=document.createElement("div");
    container.innerHTML=html;
    el.innerHTML="";
    el.appendChild(container);

    todaysEvents.forEach(function(ev){
      checkExistingCheckin(ev.id,player.id).then(function(existing){
        var card=document.createElement("div");
        card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;margin-bottom:14px;box-shadow:0 2px 8px var(--shadow)";
        var locked=existing&&(existing.status==="present"||existing.status==="absent");
        var actionHtml;
        if(locked){
          actionHtml='<div style="margin-top:12px">'+checkinBadgeHtml(player.id,ev.id,existing.status)+'</div>';
        } else if(ev.type==="match"){
          actionHtml='<div style="margin-top:12px">'+checkinButtonsHtml(player.id,ev.id)+'</div>';
        } else {
          actionHtml='<div style="margin-top:12px"><button onclick="signalerAbsence(\''+ev.id+'\')" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:#C0392B;font-size:12px;font-weight:700;border:none;cursor:pointer"> Signaler une absence</button></div>';
        }
        card.innerHTML='<div style="font-size:14px;font-weight:800;color:var(--txt)">'+ev.titre+'</div>'+
          '<div style="font-size:12px;color:var(--mut);margin-top:2px">'+(ev.heure||"")+(ev.lieu?" · "+ev.lieu:"")+'</div>'+actionHtml;
        el.appendChild(card);
      });
    });
    var exitDiv=document.createElement("div");
    exitDiv.innerHTML='<button onclick="logoutUser()" style="margin-top:16px;width:100%;padding:12px;border-radius:var(--rx);background:#C0392B;color:#fff;font-size:12px;font-weight:800;border:none;cursor:pointer"> Se déconnecter</button>';
    el.appendChild(exitDiv);
  });
}

function checkExistingCheckin(eventId,playerId){
  if(!window.fbReady)return Promise.resolve(null);
  var docId=eventId+"_"+playerId;
  return window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
    var found=null;
    snap.forEach(function(d){if(d.id===docId)found=d.data();});
    return found;
  }).catch(function(){return null;});
}

function refreshEventCounts(eventId){
  if(!window.fbReady)return;
  var absEl=document.getElementById("cal-absences-"+eventId);
  var countsEl=document.getElementById("cal-counts-"+eventId);
  var mCountsEl=document.getElementById("match-counts-"+eventId);
  if(!absEl&&!countsEl&&!mCountsEl)return;
  window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
    var notable=[],pres=0,abs=0;
    snap.forEach(function(d){
      var c=d.data();
      if(c.eventId!==eventId)return;
      if(c.status==="present")pres++;
      else if(c.status==="absent"){abs++;notable.push(c);}
    });
    var badges='<span style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#D4AF37;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center">'+pres+'</span>'+
      '<span style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#C0392B;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center">'+abs+'</span>';
    if(countsEl)countsEl.innerHTML=badges;
    if(mCountsEl)mCountsEl.innerHTML=badges;
    if(absEl){
      if(notable.length){
        var html='<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bdr)">';
        notable.forEach(function(c){
          html+='<div style="font-size:10px;color:var(--mut);margin-top:2px">'+c.playerName+' absent(e)</div>';
        });
        html+='</div>';
        absEl.innerHTML=html;
      } else absEl.innerHTML="";
    }
  }).catch(function(){});
}

function checkinButtonsHtml(playerId,eventId){
  return '<div style="display:flex;gap:8px" id="checkin-btns-'+eventId+'">'+
    '<button onclick="joueurSelfCheckin(\''+playerId+'\',\''+eventId+'\',\'present\')" style="flex:1;padding:10px;border-radius:var(--rx);background:#D4AF37;color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer">✓ Présent</button>'+
    '<button onclick="joueurSelfCheckin(\''+playerId+'\',\''+eventId+'\',\'absent\')" style="flex:1;padding:10px;border-radius:var(--rx);background:#C0392B;color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer">✕ Absent</button>'+
  '</div>';
}

function checkinBadgeHtml(playerId,eventId,status){
 var lbl={present:"✓ Présent",retard:"En retard",absent:"✕ Absent"};
 var col={present:"#D4AF37",retard:"#E8670A",absent:"#C0392B"};
 return '<div onclick="reopenCheckin(this,\''+playerId+'\',\''+eventId+'\')" style="cursor:pointer;text-align:center;padding:9px;border-radius:var(--rx);background:'+col[status]+';color:#fff;font-size:12px;font-weight:800">'+lbl[status]+' · enregistré (toucher pour modifier)</div>';
}

function reopenCheckin(el,playerId,eventId){
  el.outerHTML=checkinButtonsHtml(playerId,eventId);
  if(!window.fbReady)return;
  window.fbDeleteDoc(window.fbDoc(window.fbDb,"checkins",eventId+"_"+playerId)).then(function(){
    refreshEventCounts(eventId);
  }).catch(function(){});
}

function joueurSelfCheckin(playerId,eventId,status){
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  var player=getPlayers().find(function(p){return p.id===playerId;});
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!player)return;
  var docId=eventId+"_"+playerId;
  window.fbSetDoc(window.fbDoc(window.fbDb,"checkins",docId),{
    eventId:eventId,playerId:playerId,
    playerName:player.prenom+" "+player.nom,
    eventTitre:ev?ev.titre:"",eventDate:ev?ev.date:"",
    status:status,ts:window.fbServerTimestamp(),source:"self"
  }).then(function(){
    var badgeHtml=checkinBadgeHtml(playerId,eventId,status);
    var btnsEl=document.getElementById("joueur-btns-"+eventId)||document.getElementById("checkin-btns-"+eventId);
    if(btnsEl)btnsEl.outerHTML=badgeHtml;
    var calSlot=document.getElementById("cal-checkin-"+eventId);
    if(calSlot)calSlot.innerHTML=badgeHtml;
    var matchActionsEl=document.getElementById("match-actions-"+eventId);
    if(matchActionsEl)matchActionsEl.innerHTML=badgeHtml;
    refreshEventCounts(eventId);
    if((status==="absent"||status==="retard")&&ev){
      var channelId=findChannelForTeamText(ev.equipe||player.cat);
      var msgTxt=status==="absent"?
        ("<b>"+player.prenom+" "+player.nom+"</b> s'est déclaré(e) absent(e) a \""+ev.titre+"\""):
        ("<b>"+player.prenom+" "+player.nom+"</b> s'est déclaré(e) en retard a \""+ev.titre+"\"");
      window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
        text:msgTxt,pseudo:"Systeme ASMB",ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
      });
    }
  }).catch(function(){alert("Erreur, réessayez");});
}

async function registerParentPhone(){
  if(myPhone){openTeamPicker(false);return;}
  var phone=await askPrompt("Votre numéro de téléphone", {placeholder:"Le même que celui fourni au club", confirmText:"Rejoindre"});
  if(!phone){
    notifyPhoneSkipped();
    openTeamPicker(false);
    return;
  }
  phone=phone.trim().replace(/\s+/g,"");
  myPhone=phone;
  localStorage.setItem("asmb_phone",phone);
  autoLinkParentToChannel(phone);
}

function notifyPhoneSkipped(){
  if(!window.fbReady)return;
  window.fbAddDoc(window.fbCollection(window.fbDb,"channels","general","messages"),{
    text:"Un parent a rejoint l'application sans renseigner son numéro de téléphone. Il n'a pas encore accès a la communaute.",
    pseudo:"Systeme ASMB",ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
  });
}

function autoLinkParentToChannel(phone){
  var lics=getLicences();
  var lic=lics.find(function(l){
    if(!l.fiche)return false;
    var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(p){return p.replace(/\s+/g,"");});
    return phones.indexOf(phone)>=0;
  });
  if(!lic||!lic.categorie){
    pendingJoinRequestPhone=phone;
    openTeamPicker(false);
    return;
  }
  // Auto-selectionner l'équipe correspondant a la catégorie de l'enfant
  var matchingTeams=getTeams().filter(function(t){return t.cat===lic.categorie;});
  var parentTeams=getParentTeams();
  matchingTeams.forEach(function(t){if(parentTeams.indexOf(t.id)<0)parentTeams.push(t.id);});
  saveParentTeamsList(parentTeams);

  // Auto-ajout au canal correspondant
  var childName=lic.fiche.prenom||"";
  var label=childName+(lic.categorie?"-"+lic.categorie:"");
  var channelId=findChannelForTeamText(lic.categorie);
  if(window.fbReady){
    window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(snap){
      var chData=null;
      snap.forEach(function(d){if(d.id===channelId)chData=d.data();});
      var members=(chData&&chData.members)||[];
      var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===phone;});
      if(!exists){
        members.push({phone:phone,label:label});
        window.fbSetDoc(window.fbDoc(window.fbDb,"channels",channelId),{members:members},{merge:true});
      }
    });
  }

  if(matchingTeams.length){
    alert("Bienvenue ! Vous avez ete rattache automatiquement a l'équipe "+matchingTeams[0].name+" et au canal correspondant.");
    saveParentTeams();
  } else {
    openTeamPicker(false);
  }
}

function navToCoach(which){
  document.querySelectorAll("#bnav-main .bni").forEach(function(b){b.classList.remove("on");});
  var hbk=document.getElementById("hbk");
  if(which==="equipe"){
    var b=document.getElementById("bni-c-equipe");if(b)b.classList.add("on");
    stack=["coach-equipe"];showScr("coach-equipe");buildCoachEquipe();
  } else if(which==="formation"){
    var b2=document.getElementById("bni-c-formation");if(b2)b2.classList.add("on");
    stack=["elite"];showScr("elite");buildElite();
  } else if(which==="competition"){
    var b3=document.getElementById("bni-c-competition");if(b3)b3.classList.add("on");
    currentPoleId="competition";
    stack=["pole-competition"];showScr("pole-competition");buildPoleScreen("competition");
  } else if(which==="evenements"){
    var b4=document.getElementById("bni-c-evenements");if(b4)b4.classList.add("on");
    currentPoleId="evenement";
    stack=["pole-evenement"];showScr("pole-evenement");buildPoleScreen("evenement");
  } else if(which==="communaute"){
    var b5=document.getElementById("bni-c-communaute");if(b5)b5.classList.add("on");
    stack=["communaute"];showScr("communaute");buildCommunaute();
  }
  if(hbk)hbk.classList.remove("show");
}

function refreshHeaderProfileBtn(){
  var prof=localStorage.getItem("asmb_profile")||"";
  var isStaff=prof==="coach"||prof==="dirigeant";
  var pb=document.getElementById("hdr-profile-btn");
  if(pb)pb.style.display=isStaff?"flex":"none";
}

function logoutUser(){
  askConfirm("Votre numéro reste enregistré pour votre prochain retour.", {title:"Se déconnecter ?", confirmText:"Se déconnecter"}).then(function(ok){
    if(!ok)return;
    // On garde asmb_phone et asmb_pseudo pour un retour rapide
    ["asmb_profile","asmb_parent_teams","asmb_parent_active_team"].forEach(function(k){
      localStorage.removeItem(k);
    });
    location.reload();
  });
}

function roleLabel(r){
  return {dirigeant:"Dirigeant",coach:"Coach",parent:"Parent",joueur:"Joueur"}[r]||r;
}
function openParametres(){
  var profile=localStorage.getItem("asmb_profile");
  if(profile==="parent"){ openParentSettings(); return; }
  stack.push("parametres");
  buildParametres();
  showScr("parametres");
}
function switchProfile(){
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.length<2){ return; }
  var current=localStorage.getItem("asmb_profile");
  var modal=document.createElement("div");
  modal.className="identity-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Se connecter en tant que";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  inner.appendChild(hdr);
  roles.forEach(function(r){
    var isCur=(r===current);
    var row=document.createElement("button");
    row.style.cssText="width:100%;display:flex;align-items:center;gap:12px;padding:14px;margin-bottom:8px;border-radius:var(--rs);border:1.5px solid "+(isCur?"var(--grn)":"var(--bdr)")+";background:"+(isCur?"rgba(212,175,55,.08)":"var(--card)")+";cursor:pointer;text-align:left";
    var av=document.createElement("div");
    av.style.cssText="width:38px;height:38px;border-radius:50%;background:var(--dkg);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0";
    av.textContent=roleLabel(r).charAt(0);
    var lbl=document.createElement("div");
    lbl.style.cssText="flex:1;font-size:14px;font-weight:700;color:var(--txt)";
    lbl.textContent=roleLabel(r);
    if(isCur){var chk=document.createElement("span");chk.style.cssText="color:var(--grn);font-weight:800";chk.textContent="\u2713";lbl.appendChild(document.createTextNode(" "));row.appendChild(av);row.appendChild(lbl);row.appendChild(chk);}
    else {row.appendChild(av);row.appendChild(lbl);}
    row.addEventListener("click",function(e){
      e.stopPropagation();
      modal.remove();
      if(r===current) return;
      localStorage.setItem("asmb_profile", r);
      if(r!=="parent"){ localStorage.removeItem("asmb_parent_active_team"); }
      initProfile();
    });
    inner.appendChild(row);
  });
  modal.addEventListener("click",function(){modal.remove();});
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

// ── PARENT TEAMS ─────────────────────────────────────────────────
function getParentTeams(){try{return JSON.parse(localStorage.getItem("asmb_parent_teams")||"[]");}catch(e){return [];}}
function saveParentTeamsList(ids){localStorage.setItem("asmb_parent_teams",JSON.stringify(ids));}
function getParentChildren(){
  var ids=(window.ASMB_USER&&window.ASMB_USER.linkedPlayerIds)||[];
  if(!ids.length) return [];
  return getPlayers().filter(function(p){return ids.indexOf(p.id)>=0;});
}
function getTeamForPlayer(pid){
  return getTeams().find(function(t){return (t.members||[]).indexOf(pid)>=0;})||null;
}
function getActiveTeamId(){return localStorage.getItem("asmb_parent_active_team")||"";}
function setActiveTeamId(id){localStorage.setItem("asmb_parent_active_team",id);}

var teamPickerContext="parent";

function openTeamPicker(fromHome){
  teamPickerContext="parent";
  document.getElementById("tp-icon").textContent="";
  document.getElementById("tp-title").textContent="Quelle équipe suivez-vous ?";
  document.getElementById("tp-sub").textContent="Vous pouvez suivre plusieurs équipes";
  var teams=getTeams();
  var selected=getParentTeams();
  var el=document.getElementById("team-picker-list");
  if(!teams.length){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucune équipe créée</div><div style="font-size:11px;margin-top:4px">Contactez un responsable du club</div></div>';
  } else {
    el.innerHTML="";
    teams.forEach(function(t){
      var isSel=selected.indexOf(t.id)>=0;
      var div=document.createElement("div");
      div.className="cy-card";
      div.dataset.teamid=t.id;
      div.style.cursor="pointer";
      div.onclick=function(){toggleTeamPick(div,t.id);};
      div.innerHTML='<div class="cy-bar" style="background:'+(isSel?"#D4AF37":"var(--bdr)")+'"></div><div class="cy-em" style="background:'+(isSel?"#D4AF37":"var(--dkg)")+'">'+(isSel?"✓":"")+'</div><div class="cy-inf"><div class="cy-nm">'+t.name+'</div><div class="cy-pr">'+t.cat+'</div></div>';
      el.appendChild(div);
    });
  }
  stack.push("team-picker");
  showScr("team-picker");
}

function toggleTeamPick(div,teamId){
  var selected=getParentTeams();
  var idx=selected.indexOf(teamId);
  if(idx>=0)selected.splice(idx,1);
  else selected.push(teamId);
  saveParentTeamsList(selected);
  openTeamPicker(true);
}

var pendingJoinRequestPhone=null;

function saveParentTeams(){
  var selected=getParentTeams();
  if(!selected.length){alert("Sélectionnez au moins une équipe");return;}
  if(!getActiveTeamId()||selected.indexOf(getActiveTeamId())<0)setActiveTeamId(selected[0]);
  buildBottomNav("parent");

  if(pendingJoinRequestPhone){
    submitJoinRequest(pendingJoinRequestPhone,selected);
    pendingJoinRequestPhone=null;
  }

  if(!localStorage.getItem("asmb_tuto_done")){
    showTutoriel();
  } else {
    stack=["parent-home"];
    showScr("parent-home");
    buildParentHome();
  }
}

async function submitJoinRequest(phone,teamIds){
  if(!window.fbReady)return;
  var teams=getTeams().filter(function(t){return teamIds.indexOf(t.id)>=0;});
  var teamNames=teams.map(function(t){return t.name;}).join(", ");
  var childName=(await askPrompt("Prénom de votre enfant", {placeholder:"Pour la demande envoyée au coach", confirmText:"Envoyer"}))||"Parent";
  window.fbAddDoc(window.fbCollection(window.fbDb,"joinRequests"),{
    phone:phone,childName:childName,teamIds:teamIds,teamNames:teamNames,
    status:"pending",ts:window.fbServerTimestamp()
  });
  alert("Votre demande a ete envoyée au coach. Vous aurez accès au canal de l'équipe une fois validée.");
}

// ── TUTORIEL PARENT (premiere connexion) ────────────────────────────
var tutoStep=0;
var TUTO_STEPS=[
  {icon:"",titre:"Bienvenue !",texte:"Retrouvez ici tout ce qui concerne l'équipe de votre enfant : prochains matchs, entraînements et résultats."},
  {icon:"",titre:"Onglet Équipe",texte:"Consultez la composition de l'équipe, les postes et numéros de maillot de chaque joueur."},
  {icon:"",titre:"Onglet Stats",texte:"Suivez le bilan de présence et l'assiduité de l'équipe au fil de la saison."},
  {icon:"",titre:"Onglet Événement",texte:"Retrouvez tous les matchs et entraînements a venir, avec les convocations du coach."},
  {icon:"",titre:"Communauté",texte:"Echangez avec les autres familles et le club dans les canaux de discussion dedies."}
];

function showTutoriel(){
  tutoStep=0;
  stack=["tutoriel"];
  showScr("tutoriel");
  renderTutoStep();
}

function renderTutoStep(){
  var step=TUTO_STEPS[tutoStep];
  var el=document.getElementById("tuto-content");
  var dots=TUTO_STEPS.map(function(_,i){return '<span style="width:'+(i===tutoStep?"20px":"7px")+';height:7px;border-radius:4px;background:'+(i===tutoStep?"var(--dkg)":"var(--bdr)")+';transition:all .2s"></span>';}).join("");
  el.innerHTML=
    '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 24px;text-align:center">'+
      '<div style="font-size:64px;margin-bottom:24px">'+step.icon+'</div>'+
      '<div style="font-size:19px;font-weight:900;color:var(--txt);margin-bottom:12px">'+step.titre+'</div>'+
      '<div style="font-size:14px;color:var(--mut);line-height:1.6;max-width:320px">'+step.texte+'</div>'+
    '</div>'+
    '<div style="padding:20px 24px;display:flex;flex-direction:column;gap:16px">'+
      '<div style="display:flex;justify-content:center;gap:6px">'+dots+'</div>'+
      '<div style="display:flex;gap:10px">'+
        (tutoStep>0?'<button onclick="tutoPrev()" style="flex:1;padding:13px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:13px;font-weight:600;border:none;cursor:pointer">Précédent</button>':'<button onclick="skipTutoriel()" style="flex:1;padding:13px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:13px;font-weight:600;border:none;cursor:pointer">Passer</button>')+
        '<button onclick="tutoNext()" style="flex:2;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer">'+(tutoStep===TUTO_STEPS.length-1?"C'est parti !":"Suivant")+'</button>'+
      '</div>'+
    '</div>';
}

function tutoNext(){
  if(tutoStep<TUTO_STEPS.length-1){tutoStep++;renderTutoStep();}
  else finishTutoriel();
}
function tutoPrev(){if(tutoStep>0){tutoStep--;renderTutoStep();}}
function skipTutoriel(){finishTutoriel();}
function finishTutoriel(){
  localStorage.setItem("asmb_tuto_done","1");
  stack=["parent-home"];
  showScr("parent-home");
  buildParentHome();
}

// ── COACH TEAM (équipe unique) ────────────────────────────────────
function getCoachTeams(){
  try{
    var raw=localStorage.getItem("asmb_coach_teams");
    if(raw)return JSON.parse(raw);
  }catch(e){}
  var legacy=localStorage.getItem("asmb_coach_team");
  return legacy?[legacy]:[];
}
function saveCoachTeams(ids){localStorage.setItem("asmb_coach_teams",JSON.stringify(ids));}
function toggleCoachTeam(id){
  var ids=getCoachTeams();
  var i=ids.indexOf(id);
  if(i>=0)ids.splice(i,1);else ids.push(id);
  saveCoachTeams(ids);
  localStorage.setItem("asmb_coach_active_team",ids[0]||"");
  localStorage.setItem("asmb_coach_team",ids[0]||"");
}
// Équipe actuellement affichée (parmi celles assignées) : ne modifie jamais la liste complète
function getCoachTeam(){
  var ids=getCoachTeams();
  if(!ids.length) return "";
  var active=localStorage.getItem("asmb_coach_active_team");
  return (active && ids.indexOf(active)>=0) ? active : ids[0];
}
function setCoachTeam(id){
  localStorage.setItem("asmb_coach_active_team",id);
  localStorage.setItem("asmb_coach_team",id);
}

function openCoachTeamPicker(){
  teamPickerContext="coach";
  document.getElementById("tp-icon").textContent="";
  document.getElementById("tp-title").textContent="Quelle(s) équipe(s) entrainez-vous ?";
  document.getElementById("tp-sub").textContent="Selectionnez une ou plusieurs équipes, puis validez";
  var teams=getTeams();
  var current=getCoachTeam();
  var el=document.getElementById("team-picker-list");
  if(!teams.length){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucune équipe créée</div><div style="font-size:11px;margin-top:4px">Contactez un responsable du club</div></div>';
  } else {
    var selected=getCoachTeams();
    el.innerHTML="";
    teams.forEach(function(t){
      var isSel=selected.indexOf(t.id)>=0;
      var div=document.createElement("div");
      div.className="cy-card";
      div.style.cursor="pointer";
      div.onclick=function(){toggleCoachTeam(t.id);openCoachTeamPicker();};
      div.innerHTML='<div class="cy-bar" style="background:'+(isSel?"#D4AF37":"var(--bdr)")+'"></div><div class="cy-em" style="background:'+(isSel?"#D4AF37":"var(--dkg)")+'">'+(isSel?"✓":"")+'</div><div class="cy-inf"><div class="cy-nm">'+t.name+'</div><div class="cy-pr">'+t.cat+'</div></div>';
      el.appendChild(div);
    });
  }
  stack.push("team-picker");
  showScr("team-picker");
}

function confirmTeamPicker(){
  if(teamPickerContext==="coach"){
    if(!getCoachTeams().length){alert("Sélectionnez au moins une équipe");return;}
    buildBottomNav("coach");
    navToCoach("equipe");
  } else {
    saveParentTeams();
  }
}

// ── PARENT HOME ───────────────────────────────────────────────────
function buildParentHome(){
  updateCountdownBanner("parent-countdown");
  var children=getParentChildren();
  var teamIds;
  if(children.length){
    teamIds=[];
    children.forEach(function(c){var t=getTeamForPlayer(c.id);if(t&&teamIds.indexOf(t.id)<0)teamIds.push(t.id);});
    if(teamIds.length)saveParentTeamsList(teamIds); else teamIds=getParentTeams();
  } else {
    teamIds=getParentTeams();
  }
  var allTeams=getTeams();
  var myTeams=allTeams.filter(function(t){return teamIds.indexOf(t.id)>=0;});
  renderMatchdayBanner("parent-matchday-banner",myTeams.map(function(t){return t.name;}));
  if(!myTeams.length){openTeamPicker(false);return;}
  var activeId=getActiveTeamId();
  if(!myTeams.find(function(t){return t.id===activeId;}))activeId=myTeams[0].id;
  setActiveTeamId(activeId);
  var activeTeam=myTeams.find(function(t){return t.id===activeId;});

  var pLogoEl=document.getElementById("parent-hero-logo");
  var pHomeLogo=document.getElementById("home-logo");
  if(pLogoEl&&pHomeLogo&&pHomeLogo.innerHTML)pLogoEl.innerHTML=pHomeLogo.innerHTML;
  document.getElementById("parent-hero-team").textContent="ASMB · "+activeTeam.name;
  fillTodayHero("parent-hero-event","parent-date",activeTeam,null,"Aucun entraînement aujourd'hui");

  // Resume : matchs joues + statut licence
  var summaryEl=document.getElementById("parent-summary-row");
  var matchesPlayed=getEvents().filter(function(e){
    if(e.type!=="match"||!e.equipe)return false;
    var eq=e.equipe.toUpperCase();
    var matchTeam=(eq.indexOf(activeTeam.name.toUpperCase())>=0);
    return matchTeam&&e.date<=new Date().toISOString().slice(0,10);
  }).length;
  var myLic=getMyLicenceForTeam(activeTeam);
  var licBadge="";
  if(myLic){
    var licColors={"validee":"#D4AF37","recue":"#8E44AD","en_cours":"#1A2E5A","ouverte":"#E8670A","envoyee":"#7a8caa"};
    var licLabels={"validee":"Licence validée","recue":"Fiche reçue","en_cours":"Fiche en cours","ouverte":"Fiche ouverte","envoyee":"Fiche a completer"};
    licBadge='<div style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;text-align:center;box-shadow:0 2px 8px var(--shadow)">'+
      '<div style="font-size:10px;color:'+((licColors[myLic.statut])||"var(--mut)")+';font-weight:700">●</div>'+
      '<div style="font-size:11px;font-weight:700;color:var(--txt);margin-top:2px">'+(licLabels[myLic.statut]||"Licence")+'</div>'+
    '</div>';
  }
  summaryEl.innerHTML='<div style="flex:1;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;text-align:center;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:18px;font-weight:900;color:var(--dkg)">'+matchesPlayed+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:2px">Match'+(matchesPlayed>1?"s":"")+' joue'+(matchesPlayed>1?"s":"")+'</div>'+
  '</div>'+licBadge;

  // Chips : enfants (avatar) si rattachés, sinon équipes
  var chipsEl=document.getElementById("parent-team-chips");
  chipsEl.innerHTML="";
  if(children.length){
    children.forEach(function(c){
      var t=getTeamForPlayer(c.id);
      var isActive=t&&t.id===activeId;
      var b=document.createElement("button");
      b.className="cat-filter"+(isActive?" on":"");
      b.style.cssText="display:inline-flex;align-items:center;gap:6px";
      var av=document.createElement("span");
      av.style.cssText="width:22px;height:22px;border-radius:50%;background:var(--dkg);color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:800;flex-shrink:0";
      av.textContent=(c.prenom||"?").charAt(0).toUpperCase();
      b.appendChild(av);
      b.appendChild(document.createTextNode(c.prenom+(t?"":" (sans équipe)")));
      if(t){ (function(tid){b.addEventListener("click",function(){setActiveTeamId(tid);buildParentHome();});})(t.id); }
      chipsEl.appendChild(b);
    });
  } else {
    myTeams.forEach(function(t){
      var b=document.createElement("button");
      b.className="cat-filter"+(t.id===activeId?" on":"");
      b.textContent=t.name;
      b.onclick=function(){setActiveTeamId(t.id);buildParentHome();};
      chipsEl.appendChild(b);
    });
  }

  // Prochain événement
  var nextEv=getNextEventForTeam(activeTeam);
  maybeShowPwaHint();
  var evEl=document.getElementById("parent-next-event");
  if(!nextEv){
    evEl.innerHTML='<div class="empty-state" style="padding:30px 20px"><div style="font-size:13px;font-weight:600">Aucun événement a venir</div></div>';
  } else {
    var col=eventTypeColor(nextEv.type);
    var dateObj=new Date(nextEv.date);
    var dStr=dateObj.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
    var mapsBtn=(nextEv.type==="match"&&nextEv.lieu)?('<a href="https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(nextEv.lieu)+'" target="_blank" style="display:inline-flex;align-items:center;gap:5px;margin-top:10px;padding:7px 14px;border-radius:20px;background:rgba(26,46,90,.1);color:#1A2E5A;font-size:11px;font-weight:700;text-decoration:none"> Itineraire</a>'):"";
    var absenceBtn='<button onclick="signalerAbsence(\''+nextEv.id+'\')" style="margin-top:10px;margin-right:6px;padding:7px 14px;border-radius:20px;background:rgba(192,57,43,.1);color:#C0392B;font-size:11px;font-weight:700;border:none;cursor:pointer"> Signaler une absence</button>';
    var rdv=(nextEv.type==="match")?rdvTimeFor(nextEv):null;
    var rdvLine=rdv?('<div style="margin-top:10px;padding:8px 12px;border-radius:var(--rx);background:rgba(232,103,10,.1);color:#E8670A;font-size:12px;font-weight:800">RDV sur place a '+rdv.txt+' ('+rdv.mins+' min avant)</div>'):'';
    var icsB=(nextEv.type==="match")?('<button onclick="exportEventIcs(\''+nextEv.id+'\')" style="margin-top:10px;margin-right:6px;padding:7px 14px;border-radius:20px;background:rgba(212,175,55,.1);color:#D4AF37;font-size:11px;font-weight:700;border:none;cursor:pointer"> Agenda</button>'):'';
    var carB=(nextEv.type==="match")?('<button onclick="shareCovoiturage(\''+nextEv.id+'\')" style="margin-top:10px;margin-right:6px;padding:7px 14px;border-radius:20px;background:rgba(142,68,173,.1);color:#8E44AD;font-size:11px;font-weight:700;border:none;cursor:pointer"> Covoiturage</button>'):'';
    evEl.innerHTML='<div style="background:var(--card);border:1px solid var(--bdr);border-left:4px solid '+col+';border-radius:var(--r);padding:16px;box-shadow:0 2px 12px var(--shadow)">'+
      '<span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;color:#fff;background:'+col+'">'+nextEv.type.toUpperCase()+'</span>'+
      '<div style="font-size:17px;font-weight:900;color:var(--txt);margin-top:10px;line-height:1.25">'+nextEv.titre+'</div>'+
      '<div style="font-size:13px;color:var(--mut);margin-top:6px">'+dStr+(nextEv.heure?" · "+nextEv.heure:"")+'</div>'+
      (nextEv.lieu?'<div style="font-size:13px;color:var(--mut);margin-top:2px">📍 '+nextEv.lieu+'</div>':'')+
      rdvLine+
      '<div style="display:flex;flex-wrap:wrap">'+absenceBtn+mapsBtn+icsB+carB+'</div>'+
    '</div>';
  }

  // Derniers matchs joues
  var lastMatches=getLastMatchesForTeam(activeTeam);
  var lmEl=document.getElementById("parent-last-matches");
  if(!lastMatches.length){
    lmEl.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:12px;color:var(--mut)">Aucun match joué pour le moment</div></div>';
  } else {
    lmEl.innerHTML="";
    lastMatches.forEach(function(m){
      var res=m.score.asmb>m.score.adv?"V":(m.score.asmb<m.score.adv?"D":"N");
      var resCol=res==="V"?"#D4AF37":(res==="D"?"#C0392B":"#E8670A");
      var div=document.createElement("div");
      div.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;box-shadow:0 2px 8px var(--shadow)";
      div.innerHTML='<div style="width:30px;height:30px;border-radius:50%;background:'+resCol+';color:#fff;font-size:13px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+res+'</div><div style="flex:1"><div style="font-size:12px;font-weight:700;color:var(--txt)">ASMB '+m.score.asmb+' - '+m.score.adv+' '+m.score.adversaire+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">'+m.date+'</div></div>';
      lmEl.appendChild(div);
    });
  }

  // Stats présence
  var stats=getTeamPresenceStats(activeTeam);
  var statsEl=document.getElementById("parent-stats");
  if(stats.total===0){
    statsEl.innerHTML='<div class="empty-state" style="padding:24px 20px"><div style="font-size:12px;color:var(--mut)">Pas d\'historique de données pour le moment</div></div>';
  } else {
    statsEl.innerHTML='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;box-shadow:0 2px 12px var(--shadow);display:flex;align-items:center;justify-content:space-around;text-align:center">'+
      '<div><div style="font-size:22px;font-weight:900;color:#D4AF37">'+stats.pct+'%</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Assiduité</div></div>'+
      '<div style="width:1px;height:36px;background:var(--bdr)"></div>'+
      '<div><div style="font-size:22px;font-weight:900;color:var(--txt)">'+stats.present+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Présences</div></div>'+
      '<div style="width:1px;height:36px;background:var(--bdr)"></div>'+
      '<div><div style="font-size:22px;font-weight:900;color:var(--txt)">'+stats.total+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Séances</div></div>'+
    '</div>';
  }
}

function getMyLicenceForTeam(team){
  if(!myPhone)return null;
  var lics=getLicences();
  return lics.find(function(l){
    if(!l.fiche)return false;
    var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(p){return p.replace(/\s+/g,"");});
    var myP=myPhone.replace(/\s+/g,"");
    var phoneMatch=phones.indexOf(myP)>=0;
    if(!phoneMatch)return false;
    if(l.categorie&&team.cat&&l.categorie!==team.cat)return false;
    return true;
  })||null;
}

async function signalerAbsence(eventId){
  if(!(await checkMyPhone()))return;
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev)return;

  // Retrouver l'enfant lie a ce parent (via son téléphone) pour verifier les doublons
 var linkedPlayer=getLinkedPlayerForCheckin();

 var proceed=async function(nom,playerId){
 var motif=(await askPrompt("Motif", {placeholder:"Optionnel", confirmText:"Envoyer"}))||"";
 var channelId=findChannelForTeamText(ev.equipe);
 window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
 text:" <b>Absence signalée</b><br>"+nom+" sera absent(e) pour \""+ev.titre+"\" le "+ev.date+(motif?"<br>Motif : "+motif:""),
 pseudo:" "+(nom||"Parent"),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
 });
 if(playerId){
 window.fbSetDoc(window.fbDoc(window.fbDb,"checkins",eventId+"_"+playerId),{
 eventId:eventId,playerId:playerId,playerName:nom,
 eventTitre:ev.titre,eventDate:ev.date,
 status:"absent",ts:window.fbServerTimestamp(),source:"parent"
 });
 }
 alert("Absence signalée dans le canal de l'équipe.");
  };

  if(linkedPlayer){
    // Verifier si un pointage existe déjà pour cet enfant sur cet événement
    checkExistingCheckin(eventId,linkedPlayer.id).then(function(existing){
      if(existing){
        var labels={present:"present(e)",retard:"en retard",absent:"absent(e)"};
        alert(linkedPlayer.prenom+" s'est déjà declare(e) "+(labels[existing.status]||existing.status)+" pour cet événement. Pas besoin de le refaire.");
        return;
      }
      proceed(linkedPlayer.prenom+" "+linkedPlayer.nom,linkedPlayer.id);
    });
  } else {
    var nom=await askPrompt("Prénom du joueur absent", {confirmText:"Suivant"});
    if(!nom)return;
    proceed(nom,null);
  }
}

function getLastMatchesForTeam(team){
  if(!team)return[];
  var events=getEvents();
  var todayStr=new Date().toISOString().slice(0,10);
  var matched=events.filter(function(e){
    if(e.type!=="match"||!e.score||!e.equipe)return false;
    var eq=e.equipe.toUpperCase();
    return (eq.indexOf(team.name.toUpperCase())>=0)&&e.date<=todayStr;
  });
  matched.sort(function(a,b){return b.date>a.date?1:-1;});
  return matched.slice(0,5);
}
function getNextEventForTeam(team){
  if(!team)return null;
  var events=getEvents();
  var todayStr=new Date().toISOString().slice(0,10);
  var matched=events.filter(function(e){
    if(!e.equipe||e.cancelled)return false;
    var eq=e.equipe.toUpperCase();
    return eq.indexOf(team.name.toUpperCase())>=0;
  }).filter(function(e){return e.date>=todayStr;});
  matched.sort(function(a,b){return a.date>b.date?1:-1;});
  return matched[0]||null;
}

function getTeamPresenceStats(team){
  if(!team)return{total:0,present:0,pct:0};
  var events=getEvents().filter(function(e){
    if(!e.presences||!Object.keys(e.presences).length||!e.equipe)return false;
    return e.equipe.toUpperCase().indexOf(team.name.toUpperCase())>=0;
  });
  var total=0,present=0;
  events.forEach(function(e){
    Object.keys(e.presences).forEach(function(k){total++;if(e.presences[k]==="present")present++;});
  });
  return{total:total,present:present,pct:total?Math.round(present/total*100):0};
}

// ── PARENT EQUIPE TAB ─────────────────────────────────────────────
function buildParentEquipe(){
  var activeId=getActiveTeamId();
  var teams=getTeams();
  var team=teams.find(function(t){return t.id===activeId;});
  if(!team){document.getElementById("parent-eq-name").textContent="Aucune équipe";return;}
  var logoEl=document.getElementById("parent-eq-logo");
  var homeLogo=document.getElementById("home-logo");
  if(logoEl&&homeLogo&&homeLogo.innerHTML){logoEl.innerHTML=homeLogo.innerHTML.replace(/width="140"/,'width="80"').replace(/height="175"/,'height="100"');}
  document.getElementById("parent-eq-name").textContent=team.name;
  document.getElementById("parent-eq-cat").textContent="Basket-ball · "+team.cat;
  var players=(team.members&&team.members.length)?getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;}):getPlayers().filter(function(p){return p.cat===team.cat;});
  var el=document.getElementById("parent-eq-members");
  if(!players.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun membre pour le moment</div></div>';return;}
  el.innerHTML="";
  var CATS_ORD=["U7","U9","U11","U13","U15","U17","Senior"];
  var teamCatIdx=CATS_ORD.indexOf(team.cat);
  var posteEligible=teamCatIdx>=CATS_ORD.indexOf("U15");
  players.forEach(function(p){
    var initials=(p.prenom||"?")[0].toUpperCase()+(p.nom||"?")[0].toUpperCase();
    var div=document.createElement("div");
    div.className="player-card";
    var posteTxt=p.poste&&p.poste!=="---"?p.poste:"Joueur";
    var metaTxt=posteEligible?"Voir la fiche":"";
    var maillotBadge=p.maillot?('<span style="font-size:11px;font-weight:800;color:var(--dkg);background:rgba(212,175,55,.12);padding:2px 8px;border-radius:10px;margin-left:6px">#'+p.maillot+'</span>'):"";
    div.innerHTML='<div class="player-avatar" style="background:var(--dkg)">'+initials+'</div><div class="player-info"><div class="player-name">'+p.prenom+" "+p.nom+maillotBadge+'</div><div class="player-meta">'+metaTxt+'</div></div>';
    if(posteEligible){
      div.style.cursor="pointer";
      div.onclick=function(){alert(p.prenom+" "+p.nom+"\nPoste : "+posteTxt+(p.maillot?"\nMaillot : #"+p.maillot:"")+"\nCategorie : "+team.cat);};
    }
    el.appendChild(div);
  });
}

// ── COACH EQUIPE TAB (restreinte a sa seule équipe) ────────────────
function buildCoachEquipe(){
  var myTeamIds=getCoachTeams();
  var teamId=getCoachTeam();
  var teams=getTeams();
  var team=teams.find(function(t){return t.id===teamId;});
  var chipsEl=document.getElementById("coach-team-chips");
  if(chipsEl){
    chipsEl.innerHTML="";
    if(myTeamIds.length>1){
      teams.filter(function(t){return myTeamIds.indexOf(t.id)>=0;}).forEach(function(t){
        var b=document.createElement("button");
        b.className="cat-filter"+(t.id===teamId?" on":"");
        b.textContent=t.name;
        b.addEventListener("click",function(){setCoachTeam(t.id);buildCoachEquipe();});
        chipsEl.appendChild(b);
      });
    }
  }
  if(!team){document.getElementById("coach-eq-name").textContent="Aucune équipe";return;}
  var logoEl=document.getElementById("coach-eq-logo");
  var homeLogo=document.getElementById("home-logo");
  if(logoEl&&homeLogo&&homeLogo.innerHTML){logoEl.innerHTML=homeLogo.innerHTML.replace(/width="140"/,'width="80"').replace(/height="175"/,'height="100"');}
  document.getElementById("coach-eq-cat").textContent="ASMB · "+team.cat;
  fillTodayHero("coach-next-event","coach-eq-name",team);
  var coachTeamNames=getTeams().filter(function(t){return getCoachTeams().indexOf(t.id)>=0;}).map(function(t){return t.name;});
  renderMatchdayBanner("coach-matchday-banner",coachTeamNames.length?coachTeamNames:[team.name]);
  buildCoachDashboard(document.getElementById("coach-presence-summary"));

  var players=(team.members&&team.members.length)?getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;}):getPlayers().filter(function(p){return p.cat===team.cat;});
  var el=document.getElementById("coach-eq-members");
  if(!players.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun membre pour le moment</div></div>';return;}
  var CATS_ORD_COACH=["U7","U9","U11","U13","U15","U17","Senior"];
  var teamCatIdxCoach=CATS_ORD_COACH.indexOf(team.cat);
  var posteEligibleCoach=teamCatIdxCoach>=CATS_ORD_COACH.indexOf("U15");
  el.innerHTML="";
  players.forEach(function(p){
    var initials=(p.prenom||"?")[0].toUpperCase()+(p.nom||"?")[0].toUpperCase();
    var div=document.createElement("div");
    div.className="player-card";
    var posteTxt=p.poste&&p.poste!=="---"?p.poste:"Poste non défini";
    var metaTxt=posteEligibleCoach?posteTxt:"";
    var maillotBadge=p.maillot?('<span style="font-size:11px;font-weight:800;color:var(--dkg);background:rgba(212,175,55,.12);padding:2px 8px;border-radius:10px;margin-left:6px">#'+p.maillot+'</span>'):"";
    var maillotBtn='<button onclick="editPlayerMaillot(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:10px;font-weight:600;border:none;cursor:pointer">Maillot</button>';
    var licenceBtn='<button onclick="editPlayerLicence(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:10px;font-weight:600;border:none;cursor:pointer;margin-top:4px">Licence</button>';
    var historyBtn='<button onclick="openPlayerHistory(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(27,92,40,.08);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer;margin-top:4px">Historique</button>';
    div.innerHTML='<div class="player-avatar" style="background:var(--dkg)">'+initials+'</div><div class="player-info"><div class="player-name">'+p.prenom+" "+p.nom+maillotBadge+'</div><div class="player-meta">'+metaTxt+'</div></div><div style="display:flex;flex-direction:column;gap:4px">'+maillotBtn+licenceBtn+historyBtn+'</div>';
    el.appendChild(div);
  });
}

async function editPlayerMaillot(playerId){
  var players=getPlayers();
  var p=players.find(function(x){return x.id===playerId;});
  if(!p)return;
  var num=await askPrompt("Numéro de maillot", {defaultValue:p.maillot||"", placeholder:p.prenom+" "+p.nom, confirmText:"Enregistrer"});
  if(num===null)return;
  p.maillot=num.trim();
  savePlayers(players);
  buildCoachEquipe();
}

async function editPlayerLicence(playerId){
  var players=getPlayers();
  var p=players.find(function(x){return x.id===playerId;});
  if(!p)return;
  var num=await askPrompt("Numéro de licence", {defaultValue:p.numLicence||"0C", placeholder:p.prenom+" "+p.nom, confirmText:"Suivant"});
  if(num===null)return;
  var type=await askPrompt("Type de licence", {defaultValue:p.typeLicence||"competition", placeholder:"compétition / loisir", confirmText:"Enregistrer"});
  if(type===null)return;
  p.numLicence=num.trim();
  p.typeLicence=(type.trim().toLowerCase().indexOf("loisir")>=0)?"loisir":"competition";
  savePlayers(players);
  buildCoachEquipe();
  alert("Licence mise a jour.");
}

// ── HISTORIQUE JOUEUR (coach) : assiduite + evaluations mensuelles + stages ──
var currentHistoryPlayerId=null;
var MONTH_NAMES_FR=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

function getMonthlyEvaluations(){try{return JSON.parse(localStorage.getItem("asmb_monthly_evaluations")||"{}");}catch(e){return {};}}
function saveMonthlyEvaluations(obj){localStorage.setItem("asmb_monthly_evaluations",JSON.stringify(obj));}

function openPlayerHistory(playerId){
  currentHistoryPlayerId=playerId;
  stack.push("player-history");showScr("player-history");
  buildPlayerHistoryScreen();
}

function buildPlayerHistoryScreen(){
  var p=getPlayers().find(function(x){return x.id===currentHistoryPlayerId;});
  if(!p)return;
  var initials=(p.prenom||"?").charAt(0).toUpperCase()+(p.nom||"?").charAt(0).toUpperCase();
  document.getElementById("ph2-avatar").textContent=initials;
  document.getElementById("ph2-name").textContent=p.prenom+" "+p.nom;
  document.getElementById("ph2-sub").textContent=(p.cat||"")+(p.maillot?" · #"+p.maillot:"");

  // Bloc 1 : assiduite (resume + lien vers le detail existant)
  var events=getEvents().filter(function(e){return e.presences&&e.presences[p.id];});
  var total=events.length;
  var present=events.filter(function(e){return e.presences[p.id]==="present";}).length;
  var pct=total?Math.round(present/total*100):0;
  var attEl=document.getElementById("ph2-attendance");
  attEl.innerHTML='<div style="display:flex;gap:8px;margin-bottom:'+(total?"10px":"0")+'">'+
    '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;background:rgba(212,175,55,.12)"><div style="font-size:18px;font-weight:900;color:#D4AF37">'+pct+'%</div><div style="font-size:9px;font-weight:600;color:#D4AF37;text-transform:uppercase">Présence</div></div>'+
    '<div style="flex:1;text-align:center;border-radius:var(--rs);padding:8px 4px;background:rgba(0,0,0,.05)"><div style="font-size:18px;font-weight:900;color:var(--txt)">'+total+'</div><div style="font-size:9px;font-weight:600;color:var(--mut);text-transform:uppercase">Séances</div></div>'+
    '</div>'+
    (total?'<div style="text-align:center"><span onclick="showPresenceHistory(\''+p.id+'\')" style="font-size:11px;color:var(--dkg);font-weight:700;cursor:pointer">Voir le détail complet →</span></div>':'<div style="font-size:12px;color:var(--mut)">Aucune donnée pour le moment</div>');

  // Bloc 2 : evaluations mensuelles
  var criteria=getEvalCriteria();
  var monthlyAll=getMonthlyEvaluations()[p.id]||{};
  var monthKeys=Object.keys(monthlyAll).sort(function(a,b){return a<b?1:-1;});
  var monthlyEl=document.getElementById("ph2-monthly");
  if(!monthKeys.length){
    monthlyEl.innerHTML='<div style="font-size:12px;color:var(--mut)">Aucune évaluation mensuelle pour le moment</div>';
  } else {
    monthlyEl.innerHTML="";
    monthKeys.forEach(function(mk,idx){
      var scores=monthlyAll[mk]||{};
      var prevScores=monthKeys[idx+1]?(monthlyAll[monthKeys[idx+1]]||{}):null;
      var total=criteria.reduce(function(s,c){return s+(scores[c]||0);},0);
      var parts=mk.split("-");
      var label=MONTH_NAMES_FR[parseInt(parts[1],10)-1]+" "+parts[0];
      monthlyEl.appendChild(buildEvalAccordionRow(label,null,total,criteria.length*5,criteria,scores,prevScores));
    });
  }

  // Bloc 3 : evaluations stages/camps
  var allEvals=getAllEvaluations();
  var eventEntries=[];
  Object.keys(allEvals).forEach(function(eventId){
    if(allEvals[eventId][p.id]){
      var ev=getEvents().find(function(e){return e.id===eventId;});
      if(ev)eventEntries.push({event:ev,scores:allEvals[eventId][p.id]});
    }
  });
  eventEntries.sort(function(a,b){return a.event.date<b.event.date?1:-1;});
  var eventsEl=document.getElementById("ph2-events");
  if(!eventEntries.length){
    eventsEl.innerHTML='<div style="font-size:12px;color:var(--mut)">Aucune évaluation de stage/camp pour le moment</div>';
  } else {
    eventsEl.innerHTML="";
    eventEntries.forEach(function(entry,idx){
      var total=criteria.reduce(function(s,c){return s+(entry.scores[c]||0);},0);
      var prevScores=eventEntries[idx+1]?eventEntries[idx+1].scores:null;
      var sub=entry.event.date+(entry.event.dateFin&&entry.event.dateFin!==entry.event.date?(" → "+entry.event.dateFin):"");
      eventsEl.appendChild(buildEvalAccordionRow(entry.event.titre,sub,total,criteria.length*5,criteria,entry.scores,prevScores));
    });
  }
}

function buildEvalAccordionRow(title,subLabel,total,maxTotal,criteria,scores,prevScores){
  var wrap=document.createElement("div");
  wrap.style.cssText="border-bottom:1px solid var(--bdr)";
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;justify-content:space-between;align-items:center;padding:10px 0;cursor:pointer";
  hdr.innerHTML='<span style="font-size:12.5px;font-weight:800;color:var(--txt)">'+title+'</span>'+
    '<div style="display:flex;align-items:center;gap:8px"><span style="font-size:12px;font-weight:800;color:#D4AF37">'+total.toFixed(1)+' / '+maxTotal+'</span><span class="ph2-arrow" style="font-size:11px;color:var(--mut);transition:transform .18s">▾</span></div>';
  var detail=document.createElement("div");
  detail.style.cssText="display:none;padding:0 0 10px";
  var detailHtml=subLabel?('<div style="font-size:10.5px;color:var(--mut);margin-bottom:6px">'+subLabel+'</div>'):"";
  criteria.forEach(function(c){
    var val=scores[c]||0;
    var full=Math.floor(val),half=(val-full)===0.5;
    var starsStr="★".repeat(full)+(half?"½":"");
    var trendHtml="";
    if(prevScores){
      var prevVal=prevScores[c]||0;
      var diff=val-prevVal;
      if(diff>0)trendHtml='<span style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px;background:rgba(212,175,55,.15);color:#D4AF37">▲ +'+diff.toFixed(1)+'</span>';
      else if(diff<0)trendHtml='<span style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px;background:rgba(192,57,43,.12);color:#C0392B">▼ '+diff.toFixed(1)+'</span>';
      else trendHtml='<span style="font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:8px;margin-left:4px;background:rgba(0,0,0,.06);color:var(--mut)">＝</span>';
    }
    detailHtml+='<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--mut);margin-bottom:3px"><b style="color:var(--txt);width:82px;flex-shrink:0;font-weight:700">'+c+'</b><span style="color:#F5A623;letter-spacing:1px">'+(starsStr||"—")+'</span>'+trendHtml+'</div>';
  });
  detail.innerHTML=detailHtml;
  hdr.onclick=function(){
    var open=detail.style.display==="block";
    detail.style.display=open?"none":"block";
    hdr.querySelector(".ph2-arrow").style.transform=open?"":"rotate(180deg)";
  };
  wrap.appendChild(hdr);wrap.appendChild(detail);
  return wrap;
}

function showMonthlyEvalForm(){
  var p=getPlayers().find(function(x){return x.id===currentHistoryPlayerId;});
  if(!p)return;
  var now=new Date();
  var monthKey=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  document.getElementById("monthly-eval-title").textContent="Évaluation · "+MONTH_NAMES_FR[now.getMonth()]+" "+now.getFullYear();
  var criteria=getEvalCriteria();
  var existing=(getMonthlyEvaluations()[p.id]||{})[monthKey]||{};
  var fieldsEl=document.getElementById("monthly-eval-fields");
  fieldsEl.innerHTML="";
  criteria.forEach(function(c){
    var row=document.createElement("div");
    row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:10px";
    var lbl=document.createElement("div");
    lbl.style.cssText="width:90px;font-size:12.5px;font-weight:700;color:var(--txt);flex-shrink:0";
    lbl.textContent=c;
    row.appendChild(lbl);
    row.appendChild(monthlyEvalStarsWrap(c,existing[c]));
    fieldsEl.appendChild(row);
  });
  document.getElementById("modal-monthly-eval").style.display="flex";
}

var monthlyEvalDraft={};
function monthlyEvalStarsWrap(critName,val){
  val=val||0;
  monthlyEvalDraft[critName]=val;
  var wrap=document.createElement("div");
  wrap.style.cssText="display:flex;gap:2px";
  wrap.setAttribute("data-crit",critName);
  for(var i=1;i<=5;i++){
    var frac=Math.max(0,Math.min(1,val-(i-1)));
    var box=document.createElement("span");
    box.style.cssText="position:relative;display:inline-block;width:22px;height:22px;font-size:20px;line-height:1;cursor:pointer";
    var bg=document.createElement("span");bg.textContent="★";bg.style.cssText="position:absolute;top:0;left:0;color:var(--bdr)";
    var fg=document.createElement("span");fg.textContent="★";fg.style.cssText="position:absolute;top:0;left:0;color:#F5A623;overflow:hidden;width:"+(frac*100)+"%;white-space:nowrap";
    box.appendChild(bg);box.appendChild(fg);
    box.addEventListener("click",(function(starIdx){
      return function(ev){
        var rect=ev.currentTarget.getBoundingClientRect();
        var half=(ev.clientX-rect.left)<rect.width/2;
        var newVal=half?starIdx-0.5:starIdx;
        if(monthlyEvalDraft[critName]===newVal)newVal=0;
        monthlyEvalDraft[critName]=newVal;
        var newWrap=monthlyEvalStarsWrap(critName,newVal);
        wrap.replaceWith(newWrap);
      };
    })(i));
    wrap.appendChild(box);
  }
  return wrap;
}

function saveMonthlyEval(){
  var p=getPlayers().find(function(x){return x.id===currentHistoryPlayerId;});
  if(!p)return;
  var now=new Date();
  var monthKey=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0");
  var all=getMonthlyEvaluations();
  if(!all[p.id])all[p.id]={};
  all[p.id][monthKey]=Object.assign({},monthlyEvalDraft);
  saveMonthlyEvaluations(all);
  monthlyEvalDraft={};
  closeModal("modal-monthly-eval");
  buildPlayerHistoryScreen();
}

