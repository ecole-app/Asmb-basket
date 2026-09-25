/* ===== 07-presences.js — Pointage des presences et envoi groupe aux familles ===== */
// ═══ PRESENCES ═══════════════════════════════════════════════════
var currentPresenceEventId=null;

function openPresences(eventId){
  var events=getEvents();
  var ev=events.find(function(e){return e.id===eventId;});
  if(!ev)return;
  currentPresenceEventId=eventId;
  document.getElementById("presence-title").textContent="Présences · "+ev.titre;
  document.getElementById("presence-sub").textContent=ev.date+(ev.heure?" · "+ev.heure:"")+(ev.equipe?" · "+ev.equipe:"");
  var players=getPlayers();
  var relevantPlayers=getPlayersForEvent(ev);
  if(!relevantPlayers.length)relevantPlayers=players;
  var el=document.getElementById("presence-list");
  el.innerHTML="";
  var presences=ev.presences||{};
  relevantPlayers.forEach(function(p){
    var state=presences[p.id]||"present";
    var div=document.createElement("div");
    div.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bdr);flex-wrap:wrap;gap:6px";
    div.innerHTML='<div style="font-size:13px;font-weight:600;color:var(--txt);display:flex;align-items:center;gap:6px">'+p.prenom+' '+p.nom+'<span id="selfdecl-'+p.id+'"></span></div>'+
      '<div style="display:flex;gap:6px">'+
        '<button data-pid="'+p.id+'" data-state="present" onclick="setPresenceState(this)" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid '+(state==="present"?"#27AE60":"var(--bdr)")+';background:'+(state==="present"?"#27AE60":"var(--bg)")+';color:'+(state==="present"?"#fff":"var(--mut)")+';cursor:pointer">✓ Présent</button>'+
        '<button data-pid="'+p.id+'" data-state="absent" onclick="setPresenceState(this)" style="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1.5px solid '+(state==="absent"?"#C0392B":"var(--bdr)")+';background:'+(state==="absent"?"#C0392B":"var(--bg)")+';color:'+(state==="absent"?"#fff":"var(--mut)")+';cursor:pointer">✕ Absent</button>'+
      '</div>';
 el.appendChild(div);
 checkExistingCheckin(eventId,p.id).then(function(existing){
 var badgeEl=document.getElementById("selfdecl-"+p.id);
 if(!badgeEl||!existing)return;
 var labels={present:"✓ auto",retard:"retard (auto)",absent:"✕ auto"};
 var colors={present:"#27AE60",retard:"#E8670A",absent:"#C0392B"};
 badgeEl.innerHTML='<span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:8px;color:#fff;background:'+colors[existing.status]+'">'+labels[existing.status]+'</span>';
    });
  });
  document.getElementById("modal-presence").style.display="flex";
}

function setPresenceState(btn){
  var pid=btn.dataset.pid,state=btn.dataset.state;
  var parent=btn.parentElement;
  parent.querySelectorAll("button").forEach(function(b){
    var isThis=b===btn;
    var s=b.dataset.state;
    var col=s==="present"?"#27AE60":"#C0392B";
    b.style.background=isThis?col:"var(--bg)";
    b.style.color=isThis?"#fff":"var(--mut)";
    b.style.borderColor=isThis?col:"var(--bdr)";
  });
  btn.dataset.selected="1";
}

function savePresences(){
  var events=getEvents();
  var idx=events.findIndex(function(e){return e.id===currentPresenceEventId;});
  if(idx<0)return;
  var presences={};
  document.querySelectorAll("#presence-list > div").forEach(function(row){
    var btns=row.querySelectorAll("button");
    btns.forEach(function(b){
      if(b.style.color==="rgb(255, 255, 255)"){presences[b.dataset.pid]=b.dataset.state;}
    });
  });
  events[idx].presences=presences;
  saveEvents(events);
  closeModal("modal-presence");
  buildPlanning();
  alert("Présences enregistrees !");
}

// ═══ BROADCAST EMAIL ═════════════════════════════════════════════
function getAllContactEmails(){
  var lics=getLicences();
  var emails=[];
  lics.forEach(function(lic){
    if(!lic.fiche)return;
    var f=lic.fiche;
    [f.emailLic,f.respEmail,f.resp2Email].forEach(function(e){
      if(e&&e.trim()&&emails.indexOf(e.trim())<0)emails.push(e.trim());
    });
  });
  return emails;
}

function showBroadcast(){
  var emails=getAllContactEmails();
  document.getElementById("broadcast-count").textContent=emails.length+" destinataire"+(emails.length>1?"s":"")+" trouve"+(emails.length>1?"s":"")+" dans les inscriptions";
  document.getElementById("bc-sujet").value="";
  document.getElementById("bc-message").value="";
  document.getElementById("bc-signature").value=localStorage.getItem("asmb_broadcast_signature")||"";
  var tip=document.getElementById("bc-mail-tip");
  if(tip)tip.style.display=localStorage.getItem("asmb_tip_bc_mail_dismissed")?"none":"flex";
  document.getElementById("modal-broadcast").style.display="flex";
}

function dismissMailTip(elId,storageKey){
  localStorage.setItem(storageKey,"1");
  var el=document.getElementById(elId);
  if(el)el.style.display="none";
}

function sendBroadcast(){
  var sujet=document.getElementById("bc-sujet").value.trim();
  var message=document.getElementById("bc-message").value.trim();
  var signature=document.getElementById("bc-signature").value.trim();
  if(!sujet||!message){alert("Objet et message obligatoires");return;}
  var emails=getAllContactEmails();
  if(!emails.length){alert("Aucun contact email trouve");return;}
  localStorage.setItem("asmb_broadcast_signature",signature);
  var sigBlock=signature?(signature+"\nASMB · Saint-Étienne Métropole Basket"):"L'équipe ASMB\nSaint-Étienne Métropole Basket";
  var body="Bonjour,\n\n"+message+"\n\n"+sigBlock;
  var mailto="mailto:?bcc="+emails.join(",")+"&subject="+encodeURIComponent(sujet)+"&body="+encodeURIComponent(body);
  window.location.href=mailto;
  closeModal("modal-broadcast");
}

