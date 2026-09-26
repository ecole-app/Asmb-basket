/* ===== 04-formation-ui.js — Affichage et edition des cycles et seances ===== */
// ── DRILL-DOWN CHIFFRES CLES ──────────────────────────────────────
var licenciesSortMode="nom";

function showLicenciesList(){
  document.getElementById("modal-licencies-list").style.display="flex";
  sortLicenciesList("nom");
}

function sortLicenciesList(mode){
  licenciesSortMode=mode;
  document.querySelectorAll("#modal-licencies-list .cat-filter").forEach(function(b){b.classList.remove("on");});
  document.getElementById("sortby-"+mode).classList.add("on");
  var players=getPlayers().slice();
  players.sort(function(a,b){
    if(mode==="nom")return (a.nom||"").localeCompare(b.nom||"");
    if(mode==="naissance")return (a.naissance||"").localeCompare(b.naissance||"");
    if(mode==="cat")return (a.cat||"").localeCompare(b.cat||"");
    return 0;
  });
  var el=document.getElementById("licencies-list-content");
  if(!players.length){el.innerHTML='<div class="empty-state"><div>Aucun licencie</div></div>';return;}
  el.innerHTML="";
  players.forEach(function(p){
    var div=document.createElement("div");
    div.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:10px 4px;border-bottom:1px solid var(--bdr)";
    div.innerHTML='<div><div style="font-size:13px;font-weight:700;color:var(--txt)">'+p.prenom+' '+p.nom+'</div><div style="font-size:11px;color:var(--mut);margin-top:2px">'+(p.naissance||"?")+' · '+(p.cat||"?")+'</div></div>'+
      '<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+(p.licence==="ok"?"#D4AF37":"#E8670A")+'">'+(p.licence==="ok"?"OK":"En attente")+'</span>';
    el.appendChild(div);
  });
}

function showPendingLicences(){
  var lics=getLicences().filter(function(l){return l.statut&&l.statut!=="validee";});
  var el=document.getElementById("pending-licences-content");
  if(!lics.length){el.innerHTML='<div class="empty-state"><div>Aucune licence en attente</div></div>';}
  else{
    el.innerHTML="";
    lics.forEach(function(l){
      var nom=l.fiche?(l.fiche.prenom+" "+l.fiche.nom):"Fiche non remplie";
      var div=document.createElement("div");
      div.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:10px 4px;border-bottom:1px solid var(--bdr);cursor:pointer";
      div.onclick=function(){closeModal("modal-pending-licences");openLicenceDetail(l.code);};
      div.innerHTML='<div><div style="font-size:13px;font-weight:700;color:var(--txt)">'+nom+'</div><div style="font-size:11px;color:var(--mut);margin-top:2px">Code : '+l.code+(l.categorie?" · "+l.categorie:"")+'</div></div><span style="color:var(--mut);font-size:16px">›</span>';
      el.appendChild(div);
    });
  }
  document.getElementById("modal-pending-licences").style.display="flex";
}

function showTeamsList(){
  var teams=getTeams();
  var el=document.getElementById("teams-list-content");
  document.getElementById("teams-list-title").textContent="Équipes du club";
  if(!teams.length){el.innerHTML='<div class="empty-state"><div>Aucune équipe</div></div>';}
  else{
    el.innerHTML="";
    teams.forEach(function(t){
      var count=(t.members&&t.members.length)?t.members.length:getPlayers().filter(function(p){return p.cat===t.cat;}).length;
      var div=document.createElement("div");
      div.style.cssText="display:flex;align-items:center;justify-content:space-between;padding:12px 4px;border-bottom:1px solid var(--bdr);cursor:pointer";
      div.onclick=function(){showTeamRoster(t.id);};
      div.innerHTML='<div><div style="font-size:14px;font-weight:700;color:var(--txt)">'+t.name+'</div><div style="font-size:11px;color:var(--mut);margin-top:2px">'+t.cat+' · '+count+' joueur'+(count>1?"s":"")+'</div></div><span style="color:var(--mut);font-size:16px">›</span>';
      el.appendChild(div);
    });
  }
  document.getElementById("modal-teams-list").style.display="flex";
}

