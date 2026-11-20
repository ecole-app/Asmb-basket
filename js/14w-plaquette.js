/* ===== 14w-plaquette.js — Plaquette du coach (tableau tactique plein écran) =====
   Bouton « Plaquette » sur les cartes match/entraînement du planning (clubs de basket).
   Terrain FIBA en SVG (unités = décimètres, 28 × 15 m), logo du club dans le rond central.
   Téléphone : terrain complet dans la longueur de l'écran ; ordinateur : en largeur (ou demi-terrain).
   Pions = joueurs présents (convoqués, sans les absents), 5 sur le terrain (ceux de la composition
   s'il y en a une), les autres sur le banc ; un ballon. Stylo, surligneur, gomme, 4 couleurs, annuler.
   Rien n'est enregistré ni envoyé : c'est une ardoise pour le coach (temps mort, causerie). */

var plqEtat=null;

function plqSportOk(){
  var s=String((window.CURRENT_CLUB&&window.CURRENT_CLUB.sport)||"basket").toLowerCase();
  return s.indexOf("basket")>=0;
}

// Bouton de la carte du planning (matchs et entraînements non annulés, clubs de basket).
function plqBoutonCarte(e){
  if(!e||e.cancelled||(e.type!=="match"&&e.type!=="entrainement")) return "";
  if(!plqSportOk()) return "";
  return '<button onclick="plqOuvrir(\''+gmJs(e.id)+'\')" style="margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:color-mix(in srgb, var(--dkg) 12%, transparent);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer">Plaquette</button>';
}

// Joueurs présents : ceux de l'équipe, limités aux convoqués s'il y en a, sans les absents.
function plqJoueurs(ev){
  var j=typeof getPlayersForEvent==="function"?getPlayersForEvent(ev):[];
  var conv=(ev.convocations||[]).map(String);
  if(conv.length) j=j.filter(function(p){return conv.indexOf(String(p.id))>=0;});
  var pr=ev.presences||{};
  j=j.filter(function(p){return pr[p.id]!=="absent";});
  // Les 5 de la composition d'abord, s'il y en a une.
  var cinq=ev.compo&&ev.compo.pos?Object.keys(ev.compo.pos).map(String):[];
  if(cinq.length){
    j=j.slice().sort(function(a,b){
      var ia=cinq.indexOf(String(a.id)), ib=cinq.indexOf(String(b.id));
      return (ia<0?99:ia)-(ib<0?99:ib);
    });
  }
  return j;
}

function plqTel(){ return window.innerWidth<700; }
function plqVertical(){ return !!plqEtat && plqEtat.complet && plqTel(); }

function plqOuvrir(eid){
  var ev=getEvents().find(function(e){return e.id===eid;}); if(!ev) return;
  plqFermer();
  plqEtat={eid:eid, titre:ev.titre||"", joueurs:plqJoueurs(ev), complet:plqTel(), outil:"move", couleur:"#111111", traits:[], courant:null, pions:[]};
  plqPeindre();
}

