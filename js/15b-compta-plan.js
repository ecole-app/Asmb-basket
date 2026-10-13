/* ===== 15b-compta-plan.js — Compta « façon Dolibarr » : plan comptable associatif, pièces, exercice ===== */
// Chaque ligne de la compta (saisie à la main OU écrite automatiquement :
// licences, chèques, buvette, billetterie, notes de frais) reste une ligne
// simple (type, catégorie, compte/caisse). La vraie comptabilité en est
// DÉDUITE ici, sans rien ressaisir :
//   - compte de charge/produit (plan comptable des associations, règlement
//     ANC 2018-06) tiré de la catégorie, modifiable par club ou par ligne ;
//   - compte de trésorerie (512 banque, 530 caisse…) tiré du compte/caisse ;
//   - journal (BQ, CA, OD) et n° de pièce continu par journal et exercice ;
//   - exercice au choix : année civile ou saison (ex. septembre → août).
// Réglages du club : clubs/{clubId}/compta_reglages/plan (même droit que la
// compta : dirigeant ou trésorier délégué), copie locale asmb_compta_reglages.

var PCG_COMPTES={
  "411":"Clients et adhérents","467":"Autres comptes débiteurs ou créditeurs","471":"Compte d'attente",
  "512":"Banque","530":"Caisse","531":"Caisse buvette",
  "601":"Achats stockés","606":"Achats non stockés de fournitures","6061":"Fournitures non stockables (eau, énergie)","6063":"Petit équipement et matériel sportif","6064":"Fournitures administratives","6068":"Autres fournitures",
  "607":"Achats de marchandises","611":"Sous-traitance générale","613":"Locations","614":"Charges locatives","615":"Entretien et réparations","616":"Primes d'assurance","618":"Documentation, colloques",
  "621":"Personnel extérieur","622":"Rémunérations d'intermédiaires et honoraires","6226":"Honoraires","623":"Publicité, publications","6234":"Cadeaux et récompenses","6238":"Divers (pourboires, dons courants)",
  "624":"Transports de biens","625":"Déplacements, missions et réceptions","6251":"Voyages et déplacements","6257":"Réceptions","626":"Frais postaux et télécommunications","627":"Services bancaires","628":"Cotisations et divers","6281":"Cotisations (fédération, ligue, comité)",
  "635":"Impôts et taxes","641":"Rémunérations du personnel","645":"Charges de sécurité sociale","647":"Autres charges sociales","651":"Redevances (licences, logiciels)","657":"Aides financières accordées","658":"Charges diverses de gestion courante","661":"Charges d'intérêts","671":"Charges exceptionnelles","681":"Dotations aux amortissements",
  "701":"Ventes de produits finis","706":"Prestations de services","7061":"Stages et camps","7062":"Partenariats, sponsoring","707":"Ventes de marchandises","708":"Produits des activités annexes",
  "740":"Subventions d'exploitation","7411":"Subvention de l'État","7412":"Subvention de la région","7413":"Subvention du département","7414":"Subvention de la commune","7418":"Subventions des organismes (ANS, CAF…)",
  "754":"Dons manuels","7541":"Dons manuels","755":"Mécénat","756":"Cotisations","758":"Produits divers de gestion courante","768":"Autres produits financiers","771":"Produits exceptionnels","791":"Transferts de charges"
};
var COMPTA_PLAN_DEFAUT={
  "recette|Cotisations/Licences":"756","recette|Licence":"756","recette|Subventions":"740",
  "recette|Sponsors/Partenaires":"706","recette|Buvette/Événements":"707","recette|Événement":"706",
  "recette|Dons":"754","recette|Autre":"758",
  "depense|Affiliation/Licences fédérales":"628","depense|Location salle":"613","depense|Matériel":"6063",
  "depense|Achats buvette":"607","depense|Déplacements":"625","depense|Arbitrage/Formations":"622",
  "depense|Assurances":"616","depense|Frais administratifs":"6064","depense|Note de frais":"625","depense|Autre":"658"
};
var COMPTA_TRESO_DEFAUT={"Banque":"512","Caisse espèces":"530","Caisse buvette":"531","Autre":"471"};
var COMPTA_JOURNAUX={BQ:"Banque",CA:"Caisse",OD:"Opérations diverses"};
var COMPTA_MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