function showTeamRoster(teamId){
  var team=getTeams().find(function(t){return t.id===teamId;});
  if(!team)return;
  document.getElementById("teams-list-title").textContent=team.name;
  var players=(team.members&&team.members.length)?getPlayers().filter(function(p){return team.members.indexOf(p.id)>=0;}):getPlayers().filter(function(p){return p.cat===team.cat;});
  var el=document.getElementById("teams-list-content");
  var backBtn='<button onclick="showTeamsList()" style="margin-bottom:10px;padding:6px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:11px;font-weight:600;border:none;cursor:pointer">← Toutes les équipes</button>';
  if(!players.length){el.innerHTML=backBtn+'<div class="empty-state"><div>Aucun joueur</div></div>';return;}
  var html=backBtn;
  players.forEach(function(p){
    html+='<div style="padding:10px 4px;border-bottom:1px solid var(--bdr)">'+
      '<div style="font-size:13px;font-weight:700;color:var(--txt)">'+p.prenom+' '+p.nom+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">Ne(e) le '+(p.naissance||"?")+' · N° licence '+(p.numLicence||"0C")+' ('+(p.typeLicence==="competition"?"Compétition":"Loisir")+')</div>'+
    '</div>';
  });
  el.innerHTML=html;
}

function showAssiduiteChart(){
  var events=getEvents().filter(function(e){return e.presences&&Object.keys(e.presences).length;});
  var now=new Date();
  var months=[];
  for(var i=5;i>=0;i--){
    var d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({key:d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0"),label:d.toLocaleDateString("fr-FR",{month:"short"})});
  }
  var byMonth={};
  months.forEach(function(m){byMonth[m.key]={present:0,total:0};});
  events.forEach(function(e){
    var key=e.date.slice(0,7);
    if(!byMonth[key])return;
    Object.keys(e.presences).forEach(function(k){
      byMonth[key].total++;
      if(e.presences[k]==="present")byMonth[key].present++;
    });
  });
  var totalP=0,totalT=0;
  months.forEach(function(m){totalP+=byMonth[m.key].present;totalT+=byMonth[m.key].total;});
  var overallPct=totalT?Math.round(totalP/totalT*100):0;

  var html='<div style="text-align:center;margin-bottom:20px"><div style="font-size:32px;font-weight:900;color:#D4AF37">'+overallPct+'%</div><div style="font-size:11px;color:var(--mut);margin-top:2px">Assiduité globale (6 derniers mois)</div></div>';
  html+='<div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding:0 8px">';
  months.forEach(function(m){
    var d=byMonth[m.key];
    var pct=d.total?Math.round(d.present/d.total*100):0;
    var barH=d.total?Math.max(pct*1.3,4):4;
    html+='<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">'+
      '<div style="font-size:10px;font-weight:700;color:var(--txt)">'+(d.total?pct+"%":"—")+'</div>'+
      '<div style="width:100%;height:'+barH+'px;background:'+(d.total?"#D4AF37":"var(--bdr)")+';border-radius:4px 4px 0 0"></div>'+
      '<div style="font-size:9px;color:var(--mut);text-transform:capitalize">'+m.label+'</div>'+
    '</div>';
  });
  html+='</div>';
  document.getElementById("assiduite-content").innerHTML=html;
  document.getElementById("modal-assiduite").style.display="flex";
}

function openPole(id){
  if(id==="formation"){stack.push("elite");buildElite();showScr("elite");}
  else if(id==="elite"||id==="competition"||id==="3x3"||id==="evenement"||id==="basketpourtous"){
    openPoleScreen(id);
  }
}
function buildElite(){
  var el=document.getElementById("eliteCards");if(!el)return;el.innerHTML="";
  ELITE_CATS.forEach(function(cat){el.appendChild(makeCard(cat,function(){openCat(cat.id);}));});
}
function openCat(id){
  // Generique : toute categorie declaree dans ELITE_CATS s'ouvre, sans liste
  // blanche a maintenir. "u13f" reste accepte pour les anciens liens.
  if(id==="u13f") id="u13";
  if(!ELITE_CATS.some(function(c){ return c.id===id; })) return;
  activeCatId=id;
  stack.push("u13home");buildU13Home();showScr("u13home");
}
function buildU13Home(){
  var cat=ELITE_CATS.filter(function(c){ return c.id===activeCatId; })[0]||{};
  var chips=document.getElementById("u13chips");
  if(chips){
    chips.innerHTML="";
    var infos=(cat.chips||["2 séances / semaine","1h30 par séance"]).slice();
    if(cat.zoneChip) infos.push("Zone "+getClubZone());
    infos.forEach(function(t){var s=document.createElement("span");s.className="chip";s.textContent=t;chips.appendChild(s);});
  }
  var ttl=document.getElementById("u13title");
  if(ttl)ttl.textContent=cat.title||cat.name||"Categorie";
  // Reconstruit a chaque affichage : la zone ou les dates du club peuvent changer.
  var vsec=document.getElementById("vacSec");
  if(vsec)vsec.textContent="Vacances zone "+getClubZone()+(getVacancesOverride()?" (dates du club)":"");
  var vl=document.getElementById("vacList");
  if(vl){
    vl.innerHTML="";
    getVacances().forEach(function(v){vl.innerHTML+='<div class="vac"><div class="vdot" style="background:'+v.c+'"></div><div class="vinf"><div class="vnm">'+v.n+'</div><div class="vdt">'+v.d+'</div></div><div class="vimp">'+v.imp+'</div></div>';});
    if(canEditCycles()){
      var b=document.createElement("button");
      b.textContent="Modifier la zone et les dates";
      b.style.cssText="width:calc(100% - 24px);margin:4px 12px 8px;padding:11px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--txt);font-size:12px;font-weight:700;cursor:pointer";
      b.addEventListener("click",openVacancesEdit);
      vl.appendChild(b);
    }
  }
  var cl=document.getElementById("cyList");cl.innerHTML="";
  activeCycles().forEach(function(cy){
    var pr=cycleProgress(cy.id);
    var allDone=pr&&pr.done===pr.total&&pr.total>0;
    var progTxt=pr&&pr.total>0?" · "+pr.done+"/"+pr.total+" faites":"";
    var d=document.createElement("div");d.className="cy-card";
    d.onclick=function(){openCy(cy.id);};
    d.innerHTML='<div class="cy-bar" style="background:'+(allDone?"#D4AF37":cy.c)+'"></div><div class="cy-em" style="background:'+(allDone?"#D4AF37":cy.c)+'">'+(allDone?"✓":cycleNum(cy))+'</div><div class="cy-inf"><div class="cy-nm" style="color:'+(allDone?"#D4AF37":"var(--txt)")+'">Cycle '+cy.id+' — '+cy.n+'</div><div class="cy-pr">'+cy.p+'</div><div class="cy-se">'+cy.s+' séances'+progTxt+'</div></div><div style="color:'+(allDone?"#D4AF37":"var(--mut)")+';font-size:16px">'+(allDone?"✓":"›")+'</div>';
    cl.appendChild(d);
  });
  if(canEditCycles()){
    var addBtn=document.createElement("button");
    addBtn.textContent="+ Ajouter un cycle";
    addBtn.style.cssText="width:calc(100% - 24px);margin:8px 12px 16px;padding:13px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
    addBtn.addEventListener("click",function(){openCycleEditModal(null);});
    cl.appendChild(addBtn);
  }
}
// ── EDITION DES CYCLES ET SEANCES (reserve dirigeant) ───────────────
function canEditCycles(){
  return (window.ASMB_USER&&window.ASMB_USER.roles||[]).indexOf("dirigeant")>=0;
}
function isCustomCycle(cy){
  var ov=getCycleOverrides();
  return (ov.custom||[]).some(function(c){return c.id==cy.id;});
}
function openCycleEditModal(cyId){
  if(!canEditCycles()){alert("Réservé au dirigeant.");return;}
  var existing=cyId?findCycle(cyId):null;
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:88vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var colorOpts=KC.map(function(c){return '<option value="'+c+'"'+(existing&&existing.c===c?" selected":"")+'>'+c+'</option>';}).join("");
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">'+(existing?"Modifier le cycle":"Nouveau cycle")+'</div>'+
      '<button id="cyed-close" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div class="form-group"><label class="form-label">Nom du cycle</label><input class="form-input" id="cyed-nom" value="'+(existing?authEsc(existing.n):"")+'" placeholder="Ex: Fondamentaux Individuels"></div>'+
    '<div class="form-group"><label class="form-label">Période</label><input class="form-input" id="cyed-periode" value="'+(existing?authEsc(existing.p):"")+'" placeholder="Ex: Sept. - mi-oct. 2026"></div>'+
    '<div class="form-group"><label class="form-label">Couleur</label><select class="form-input" id="cyed-couleur">'+colorOpts+'</select></div>'+
    '<div class="form-group"><label class="form-label">Objectifs (un par ligne)</label><textarea class="form-input" id="cyed-objs" rows="5" placeholder="Un objectif par ligne">'+(existing&&existing.objs?authEsc(existing.objs.join("\n")):"")+'</textarea></div>'+
    '<button id="cyed-save" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:4px">Enregistrer</button>'+
    (existing?'<button id="cyed-del" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:13px;font-weight:700;border:none;cursor:pointer;margin-top:8px">'+(isCustomCycle(existing)?"Supprimer ce cycle":"Masquer ce cycle")+'</button>':'');
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  document.getElementById("cyed-close").addEventListener("click",function(){modal.remove();});
  document.getElementById("cyed-save").addEventListener("click",function(){
    var nom=document.getElementById("cyed-nom").value.trim();
    var periode=document.getElementById("cyed-periode").value.trim();
    var couleur=document.getElementById("cyed-couleur").value;
    var objs=document.getElementById("cyed-objs").value.split("\n").map(function(s){return s.trim();}).filter(Boolean);
    if(!nom){alert("Le nom du cycle est obligatoire");return;}
    var ov=getCycleOverrides();
    if(existing){
      if(isCustomCycle(existing)){
        var ci=(ov.custom||[]).findIndex(function(c){return c.id==existing.id;});
        if(ci>=0){ ov.custom[ci].n=nom; ov.custom[ci].p=periode; ov.custom[ci].c=couleur; ov.custom[ci].objs=objs; }
      } else {
        ov.edits=ov.edits||{};
        ov.edits[existing.id]=Object.assign({},ov.edits[existing.id]||{},{n:nom,p:periode,c:couleur,objs:objs});
      }
    } else {
      ov.custom=ov.custom||[];
      var newId=Date.now();
      ov.custom.push({id:newId,cat:activeCatId,n:nom,sh:nom,p:periode,s:0,c:couleur,e:"",objs:objs,seas:[]});
    }
    saveCycleOverrides(ov);
    modal.remove();
    buildU13Home();
    if(existing&&document.querySelector("#scr-cycle.on")){ curCy=findCycle(existing.id); if(curCy) buildCycle(curCy); }
  });
  var delBtn=document.getElementById("cyed-del");
  if(delBtn){
    delBtn.addEventListener("click",function(){
      var custom=isCustomCycle(existing);
      askConfirm(custom?"Supprimer définitivement ce cycle ?":"Masquer ce cycle ? Le contenu d'origine est conservé et pourra être réaffiché.",{danger:true,confirmText:custom?"Supprimer":"Masquer"}).then(function(ok){
        if(!ok)return;
        var ov=getCycleOverrides();
        if(custom){ ov.custom=(ov.custom||[]).filter(function(c){return c.id!=existing.id;}); }
        else { ov.hidden=ov.hidden||[]; if(ov.hidden.indexOf(existing.id)<0) ov.hidden.push(existing.id); }
        saveCycleOverrides(ov);
        modal.remove();
        if(document.querySelector("#scr-cycle.on")){ goBack(); }
        buildU13Home();
      });
    });
  }
}
function openSeanceEditModal(cyId,seaNum){
  if(!canEditCycles()){alert("Réservé au dirigeant.");return;}
  var cy=findCycle(cyId);
  if(!cy)return;
  var existing=seaNum?cy.seas.find(function(s){return s.num===seaNum;}):null;
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:88vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var existingContent="";
  if(existing&&existing.sits&&existing.sits.length===1&&existing.sits[0].freeText){ existingContent=existing.sits[0].desc||""; }
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">'+(existing?"Modifier la séance":"Nouvelle séance")+'</div>'+
      '<button id="sed-close" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div class="form-group"><label class="form-label">Titre</label><input class="form-input" id="sed-titre" value="'+(existing?authEsc(existing.t):"")+'" placeholder="Ex: Dribble et changement de main"></div>'+
    '<div class="form-group"><label class="form-label">Objectif</label><input class="form-input" id="sed-obj" value="'+(existing?authEsc(existing.obj):"")+'" placeholder="Ex: Progresser dans la maitrise du dribble"></div>'+
    '<div class="form-group"><label class="form-label">Durée</label><input class="form-input" id="sed-dur" value="'+(existing?authEsc(existing.dur):"1h30")+'" placeholder="1h30"></div>'+
    (existing&&!existingContent&&existing.sits&&existing.sits.length
      ? '<div style="font-size:11px;color:var(--mut);background:#e8edf5;border-radius:var(--rx);padding:10px 12px;margin-bottom:12px;line-height:1.4">Cette séance contient '+existing.sits.length+' situation(s) détaillée(s) du contenu d\'origine. Elles sont conservées telles quelles.</div>'
      : '<div class="form-group"><label class="form-label">Contenu de la séance</label><textarea class="form-input" id="sed-contenu" rows="6" placeholder="Décrire le déroulé, les exercices, l\'organisation...">'+authEsc(existingContent)+'</textarea></div>')+
    '<button id="sed-save" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:4px">Enregistrer</button>'+
    (existing?'<button id="sed-del" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:13px;font-weight:700;border:none;cursor:pointer;margin-top:8px">Supprimer cette séance</button>':'');
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  document.getElementById("sed-close").addEventListener("click",function(){modal.remove();});
  document.getElementById("sed-save").addEventListener("click",function(){
    var titre=document.getElementById("sed-titre").value.trim();
    var obj=document.getElementById("sed-obj").value.trim();
    var dur=document.getElementById("sed-dur").value.trim()||"1h30";
    var contenuEl=document.getElementById("sed-contenu");
    if(!titre){alert("Le titre est obligatoire");return;}
    var ov=getCycleOverrides();
    var custom=isCustomCycle(cy);
    function applyToSeance(s){
      s.t=titre; s.obj=obj; s.dur=dur;
      if(contenuEl){
        var txt=contenuEl.value.trim();
        s.sits=txt?[{ti:titre,dur:dur,desc:txt,org:"",axes:[],kws:[],ch:null,freeText:true}]:[];
      }
      return s;
    }
    if(existing){
      if(custom){
        var ci=(ov.custom||[]).findIndex(function(c){return c.id==cy.id;});
        if(ci>=0){
          var si=ov.custom[ci].seas.findIndex(function(s){return s.num===seaNum;});
          if(si>=0) applyToSeance(ov.custom[ci].seas[si]);
        }
      } else {
        ov.edits=ov.edits||{};
        ov.edits[cy.id]=ov.edits[cy.id]||{};
        var extra=ov.edits[cy.id].extraSeas||[];
        var ei=extra.findIndex(function(s){return s.num===seaNum;});
        if(ei>=0){ applyToSeance(extra[ei]); ov.edits[cy.id].extraSeas=extra; }
        else {
          // Modification d'une seance d'origine : on stocke un patch cible
          ov.edits[cy.id].seaPatches=ov.edits[cy.id].seaPatches||{};
          ov.edits[cy.id].seaPatches[seaNum]={t:titre,obj:obj,dur:dur};
        }
      }
    } else {
      var newNum=cy.id+"."+(cy.seas.length+1);
      var newSea=applyToSeance({num:newNum,t:"",obj:"",dur:dur,sits:[]});
      if(custom){
        var ci2=(ov.custom||[]).findIndex(function(c){return c.id==cy.id;});
        if(ci2>=0){ ov.custom[ci2].seas.push(newSea); ov.custom[ci2].s=ov.custom[ci2].seas.length; }
      } else {
        ov.edits=ov.edits||{};
        ov.edits[cy.id]=ov.edits[cy.id]||{};
        ov.edits[cy.id].extraSeas=(ov.edits[cy.id].extraSeas||[]).concat([newSea]);
      }
    }
    saveCycleOverrides(ov);
    modal.remove();
    curCy=findCycle(cy.id);
    if(curCy) buildCycle(curCy);
    buildU13Home();
  });
  var sdel=document.getElementById("sed-del");
  if(sdel){
    sdel.addEventListener("click",function(){
      askConfirm("Supprimer cette séance ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
        if(!ok)return;
        var ov=getCycleOverrides();
        if(isCustomCycle(cy)){
          var ci=(ov.custom||[]).findIndex(function(c){return c.id==cy.id;});
          if(ci>=0){ ov.custom[ci].seas=ov.custom[ci].seas.filter(function(s){return s.num!==seaNum;}); ov.custom[ci].s=ov.custom[ci].seas.length; }
        } else {
          ov.edits=ov.edits||{};
          ov.edits[cy.id]=ov.edits[cy.id]||{};
          var extra=(ov.edits[cy.id].extraSeas||[]).filter(function(s){return s.num!==seaNum;});
          if(extra.length!==(ov.edits[cy.id].extraSeas||[]).length){ ov.edits[cy.id].extraSeas=extra; }
          else { ov.edits[cy.id].hiddenSeas=(ov.edits[cy.id].hiddenSeas||[]).concat([seaNum]); }
        }
        saveCycleOverrides(ov);
        modal.remove();
        curCy=findCycle(cy.id);
        if(curCy) buildCycle(curCy);
        buildU13Home();
      });
    });
  }
}

function openCy(id){curCy=findCycle(id);stack.push("cycle");buildCycle(curCy);showScr("cycle");}
function buildCycle(cy){
  if(!cy)return;
  document.getElementById("cyHdr").innerHTML='<div style="padding:14px 16px;border-bottom:1px solid var(--bdr)"><div style="display:flex;align-items:center;gap:10px"><div style="width:40px;height:40px;border-radius:12px;background:'+cy.c+';display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;color:#fff">'+cycleNum(cy)+'</div><div><div style="font-size:17px;font-weight:900;color:var(--txt)">'+cy.n+'</div><div style="font-size:11px;color:var(--mut)">'+cy.p+' · '+cy.s+' séances</div></div></div></div>';
  document.getElementById("cyObjs").innerHTML='<div class="obj-bx">'+cy.objs.map(function(o){return '<div class="obj-it">'+o+'</div>';}).join("")+'</div>';
  var sl=document.getElementById("cySeances");sl.innerHTML="";
  var pr=cycleProgress(cy.id);
  if(pr&&pr.total>0){var pct=Math.round(pr.done/pr.total*100);var _pw=document.createElement("div");_pw.className="prog-wrap";_pw.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--mut)">Progression</span><span style="font-size:11px;font-weight:700;color:var(--ltg)">'+pr.done+'/'+pr.total+' séances</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%"></div></div>';sl.appendChild(_pw);}
  cy.seas.forEach(function(s,si){
    var done=isDone(cy.id,s.num);
    var d=document.createElement("div");d.className="sea-card";
    d.onclick=function(){openSea(cy.id,s.num);};
    d.innerHTML='<div class="shdr"><div class="snum" style="background:'+(done?"#D4AF37":cy.c)+'">'+(done?"✓":(si+1))+'</div><div class="sinf"><div class="stit" style="color:'+(done?"#D4AF37":"var(--txt)")+'">'+s.t+'</div><div class="sobj">'+s.obj+'</div></div><div style="display:flex;align-items:center;gap:6px"><span style="font-size:10px;color:var(--mut)">'+s.dur+'</span><span style="color:'+(done?"#D4AF37":"var(--mut)")+';font-size:14px">'+(done?"✓":"›")+'</span></div></div>';
    if(canEditCycles()){
      var editSea=document.createElement("button");
      editSea.textContent="Modifier";
      editSea.style.cssText="margin:0 0 0 auto;display:block;padding:5px 12px;border-radius:14px;background:var(--bdr);color:var(--txt2);font-size:10px;font-weight:700;border:none;cursor:pointer";
      editSea.addEventListener("click",function(e){e.stopPropagation();openSeanceEditModal(cy.id,s.num);});
      d.appendChild(editSea);
    }
    sl.appendChild(d);
  });
  if(canEditCycles()){
    var addSea=document.createElement("button");
    addSea.textContent="+ Ajouter une séance";
    addSea.style.cssText="width:100%;margin-top:10px;padding:12px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
    addSea.addEventListener("click",function(){openSeanceEditModal(cy.id,null);});
    sl.appendChild(addSea);
    var editCy=document.createElement("button");
    editCy.textContent="Modifier ce cycle";
    editCy.style.cssText="width:100%;margin-top:8px;padding:11px;border-radius:var(--rs);background:transparent;border:1px solid var(--bdr);color:var(--txt2);font-size:12px;font-weight:700;cursor:pointer";
    editCy.addEventListener("click",function(){openCycleEditModal(cy.id);});
    sl.appendChild(editCy);
  }
}
function openSea(cyId,sNum){
  curCy=findCycle(cyId);
  curSea=curCy.seas.find(function(s){return s.num===sNum;});
  stack.push("seance");buildSeance(curCy,curSea);showScr("seance");
}
function buildSeance(cy,s){
  var done=isDone(cy.id,s.num);
  var hdr=document.getElementById("seaHdr");
  hdr.innerHTML="";
  var top=document.createElement("div");
  top.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:6px";
  var seaIdx=curCy.seas.findIndex(function(x){return x.num===s.num;})+1;
  top.innerHTML='<div style="background:'+cy.c+';color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:20px">Séance '+seaIdx+'</div><div style="font-size:11px;color:var(--mut)">'+s.dur+'</div>';
 var ttl=document.createElement("div");ttl.style.cssText="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:4px";ttl.textContent=s.t;
 var obj=document.createElement("div");obj.style.cssText="font-size:11.5px;color:var(--mut);line-height:1.4;margin-bottom:8px";obj.textContent=s.obj;
 var btn=document.createElement("button");
 btn.id="done-btn";btn.className="done-btn"+(done?" active":"");
 btn.textContent=done?"✓ Séance terminée":"○ Marquer comme terminée";
 btn.onclick=function(){toggleDone(cy.id,s.num);};
 hdr.appendChild(top);hdr.appendChild(ttl);hdr.appendChild(obj);hdr.appendChild(btn);
 var sl=document.getElementById("seaSits");sl.innerHTML="";
 s.sits.forEach(function(sit,i){
 var ch=sit.ch&&sit.ch.startsWith("ok:")?'<div class="chok">✓ '+sit.ch.slice(3)+'</div>':"";
    var kws=sit.kws.map(function(k,j){return '<span class="kw" style="background:'+KC[j%KC.length]+'">'+k+'</span>';}).join("");
    var animKey=s.num+"-"+(i+1);
    var hasAnim=typeof SIT_ANIMS!=="undefined"&&SIT_ANIMS[animKey];
    var animDiv=hasAnim?'<div style="margin:8px 0"><div class="lbl">Animation</div><div id="anim-'+animKey+'" style="background:var(--bg);border-radius:8px;overflow:hidden"></div></div>':"";
    var d=document.createElement("div");d.className="sit-card";
    d.innerHTML='<div class="shd2" style="border-bottom:2px solid '+cy.c+'"><div class="st2">Sit. '+(i+1)+' — '+sit.ti+'</div><div class="sdur">'+sit.dur+'</div></div><div class="sbdy">'+ch+'<div class="lbl">Description</div><div class="txt">'+sit.desc+'</div><div class="lbl">Organisation</div><div class="txt">'+sit.org+'</div>'+animDiv+'<div class="lbl">Axes evolution</div><div style="margin-bottom:10px">'+sit.axes.map(function(a){return '<div class="axe">'+a+'</div>';}).join("")+'</div><div class="lbl">Mots cles</div><div class="kws">'+kws+'</div></div>';
 sl.appendChild(d);
 });
 setTimeout(function(){
 if(typeof SIT_ANIMS==="undefined")return;
 s.sits.forEach(function(_,i){var key=s.num+"-"+(i+1);if(SIT_ANIMS[key])injectSitAnim(key);});
 },60);
}


// ── ZONE ET DATES DE VACANCES (reserve dirigeant) ───────────────────
// Le club choisit sa zone academique, ou saisit ses propres dates si son
// calendrier differe (stage, treve interne, calendrier etranger...).
async function openVacancesEdit(){
  if(!canEditCycles()) return;
  var zones=["A","B","C"];
  var cur=getClubZone();
  var z=await askPrompt("Zone academique du club (A, B ou C) \u2014 actuelle : "+cur,
    {defaultValue:cur,confirmText:"Suivant"});
  if(z===null) return;
  z=String(z).trim().toUpperCase();
  if(zones.indexOf(z)<0){ askAlert("Zone inconnue. Saisir A, B ou C."); return; }
  if(window.CURRENT_CLUB_ID && window.fbUpdateDoc){
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{zone:z}).catch(function(){});
  }
  if(window.CURRENT_CLUB) window.CURRENT_CLUB.zone=z;

  var perso=await askConfirm("Utiliser les dates officielles de la zone "+z+" ?\n\nRepondre Non pour saisir vos propres dates.",
    {confirmText:"Dates officielles",cancelText:"Mes dates"});
  if(perso){
    saveVacancesOverride(null);
    buildU13Home();
    askAlert("Zone "+z+" appliquee avec les dates officielles.");
    return;
  }
  var base=getVacances().slice();
  var out=[];
  for(var i=0;i<base.length;i++){
    var v=base[i];
    var d=await askPrompt(v.n+" \u2014 dates",{defaultValue:v.d,confirmText:"Suivant"});
    if(d===null) return;
    var imp=await askPrompt(v.n+" \u2014 seances impactees",{defaultValue:v.imp,confirmText:i===base.length-1?"Enregistrer":"Suivant"});
    if(imp===null) return;
    out.push({n:v.n,d:String(d).trim()||v.d,imp:String(imp).trim()||v.imp,c:v.c});
  }
  saveVacancesOverride(out);
  buildU13Home();
  askAlert("Dates du club enregistrees.");
}