/* ---------- terrain ---------- */
function plqL(w){ return 'fill="none" stroke="#fff" stroke-width="'+(w||.6)+'"'; }
// Demi-terrain vertical, ligne de fond en haut : 150 de large, 140 jusqu'à la ligne médiane.
function plqDemi(){
  var L=plqL;
  var marques=[17.5,26,34.5,43].map(function(y){ return '<line x1="49.5" y1="'+y+'" x2="50.5" y2="'+y+'" '+L(.5)+'/><line x1="99.5" y1="'+y+'" x2="100.5" y2="'+y+'" '+L(.5)+'/>'; }).join("");
  return '<rect x="50.5" y="0" width="49" height="58" fill="var(--dkg)" fill-opacity=".85"/>'+
    '<rect x="50.5" y="0" width="49" height="58" '+L()+'/>'+marques+
    '<path d="M 57 58 A 18 18 0 0 0 93 58" '+L()+'/>'+
    '<path d="M 57 58 A 18 18 0 0 1 93 58" '+L()+' stroke-dasharray="2.4 2"/>'+
    '<path d="M 9 0 L 9 29.9 A 67.5 67.5 0 0 0 141 29.9 L 141 0" '+L()+'/>'+
    '<path d="M 62.5 12 L 62.5 15.75 A 12.5 12.5 0 0 0 87.5 15.75 L 87.5 12" '+L(.5)+'/>'+
    '<line x1="66" y1="12" x2="84" y2="12" stroke="#fff" stroke-width="1.1"/>'+
    '<line x1="75" y1="12" x2="75" y2="13.5" '+L(.6)+'/>'+
    '<circle cx="75" cy="15.75" r="2.25" fill="none" stroke="#e8670a" stroke-width=".7"/>';
}
function plqRond(cx,cy){
  var src=typeof clubLogo==="function"?clubLogo():null, centre;
  if(src && /^data:image\/|^https:\/\//.test(String(src))){
    centre='<clipPath id="plqClip"><circle cx="'+cx+'" cy="'+cy+'" r="16.5"/></clipPath>'+
      '<image href="'+authEsc(src)+'" x="'+(cx-15)+'" y="'+(cy-15)+'" width="30" height="30" clip-path="url(#plqClip)" preserveAspectRatio="xMidYMid meet"/>';
  } else {
    var ini=typeof clubInitiales==="function"?clubInitiales():"";
    centre='<text x="'+cx+'" y="'+(cy+4)+'" text-anchor="middle" font-size="11" font-weight="900" fill="#fff" font-family="system-ui,sans-serif">'+authEsc(ini)+'</text>';
  }
  return '<circle cx="'+cx+'" cy="'+cy+'" r="18" fill="var(--dkg)" fill-opacity=".85"/>'+centre+'<circle cx="'+cx+'" cy="'+cy+'" r="18" '+plqL()+'/>';
}
function plqParquet(rot){
  return '<defs><pattern id="plqPq" width="7.2" height="120" patternUnits="userSpaceOnUse"'+(rot?' patternTransform="rotate(90)"':'')+'>'+
    '<rect width="7.2" height="120" fill="#d7a46a"/>'+
    '<rect x="2.4" width="2.4" height="120" fill="#000" fill-opacity=".045"/>'+
    '<rect x="4.8" width="2.4" height="120" fill="#fff" fill-opacity=".05"/>'+
    '<path d="M2.4 0V120M4.8 0V120M7.2 0V120" stroke="#5a3a17" stroke-opacity=".16" stroke-width=".18"/>'+
    '<path d="M0 31H2.4M2.4 78H4.8M4.8 12H7.2M0 96H2.4M4.8 58H7.2M2.4 18H4.8" stroke="#5a3a17" stroke-opacity=".2" stroke-width=".2"/>'+
    '</pattern></defs>';
}
// [largeur, hauteur] du terrain dans la vue courante (unités SVG).
function plqVue(){ return plqVertical()?[150,280]:(plqEtat.complet?[280,150]:[150,160]); }
function plqTerrainSvg(){
  var v=plqVue(), w=v[0], h=v[1], fond;
  if(plqVertical()){
    fond=plqParquet(false)+'<rect width="150" height="280" fill="url(#plqPq)"/>'+
      plqDemi()+'<g transform="translate(150,280) rotate(180)">'+plqDemi()+'</g>'+
      '<line x1="0" y1="140" x2="150" y2="140" '+plqL()+'/>'+plqRond(75,140)+
      '<rect x=".3" y=".3" width="149.4" height="279.4" '+plqL()+'/>';
  } else if(plqEtat.complet){
    fond=plqParquet(true)+'<rect width="280" height="150" fill="url(#plqPq)"/>'+
      '<g transform="translate(0,150) rotate(-90)">'+plqDemi()+'</g>'+
      '<g transform="translate(280,0) rotate(90)">'+plqDemi()+'</g>'+
      '<line x1="140" y1="0" x2="140" y2="150" '+plqL()+'/>'+plqRond(140,75)+
      '<rect x=".3" y=".3" width="279.4" height="149.4" '+plqL()+'/>';
  } else {
    fond=plqParquet(false)+'<rect width="150" height="160" fill="url(#plqPq)"/>'+
      plqDemi()+'<line x1="0" y1="140" x2="150" y2="140" '+plqL()+'/>'+plqRond(75,140)+
      '<path d="M .3 160 V .3 H 149.7 V 160" '+plqL()+'/>';
  }
  return '<svg viewBox="0 0 '+w+' '+h+'" style="display:block;width:100%;height:100%" role="img" aria-label="Terrain de basket">'+fond+'</svg>';
}