// ── Réglages du club ─────────────────────────────────────────────────
function comptaReglages(){
  var r=null;
  try{ r=JSON.parse(localStorage.getItem("asmb_compta_reglages")||"null"); }catch(e){}
  r=(r&&typeof r==="object")?r:{};
  var m=parseInt(r.debutMois,10);
  return {debutMois:(m>=1&&m<=12)?m:1, comptes:r.comptes||{}, tresorerie:r.tresorerie||{}};
}
function comptaChargerReglages(){
  if(!window.fbDb||!window.fbGetDoc||!window.fbDoc) return Promise.resolve(comptaReglages());
  return window.fbGetDoc(window.fbDoc(window.fbDb,"compta_reglages","plan")).then(function(snap){
    if(snap&&snap.exists()) localStorage.setItem("asmb_compta_reglages",JSON.stringify(snap.data()));
    return comptaReglages();
  }).catch(function(){ return comptaReglages(); });
}
function comptaSauverReglages(r){
  var propre={debutMois:r.debutMois, comptes:r.comptes||{}, tresorerie:r.tresorerie||{}, maj:Date.now()};
  localStorage.setItem("asmb_compta_reglages",JSON.stringify(propre));
  if(window.SUPPORT_MODE||!window.fbDb||!window.fbSetDoc) return Promise.resolve();
  return window.fbSetDoc(window.fbDoc(window.fbDb,"compta_reglages","plan"),propre);
}

// ── Exercice ─────────────────────────────────────────────────────────
// debutMois=1 → année civile (« 2026 ») ; sinon saison (« 2026-2027 »).
// cle = année de début de l'exercice (sert au n° de pièce).
function comptaExercice(dateIso, debutMois){
  if(debutMois==null) debutMois=comptaReglages().debutMois;
  var y=parseInt(String(dateIso||"").slice(0,4),10), m=parseInt(String(dateIso||"").slice(5,7),10);
  if(!y||!m){ var d=new Date(); y=d.getFullYear(); m=d.getMonth()+1; }
  var an=m>=debutMois?y:y-1;
  function p2(n){ return (n<10?"0":"")+n; }
  var debut=an+"-"+p2(debutMois)+"-01";
  var finAn=debutMois===1?an:an+1, finMois=debutMois===1?12:debutMois-1;
  var finJour=new Date(Date.UTC(finAn,finMois,0)).getUTCDate();
  return {cle:String(an), debut:debut, fin:finAn+"-"+p2(finMois)+"-"+p2(finJour), label:debutMois===1?String(an):an+"-"+(an+1)};
}
function comptaExerciceCourant(){ return comptaExercice(new Date().toISOString().slice(0,10)); }
// Exercices présents dans les lignes (+ le courant), du plus récent au plus ancien.
function comptaExercicesConnus(lines){
  var vus={}, out=[], cour=comptaExerciceCourant();
  vus[cour.cle]=1; out.push(cour);
  (lines||[]).forEach(function(l){ if(!l.date) return; var e=comptaExercice(l.date); if(!vus[e.cle]){ vus[e.cle]=1; out.push(e); } });
  return out.sort(function(a,b){ return b.cle.localeCompare(a.cle); });
}

// ── Comptes ──────────────────────────────────────────────────────────
function comptaCompteNum(l){
  if(l&&l.compteNum) return String(l.compteNum);
  var t=(l&&l.type)==="depense"?"depense":"recette", k=t+"|"+((l&&l.categorie)||"Autre"), r=comptaReglages();
  return r.comptes[k]||COMPTA_PLAN_DEFAUT[k]||(t==="depense"?"658":"758");
}
function comptaCompteAuto(type,categorie){
  var k=(type==="depense"?"depense":"recette")+"|"+(categorie||"Autre"), r=comptaReglages();
  return r.comptes[k]||COMPTA_PLAN_DEFAUT[k]||(type==="depense"?"658":"758");
}
function comptaTresoNum(l){
  var c=comptaLigneCompte(l), r=comptaReglages();
  return r.tresorerie[c]||COMPTA_TRESO_DEFAUT[c]||"471";
}
function comptaLibCompte(num){
  num=String(num||"");
  if(PCG_COMPTES[num]) return PCG_COMPTES[num];
  for(var i=num.length-1;i>=2;i--){ if(PCG_COMPTES[num.slice(0,i)]) return PCG_COMPTES[num.slice(0,i)]; }
  return "Compte "+num;
}
function comptaJournal(l){
  var t=comptaTresoNum(l);
  if(t.indexOf("512")===0) return "BQ";
  if(t.indexOf("53")===0) return "CA";
  return "OD";
}

