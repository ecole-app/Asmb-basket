/* ===== 20-parent-tabs.js — Onglets evenements et statistiques cote parent ===== */
// ── PARENT EVENEMENTS TAB ─────────────────────────────────────────
function buildParentEvents(){
  var activeId=getActiveTeamId();
  var teams=getTeams();
  var team=teams.find(function(t){return t.id===activeId;});
  document.getElementById("parent-events-sub").textContent=team?team.name:"";
  var el=document.getElementById("parent-events-list");
  if(!team){el.innerHTML="";return;}
  var events=getVisibleEvents().filter(function(e){
    if(!e.equipe)return false;
    return e.equipe.toUpperCase().indexOf(team.name.toUpperCase())>=0;
  });
  events.sort(function(a,b){return a.date>b.date?1:-1;});
  if(!events.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun événement</div></div>';return;}
  el.innerHTML="";
  events.forEach(function(e){
    var col=eventTypeColor(e.type);
    var div=document.createElement("div");
    div.className="event-card";
    var presInfo="";
    if(e.presences&&Object.keys(e.presences).length){
      var pres=Object.values(e.presences).filter(function(v){return v==="present";}).length;
      var tot=Object.keys(e.presences).length;
      presInfo='<div style="font-size:11px;color:var(--ltg);margin-top:4px">✓ '+pres+"/"+tot+' présents</div>';
    }
    var convocInfo="";
    if(e.convocations&&e.convocations.length){
      var convPlayers=getPlayers();
      var noms=e.convocations.map(function(id){var p=convPlayers.find(function(x){return x.id===id;});return p?p.prenom:null;}).filter(Boolean);
      convocInfo='<div style="font-size:11px;color:#1A2E5A;margin-top:4px">Convoqués : '+authEsc(noms.join(", "))+'</div>';
    }
    var cancelledInfo=e.cancelled?'<div style="font-size:11px;font-weight:800;color:#C0392B;margin-top:4px">ANNULÉ</div>':"";
    div.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+col+'">'+eventTypeLabel(e.type)+'</span><span style="font-size:11px;color:var(--mut)">'+authEsc(e.date)+(e.heure?" · "+authEsc(e.heure):"")+'</span></div><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(e.titre)+'</div>'+(e.lieu?'<div style="font-size:11px;color:var(--mut);margin-top:2px">📍 '+authEsc(e.lieu)+'</div>':"")+cancelledInfo+convocInfo+presInfo;
    el.appendChild(div);
  });
}

// ── PARENT STATS TAB ──────────────────────────────────────────────
function buildParentStats(){
  var activeId=getActiveTeamId();
  var teams=getTeams();
  var team=teams.find(function(t){return t.id===activeId;});
  document.getElementById("parent-stats-sub").textContent=team?team.name:"";
  var el=document.getElementById("parent-stats-content");
  if(!team){el.innerHTML="";return;}

  var stats=getTeamPresenceStats(team);
  var html="";

  if(stats.total===0){
    html+='<div class="empty-state"><div style="font-size:13px;font-weight:600">Pas d\'historique de données</div><div style="font-size:11px;margin-top:4px">pour les critères sélectionnés</div></div>';
  } else {
    html+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:18px;box-shadow:0 2px 12px var(--shadow);margin-bottom:12px">';
    html+='<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:14px">Bilan des présences</div>';
    html+='<div style="display:flex;align-items:center;justify-content:space-around;text-align:center">';
    html+='<div><div style="font-size:24px;font-weight:900;color:var(--ltg)">'+stats.pct+'%</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Assiduité</div></div>';
    html+='<div style="width:1px;height:40px;background:var(--bdr)"></div>';
    html+='<div><div style="font-size:24px;font-weight:900;color:var(--txt)">'+stats.present+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Présences</div></div>';
    html+='<div style="width:1px;height:40px;background:var(--bdr)"></div>';
    html+='<div><div style="font-size:24px;font-weight:900;color:var(--txt)">'+(stats.total-stats.present)+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Absences</div></div>';
    html+='</div></div>';

    // Progress bar
    html+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:18px;box-shadow:0 2px 12px var(--shadow)">';
    html+='<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Taux d\'assiduité</div>';
    html+='<div class="prog-bar" style="height:10px"><div class="prog-fill" style="width:'+stats.pct+'%"></div></div>';
    html+='<div style="font-size:11px;color:var(--mut);margin-top:8px">'+stats.present+' présences sur '+stats.total+' séances enregistrées</div>';
    html+='</div>';
  }

  el.innerHTML=html;
}

// ── DYNAMIC BOTTOM NAV ────────────────────────────────────────────
var NAV_ICONS={
  home:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>',
  communaute:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
  inscription:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M9 13l2 2 4-4"/></svg>',
  admin:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  match:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18"/></svg>',
  equipe:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z"/></svg>',
  stats:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  events:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  formation:'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3L2 8l10 5 10-5-10-5z"/><path d="M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5"/></svg>'
};

function buildBottomNav(profile){
  var nav=document.getElementById("bnav-main");
  if(!nav)return;
  if(profile==="dirigeant"){
    nav.innerHTML=
      '<button class="bni on" id="bni-portal" onclick="navTo(\'portal\')"><span class="bni-ic">'+NAV_ICONS.home+'</span>Accueil</button>'+
      '<button class="bni" id="bni-communaute" onclick="navTo(\'communaute\')"><span class="bni-ic">'+NAV_ICONS.communaute+'</span>Communauté</button>'+
      '<button class="bni" id="bni-inscription" onclick="navTo(\'inscription\')"><span class="bni-ic">'+NAV_ICONS.inscription+'</span>Inscription</button>'+
      '<button class="bni" id="bni-admin" onclick="navTo(\'admin\')"><span class="bni-ic">'+NAV_ICONS.admin+'</span>Admin</button>';
  } else if(profile==="coach"){
    // "Admin" n'apparaît que si le dirigeant a coché au moins un accès bureau
    // pour ce compte (Accès coach) — l'accès sportif fixe du coach, lui, ne
    // bouge jamais, cases ou pas.
    var hasBureauAccess=typeof BUREAU_GRANTABLE!=="undefined" && typeof hasModulePermission==="function"
      && BUREAU_GRANTABLE.some(function(id){return hasModulePermission(id);});
    nav.innerHTML=
      '<button class="bni on" id="bni-c-equipe" onclick="navToCoach(\'equipe\')"><span class="bni-ic">'+NAV_ICONS.equipe+'</span>Équipe</button>'+
      '<button class="bni" id="bni-c-formation" onclick="navToCoach(\'formation\')"><span class="bni-ic">'+NAV_ICONS.formation+'</span>Formation</button>'+
      '<button class="bni" id="bni-c-competition" onclick="navToCoach(\'competition\')"><span class="bni-ic">'+NAV_ICONS.match+'</span>Compétition</button>'+
      '<button class="bni" id="bni-c-evenements" onclick="navToCoach(\'evenements\')"><span class="bni-ic">'+NAV_ICONS.events+'</span>Événements</button>'+
      '<button class="bni" id="bni-c-communaute" onclick="navToCoach(\'communaute\')"><span class="bni-ic">'+NAV_ICONS.communaute+'</span>Communauté</button>'+
      (hasBureauAccess?'<button class="bni" id="bni-c-admin" onclick="navToCoach(\'admin\')"><span class="bni-ic">'+NAV_ICONS.admin+'</span>Gestion</button>':'');
  } else if(profile==="bureau"){
    // Membre du bureau : pas d'équipe, pas d'accès sportif fixe — uniquement
    // Communauté (toujours là) et "Gestion" si au moins une case est cochée.
    var hasBureauAccess2=typeof BUREAU_GRANTABLE!=="undefined" && typeof hasModulePermission==="function"
      && BUREAU_GRANTABLE.some(function(id){return hasModulePermission(id);});
    nav.innerHTML=
      '<button class="bni on" id="bni-c-communaute" onclick="navToCoach(\'communaute\')"><span class="bni-ic">'+NAV_ICONS.communaute+'</span>Communauté</button>'+
      (hasBureauAccess2?'<button class="bni" id="bni-c-admin" onclick="navToCoach(\'admin\')"><span class="bni-ic">'+NAV_ICONS.admin+'</span>Gestion</button>':'');
  } else {
    nav.innerHTML=
      '<button class="bni on" id="bni-portal" onclick="navToParent(\'home\')"><span class="bni-ic">'+NAV_ICONS.match+'</span>Match</button>'+
      '<button class="bni" id="bni-eq" onclick="navToParent(\'equipe\')"><span class="bni-ic">'+NAV_ICONS.equipe+'</span>Équipe</button>'+
      '<button class="bni" id="bni-stats" onclick="navToParent(\'stats\')"><span class="bni-ic">'+NAV_ICONS.stats+'</span>Stats</button>'+
      '<button class="bni" id="bni-ev" onclick="navToParent(\'events\')"><span class="bni-ic">'+NAV_ICONS.events+'</span>Événement</button>'+
      '<button class="bni" id="bni-p-communaute" onclick="navToParent(\'communaute\')"><span class="bni-ic">'+NAV_ICONS.communaute+'</span>Communauté</button>';
  }
}

function navToParent(which){
  document.querySelectorAll("#bnav-main .bni").forEach(function(b){b.classList.remove("on");});
  if(which==="home"){document.getElementById("bni-portal").classList.add("on");stack=["parent-home"];showScr("parent-home");buildParentHome();}
  else if(which==="equipe"){document.getElementById("bni-eq").classList.add("on");stack=["parent-equipe"];showScr("parent-equipe");buildParentEquipe();}
  else if(which==="stats"){document.getElementById("bni-stats").classList.add("on");stack=["parent-stats"];showScr("parent-stats");buildParentStats();}
  else if(which==="events"){document.getElementById("bni-ev").classList.add("on");stack=["parent-events"];showScr("parent-events");buildParentEvents();}
  else if(which==="communaute"){
    var b=document.getElementById("bni-p-communaute");if(b)b.classList.add("on");
    var teams=getTeams();
    var activeId=getActiveTeamId();
    var activeTeam=teams.find(function(t){return t.id===activeId;})||teams[0];
    if(activeTeam&&window.fbReady){
      window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(snap){
        var chData=null;
        snap.forEach(function(d){if(d.id===activeTeam.id)chData={id:d.id,name:(d.data().name||activeTeam.name),desc:d.data().desc||"",members:d.data().members||[],icon:d.data().icon||""};});
        if(!chData)chData={id:activeTeam.id,name:activeTeam.name,desc:"Canal de l'équipe "+activeTeam.name,members:[],icon:""};
        openChannel(chData);
      });
    } else {
      stack=["communaute"];showScr("communaute");buildCommunaute();
    }
  }
}

