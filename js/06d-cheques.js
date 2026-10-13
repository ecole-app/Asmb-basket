/* ===== 06d-cheques.js — Licences payées par chèque : plusieurs fois, dépôt en banque, bordereau ===== */
// Un paiement « Chèque » de licence peut être fait en 1 à 4 chèques (n°, banque,
// émetteur, montant, date d'encaissement prévue). Chaque chèque est « À déposer »
// puis « Déposé » : la ligne de compta est créée au DÉPÔT (une par chèque), pas à
// la saisie. Écran « Remise en banque » : chèques encaissables cochés, bordereau
// PDF à joindre au dépôt, puis « Marquer comme déposés ».
// Données : lic.cheques=[{id,num,banque,emetteur,montant,encaissement,statut,deposeLe}],
// lic.paiement={moyen:"Chèque",montant:total,date,reference,cheques:true}.

var CHQ_PREVU={especes:"Espèces",cheque1:"Chèque en 1 fois",cheque2:"Chèque en 2 fois",cheque3:"Chèque en 3 fois",virement:"Virement",cb:"Carte bancaire",enligne:"Paiement en ligne"};

function chqAuj(){ return new Date().toISOString().slice(0,10); }
function chqDateFr(iso){ var d=new Date((iso||"")+"T12:00:00"); return isNaN(d)?(iso||""):d.toLocaleDateString("fr-FR"); }
function chqMoisPlus(iso, n){ var d=new Date((iso||chqAuj())+"T12:00:00"); var j=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n); var fin=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(j,fin)); return d.toISOString().slice(0,10); }
function chqEuro(v){ return (Math.round((Number(v)||0)*100)/100).toFixed(2).replace(".",",")+" €"; }
function chqPeutCompta(){
  var dir=((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0;
  return (dir||(typeof hasModulePermission==="function"&&hasModulePermission("comptabilite")));
}
function chqNomLic(lic){ var f=lic.fiche||{}; return ((f.prenom||"")+" "+(f.nom||"")).trim(); }
function chqRef(code, id){ return "Licence "+code+" · chèque "+id; }

// ── Éditeur de chèques dans la fenêtre « Enregistrer le paiement » ──
// Renvoie un objet {lire()} qui donne la liste validée, ou null si erreur.
function chqEditeur(box, lic){
  var f=lic.fiche||{};
  var deja=(lic.cheques||[]).map(function(c){ return Object.assign({},c); });
  var prevu=String(f.paiementPrevu||""), nDef=/^cheque[1-4]$/.test(prevu)?parseInt(prevu.slice(6),10):1;
  var total=deja.length?deja.reduce(function(s,c){return s+(Number(c.montant)||0);},0):(lic.montantAttendu||(lic.paiement&&lic.paiement.montant)||"");
  var liste=deja.length?deja:[];
  function repartir(n){
    var t=Math.round((parseFloat(String(total).replace(",","."))||0)*100), base=Math.floor(t/n/100)*100, reste=t-base*n;
    var anciens=liste.slice();
    liste=[];
    for(var i=0;i<n;i++){
      var a=anciens[i]||{};
      liste.push({id:a.id||(Date.now().toString(36)+i), num:a.num||"", banque:a.banque||(anciens[0]&&anciens[0].banque)||"", emetteur:a.emetteur||(anciens[0]&&anciens[0].emetteur)||f.respNom||chqNomLic(lic),
        montant:t?((base+(i===0?reste:0))/100):(a.montant||""), encaissement:a.encaissement||chqMoisPlus(chqAuj(),i), statut:a.statut||"a_deposer", deposeLe:a.deposeLe||null});
    }
  }
  if(!liste.length) repartir(nDef);
  box.innerHTML="";
  var tot=document.createElement("div"); tot.className="form-group";
  tot.innerHTML='<label class="form-label">Montant total (€)</label>';
  var iT=document.createElement("input"); iT.className="form-input"; iT.type="number"; iT.step="0.01"; iT.value=total; iT.placeholder="0.00";
  tot.appendChild(iT); box.appendChild(tot);
  var nb=document.createElement("div"); nb.className="form-group";
  nb.innerHTML='<label class="form-label">Nombre de chèques</label>';
  var chips=document.createElement("div"); chips.style.cssText="display:flex;gap:6px"; nb.appendChild(chips); box.appendChild(nb);
  if(prevu&&CHQ_PREVU[prevu]){ var pv=document.createElement("div"); pv.style.cssText="font-size:11px;color:var(--mut);margin:-6px 0 10px"; pv.textContent="Prévu par la famille sur la fiche : "+CHQ_PREVU[prevu]; box.appendChild(pv); }
  var rows=document.createElement("div"); box.appendChild(rows);
  function peindreChips(){
    chips.innerHTML="";
    [1,2,3,4].forEach(function(n){
      var on=liste.length===n, b=document.createElement("button"); b.type="button"; b.textContent=n+(n===1?" chèque":" chèques");
      b.style.cssText="flex:1;padding:9px 4px;border-radius:var(--rx);font-size:11px;font-weight:700;cursor:pointer;border:2px solid "+(on?"var(--grn)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--ltg) 10%, transparent)":"var(--card)")+";color:"+(on?"var(--dkg)":"var(--mut)");
      b.addEventListener("click",function(){ if(liste.some(function(c){return c.statut==="depose";})&&n<liste.length){ askAlert("Un chèque déjà déposé ne peut pas être retiré."); return; } repartir(n); peindre(); });
      chips.appendChild(b);
    });
  }
  function champ(c, cle, ph, type, w){
    var i=document.createElement("input"); i.className="form-input"; i.type=type||"text"; i.placeholder=ph; i.value=c[cle]==null?"":c[cle];
    i.style.cssText="padding:8px 10px;font-size:13px;min-width:0;flex:"+(w||1); if(type==="number"){ i.step="0.01"; }
    if(c.statut==="depose") i.disabled=true;
    if(cle==="montant") c._in=i;
    c["_"+cle]=i;
    i.addEventListener("input",function(){
      var avant=c[cle]; c[cle]=i.value;
      // Banque et émetteur tapés sur le 1er chèque : recopiés sur les suivants
      if((cle==="banque"||cle==="emetteur")&&liste[0]===c) liste.slice(1).forEach(function(o){
        if(o.statut!=="depose"&&(!o[cle]||o[cle]===avant)){ o[cle]=i.value; if(o["_"+cle]) o["_"+cle].value=i.value; }
      });
    });
    return i;
  }
  function peindre(){
    peindreChips(); rows.innerHTML="";
    liste.forEach(function(c,i){
      var card=document.createElement("div");
      card.style.cssText="border:1px solid var(--bdr);border-radius:var(--rs);padding:10px;margin-bottom:8px;background:var(--card)";
      var h=document.createElement("div"); h.style.cssText="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:6px;display:flex;justify-content:space-between";
      h.textContent="Chèque "+(i+1);
      if(c.statut==="depose"){ var s=document.createElement("span"); s.style.cssText="color:var(--grn)"; s.textContent="Déposé le "+chqDateFr(c.deposeLe); h.appendChild(s); }
      card.appendChild(h);
      var r1=document.createElement("div"); r1.style.cssText="display:flex;gap:6px;margin-bottom:6px";
      r1.appendChild(champ(c,"montant","Montant","number",1)); r1.appendChild(champ(c,"num","N° du chèque","text",1.3));
      var r2=document.createElement("div"); r2.style.cssText="display:flex;gap:6px;margin-bottom:6px";
      r2.appendChild(champ(c,"banque","Banque","text",1)); r2.appendChild(champ(c,"emetteur","Émetteur","text",1.3));
      var r3=document.createElement("div"); r3.style.cssText="display:flex;gap:6px;align-items:center";
      var l=document.createElement("span"); l.style.cssText="font-size:11px;color:var(--mut);flex-shrink:0"; l.textContent="À encaisser le";
      r3.appendChild(l); r3.appendChild(champ(c,"encaissement","","date",1));
      card.appendChild(r1); card.appendChild(r2); card.appendChild(r3);
      rows.appendChild(card);
    });
  }
  // Nouveau total : on répartit dans les champs existants sans reconstruire
  // la liste (le champ que l'utilisateur vient de toucher garde le focus).
  iT.addEventListener("input",function(){
    total=iT.value;
    if(liste.some(function(c){return c.statut==="depose";})) return;
    var t=Math.round((parseFloat(String(total).replace(",","."))||0)*100), n=liste.length, base=Math.floor(t/n/100)*100, reste=t-base*n;
    liste.forEach(function(c,i){ c.montant=t?(base+(i===0?reste:0))/100:""; if(c._in) c._in.value=c.montant; });
  });
  peindre();
  return {
    lire:function(){
      var ok=true;
      var out=liste.map(function(c){
        var m=Math.round((parseFloat(String(c.montant).replace(",","."))||0)*100)/100;
        if(!(m>0)||!/^\d{4}-\d{2}-\d{2}$/.test(c.encaissement||"")) ok=false;
        return {id:c.id,num:String(c.num||"").trim().slice(0,20),banque:String(c.banque||"").trim().slice(0,40),emetteur:String(c.emetteur||"").trim().slice(0,60),
          montant:m,encaissement:c.encaissement,statut:c.statut||"a_deposer",deposeLe:c.deposeLe||null};
      });
      if(!ok){ askAlert("Chaque chèque doit avoir un montant et une date d'encaissement."); return null; }
      return out;
    }
  };
}
// Enregistre les chèques d'une licence. La compta ne bouge que pour les chèques
// déjà déposés (montant corrigé) ; une ancienne ligne « paiement unique » est retirée.
function chqEnregistrer(code, cheques){
  var lics=getLicences(), idx=lics.findIndex(function(l){return l.code===code;}); if(idx<0) return;
  var lic=lics[idx];
  var total=Math.round(cheques.reduce(function(s,c){return s+c.montant;},0)*100)/100;
  lic.cheques=cheques;
  lic.paiement={moyen:"Chèque",montant:total,date:cheques.map(function(c){return c.encaissement;}).sort()[0]||chqAuj(),
    reference:cheques.length+" chèque"+(cheques.length>1?"s":"")+(cheques[0]&&cheques[0].num?" (n° "+cheques.map(function(c){return c.num;}).filter(Boolean).join(", ")+")":""),cheques:true};
  saveLicences(lics);
  if(chqPeutCompta()&&typeof getComptabilite==="function"){
    var compta=getComptabilite(), avant=compta.length, ids={};
    cheques.forEach(function(c){ ids[chqRef(code,c.id)]=c; });
    compta=compta.filter(function(l){
      if(l.reference==="Licence "+code) return false;
      if(String(l.reference||"").indexOf("Licence "+code+" · chèque ")===0 && !ids[l.reference]) return false;
      return true;
    });
    var change=compta.length!==avant;
    compta.forEach(function(l){ var c=ids[l.reference]; if(c&&c.statut==="depose"&&l.montant!==c.montant){ l.montant=c.montant; change=true; } });
    if(change) saveComptabilite(compta);
  }
  if(typeof renderLicenceDetail==="function") renderLicenceDetail(lic);
  if(typeof buildLicences==="function") buildLicences();
}
// Passage à un autre moyen de paiement : les chèques et leurs lignes disparaissent.
function chqRetirer(lic, compta){
  if(!lic.cheques) return compta;
  delete lic.cheques;
  if(!compta) return compta;
  return compta.filter(function(l){ return String(l.reference||"").indexOf("Licence "+lic.code+" · chèque ")!==0; });
}

// ── Affichage sur la fiche licence ──────────────────────────────────
function chqHtmlLicence(lic){
  var l=lic.cheques; if(!l||!l.length) return "";
  var auj=chqAuj();
  return '<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">'+l.map(function(c,i){
    var dep=c.statut==="depose", pret=!dep&&c.encaissement<=auj;
    return '<div style="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rx);padding:8px 10px">'+
      '<div style="flex:1;min-width:0;font-size:12px;color:var(--txt)"><b>'+chqEuro(c.montant)+'</b> · '+(c.num?"n° "+authEsc(c.num):"chèque "+(i+1))+(c.banque?" · "+authEsc(c.banque):"")+
      '<div style="font-size:11px;color:var(--mut)">'+(dep?"Déposé le "+chqDateFr(c.deposeLe):"À encaisser le "+chqDateFr(c.encaissement))+(c.emetteur?" · "+authEsc(c.emetteur):"")+'</div></div>'+
      '<span style="flex-shrink:0;font-size:10px;font-weight:800;padding:3px 9px;border-radius:20px;'+(dep?"background:var(--grn);color:#fff":(pret?"background:#E8670A;color:#fff":"background:var(--bdr);color:var(--txt2)"))+'">'+(dep?"Déposé":(pret?"À déposer":"Plus tard"))+'</span></div>';
  }).join("")+'</div>';
}

// ── Bloc « Chèques à déposer » dans Licences ────────────────────────
function chqTous(){
  var out=[];
  (typeof getLicences==="function"?getLicences():[]).forEach(function(lic){
    (lic.cheques||[]).forEach(function(c){ out.push({lic:lic,c:c}); });
  });
  return out;
}
function renderChequesAdmin(){
  var box=document.getElementById("lic-cheques-box"); if(!box) return;
  if(!chqPeutCompta()){ box.innerHTML=""; return; }
  var auj=chqAuj(), l=chqTous().filter(function(x){return x.c.statut!=="depose";});
  if(!l.length){ box.innerHTML=""; return; }
  var prets=l.filter(function(x){return x.c.encaissement<=auj;});
  var mPrets=prets.reduce(function(s,x){return s+x.c.montant;},0), mTous=l.reduce(function(s,x){return s+x.c.montant;},0);
  box.innerHTML='<div style="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid '+(prets.length?"#E8670A":"var(--bdr)")+';border-radius:var(--rs);padding:12px 14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'+
      '<div><div style="font-size:13px;font-weight:800;color:var(--txt)">Chèques'+(prets.length?' à déposer : '+prets.length:'')+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+(prets.length?chqEuro(mPrets)+" encaissables aujourd'hui · ":"")+l.length+' en attente au total ('+chqEuro(mTous)+')</div></div>'+
      '<button onclick="ouvrirRemiseBanque()" style="flex-shrink:0;padding:9px 12px;border-radius:var(--rx);border:none;cursor:pointer;font-size:12px;font-weight:700;background:'+(prets.length?"#E8670A;color:#fff":"var(--bdr);color:var(--txt)")+'">Remise en banque</button>'+
    '</div></div>';
}

// ── Remise en banque ────────────────────────────────────────────────
function ouvrirRemiseBanque(){
  var auj=chqAuj();
  var l=chqTous().filter(function(x){return x.c.statut!=="depose";}).sort(function(a,b){ return a.c.encaissement<b.c.encaissement?-1:a.c.encaissement>b.c.encaissement?1:chqNomLic(a.lic).localeCompare(chqNomLic(b.lic)); });
  var sel={}; l.forEach(function(x){ if(x.c.encaissement<=auj) sel[x.lic.code+"|"+x.c.id]=true; });
  var s=gmSheet("Remise en banque");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Cochez les chèques que vous déposez. Le bordereau PDF liste les chèques à joindre au dépôt ; « Marquer comme déposés » ajoute une recette par chèque en comptabilité, à la date du jour.";
  s.body.appendChild(t);
  var resume=document.createElement("div"); resume.style.cssText="position:sticky;top:0;z-index:1;background:var(--bg);padding:6px 0 10px;font-size:14px;font-weight:800;color:var(--txt)";
  s.body.appendChild(resume);
  var list=document.createElement("div"); s.body.appendChild(list);
  function choisis(){ return l.filter(function(x){ return sel[x.lic.code+"|"+x.c.id]; }); }
  function majResume(){ var c=choisis(); resume.textContent=c.length+" chèque"+(c.length>1?"s":"")+" · "+chqEuro(c.reduce(function(a,x){return a+x.c.montant;},0)); }
  var titrePlus=false;
  l.forEach(function(x){
    var k=x.lic.code+"|"+x.c.id;
    if(x.c.encaissement>auj&&!titrePlus){ titrePlus=true; var h=document.createElement("div"); h.style.cssText="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px"; h.textContent="À encaisser plus tard"; list.appendChild(h); }
    var r=document.createElement("label"); r.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rx);padding:10px 12px;margin-bottom:6px;cursor:pointer";
    var cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!sel[k]; cb.style.cssText="width:20px;height:20px;accent-color:var(--dkg);flex-shrink:0";
    cb.addEventListener("change",function(){ sel[k]=cb.checked; majResume(); });
    var g=document.createElement("div"); g.style.cssText="flex:1;min-width:0";
    var n=document.createElement("div"); n.style.cssText="font-size:13px;font-weight:700;color:var(--txt)"; n.textContent=chqNomLic(x.lic)+" · "+chqEuro(x.c.montant);
    var d=document.createElement("div"); d.style.cssText="font-size:11px;color:var(--mut)";
    d.textContent=(x.c.num?"n° "+x.c.num:"n° ?")+(x.c.banque?" · "+x.c.banque:"")+(x.c.emetteur?" · "+x.c.emetteur:"")+" · le "+chqDateFr(x.c.encaissement);
    g.appendChild(n); g.appendChild(d); r.appendChild(cb); r.appendChild(g); list.appendChild(r);
  });
  majResume();
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Bordereau PDF","soft",function(){ var c=choisis(); if(!c.length) return askAlert("Cochez au moins un chèque."); chqBordereau(c); }));
  row.appendChild(gmBtn("Marquer comme déposés","primary",function(b){
    var c=choisis(); if(!c.length) return askAlert("Cochez au moins un chèque.");
    askConfirm(c.length+" chèque"+(c.length>1?"s":"")+" ("+chqEuro(c.reduce(function(a,x){return a+x.c.montant;},0))+") déposé"+(c.length>1?"s":"")+" aujourd'hui ?",{confirmText:"Oui, déposés"}).then(function(ok){
      if(!ok) return;
      chqDeposer(c);
      s.modal.remove(); showToast(c.length+" chèque"+(c.length>1?"s":"")+" déposé"+(c.length>1?"s":"")+", recettes ajoutées en compta");
    });
  }));
}
function chqDeposer(choix){
  var auj=chqAuj(), lics=getLicences(), compta=(typeof getComptabilite==="function")?getComptabilite():null;
  var premium=typeof hasPremium==="function"?hasPremium():true, n=0;
  choix.forEach(function(x){
    var lic=lics.find(function(l){return l.code===x.lic.code;}); if(!lic||!lic.cheques) return;
    var c=lic.cheques.find(function(y){return y.id===x.c.id;}); if(!c||c.statut==="depose") return;
    c.statut="depose"; c.deposeLe=auj; n++;
    if(compta){
      var ref=chqRef(lic.code,c.id), f=lic.fiche||{}, nom=chqNomLic(lic);
      var ligne={date:auj,montant:c.montant,type:"recette",categorie:"Licence",
        motif:"Licence "+nom+(c.num?" · chèque n° "+c.num:" · chèque"),tiers:c.emetteur||f.respNom||nom,moyen:"Chèque",reference:ref};
      var ex=compta.find(function(l){return l.reference===ref;});
      if(ex) Object.assign(ex,ligne); else { if(!premium) ligne.horsPremium=true; ligne.id=Date.now().toString()+"-"+n; compta.push(ligne); }
    }
  });
  saveLicences(lics);
  if(compta) saveComptabilite(compta);
  if(typeof buildLicences==="function") buildLicences();
}
function chqBordereau(choix){
  if(!window.jspdf||!window.jspdf.jsPDF){ askAlert("PDF indisponible pour le moment."); return; }
  var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
  var rgb=(typeof clubPdfRgb==="function")?clubPdfRgb():[26,46,90];
  var club=(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"Club";
  doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(0,0,210,24,"F");
  doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(15); doc.text("Bordereau de remise de chèques",14,11);
  doc.setFont("helvetica","normal"); doc.setFontSize(10); doc.text(club+" · "+new Date().toLocaleDateString("fr-FR"),14,18);
  doc.setTextColor(30,30,30);
  var y=36, cols=[[14,"N° chèque"],[44,"Banque"],[80,"Émetteur"],[130,"Licencié"],[196,"Montant"]];
  doc.setFont("helvetica","bold"); doc.setFontSize(9);
  cols.forEach(function(c){ doc.text(c[1],c[0],y,c[0]===196?{align:"right"}:undefined); });
  doc.setDrawColor(200); doc.line(14,y+2,196,y+2); y+=8;
  doc.setFont("helvetica","normal");
  var total=0;
  choix.forEach(function(x,i){
    if(y>275){ doc.addPage(); y=20; }
    var c=x.c; total+=c.montant;
    function cut(s,w){ s=String(s||""); while(s.length>1&&doc.getTextWidth(s)>w) s=s.slice(0,-1); return s; }
    if(i%2===0){ doc.setFillColor(245,246,248); doc.rect(13,y-4.5,184,6.5,"F"); }
    doc.text(cut(c.num||"—",28),14,y); doc.text(cut(c.banque||"—",34),44,y); doc.text(cut(c.emetteur||"—",48),80,y); doc.text(cut(chqNomLic(x.lic),44),130,y);
    doc.text(chqEuro(c.montant).replace(" €"," EUR"),196,y,{align:"right"});
    y+=7;
  });
  doc.line(14,y-2,196,y-2); y+=4;
  doc.setFont("helvetica","bold"); doc.setFontSize(11);
  doc.text(choix.length+" chèque"+(choix.length>1?"s":""),14,y);
  doc.text("Total : "+chqEuro(total).replace(" €"," EUR"),196,y,{align:"right"});
  y+=16; doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110);
  doc.text("Signature du déposant :",14,y);
  doc.save("bordereau-cheques-"+chqAuj()+".pdf");
}