/* ---------- écran ---------- */
function plqCss(){
  if(document.getElementById("plq-css")) return;
  var st=document.createElement("style"); st.id="plq-css";
  st.textContent=
    "#plq-ecran button{font:inherit;color:var(--txt);background:transparent;border:0;border-radius:10px;padding:8px 10px;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px;min-height:38px}"+
    "#plq-ecran button[aria-pressed=true]{background:var(--dkg);color:#fff}"+
    "#plq-ecran button:disabled{opacity:.35;cursor:default}"+
    "#plq-ecran .plq-grp{display:flex;gap:3px;background:var(--card);border:1px solid var(--bdr);border-radius:13px;padding:3px}"+
    "#plq-ecran .plq-sw{width:28px;height:28px;min-height:28px;padding:0;border-radius:50%;border:2px solid var(--card);box-shadow:0 0 0 1px var(--bdr);margin:5px 3px}"+
    "#plq-ecran .plq-sw[aria-pressed=true]{box-shadow:0 0 0 3px var(--dkg)}"+
    "#plq-ecran .plq-pion{position:absolute;width:40px;height:40px;margin:-20px 0 0 -20px;border-radius:50%;background:var(--dkg);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:grab;z-index:5;touch-action:none}"+
    "#plq-ecran .plq-pion small{position:absolute;top:100%;margin-top:1px;font-size:10px;font-weight:700;color:var(--txt);white-space:nowrap;text-shadow:0 0 3px var(--bg),0 0 3px var(--bg)}"+
    "#plq-ecran .plq-pion.plq-ballon{width:28px;height:28px;margin:-14px 0 0 -14px;background:#e8670a;border:2px solid #fff;z-index:6}"+
    "#plq-ecran .plq-pion.plq-drag{cursor:grabbing;transform:scale(1.12)}"+
    "#plq-ecran .plq-dessin .plq-pion{pointer-events:none}"+
    "#plq-ecran .plq-dessin canvas{cursor:crosshair}"+
    "#plq-ecran .plq-move canvas{pointer-events:none}"+
    "@media (max-width:699px){#plq-ecran .plq-lib{display:none}#plq-outils button,#plq-actions button{padding:6px 7px;font-size:15px}#plq-ecran .plq-sw{width:24px;height:24px;min-height:24px;margin:6px 2px}}";
  document.head.appendChild(st);
}

