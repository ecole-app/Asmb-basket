/* ===== 14e-tournoi.js — Tournois : équipes, poules, phases finales, planning automatique ===== */
// Un événement de type « tournoi » porte sa configuration dans e.trn :
//   equipes  [{id, nom, club, cat}]
//   cats     {cat: {nbPoules, suite, petiteFinale, duree}}   (format par catégorie)
//   journée  debut, fin ("HH:MM"), pause {debut, fin} ou null, terrains (nombre),
//            battement (min entre deux matchs sur un terrain), repos (une équipe
//            ne joue pas deux matchs d'affilée)
//   matchs   planning généré [{id, cat, phase, poule, label, a, b, aRef, bRef, terrain, debut, fin, hors}]
// Le planning public (sans rien de privé) est copié dans trn_pages/{clubId__eventId},
// lisible sans compte (lien + QR). Les codes de table de marque (jour J) n'y sont jamais.
var TRN_URL_BASE="https://generalmanagerapp.fr/?trn=";
var TRN_SUITES={aucune:"Rien : classement des poules",finale:"Finale",demis:"Demi-finales + finale",classement:"Matchs de classement (tout le monde rejoue)"};
var TRN_LETTRES="ABCDEFGH";

// ── Outils purs (testés dans tests/metier/tournoi.test.js) ────────────
function trnMin(h){ var m=String(h||"").match(/^(\d{1,2}):(\d{2})$/); return m?parseInt(m[1],10)*60+parseInt(m[2],10):null; }
function trnHeure(n){ n=Math.round(n); return ("0"+Math.floor(n/60)).slice(-2)+":"+("0"+(n%60)).slice(-2); }
function trnCfg(e){
  var t=(e&&e.trn)||{};
  return {
    equipes:t.equipes||[], cats:t.cats||{}, terrains:Math.max(1,Math.min(12,parseInt(t.terrains,10)||2)),
    debut:t.debut||"09:00", fin:t.fin||"18:00", pause:t.pause||null,
    battement:t.battement!=null?Math.max(0,parseInt(t.battement,10)||0):5, repos:t.repos!==false,
    matchs:t.matchs||[], genereLe:t.genereLe||null, publieLe:t.publieLe||null, modifLe:t.modifLe||null
  };
}
function trnCatsDe(equipes){
  var vus={}, out=[];
  equipes.forEach(function(q){ var c=q.cat||"Sans catégorie"; if(!vus[c]){ vus[c]=1; out.push(c); } });
  return out;
}
function trnConfCat(cfg,cat){
  var n=cfg.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===cat; }).length;
  var c=cfg.cats[cat]||{};
  var nbP=parseInt(c.nbPoules,10)||(n>=8?2:1);
  return {nbPoules:Math.max(1,Math.min(nbP,Math.max(1,Math.floor(n/2)))), suite:c.suite||"aucune", petiteFinale:!!c.petiteFinale, duree:Math.max(4,parseInt(c.duree,10)||20)};
}
// Formats possibles selon le nombre de poules et la taille de la plus petite.
function trnSuitesPossibles(nbPoules,taillePlusPetite,nbEquipes){
  var s=["aucune"];
  if(nbPoules===1&&nbEquipes>=3) s.push("finale");
  if(nbPoules===1&&nbEquipes>=4) s.push("demis");
  if(nbPoules===2&&taillePlusPetite>=1) s.push("finale");
  if(nbPoules===2&&taillePlusPetite>=2) s.push("demis","classement");
  if(nbPoules===4) s.push("demis");
  return s;
}
// Répartition en poules : les équipes d'un même club sont écartées autant que possible.
function trnPoules(equipes,nb){
  var parClub={}, clubs=[];
  equipes.forEach(function(q){ var k=(q.club||"").toLowerCase().trim()||("_"+q.id); if(!parClub[k]){ parClub[k]=[]; clubs.push(k); } parClub[k].push(q.id); });
  clubs.sort(function(a,b){ return parClub[b].length-parClub[a].length; });
  var ordre=[], reste=true;
  for(var i=0;reste;i++){ reste=false; clubs.forEach(function(k){ if(parClub[k][i]!=null){ ordre.push(parClub[k][i]); reste=true; } }); }
  var poules=[]; for(var p=0;p<nb;p++) poules.push([]);
  ordre.forEach(function(id,j){ var tour=Math.floor(j/nb), pos=j%nb; poules[tour%2?nb-1-pos:pos].push(id); });
  return poules;
}
// Tous contre tous (méthode du cercle) : tours successifs où chacun joue au plus une fois.
function trnTours(ids){
  var l=ids.slice(); if(l.length%2) l.push(null);
  var n=l.length, tours=[];
  for(var r=0;r<n-1;r++){
    var t=[];
    for(var i=0;i<n/2;i++){ var a=l[i], b=l[n-1-i]; if(a!=null&&b!=null) t.push(r%2?[b,a]:[a,b]); }
    tours.push(t);
    l.splice(1,0,l.pop());
  }
  return tours;
}
function trnRefTxt(r,labels){
  if(!r) return "";
  if(r.r==="rang") return r.rang+(r.rang===1?"er":"e")+" poule "+r.poule;
  var lab=(labels&&labels[r.match])||"match";
  return (r.r==="vainq"?"Vainqueur ":"Perdant ")+lab.toLowerCase();
}
// Matchs d'une catégorie : poules (tous contre tous) puis la suite choisie.
function trnMatchsCat(cat,equipesCat,conf){
  var poules=trnPoules(equipesCat,conf.nbPoules), out=[], k=0;
  function id(s){ return cat+"|"+s; }
  poules.forEach(function(p,ip){
    var L=TRN_LETTRES.charAt(ip);
    trnTours(p).forEach(function(tour,r){
      tour.forEach(function(m){ out.push({id:id("P"+L+(++k)),cat:cat,phase:"poule",poule:L,tour:r,a:m[0],b:m[1],label:(poules.length>1?"Poule "+L:"Poule"),duree:conf.duree}); });
    });
  });
  var tailles=poules.map(function(p){ return p.length; }), mini=Math.min.apply(null,tailles);
  var ok=trnSuitesPossibles(poules.length,mini,equipesCat.length);
  var suite=ok.indexOf(conf.suite)>=0?conf.suite:"aucune";
  function rang(L,n){ return {r:"rang",poule:L,rang:n}; }
  function fin(code,label,aRef,bRef,niveau){ var m={id:id(code),cat:cat,phase:"finale",niveau:niveau,label:label,a:null,b:null,aRef:aRef,bRef:bRef,duree:conf.duree}; out.push(m); return m; }
  var P=poules.length;
  if(suite==="finale"){
    // La petite finale passe avant la finale (la finale clôt la journée de la catégorie).
    if(P===1){ if(conf.petiteFinale&&equipesCat.length>=4) fin("PF","Petite finale",rang("A",3),rang("A",4),1); fin("F","Finale",rang("A",1),rang("A",2),1); }
    else { if(conf.petiteFinale) fin("PF","Petite finale",rang("A",2),rang("B",2),1); fin("F","Finale",rang("A",1),rang("B",1),1); }
  } else if(suite==="demis"){
    var d1,d2;
    if(P===1){ d1=fin("D1","Demi-finale 1",rang("A",1),rang("A",4),1); d2=fin("D2","Demi-finale 2",rang("A",2),rang("A",3),1); }
    else if(P===2){ d1=fin("D1","Demi-finale 1",rang("A",1),rang("B",2),1); d2=fin("D2","Demi-finale 2",rang("B",1),rang("A",2),1); }
    else { d1=fin("D1","Demi-finale 1",rang("A",1),rang("D",1),1); d2=fin("D2","Demi-finale 2",rang("B",1),rang("C",1),1); }
    if(conf.petiteFinale) fin("PF","Petite finale",{r:"perd",match:d1.id},{r:"perd",match:d2.id},2);
    fin("F","Finale",{r:"vainq",match:d1.id},{r:"vainq",match:d2.id},2);
  } else if(suite==="classement"){
    for(var n=mini;n>=1;n--) fin("C"+n,n===1?"Finale":"Match pour la "+(2*n-1)+"e place",rang("A",n),rang("B",n),1);
  }
  return {poules:poules.map(function(p,i){ return {nom:TRN_LETTRES.charAt(i),equipes:p}; }),matchs:out,suite:suite};
}
function trnDeps(m,tous){
  if(m.phase==="poule") return [];
  var ids=[];
  [m.aRef,m.bRef].forEach(function(r){
    if(!r) return;
    if(r.r==="rang") tous.forEach(function(x){ if(x.cat===m.cat&&x.phase==="poule"&&x.poule===r.poule) ids.push(x.id); });
    else ids.push(r.match);
  });
  return ids;
}
// Planning : à chaque étape, le match (et le terrain) qui peut commencer le plus tôt,
// en respectant : terrain libre + battement, équipes reposées, matchs précédents finis,
// pause de midi. Ordre de priorité à égalité : tour de poule, puis catégorie.
function trnPlanifier(matchs,cfg){
  var deb=trnMin(cfg.debut)||540, fin=trnMin(cfg.fin)||1080, bat=cfg.battement||0;
  var pd=cfg.pause?trnMin(cfg.pause.debut):null, pf=cfg.pause?trnMin(cfg.pause.fin):null;
  var libre=[]; for(var t=0;t<cfg.terrains;t++) libre.push(deb);
  var pret={}, finDe={}, reste=matchs.map(function(m,i){ return {m:m,i:i,deps:trnDeps(m,matchs)}; }), out=[], hors=0;
  function apresPause(s,len){ if(pd!=null&&pf!=null&&pf>pd&&s<pf&&s+len>pd) return pf; return s; }
  while(reste.length){
    var best=null;
    reste.forEach(function(x){
      if(!x.deps.every(function(d){ return finDe[d]!=null; })) return;
      var len=x.m.duree, s0=deb;
      x.deps.forEach(function(d){ s0=Math.max(s0,finDe[d]+bat+(cfg.repos?len:0)); });
      [x.m.a,x.m.b].forEach(function(q){ if(q&&pret[q]!=null) s0=Math.max(s0,pret[q]); });
      for(var t=0;t<libre.length;t++){
        var s=apresPause(Math.max(s0,libre[t]),len);
        if(!best||s<best.s||(s===best.s&&x.i<best.x.i)) best={x:x,t:t,s:s};
      }
    });
    if(!best) break; // dépendance impossible (ne devrait pas arriver)
    var m=Object.assign({},best.x.m), len=m.duree;
    m.terrain=best.t+1; m.debut=trnHeure(best.s); m.fin=trnHeure(best.s+len); m.hors=best.s+len>fin;
    if(m.hors) hors++;
    libre[best.t]=best.s+len+bat;
    finDe[m.id]=best.s+len;
    [m.a,m.b].forEach(function(q){ if(q) pret[q]=best.s+len+bat+(cfg.repos?len:0); });
    out.push(m);
    reste.splice(reste.indexOf(best.x),1);
  }
  out.sort(function(a,b){ return trnMin(a.debut)-trnMin(b.debut)||a.terrain-b.terrain; });
  var dernier=out.length?Math.max.apply(null,out.map(function(m){ return trnMin(m.fin); })):deb;
  return {matchs:out,hors:hors,finReelle:trnHeure(dernier)};
}
// Génère tout le tournoi : poules + phases finales de chaque catégorie, puis le planning.
function trnGenerer(cfg){
  var cats=trnCatsDe(cfg.equipes), poules={}, tous=[], formats={};
  cats.forEach(function(cat){
    var eq=cfg.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===cat; });
    if(eq.length<2) return;
    var conf=trnConfCat(cfg,cat), r=trnMatchsCat(cat,eq,conf);
    poules[cat]=r.poules; formats[cat]={nbPoules:conf.nbPoules,suite:r.suite,petiteFinale:conf.petiteFinale,duree:conf.duree};
    tous=tous.concat(r.matchs);
  });
  // Priorité : on entrelace les catégories tour par tour (chacune avance au même rythme).
  var ordreCat={}; cats.forEach(function(c,i){ ordreCat[c]=i; });
  tous.forEach(function(m,i){ m._o=i; });
  tous.sort(function(a,b){
    var pa=a.phase==="poule"?0:1, pb=b.phase==="poule"?0:1;
    return pa-pb||(a.tour||0)-(b.tour||0)||(a.niveau||0)-(b.niveau||0)||ordreCat[a.cat]-ordreCat[b.cat]||String(a.poule||"").localeCompare(String(b.poule||""))||a._o-b._o;
  });
  tous.forEach(function(m){ delete m._o; });
  var p=trnPlanifier(tous,cfg);
  return {matchs:p.matchs,poules:poules,formats:formats,hors:p.hors,finReelle:p.finReelle};
}

