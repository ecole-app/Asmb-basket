/* ===== 15d-compta-bilan.js — Bilan simplifié (actif / passif) et annexe (Premium) ===== */
// Ouvert depuis Comptabilité › Comptes annuels. Pensé pour une association
// tenue en comptabilité de trésorerie (ce que fait l'appli) :
//  ACTIF  : immobilisations nettes et stock (saisis), créances adhérents
//           (licences restant dues, pré-rempli), autres créances (saisies),
//           disponibilités = solde de chaque banque / caisse à la clôture,
//           calculé depuis les lignes + le solde de départ du compte.
//  PASSIF : fonds associatifs = report à nouveau (déduit pour que le bilan
//           s'équilibre) + résultat de l'exercice (compte de résultat) ;
//           dettes : notes de frais à rembourser (pré-rempli) + autres dettes.
// Annexe : règles et méthodes, faits marquants, bénévolat valorisé (contributions
// volontaires en nature), effectifs. Saisies et soldes de départ gardés dans
// compta_reglages/plan (bilans[exercice], soldesInit), même droit que la compta.

function comptaBilanReglages(){
  var r=null; try{ r=JSON.parse(localStorage.getItem("asmb_compta_reglages")||"null"); }catch(e){}
  r=(r&&typeof r==="object")?r:{};
  return {soldesInit:r.soldesInit||{}, bilans:r.bilans||{}};
}
function comptaBilanSauver(maj){
  var r=null; try{ r=JSON.parse(localStorage.getItem("asmb_compta_reglages")||"null"); }catch(e){}
  r=(r&&typeof r==="object")?r:{};
  Object.keys(maj).forEach(function(k){ r[k]=maj[k]; });
  r.maj=Date.now();
  localStorage.setItem("asmb_compta_reglages",JSON.stringify(r));
  if(window.SUPPORT_MODE||!window.fbDb||!window.fbSetDoc) return Promise.resolve();
  return window.fbSetDoc(window.fbDoc(window.fbDb,"compta_reglages","plan"),r);
}
// Comptes de trésorerie présents (caisses du club + celles des lignes).
function comptaBilanComptesTreso(all){
  var out=(typeof COMPTA_COMPTES!=="undefined"?COMPTA_COMPTES:["Banque"]).filter(function(c){ return c!=="Autre"; });
  (all||[]).forEach(function(l){ var c=comptaLigneCompte(l); if(c&&out.indexOf(c)<0) out.push(c); });
  return out;
}
// Solde d'un compte à une date : solde de départ (s'il est antérieur) + lignes depuis.
function comptaBilanSolde(all,compte,fin,init){
  var depuis=(init&&init.date&&init.date<=fin)?init.date:null, s=depuis?(Number(init.montant)||0):0;
  (all||[]).forEach(function(l){
    if(comptaLigneCompte(l)!==compte||!l.date||l.date>fin) return;
    if(depuis&&l.date<depuis) return;
    s+=comptaMontantSigne(l);
  });
  return comptaArrondi(s);
}
// Valeurs pré-remplies pour l'exercice en cours (impossible à reconstituer pour un exercice passé).
function comptaBilanSuggestions(ex){
  var cour=comptaExerciceCourant(), o={stock:0,creancesAdh:0,dettesNdf:0};
  if(ex.cle!==cour.cle) return o;
  try{
    (typeof getInventaire==="function"?getInventaire():[]).forEach(function(it){ if(it&&it.categorie==="buvette"&&it.prixAchat!=null) o.stock+=(Number(it.qte)||0)*(Number(it.prixAchat)||0); });
    var saison=(typeof getCurrentSeason==="function")?getCurrentSeason():"";
    (typeof getLicences==="function"?getLicences():[]).forEach(function(l){ if(l&&(!l.saison||l.saison>=saison)&&l.montantAttendu!=null&&typeof licenceMontantDu==="function") o.creancesAdh+=licenceMontantDu(l); });
    (typeof getNotesFrais==="function"?getNotesFrais():[]).forEach(function(n){ if(n&&n.statut==="soumise"&&(!n.date||n.date<=ex.fin)) o.dettesNdf+=Number(n.montant)||0; });
  }catch(e){}
  o.stock=comptaArrondi(o.stock); o.creancesAdh=comptaArrondi(o.creancesAdh); o.dettesNdf=comptaArrondi(o.dettesNdf);
  return o;
}
var COMPTA_BILAN_CHAMPS=["immo","stock","creancesAdh","autresCreances","dettesNdf","autresDettes"];
function comptaBilanSaisie(ex){
  var sv=comptaBilanReglages().bilans[ex.cle]||{}, sug=comptaBilanSuggestions(ex), o={};
  COMPTA_BILAN_CHAMPS.forEach(function(k){ o[k]=(sv[k]!=null)?Number(sv[k])||0:(sug[k]||0); });
  o.faits=sv.faits||""; o.benevH=sv.benevH!=null?Number(sv.benevH)||0:0; o.benevTaux=sv.benevTaux!=null?Number(sv.benevTaux)||0:0;
  o.enregistre=!!sv.maj;
  return o;
}
function comptaBilanCalcul(all,ex,sai){
  var init=comptaBilanReglages().soldesInit;
  var dispo=comptaBilanComptesTreso(all).map(function(c){ return {compte:c,num:(comptaReglages().tresorerie[c]||COMPTA_TRESO_DEFAUT[c]||"471"),solde:comptaBilanSolde(all,c,ex.fin,init[c])}; })
    .filter(function(d){ return d.solde!==0||init[d.compte]; });
  var totDispo=comptaArrondi(dispo.reduce(function(t,d){ return t+d.solde; },0));
  var actif=comptaArrondi(sai.immo+sai.stock+sai.creancesAdh+sai.autresCreances+totDispo);
  var dettes=comptaArrondi(sai.dettesNdf+sai.autresDettes);
  var resultat=comptaCompteResultat(comptaLignesPeriode(all,ex)).resultat;
  var fp=comptaArrondi(actif-dettes), report=comptaArrondi(fp-resultat);
  return {dispo:dispo,totDispo:totDispo,totalActif:actif,dettes:dettes,resultat:resultat,fondsPropres:fp,report:report,totalPassif:comptaArrondi(fp+dettes)};
}

