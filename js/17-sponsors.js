/* ===== 17-sponsors.js — Module Sponsors & Partenaires ===== */
// Mêmes conventions que 15-compta-inventaire.js : stockage local + sync
// Firestore via fsWriteCollection("sponsors", ...), accès dirigeant ou
// bureau/coach avec permissions.sponsors=true (voir firestore.rules).
function getSponsors(){try{return JSON.parse(localStorage.getItem("asmb_sponsors")||"[]");}catch(e){return [];}}
function saveSponsors(list){localStorage.setItem("asmb_sponsors",JSON.stringify(list));fsWriteCollection("sponsors",list);}

var SP_TAB="tous";
var sponsorEditId=null;
var sponsorLogoDataUrl=null;
var sponsorDocDataUrl=null;

function setSponsorTab(tab){
  SP_TAB=tab;
  ["tous","prospect","actif","expire"].forEach(function(t){
    var b=document.getElementById("sp-tab-"+t);
    if(b) b.classList.toggle("on",t===tab);
  });
  buildSponsors();
}

function sponsorFilteredList(){
  var all=getSponsors();
  if(SP_TAB!=="tous") all=all.filter(function(s){return s.statut===SP_TAB;});
  var q=((document.getElementById("sp-search")||{}).value||"").trim().toLowerCase();
  if(q) all=all.filter(function(s){return (s.nom||"").toLowerCase().indexOf(q)>=0;});
  all.sort(function(a,b){return (a.nom||"").localeCompare(b.nom||"");});
  return all;
}

var SP_STATUT_LABEL={prospect:"Prospect",actif:"Actif",expire:"Expiré"};
var SP_STATUT_COLOR={prospect:"#E8670A",actif:"var(--grn)",expire:"var(--mut)"};

function buildSponsors(){
  var all=getSponsors();
  var countEl=document.getElementById("sp-count");
  if(countEl) countEl.textContent=all.length+" sponsor"+(all.length>1?"s":"");
  var list=sponsorFilteredList();
  var el=document.getElementById("sp-list");if(!el)return;
  el.innerHTML="";
  if(!list.length){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun sponsor</div><div style="font-size:11px;margin-top:4px">Utilisez le bouton + Sponsor pour ajouter un prospect ou un partenaire</div></div>';
    return;
  }
  var today=new Date().toISOString().slice(0,10);
  list.forEach(function(s){
    var relanceDue=s.relance && s.relance<=today;
    var card=document.createElement("div");
    card.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+(SP_STATUT_COLOR[s.statut]||"var(--bdr)")+";border-radius:var(--rs);padding:12px;cursor:pointer";
    card.addEventListener("click",function(){showEditSponsor(s.id);});
    var logoHtml=s.logo
      ? '<img src="'+s.logo+'" style="width:40px;height:40px;border-radius:8px;object-fit:cover;flex-shrink:0">'
      : '<div style="width:40px;height:40px;border-radius:8px;background:var(--bdr);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;color:var(--mut);flex-shrink:0">'+authEsc((s.nom||"?").charAt(0).toUpperCase())+'</div>';
    var top=document.createElement("div");
    top.style.cssText="display:flex;align-items:center;gap:10px";
    top.innerHTML=logoHtml
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(s.nom||"")+'</div>'
        +'<div style="font-size:11px;color:var(--mut);margin-top:2px">'+(s.montant?Number(s.montant).toFixed(2)+" €":"Montant non précisé")+(s.dateFin?" · jusqu'au "+authEsc(s.dateFin.split("-").reverse().join("/")):"")+'</div>'
      +'</div>'
      +'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+(SP_STATUT_COLOR[s.statut]||"var(--mut)")+'">'+(SP_STATUT_LABEL[s.statut]||s.statut||"")+'</span>';
    card.appendChild(top);
    if(relanceDue){
      var alertBox=document.createElement("div");
      alertBox.style.cssText="margin-top:8px;padding:6px 10px;background:rgba(232,103,10,.1);border-radius:8px;font-size:11px;color:#E8670A;font-weight:700";
      alertBox.textContent="⏰ Relance à faire ("+s.relance.split("-").reverse().join("/")+")";
      card.appendChild(alertBox);
    }
    el.appendChild(card);
  });
}