// ── Écran de préparation (staff) ──────────────────────────────────────
function trnBoutonCarte(e){
  if(e.type!=="tournoi") return "";
  if(typeof isStaffUser==="function"&&!isStaffUser()) return "";
  return "<button onclick=\"trnOuvrir('"+authEsc(e.id)+"')\" style=\"margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:#b7791f;color:#fff;font-size:10px;font-weight:700;border:none;cursor:pointer\">🏆 Tournoi</button>";
}
// sansModif : enregistrement qui ne change ni équipes ni format (publication).
function trnSauver(eid,maj,sansModif){
  var events=getEvents(), e=events.find(function(x){ return x.id===eid; }); if(!e) return null;
  e.trn=Object.assign({},e.trn||{},maj,sansModif?{}:{modifLe:Date.now()});
  saveEvents(events);
  return e;
}
function trnNom(cfg,id){ var q=cfg.equipes.filter(function(x){ return x.id===id; })[0]; return q?q.nom:"?"; }

function trnOuvrir(eid){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var s=gmSheet("Tournoi · "+(e.titre||"Tournoi")), b=s.body;
  var zone=document.createElement("div"); b.appendChild(zone);
  var onglet="equipes";
  function cfg(){ return trnCfg(getEvents().find(function(x){ return x.id===eid; })||e); }
  function rendre(){
    var c=cfg();
    zone.innerHTML="";
    var tabs=document.createElement("div"); tabs.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px";
    [["equipes","Équipes ("+c.equipes.length+")"],["format","Journée et format"],["planning","Planning"+(c.matchs.length?" ("+c.matchs.length+")":"")]].forEach(function(o){
      var t=document.createElement("button"); t.type="button"; t.className="cat-filter"+(onglet===o[0]?" on":""); t.textContent=o[1];
      t.addEventListener("click",function(){ onglet=o[0]; rendre(); }); tabs.appendChild(t);
    });
    zone.appendChild(tabs);
    if(c.matchs.length&&c.modifLe&&c.genereLe&&c.modifLe>c.genereLe){
      var w=document.createElement("div"); w.style.cssText="background:rgba(217,105,11,.12);color:#b45309;font-size:12px;font-weight:700;padding:9px 12px;border-radius:10px;margin-bottom:10px";
      w.textContent="Équipes ou réglages modifiés depuis le dernier planning : pensez à le générer de nouveau.";
      zone.appendChild(w);
    }
    if(onglet==="equipes") rendreEquipes(c); else if(onglet==="format") rendreFormat(c); else rendrePlanning(c);
  }
  function champ(lab,el){ var g=document.createElement("div"); g.className="form-group"; var l=document.createElement("label"); l.className="form-label"; l.textContent=lab; g.appendChild(l); g.appendChild(el); return g; }
  function rendreEquipes(c){
    var aide=document.createElement("div"); aide.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
    aide.textContent="Ajoutez les équipes qui jouent, avec leur catégorie. Les équipes d'un même club sont mises dans des poules différentes quand c'est possible.";
    zone.appendChild(aide);
    var f=document.createElement("div"); f.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;align-items:end";
    var nom=document.createElement("input"); nom.className="form-input"; nom.placeholder="ex. ASMB 1"; nom.maxLength=40;
    var club=document.createElement("input"); club.className="form-input"; club.placeholder="Club"; club.maxLength=50; club.value=clubLabel("");
    var cat=document.createElement("input"); cat.className="form-input"; cat.placeholder="ex. U13 M"; cat.maxLength=20; cat.setAttribute("list","trn-cats");
    var dl=document.createElement("datalist"); dl.id="trn-cats";
    dl.innerHTML=trnCatsDe(c.equipes).concat(["U9","U11 M","U11 F","U13 M","U13 F","U15 M","U15 F","U17 M","U17 F","Seniors M","Seniors F"]).filter(function(x,i,a){ return a.indexOf(x)===i; }).map(function(x){ return '<option value="'+authEsc(x)+'">'; }).join("");
    f.appendChild(champ("Équipe",nom)); f.appendChild(champ("Club",club)); f.appendChild(champ("Catégorie",cat)); zone.appendChild(dl); zone.appendChild(f);
    var row=gmRow(zone); row.style.marginTop="0";
    row.appendChild(gmBtn("+ Ajouter l'équipe","primary",function(){
      var n=nom.value.trim(), k=cat.value.trim();
      if(!n||!k) return askAlert("Nom de l'équipe et catégorie obligatoires.");
      var eq=cfg().equipes.slice(); eq.push({id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,5),nom:n,club:club.value.trim(),cat:k,source:"club"});
      trnSauver(eid,{equipes:eq}); rendre();
      setTimeout(function(){ var x=zone.querySelector("input.form-input"); if(x) x.focus(); },0);
    }));
    var teams=(typeof getTeams==="function")?getTeams():[];
    if(teams.length) row.appendChild(gmBtn("Ajouter nos équipes du club","soft",function(){ trnChoisirEquipesClub(eid,teams,rendre); }));
    trnCatsDe(c.equipes).forEach(function(k){
      var eq=c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===k; });
      gmSection(zone,k+" · "+eq.length+" équipe"+(eq.length>1?"s":""));
      var card=gmCard(); card.style.padding="4px 12px";
      eq.forEach(function(q){
        var l=document.createElement("div"); l.style.cssText="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr)";
        l.innerHTML='<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(q.nom)+'</div><div style="font-size:11.5px;color:var(--mut)">'+authEsc(q.club||"")+(q.source==="lien"?" · inscrite par le lien":"")+'</div></div>';
        var x=gmBtn("Retirer","danger",function(){ askConfirm("Retirer « "+q.nom+" » du tournoi ?",{danger:true,confirmText:"Retirer"}).then(function(ok){ if(!ok) return; trnSauver(eid,{equipes:cfg().equipes.filter(function(z){ return z.id!==q.id; })}); rendre(); }); });
        l.appendChild(x); card.appendChild(l);
      });
      if(card.lastChild) card.lastChild.style.borderBottom="none";
      zone.appendChild(card);
    });
  }
  function rendreFormat(c){
    gmSection(zone,"La journée");
    var g=document.createElement("div"); g.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px";
    function inp(type,val,attrs){ var i=document.createElement("input"); i.type=type; i.className="form-input"; i.value=val; Object.keys(attrs||{}).forEach(function(k){ i.setAttribute(k,attrs[k]); }); return i; }
    var deb=inp("time",c.debut), fin=inp("time",c.fin), ter=inp("number",c.terrains,{min:1,max:12}), bat=inp("number",c.battement,{min:0,max:60});
    g.appendChild(champ("Début",deb)); g.appendChild(champ("Fin au plus tard",fin)); g.appendChild(champ("Terrains",ter)); g.appendChild(champ("Battement (min)",bat));
    zone.appendChild(g);
    function coche(txt,val){ var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;color:var(--txt);margin:4px 0 8px;cursor:pointer"; var x=document.createElement("input"); x.type="checkbox"; x.checked=val; x.style.cssText="width:18px;height:18px;accent-color:var(--dkg)"; l.appendChild(x); l.appendChild(document.createTextNode(txt)); zone.appendChild(l); return x; }
    var cbP=coche("Pause de midi",!!c.pause);
    var gp=document.createElement("div"); gp.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
    var pd=inp("time",c.pause?c.pause.debut:"12:00"), pf=inp("time",c.pause?c.pause.fin:"13:30");
    gp.appendChild(champ("Pause de",pd)); gp.appendChild(champ("à",pf)); zone.appendChild(gp);
    function majP(){ gp.style.display=cbP.checked?"grid":"none"; } cbP.addEventListener("change",majP); majP();
    var cbR=coche("Une équipe ne joue jamais deux matchs d'affilée",c.repos);
    var cats=trnCatsDe(c.equipes), confs={};
    if(cats.length) gmSection(zone,"Format par catégorie","Toujours une phase de poules (tous contre tous), puis la suite que vous choisissez.");
    cats.forEach(function(k){
      var n=c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===k; }).length, cc=trnConfCat(c,k);
      var card=gmCard();
      card.innerHTML='<div style="font-size:14px;font-weight:900;color:var(--txt);margin-bottom:8px">'+authEsc(k)+' <span style="font-weight:700;color:var(--mut);font-size:12px">· '+n+' équipe'+(n>1?"s":"")+'</span></div>';
      if(n<2){ card.innerHTML+='<div style="font-size:12px;color:var(--mut)">Il faut au moins 2 équipes pour jouer.</div>'; zone.appendChild(card); return; }
      var gg=document.createElement("div"); gg.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px";
      var selP=document.createElement("select"); selP.className="form-input";
      for(var p=1;p<=Math.min(4,Math.floor(n/2));p++){ if(p===3) continue; var o=document.createElement("option"); o.value=p; o.textContent=p===1?"1 poule (tous contre tous)":p+" poules"; selP.appendChild(o); }
      if(n>=6&&Math.floor(n/2)>=3){ var o3=document.createElement("option"); o3.value=3; o3.textContent="3 poules"; selP.insertBefore(o3,selP.children[2]||null); }
      selP.value=String(cc.nbPoules);
      var selS=document.createElement("select"); selS.className="form-input";
      var dur=inp("number",cc.duree,{min:4,max:80});
      var pfL=document.createElement("label"); pfL.style.cssText="display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:var(--txt2);cursor:pointer;margin-top:4px";
      var pfC=document.createElement("input"); pfC.type="checkbox"; pfC.checked=cc.petiteFinale; pfC.style.cssText="width:17px;height:17px;accent-color:var(--dkg)";
      pfL.appendChild(pfC); pfL.appendChild(document.createTextNode("Petite finale (3e place)"));
      var info=document.createElement("div"); info.style.cssText="font-size:11.5px;color:var(--mut);margin-top:6px";
      function majS(){
        var nbP=parseInt(selP.value,10), tailles=trnPoules(c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===k; }),nbP).map(function(x){ return x.length; });
        var ok=trnSuitesPossibles(nbP,Math.min.apply(null,tailles),n), cur=selS.value||cc.suite;
        selS.innerHTML=ok.map(function(sx){ return '<option value="'+sx+'">'+authEsc(TRN_SUITES[sx])+'</option>'; }).join("");
        selS.value=ok.indexOf(cur)>=0?cur:"aucune";
        pfL.style.display=(selS.value==="demis"||selS.value==="finale")?"flex":"none";
        var nbM=tailles.reduce(function(t,x){ return t+x*(x-1)/2; },0);
        info.textContent="Poules de "+tailles.join(", ")+" équipes · "+nbM+" matchs de poule";
      }
      selP.addEventListener("change",majS); selS.addEventListener("change",majS); majS();
      gg.appendChild(champ("Poules",selP)); gg.appendChild(champ("Après les poules",selS)); gg.appendChild(champ("Durée d'un match (min)",dur));
      card.appendChild(gg); card.appendChild(pfL); card.appendChild(info); zone.appendChild(card);
      confs[k]={selP:selP,selS:selS,dur:dur,pfC:pfC};
    });
    var row=gmRow(zone);
    row.appendChild(gmBtn("Enregistrer","primary",function(){
      var d=trnMin(deb.value), f=trnMin(fin.value);
      if(d==null||f==null||f<=d) return askAlert("L'heure de fin doit être après l'heure de début.");
      var pause=null;
      if(cbP.checked){ var a=trnMin(pd.value), z=trnMin(pf.value); if(a==null||z==null||z<=a) return askAlert("La fin de la pause doit être après son début."); pause={debut:pd.value,fin:pf.value}; }
      var cs={}; Object.keys(confs).forEach(function(k){ var x=confs[k]; cs[k]={nbPoules:parseInt(x.selP.value,10),suite:x.selS.value,petiteFinale:x.pfC.checked&&(x.selS.value==="demis"||x.selS.value==="finale"),duree:Math.max(4,parseInt(x.dur.value,10)||20)}; });
      trnSauver(eid,{debut:deb.value,fin:fin.value,pause:pause,terrains:Math.max(1,Math.min(12,parseInt(ter.value,10)||1)),battement:Math.max(0,parseInt(bat.value,10)||0),repos:cbR.checked,cats:cs});
      showToast("Réglages du tournoi enregistrés"); onglet="planning"; rendre();
    }));
  }
  function rendrePlanning(c){
    var row=gmRow(zone); row.style.marginTop="0";
    row.appendChild(gmBtn(c.matchs.length?"Générer de nouveau":"Générer le planning","primary",function(){
      if(trnCatsDe(c.equipes).every(function(k){ return c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===k; }).length<2; }))
        return askAlert("Ajoutez au moins 2 équipes dans une catégorie.");
      (c.matchs.length?askConfirm("Le planning actuel sera remplacé par un nouveau.",{confirmText:"Générer"}):Promise.resolve(true)).then(function(ok){
        if(!ok) return;
        var g=trnGenerer(c);
        trnSauver(eid,{matchs:g.matchs,poules:g.poules,formats:g.formats,genereLe:Date.now()},true);
        if(g.hors) askAlert(g.hors+" match"+(g.hors>1?"s finissent":" finit")+" après "+c.fin+" (fin réelle : "+g.finReelle+"). Ajoutez un terrain, raccourcissez les matchs ou le battement, ou choisissez moins de matchs.");
        else showToast("Planning prêt : "+g.matchs.length+" matchs, fin vers "+g.finReelle);
        rendre();
      });
    }));
    if(!c.matchs.length){
      var v=document.createElement("div"); v.style.cssText="font-size:12.5px;color:var(--mut);margin-top:12px;line-height:1.5";
      v.textContent="Renseignez les équipes et le format, puis générez : chaque match reçoit un terrain et un horaire.";
      zone.appendChild(v); return;
    }
    row.appendChild(gmBtn("Planning PDF","soft",function(){ trnPdf(eid); }));
    row.appendChild(gmBtn("Lien et QR code","soft",function(){ trnPublier(eid).then(function(){ trnPartager(eid); }).catch(function(err){ askAlert("Publication impossible ("+((err&&err.code)||"réseau")+"). Réessayez."); }); }));
    var e2=getEvents().find(function(x){ return x.id===eid; })||e;
    var poules=(e2.trn&&e2.trn.poules)||{};
    Object.keys(poules).forEach(function(k){
      gmSection(zone,k+" · "+TRN_SUITES[(e2.trn.formats&&e2.trn.formats[k]&&e2.trn.formats[k].suite)||"aucune"]);
      var gg=document.createElement("div"); gg.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px";
      poules[k].forEach(function(p){
        var card=gmCard(); card.style.margin="0"; card.style.padding="10px 12px";
        card.innerHTML='<div style="font-size:11px;font-weight:900;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Poule '+authEsc(p.nom)+'</div>'+p.equipes.map(function(id){ return '<div style="font-size:13px;font-weight:700;color:var(--txt);padding:2px 0">'+authEsc(trnNom(c,id))+'</div>'; }).join("");
        gg.appendChild(card);
      });
      zone.appendChild(gg);
    });
    gmSection(zone,"Matchs","Fin prévue vers "+trnHeure(Math.max.apply(null,c.matchs.map(function(m){ return trnMin(m.fin); })))+" · "+c.terrains+" terrain"+(c.terrains>1?"s":""));
    zone.appendChild(trnListeHtml(c,c.matchs,false));
  }
  rendre();
}
function trnChoisirEquipesClub(eid,teams,apres){
  var s=gmSheet("Nos équipes"), coches=[];
  teams.forEach(function(t){
    var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr);font-size:13.5px;font-weight:700;color:var(--txt);cursor:pointer";
    var x=document.createElement("input"); x.type="checkbox"; x.style.cssText="width:18px;height:18px;accent-color:var(--dkg)";
    l.appendChild(x); l.appendChild(document.createTextNode((t.name||"Équipe")+(t.cat?" · "+t.cat:""))); s.body.appendChild(l); coches.push({x:x,t:t});
  });
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Ajouter","primary",function(){
    var c=trnCfg(getEvents().find(function(z){ return z.id===eid; })), eq=c.equipes.slice();
    coches.forEach(function(o,i){ if(o.x.checked) eq.push({id:"q"+Date.now().toString(36)+i,nom:String(o.t.name||"Équipe").slice(0,40),club:clubLabel(""),cat:String(o.t.cat||"").slice(0,20)||"Sans catégorie",source:"club"}); });
    trnSauver(eid,eq===c.equipes?{}:{equipes:eq}); s.modal.remove(); apres();
  }));
}
// Liste des matchs, groupés par horaire. Les équipes à venir (phases finales) sont écrites
// en clair (« 1er poule A », « Vainqueur demi-finale 1 »).
function trnListeHtml(c,matchs,publique){
  var labels={}; matchs.forEach(function(m){ labels[m.id]=m.label; });
  var box=document.createElement("div"), parH={};
  matchs.forEach(function(m){ (parH[m.debut]=parH[m.debut]||[]).push(m); });
  Object.keys(parH).sort(function(a,b){ return trnMin(a)-trnMin(b); }).forEach(function(h){
    var g=document.createElement("div"); g.style.cssText="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--bdr)";
    var hh=document.createElement("div"); hh.style.cssText="width:48px;flex-shrink:0;font-size:13px;font-weight:900;color:var(--dkg);font-variant-numeric:tabular-nums;padding-top:6px"; hh.textContent=h;
    var col=document.createElement("div"); col.style.cssText="flex:1;min-width:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:6px";
    parH[h].forEach(function(m){
      var a=m.a?trnNom(c,m.a):trnRefTxt(m.aRef,labels), b=m.b?trnNom(c,m.b):trnRefTxt(m.bRef,labels);
      var d=document.createElement("div");
      d.style.cssText="background:var(--card);border:1px solid "+(m.hors?"var(--red)":"var(--bdr)")+";border-radius:10px;padding:7px 10px"+(m.phase==="finale"?";border-left:4px solid #b7791f":"");
      d.innerHTML='<div style="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.4px">Terrain '+m.terrain+' · '+authEsc(m.cat)+' · '+authEsc(m.label)+(m.hors?' · <span style="color:var(--red)">après l\'heure de fin</span>':'')+'</div>'+
        '<div style="font-size:13px;font-weight:800;color:var(--txt);margin-top:2px">'+authEsc(a)+' <span style="color:var(--mut);font-weight:600">vs</span> '+authEsc(b)+'</div>';
      col.appendChild(d);
    });
    g.appendChild(hh); g.appendChild(col); box.appendChild(g);
  });
  return box;
}

