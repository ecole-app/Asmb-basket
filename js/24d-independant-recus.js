/* ===== 24d-independant-recus.js — reçus numérotés et livre des recettes de l'indépendant ===== */
// Construit sur les lignes d'argent (`indep_lignes`, voir 24b) payées. L'appli n'encaisse rien : le reçu
// constate un paiement que l'indépendant a déjà reçu (espèces, virement, chèque, en ligne).
//  - Reçu : numéro `R-AAAA-0001` attribué à la première génération, jamais réutilisé. Les lignes payées
//    ensemble (même payeur, même date, même mode) partagent un seul reçu. Il est écrit sur les lignes
//    (`recuNum`, `recuLe`, `recuNom`, `recuPour`) : le client peut donc retélécharger son PDF sans rien lire d'autre.
//    Annuler un paiement annule son reçu (numéro gardé dans `recusAnnules`, jamais recyclé).
//  - Compteur et identité de l'émetteur : `indep_reglages/recus` {raison, siret, adresse, contact, annee, n}.
//  - Mention « TVA non applicable, art. 293 B du CGI » (micro-entreprise).
//  - Livre des recettes : encaissements de l'année classés par date de paiement, totaux par mois et trimestre, PDF et Excel.

// ── Fonctions pures ──────────────────────────────────────────────────
function indRecuNumero(annee,n){ return "R-"+annee+"-"+("0000"+n).slice(-4); }
function indFr(iso){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(iso||""); return m?m[3]+"/"+m[2]+"/"+m[1]:"";
}
function indSiretOk(s){ return /^\d{14}$/.test(String(s||"").replace(/\s/g,"")); }
// Lignes qui partagent le reçu de `l` : même payeur, même date et même mode de paiement ;
// celles qui ont déjà un reçu ne rejoignent qu'un reçu du même numéro.
function indRecuGroupe(l,toutes){
  return toutes.filter(function(x){
    if(x.statut!=="paye" || x.compte!==l.compte) return false;
    if(l.recuNum) return x.recuNum===l.recuNum;
    return !x.recuNum && x.datePaiement===l.datePaiement && (x.mode||"")===(l.mode||"");
  });
}
function indRecuDonnees(lignes){
  var l0=lignes[0]||{};
  return {num:l0.recuNum||"", le:l0.recuLe||"", payeur:l0.recuNom||"", mode:l0.mode||"", datePaiement:l0.datePaiement||"",
    lignes:lignes.map(function(x){ return {date:x.date, libelle:x.libelle||"", pour:x.recuPour||"", montant:Number(x.montant)||0}; }),
    total:indArrondi(lignes.reduce(function(s,x){ return s+(Number(x.montant)||0); },0))};
}
// Livre des recettes d'une année : encaissements classés par date de paiement.
function indLivreCalcul(lignes,annee,nomDe){
  var rows=lignes.filter(function(x){ return x.statut==="paye" && (x.datePaiement||"").slice(0,4)===String(annee); })
    .map(function(x){ return {date:x.datePaiement, client:nomDe?nomDe(x.compte):x.compte, nature:x.libelle||"", mode:x.mode||"", montant:Number(x.montant)||0, recu:x.recuNum||""}; })
    .sort(function(a,b){ return a.date<b.date?-1:a.date>b.date?1:(a.client<b.client?-1:1); });
  var mois=[0,0,0,0,0,0,0,0,0,0,0,0], total=0;
  rows.forEach(function(r){ mois[+r.date.slice(5,7)-1]+=r.montant; total+=r.montant; });
  var trim=[0,1,2,3].map(function(q){ return indArrondi(mois[q*3]+mois[q*3+1]+mois[q*3+2]); });
  return {rows:rows, mois:mois.map(indArrondi), trim:trim, total:indArrondi(total)};
}

