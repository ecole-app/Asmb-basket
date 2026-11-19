/* ===== 14v-composition.js — Composition d'équipe (5 de départ + remplaçants) d'un match =====
   Stockage : ev.compo = {v:1, pos:{<idJoueur>:{x,y,l}}, bench:[<idJoueur>]} (x,y en fraction 0-1 du terrain,
   l = verrouillé). Aucune nouvelle collection : l'événement est déjà écrit par le staff.
   Activation : seniors = automatique ; autres catégories (U13 et +) = team.compo=true posé par le coach
   ou le dirigeant (confirmation au premier clic). Moins de U13 : pas de bouton (4 contre 4). */

var COMPO_DEFAUT=[[.5,.30],[.14,.40],[.86,.52],[.32,.62],[.66,.74]];
var compoEtat=null;

function compoEquipe(ev){ return typeof assidEquipeDeEvt==="function"?assidEquipeDeEvt(ev):null; }
function compoSenior(t){ return !!t && /senior/i.test(String(t.cat||t.name||"")); }
function compoDispo(t){ return !!t && (compoSenior(t) || posteVisible(t.cat||t.name)); }
function compoActive(t){ return compoSenior(t) || (t&&t.compo===true); }

// Bouton de la carte match (planning). Vide si l'équipe est trop jeune.
function compoBoutonCarte(e){
  if(!e||e.type!=="match"||e.cancelled) return "";
  var t=compoEquipe(e); if(!t||!compoDispo(t)) return "";
  return '<button onclick="compoOuvrir(\''+gmJs(e.id)+'\')" style="margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:rgba(232,103,10,.12);color:#E8670A;font-size:10px;font-weight:700;border:none;cursor:pointer">Composition'+(e.compo?" ✓":"")+'</button>';
}

function compoOuvrir(eid){
  var ev=getEvents().find(function(e){return e.id===eid;}); if(!ev) return;
  var t=compoEquipe(ev); if(!t) return;
  if(!compoActive(t)){
    askConfirm("Activer la composition d'équipe pour "+t.name+" ? Le coach place ses 5 de départ sur le terrain et gère les remplaçants.",{title:"Composition",confirmText:"Activer"}).then(function(ok){
      if(!ok) return;
      var ts=getTeams(); ts.forEach(function(x){ if(x.id===t.id) x.compo=true; }); saveTeams(ts);
      compoOuvrir(eid);
    });
    return;
  }
  var joueurs=getPlayersForEvent(ev);
  var conv=(ev.convocations||[]).map(String);
  if(conv.length) joueurs=joueurs.filter(function(p){return conv.indexOf(String(p.id))>=0;});
  if(!joueurs.length){ askAlert("Aucun joueur à placer : convoquez d'abord des joueurs pour ce match."); return; }
  var ids=joueurs.map(function(p){return String(p.id);});
  var c=ev.compo||{pos:{},bench:[]};
  var pos={}, bench=[];
  Object.keys(c.pos||{}).forEach(function(k){ if(ids.indexOf(k)>=0) pos[k]=c.pos[k]; });
  bench=(c.bench||[]).map(String).filter(function(k){return ids.indexOf(k)>=0&&!pos[k];});
  ids.forEach(function(k){
    if(pos[k]||bench.indexOf(k)>=0) return;
    var n=Object.keys(pos).length;
    if(n<5){ var d=COMPO_DEFAUT[n]; pos[k]={x:d[0],y:d[1],l:false}; } else bench.push(k);
  });
  compoEtat={eid:eid,titre:ev.titre||"",pos:pos,bench:bench,joueurs:joueurs,verrou:false,sale:false};
  compoPeindre();
}

function compoJoueur(id){ return compoEtat.joueurs.filter(function(p){return String(p.id)===String(id);})[0]||{}; }
function compoFond(id){ var i=0; String(id).split("").forEach(function(ch){i+=ch.charCodeAt(0);}); return KC[i%KC.length]; }