// ── N° de pièce : continu par journal et par exercice (BQ26-0001…) ───
// Donné une fois pour toutes. Une ligne qui change de journal ou d'exercice
// (date ou caisse modifiée) reçoit un nouveau numéro en fin de séquence.
function comptaPrefixe(l){ return comptaJournal(l)+comptaExercice(l.date).cle.slice(2)+"-"; }
function comptaNumeroter(lines){
  if(!lines||!lines.length) return 0;
  var maxi={}, a=[];
  lines.forEach(function(l){
    if(!l||!l.date) return;
    var p=comptaPrefixe(l);
    if(l.piece&&String(l.piece).indexOf(p)===0){
      var n=parseInt(String(l.piece).slice(p.length),10);
      if(n>0&&(!maxi[p]||n>maxi[p])) maxi[p]=n;
    } else a.push(l);
  });
  a.sort(function(x,y){ return (x.date||"").localeCompare(y.date||"")||String(x.id||"").localeCompare(String(y.id||"")); });
  a.forEach(function(l){
    var p=comptaPrefixe(l), n=(maxi[p]||0)+1; maxi[p]=n;
    l.piece=p+("000"+n).slice(-Math.max(4,String(n).length));
  });
  return a.length;
}
// Deux lignes avec la même pièce (deux appareils hors ligne au même moment) :
// on renumérote la seconde.
function comptaDedoublonnerPieces(lines){
  var vus={}, n=0;
  lines.slice().sort(function(x,y){ return String(x.id||"").localeCompare(String(y.id||"")); }).forEach(function(l){
    if(!l.piece) return;
    if(vus[l.piece]){ delete l.piece; n++; } else vus[l.piece]=1;
  });
  return n;
}

// ── Écran Comptabilité : sélecteur d'exercice + réglages ─────────────
function comptaFiltreExercice(fEl, all){
  var ex=comptaExercicesConnus(all);
  var sel=document.createElement("select");
  sel.style.cssText="flex:1 1 100%;padding:8px;border:1.5px solid var(--dkg);border-radius:8px;font-size:12px;font-weight:700;background:var(--bg);color:var(--txt)";
  var actuel="";
  ex.forEach(function(e){ if(COMPTA_FILTERS.du===e.debut&&COMPTA_FILTERS.au===e.fin) actuel=e.cle; });
  sel.innerHTML='<option value="">Tous les exercices</option>'+ex.map(function(e){
    return '<option value="'+e.cle+'"'+(actuel===e.cle?" selected":"")+'>Exercice '+e.label+'</option>';
  }).join("")+(actuel===""&&(COMPTA_FILTERS.du||COMPTA_FILTERS.au)?'<option value="_" selected>Période personnalisée</option>':'');
  sel.addEventListener("change",function(){
    var e=ex.filter(function(x){ return x.cle===sel.value; })[0];
    COMPTA_FILTERS.du=e?e.debut:""; COMPTA_FILTERS.au=e?e.fin:"";
    buildComptabilite();
  });
  fEl.insertBefore(sel,fEl.firstChild);
}
function comptaLigneInfos(l){
  var n=comptaCompteNum(l);
  return (l.piece?l.piece+" · ":"")+n+" "+comptaLibCompte(n);
}
// Champ « Compte comptable » ajouté au formulaire de ligne (sans toucher index.html).
function comptaChampCompte(){
  var sel=document.getElementById("cl-compte-num");
  if(sel) return sel;
  var cat=document.getElementById("cl-categorie"); if(!cat||!cat.parentNode) return null;
  var g=document.createElement("div"); g.className="form-group";
  g.innerHTML='<label class="form-label">Compte comptable</label><select class="form-input" id="cl-compte-num"></select>';
  cat.parentNode.parentNode.insertBefore(g,cat.parentNode.nextSibling);
  cat.addEventListener("change",function(){ comptaRemplirCompte(); });
  return document.getElementById("cl-compte-num");
}
function comptaRemplirCompte(valeur){
  var sel=comptaChampCompte(); if(!sel) return;
  if(valeur===undefined) valeur=sel.value;
  var type=typeof comptaCurrentType!=="undefined"?comptaCurrentType:"recette";
  var classe=type==="depense"?"6":"7";
  var auto=comptaCompteAuto(type,(document.getElementById("cl-categorie")||{}).value);
  var nums=Object.keys(PCG_COMPTES).filter(function(k){ return k.charAt(0)===classe; });
  if(valeur&&nums.indexOf(valeur)<0) nums.push(valeur);
  nums.sort();
  sel.innerHTML='<option value="">Automatique · '+auto+' '+authEsc(comptaLibCompte(auto))+'</option>'+
    nums.map(function(k){ return '<option value="'+k+'">'+k+' '+authEsc(comptaLibCompte(k))+'</option>'; }).join("");
  sel.value=valeur||"";
}

