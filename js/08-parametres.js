/* ===== 08-parametres.js — Ecran Parametres et sa personnalisation ===== */
// ═══ PARAMETRES ══════════════════════════════════════════════════
function buildParametres(){
  var isDirigeant=localStorage.getItem("asmb_profile")==="dirigeant";
  var adminOnly=document.getElementById("params-dirigeant-only");
  if(adminOnly) adminOnly.style.display=isDirigeant?"block":"none";
  var seasonEl=document.getElementById("season-status");
  if(seasonEl){
    var cur=getCurrentSeason(), natural=computeNaturalSeason();
    if(natural!==cur){
      seasonEl.innerHTML='Saison affichée : <b>'+cur+'</b><br><span style="color:#E8670A;font-weight:700">La saison '+natural+' a commencé — pensez à archiver.</span>';
    } else {
      seasonEl.textContent="Saison affichée : "+cur;
    }
  }
  var gd=document.getElementById("gp-dark");
  if(gd)gd.checked=document.documentElement.getAttribute("data-theme")==="dark";
  var toggle=document.getElementById("notif-toggle");
  if(toggle)toggle.checked=localStorage.getItem("asmb_notif")==="on";
  ["messages","match","entrainement","evenement"].forEach(function(t){
    var tg=document.getElementById("notif-"+t+"-toggle");
    if(tg)tg.checked=localStorage.getItem("asmb_notif_"+t)!=="off";
  });
  var accEl=document.getElementById("account-info-box");
  if(accEl){
    var u=window.ASMB_USER;
    accEl.innerHTML = u
      ? "Connecté en tant que <b>"+authEsc(u.email||"")+"</b>"
      : "Connexion en cours...";
  }
  buildClubStats();
  var fbBtn=document.getElementById("feedback-send-btn");
  if(fbBtn && !fbBtn.dataset.wired){
    fbBtn.dataset.wired="1";
    fbBtn.addEventListener("click", function(){ sendFeedback(""); });
  }
  wireThemeAnimSettings("");
  buildParametresLayout();
}

// ═══ PERSONNALISATION DES PARAMETRES (ordre, masquage, raccourcis) ═══
var PARAMS_EDIT_MODE=false;
var PARAMS_SECTION_NAMES={
  themes:"Thèmes animés",avis:"Avis et suggestions",notesfrais:"Notes de frais",stats:"Statistiques du club",
  apparence:"Apparence",qr:"Partage & QR codes",notifications:"Notifications",
  communication:"Communication",donnees:"Données",demo:"Demonstration"
};
function getParamsOrder(){try{return JSON.parse(localStorage.getItem("asmb_params_order")||"[]");}catch(e){return [];}}
function saveParamsOrder(o){localStorage.setItem("asmb_params_order",JSON.stringify(o));}
function getParamsHidden(){try{return JSON.parse(localStorage.getItem("asmb_params_hidden")||"[]");}catch(e){return [];}}
function saveParamsHidden(h){localStorage.setItem("asmb_params_hidden",JSON.stringify(h));}
function getCustomShortcuts(){try{return JSON.parse(localStorage.getItem("asmb_params_shortcuts")||"[]");}catch(e){return [];}}
function saveCustomShortcuts(s){localStorage.setItem("asmb_params_shortcuts",JSON.stringify(s));}

function toggleParamsEditMode(){
  PARAMS_EDIT_MODE=!PARAMS_EDIT_MODE;
  var btn=document.getElementById("params-edit-toggle");
  if(btn){
    btn.textContent=PARAMS_EDIT_MODE?"Terminé":"Organiser";
    btn.style.background=PARAMS_EDIT_MODE?"var(--dkg)":"var(--bdr)";
    btn.style.color=PARAMS_EDIT_MODE?"#fff":"var(--mut)";
  }
  buildParametresLayout();
}

