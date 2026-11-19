/* ===== 15h-compta-virements.js — Virements entre comptes + circuit des notes de frais =====
   Virement : 2 lignes liées (même virementId, virement:true) — sortie (type "depense", champ vers) sur le compte
   de départ, entrée (type "recette", champ de) sur le compte d'arrivée. Ni recette ni dépense : invisibles pour
   getComptabilite() (totaux, résultat, budget, bilan), visibles dans la liste, les soldes, le relevé et le FEC
   (une seule écriture 512 → 530…, portée par la ligne de sortie, js/15b comptaEcritures).
   Notes de frais : dès que le dirigeant (ou un compte avec l'accès compta) reçoit une note, elle entre en compta
   en dépense « Note de frais » sur le compte « Notes de frais à rembourser » (dette du club, 467, hors
   disponibilités). Elle se solde par un remboursement (virement Banque/Caisse → ce compte) ou par un abandon
   de frais (recette « Dons » sur ce compte : charge et don se compensent). */

var COMPTA_NDF="Notes de frais à rembourser";

function comptaVirementComptes(){ return COMPTA_COMPTES.filter(function(c){ return c!=="Autre"; }); }
function comptaVirementDe(id){
  return getComptabiliteTout().filter(function(l){ return l&&l.virement&&String(l.id)===String(id); })[0]||null;
}
function comptaVirementLignes(vid){
  return getComptabiliteTout().filter(function(l){ return l&&l.virement&&l.virementId===vid; });
}
// Crée les 2 lignes ; renvoie l'identifiant du virement.
function comptaVirementCreer(o){
  var vid="vir"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), m=Math.round((Number(o.montant)||0)*100)/100;
  var commun={date:o.date,montant:m,categorie:"Virement entre comptes",motif:o.motif||("Virement "+o.de+" → "+o.vers),
    tiers:o.tiers||"",moyen:o.moyen||"Virement",reference:o.reference||"",pointe:false,justificatif:null,
    virement:true,virementId:vid,horsPremium:(typeof hasPremium==="function")?!hasPremium():false};
  if(o.ndfId) commun.ndfId=o.ndfId;
  var sortie=Object.assign({id:vid+"_s",type:"depense",compte:o.de,vers:o.vers},commun);
  var entree=Object.assign({id:vid+"_e",type:"recette",compte:o.vers,de:o.de},commun);
  saveComptabiliteTout(getComptabiliteTout().concat([sortie,entree]));
  return vid;
}
function comptaVirementSupprimer(vid){
  var lignes=comptaVirementLignes(vid), ndf=lignes.length&&lignes[0].ndfId;
  saveComptabiliteTout(getComptabiliteTout().filter(function(l){ return !(l&&l.virement&&l.virementId===vid); }));
  // Remboursement d'une note de frais annulé : la note redevient « à rembourser ».
  if(ndf){ var ns=getNotesFrais(), n=ns.filter(function(x){ return x.id===ndf; })[0]; if(n&&n.virementId===vid){ n.statut="arembourser"; delete n.virementId; saveNotesFrais(ns); } }
}