function openComptaPlan(){
  if(typeof hasPremium==="function"&&!hasPremium()){ askComptaVerrouillee(); return; }
  comptaChargerReglages().then(function(r){ comptaPlanFenetre(r); });
}
function comptaPlanFenetre(r){
  var s=gmSheet("Plan comptable");
  var b=s.body;
  gmSection(b,"Exercice comptable","Année civile, ou saison sportive (le plus courant : septembre → août). Sert aux numéros de pièce, au compte de résultat et à l'export FEC.");
  var mois=document.createElement("select"); mois.className="form-input";
  mois.innerHTML=COMPTA_MOIS.map(function(m,i){
    var d=i+1; return '<option value="'+d+'">'+(d===1?"Année civile (janvier → décembre)":"Du 1er "+m+" au "+COMPTA_MOIS[(i+11)%12]+" suivant")+'</option>';
  }).join("");
  mois.value=String(r.debutMois); b.appendChild(mois);
  var ex=document.createElement("div"); ex.style.cssText="font-size:12px;color:var(--txt2);margin:6px 0 4px";
  function majEx(){ var e=comptaExercice(new Date().toISOString().slice(0,10),parseInt(mois.value,10)); ex.textContent="Exercice en cours : "+e.label+" (du "+e.debut.split("-").reverse().join("/")+" au "+e.fin.split("-").reverse().join("/")+")"; }
  mois.addEventListener("change",majEx); majEx(); b.appendChild(ex);

  var dl=document.createElement("datalist"); dl.id="pcg-list";
  dl.innerHTML=Object.keys(PCG_COMPTES).sort().map(function(k){ return '<option value="'+k+'">'+authEsc(PCG_COMPTES[k])+'</option>'; }).join("");
  b.appendChild(dl);
  var champs=[];
  function ligne(parent,label,cle,defaut,classes,cible){
    var row=document.createElement("div"); row.style.cssText="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bdr)";
    var lab=document.createElement("div"); lab.style.cssText="flex:1;min-width:0;font-size:12.5px;color:var(--txt)";
    var inp=document.createElement("input"); inp.className="form-input"; inp.setAttribute("list","pcg-list"); inp.inputMode="numeric";
    inp.style.cssText="width:92px;flex-shrink:0;padding:7px 8px;font-size:13px;font-weight:700;text-align:center";
    inp.value=cible[cle]||defaut; inp.dataset.defaut=defaut;
    function majLab(){ lab.innerHTML=authEsc(label)+'<div style="font-size:11px;color:var(--mut)">'+authEsc(comptaLibCompte(inp.value.trim()||defaut))+'</div>'; }
    inp.addEventListener("input",majLab); majLab();
    row.appendChild(lab); row.appendChild(inp); parent.appendChild(row);
    champs.push({inp:inp,cle:cle,classes:classes,cible:cible===r.tresorerie?"tresorerie":"comptes",label:label});
  }
  gmSection(b,"Recettes → comptes de produits (classe 7)");
  var AUTO_LAB={"Licence":"Licence (paiement enregistré sur la fiche)","Événement":"Événement (billetterie)","Note de frais":"Note de frais (validée)"};
  COMPTA_CATS.recette.concat(["Licence","Événement"]).forEach(function(c){ ligne(b,AUTO_LAB[c]||c,"recette|"+c,COMPTA_PLAN_DEFAUT["recette|"+c]||"758","7",r.comptes); });
  gmSection(b,"Dépenses → comptes de charges (classe 6)");
  COMPTA_CATS.depense.concat(["Note de frais"]).forEach(function(c){ ligne(b,AUTO_LAB[c]||c,"depense|"+c,COMPTA_PLAN_DEFAUT["depense|"+c]||"658","6",r.comptes); });
  gmSection(b,"Comptes / caisses → trésorerie","512 = banque, 53x = caisse, 471 = compte d'attente. Le journal suit : BQ pour la banque, CA pour les caisses, OD sinon.");
  COMPTA_COMPTES.forEach(function(c){ ligne(b,c,c,COMPTA_TRESO_DEFAUT[c]||"471","45",r.tresorerie); });
  var row=gmRow(b); row.style.marginTop="16px";
  row.appendChild(gmBtn("Enregistrer","primary",function(btn){
    var n={debutMois:parseInt(mois.value,10),comptes:{},tresorerie:{}}, err="";
    champs.forEach(function(c){
      var v=c.inp.value.trim().replace(/\s/g,"");
      if(!v) v=c.inp.dataset.defaut;
      if(!/^\d{3,8}$/.test(v)||c.classes.indexOf(v.charAt(0))<0){ err=err||("« "+c.label+" » : le compte doit commencer par "+c.classes.split("").join(" ou ")+" (3 à 8 chiffres)."); return; }
      if(v!==c.inp.dataset.defaut) n[c.cible][c.cle]=v;
    });
    if(err) return askAlert(err);
    var changeEx=n.debutMois!==comptaReglages().debutMois;
    (changeEx&&getComptabilite().length?askConfirm("Changer d'exercice refait les numéros de pièce de toutes les lignes, pour qu'ils restent continus dans chaque exercice. Continuer ?",{confirmText:"Changer l'exercice"}):Promise.resolve(true)).then(function(ok){
    if(!ok) return;
    btn.disabled=true;
    comptaSauverReglages(n).then(function(){
      // Nouvel exercice : numérotation refaite de zéro (séquences continues).
      if(changeEx){ var lines=getComptabilite(); lines.forEach(function(l){ delete l.piece; }); comptaNumeroter(lines); saveComptabilite(lines); }
      s.modal.remove(); showToast("Plan comptable enregistré");
      if(typeof buildComptabilite==="function") buildComptabilite();
    }).catch(function(e){ btn.disabled=false; askAlert("Enregistrement impossible ("+((e&&e.code)||"réseau")+"). Réessayez."); });
    });
  }));
  row.appendChild(gmBtn("Valeurs par défaut","ghost",function(){
    champs.forEach(function(c){ c.inp.value=c.inp.dataset.defaut; c.inp.dispatchEvent(new Event("input")); });
  }));
}

