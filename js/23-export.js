/* ===== 23-export.js — Exports Excel (.xlsx) : compta, licences, sponsors, inventaire ===== */
// Une seule bibliothèque (SheetJS), chargée à la demande au premier export :
// pas de poids ajouté au démarrage de l'appli. Les cellules texte restent du
// texte (aoa_to_sheet ne les interprète jamais comme formule), donc une fiche
// d'inscription publique contenant "=..." ne s'exécute pas dans Excel.
var XLSX_URL="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
var xlsxLoading=null;
function chargerXlsx(){
  if(window.XLSX) return Promise.resolve();
  if(xlsxLoading) return xlsxLoading;
  xlsxLoading=new Promise(function(resolve,reject){
    var s=document.createElement("script");
    s.src=XLSX_URL;
    s.onload=function(){resolve();};
    s.onerror=function(){xlsxLoading=null;reject(new Error("Chargement impossible"));};
    document.head.appendChild(s);
  });
  return xlsxLoading;
}

// feuilles : [{nom, entetes:[...], lignes:[[...], ...]}] — les nombres restent
// des nombres (sommes possibles dans Excel), le reste est du texte.
function exporterXlsx(nomFichier,feuilles){
  return chargerXlsx().then(function(){
    var wb=XLSX.utils.book_new();
    feuilles.forEach(function(f){
      var data=[f.entetes].concat(f.lignes);
      var ws=XLSX.utils.aoa_to_sheet(data);
      // Largeur de colonne = contenu le plus long (bornée), pour un fichier lisible à l'ouverture.
      ws["!cols"]=f.entetes.map(function(_,i){
        var max=0;
        data.forEach(function(r){var v=r[i]; var l=v==null?0:String(v).length; if(l>max)max=l;});
        return {wch:Math.min(Math.max(max+2,10),50)};
      });
      var nom=String(f.nom).replace(/[\\\/\?\*\[\]:]/g,"-").slice(0,31);
      XLSX.utils.book_append_sheet(wb,ws,nom);
    });
    XLSX.writeFile(wb,nomFichier);
  }).catch(function(){
    askAlert("Impossible de générer le fichier Excel (connexion requise la première fois). Réessayez.");
  });
}
function exportDateStr(){ return new Date().toISOString().slice(0,10); }

// ── COMPTABILITÉ ─────────────────────────────────────────────────────
// Respecte les filtres affichés à l'écran (période, catégorie, compte...).
function exportComptaXlsx(){
  if(typeof hasModulePermission==="function" && !hasModulePermission("comptabilite")){ askAlert("Accès non autorisé."); return; }
  var lines=comptaFilteredList();
  if(!lines.length){ askAlert("Aucune ligne à exporter."); return; }
  var ecritures=lines.map(function(l){
    return [l.date||"",l.type==="depense"?"Dépense":"Recette",Number(l.montant)||0,l.categorie||"",l.motif||"",l.tiers||"",l.moyen||"",comptaLigneCompte(l),l.reference||"",l.pointe?"Oui":"Non"];
  });
  var parCat={};
  lines.forEach(function(l){
    var k=l.categorie||"Autre";
    if(!parCat[k]) parCat[k]={recettes:0,depenses:0};
    if(l.type==="depense") parCat[k].depenses+=Number(l.montant)||0; else parCat[k].recettes+=Number(l.montant)||0;
  });
  var totR=0,totD=0;
  var synthese=Object.keys(parCat).sort().map(function(k){
    totR+=parCat[k].recettes; totD+=parCat[k].depenses;
    return [k,parCat[k].recettes,parCat[k].depenses,parCat[k].recettes-parCat[k].depenses];
  });
  synthese.push(["TOTAL",totR,totD,totR-totD]);
  exporterXlsx(clubSlug()+"_comptabilite_"+exportDateStr()+".xlsx",[
    {nom:"Écritures",entetes:["Date","Type","Montant (€)","Catégorie","Motif","Tiers/Membre","Moyen de paiement","Compte","Référence","Pointé"],lignes:ecritures},
    {nom:"Synthèse par catégorie",entetes:["Catégorie","Recettes (€)","Dépenses (€)","Solde (€)"],lignes:synthese}
  ]);
}

