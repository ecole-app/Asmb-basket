// ── Tableau des factures (sponsors & partenaires) ───────────────────────────
// Chaque facture générée depuis la fiche d'un sponsor est gardée dans clubs/{id}/factures :
// statuts brouillon (« à envoyer ») → envoyée → payée (ou annulée). « Payée » crée la ligne de comptabilité.
// Aucun e-mail ne part tout seul : mailto: pré-rempli, le PDF se joint à la main.
function getFactures(){ try{ return JSON.parse(localStorage.getItem("asmb_factures")||"[]"); }catch(e){ return []; } }
function saveFactures(l){ localStorage.setItem("asmb_factures",JSON.stringify(l)); fsWriteCollection("factures",l); }

var FACT_FILTRE="";
var FACT_STATUTS={brouillon:["À envoyer","#5F6F67"],attente:["Envoyée","#C45A06"],retard:["En retard","#C0392B"],payee:["Payée","#13863A"],annulee:["Annulée","#8a8ea3"]};

function factEur(v){ return (Math.round((Number(v)||0)*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:0,maximumFractionDigits:2})+" €"; }
function factFr(iso){ var p=String(iso||"").split("-"); return p.length===3?p[2]+"/"+p[1]+"/"+p[0]:""; }
function factAujourdhui(){ var a=new Date(); return a.getFullYear()+"-"+("0"+(a.getMonth()+1)).slice(-2)+"-"+("0"+a.getDate()).slice(-2); }
// Statut affiché : « envoyée » devient « en retard » une fois l'échéance passée.
function factStatut(f){
  if(f.statut==="payee"||f.statut==="annulee"||f.statut==="brouillon") return f.statut;
  return (f.echeance&&f.echeance<factAujourdhui())?"retard":"attente";
}

// PDF de la facture (même mise en page qu'avant, générée à partir de la facture gardée).
function factTelechargerPdf(rec, factInfos){
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes."); return; }
  factInfos=factInfos||((typeof clubFacturationInfos==="function")?clubFacturationInfos():null);
  if(!factInfos){ askAlert("Informations de facturation manquantes (Paramètres)."); return; }
  var doc=new window.jspdf.jsPDF(), y=20, numero=rec.numero;
  doc.setFontSize(16); doc.setTextColor.apply(doc,clubPdfRgb());
  doc.text("FACTURE "+numero,14,y); y+=6;
  doc.setFontSize(9); doc.setTextColor(100,100,100);
  doc.text("Date : "+factFr(rec.date),14,y); y+=14;
  doc.setFontSize(10); doc.setTextColor(30,30,30);
  doc.setFont(undefined,"bold"); doc.text("Émetteur",14,y); doc.setFont(undefined,"normal"); y+=6;
  doc.text(clubLabel(),14,y); y+=5;
  doc.text(factInfos.adresse,14,y,{maxWidth:182}); y+=5;
  if(factInfos.siret){ doc.text("SIRET : "+factInfos.siret,14,y); y+=5; }
  y+=6;
  doc.setFont(undefined,"bold"); doc.text("Client",14,y); doc.setFont(undefined,"normal"); y+=6;
  doc.text(rec.client||"",14,y,{maxWidth:182}); y+=5;
  if(rec.contactNom){ doc.text("Contact : "+rec.contactNom,14,y,{maxWidth:182}); y+=5; }
  y+=8;
  doc.setFont(undefined,"bold"); doc.text("Désignation",14,y); doc.setFont(undefined,"normal"); y+=6;
  var lignes=doc.splitTextToSize(rec.designation||"",182);
  doc.text(lignes,14,y); y+=lignes.length*5+6;
  doc.text("Montant HT : "+Number(rec.montantHt).toFixed(2)+" €",14,y); y+=6;
  if(rec.tvaActive){
    doc.text("TVA ("+rec.tauxTva+"%) : "+Number(rec.montantTva).toFixed(2)+" €",14,y); y+=6;
    doc.setFont(undefined,"bold"); doc.text("Total TTC : "+Number(rec.montantTtc).toFixed(2)+" €",14,y); doc.setFont(undefined,"normal"); y+=10;
  } else {
    doc.setFont(undefined,"bold"); doc.text("Total : "+Number(rec.montantHt).toFixed(2)+" €",14,y); doc.setFont(undefined,"normal"); y+=6;
    doc.setFontSize(9); doc.text("TVA non applicable, article 293 B du Code général des impôts.",14,y,{maxWidth:182}); y+=10;
    doc.setFontSize(10);
  }
  y+=8; doc.setFontSize(9); doc.setTextColor(80,80,80);
  doc.text("Paiement sous 30 jours"+(rec.echeance?", avant le "+factFr(rec.echeance):"")+".",14,y);
  doc.save(clubSlug()+"_"+String(numero).toLowerCase()+"_"+String(rec.client||"").replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".pdf");
}

