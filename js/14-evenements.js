/* ===== 14-evenements.js — Evenements, creneaux, convocations, meteo du match ===== */
// ── CRENEAUX ─────────────────────────────────────────────────────
var creneauType="entrainement";
var creneauJour="Lundi";

// ── LISTE EVENEMENTS REELS DANS L'ONGLET "ÉVÉNEMENT" (coach + dirigeant) ──
function buildRealEventsList(){
  var el=document.getElementById("real-events-list");if(!el)return;
  var events=getVisibleEvents();
  var profile=localStorage.getItem("asmb_profile");
  if(profile==="coach"){
    var teamId=getCoachTeam();
    var team=getTeams().find(function(t){return t.id===teamId;});
    if(team){
      events=events.filter(function(e){return (e.equipe||"").toUpperCase().indexOf(team.name.toUpperCase())>=0;});
    }
  }
  if(!events.length){el.innerHTML='<div class="empty-state" style="padding:16px"><div style="font-size:12px;color:var(--mut)">Aucun événement</div></div>';return;}
  el.innerHTML="";
  events.sort(function(a,b){return a.date>b.date?1:-1;});
  events.forEach(function(e){
    var d=document.createElement("div");d.className="event-card";
    var evCol=eventTypeColor(e.type);
    var evDate=(e.dateFin&&e.dateFin!==e.date?(e.date+" → "+e.dateFin):e.date)+(e.heure?" · "+e.heure:"");
    var evLieu=e.lieu?"<div style=\"font-size:11px;color:var(--mut);margin-top:2px\">📍 "+e.lieu+"</div>":"";
    var evEquipe=e.equipe?"<div style=\"font-size:11px;color:var(--mut);margin-top:1px\">"+e.equipe+"</div>":"";
    var presenceCount=e.presences?Object.keys(e.presences).length:0;
    var presBtn=(e.type==="entrainement"||e.type==="match")?("<button onclick=\"openPresences('"+e.id+"')\" style=\"margin-top:8px;padding:6px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:#D4AF37;font-size:10px;font-weight:700;border:none;cursor:pointer\">✓ Gerer les présences"+(presenceCount?" ("+presenceCount+")":"")+"</button>"):"";
    var evalBtn=(e.type==="stage"&&e.evaluationEnabled)?("<button onclick=\"openLiveEval('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(27,92,40,.08);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer\">Évaluer</button>"):"";
    var editTimeBtn="<button onclick=\"editEventDateTime('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:10px;font-weight:700;border:none;cursor:pointer\"> Modifier</button>";
    var delBtn="<button onclick=\"deleteEvent('"+e.id+"')\" style=\"padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer;flex-shrink:0;margin-left:8px\">✕</button>";
    d.innerHTML="<div style=\"display:flex;align-items:flex-start;justify-content:space-between\"><div style=\"flex:1\"><div style=\"display:flex;align-items:center;gap:8px;margin-bottom:4px\"><span style=\"font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:"+evCol+"\">"+eventTypeLabel(e.type)+"</span><span style=\"font-size:11px;color:var(--mut)\">"+evDate+"</span></div><div style=\"font-size:13px;font-weight:700;color:var(--txt)\">"+e.titre+"</div>"+evLieu+evEquipe+presBtn+evalBtn+editTimeBtn+"</div>"+delBtn+"</div>";
    el.appendChild(d);
  });
}

function showAddCreneau(){
  creneauType="entrainement";
  creneauJour="Lundi";
  document.getElementById("modal-creneau").style.display="flex";
}

function selectCreneauType(type){
  creneauType=type;
  var btns=["entrainement","match"];
  btns.forEach(function(t){
    var b=document.getElementById("type-"+t);
    if(!b)return;
    var active=t===type;
    var colors={"entrainement":"var(--dkg)","match":"#C0392B"};
    b.style.background=active?colors[t]:"var(--bg)";
    b.style.color=active?"#fff":"var(--mut)";
    b.style.borderColor=active?colors[t]:"var(--bdr)";
  });
}

function selectJour(btn,jour){
  creneauJour=jour;
  document.querySelectorAll(".jour-btn").forEach(function(b){
    b.style.background="var(--bg)";b.style.color="var(--mut)";b.style.borderColor="var(--bdr)";
  });
  btn.style.background="var(--dkg)";btn.style.color="#fff";btn.style.borderColor="var(--dkg)";
}

function getNextDateForDayName(dayName){
  var days=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  var targetIdx=days.indexOf(dayName);
  if(targetIdx<0)return new Date().toISOString().slice(0,10);
  var d=new Date();
  var todayIdx=d.getDay();
  var diff=(targetIdx-todayIdx+7)%7;
  d.setDate(d.getDate()+diff);
  return d.toISOString().slice(0,10);
}

function saveCreneau(){
  var debut=(document.getElementById("cr-debut")||{}).value||"";
  var fin=(document.getElementById("cr-fin")||{}).value||"";
  var salle=(document.getElementById("cr-salle")||{}).value||"";
  var equipe=(document.getElementById("cr-equipe")||{}).value||"";
  var notes=(document.getElementById("cr-notes")||{}).value||"";
  var repeatVal=(document.getElementById("cr-repeat")||{}).value||"0";
  if(!debut||!fin){alert("Horaires obligatoires");return;}
  var events=getEvents();
  var firstDate=getNextDateForDayName(creneauJour);
  var occurrences;
  if(repeatVal==="season"){
    var endOfSeason=new Date(firstDate.getFullYear()+(firstDate.getMonth()<7?0:1),5,30);
    occurrences=Math.max(1,Math.ceil((endOfSeason-firstDate)/(7*24*60*60*1000))+1);
  } else {
    var repeatWeeks=parseInt(repeatVal||"0",10);
    occurrences=repeatWeeks>0?repeatWeeks:1;
  }
  for(var i=0;i<occurrences;i++){
    var d=new Date(firstDate);
    d.setDate(d.getDate()+i*7);
    events.push({
      id:Date.now().toString()+"-"+i,
      titre:(creneauType==="match"?"Match":"Entraînement")+(equipe?" · "+equipe:""),
      type:creneauType,
      date:d.toISOString().slice(0,10),
      heure:debut+" - "+fin,
      lieu:salle,equipe:equipe,notes:notes,
      recurrent:(repeatVal!=="0")
    });
  }
  saveEvents(events);
  closeModal("modal-creneau");
  buildPlanning();buildAdminHome();buildRealEventsList();
  if(occurrences>1)alert(occurrences+" créneaux crees (repetition hebdomadaire)");
}

var evExternes=[];
var evSelectedTeams=[];

