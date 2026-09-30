/* ===== 15-compta-inventaire.js — Comptabilite, documents, inventaire buvette/materiel ===== */
// ── DOCUMENTS ────────────────────────────────────────────────────
function getDocs(){try{return JSON.parse(localStorage.getItem("asmb_docs")||"[]");}catch(e){return [];}}
function saveDocs(d){localStorage.setItem("asmb_docs",JSON.stringify(d));}

// ── COMPTABILITE (reserve dirigeant) ────────────────────────────────
function getComptabilite(){try{return JSON.parse(localStorage.getItem("asmb_comptabilite")||"[]");}catch(e){return [];}}
function saveComptabilite(c){localStorage.setItem("asmb_comptabilite",JSON.stringify(c));fsWriteCollection("comptabilite",c);}

// Taxonomie fixe des catégories (club sportif loi 1901)
var COMPTA_CATS={
  recette:["Cotisations/Licences","Subventions","Sponsors/Partenaires","Buvette/Événements","Dons","Autre"],
  depense:["Affiliation/Licences fédérales","Location salle","Matériel","Achats buvette","Déplacements","Arbitrage/Formations","Assurances","Frais administratifs","Autre"]
};

// ── Budget prévisionnel ──────────────────────────────────────────
function getBudgetPrev(){try{return JSON.parse(localStorage.getItem("asmb_budget_prev")||"{}");}catch(e){return {};}}
function saveBudgetPrev(b){localStorage.setItem("asmb_budget_prev",JSON.stringify(b));fsWriteCollection("budgetPrev",[Object.assign({id:"budget"},b)]);}
function comptaCurrentYear(){return new Date().getFullYear().toString();}

var COMPTA_FILTERS={du:"",au:"",categorie:"",moyen:"",pointe:""};
var comptaEditId=null;

function comptaFilteredList(){
  var lines=getComptabilite().slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
  return lines.filter(function(l){
    if(COMPTA_FILTERS.du && (l.date||"") < COMPTA_FILTERS.du) return false;
    if(COMPTA_FILTERS.au && (l.date||"") > COMPTA_FILTERS.au) return false;
    if(COMPTA_FILTERS.categorie && l.categorie!==COMPTA_FILTERS.categorie) return false;
    if(COMPTA_FILTERS.moyen && l.moyen!==COMPTA_FILTERS.moyen) return false;
    if(COMPTA_FILTERS.pointe==="oui" && !l.pointe) return false;
    if(COMPTA_FILTERS.pointe==="non" && l.pointe) return false;
    return true;
  });
}