// ── Étape 2 : comptes annuels (compte de résultat + FEC) ──────────────
// Rubriques du compte de résultat des associations (règlement ANC 2018-06).
// Le premier motif qui correspond l'emporte (ordre important).
var CR_PRODUITS=[
  {lib:"Cotisations",re:/^756/},
  {lib:"Ventes de biens et services (stages, buvette, partenariats…)",re:/^70/},
  {lib:"Subventions d'exploitation",re:/^74/},
  {lib:"Dons, mécénat (générosité du public)",re:/^75[45]/},
  {lib:"Autres produits de gestion courante",re:/^75/},
  {lib:"Produits financiers",re:/^76/},
  {lib:"Produits exceptionnels",re:/^77/},
  {lib:"Reprises et transferts de charges",re:/^7[89]/},
  {lib:"Autres produits",re:/^7/}
];
var CR_CHARGES=[
  {lib:"Achats (matériel, fournitures, marchandises)",re:/^60/},
  {lib:"Services extérieurs (locations, entretien, assurances)",re:/^61/},
  {lib:"Autres services extérieurs (honoraires, déplacements, cotisations)",re:/^62/},
  {lib:"Impôts et taxes",re:/^63/},
  {lib:"Charges de personnel",re:/^64/},
  {lib:"Autres charges de gestion courante",re:/^65/},
  {lib:"Charges financières",re:/^66/},
  {lib:"Charges exceptionnelles",re:/^67/},
  {lib:"Dotations aux amortissements et provisions",re:/^68/},
  {lib:"Autres charges",re:/^6/}
];
function comptaArrondi(n){ return Math.round((Number(n)||0)*100)/100; }
function comptaLignesPeriode(lines,ex){
  return (lines||[]).filter(function(l){ var d=l.date||""; return d>=ex.debut&&d<=ex.fin; });
}
// Une ligne = une écriture à 2 lignes : recette → débit trésorerie / crédit produit ;
// dépense → débit charge / crédit trésorerie (montant négatif : sens inversé).
function comptaEcritures(l){
  var m=comptaArrondi(l.montant); if(!m) return [];
  var cn=comptaCompteNum(l), tr=comptaTresoNum(l), dep=l.type==="depense";
  var debit=dep?cn:tr, credit=dep?tr:cn;
  if(m<0){ m=-m; var x=debit; debit=credit; credit=x; }
  return [{compte:debit,debit:m,credit:0},{compte:credit,debit:0,credit:m}];
}
function comptaCompteResultat(lines){
  var soldes={};
  (lines||[]).forEach(function(l){
    comptaEcritures(l).forEach(function(e){ soldes[e.compte]=(soldes[e.compte]||0)+e.debit-e.credit; });
  });
  function rubriques(def,classe,signe){
    var out=def.map(function(r){ return {lib:r.lib,re:r.re,total:0,comptes:{}}; }), tot=0;
    Object.keys(soldes).forEach(function(num){
      if(num.charAt(0)!==classe) return;
      var v=comptaArrondi(soldes[num]*signe); if(!v) return;
      for(var i=0;i<out.length;i++){ if(out[i].re.test(num)){ out[i].comptes[num]=v; out[i].total=comptaArrondi(out[i].total+v); break; } }
      tot=comptaArrondi(tot+v);
    });
    return {rubriques:out,total:tot};
  }
  var P=rubriques(CR_PRODUITS,"7",-1), C=rubriques(CR_CHARGES,"6",1);
  return {produits:P.rubriques,totalProduits:P.total,charges:C.rubriques,totalCharges:C.total,resultat:comptaArrondi(P.total-C.total)};
}
function comptaEur(n){
  n=comptaArrondi(n); var neg=n<0, s=Math.abs(n).toFixed(2).split(".");
  return (neg?"-":"")+s[0].replace(/\B(?=(\d{3})+(?!\d))/g," ")+","+s[1]+" €";
}