function toggleEvEvalOption(){
  var type=document.getElementById("ev-type").value;
  var box=document.getElementById("ev-eval-option");
  if(box)box.style.display=(type==="stage")?"block":"none";
}

function showAddEvent(){
  evExternes=[];
  evSelectedTeams=[];
  if(localStorage.getItem("asmb_profile")==="coach"){
    var ct=getCoachTeam();
    if(ct)evSelectedTeams=[ct];
  }
  document.getElementById("ev-titre").value="";
  document.getElementById("ev-date").value="";
  document.getElementById("ev-date-fin").value="";
  document.getElementById("ev-heure").value="";
  document.getElementById("ev-lieu").value="";
  document.getElementById("ev-type").value="autre";
  document.getElementById("ev-canal").value="";
  document.getElementById("ev-eval-enabled").checked=false;
  toggleEvEvalOption();
  renderEvExternes();
  renderEvTeamChecks();
  renderEvPlayers();
  document.getElementById("modal-event-full").style.display="flex";
}

function renderEvTeamChecks(){
  var el=document.getElementById("ev-teams-checks");if(!el)return;
  var teams=getTeams();
  if(!teams.length){el.innerHTML='<div style="font-size:11px;color:var(--mut)">Aucune équipe creee - Admin > Équipes</div>';return;}
  el.innerHTML="";
  var noneBtn=document.createElement("button");
  noneBtn.type="button";
  noneBtn.textContent="Aucune équipe";
  var noneOn=evSelectedTeams.length===0;
  noneBtn.style.cssText="padding:6px 10px;border-radius:14px;font-size:11px;font-weight:600;border:1.5px solid "+(noneOn?"var(--mut)":"var(--bdr)")+";background:"+(noneOn?"var(--bdr)":"var(--card)")+";color:var(--mut);cursor:pointer;white-space:normal;max-width:100%;word-break:break-word;text-align:center;line-height:1.3";
  noneBtn.onclick=function(){evSelectedTeams=[];renderEvTeamChecks();renderEvPlayers();};
  el.appendChild(noneBtn);
  // Chips "Tout le club"
  var allOn=evSelectedTeams.indexOf("__all__")>=0;
  var allBtn=document.createElement("button");
  allBtn.type="button";
  allBtn.textContent="Tout le club";
  allBtn.style.cssText="padding:6px 10px;border-radius:14px;font-size:11px;font-weight:600;border:1.5px solid "+(allOn?"var(--dkg)":"var(--bdr)")+";background:"+(allOn?"var(--dkg)":"var(--card)")+";color:"+(allOn?"#fff":"var(--mut)")+";cursor:pointer;white-space:normal;max-width:100%;word-break:break-word;text-align:center;line-height:1.3";
  allBtn.onclick=function(){
    if(evSelectedTeams.indexOf("__all__")>=0){evSelectedTeams=[];}
    else{evSelectedTeams=["__all__"];}
    renderEvTeamChecks();renderEvPlayers();
  };
  el.appendChild(allBtn);
  teams.forEach(function(t){
    var on=evSelectedTeams.indexOf(t.id)>=0;
    var btn=document.createElement("button");
    btn.type="button";
    btn.textContent=t.name;
    btn.style.cssText="padding:6px 10px;border-radius:14px;font-size:11px;font-weight:600;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--mut)")+";cursor:pointer;white-space:normal;max-width:100%;word-break:break-word;text-align:center;line-height:1.3";
    btn.onclick=function(){toggleEvTeam(t.id);};
    el.appendChild(btn);
  });
}

function toggleEvTeam(teamId){
  var idx=evSelectedTeams.indexOf(teamId);
  if(idx>=0)evSelectedTeams.splice(idx,1);
  else evSelectedTeams.push(teamId);
  renderEvTeamChecks();
  renderEvPlayers();
}

function renderEvPlayers(){
  var el=document.getElementById("ev-players-list");if(!el)return;
  var teams=getTeams();
  var allClub=evSelectedTeams.indexOf("__all__")>=0;
  var players;
  if(allClub){
    players=getPlayers();
  } else {
    var selectedTeams=teams.filter(function(t){return evSelectedTeams.indexOf(t.id)>=0;});
    if(!selectedTeams.length){
      players=getPlayers();
    } else {
      var allowedIds=[];
      var allowedCats=[];
      selectedTeams.forEach(function(t){
        if(t.members&&t.members.length)allowedIds=allowedIds.concat(t.members);
        else allowedCats.push(t.cat);
      });
      players=getPlayers().filter(function(p){return allowedIds.indexOf(p.id)>=0||allowedCats.indexOf(p.cat)>=0;});
    }
  }
  if(!players.length){el.innerHTML='<div style="font-size:11px;color:var(--mut);padding:8px 0">Aucun joueur concerne</div>';return;}
  el.innerHTML="";
  players.forEach(function(p){
    var lbl=document.createElement("label");
    lbl.style.cssText="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--bdr);font-size:12px;color:var(--txt)";
    var checkedAttr=selectedTeams.length?"checked":"";
    lbl.innerHTML='<input type="checkbox" class="ev-player-cb" value="'+p.id+'" '+checkedAttr+' style="width:16px;height:16px;accent-color:var(--dkg)"> '+p.prenom+' '+p.nom+' <span style="color:var(--mut);font-size:10px">('+p.cat+')</span>';
    el.appendChild(lbl);
  });
}
function renderEvExternes(){
  var el=document.getElementById("ev-externes-list");if(!el)return;
  if(!evExternes.length){el.innerHTML='<div style="font-size:11px;color:var(--mut);padding:4px 0">Aucun invite externe</div>';return;}
  el.innerHTML="";
  evExternes.forEach(function(ex,i){
    var div=document.createElement("div");
    div.style.cssText="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:12px;color:var(--txt)";
    div.innerHTML='<span style="flex:1">'+ex.nom+(ex.contact?" · "+ex.contact:"")+'</span><button onclick="removeEvExterne('+i+')" style="padding:3px 8px;border-radius:6px;background:rgba(192,57,43,.1);color:var(--red);font-size:10px;border:none;cursor:pointer">✕</button>';
    el.appendChild(div);
  });
}
function addEvExterne(){
  var nom=document.getElementById("ev-ext-nom").value.trim();
  var contact=document.getElementById("ev-ext-contact").value.trim();
  if(!nom){alert("Nom obligatoire");return;}
  evExternes.push({nom:nom,contact:contact});
  document.getElementById("ev-ext-nom").value="";
  document.getElementById("ev-ext-contact").value="";
  renderEvExternes();
}
function removeEvExterne(i){evExternes.splice(i,1);renderEvExternes();}