function plqPeindre(){
  plqCss();
  var s=plqEtat, o=document.createElement("div");
  o.id="plq-ecran";
  o.style.cssText="position:fixed;inset:0;z-index:950;background:var(--bg);display:flex;flex-direction:column;gap:8px;padding:max(10px,env(safe-area-inset-top)) 10px calc(10px + env(safe-area-inset-bottom)) 10px;box-sizing:border-box;user-select:none;-webkit-user-select:none";
  var outils=[["move","✋","Déplacer"],["stylo","✏️","Stylo"],["marqueur","🖍","Surligneur"],["gomme","🧽","Gomme"]];
  var encres=[["#111111","Noir"],["#d6322a","Rouge"],["#1f5fd1","Bleu"],["#1c9a4a","Vert"]];
  o.innerHTML=
    '<div style="display:flex;align-items:center;gap:8px">'+
      '<button type="button" id="plq-x" aria-label="Fermer" style="width:36px;height:36px;min-height:36px;border-radius:50%;background:var(--bdr);color:var(--mut);justify-content:center;padding:0;font-size:15px">✕</button>'+
      '<div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:var(--txt)">Plaquette</div>'+
        '<div data-notr style="font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(s.titre)+'</div></div>'+
      '<div class="plq-grp"><button type="button" id="plq-vue"></button></div>'+
    '</div>'+
    '<div id="plq-zone" style="flex:1;min-height:0;display:flex;align-items:center;justify-content:center">'+
      '<div id="plq-stage" class="plq-move" style="position:relative;background:var(--card);border:1px solid var(--bdr);border-radius:14px;overflow:hidden;touch-action:none">'+
        '<div id="plq-court" style="position:relative;width:100%"></div>'+
        '<div id="plq-banc" style="position:relative;border-top:1px dashed var(--bdr)"><span style="position:absolute;right:10px;top:4px;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);font-weight:800">Banc</span></div>'+
        '<canvas id="plq-cv" style="position:absolute;inset:0;width:100%;height:100%"></canvas>'+
      '</div>'+
    '</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">'+
      '<div class="plq-grp" id="plq-outils">'+outils.map(function(t){ return '<button type="button" data-outil="'+t[0]+'" aria-label="'+t[2]+'" title="'+t[2]+'" aria-pressed="'+(t[0]===s.outil)+'">'+t[1]+'<span class="plq-lib">'+t[2]+'</span></button>'; }).join("")+'</div>'+
      '<div class="plq-grp" id="plq-encres">'+encres.map(function(c){ return '<button type="button" class="plq-sw" data-c="'+c[0]+'" aria-label="'+c[1]+'" title="'+c[1]+'" style="background:'+c[0]+'" aria-pressed="'+(c[0]===s.couleur)+'"></button>'; }).join("")+'</div>'+
      '<div class="plq-grp" id="plq-actions"><button type="button" id="plq-annuler" aria-label="Annuler le trait" title="Annuler le trait">↶<span class="plq-lib">Annuler le trait</span></button>'+
        '<button type="button" id="plq-effacer" aria-label="Tout effacer" title="Tout effacer">🗑<span class="plq-lib">Tout effacer</span></button></div>'+
    '</div>';
  document.body.appendChild(o);

  document.getElementById("plq-x").onclick=plqFermer;
  document.getElementById("plq-vue").onclick=function(){ s.complet=!s.complet; plqMiseEnPlace(true); };
  document.getElementById("plq-outils").onclick=function(e){
    var b=e.target.closest("[data-outil]"); if(!b) return; plqOutil(b.dataset.outil);
  };
  document.getElementById("plq-encres").onclick=function(e){
    var b=e.target.closest("[data-c]"); if(!b) return; s.couleur=b.dataset.c;
    this.querySelectorAll("button").forEach(function(x){ x.setAttribute("aria-pressed",x===b?"true":"false"); });
    if(s.outil==="move"||s.outil==="gomme") plqOutil("stylo");
  };
  document.getElementById("plq-annuler").onclick=function(){ s.traits.pop(); plqRedessiner(); };
  document.getElementById("plq-effacer").onclick=function(){ s.traits=[]; plqRedessiner(); };
  plqDessinBrancher();
  s.vertical=plqVertical();
  s.surResize=function(){ if(!plqEtat) return; var v=plqVertical(); plqMiseEnPlace(v!==plqEtat.vertical); };
  s.surTouche=function(e){ if(e.key==="Escape") plqFermer(); };
  window.addEventListener("resize",s.surResize);
  document.addEventListener("keydown",s.surTouche);
  plqMiseEnPlace(true);
}

function plqOutil(t){
  var s=plqEtat; s.outil=t;
  document.querySelectorAll("#plq-outils button").forEach(function(x){ x.setAttribute("aria-pressed",x.dataset.outil===t?"true":"false"); });
  var st=document.getElementById("plq-stage");
  st.classList.toggle("plq-move",t==="move"); st.classList.toggle("plq-dessin",t!=="move");
}

