/* ===== 10-annuaire-galerie.js — Annuaire, benevoles, galerie photos, sauvegarde, demo ===== */
// ── ANNUAIRE DU CLUB ────────────────────────────────────────────
function getAnnuaire(){try{return JSON.parse(localStorage.getItem("asmb_annuaire")||"[]");}catch(e){return [];}}
function saveAnnuaireList(list){localStorage.setItem("asmb_annuaire",JSON.stringify(list));fsWriteCollection("annuaire",list);}

var calWeekOffset=0;

function openCalendrier(){
  calWeekOffset=0;
  stack.push("calendrier");
  showScr("calendrier");
  switchCalTab("semaine");
}

var calCurrentTab="semaine";
var matchFilterCat="all";

function switchCalTab(tab){
  calCurrentTab=tab;
  document.getElementById("caltab-semaine").classList.toggle("on",tab==="semaine");
  document.getElementById("caltab-matchs").classList.toggle("on",tab==="matchs");
  document.getElementById("caltab-classement").classList.toggle("on",tab==="classement");
  document.getElementById("cal-tab-semaine").style.display=tab==="semaine"?"block":"none";
  document.getElementById("cal-tab-matchs").style.display=tab==="matchs"?"block":"none";
  document.getElementById("cal-tab-classement").style.display=tab==="classement"?"block":"none";
  if(tab==="semaine")buildCalendrier();
  else if(tab==="matchs")buildMatchList();
  else buildClassement();
}

function showMatchFilter(){
  var row=document.getElementById("match-filter-row");
  if(row.style.display==="flex"){row.style.display="none";return;}
  var teams=getTeams();
  var cats=[];
  teams.forEach(function(t){if(cats.indexOf(t.cat)<0)cats.push(t.cat);});
  var html='<button class="cat-filter'+(matchFilterCat==="all"?" on":"")+'" onclick="setMatchFilter(\'all\')" style="display:inline-block;margin-right:6px">Tous</button>';
  cats.forEach(function(c){
    html+='<button class="cat-filter'+(matchFilterCat===c?" on":"")+'" onclick="setMatchFilter(\''+c+'\')" style="display:inline-block;margin-right:6px">'+c+'</button>';
  });
  row.innerHTML=html;
  row.style.display="flex";
}

function setMatchFilter(cat){
  matchFilterCat=cat;
  showMatchFilter();
  showMatchFilter();
  buildMatchList();
}