function factMaj(id, champs){
  var l=getFactures(), f=l.find(function(x){ return x.id===id; }); if(!f) return null;
  Object.assign(f,champs); saveFactures(l); return f;
}

// E-mail pré-rempli (rien ne part tout seul). Le PDF est téléchargé en même temps : à joindre.
function factEnvoyer(id, relance){
  var f=getFactures().find(function(x){ return x.id===id; }); if(!f) return;
  var club=(typeof clubLabel==="function"?clubLabel(""):"")||"Notre club";
  var bonjour="Bonjour"+(f.contactNom?" "+f.contactNom:"")+",\n\n";
  var corps=relance
    ? bonjour+"Sauf erreur de notre part, la facture n° "+f.numero+" du "+factFr(f.date)+" ("+factEur(f.montantTtc)+") n'a pas encore été réglée. Elle était à régler avant le "+factFr(f.echeance)+".\n\nMerci de nous indiquer si le paiement est en cours.\n\nCordialement,\n"+club
    : bonjour+"Veuillez trouver ci-joint la facture n° "+f.numero+" ("+factEur(f.montantTtc)+"), à régler avant le "+factFr(f.echeance)+".\n\nMerci pour votre soutien.\n\nCordialement,\n"+club;
  var sujet=(relance?"Relance facture ":"Facture ")+f.numero+" – "+club;
  if(!relance) factTelechargerPdf(f);
  if(!f.contactEmail) askAlert("Pas d'adresse e-mail sur la fiche du sponsor : ajoute-la, ou envoie le PDF autrement.");
  if(f.statut==="brouillon") factMaj(id,{statut:"envoyee", envoyeeLe:factAujourdhui()});
  if(relance) factMaj(id,{relanceLe:factAujourdhui()});
  window.location.href="mailto:"+encodeURIComponent(f.contactEmail||"")+"?subject="+encodeURIComponent(sujet)+"&body="+encodeURIComponent(corps);
  setTimeout(factOuvrir,400);
}

function factPayer(id){
  var f=getFactures().find(function(x){ return x.id===id; }); if(!f) return;
  askConfirm("Facture "+f.numero+" payée par "+f.client+" ? Une ligne de "+factEur(f.montantTtc)+" sera ajoutée à la comptabilité.",{confirmText:"Oui, payée"}).then(function(ok){
    if(!ok) return;
    var cid="fact"+f.id, compta=getComptabilite();
    if(!compta.some(function(l){ return l.id===cid; })){
      compta.push({id:cid, date:factAujourdhui(), montant:Number(f.montantTtc), type:"recette", categorie:"Sponsors/Partenaires",
        motif:"Facture n° "+f.numero+" — "+f.client, tiers:f.client, moyen:"Virement", reference:f.numero});
      saveComptabilite(compta);
    }
    factMaj(id,{statut:"payee", payeeLe:factAujourdhui(), comptaId:cid});
    showToast("Facture "+f.numero+" payée. Ligne ajoutée à la comptabilité.");
    factOuvrir();
  });
}
function factRemettre(id){
  var f=getFactures().find(function(x){ return x.id===id; }); if(!f) return;
  askConfirm("Remettre la facture "+f.numero+" en attente ? La ligne de comptabilité sera retirée.",{confirmText:"Remettre en attente"}).then(function(ok){
    if(!ok) return;
    var cid=f.comptaId||("fact"+f.id), compta=getComptabilite().filter(function(l){ return l.id!==cid; });
    saveComptabilite(compta);
    factMaj(id,{statut:"envoyee", payeeLe:null, comptaId:null});
    factOuvrir();
  });
}
function factAnnuler(id){
  var f=getFactures().find(function(x){ return x.id===id; }); if(!f) return;
  askConfirm("Annuler la facture "+f.numero+" ? Son numéro reste utilisé (on ne supprime jamais une facture).",{confirmText:"Annuler la facture"}).then(function(ok){
    if(!ok) return;
    factMaj(id,{statut:"annulee"}); factOuvrir();
  });
}