// Taille du terrain + banc dans la place disponible ; refaire = nouveau terrain, pions replacés, traits effacés.
function plqMiseEnPlace(refaire){
  var s=plqEtat; if(!s) return;
  var zone=document.getElementById("plq-zone"), stage=document.getElementById("plq-stage");
  var court=document.getElementById("plq-court"), banc=document.getElementById("plq-banc");
  if(!zone||!stage) return;
  s.vertical=plqVertical();
  var b=document.getElementById("plq-vue");
  b.textContent=s.complet?"Demi-terrain":"Terrain complet";
  if(refaire) court.innerHTML=plqTerrainSvg();
  var v=plqVue(), ratio=v[0]/v[1];
  var W=zone.clientWidth, H=zone.clientHeight;
  var nbBanc=Math.max(0,s.joueurs.length-5);
  var parLigne=Math.max(1,Math.floor((Math.min(W,H*ratio)-20)/50));
  var lignes=Math.max(1,Math.ceil(nbBanc/parLigne));
  var hBanc=22+lignes*52;
  var w=Math.max(160,Math.min(W,(H-hBanc)*ratio));
  parLigne=Math.max(1,Math.floor((w-20)/50)); lignes=Math.max(1,Math.ceil(nbBanc/parLigne)); hBanc=22+lignes*52;
  var hc=w/ratio;
  stage.style.width=Math.round(w)+"px";
  court.style.height=Math.round(hc)+"px";
  banc.style.height=hBanc+"px";
  s.geo={hc:hc,hb:hBanc,parLigne:parLigne};
  if(refaire){ s.traits=[]; s.courant=null; plqPions(); }
  plqTailleCanvas();
}

/* ---------- pions ---------- */
// Point du demi-terrain (dm, panier en haut) → fraction du cadre selon la vue.
function plqVersCadre(x,y){
  var s=plqEtat, f=s.geo.hc/(s.geo.hc+s.geo.hb);
  return s.vertical?[x/150,y/280*f]:(s.complet?[y/280,(150-x)/150*f]:[x/150,y/160*f]);
}
function plqBancY(){ var g=plqEtat.geo; return g.hc/(g.hc+g.hb); }
function plqPlaceBanc(p,i){
  var g=plqEtat.geo, tot=g.hc+g.hb, w=document.getElementById("plq-stage").clientWidth||1;
  var lig=Math.floor(i/g.parLigne), col=i%g.parLigne;
  p.x=(30+col*50)/w;
  p.y=(g.hc+28+lig*52)/tot;
}
function plqPions(){
  var s=plqEtat, stage=document.getElementById("plq-stage");
  s.pions.forEach(function(p){ p.el.remove(); }); s.pions=[];
  var init=[[75,78],[22,52],[128,52],[52,26],[98,26]];
  s.joueurs.forEach(function(j,i){
    var ini=String(j.maillot||"").trim()||(((j.prenom||"?")[0]||"")+((j.nom||"")[0]||"")).toUpperCase();
    var p=plqPion(stage,ini,j.prenom||"");
    if(i<5){ var q=plqVersCadre(init[i][0],init[i][1]); p.x=q[0]; p.y=q[1]; }
    else plqPlaceBanc(p,i-5);
    plqPlacer(p);
  });
  var bl=plqPion(stage,"","",true), qb=plqVersCadre(86,84); bl.x=qb[0]; bl.y=qb[1]; plqPlacer(bl);
}
function plqPion(stage,txt,nom,ballon){
  var d=document.createElement("div");
  d.className="plq-pion"+(ballon?" plq-ballon":"");
  d.setAttribute("role","img"); d.setAttribute("aria-label",ballon?"Ballon":nom);
  if(!ballon){ d.setAttribute("data-notr",""); d.innerHTML=authEsc(txt)+(nom?"<small>"+authEsc(nom)+"</small>":""); }
  stage.appendChild(d);
  var p={el:d,x:.5,y:.5,ballon:!!ballon};
  plqEtat.pions.push(p);
  d.addEventListener("pointerdown",function(e){ if(plqEtat&&plqEtat.outil==="move") plqGlisser(e,p); });
  return p;
}
function plqPlacer(p){ p.el.style.left=(p.x*100)+"%"; p.el.style.top=(p.y*100)+"%"; }
function plqGlisser(e,p){
  e.preventDefault(); p.el.setPointerCapture(e.pointerId); p.el.classList.add("plq-drag");
  var r=document.getElementById("plq-stage").getBoundingClientRect();
  function bouge(ev){
    p.x=Math.min(.97,Math.max(.03,(ev.clientX-r.left)/r.width));
    p.y=Math.min(.98,Math.max(.02,(ev.clientY-r.top)/r.height)); plqPlacer(p);
  }
  function fin(){
    p.el.classList.remove("plq-drag");
    p.el.removeEventListener("pointermove",bouge); p.el.removeEventListener("pointerup",fin); p.el.removeEventListener("pointercancel",fin);
    // Un joueur lâché sur le banc s'aligne sur la rangée du banc ; le ballon reste sur le terrain.
    var yb=plqBancY();
    if(p.y>yb){
      if(p.ballon) p.y=yb-.03;
      else { var g=plqEtat.geo; p.y=Math.max(p.y,(g.hc+28)/(g.hc+g.hb)); }
      plqPlacer(p);
    }
  }
  p.el.addEventListener("pointermove",bouge); p.el.addEventListener("pointerup",fin); p.el.addEventListener("pointercancel",fin);
}