function saveEventFull(){
  var titre=document.getElementById("ev-titre").value.trim();
  var type=document.getElementById("ev-type").value;
  var date=document.getElementById("ev-date").value;
  var dateFin=document.getElementById("ev-date-fin").value;
  var heure=document.getElementById("ev-heure").value;
  var lieu=document.getElementById("ev-lieu").value.trim();
  var teams=getTeams();
  var realSelectedTeamIds=evSelectedTeams.filter(function(id){return id!=="__all__";});
  var equipe=teams.filter(function(t){return evSelectedTeams.indexOf(t.id)>=0;}).map(function(t){return t.name;}).join(", ");
  var canal=document.getElementById("ev-canal").value;
  if(!titre||!date){alert("Titre et date obligatoires");return;}
  var participantsClub=Array.from(document.querySelectorAll(".ev-player-cb:checked")).map(function(cb){return cb.value;});
  var players=getPlayers();
  var participantsNoms=participantsClub.map(function(id){var p=players.find(function(x){return x.id===id;});return p?p.prenom+" "+p.nom:id;});
  var isDirigeant=(window.ASMB_USER&&window.ASMB_USER.roles||[]).indexOf("dirigeant")>=0;
  var eventObj={
    id:Date.now().toString(),titre:titre,type:type,date:date,dateFin:dateFin||"",heure:heure||"",lieu:lieu||"",equipe:equipe||"",
    participantsClub:participantsClub,participantsExternes:evExternes.slice(),
    presences:{},evaluationEnabled:(type==="stage"&&document.getElementById("ev-eval-enabled").checked),
    canalId:canal||null, canalAutoTeamIds:(canal&&realSelectedTeamIds.length)?realSelectedTeamIds:[],
    canalAccessGranted:false, canalAccessRevoked:false,
    statut:isDirigeant?"validee":"attente",
    creePar:(window.ASMB_USER&&window.ASMB_USER.email)||"",
    creeParRole:isDirigeant?"dirigeant":"coach"
  };
  var events=getEvents();
  events.push(eventObj);
  saveEvents(events);
  buildPlanning();buildAdminHome();buildRealEventsList();
  closeModal("modal-event-full");
  if(!isDirigeant){
    alert("Événement soumis au dirigeant pour validation. Il apparaîtra dans le calendrier une fois approuvé.");
    return;
  }
  if(eventObj.canalId && eventObj.canalAutoTeamIds.length){ grantEventChannelAccess(eventObj); }
  finishSaveEventFullNotify(eventObj, canal, participantsNoms);
}
function finishSaveEventFullNotify(eventObj, canal, participantsNoms){
  var titre=eventObj.titre, date=eventObj.date, heure=eventObj.heure, lieu=eventObj.lieu, equipe=eventObj.equipe;
  // Envoi au canal si selectionne
  if(canal&&window.fbReady){
    var msg="<b>"+titre+"</b><br>"+date+(heure?" · "+heure:"")+"<br>"+(lieu?"📍 "+lieu+"<br>":"")+(equipe?equipe+"<br>":"")+(participantsNoms.length?"Participants : "+participantsNoms.join(", "):"");
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",canal,"messages"),{
      text:msg,pseudo:"Admin ASMB",ts:window.fbServerTimestamp()
    });
    alert("Événement créé et annonce envoyée dans le canal !");
  } else {
    alert("Événement créé !");
  }
}
function deleteEvent(id){askConfirm("Supprimer cet événement ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){if(!ok)return;var events=getEvents().filter(function(e){return e.id!==id;});saveEvents(events);buildPlanning();buildAdminHome();buildRealEventsList();});}

// ── ACCES AUTOMATIQUE AU CANAL POUR LES EQUIPES SELECTIONNEES (point 6) ──
function grantEventChannelAccess(eventObj){
  if(!window.fbDb||!window.fbGetDocs||!eventObj.canalId||!eventObj.canalAutoTeamIds||!eventObj.canalAutoTeamIds.length) return;
  window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(snap){
    var byId={}; snap.forEach(function(d){ byId[d.id]=d.data(); });
    var targetChannel=byId[eventObj.canalId];
    if(!targetChannel) return;
    var existing=(targetChannel.members||[]).slice();
    var existingPhones=existing.map(function(m){return typeof m==="string"?m:m.phone;});
    var added=false;
    eventObj.canalAutoTeamIds.forEach(function(teamId){
      // Trouve le canal propre a cette equipe (lie via teamId) pour recuperer ses membres
      Object.keys(byId).forEach(function(chId){
        var ch=byId[chId];
        if(ch.teamId===teamId && ch.members){
          ch.members.forEach(function(m){
            var phone=typeof m==="string"?m:m.phone;
            if(phone && existingPhones.indexOf(phone)<0){
              existing.push({phone:phone, label:(typeof m==="string"?"":m.label)||"", tempForEvent:eventObj.id});
              existingPhones.push(phone);
              added=true;
            }
          });
        }
      });
    });
    if(added){
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"channels",eventObj.canalId),{members:existing}).then(function(){
        var events=getEvents();
        var idx=events.findIndex(function(e){return e.id===eventObj.id;});
        if(idx>=0){ events[idx].canalAccessGranted=true; saveEvents(events); }
      }).catch(function(){});
    } else {
      var events=getEvents();
      var idx=events.findIndex(function(e){return e.id===eventObj.id;});
      if(idx>=0){ events[idx].canalAccessGranted=true; saveEvents(events); }
    }
  }).catch(function(){});
}
function revokeEventChannelAccess(eventObj){
  if(!window.fbDb||!window.fbGetDoc||!eventObj.canalId) return;
  window.fbGetDoc(window.fbDoc(window.fbDb,"channels",eventObj.canalId)).then(function(snap){
    if(!snap||!snap.exists()) return;
    var ch=snap.data();
    var members=(ch.members||[]).filter(function(m){
      return !(m && typeof m==="object" && m.tempForEvent===eventObj.id);
    });
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"channels",eventObj.canalId),{members:members}).catch(function(){});
  }).catch(function(){});
}
// A appeler periodiquement (ex: a l'ouverture de l'app dirigeant) pour retirer
// l'acces temporaire des evenements dont la date est passee.
function cleanupExpiredEventChannelAccess(){
  var events=getEvents();
  var today=new Date().toISOString().slice(0,10);
  var changed=false;
  events.forEach(function(e){
    var endDate=e.dateFin||e.date;
    if(e.canalAccessGranted && !e.canalAccessRevoked && endDate<today){
      revokeEventChannelAccess(e);
      e.canalAccessRevoked=true;
      changed=true;
    }
  });
  if(changed) saveEvents(events);
}