function buildMatchList(){
  var content=document.getElementById("match-list-content");
  content.innerHTML='<div style="text-align:center;padding:30px;font-size:12px;color:var(--mut)">Chargement...</div>';
  fetchEventsFromCloud().then(function(events){
    var matches=events.filter(function(e){return e.type==="match"&&!e.cancelled;});
    if(matchFilterCat!=="all"){
      matches=matches.filter(function(e){return (e.equipe||"").toUpperCase().indexOf(matchFilterCat.toUpperCase())>=0;});
    }
    matches.sort(function(a,b){return b.date>a.date?1:-1;});
    if(!matches.length){
      content.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun match</div></div>';
      return;
    }
    var todayStr=new Date().toISOString().slice(0,10);
    var monthLabels={};
    content.innerHTML="";
    matches.forEach(function(e){
      var d=new Date(e.date);
      var monthKey=d.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
      if(!monthLabels[monthKey]){
        monthLabels[monthKey]=true;
        var monthDiv=document.createElement("div");
        monthDiv.style.cssText="padding:14px 16px 6px;font-size:12px;font-weight:800;color:#E8670A;text-transform:uppercase;letter-spacing:.5px";
        monthDiv.textContent=monthKey;
        content.appendChild(monthDiv);
      }
      var isPast=e.date<todayStr;
      var card=document.createElement("div");
      card.style.cssText="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:12px 14px;box-shadow:0 2px 8px var(--shadow);display:flex;gap:12px;align-items:flex-start";
      card.innerHTML='<div style="text-align:center;flex-shrink:0;width:40px">'+
          '<div style="font-size:16px;font-weight:900;color:var(--txt)">'+d.getDate()+'</div>'+
          '<div style="font-size:9px;font-weight:700;color:var(--mut);text-transform:uppercase">'+d.toLocaleDateString("fr-FR",{month:"short"})+'</div>'+
        '</div>'+
        '<div style="flex:1;min-width:0">'+
          '<div style="font-size:13px;font-weight:700;color:var(--txt)">'+e.titre+'</div>'+
          '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+d.toLocaleDateString("fr-FR",{weekday:"long"})+', '+(e.heure||"?")+(e.lieu?" · "+e.lieu:"")+'</div>'+
          '<div id="match-counts-'+e.id+'" style="margin-top:8px;display:flex;gap:6px;align-items:center"></div>'+
          (e.lieu?'<button onclick="showWeather(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(232,103,10,.12);color:#E8670A;font-size:10px;font-weight:700;border:none;cursor:pointer"> Meteo</button>':'')+
          (e.lieu?'<a href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(e.lieu)+'" target="_blank" style="display:inline-block;margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(26,46,90,.12);color:#1A2E5A;font-size:10px;font-weight:700;text-decoration:none"> Itineraire</a>':'')+
          ((["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0)?('<button onclick="showConvocation(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(26,46,90,.12);color:#1A2E5A;font-size:10px;font-weight:700;border:none;cursor:pointer"> Convocation</button>'+'<button onclick="openPresences(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:#D4AF37;font-size:10px;font-weight:700;border:none;cursor:pointer">✓ Presences</button>'):'')+
          '<div id="match-actions-'+e.id+'" style="margin-top:8px"></div>'+
        '</div>';
      content.appendChild(card);

      window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
        var pres=0,abs=0;
        snap.forEach(function(d2){var c=d2.data();if(c.eventId===e.id){if(c.status==="present")pres++;else if(c.status==="absent")abs++;}});
        var countsEl=document.getElementById("match-counts-"+e.id);
        if(countsEl){
          countsEl.innerHTML='<span style="min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#D4AF37;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">'+pres+'</span>'+
            '<span style="min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#C0392B;color:#fff;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center">'+abs+'</span>';
        }
      });

      var linkedPlayer=getLinkedPlayerForCheckin();
      var actionsEl=document.getElementById("match-actions-"+e.id);
      if(linkedPlayer&&actionsEl){
        var eq=(e.equipe||"").toUpperCase();
        if(eventMatchesPlayer(e,linkedPlayer)){
          checkExistingCheckin(e.id,linkedPlayer.id).then(function(existing){
            if(existing&&(existing.status==="present"||existing.status==="absent")){
              actionsEl.innerHTML=checkinBadgeHtml(linkedPlayer.id,e.id,existing.status);
            } else {
              actionsEl.innerHTML=checkinButtonsHtml(linkedPlayer.id,e.id);
            }
          });
        }
      }
    });
  });
}

function shiftCalWeek(dir){
  calWeekOffset+=dir;
  buildCalendrier();
}

function getMonday(d){
  var day=d.getDay();
  var diff=day===0?-6:1-day;
  var monday=new Date(d);
  monday.setDate(d.getDate()+diff);
  monday.setHours(0,0,0,0);
  return monday;
}

var calFilterMode="mine";

function toggleCalEventExpand(eventId){
  var slot=document.getElementById("cal-checkin-"+eventId);
  var chevron=document.getElementById("cal-chevron-"+eventId);
  if(!slot)return;
  var isOpen=slot.style.display==="block";
  slot.style.display=isOpen?"none":"block";
  if(chevron)chevron.textContent=isOpen?"›":"⌄";
}

function setCalFilter(mode){
  calFilterMode=mode;
  document.getElementById("cal-filter-mine").classList.toggle("on",mode==="mine");
  document.getElementById("cal-filter-all").classList.toggle("on",mode==="all");
  buildCalendrier();
}

function buildCalendrier(){
  var base=new Date();
  base.setDate(base.getDate()+calWeekOffset*7);
  var monday=getMonday(base);
  var days=[];
  for(var i=0;i<7;i++){
    var d=new Date(monday);
    d.setDate(monday.getDate()+i);
    days.push(d);
  }
  var sunday=days[6];
  var labelFmt=function(d){return d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});};
  document.getElementById("cal-week-label").textContent=labelFmt(monday)+" - "+labelFmt(sunday)+" "+sunday.getFullYear();

  var filterRow=document.getElementById("cal-filter-row");
  var isCoach=localStorage.getItem("asmb_profile")==="coach";
  var coachTeamId=isCoach?getCoachTeam():null;
  var coachTeamObj=coachTeamId?getTeams().find(function(t){return t.id===coachTeamId;}):null;
  if(filterRow)filterRow.style.display=(isCoach&&coachTeamObj)?"flex":"none";

  fetchEventsFromCloud().then(function(events){
    if(isCoach&&coachTeamObj&&calFilterMode==="mine"){
      events=events.filter(function(e){
        var eq=(e.equipe||"").toUpperCase();
        return eq.indexOf(coachTeamObj.name.toUpperCase())>=0;
      });
    }
    var content=document.getElementById("cal-week-content");
    content.innerHTML="";
    var dayNames=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"];
    var todayStr=new Date().toISOString().slice(0,10);

    days.forEach(function(d,idx){
      var dStr=d.toISOString().slice(0,10);
      var isSaturday=idx===5;
      var isToday=dStr===todayStr;
      var dayEvents=events.filter(function(e){return e.date===dStr&&!e.cancelled;});
      if(isSaturday){
        dayEvents=dayEvents.slice().sort(function(a,b){return a.type==="match"?-1:(b.type==="match"?1:0);});
      }

      var dayBlock=document.createElement("div");
      dayBlock.style.cssText="padding:10px 16px";
      var dayHeader='<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'+
        '<span style="font-size:11px;font-weight:800;color:'+(isToday?"var(--dkg)":"var(--mut)")+';text-transform:uppercase;letter-spacing:.5px">'+dayNames[idx]+' '+d.getDate()+(isSaturday?" ":"")+'</span>'+
        (isToday?'<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;background:var(--dkg);color:#fff">AUJOURD\'HUI</span>':"")+
      '</div>';

      var eventsHtml="";
      if(!dayEvents.length){
        eventsHtml='<div style="font-size:11px;color:var(--mut);padding:6px 0 6px 4px">Aucun événement</div>';
      } else {
        dayEvents.forEach(function(e){
          var isMatch=e.type==="match";
          var isCoachOrDir=["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0;
          var itinBtn=(e.type==="match"&&e.lieu)?'<a href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(e.lieu)+'" target="_blank" style="display:inline-block;margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(26,46,90,.12);color:#1A2E5A;font-size:10px;font-weight:700;text-decoration:none"> Itineraire</a>':'';
          var weatherBtn=(isMatch&&e.lieu)?'<button onclick="showWeather(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(232,103,10,.12);color:#E8670A;font-size:10px;font-weight:700;border:none;cursor:pointer"> Meteo</button>':'';
          var icsBtn=isMatch?'<button onclick="exportEventIcs(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:#D4AF37;font-size:10px;font-weight:700;border:none;cursor:pointer"> Agenda</button>':'';
          var carBtn=isMatch?'<button onclick="shareCovoiturage(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(142,68,173,.12);color:#8E44AD;font-size:10px;font-weight:700;border:none;cursor:pointer"> Covoiturage</button>':'';
          var coachBtns=(isCoachOrDir&&isMatch)?
            ('<button onclick="showConvocation(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(26,46,90,.12);color:#1A2E5A;font-size:10px;font-weight:700;border:none;cursor:pointer"> Convocation</button>'+
            '<button onclick="openPresences(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:#D4AF37;font-size:10px;font-weight:700;border:none;cursor:pointer">✓ Presences</button>')
            :((isCoachOrDir&&e.type==="entrainement")?('<button onclick="openPresences(\''+e.id+'\')" style="margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:#D4AF37;font-size:10px;font-weight:700;border:none;cursor:pointer">✓ Presences</button>'):'');
          eventsHtml+='<div style="background:var(--card);border:1px solid var(--bdr);border-left:3px solid '+eventTypeColor(e.type)+';border-radius:var(--rs);padding:9px 12px;margin-bottom:6px">'+
            '<div style="display:flex;align-items:center;gap:10px"><div style="flex:1;min-width:0">'+
            '<span style="display:inline-block;font-size:9px;font-weight:800;padding:2px 8px;border-radius:10px;color:#fff;background:'+eventTypeColor(e.type)+';text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px">'+eventTypeLabel(e.type)+'</span>'+
            '<div style="font-size:12px;font-weight:700;color:var(--txt)">'+e.titre+'</div><div style="font-size:10px;color:var(--mut);margin-top:1px">'+(e.heure||"")+(e.lieu?" · "+e.lieu:"")+'</div></div>'+(isMatch?'<div id="cal-counts-'+e.id+'" style="display:flex;gap:6px"></div>':"")+'</div>'+
            '<div style="display:flex;flex-wrap:wrap">'+itinBtn+weatherBtn+icsBtn+carBtn+coachBtns+'</div>'+
            (isMatch?'<div id="cal-absences-'+e.id+'"></div><div id="cal-checkin-'+e.id+'" style="margin-top:8px"></div>':"")+
          '</div>';
        });
      }

      dayBlock.innerHTML=dayHeader+eventsHtml;
      content.appendChild(dayBlock);
    });

    // Compteurs Present/Absent + liste des absents, visible par tous
    events.forEach(function(e){
      var absEl=document.getElementById("cal-absences-"+e.id);
      var countsEl=document.getElementById("cal-counts-"+e.id);
      if(!absEl&&!countsEl)return;
      window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
        var notable=[];
        var pres=0,abs=0;
        snap.forEach(function(d){
          var c=d.data();
          if(c.eventId!==e.id)return;
          if(c.status==="present")pres++;
          else if(c.status==="absent"){abs++;notable.push(c);}
        });
        if(countsEl){
          countsEl.innerHTML='<span style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#D4AF37;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center">'+pres+'</span>'+
            '<span style="min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#C0392B;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center">'+abs+'</span>';
        }
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
    });

    // Action de pointage pour le joueur/parent lie (affichee au clic sur la carte)
    var linkedPlayer=getLinkedPlayerForCheckin();
    if(linkedPlayer){
      events.forEach(function(e){
        var slot=document.getElementById("cal-checkin-"+e.id);
        if(!slot)return;
        var eq=(e.equipe||"").toUpperCase();
        var matches=eventMatchesPlayer(e,linkedPlayer);
        if(!matches)return;

        if(e.type==="match"){
          checkExistingCheckin(e.id,linkedPlayer.id).then(function(existing){
            if(existing&&(existing.status==="present"||existing.status==="absent")){
              slot.innerHTML=checkinBadgeHtml(linkedPlayer.id,e.id,existing.status);
            } else {
              slot.innerHTML=checkinButtonsHtml(linkedPlayer.id,e.id);
            }
          });
        } else {
          slot.innerHTML='<div style="margin-top:8px"><button onclick="signalerAbsence(\''+e.id+'\')" style="width:100%;padding:9px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:#C0392B;font-size:11px;font-weight:700;border:none;cursor:pointer"> Signaler une absence</button></div>';
        }
      });
    }
  });
}

var classementActiveTeamId=null;

function openClassement(){
  openCalendrier();
  switchCalTab("classement");
}

function getClassement(){
  try{return JSON.parse(localStorage.getItem("asmb_classement")||"{}");}catch(e){return {};}
}
function saveClassement(data){
  localStorage.setItem("asmb_classement",JSON.stringify(data));
  if(window.fbReady){
    window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","classement"),{data:JSON.stringify(data)},{merge:true}).catch(function(){});
  }
}
function fetchClassementFromCloud(){
  if(!window.fbReady)return Promise.resolve(getClassement());
  return window.fbGetDocs(window.fbCollection(window.fbDb,"app_data")).then(function(snap){
    var found=null;
    snap.forEach(function(d){if(d.id==="classement")found=d.data();});
    if(found&&found.data){try{return JSON.parse(found.data);}catch(e){return getClassement();}}
    return getClassement();
  }).catch(function(){return getClassement();});
}

var classementActivePhase="phase1";
var PHASES=[{id:"phase1",label:"Phase 1"},{id:"phase2",label:"Phase 2"},{id:"phase3",label:"Phase 3 / Finales"}];

function buildClassement(){
  var isCoachOrDir=["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0;
  var teams=getTeams();
  var selEl=document.getElementById("classement-team-select");
  if(!classementActiveTeamId&&teams.length)classementActiveTeamId=teams[0].id;
  selEl.innerHTML="";
  teams.forEach(function(t){
    var on=t.id===classementActiveTeamId;
    var btn=document.createElement("button");
    btn.textContent=t.name;
    btn.style.cssText="flex-shrink:0;padding:7px 13px;border-radius:20px;font-size:12px;font-weight:600;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--mut)")+";cursor:pointer";
    btn.onclick=function(){classementActiveTeamId=t.id;buildClassement();};
    selEl.appendChild(btn);
  });
  document.getElementById("classement-add-btn").style.display=isCoachOrDir?"block":"none";

  var phaseEl=document.getElementById("classement-phase-select");
  if(phaseEl){
    phaseEl.innerHTML="";
    PHASES.forEach(function(ph){
      var on=ph.id===classementActivePhase;
      var b=document.createElement("button");
      b.textContent=ph.label;
      b.className="cat-filter"+(on?" on":"");
      b.style.cssText="flex-shrink:0";
      b.onclick=function(){classementActivePhase=ph.id;buildClassement();};
      phaseEl.appendChild(b);
    });
  }

  fetchClassementFromCloud().then(function(all){
    var teamData=(classementActiveTeamId&&all[classementActiveTeamId])||{};
    var rows=teamData[classementActivePhase]||[];
    rows=rows.slice().sort(function(a,b){return (a.rang||99)-(b.rang||99);});
    var el=document.getElementById("classement-content");
    if(!rows.length){
      el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Classement non renseigne</div>'+(isCoachOrDir?'<div style="font-size:11px;margin-top:6px">Touchez + Ligne pour ajouter les equipes de la poule</div>':'')+'</div>';
      return;
    }
    var html='<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:11px">'+
      '<tr style="color:var(--mut);text-transform:uppercase;border-bottom:2px solid var(--bdr)">'+
        '<td style="padding:8px 4px;font-weight:700">Pos</td>'+
        '<td style="font-weight:700">Equipe</td>'+
        '<td style="text-align:center;font-weight:700">Pts</td>'+
        '<td style="text-align:center;font-weight:700">J</td>'+
        '<td style="text-align:center;font-weight:700">G</td>'+
        '<td style="text-align:center;font-weight:700">P</td>'+
        '<td style="text-align:center;font-weight:700">Pm</td>'+
        '<td style="text-align:center;font-weight:700">Pe</td>'+
        (isCoachOrDir?'<td></td>':'')+
      '</tr>';
    rows.forEach(function(r){
      var isUs=r.equipe&&r.equipe.toUpperCase().indexOf("ASMB")>=0;
      html+='<tr style="border-bottom:1px solid var(--bdr);'+(isUs?"background:rgba(27,92,40,.08)":"")+'">'+
        '<td style="padding:8px 4px;font-size:12px;font-weight:800;color:var(--txt)">'+r.rang+'</td>'+
        '<td style="font-size:12px;font-weight:'+(isUs?"700":"400")+';color:var(--txt);white-space:nowrap">'+r.equipe+'</td>'+
        '<td style="text-align:center;font-size:12px;font-weight:800;color:var(--txt)">'+(r.points||0)+'</td>'+
        '<td style="text-align:center;color:var(--mut)">'+(r.joues||0)+'</td>'+
        '<td style="text-align:center;color:#D4AF37;font-weight:700">'+(r.victoires||0)+'</td>'+
        '<td style="text-align:center;color:#C0392B;font-weight:700">'+(r.defaites||0)+'</td>'+
        '<td style="text-align:center;color:var(--mut)">'+(r.pointsMarques||0)+'</td>'+
        '<td style="text-align:center;color:var(--mut)">'+(r.pointsEncaisses||0)+'</td>'+
        (isCoachOrDir?'<td><button onclick="deleteClassementRow(\''+r.id+'\')" style="padding:4px 8px;border-radius:12px;background:rgba(192,57,43,.1);color:#C0392B;font-size:10px;border:none;cursor:pointer">✕</button></td>':'')+
      '</tr>';
    });
    html+='</table></div>';
    el.innerHTML=html;
  });
}

async function showAddClassementRow(){
  if(!classementActiveTeamId){alert("Créez d\'abord une équipe");return;}
  var equipe=await askPrompt("Nom de l'équipe", {placeholder:"Mettre ASMB dans le nom pour votre équipe", confirmText:"Suivant"});
  if(!equipe)return;
  var rang=parseInt((await askPrompt("Position dans la poule", {defaultValue:"1", type:"number", confirmText:"Suivant"}))||"1",10);
  var points=parseInt((await askPrompt("Points", {defaultValue:"0", type:"number", confirmText:"Suivant"}))||"0",10);
  var joues=parseInt((await askPrompt("Matchs joués (J)", {defaultValue:"0", type:"number", confirmText:"Suivant"}))||"0",10);
  var victoires=parseInt((await askPrompt("Gagnés (G)", {defaultValue:"0", type:"number", confirmText:"Suivant"}))||"0",10);
  var defaites=parseInt((await askPrompt("Perdus (P)", {defaultValue:"0", type:"number", confirmText:"Suivant"}))||"0",10);
  var pointsMarques=parseInt((await askPrompt("Points marqués (Pm)", {defaultValue:"0", type:"number", confirmText:"Suivant"}))||"0",10);
  var pointsEncaisses=parseInt((await askPrompt("Points encaissés (Pe)", {defaultValue:"0", type:"number", confirmText:"Ajouter"}))||"0",10);
  var all=getClassement();
  if(!all[classementActiveTeamId])all[classementActiveTeamId]={};
  if(!all[classementActiveTeamId][classementActivePhase])all[classementActiveTeamId][classementActivePhase]=[];
  all[classementActiveTeamId][classementActivePhase].push({id:Date.now().toString(),equipe:equipe,rang:rang,points:points,joues:joues,victoires:victoires,defaites:defaites,pointsMarques:pointsMarques,pointsEncaisses:pointsEncaisses});
  saveClassement(all);
  buildClassement();
}

function deleteClassementRow(rowId){
  askConfirm("Supprimer cette ligne ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var all=getClassement();
    if(all[classementActiveTeamId]&&all[classementActiveTeamId][classementActivePhase]){
      all[classementActiveTeamId][classementActivePhase]=all[classementActiveTeamId][classementActivePhase].filter(function(r){return r.id!==rowId;});
    }
    saveClassement(all);
    buildClassement();
  });
}

function openAnnuaire(){
  var addBtn=document.getElementById("annuaire-add-btn");
  if(addBtn)addBtn.style.display=window.asmbCoachMode?"block":"none";
  stack.push("annuaire");
  showScr("annuaire");
  buildAnnuaire();
}

var annuaireFilter="tous";
function setAnnuaireFilter(f){
  annuaireFilter=f;
  var tTous=document.getElementById("annuaire-tab-tous"), tBen=document.getElementById("annuaire-tab-benevoles");
  if(tTous)tTous.classList.toggle("on",f==="tous");
  if(tBen)tBen.classList.toggle("on",f==="benevole");
  buildAnnuaire();
}
function buildAnnuaire(){
  var el=document.getElementById("annuaire-list");if(!el)return;
  var contacts=getAnnuaire();
  if(annuaireFilter==="benevole"){ contacts=contacts.filter(function(c){return c.type==="benevole";}); }
  var searchEl=document.getElementById("annuaire-search");
  var q=searchEl?searchEl.value.trim().toLowerCase():"";
  if(q){contacts=contacts.filter(function(c){return (c.nom||"").toLowerCase().indexOf(q)>=0||(c.role||"").toLowerCase().indexOf(q)>=0;});}
  if(!contacts.length){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">'+(q?"Aucun résultat":(annuaireFilter==="benevole"?"Aucun bénévole pour le moment":"Aucun contact pour le moment"))+'</div>'+(!q&&window.asmbCoachMode?'<div style="font-size:11px;margin-top:4px">Appuyez sur + Contact</div>':"")+'</div>';
    return;
  }
  el.innerHTML="";
  contacts.forEach(function(c){
    var initials=(c.nom||"?")[0].toUpperCase();
    var div=document.createElement("div");
    div.className="player-card";
    var delBtn=window.asmbCoachMode?('<button onclick="deleteContact(\''+c.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer;flex-shrink:0">✕</button>'):"";
    var telLink=c.tel?('<a href="tel:'+c.tel+'" style="font-size:11px;color:var(--ltg);text-decoration:none">'+c.tel+'</a>'):"";
    var benBadge=c.type==="benevole"?'<span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;background:rgba(232,103,10,.12);color:#E8670A;font-size:9px;font-weight:800;text-transform:uppercase">Bénévole</span>':"";
    var dispoLine=(c.type==="benevole"&&c.dispo)?('<div style="font-size:11px;color:var(--mut);margin-top:2px">'+c.dispo+'</div>'):"";
    div.innerHTML='<div class="player-avatar" style="background:var(--dkg)">'+initials+'</div><div class="player-info"><div class="player-name">'+c.nom+benBadge+'</div><div class="player-meta">'+(c.role||"")+'</div>'+(telLink?'<div style="margin-top:3px">'+telLink+'</div>':"")+dispoLine+'</div>'+delBtn;
    el.appendChild(div);
  });
}

function showAddContact(){
  document.getElementById("ct-nom").value="";
  document.getElementById("ct-role").value="";
  document.getElementById("ct-tel").value="";
  document.getElementById("ct-email").value="";
  document.getElementById("ct-benevole").checked=false;
  document.getElementById("ct-dispo").value="";
  document.getElementById("ct-dispo-wrap").style.display="none";
  document.getElementById("modal-contact").style.display="flex";
}

function saveContact(){
  var nom=document.getElementById("ct-nom").value.trim();
  if(!nom){alert("Nom obligatoire");return;}
  var isBenevole=document.getElementById("ct-benevole").checked;
  var contacts=getAnnuaire();
  contacts.push({
    id:Date.now().toString(),nom:nom,
    role:document.getElementById("ct-role").value.trim(),
    tel:document.getElementById("ct-tel").value.trim(),
    email:document.getElementById("ct-email").value.trim(),
    type:isBenevole?"benevole":"contact",
    dispo:isBenevole?document.getElementById("ct-dispo").value.trim():""
  });
  saveAnnuaireList(contacts);
  closeModal("modal-contact");
  buildAnnuaire();
}

function deleteContact(id){
  askConfirm("Supprimer ce contact ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var contacts=getAnnuaire().filter(function(c){return c.id!==id;});
    saveAnnuaireList(contacts);
    buildAnnuaire();
  });
}

// ── GALERIE PHOTOS ────────────────────────────────────────────────
var currentPhotoId=null;

function openGalerie(){
  var addBtn=document.getElementById("galerie-add-btn");
  if(addBtn)addBtn.style.display=window.asmbCoachMode?"block":"none";
  stack.push("galerie");
  showScr("galerie");
  buildGalerie();
}

function buildGalerie(){
  var el=document.getElementById("galerie-grid");if(!el)return;
  if(!window.fbReady){
    el.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:30px;font-size:12px;color:var(--mut)">Chargement...</div>';
    window.addEventListener("fb-ready",function(){buildGalerie();},{once:true});
    return;
  }
  var q=window.fbQuery(window.fbCollection(window.fbDb,"gallery"),window.fbOrderBy("ts"));
  window.fbOnSnapshot(q,function(snap){
    el.innerHTML="";
    if(!snap.size){el.innerHTML='<div style="grid-column:1/-1" class="empty-state"><div style="font-size:13px;font-weight:600">Aucune photo</div></div>';return;}
    var photos=[];
    snap.forEach(function(d){var p=d.data();if(p.deleted)return;p.id=d.id;photos.push(p);});
    if(!photos.length){el.innerHTML='<div style="grid-column:1/-1" class="empty-state"><div style="font-size:13px;font-weight:600">Aucune photo</div></div>';return;}
    photos.reverse().forEach(function(p){
      var div=document.createElement("div");
      div.style.cssText="aspect-ratio:1;border-radius:var(--rx);overflow:hidden;cursor:pointer;background:var(--card)";
      div.innerHTML='<img src="'+p.url+'" style="width:100%;height:100%;object-fit:cover" loading="lazy">';
      div.onclick=function(){viewPhoto(p);};
      el.appendChild(div);
    });
  });
}

function compressImageFile(file,maxWidth,quality){
  return new Promise(function(resolve,reject){
    var img=new Image();
    var reader=new FileReader();
    reader.onload=function(e){
      img.onload=function(){
        var w=img.width,h=img.height;
        if(w>maxWidth){h=Math.round(h*(maxWidth/w));w=maxWidth;}
        var canvas=document.createElement("canvas");
        canvas.width=w;canvas.height=h;
        var ctx=canvas.getContext("2d");
        ctx.drawImage(img,0,0,w,h);
        var dataUrl=canvas.toDataURL("image/jpeg",quality);
        resolve(dataUrl);
      };
      img.onerror=function(){reject(new Error("Image invalide"));};
      img.src=e.target.result;
    };
    reader.onerror=function(){reject(new Error("Lecture fichier echouee"));};
    reader.readAsDataURL(file);
  });
}

function uploadGalleryPhoto(input){
  if(!input.files||!input.files[0])return;
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  var file=input.files[0];
  var addBtn=document.getElementById("galerie-add-btn");
  if(addBtn){addBtn.textContent="Compression...";addBtn.disabled=true;}
  compressImageFile(file,1000,0.6).then(function(dataUrl){
    if(dataUrl.length>900000){
      return compressImageFile(file,700,0.45);
    }
    return dataUrl;
  }).then(function(dataUrl){
    if(addBtn)addBtn.textContent="Envoi...";
    return window.fbAddDoc(window.fbCollection(window.fbDb,"gallery"),{
      url:dataUrl,caption:"",uploadedBy:savedPseudo||"ASMB",ts:window.fbServerTimestamp()
    });
  }).then(function(){
    input.value="";
    if(addBtn){addBtn.textContent="+ Photo";addBtn.disabled=false;}
  }).catch(function(err){
    if(addBtn){addBtn.textContent="+ Photo";addBtn.disabled=false;}
    alert("Erreur lors de l'envoi de la photo. Réessayez avec une image plus petite.");
    console.error(err);
  });
}

function viewPhoto(p){
  currentPhotoId=p.id;
  document.getElementById("photo-view-img").src=p.url;
  document.getElementById("photo-view-caption").textContent=p.caption||"";
  var delBtn=document.getElementById("photo-delete-btn");
  delBtn.style.display=window.asmbCoachMode?"block":"none";
  document.getElementById("modal-photo-view").style.display="flex";
}

function viewChatMedia(url){
  currentPhotoId=null;
  document.getElementById("photo-view-img").src=url;
  document.getElementById("photo-view-caption").textContent="";
  document.getElementById("photo-delete-btn").style.display="none";
  document.getElementById("modal-photo-view").style.display="flex";
}

function deleteGalleryPhoto(){
  if(!currentPhotoId||!window.fbReady)return;
  askConfirm("Supprimer cette photo ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    window.fbSetDoc(window.fbDoc(window.fbDb,"gallery",currentPhotoId),{deleted:true},{merge:true});
    closeModal("modal-photo-view");
  });
}

