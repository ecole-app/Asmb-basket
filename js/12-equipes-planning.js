/* ===== 12-equipes-planning.js — Equipes, effectifs, planning, historique de presence ===== */
// ── HISTORIQUE PRESENCE PAR JOUEUR ─────────────────────────────────
var phCurrentPlayerId=null;
var phCurrentPeriod="month";

function showPresenceHistory(playerId){
  phCurrentPlayerId=playerId;
  phCurrentPeriod="month";
  var players=getPlayers();
  var p=players.find(function(x){return x.id===playerId;});
  if(!p)return;
  document.getElementById("ph-name").textContent=p.prenom+" "+p.nom;
  document.querySelectorAll("#modal-presence-history .cat-filter").forEach(function(b){b.classList.remove("on");});
  document.getElementById("ph-period-month").classList.add("on");
  renderPresenceHistory();
  document.getElementById("modal-presence-history").style.display="flex";
}

function setPresencePeriod(period){
  phCurrentPeriod=period;
  document.querySelectorAll("#modal-presence-history .cat-filter").forEach(function(b){b.classList.remove("on");});
  document.getElementById("ph-period-"+period).classList.add("on");
  renderPresenceHistory();
}

function renderPresenceHistory(){
  var events=getEvents().filter(function(e){return e.presences&&e.presences[phCurrentPlayerId];});
  var now=new Date();
  events=events.filter(function(e){
    var d=new Date(e.date);
    if(phCurrentPeriod==="month")return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(phCurrentPeriod==="year")return d.getFullYear()===now.getFullYear();
    return true;
  });
  events.sort(function(a,b){return b.date>a.date?1:-1;});

  var total=events.length;
  var present=events.filter(function(e){return e.presences[phCurrentPlayerId]==="present";}).length;
  var pct=total?Math.round(present/total*100):0;

  var sumEl=document.getElementById("ph-summary");
  sumEl.innerHTML='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;box-shadow:0 2px 8px var(--shadow);display:flex;align-items:center;justify-content:space-around;text-align:center">'+
    '<div><div style="font-size:22px;font-weight:900;color:#27AE60">'+pct+'%</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Assiduité</div></div>'+
    '<div style="width:1px;height:36px;background:var(--bdr)"></div>'+
    '<div><div style="font-size:22px;font-weight:900;color:var(--txt)">'+present+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Présences</div></div>'+
    '<div style="width:1px;height:36px;background:var(--bdr)"></div>'+
    '<div><div style="font-size:22px;font-weight:900;color:var(--txt)">'+(total-present)+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Absences</div></div>'+
  '</div>';

  var listEl=document.getElementById("ph-detail-list");
  if(!total){listEl.innerHTML='<div class="empty-state" style="padding:20px"><div style="font-size:12px;color:var(--mut)">Aucune donnée pour cette période</div></div>';return;}
  listEl.innerHTML="";
  events.forEach(function(e){
    var isPresent=e.presences[phCurrentPlayerId]==="present";
    var div=document.createElement("div");
    div.style.cssText="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr)";
    div.innerHTML='<div style="width:26px;height:26px;border-radius:50%;background:'+(isPresent?"#27AE60":"#C0392B")+';color:#fff;font-size:11px;font-weight:900;display:flex;align-items:center;justify-content:center;flex-shrink:0">'+(isPresent?"✓":"✕")+'</div><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--txt)">'+e.titre+'</div><div style="font-size:10px;color:var(--mut)">'+e.date+' · '+eventTypeLabel(e.type)+'</div></div>';
    listEl.appendChild(div);
  });

  // Auto-declarations (historique horodate, pour litiges)
  var selfEl=document.getElementById("ph-self-declared");
  if(selfEl){
    selfEl.innerHTML='<div style="font-size:11px;color:var(--mut);padding:8px 0">Chargement des auto-declarations...</div>';
 if(window.fbReady){
 window.fbGetDocs(window.fbCollection(window.fbDb,"checkins")).then(function(snap){
 var mine=[];
 snap.forEach(function(d){
 var c=d.data();
 if(c.playerId===phCurrentPlayerId)mine.push(c);
 });
 mine.sort(function(a,b){
 var ta=a.ts&&a.ts.toDate?a.ts.toDate().getTime():0;
 var tb=b.ts&&b.ts.toDate?b.ts.toDate().getTime():0;
 return tb-ta;
 });
 if(!mine.length){selfEl.innerHTML="";return;}
 var statusLabels={present:"✓ Présent",retard:"Retard",absent:"✕ Absent"};
 var statusColors={present:"#27AE60",retard:"#E8670A",absent:"#C0392B"};
 var html='<div class="sec" style="padding-left:0;margin-top:16px">Auto-declarations (horodatees)</div>';
        mine.forEach(function(c){
          var ts=c.ts&&c.ts.toDate?c.ts.toDate():null;
          var tsStr=ts?ts.toLocaleString("fr-FR"):"?";
          html+='<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr)">'+
            '<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;color:#fff;background:'+(statusColors[c.status]||"#8E44AD")+'">'+(statusLabels[c.status]||c.status)+'</span>'+
            '<div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:600;color:var(--txt)">'+(c.eventTitre||"?")+'</div><div style="font-size:10px;color:var(--mut)">Declare le '+tsStr+'</div></div>'+
          '</div>';
        });
        selfEl.innerHTML=html;
      }).catch(function(){selfEl.innerHTML="";});
    } else {
      selfEl.innerHTML="";
    }
  }
}