// ── VALIDATION DES EVENEMENTS CREES PAR UN COACH (point 3) ──────────
// Evenements reellement affiches (exclut ceux en attente de validation dirigeant, point 3)
function getVisibleEvents(){
  return getEvents().filter(function(e){ return e.statut!=="attente"; });
}
function getPendingEvents(){ return getEvents().filter(function(e){ return e.statut==="attente"; }); }
async function approveEvent(id){
  var events=getEvents();
  var idx=events.findIndex(function(e){return e.id===id;});
  if(idx<0) return;
  events[idx].statut="validee";
  saveEvents(events);
  buildPlanning();buildAdminHome();buildRealEventsList();
  var ev=events[idx];
  if(ev.canalId && ev.canalAutoTeamIds && ev.canalAutoTeamIds.length){ grantEventChannelAccess(ev); }
  if(document.getElementById("events-validation-list")) renderEventsValidationList(document.getElementById("events-validation-list"));
}
async function rejectEvent(id){
  var ok=await askConfirm("Refuser et supprimer cet événement proposé ?",{danger:true,confirmText:"Refuser"});
  if(!ok)return;
  var events=getEvents().filter(function(e){return e.id!==id;});
  saveEvents(events);
  buildPlanning();buildAdminHome();buildRealEventsList();
  if(document.getElementById("events-validation-list")) renderEventsValidationList(document.getElementById("events-validation-list"));
}
function openEventsValidationModal(){
  var modal=document.createElement("div");
  modal.className="events-validation-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Événements à valider";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.id="events-validation-list";
  list.style.cssText="overflow-y:auto;flex:1";
  inner.appendChild(hdr);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  renderEventsValidationList(list);
}
function renderEventsValidationList(list){
  var pending=getPendingEvents();
  list.innerHTML="";
  if(!pending.length){
    list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Aucun événement en attente.</div>';
    return;
  }
  pending.forEach(function(e){
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+eventTypeColor(e.type)+";border-radius:var(--rs);padding:14px;margin-bottom:10px";
    var title=document.createElement("div");
    title.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    title.textContent=e.titre;
    var meta=document.createElement("div");
    meta.style.cssText="font-size:11px;color:var(--mut);margin-bottom:10px";
    meta.textContent=eventTypeLabel(e.type)+" · "+e.date+(e.heure?" · "+e.heure:"")+(e.lieu?" · "+e.lieu:"")+(e.equipe?" · "+e.equipe:"")+" · proposé par "+(e.creePar||"un coach");
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px";
    var okBtn=document.createElement("button");
    okBtn.textContent="Valider";
    okBtn.style.cssText="padding:7px 14px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer";
    okBtn.addEventListener("click",function(){ approveEvent(e.id); });
    var refBtn=document.createElement("button");
    refBtn.textContent="Refuser";
    refBtn.style.cssText="padding:7px 14px;border-radius:20px;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:700;border:none;cursor:pointer";
    refBtn.addEventListener("click",function(){ rejectEvent(e.id); });
    btnRow.appendChild(okBtn);btnRow.appendChild(refBtn);
    card.appendChild(title);card.appendChild(meta);card.appendChild(btnRow);
    list.appendChild(card);
  });
}

function cancelEvent(eventId){
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev)return;
  askConfirm('"'+ev.titre+'" du '+ev.date+' — une alerte sera envoyée dans le canal.', {title:"Annuler cet événement ?", confirmText:"Annuler l'événement", danger:true}).then(function(ok){
    if(!ok)return;
    ev.cancelled=true;
    saveEvents(events);
    buildPlanning();
    if(window.fbReady){
      var channelId=findChannelForTeamText(ev.equipe);
      window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
        text:"<b>Événement annulé</b><br>\""+ev.titre+"\" du "+ev.date+(ev.heure?" a "+ev.heure:"")+" est annulé.",
        pseudo:"ASMB",ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
      });
    }
  });
}

async function editEventDateTime(eventId){
  var events=getEvents();
  var idx=events.findIndex(function(e){return e.id===eventId;});
  if(idx<0)return;
  var ev=events[idx];
  var oldDate=ev.date,oldHeure=ev.heure,oldEquipe=ev.equipe,oldLieu=ev.lieu;

  var newDate=await askPrompt("Date", {defaultValue:ev.date, placeholder:"AAAA-MM-JJ", confirmText:"Suivant"});
  if(newDate===null)return;
  var newHeure=await askPrompt("Heure", {defaultValue:ev.heure||"", confirmText:"Suivant"});
  if(newHeure===null)return;

  var teams=getTeams();
  var teamNames=teams.map(function(t){return t.name;}).join(", ");
  var newEquipe=await askPrompt("Équipe concernée", {defaultValue:ev.equipe||"", placeholder:teamNames, confirmText:"Suivant"});
  if(newEquipe===null)return;
  var newLieu=await askPrompt("Lieu", {defaultValue:ev.lieu||"", confirmText:"Enregistrer"});
  if(newLieu===null)return;

  var changed=(newDate!==oldDate)||(newHeure!==oldHeure)||(newEquipe!==oldEquipe)||(newLieu!==oldLieu);
  ev.date=newDate.trim()||oldDate;
  ev.heure=newHeure.trim();
  ev.equipe=newEquipe.trim();
  ev.lieu=newLieu.trim();
  saveEvents(events);
  buildPlanning();
  if(changed&&window.fbReady){
    var channelId=findChannelForTeamText(ev.equipe);
    var changesTxt=[];
    if(newDate!==oldDate||newHeure!==oldHeure)changesTxt.push("nouveau rendez-vous le "+ev.date+(ev.heure?" a "+ev.heure:""));
    if(newEquipe!==oldEquipe)changesTxt.push("équipe : "+ev.equipe);
    if(newLieu!==oldLieu)changesTxt.push("lieu : "+ev.lieu);
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
      text:"<b>Créneau modifié</b><br>\""+ev.titre+"\" : "+changesTxt.join(", "),
      pseudo:"ASMB",ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
    });
    alert("Créneau modifié, alerte envoyée dans le canal.");
  }
}
async function editScore(eventId){
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev)return;
  var adversaire=await askPrompt("Nom de l'adversaire", {defaultValue:(ev.score&&ev.score.adversaire)||"", confirmText:"Suivant"});
  if(adversaire===null)return;
  var scoreAsmb=await askPrompt("Score ASMB", {defaultValue:(ev.score&&ev.score.asmb)||"0", type:"number", confirmText:"Suivant"});
  if(scoreAsmb===null)return;
  var scoreAdv=await askPrompt("Score adversaire", {defaultValue:(ev.score&&ev.score.adv)||"0", type:"number", confirmText:"Enregistrer"});
  if(scoreAdv===null)return;
  ev.score={adversaire:adversaire.trim()||"Adversaire",asmb:parseInt(scoreAsmb,10)||0,adv:parseInt(scoreAdv,10)||0};
  saveEvents(events);
  buildPlanning();
}