function moveParamBlock(secId,delta){
  // On ne reordonne qu'a l'interieur du meme groupe (sections partagees vs reservees dirigeant),
  // pour ne jamais faire sortir une section admin de son conteneur protege.
  var block=document.querySelector('#scr-parametres .param-block[data-sec="'+secId+'"]');
  if(!block) return;
  var siblings=Array.prototype.slice.call(block.parentNode.children).filter(function(c){return c.classList&&c.classList.contains("param-block");});
  var ids=siblings.map(function(b){return b.dataset.sec;});
  var from=ids.indexOf(secId);
  var to=from+delta;
  if(from<0||to<0||to>=ids.length) return;
  ids.splice(from,1);
  ids.splice(to,0,secId);
  // Fusionne dans l'ordre global enregistre
  var globalOrder=getParamsOrder().filter(function(id){return ids.indexOf(id)<0;});
  saveParamsOrder(globalOrder.concat(ids));
  buildParametresLayout();
}
function toggleParamHidden(secId){
  var h=getParamsHidden();
  var i=h.indexOf(secId);
  if(i>=0) h.splice(i,1); else h.push(secId);
  saveParamsHidden(h);
  buildParametresLayout();
}

function buildParametresLayout(){
  renderCustomShortcuts();
  var order=getParamsOrder();
  var hidden=getParamsHidden();
  var allBlocks=Array.prototype.slice.call(document.querySelectorAll("#scr-parametres .param-block"));

  // Reordonne les vrais noeuds du DOM, groupe par parent reel
  var groups=new Map();
  allBlocks.forEach(function(b){
    if(!groups.has(b.parentNode)) groups.set(b.parentNode,[]);
    groups.get(b.parentNode).push(b);
  });
  groups.forEach(function(group,parent){
    var sorted=group.slice().sort(function(a,b){
      var ia=order.indexOf(a.dataset.sec), ib=order.indexOf(b.dataset.sec);
      if(ia<0) ia=999+group.indexOf(a);
      if(ib<0) ib=999+group.indexOf(b);
      return ia-ib;
    });
    sorted.forEach(function(b){ parent.appendChild(b); });
  });

  // Etat visuel + controles
  groups.forEach(function(group,parent){
    var visible=Array.prototype.slice.call(parent.children).filter(function(c){return c.classList&&c.classList.contains("param-block");});
    visible.forEach(function(block){
      var secId=block.dataset.sec;
      var isCustom=secId.indexOf("custom-")===0;
      var isHidden=hidden.indexOf(secId)>=0;
      block.style.display=(isHidden && !PARAMS_EDIT_MODE)?"none":"";
      block.style.opacity=(isHidden && PARAMS_EDIT_MODE)?".45":"1";
      block.classList.toggle("editing", PARAMS_EDIT_MODE);
      var oldCtrl=block.querySelector(".param-ctrl");
      if(oldCtrl) oldCtrl.remove();
      if(!PARAMS_EDIT_MODE) return;
      var ctrl=document.createElement("div");
      ctrl.className="param-ctrl";
      ctrl.style.cssText="display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:0 12px 12px";
      var handle=document.createElement("span");
      handle.className="drag-handle";
      handle.style.cssText="color:var(--mut);font-size:20px;margin-right:auto;padding:10px;cursor:grab";
      handle.textContent="\u2807";
      ctrl.appendChild(handle);
      if(isCustom){
        var delBtn=document.createElement("button");
        delBtn.textContent="Supprimer";
        delBtn.style.cssText="padding:0 14px;height:34px;border-radius:17px;border:none;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:700;cursor:pointer";
        delBtn.addEventListener("click",function(e){
          e.stopPropagation();
          askConfirm("Supprimer ce raccourci ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
            if(!ok)return;
            var scId=secId.replace("custom-","");
            saveCustomShortcuts(getCustomShortcuts().filter(function(s){return s.id!==scId;}));
            buildParametresLayout();
          });
        });
        ctrl.appendChild(delBtn);
      } else {
        var hideBtn=document.createElement("button");
        hideBtn.textContent=isHidden?"Afficher":"Masquer";
        hideBtn.style.cssText="padding:0 14px;height:34px;border-radius:17px;border:none;background:"+(isHidden?"rgba(212,175,55,.15)":"rgba(192,57,43,.1)")+";color:"+(isHidden?"var(--dkg)":"var(--red)")+";font-size:11px;font-weight:700;cursor:pointer";
        hideBtn.addEventListener("click",function(e){e.stopPropagation();toggleParamHidden(secId);});
        ctrl.appendChild(hideBtn);
      }
      block.appendChild(ctrl);
    });
    if(PARAMS_EDIT_MODE && visible.length>1){
      enablePressDrag(visible, function(newOrder){
        var globalOrder=getParamsOrder().filter(function(id){return newOrder.indexOf(id)<0;});
        saveParamsOrder(globalOrder.concat(newOrder));
        buildParametresLayout();
      });
    }
  });

  renderParamsAddTile();
}

