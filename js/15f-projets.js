/* ===== 15f-projets.js — Projets du club avec budget prévisionnel (Premium, dans « 📊 Budget ») =====
 *
 * Un projet (stage d'été, achat d'un minibus, tournoi, section féminine…) = ce qu'il coûte (charges)
 * et comment on le finance (subventions avec leur statut, autres financements : sponsor, fonds propres,
 * participation des familles…). On voit tout de suite ce qui est obtenu, ce qui est demandé, ce qui
 * reste à demander et le reste à financer, et on sort le budget prévisionnel du projet en PDF
 * (à joindre à un dossier de subvention).
 *
 * Stockage : `budgetPrev.projets` (même document que le budget prévisionnel, voir getBudgetPrev /
 * saveBudgetPrev dans 15-compta-inventaire.js). Projet : {id, nom, debut, fin, description,
 * charges:[{lib, montant}], subv:[{nom, montant, statut}], autres:[{lib, montant}], creeLe}.
 * Les statuts de subvention sont ceux de BUDGET_SUBV_STATUTS (à demander, demandée, accordée, versée).
 */

// ── Calcul pur (testé dans tests/metier/projets.test.js) ──────────────
function projetsListe(budget){ var l=(budget||{}).projets; return Array.isArray(l)?l:[]; }
function projetNum(v){ var n=parseFloat(String(v==null?"":v).replace(",",".")); return isNaN(n)||n<0?0:Math.round(n*100)/100; }
function projetTotaux(p){
  var t={cout:0,obtenu:0,attente:0,ademander:0,autres:0,finance:0,reste:0,prevu:0};
  ((p&&p.charges)||[]).forEach(function(c){ t.cout+=projetNum(c.montant); });
  ((p&&p.subv)||[]).forEach(function(s){
    var m=projetNum(s.montant);
    if(s.statut==="accordee"||s.statut==="versee") t.obtenu+=m;
    else if(s.statut==="demandee") t.attente+=m;
    else t.ademander+=m;
  });
  ((p&&p.autres)||[]).forEach(function(a){ t.autres+=projetNum(a.montant); });
  // financé = ce qui est acquis (subventions accordées/versées + autres financements)
  t.finance=t.obtenu+t.autres;
  // prévu = toutes les ressources du plan de financement, acquises ou non
  t.prevu=t.finance+t.attente+t.ademander;
  t.reste=Math.max(0,t.cout-t.finance);
  Object.keys(t).forEach(function(k){ t[k]=Math.round(t[k]*100)/100; });
  return t;
}
// Le plan est équilibré quand toutes les ressources prévues couvrent le coût (exigé par les dossiers de subvention).
function projetEquilibre(p){ var t=projetTotaux(p); return Math.abs(t.prevu-t.cout)<0.01; }
function projetNettoyer(p){
  var txt=function(v,n){ return String(v==null?"":v).trim().slice(0,n); };
  var st=(typeof BUDGET_SUBV_STATUTS!=="undefined"?BUDGET_SUBV_STATUTS:[["a_demander"],["demandee"],["accordee"],["versee"]]).map(function(s){return s[0];});
  return {
    id:txt(p.id,40)||("p"+Date.now().toString(36)), nom:txt(p.nom,80), debut:txt(p.debut,10), fin:txt(p.fin,10), description:txt(p.description,600),
    charges:(p.charges||[]).map(function(c){ return {lib:txt(c.lib,80),montant:projetNum(c.montant)}; }).filter(function(c){ return c.lib||c.montant; }),
    subv:(p.subv||[]).map(function(s){ return {nom:txt(s.nom,80),montant:projetNum(s.montant),statut:st.indexOf(s.statut)>=0?s.statut:"a_demander"}; }).filter(function(s){ return s.nom||s.montant; }),
    autres:(p.autres||[]).map(function(a){ return {lib:txt(a.lib,80),montant:projetNum(a.montant)}; }).filter(function(a){ return a.lib||a.montant; }),
    creeLe:p.creeLe||Date.now()
  };
}