// ── CONVOCATION ────────────────────────────────────────────────────
var convocEventId=null;

function showConvocation(eventId){
  convocEventId=eventId;
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev)return;
  document.getElementById("convoc-sub").textContent=ev.titre+" · "+ev.date+(ev.heure?" · "+ev.heure:"");
  var players=getPlayersForEvent(ev);
  var convoked=ev.convocations||[];
  var el=document.getElementById("convoc-players-list");
  if(!players.length){el.innerHTML='<div style="font-size:11px;color:var(--mut);padding:8px 0">Aucun joueur disponible pour cette équipe</div>';}
  else{
    el.innerHTML="";
    players.forEach(function(p){
      var isChecked=convoked.indexOf(p.id)>=0;
      var lbl=document.createElement("label");
      lbl.style.cssText="display:flex;align-items:center;gap:8px;padding:8px 4px;border-bottom:1px solid var(--bdr);font-size:12px;color:var(--txt)";
      lbl.innerHTML='<input type="checkbox" class="convoc-cb" value="'+p.id+'" '+(isChecked?"checked":"")+' style="width:16px;height:16px;accent-color:var(--dkg)"> '+p.prenom+' '+p.nom+' <span style="color:var(--mut);font-size:10px">('+p.cat+')</span>';
      el.appendChild(lbl);
    });
  }
  document.getElementById("modal-convocation").style.display="flex";
}

function findChannelForTeamText(teamText){
  var text=(teamText||"").toUpperCase();
  // 1. Chercher une equipe reelle correspondante (par nom ou categorie) et utiliser son propre canal,
  // SANS le recréer s'il a été supprimé volontairement (voir showAddTeam pour la création du canal).
  var teams=getTeams();
  var matchedTeam=teams.find(function(t){
    return text.indexOf(t.name.toUpperCase())>=0||t.name.toUpperCase().indexOf(text)>=0||text===t.cat.toUpperCase();
  });
  if(matchedTeam){
    return matchedTeam.id;
  }
  // 2. Repli sur les canaux generiques par categorie
  var known={"U13":"u13f","U15":"u15","SENIOR":"seniors"};
  for(var key in known){
    if(text.indexOf(key)>=0)return known[key];
  }
  return "general";
}

function ensureTeamChannel(team){
  if(!window.fbReady)return;
  window.fbSetDoc(window.fbDoc(window.fbDb,"channels",team.id),{
    id:team.id,name:team.name,icon:"🏀",desc:"Canal de l'équipe "+team.name
  },{merge:true});
}

function saveConvocation(){
  var events=getEvents();
  var idx=events.findIndex(function(e){return e.id===convocEventId;});
  if(idx<0)return;
  var ev=events[idx];
  var checked=Array.from(document.querySelectorAll(".convoc-cb:checked")).map(function(cb){return cb.value;});
  if(!checked.length){alert("Sélectionnez au moins un joueur");closeModal("modal-convocation");return;}
  ev.convocations=checked;
  saveEvents(events);
  buildPlanning();
  closeModal("modal-convocation");

  var players=getPlayers();
  var convocPlayers=checked.map(function(id){var p=players.find(function(x){return x.id===id;});return p?{id:id,nom:p.prenom+" "+p.nom}:null;}).filter(Boolean);
  var channelId=findChannelForTeamText(ev.equipe);
  if(window.fbReady){
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
      type:"convocation",eventId:ev.id,eventTitre:ev.titre,eventDate:ev.date,eventHeure:ev.heure||"",eventLieu:ev.lieu||"",
      players:convocPlayers,responses:{},pseudo:"Convocation ASMB",ts:window.fbServerTimestamp()
    });
    alert("Convocation envoyée dans le canal !");
  } else {
    alert("Convocation enregistrée (pas de connexion pour notifier)");
  }
}

// ── METEO DU MATCH ───────────────────────────────────────────────
function weatherIconHtml(code){
  // Codes WMO simplifies : 0-1 soleil, 2-3 nuage, 45-48 brouillard, 51-67/80-82 pluie, 71-77/85-86 neige, 95+ orage
  if(code===0||code===1){
    return '<div class="weather-icon-wrap"><div class="w-sun"></div><div class="w-sun-rays">'+
      [0,45,90,135,180,225,270,315].map(function(a){return '<div class="w-ray" style="transform:rotate('+a+'deg) translateY(2px)"></div>';}).join("")+
      '</div></div>';
  }
  if(code>=2&&code<=3){
    return '<div class="weather-icon-wrap"><div class="w-sun" style="width:50px;height:50px;top:15px;left:10px"></div><div class="w-cloud"></div></div>';
  }
  if((code>=51&&code<=67)||(code>=80&&code<=82)){
    var drops=[];
    for(var i=0;i<5;i++){drops.push('<div class="w-rain" style="left:'+(25+i*13)+'px;top:60px;animation-delay:'+(i*0.15)+'s"></div>');}
    return '<div class="weather-icon-wrap"><div class="w-cloud" style="top:20px"></div>'+drops.join("")+'</div>';
  }
  if(code>=71&&code<=86){
    return '<div class="weather-icon-wrap"><div class="w-cloud" style="top:20px"></div><div style="position:absolute;top:60px;left:30px;font-size:24px"></div></div>';
  }
  if(code>=95){
    return '<div class="weather-icon-wrap"><div class="w-cloud" style="top:20px;background:#8a94a3"></div><div style="position:absolute;top:58px;left:44px;font-size:22px"></div></div>';
  }
  return '<div class="weather-icon-wrap"><div class="w-cloud" style="top:30px"></div></div>';
}

function weatherLabel(code){
  if(code===0)return "Ciel degage";
  if(code===1)return "Plutot ensoleille";
  if(code===2)return "Partiellement nuageux";
  if(code===3)return "Couvert";
  if(code>=45&&code<=48)return "Brouillard";
  if((code>=51&&code<=67)||(code>=80&&code<=82))return "Pluie";
  if(code>=71&&code<=86)return "Neige";
  if(code>=95)return "Orage";
  return "Conditions variables";
}