function compoPeindre(){
  var old=document.getElementById("compo-ecran"); if(old) old.remove();
  var s=compoEtat, o=document.createElement("div");
  o.id="compo-ecran";
  o.style.cssText="position:fixed;inset:0;z-index:350;background:var(--bg);display:flex;flex-direction:column;padding:max(12px,env(safe-area-inset-top)) 14px calc(12px + env(safe-area-inset-bottom)) 14px;box-sizing:border-box;touch-action:none";
  var h=document.createElement("div");
  h.style.cssText="display:flex;align-items:center;gap:8px;margin-bottom:8px";
  h.innerHTML='<button type="button" id="compo-x" style="width:32px;height:32px;border-radius:50%;border:0;background:var(--bdr);color:var(--mut);font-size:15px;cursor:pointer">✕</button>'+
    '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:var(--txt)">Composition</div><div style="font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(s.titre)+'</div></div>'+
    '<button type="button" id="compo-lock" style="padding:8px 12px;border-radius:20px;border:0;background:var(--bdr);color:var(--txt);font-size:12px;font-weight:800;cursor:pointer"></button>'+
    '<button type="button" id="compo-ok" style="padding:8px 14px;border-radius:20px;border:0;background:var(--dkg);color:#fff;font-size:12px;font-weight:800;cursor:pointer">Enregistrer</button>';
  o.appendChild(h);
  var cour=document.createElement("div");
  cour.id="compo-cour";
  cour.style.cssText="position:relative;flex:1;min-height:0;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#E9B26B,#D99A52);border:2px solid rgba(0,0,0,.25)";
  cour.innerHTML='<svg viewBox="0 0 100 130" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%" fill="none" stroke="rgba(255,255,255,.85)" stroke-width=".8">'+
    '<rect x="32" y="82" width="36" height="48"/><circle cx="50" cy="82" r="12"/><path d="M8 130 V104 A44 44 0 0 1 92 104 V130"/><path d="M42 124 H58"/><circle cx="50" cy="123" r="2.2"/><path d="M0 0 H100" /></svg>';
  o.appendChild(cour);
  var tit=document.createElement("div");
  tit.style.cssText="font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:10px 2px 6px";
  tit.textContent="Remplaçants";
  o.appendChild(tit);
  var banc=document.createElement("div");
  banc.id="compo-banc";
  banc.style.cssText="display:flex;gap:10px;overflow-x:auto;padding:4px 2px;min-height:78px";
  o.appendChild(banc);
  document.body.appendChild(o);
  document.getElementById("compo-x").onclick=compoFermer;
  document.getElementById("compo-ok").onclick=compoEnregistrer;
  document.getElementById("compo-lock").onclick=function(){
    s.verrou=!s.verrou; Object.keys(s.pos).forEach(function(k){s.pos[k].l=s.verrou;}); s.sale=true; compoPeindre();
  };
  document.getElementById("compo-lock").textContent=s.verrou?"🔓 Tout déverrouiller":"🔒 Tout verrouiller";
  Object.keys(s.pos).forEach(function(k){ compoPion(cour,k); });
  compoBancPeindre();
}

function compoBulle(id,taille){
  var p=compoJoueur(id), d=document.createElement("div");
  d.style.cssText="width:"+taille+"px;text-align:center;touch-action:none;user-select:none;-webkit-user-select:none";
  var av=joueurAvatarHtml(p,compoFond(id));
  d.innerHTML='<div style="width:'+(taille-14)+'px;height:'+(taille-14)+'px;margin:0 auto;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);position:relative">'+
    av.replace('class="player-avatar"','class="player-avatar" data-cav')+'</div>'+
    '<div style="margin-top:2px;font-size:11px;font-weight:800;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(p.prenom||"")+'</div>';
  var a=d.querySelector("[data-cav]"); if(a){ a.style.cssText+=";width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff"; }
  return d;
}