function exportPlanningPDF(){
  if(typeof window.jspdf==="undefined"){alert("Chargement du generateur PDF, réessayez dans quelques secondes");return;}
  var events=getEvents().slice().sort(function(a,b){return a.date>b.date?1:-1;});
  if(!events.length){alert("Aucun événement a exporter");return;}
  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF();
  doc.setFontSize(16);doc.setTextColor(27,92,40);
  doc.text("ASMB - Planning",14,16);
  doc.setFontSize(9);doc.setTextColor(100,100,100);
  doc.text("Généré le "+new Date().toLocaleDateString("fr-FR"),14,22);

  var headers=["Date","Type","Titre","Heure","Lieu","Équipe"];
  var colX=[14,42,66,120,145,175];
  var y=32;
  doc.setFontSize(8);doc.setTextColor(255,255,255);doc.setFillColor(27,92,40);
  doc.rect(12,y-5,186,7,"F");
  headers.forEach(function(h,i){doc.text(h,colX[i],y);});
  y+=8;
  doc.setTextColor(30,30,30);
  events.forEach(function(e,idx){
    if(y>280){doc.addPage();y=20;}
    if(idx%2===0){doc.setFillColor(240,247,242);doc.rect(12,y-5,186,7,"F");}
    doc.text(e.date||"",colX[0],y);
    doc.text((e.type||"").substring(0,12),colX[1],y);
    doc.text((e.titre||"").substring(0,24),colX[2],y);
    doc.text(e.heure||"",colX[3],y);
    doc.text((e.lieu||"").substring(0,10),colX[4],y);
    doc.text((e.equipe||"").substring(0,10),colX[5],y);
    y+=7;
  });
  doc.setFontSize(8);doc.setTextColor(150,150,150);
  doc.text("Total : "+events.length+" événement(s)",14,y+6);
  doc.save("ASMB_planning_"+new Date().toISOString().slice(0,10)+".pdf");
}