function openComptaBilan(ex){
  if(typeof hasPremium==="function"&&!hasPremium()){ askComptaVerrouillee(); return; }
  var all=getComptabilite();
  var s=gmSheet("Bilan et annexe · "+ex.label), b=s.body;
  var sai=comptaBilanSaisie(ex);
  var zone=document.createElement("div"); b.appendChild(zone);
  function ligne(lib,v,fort,sous){
    return '<div style="display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--bdr);font-size:'+(fort?13.5:12.5)+'px;'+(fort?"font-weight:800;":"")+'color:var(--txt)"><span style="flex:1;min-width:0">'+authEsc(lib)+(sous?'<span style="display:block;font-size:10.5px;color:var(--mut);font-weight:500">'+authEsc(sous)+'</span>':'')+'</span><span style="white-space:nowrap;font-variant-numeric:tabular-nums">'+comptaEur(v)+'</span></div>';
  }
  function titre(t,col){ return '<div style="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:'+(col||"var(--mut)")+';margin:16px 0 4px">'+authEsc(t)+'</div>'; }
  function rendre(){
    var c=comptaBilanCalcul(all,ex,sai);
    var h='<div style="font-size:12px;color:var(--txt2);margin:2px 0 4px">Situation au '+ex.fin.split("-").reverse().join("/")+'</div>'+
      titre("Actif","var(--dkg)")+
      (sai.immo?ligne("Immobilisations (matériel durable, net)",sai.immo):"")+
      (sai.stock?ligne("Stocks (buvette, boutique)",sai.stock):"")+
      (sai.creancesAdh?ligne("Créances adhérents (licences restant dues)",sai.creancesAdh):"")+
      (sai.autresCreances?ligne("Autres créances (subventions, sponsors à recevoir)",sai.autresCreances):"")+
      c.dispo.map(function(d){ return ligne("Disponibilités · "+d.compte,d.solde,false,d.num+" "+comptaLibCompte(d.num)); }).join("")+
      ligne("Total actif",c.totalActif,true)+
      titre("Passif","var(--dkg)")+
      ligne("Fonds associatifs et report à nouveau",c.report,false,"Déduit pour équilibrer le bilan")+
      ligne((c.resultat>=0?"Excédent":"Déficit")+" de l'exercice",c.resultat)+
      ligne("Total fonds propres",c.fondsPropres,true)+
      (sai.dettesNdf?ligne("Dettes : notes de frais à rembourser",sai.dettesNdf):"")+
      (sai.autresDettes?ligne("Autres dettes (fournisseurs, organismes)",sai.autresDettes):"")+
      ligne("Total passif",c.totalPassif,true);
    if(!c.dispo.length) h+='<div style="font-size:12px;color:#c77700;margin-top:8px">Aucune disponibilité : renseignez le solde de départ de vos comptes ci-dessous.</div>';
    if(c.fondsPropres<0) h+='<div style="font-size:12px;color:var(--red);margin-top:8px">Fonds propres négatifs : vérifiez les soldes de départ et les dettes saisies.</div>';
    zone.innerHTML=h;
  }
  rendre();

  // ── Éléments à compléter ──
  var form=document.createElement("div");
  form.innerHTML=titre("Éléments hors trésorerie")+
    '<div style="font-size:11.5px;color:var(--mut);line-height:1.45;margin-bottom:8px">'+(ex.cle===comptaExerciceCourant().cle?"Pré-rempli avec l'inventaire, les licences restant dues et les notes de frais en attente. Ajustez à la date de clôture.":"Exercice passé : saisissez les montants à la date de clôture.")+'</div>';
  var champs=[["immo","Immobilisations nettes (€)"],["stock","Stock à la clôture (€)"],["creancesAdh","Créances adhérents (€)"],["autresCreances","Autres créances (€)"],["dettesNdf","Notes de frais à rembourser (€)"],["autresDettes","Autres dettes (€)"]];
  var grid=document.createElement("div"); grid.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
  champs.forEach(function(f){
    var w=document.createElement("label"); w.style.cssText="display:block;font-size:11.5px;font-weight:700;color:var(--txt2)";
    w.textContent=f[1];
    var i=document.createElement("input"); i.type="number"; i.step="0.01"; i.min="0"; i.className="form-input"; i.style.marginTop="4px"; i.value=sai[f[0]]?String(sai[f[0]]):""; i.dataset.k=f[0];
    i.addEventListener("input",function(){ sai[f[0]]=comptaArrondi(parseFloat(String(i.value).replace(",","."))||0); rendre(); });
    w.appendChild(i); grid.appendChild(w);
  });
  form.appendChild(grid);
  b.appendChild(form);

  // ── Soldes de départ des comptes ──
  var sd=document.createElement("div");
  sd.innerHTML=titre("Soldes de départ des comptes")+'<div style="font-size:11.5px;color:var(--mut);line-height:1.45;margin-bottom:8px">Le solde de chaque compte le jour où vous avez commencé à saisir dans l\'appli (relevé bancaire, comptage de caisse). Les lignes antérieures à cette date sont ignorées pour ce compte.</div>';
  var init=JSON.parse(JSON.stringify(comptaBilanReglages().soldesInit||{}));
  comptaBilanComptesTreso(all).forEach(function(cpt){
    var r=document.createElement("div"); r.style.cssText="display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:6px;align-items:center;margin-bottom:6px";
    var l=document.createElement("div"); l.style.cssText="font-size:12.5px;font-weight:700;color:var(--txt)"; l.textContent=cpt;
    var d=document.createElement("input"); d.type="date"; d.className="form-input"; d.value=(init[cpt]&&init[cpt].date)||""; d.setAttribute("aria-label","Date du solde de départ "+cpt);
    var m=document.createElement("input"); m.type="number"; m.step="0.01"; m.className="form-input"; m.placeholder="Solde €"; m.value=(init[cpt]&&init[cpt].montant!=null)?String(init[cpt].montant):""; m.setAttribute("aria-label","Montant du solde de départ "+cpt);
    function lire(){ var v=parseFloat(String(m.value).replace(",",".")); if(/^\d{4}-\d{2}-\d{2}$/.test(d.value)&&!isNaN(v)) init[cpt]={date:d.value,montant:comptaArrondi(v)}; else delete init[cpt]; }
    d.addEventListener("change",lire); m.addEventListener("input",lire);
    r.appendChild(l); r.appendChild(d); r.appendChild(m); sd.appendChild(r);
  });
  b.appendChild(sd);

  // ── Annexe ──
  var an=document.createElement("div");
  an.innerHTML=titre("Annexe")+
    '<label style="display:block;font-size:11.5px;font-weight:700;color:var(--txt2)">Faits marquants de l\'exercice<textarea class="form-input" id="bl-faits" rows="3" maxlength="1200" style="margin-top:4px;resize:vertical"></textarea></label>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px">'+
      '<label style="display:block;font-size:11.5px;font-weight:700;color:var(--txt2)">Heures de bénévolat<input class="form-input" id="bl-bh" type="number" min="0" step="1" style="margin-top:4px"></label>'+
      '<label style="display:block;font-size:11.5px;font-weight:700;color:var(--txt2)">Valorisation horaire (€)<input class="form-input" id="bl-bt" type="number" min="0" step="0.01" style="margin-top:4px"></label>'+
    '</div><div style="font-size:11px;color:var(--mut);margin-top:4px">Le bénévolat valorisé apparaît dans l\'annexe (contributions volontaires en nature), pas dans le résultat.</div>';
  b.appendChild(an);
  an.querySelector("#bl-faits").value=sai.faits; an.querySelector("#bl-bh").value=sai.benevH?String(sai.benevH):""; an.querySelector("#bl-bt").value=sai.benevTaux?String(sai.benevTaux):"";
  function lireAnnexe(){
    sai.faits=String(an.querySelector("#bl-faits").value||"").trim().slice(0,1200);
    sai.benevH=Math.max(0,parseFloat(an.querySelector("#bl-bh").value)||0);
    sai.benevTaux=Math.max(0,parseFloat(String(an.querySelector("#bl-bt").value).replace(",","."))||0);
  }
  function enregistrer(){
    lireAnnexe();
    var bl=comptaBilanReglages().bilans; bl=Object.assign({},bl);
    var o={maj:Date.now(),faits:sai.faits,benevH:sai.benevH,benevTaux:sai.benevTaux};
    COMPTA_BILAN_CHAMPS.forEach(function(k){ o[k]=sai[k]||0; });
    bl[ex.cle]=o;
    return comptaBilanSauver({bilans:bl,soldesInit:init});
  }
  var row=gmRow(b); row.style.marginTop="14px";
  row.appendChild(gmBtn("📄 Bilan et annexe (PDF)","primary",function(){ enregistrer().catch(function(){}); rendre(); comptaBilanPdf(ex,sai); }));
  row.appendChild(gmBtn("Enregistrer","soft",function(bt){
    bt.disabled=true;
    enregistrer().then(function(){ bt.disabled=false; rendre(); showToast("Bilan enregistré"); }).catch(function(e){ bt.disabled=false; askAlert("Enregistrement impossible ("+((e&&e.code)||"réseau")+")."); });
  }));
  // Les soldes de départ changent le calcul tout de suite.
  sd.addEventListener("change",function(){ localStorage.setItem("asmb_compta_reglages",JSON.stringify(Object.assign(JSON.parse(localStorage.getItem("asmb_compta_reglages")||"{}"),{soldesInit:init}))); rendre(); });
}

