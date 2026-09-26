/* ===== 09-ui-modales.js — Modales maison : confirmation, saisie, alerte ===== */
// ── CONFIRMATION MAISON (remplace confirm() du navigateur) ────────
// askConfirm(message, {title, confirmText, cancelText, danger}) -> Promise<boolean>
function askConfirm(message, opts){
  opts=opts||{};
  var title=opts.title||"Confirmer";
  var confirmText=opts.confirmText||"Confirmer";
  var cancelText=opts.cancelText||"Annuler";
  var danger=!!opts.danger;
  return new Promise(function(resolve){
    var modal=document.createElement("div");
    modal.className="confirm-modal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:24px";
    var box=document.createElement("div");
    box.style.cssText="background:#fff;border-radius:18px;padding:22px 20px 18px;width:100%;max-width:340px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center";
    box.addEventListener("click",function(e){e.stopPropagation();});
    var titleEl=document.createElement("div");
    titleEl.style.cssText="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:6px";
    titleEl.textContent=title;
    var subEl=document.createElement("div");
    subEl.style.cssText="font-size:13px;color:var(--txt2);line-height:1.45;margin-bottom:20px;white-space:pre-line";
    subEl.textContent=message;
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:10px";
    var cancelBtn=document.createElement("button");
    cancelBtn.textContent=cancelText;
    cancelBtn.style.cssText="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:1.5px solid var(--bdr);background:var(--bg);color:var(--txt);cursor:pointer";
    var okBtn=document.createElement("button");
    okBtn.textContent=confirmText;
    okBtn.style.cssText="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;color:#fff;cursor:pointer;background:"+(danger?"var(--red)":"var(--dkg)");
    function finish(result){ modal.remove(); resolve(result); }
    cancelBtn.addEventListener("click",function(){finish(false);});
    okBtn.addEventListener("click",function(){finish(true);});
    modal.addEventListener("click",function(){finish(false);});
    btnRow.appendChild(cancelBtn);btnRow.appendChild(okBtn);
    box.appendChild(titleEl);box.appendChild(subEl);box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
  });
}

// askPrompt(title, {placeholder, defaultValue, confirmText, type}) -> Promise<string|null>
function askPrompt(title, opts){
  opts=opts||{};
  var placeholder=opts.placeholder||"";
  var defaultValue=opts.defaultValue||"";
  var confirmText=opts.confirmText||"Valider";
  var type=opts.type||"text";
  return new Promise(function(resolve){
    var modal=document.createElement("div");
    modal.className="prompt-modal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:24px";
    var box=document.createElement("div");
    box.style.cssText="background:#fff;border-radius:18px;padding:22px 20px 18px;width:100%;max-width:340px;box-shadow:0 10px 30px rgba(0,0,0,.25)";
    box.addEventListener("click",function(e){e.stopPropagation();});
    var titleEl=document.createElement("div");
    titleEl.style.cssText="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:14px;text-align:center";
    titleEl.textContent=title;
    var input=document.createElement("input");
    input.type=type;
    input.placeholder=placeholder;
    input.value=defaultValue;
    input.style.cssText="width:100%;padding:12px;border:1.5px solid var(--bdr);border-radius:12px;font-size:15px;background:var(--bg);color:var(--txt);outline:none;margin-bottom:18px";
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:10px";
    var cancelBtn=document.createElement("button");
    cancelBtn.textContent="Annuler";
    cancelBtn.style.cssText="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:1.5px solid var(--bdr);background:var(--bg);color:var(--txt);cursor:pointer";
    var okBtn=document.createElement("button");
    okBtn.textContent=confirmText;
    okBtn.style.cssText="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;color:#fff;cursor:pointer;background:var(--dkg)";
    function finish(result){ modal.remove(); resolve(result); }
    cancelBtn.addEventListener("click",function(){finish(null);});
    okBtn.addEventListener("click",function(){finish(input.value);});
    input.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();finish(input.value);}});
    modal.addEventListener("click",function(){finish(null);});
    btnRow.appendChild(cancelBtn);btnRow.appendChild(okBtn);
    box.appendChild(titleEl);box.appendChild(input);box.appendChild(btnRow);
    modal.appendChild(box);
    document.body.appendChild(modal);
    setTimeout(function(){input.focus();},50);
  });
}