function showAddSponsor(){
  sponsorEditId=null;
  sponsorLogoDataUrl=null;
  sponsorDocDataUrl=null;
  document.getElementById("sp-modal-title").textContent="Nouveau sponsor";
  document.getElementById("sp-nom").value="";
  document.getElementById("sp-statut").value="prospect";
  document.getElementById("sp-contact-nom").value="";
  document.getElementById("sp-contact-tel").value="";
  document.getElementById("sp-contact-email").value="";
  document.getElementById("sp-montant").value="";
  document.getElementById("sp-date-debut").value="";
  document.getElementById("sp-date-fin").value="";
  document.getElementById("sp-relance").value="";
  document.getElementById("sp-logo-preview").textContent="Aucun logo";
  document.getElementById("sp-doc-preview").textContent="Aucun document joint";
  document.getElementById("sp-notes").value="";
  document.getElementById("sp-logo-file").value="";
  document.getElementById("sp-doc-file").value="";
  var delBtn=document.getElementById("sp-delete-btn"); if(delBtn) delBtn.style.display="none";
  var factBtn=document.getElementById("sp-facture-btn"); if(factBtn) factBtn.style.display="none";
  var histBox=document.getElementById("sp-historique"); if(histBox) histBox.style.display="none";
  document.getElementById("modal-sponsor").style.display="flex";
}

// Rapproche les lignes comptables "Sponsors/Partenaires" dont le champ
// Tiers correspond au nom du sponsor (comparaison insensible à la casse).
// Lien volontairement simple (par nom) plutôt qu'un vrai ID relationnel :
// cohérent avec le reste de la Comptabilité qui ne connaît pas les sponsors.
function sponsorPaiements(nom){
  if(typeof getComptabilite!=="function" || !nom) return [];
  var n=nom.trim().toLowerCase();
  return getComptabilite().filter(function(l){
    return l.categorie==="Sponsors/Partenaires" && (l.tiers||"").trim().toLowerCase()===n;
  }).sort(function(a,b){return (b.date||"")<(a.date||"")?-1:1;});
}
function renderSponsorHistorique(nom){
  var box=document.getElementById("sp-historique"), listEl=document.getElementById("sp-historique-list");
  if(!box||!listEl) return;
  var paiements=sponsorPaiements(nom);
  if(!paiements.length){ box.style.display="none"; return; }
  box.style.display="block";
  listEl.innerHTML=paiements.map(function(l){
    return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--bdr);font-size:12px">'
      +'<span style="color:var(--mut)">'+authEsc((l.date||"").split("-").reverse().join("/"))+(l.motif?" · "+authEsc(l.motif):"")+'</span>'
      +'<span style="font-weight:700;color:var(--grn)">+'+(l.montant||0).toFixed(2)+' €</span>'
    +'</div>';
  }).join("");
}

function showEditSponsor(id){
  var s=getSponsors().find(function(x){return x.id===id;});
  if(!s)return;
  sponsorEditId=id;
  sponsorLogoDataUrl=s.logo||null;
  sponsorDocDataUrl=s.document||null;
  document.getElementById("sp-modal-title").textContent="Modifier le sponsor";
  document.getElementById("sp-nom").value=s.nom||"";
  document.getElementById("sp-statut").value=s.statut||"prospect";
  document.getElementById("sp-contact-nom").value=s.contactNom||"";
  document.getElementById("sp-contact-tel").value=s.contactTel||"";
  document.getElementById("sp-contact-email").value=s.contactEmail||"";
  document.getElementById("sp-montant").value=s.montant||"";
  document.getElementById("sp-date-debut").value=s.dateDebut||"";
  document.getElementById("sp-date-fin").value=s.dateFin||"";
  document.getElementById("sp-relance").value=s.relance||"";
  document.getElementById("sp-logo-preview").textContent=s.logo?"🖼 Logo joint":"Aucun logo";
  document.getElementById("sp-doc-preview").textContent=s.document?"📎 Document joint":"Aucun document joint";
  document.getElementById("sp-notes").value=s.notes||"";
  document.getElementById("sp-logo-file").value="";
  document.getElementById("sp-doc-file").value="";
  var delBtn=document.getElementById("sp-delete-btn"); if(delBtn) delBtn.style.display="block";
  var factBtn=document.getElementById("sp-facture-btn"); if(factBtn) factBtn.style.display="block";
  renderSponsorHistorique(s.nom);
  document.getElementById("modal-sponsor").style.display="flex";
}

function sponsorLogoPick(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  if(file.type.indexOf("image")!==0){askAlert("Le logo doit être une image");input.value="";return;}
  if(file.size>700*1024){askAlert("Fichier trop volumineux (700 Ko max).");input.value="";return;}
  var reader=new FileReader();
  reader.onload=function(){
    sponsorLogoDataUrl=reader.result;
    var prev=document.getElementById("sp-logo-preview");
    if(prev) prev.textContent="🖼 "+file.name+" (joint)";
  };
  reader.readAsDataURL(file);
}
function sponsorDocPick(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var isPdf=file.type==="application/pdf", isImage=file.type.indexOf("image")===0;
  if(!isPdf&&!isImage){askAlert("Seules les photos et les PDF sont acceptés");input.value="";return;}
  if(file.size>700*1024){askAlert("Fichier trop volumineux (700 Ko max).");input.value="";return;}
  var reader=new FileReader();
  reader.onload=function(){
    sponsorDocDataUrl=reader.result;
    var prev=document.getElementById("sp-doc-preview");
    if(prev) prev.textContent="📎 "+file.name+" (joint)";
  };
  reader.readAsDataURL(file);
}