function comptaBilanPdf(ex,sai){
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes"); return; }
  var all=getComptabilite(), c=comptaBilanCalcul(all,ex,sai), cr=comptaCompteResultat(comptaLignesPeriode(all,ex));
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), y=18;
  function fr(d){ return d.split("-").reverse().join("/"); }
  function eur(n){ return comptaEur(n).replace("€","EUR"); }
  function haut(t){
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb); doc.text(clubTitle()||"Association",14,y); y+=8;
    doc.setFontSize(13); doc.setTextColor(30,30,30); doc.text(t,14,y); y+=6;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110,110,110);
    var fi=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
    doc.text("Exercice du "+fr(ex.debut)+" au "+fr(ex.fin)+(fi&&fi.siret?"  -  SIRET "+fi.siret:"")+"  -  édité le "+new Date().toLocaleDateString("fr-FR"),14,y); y+=10;
  }
  function entete(t){ doc.setFillColor.apply(doc,rgb); doc.rect(12,y-5,186,7,"F"); doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255,255,255); doc.text(t,14,y); doc.text("Montant",196,y,{align:"right"}); y+=8; }
  function l(lib,v,fort,sous){
    if(y>275){ doc.addPage(); y=20; }
    doc.setFont("helvetica",fort?"bold":"normal"); doc.setFontSize(fort?10:9.5); doc.setTextColor(30,30,30);
    doc.text(doc.splitTextToSize(lib,130)[0],fort?14:18,y); doc.text(eur(v),196,y,{align:"right"});
    if(sous){ y+=4; doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(120,120,120); doc.text(sous,18,y); }
    y+=fort?8:6;
    if(fort){ doc.setDrawColor(210,210,210); doc.line(14,y-12,198,y-12); }
  }
  haut("Bilan simplifié au "+fr(ex.fin));
  entete("ACTIF");
  if(sai.immo) l("Immobilisations (matériel durable, net)",sai.immo);
  if(sai.stock) l("Stocks",sai.stock);
  if(sai.creancesAdh) l("Créances adhérents (licences restant dues)",sai.creancesAdh);
  if(sai.autresCreances) l("Autres créances",sai.autresCreances);
  c.dispo.forEach(function(d){ l("Disponibilités - "+d.compte,d.solde,false,d.num+" "+comptaLibCompte(d.num)); });
  l("TOTAL ACTIF",c.totalActif,true); y+=4;
  entete("PASSIF");
  l("Fonds associatifs et report à nouveau",c.report);
  l((c.resultat>=0?"Excédent":"Déficit")+" de l'exercice",c.resultat);
  l("Total fonds propres",c.fondsPropres,true);
  if(sai.dettesNdf) l("Dettes : notes de frais à rembourser",sai.dettesNdf);
  if(sai.autresDettes) l("Autres dettes",sai.autresDettes);
  l("TOTAL PASSIF",c.totalPassif,true);
  doc.setFontSize(7.5); doc.setTextColor(140,140,140); doc.setFont("helvetica","normal");
  doc.text("Bilan simplifié d'une association tenue en comptabilité de trésorerie. Les fonds associatifs sont déterminés par différence.",14,290);

  doc.addPage(); y=18;
  haut("Annexe aux comptes - exercice "+ex.label);
  function para(titreP,txt){
    if(y>260){ doc.addPage(); y=20; }
    doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor.apply(doc,rgb); doc.text(titreP,14,y); y+=6;
    doc.setFont("helvetica","normal"); doc.setFontSize(9.5); doc.setTextColor(40,40,40);
    doc.splitTextToSize(txt,182).forEach(function(t){ if(y>282){ doc.addPage(); y=20; } doc.text(t,14,y); y+=4.8; });
    y+=5;
  }
  para("1. Règles et méthodes comptables","Les comptes sont présentés selon le règlement ANC n° 2018-06 relatif aux comptes annuels des personnes morales de droit privé à but non lucratif. La comptabilité est tenue en trésorerie : recettes et dépenses sont enregistrées à la date de leur encaissement ou de leur paiement. Les créances et dettes figurant au bilan sont évaluées à la clôture par le bureau. Les fonds associatifs sont déterminés par différence entre l'actif et les dettes.");
  para("2. Résultat de l'exercice","Produits : "+eur(cr.totalProduits)+". Charges : "+eur(cr.totalCharges)+". "+(cr.resultat>=0?"Excédent":"Déficit")+" : "+eur(cr.resultat)+". Le détail figure dans le compte de résultat.");
  var lic=0; try{ var saison=getCurrentSeason(); lic=(getLicences()||[]).filter(function(x){ return x&&(x.statut==="validee"||x.statut==="valide")&&(!x.saison||x.saison===saison); }).length; }catch(e){}
  para("3. Disponibilités",c.dispo.length?c.dispo.map(function(d){ return d.compte+" : "+eur(d.solde); }).join(" ; ")+". Total : "+eur(c.totDispo)+".":"Aucune disponibilité renseignée.");
  if(sai.faits) para("4. Faits marquants",sai.faits);
  var bv=comptaArrondi((sai.benevH||0)*(sai.benevTaux||0));
  para((sai.faits?"5":"4")+". Contributions volontaires en nature",sai.benevH?("Le bénévolat représente environ "+sai.benevH+" heures"+(sai.benevTaux?", valorisées à "+eur(sai.benevTaux)+" de l'heure, soit "+eur(bv):"")+". Ces contributions ne sont pas comptabilisées dans le résultat (comptes 86 et 87)."):"Les dirigeants, éducateurs et bénévoles de l'association interviennent à titre bénévole ; ce bénévolat n'est pas valorisé dans les comptes.");
  if(lic) para((sai.faits?"6":"5")+". Effectifs","Licences validées pour la saison en cours : "+lic+".");
  if(y>250){ doc.addPage(); y=30; }
  y+=6; doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
  doc.text("Comptes approuvés par l'assemblée générale du ..................................",14,y); y+=14;
  doc.text("Le président",30,y); doc.text("Le trésorier",130,y);
  doc.save(clubSlug()+"_bilan_annexe_"+ex.label+".pdf");
}