function checkWeatherAlerts(){
  if(!window.asmbCoachMode||!window.fbReady)return;
  var events=getEvents();
  var now=new Date();
  var todayStr=now.toISOString().slice(0,10);
  var in48h=new Date(now.getTime()+48*3600000).toISOString().slice(0,10);
  var upcoming=events.filter(function(e){return e.type==="match"&&e.lieu&&e.date>=todayStr&&e.date<=in48h;});
  var alerted=JSON.parse(localStorage.getItem("asmb_weather_alerted")||"{}");
  upcoming.forEach(function(ev){
    if(alerted[ev.id])return;
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(ev.lieu+", France"))
      .then(function(r){return r.json();})
      .then(function(geo){
        if(!geo||!geo.length)return;
        return fetch("https://api.open-meteo.com/v1/forecast?latitude="+geo[0].lat+"&longitude="+geo[0].lon+"&daily=weathercode&timezone=auto&start_date="+ev.date+"&end_date="+ev.date)
          .then(function(r2){return r2.json();})
          .then(function(w){
            if(!w.daily||!w.daily.weathercode||!w.daily.weathercode.length)return;
            var code=w.daily.weathercode[0];
            var isBad=(code>=51&&code<=67)||(code>=80&&code<=99);
            if(!isBad)return;
            alerted[ev.id]=true;
            localStorage.setItem("asmb_weather_alerted",JSON.stringify(alerted));
            var channelId=findChannelForTeamText(ev.equipe);
            window.fbAddDoc(window.fbCollection(window.fbDb,"channels",channelId,"messages"),{
              text:"<b>Alerte meteo</b><br>"+weatherLabel(code)+" prévu pour le match \""+ev.titre+"\" le "+ev.date+(ev.heure?" a "+ev.heure:"")+" · "+ev.lieu,
              pseudo:"Alerte Meteo ASMB",ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
            });
          });
      })
      .catch(function(){});
  });
}

var deferredPwaPrompt=null;
window.addEventListener("beforeinstallprompt",function(ev){
  ev.preventDefault();deferredPwaPrompt=ev;
  var b=document.getElementById("pwa-install-btn");if(b)b.style.display="inline-block";
});

function isStandalonePwa(){
  return window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
}

function maybeShowPwaHint(){
  var box=document.getElementById("pwa-install-hint");
  if(!box)return;
  if(isStandalonePwa()||localStorage.getItem("asmb_pwa_hint")==="off"){box.style.display="none";return;}
  var ua=navigator.userAgent||"";
  var isIos=/iPad|iPhone|iPod/.test(ua);
  var txt=document.getElementById("pwa-install-txt");
  if(txt){
    txt.textContent=isIos
      ? "Sur iPhone : touchez le bouton Partager puis \"Sur l\'écran d\'accueil\"."
      : "Ajoutez ASMB a votre écran d\'accueil pour un accès direct, sans passer par le navigateur.";
  }
  var b=document.getElementById("pwa-install-btn");
  if(b)b.style.display=deferredPwaPrompt?"inline-block":"none";
  box.style.display="block";
}

function triggerPwaInstall(){
  if(!deferredPwaPrompt)return;
  deferredPwaPrompt.prompt();
  deferredPwaPrompt.userChoice.then(function(){
    deferredPwaPrompt=null;
    dismissPwaHint();
  });
}

function dismissPwaHint(){
  localStorage.setItem("asmb_pwa_hint","off");
  var box=document.getElementById("pwa-install-hint");if(box)box.style.display="none";
}

function icsEscape(s){return String(s||"").replace(/\\/g,"\\\\").replace(/;/g,"\\;").replace(/,/g,"\\,").replace(/\n/g,"\\n");}

function icsStamp(dateStr,heureStr,offsetMin){
  var hm=(heureStr||"00:00").replace("h",":").split(":");
  var h=parseInt(hm[0]||"0",10),mi=parseInt(hm[1]||"0",10);
  var d=new Date(dateStr+"T00:00:00");
  d.setHours(h,mi,0,0);
  if(offsetMin)d.setMinutes(d.getMinutes()+offsetMin);
  function p(n){return (n<10?"0":"")+n;}
  return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+"T"+p(d.getHours())+p(d.getMinutes())+"00";
}

function eventToVEVENT(e){
  var isMatch=e.type==="match";
  // Pour un match : rendez-vous 1h avant (45 min a domicile)
  var rdvOffset=isMatch?-parseInt(/domicile/i.test(e.lieu||"")?ppGet("asmb_rdv_home","45"):ppGet("asmb_rdv_away","60"),10):0;
  var start=icsStamp(e.date,e.heure,rdvOffset);
  var end=icsStamp(e.date,e.heure,isMatch?90:90);
  var desc=isMatch?("Rendez-vous "+Math.abs(rdvOffset)+" min avant le match ("+(e.heure||"")+")"+(e.equipe?" - "+e.equipe:"")):(e.equipe||"");
  var alarm=[];
  if(ppGet("asmb_ics_alarm","on")==="on"){
    alarm=["BEGIN:VALARM","TRIGGER:-PT"+parseInt(ppGet("asmb_ics_delay","120"),10)+"M","ACTION:DISPLAY","DESCRIPTION:"+icsEscape(e.titre),"END:VALARM"];
  }
  return ["BEGIN:VEVENT",
    "UID:"+e.id+"@asmb-basket",
    "DTSTAMP:"+icsStamp(e.date,e.heure,0)+"Z",
    "DTSTART:"+start,
    "DTEND:"+end,
    "SUMMARY:"+icsEscape((isMatch?" ":"")+e.titre),
    "LOCATION:"+icsEscape(e.lieu||""),
    "DESCRIPTION:"+icsEscape(desc)]
    .concat(alarm)
    .concat(["END:VEVENT"]).join("\r\n");
}

function downloadIcs(filename,events){
  if(!events.length){alert("Aucun événement a exporter");return;}
  var body=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ASMB Basket//FR","CALSCALE:GREGORIAN"]
    .concat(events.map(eventToVEVENT)).concat(["END:VCALENDAR"]).join("\r\n");
  var blob=new Blob([body],{type:"text/calendar;charset=utf-8"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();
  document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(url);},1500);
}

function exportEventIcs(eventId){
  var e=getEvents().find(function(x){return x.id===eventId;});
  if(!e)return;
  downloadIcs("asmb-"+(e.titre||"event").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".ics",[e]);
}

function exportSeasonIcs(){
  var lp=getLinkedPlayerForCheckin();
  var all=getEvents().filter(function(e){return e.date&&!e.cancelled;});
  var mine=lp?all.filter(function(e){return eventMatchesPlayer(e,lp);}):all;
  if(!mine.length)mine=all;
  downloadIcs("asmb-saison.ics",mine);
}

function getTodayMatchForTeams(teamNames){
  var todayStr=new Date().toISOString().slice(0,10);
  var evs=getEvents().filter(function(e){
    if(e.type!=="match"||e.cancelled||e.date!==todayStr)return false;
    if(!e.equipe)return false;
    var eq=e.equipe.toUpperCase();
    return teamNames.some(function(n){return eq.indexOf(n.toUpperCase())>=0;});
  });
  evs.sort(function(a,b){return (a.heure||"")>(b.heure||"")?1:-1;});
  return evs[0]||null;
}