function openComptaComptes(){
  if(typeof hasModulePermission==="function"&&!hasModulePermission("comptabilite")){ askAlert("Accès non autorisé."); return; }
  if(typeof hasPremium==="function"&&!hasPremium()){ askComptaVerrouillee(); return; }
  var all=getComptabilite();
  if(comptaDedoublonnerPieces(all)+comptaNumeroter(all)>0) saveComptabilite(all);
  var exs=comptaExercicesConnus(all);
  var s=gmSheet("Comptes annuels"), b=s.body;
  var sel=document.createElement("select"); sel.className="form-input";
  sel.innerHTML=exs.map(function(e){ return '<option value="'+e.cle+'">Exercice '+e.label+'</option>'; }).join("");
  // Par défaut : le dernier exercice terminé s'il a des lignes (c'est lui qu'on présente en AG).
  var cour=comptaExerciceCourant(), prec=exs.filter(function(e){ return e.cle<cour.cle&&comptaLignesPeriode(all,e).length; })[0];
  sel.value=(prec&&!comptaLignesPeriode(all,cour).length)?prec.cle:cour.cle;
  b.appendChild(sel);
  var zone=document.createElement("div"); b.appendChild(zone);
  var row=gmRow(b); row.style.marginTop="14px";
  function exChoisi(){ return exs.filter(function(e){ return e.cle===sel.value; })[0]; }
  row.appendChild(gmBtn("📄 Compte de résultat (PDF)","primary",function(){ comptaCompteResultatPdf(exChoisi()); }));
  row.appendChild(gmBtn("🧾 Export FEC","soft",function(){ comptaExportFec(exChoisi()); }));
  var aide=document.createElement("div"); aide.style.cssText="font-size:11.5px;color:var(--mut);line-height:1.5;margin-top:12px";
  aide.textContent="Le FEC (fichier des écritures comptables) est le format officiel que lisent les logiciels des experts-comptables et l'administration fiscale. Le compte de résultat suit le plan comptable des associations, avec l'exercice précédent pour comparer.";
  b.appendChild(aide);
  function rendre(){
    var ex=exChoisi(), n1=comptaExercice(String(parseInt(ex.cle,10)-1)+ex.debut.slice(4));
    var cr=comptaCompteResultat(comptaLignesPeriode(all,ex)), crN1=comptaCompteResultat(comptaLignesPeriode(all,n1));
    var nb=comptaLignesPeriode(all,ex).length;
    function bloc(titre,rubs,tot,rubsN1,totN1,coul){
      var h='<div style="display:flex;justify-content:space-between;font-size:10px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:var(--mut);margin:16px 0 4px"><span>'+titre+'</span><span>'+ex.label+' · <span style="opacity:.7">'+n1.label+'</span></span></div>';
      rubs.forEach(function(r,i){
        var v1=rubsN1[i].total; if(!r.total&&!v1) return;
        h+='<div style="display:flex;justify-content:space-between;gap:10px;font-size:12.5px;color:var(--txt);padding:6px 0;border-bottom:1px solid var(--bdr)"><span style="flex:1;min-width:0">'+authEsc(r.lib)+
          '<span style="display:block;font-size:10.5px;color:var(--mut);font-family:monospace">'+Object.keys(r.comptes).sort().map(function(k){ return k+" "+authEsc(comptaLibCompte(k))+" : "+comptaEur(r.comptes[k]); }).join("<br>")+'</span></span>'+
          '<span style="text-align:right;white-space:nowrap;font-weight:700">'+comptaEur(r.total)+'<span style="display:block;font-weight:500;color:var(--mut);font-size:11px">'+comptaEur(v1)+'</span></span></div>';
      });
      h+='<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:'+coul+';padding:7px 0">Total '+titre.toLowerCase()+'<span style="text-align:right">'+comptaEur(tot)+'<span style="display:block;font-weight:500;color:var(--mut);font-size:11px">'+comptaEur(totN1)+'</span></span></div>';
      return h;
    }
    zone.innerHTML='<div style="font-size:12px;color:var(--txt2);margin-top:8px">Du '+ex.debut.split("-").reverse().join("/")+' au '+ex.fin.split("-").reverse().join("/")+' · '+nb+' écriture'+(nb>1?"s":"")+'</div>'+
      bloc("Produits",cr.produits,cr.totalProduits,crN1.produits,crN1.totalProduits,"var(--grn)")+
      bloc("Charges",cr.charges,cr.totalCharges,crN1.charges,crN1.totalCharges,"var(--red)")+
      '<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:900;color:var(--dkg);padding:12px 0;margin-top:6px;border-top:2px solid var(--bdr)">'+(cr.resultat>=0?"Excédent":"Déficit")+' de l\'exercice<span style="text-align:right">'+comptaEur(cr.resultat)+'<span style="display:block;font-size:11px;font-weight:500;color:var(--mut)">'+n1.label+' : '+comptaEur(crN1.resultat)+'</span></span></div>';
  }
  sel.addEventListener("change",rendre); rendre();
}

