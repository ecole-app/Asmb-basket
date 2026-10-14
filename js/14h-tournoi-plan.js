// ══════════════════════════════════════════════════════════════
// TOURNOI — PLAN DU SITE
// Le club cherche l'adresse de son tournoi, la carte (photo aérienne IGN) se
// centre dessus, puis il place ses terrains, la buvette, l'accueil, les
// toilettes… Le plan s'affiche sur la page publique /tournoi (onglet « Plan »,
// « 📍 » sur chaque match) avec un bouton itinéraire.
// Stocké sur l'événement : e.trn.plan = {lat, lng, zoom, fond, points:[{t, n?, lat, lng}]}
// Carte : Leaflet chargé à la demande ; fonds IGN Géoplateforme (libres, sans clé).
// Adresse : géocodage Géoplateforme, puis api-adresse, puis OpenStreetMap.
// ══════════════════════════════════════════════════════════════
var TRN_PLAN_TYPES=[
  {t:"terrain",ic:"🏀",nom:"Terrain"},
  {t:"buvette",ic:"🥤",nom:"Buvette"},
  {t:"accueil",ic:"ℹ️",nom:"Accueil"},
  {t:"entree",ic:"🚪",nom:"Entrée"},
  {t:"vestiaires",ic:"👕",nom:"Vestiaires"},
  {t:"toilettes",ic:"🚻",nom:"Toilettes"},
  {t:"parking",ic:"🅿️",nom:"Parking"},
  {t:"secours",ic:"⛑️",nom:"Secours"}
];
var TRN_PLAN_UNIQUES={buvette:1,accueil:1,secours:1};
var GM_LEAFLET="https://unpkg.com/leaflet@1.9.4/dist/";
function gmLeaflet(){
  if(window.L&&window.L.map) return Promise.resolve(window.L);
  if(gmLeaflet.p) return gmLeaflet.p;
  gmLeaflet.p=new Promise(function(ok,ko){
    var l=document.createElement("link"); l.rel="stylesheet"; l.href=GM_LEAFLET+"leaflet.css"; document.head.appendChild(l);
    var s=document.createElement("script"); s.src=GM_LEAFLET+"leaflet.js"; s.onload=function(){ ok(window.L); }; s.onerror=function(){ gmLeaflet.p=null; ko(new Error("leaflet")); };
    document.head.appendChild(s);
  });
  return gmLeaflet.p;
}
function trnPlanType(t){ return TRN_PLAN_TYPES.filter(function(x){ return x.t===t; })[0]||TRN_PLAN_TYPES[0]; }
function trnPlanNom(p){ return p.t==="terrain"?"Terrain "+p.n:trnPlanType(p.t).nom; }
// Fonds de carte IGN (photo aérienne / plan), OpenStreetMap en secours hors de France.
function trnPlanFonds(L){
  function ign(layer,fmt){ return "https://data.geopf.fr/wmts?REQUEST=GetTile&SERVICE=WMTS&VERSION=1.0.0&STYLE=normal&TILEMATRIXSET=PM&FORMAT="+fmt+"&LAYER="+layer+"&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"; }
  return {
    ortho:L.tileLayer(ign("ORTHOIMAGERY.ORTHOPHOTOS","image/jpeg"),{maxZoom:21,maxNativeZoom:19,attribution:"© IGN"}),
    plan:L.tileLayer(ign("GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2","image/png"),{maxZoom:21,maxNativeZoom:18,attribution:"© IGN"}),
    osm:L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:21,maxNativeZoom:19,attribution:"© OpenStreetMap"})
  };
}
function trnPlanIcone(L,p,actif){
  var txt=p.t==="terrain"?String(p.n):trnPlanType(p.t).ic;
  return L.divIcon({className:"trn-pin-wrap",iconSize:[36,36],iconAnchor:[18,18],
    html:'<div class="trn-pin'+(p.t==="terrain"?" ter":"")+(actif?" on":"")+'" title="'+authEsc(trnPlanNom(p))+'">'+authEsc(txt)+'</div>'});
}
// Adresse → coordonnées (3 services gratuits, le premier qui répond).
function trnGeocoder(q){
  q=String(q||"").trim(); if(q.length<3) return Promise.resolve([]);
  function ban(url){
    return fetch(url+encodeURIComponent(q)+"&limit=5").then(function(r){ if(!r.ok) throw 0; return r.json(); }).then(function(d){
      var l=((d&&d.features)||[]).map(function(f){ return {label:(f.properties&&f.properties.label)||q, lat:f.geometry.coordinates[1], lng:f.geometry.coordinates[0]}; });
      if(!l.length) throw 0; return l;
    });
  }
  return ban("https://data.geopf.fr/geocodage/search?q=")
    .catch(function(){ return ban("https://api-adresse.data.gouv.fr/search/?q="); })
    .catch(function(){
      return fetch("https://nominatim.openstreetmap.org/search?format=json&limit=5&q="+encodeURIComponent(q)).then(function(r){ return r.json(); })
        .then(function(d){ return (d||[]).map(function(x){ return {label:x.display_name, lat:parseFloat(x.lat), lng:parseFloat(x.lon)}; }); });
    }).catch(function(){ return []; });
}