// ═══ THEME ════════════════════════════════════════════════════════
function ppGet(k,def){var v=localStorage.getItem(k);return v===null?def:v;}
function savePP(k,checked){localStorage.setItem(k,checked?"on":"off");}
function savePPVal(k,v){localStorage.setItem(k,v);}

function openParentSettings(){
  stack.push("parent-params");
  showScr("parent-params");
  buildParentSettings();
}

// ═══ ACCES DE MON ENFANT ══════════════════════════════════════════
// Pour un mineur, c'est au titulaire de l'autorite parentale d'ouvrir l'acces.
// Le parent emet un code a usage unique ; l'enfant choisit un mot de passe et
// ne fournit aucune donnee de contact.
var CODES_ENFANTS={};

function mesEnfants(){
  var ids=[]; try{ ids=JSON.parse(localStorage.getItem("asmb_mes_joueurs")||"[]"); }catch(e){}
  var r=(typeof getRoster==="function")?getRoster():[];
  return r.filter(function(p){ return ids.indexOf(String(p.id))>=0; });
}

function buildAccesEnfants(){
  var box=document.getElementById("acces-enfants");
  if(!box) return;
  var enfants=mesEnfants();
  box.innerHTML="";
  if(!enfants.length){
    box.innerHTML='<div style="padding:14px;font-size:12px;color:var(--mut);line-height:1.45">Aucun enfant rattaché à ce compte. Le rattachement est fait par le club au moment de valider la licence.</div>';
    return;
  }
  enfants.forEach(function(p){
    var etat=CODES_ENFANTS[String(p.id)];
    var row=document.createElement("div");
    row.style.cssText="padding:14px;border-bottom:1px solid var(--bdr)";
    var nom=document.createElement("div");
    nom.style.cssText="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:8px";
    nom.textContent=((p.prenom||"")+" "+(p.nom||"")).trim();
    row.appendChild(nom);
    if(etat && etat.usedBy){
      var ok=document.createElement("div");
      ok.style.cssText="font-size:11.5px;color:var(--mut);line-height:1.45";
      ok.textContent="Accès créé. Pour le fermer, demandez au club.";
      row.appendChild(ok);
    } else if(etat && etat.code){
      var c=document.createElement("div");
      c.style.cssText="font-family:monospace;font-size:16px;font-weight:800;letter-spacing:2px;color:var(--dkg);background:var(--bg);border:1px dashed var(--bdr);border-radius:var(--rx);padding:12px;text-align:center;margin-bottom:8px";
      c.textContent=etat.code;
      var aide=document.createElement("div");
      aide.style.cssText="font-size:11px;color:var(--mut);line-height:1.45;margin-bottom:8px";
      aide.textContent="À donner à votre enfant. Utilisable une seule fois, valable 7 jours.";
      var ann=document.createElement("button");
      ann.textContent="Annuler ce code";
      ann.style.cssText="width:100%;padding:10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:12px;font-weight:700;border:none;cursor:pointer";
      ann.addEventListener("click",function(){ annulerAccesEnfant(p.id, etat.code); });
      row.appendChild(c);row.appendChild(aide);row.appendChild(ann);
    } else {
      var b=document.createElement("button");
      b.textContent="Créer l'accès de "+(p.prenom||"mon enfant");
      b.style.cssText="width:100%;padding:11px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer";
      b.addEventListener("click",function(){ creerAccesEnfant(p); });
      row.appendChild(b);
    }
    box.appendChild(row);
  });
}