// ── Planning PDF (grille horaires × terrains, à afficher au gymnase) ──
function trnPdf(eid){
  if(typeof window.jspdf==="undefined") return askAlert("Chargement du générateur PDF, réessayez dans quelques secondes");
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var c=trnCfg(e); if(!c.matchs.length) return askAlert("Générez d'abord le planning.");
  var doc=new window.jspdf.jsPDF({orientation:"landscape"}), rgb=clubPdfRgb(), W=297, y=16;
  var labels={}; c.matchs.forEach(function(m){ labels[m.id]=m.label; });
  function nom(id,ref){ return id?trnNom(c,id):trnRefTxt(ref,labels); }
  function entete(){
    doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.setTextColor.apply(doc,rgb);
    doc.text((e.titre||"Tournoi")+" - planning",12,y);
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110,110,110);
    doc.text(clubLabel("")+(e.date?"  -  "+new Date(e.date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}):"")+(e.lieu?"  -  "+e.lieu:""),12,y+6);
    y+=13;
  }
  entete();
  var T=c.terrains, xH=12, wH=16, wT=(W-24-wH)/T;
  function ligneTitre(){
    doc.setFillColor.apply(doc,rgb); doc.rect(xH,y-5,W-24,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(255,255,255);
    doc.text("Heure",xH+2,y);
    for(var t=0;t<T;t++) doc.text("Terrain "+(t+1),xH+wH+t*wT+2,y);
    y+=5;
  }
  ligneTitre();
  var parH={}; c.matchs.forEach(function(m){ (parH[m.debut]=parH[m.debut]||[]).push(m); });
  var heures=Object.keys(parH).sort(function(a,b){ return trnMin(a)-trnMin(b); });
  if(c.pause){ heures.push("_pause"); heures.sort(function(a,b){ return (a==="_pause"?trnMin(c.pause.debut)-0.5:trnMin(a))-(b==="_pause"?trnMin(c.pause.debut)-0.5:trnMin(b)); }); }
  heures.forEach(function(h,i){
    if(y+13>204){ doc.addPage(); y=16; entete(); ligneTitre(); }
    if(h==="_pause"){
      doc.setFillColor(245,240,225); doc.rect(xH,y,W-24,7,"F");
      doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.setTextColor(120,90,20);
      doc.text("Pause de "+c.pause.debut+" à "+c.pause.fin,xH+2,y+5); y+=8; return;
    }
    var hRow=13;
    if(i%2===0){ doc.setFillColor.apply(doc,clubPdfTint(0.94)); doc.rect(xH,y,W-24,hRow,"F"); }
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(20,20,20); doc.text(h,xH+2,y+8);
    parH[h].forEach(function(m){
      var x=xH+wH+(m.terrain-1)*wT+2, maxW=wT-4;
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(110,110,110);
      doc.text(doc.splitTextToSize(m.cat+" - "+m.label,maxW)[0],x,y+4.5);
      doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.setTextColor(20,20,20);
      doc.text(doc.splitTextToSize(nom(m.a,m.aRef),maxW)[0],x,y+8.3);
      doc.text(doc.splitTextToSize("- "+nom(m.b,m.bRef),maxW)[0],x,y+11.8);
    });
    y+=hRow;
  });
  doc.save(clubSlug()+"_tournoi_planning.pdf");
}