function collectAllData(){
  return {
    players:getPlayers(),teams:getTeams(),events:getEvents(),docs:getDocs(),
    licences:getLicences(),annuaire:getAnnuaire(),
    pole_elite:getPoleData("elite"),pole_competition:getPoleData("competition"),
    pole_3x3:getPoleData("3x3"),pole_evenement:getPoleData("evenement"),pole_basketpourtous:getPoleData("basketpourtous")
  };
}

function exportData(){
  var data=collectAllData();
  var blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download="asmb-export-"+new Date().toISOString().slice(0,10)+".json";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── SAUVEGARDE AUTOMATIQUE CLOUD ─────────────────────────────────
function backupToCloud(){
  if(!window.fbReady||!window.asmbCoachMode)return;
  var data=collectAllData();
  window.fbSetDoc(window.fbDoc(window.fbDb,"backups","latest"),{
    data:JSON.stringify(data),ts:window.fbServerTimestamp()
  },{merge:true}).catch(function(){});
}

function restoreFromCloud(){
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  askConfirm("Ceci va remplacer toutes vos données locales par la dernière sauvegarde cloud.", {title:"Restaurer la sauvegarde ?", confirmText:"Restaurer"}).then(function(ok){
    if(!ok)return;
    window.fbGetDocs(window.fbCollection(window.fbDb,"backups")).then(function(snap){
      var found=null;
      snap.forEach(function(d){if(d.id==="latest")found=d.data();});
      if(!found||!found.data){alert("Aucune sauvegarde cloud disponible");return;}
      var data=JSON.parse(found.data);
      localStorage.setItem("asmb_players",JSON.stringify(data.players||[]));
      localStorage.setItem("asmb_teams",JSON.stringify(data.teams||[]));
      localStorage.setItem("asmb_events",JSON.stringify(data.events||[]));
      localStorage.setItem("asmb_docs",JSON.stringify(data.docs||[]));
      localStorage.setItem("asmb_licences",JSON.stringify(data.licences||[]));
      localStorage.setItem("asmb_annuaire",JSON.stringify(data.annuaire||[]));
      ["elite","competition","3x3","evenement","basketpourtous"].forEach(function(id){
        localStorage.setItem("asmb_pole_"+id,JSON.stringify(data["pole_"+id]||[]));
      });
      askAlert("Données restaurées depuis le cloud ! L'application va se recharger.").then(function(){location.reload();});
    }).catch(function(){alert("Erreur lors de la restauration");});
  });
}

async function resetAllData(){
  var counts="";
  if(window.fbDb && window.fbGetDocs){
    try{
      var p=await window.fbGetDocs(window.fbCollection(window.fbDb,"players"));
      var t=await window.fbGetDocs(window.fbCollection(window.fbDb,"teams"));
      var e=await window.fbGetDocs(window.fbCollection(window.fbDb,"events"));
      var l=await window.fbGetDocs(window.fbCollection(window.fbDb,"licences"));
      var ch=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels"));
      counts="Actuellement dans le cloud : "+p.size+" joueur(s), "+t.size+" équipe(s), "+e.size+" événement(s), "+l.size+" licence(s), "+ch.size+" canal/canaux de discussion.\n\n";
    }catch(err){}
  }
  var ok=await askConfirm(counts+"Ceci va supprimer TOUTES ces données du club (y compris les canaux de discussion et leurs messages), dans le cloud partagé, pour tout le monde. Vos préférences personnelles (thème, numéro, notifications) sont conservées. Action définitive et IRREVERSIBLE.", {title:"Attention — action destructive", confirmText:"Continuer", danger:true});
  if(!ok)return;
  var typed=await askPrompt("Pour confirmer la suppression définitive, taper SUPPRIMER en majuscules", {placeholder:"SUPPRIMER", confirmText:"Vérifier"});
  if(typed!=="SUPPRIMER"){ if(typed!==null) alert("Texte incorrect, rien n'a été supprimé."); return; }

  ["asmb_players","asmb_teams","asmb_events","asmb_docs","asmb_licences","asmb_evaluations","asmb_done"].forEach(function(k){localStorage.removeItem(k);});
  Object.keys(localStorage).filter(function(k){return k.startsWith("asmb_pole_")||k.startsWith("asmb_lastread_");}).forEach(function(k){localStorage.removeItem(k);});

  if(window.fbDb && window.fbGetDocs && window.fbDeleteDoc){
    // Canaux : purger d'abord les messages (sous-collection) de chaque canal, puis le canal lui-meme
    try{
      var chansSnap=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels"));
      for(const chanDoc of chansSnap.docs){
        var msgsSnap=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels",chanDoc.id,"messages"));
        var msgDels=[];
        msgsSnap.forEach(function(m){ msgDels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",chanDoc.id,"messages",m.id))); });
        await Promise.all(msgDels);
        await window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",chanDoc.id));
      }
    }catch(e){ console.log("reset channels:", e); }

    var collections=["players","teams","events","licences","evaluations","phone_index","inscription_codes","inscription_submissions"];
    for(var i=0;i<collections.length;i++){
      try{
        var snap=await window.fbGetDocs(window.fbCollection(window.fbDb,collections[i]));
        var dels=[];
        snap.forEach(function(d){ dels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,collections[i],d.id))); });
        await Promise.all(dels);
      }catch(e){ console.log("reset "+collections[i]+":", e); }
    }
  }

  await askAlert("Données du club supprimées (localement et dans le cloud). L'application va se recharger.");
  location.reload();
}