function renderParamsAddTile(){
  var old=document.getElementById("params-add-tile");
  if(old) old.remove();
  if(!PARAMS_EDIT_MODE) return;
  var tile=document.createElement("div");
  tile.id="params-add-tile";
  tile.style.cssText="margin:4px 12px 20px";
  tile.innerHTML='<button onclick="openAddShortcutModal()" style="width:100%;padding:13px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--dkg);font-size:13px;font-weight:700;cursor:pointer">+ Ajouter un raccourci</button>';
  var container=document.getElementById("params-custom-list");
  if(container && container.parentNode) container.parentNode.insertBefore(tile, container.nextSibling);
}

// ── Raccourcis personnalises : vers une destination existante de l'app ──
var SHORTCUT_TARGETS=[
  {id:"comptabilite",label:"Comptabilité",icon:"💶"},
  {id:"fiches",label:"Fiches reçues",icon:"📥"},
  {id:"acces",label:"Accès coach",icon:"🔑"},
  {id:"avis",label:"Avis & suggestions",icon:"💡"},
  {id:"licences",label:"Licences",icon:"📋"},
  {id:"inscriptions",label:"Inscriptions",icon:"📝"},
  {id:"equipes",label:"Équipes",icon:"👥"},
  {id:"planning",label:"Planning",icon:"📅"},
  {id:"documents",label:"Documents",icon:"📁"}
];
function renderCustomShortcuts(){
  var container=document.getElementById("params-custom-list");
  if(!container) return;
  container.innerHTML="";
  getCustomShortcuts().forEach(function(sc){
    var target=SHORTCUT_TARGETS.find(function(t){return t.id===sc.target;});
    var block=document.createElement("div");
    block.className="param-block";
    block.dataset.sec="custom-"+sc.id;
    block.innerHTML='<div class="sec">'+authEsc(sc.label)+'</div>';
    var card=document.createElement("div");
    card.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow);cursor:pointer;display:flex;align-items:center;gap:12px";
    card.innerHTML='<span style="font-size:22px;flex-shrink:0">'+(target?target.icon:"⭐")+'</span>'+
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(sc.label)+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">Ouvre : '+(target?authEsc(target.label):"destination inconnue")+'</div></div>'+
      '<div style="color:var(--mut);font-size:18px">\u203a</div>';
    card.addEventListener("click",function(){
      if(PARAMS_EDIT_MODE) return;
      if(target) openAdminModule(target.id);
    });
    block.appendChild(card);
    container.appendChild(block);
  });
}
function openAddShortcutModal(){
  var modal=document.createElement("div");
  modal.className="shortcut-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:80vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px";
  hdr.innerHTML='<div style="font-size:15px;font-weight:800;color:var(--txt)">Nouveau raccourci</div>';
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(){modal.remove();});
  hdr.appendChild(closeBtn);
  var hint=document.createElement("div");
  hint.style.cssText="font-size:11px;color:var(--mut);margin-bottom:14px;line-height:1.4";
  hint.textContent="Choisir la page que ce raccourci doit ouvrir.";
  inner.appendChild(hdr);inner.appendChild(hint);
  SHORTCUT_TARGETS.forEach(function(t){
    var row=document.createElement("button");
    row.style.cssText="width:100%;display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border-radius:var(--rs);border:1.5px solid var(--bdr);background:var(--card);cursor:pointer;text-align:left";
    row.innerHTML='<span style="font-size:20px">'+t.icon+'</span><span style="font-size:13px;font-weight:700;color:var(--txt)">'+t.label+'</span>';
    row.addEventListener("click",function(){ modal.remove(); finishAddShortcut(t); });
    inner.appendChild(row);
  });
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
}
async function finishAddShortcut(target){
  var label=await askPrompt("Nom du raccourci",{defaultValue:target.label,confirmText:"Ajouter"});
  if(label===null) return;
  var list=getCustomShortcuts();
  list.push({id:Date.now().toString(),label:(label.trim()||target.label),target:target.id});
  saveCustomShortcuts(list);
  buildParametresLayout();
}