function importPlayersCSV(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var reader=new FileReader();
  reader.onload=function(e){
    var text=e.target.result;
    var lines=text.split(/\r?\n/).filter(function(l){return l.trim();});
    if(lines.length<2){alert("Fichier CSV vide ou invalide");return;}
    var headers=lines[0].split(",").map(function(h){return h.trim().toLowerCase();});
    var idxNom=headers.indexOf("nom");
    var idxPrenom=headers.indexOf("prenom");
    var idxNaissance=headers.indexOf("naissance");
    var idxCat=headers.indexOf("categorie");
    var idxNumLic=headers.indexOf("numlicence");
    var idxTypeLic=headers.indexOf("typelicence");
    if(idxNom<0||idxPrenom<0){
      alert("Le fichier doit contenir au minimum les colonnes: nom,prénom (optionnel: naissance,catégorie,numlicence,typelicence)");
      return;
    }
    var players=getPlayers();
    var added=0;
    lines.slice(1).forEach(function(line){
      var cols=line.split(",").map(function(c){return c.trim();});
      var nom=cols[idxNom],prenom=cols[idxPrenom];
      if(!nom||!prenom)return;
      players.push({
        id:Date.now().toString()+Math.random().toString(36).slice(2),
        prenom:prenom,nom:nom,
        naissance:idxNaissance>=0?(cols[idxNaissance]||""):"",
        cat:idxCat>=0?(cols[idxCat]||""):"",
        poste:"---",maillot:"",
        licence:"attente",
        typeLicence:idxTypeLic>=0&&cols[idxTypeLic]?cols[idxTypeLic]:"competition",
        numLicence:idxNumLic>=0&&cols[idxNumLic]?cols[idxNumLic]:"0C",
        contact:"",notes:""
      });
      added++;
    });
    savePlayers(players);
    renderPlayers();
    buildAdminHome();
    input.value="";
    alert(added+" joueur(s) importe(s) depuis le CSV !");
  };
  reader.readAsText(file);
}

function exportPlayersPDF(){
  if(typeof window.jspdf==="undefined"){alert("Chargement du generateur PDF, réessayez dans quelques secondes");return;}
  var players=currentCatFilter==="all"?getPlayers():getPlayers().filter(function(p){return p.cat===currentCatFilter;});
  if(!players.length){alert("Aucun joueur a exporter");return;}
  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF();
  doc.setFontSize(16);
  doc.setTextColor(27,92,40);
  doc.text("ASMB - Liste des licenciés",14,16);
  doc.setFontSize(9);
  doc.setTextColor(100,100,100);
  doc.text("Saint-Étienne Métropole Basket - Généré le "+new Date().toLocaleDateString("fr-FR"),14,22);
  if(currentCatFilter!=="all"){doc.text("Catégorie : "+currentCatFilter,14,27);}

  var headers=["Nom","Prénom","Catégorie","Type licence","N° licence","Statut"];
  var colX=[14,50,86,112,150,178];
  var y=currentCatFilter!=="all"?35:32;
  doc.setFontSize(9);
  doc.setTextColor(255,255,255);
  doc.setFillColor(27,92,40);
  doc.rect(12,y-5,186,7,"F");
  headers.forEach(function(h,i){doc.text(h,colX[i],y);});
  y+=8;
  doc.setTextColor(30,30,30);
  players.forEach(function(p,idx){
    if(y>280){doc.addPage();y=20;}
    if(idx%2===0){doc.setFillColor(240,247,242);doc.rect(12,y-5,186,7,"F");}
    var typeLic=p.typeLicence==="competition"?"Compétition":"Loisir";
    var numLic=p.numLicence||"0C";
    var statut=p.licence==="ok"?"Licencie":(p.licence==="attente"?"En attente":"Sans licence");
    doc.text((p.nom||"").substring(0,18),colX[0],y);
    doc.text((p.prenom||"").substring(0,18),colX[1],y);
    doc.text(p.cat||"",colX[2],y);
    doc.text(typeLic,colX[3],y);
    doc.text(numLic,colX[4],y);
    doc.text(statut,colX[5],y);
    y+=7;
  });
  doc.setFontSize(8);
  doc.setTextColor(150,150,150);
  doc.text("Total : "+players.length+" licencie(s)",14,y+6);

  doc.save("ASMB_licencies_"+(currentCatFilter!=="all"?currentCatFilter+"_":"")+new Date().toISOString().slice(0,10)+".pdf");
}