// ── Page publique (lien + QR, sans compte) ────────────────────────────
function trnPageId(eid){ return (window.CURRENT_CLUB_ID||"")+"__"+eid; }
function trnLien(eid){ return TRN_URL_BASE+encodeURIComponent(trnPageId(eid)); }
function trnPublier(eid){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return Promise.reject({code:"introuvable"});
  var c=trnCfg(e), club=window.CURRENT_CLUB||{};
  var page={
    clubId:window.CURRENT_CLUB_ID, eventId:String(e.id), titre:String(e.titre||"Tournoi").slice(0,100), date:e.date||"", dateFin:e.dateFin||"",
    heure:e.heure||"", lieu:String(e.lieu||"").slice(0,120), adresse:String(e.adresse||"").slice(0,140), type:"tournoi",
    nom:club.name||"", logo:club.logo||null, couleur:club.couleur||null, couleur2:club.couleur2||null,
    terrains:c.terrains, pause:c.pause, equipes:c.equipes.map(function(q){ return {id:q.id,nom:q.nom,club:q.club||"",cat:q.cat||""}; }),
    poules:(e.trn&&e.trn.poules)||{}, formats:(e.trn&&e.trn.formats)||{},
    matchs:c.matchs.map(function(m){ var o={id:m.id,cat:m.cat,phase:m.phase,label:m.label,terrain:m.terrain,debut:m.debut,fin:m.fin,a:m.a||null,b:m.b||null}; if(m.poule) o.poule=m.poule; if(m.aRef) o.aRef=m.aRef; if(m.bRef) o.bRef=m.bRef; return o; }),
    majLe:Date.now()
  };
  return window.fbSetDoc(window.fbDoc(window.fbDb,"trn_pages",trnPageId(eid)),page).then(function(){ trnSauver(eid,{publieLe:Date.now()},true); });
}
function trnPartager(eid){
  var e=getEvents().find(function(x){ return x.id===eid; })||{}, url=trnLien(eid);
  var s=gmSheet("Planning en ligne");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Équipes, coachs et familles voient les poules et le planning sans compte. Affichez le QR code au gymnase. Après chaque modification du planning, rouvrez cette fenêtre pour mettre la page à jour.";
  var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;padding:12px;background:#fff;border-radius:var(--rs);margin-bottom:10px";
  var box=document.createElement("div"); box.style.cssText="background:var(--card);border:1.5px dashed var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;word-break:break-all;color:var(--txt);font-family:monospace";
  box.textContent=url;
  s.body.appendChild(t); s.body.appendChild(qr); s.body.appendChild(box);
  if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:url,width:200,height:200,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(err){} } else qr.style.display="none";
  var row=gmRow(s.body), txt=clubLabel()+" : "+(e.titre||"Tournoi")+". Poules et planning : "+url;
  row.appendChild(gmBtn("WhatsApp","primary",function(){ window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank"); }));
  row.appendChild(gmBtn("Copier le lien","soft",function(){ copyToClipboard(url); }));
}
function showTrnPublic(pid){
  pid=String(pid||"").replace(/[^a-z0-9_-]/gi,"").slice(0,140);
  if(typeof gmModePublic==="function") gmModePublic(true);
  stack=["trn"]; showScr("trn");
  var el=document.getElementById("trn-public-content"); if(!el) return;
  el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--mut)">Chargement…</div>';
  var n=0;
  (function attendre(){
    if(!window.fbGetDoc||!window.fbDb){ if(n++<60){ setTimeout(attendre,100); return; } el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); return; }
    window.fbGetDoc(window.fbDoc(window.fbDb,"trn_pages",pid)).then(function(snap){
      if(!snap.exists()){ el.innerHTML=essaiErreur("Ce tournoi n'existe pas ou n'est pas encore publié."); return; }
      var p=snap.data();
      window.CURRENT_CLUB_ID=p.clubId;
      window.CURRENT_CLUB={id:p.clubId,name:p.nom||"",logo:(typeof p.logo==="string"&&/^data:image\//.test(p.logo))?p.logo:null,couleur:p.couleur||null,couleur2:p.couleur2||null,liens:{}};
      if(typeof applyClubColor==="function") applyClubColor();
      try{ document.title=(p.titre||"Tournoi")+" · "+(p.nom||""); }catch(e){}
      trnRendrePublic(el,p);
    }).catch(function(){ el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); });
  })();
}
function trnRendrePublic(el,p){
  var c={equipes:p.equipes||[],terrains:p.terrains||1}, cats=Object.keys(p.poules||{});
  if(!cats.length) cats=trnCatsDe(c.equipes);
  var choix=cats[0]||"";
  try{ var mem=localStorage.getItem("gm_trn_cat_"+p.eventId); if(mem&&cats.indexOf(mem)>=0) choix=mem; }catch(e){}
  function rendre(){
    el.innerHTML=evtEntete(p)+'<div style="padding:14px 16px 40px" id="trn-pub"></div>';
    var z=el.querySelector("#trn-pub");
    var f=document.createElement("div"); f.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px";
    cats.forEach(function(k){ var bt=document.createElement("button"); bt.type="button"; bt.className="cat-filter"+(k===choix?" on":""); bt.textContent=k; bt.addEventListener("click",function(){ choix=k; try{ localStorage.setItem("gm_trn_cat_"+p.eventId,k); }catch(e){} rendre(); }); f.appendChild(bt); });
    z.appendChild(f);
    var poules=(p.poules||{})[choix]||[];
    if(poules.length){
      gmSection(z,"Poules");
      var gg=document.createElement("div"); gg.style.cssText="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px";
      poules.forEach(function(po){ var card=gmCard(); card.style.margin="0"; card.style.padding="10px 12px";
        card.innerHTML='<div style="font-size:11px;font-weight:900;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin-bottom:4px">Poule '+authEsc(po.nom)+'</div>'+po.equipes.map(function(id){ return '<div style="font-size:13px;font-weight:700;color:var(--txt);padding:2px 0">'+authEsc(trnNom(c,id))+'</div>'; }).join("");
        gg.appendChild(card); });
      z.appendChild(gg);
    }
    var ms=(p.matchs||[]).filter(function(m){ return m.cat===choix; });
    gmSection(z,"Planning",ms.length?"Du premier match à "+ms[0].debut+" au dernier vers "+ms[ms.length-1].fin+".":"");
    z.appendChild(trnListeHtml(c,ms,true));
    if(p.pause){ var pz=document.createElement("div"); pz.style.cssText="font-size:12px;color:var(--mut);margin-top:10px"; pz.textContent="Pause de "+p.pause.debut+" à "+p.pause.fin+"."; z.appendChild(pz); }
  }
  rendre();
}