function compoPion(cour,id){
  var s=compoEtat, c=s.pos[id], T=64;
  var d=compoBulle(id,T); d.dataset.id=id;
  d.style.position="absolute"; d.style.cursor="grab"; d.style.zIndex=2;
  function place(){ var W=cour.clientWidth-T, H=cour.clientHeight-T; d.style.left=Math.round(c.x*W)+"px"; d.style.top=Math.round(c.y*H)+"px"; }
  function cad(){ var k=d.querySelector(".cad"); if(k) k.remove(); if(c.l){ var e=document.createElement("div"); e.className="cad"; e.textContent="🔒"; e.style.cssText="position:absolute;right:-4px;top:-4px;font-size:12px;background:#fff;border-radius:50%;width:18px;height:18px;line-height:18px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.4)"; d.firstChild.style.overflow="visible"; d.firstChild.appendChild(e); } }
  cour.appendChild(d); place(); cad();
  requestAnimationFrame(place);
  var dep=null;
  d.addEventListener("pointerdown",function(e){
    d.setPointerCapture(e.pointerId);
    dep={x:e.clientX,y:e.clientY,bouge:false};
  });
  d.addEventListener("pointermove",function(e){
    if(!dep) return;
    if(Math.abs(e.clientX-dep.x)+Math.abs(e.clientY-dep.y)>6) dep.bouge=true;
    if(!dep.bouge||c.l) return;
    var r=cour.getBoundingClientRect(), W=r.width-T, H=r.height-T;
    var rx=e.clientX-r.left-T/2, ry=e.clientY-r.top-T/2;
    var bord=rx<-6||rx>W+6||ry<-6||ry>H+6;
    c.x=Math.max(0,Math.min(1,rx/W)); c.y=Math.max(0,Math.min(1,ry/H)); place();
    var banc=document.getElementById("compo-banc");
    if(banc) banc.classList.toggle("compo-vibre",bord);
    var cible=bord?compoCible(e):null;
    banc.querySelectorAll("[data-bid]").forEach(function(b){ b.style.outline=(cible&&b.dataset.bid===cible)?"3px solid #fff":"none"; });
    dep.cible=cible;
  });
  d.addEventListener("pointerup",function(e){
    if(!dep) return;
    var f=dep; dep=null;
    var banc=document.getElementById("compo-banc"); if(banc) banc.classList.remove("compo-vibre");
    if(!f.bouge){ c.l=!c.l; s.sale=true; cad(); return; }
    var cible=compoCible(e);
    if(cible){
      var i=s.bench.indexOf(cible);
      if(i>=0){ s.bench[i]=id; s.pos[cible]={x:c.x,y:c.y,l:false}; delete s.pos[id]; s.sale=true; compoPeindre(); return; }
    }
    s.sale=true;
  });
}

function compoCible(e){
  var r=null, bs=document.querySelectorAll("#compo-banc [data-bid]");
  for(var i=0;i<bs.length;i++){ var q=bs[i].getBoundingClientRect(); if(e.clientX>=q.left&&e.clientX<=q.right&&e.clientY>=q.top-20&&e.clientY<=q.bottom+20){ r=bs[i].dataset.bid; break; } }
  return r;
}

function compoBancPeindre(){
  var s=compoEtat, banc=document.getElementById("compo-banc"); banc.innerHTML="";
  if(!document.getElementById("compo-css")){
    var st=document.createElement("style"); st.id="compo-css";
    st.textContent="@keyframes compoVib{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}.compo-vibre>[data-bid]{animation:compoVib .25s infinite}";
    document.head.appendChild(st);
  }
  if(!s.bench.length){ banc.innerHTML='<div style="font-size:12px;color:var(--mut);padding:10px 0">Aucun remplaçant convoqué.</div>'; return; }
  s.bench.forEach(function(id){
    var w=document.createElement("div"); w.dataset.bid=id; w.style.cssText="flex:none;border-radius:12px;padding:4px;background:#B9742F";
    w.appendChild(compoBulle(id,64)); banc.appendChild(w);
  });
}

function compoFermer(){
  var s=compoEtat;
  var fin=function(){ var o=document.getElementById("compo-ecran"); if(o) o.remove(); compoEtat=null; };
  if(s&&s.sale){ askConfirm("Quitter sans enregistrer la composition ?",{title:"Composition",confirmText:"Quitter",danger:true}).then(function(ok){ if(ok) fin(); }); }
  else fin();
}

function compoEnregistrer(){
  var s=compoEtat, evs=getEvents(), ev=evs.find(function(e){return e.id===s.eid;}); if(!ev) return;
  ev.compo={v:1,pos:s.pos,bench:s.bench};
  saveEvents(evs);
  s.sale=false;
  showToast("Composition enregistrée");
  var o=document.getElementById("compo-ecran"); if(o) o.remove(); compoEtat=null;
  if(typeof buildPlanning==="function") try{ buildPlanning(); }catch(e){}
}
