/* ===== 13-firestore-sync.js — Synchronisation temps reel et migration Firestore ===== */
// ═══ STEP 3 : SYNC LIVE FIRESTORE (lecture onSnapshot + écriture par doc) ═══
var FS_PREV = {};      // dernier état connu par collection (baseline pour diff écriture)
var FS_UNSUB = {};     // désabonnements onSnapshot
var FS_SYNC_STARTED = false;

function fsArrFromSnap(snap){ var a=[]; snap.forEach(function(d){ a.push(d.data()); }); return a; }

function fsStartSync(coll, lsKey){
  if(FS_UNSUB[coll] || !window.fbDb || !window.fbOnSnapshot) return;
  FS_UNSUB[coll]=window.fbOnSnapshot(
    window.fbCollection(window.fbDb, coll),
    function(snap){
      var arr=fsArrFromSnap(snap);
      FS_PREV[coll]=arr.slice();
      localStorage.setItem(lsKey, JSON.stringify(arr));
      refreshCurrentScreen();
    },
    function(err){ console.log("sync "+coll+":", (err&&err.code)||err); }
  );
}

// Écrit un tableau d'entités : seuls les docs nouveaux/modifiés sont poussés, les retirés sont supprimés
function fsWriteCollection(coll, arr){
  if(!window.fbDb || !window.fbSetDoc) return;
  if(window.SUPPORT_MODE) return; // mode support : lecture seule (aussi imposé par les règles serveur)
  var prev=FS_PREV[coll]||[];
  var prevMap={};
  prev.forEach(function(x){ if(x&&x.id!=null) prevMap[String(x.id)]=JSON.stringify(x); });
  var curIds={};
  (arr||[]).forEach(function(x){
    if(!x||x.id==null) return;
    var k=String(x.id); curIds[k]=1;
    var s=JSON.stringify(x);
    if(prevMap[k]!==s){
      window.fbSetDoc(window.fbDoc(window.fbDb,coll,k), x).catch(function(e){ console.log("write "+coll+"/"+k, (e&&e.code)||e); });
    }
  });
  prev.forEach(function(x){
    if(x&&x.id!=null && !curIds[String(x.id)]){
      window.fbDeleteDoc(window.fbDoc(window.fbDb,coll,String(x.id))).catch(function(){});
    }
  });
  FS_PREV[coll]=(arr||[]).slice();
}

// Évaluations : stockées en map {eventId:{playerId:{critère:score}}} → 1 doc par eventId
var FS_PREV_EVAL={};
function fsStartSyncEvaluations(){
  if(FS_UNSUB["evaluations"] || !window.fbDb || !window.fbOnSnapshot) return;
  FS_UNSUB["evaluations"]=window.fbOnSnapshot(
    window.fbCollection(window.fbDb,"evaluations"),
    function(snap){
      var map={};
      snap.forEach(function(d){ var v=d.data(); map[d.id]=(v&&v.scores)?v.scores:{}; });
      FS_PREV_EVAL=JSON.parse(JSON.stringify(map));
      localStorage.setItem("asmb_evaluations", JSON.stringify(map));
      refreshCurrentScreen();
    },
    function(err){ console.log("sync evaluations:", (err&&err.code)||err); }
  );
}
function fsWriteEvaluations(obj){
  if(!window.fbDb || !window.fbSetDoc) return;
  obj=obj||{};
  Object.keys(obj).forEach(function(evId){
    var s=JSON.stringify(obj[evId]);
    if(JSON.stringify(FS_PREV_EVAL[evId])!==s){
      window.fbSetDoc(window.fbDoc(window.fbDb,"evaluations",String(evId)), {scores:obj[evId]}).catch(function(e){ console.log("write eval/"+evId, (e&&e.code)||e); });
    }
  });
  Object.keys(FS_PREV_EVAL).forEach(function(evId){
    if(!(evId in obj)){ window.fbDeleteDoc(window.fbDoc(window.fbDb,"evaluations",String(evId))).catch(function(){}); }
  });
  FS_PREV_EVAL=JSON.parse(JSON.stringify(obj));
}