// ── Identité de l'émetteur ───────────────────────────────────────────
function indRecusCfg(){ return IND.recusCfg||{}; }
function indNomComplet(compte){
  if(IND.role==="coach"){ var c=IND.clients[compte]; if(c&&c.prenom) return (c.prenom+" "+(c.nom||"")).trim(); return "Client"; }
  var f=IND.fiche||{}; return ((f.prenom||"")+" "+(f.nom||"")).trim()||"Client";
}
function indRecusInfosForm(apres){
  var cfg=indRecusCfg();
  var sh=gmSheet("Mes infos pour les reçus");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.innerHTML='<form class="ind-f" id="ind-ri-f" novalidate>'
    +'<p class="ind-note">Ces informations apparaissent sur tes reçus et ton livre des recettes.</p>'
    +'<label>Nom ou raison sociale<input id="ind-ri-nom" maxlength="80" value="'+indEsc(cfg.raison||(IND.club&&IND.club.name)||"")+'"></label>'
    +'<label>SIRET (14 chiffres)<input id="ind-ri-siret" inputmode="numeric" maxlength="17" value="'+indEsc(cfg.siret||"")+'"></label>'
    +'<label>Adresse<input id="ind-ri-adr" maxlength="160" autocomplete="street-address" value="'+indEsc(cfg.adresse||"")+'"></label>'
    +'<label>Téléphone ou e-mail (facultatif)<input id="ind-ri-ct" maxlength="80" value="'+indEsc(cfg.contact||"")+'"></label>'
    +'<div class="err" id="ind-ri-err"></div><div class="actions"><button type="submit" class="ok">Enregistrer</button></div></form>';
  var f=sh.body.querySelector("#ind-ri-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var raison=f.querySelector("#ind-ri-nom").value.trim(), siret=f.querySelector("#ind-ri-siret").value.replace(/\s/g,"");
    if(raison.length<2){ f.querySelector("#ind-ri-err").textContent="Indique ton nom ou celui de ton activité."; return; }
    if(!indSiretOk(siret)){ f.querySelector("#ind-ri-err").textContent="Le SIRET fait 14 chiffres."; return; }
    var d={raison:raison.slice(0,80), siret:siret, adresse:f.querySelector("#ind-ri-adr").value.trim().slice(0,160), contact:f.querySelector("#ind-ri-ct").value.trim().slice(0,80)};
    window.fbSetDoc(window.fbDoc(indDb(),"indep_reglages","recus"),d,{merge:true}).then(function(){
      IND.recusCfg=Object.assign({},cfg,d); sh.modal.remove(); showToast("Enregistré"); if(apres) apres();
    }).catch(indErr);
  });
}

// ── Émission du reçu ─────────────────────────────────────────────────
function indRecuOuvrir(id){
  var l=IND.lignes[id]; if(!l) return;
  var toutes=indLignes().map(function(x){ return Object.assign({id:x.id},x); });
  var gr=indRecuGroupe(Object.assign({id:id},l),toutes);
  if(l.recuNum){ indRecuSheet(gr); return; }
  if(IND.role!=="coach") return;
  if(!indSiretOk(indRecusCfg().siret)){ indRecusInfosForm(function(){ indRecuOuvrir(id); }); return; }
  var ref=window.fbDoc(indDb(),"indep_reglages","recus"), annee=+indAuj().slice(0,4);
  window.fbGetDoc(ref).then(function(s){
    var cfg=s.exists()?s.data():{}, n=(cfg.annee===annee?(+cfg.n||0):0)+1, num=indRecuNumero(annee,n);
    var b=window.fbWriteBatch(), nom=indNomComplet(l.compte).slice(0,80);
    gr.forEach(function(x){
      var pour=x.uid!==x.compte?indNomComplet(x.uid).slice(0,80):"";
      b.update(window.fbDoc(indDb(),"indep_lignes",x.id),{recuNum:num, recuLe:indAuj(), recuNom:nom, recuPour:pour});
    });
    b.set(ref,{annee:annee, n:n},{merge:true});
    return b.commit().then(function(){
      gr.forEach(function(x){ var li=IND.lignes[x.id]; if(li){ li.recuNum=num; li.recuLe=indAuj(); li.recuNom=nom; li.recuPour=x.uid!==x.compte?indNomComplet(x.uid).slice(0,80):""; } });
      indRecuSheet(gr.map(function(x){ return Object.assign({},x,IND.lignes[x.id]||{}); }));
    });
  }).catch(indErr);
}

