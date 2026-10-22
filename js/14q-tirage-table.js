// ── Tirage au sort de la table de marque et de l'arbitrage (matchs à domicile) ──
// Un appui tire toute la période choisie (un mois, une phase d'environ 2 mois, ou la saison) pour que les
// parents sachent à l'avance. Le vivier d'un match = les parents de l'équipe qui joue ; s'il n'y en a pas,
// les joueurs des équipes supérieures et les bénévoles du club (jamais les parents des autres équipes). Équité : on prend toujours ceux qui sont passés le moins
// de fois (historique de la saison compris). Un tour sans match n'est jamais perdu : il passe au match suivant.
// Pas de tirage pendant les vacances scolaires de la zone du club : ces matchs restent « à désigner ».
// Les missions sont des bénévoles de l'événement (js/14g-benevoles.js) : accueil, rappel et SMS déjà en place.

// Vacances scolaires : chargées chaque saison depuis l'API ouverte de l'Éducation nationale
// (data.education.gouv.fr, jeu « fr-en-calendrier-scolaire »), gardées sur l'appareil.
// Table de secours ci-dessous si l'API ne répond pas (début = samedi de sortie, fin = dimanche avant la reprise).
var TIR_VACANCES={
  "2026-2027":{
    toussaint:{A:["2026-10-17","2026-11-01"],B:["2026-10-17","2026-11-01"],C:["2026-10-17","2026-11-01"]},
    noel:{A:["2026-12-19","2027-01-03"],B:["2026-12-19","2027-01-03"],C:["2026-12-19","2027-01-03"]},
    hiver:{A:["2027-02-13","2027-02-28"],B:["2027-02-20","2027-03-07"],C:["2027-02-06","2027-02-21"]},
    printemps:{A:["2027-04-10","2027-04-25"],B:["2027-04-17","2027-05-02"],C:["2027-04-03","2027-04-18"]},
    ete:{A:["2027-07-03","2027-08-31"],B:["2027-07-03","2027-08-31"],C:["2027-07-03","2027-08-31"]}
  }
};
function tirPrefs(){
  var p={zone:"A",postes:{"Table de marque":1,"Arbitrage":1}};
  try{ var s=JSON.parse(localStorage.getItem("gm_tirage_prefs")||"null"); if(s){ if(s.zone) p.zone=s.zone; if(s.postes) p.postes=s.postes; } }catch(e){}
  return p;
}
function tirPrefsSauver(p){ try{ localStorage.setItem("gm_tirage_prefs",JSON.stringify(p)); }catch(e){} }
var TIR_VAC_API={}; // "saison|zone" → [[début, fin, nom], …]
function tirIsoLocal(d){ return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
function tirVacancesCle(saison, zone){ return saison+"|"+zone; }
// Charge (une fois par saison et par zone) les vacances depuis l'API ; ne rejette jamais.
function tirVacancesCharger(saison, zone){
  var cle=tirVacancesCle(saison,zone);
  if(TIR_VAC_API[cle]) return Promise.resolve(TIR_VAC_API[cle]);
  try{ var m=JSON.parse(localStorage.getItem("gm_vacances_"+cle)||"null"); if(m&&m.length){ TIR_VAC_API[cle]=m; return Promise.resolve(m); } }catch(e){}
  if(typeof fetch!=="function") return Promise.resolve(null);
  var where='annee_scolaire="'+saison+'" and zones="Zone '+zone+'"';
  var url="https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records?limit=100&where="+encodeURIComponent(where);
  return fetch(url).then(function(r){ return r.ok?r.json():null; }).then(function(j){
    var res=[], vus={};
    ((j&&j.results)||[]).forEach(function(x){
      if(/enseignant/i.test(x.population||"")||!x.start_date) return;
      // start_date = veille au soir (UTC) → samedi en heure de Paris ; end_date = jour de reprise → on garde la veille.
      var d=new Date(x.start_date), f=x.end_date?new Date(x.end_date):null;
      var deb=tirIsoLocal(d), fin=f?tirIsoLocal(new Date(f.getTime()-86400000)):tirPlusJours(deb,60);
      if(/été/i.test(x.description||"")) fin=tirPlusJours(deb,60);
      var k=deb+fin; if(vus[k]) return; vus[k]=true;
      res.push([deb, fin, String(x.description||"vacances").replace(/^Vacances (de la |de |d')?/i,"")]);
    });
    if(!res.length) return null;
    TIR_VAC_API[cle]=res;
    try{ localStorage.setItem("gm_vacances_"+cle,JSON.stringify(res)); }catch(e){}
    return res;
  }).catch(function(){ return null; });
}
// Nom de la période de vacances qui contient cette date (pour la zone), ou "".
function tirVacances(dateIso, zone){
  var saison=tirSaisonDe(dateIso), api=TIR_VAC_API[tirVacancesCle(saison,zone)];
  if(api){ for(var i=0;i<api.length;i++){ if(dateIso>=api[i][0]&&dateIso<=api[i][1]) return api[i][2]; } return ""; }
  var t=TIR_VACANCES[saison]; if(!t) return "";
  var noms={toussaint:"Toussaint",noel:"Noël",hiver:"hiver",printemps:"printemps",ete:"été"};
  for(var k in t){ var r=t[k][zone]; if(r && dateIso>=r[0] && dateIso<=r[1]) return noms[k]; }
  return "";
}
function tirVacancesConnues(saison, zone){ return !!(TIR_VAC_API[tirVacancesCle(saison,zone)]||TIR_VACANCES[saison]); }
function tirSaisonDe(dateIso){
  var y=parseInt(String(dateIso).slice(0,4),10), m=parseInt(String(dateIso).slice(5,7),10);
  return m>=8 ? y+"-"+(y+1) : (y-1)+"-"+y;
}
function tirHash(s){ var h=0; s=String(s); for(var i=0;i<s.length;i++){ h=((h<<5)-h+s.charCodeAt(i))|0; } return "p"+(h>>>0).toString(36); }
function tirTel(t){ return String(t||"").replace(/[^+0-9]/g,"").replace(/^\+33/,"0"); }
function tirNorm(s){ return String(s||"").trim().toLowerCase(); }
function tirAujourdhui(){ var a=new Date(); return a.getFullYear()+"-"+("0"+(a.getMonth()+1)).slice(-2)+"-"+("0"+a.getDate()).slice(-2); }
function tirPlusJours(iso,n){ var d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }
function tirFr(iso){ try{ return new Date(iso+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}); }catch(e){ return iso; } }

// ── Vivier ────────────────────────────────────────────────────────────────
// Parents d'un joueur : numéros de la fiche joueur, noms pris sur la fiche de licence.
function tirParentsDe(p, lics, comptes){
  var lic=lics.find(function(l){ var f=l.fiche||{}; return tirNorm(f.nom)===tirNorm(p.nom)&&tirNorm(f.prenom)===tirNorm(p.prenom); });
  var f=(lic&&lic.fiche)||{}, res=[];
  [[p.respTel||f.respTel, f.respNom],[p.resp2Tel||f.resp2Tel, f.resp2Nom]].forEach(function(x){
    var tel=tirTel(x[0]); if(!tel) return;
    var nom=String(x[1]||"").trim()||("Parent de "+(p.prenom||""));
    var cpt=comptes.find(function(c){ return tirTel(c.phone)===tel; });
    res.push({cle:tirHash(tel), nom:nom, prenom:String(x[1]||"").trim().split(" ")[0]||"", tel:tel, uid:cpt?cpt.uid:null, de:p.prenom||""});
  });
  return res;
}
// Rang d'une catégorie (Micro < Baby < U7 < … < Senior) ; -1 si inconnue.
function tirRangCat(c){ return (typeof CATS_LIC!=="undefined")?CATS_LIC.indexOf(c):-1; }
function tirVivier(equipeNom, comptes){
  var lics=getLicences()||[], teams=getTeams()||[], team=teams.find(function(t){ return t.name===equipeNom; });
  var parEquipe={}, dansEquipe={};
  var ajoute=function(map,c){ if(!map[c.cle]) map[c.cle]=c; else if(c.de && map[c.cle].de.indexOf(c.de)<0) map[c.cle].de+=", "+c.de; };
  if(team) getPlayersForTeam(team).forEach(function(p){ dansEquipe[p.id]=true; tirParentsDe(p,lics,comptes).forEach(function(c){ ajoute(parEquipe,c); }); });
  // Joueurs des équipes supérieures (catégorie plus âgée que l'équipe qui joue), avec un numéro.
  var rang=team?tirRangCat(team.cat):-1, joueurs=[];
  getPlayers().forEach(function(p){
    if(dansEquipe[p.id]) return;
    var r=tirRangCat(p.cat); if(rang>=0 && !(r>rang)) return;
    var tel=tirTel(p.contact||p.telephone||""); if(!tel) return;
    var cpt=comptes.find(function(c){ return tirTel(c.phone)===tel; });
    joueurs.push({cle:"j"+tirHash(String(p.id)), nom:((p.prenom||"")+" "+(p.nom||"")).trim(), prenom:p.prenom||"", tel:tel, uid:cpt?cpt.uid:null, de:"", joueur:p.cat||""});
  });
  return {equipe:Object.keys(parEquipe).map(function(k){ return parEquipe[k]; }), club:joueurs};
}
function tirBenevolesCarnet(carnet){
  return (carnet||[]).filter(function(x){ return x.actif!==false; }).map(function(x){
    return {cle:"b"+x.id, nom:x.nom, prenom:String(x.nom||"").split(" ")[0], tel:tirTel(x.tel||""), uid:null, benId:x.id, de:""};
  });
}

// ── Historique et équité ──────────────────────────────────────────────────
function tirCleMission(m){ return m.cle||(m.benId?"b"+m.benId:(m.uid?"u"+m.uid:"n"+tirNorm(m.nom))); }
function tirCompteurs(events, postes){
  var n={};
  events.forEach(function(e){ benListe(e).forEach(function(m){ if(postes.indexOf(m.poste)>=0){ var k=tirCleMission(m); n[k]=(n[k]||0)+1; } }); });
  return n;
}

// ── Le tirage ─────────────────────────────────────────────────────────────
function tirMatchs(du, au, zone){
  var ajd=tirAujourdhui();
  return getEvents().filter(function(e){
    if(!e||e.type!=="match"||e.cancelled||!e.date||e.date<ajd||e.date<du||e.date>au) return false;
    return e.domicile===true || (e.domicile===undefined && /domicile/i.test(e.lieu||""));
  }).sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
}
function tirTirer(du, au, prefs, comptes, carnet, opts){
  opts=opts||{};
  var events=getEvents(), postes=Object.keys(prefs.postes).filter(function(p){ return prefs.postes[p]>0; });
  var cnt=tirCompteurs(events, postes), carnetPool=tirBenevolesCarnet(carnet);
  var matchs=opts.eid?getEvents().filter(function(e){ return e.id===opts.eid; }):tirMatchs(du,au,prefs.zone);
  var idTirage=opts.id||("t"+Date.now().toString(36)), res=[], nouveaux={};
  matchs.forEach(function(e){
    var ligne={e:e, affectes:[], manques:[], vacances:opts.forcer?"":tirVacances(e.date,prefs.zone)};
    if(ligne.vacances){ res.push(ligne); return; }
    var deja=benListe(e), pris={};
    deja.forEach(function(m){ pris[tirCleMission(m)]=true; });
    var viv=tirVivier(e.equipe||"", comptes);
    postes.forEach(function(poste){
      var existants=deja.filter(function(m){ return m.poste===poste; }).length;
      for(var i=existants;i<prefs.postes[poste];i++){
        // 1) parents de l'équipe, 2) joueurs des équipes supérieures et bénévoles du club
        var choix=null;
        [viv.equipe, viv.club.concat(carnetPool)].some(function(pool){
          var dispo=pool.filter(function(c){ return !pris[c.cle]; });
          if(!dispo.length) return false;
          var min=Math.min.apply(null,dispo.map(function(c){ return cnt[c.cle]||0; }));
          var egaux=dispo.filter(function(c){ return (cnt[c.cle]||0)===min; });
          choix=egaux[Math.floor(Math.random()*egaux.length)]; return true;
        });
        if(!choix){ ligne.manques.push(poste); continue; }
        pris[choix.cle]=true; cnt[choix.cle]=(cnt[choix.cle]||0)+1;
        var m={id:"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,6), poste:poste, heure:e.heure||"", nom:String(choix.nom).slice(0,60), cle:choix.cle, tirage:idTirage};
        if(choix.prenom) m.prenom=String(choix.prenom).slice(0,40);
        if(choix.uid) m.uid=choix.uid;
        if(choix.benId) m.benId=choix.benId;
        (nouveaux[e.id]=nouveaux[e.id]||[]).push(m);
        ligne.affectes.push({poste:poste, m:m, tel:choix.tel, dePrenom:choix.de, joueur:choix.joueur||""});
      }
    });
    res.push(ligne);
  });
  // Une seule écriture par match
  Object.keys(nouveaux).forEach(function(eid){
    var ev=getEvents().find(function(x){ return x.id===eid; });
    if(ev) benSauver(eid, benListe(ev).concat(nouveaux[eid]));
  });
  try{ localStorage.setItem("gm_dernier_tirage",idTirage); }catch(e){}
  return {id:idTirage, lignes:res, du:du, au:au, prefs:prefs};
}
function tirAnnuler(id){
  var n=0;
  getEvents().forEach(function(e){
    var l=benListe(e), reste=l.filter(function(m){ return m.tirage!==id; });
    if(reste.length!==l.length){ n+=l.length-reste.length; benSauver(e.id,reste); }
  });
  return n;
}

// ── Écran ─────────────────────────────────────────────────────────────────
function tirageOuvrir(){
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.indexOf("dirigeant")<0){ askAlert("Seul le dirigeant peut lancer le tirage."); return; }
  var prefs=tirPrefs(), s=gmSheet("Tirage table de marque et arbitrage");
  var ajd=tirAujourdhui();
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);line-height:1.5;margin-bottom:12px";
  info.textContent="Un appui tire les matchs à domicile de la période. On choisit d'abord les parents de l'équipe qui joue, sinon les joueurs des équipes supérieures et les bénévoles du club. Tout le monde passe à peu près autant de fois. Il manque quelqu'un ? On complète match par match.";
  s.body.appendChild(info);
  var html='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div class="form-group"><label class="form-label">Du</label><input class="form-input" id="tir-du" type="date" value="'+ajd+'"></div>'
    +'<div class="form-group"><label class="form-label">Au</label><input class="form-input" id="tir-au" type="date" value="'+tirPlusJours(ajd,61)+'"></div></div>'
    +'<div style="display:flex;gap:6px;margin:-4px 0 10px;flex-wrap:wrap"><button type="button" id="tir-mois" style="padding:6px 12px;border-radius:16px;border:1.5px solid var(--bdr);background:transparent;color:var(--txt);font-size:11px;font-weight:700;cursor:pointer">Mois</button><button type="button" class="mini" id="tir-2m" style="padding:6px 12px;border-radius:16px;border:1.5px solid var(--bdr);background:transparent;color:var(--txt);font-size:11px;font-weight:700;cursor:pointer">Phase (2 mois)</button>'
    +'<button type="button" id="tir-saison" style="padding:6px 12px;border-radius:16px;border:1.5px solid var(--bdr);background:transparent;color:var(--txt);font-size:11px;font-weight:700;cursor:pointer">Toute la saison</button></div>'
    +'<div class="form-group"><label class="form-label">Zone scolaire du club</label><select class="form-select" id="tir-zone">'
    +["A","B","C"].map(function(z){ return '<option value="'+z+'"'+(prefs.zone===z?" selected":"")+'>Zone '+z+(z==="A"?" (Lyon, Saint-Étienne)":"")+'</option>'; }).join("")+'</select></div>'
    +'<div class="form-label" style="margin-bottom:4px">Postes à tirer (nombre de personnes)</div><div id="tir-postes" style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;margin-bottom:12px">'
    +["Table de marque","Chronomètre","Arbitrage"].map(function(p){
        return '<label style="font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:7px 10px">'+authEsc(p)
          +'<input type="number" min="0" max="4" value="'+(prefs.postes[p]||0)+'" data-poste="'+authEsc(p)+'" style="width:44px;text-align:center" class="form-input"></label>'; }).join("")+'</div>';
  var f=document.createElement("div"); f.innerHTML=html; s.body.appendChild(f);
  // Mois : jusqu'à la fin du mois en cours ; après le 20, le mois suivant entier.
  f.querySelector("#tir-mois").onclick=function(){
    var a=new Date(ajd+"T12:00:00"), debut, fin;
    if(a.getDate()>20){ debut=new Date(a.getFullYear(),a.getMonth()+1,1); fin=new Date(a.getFullYear(),a.getMonth()+2,0); }
    else { debut=a; fin=new Date(a.getFullYear(),a.getMonth()+1,0); }
    f.querySelector("#tir-du").value=tirIsoLocal(debut); f.querySelector("#tir-au").value=tirIsoLocal(fin);
  };
  f.querySelector("#tir-2m").onclick=function(){ f.querySelector("#tir-du").value=ajd; f.querySelector("#tir-au").value=tirPlusJours(ajd,61); };
  f.querySelector("#tir-saison").onclick=function(){
    var sai=(typeof getCurrentSeason==="function"?getCurrentSeason():"")||tirSaisonDe(ajd), an=parseInt(String(sai).slice(5,9),10)||(new Date().getFullYear()+1);
    f.querySelector("#tir-du").value=ajd; f.querySelector("#tir-au").value=an+"-06-30";
  };
  var sortie=document.createElement("div"); sortie.style.cssText="margin-top:14px";
  var col=document.createElement("div"); col.style.cssText="display:flex;flex-direction:column;gap:8px";
  var go=gmBtn("🎲 Tirer au sort","primary",function(b){
    var du=f.querySelector("#tir-du").value, au=f.querySelector("#tir-au").value;
    if(!du||!au||au<du){ askAlert("Choisis une période valide."); return; }
    var p={zone:f.querySelector("#tir-zone").value, postes:{}};
    f.querySelectorAll("#tir-postes input").forEach(function(i){ p.postes[i.getAttribute("data-poste")]=Math.max(0,Math.min(4,parseInt(i.value,10)||0)); });
    if(!Object.keys(p.postes).some(function(k){ return p.postes[k]>0; })){ askAlert("Choisis au moins un poste."); return; }
    tirPrefsSauver(p); b.disabled=true; b.textContent="Tirage en cours…";
    var saisons=[tirSaisonDe(du)]; if(tirSaisonDe(au)!==saisons[0]) saisons.push(tirSaisonDe(au));
    Promise.all([typeof benChargerComptes==="function"?benChargerComptes():[], typeof benCarnetCharger==="function"?benCarnetCharger():[]]
      .concat(saisons.map(function(x){ return tirVacancesCharger(x,p.zone); }))).then(function(r){
      if(saisons.some(function(x){ return !tirVacancesConnues(x,p.zone); })) showToast("Vacances scolaires introuvables pour cette saison : aucun match n'est mis de côté.");
      var t=tirTirer(du,au,p,r[0]||[],r[1]||[]);
      t.comptes=r[0]||[]; t.carnet=r[1]||[];
      b.disabled=false; b.textContent="🎲 Tirer au sort";
      tirResultat(sortie, t, function(){ go.click(); });
      sortie.scrollIntoView({behavior:"smooth",block:"start"});
    }).catch(function(e){ b.disabled=false; b.textContent="🎲 Tirer au sort"; askAlert("Erreur : "+((e&&e.message)||e)); });
  });
  col.appendChild(go); f.appendChild(col); s.body.appendChild(sortie);
  var dernier=""; try{ dernier=localStorage.getItem("gm_dernier_tirage")||""; }catch(e){}
  if(dernier && getEvents().some(function(e){ return benListe(e).some(function(m){ return m.tirage===dernier; }); })){
    var rap=document.createElement("div"); rap.style.cssText="font-size:12px;color:var(--mut);margin-top:12px";
    rap.textContent="Un tirage précédent est déjà enregistré. Un nouveau tirage ne touche pas aux postes déjà remplis."; s.body.appendChild(rap);
    s.body.appendChild(gmBtn("Annuler le dernier tirage","danger",function(){
      askConfirm("Retirer toutes les personnes placées par le dernier tirage ?",{confirmText:"Retirer"}).then(function(ok){ if(!ok) return; var n=tirAnnuler(dernier); showToast(n+" mission"+(n>1?"s":"")+" retirée"+(n>1?"s":"")); s.modal.remove(); });
    }));
  }
}
// Résultat : une ligne par match, puis un SMS récapitulatif par personne.
function tirResultat(box, t, refaire){
  box.innerHTML="";
  var ok=t.lignes.filter(function(l){ return l.affectes.length; }).length;
  var tete=document.createElement("div"); tete.style.cssText="background:#1f844b;color:#fff;border-radius:var(--rx);padding:10px 12px;font-size:13px;font-weight:800;margin-bottom:8px";
  tete.textContent=t.lignes.length?("🎉 "+ok+" match"+(ok>1?"s":"")+" sur "+t.lignes.length+" avec une équipe de service"):"Aucun match à domicile sur cette période.";
  box.appendChild(tete);
  if(!t.lignes.length){
    var h=document.createElement("div"); h.style.cssText="font-size:12px;color:var(--mut);line-height:1.5";
    h.textContent="Les matchs à domicile viennent des championnats liés à la FFBB ou des matchs du planning dont le lieu contient « domicile ».";
    box.appendChild(h); return;
  }
  var parPersonne={};
  t.lignes.forEach(function(l){
    var c=gmCard();
    var titre=(l.e.titre||"Match"), eq=l.e.equipe?(" · "+l.e.equipe):"";
    var txt='<div style="font-size:12px;font-weight:800">'+authEsc(tirFr(l.e.date))+(l.e.heure?" · "+authEsc(l.e.heure):"")+'</div><div style="font-size:11px;color:var(--mut);margin-bottom:6px">'+authEsc(titre)+authEsc(eq)+'</div>';
    if(l.vacances) txt+='<div style="font-size:11px;font-weight:700;color:#E8670A">Vacances ('+authEsc(l.vacances)+') : à désigner à la main</div>';
    l.affectes.forEach(function(a){
      var qui=a.dePrenom?"parent de "+a.dePrenom:(a.joueur?"joueur "+a.joueur:(a.m.benId?"bénévole":""));
      txt+='<div style="font-size:12px"><b>'+authEsc(a.poste)+'</b> : '+authEsc(a.m.nom)+(qui?' <span style="color:var(--mut)">('+authEsc(qui)+')</span>':"")+'</div>';
      var k=a.m.cle; (parPersonne[k]=parPersonne[k]||{nom:a.m.nom,prenom:a.m.prenom,tel:a.tel,items:[]}).items.push({e:l.e,poste:a.poste});
    });
    l.manques.forEach(function(p){ txt+='<div style="font-size:11px;font-weight:700;color:#C0392B">'+authEsc(p)+' : personne de disponible</div>'; });
    c.innerHTML=txt; box.appendChild(c);
    // Compléter ce match : nouveau tirage pour lui seul (même pendant les vacances), ou choix à la main.
    if(l.vacances||l.manques.length){
      var rg=document.createElement("div"); rg.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"; c.appendChild(rg);
      var b1=gmBtn("🎲 Tirer ce match","primary",function(){
        var u=tirTirer(t.du,t.au,t.prefs,t.comptes||[],t.carnet||[],{eid:l.e.id,forcer:true,id:t.id});
        var nl=u.lignes[0]; if(nl){ var i=t.lignes.indexOf(l); nl.e=getEvents().find(function(x){ return x.id===l.e.id; })||l.e;
          nl.affectes=l.affectes.concat(nl.affectes); t.lignes[i]=nl; }
        tirResultat(box,t,refaire);
      });
      var b2=gmBtn("Choisir à la main","soft",function(){ if(typeof benOuvrir==="function") benOuvrir(l.e.id); });
      [b1,b2].forEach(function(b){ b.style.padding="7px 12px"; b.style.fontSize="11px"; rg.appendChild(b); });
    }
  });
  var cles=Object.keys(parPersonne);
  if(cles.length){
    var th=document.createElement("div"); th.style.cssText="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase;margin:14px 0 6px"; th.textContent="Prévenir par SMS (un message par personne)";
    box.appendChild(th);
    cles.forEach(function(k){
      var p=parPersonne[k], row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)";
      var n=document.createElement("div"); n.style.cssText="font-size:12px;min-width:0"; n.innerHTML='<b>'+authEsc(p.nom)+'</b> <span style="color:var(--mut)">· '+p.items.length+' fois</span>';
      row.appendChild(n);
      row.appendChild(gmBtn(p.tel?"SMS":"Pas de numéro","soft",function(){ if(p.tel) tirSms(p); }));
      box.appendChild(row);
    });
  }
  var bas=document.createElement("div"); bas.style.cssText="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap";
  bas.appendChild(gmBtn("Refaire le tirage","soft",function(){
    askConfirm("Retirer ce tirage et en refaire un autre ?",{confirmText:"Refaire"}).then(function(ok){ if(!ok) return; tirAnnuler(t.id); refaire(); });
  }));
  bas.appendChild(gmBtn("Annuler ce tirage","danger",function(){
    askConfirm("Retirer toutes les personnes placées par ce tirage ?",{confirmText:"Retirer"}).then(function(ok){ if(!ok) return; tirAnnuler(t.id); box.innerHTML=""; showToast("Tirage annulé"); });
  }));
  box.appendChild(bas);
}
// SMS récapitulatif : toutes les dates de la personne dans un seul message.
function tirSms(p){
  var club=(typeof clubLabel==="function"?clubLabel(""):"");
  var dates=p.items.sort(function(a,b){ return a.e.date<b.e.date?-1:1; }).map(function(x){
    return tirFr(x.e.date)+(x.e.heure?" "+x.e.heure:"")+" ("+x.poste+(x.e.equipe?", "+x.e.equipe:"")+")";
  }).join(" ; ");
  var prenom=p.prenom||(String(p.nom||"").indexOf("@")>=0?"":String(p.nom||"").split(" ")[0]);
  var txt=(club?club+" : ":"")+"Bonjour"+(prenom?" "+prenom:"")+", vous êtes tiré(e) au sort pour aider aux matchs à domicile : "+dates+". En cas d'empêchement, prévenez-nous au plus vite. Merci !";
  window.location.href="sms:"+p.tel+"?&body="+encodeURIComponent(txt);
}