function comptaCompteResultatPdf(ex){
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes"); return; }
  var all=getComptabilite(), n1=comptaExercice(String(parseInt(ex.cle,10)-1)+ex.debut.slice(4));
  var cr=comptaCompteResultat(comptaLignesPeriode(all,ex)), crN1=comptaCompteResultat(comptaLignesPeriode(all,n1));
  if(!comptaLignesPeriode(all,ex).length){ askAlert("Aucune ligne sur l'exercice "+ex.label+"."); return; }
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), y=18;
  function fr(d){ return d.split("-").reverse().join("/"); }
  function eur(n){ return comptaEur(n).replace("€","EUR"); }
  doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb);
  doc.text(clubTitle()||"Association",14,y); y+=8;
  doc.setFontSize(13); doc.setTextColor(30,30,30); doc.text("Compte de résultat - exercice "+ex.label,14,y); y+=6;
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110,110,110);
  var fi=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  doc.text("Du "+fr(ex.debut)+" au "+fr(ex.fin)+(fi&&fi.siret?"  -  SIRET "+fi.siret:"")+"  -  édité le "+new Date().toLocaleDateString("fr-FR"),14,y); y+=10;
  var xN=162, xN1=196;
  function entete(titre){
    if(y>265){ doc.addPage(); y=20; }
    doc.setFillColor.apply(doc,rgb); doc.rect(12,y-5,186,7,"F");
    doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(255,255,255);
    doc.text(titre,14,y); doc.text(ex.label,xN,y,{align:"right"}); doc.text(n1.label,xN1,y,{align:"right"}); y+=8;
  }
  function bloc(titre,rubs,tot,rubsN1,totN1){
    entete(titre);
    rubs.forEach(function(r,i){
      var v1=rubsN1[i].total; if(!r.total&&!v1) return;
      if(y>275){ doc.addPage(); y=20; }
      doc.setFont("helvetica","bold"); doc.setFontSize(9.5); doc.setTextColor(30,30,30);
      doc.text(doc.splitTextToSize(r.lib,120)[0],14,y); doc.text(eur(r.total),xN,y,{align:"right"});
      doc.setTextColor(120,120,120); doc.text(eur(v1),xN1,y,{align:"right"}); y+=5;
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(90,90,90);
      Object.keys(r.comptes).sort().forEach(function(k){
        if(y>282){ doc.addPage(); y=20; }
        doc.text(k+"  "+comptaLibCompte(k),20,y); doc.text(eur(r.comptes[k]),xN,y,{align:"right"}); y+=4.5;
      });
      y+=1.5;
    });
    doc.setDrawColor(200,200,200); doc.line(14,y-3,198,y-3);
    doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor.apply(doc,rgb);
    doc.text("Total "+titre.toLowerCase(),14,y+1); doc.text(eur(tot),xN,y+1,{align:"right"});
    doc.setTextColor(120,120,120); doc.text(eur(totN1),xN1,y+1,{align:"right"}); y+=11;
  }
  bloc("Produits",cr.produits,cr.totalProduits,crN1.produits,crN1.totalProduits);
  bloc("Charges",cr.charges,cr.totalCharges,crN1.charges,crN1.totalCharges);
  if(y>260){ doc.addPage(); y=20; }
  doc.setFillColor.apply(doc,clubPdfTint(0.88)); doc.rect(12,y-6,186,10,"F");
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.setTextColor(20,20,20);
  doc.text((cr.resultat>=0?"Excédent":"Déficit")+" de l'exercice",14,y+1); doc.text(eur(cr.resultat),xN,y+1,{align:"right"});
  doc.setFontSize(10); doc.setTextColor(120,120,120); doc.text(eur(crN1.resultat),xN1,y+1,{align:"right"}); y+=18;
  if(y>250){ doc.addPage(); y=30; }
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
  doc.text("Approuvé par l'assemblée générale du ..................................",14,y); y+=14;
  doc.text("Le président",30,y); doc.text("Le trésorier",130,y);
  doc.setFontSize(7.5); doc.setTextColor(140,140,140);
  doc.text("Présenté selon le plan comptable des associations (règlement ANC n° 2018-06). Comptabilité de trésorerie : recettes et dépenses à la date de paiement.",14,290);
  doc.save(clubSlug()+"_compte_de_resultat_"+ex.label+".pdf");
}