function saveSponsor(){
  var nom=((document.getElementById("sp-nom")||{}).value||"").trim();
  if(!nom){askAlert("Le nom du sponsor est obligatoire");return;}
  var list=getSponsors();
  var data={
    nom:nom,
    statut:document.getElementById("sp-statut").value,
    contactNom:(document.getElementById("sp-contact-nom").value||"").trim(),
    contactTel:(document.getElementById("sp-contact-tel").value||"").trim(),
    contactEmail:(document.getElementById("sp-contact-email").value||"").trim(),
    montant:parseFloat(document.getElementById("sp-montant").value)||null,
    dateDebut:document.getElementById("sp-date-debut").value||"",
    dateFin:document.getElementById("sp-date-fin").value||"",
    relance:document.getElementById("sp-relance").value||"",
    logo:sponsorLogoDataUrl||null,
    document:sponsorDocDataUrl||null,
    notes:(document.getElementById("sp-notes").value||"").trim()
  };
  if(sponsorEditId){
    var idx=list.findIndex(function(x){return x.id===sponsorEditId;});
    if(idx>=0) list[idx]=Object.assign({id:sponsorEditId},data);
  } else {
    data.id=Date.now().toString();
    list.push(data);
  }
  saveSponsors(list);
  closeModal("modal-sponsor");
  buildSponsors();
  showToast("Sponsor enregistré !");
}

function deleteSponsor(){
  if(!sponsorEditId)return;
  askConfirm("Supprimer ce sponsor ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var list=getSponsors().filter(function(x){return x.id!==sponsorEditId;});
    saveSponsors(list);
    closeModal("modal-sponsor");
    buildSponsors();
  });
}

// ═══ FACTURE (sponsors/partenaires) ═══════════════════════════════
// Infos légales (adresse/SIRET/TVA) : clubFacturationInfos() dans
// 08-parametres.js. Le compteur de numérotation vit à part, dans
// clubs/{clubId}/facturation_compteur/compteur — une collection dédiée
// avec sa propre règle hasPermission(clubId,'sponsors'), pour qu'un
// trésorier/bureau délégué puisse générer des factures sans avoir le
// droit (réservé au dirigeant) de modifier la fiche du club elle-même.
var SP_FACT_COUNTER=null; // valeur en cache une fois chargée depuis Firestore
function loadFactureCounter(cb){
  if(SP_FACT_COUNTER!=null){ cb(); return; }
  if(!window.fbGetDoc || !window.fbDb){ SP_FACT_COUNTER=1; cb(); return; }
  window.fbGetDoc(window.fbDoc(window.fbDb,"facturation_compteur","compteur")).then(function(snap){
    SP_FACT_COUNTER=(snap.exists() && snap.data().prochainNumero) || 1;
    cb();
  }).catch(function(){ SP_FACT_COUNTER=1; cb(); });
}
function remplirProchainNumeroFacture(){
  var numEl=document.getElementById("fact-prochain-numero");
  if(!numEl) return;
  loadFactureCounter(function(){ numEl.textContent="FAC-"+String(SP_FACT_COUNTER).padStart(5,"0"); });
}
// Réserve le prochain numéro et l'incrémente (lecture-puis-écriture simple,
// pas de transaction : risque de collision négligeable vu le volume d'un
// club amateur). cb reçoit le numéro formaté, ex. "FAC-00001".
function reserverNumeroFacture(cb){
  loadFactureCounter(function(){
    var numero=SP_FACT_COUNTER;
    SP_FACT_COUNTER=numero+1;
    if(window.fbDb && window.fbSetDoc){
      window.fbSetDoc(window.fbDoc(window.fbDb,"facturation_compteur","compteur"),{prochainNumero:SP_FACT_COUNTER})
        .catch(function(e){ console.log("maj numéro facture:",(e&&e.code)||e); });
    }
    cb("FAC-"+String(numero).padStart(5,"0"));
  });
}

