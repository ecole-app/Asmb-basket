/* ===== 17d-poles-club.js — Pôles créés / masqués par le dirigeant du club ===== */
// clubs/{clubId}.polesCustom = [{id:"pc_xxxx",name,sub,about,icon,color}] (créés par le dirigeant)
// clubs/{clubId}.polesMasques = ["3x3",...] (pôles d'origine cachés pour ce club seulement, jamais effacés)
// Gestion réservée au dirigeant, sur ordinateur. Un pôle créé = une page de présentation.
var POLES_CLUB_COULEURS=["#1A2E5A","#C0392B","#E8670A","#8E44AD","#16A085","#0E7490","#1a6b30","#B8860B"];
var POLES_CLUB_MAX=12;
function polesClubCustom(){ var c=window.CURRENT_CLUB; return (c&&Array.isArray(c.polesCustom))?c.polesCustom.filter(function(p){ return p&&typeof p.id==="string"&&typeof p.name==="string"; }):[]; }
function polesClubMasques(){ var c=window.CURRENT_CLUB; return (c&&Array.isArray(c.polesMasques))?c.polesMasques.filter(function(x){ return typeof x==="string"; }):[]; }
function polesClubObjets(){
  return polesClubCustom().map(function(p){ return {id:p.id,name:p.name,sub:p.sub||"",desc:p.sub||"",icon:p.icon||"📌",color:p.color||"#1A2E5A",about:p.about||"",items:[],ready:true,custom:true}; });
}
function polesClubGerable(){
  return localStorage.getItem("asmb_profile")==="dirigeant" && typeof gmDeskOn==="function" && gmDeskOn() && !(typeof isLimite==="function"&&isLimite()&&!(typeof isSuperAdmin==="function"&&isSuperAdmin()));
}
function polesClubSauver(champs){
  return window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),champs).then(function(){
    if(window.CURRENT_CLUB) Object.keys(champs).forEach(function(k){ window.CURRENT_CLUB[k]=champs[k]; });
    if(typeof buildPortal==="function") buildPortal();
  });
}
function polesClubErreur(e){ askAlert("Enregistrement impossible ("+((e&&e.code)||"réseau")+"). Réessayez."); }

// Page d'un pôle créé : écran unique réutilisé.
function polesClubOuvrir(id){
  var p=polesClubObjets().filter(function(x){ return x.id===id; })[0]; if(!p) return;
  var host=document.getElementById("scr-pole-3x3"); if(!host) return;
  var s=document.getElementById("scr-pole-custom");
  if(!s){ s=document.createElement("div"); s.className="scr"; s.id="scr-pole-custom"; host.parentNode.appendChild(s); }
  var h='<div style="padding:14px 16px;border-bottom:1px solid var(--bdr)"><div style="font-size:16px;font-weight:800;color:var(--txt)">'+authEsc(p.icon+" "+p.name)+'</div>'+(p.sub?'<div style="font-size:11px;color:var(--mut)">'+authEsc(p.sub)+'</div>':'')+'</div>';
  h+='<div style="margin:12px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid '+authEsc(p.color)+';border-radius:var(--rs);padding:14px;font-size:13px;line-height:1.5;color:var(--txt2)">'+(p.about?authEsc(p.about).replace(/\n/g,"<br>"):'<i>Aucune description.</i>')+'</div>';
  if(polesClubGerable()) h+='<div style="margin:0 12px 80px"><button onclick="polesClubSupprimer(\''+gmJs(p.id)+'\')" style="padding:10px 16px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:12px;font-weight:700;border:none;cursor:pointer">Supprimer ce pôle</button></div>';
  s.innerHTML=h;
  stack.push("pole-custom"); showScr("pole-custom");
}

async function polesClubCreer(apres){
  if(polesClubCustom().length>=POLES_CLUB_MAX){ askAlert("Maximum "+POLES_CLUB_MAX+" pôles créés."); return; }
  var nom=await askPrompt("Nom du nouveau pôle",{placeholder:"Ex : Basket féminin",confirmText:"Suivant"});
  nom=(nom||"").trim().slice(0,40); if(!nom) return;
  var about=await askPrompt("Description (facultatif)",{placeholder:"À quoi sert ce pôle ?",confirmText:"Créer"});
  var liste=polesClubCustom().slice();
  liste.push({id:"pc_"+Date.now().toString(36)+Math.floor(Math.random()*1296).toString(36),name:nom,about:(about||"").trim().slice(0,600),icon:"📌",color:POLES_CLUB_COULEURS[liste.length%POLES_CLUB_COULEURS.length]});
  polesClubSauver({polesCustom:liste}).then(function(){ showToast("Pôle créé"); if(apres) apres(); }).catch(polesClubErreur);
}
async function polesClubSupprimer(id,apres){
  var p=polesClubCustom().filter(function(x){ return x.id===id; })[0]; if(!p) return;
  var ok=await askConfirm("Supprimer définitivement le pôle « "+p.name+" » ?\n\nCette action est irréversible.",{danger:true,confirmText:"Supprimer"});
  if(!ok) return;
  var ch={polesCustom:polesClubCustom().filter(function(x){ return x.id!==id; })};
  var pc=window.CURRENT_CLUB&&window.CURRENT_CLUB.polesCoachs;
  if(pc&&pc[id]){ var m=Object.assign({},pc); delete m[id]; ch.polesCoachs=m; }
  polesClubSauver(ch).then(function(){ showToast("Pôle supprimé"); if(!apres){ stack=["portal"]; showScr("portal"); } else apres(); }).catch(polesClubErreur);
}
function polesClubMasquer(id,masquer,apres){
  var l=polesClubMasques().filter(function(x){ return x!==id; });
  if(masquer) l.push(id);
  polesClubSauver({polesMasques:l}).then(function(){ if(apres) apres(); }).catch(polesClubErreur);
}