// ── Écran ──────────────────────────────────────────────────────────
function projetsEur(n){ return typeof comptaEur==="function"?comptaEur(n):(Math.round(n)+" €"); }
// Bloc affiché en haut du budget prévisionnel.
function projetsBlocHtml(){
  var l=projetsListe(getBudgetPrev());
  var h='<div style="display:flex;align-items:center;justify-content:space-between;margin:4px 0 6px"><div style="font-size:12px;font-weight:800;color:var(--txt)">Projets</div>'+
    '<button type="button" onclick="projetOuvrir()" style="padding:6px 12px;border-radius:20px;border:1.5px dashed var(--bdr);background:none;color:var(--dkg);font-size:11.5px;font-weight:700;cursor:pointer">+ Nouveau projet</button></div>';
  if(!l.length) return h+'<div style="font-size:11px;color:var(--mut);margin-bottom:12px">Un stage, un achat, un tournoi… Indiquez ce qu\'il coûte et comment le financer : subventions à demander, sponsors, fonds propres. Budget du projet en PDF pour vos dossiers.</div>';
  l.forEach(function(p){
    var t=projetTotaux(p), pct=t.cout>0?Math.min(100,Math.round(t.finance/t.cout*100)):0;
    h+='<div role="button" onclick="projetOuvrir(\''+authEsc(p.id)+'\')" style="cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:11px 12px;margin-bottom:8px">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><div style="font-size:13px;font-weight:800;color:var(--txt);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+authEsc(p.nom||"Sans nom")+'</div>'+
      '<div style="font-size:12px;font-weight:700;color:var(--txt);white-space:nowrap">'+projetsEur(t.cout)+'</div></div>'+
      '<div style="height:6px;border-radius:4px;background:var(--bdr);overflow:hidden;margin:7px 0 4px"><div style="height:100%;width:'+pct+'%;background:var(--grn)"></div></div>'+
      '<div style="font-size:10.5px;color:var(--mut)">Financé '+projetsEur(t.finance)+(t.attente?' · en attente '+projetsEur(t.attente):'')+(t.ademander?' · à demander '+projetsEur(t.ademander):'')+(t.reste?' · <b style="color:'+(t.prevu>=t.cout?'var(--mut)':'var(--red)')+'">reste '+projetsEur(t.reste)+'</b>':' · <b style="color:var(--grn)">financé</b>')+'</div></div>';
  });
  return h+'<div style="height:6px"></div>';
}
function projetsRafraichir(){ var z=document.getElementById("budget-projets-zone"); if(z) z.innerHTML=projetsBlocHtml(); }