// Re-rendu best-effort de l'écran courant (no-op si non couvert)
function refreshCurrentScreen(){
  try{
    var id=(typeof stack!=="undefined"&&stack.length)?stack[stack.length-1]:null;
    if(!id) return;
    var map={
      portal:window.buildPortal, "parent-home":window.buildParentHome, admin:window.buildAdminHome,
      equipes:window.buildTeams, planning:window.buildPlanning, licences:window.buildLicences,
      parametres:window.buildParametres, "live-eval":window.buildLiveEval, inscriptions:window.buildPlayers
    };
    var f=map[id];
    if(typeof f==="function") f();
  }catch(e){ console.log("refresh:", e); }
}

function initFirestoreSync(){
  if(FS_SYNC_STARTED || !window.fbDb) return;
  FS_SYNC_STARTED=true;
  fsStartSync("players","asmb_players");
  fsStartSync("teams","asmb_teams");
  fsStartSync("licences","asmb_licences");
  fsStartSync("events","asmb_events");
  fsStartSync("annuaire","asmb_annuaire");
  fsStartSync("notes_frais","asmb_notes_frais");
  fsStartSyncEvaluations();
  if((window.ASMB_USER&&window.ASMB_USER.roles||[]).indexOf("dirigeant")>=0){
    fsStartSync("comptabilite","asmb_comptabilite");
    fsStartSync("inventaire","asmb_inventaire");
  }
  fetchCycleOverridesFromCloud();
  if(window.fbGetDoc){
    window.fbGetDoc(window.fbDoc(window.fbDb,"app_data","season")).then(function(snap){
      if(snap && snap.exists() && snap.data().value){
        localStorage.setItem("asmb_current_season", snap.data().value);
        applySeasonLabels();
      }
    }).catch(function(){});
  }
}

// ═══ STEP 2 : MIGRATION localStorage → Firestore (collections) ═══════
function migrateToFirestore(){
  if(!window.ASMB_USER || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){ alert("Réservé au dirigeant."); return; }
  if(!window.fbDb || !window.fbSetDoc){ alert("Firestore non disponible."); return; }
  askConfirm("Sans risque : écrase les documents existants, peut être relancé.", {title:"Copier les données vers Firestore ?", confirmText:"Lancer"}).then(function(ok){
    if(!ok)return;
    migrateToFirestoreConfirmed();
  });
}
function migrateToFirestoreConfirmed(){
  var statusEl=document.getElementById("migration-status");
  function log(msg){ if(statusEl){ statusEl.innerHTML=msg; } }
  log("Migration en cours...");
  var tasks=[], counts={players:0,teams:0,events:0,licences:0,evaluations:0}, errors=[];
  function push(coll,id,data,key){
    if(id==null||id==="") return;
    tasks.push(
      window.fbSetDoc(window.fbDoc(window.fbDb,coll,String(id)),data)
        .then(function(){ counts[key]++; })
        .catch(function(e){ errors.push(coll+"/"+id+" ("+((e&&e.code)||(e&&e.message)||"err")+")"); })
    );
  }
  try{
    getPlayers().forEach(function(p){ if(p) push("players",p.id,p,"players"); });
    getTeams().forEach(function(t){ if(t) push("teams",t.id,t,"teams"); });
    getEvents().forEach(function(e){ if(e) push("events",e.id,e,"events"); });
    getLicences().forEach(function(l){ if(l) push("licences",l.id,l,"licences"); });
    var evals=getAllEvaluations();
    Object.keys(evals).forEach(function(evId){ push("evaluations",evId,{scores:evals[evId]},"evaluations"); });
  }catch(err){ log("Erreur préparation : "+err.message); return; }
  if(!tasks.length){ log("Aucune donnée locale à migrer."); return; }
  Promise.all(tasks).then(function(){
    var msg="✔ Terminé : "+counts.players+" joueurs · "+counts.teams+" équipes · "+counts.events+" événements · "+counts.licences+" licences · "+counts.evaluations+" évals.";
    if(errors.length){ msg+="<br><span style=\"color:#C0392B\">"+errors.length+" échec(s) : "+errors.slice(0,4).join(" | ")+(errors.length>4?"…":"")+"</span>"; }
    log(msg);
    syncPhoneIndexFromLicences(getLicences());
    syncInscriptionCodes(getLicences());
  });
}

