// ══════════════════════════════════════════════════════════════
// BILAN DE SAISON (PDF) — pour les dossiers de subvention (ANS, mairie,
// département) et l'AG. Tout est déduit des données du club :
// licences de la saison (catégorie, genre, âge, commune tirée de l'adresse),
// équipes, pôles, événements (participants lus sur evt_pages) et, en
// Premium avec l'accès compta, les recettes/dépenses de l'exercice.
// ══════════════════════════════════════════════════════════════

// Bornes d'une saison « 2026-2027 » : 1er juillet → 30 juin (comme computeNaturalSeason).
function bilanBornes(saison){
  var a=parseInt(String(saison).slice(0,4),10)||new Date().getFullYear();
  return {debut:a+"-07-01", fin:(a+1)+"-06-30", annee:a};
}
function bilanSaisons(){
  var vus={}, out=[], cur=getCurrentSeason();
  vus[cur]=1; out.push(cur);
  (getLicences()||[]).forEach(function(l){ if(l.saison&&!vus[l.saison]){ vus[l.saison]=1; out.push(l.saison); } });
  return out.sort().reverse();
}
function bilanLicences(saison){
  var cur=getCurrentSeason();
  return (getLicences()||[]).filter(function(l){ return (l.saison||cur)===saison; });
}
// Commune depuis l'adresse libre (« 12 rue X, 42000 Saint-Étienne »).
function bilanCommune(adr){
  var s=String(adr||"").replace(/\s+/g," ").trim();
  var m=s.match(/\b(\d{5})\s*,?\s*([A-Za-zÀ-ÿ'’\- ]{2,40})\s*$/);
  if(m) return {cp:m[1], ville:bilanVille(m[2])};
  m=s.match(/\b(\d{5})\b/);
  if(m) return {cp:m[1], ville:""};
  return null;
}
function bilanVille(v){
  return String(v||"").trim().toLowerCase().replace(/(^|[\s\-'’])([a-zà-ÿ])/g,function(x,a,b){ return a+b.toUpperCase(); }).replace(/\bSt\b/g,"Saint").replace(/\bSte\b/g,"Sainte");
}
// Âge au 1er janvier de la 2e année de la saison (même logique que les catégories FFBB).
function bilanTranche(naissance,annee){
  var y=parseInt(String(naissance||"").slice(0,4),10); if(!y) return "Non renseigné";
  var age=(annee+1)-y-1+(String(naissance).slice(5)<="01-01"?1:0);
  if(age<7) return "Moins de 7 ans";
  if(age<12) return "7 à 11 ans";
  if(age<18) return "12 à 17 ans";
  if(age<26) return "18 à 25 ans";
  if(age<60) return "26 à 59 ans";
  return "60 ans et plus";
}
var BILAN_TRANCHES=["Moins de 7 ans","7 à 11 ans","12 à 17 ans","18 à 25 ans","26 à 59 ans","60 ans et plus","Non renseigné"];

function bilanCalcul(saison){
  var b=bilanBornes(saison), lics=bilanLicences(saison);
  var valides=lics.filter(function(l){ return l.statut==="validee"; });
  var base=valides.length?valides:lics;   // club qui ne valide pas : on compte toutes les fiches
  var g={F:0,M:0,NR:0}, parCat={}, parAge={}, communes={}, sansCommune=0;
  base.forEach(function(l){
    var f=l.fiche||{}, gn=genreNorm(f.genre), cat=l.categorie||"Non classée";
    g[gn]++;
    if(!parCat[cat]) parCat[cat]={F:0,M:0,NR:0};
    parCat[cat][gn]++;
    var t=bilanTranche(f.naissance,b.annee); parAge[t]=(parAge[t]||0)+1;
    var c=bilanCommune(f.adresse);
    if(c){
      // Même commune quelle que soit l'écriture (accents, majuscules, « St ») : regroupée, avec ses codes postaux.
      var k=c.ville?c.ville.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase():c.cp, x=communes[k]||(communes[k]={nom:"",cps:{},n:0});
      x.n++; x.cps[c.cp]=1;
      if(c.ville&&(!x.nom||/[À-ÿ]/.test(c.ville)&&!/[À-ÿ]/.test(x.nom))) x.nom=c.ville;
    } else sansCommune++;
  });
  var parCommune={};
  Object.keys(communes).forEach(function(k){ var x=communes[k]; parCommune[(x.nom||"Code postal")+" ("+Object.keys(x.cps).sort().join(", ")+")"]=x.n; });
  var equipes=(getTeams()||[]).map(function(t){
    var n=0; try{ n=getPlayersForTeam(t).length; }catch(e){}
    return {nom:t.name||"Équipe", cat:t.cat||"", n:n};
  });
  var poles={};
  if(typeof POLES_JOUEURS!=="undefined"){
    (getPlayers()||[]).forEach(function(p){
      Object.keys(p.poles||{}).forEach(function(k){ if(POLES_JOUEURS[k]) poles[k]=(poles[k]||0)+1; });
    });
  }
  var evts=(getEvents()||[]).filter(function(e){
    return ["stage","tournoi","soiree","formation","autre"].indexOf(e.type)>=0 && e.date>=b.debut && e.date<=b.fin && e.statut!=="annulee";
  }).sort(function(x,y){ return String(x.date).localeCompare(String(y.date)); });
  return {saison:saison, bornes:b, total:base.length, enAttente:lics.length-valides.length, compteValides:!!valides.length,
    g:g, parCat:parCat, parAge:parAge, parCommune:parCommune, sansCommune:sansCommune, equipes:equipes, poles:poles, evts:evts};
}
// Participants : billets comptés sur la page publique (stage, soirée…) ou équipes (tournoi).
function bilanParticipants(evts){
  return Promise.all(evts.map(function(e){
    if(e.type==="tournoi"){ var n=((e.trn&&e.trn.equipes)||[]).length; return Promise.resolve(n?n+" équipe"+(n>1?"s":""):""); }
    if(!window.fbGetDoc||!window.fbDb||typeof evtPageId!=="function") return Promise.resolve("");
    return Promise.race([
      window.fbGetDoc(window.fbDoc(window.fbDb,"evt_pages",evtPageId(e.id))).then(function(s){
        if(!s.exists()) return ""; var n=Number(s.data().nb)||0; return n?n+" participant"+(n>1?"s":""):"";
      }).catch(function(){ return ""; }),
      new Promise(function(ok){ setTimeout(function(){ ok(""); },4000); })
    ]);
  }));
}
function bilanCompta(saison){
  if(typeof hasPremium!=="function"||!hasPremium()) return null;
  if(typeof hasModulePermission==="function"&&!hasModulePermission("comptabilite")) return null;
  var ex=(typeof comptaExercice==="function")?comptaExercice(bilanBornes(saison).debut.slice(0,4)+"-09-15"):{debut:bilanBornes(saison).debut,fin:bilanBornes(saison).fin,label:saison};
  var r={}, d={}, tr=0, td=0, n=0;
  (getComptabilite()||[]).forEach(function(l){
    if(!l.date||l.date<ex.debut||l.date>ex.fin) return;
    var m=Number(l.montant)||0, k=l.categorie||"Autre"; n++;
    if(l.type==="depense"){ d[k]=(d[k]||0)+m; td+=m; } else { r[k]=(r[k]||0)+m; tr+=m; }
  });
  return n?{label:ex.label, debut:ex.debut, fin:ex.fin, recettes:r, depenses:d, tr:tr, td:td}:null;
}

// ── Écran de choix puis PDF ──────────────────────────────────────────
function openBilanSaison(){
  var s=gmSheet("Bilan de saison (PDF)");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:10px";
  t.textContent="Pour les dossiers de subvention (ANS, mairie, département) et l'assemblée générale : licenciés par catégorie, genre, âge et commune, équipes, pôles, événements"+((typeof hasPremium==="function"&&hasPremium())?" et comptabilité de l'exercice.":".");
  s.body.appendChild(t);
  var w=document.createElement("div"); w.className="form-group";
  w.innerHTML='<label class="form-label">Saison</label>';
  var sel=document.createElement("select"); sel.className="form-input";
  bilanSaisons().forEach(function(x){ var o=document.createElement("option"); o.value=x; o.textContent=x; sel.appendChild(o); });
  w.appendChild(sel); s.body.appendChild(w);
  var cpt=null;
  if(typeof hasPremium==="function"&&hasPremium()&&(typeof hasModulePermission!=="function"||hasModulePermission("comptabilite"))){
    var lab=document.createElement("label"); lab.style.cssText="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--txt);margin:4px 0 10px;cursor:pointer";
    cpt=document.createElement("input"); cpt.type="checkbox"; cpt.checked=true; cpt.style.cssText="width:17px;height:17px";
    lab.appendChild(cpt); lab.appendChild(document.createTextNode("Inclure la comptabilité (recettes et dépenses par catégorie)"));
    s.body.appendChild(lab);
  }
  var apercu=document.createElement("div"); apercu.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px";
  s.body.appendChild(apercu);
  function maj(){
    var c=bilanCalcul(sel.value);
    apercu.textContent=c.total+" licencié"+(c.total>1?"s":"")+(c.compteValides?" (fiches validées)":"")+" · "+c.equipes.length+" équipe"+(c.equipes.length>1?"s":"")+" · "+c.evts.length+" événement"+(c.evts.length>1?"s":"");
  }
  sel.addEventListener("change",maj); maj();
  var btn=gmBtn("Télécharger le PDF","primary",function(){
    btn.disabled=true; btn.textContent="Préparation…";
    bilanSaisonPdf(sel.value,{compta:!!(cpt&&cpt.checked)}).then(function(){ btn.disabled=false; btn.textContent="Télécharger le PDF"; })
      .catch(function(){ btn.disabled=false; btn.textContent="Télécharger le PDF"; askAlert("Le PDF n'a pas pu être créé. Réessayez."); });
  });
  gmRow(s.body).appendChild(btn);
}
function bilanSaisonPdf(saison,opts){
  opts=opts||{};
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes"); return Promise.resolve(); }
  var c=bilanCalcul(saison), cpt=opts.compta?bilanCompta(saison):null;
  return bilanParticipants(c.evts).then(function(parts){
    var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), tint=(typeof clubPdfTint==="function")?clubPdfTint(0.92):[240,240,240], y=18;
    var eur=function(n){ return (Math.round(n*100)/100).toFixed(2).replace(".",",").replace(/\B(?=(\d{3})+(?!\d))/g," ")+" EUR"; };
    function saut(h){ if(y+h>284){ doc.addPage(); y=20; } }
    function titre(tx){ saut(16); y+=4; doc.setFontSize(12); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb); doc.text(tx,14,y); doc.setFont(undefined,"normal"); y+=7; }
    // Tableau simple : cols = [{t:"Titre", x:14, w:..., a:"left"|"right"}]
    function tableau(cols,rows,totalRow){
      saut(14);
      doc.setFontSize(8.5); doc.setFillColor.apply(doc,rgb); doc.rect(12,y-4.5,186,6.5,"F"); doc.setTextColor(255,255,255); doc.setFont(undefined,"bold");
      cols.forEach(function(k){ doc.text(k.t,k.a==="right"?k.x+k.w:k.x,y,{align:k.a==="right"?"right":"left"}); });
      doc.setFont(undefined,"normal"); y+=6.5; doc.setTextColor(30,30,30);
      rows.concat(totalRow?[totalRow]:[]).forEach(function(r,i){
        saut(7);
        var tot=totalRow&&i===rows.length;
        if(tot){ doc.setFont(undefined,"bold"); doc.setDrawColor(150,150,150); doc.line(12,y-4.5,198,y-4.5); }
        else if(i%2===0){ doc.setFillColor.apply(doc,tint); doc.rect(12,y-4.5,186,6.2,"F"); }
        cols.forEach(function(k,j){ var v=String(r[j]==null?"":r[j]); doc.text(v.length>60?v.slice(0,58)+"…":v,k.a==="right"?k.x+k.w:k.x,y,{align:k.a==="right"?"right":"left"}); });
        if(tot) doc.setFont(undefined,"normal");
        y+=6.2;
      });
      y+=3;
    }
    // En-tête
    doc.setFontSize(18); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb);
    doc.text(clubTitle(),14,y); doc.setFont(undefined,"normal"); y+=8;
    doc.setFontSize(13); doc.setTextColor(40,40,40); doc.text("Bilan de la saison "+saison,14,y); y+=6;
    doc.setFontSize(8.5); doc.setTextColor(110,110,110);
    doc.text("Du "+new Date(c.bornes.debut).toLocaleDateString("fr-FR")+" au "+new Date(c.bornes.fin).toLocaleDateString("fr-FR")+" · document généré le "+new Date().toLocaleDateString("fr-FR"),14,y); y+=8;
    // Chiffres clés
    var cles=[[String(c.total),"licencié"+(c.total>1?"s":"")],[String(c.g.F),"fille"+(c.g.F>1?"s":"")+" / femme"+(c.g.F>1?"s":"")],[String(c.g.M),"garçon"+(c.g.M>1?"s":"")+" / homme"+(c.g.M>1?"s":"")],[String(c.equipes.length),"équipe"+(c.equipes.length>1?"s":"")],[String(c.evts.length),"événement"+(c.evts.length>1?"s":"")]];
    var bw=36.4;
    cles.forEach(function(k,i){
      var x=12+i*(bw+1); doc.setFillColor.apply(doc,tint); doc.roundedRect(x,y,bw,18,2,2,"F");
      doc.setFontSize(15); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb); doc.text(k[0],x+bw/2,y+8.5,{align:"center"});
      doc.setFontSize(7.5); doc.setFont(undefined,"normal"); doc.setTextColor(70,70,70); doc.text(k[1],x+bw/2,y+14,{align:"center"});
    });
    y+=24;
    if(c.compteValides&&c.enAttente>0){ doc.setFontSize(8); doc.setTextColor(120,120,120); doc.text("Fiches validées uniquement ("+c.enAttente+" fiche"+(c.enAttente>1?"s":"")+" encore en attente non comptée"+(c.enAttente>1?"s":"")+").",14,y); y+=5; }
    // Catégories × genre
    titre("Licenciés par catégorie et par genre");
    var cats=Object.keys(c.parCat).sort(function(a,b){ return catRank(a)-catRank(b)||a.localeCompare(b); });
    var colsG=[{t:"Catégorie",x:14},{t:"Féminin",x:88,w:20,a:"right"},{t:"Masculin",x:112,w:20,a:"right"},{t:"Non renseigné",x:142,w:22,a:"right"},{t:"Total",x:174,w:20,a:"right"}];
    tableau(colsG,cats.map(function(k){ var v=c.parCat[k]; return [k,v.F,v.M,v.NR,v.F+v.M+v.NR]; }),["Total",c.g.F,c.g.M,c.g.NR,c.total]);
    // Âges
    titre("Licenciés par tranche d'âge");
    tableau([{t:"Tranche d'âge",x:14},{t:"Licenciés",x:150,w:20,a:"right"},{t:"Part",x:174,w:20,a:"right"}],
      BILAN_TRANCHES.filter(function(k){ return c.parAge[k]; }).map(function(k){ return [k,c.parAge[k],c.total?Math.round(c.parAge[k]*100/c.total)+" %":""]; }));
    // Communes
    titre("Licenciés par commune de résidence");
    var comm=Object.keys(c.parCommune).sort(function(a,b){ return c.parCommune[b]-c.parCommune[a]||a.localeCompare(b); });
    var lignesC=comm.slice(0,20).map(function(k){ return [k,c.parCommune[k],c.total?Math.round(c.parCommune[k]*100/c.total)+" %":""]; });
    var autres=comm.slice(20).reduce(function(s,k){ return s+c.parCommune[k]; },0);
    if(autres) lignesC.push(["Autres communes ("+(comm.length-20)+")",autres,Math.round(autres*100/c.total)+" %"]);
    if(c.sansCommune) lignesC.push(["Adresse non renseignée",c.sansCommune,Math.round(c.sansCommune*100/c.total)+" %"]);
    tableau([{t:"Commune",x:14},{t:"Licenciés",x:150,w:20,a:"right"},{t:"Part",x:174,w:20,a:"right"}],lignesC);
    // Équipes
    if(c.equipes.length){
      titre("Équipes engagées");
      tableau([{t:"Équipe",x:14},{t:"Catégorie",x:110},{t:"Joueurs",x:174,w:20,a:"right"}],c.equipes.map(function(e){ return [e.nom,e.cat,e.n||""]; }));
    }
    // Pôles
    var pk=Object.keys(c.poles);
    if(pk.length){
      titre("Pôles et actions du club");
      tableau([{t:"Pôle",x:14},{t:"Pratiquants",x:174,w:20,a:"right"}],pk.map(function(k){ return [POLES_JOUEURS[k].court,c.poles[k]]; }));
    }
    // Événements
    if(c.evts.length){
      titre("Événements organisés");
      var typ={stage:"Stage",tournoi:"Tournoi",soiree:"Soirée",formation:"Formation",autre:"Événement"};
      tableau([{t:"Date",x:14},{t:"Type",x:40},{t:"Événement",x:66},{t:"Participation",x:174,w:20,a:"right"}],
        c.evts.map(function(e,i){ return [new Date(e.date).toLocaleDateString("fr-FR"),typ[e.type]||"",String(e.titre||"").slice(0,48),parts[i]||""]; }));
    }
    // Compta
    if(cpt){
      titre("Comptabilité de l'exercice "+cpt.label);
      var ks=function(o){ return Object.keys(o).sort(function(a,b){ return o[b]-o[a]; }); };
      tableau([{t:"Recettes",x:14},{t:"Montant",x:164,w:30,a:"right"}],ks(cpt.recettes).map(function(k){ return [k,eur(cpt.recettes[k])]; }),["Total des recettes",eur(cpt.tr)]);
      tableau([{t:"Dépenses",x:14},{t:"Montant",x:164,w:30,a:"right"}],ks(cpt.depenses).map(function(k){ return [k,eur(cpt.depenses[k])]; }),["Total des dépenses",eur(cpt.td)]);
      saut(8); doc.setFontSize(11); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb);
      doc.text("Résultat de l'exercice : "+(cpt.tr-cpt.td>=0?"+":"")+eur(cpt.tr-cpt.td),14,y); doc.setFont(undefined,"normal"); y+=8;
    }
    // Pied de page
    var nb=doc.getNumberOfPages();
    for(var i=1;i<=nb;i++){ doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(140,140,140); doc.text(clubTitle()+" · Bilan de saison "+saison+" · page "+i+"/"+nb,105,292,{align:"center"}); }
    doc.save(clubSlug()+"_bilan_saison_"+saison+".pdf");
  });
}
