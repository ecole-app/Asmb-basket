/* ===== 15-compta-inventaire.js — Comptabilite, documents, inventaire buvette/materiel ===== */
// ── DOCUMENTS ────────────────────────────────────────────────────
function getDocs(){try{return JSON.parse(localStorage.getItem("asmb_docs")||"[]");}catch(e){return [];}}
function saveDocs(d){localStorage.setItem("asmb_docs",JSON.stringify(d));}

// ── COMPTABILITE (reserve dirigeant) ────────────────────────────────
function getComptabilite(){try{return JSON.parse(localStorage.getItem("asmb_comptabilite")||"[]");}catch(e){return [];}}
function saveComptabilite(c){localStorage.setItem("asmb_comptabilite",JSON.stringify(c));fsWriteCollection("comptabilite",c);}

var COMPTA_FILTERS={du:"",au:"",categorie:"",moyen:""};
var comptaEditId=null;

function comptaFilteredList(){
  var lines=getComptabilite().slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
  return lines.filter(function(l){
    if(COMPTA_FILTERS.du && (l.date||"") < COMPTA_FILTERS.du) return false;
    if(COMPTA_FILTERS.au && (l.date||"") > COMPTA_FILTERS.au) return false;
    if(COMPTA_FILTERS.categorie && l.categorie!==COMPTA_FILTERS.categorie) return false;
    if(COMPTA_FILTERS.moyen && l.moyen!==COMPTA_FILTERS.moyen) return false;
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
  var cats=[].concat.apply([],[getComptabilite().map(function(l){return l.categorie;})]).filter(Boolean);
  var uniqCats=cats.filter(function(c,i){return cats.indexOf(c)===i;});
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
  fEl.appendChild(duInp);fEl.appendChild(auInp);fEl.appendChild(catSel);fEl.appendChild(moyenSel);
  if(COMPTA_FILTERS.du||COMPTA_FILTERS.au||COMPTA_FILTERS.categorie||COMPTA_FILTERS.moyen){
    var clearBtn=document.createElement("button");
    clearBtn.textContent="Réinitialiser";
    clearBtn.style.cssText="padding:8px 12px;border-radius:8px;background:var(--bdr);color:var(--mut);font-size:12px;font-weight:700;border:none;cursor:pointer";
    clearBtn.addEventListener("click",function(){COMPTA_FILTERS={du:"",au:"",categorie:"",moyen:""};buildComptabilite();});
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
  var totalRecette=0,totalDepense=0;
  filtered.forEach(function(l){
    if(l.type==="depense") totalDepense+=(l.montant||0); else totalRecette+=(l.montant||0);
  });
  var totEl=document.getElementById("compta-totals");
  totEl.innerHTML='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;display:flex;justify-content:space-between;font-size:12px">'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Recettes</div><div style="color:var(--grn);font-weight:800;font-size:15px">'+totalRecette.toFixed(2)+' €</div></div>'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Dépenses</div><div style="color:var(--red);font-weight:800;font-size:15px">'+totalDepense.toFixed(2)+' €</div></div>'+
    '<div><div style="color:var(--mut);font-size:10px;font-weight:700;text-transform:uppercase">Solde</div><div style="color:var(--dkg);font-weight:800;font-size:15px">'+(totalRecette-totalDepense).toFixed(2)+' €</div></div>'+
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
    dateSpan.textContent=(l.date?new Date(l.date).toLocaleDateString("fr-FR"):"")+(l.categorie?" · "+l.categorie:"");
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
function setComptaType(type){
  comptaCurrentType=type;
  var rB=document.getElementById("compta-type-recette"), dB=document.getElementById("compta-type-depense");
  rB.style.background=type==="recette"?"var(--grn)":"var(--card)";
  rB.style.color=type==="recette"?"#fff":"var(--mut)";
  rB.style.borderColor=type==="recette"?"var(--grn)":"var(--bdr)";
  dB.style.background=type==="depense"?"var(--red)":"var(--card)";
  dB.style.color=type==="depense"?"#fff":"var(--mut)";
  dB.style.borderColor=type==="depense"?"var(--red)":"var(--bdr)";
}
function showAddComptaLine(editId){
  comptaEditId=editId||null;
  var lines=getComptabilite();
  var existing=comptaEditId?lines.find(function(l){return l.id===comptaEditId;}):null;
  document.getElementById("compta-modal-title").textContent=existing?"Modifier la ligne":"Nouvelle ligne";
  document.getElementById("cl-date").value=existing?existing.date:new Date().toISOString().slice(0,10);
  document.getElementById("cl-montant").value=existing?existing.montant:"";
  document.getElementById("cl-categorie").value=existing?existing.categorie||"":"";
  document.getElementById("cl-motif").value=existing?existing.motif||"":"";
  document.getElementById("cl-tiers").value=existing?existing.tiers||"":"";
  document.getElementById("cl-moyen").value=existing?existing.moyen||"Espèces":"Espèces";
  document.getElementById("cl-reference").value=existing?existing.reference||"":"";
  setComptaType(existing?existing.type:"recette");
  var delBtn=document.getElementById("compta-delete-btn");
  if(delBtn) delBtn.style.display=existing?"block":"none";
  buildComptabilite(); // rafraichit les datalists de suggestion
  document.getElementById("modal-compta-line").style.display="flex";
}
function saveComptaLine(){
  var date=document.getElementById("cl-date").value;
  var montant=parseFloat(document.getElementById("cl-montant").value);
  if(!date){alert("Date obligatoire");return;}
  if(!montant||montant<=0){alert("Montant invalide");return;}
  var lines=getComptabilite();
  var data={
    date:date, montant:montant, type:comptaCurrentType,
    categorie:document.getElementById("cl-categorie").value.trim(),
    motif:document.getElementById("cl-motif").value.trim(),
    tiers:document.getElementById("cl-tiers").value.trim(),
    moyen:document.getElementById("cl-moyen").value,
    reference:document.getElementById("cl-reference").value.trim()
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
  if(!lines.length){alert("Aucune ligne à exporter.");return;}
  var header=["Date","Type","Montant","Catégorie","Motif","Tiers/Membre","Moyen de paiement","Référence"];
  var rows=lines.map(function(l){
    return [l.date,l.type==="depense"?"Dépense":"Recette",(l.montant||0).toFixed(2),l.categorie||"",l.motif||"",l.tiers||"",l.moyen||"",l.reference||""]
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
    var minusBtn=document.createElement("button");
    minusBtn.textContent="− 1";
    minusBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:12px;font-weight:700;border:none;cursor:pointer";
    minusBtn.addEventListener("click",function(e){e.stopPropagation();adjustInvQte(it.id,-1);});
    var plusBtn=document.createElement("button");
    plusBtn.textContent="+ 1";
    plusBtn.style.cssText="flex:1;padding:8px;border-radius:var(--rx);background:rgba(212,175,55,.12);color:var(--dkg);font-size:12px;font-weight:700;border:none;cursor:pointer";
    plusBtn.addEventListener("click",function(e){e.stopPropagation();adjustInvQte(it.id,1);});
    adjRow.appendChild(minusBtn);adjRow.appendChild(plusBtn);
    card.appendChild(adjRow);
    list.appendChild(card);
  });
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
}
var invEditCat="buvette";
function showAddInvItem(){
  invEditId=null;
  document.getElementById("inv-modal-title").textContent="Nouvel article";
  document.getElementById("inv-nom").value="";
  document.getElementById("inv-qte").value="0";
  document.getElementById("inv-unite").value="";
  document.getElementById("inv-seuil").value="";
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
  document.getElementById("inv-emplacement").value=it.emplacement||"";
  document.getElementById("inv-notes").value=it.notes||"";
  document.getElementById("inv-delete-btn").style.display="block";
  setInvItemCat(it.categorie||"buvette");
  document.getElementById("modal-inv-item").style.display="flex";
}
function saveInvItem(){
  var nom=document.getElementById("inv-nom").value.trim();
  if(!nom){alert("Le nom de l'article est obligatoire");return;}
  var qte=parseInt(document.getElementById("inv-qte").value,10)||0;
  var seuilRaw=document.getElementById("inv-seuil").value;
  var data={
    nom:nom,categorie:invEditCat,qte:qte,
    unite:document.getElementById("inv-unite").value.trim(),
    seuil:seuilRaw!==""?parseInt(seuilRaw,10):null,
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
  alert(files.length+" document"+(files.length>1?"s":"")+" ajouté"+(files.length>1?"s":"")+" !");
}
function deleteDoc(id){askConfirm("Supprimer ce document ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){if(!ok)return;var docs=getDocs().filter(function(d){return d.id!==id;});saveDocs(docs);buildDocs();buildAdminHome();});}