// ── TEAMS ────────────────────────────────────────────────────────
function getTeams(){try{return JSON.parse(localStorage.getItem("asmb_teams")||"[]");}catch(e){return [];}}

function getPlayersForTeam(team){
  if(team.members&&team.members.length)return getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;});
  var players=getPlayers().filter(function(p){return p.cat===team.cat;});
  var nameUp=(team.name||"").toUpperCase();
  var wantsF=/FILLE|FEMININ/.test(nameUp);
  var wantsM=/GARCON|MASCULIN/.test(nameUp);
  if(wantsF)return players.filter(function(p){return p.genre==="F";});
  if(wantsM)return players.filter(function(p){return p.genre==="M";});
  return players;
}

function eventMatchesPlayer(ev,player){
  if(!ev.equipe)return false;
  var eq=ev.equipe.toUpperCase();
  var teams=getTeams().filter(function(t){return t.cat===player.cat;});
  var playerTeams=teams.filter(function(t){return getPlayersForTeam(t).some(function(p){return p.id===player.id;});});
  if(playerTeams.length)return playerTeams.some(function(t){return eq.indexOf(t.name.toUpperCase())>=0;});
  return eq.indexOf(player.cat.toUpperCase())>=0;
}

function getPlayersForEvent(ev){
  if(!ev.equipe)return getPlayers();
  var teams=getTeams();
  var equipeUp=ev.equipe.toUpperCase();
  var matchedTeams=teams.filter(function(t){return equipeUp.indexOf(t.name.toUpperCase())>=0;});
  if(matchedTeams.length){
    var all=[];
    matchedTeams.forEach(function(t){
      getPlayersForTeam(t).forEach(function(p){if(!all.some(function(q){return q.id===p.id;}))all.push(p);});
    });
    return all;
  }
  return getPlayers().filter(function(p){return p.cat&&equipeUp.indexOf(p.cat.toUpperCase())>=0;});
}
function saveTeams(t){localStorage.setItem("asmb_teams",JSON.stringify(t));fsWriteCollection("teams",t);}
function buildTeams(){
  var teams=getTeams(),players=getPlayers();
  var el=document.getElementById("teamList");if(!el)return;
  if(!teams.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucune équipe</div><div style="font-size:11px;margin-top:4px">Appuyez sur + Équipe</div></div>';return;}
  el.innerHTML="";
  teams.forEach(function(t){
    var col=CAT_COLORS[t.cat]||"#1B5C28";
    var members=players.filter(function(p){return (t.members||[]).includes(p.id);});
    var plural=members.length>1?"s":"";
    var d=document.createElement("div");d.className="team-card";

    // Header
    var hdr=document.createElement("div");hdr.className="team-hdr";
    hdr.addEventListener("click",function(){toggleTeam(t.id);});
    var hdrLeft=document.createElement("div");
    var hdrTitle=document.createElement("div");hdrTitle.className="team-title";hdrTitle.textContent=t.name;
    var hdrSub=document.createElement("div");hdrSub.style.cssText="font-size:11px;color:var(--mut)";
    hdrSub.textContent=t.cat+" · "+members.length+" joueur"+plural;
    hdrLeft.appendChild(hdrTitle);hdrLeft.appendChild(hdrSub);
    var hdrRight=document.createElement("div");hdrRight.style.cssText="display:flex;align-items:center;gap:8px";
    var badge=document.createElement("span");badge.className="player-badge";badge.style.background=col;badge.textContent=t.cat;
    var arrow=document.createElement("span");arrow.style.cssText="color:var(--mut)";arrow.textContent="▾";
    hdrRight.appendChild(badge);hdrRight.appendChild(arrow);
    hdr.appendChild(hdrLeft);hdr.appendChild(hdrRight);

    // Body
    var body=document.createElement("div");body.className="team-body";body.id="team-body-"+t.id;
    var bodyInner=document.createElement("div");bodyInner.style.cssText="border-top:1px solid var(--bdr);padding-top:10px";

    // Liste membres
    if(members.length){
      members.forEach(function(p){
        var row=document.createElement("div");row.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--bdr)";
        var info=document.createElement("span");info.style.cssText="font-size:12px;color:var(--txt)";
        info.textContent=p.prenom+" "+p.nom+" ";
        var poste=document.createElement("span");poste.style.cssText="color:var(--mut);font-size:10px";poste.textContent=p.poste||"";
        info.appendChild(poste);
        var rm=document.createElement("button");rm.textContent="×";
        rm.style.cssText="border:none;background:none;color:var(--red);font-size:16px;cursor:pointer;padding:0 4px;line-height:1";
        (function(pid){rm.addEventListener("click",function(e){e.stopPropagation();removeTeamMember(t.id,pid);});})(p.id);
        row.appendChild(info);row.appendChild(rm);bodyInner.appendChild(row);
      });
    } else {
      var empty=document.createElement("div");empty.style.cssText="font-size:12px;color:var(--mut);padding:6px 0";
      empty.textContent="Aucun joueur assigné";bodyInner.appendChild(empty);
    }

    // Bouton ajouter
    var addBtn=document.createElement("button");
    addBtn.textContent="+ Ajouter un joueur";
    addBtn.style.cssText="margin-top:10px;padding:7px 14px;border-radius:var(--rx);background:rgba(39,174,96,.12);color:var(--dkg);font-size:11px;font-weight:700;border:1px solid rgba(39,174,96,.3);cursor:pointer;margin-right:8px";
    (function(tid){addBtn.addEventListener("click",function(e){e.stopPropagation();openAddTeamMember(tid);});})(t.id);

    // Bouton supprimer
    var delBtn=document.createElement("button");
    delBtn.textContent="Supprimer";
    delBtn.style.cssText="margin-top:10px;padding:7px 14px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:600;border:none;cursor:pointer";
    (function(tid){delBtn.addEventListener("click",function(e){e.stopPropagation();deleteTeam(tid);});})(t.id);

    bodyInner.appendChild(addBtn);bodyInner.appendChild(delBtn);
    body.appendChild(bodyInner);
    d.appendChild(hdr);d.appendChild(body);
    el.appendChild(d);
  });
}
function openAddTeamMember(teamId){
  var team=getTeams().find(function(t){return t.id===teamId;});
  if(!team) return;
  var currentIds=team.members||[];
  var players=getPlayers().filter(function(p){return currentIds.indexOf(p.id)<0;});
  if(!players.length){alert("Aucun joueur disponible à ajouter.");return;}
  var modal=document.createElement("div");
  modal.className="team-member-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:70vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Ajouter des joueurs";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="✕";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  players.forEach(function(p){
    var lbl=document.createElement("label");
    lbl.style.cssText="display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--bdr);cursor:pointer";
    var chk=document.createElement("input");
    chk.type="checkbox";chk.value=p.id;
    chk.style.cssText="width:18px;height:18px;accent-color:var(--dkg);flex-shrink:0";
    var name=document.createElement("span");
    name.style.cssText="font-size:13px;color:var(--txt);font-weight:600;flex:1";
    name.textContent=p.prenom+" "+p.nom;
    var cat=document.createElement("span");
    cat.style.cssText="font-size:10px;color:var(--mut)";
    cat.textContent=p.cat;
    lbl.appendChild(chk);lbl.appendChild(name);lbl.appendChild(cat);
    list.appendChild(lbl);
  });
  var addBtn=document.createElement("button");
  addBtn.textContent="Ajouter la sélection";
  addBtn.style.cssText="width:100%;margin-top:14px;padding:14px;border:none;border-radius:var(--rs);background:var(--dkg);color:#fff;font-size:14px;font-weight:800;cursor:pointer";
  addBtn.addEventListener("click",function(e){
    e.stopPropagation();
    var checked=[].slice.call(list.querySelectorAll("input[type=checkbox]:checked")).map(function(c){return c.value;});
    if(!checked.length){alert("Aucun joueur sélectionné.");return;}
    var teams=getTeams();
    var t=teams.find(function(x){return x.id===teamId;});
    if(!t) return;
    t.members=(t.members||[]).concat(checked.filter(function(id){return (t.members||[]).indexOf(id)<0;}));
    saveTeams(teams);
    modal.remove();
    buildTeams();
  });
  modal.addEventListener("click",function(){modal.remove();});
  inner.appendChild(hdr);inner.appendChild(list);inner.appendChild(addBtn);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}