async function resetComptabilite(){
  if(!isStaffUser() || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){alert("Réservé au dirigeant.");return;}
  var count=getComptabilite().length;
  var ok=await askConfirm("Ceci va supprimer les "+count+" ligne(s) de comptabilité (recettes et dépenses), dans le cloud partagé. Action définitive et IRREVERSIBLE.", {title:"Attention — action destructive", confirmText:"Continuer", danger:true});
  if(!ok)return;
  var typed=await askPrompt("Pour confirmer, taper SUPPRIMER en majuscules", {placeholder:"SUPPRIMER", confirmText:"Vérifier"});
  if(typed!=="SUPPRIMER"){ if(typed!==null) alert("Texte incorrect, rien n'a été supprimé."); return; }

  localStorage.removeItem("asmb_comptabilite");
  if(window.fbDb && window.fbGetDocs && window.fbDeleteDoc){
    try{
      var snap=await window.fbGetDocs(window.fbCollection(window.fbDb,"comptabilite"));
      var dels=[];
      snap.forEach(function(d){ dels.push(window.fbDeleteDoc(window.fbDoc(window.fbDb,"comptabilite",d.id))); });
      await Promise.all(dels);
    }catch(e){ console.log("reset comptabilite:", e); }
  }
  await askAlert("Comptabilité réinitialisée.");
  buildParametres();
  if(document.getElementById("compta-list")) buildComptabilite();
}