function openLiveEval(eventId){
  currentEvalEventId=eventId;
  stack.push("live-eval");showScr("live-eval");
  buildLiveEval();
}

function buildLiveEval(){
  var ev=getEvents().find(function(e){return e.id===currentEvalEventId;});
  if(!ev)return;
  document.getElementById("live-eval-title").textContent=ev.titre;
  document.getElementById("live-eval-sub").textContent=ev.date+(ev.heure?" · "+ev.heure:"");

  var players=getPlayers().filter(function(p){return (ev.participantsClub||[]).indexOf(p.id)>=0;});
  var allEvals=getAllEvaluations();
  var evalForEvent=allEvals[currentEvalEventId]||{};
  var criteria=getEvalCriteria();

  function totalFor(playerId){
    var scores=evalForEvent[playerId]||{};
    return criteria.reduce(function(sum,c){return sum+(scores[c]||0);},0);
  }

  // Leaderboard
  var sorted=players.slice().sort(function(a,b){return totalFor(b.id)-totalFor(a.id);});
  var lb=document.getElementById("live-eval-leaderboard");
  lb.innerHTML="";
  if(!players.length){
    lb.innerHTML='<div style="font-size:12px;color:var(--mut)">Aucun participant enregistré pour cet événement</div>';
  }
  sorted.forEach(function(p,i){
    var row=document.createElement("div");
    row.style.cssText="display:flex;align-items:center;gap:10px;padding:7px 0";
    var initials=(p.prenom||"?").charAt(0).toUpperCase()+(p.nom||"?").charAt(0).toUpperCase();
    row.innerHTML='<div style="width:20px;font-size:13px;font-weight:900;color:'+(i===0?"#F5A623":"var(--mut)")+';text-align:center">'+(i+1)+'</div>'+
      '<div style="width:28px;height:28px;border-radius:50%;background:var(--dkg);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+initials+'</div>'+
      '<div style="flex:1;font-size:12.5px;font-weight:700;color:var(--txt)">'+p.prenom+' '+p.nom+'</div>'+
      '<div style="font-size:13px;font-weight:900;color:#D4AF37">'+totalFor(p.id).toFixed(1)+'</div>';
    lb.appendChild(row);
  });

  // Player cards
  var list=document.getElementById("live-eval-players");
  list.innerHTML="";
  players.forEach(function(p){
    var scores=evalForEvent[p.id]||{};
    var card=document.createElement("div");
    card.style.cssText="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:14px;box-shadow:0 2px 12px var(--shadow)";
    var hdr=document.createElement("div");
    hdr.style.cssText="display:flex;align-items:center;gap:10px;margin-bottom:10px";
    var initials=(p.prenom||"?").charAt(0).toUpperCase()+(p.nom||"?").charAt(0).toUpperCase();
    hdr.innerHTML='<div style="width:28px;height:28px;border-radius:50%;background:var(--dkg);color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+initials+'</div>'+
      '<div style="flex:1;font-size:13.5px;font-weight:800;color:var(--txt)">'+p.prenom+' '+p.nom+'</div>'+
      '<div style="font-size:13px;font-weight:900;color:#D4AF37;background:rgba(212,175,55,.12);padding:3px 10px;border-radius:12px">'+totalFor(p.id).toFixed(1)+' pts</div>';
    card.appendChild(hdr);
    criteria.forEach(function(c,ci){
      var row=document.createElement("div");
      row.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px";
      var lbl=document.createElement("div");
      lbl.style.cssText="width:82px;font-size:11.5px;font-weight:700;color:var(--txt);flex-shrink:0";
      lbl.textContent=c;
      row.appendChild(lbl);
      row.appendChild(evalStarsWrap(p.id,c,scores[c]));
      card.appendChild(row);
    });
    list.appendChild(card);
  });
}