// ── PDF ──────────────────────────────────────────────────────────────
function indPdfOk(){
  if(!window.jspdf||!window.jspdf.jsPDF){ askAlert("PDF indisponible pour le moment."); return false; }
  return true;
}
function indRgb(){
  var h=String(indCouleur()||"#0E7C7B").replace("#",""); if(h.length===3) h=h.replace(/(.)/g,"$1$1");
  return [parseInt(h.slice(0,2),16)||14, parseInt(h.slice(2,4),16)||124, parseInt(h.slice(4,6),16)||123];
}
function indRecuPdf(rec,em){
  var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}), rgb=indRgb();
  doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(0,0,210,26,"F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(18); doc.text("REÇU",14,16);
  doc.setFontSize(11); doc.text("N° "+rec.num,196,12,{align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text("Émis le "+indFr(rec.le),196,19,{align:"right"});
  doc.setTextColor(30,30,30);
  var y=40;
  doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.text(em.raison||"",14,y);
  doc.setFont("helvetica","normal"); doc.setFontSize(10); y+=6;
  doc.text("SIRET "+String(em.siret||"").replace(/(\d{3})(\d{3})(\d{3})(\d{5})/,"$1 $2 $3 $4"),14,y); y+=5;
  if(em.adresse){ doc.text(doc.splitTextToSize(em.adresse,90),14,y); y+=5*Math.max(1,doc.splitTextToSize(em.adresse,90).length); }
  if(em.contact){ doc.text(em.contact,14,y); y+=5; }
  doc.setFont("helvetica","bold"); doc.text("Reçu de",130,40);
  doc.setFont("helvetica","normal"); doc.text(doc.splitTextToSize(rec.payeur||"",66),130,46);
  y=Math.max(y,62)+6;
  doc.setDrawColor(200); doc.setFont("helvetica","bold"); doc.setFontSize(9);
  doc.text("Date",14,y); doc.text("Désignation",40,y); doc.text("Montant",196,y,{align:"right"});
  doc.line(14,y+2,196,y+2); y+=8; doc.setFont("helvetica","normal"); doc.setFontSize(10);
  rec.lignes.forEach(function(x){
    if(y>250){ doc.addPage(); y=20; }
    doc.text(indFr(x.date),14,y);
    var t=doc.splitTextToSize(x.libelle+(x.pour?" (pour "+x.pour+")":""),120); doc.text(t,40,y);
    doc.text(indEuros(x.montant),196,y,{align:"right"}); y+=5*t.length+2;
  });
  doc.line(14,y,196,y); y+=7;
  doc.setFont("helvetica","bold"); doc.setFontSize(12); doc.text("Total payé : "+indEuros(rec.total),196,y,{align:"right"}); y+=9;
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text("Réglé le "+indFr(rec.datePaiement)+(rec.mode?" par "+indModeTxt(rec.mode).toLowerCase():"")+".",14,y); y+=8;
  doc.setFontSize(9); doc.setTextColor(90,90,90);
  doc.text("TVA non applicable, art. 293 B du CGI.",14,y);
  return doc;
}
function indRecuNomFichier(rec){ return "recu-"+rec.num+".pdf"; }

// ── Fenêtre du reçu : télécharger, partager, envoyer ─────────────────
function indRecuSheet(lignes){
  var rec=indRecuDonnees(lignes), em=indRecusCfg();
  var sh=gmSheet("Reçu "+rec.num);
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var coach=IND.role==="coach", cli=coach?(IND.clients[lignes[0].compte]||{}):{};
  var tel=String(cli.tel||"").replace(/[^+0-9]/g,""), mail=cli.email||"";
  sh.body.innerHTML='<div class="ind-c"><div class="ind-row"><div class="t"><strong>'+indEsc(indEuros(rec.total))+'</strong><span>'
    +indEsc((rec.payeur||"")+" · "+indFr(rec.datePaiement)+(rec.mode?" · "+indModeTxt(rec.mode):""))+'</span></div></div></div>'
    +'<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn p" id="ind-rc-dl">Télécharger le PDF</button>'
    +(navigator.share?'<button type="button" class="ind-btn s" id="ind-rc-sh">Partager</button>':'')+'</div>'
    +(coach?'<div class="ind-btns" style="margin-top:8px">'
      +'<a class="ind-btn s" style="text-decoration:none" id="ind-rc-ml" href="#">E-mail</a>'
      +(tel?'<a class="ind-btn s" style="text-decoration:none" id="ind-rc-sms" href="#">SMS</a>':'')+'</div>'
      +'<p class="ind-note" style="margin-top:8px">E-mail et SMS sont pré-remplis mais n\'envoient rien tout seuls. Pour l\'e-mail, joins le PDF téléchargé (ou utilise « Partager »).</p>':'');
  function faire(){ return indRecuPdf(rec,em); }
  sh.body.querySelector("#ind-rc-dl").addEventListener("click",function(){ if(indPdfOk()) faire().save(indRecuNomFichier(rec)); });
  var bs=sh.body.querySelector("#ind-rc-sh");
  if(bs) bs.addEventListener("click",function(){
    if(!indPdfOk()) return;
    var blob=faire().output("blob"), file=new File([blob],indRecuNomFichier(rec),{type:"application/pdf"});
    var data={files:[file], title:"Reçu "+rec.num};
    if(navigator.canShare && !navigator.canShare(data)){ faire().save(indRecuNomFichier(rec)); return; }
    navigator.share(data).catch(function(){});
  });
  var txt="Bonjour, voici votre reçu n° "+rec.num+" de "+indEuros(rec.total)+" (paiement du "+indFr(rec.datePaiement)+"). Cordialement, "+(em.raison||"");
  var ml=sh.body.querySelector("#ind-rc-ml");
  if(ml) ml.addEventListener("click",function(e){ e.preventDefault(); location.href="mailto:"+encodeURIComponent(mail)+"?subject="+encodeURIComponent("Reçu "+rec.num)+"&body="+encodeURIComponent(txt); });
  var sm=sh.body.querySelector("#ind-rc-sms");
  if(sm) sm.addEventListener("click",function(e){ e.preventDefault(); location.href="sms:"+tel+"?&body="+encodeURIComponent(txt); });
}

// Annulation d'un paiement : le reçu qui le couvrait est annulé pour tout son groupe (numéro gardé, jamais réutilisé).
function indRecuAnnulerOps(l,b){
  if(!l.recuNum) return;
  indLignes().filter(function(x){ return x.recuNum===l.recuNum && x.id!==l.id; }).forEach(function(x){
    b.update(window.fbDoc(indDb(),"indep_lignes",x.id),{recuNum:"", recuLe:"", recusAnnules:window.fbArrayUnion(l.recuNum)});
  });
}

// ── Livre des recettes ───────────────────────────────────────────────
var IND_MOIS_LONG=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
function indLivre(annee){
  annee=annee||+indAuj().slice(0,4);
  var sh=gmSheet("Livre des recettes");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  function peindre(){
    var r=indLivreCalcul(indLignes(),annee,indNomComplet);
    var h='<div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:10px"><button type="button" class="ind-btn s mini" style="width:auto;min-width:44px" data-a="-1" aria-label="Année précédente">‹</button>'
      +'<strong style="font-size:18px">'+annee+'</strong><button type="button" class="ind-btn s mini" style="width:auto;min-width:44px" data-a="1" aria-label="Année suivante">›</button></div>'
      +'<div class="ind-c"><div class="ind-row"><div class="t"><strong style="font-size:22px">'+indEsc(indEuros(r.total))+'</strong><span>encaissé en '+annee+' · '+r.rows.length+' paiement'+(r.rows.length>1?"s":"")+'</span></div></div></div>';
    h+='<div class="ind-k">Par trimestre</div><div class="ind-c ind-list">'+r.trim.map(function(t,i){ return '<div class="ind-row"><div class="t"><strong>T'+(i+1)+'</strong></div><span class="ind-pill">'+indEsc(indEuros(t))+'</span></div>'; }).join("")+'</div>';
    h+='<div class="ind-k">Par mois</div><div class="ind-c ind-list">'+r.mois.map(function(m,i){ return m?'<div class="ind-row"><div class="t"><strong>'+IND_MOIS_LONG[i]+'</strong></div><span class="ind-pill">'+indEsc(indEuros(m))+'</span></div>':""; }).join("")+(r.total?'':'<div class="ind-vide">Aucun encaissement cette année.</div>')+'</div>';
    h+='<div class="ind-k">Détail</div>'+(r.rows.length?'<div class="ind-c ind-list">'+r.rows.map(function(x){
      return '<div class="ind-row"><div class="t"><strong>'+indEsc(indFr(x.date)+" · "+x.client)+'</strong><span>'+indEsc([x.nature,indModeTxt(x.mode),x.recu].filter(Boolean).join(" · "))+'</span></div><span class="ind-pill">'+indEsc(indEuros(x.montant))+'</span></div>';
    }).join("")+'</div>':'<div class="ind-c ind-vide">Rien à afficher.</div>');
    h+='<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn p" data-x="pdf">PDF</button><button type="button" class="ind-btn s" data-x="xlsx">Excel</button></div>';
    sh.body.innerHTML=h; sh.body.__r=r;
  }
  sh.body.addEventListener("click",function(e){
    var a=e.target.closest("button[data-a]"); if(a){ annee+=+a.dataset.a; peindre(); return; }
    var x=e.target.closest("button[data-x]"); if(!x) return;
    var r=indLivreCalcul(indLignes(),annee,indNomComplet);
    if(x.dataset.x==="pdf") indLivrePdf(r,annee); else indLivreXlsx(r,annee);
  });
  peindre();
}
function indLivreXlsx(r,annee){
  if(typeof exporterXlsx!=="function"){ askAlert("Export Excel indisponible."); return; }
  exporterXlsx("livre-des-recettes-"+annee+".xlsx",[
    {nom:"Recettes "+annee, entetes:["Date","Client","Nature","Mode","Montant (€)","N° reçu"],
      lignes:r.rows.map(function(x){ return [indFr(x.date),x.client,x.nature,indModeTxt(x.mode),x.montant,x.recu]; })},
    {nom:"Totaux", entetes:["Période","Montant (€)"],
      lignes:r.trim.map(function(t,i){ return ["T"+(i+1),t]; }).concat(r.mois.map(function(m,i){ return [IND_MOIS_LONG[i],m]; })).concat([["Total "+annee,r.total]])}
  ]);
}
function indLivrePdf(r,annee){
  if(!indPdfOk()) return;
  var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"}), rgb=indRgb(), em=indRecusCfg();
  doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(0,0,210,24,"F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("Livre des recettes "+annee,14,11);
  doc.setFont("helvetica","normal"); doc.setFontSize(10);
  doc.text((em.raison||(IND.club&&IND.club.name)||"")+(em.siret?" · SIRET "+em.siret:""),14,18);
  doc.setTextColor(30,30,30);
  var y=34, cols=[[14,"Date"],[36,"Client"],[84,"Nature"],[140,"Mode"],[170,"N° reçu"],[196,"Montant"]];
  function entete(){ doc.setFont("helvetica","bold"); doc.setFontSize(9); cols.forEach(function(c){ doc.text(c[1],c[0],y,c[0]===196?{align:"right"}:undefined); }); doc.setDrawColor(200); doc.line(14,y+2,196,y+2); y+=8; doc.setFont("helvetica","normal"); }
  entete();
  r.rows.forEach(function(x){
    if(y>275){ doc.addPage(); y=20; entete(); }
    doc.text(indFr(x.date),14,y); doc.text(doc.splitTextToSize(x.client,44)[0]||"",36,y); doc.text(doc.splitTextToSize(x.nature,52)[0]||"",84,y);
    doc.text(indModeTxt(x.mode),140,y); doc.text(x.recu,170,y); doc.text(indEuros(x.montant),196,y,{align:"right"}); y+=6;
  });
  if(y>240){ doc.addPage(); y=20; }
  y+=4; doc.line(14,y,196,y); y+=7; doc.setFont("helvetica","bold");
  r.trim.forEach(function(t,i){ doc.text("T"+(i+1),14,y); doc.text(indEuros(t),60,y,{align:"right"}); y+=6; });
  doc.setFontSize(11); y+=2; doc.text("Total "+annee+" : "+indEuros(r.total),196,y,{align:"right"});
  doc.setFont("helvetica","normal"); doc.setFontSize(8); doc.setTextColor(90,90,90);
  doc.text("TVA non applicable, art. 293 B du CGI.",14,288);
  doc.save("livre-des-recettes-"+annee+".pdf");
}

// ── Boutons de l'onglet Argent et actions ────────────────────────────
function indRecusBoutons(){
  return '<div class="ind-btns" style="margin-top:10px"><button type="button" class="ind-btn s" data-act="stats">Stats</button><button type="button" class="ind-btn s" data-act="livre">Livre des recettes</button>'
    +'<button type="button" class="ind-btn s" data-act="recus-infos">Mes infos pour les reçus</button></div>';
}
function indRecusClic(act,el){
  if(act==="recu"){ indRecuOuvrir(el.dataset.id); return true; }
  if(act==="livre"){ indLivre(); return true; }
  if(act==="recus-infos"){ indRecusInfosForm(); return true; }
  if(typeof indStatsClic==="function") return indStatsClic(act);
  return false;
}