function matchdayBannerHtml(ev,mini){
  var d=new Date(ev.date+"T00:00:00");
  var jour=d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  var rdv=rdvTimeFor(ev);
  if(mini){
    return '<div onclick="openMatchday(\''+ev.id+'\')" style="cursor:pointer;background:linear-gradient(135deg,#E8670A,#c0560a);border-radius:var(--r);padding:12px 14px;color:#fff;display:flex;align-items:center;gap:12px;box-shadow:0 3px 12px rgba(232,103,10,.28)">'+
      '<div style="font-size:22px">🏀</div>'+
      '<div style="flex:1;min-width:0"><div style="font-size:9px;font-weight:800;letter-spacing:1px;opacity:.85;text-transform:uppercase">Jour de match</div><div style="font-size:13px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ev.titre+'</div></div>'+
      '<div style="font-size:20px">›</div></div>';
  }
  return '<div onclick="openMatchday(\''+ev.id+'\')" style="cursor:pointer;min-height:calc(100vh - 220px);margin:-16px -16px 0;padding:40px 26px;border-radius:0;background:radial-gradient(circle at 85% 0%, rgba(232,103,10,.25) 0%, transparent 50%), linear-gradient(160deg,#1A2E5A 0%,#142a4d 60%,#050b16 100%);color:#fff;display:flex;flex-direction:column;justify-content:center;text-align:center">'+
    '<div style="font-size:64px;margin-bottom:14px">🏀</div>'+
    '<div style="display:inline-block;margin:0 auto 16px;background:var(--red);font-size:11px;font-weight:800;padding:5px 16px;border-radius:20px;letter-spacing:1px">JOUR DE MATCH</div>'+
    '<div style="font-size:26px;font-weight:900;line-height:1.2;margin-bottom:10px">'+ev.titre+'</div>'+
    '<div style="font-size:14px;opacity:.85;margin-bottom:6px">'+jour+(ev.heure?" · "+ev.heure:"")+'</div>'+
    (ev.lieu?'<div style="font-size:14px;opacity:.85">📍 '+ev.lieu+'</div>':'')+
    (rdv?'<div style="margin:22px auto 0;background:rgba(232,103,10,.2);border:1px solid rgba(232,103,10,.5);border-radius:var(--rs);padding:12px 18px;font-size:15px;font-weight:800">⏰ RDV sur place à '+rdv.txt+'</div>':'')+
    '<div style="margin-top:28px;font-size:13px;font-weight:800;background:#fff;color:#1A2E5A;padding:14px;border-radius:var(--rx)">Appuyer pour voir les details ›</div></div>';
}

function renderMatchdayBanner(containerId,teamNames){
  var el=document.getElementById(containerId);
  if(!el)return;
  var ev=getTodayMatchForTeams(teamNames);
  if(!ev){el.innerHTML="";el.style.display="none";return;}
  el.style.display="block";
  var seen=localStorage.getItem("asmb_md_seen_"+ev.id)==="1";
  el.innerHTML=matchdayBannerHtml(ev,seen);
}

function openMatchday(eventId){
  localStorage.setItem("asmb_md_seen_"+eventId,"1");
  stack.push("matchday");
  showScr("matchday");
  buildMatchday(eventId);
}

function buildMatchday(eventId){
  var ev=getEvents().find(function(e){return e.id===eventId;});
  var el=document.getElementById("matchday-content");
  if(!ev){el.innerHTML='<div class="empty-state"><div>Match introuvable</div></div>';return;}
  var d=new Date(ev.date+"T00:00:00");
  var jour=d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  var rdv=rdvTimeFor(ev);
  var mapsBtn=ev.lieu?'<button onclick="window.open(\'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(ev.lieu)+'\',\'_blank\')" style="flex:1;padding:12px;border-radius:var(--rx);background:rgba(26,46,90,.1);color:#1A2E5A;font-size:12px;font-weight:700;border:none;cursor:pointer">🧭 Itineraire</button>':'';
  var weatherBtn=ev.lieu?'<button onclick="showWeather(\''+ev.id+'\')" style="flex:1;padding:12px;border-radius:var(--rx);background:rgba(232,103,10,.12);color:#E8670A;font-size:12px;font-weight:700;border:none;cursor:pointer">☀️ Meteo</button>':'';

  el.innerHTML=
    '<div style="padding:22px 18px;background:radial-gradient(circle at 85% 0%, rgba(232,103,10,.22) 0%, transparent 50%), linear-gradient(160deg,#1A2E5A 0%,#142a4d 60%,#050b16 100%);color:#fff">'+
      '<div style="display:inline-block;background:var(--red);font-size:10px;font-weight:800;padding:4px 12px;border-radius:20px;letter-spacing:.5px">MATCH</div>'+
      '<div style="font-size:22px;font-weight:900;line-height:1.15;margin-top:12px">'+ev.titre+'</div>'+
      '<div style="font-size:13px;opacity:.85;margin-top:8px">'+jour+(ev.heure?" · "+ev.heure:"")+(ev.lieu?" · "+ev.lieu:"")+'</div>'+
      (rdv?'<div style="background:rgba(232,103,10,.18);border:1px solid rgba(232,103,10,.4);border-radius:var(--rs);padding:12px 14px;margin-top:14px;font-size:14px;font-weight:800">⏰ RDV sur place à '+rdv.txt+' ('+rdv.mins+' min avant)</div>':'')+
    '</div>'+
    '<div style="padding:16px">'+
      '<div style="display:flex;gap:10px;margin-bottom:18px">'+mapsBtn+weatherBtn+'</div>'+
      '<div id="md-counts" style="display:flex;gap:10px;margin-bottom:14px"></div>'+
      '<div class="sec" style="padding:0 0 8px">Effectif convoqué</div>'+
      '<div id="md-players"></div>'+
    '</div>';

  renderMatchdayPlayers(ev);
}