function buildComptabilite(){
  if(!isStaffUser() || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){
    var listElNo=document.getElementById("compta-list");
    if(listElNo) listElNo.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Réservé au dirigeant</div></div>';
    return;
  }
  var all=getComptabilite();
  document.getElementById("compta-count").textContent=all.length+" ligne"+(all.length>1?"s":"");

  // Filtres
  var fEl=document.getElementById("compta-filters");
  var uniqCats=COMPTA_CATS.recette.concat(COMPTA_CATS.depense).filter(function(c,i,a){return a.indexOf(c)===i;});
  fEl.innerHTML="";
  var duInp=document.createElement("input");duInp.type="date";duInp.value=COMPTA_FILTERS.du;
  duInp.style.cssText="flex:1;min-width:120px;padding:8px;border:1.5px solid var(--bdr);border-radius:8px;font-size:12px;background:var(--bg);color:var(--txt)";
  duInp.addEventListener("change",function(){COMPTA_FILTERS.du=duInp.value;buildComptabilite();});
  var auInp=document.createElement("input");auInp.type="date";auInp.value=COMPTA_FILTERS.au;
  auInp.style.cssText=duInp.style.cssText;
  auInp.addEventListener("change",function(){COMPTA_FILTERS.au=auInp.value;buildComptabilite();});
  var catSel=document.createElement("select");
  catSel.style.cssText="flex:1;min-width:120px;padding:8px;border:1.5px solid var(--bdr);border-radius:8px;font-size:12px;background:var(--bg);color:var(--txt)";
  catSel.innerHTML='<option value="">Toutes catégories</option>'+uniqCats.map(function(c){return '<option value="'+c+'"'+(COMPTA_FILTERS.categorie===c?" selected":"")+'>'+c+'</option>';}).join("");
  catSel.addEventListener("change",function(){COMPTA_FILTERS.categorie=catSel.value;buildComptabilite();});
  var moyenSel=document.createElement("select");
  moyenSel.style.cssText=catSel.style.cssText;
  moyenSel.innerHTML='<option value="">Tout moyen</option>'+["Espèces","Chèque","Virement","CB","Autre"].map(function(m){return '<option value="'+m+'"'+(COMPTA_FILTERS.moyen===m?" selected":"")+'>'+m+'</option>';}).join("");
  moyenSel.addEventListener("change",function(){COMPTA_FILTERS.moyen=moyenSel.value;buildComptabilite();});
  var pointeSel=document.createElement("select");
  pointeSel.style.cssText=catSel.style.cssText;
  pointeSel.innerHTML='<option value="">Pointé ou non</option><option value="oui"'+(COMPTA_FILTERS.pointe==="oui"?" selected":"")+'>✓ Pointées</option><option value="non"'+(COMPTA_FILTERS.pointe==="non"?" selected":"")+'>Non pointées</option>';
  pointeSel.addEventListener("change",function(){COMPTA_FILTERS.pointe=pointeSel.value;buildComptabilite();});
  fEl.appendChild(duInp);fEl.appendChild(auInp);fEl.appendChild(catSel);fEl.appendChild(moyenSel);fEl.appendChild(pointeSel);
  if(COMPTA_FILTERS.du||COMPTA_FILTERS.au||COMPTA_FILTERS.categorie||COMPTA_FILTERS.moyen||COMPTA_FILTERS.pointe){
    var clearBtn=document.createElement("button");
    clearBtn.textContent="Réinitialiser";
    clearBtn.style.cssText="padding:8px 12px;border-radius:8px;background:var(--bdr);color:var(--mut);font-size:12px;font-weight:700;border:none;cursor:pointer";
    clearBtn.addEventListener("click",function(){COMPTA_FILTERS={du:"",au:"",categorie:"",moyen:"",pointe:""};buildComptabilite();});
    fEl.appendChild(clearBtn);
  }

  // Datalists pour le formulaire (suggestions)
  var motifs=all.map(function(l){return l.motif;}).filter(Boolean);
  var tiers=all.map(function(l){return l.tiers;}).filter(Boolean);
  var uniq=function(arr){return arr.filter(function(v,i){return arr.indexOf(v)===i;});};
  var dlCat=document.getElementById("compta-cat-list");
  if(dlCat) dlCat.innerHTML=uniqCats.map(function(c){return '<option value="'+c+'">';}).join("");
  var dlMotif=document.getElementById("compta-motif-list");
  if(dlMotif) dlMotif.innerHTML=uniq(motifs).map(function(m){return '<option value="'+m+'">';}).join("");
  var dlTiers=document.getElementById("compta-tiers-list");
  if(dlTiers) dlTiers.innerHTML=uniq(tiers).map(function(t){return '<option value="'+t+'">';}).join("");

  // Liste + totaux
  var filtered=comptaFilteredList();
  var totalRecette=0,totalDepense=0,soldePointe=0;
  filtered.forEach(function(l){
    var m=l.montant||0;
    if(l.type==="depense"){totalDepense+=m; if(l.pointe) soldePointe-=m;}
    else {totalRecette+=m; if(l.pointe) soldePointe+=m;}
  });
  var totEl=document.getElementById("compta-totals");
  totEl.innerHTML='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;display:flex;justify-content:space-between;font-size:12px">'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Recettes</div><div style="color:var(--grn);font-weight:800;font-size:15px">'+totalRecette.toFixed(2)+' €</div></div>'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Dépenses</div><div style="color:var(--red);font-weight:800;font-size:15px">'+totalDepense.toFixed(2)+' €</div></div>'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Solde</div><div style="color:var(--dkg);font-weight:800;font-size:15px">'+(totalRecette-totalDepense).toFixed(2)+' €</div></div>'+
  '</div>'+
  '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding:10px 12px;background:var(--bg);border:1px dashed var(--bdr);border-radius:var(--rs);font-size:11px;color:var(--mut)">'+
    '<span>🏦 Solde pointé (rapproché banque) : <b style="color:var(--txt)">'+soldePointe.toFixed(2)+' €</b></span>'+
    '<span style="display:flex;gap:6px">'+
      '<button onclick="openBudgetPrev()" style="padding:6px 10px;border-radius:8px;background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">📊 Budget</button>'+
      '<button onclick="openBilanAnnuel()" style="padding:6px 10px;border-radius:8px;background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">📄 Bilan AG</button>'+
    '</span>'+
  '</div>';

  var listEl=document.getElementById("compta-list");
  listEl.innerHTML="";
  if(!filtered.length){listEl.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucune ligne</div><div style="font-size:11px;margin-top:4px">Utilisez le bouton + Ligne pour ajouter</div></div>';return;}
  filtered.forEach(function(l){
    var row=document.createElement("div");
    row.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+(l.type==="depense"?"var(--red)":"var(--grn)")+";border-radius:var(--rs);padding:12px;cursor:pointer";
    row.addEventListener("click",function(){showAddComptaLine(l.id);});
    var top=document.createElement("div");
    top.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;gap:8px";
    var left=document.createElement("div");left.style.cssText="flex:1;min-width:0";
    var dateSpan=document.createElement("div");dateSpan.style.cssText="font-size:11px;color:var(--mut)";
    dateSpan.textContent=(l.date?new Date(l.date).toLocaleDateString("fr-FR"):"")+(l.categorie?" · "+l.categorie:"")+(l.pointe?" · ✓ pointé":"")+(l.justificatif?" · 📎":"");
    var motifDiv=document.createElement("div");motifDiv.style.cssText="font-size:13px;font-weight:700;color:var(--txt);margin-top:2px";
    motifDiv.textContent=l.motif||"(sans motif)";
    var tiersDiv=document.createElement("div");tiersDiv.style.cssText="font-size:11px;color:var(--txt2);margin-top:2px";
    tiersDiv.textContent=[l.tiers,l.moyen].filter(Boolean).join(" · ");
    left.appendChild(dateSpan);left.appendChild(motifDiv);left.appendChild(tiersDiv);
    var montantDiv=document.createElement("div");
    montantDiv.style.cssText="font-size:15px;font-weight:800;flex-shrink:0;color:"+(l.type==="depense"?"var(--red)":"var(--grn)");
    montantDiv.textContent=(l.type==="depense"?"-":"+")+(l.montant||0).toFixed(2)+" €";
    top.appendChild(left);top.appendChild(montantDiv);
    row.appendChild(top);
    listEl.appendChild(row);
  });
}

var comptaCurrentType="recette";
var comptaJustifDataUrl=null;
function setComptaType(type){
  comptaCurrentType=type;
  var rB=document.getElementById("compta-type-recette"), dB=document.getElementById("compta-type-depense");
  rB.style.background=type==="recette"?"var(--grn)":"var(--card)";
  rB.style.color=type==="recette"?"#fff":"var(--mut)";
  rB.style.borderColor=type==="recette"?"var(--grn)":"var(--bdr)";
  dB.style.background=type==="depense"?"var(--red)":"var(--card)";
  dB.style.color=type==="depense"?"#fff":"var(--mut)";
  dB.style.borderColor=type==="depense"?"var(--red)":"var(--bdr)";
  var catSel=document.getElementById("cl-categorie");
  if(catSel){
    var prev=catSel.getAttribute("data-keep")||catSel.value;
    catSel.innerHTML=COMPTA_CATS[type].map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join("");
    if(prev && COMPTA_CATS[type].indexOf(prev)>=0) catSel.value=prev;
    catSel.removeAttribute("data-keep");
  }
}
function comptaJustifPick(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var isPdf=file.type==="application/pdf", isImage=file.type.indexOf("image")===0;
  if(!isPdf&&!isImage){askAlert("Seules les photos et les PDF sont acceptés");input.value="";return;}
  if(file.size>700*1024){askAlert("Fichier trop volumineux (700 Ko max).");input.value="";return;}
  var reader=new FileReader();
  reader.onload=function(){
    comptaJustifDataUrl=reader.result;
    var prev=document.getElementById("cl-justif-preview");
    if(prev) prev.textContent="📎 "+file.name+" (joint)";
  };
  reader.readAsDataURL(file);
}
function comptaJustifClear(){
  comptaJustifDataUrl=null;
  var f=document.getElementById("cl-justif-file"); if(f) f.value="";
  var prev=document.getElementById("cl-justif-preview"); if(prev) prev.textContent="Aucun justificatif joint";
}
function showAddComptaLine(editId){
  comptaEditId=editId||null;
  var lines=getComptabilite();
  var existing=comptaEditId?lines.find(function(l){return l.id===comptaEditId;}):null;
  document.getElementById("compta-modal-title").textContent=existing?"Modifier la ligne":"Nouvelle ligne";
  document.getElementById("cl-date").value=existing?existing.date:new Date().toISOString().slice(0,10);
  document.getElementById("cl-montant").value=existing?existing.montant:"";
  var catSelEl=document.getElementById("cl-categorie");
  if(catSelEl && existing) catSelEl.setAttribute("data-keep",existing.categorie||"");
  document.getElementById("cl-motif").value=existing?existing.motif||"":"";
  document.getElementById("cl-tiers").value=existing?existing.tiers||"":"";
  document.getElementById("cl-moyen").value=existing?existing.moyen||"Espèces":"Espèces";
  document.getElementById("cl-reference").value=existing?existing.reference||"":"";
  document.getElementById("cl-pointe").checked=!!(existing&&existing.pointe);
  comptaJustifDataUrl=existing?(existing.justificatif||null):null;
  var justifPrev=document.getElementById("cl-justif-preview");
  if(justifPrev) justifPrev.textContent=comptaJustifDataUrl?"📎 Justificatif joint":"Aucun justificatif joint";
  var justifFile=document.getElementById("cl-justif-file"); if(justifFile) justifFile.value="";
  setComptaType(existing?existing.type:"recette");
  var delBtn=document.getElementById("compta-delete-btn");
  if(delBtn) delBtn.style.display=existing?"block":"none";
  document.getElementById("modal-compta-line").style.display="flex";
}
// Crée une ligne comptable directement depuis un mouvement de stock (buvette)
function addComptaLineFromStock(type,categorie,montant,motif,reference){
  var lines=getComptabilite();
  lines.push({
    id:Date.now().toString()+Math.random().toString(36).slice(2,6),
    date:new Date().toISOString().slice(0,10),
    montant:montant,type:type,categorie:categorie,motif:motif,tiers:"",
    moyen:"Espèces",reference:reference||"Buvette",pointe:false,justificatif:null
  });
  saveComptabilite(lines);
}
function saveComptaLine(){
  var date=document.getElementById("cl-date").value;
  var montant=parseFloat(document.getElementById("cl-montant").value);
  if(!date){askAlert("Date obligatoire");return;}
  if(!montant||montant<=0){askAlert("Montant invalide");return;}
  var lines=getComptabilite();
  var data={
    date:date, montant:montant, type:comptaCurrentType,
    categorie:document.getElementById("cl-categorie").value,
    motif:document.getElementById("cl-motif").value.trim(),
    tiers:document.getElementById("cl-tiers").value.trim(),
    moyen:document.getElementById("cl-moyen").value,
    reference:document.getElementById("cl-reference").value.trim(),
    pointe:document.getElementById("cl-pointe").checked,
    justificatif:comptaJustifDataUrl||null
  };
  if(comptaEditId){
    var idx=lines.findIndex(function(l){return l.id===comptaEditId;});
    if(idx>=0) lines[idx]=Object.assign({id:comptaEditId},data);
  } else {
    data.id=Date.now().toString();
    lines.push(data);
  }
  saveComptabilite(lines);
  closeModal("modal-compta-line");
  buildComptabilite();
}
async function deleteComptaLine(){
  if(!comptaEditId)return;
  var ok=await askConfirm("Supprimer cette ligne comptable ?", {danger:true, confirmText:"Supprimer"});
  if(!ok)return;
  var lines=getComptabilite().filter(function(l){return l.id!==comptaEditId;});
  saveComptabilite(lines);
  closeModal("modal-compta-line");
  buildComptabilite();
}
function exportComptaCsv(){
  var lines=comptaFilteredList();
  if(!lines.length){askAlert("Aucune ligne à exporter.");return;}
  var header=["Date","Type","Montant","Catégorie","Motif","Tiers/Membre","Moyen de paiement","Référence","Pointé","Justificatif"];
  var rows=lines.map(function(l){
    return [l.date,l.type==="depense"?"Dépense":"Recette",(l.montant||0).toFixed(2),l.categorie||"",l.motif||"",l.tiers||"",l.moyen||"",l.reference||"",l.pointe?"Oui":"Non",l.justificatif?"Oui":"Non"]
      .map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(";");
  });
  var csv=header.join(";")+"\n"+rows.join("\n");
  var blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"});
  var url=URL.createObjectURL(blob);
  var a=document.createElement("a");
  a.href=url;a.download="comptabilite-asmb-"+taTodayStr().replace(/\//g,"-")+".csv";
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
}

// ── BUDGET PREVISIONNEL ──────────────────────────────────────────
function openBudgetPrev(){
  var year=comptaCurrentYear();
  var budget=getBudgetPrev();
  var yearBudget=budget[year]||{};
  var all=getComptabilite().filter(function(l){return (l.date||"").indexOf(year)===0;});
  var realise={};
  all.forEach(function(l){
    var key=l.type+"|"+(l.categorie||"Autre");
    realise[key]=(realise[key]||0)+(l.montant||0);
  });
  var body=document.getElementById("modal-budget-body");
  var html='<div style="font-size:11px;color:var(--mut);margin-bottom:10px">Budget prévisionnel '+year+' — comparez le prévu au réalisé de l\'année en cours.</div>';
  ["recette","depense"].forEach(function(type){
    html+='<div style="font-size:12px;font-weight:800;color:var(--txt);margin:12px 0 6px">'+(type==="recette"?"Recettes":"Dépenses")+'</div>';
    COMPTA_CATS[type].forEach(function(cat){
      var prevu=yearBudget[type+"|"+cat]||0;
      var reel=realise[type+"|"+cat]||0;
      var pct=prevu>0?Math.min(100,Math.round(reel/prevu*100)):(reel>0?100:0);
      var over=prevu>0 && reel>prevu;
      html+='<div style="margin-bottom:10px">'+
        '<div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--txt);margin-bottom:3px">'+
          '<span>'+cat+'</span>'+
          '<span style="display:flex;align-items:center;gap:6px">'+
            '<input type="number" step="1" value="'+(prevu||"")+'" placeholder="0" data-budget-key="'+type+'|'+cat+'" style="width:70px;padding:5px 6px;border:1px solid var(--bdr);border-radius:6px;font-size:11px;background:var(--bg);color:var(--txt);text-align:right">'+
            '<span style="color:var(--mut);font-size:10px">prévu</span>'+
          '</span>'+
        '</div>'+
        '<div style="height:6px;border-radius:4px;background:var(--bdr);overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+(over?"var(--red)":"var(--grn)")+'"></div></div>'+
        '<div style="font-size:10px;color:var(--mut);margin-top:2px">Réalisé : '+reel.toFixed(2)+' €'+(prevu>0?" / "+prevu.toFixed(2)+" € prévu":"")+'</div>'+
      '</div>';
    });
  });
  body.innerHTML=html;
  document.getElementById("modal-budget-prev").style.display="flex";
}
function saveBudgetPrevForm(){
  var year=comptaCurrentYear();
  var budget=getBudgetPrev();
  var yearBudget={};
  document.querySelectorAll('[data-budget-key]').forEach(function(inp){
    var v=parseFloat(inp.value);
    if(v>0) yearBudget[inp.getAttribute("data-budget-key")]=v;
  });
  budget[year]=yearBudget;
  saveBudgetPrev(budget);
  closeModal("modal-budget-prev");
  buildComptabilite();
}

// ── BILAN ANNUEL / RAPPORT AG ────────────────────────────────────
function openBilanAnnuel(){
  var year=comptaCurrentYear();
  var lines=getComptabilite().filter(function(l){return (l.date||"").indexOf(year)===0;});
  var byCat={recette:{},depense:{}};
  var totR=0,totD=0;
  lines.forEach(function(l){
    var cat=l.categorie||"Autre";
    byCat[l.type===("depense")?"depense":"recette"][cat]=(byCat[l.type==="depense"?"depense":"recette"][cat]||0)+(l.montant||0);
    if(l.type==="depense") totD+=(l.montant||0); else totR+=(l.montant||0);
  });
  var html='<div style="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:2px">Bilan financier '+year+'</div>'+
    '<div style="font-size:11px;color:var(--mut);margin-bottom:14px">À présenter en Assemblée Générale</div>';
  html+='<div style="font-size:12px;font-weight:800;color:var(--grn);margin:10px 0 6px">Recettes</div>';
  Object.keys(byCat.recette).sort().forEach(function(c){
    html+='<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--txt);padding:4px 0;border-bottom:1px solid var(--bdr)"><span>'+c+'</span><span style="font-weight:700">'+byCat.recette[c].toFixed(2)+' €</span></div>';
  });
  html+='<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--grn);padding:6px 0">Total recettes<span>'+totR.toFixed(2)+' €</span></div>';
  html+='<div style="font-size:12px;font-weight:800;color:var(--red);margin:14px 0 6px">Dépenses</div>';
  Object.keys(byCat.depense).sort().forEach(function(c){
    html+='<div style="display:flex;justify-content:space-between;font-size:12px;color:var(--txt);padding:4px 0;border-bottom:1px solid var(--bdr)"><span>'+c+'</span><span style="font-weight:700">'+byCat.depense[c].toFixed(2)+' €</span></div>';
  });
  html+='<div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--red);padding:6px 0">Total dépenses<span>'+totD.toFixed(2)+' €</span></div>';
  html+='<div style="display:flex;justify-content:space-between;font-size:15px;font-weight:800;color:var(--dkg);padding:12px 0;margin-top:8px;border-top:2px solid var(--bdr)">Résultat net '+year+'<span>'+(totR-totD).toFixed(2)+' €</span></div>';
  document.getElementById("modal-bilan-body").innerHTML=html;
  document.getElementById("modal-bilan-annuel").style.display="flex";
}
function printBilanAnnuel(){
  var content=document.getElementById("modal-bilan-body").innerHTML;
  var w=window.open("","_blank");
  w.document.write('<html><head><title>Bilan financier</title><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}div{box-sizing:border-box}</style></head><body>'+content+'</body></html>');
  w.document.close();
  w.print();
}

// ── INVENTAIRE BUVETTE ET MATERIEL (point 11) ───────────────────────
function getInventaire(){try{return JSON.parse(localStorage.getItem("asmb_inventaire")||"[]");}catch(e){return [];}}
function saveInventaire(list){localStorage.setItem("asmb_inventaire",JSON.stringify(list));fsWriteCollection("inventaire",list);}

var invActiveTab="buvette";
function setInvTab(tab){
  invActiveTab=tab;
  var tB=document.getElementById("inv-tab-buvette"), tM=document.getElementById("inv-tab-materiel");
  if(tB)tB.classList.toggle("on",tab==="buvette");
  if(tM)tM.classList.toggle("on",tab==="materiel");
  buildInventaire();
}
function invFilteredList(){
  var all=getInventaire().filter(function(it){return it.categorie===invActiveTab;});
  var q=(document.getElementById("inv-search")||{}).value||"";
  q=q.trim().toLowerCase();
  if(q) all=all.filter(function(it){return (it.nom||"").toLowerCase().indexOf(q)>=0;});
  all.sort(function(a,b){return (a.nom||"").localeCompare(b.nom||"");});
  return all;
}
function buildInventaire(){
  var all=getInventaire();
  document.getElementById("inv-count").textContent=all.length+" article"+(all.length>1?"s":"");
  var lowStock=all.filter(function(it){return it.seuil!=null && it.seuil!=="" && Number(it.qte)<Number(it.seuil);});
  var banner=document.getElementById("inv-alert-banner");
  if(banner){
    banner.innerHTML=lowStock.length
      ? '<div style="background:rgba(232,103,10,.1);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:12px 14px">'+
          '<div style="font-size:13px;font-weight:700;color:#E8670A">'+lowStock.length+' article'+(lowStock.length>1?"s":"")+' en stock bas</div>'+
          '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+lowStock.map(function(it){return authEsc(it.nom);}).join(", ")+'</div>'+
        '</div>'
      : "";
  }
  var list=document.getElementById("inv-list");
  if(!list)return;
  var items=invFilteredList();
  list.innerHTML="";
  if(!items.length){
    list.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun article</div><div style="font-size:11px;margin-top:4px">Utilisez le bouton + Article</div></div>';
    return;
  }
  items.forEach(function(it){
    var low=it.seuil!=null && it.seuil!=="" && Number(it.qte)<Number(it.seuil);
    var card=document.createElement("div");
    card.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+(low?"#E8670A":"var(--grn)")+";border-radius:var(--rs);padding:12px";
    var top=document.createElement("div");
    top.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;cursor:pointer";
    top.addEventListener("click",function(){ showEditInvItem(it.id); });
    var left=document.createElement("div");
    left.style.cssText="flex:1;min-width:0";
    left.innerHTML='<div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(it.nom||"")+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+(it.emplacement?authEsc(it.emplacement):"")+(low?'<span style="color:#E8670A;font-weight:700"> · Stock bas</span>':"")+'</div>';
    var qteBox=document.createElement("div");
    qteBox.style.cssText="text-align:right;flex-shrink:0";
    qteBox.innerHTML='<div style="font-size:16px;font-weight:800;color:'+(low?"#E8670A":"var(--txt)")+'">'+it.qte+'</div><div style="font-size:9px;color:var(--mut)">'+(it.unite||"")+'</div>';
    top.appendChild(left);top.appendChild(qteBox);
    card.appendChild(top);
    var adjRow=document.createElement("div");
    adjRow.style.cssText="display:flex;gap:8px;margin-top:10px";
    if(it.categorie==="buvette"){
      var achatBtn=document.createElement("button");
      achatBtn.textContent="↓ Achat";
      achatBtn.title="Entrée de stock (achat) — crée une dépense en comptabilité";
      achatBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:12px;font-weight:700;border:none;cursor:pointer";
      achatBtn.addEventListener("click",function(e){e.stopPropagation();stockMovement(it.id,"achat");});
      var venteBtn=document.createElement("button");
      venteBtn.textContent="↑ Vente";
      venteBtn.title="Sortie de stock (vente) — crée une recette en comptabilité";
      venteBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:rgba(212,175,55,.12);color:var(--dkg);font-size:12px;font-weight:700;border:none;cursor:pointer";
      venteBtn.addEventListener("click",function(e){e.stopPropagation();stockMovement(it.id,"vente");});
      adjRow.appendChild(achatBtn);adjRow.appendChild(venteBtn);
    }else{
      var minusBtn=document.createElement("button");
      minusBtn.textContent="− 1";
      minusBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:12px;font-weight:700;border:none;cursor:pointer";
      minusBtn.addEventListener("click",function(e){e.stopPropagation();adjustInvQte(it.id,-1);});
      var plusBtn=document.createElement("button");
      plusBtn.textContent="+ 1";
      plusBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:rgba(212,175,55,.12);color:var(--dkg);font-size:12px;font-weight:700;border:none;cursor:pointer";
      plusBtn.addEventListener("click",function(e){e.stopPropagation();adjustInvQte(it.id,1);});
      adjRow.appendChild(minusBtn);adjRow.appendChild(plusBtn);
    }
    card.appendChild(adjRow);
    list.appendChild(card);
  });
}
function stockMovement(id,sens){
  var items=getInventaire();
  var idx=items.findIndex(function(x){return x.id===id;});
  if(idx<0)return;
  var it=items[idx];
  var qStr=window.prompt((sens==="achat"?"Quantité achetée":"Quantité vendue")+" ("+(it.unite||"unité")+") :","1");
  if(qStr===null)return;
  var qte=parseFloat(qStr.replace(",","."));
  if(!qte||qte<=0){showToast("Quantité invalide");return;}
  var prixUnit=sens==="achat"?it.prixAchat:it.prixVente;
  var montantDefault=prixUnit!=null?Math.round(prixUnit*qte*100)/100:0;
  var mStr=window.prompt("Montant "+(sens==="achat"?"dépensé":"encaissé")+" (€) :",montantDefault.toFixed(2));
  if(mStr===null)return;
  var montant=parseFloat(mStr.replace(",","."));
  if(!montant||montant<=0){showToast("Montant invalide");return;}
  var newQte=Number(it.qte||0)+(sens==="achat"?qte:-qte);
  if(newQte<0)newQte=0;
  items[idx].qte=newQte;
  saveInventaire(items);
  addComptaLineFromStock(
    sens==="achat"?"depense":"recette",
    sens==="achat"?"Achats buvette":"Buvette/Événements",
    montant,
    (sens==="achat"?"Achat ":"Vente ")+(it.nom||"article"),
    "Buvette"
  );
  showToast(sens==="achat"?"Achat enregistré + ligne comptable créée":"Vente enregistrée + ligne comptable créée");
  buildInventaire();
}
function adjustInvQte(id,delta){
  var items=getInventaire();
  var idx=items.findIndex(function(x){return x.id===id;});
  if(idx<0)return;
  var newQte=Number(items[idx].qte||0)+delta;
  if(newQte<0)newQte=0;
  items[idx].qte=newQte;
  saveInventaire(items);
  buildInventaire();
}
var invEditId=null;
function setInvItemCat(cat){
  invEditCat=cat;
  var bB=document.getElementById("inv-cat-buvette"), bM=document.getElementById("inv-cat-materiel");
  bB.style.background=cat==="buvette"?"var(--dkg)":"var(--card)";
  bB.style.color=cat==="buvette"?"#fff":"var(--mut)";
  bB.style.borderColor=cat==="buvette"?"var(--dkg)":"var(--bdr)";
  bM.style.background=cat==="materiel"?"var(--dkg)":"var(--card)";
  bM.style.color=cat==="materiel"?"#fff":"var(--mut)";
  bM.style.borderColor=cat==="materiel"?"var(--dkg)":"var(--bdr)";
  var prixBlock=document.getElementById("inv-prix-block");
  if(prixBlock) prixBlock.style.display=cat==="buvette"?"block":"none";
}
var invEditCat="buvette";
function showAddInvItem(){
  invEditId=null;
  document.getElementById("inv-modal-title").textContent="Nouvel article";
  document.getElementById("inv-nom").value="";
  document.getElementById("inv-qte").value="0";
  document.getElementById("inv-unite").value="";
  document.getElementById("inv-seuil").value="";
  document.getElementById("inv-prix-achat").value="";
  document.getElementById("inv-prix-vente").value="";
  document.getElementById("inv-emplacement").value="";
  document.getElementById("inv-notes").value="";
  document.getElementById("inv-delete-btn").style.display="none";
  setInvItemCat(invActiveTab);
  document.getElementById("modal-inv-item").style.display="flex";
}
function showEditInvItem(id){
  var it=getInventaire().find(function(x){return x.id===id;});
  if(!it)return;
  invEditId=id;
  document.getElementById("inv-modal-title").textContent="Modifier l'article";
  document.getElementById("inv-nom").value=it.nom||"";
  document.getElementById("inv-qte").value=it.qte!=null?it.qte:0;
  document.getElementById("inv-unite").value=it.unite||"";
  document.getElementById("inv-seuil").value=it.seuil!=null?it.seuil:"";
  document.getElementById("inv-prix-achat").value=it.prixAchat!=null?it.prixAchat:"";
  document.getElementById("inv-prix-vente").value=it.prixVente!=null?it.prixVente:"";
  document.getElementById("inv-emplacement").value=it.emplacement||"";
  document.getElementById("inv-notes").value=it.notes||"";
  document.getElementById("inv-delete-btn").style.display="block";
  setInvItemCat(it.categorie||"buvette");
  document.getElementById("modal-inv-item").style.display="flex";
}
function saveInvItem(){
  var nom=document.getElementById("inv-nom").value.trim();
  if(!nom){askAlert("Le nom de l'article est obligatoire");return;}
  var qte=parseInt(document.getElementById("inv-qte").value,10)||0;
  var seuilRaw=document.getElementById("inv-seuil").value;
  var prixAchatRaw=document.getElementById("inv-prix-achat").value;
  var prixVenteRaw=document.getElementById("inv-prix-vente").value;
  var data={
    nom:nom,categorie:invEditCat,qte:qte,
    unite:document.getElementById("inv-unite").value.trim(),
    seuil:seuilRaw!==""?parseInt(seuilRaw,10):null,
    prixAchat:prixAchatRaw!==""?parseFloat(prixAchatRaw):null,
    prixVente:prixVenteRaw!==""?parseFloat(prixVenteRaw):null,
    emplacement:document.getElementById("inv-emplacement").value.trim(),
    notes:document.getElementById("inv-notes").value.trim()
  };
  var items=getInventaire();
  if(invEditId){
    var idx=items.findIndex(function(x){return x.id===invEditId;});
    if(idx>=0) items[idx]=Object.assign({id:invEditId},data);
  } else {
    data.id=Date.now().toString();
    items.push(data);
  }
  saveInventaire(items);
  closeModal("modal-inv-item");
  invActiveTab=invEditCat;
  setInvTab(invEditCat);
}
function deleteInvItem(){
  if(!invEditId)return;
  askConfirm("Supprimer cet article de l'inventaire ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    saveInventaire(getInventaire().filter(function(x){return x.id!==invEditId;}));
    closeModal("modal-inv-item");
    buildInventaire();
  });
}
var pendingDocCategory="autre";
var DOC_CAT_LABELS={"reglement":"Règlement","autorisation":"Autorisation","formulaire":"Formulaire","autre":"Autre"};
var DOC_CAT_COLORS={"reglement":"#1A2E5A","autorisation":"#C0392B","formulaire":"#16A085","autre":"#8E44AD"};

function filterDocCat(cat){
  currentDocCatFilter=cat;
  document.querySelectorAll("#scr-documents .cat-filter").forEach(function(b){b.classList.remove("on");});
  var btn=document.getElementById("doccat-"+cat);if(btn)btn.classList.add("on");
  buildDocs();
}

function buildDocs(){
  var docs=getDocs();
  var filtered=currentDocCatFilter==="all"?docs:docs.filter(function(d){return (d.category||"autre")===currentDocCatFilter;});
  var el=document.getElementById("docList");if(!el)return;
  el.innerHTML="";
  // Upload zone
  var uploadZone=document.createElement("div");
  uploadZone.style.cssText="margin:12px;padding:20px;background:var(--card);border:2px dashed var(--bdr);border-radius:var(--rs);text-align:center;cursor:pointer";
  uploadZone.onclick=function(){showAddDoc();};
  uploadZone.innerHTML="<div style=\"font-size:28px;margin-bottom:8px\"></div><div style=\"font-size:13px;font-weight:600;color:var(--txt)\">Ajouter un document</div><div style=\"font-size:11px;color:var(--mut);margin-top:4px\">PDF · Image · Word · Excel</div>";
  el.appendChild(uploadZone);
  if(!filtered.length){var empty=document.createElement("div");empty.className="empty-state";empty.innerHTML="<div class=\"empty-state-icon\"></div><div style=\"font-size:13px;font-weight:600\">Aucun document</div>";el.appendChild(empty);return;}
  var typeIcons={"pdf":"","image":"","word":"","excel":"","autre":""};
  filtered.forEach(function(d){
    var icon=typeIcons[d.type]||"";
    var cat=d.category||"autre";
    var div=document.createElement("div");div.className="doc-card";
    var catBadge="<span style=\"font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;color:#fff;background:"+(DOC_CAT_COLORS[cat]||"#8E44AD")+"\">"+(DOC_CAT_LABELS[cat]||"Autre")+"</span>";
    var docDel="<button onclick=\"deleteDoc('"+d.id+"')\" style=\"padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer;flex-shrink:0\">✕</button>";
    div.innerHTML="<div class=\"doc-icon\">"+icon+"</div><div style=\"flex:1;min-width:0\"><div style=\"font-size:13px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">"+d.name+"</div><div style=\"font-size:11px;color:var(--mut);margin-top:2px\">"+d.size+" · "+d.date+"</div><div style=\"margin-top:4px\">"+catBadge+"</div></div>"+docDel;
    el.appendChild(div);
  });
}

function showAddDoc(){
  document.getElementById("doc-cat-select").value="autre";
  document.getElementById("modal-doc-cat").style.display="flex";
}
function confirmDocUpload(){
  pendingDocCategory=document.getElementById("doc-cat-select").value;
  closeModal("modal-doc-cat");
  document.getElementById("file-input").click();
}

function handleFiles(files){
  if(!files||!files.length)return;
  var docs=getDocs();
  Array.from(files).forEach(function(file){
    var type="autre";
    if(file.type.includes("pdf"))type="pdf";
    else if(file.type.includes("image"))type="image";
    else if(file.name.match(/\.docx?$/i))type="word";
    else if(file.name.match(/\.xlsx?$/i))type="excel";
    var size=file.size>1024*1024?(file.size/1024/1024).toFixed(1)+" Mo":(file.size/1024).toFixed(0)+" Ko";
    docs.push({id:Date.now().toString()+Math.random(),name:file.name,type:type,size:size,date:new Date().toLocaleDateString("fr-FR"),desc:"",category:pendingDocCategory});
  });
  saveDocs(docs);buildDocs();buildAdminHome();
  showToast(files.length+" document"+(files.length>1?"s":"")+" ajouté"+(files.length>1?"s":"")+" !");
}
function deleteDoc(id){
  askConfirm("Supprimer ce document ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var all=getDocs();
    var removed=all.find(function(d){return d.id===id;});
    var docs=all.filter(function(d){return d.id!==id;});
    saveDocs(docs);buildDocs();buildAdminHome();
    if(!removed)return;
    showUndoToast("Document « "+(removed.name||"")+" » supprimé",function(){
      var cur=getDocs();
      cur.push(removed);
      saveDocs(cur);buildDocs();buildAdminHome();
    });
  });
}