// ── LICENCES (saison affichée, avec suivi des paiements) ─────────────
function exportLicencesXlsx(){
  if(typeof isStaffUser==="function" && !isStaffUser()){ askAlert("Accès non autorisé."); return; }
  var season=getCurrentSeason();
  var all=getLicences();
  var lics=licShowArchived ? all.filter(function(l){return l.saison && l.saison!==season;})
                           : all.filter(function(l){return !l.saison || l.saison===season;});
  lics=lics.filter(function(l){return genreMatch(licGenre(l),licGenreFilter);});
  lics.sort(function(a,b){return compareCatGenreNom(a.categorie,licGenre(a),licNomTri(a),b.categorie,licGenre(b),licNomTri(b));});
  if(!lics.length){ askAlert("Aucune fiche à exporter."); return; }
  var libPaie={paye:"Payé",partiel:"Partiel",impaye:"Impayé"};
  var eff=effectifsParCatGenre(lics,function(l){return l.categorie;},licGenre);
  var lignesEff=eff.rows.concat([{cat:"Total",F:eff.all.F,M:eff.all.M,NR:eff.all.NR,total:eff.all.total}])
    .map(function(r){return [r.cat,r.F,r.M,r.NR,r.total];});
  var lignes=lics.map(function(l){
    var f=l.fiche||{};
    var st=STATUTS.find(function(s){return s.id===l.statut;})||STATUTS[0];
    var sp=licenceStatutPaiement(l);
    return [
      l.code||"",st.label,f.prenom||"",f.nom||"",f.naissance||"",f.genre==="F"?"Féminin":(f.genre?"Masculin":""),
      l.categorie||"",l.typeLicence==="competition"?"Compétition":(l.typeLicence?"Loisir":""),l.saison||season,
      f.emailLic||l.email||"",f.telephone||"",
      f.respNom||"",f.respTel||"",f.respEmail||"",f.resp2Nom||"",f.resp2Tel||"",
      l.montantAttendu!=null?l.montantAttendu:"",licenceMontantPaye(l)||"",l.montantAttendu!=null?licenceMontantDu(l):"",
      sp?libPaie[sp]:"",(l.relances||[]).length,l.suspendue?"Oui":"Non"
    ];
  });
  exporterXlsx(clubSlug()+"_licences_"+exportDateStr()+".xlsx",[
    {nom:"Licences",entetes:["Code","Statut fiche","Prénom","Nom","Naissance","Genre","Catégorie","Type","Saison","Email","Téléphone","Responsable 1","Tél resp. 1","Email resp. 1","Responsable 2","Tél resp. 2","Montant attendu (€)","Payé (€)","Reste dû (€)","Paiement","Relances","Suspendue"],lignes:lignes},
    {nom:"Effectifs",entetes:["Catégorie","Filles","Garçons","Non renseigné","Total"],lignes:lignesEff}
  ]);
}

// ── SPONSORS (respecte l'onglet et la recherche affichés) ────────────
function exportSponsorsXlsx(){
  if(typeof hasModulePermission==="function" && !hasModulePermission("sponsors")){ askAlert("Accès non autorisé."); return; }
  var list=sponsorFilteredList();
  if(!list.length){ askAlert("Aucun sponsor à exporter."); return; }
  var lignes=list.map(function(s){
    return [s.nom||"",SP_STATUT_LABEL[s.statut]||s.statut||"",s.contactNom||"",s.contactTel||"",s.contactEmail||"",s.montant!=null?s.montant:"",s.dateDebut||"",s.dateFin||"",s.relance||"",s.notes||""];
  });
  exporterXlsx(clubSlug()+"_sponsors_"+exportDateStr()+".xlsx",[
    {nom:"Sponsors",entetes:["Nom","Statut","Contact","Téléphone","Email","Montant (€)","Début","Fin","Relance","Notes"],lignes:lignes}
  ]);
}

// ── INVENTAIRE (onglet affiché : buvette ou matériel) ────────────────
function exportInventaireXlsx(){
  if(typeof hasModulePermission==="function" && !hasModulePermission("inventaire")){ askAlert("Accès non autorisé."); return; }
  var items=invFilteredList();
  if(!items.length){ askAlert("Aucun article à exporter."); return; }
  var lignes=items.map(function(it){
    var bas=it.seuil!=null && it.seuil!=="" && Number(it.qte)<Number(it.seuil);
    return [it.nom||"",Number(it.qte)||0,it.unite||"",it.seuil!=null?it.seuil:"",bas?"Oui":"Non",it.prixAchat!=null?it.prixAchat:"",it.prixVente!=null?it.prixVente:"",it.emplacement||"",it.notes||""];
  });
  exporterXlsx(clubSlug()+"_inventaire-"+invActiveTab+"_"+exportDateStr()+".xlsx",[
    {nom:invActiveTab==="buvette"?"Buvette":"Matériel",entetes:["Article","Quantité","Unité","Seuil","Stock bas","Prix d'achat (€)","Prix de vente (€)","Emplacement","Notes"],lignes:lignes}
  ]);
}