function confirmAddTeamMembers(){}
function removeTeamMember(teamId,playerId){
  var teams=getTeams();
  var team=teams.find(function(t){return t.id===teamId;});
  if(!team) return;
  team.members=(team.members||[]).filter(function(id){return id!==playerId;});
  saveTeams(teams);
  buildTeams();
}
function toggleTeam(id){var b=document.getElementById("team-body-"+id);if(b)b.style.display=b.style.display==="block"?"none":"block";}
async function showAddTeam(){
  var name=await askPrompt("Nom de l'équipe", {placeholder:"ex: U13F", confirmText:"Suivant"});
  if(!name)return;
  var cat=await askPrompt("Catégorie", {placeholder:"U7/U9/U11/U13/U15/U17/Senior", confirmText:"Créer"});
  if(!cat)return;
  var teams=getTeams();
  var newTeam={id:Date.now().toString(),name:name,cat:cat,members:[]};
  teams.push(newTeam);
  saveTeams(teams);
  ensureTeamChannel(newTeam);
  buildTeams();buildAdminHome();
}
function deleteTeam(id){askConfirm("Supprimer cette équipe ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){if(!ok)return;var teams=getTeams().filter(function(t){return t.id!==id;});saveTeams(teams);buildTeams();buildAdminHome();});}

// ── PLANNING ─────────────────────────────────────────────────────
function getEvents(){try{return JSON.parse(localStorage.getItem("asmb_events")||"[]");}catch(e){return [];}}
function saveEvents(e){
  localStorage.setItem("asmb_events",JSON.stringify(e));
  fsWriteCollection("events",e);
}

function fetchEventsFromCloud(){
  if(!window.fbReady||!window.fbGetDocs)return Promise.resolve(getVisibleEvents());
  return window.fbGetDocs(window.fbCollection(window.fbDb,"events")).then(function(snap){
    var a=[]; snap.forEach(function(d){var e=d.data(); if(e.statut!=="attente") a.push(e);});
    return a.length?a:getVisibleEvents();
  }).catch(function(){return getVisibleEvents();});
}
var planViewMode="list";
var planCalMonth=new Date().getMonth();
var planCalYear=new Date().getFullYear();

function togglePlanningView(){
  planViewMode=(planViewMode==="list")?"calendar":"list";
  var btn=document.getElementById("plan-view-toggle");
  var calEl=document.getElementById("planning-calendar");
  var listEl=document.getElementById("planningList");
  if(planViewMode==="calendar"){
    btn.textContent="Vue liste";
    calEl.style.display="block";
    listEl.style.display="none";
    renderPlanningCalendar();
  } else {
    btn.textContent="Vue calendrier";
    calEl.style.display="none";
    listEl.style.display="block";
  }
}

function renderPlanningCalendar(){
  var el=document.getElementById("planning-calendar");if(!el)return;
  var events=getEvents();
  var monthNames=["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Aout","Septembre","Octobre","Novembre","Décembre"];
  var firstDay=new Date(planCalYear,planCalMonth,1);
  var startOffset=(firstDay.getDay()+6)%7; // lundi=0
  var daysInMonth=new Date(planCalYear,planCalMonth+1,0).getDate();
  var todayStr=new Date().toISOString().slice(0,10);

  var html='<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'+
    '<button onclick="shiftPlanCal(-1)" style="width:32px;height:32px;border-radius:8px;background:var(--bdr);border:none;color:var(--mut);cursor:pointer">‹</button>'+
    '<div style="font-size:14px;font-weight:800;color:var(--txt)">'+monthNames[planCalMonth]+' '+planCalYear+'</div>'+
    '<button onclick="shiftPlanCal(1)" style="width:32px;height:32px;border-radius:8px;background:var(--bdr);border:none;color:var(--mut);cursor:pointer">›</button>'+
  '</div>';

  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:6px">';
  ["L","M","M","J","V","S","D"].forEach(function(d){html+='<div style="text-align:center;font-size:9px;font-weight:700;color:var(--mut)">'+d+'</div>';});
  html+='</div>';

  html+='<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
  for(var i=0;i<startOffset;i++){html+='<div></div>';}
  for(var day=1;day<=daysInMonth;day++){
    var dateStr=planCalYear+"-"+String(planCalMonth+1).padStart(2,"0")+"-"+String(day).padStart(2,"0");
    var dayEvents=events.filter(function(e){return e.date===dateStr;});
    var isToday=dateStr===todayStr;
    var dots=dayEvents.slice(0,3).map(function(e){return '<span style="width:5px;height:5px;border-radius:50%;background:'+eventTypeColor(e.type)+';display:inline-block;margin:0 1px"></span>';}).join("");
    html+='<div onclick="showDayEvents(\''+dateStr+'\')" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;border-radius:8px;cursor:pointer;background:'+(isToday?"var(--dkg)":"var(--card)")+';border:1px solid var(--bdr)">'+
      '<span style="font-size:11px;font-weight:'+(isToday?"800":"600")+';color:'+(isToday?"#fff":"var(--txt)")+'">'+day+'</span>'+
      '<div style="height:6px;margin-top:2px">'+dots+'</div>'+
    '</div>';
  }
  html+='</div>';
  el.innerHTML=html;
}

function shiftPlanCal(delta){
  planCalMonth+=delta;
  if(planCalMonth<0){planCalMonth=11;planCalYear--;}
  if(planCalMonth>11){planCalMonth=0;planCalYear++;}
  renderPlanningCalendar();
}

function showDayEvents(dateStr){
  var events=getEvents().filter(function(e){return e.date===dateStr;});
  if(!events.length){alert("Aucun événement ce jour-la");return;}
  var txt=events.map(function(e){return "• "+e.titre+" ("+e.type+")"+(e.heure?" a "+e.heure:"");}).join("\n");
  alert("Événements du "+dateStr+" :\n\n"+txt);
}

function buildPlanning(){
  var events=getVisibleEvents();
  var el=document.getElementById("planningList");if(!el)return;
  if(!events.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun événement</div><div style="font-size:11px;margin-top:4px">Appuyez sur + Événement</div></div>';return;}
  el.innerHTML="";
  // Sort by date
  events.sort(function(a,b){return a.date>b.date?1:-1;});
  events.forEach(function(e){
    var d=document.createElement("div");d.className="event-card";
    var evCol=eventTypeColor(e.type);
    var evDate=(e.dateFin&&e.dateFin!==e.date?(e.date+" → "+e.dateFin):e.date)+(e.heure?" · "+e.heure:"");
    var evLieu=e.lieu?"<div style=\"font-size:11px;color:var(--mut);margin-top:2px\">📍 "+e.lieu+"</div>":"";
    var evEquipe=e.equipe?"<div style=\"font-size:11px;color:var(--mut);margin-top:1px\">"+e.equipe+"</div>":"";
    var delBtn="<button onclick=\"deleteEvent('"+e.id+"')\" style=\"padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer;flex-shrink:0;margin-left:8px\">✕</button>";
    var presenceCount=e.presences?Object.keys(e.presences).length:0;
    var presBtn=(e.type==="entrainement"||e.type==="match")?("<button onclick=\"openPresences('"+e.id+"')\" style=\"margin-top:8px;padding:6px 12px;border-radius:20px;background:rgba(39,174,96,.12);color:#27AE60;font-size:10px;font-weight:700;border:none;cursor:pointer\">✓ Gerer les présences"+(presenceCount?" ("+presenceCount+")":"")+"</button>"):"";
    var scoreDisplay=e.score?("<div style=\"font-size:12px;font-weight:800;color:var(--txt);margin-top:6px\">ASMB "+e.score.asmb+" - "+e.score.adv+" "+(e.score.adversaire||"Adversaire")+"</div>"):"";
    var scoreBtn=(e.type==="match")?("<button onclick=\"editScore('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(192,57,43,.12);color:#C0392B;font-size:10px;font-weight:700;border:none;cursor:pointer\">"+(e.score?"Modifier score":"Ajouter score")+"</button>"):"";
    var convocCount=e.convocations?e.convocations.length:0;
    var convocBtn=(e.type==="match")?("<button onclick=\"showConvocation('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(26,46,90,.12);color:#1A2E5A;font-size:10px;font-weight:700;border:none;cursor:pointer\"> Convocation"+(convocCount?" ("+convocCount+")":"")+"</button>"):"";
    var weatherBtn=(e.type==="match"&&e.lieu)?("<button onclick=\"showWeather('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(232,103,10,.12);color:#E8670A;font-size:10px;font-weight:700;border:none;cursor:pointer\"> Meteo</button>"):"";
    var editTimeBtn="<button onclick=\"editEventDateTime('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:10px;font-weight:700;border:none;cursor:pointer\"> Modifier</button>";
    var evalBtn=(e.type==="stage"&&e.evaluationEnabled)?("<button onclick=\"openLiveEval('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(27,92,40,.08);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer\">Évaluer</button>"):"";
    var cancelBtn=e.cancelled?"":"<button onclick=\"cancelEvent('"+e.id+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(192,57,43,.12);color:#C0392B;font-size:10px;font-weight:700;border:none;cursor:pointer\"> Annuler</button>";
    var cancelledBadge=e.cancelled?"<div style=\"font-size:11px;font-weight:800;color:#C0392B;margin-top:4px\"> EVENEMENT ANNULÉ</div>":"";
    d.innerHTML="<div style=\"display:flex;align-items:flex-start;justify-content:space-between\"><div style=\"flex:1\"><div style=\"display:flex;align-items:center;gap:8px;margin-bottom:4px\"><span style=\"font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:"+evCol+"\">"+e.type.toUpperCase()+"</span><span style=\"font-size:11px;color:var(--mut)\">"+evDate+"</span></div><div style=\"font-size:13px;font-weight:700;color:var(--txt)\">"+e.titre+"</div>"+evLieu+evEquipe+cancelledBadge+scoreDisplay+presBtn+scoreBtn+convocBtn+weatherBtn+evalBtn+editTimeBtn+cancelBtn+"</div>"+delBtn+"</div>";
    el.appendChild(d);
  });
}

// ── EVALUATION EN DIRECT (Stage/Camp) ────────────────────────────
var currentEvalEventId=null;
var DEFAULT_EVAL_CRITERIA=["Tir","Dribble","Défense","Vitesse","Physique","Esprit d'équipe"];

function getEvalCriteria(){
  try{var c=JSON.parse(localStorage.getItem("asmb_eval_criteria")||"null");return (c&&c.length)?c:DEFAULT_EVAL_CRITERIA.slice();}catch(e){return DEFAULT_EVAL_CRITERIA.slice();}
}
function saveEvalCriteria(arr){localStorage.setItem("asmb_eval_criteria",JSON.stringify(arr));}

function getAllEvaluations(){try{return JSON.parse(localStorage.getItem("asmb_evaluations")||"{}");}catch(e){return {};}}
function saveAllEvaluations(obj){localStorage.setItem("asmb_evaluations",JSON.stringify(obj));fsWriteEvaluations(obj);}