function evalStarsWrap(playerId,critName,val){
  val=val||0;
  var wrap=document.createElement("div");
  wrap.style.cssText="display:flex;gap:2px";
  for(var i=1;i<=5;i++){
    var frac=Math.max(0,Math.min(1,val-(i-1)));
    var box=document.createElement("span");
    box.style.cssText="position:relative;display:inline-block;width:20px;height:20px;font-size:19px;line-height:1;cursor:pointer";
    var bg=document.createElement("span");
    bg.textContent="★";
    bg.style.cssText="position:absolute;top:0;left:0;color:var(--bdr)";
    var fg=document.createElement("span");
    fg.textContent="★";
    fg.style.cssText="position:absolute;top:0;left:0;color:#F5A623;overflow:hidden;width:"+(frac*100)+"%;white-space:nowrap";
    box.appendChild(bg);box.appendChild(fg);
    box.addEventListener("click",(function(starIdx){
      return function(ev){setEvalStar(ev,playerId,critName,starIdx);};
    })(i));
    wrap.appendChild(box);
  }
  return wrap;
}

function setEvalStar(ev,playerId,critName,fullVal){
  var rect=ev.currentTarget.getBoundingClientRect();
  var half=(ev.clientX-rect.left)<rect.width/2;
  var val=half?fullVal-0.5:fullVal;
  var allEvals=getAllEvaluations();
  if(!allEvals[currentEvalEventId])allEvals[currentEvalEventId]={};
  if(!allEvals[currentEvalEventId][playerId])allEvals[currentEvalEventId][playerId]={};
  var current=allEvals[currentEvalEventId][playerId][critName]||0;
  allEvals[currentEvalEventId][playerId][critName]=(current===val)?0:val;
  saveAllEvaluations(allEvals);
  buildLiveEval();
}

function showEvalCriteriaModal(){
  renderEvalCritList();
  document.getElementById("modal-eval-criteria").style.display="flex";
}
function renderEvalCritList(){
  var criteria=getEvalCriteria();
  var el=document.getElementById("eval-crit-list");
  el.innerHTML="";
  criteria.forEach(function(c,i){
    var row=document.createElement("div");
    row.style.cssText="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--bdr)";
    var input=document.createElement("input");
    input.value=c;input.setAttribute("data-i",i);
    input.style.cssText="flex:1;border:none;background:none;font-size:13px;font-weight:700;color:var(--txt);outline:none";
    var rm=document.createElement("button");
    rm.textContent="✕";
    rm.style.cssText="width:24px;height:24px;border-radius:50%;background:rgba(192,57,43,.1);color:var(--red);border:none;cursor:pointer;font-size:11px";
    rm.onclick=function(){row.remove();};
    row.appendChild(input);row.appendChild(rm);
    el.appendChild(row);
  });
}
function addEvalCriterion(){
  var el=document.getElementById("eval-crit-list");
  var row=document.createElement("div");
  row.style.cssText="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--bdr)";
  var input=document.createElement("input");
  input.value="Nouveau critère";
  input.style.cssText="flex:1;border:none;background:none;font-size:13px;font-weight:700;color:var(--txt);outline:none";
  var rm=document.createElement("button");
  rm.textContent="✕";
  rm.style.cssText="width:24px;height:24px;border-radius:50%;background:rgba(192,57,43,.1);color:var(--red);border:none;cursor:pointer;font-size:11px";
  rm.onclick=function(){row.remove();};
  row.appendChild(input);row.appendChild(rm);
  el.appendChild(row);
}
function saveEvalCriteriaFromModal(){
  var inputs=document.querySelectorAll("#eval-crit-list input");
  var criteria=Array.from(inputs).map(function(inp){return inp.value.trim();}).filter(Boolean);
  if(!criteria.length){alert("Au moins un critère est requis");return;}
  saveEvalCriteria(criteria);
  closeModal("modal-eval-criteria");
  buildLiveEval();
}