function wireThemeAnimSettings(prefix){
  prefix=prefix||"";
  var settings=taGetSettings();
  var enabledInp=document.getElementById(prefix+"ta-enabled");
  var styleMeteo=document.getElementById(prefix+"ta-style-meteo");
  var styleSaison=document.getElementById(prefix+"ta-style-saison");
  var cityInp=document.getElementById(prefix+"ta-city");
  var cityWrap=document.getElementById(prefix+"ta-city-wrap");
  if(!enabledInp) return;
  enabledInp.checked=settings.enabled;
  if(settings.style==="saison"){ styleSaison.checked=true; } else { styleMeteo.checked=true; }
  cityInp.value=settings.city;
  cityWrap.style.display=(settings.style==="saison")?"none":"block";
  var durInp=document.getElementById(prefix+"ta-dur-"+settings.duration);
  if(durInp) durInp.checked=true;

  // Rejoue l'animation immediatement en fond pour donner un retour visuel live du reglage
  function livePreview(){
    localStorage.removeItem("asmb_theme_anim_shown_date");
    ["home-hero-portal","home-hero-parent","home-hero-coach"].forEach(function(id){
      var h=document.getElementById(id);
      if(h){ h.querySelectorAll(".ta-flake,.ta-sun,.ta-cloud,.ta-drop,.ta-leaf,.ta-petal,.ta-moon,.ta-star").forEach(function(n){n.remove();}); delete h.dataset.taSpawned; }
    });
    maybeShowDailyThemeAnimation();
  }

  if(!enabledInp.dataset.wired){
    enabledInp.dataset.wired="1";
    enabledInp.addEventListener("change",function(){ taSaveSetting("enabled", enabledInp.checked?"on":"off"); livePreview(); });
    [styleMeteo,styleSaison].forEach(function(r){
      r.addEventListener("change",function(){
        taSaveSetting("style", r.value);
        cityWrap.style.display=(r.value==="saison")?"none":"block";
        livePreview();
      });
    });
    cityInp.addEventListener("change",function(){
      taSaveSetting("city", cityInp.value.trim()||"Saint-Étienne");
      localStorage.removeItem("asmb_theme_weather_cache"); // invalide le cache si la ville change
      livePreview();
    });
    ["5","10","15","continu"].forEach(function(v){
      var r=document.getElementById(prefix+"ta-dur-"+v);
      if(r) r.addEventListener("change",function(){ taSaveSetting("duration", v); livePreview(); });
    });
  }
}

function sendFeedback(prefix){
  prefix=prefix||"";
  var ta=document.getElementById(prefix+"feedback-text");
  var msg=(ta&&ta.value||"").trim();
  if(!msg){ alert("Ecrire un message avant d'envoyer."); return; }
  if(!window.fbDb || !window.fbAddDoc){ alert("Connexion en cours, reessayer dans quelques secondes."); return; }
  var btn=document.getElementById(prefix+"feedback-send-btn");
  if(btn){ btn.disabled=true; btn.textContent="Envoi..."; }
  var u=window.ASMB_USER||{};
  window.fbAddDoc(window.fbCollection(window.fbDb,"feedback"),{
    uid:u.uid||"", email:u.email||"", phone:u.phone||"",
    roles:u.roles||[], message:msg, status:"nouveau",
    ts:window.fbServerTimestamp()
  }).then(function(){
    if(ta) ta.value="";
    var st=document.getElementById(prefix+"feedback-status");
    if(st){ st.style.display="block"; setTimeout(function(){st.style.display="none";},3000); }
  }).catch(function(e){
    alert("Erreur d'envoi : "+((e&&e.code)||e));
  }).finally(function(){
    if(btn){ btn.disabled=false; btn.textContent="Envoyer"; }
  });
}