function renderMatchdayPlayers(ev){
  var players=getPlayersForEvent(ev);
  var countsEl=document.getElementById("md-counts");
  var listEl=document.getElementById("md-players");
  if(!listEl)return;
  if(!window.fbReady){
    listEl.innerHTML='<div style="font-size:12px;color:var(--mut);padding:10px">Connexion requise pour voir les pointages.</div>';
    return;
  }
  window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
    var status={};
    snap.forEach(function(doc){
      var c=doc.data();
      if(c.eventId===ev.id)status[c.playerId]=c.status;
    });
    var pres=0,abs=0,none=0;
    var rows="";
    players.forEach(function(p){
      var st=status[p.id];
      if(st==="present")pres++;else if(st==="absent")abs++;else none++;
      var initials=((p.prenom||"?")[0]+(p.nom||"?")[0]).toUpperCase();
      var badge=st==="present"?'<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;background:rgba(212,175,55,.15);color:#D4AF37">Present</span>':
                st==="absent"?'<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;background:rgba(192,57,43,.12);color:#C0392B">Absent</span>':
                '<span style="font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;background:var(--bdr);color:var(--mut)">—</span>';
      rows+='<div style="display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:10px 12px;margin-bottom:8px">'+
        '<div style="width:38px;height:38px;border-radius:50%;background:var(--dkg);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;flex-shrink:0">'+initials+'</div>'+
        '<div style="flex:1;font-size:13px;font-weight:700;color:var(--txt)">'+p.prenom+' '+p.nom+'</div>'+badge+'</div>';
    });
    if(countsEl){
      countsEl.innerHTML=
        '<div style="flex:1;border-radius:var(--rs);padding:14px;text-align:center;color:#fff;background:#D4AF37"><div style="font-size:26px;font-weight:900">'+pres+'</div><div style="font-size:10px;font-weight:700;text-transform:uppercase">Presents</div></div>'+
        '<div style="flex:1;border-radius:var(--rs);padding:14px;text-align:center;color:#fff;background:#C0392B"><div style="font-size:26px;font-weight:900">'+abs+'</div><div style="font-size:10px;font-weight:700;text-transform:uppercase">Absents</div></div>'+
        '<div style="flex:1;border-radius:var(--rs);padding:14px;text-align:center;color:#fff;background:#8a9a90"><div style="font-size:26px;font-weight:900">'+none+'</div><div style="font-size:10px;font-weight:700;text-transform:uppercase">Sans reponse</div></div>';
    }
    listEl.innerHTML=rows||'<div style="font-size:12px;color:var(--mut);padding:10px">Aucun joueur convoqué.</div>';
  }).catch(function(){
    listEl.innerHTML='<div style="font-size:12px;color:var(--mut);padding:10px">Erreur de chargement.</div>';
  });
}

function rdvTimeFor(e){
  var atHome=/domicile/i.test(e.lieu||"");
  var mins=parseInt(atHome?ppGet("asmb_rdv_home","45"):ppGet("asmb_rdv_away","60"),10);
  var hm=(e.heure||"").replace("h",":").split(":");
  if(!hm[0])return null;
  var d=new Date(e.date+"T00:00:00");
  d.setHours(parseInt(hm[0],10),parseInt(hm[1]||"0",10),0,0);
  d.setMinutes(d.getMinutes()-mins);
  function p(n){return (n<10?"0":"")+n;}
  return {txt:p(d.getHours())+"h"+p(d.getMinutes()),mins:mins};
}

function shareCovoiturage(eventId){
  var e=getEvents().find(function(x){return x.id===eventId;});
  if(!e)return;
  var d=new Date(e.date+"T00:00:00");
  var jour=d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  var rdv=rdvTimeFor(e);
  var lignes=[" "+e.titre];
  if(e.equipe)lignes.push(e.equipe);
  lignes.push(jour+(e.heure?" a "+e.heure:""));
  if(e.lieu)lignes.push("📍 "+e.lieu);
  if(rdv)lignes.push("RDV sur place a "+rdv.txt+" ("+rdv.mins+" min avant)");
  lignes.push("");
  lignes.push("Qui peut emmener / ramener des joueurs ?");
  var txt=lignes.join("\n");
  if(navigator.share){
    navigator.share({title:e.titre,text:txt}).catch(function(){});
  } else {
    window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank");
  }
}

function showQrModal(kind){
  var base="https://ecole-app.github.io/Asmb-basket/";
  var url=kind==="inscription"?base+"?inscription=1":base;
  document.getElementById("qr-title").textContent=kind==="inscription"?"QR S'inscrire":"QR Rejoindre l'app";
  document.getElementById("qr-sub").textContent=kind==="inscription"?"Ouvre directement la fiche d'inscription":"Ouvre l'application ASMB";
  document.getElementById("qr-url").textContent=url;
  var box=document.getElementById("qr-canvas");
  box.innerHTML="";
  document.getElementById("modal-qr").style.display="flex";
  if(typeof QRCode==="undefined"){box.innerHTML='<div style="font-size:12px;color:#888;padding:20px">Chargement du generateur, réessayez dans un instant.</div>';return;}
  new QRCode(box,{text:url,width:220,height:220,colorDark:"#1A2E5A",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
}

function showWeather(eventId){
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev||!ev.lieu)return;
  var el=document.getElementById("weather-content");
  el.innerHTML='<div style="font-size:12px;color:var(--mut)">Recherche de la meteo pour "'+ev.lieu+'"...</div>';
  document.getElementById("modal-weather").style.display="flex";

  fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(ev.lieu+", France"))
    .then(function(r){return r.json();})
    .then(function(geo){
      if(!geo||!geo.length){el.innerHTML='<div style="font-size:12px;color:var(--mut)">Lieu introuvable pour la meteo. Vérifiez l\'adresse renseignee.</div>';return;}
      var lat=geo[0].lat,lon=geo[0].lon;
      return fetch("https://api.open-meteo.com/v1/forecast?latitude="+lat+"&longitude="+lon+"&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&start_date="+ev.date+"&end_date="+ev.date)
        .then(function(r2){return r2.json();})
        .then(function(w){
          if(!w.daily||!w.daily.weathercode||!w.daily.weathercode.length){
            el.innerHTML='<div style="font-size:12px;color:var(--mut)">Previsions non disponibles pour cette date (trop lointaine ou passée).</div>';
            return;
          }
          var code=w.daily.weathercode[0];
          var tmax=Math.round(w.daily.temperature_2m_max[0]);
          var tmin=Math.round(w.daily.temperature_2m_min[0]);
          el.innerHTML=weatherIconHtml(code)+
            '<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:4px">'+weatherLabel(code)+'</div>'+
            '<div style="font-size:22px;font-weight:900;color:var(--txt)">'+tmax+'° <span style="font-size:14px;color:var(--mut);font-weight:600">/ '+tmin+'°</span></div>'+
            '<div style="font-size:11px;color:var(--mut);margin-top:6px">'+ev.lieu+' · '+ev.date+'</div>';
        });
    })
    .catch(function(){
      el.innerHTML='<div style="font-size:12px;color:var(--mut)">Impossible de recuperer la meteo (vérifiez votre connexion).</div>';
    });
}