// ── DONNEES DE DEMO ───────────────────────────────────────────────
function loadDemoData(){
  askConfirm("Charger 4 équipes et 40 joueurs de démonstration pour tester l'app ?", {title:"Données de démonstration", confirmText:"Charger"}).then(function(ok){
    if(!ok)return;
    loadDemoDataConfirmed();
  });
}
function loadDemoDataConfirmed(){

  var teamDefs=[
    {id:"demo-team-u13f",name:"U13 Filles ASMB (Demo)",cat:"U13"},
    {id:"demo-team-u13g",name:"U13 Garcons ASMB (Demo)",cat:"U13"},
    {id:"demo-team-seniorf",name:"Seniors Filles ASMB (Demo)",cat:"Senior"},
    {id:"demo-team-seniorm",name:"Seniors Garcons ASMB (Demo)",cat:"Senior"}
  ];

  var prenomsF=["Lea","Chloe","Emma","Sarah","Manon","Julie","Camille","Ines","Anais","Clara"];
  var prenomsM=["Nathan","Enzo","Rayan","Mathis","Lucas","Adam","Karim","Thomas","Yanis","Hugo"];
  var noms=["Martin","Bernard","Dubois","Petit","Girard","Fontaine","Lefevre","Robin","Faure","Blanc"];
  var postes=["Meneur","Arriere","Ailier","Ailier Fort","Pivot"];

  var players=getPlayers();
  var teams=getTeams();

  teamDefs.forEach(function(td,ti){
    if(!teams.find(function(t){return t.id===td.id;})){
      teams.push({id:td.id,name:td.name,cat:td.cat,coach:"Demo Coach",notes:"",demo:true,members:[]});
    }
    var team=teams.find(function(t){return t.id===td.id;});
    var genre=(ti%2===0)?"F":"M";
    var prenoms=(genre==="F")?prenomsF:prenomsM;
    var memberIds=[];
    for(var i=0;i<10;i++){
      var pid="demo-player-t"+ti+"-"+i;
      memberIds.push(pid);
      if(!players.find(function(p){return p.id===pid;})){
        var telEnfantDemo="06"+String(ti).padStart(2,"0")+String(i).padStart(2,"0")+"0000";
        players.push({
          id:pid,prenom:prenoms[i],nom:noms[i],naissance:(td.cat==="U13"?"2013-01-01":"1998-01-01"),
          cat:td.cat,genre:genre,poste:postes[i%postes.length],maillot:String(i+1),
          licence:"ok",typeLicence:"competition",numLicence:"0C",
          contact:"06 00 00 00 00",telEnfant:telEnfantDemo,notes:"",demo:true
        });
      }
    }
    team.members=memberIds;
    ensureTeamChannel(team);
  });

  saveTeams(teams);
  savePlayers(players);

  // Fiche licence demo pour tester le lien Parent (via son propre numero, different de l'enfant)
  // Upsert : toujours remise a jour (ne pas se fier a une ancienne version incomplete)
  var lics=getLicences().filter(function(l){return l.code!=="DEMO01";});
  lics.push({
    code:"DEMO01",email:"parent.demo@test.fr",nomDest:"Parent de Lea",
    statut:"validee",createdAt:Date.now(),ouvertLe:new Date().toLocaleDateString("fr-FR"),
    categorie:"U13",
    fiche:{
      prenom:"Lea",nom:"Martin",naissance:"2013-01-01",
      telephone:"",respTel:"0700000000",resp2Tel:"",
      adresse:"",emailLic:"parent.demo@test.fr",respNom:"Parent Demo",
      urgenceNom:"",urgenceTel:"",notes:"Fiche demo"
    }
  });
  saveLicences(lics);

  alert("Données de demo chargées ! 4 équipes de 10 joueurs chacune.\n\nPour tester :\n- \"Je suis Joueur\" (Lea Martin) : 0600000000\n- \"Je suis Parent\" (parent de Lea) : 0700000000");
  buildAdminHome();
}