function comptaChampSelect(id,lab,opts,val){
  return '<div class="form-group"><label class="form-label" for="'+id+'">'+authEsc(lab)+'</label><select class="form-input" id="'+id+'">'+
    opts.map(function(c){ return '<option value="'+authEsc(c)+'"'+(c===val?" selected":"")+'>'+authEsc(c)+'</option>'; }).join("")+'</select></div>';
}
function openComptaVirement(){
  if(typeof hasPremium==="function"&&!hasPremium()){ askComptaVerrouillee(); return; }
  var cs=comptaVirementComptes(), s=gmSheet("Virement entre comptes"), b=s.body;
  b.innerHTML='<div style="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px">Argent déplacé d\'un compte du club à un autre (dépôt d\'espèces en banque, retrait, caisse buvette versée en banque). Ce n\'est ni une recette ni une dépense : seuls les soldes des comptes changent.</div>'+
    comptaChampSelect("vir-de","Compte de départ",cs,"Caisse espèces")+
    comptaChampSelect("vir-vers","Compte d'arrivée",cs,"Banque")+
    '<div class="form-group"><label class="form-label" for="vir-montant">Montant (€)</label><input class="form-input" id="vir-montant" type="number" step="0.01" min="0" inputmode="decimal"></div>'+
    '<div class="form-group"><label class="form-label" for="vir-date">Date</label><input class="form-input" id="vir-date" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
    '<div class="form-group"><label class="form-label" for="vir-motif">Libellé (facultatif)</label><input class="form-input" id="vir-motif" placeholder="Dépôt des espèces du tournoi"></div>';
  b.appendChild(gmBtn("Enregistrer le virement","primary",function(){
    var de=document.getElementById("vir-de").value, vers=document.getElementById("vir-vers").value;
    var m=parseFloat(document.getElementById("vir-montant").value), d=document.getElementById("vir-date").value;
    if(de===vers){ askAlert("Choisissez deux comptes différents."); return; }
    if(!(m>0)){ askAlert("Montant invalide"); return; }
    if(!d){ askAlert("Date obligatoire"); return; }
    comptaVirementCreer({de:de,vers:vers,montant:m,date:d,motif:document.getElementById("vir-motif").value.trim()});
    s.modal.remove(); showToast("Virement enregistré"); if(typeof buildComptabilite==="function") buildComptabilite();
  }));
}
function comptaVirementDetail(l){
  var ls=comptaVirementLignes(l.virementId), sortie=ls.filter(function(x){ return x.type==="depense"; })[0]||l;
  var de=sortie.compte, vers=sortie.vers||l.compte, s=gmSheet("Virement entre comptes"), b=s.body;
  b.innerHTML='<div style="font-size:22px;font-weight:900;color:var(--txt)">'+authEsc((Number(l.montant)||0).toFixed(2).replace(".",","))+' €</div>'+
    '<div style="font-size:13px;font-weight:700;color:var(--txt);margin-top:6px">'+authEsc(de)+' → '+authEsc(vers)+'</div>'+
    '<div style="font-size:12px;color:var(--mut);margin-top:4px">'+authEsc(l.date?l.date.split("-").reverse().join("/"):"")+(l.motif?" · "+authEsc(l.motif):"")+'</div>'+
    (l.ndfId?'<div style="font-size:12px;color:var(--txt2);margin-top:8px">Remboursement d\'une note de frais : supprimer ce virement la remet « à rembourser ».</div>':'')+
    '<div style="height:14px"></div>';
  b.appendChild(gmBtn("Supprimer le virement","danger",function(){
    askConfirm("Supprimer ce virement (les 2 lignes) ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
      if(!ok) return; comptaVirementSupprimer(l.virementId); s.modal.remove(); showToast("Virement supprimé");
      if(typeof buildComptabilite==="function") buildComptabilite();
    });
  }));
}

