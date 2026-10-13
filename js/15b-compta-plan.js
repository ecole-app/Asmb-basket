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