function projetOuvrir(id){
  var budget=getBudgetPrev(), liste=projetsListe(budget);
  var orig=id?liste.find(function(p){ return p.id===id; }):null;
  var p=JSON.parse(JSON.stringify(orig||{nom:"",debut:"",fin:"",description:"",charges:[{lib:"",montant:""}],subv:[{nom:"",montant:"",statut:"a_demander"}],autres:[]}));
  var s=gmSheet(orig?"Projet":"Nouveau projet");
  var zone=document.createElement("div"); s.body.appendChild(zone);
  var inp="padding:8px 9px;border:1px solid var(--bdr);border-radius:8px;font-size:12.5px;background:var(--card);color:var(--txt);box-sizing:border-box";
  function lire(){
    var q=function(sel){ var e=zone.querySelector(sel); return e?e.value:""; };
    p.nom=q("[data-p=nom]"); p.debut=q("[data-p=debut]"); p.fin=q("[data-p=fin]"); p.description=q("[data-p=description]");
    ["charges","subv","autres"].forEach(function(k){
      p[k]=Array.prototype.map.call(zone.querySelectorAll("[data-l="+k+"]"),function(r){
        var o={montant:r.querySelector("[data-m]").value};
        if(k==="subv"){ o.nom=r.querySelector("[data-n]").value; o.statut=r.querySelector("[data-s]").value; } else o.lib=r.querySelector("[data-n]").value;
        return o;
      });
    });
  }
  function ligne(k,o){
    var nom=k==="subv"?(o.nom||""):(o.lib||""), ph=k==="charges"?"Dépense (ex : location du gymnase)":k==="subv"?"Financeur (ex : ANS, Mairie)":"Financement (ex : sponsor, fonds propres)";
    return '<div data-l="'+k+'" style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap">'+
      '<input data-n'+(k==="subv"?' list="subv-noms"':'')+' value="'+authEsc(nom)+'" placeholder="'+ph+'" style="'+inp+';flex:1 1 '+(k==="subv"?"100px":"150px")+';min-width:0">'+
      '<input data-m type="number" step="1" min="0" value="'+authEsc(String(o.montant==null?"":o.montant))+'" placeholder="€" style="'+inp+';width:'+(k==="subv"?"64px":"82px")+'">'+
      (k==="subv"?'<select data-s style="'+inp+'">'+BUDGET_SUBV_STATUTS.map(function(x){ return '<option value="'+x[0]+'"'+(o.statut===x[0]?' selected':'')+'>'+x[1]+'</option>'; }).join("")+'</select>':'')+
      '<button type="button" data-del aria-label="Supprimer" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;color:var(--mut);flex-shrink:0">✕</button></div>';
  }
  function section(k,titre,aide,plus){
    return '<div style="font-size:12px;font-weight:800;color:var(--txt);margin:14px 0 2px">'+titre+'</div>'+
      '<div style="font-size:10.5px;color:var(--mut);margin-bottom:6px">'+aide+'</div>'+
      (p[k]||[]).map(function(o){ return ligne(k,o); }).join("")+
      '<button type="button" data-add="'+k+'" style="padding:6px 12px;border-radius:20px;border:1.5px dashed var(--bdr);background:none;color:var(--dkg);font-size:11.5px;font-weight:700;cursor:pointer">'+plus+'</button>';
  }
  function dessiner(){
    var t=projetTotaux(p);
    zone.innerHTML=
      '<datalist id="subv-noms"><option value="ANS (Agence nationale du Sport)"><option value="Mairie"><option value="Département"><option value="Région"><option value="Fédération / Comité"><option value="CAF"></datalist>'+
      '<input data-p="nom" value="'+authEsc(p.nom||"")+'" placeholder="Nom du projet" style="'+inp+';width:100%;font-weight:700;font-size:14px;margin-bottom:6px">'+
      '<div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;color:var(--mut)">Du</span><input data-p="debut" type="date" value="'+authEsc(p.debut||"")+'" style="'+inp+';flex:1;min-width:120px">'+
      '<span style="font-size:11px;color:var(--mut)">au</span><input data-p="fin" type="date" value="'+authEsc(p.fin||"")+'" style="'+inp+';flex:1;min-width:120px"></div>'+
      '<textarea data-p="description" rows="2" placeholder="Objectif, public visé (facultatif)" style="'+inp+';width:100%;resize:vertical;font-family:inherit">'+authEsc(p.description||"")+'</textarea>'+
      section("charges","Ce que ça coûte","Toutes les dépenses du projet.","+ Ajouter une dépense")+
      section("subv","Subventions","Accordées ou versées = acquises. Demandées = en attente de réponse.","+ Ajouter une subvention")+
      section("autres","Autres financements","Sponsors, fonds propres du club, participation des familles…","+ Ajouter un financement")+
      '<div style="margin-top:14px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;color:var(--txt);line-height:1.8">'+
        '<div style="display:flex;justify-content:space-between"><span>Coût du projet</span><b>'+projetsEur(t.cout)+'</b></div>'+
        '<div style="display:flex;justify-content:space-between"><span>Acquis</span><b style="color:var(--grn)">'+projetsEur(t.finance)+'</b></div>'+
        (t.attente?'<div style="display:flex;justify-content:space-between"><span>Demandé, en attente</span><b>'+projetsEur(t.attente)+'</b></div>':'')+
        (t.ademander?'<div style="display:flex;justify-content:space-between"><span>À demander</span><b style="color:#E8670A">'+projetsEur(t.ademander)+'</b></div>':'')+
        '<div style="display:flex;justify-content:space-between;border-top:1px solid var(--bdr);margin-top:4px;padding-top:4px"><span>Reste à financer</span><b style="color:'+(t.reste?'var(--red)':'var(--grn)')+'">'+projetsEur(t.reste)+'</b></div>'+
        (t.cout&&!projetEquilibre(p)?'<div style="font-size:10.5px;color:var(--mut);line-height:1.4;margin-top:6px">'+(t.prevu<t.cout?'Il manque '+projetsEur(t.cout-t.prevu)+' de financements prévus pour équilibrer le budget (exigé dans un dossier de subvention).':'Les financements prévus dépassent le coût de '+projetsEur(t.prevu-t.cout)+'.')+'</div>':'')+
      '</div>';
    zone.querySelectorAll("[data-add]").forEach(function(b){ b.addEventListener("click",function(){ lire(); var k=b.getAttribute("data-add"); p[k]=p[k]||[]; p[k].push(k==="subv"?{nom:"",montant:"",statut:"a_demander"}:{lib:"",montant:""}); dessiner(); }); });
    zone.querySelectorAll("[data-del]").forEach(function(b){ b.addEventListener("click",function(){
      var r=b.parentNode, k=r.getAttribute("data-l"), i=Array.prototype.indexOf.call(zone.querySelectorAll("[data-l="+k+"]"),r);
      lire(); p[k].splice(i,1); dessiner();
    }); });
    zone.querySelectorAll("[data-m],[data-s]").forEach(function(e){ e.addEventListener("change",function(){ lire(); dessiner(); }); });
  }
  dessiner();
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(){
    lire();
    if(!String(p.nom||"").trim()){ askAlert("Donnez un nom au projet."); return; }
    if(p.debut&&p.fin&&p.fin<p.debut){ askAlert("La date de fin doit être après la date de début."); return; }
    var propre=projetNettoyer(Object.assign({},p,{id:orig?orig.id:""}));
    var b=getBudgetPrev(), l=projetsListe(b).slice(), i=l.findIndex(function(x){ return x.id===propre.id; });
    if(i>=0) l[i]=propre; else l.push(propre);
    b.projets=l; saveBudgetPrev(b);
    s.modal.remove(); projetsRafraichir(); showToast("Projet enregistré");
  }));
  row.appendChild(gmBtn("📄 Budget PDF","soft",function(){ lire(); projetPdf(projetNettoyer(p)); }));
  if(orig) row.appendChild(gmBtn("Supprimer","danger",function(){
    askConfirm("Supprimer le projet « "+(orig.nom||"")+" » ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
      if(!ok) return;
      var b=getBudgetPrev(); b.projets=projetsListe(b).filter(function(x){ return x.id!==orig.id; }); saveBudgetPrev(b);
      s.modal.remove(); projetsRafraichir(); showToast("Projet supprimé");
    });
  }));
}