// Codes deja emis par ce compte : la regle n'autorise la lecture que des siens.
function chargerCodesEnfants(){
  if(!window.fbDb||!window.fbGetDocs||!window.fbQuery||!window.fbWhere) return;
  if(!window.ASMB_USER||!window.ASMB_USER.uid) return;
  var q=window.fbQuery(window.fbCollection(window.fbDb,"club_invites"),
        window.fbWhere("createdBy","==",window.ASMB_USER.uid));
  window.fbGetDocs(q).then(function(snap){
    CODES_ENFANTS={};
    snap.forEach(function(d){
      var v=d.data();
      if(v.role!=="joueur"||!v.playerId) return;
      var exp=v.expiresAt&&v.expiresAt.toDate?v.expiresAt.toDate():null;
      if(!v.usedBy && exp && exp<new Date()) return; // perime : on repropose la creation
      CODES_ENFANTS[String(v.playerId)]={code:d.id,usedBy:v.usedBy||null};
    });
    buildAccesEnfants();
  }).catch(function(){});
}

function creerAccesEnfant(p){
  if(!window.fbSetDoc||!window.CURRENT_CLUB_ID){ askAlert("Connexion en cours, réessayez."); return; }
  var code=genSecureCode(3,4);
  window.fbSetDoc(window.fbDoc(window.fbDb,"club_invites",code),{
    clubId:window.CURRENT_CLUB_ID, clubName:(typeof clubLabel==="function"?clubLabel(""):""),
    role:"joueur", playerId:String(p.id), usedBy:null,
    createdBy:window.ASMB_USER.uid, createdAt:window.fbServerTimestamp(),
    expiresAt:new Date(Date.now()+7*86400000)
  }).then(function(){
    CODES_ENFANTS[String(p.id)]={code:code,usedBy:null};
    buildAccesEnfants();
  }).catch(function(e){
    askAlert("Impossible de créer l'accès : "+((e&&e.code)||e));
  });
}