/* ---------- dessin (coordonnées 0-1 du cadre ; la gomme retire le trait touché) ---------- */
function plqTailleCanvas(){
  var cv=document.getElementById("plq-cv"); if(!cv) return;
  var r=cv.getBoundingClientRect(), d=window.devicePixelRatio||1;
  cv.width=Math.max(1,Math.round(r.width*d)); cv.height=Math.max(1,Math.round(r.height*d));
  cv.getContext("2d").setTransform(d,0,0,d,0,0);
  plqRedessiner();
}
function plqTracer(ctx,t,w,h){
  if(!t.pts.length) return;
  ctx.beginPath(); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle=t.c;
  ctx.globalAlpha=t.t==="marqueur"?.45:1; ctx.lineWidth=t.t==="marqueur"?16:4;
  ctx.moveTo(t.pts[0][0]*w,t.pts[0][1]*h);
  if(t.pts.length===1) ctx.lineTo(t.pts[0][0]*w+.1,t.pts[0][1]*h);
  for(var i=1;i<t.pts.length;i++) ctx.lineTo(t.pts[i][0]*w,t.pts[i][1]*h);
  ctx.stroke(); ctx.globalAlpha=1;
}
function plqRedessiner(){
  var s=plqEtat, cv=document.getElementById("plq-cv"); if(!s||!cv) return;
  var ctx=cv.getContext("2d"), r=cv.getBoundingClientRect();
  ctx.clearRect(0,0,r.width,r.height);
  s.traits.forEach(function(t){ plqTracer(ctx,t,r.width,r.height); });
  if(s.courant) plqTracer(ctx,s.courant,r.width,r.height);
  document.getElementById("plq-annuler").disabled=!s.traits.length;
  document.getElementById("plq-effacer").disabled=!s.traits.length;
}
function plqDessinBrancher(){
  var cv=document.getElementById("plq-cv");
  function pt(e){ var r=cv.getBoundingClientRect(); return [(e.clientX-r.left)/r.width,(e.clientY-r.top)/r.height]; }
  function gommer(p){
    var s=plqEtat, r=cv.getBoundingClientRect(), n=s.traits.length;
    s.traits=s.traits.filter(function(t){ return !t.pts.some(function(q){ var dx=(q[0]-p[0])*r.width, dy=(q[1]-p[1])*r.height; return dx*dx+dy*dy<24*24; }); });
    if(s.traits.length!==n) plqRedessiner();
  }
  cv.addEventListener("pointerdown",function(e){
    var s=plqEtat; if(!s||s.outil==="move") return;
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    var p=pt(e);
    if(s.outil==="gomme") gommer(p); else { s.courant={t:s.outil,c:s.couleur,pts:[p]}; plqRedessiner(); }
  });
  cv.addEventListener("pointermove",function(e){
    var s=plqEtat; if(!s||!cv.hasPointerCapture(e.pointerId)) return;
    var p=pt(e);
    if(s.outil==="gomme") gommer(p); else if(s.courant){ s.courant.pts.push(p); plqRedessiner(); }
  });
  function fin(){ var s=plqEtat; if(s&&s.courant){ s.traits.push(s.courant); s.courant=null; plqRedessiner(); } }
  cv.addEventListener("pointerup",fin); cv.addEventListener("pointercancel",fin);
}

function plqFermer(){
  var s=plqEtat;
  if(s){ window.removeEventListener("resize",s.surResize); document.removeEventListener("keydown",s.surTouche); }
  var o=document.getElementById("plq-ecran"); if(o) o.remove();
  plqEtat=null;
}