// Écran « Factures » : totaux, filtres par statut, une carte par facture.
function factOuvrir(){
  if(typeof hasPremium==="function"&&!hasPremium()){ askPremiumRequis("Factures sponsors & partenaires"); return; }
  var ancien=document.getElementById("fact-sheet"); if(ancien) ancien.remove();
  var s=gmSheet("Factures"); s.modal.id="fact-sheet";
  var l=getFactures().slice().sort(function(a,b){ return a.numero<b.numero?1:-1; });
  var att=0, ret=0, enc=0;
  l.forEach(function(f){ var st=factStatut(f); if(st==="attente") att+=Number(f.montantTtc)||0; if(st==="retard"){ att+=Number(f.montantTtc)||0; ret+=Number(f.montantTtc)||0; } if(st==="payee") enc+=Number(f.montantTtc)||0; });
  var tot=document.createElement("div"); tot.style.cssText="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:10px";
  [["À encaisser",att,"#C45A06"],["En retard",ret,"#C0392B"],["Encaissé",enc,"#13863A"]].forEach(function(t){
    var d=document.createElement("div"); d.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:9px 10px;min-width:0";
    d.innerHTML='<b style="display:block;font-size:15px;color:'+t[2]+'">'+authEsc(factEur(t[1]))+'</b><span style="font-size:10.5px;color:var(--mut)">'+t[0]+'</span>';
    tot.appendChild(d);
  });
  s.body.appendChild(tot);
  var chips=document.createElement("div"); chips.style.cssText="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none";
  [["","Toutes"],["attente","Envoyées"],["retard","En retard"],["payee","Payées"],["brouillon","À envoyer"]].forEach(function(c){
    var n=l.filter(function(f){ var st=factStatut(f); return st!=="annulee"&&(!c[0]||st===c[0]); }).length, on=FACT_FILTRE===c[0];
    var b=document.createElement("button"); b.type="button";
    b.style.cssText="padding:6px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;cursor:pointer;font-size:11.5px;font-weight:700;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"transparent")+";color:"+(on?"#fff":"var(--txt)");
    b.textContent=c[1]+" "+n; b.onclick=function(){ FACT_FILTRE=c[0]; factOuvrir(); };
    chips.appendChild(b);
  });
  s.body.appendChild(chips);
  var vues=l.filter(function(f){ var st=factStatut(f); return FACT_FILTRE?st===FACT_FILTRE:st!=="annulee"; });
  if(!vues.length){
    var v=document.createElement("div"); v.style.cssText="padding:18px 4px;text-align:center;font-size:12.5px;color:var(--mut);line-height:1.5";
    v.textContent=l.length?"Aucune facture dans cette catégorie.":"Aucune facture pour l'instant. Ouvre la fiche d'un sponsor et choisis « Générer une facture » : elle apparaîtra ici.";
    s.body.appendChild(v);
  }
  vues.forEach(function(f){
    var st=factStatut(f), lib=FACT_STATUTS[st], card=gmCard();
    var sous=st==="payee"?"payée le "+factFr(f.payeeLe):(st==="brouillon"?"pas encore envoyée":"échéance "+factFr(f.echeance));
    card.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><b style="font-size:13px;min-width:0">'+authEsc(f.client)+'</b><b>'+authEsc(factEur(f.montantTtc))+'</b></div>'
      +'<div style="font-size:11px;color:var(--mut);margin:2px 0 6px">'+authEsc(f.numero)+' · '+factFr(f.date)+' · '+authEsc(sous)+'</div>'
      +'<span style="display:inline-block;font-size:10px;font-weight:800;padding:3px 9px;border-radius:10px;color:#fff;background:'+lib[1]+'">'+lib[0]+'</span>';
    var row=document.createElement("div"); row.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px"; card.appendChild(row);
    var bt=function(txt,kind,fn){ var b=gmBtn(txt,kind,fn); b.style.padding="7px 12px"; b.style.fontSize="11px"; row.appendChild(b); };
    bt("PDF","soft",function(){ factTelechargerPdf(f); });
    if(st==="brouillon") bt("Envoyer par e-mail","primary",function(){ factEnvoyer(f.id,false); });
    if(st==="attente"||st==="retard") bt("Marquer payée","primary",function(){ factPayer(f.id); });
    if(st==="retard") bt("Relancer","soft",function(){ factEnvoyer(f.id,true); });
    if(st==="payee") bt("Remettre en attente","soft",function(){ factRemettre(f.id); });
    if(st==="brouillon"||st==="attente"||st==="retard") bt("Annuler","ghost",function(){ factAnnuler(f.id); });
    s.body.appendChild(card);
  });
}