// FEC (article A47 A-1 du LPF) : 18 colonnes séparées par des tabulations,
// dates AAAAMMJJ, montants à virgule, encodage ISO-8859-15.
var FEC_COLONNES=["JournalCode","JournalLib","EcritureNum","EcritureDate","CompteNum","CompteLib","CompAuxNum","CompAuxLib","PieceRef","PieceDate","EcritureLib","Debit","Credit","EcritureLet","DateLet","ValidDate","Montantdevise","Idevise"];
function comptaFecTexte(lines){
  function d8(d){ return String(d||"").replace(/-/g,"").slice(0,8); }
  function txt(s){ return String(s==null?"":s).replace(/[\t\r\n|]+/g," ").trim().slice(0,200); }
  function mt(n){ return comptaArrondi(n).toFixed(2).replace(".",","); }
  var tri=(lines||[]).slice().sort(function(a,b){ return (a.date||"").localeCompare(b.date||"")||String(a.piece||"").localeCompare(String(b.piece||"")); });
  var out=[FEC_COLONNES.join("\t")], totD=0, totC=0, n=0;
  tri.forEach(function(l){
    var ecr=comptaEcritures(l); if(!ecr.length) return;
    var j=comptaJournal(l), lib=txt(l.motif||l.categorie||"Écriture")+(l.tiers?" - "+txt(l.tiers):"");
    n++;
    ecr.forEach(function(e){
      totD+=e.debit; totC+=e.credit;
      out.push([j,COMPTA_JOURNAUX[j],txt(l.piece),d8(l.date),e.compte,txt(comptaLibCompte(e.compte)),"","",txt(l.piece),d8(l.date),txt(lib),mt(e.debit),mt(e.credit),"","",d8(l.date),"",""].join("\t"));
    });
  });
  return {texte:out.join("\r\n")+"\r\n", ecritures:n, debit:comptaArrondi(totD), credit:comptaArrondi(totC)};
}
var ISO885915={0x20AC:0xA4,0x160:0xA6,0x161:0xA8,0x17D:0xB4,0x17E:0xB8,0x152:0xBC,0x153:0xBD,0x178:0xBE};
function comptaIso885915(s){
  var out=new Uint8Array(s.length);
  for(var i=0;i<s.length;i++){
    var c=s.charCodeAt(i);
    if(ISO885915[c]) out[i]=ISO885915[c];
    else if(c<256&&[0xA4,0xA6,0xA8,0xB4,0xB8,0xBC,0xBD,0xBE].indexOf(c)<0) out[i]=c;
    else if(c===0x2019||c===0x2018) out[i]=0x27;
    else if(c===0x201C||c===0x201D) out[i]=0x22;
    else if(c===0x2013||c===0x2014) out[i]=0x2D;
    else if(c===0x2026) out[i]=0x2E;
    else out[i]=0x3F;
  }
  return out;
}
function comptaExportFec(ex){
  var all=getComptabilite();
  if(comptaDedoublonnerPieces(all)+comptaNumeroter(all)>0) saveComptabilite(all);
  var lignes=comptaLignesPeriode(all,ex);
  if(!lignes.length){ askAlert("Aucune ligne sur l'exercice "+ex.label+"."); return; }
  var f=comptaFecTexte(lignes);
  var fi=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  var siren=String((fi&&fi.siret)||"").replace(/\D/g,"").slice(0,9);
  var nom=(siren.length===9?siren:clubSlug())+"FEC"+ex.fin.replace(/-/g,"")+".txt";
  var blob=new Blob([comptaIso885915(f.texte)],{type:"text/plain;charset=ISO-8859-15"});
  var url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download=nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function(){ URL.revokeObjectURL(url); },1500);
  if(siren.length!==9) askAlert("FEC téléchargé ("+f.ecritures+" écritures). Le nom officiel commence par le SIREN du club : renseignez le SIRET dans Paramètres › Facturation pour qu'il soit repris.");
  else showToast("FEC téléchargé : "+f.ecritures+" écritures, équilibré ("+comptaEur(f.debit)+")");
}