// ── BILAN COMPTABLE PDF (Premium) ────────────────────────────────────
// Respecte les filtres affichés (période, catégorie, compte...) : recettes et
// dépenses par catégorie, solde, puis détail des écritures.
function exportComptaBilanPdf(){
  if(typeof hasModulePermission==="function" && !hasModulePermission("comptabilite")){ askAlert("Accès non autorisé."); return; }
  if(typeof hasPremium==="function" && !hasPremium()){ askPremiumRequis("Bilan comptable PDF"); return; }
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes"); return; }
  var lines=comptaFilteredList().slice().sort(function(a,b){return (a.date||"")>(b.date||"")?1:-1;});
  if(!lines.length){ askAlert("Aucune ligne à exporter."); return; }
  var eur=function(n){ return (Math.round(n*100)/100).toFixed(2).replace(".",",")+" EUR"; };
  var parCat={recette:{},depense:{}}, totR=0, totD=0;
  lines.forEach(function(l){
    var t=l.type==="depense"?"depense":"recette", k=l.categorie||"Autre", m=Number(l.montant)||0;
    parCat[t][k]=(parCat[t][k]||0)+m;
    if(t==="depense") totD+=m; else totR+=m;
  });
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), y=16;
  var du=(COMPTA_FILTERS&&COMPTA_FILTERS.du)||lines[0].date, au=(COMPTA_FILTERS&&COMPTA_FILTERS.au)||lines[lines.length-1].date;
  doc.setFontSize(16); doc.setTextColor.apply(doc,rgb);
  doc.text(clubTitle()+" - Bilan comptable",14,y); y+=6;
  doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text("Période : "+(du||"")+" au "+(au||"")+" - généré le "+new Date().toLocaleDateString("fr-FR"),14,y); y+=10;
  function bloc(titre,obj,tot){
    doc.setFontSize(11); doc.setTextColor.apply(doc,rgb); doc.text(titre,14,y); y+=6;
    doc.setFontSize(9); doc.setTextColor(30,30,30);
    Object.keys(obj).sort().forEach(function(k){ doc.text(k,16,y); doc.text(eur(obj[k]),150,y); y+=5.5; });
    doc.setFont(undefined,"bold"); doc.text("Total",16,y); doc.text(eur(tot),150,y); doc.setFont(undefined,"normal"); y+=9;
  }
  bloc("Recettes par catégorie",parCat.recette,totR);
  bloc("Dépenses par catégorie",parCat.depense,totD);
  doc.setFontSize(12); doc.setTextColor.apply(doc,rgb);
  doc.text("Solde : "+eur(totR-totD),14,y); y+=10;
  doc.setFontSize(11); doc.text("Détail des écritures",14,y); y+=6;
  doc.setFontSize(8); doc.setTextColor(255,255,255); doc.setFillColor.apply(doc,rgb);
  doc.rect(12,y-4,186,6,"F"); doc.text("Date",14,y); doc.text("Catégorie",38,y); doc.text("Motif",86,y); doc.text("Montant",172,y); y+=7;
  doc.setTextColor(30,30,30);
  lines.forEach(function(l,i){
    if(y>285){ doc.addPage(); y=20; }
    if(i%2===0){ doc.setFillColor.apply(doc,clubPdfTint(0.92)); doc.rect(12,y-4,186,6,"F"); }
    var m=(l.type==="depense"?"-":"+")+eur(Number(l.montant)||0);
    doc.text(String(l.date||""),14,y); doc.text(String(l.categorie||"").substring(0,26),38,y);
    doc.text(String(l.motif||"").substring(0,48),86,y); doc.text(m,172,y); y+=6;
  });
  doc.save(clubSlug()+"_bilan_comptable_"+exportDateStr()+".pdf");
}