function openFactureModal(){
  if(!sponsorEditId){askAlert("Enregistrez d'abord le sponsor avant de générer une facture.");return;}
  var factInfos=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  var blockedBox=document.getElementById("facture-blocked-box");
  var formBox=document.getElementById("facture-form-box");
  if(!factInfos){
    if(blockedBox)blockedBox.style.display="block";
    if(formBox)formBox.style.display="none";
  } else {
    if(blockedBox)blockedBox.style.display="none";
    if(formBox)formBox.style.display="block";
    document.getElementById("fact-designation").value="";
    document.getElementById("fact-montant-ht").value="";
    updateFactureApercu();
    loadFactureCounter(function(){}); // préchauffe le cache pour que le clic sur "Télécharger" soit instantané
  }
  document.getElementById("modal-facture").style.display="flex";
}
function updateFactureApercu(){
  var apercuEl=document.getElementById("facture-apercu"); if(!apercuEl) return;
  var factInfos=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  var ht=parseFloat((document.getElementById("fact-montant-ht")||{}).value)||0;
  if(!ht){ apercuEl.textContent=""; return; }
  if(factInfos && factInfos.tvaActive){
    var taux=factInfos.tvaTaux||20;
    var tva=ht*taux/100;
    apercuEl.textContent="TVA ("+taux+"%) : "+tva.toFixed(2)+" € — Total TTC : "+(ht+tva).toFixed(2)+" €";
  } else {
    apercuEl.textContent="TVA non applicable, article 293 B du CGI — Total : "+ht.toFixed(2)+" €";
  }
}

function genererFacturePdf(){
  if(typeof window.jspdf==="undefined"){askAlert("Chargement du générateur PDF, réessayez dans quelques secondes");return;}
  var factInfos=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  if(!factInfos){askAlert("Informations de facturation manquantes.");return;}
  var s=getSponsors().find(function(x){return x.id===sponsorEditId;});
  if(!s){askAlert("Sponsor introuvable.");return;}
  var designation=((document.getElementById("fact-designation")||{}).value||"").trim();
  var montantHt=parseFloat((document.getElementById("fact-montant-ht")||{}).value);
  if(!designation){askAlert("La désignation de la prestation est obligatoire");return;}
  if(!montantHt||montantHt<=0){askAlert("Montant invalide");return;}

  var tvaActive=!!factInfos.tvaActive;
  var tauxTva=factInfos.tvaTaux||20;
  var montantTva=tvaActive?montantHt*tauxTva/100:0;
  var montantTtc=montantHt+montantTva;

  reserverNumeroFacture(function(numero){
    var jsPDF=window.jspdf.jsPDF;
    var doc=new jsPDF();
    var y=20;

    doc.setFontSize(16);doc.setTextColor.apply(doc,clubPdfRgb());
    doc.text("FACTURE "+numero,14,y);y+=6;
    doc.setFontSize(9);doc.setTextColor(100,100,100);
    doc.text("Date : "+new Date().toLocaleDateString("fr-FR"),14,y);y+=14;

    doc.setFontSize(10);doc.setTextColor(30,30,30);
    doc.setFont(undefined,"bold");doc.text("Émetteur",14,y);doc.setFont(undefined,"normal");y+=6;
    doc.text(clubLabel(),14,y);y+=5;
    doc.text(factInfos.adresse,14,y,{maxWidth:182});y+=5;
    if(factInfos.siret){doc.text("SIRET : "+factInfos.siret,14,y);y+=5;}
    y+=6;

    doc.setFont(undefined,"bold");doc.text("Client",14,y);doc.setFont(undefined,"normal");y+=6;
    doc.text(s.nom||"",14,y,{maxWidth:182});y+=5;
    if(s.contactNom){doc.text("Contact : "+s.contactNom,14,y,{maxWidth:182});y+=5;}
    y+=8;

    doc.setFont(undefined,"bold");doc.text("Désignation",14,y);doc.setFont(undefined,"normal");y+=6;
    var designationLines=doc.splitTextToSize(designation,182);
    doc.text(designationLines,14,y);
    y+=designationLines.length*5+6;

    doc.text("Montant HT : "+montantHt.toFixed(2)+" €",14,y);y+=6;
    if(tvaActive){
      doc.text("TVA ("+tauxTva+"%) : "+montantTva.toFixed(2)+" €",14,y);y+=6;
      doc.setFont(undefined,"bold");doc.text("Total TTC : "+montantTtc.toFixed(2)+" €",14,y);doc.setFont(undefined,"normal");y+=10;
    } else {
      doc.setFont(undefined,"bold");doc.text("Total : "+montantHt.toFixed(2)+" €",14,y);doc.setFont(undefined,"normal");y+=6;
      doc.setFontSize(9);doc.text("TVA non applicable, article 293 B du Code général des impôts.",14,y,{maxWidth:182});y+=10;
      doc.setFontSize(10);
    }

    y+=8;
    doc.setFontSize(9);doc.setTextColor(80,80,80);
    doc.text("Paiement à réception de facture.",14,y);

    doc.save(clubSlug()+"_"+numero.toLowerCase()+"_"+(s.nom||"").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".pdf");
    closeModal("modal-facture");
    showToast("Facture "+numero+" générée !");
  });
}