function annulerAccesEnfant(playerId, code){
  askConfirm("Annuler ce code ? Il ne pourra plus servir.",{danger:true,confirmText:"Annuler le code"}).then(function(ok){
    if(!ok)return;
    window.fbDeleteDoc(window.fbDoc(window.fbDb,"club_invites",code)).then(function(){
      delete CODES_ENFANTS[String(playerId)];
      buildAccesEnfants();
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  });
}

function buildParentSettings(){
  buildAccesEnfants();
  chargerCodesEnfants();
  function setChk(id,key,def){var el=document.getElementById(id);if(el)el.checked=ppGet(key,def)==="on";}
  function setSel(id,key,def){var el=document.getElementById(id);if(el)el.value=ppGet(key,def);}
  setChk("pp-ics-alarm","asmb_ics_alarm","on");
  setSel("pp-ics-delay","asmb_ics_delay","120");
  setSel("pp-rdv-home","asmb_rdv_home","45");
  setSel("pp-rdv-away","asmb_rdv_away","60");
  setChk("pp-notif-match","asmb_pp_match","on");
  setChk("pp-notif-chat","asmb_pp_chat","on");
  var ph=document.getElementById("pp-phone");
  if(ph)ph.textContent=myPhone||"Non renseigné";
  var dk=document.getElementById("pp-dark");
  if(dk)dk.checked=document.documentElement.getAttribute("data-theme")==="dark";
  var vv=document.getElementById("pp-version");
  if(vv)vv.textContent=APP_VERSION;
  wireThemeAnimSettings("pp-");
  var fbBtn=document.getElementById("pp-feedback-send-btn");
  if(fbBtn && !fbBtn.dataset.wired){
    fbBtn.dataset.wired="1";
    fbBtn.addEventListener("click", function(){ sendFeedback("pp-"); });
  }
}

function toggleThemeFromParams(){toggleTheme();}

async function changeParentPhone(){
  var p=await askPrompt("Votre numéro de téléphone", {defaultValue:myPhone||"", confirmText:"Enregistrer"});
  if(p===null)return;
  p=p.trim().replace(/\s+/g,"");
  myPhone=p;
  localStorage.setItem("asmb_phone",p);
  var ph=document.getElementById("pp-phone");
  if(ph)ph.textContent=myPhone||"Non renseigné";
  if(p)autoLinkParentToChannel(p);
}