// askAlert(message, {title}) -> Promise<void> (résolu quand l'utilisateur clique OK)
function askAlert(message, opts){
  opts=opts||{};
  var title=opts.title||"Information";
  return new Promise(function(resolve){
    var modal=document.createElement("div");
    modal.className="alert-modal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:500;display:flex;align-items:center;justify-content:center;padding:24px";
    var box=document.createElement("div");
    box.style.cssText="background:#fff;border-radius:18px;padding:22px 20px 18px;width:100%;max-width:340px;box-shadow:0 10px 30px rgba(0,0,0,.25);text-align:center";
    box.addEventListener("click",function(e){e.stopPropagation();});
    var titleEl=document.createElement("div");
    titleEl.style.cssText="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:6px";
    titleEl.textContent=title;
    var subEl=document.createElement("div");
    subEl.style.cssText="font-size:13px;color:var(--txt2);line-height:1.45;margin-bottom:20px;white-space:pre-line";
    subEl.textContent=String(message);
    var okBtn=document.createElement("button");
    okBtn.textContent="OK";
    okBtn.style.cssText="width:100%;padding:12px;border-radius:12px;font-size:14px;font-weight:700;border:none;color:#fff;cursor:pointer;background:var(--dkg)";
    function finish(){ modal.remove(); resolve(); }
    okBtn.addEventListener("click",finish);
    modal.addEventListener("click",finish);
    box.appendChild(titleEl);box.appendChild(subEl);box.appendChild(okBtn);
    modal.appendChild(box);
    document.body.appendChild(modal);
  });
}
// Remplace l'alert() natif du navigateur par la modale maison (non bloquant, ne change pas le flux existant)
window.alert = function(message){ askAlert(message); };

function authConfirmLogout(){
  askConfirm("Se déconnecter de l'application ?", {title:"Déconnexion", confirmText:"Se déconnecter"}).then(function(ok){
    if(ok) authLogout();
  });
}

function toggleNotifType(type,checked){
  localStorage.setItem("asmb_notif_"+type,checked?"on":"off");
}

function buildClubStats(){
  var el=document.getElementById("club-stats-box");
  if(!el)return;
  var players=getPlayers();
  var CATS_ALL=["U7","U9","U11","U13","U15","U17","U18","U21","Senior","Loisir","3x3"];
  var byCat={};
  CATS_ALL.forEach(function(c){byCat[c]=0;});
  players.forEach(function(p){if(byCat.hasOwnProperty(p.cat))byCat[p.cat]++;});
  var licencies=players.filter(function(p){return p.licence==="ok";}).length;

  var allEvents=getEvents().filter(function(e){return e.presences&&Object.keys(e.presences).length;});
  var totalPres=0,totalSlots=0;
  allEvents.forEach(function(e){
    Object.keys(e.presences).forEach(function(k){totalSlots++;if(e.presences[k]==="present")totalPres++;});
  });
  var avgPresence=totalSlots?Math.round(totalPres/totalSlots*100):0;

  var html='<div style="display:flex;align-items:center;justify-content:space-around;text-align:center;margin-bottom:16px">'+
    '<div><div style="font-size:24px;font-weight:900;color:var(--dkg)">'+players.length+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Licenciés total</div></div>'+
    '<div style="width:1px;height:38px;background:var(--bdr)"></div>'+
    '<div><div style="font-size:24px;font-weight:900;color:#D4AF37">'+licencies+'</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Licences validees</div></div>'+
    '<div style="width:1px;height:38px;background:var(--bdr)"></div>'+
    '<div><div style="font-size:24px;font-weight:900;color:var(--txt)">'+avgPresence+'%</div><div style="font-size:10px;color:var(--mut);margin-top:2px">Assiduité moyenne</div></div>'+
  '</div>';

  html+='<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Répartition par catégorie</div>';
  CATS_ALL.forEach(function(c){
    var count=byCat[c];
    if(count===0)return;
    var pct=Math.round(count/players.length*100)||0;
    html+='<div style="margin-bottom:8px"><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:3px"><span style="color:var(--txt);font-weight:600">'+c+'</span><span style="color:var(--mut)">'+count+'</span></div><div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%"></div></div></div>';
  });
  if(!players.length){html+='<div style="font-size:11px;color:var(--mut);text-align:center;padding:10px 0">Aucune donnée pour le moment</div>';}

  el.innerHTML=html;
}

function toggleNotif(checked){
  if(checked&&"Notification" in window){
    Notification.requestPermission().then(function(perm){
      if(perm==="granted"){localStorage.setItem("asmb_notif","on");new Notification("ASMB",{body:"Notifications activees !"});}
      else{localStorage.setItem("asmb_notif","off");document.getElementById("notif-toggle").checked=false;alert("Permission refusée");}
    });
  } else {
    localStorage.setItem("asmb_notif","off");
  }
}