// ── Onglet « Plan du site » (staff) ───────────────────────────────────
function trnPlanEditer(zone,eid){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var c=trnCfg(e), plan=JSON.parse(JSON.stringify((e.trn&&e.trn.plan)||{points:[]}));
  plan.points=plan.points||[];
  var aide=document.createElement("div"); aide.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:8px";
  aide.textContent="Cherchez l'adresse du tournoi, choisissez un élément ci-dessous puis touchez la carte pour le placer. Les repères se déplacent en les faisant glisser. Le plan s'affiche sur la page publique du tournoi.";
  zone.appendChild(aide);
  var rech=document.createElement("div"); rech.style.cssText="display:flex;gap:6px";
  var q=document.createElement("input"); q.className="form-input"; q.placeholder="Adresse du gymnase ou du complexe"; q.value=e.adresse||e.lieu||""; q.style.flex="1";
  var go=gmBtn("Chercher","primary",function(){ chercher(); }); go.style.flex="0 0 auto";
  rech.appendChild(q); rech.appendChild(go); zone.appendChild(rech);
  var res=document.createElement("div"); zone.appendChild(res);
  q.addEventListener("keydown",function(ev){ if(ev.key==="Enter") chercher(); });
  var pal=document.createElement("div"); pal.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin:10px 0 8px";
  zone.appendChild(pal);
  var carte=document.createElement("div"); carte.style.cssText="isolation:isolate;position:relative;height:380px;border-radius:var(--rs);overflow:hidden;border:1px solid var(--bdr);background:var(--bdr)";
  zone.appendChild(carte);
  var bas=gmRow(zone);
  var info=document.createElement("div"); info.style.cssText="font-size:11.5px;color:var(--mut);margin-top:6px"; zone.appendChild(info);
  var choix=null, map=null, L=null, fonds=null, marqueurs=[];
  function cle(p){ return p.t==="terrain"?"terrain"+p.n:p.t; }
  function peindrePalette(){
    pal.innerHTML="";
    var items=[]; for(var n=1;n<=c.terrains;n++) items.push({t:"terrain",n:n});
    TRN_PLAN_TYPES.slice(1).forEach(function(x){ items.push({t:x.t}); });
    items.forEach(function(it){
      var place=plan.points.some(function(p){ return cle(p)===cle(it); });
      var b=document.createElement("button"); b.type="button";
      var on=choix&&cle(choix)===cle(it);
      b.textContent=(it.t==="terrain"?"🏀 "+it.n+(c.typesTerrains[it.n-1]==="ext"?" ☀️":""):trnPlanType(it.t).ic+" "+trnPlanType(it.t).nom)+(place&&(it.t==="terrain"||TRN_PLAN_UNIQUES[it.t])?" ✓":"");
      b.style.cssText="padding:7px 11px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt)");
      b.addEventListener("click",function(){ choix=on?null:it; peindrePalette(); info.textContent=choix?"Touchez la carte pour placer : "+trnPlanNom(choix):""; });
      pal.appendChild(b);
    });
  }
  function peindreMarqueurs(){
    if(!map) return;
    marqueurs.forEach(function(m){ map.removeLayer(m); }); marqueurs=[];
    plan.points.forEach(function(p,i){
      var m=L.marker([p.lat,p.lng],{icon:trnPlanIcone(L,p),draggable:true}).addTo(map);
      m.on("dragend",function(){ var ll=m.getLatLng(); p.lat=+ll.lat.toFixed(6); p.lng=+ll.lng.toFixed(6); });
      m.bindPopup(function(){
        var d=document.createElement("div"); d.style.cssText="font:700 13px system-ui;text-align:center";
        d.appendChild(document.createTextNode(trnPlanNom(p)));
        var x=document.createElement("button"); x.type="button"; x.textContent="Retirer"; x.style.cssText="display:block;margin:8px auto 0;padding:6px 12px;border-radius:16px;border:none;background:#c0392b;color:#fff;font-weight:700;cursor:pointer";
        x.addEventListener("click",function(){ plan.points.splice(plan.points.indexOf(p),1); map.closePopup(); peindreMarqueurs(); peindrePalette(); });
        d.appendChild(x); return d;
      });
      marqueurs.push(m);
    });
  }
  function chercher(){
    res.innerHTML='<div style="font-size:12px;color:var(--mut);padding:6px 0">Recherche…</div>';
    trnGeocoder(q.value).then(function(l){
      res.innerHTML="";
      if(!l.length){ res.innerHTML='<div style="font-size:12px;color:var(--red);padding:6px 0">Adresse introuvable. Essayez avec la ville, ou déplacez la carte à la main.</div>'; return; }
      l.forEach(function(x,i){
        var b=document.createElement("button"); b.type="button"; b.textContent="📍 "+x.label;
        b.style.cssText="display:block;width:100%;text-align:left;padding:8px 10px;margin-top:4px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:12.5px;font-weight:600;cursor:pointer";
        b.addEventListener("click",function(){ res.innerHTML=""; if(map) map.setView([x.lat,x.lng],18); });
        res.appendChild(b);
        if(i===0&&map&&!plan.points.length) map.setView([x.lat,x.lng],18);
      });
    });
  }
  peindrePalette();
  carte.innerHTML='<div style="padding:30px;text-align:center;color:var(--mut);font-size:12px">Chargement de la carte…</div>';
  gmLeaflet().then(function(Lf){
    L=Lf; carte.innerHTML="";
    var centre=plan.lat?[plan.lat,plan.lng]:[46.6,2.4], zoom=plan.lat?(plan.zoom||18):6;
    map=L.map(carte,{zoomControl:true,attributionControl:true}).setView(centre,zoom);
    fonds=trnPlanFonds(L);
    var fond=plan.fond==="plan"?"plan":"ortho";
    fonds[fond].addTo(map);
    fonds[fond].on("tileerror",function(){ if(!map.hasLayer(fonds.osm)){ map.removeLayer(fonds[fond]); fonds.osm.addTo(map); } });
    map.on("click",function(ev){
      if(!choix) return;
      var p={t:choix.t,lat:+ev.latlng.lat.toFixed(6),lng:+ev.latlng.lng.toFixed(6)}; if(choix.t==="terrain") p.n=choix.n;
      if(choix.t==="terrain"||TRN_PLAN_UNIQUES[choix.t]) plan.points=plan.points.filter(function(x){ return cle(x)!==cle(p); });
      plan.points.push(p);
      // Terrain suivant proposé tout de suite.
      if(choix.t==="terrain"&&choix.n<c.terrains&&!plan.points.some(function(x){ return x.t==="terrain"&&x.n===choix.n+1; })) choix={t:"terrain",n:choix.n+1}; else choix=null;
      info.textContent=choix?"Touchez la carte pour placer : "+trnPlanNom(choix):"";
      peindreMarqueurs(); peindrePalette();
    });
    peindreMarqueurs();
    if(!plan.lat&&q.value) chercher();
    var bFond=gmBtn(fond==="ortho"?"Vue plan":"Vue satellite","soft",function(){
      map.removeLayer(fonds[fond]); fond=fond==="ortho"?"plan":"ortho"; fonds[fond].addTo(map); bFond.textContent=fond==="ortho"?"Vue plan":"Vue satellite"; plan.fond=fond;
    });
    bas.appendChild(bFond);
    setTimeout(function(){ map.invalidateSize(); },200);
  }).catch(function(){ carte.innerHTML='<div style="padding:30px;text-align:center;color:var(--red);font-size:12px">Carte indisponible (connexion). Réessayez dans un instant.</div>'; });
  bas.insertBefore(gmBtn("Enregistrer le plan","primary",function(){
    if(map){ var ce=map.getCenter(); plan.lat=+ce.lat.toFixed(6); plan.lng=+ce.lng.toFixed(6); plan.zoom=map.getZoom(); }
    if(!plan.lat) return askAlert("Cherchez d'abord l'adresse du tournoi.");
    plan.points=plan.points.slice(0,40);
    trnSauver(eid,{plan:plan},true);
    trnPublier(eid).then(function(){ showToast("Plan enregistré et publié"); }).catch(function(){ showToast("Plan enregistré (publication au prochain essai)"); });
  }),bas.firstChild);
}