function loadDemoEvents(){
  askConfirm("Ajouter des entraînements fictifs pour la semaine prochaine (+ un match samedi) ?", {title:"Données de démonstration", confirmText:"Ajouter"}).then(function(ok){
    if(!ok)return;
    loadDemoEventsConfirmed();
  });
}
function loadDemoEventsConfirmed(){
  var teams=getTeams();
  var demoTeams=teams.filter(function(t){return t.demo;});
  if(!demoTeams.length){
    alert("Chargez d'abord les equipes de demo (bouton juste au-dessus).");
    return;
  }

  var today=new Date();
  var nextMonday=getMonday(today);
  nextMonday.setDate(nextMonday.getDate()+7);

  var events=getEvents();
  var scheduleByDay=[0,1,2,3]; // lundi, mardi, mercredi, jeudi ->entraînements
 var heures=["18h00 - 19h30","18h30 - 20h00","17h30 - 19h00","19h00 - 20h30"];

 demoTeams.forEach(function(team,ti){
 var dayIdx=scheduleByDay[ti%scheduleByDay.length];
 var d=new Date(nextMonday);
 d.setDate(nextMonday.getDate()+dayIdx);
 events.push({
 id:"demo-evt-train-"+ti+"-"+Date.now(),
 titre:"Entraînement "+team.name,
 type:"entrainement",
 date:d.toISOString().slice(0,10),
 heure:heures[ti%heures.length],
 lieu:"Gymnase Giraudet",
 equipe:team.name,
 demo:true
 });
 });

 // Match le samedi pour la 1ere équipe demo
 var saturday=new Date(nextMonday);
 saturday.setDate(nextMonday.getDate()+5);
 events.push({
 id:"demo-evt-match-"+Date.now(),
 titre:demoTeams[0].name+" vs ASVEL Villeurbanne (Demo)",
 type:"match",
 date:saturday.toISOString().slice(0,10),
 heure:"15h00",
 lieu:"Domicile",
 equipe:demoTeams[0].name,
 demo:true
 });

 saveEvents(events);
 alert("Entraînements fictifs ajoutes pour la semaine du "+nextMonday.toLocaleDateString("fr-FR")+".");
 buildAdminHome();
}

function clearDemoData(){
 askConfirm("Supprimer uniquement les données de démonstration (équipes/joueurs/événements/licences/évaluations marquées Demo) ?", {title:"Supprimer les données démo", confirmText:"Supprimer", danger:true}).then(function(ok){
   if(!ok)return;
   var teams=getTeams().filter(function(t){return !t.demo;});
   saveTeams(teams);
   var players=getPlayers().filter(function(p){return !p.demo;});
   savePlayers(players);
   var allEvents=getEvents();
   var removedEventIds=allEvents.filter(function(e){return e.demo;}).map(function(e){return e.id;});
   var events=allEvents.filter(function(e){return !e.demo;});
   saveEvents(events);
   var lics=getLicences().filter(function(l){return l.code!=="DEMO01";});
   saveLicences(lics);
   // Purge les évaluations rattachées aux événements démo supprimés
   var allEvals=getAllEvaluations();
   var evalsChanged=false;
   removedEventIds.forEach(function(evId){
     if(allEvals[evId]){ delete allEvals[evId]; evalsChanged=true; }
   });
   if(evalsChanged) saveAllEvaluations(allEvals);
   alert("Données de démo supprimées.");
   buildAdminHome();
 });
}