// ── PDF : budget prévisionnel du projet (charges / produits) ──────────
function projetPdf(p){
  if(!window.jspdf){ askAlert("Le générateur de PDF n'est pas chargé. Réessayez dans un instant."); return; }
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), tint=(typeof clubPdfTint==="function")?clubPdfTint(0.92):[240,240,240], t=projetTotaux(p), y=18;
  function eur(n){ return (typeof comptaEur==="function"?comptaEur(n):String(n)+" €").replace(/[  ]/g," ").replace("€","EUR"); }
  function dfr(d){ var x=String(d||"").split("-"); return x.length===3?x[2]+"/"+x[1]+"/"+x[0]:""; }
  var statuts={}; (typeof BUDGET_SUBV_STATUTS!=="undefined"?BUDGET_SUBV_STATUTS:[]).forEach(function(s){ statuts[s[0]]=s[1]; });
  doc.setFontSize(10); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb); doc.text(clubTitle()||"",14,y); y+=8;
  doc.setFontSize(15); doc.setTextColor(30,30,30); doc.text("Budget prévisionnel du projet",14,y); y+=7;
  doc.setFontSize(12); doc.text(doc.splitTextToSize(p.nom||"",182),14,y); y+=6;
  doc.setFont(undefined,"normal"); doc.setFontSize(9); doc.setTextColor(90,90,90);
  var dates=p.debut?(p.fin&&p.fin!==p.debut?"Du "+dfr(p.debut)+" au "+dfr(p.fin):"Le "+dfr(p.debut)):"";
  doc.text((dates?dates+" · ":"")+"Document établi le "+new Date().toLocaleDateString("fr-FR"),14,y); y+=6;
  if(p.description){ var dl=doc.splitTextToSize(p.description,182); doc.setTextColor(50,50,50); doc.text(dl,14,y); y+=dl.length*4.5+2; }
  y+=3;
  // Deux colonnes : charges à gauche, produits à droite
  var gx=12, dx=107, w=91;
  function entete(x,txt){ doc.setFillColor.apply(doc,rgb); doc.rect(x,y-4.5,w,7,"F"); doc.setTextColor(255,255,255); doc.setFont(undefined,"bold"); doc.setFontSize(9); doc.text(txt,x+2,y); doc.text("Montant",x+w-2,y,{align:"right"}); doc.setFont(undefined,"normal"); }
  entete(gx,"CHARGES"); entete(dx,"PRODUITS"); y+=7;
  var gauche=p.charges.map(function(c){ return [c.lib||"",c.montant]; });
  var droite=p.subv.map(function(s){ return ["Subvention "+(s.nom||"")+" ("+(statuts[s.statut]||"").toLowerCase()+")",s.montant]; })
    .concat(p.autres.map(function(a){ return [a.lib||"",a.montant]; }));
  if(t.prevu<t.cout) droite.push(["Reste à financer",Math.round((t.cout-t.prevu)*100)/100]);
  var n=Math.max(gauche.length,droite.length,1);
  doc.setFontSize(8.5);
  for(var i=0;i<n;i++){
    if(y>275){ doc.addPage(); y=20; }
    if(i%2===1){ doc.setFillColor.apply(doc,tint); doc.rect(gx,y-4.3,w,6.2,"F"); doc.rect(dx,y-4.3,w,6.2,"F"); }
    doc.setTextColor(40,40,40);
    [[gx,gauche[i]],[dx,droite[i]]].forEach(function(c){
      if(!c[1]) return;
      var lib=doc.splitTextToSize(String(c[1][0]),w-30)[0];
      doc.text(lib,c[0]+2,y); doc.text(eur(c[1][1]),c[0]+w-2,y,{align:"right"});
    });
    y+=6.2;
  }
  var totalProduits=Math.max(t.prevu,t.cout);
  doc.setDrawColor.apply(doc,rgb); doc.setLineWidth(0.4); doc.line(gx,y-3.5,gx+w,y-3.5); doc.line(dx,y-3.5,dx+w,y-3.5);
  doc.setFont(undefined,"bold"); doc.setFontSize(9.5);
  doc.text("Total des charges",gx+2,y+1); doc.text(eur(t.cout),gx+w-2,y+1,{align:"right"});
  doc.text("Total des produits",dx+2,y+1); doc.text(eur(totalProduits),dx+w-2,y+1,{align:"right"});
  y+=12;
  doc.setFont(undefined,"normal"); doc.setFontSize(9); doc.setTextColor(60,60,60);
  [["Financements acquis",t.finance],["Subventions demandées, en attente",t.attente],["Subventions à demander",t.ademander],["Reste à financer (hors acquis)",t.reste]].forEach(function(r){
    if(y>280){ doc.addPage(); y=20; }
    doc.text(r[0],14,y); doc.text(eur(r[1]),98,y,{align:"right"}); y+=5.5;
  });
  y+=6; doc.setFontSize(8); doc.setTextColor(120,120,120);
  doc.text("Budget prévisionnel établi par "+(clubTitle()||"le club")+". Montants en euros.",14,Math.min(y,288));
  var nomFic=("budget-projet-"+String(p.nom||"projet").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")).slice(0,60);
  doc.save(nomFic+".pdf");
}