// Fenêtre « Gérer les pôles » (accueil du dirigeant, ordinateur seulement).
function polesClubGerer(){
  var ex=document.getElementById("modal-poles-club"); if(ex) ex.remove();
  var m=document.createElement("div"); m.id="modal-poles-club";
  m.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:300;display:flex;align-items:center;justify-content:center;padding:24px";
  m.onclick=function(){ m.remove(); };
  var b=document.createElement("div");
  b.style.cssText="background:var(--card);border-radius:18px;padding:20px;width:100%;max-width:460px;max-height:calc(85*var(--vh,1vh));overflow:auto;box-shadow:0 10px 30px rgba(0,0,0,.25)";
  b.onclick=function(e){ e.stopPropagation(); };
  m.appendChild(b); document.body.appendChild(m);
  var redo=function(){ polesClubGerer(); };
  var ligne=function(p,btnTxt,fn,danger){
    var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr)";
    var t=document.createElement("div"); t.style.cssText="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--txt)"; t.textContent=(p.icon||"")+" "+p.name;
    var x=document.createElement("button"); x.textContent=btnTxt; x.style.cssText="padding:6px 12px;border-radius:var(--rx);border:none;cursor:pointer;font-size:11px;font-weight:700;"+(danger?"background:rgba(192,57,43,.1);color:var(--red)":"background:var(--bdr);color:var(--txt)");
    x.onclick=fn; r.appendChild(t); r.appendChild(x); b.appendChild(r);
  };
  var tit=document.createElement("div"); tit.style.cssText="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:6px"; tit.textContent="Gérer les pôles"; b.appendChild(tit);
  var masq=polesClubMasques();
  var visibles=activePoles();
  visibles.forEach(function(p){
    if(p.custom) ligne(p,"Supprimer",function(){ m.remove(); polesClubSupprimer(p.id,redo); },true);
    else ligne(p,"Masquer",function(){ polesClubMasquer(p.id,true,redo); });
  });
  var caches=POLES.filter(function(p){ return masq.indexOf(p.id)>=0; });
  if(caches.length){
    var h=document.createElement("div"); h.style.cssText="font-size:11px;font-weight:800;color:var(--mut);margin:14px 0 2px;text-transform:uppercase"; h.textContent="Masqués"; b.appendChild(h);
    caches.forEach(function(p){ ligne(p,"Restaurer",function(){ polesClubMasquer(p.id,false,redo); }); });
  }
  var row=document.createElement("div"); row.style.cssText="display:flex;gap:8px;margin-top:16px";
  var n=document.createElement("button"); n.textContent="+ Nouveau pôle"; n.style.cssText="flex:1;padding:11px;border-radius:var(--rx);border:none;cursor:pointer;background:var(--dkg);color:#fff;font-size:13px;font-weight:800";
  n.onclick=function(){ m.remove(); polesClubCreer(redo); };
  var f=document.createElement("button"); f.textContent="Fermer"; f.style.cssText="padding:11px 16px;border-radius:var(--rx);border:none;cursor:pointer;background:var(--bdr);color:var(--txt);font-size:13px;font-weight:700";
  f.onclick=function(){ m.remove(); };
  row.appendChild(n); row.appendChild(f); b.appendChild(row);
}
// Bouton en bas des cartes de l'accueil.
function polesClubBouton(el){
  if(!el||!polesClubGerable()) return;
  var d=document.createElement("div"); d.style.cssText="padding:6px 12px 0";
  d.innerHTML='<button onclick="polesClubGerer()" style="padding:9px 14px;border-radius:var(--rx);border:1.5px dashed var(--bdr);background:transparent;color:var(--mut);font-size:12px;font-weight:700;cursor:pointer">⚙ Gérer les pôles</button>';
  el.appendChild(d);
}