// ── Notes de frais ───────────────────────────────────────────────────
function ndfPeutCompta(){ return typeof hasModulePermission==="function"&&hasModulePermission("comptabilite"); }
function ndfLigneCompta(n){
  var j=(n.photo&&String(n.photo).length<950000)?n.photo:null;
  return {id:"ndf_"+n.id,date:n.date||new Date().toISOString().slice(0,10),montant:Math.round((Number(n.montant)||0)*100)/100,type:"depense",
    categorie:"Note de frais",motif:n.motif||"Note de frais",tiers:n.demandeurNom||n.demandeurEmail||"",moyen:"Autre",
    compte:COMPTA_NDF,reference:"Note de frais #"+n.id,pointe:false,justificatif:j,ndfId:n.id,
    horsPremium:(typeof hasPremium==="function")?!hasPremium():false};
}
// Notes reçues (statut « soumise ») → dépense en compta + « à rembourser ». Tourne sur l'appareil qui a l'accès compta.
function ndfSynchroCompta(){
  if(!ndfPeutCompta()||typeof getNotesFrais!=="function") return 0;
  // Pas avant que la compta ET les notes soient synchronisées (sinon on réécrirait une copie locale périmée).
  if(!window.GM_DEMO&&window.fbDb&&typeof FS_PREV!=="undefined"&&(!FS_PREV.comptabilite||!FS_PREV.notes_frais)) return 0;
  if(window.SUPPORT_MODE) return 0;
  var ns=getNotesFrais(), nouv=ns.filter(function(n){ return n&&n.statut==="soumise"&&!n.comptaId&&Number(n.montant)>0; });
  if(!nouv.length) return 0;
  var tout=getComptabiliteTout(), ids={}; tout.forEach(function(l){ ids[l.id]=1; });
  nouv.forEach(function(n){ var l=ndfLigneCompta(n); if(!ids[l.id]) tout.push(l); n.comptaId=l.id; n.statut="arembourser"; });
  saveComptabiliteTout(tout); saveNotesFrais(ns);
  return nouv.length;
}
function ndfRembourser(id,apres){
  var n=getNotesFrais().filter(function(x){ return x.id===id; })[0]; if(!n) return;
  if(n.statut==="soumise") ndfSynchroCompta();
  var s=gmSheet("Rembourser la note de frais"), b=s.body, nom=n.demandeurNom||n.demandeurEmail||"";
  b.innerHTML='<div style="font-size:13px;color:var(--txt);margin-bottom:12px"><b>'+authEsc((Number(n.montant)||0).toFixed(2).replace(".",","))+' €</b> à '+authEsc(nom)+(n.motif?' · '+authEsc(n.motif):'')+'</div>'+
    comptaChampSelect("ndf-compte","Payé depuis",comptaVirementComptes(),"Banque")+
    comptaChampSelect("ndf-moyen","Moyen",["Virement","Espèces","Chèque","CB"],"Virement")+
    '<div class="form-group"><label class="form-label" for="ndf-date">Date du paiement</label><input class="form-input" id="ndf-date" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>';
  b.appendChild(gmBtn("Enregistrer le remboursement","primary",function(){
    var d=document.getElementById("ndf-date").value; if(!d){ askAlert("Date obligatoire"); return; }
    var ns=getNotesFrais(), x=ns.filter(function(y){ return y.id===id; })[0]; if(!x) return;
    x.virementId=comptaVirementCreer({de:document.getElementById("ndf-compte").value,vers:COMPTA_NDF,montant:x.montant,date:d,
      moyen:document.getElementById("ndf-moyen").value,tiers:nom,motif:"Remboursement note de frais"+(x.motif?" · "+x.motif:""),reference:"Note de frais #"+x.id,ndfId:x.id});
    x.statut="remboursee"; x.rembourseLe=d; saveNotesFrais(ns);
    s.modal.remove(); showToast("Remboursement enregistré"); if(apres) apres();
  }));
}
function ndfAbandon(id,apres){
  var ns=getNotesFrais(), n=ns.filter(function(x){ return x.id===id; })[0]; if(!n) return;
  askConfirm("Le demandeur renonce à son remboursement : la note devient un don au club (abandon de frais). Aucune sortie d'argent.",{title:"Abandon de frais",confirmText:"Valider l'abandon"}).then(function(ok){
    if(!ok) return;
    if(n.statut==="soumise"){ ndfSynchroCompta(); ns=getNotesFrais(); n=ns.filter(function(x){ return x.id===id; })[0]; }
    var tout=getComptabiliteTout(), lid="ndfab_"+n.id;
    if(!tout.some(function(l){ return l.id===lid; })) tout.push({id:lid,date:new Date().toISOString().slice(0,10),montant:Math.round((Number(n.montant)||0)*100)/100,type:"recette",
      categorie:"Dons",motif:"Abandon de frais"+(n.motif?" · "+n.motif:""),tiers:n.demandeurNom||n.demandeurEmail||"",moyen:"Autre",compte:COMPTA_NDF,
      reference:"Note de frais #"+n.id,pointe:false,justificatif:null,ndfId:n.id,horsPremium:(typeof hasPremium==="function")?!hasPremium():false});
    saveComptabiliteTout(tout);
    n.abandonId=lid; n.statut="abandonnee"; saveNotesFrais(ns);
    showToast("Abandon de frais enregistré"); if(apres) apres();
  });
}
// Suppression d'une note : ses lignes de compta (dépense, remboursement, abandon, ancien format) partent avec elle.
function ndfSupprimerCompta(n){
  var tout=getComptabiliteTout(), reste=tout.filter(function(l){
    if(!l) return false;
    if(l.ndfId===n.id) return false;
    if(n.comptaId&&l.id===n.comptaId) return false;
    if(n.virementId&&l.virementId===n.virementId) return false;
    if(l.reference==="Note de frais #"+n.id) return false;
    return true;
  });
  if(reste.length!==tout.length) saveComptabiliteTout(reste);
}
