/* ===== 14b-billetterie.js — Événements à inscription : stage/camp, tournoi, soirée ===== */
// Le staff ouvre les inscriptions d'un événement (tarifs licencié / extérieur,
// modes de paiement, places, date limite). Une page publique evt_pages/{clubId__eventId}
// (globale, lisible par son lien) permet aux extérieurs de s'inscrire SANS compte :
// ils n'entrent jamais dans l'appli. Les parents inscrivent leur enfant depuis
// l'appli (relié à sa fiche joueur). Chaque inscription = un billet
// clubs/{id}/evt_inscrits/{CODE} (STG-12345, TRN-…, SOI-…), avec QR code.
// Le compteur nb de la page monte dans la même écriture (règles : jamais au-delà des places).
// Paiement : espèces, chèque, CB sur place ou lien HelloAsso. Jamais bloquant ;
// « Paiement reçu » ajoute la recette en comptabilité (comme les licences).

var EVT_URL_BASE="https://generalmanagerapp.fr/?evt=";
var EVT_PREFIX={stage:"STG",tournoi:"TRN",soiree:"SOI"};
var EVT_TYPES_INSCR=["stage","tournoi","soiree"];
var EVT_MODES={especes:"Espèces",cheque:"Chèque",cb:"CB sur place",helloasso:"HelloAsso"};
var EVT_MODES_COMPTA={especes:"Espèces",cheque:"Chèque",cb:"CB",helloasso:"CB"};

function evtPageId(eid){ return (window.CURRENT_CLUB_ID||"")+"__"+eid; }
function evtLien(eid){ return EVT_URL_BASE+encodeURIComponent(evtPageId(eid)); }
function evtCode(type){
  var n=""; for(var i=0;i<5;i++) n+=Math.floor(Math.random()*10);
  return (EVT_PREFIX[type]||"EVT")+"-"+n;
}
function evtPrix(p){ p=Number(p)||0; return (Math.round(p*100)/100).toString().replace(".",",")+" €"; }
function evtTarifTxt(p){ return Number(p)>0?evtPrix(p):"Gratuit"; }
function evtDateTxt(e){
  function f(iso){ var d=new Date(iso+"T12:00:00"); return isNaN(d)?(iso||""):d.toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"long"}); }
  if(!e||!e.date) return "";
  return f(e.date)+(e.dateFin&&e.dateFin!==e.date?" → "+f(e.dateFin):"")+(e.heure?" · "+e.heure:"");
}
// ── Jours au choix (stage sur plusieurs jours) ──────────────────────
// Quand « les familles choisissent leurs jours » est activé, le tarif est « par jour »
// (forfait facultatif pour tous les jours) et chaque billet porte la liste de ses jours.
function evtJoursPlage(date, fin){
  if(!date) return [];
  var d=new Date(date+"T12:00:00"); if(isNaN(d)) return [];
  var f=new Date(((fin&&fin>date)?fin:date)+"T12:00:00"), out=[];
  for(var i=0;i<14&&d<=f;i++){ out.push(d.toISOString().slice(0,10)); d.setDate(d.getDate()+1); }
  return out;
}
function evtJourTxt(iso, long){
  var d=new Date(iso+"T12:00:00");
  return isNaN(d)?String(iso||""):d.toLocaleDateString("fr-FR",long?{weekday:"long",day:"numeric",month:"long"}:{weekday:"short",day:"numeric",month:"short"});
}
function evtMontant(t, jours, total){
  var n=(jours||[]).length; if(!n||!t) return 0;
  var pj=Number(t.prix)||0, fo=Number(t.forfait)||0;
  return Math.round(((fo>0&&n===total)?fo:pj*n)*100)/100;
}
function evtJoursTxt(jours, total){
  if(!jours||!jours.length) return "";
  if(total&&jours.length===total&&total>1) return "Tous les jours";
  return jours.map(function(j){ return evtJourTxt(j); }).join(", ");
}
function evtTotalTxt(t, sel, total){
  var m=evtMontant(t,sel,total), n=sel.length;
  if(!n) return "Choisissez au moins un jour";
  if(!(m>0)) return "Gratuit · "+n+" jour"+(n>1?"s":"");
  var fo=Number(t.forfait)||0;
  return (fo>0&&n===total?"Forfait tous les jours : ":"Total : ")+evtPrix(m)+(fo>0&&n===total?"":" · "+n+" jour"+(n>1?"s":""));
}
// Cases à cocher des jours (page publique et appli) ; un jour complet est grisé.
function evtSelecteurJours(host, page, sel, onChange){
  var jours=page.jours||[], nbJ=page.nbJ||{}, places=page.places||0;
  function plein(j){ return places>0&&(nbJ[j]||0)>=places; }
  function peindre(){
    host.innerHTML="";
    var libres=jours.filter(function(j){return !plein(j);});
    var tous=libres.length>1&&libres.every(function(j){return sel.indexOf(j)>=0;});
    if(libres.length>1){
      var bt=document.createElement("button"); bt.type="button";
      bt.style.cssText="margin-bottom:8px;padding:8px 14px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid var(--dkg);background:"+(tous?"var(--dkg)":"var(--card)")+";color:"+(tous?"#fff":"var(--dkg)");
      bt.textContent=tous?"✓ Tous les jours":"Tous les jours";
      bt.addEventListener("click",function(){ sel.length=0; if(!tous) libres.forEach(function(j){ sel.push(j); }); peindre(); onChange(); });
      host.appendChild(bt);
    }
    jours.forEach(function(j){
      var on=sel.indexOf(j)>=0, full=plein(j);
      var b=document.createElement("button"); b.type="button"; b.disabled=full;
      b.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;text-align:left;padding:11px 14px;margin-bottom:6px;border-radius:var(--rs);cursor:"+(full?"not-allowed":"pointer")+";border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--dkg) 8%, var(--card))":"var(--card)")+";color:var(--txt);opacity:"+(full?".45":"1");
      var a=document.createElement("span"); a.style.cssText="font-size:14px;font-weight:800;text-transform:capitalize"; a.textContent=(on?"✓ ":"")+evtJourTxt(j,true);
      var c=document.createElement("span"); c.style.cssText="font-size:11px;font-weight:700;color:"+(full?"var(--red)":"var(--mut)");
      c.textContent=full?"Complet":(places>0?Math.max(0,places-(nbJ[j]||0))+" place"+(places-(nbJ[j]||0)>1?"s":""):"");
      b.appendChild(a); b.appendChild(c);
      b.addEventListener("click",function(){ var k=sel.indexOf(j); if(k>=0) sel.splice(k,1); else sel.push(j); sel.sort(); peindre(); onChange(); });
      host.appendChild(b);
    });
  }
  peindre();
}
function evtPlacesTxt(places, nb){
  if(!places) return "";
  var r=Math.max(0,places-(nb||0));
  if(r===0) return "Complet";
  return r===1?"Dernière place !":r+" places restantes";
}
function evtOuvertes(e){
  var i=e&&e.inscr; if(!i||!i.actif) return false;
  var auj=new Date().toISOString().slice(0,10);
  if(i.limite && i.limite<auj) return false;
  return (e.dateFin||e.date||auj)>=auj;
}
function evtNorm(s){ return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z]/g,""); }
function evtPeutCompta(){
  var dir=((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0;
  var ok=dir||(typeof hasModulePermission==="function"&&hasModulePermission("comptabilite"));
  return ok && typeof FS_PREV!=="undefined" && !!FS_PREV.comptabilite;
}

// ── Bouton sur la carte d'événement (staff) ─────────────────────────
function evtBoutonCarte(e){
  if(EVT_TYPES_INSCR.indexOf(e.type)<0) return "";
  if(typeof isStaffUser==="function"&&!isStaffUser()) return "";
  var on=e.inscr&&e.inscr.actif;
  return "<button onclick=\"evtTableau('"+authEsc(e.id)+"')\" style=\"margin-top:8px;margin-right:6px;padding:6px 12px;border-radius:20px;background:"+(on?"var(--dkg)":"color-mix(in srgb, var(--dkg) 10%, transparent)")+";color:"+(on?"#fff":"var(--dkg)")+";font-size:10px;font-weight:700;border:none;cursor:pointer\">"+(on?"Inscriptions":"Ouvrir les inscriptions")+"</button>";
}

// ── Réglages des inscriptions (staff) ───────────────────────────────
function evtConfigurer(eid){
  var events=getEvents();
  var e=events.find(function(x){return x.id===eid;}); if(!e) return;
  var i=e.inscr||{};
  var tarifs=(i.tarifs&&i.tarifs.length)?i.tarifs.map(function(t){return Object.assign({gratuit:!(Number(t.prix)>0)},t);})
    :[{nom:"Licencié du club",prix:"",pour:"lic"},{nom:"Extérieur",prix:"",pour:"ext"}];
  var modes=i.modes||["especes","cheque","cb"];
  var s=gmSheet("Inscriptions · "+(e.titre||eventTypeLabel(e.type)));
  var intro=document.createElement("div");
  intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:6px";
  intro.textContent="Les familles du club inscrivent leur enfant depuis l'appli. Les extérieurs passent par un lien ou une affiche, sans créer de compte. Chaque inscrit reçoit un billet avec QR code.";
  s.body.appendChild(intro);
  var lab=document.createElement("label");
  lab.style.cssText="display:flex;align-items:center;gap:10px;padding:12px 0;font-size:14px;font-weight:700;color:var(--txt);cursor:pointer";
  var cbA=document.createElement("input"); cbA.type="checkbox"; cbA.checked=i.actif!==false;
  cbA.style.cssText="width:20px;height:20px;accent-color:var(--dkg)";
  lab.appendChild(cbA); lab.appendChild(document.createTextNode("Inscriptions ouvertes"));
  s.body.appendChild(lab);

  var jr=evtJoursPlage(e.date,e.dateFin), parJour=!!(i.parJour&&jr.length>1);
  var lj=document.createElement("label");
  lj.style.cssText="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;margin-bottom:6px;border:1px solid var(--bdr);border-radius:var(--rs);background:var(--card);cursor:"+(jr.length>1?"pointer":"default")+(jr.length>1?"":";opacity:.7");
  var cbJ=document.createElement("input"); cbJ.type="checkbox"; cbJ.checked=parJour; cbJ.disabled=jr.length<2; cbJ.style.cssText="width:20px;height:20px;accent-color:var(--dkg);flex-shrink:0;margin-top:1px";
  var tj=document.createElement("div");
  tj.innerHTML='<div style="font-size:14px;font-weight:800;color:var(--txt)">Les familles choisissent leurs jours</div>'+
    '<div style="font-size:12px;color:var(--mut);line-height:1.4;margin-top:2px">'+(jr.length>1
      ? authEsc("Du "+evtJourTxt(jr[0])+" au "+evtJourTxt(jr[jr.length-1])+" ("+jr.length+" jours) : chacun coche les jours qui l'intéressent, ou prend tous les jours. Le tarif devient « par jour », avec un forfait facultatif pour tous les jours.")
      : "Pour proposer plusieurs jours, mettez une date de fin à l'événement (« du … au … »), puis revenez ici.")+'</div>';
  lj.appendChild(cbJ); lj.appendChild(tj); s.body.appendChild(lj);
  cbJ.addEventListener("change",function(){ parJour=cbJ.checked; peindreTarifs(); iP.placeholder=parJour?"Places par jour (vide = illimité)":"Places (vide = illimité)"; });
  gmSection(s.body,"Tarifs","Prix différents pour les licenciés du club et les extérieurs, ou « Gratuit ». Avec le choix des jours, le prix est par jour.");
  var tBox=document.createElement("div"); s.body.appendChild(tBox);
  function peindreTarifs(){
    tBox.innerHTML="";
    tarifs.forEach(function(t,idx){
      var r=document.createElement("div"); r.style.cssText="display:flex;gap:6px;margin-bottom:6px;align-items:center";
      var n=document.createElement("input"); n.className="form-input"; n.maxLength=40; n.value=t.nom||""; n.placeholder="Nom du tarif"; n.style.flex="2";
      n.addEventListener("input",function(){ t.nom=n.value; });
      var p=document.createElement("input"); p.className="form-input"; p.type="number"; p.min="0"; p.step="0.5"; p.value=t.gratuit?"":t.prix; p.placeholder=t.gratuit?"0":(parJour?"€ / jour":"€"); p.disabled=!!t.gratuit; p.style.cssText="flex:1;min-width:64px";
      p.addEventListener("input",function(){ t.prix=p.value; });
      var gr=document.createElement("button"); gr.type="button"; gr.textContent="Gratuit"; gr.setAttribute("aria-pressed",t.gratuit?"true":"false");
      gr.style.cssText="flex-shrink:0;padding:8px 10px;border-radius:20px;font-size:11px;font-weight:800;cursor:pointer;border:1.5px solid "+(t.gratuit?"var(--grn)":"var(--bdr)")+";background:"+(t.gratuit?"var(--grn)":"var(--card)")+";color:"+(t.gratuit?"#fff":"var(--mut)");
      gr.addEventListener("click",function(){ t.gratuit=!t.gratuit; if(t.gratuit) t.prix=0; peindreTarifs(); majModes(); });
      var w=document.createElement("select"); w.className="form-select"; w.style.cssText="flex:1.3;min-width:90px";
      [["lic","Licenciés"],["ext","Extérieurs"],["tous","Tous"]].forEach(function(o){ var op=document.createElement("option"); op.value=o[0]; op.textContent=o[1]; if((t.pour||"tous")===o[0]) op.selected=true; w.appendChild(op); });
      w.addEventListener("change",function(){ t.pour=w.value; });
      r.appendChild(n); r.appendChild(p); r.appendChild(gr); r.appendChild(w);
      if(parJour&&!t.gratuit){
        var fo=document.createElement("input"); fo.className="form-input"; fo.type="number"; fo.min="0"; fo.step="0.5"; fo.value=t.forfait||""; fo.placeholder="Forfait tous les jours (facultatif)"; fo.setAttribute("aria-label","Forfait tous les jours");
        fo.style.cssText="flex:1 1 100%;order:9";
        fo.addEventListener("input",function(){ t.forfait=fo.value; });
        r.style.flexWrap="wrap"; r.appendChild(fo);
      }
      if(tarifs.length>1){
        var x=document.createElement("button"); x.type="button"; x.textContent="✕"; x.setAttribute("aria-label","Retirer ce tarif");
        x.style.cssText="border:none;background:none;color:var(--red);font-size:14px;cursor:pointer;padding:6px";
        x.addEventListener("click",function(){ tarifs.splice(idx,1); peindreTarifs(); });
        r.appendChild(x);
      }
      tBox.appendChild(r);
    });
    if(tarifs.length<6){
      var add=document.createElement("button"); add.type="button"; add.textContent="+ Ajouter un tarif";
      add.style.cssText="border:none;background:none;color:var(--dkg);font-size:12px;font-weight:700;cursor:pointer;padding:4px 0";
      add.addEventListener("click",function(){ tarifs.push({nom:"",prix:"",pour:"tous"}); peindreTarifs(); majModes(); });
      tBox.appendChild(add);
    }
  }
  function majModes(){}
  peindreTarifs();

  var paySec=document.createElement("div"); s.body.appendChild(paySec);
  gmSection(paySec,"Paiement","Le paiement ne bloque jamais l'inscription : vous le marquez reçu ensuite.");
  var mBox=document.createElement("div"); mBox.style.cssText="display:flex;flex-wrap:wrap;gap:8px";
  var mCbs={};
  Object.keys(EVT_MODES).forEach(function(k){
    var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--txt);padding:6px 10px;border:1px solid var(--bdr);border-radius:20px;cursor:pointer";
    var c=document.createElement("input"); c.type="checkbox"; c.checked=modes.indexOf(k)>=0; c.style.accentColor="var(--dkg)";
    l.appendChild(c); l.appendChild(document.createTextNode(EVT_MODES[k])); mBox.appendChild(l); mCbs[k]=c;
  });
  paySec.appendChild(mBox);
  var ha=document.createElement("input"); ha.className="form-input"; ha.type="url"; ha.maxLength=300;
  ha.placeholder="Lien HelloAsso (https://www.helloasso.com/…)"; ha.value=i.helloasso||""; ha.style.marginTop="8px";
  paySec.appendChild(ha);
  majModes=function(){ paySec.style.display=tarifs.every(function(t){return t.gratuit;})?"none":"block"; };
  majModes();
  function majHa(){ ha.style.display=mCbs.helloasso.checked?"block":"none"; }
  mCbs.helloasso.addEventListener("change",majHa); majHa();

  gmSection(s.body,"Places et date limite");
  var pl=document.createElement("div"); pl.style.cssText="display:flex;gap:8px";
  var iP=document.createElement("input"); iP.className="form-input"; iP.type="number"; iP.min="0"; iP.max="5000"; iP.placeholder=parJour?"Places par jour (vide = illimité)":"Places (vide = illimité)"; iP.value=i.places||""; iP.style.flex="1";
  var iL=document.createElement("input"); iL.className="form-input"; iL.type="date"; iL.value=i.limite||""; iL.style.flex="1"; iL.setAttribute("aria-label","Date limite d'inscription");
  pl.appendChild(iP); pl.appendChild(iL); s.body.appendChild(pl);

  gmSection(s.body,"Programme (facultatif)","Affiché sur la page d'inscription.");
  var prog=document.createElement("textarea"); prog.className="form-input"; prog.rows=3; prog.maxLength=600;
  prog.placeholder="Ex : 9h-17h, repas du midi compris, prévoir gourde et baskets propres";
  prog.value=i.programme||""; s.body.appendChild(prog);

  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(b){
    var tf=tarifs.filter(function(t){return String(t.nom||"").trim();}).map(function(t){
      return {nom:String(t.nom).trim().slice(0,40), prix:t.gratuit?0:Math.max(0,Math.round((parseFloat(String(t.prix).replace(",","."))||0)*100)/100), pour:t.pour||"tous"};
    });
    tf.forEach(function(t,k){ var fo=parJour?Math.max(0,Math.round((parseFloat(String(tarifs.filter(function(x){return String(x.nom||"").trim();})[k].forfait).replace(",","."))||0)*100)/100):0; if(fo>0&&t.prix>0) t.forfait=fo; });
    if(!tf.length){ askAlert("Ajoutez au moins un tarif."); return; }
    var toutGratuit=tf.every(function(t){return !(t.prix>0);});
    var md=toutGratuit?[]:Object.keys(mCbs).filter(function(k){return mCbs[k].checked;});
    if(!toutGratuit && !md.length){ askAlert("Choisissez au moins un mode de paiement."); return; }
    var lienHa=ha.value.trim();
    if(!toutGratuit && md.indexOf("helloasso")>=0 && !/^https:\/\/([a-z0-9-]+\.)*helloasso\.com\//i.test(lienHa)){ askAlert("Collez le lien HelloAsso de l'événement (il commence par https://www.helloasso.com/)."); return; }
    var inscr={
      actif:cbA.checked, tarifs:tf, modes:md, helloasso:md.indexOf("helloasso")>=0?lienHa.slice(0,300):"",
      parJour:parJour, places:Math.max(0,parseInt(iP.value,10)||0), limite:iL.value||"", programme:prog.value.trim().slice(0,600), majLe:Date.now()
    };
    b.disabled=true;
    evtPublierPage(e, inscr).then(function(){
      var evs=getEvents(); var k=evs.findIndex(function(x){return x.id===eid;});
      if(k>=0){ evs[k].inscr=inscr; saveEvents(evs); }
      s.modal.remove();
      if(typeof buildRealEventsList==="function") buildRealEventsList();
      evtTableau(eid);
    }).catch(function(err){ b.disabled=false; askAlert("Erreur : "+((err&&err.code)||err)); });
  }));
}
// Publie (ou met à jour) la page publique. nb n'est posé qu'à la création.
function evtPublierPage(e, inscr){
  var c=window.CURRENT_CLUB||{};
  var ref=window.fbDoc(window.fbDb,"evt_pages",evtPageId(e.id));
  var page={
    clubId:window.CURRENT_CLUB_ID, eventId:String(e.id), actif:!!inscr.actif, type:e.type||"",
    titre:String(e.titre||"").slice(0,100), date:e.date||"", dateFin:e.dateFin||"", heure:e.heure||"", lieu:String(e.lieu||"").slice(0,120),
    tarifs:inscr.tarifs, parJour:!!inscr.parJour, jours:inscr.parJour?evtJoursPlage(e.date,e.dateFin):[], modes:inscr.modes, helloasso:inscr.helloasso||"", places:inscr.places||0, limite:inscr.limite||"",
    programme:inscr.programme||"", nom:c.name||"", logo:c.logo||null, couleur:c.couleur||null, couleur2:c.couleur2||null,
    liens:c.liens||{}, majLe:Date.now()
  };
  return window.fbGetDoc(ref).then(function(snap){
    if(!snap.exists()){ page.nb=0; page.nbJ={}; }
    return window.fbSetDoc(ref,page,{merge:true});
  });
}

// ── Tableau de suivi (staff) ────────────────────────────────────────
function evtTableau(eid){
  var e=getEvents().find(function(x){return x.id===eid;}); if(!e) return;
  if(!e.inscr){ evtConfigurer(eid); return; }
  var s=gmSheet((e.titre||eventTypeLabel(e.type)));
  var head=document.createElement("div"); s.body.appendChild(head);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Entrée","primary",function(){ s.modal.remove(); evtEntree(eid); }));
  row.appendChild(gmBtn("Lien et QR code","soft",function(){ evtPartager(e); }));
  row.appendChild(gmBtn("Affiche","soft",function(){ s.modal.remove(); evtAffiche(eid); }));
  row.appendChild(gmBtn("Code bénévole","soft",function(){ evtCodesBenevoles(eid); }));
  row.appendChild(gmBtn("Réglages","soft",function(){ s.modal.remove(); evtConfigurer(eid); }));
  var list=document.createElement("div"); list.style.marginTop="12px";
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Chargement…</div>';
  s.body.appendChild(list);
  var pageRef=window.fbDoc(window.fbDb,"evt_pages",evtPageId(eid));
  Promise.all([
    window.fbGetDoc(pageRef),
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_inscrits"),window.fbWhere("eventId","==",String(eid))))
  ]).then(function(r){
    var page=r[0].exists()?r[0].data():{nb:0};
    var items=[]; r[1].forEach(function(d){ var v=d.data(); v._id=d.id; items.push(v); });
    items.sort(function(a,b){ return ((a.at&&a.at.toMillis)?a.at.toMillis():0)-((b.at&&b.at.toMillis)?b.at.toMillis():0); });
    evtRapprocher(items);
    if(typeof entreeReporter==="function") entreeReporter(eid, items.filter(function(x){return x.statut!=="annule";})).then(function(){ peindre(); });
    function peindre(){
      var actifs=items.filter(function(x){return x.statut!=="annule";});
      var encaisse=0, attendu=0;
      actifs.forEach(function(x){ attendu+=Number(x.montant)||0; if(x.paye) encaisse+=Number(x.montant)||0; });
      var parJ=!!e.inscr.parJour, places=parJ?0:(e.inscr.places||0);
      var cptJ={}; if(parJ) actifs.forEach(function(x){ (x.jours||[]).forEach(function(j){ cptJ[j]=(cptJ[j]||0)+1; }); });
      var jTxt=parJ?(page.jours||evtJoursPlage(e.date,e.dateFin)).map(function(j){ return evtJourTxt(j)+" : "+(cptJ[j]||0)+(e.inscr.places?" / "+e.inscr.places:""); }).join(" · "):"";
      if(parJ&&!peindre.sync){ peindre.sync=1; var vieux=page.nbJ||{}, diff=false; (page.jours||[]).forEach(function(j){ if((vieux[j]||0)!==(cptJ[j]||0)) diff=true; });
        if(diff){ var nn={}; (page.jours||[]).forEach(function(j){ nn[j]=cptJ[j]||0; }); page.nbJ=nn; window.fbUpdateDoc(pageRef,{nbJ:nn}).catch(function(){}); } }
      head.innerHTML=
        '<div style="display:flex;gap:8px;margin-bottom:10px">'+
          evtStat(actifs.length+(places?" / "+places:""),"inscrit"+(actifs.length>1?"s":""))+
          evtStat(evtPrix(encaisse),"encaissé"+(attendu>encaisse?" sur "+evtPrix(attendu):""))+
          evtStat(actifs.filter(function(x){return x.present;}).length,"présent"+(actifs.filter(function(x){return x.present;}).length>1?"s":""))+
        '</div>'+
        '<div style="font-size:12px;color:var(--mut);margin-bottom:4px">'+authEsc(evtDateTxt(e))+(e.lieu?" · "+authEsc(e.lieu):"")+
          (e.inscr.actif?(places?" · "+authEsc(evtPlacesTxt(places,page.nb)):""):' · <b style="color:var(--red)">Inscriptions fermées</b>')+'</div>'+
        (jTxt?'<div style="font-size:12px;color:var(--txt2);font-weight:700;margin-bottom:4px">'+authEsc(jTxt)+'</div>':'')+
        ((places&&e.inscr.actif&&places-(page.nb||0)<=5&&typeof afAlerteTxt==="function")?
          '<button onclick="document.querySelectorAll(\'.gm-sheet\').forEach(function(m){m.remove();});evtAffiche(\''+authEsc(eid)+'\')" style="margin-top:8px;width:100%;text-align:left;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:12px;padding:10px 12px;font-size:12px;font-weight:700;cursor:pointer">'+authEsc(afAlerteTxt(Math.max(0,places-(page.nb||0))))+' : republier l\'affiche à jour →</button>':'');
      evtListe(list, items, e, page, peindre);
    }
    peindre();
  }).catch(function(err){ list.innerHTML='<div style="color:var(--red);padding:16px;text-align:center">Erreur : '+authEsc((err&&err.code)||String(err))+'</div>'; });
}
function evtStat(v,l){
  return '<div style="flex:1;background:var(--bg);border-radius:var(--rs);padding:10px;text-align:center"><div style="font-size:16px;font-weight:900;color:var(--txt)">'+authEsc(String(v))+'</div><div style="font-size:10px;color:var(--mut);font-weight:700;text-transform:uppercase;letter-spacing:.4px">'+authEsc(l)+'</div></div>';
}
// Un « licencié » inscrit depuis le lien public est rapproché des joueurs du club
// (nom + prénom + date de naissance). Sinon il reste « À vérifier ».
function evtRapprocher(items){
  var players=(typeof getPlayers==="function")?getPlayers():[];
  if(!players.length) return;
  items.forEach(function(x){
    if(x.playerId||x.statut==="annule") return;
    var m=players.filter(function(p){ return evtNorm(p.nom)===evtNorm(x.nom)&&evtNorm(p.prenom)===evtNorm(x.prenom)&&(!p.naissance||p.naissance===x.naissance); });
    if(m.length===1){
      x.playerId=String(m[0].id);
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",x._id),{playerId:x.playerId}).catch(function(){});
    }
  });
}
function evtEstLicTarif(x, page){
  var t=page&&page.tarifs&&page.tarifs[x.tarifIdx];
  return !!(t&&t.pour==="lic");
}
function evtListe(list, items, e, page, repeindre){
  list.innerHTML="";
  if(!items.length){ list.innerHTML='<div style="color:var(--mut);padding:20px;text-align:center;font-size:13px">Pas encore d\'inscrit. Partagez le lien ou l\'affiche.</div>'; return; }
  items.forEach(function(x){
    var card=gmCard();
    if(x.statut==="annule") card.style.opacity=".5";
    var h=document.createElement("div"); h.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;gap:8px";
    var g=document.createElement("div"); g.style.minWidth="0";
    var n=document.createElement("div"); n.style.cssText="font-size:14px;font-weight:800;color:var(--txt)";
    n.textContent=(x.prenom||"")+" "+(x.nom||"")+(typeof essaiAge==="function"&&essaiAge(x.naissance)?" · "+essaiAge(x.naissance):"");
    var d=document.createElement("div"); d.style.cssText="font-size:12px;color:var(--txt2);margin-top:2px";
    d.textContent=(x.tarifNom||"")+" · "+evtTarifTxt(x.montant)+(EVT_MODES[x.mode]?" · "+EVT_MODES[x.mode]:"")+(x.clubOrigine?" · "+x.clubOrigine:"");
    if(x.jours&&x.jours.length){ var dj=document.createElement("div"); dj.style.cssText="font-size:12px;color:var(--dkg);font-weight:700;margin-top:2px"; dj.textContent="📅 "+evtJoursTxt(x.jours,(page.jours||[]).length); g.appendChild(dj); }
    var c=document.createElement("div"); c.style.cssText="font-size:11px;color:var(--mut);margin-top:2px;font-family:monospace";
    c.textContent=x._id+(x.tel?" · "+x.tel:"");
    g.insertBefore(n,g.firstChild); g.insertBefore(d,n.nextSibling); g.appendChild(c);
    var pills=document.createElement("div"); pills.style.cssText="display:flex;flex-direction:column;gap:4px;align-items:flex-end;flex-shrink:0";
    function pill(t,bg,fg){ var p=document.createElement("span"); p.style.cssText="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;white-space:nowrap;background:"+bg+";color:"+(fg||"#fff"); p.textContent=t; pills.appendChild(p); }
    if(x.statut==="annule") pill("Annulé","var(--bdr)","var(--mut)");
    else {
      if(x.playerId) pill("Licencié ✓","var(--ltg)");
      else if(evtEstLicTarif(x,page)) pill("À vérifier","#E8670A");
      else pill("Extérieur","var(--bdr)","var(--txt2)");
      if(Number(x.montant)>0) pill(x.paye?"Payé":"À payer",x.paye?"var(--grn)":"rgba(192,57,43,.12)",x.paye?"#fff":"var(--red)");
      else pill("Gratuit","var(--bdr)","var(--txt2)");
    }
    h.appendChild(g); h.appendChild(pills); card.appendChild(h);
    if(x.statut!=="annule"){
      var r=gmRow(card);
      if(!(Number(x.montant)>0)){}
      else if(!x.paye) r.appendChild(gmBtn("Paiement reçu","primary",function(b){ b.disabled=true; evtMarquerPaye(x,e,true).then(repeindre).catch(function(err){ b.disabled=false; askAlert("Erreur : "+((err&&err.code)||err)); }); }));
      else r.appendChild(gmBtn("Annuler le paiement","ghost",function(b){ b.disabled=true; evtMarquerPaye(x,e,false).then(repeindre).catch(function(){ b.disabled=false; }); }));
      if(!x.playerId && evtEstLicTarif(x,page)) r.appendChild(gmBtn("Relier","soft",function(){ evtRelier(x, repeindre); }));
      if(x.tel) r.appendChild(gmBtn("SMS","soft",function(){ window.location.href="sms:"+String(x.tel).replace(/[^+0-9]/g,""); }));
      r.appendChild(gmBtn("Annuler","danger",function(){
        askConfirm("Annuler l'inscription de "+(x.prenom||"")+" ? La place est libérée.",{danger:true,confirmText:"Annuler l'inscription"}).then(function(ok){
          if(!ok) return;
          evtAnnuler(x,e).then(function(nb){ if(nb!=null) page.nb=nb; repeindre(); }).catch(function(err){ askAlert("Erreur : "+((err&&err.code)||err)); });
        });
      }));
    }
    list.appendChild(card);
  });
}
function evtMarquerPaye(x, e, paye){
  var maj={paye:paye};
  return window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",x._id),maj).then(function(){
    x.paye=paye;
    if(!evtPeutCompta()) return;
    var compta=getComptabilite();
    var ref="Billet "+x._id;
    var i=compta.findIndex(function(c){return c.reference===ref;});
    if(!paye){ if(i>=0){ compta.splice(i,1); saveComptabilite(compta); } return; }
    if(!(Number(x.montant)>0)) return;
    var ligne={
      date:new Date().toISOString().slice(0,10), montant:Number(x.montant), type:"recette", categorie:"Événement",
      motif:(e.titre||eventTypeLabel(e.type))+" · "+((x.prenom||"")+" "+(x.nom||"")).trim()+((x.jours&&x.jours.length)?" ("+x.jours.length+" jour"+(x.jours.length>1?"s":"")+")":""),
      tiers:((x.prenom||"")+" "+(x.nom||"")).trim(), moyen:EVT_MODES_COMPTA[x.mode]||"Espèces", reference:ref
    };
    if(typeof hasPremium==="function" && !hasPremium() && i<0) ligne.horsPremium=true;
    if(i>=0) Object.assign(compta[i],ligne); else { ligne.id=Date.now().toString(); compta.push(ligne); }
    saveComptabilite(compta);
  });
}
// Annulation : le billet reste (trace), la place est rendue au compteur public.
function evtAnnuler(x, e){
  var pageRef=window.fbDoc(window.fbDb,"evt_pages",evtPageId(e.id));
  return window.fbGetDoc(pageRef).then(function(snap){
    var nb=snap.exists()?Math.max(0,(snap.data().nb||0)-1):0;
    var b=window.fbWriteBatch();
    b.update(window.fbDoc(window.fbDb,"evt_inscrits",x._id),{statut:"annule"});
    if(snap.exists()){
      var maj={nb:nb};
      if(x.jours&&x.jours.length){ var nj=Object.assign({},snap.data().nbJ||{}); x.jours.forEach(function(j){ nj[j]=Math.max(0,(nj[j]||0)-1); }); maj.nbJ=nj; }
      b.update(pageRef,maj);
    }
    return b.commit().then(function(){
      x.statut="annule";
      if(x.paye) return evtMarquerPaye(x,e,false).then(function(){ return nb; });
      return nb;
    });
  });
}
function evtRelier(x, fini){
  var players=(typeof getPlayers==="function")?getPlayers():[];
  var s=gmSheet("Relier à un joueur du club");
  var q=document.createElement("input"); q.className="form-input"; q.placeholder="Rechercher un nom"; q.value=x.nom||"";
  var box=document.createElement("div"); box.style.cssText="display:flex;flex-direction:column;gap:6px;margin-top:8px";
  s.body.appendChild(q); s.body.appendChild(box);
  function peindre(){
    var t=evtNorm(q.value);
    box.innerHTML="";
    players.filter(function(p){ return !t||evtNorm(p.nom+p.prenom).indexOf(t)>=0||evtNorm(p.prenom+p.nom).indexOf(t)>=0; }).slice(0,20).forEach(function(p){
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="text-align:left;padding:10px 12px;border-radius:var(--rx);border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:13px;cursor:pointer";
      b.textContent=(p.prenom||"")+" "+(p.nom||"")+(p.cat?" · "+p.cat:"")+(p.naissance?" · "+p.naissance:"");
      b.addEventListener("click",function(){
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",x._id),{playerId:String(p.id)}).then(function(){ x.playerId=String(p.id); s.modal.remove(); fini(); });
      });
      box.appendChild(b);
    });
    if(!box.children.length) box.innerHTML='<div style="font-size:12px;color:var(--mut);padding:8px">Aucun joueur trouvé : cette personne n\'est peut-être pas licenciée au club.</div>';
  }
  q.addEventListener("input",peindre); peindre();
}
function evtPartager(e){
  var url=evtLien(e.id);
  var s=gmSheet("Lien d'inscription");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Partagez ce lien sur vos réseaux ou dans vos groupes : on s'inscrit sans créer de compte. Les familles du club peuvent aussi inscrire leur enfant depuis l'appli.";
  var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;padding:12px;background:#fff;border-radius:var(--rs);margin-bottom:10px";
  var box=document.createElement("div");
  box.style.cssText="background:var(--card);border:1.5px dashed var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;word-break:break-all;color:var(--txt);font-family:monospace";
  box.textContent=url;
  s.body.appendChild(t); s.body.appendChild(qr); s.body.appendChild(box);
  if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:url,width:200,height:200,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(err){} }
  else qr.style.display="none";
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Partager","primary",function(){
    var txt=clubLabel()+" : "+(e.titre||eventTypeLabel(e.type))+" ("+evtDateTxt(e)+"). Inscriptions ici : "+url;
    if(navigator.share) navigator.share({title:e.titre||"Inscriptions",text:txt}).catch(function(){}); else copyToClipboard(url);
  }));
  row.appendChild(gmBtn("Copier le lien","soft",function(){ copyToClipboard(url); }));
}

// ── Inscription (écriture commune page publique / appli) ─────────────
// Une seule opération : le billet + le compteur de la page. En cas de code
// déjà pris ou d'inscription simultanée, on relit la page et on réessaie.
function evtInscrire(pid, data, essai){
  essai=essai||0;
  var pageRef=window.fbDoc(window.fbDb,"evt_pages",pid);
  return window.fbGetDoc(pageRef).then(function(snap){
    if(!snap.exists()) throw {code:"introuvable"};
    var p=snap.data();
    if(p.actif!==true) throw {code:"ferme"};
    var maj={nb:(p.nb||0)+1};
    if(p.parJour){
      var js=data.jours||[], nbJ=Object.assign({},p.nbJ||{});
      if(!js.length||js.some(function(j){ return (p.jours||[]).indexOf(j)<0; })) throw {code:"jours"};
      js.forEach(function(j){ if(p.places&&(nbJ[j]||0)>=p.places) throw {code:"complet",jour:j}; nbJ[j]=(nbJ[j]||0)+1; });
      maj.nbJ=nbJ;
    } else if(p.places && (p.nb||0)>=p.places) throw {code:"complet"};
    var code=evtCode(p.type);
    var b=window.fbWriteBatch();
    b.set(window.fbDoc(window.fbDb,"evt_inscrits",code),Object.assign({},data,{at:window.fbServerTimestamp()}));
    maj.dernier=code;
    b.update(pageRef,maj);
    return b.commit().then(function(){ return {code:code,page:p}; }).catch(function(err){
      if(essai<3) return evtInscrire(pid,data,essai+1);
      throw err;
    });
  });
}
function evtGarderBillet(pid, billet){
  try{
    var all=JSON.parse(localStorage.getItem("gm_billets")||"{}");
    (all[pid]=all[pid]||[]).push(billet);
    localStorage.setItem("gm_billets",JSON.stringify(all));
  }catch(e){}
}
function evtMesBillets(pid){ try{ return (JSON.parse(localStorage.getItem("gm_billets")||"{}")[pid])||[]; }catch(e){ return []; } }

// Billet : code + QR (le QR porte l'adresse du billet, lue par l'écran Entrée).
function evtBilletHtml(b, p){
  return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:18px;text-align:center;box-shadow:0 4px 16px var(--shadow);margin-bottom:12px">'+
    '<div style="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:1px">Billet</div>'+
    '<div style="font-size:17px;font-weight:900;color:var(--txt);margin-top:4px">'+authEsc((b.prenom||"")+" "+(b.nom||""))+'</div>'+
    '<div style="font-size:12px;color:var(--txt2);margin-top:2px">'+authEsc((p.titre||"")+" · "+evtDateTxt(p))+'</div>'+
    '<div class="evt-qr" data-code="'+authEsc(b.code)+'" style="display:flex;justify-content:center;margin:14px 0 8px"></div>'+
    '<div style="font-size:22px;font-weight:900;letter-spacing:2px;font-family:monospace;color:var(--dkg)">'+authEsc(b.code)+'</div>'+
    (b.jours&&b.jours.length?'<div style="font-size:13px;font-weight:800;color:var(--txt);margin-top:6px">📅 '+authEsc(evtJoursTxt(b.jours,(p.jours||[]).length))+'</div>':'')+
    '<div style="font-size:12px;color:var(--txt2);margin-top:6px">'+authEsc((b.tarifNom||"")+" · "+evtTarifTxt(b.montant)+(EVT_MODES[b.mode]?" · "+EVT_MODES[b.mode]:""))+'</div>'+
  '</div>';
}
function evtDessinerQr(root, pid){
  if(typeof QRCode==="undefined") return;
  Array.prototype.forEach.call(root.querySelectorAll(".evt-qr"),function(q){
    if(q.childNodes.length) return;
    try{ new QRCode(q,{text:"https://generalmanagerapp.fr/?billet="+encodeURIComponent(q.dataset.code)+"&evt="+encodeURIComponent(pid),width:170,height:170,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(e){}
  });
}

// ── Page publique (?evt=clubId__eventId), sans compte ───────────────
function showEvtPublic(pid){
  pid=String(pid||"").replace(/[^a-z0-9_-]/gi,"").slice(0,140);
  var nav=document.getElementById("bnav-main"); if(nav) nav.style.display="none";
  ["hdr-settings-btn","hdr-profile-btn"].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display="none"; });
  stack=["evt"]; showScr("evt");
  var el=document.getElementById("evt-public-content"); if(!el) return;
  el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--mut)">Chargement…</div>';
  var n=0;
  (function attendre(){
    if(!window.fbGetDoc||!window.fbDb){ if(n++<60){ setTimeout(attendre,100); return; } el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); return; }
    window.fbGetDoc(window.fbDoc(window.fbDb,"evt_pages",pid)).then(function(snap){
      if(!snap.exists()){ el.innerHTML=essaiErreur("Cet événement n'existe pas. Vérifiez le lien reçu."); return; }
      var p=snap.data();
      window.CURRENT_CLUB_ID=p.clubId;
      window.CURRENT_CLUB={id:p.clubId,name:p.nom||"",logo:(typeof p.logo==="string"&&/^data:image\//.test(p.logo))?p.logo:null,couleur:p.couleur||null,couleur2:p.couleur2||null,liens:p.liens||{}};
      if(typeof applyClubColor==="function") applyClubColor();
      try{ document.title=(p.titre||"Événement")+" · "+(p.nom||""); }catch(e){}
      rendreEvtPublic(el,p,pid);
    }).catch(function(){ el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); });
  })();
}
function evtEntete(p){
  var places=(p.places&&!p.parJour)?evtPlacesTxt(p.places,p.nb):"";
  return '<div style="background:linear-gradient(135deg,var(--dkg),var(--ltg));color:#fff;padding:20px 18px">'+
    '<div style="display:flex;align-items:center;gap:12px">'+
      '<div style="flex-shrink:0;background:rgba(255,255,255,.95);border-radius:12px;padding:3px">'+clubLogoHtml(44)+'</div>'+
      '<div style="min-width:0;font-size:13px;font-weight:800;opacity:.9">'+authEsc(p.nom||"")+'</div>'+
    '</div>'+
    '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;opacity:.85;margin-top:16px">'+authEsc(eventTypeLabel(p.type))+'</div>'+
    '<div style="font-size:24px;font-weight:900;line-height:1.15;margin-top:2px">'+authEsc(p.titre||"")+'</div>'+
    '<div style="font-size:13px;opacity:.92;margin-top:6px">'+authEsc(evtDateTxt(p))+(p.lieu?'<br>'+authEsc(p.lieu):'')+'</div>'+
    (places?'<div style="display:inline-block;margin-top:10px;padding:5px 12px;border-radius:20px;background:rgba(255,255,255,.18);font-size:12px;font-weight:800">'+authEsc(places)+'</div>':'')+
  '</div>';
}
function rendreEvtPublic(el,p,pid){
  var auj=new Date().toISOString().slice(0,10);
  var mes=evtMesBillets(pid);
  var mesHtml=mes.length?'<div style="padding:16px 16px 0"><div class="form-label" style="margin-bottom:8px">Mes billets</div>'+mes.map(function(b){return evtBilletHtml(b,p);}).join("")+'</div>':'';
  var ferme=p.actif!==true||(p.limite&&p.limite<auj)||((p.dateFin||p.date||auj)<auj);
  var complet=p.parJour?(p.places>0&&(p.jours||[]).length>0&&(p.jours||[]).every(function(j){ return ((p.nbJ||{})[j]||0)>=p.places; })):(p.places&&(p.nb||0)>=p.places);
  if(ferme||complet){
    el.innerHTML=evtEntete(p)+mesHtml+essaiErreur(complet?"C'est complet ! Contactez le club pour la liste d'attente.":"Les inscriptions sont fermées.")+'<div style="padding:0 16px 24px">'+clubLiensHtml()+'</div>';
    evtDessinerQr(el,pid); return;
  }
  var tarifs=p.tarifs||[], modes=p.modes||[];
  var tIdx=tarifs.length===1?0:null, mode=modes.length===1?modes[0]:null;
  var sel=(p.parJour?(p.jours||[]).filter(function(j){ return !(p.places>0&&((p.nbJ||{})[j]||0)>=p.places); }):[]), nJ=(p.jours||[]).length;
  function montantCourant(){ if(tIdx==null) return null; return p.parJour?evtMontant(tarifs[tIdx],sel,nJ):(Number(tarifs[tIdx].prix)||0); }
  el.innerHTML=evtEntete(p)+mesHtml+
    '<div style="padding:16px 16px 40px">'+
      (p.programme?'<div style="font-size:13px;color:var(--txt2);line-height:1.5;margin-bottom:14px;white-space:pre-line">'+authEsc(p.programme)+'</div>':'')+
      '<div class="form-label" style="margin-bottom:8px">Tarif</div><div id="evt-tarifs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px"></div>'+
      (p.parJour?'<div class="form-label" style="margin-bottom:8px">Jours choisis</div><div id="evt-jours" style="margin-bottom:4px"></div><div id="evt-total" style="font-size:15px;font-weight:900;color:var(--dkg);margin:4px 0 16px"></div>':'')+
      '<div class="form-group"><label class="form-label" for="evt-prenom">Prénom du participant</label><input class="form-input" id="evt-prenom" maxlength="40" autocomplete="off"></div>'+
      '<div class="form-group"><label class="form-label" for="evt-nom">Nom</label><input class="form-input" id="evt-nom" maxlength="60" autocomplete="off"></div>'+
      '<div class="form-group"><label class="form-label" for="evt-naiss">Date de naissance</label><input class="form-input" id="evt-naiss" type="date"></div>'+
      '<div class="form-group" id="evt-club-g"><label class="form-label" for="evt-club">Club actuel (facultatif)</label><input class="form-input" id="evt-club" maxlength="60" autocomplete="off"></div>'+
      '<div class="form-group"><label class="form-label" for="evt-tel">Téléphone (parent si mineur)</label><input class="form-input" id="evt-tel" type="tel" maxlength="20" autocomplete="tel" placeholder="06 12 34 56 78"></div>'+
      '<div id="evt-pay-g"><div class="form-label" style="margin-bottom:8px">Paiement</div><div id="evt-modes" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px"></div></div>'+
      '<input id="evt-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-5000px;width:1px;height:1px;opacity:0">'+
      '<button id="evt-envoyer" style="width:100%;padding:15px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:15px;font-weight:800;border:none;cursor:pointer">M\'inscrire</button>'+
      '<div style="font-size:11px;color:var(--mut);line-height:1.45;margin-top:10px">Vos coordonnées servent uniquement au club pour organiser l\'événement. Elles ne sont ni publiées ni transmises.</div>'+
      '<div style="margin-top:24px">'+clubLiensHtml()+'</div>'+
    '</div>';
  evtDessinerQr(el,pid);
  var tBox=document.getElementById("evt-tarifs"), mBox=document.getElementById("evt-modes");
  function choixBtn(on){ return "text-align:left;padding:12px 14px;border-radius:var(--rs);cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--dkg) 8%, var(--card))":"var(--card)")+";color:var(--txt)"; }
  function peindre(){
    tBox.innerHTML="";
    tarifs.forEach(function(t,i){
      var b=document.createElement("button"); b.type="button"; b.style.cssText=choixBtn(tIdx===i)+";display:flex;justify-content:space-between;align-items:center;gap:10px";
      var g=document.createElement("div");
      var n=document.createElement("div"); n.style.cssText="font-size:14px;font-weight:800"; n.textContent=(tIdx===i?"✓ ":"")+t.nom; g.appendChild(n);
      if(t.pour==="lic"){ var h=document.createElement("div"); h.style.cssText="font-size:11px;color:var(--mut);margin-top:2px"; h.textContent="Réservé aux licenciés du club (vérifié par le club)"; g.appendChild(h); }
      var pr=document.createElement("div"); pr.style.cssText="font-size:16px;font-weight:900;color:var(--dkg);white-space:nowrap;text-align:right"; pr.textContent=t.prix?evtPrix(t.prix)+(p.parJour?" / jour":""):"Gratuit";
      if(p.parJour&&Number(t.forfait)>0){ var fo=document.createElement("div"); fo.style.cssText="font-size:11px;font-weight:700;color:var(--mut)"; fo.textContent="forfait "+evtPrix(t.forfait); pr.appendChild(fo); }
      b.appendChild(g); b.appendChild(pr);
      b.addEventListener("click",function(){ tIdx=i; peindre(); });
      tBox.appendChild(b);
    });
    var mc=montantCourant();
    var pg=document.getElementById("evt-pay-g"); if(pg) pg.style.display=(tIdx!=null&&!(mc>0))?"none":"block";
    var tt=document.getElementById("evt-total"); if(tt) tt.textContent=tIdx==null?"Choisissez d'abord un tarif":evtTotalTxt(tarifs[tIdx],sel,nJ);
    var cg=document.getElementById("evt-club-g"); if(cg) cg.style.display=(tIdx!=null&&tarifs[tIdx].pour==="lic")?"none":"block";
    mBox.innerHTML="";
    modes.forEach(function(m){
      var on=mode===m;
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="padding:9px 14px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt)");
      b.textContent=EVT_MODES[m]+(m==="helloasso"?" (en ligne)":"");
      b.addEventListener("click",function(){ mode=m; peindre(); });
      mBox.appendChild(b);
    });
  }
  peindre();
  if(p.parJour) evtSelecteurJours(document.getElementById("evt-jours"),p,sel,peindre);
  document.getElementById("evt-envoyer").addEventListener("click",function(){
    var btn=this;
    if(document.getElementById("evt-hp").value){ el.innerHTML=evtEntete(p)+essaiMerci(""); return; }
    var v=function(id){ return String((document.getElementById(id)||{}).value||"").trim(); };
    var tel=v("evt-tel").replace(/[\s.\-()]/g,"");
    if(tIdx==null) return askAlert("Choisissez un tarif.");
    if(!v("evt-prenom")) return askAlert("Indiquez le prénom.");
    if(!v("evt-nom")) return askAlert("Indiquez le nom.");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v("evt-naiss"))) return askAlert("Indiquez la date de naissance.");
    if(!/^[+]?[0-9]{9,15}$/.test(tel)) return askAlert("Numéro de téléphone invalide.");
    var t=tarifs[tIdx];
    if(p.parJour&&!sel.length) return askAlert("Choisissez au moins un jour.");
    var montant=montantCourant();
    var gratuit=!(montant>0);
    if(!gratuit && !mode) return askAlert("Choisissez le mode de paiement.");
    var data={
      eventId:String(p.eventId), prenom:v("evt-prenom").slice(0,40), nom:v("evt-nom").slice(0,60), naissance:v("evt-naiss"), tel:tel,
      clubOrigine:t.pour==="lic"?"":v("evt-club").slice(0,60), tarifIdx:tIdx, tarifNom:String(t.nom||"").slice(0,40), montant:montant,
      mode:gratuit?"gratuit":mode, statut:"inscrit", paye:false, present:false, source:"public"
    };
    if(p.parJour) data.jours=sel.slice().sort();
    btn.disabled=true; btn.textContent="Inscription…";
    evtInscrire(pid,data).then(function(r){
      var billet=Object.assign({code:r.code},data);
      evtGarderBillet(pid,billet);
      p.nb=(r.page.nb||0)+1;
      if(p.parJour){ p.nbJ=Object.assign({},r.page.nbJ||{}); (data.jours||[]).forEach(function(j){ p.nbJ[j]=(p.nbJ[j]||0)+1; }); }
      evtConfirmation(el,p,pid,billet);
    }).catch(function(err){
      btn.disabled=false; btn.textContent="M'inscrire";
      var c=err&&err.code;
      if(c==="complet") askAlert(err.jour?"Désolé, "+evtJourTxt(err.jour,true)+" est complet. Choisissez un autre jour.":"Désolé, c'est complet.");
      else if(c==="jours") askAlert("Les jours ont changé : rechargez la page.");
      else if(c==="ferme") askAlert("Les inscriptions viennent de fermer.");
      else askAlert("L'inscription n'a pas fonctionné. Réessayez, ou contactez directement le club.");
    });
  });
}
function evtConfirmation(el,p,pid,b){
  var pay=b.mode==="helloasso"&&p.helloasso
    ?'<a href="'+authEsc(p.helloasso)+'" target="_blank" rel="noopener" style="display:block;text-align:center;width:100%;box-sizing:border-box;padding:15px;border-radius:var(--rx);background:#49D38A;color:#0b1630;font-size:15px;font-weight:900;text-decoration:none;margin-bottom:10px">Payer '+authEsc(evtPrix(b.montant))+' sur HelloAsso</a>'
    :(Number(b.montant)>0?'<div style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:10px">À régler sur place : '+authEsc(evtPrix(b.montant))+' ('+authEsc(EVT_MODES[b.mode]||"")+')</div>':'');
  el.innerHTML=evtEntete(p)+
    '<div style="padding:18px 16px 40px">'+
      '<div style="text-align:center;font-size:18px;font-weight:900;color:var(--txt);margin-bottom:4px">✅ Inscription enregistrée</div>'+
      '<div style="text-align:center;font-size:13px;color:var(--mut);line-height:1.5;margin-bottom:14px">Faites une capture d\'écran de votre billet : il sera scanné à l\'entrée.</div>'+
      evtBilletHtml(b,p)+pay+
      '<button id="evt-autre" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:14px;font-weight:700;border:none;cursor:pointer">Inscrire une autre personne</button>'+
      '<div style="margin-top:24px">'+clubLiensHtml()+'</div>'+
    '</div>';
  evtDessinerQr(el,pid);
  document.getElementById("evt-autre").addEventListener("click",function(){ rendreEvtPublic(el,p,pid); window.scrollTo(0,0); });
  window.scrollTo(0,0);
}

// ── Parents : inscrire son enfant depuis l'appli ────────────────────
function evtCartesParent(){
  var evs=getVisibleEvents().filter(function(e){ return EVT_TYPES_INSCR.indexOf(e.type)>=0 && evtOuvertes(e); });
  if(!evs.length) return null;
  evs.sort(function(a,b){return a.date>b.date?1:-1;});
  var wrap=document.createElement("div"); wrap.style.marginBottom="12px";
  var t=document.createElement("div"); t.style.cssText="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px;margin:0 2px 8px";
  t.textContent="Inscriptions ouvertes";
  wrap.appendChild(t);
  evs.forEach(function(e){
    var d=document.createElement("div"); d.className="event-card"; d.style.borderLeft="4px solid "+eventTypeColor(e.type);
    var lic=(e.inscr.tarifs||[]).find(function(x){return x.pour==="lic";})||(e.inscr.tarifs||[])[0];
    d.innerHTML='<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+eventTypeColor(e.type)+'">'+authEsc(eventTypeLabel(e.type))+'</span><span style="font-size:11px;color:var(--mut)">'+authEsc(evtDateTxt(e))+'</span></div>'+
      '<div style="font-size:14px;font-weight:800;color:var(--txt)">'+authEsc(e.titre||"")+'</div>'+
      (e.lieu?'<div style="font-size:11px;color:var(--mut);margin-top:2px">📍 '+authEsc(e.lieu)+'</div>':'')+
      (lic?'<div style="font-size:12px;color:var(--dkg);font-weight:800;margin-top:4px">'+authEsc(lic.nom+" : "+(lic.prix?evtPrix(lic.prix)+(e.inscr.parJour?" / jour":""):"gratuit")+((e.inscr.parJour&&Number(lic.forfait)>0)?" · forfait "+evtPrix(lic.forfait):""))+'</div>':'')+
      (e.inscr.parJour?'<div style="font-size:11px;color:var(--mut);margin-top:2px">Choisissez les jours qui vous intéressent</div>':'');
    var b=document.createElement("button");
    b.style.cssText="margin-top:10px;width:100%;padding:11px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer";
    b.textContent="Inscrire mon enfant";
    b.addEventListener("click",function(){ evtInscrireEnfant(e); });
    d.appendChild(b);
    wrap.appendChild(d);
  });
  return wrap;
}
function evtInscrireEnfant(e){
  var enfants=(typeof mesEnfants==="function")?mesEnfants():[];
  var fiches=window.MES_FICHES||{};
  var tarifs=e.inscr.tarifs||[], modes=e.inscr.modes||[];
  var tIdx=tarifs.findIndex(function(x){return x.pour==="lic";}); if(tIdx<0) tIdx=0;
  var mode=modes.length===1?modes[0]:null, pid=null;
  var parJour=!!e.inscr.parJour, pageJ={jours:evtJoursPlage(e.date,e.dateFin),places:e.inscr.places||0,nbJ:{}}, sel=pageJ.jours.slice();
  function montantCourant(){ return parJour?evtMontant(tarifs[tIdx],sel,pageJ.jours.length):(Number(tarifs[tIdx].prix)||0); }
  var s=gmSheet(e.titre||eventTypeLabel(e.type));
  if(!enfants.length){
    var v=document.createElement("div"); v.style.cssText="font-size:13px;color:var(--txt2);line-height:1.5";
    v.textContent="Aucun enfant n'est relié à votre compte. Demandez au club de rattacher votre numéro à la fiche de votre enfant, ou utilisez le lien d'inscription du club.";
    s.body.appendChild(v); return;
  }
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);margin-bottom:8px";
  info.textContent=evtDateTxt(e)+(e.lieu?" · "+e.lieu:"");
  s.body.appendChild(info);
  if(e.inscr.programme){ var pg=document.createElement("div"); pg.style.cssText="font-size:12px;color:var(--txt2);line-height:1.5;white-space:pre-line;margin-bottom:6px"; pg.textContent=e.inscr.programme; s.body.appendChild(pg); }
  gmSection(s.body,"Qui participe ?");
  var eBox=document.createElement("div"); eBox.style.cssText="display:flex;flex-wrap:wrap;gap:8px"; s.body.appendChild(eBox);
  var naissG=document.createElement("div"); naissG.className="form-group"; naissG.style.cssText="margin-top:8px;display:none";
  naissG.innerHTML='<label class="form-label" for="evt-p-naiss">Date de naissance</label><input class="form-input" id="evt-p-naiss" type="date">';
  s.body.appendChild(naissG);
  gmSection(s.body,"Tarif");
  var tBox=document.createElement("div"); tBox.style.cssText="display:flex;flex-direction:column;gap:6px"; s.body.appendChild(tBox);
  var jSec=document.createElement("div"); jSec.style.display=parJour?"block":"none"; s.body.appendChild(jSec);
  gmSection(jSec,"Jours choisis");
  var jBox=document.createElement("div"); jSec.appendChild(jBox);
  var jTot=document.createElement("div"); jTot.style.cssText="font-size:15px;font-weight:900;color:var(--dkg);margin-top:6px"; jSec.appendChild(jTot);
  var payG=document.createElement("div"); s.body.appendChild(payG);
  gmSection(payG,"Paiement");
  var mBox=document.createElement("div"); mBox.style.cssText="display:flex;flex-wrap:wrap;gap:8px"; payG.appendChild(mBox);
  function chip(on){ return "padding:9px 14px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt)"); }
  function peindre(){
    eBox.innerHTML="";
    enfants.forEach(function(k){
      var b=document.createElement("button"); b.type="button"; b.style.cssText=chip(pid===String(k.id)); b.textContent=k.prenom||k.nom||"Enfant";
      b.addEventListener("click",function(){ pid=String(k.id); peindre(); }); eBox.appendChild(b);
    });
    var f=pid?(fiches[pid]||{}):{};
    naissG.style.display=(pid&&!/^\d{4}-\d{2}-\d{2}$/.test(f.naissance||""))?"block":"none";
    tBox.innerHTML="";
    tarifs.forEach(function(t,i){
      var b=document.createElement("button"); b.type="button"; b.style.cssText=chip(tIdx===i)+";border-radius:var(--rx);text-align:left;display:flex;justify-content:space-between";
      var a=document.createElement("span"); a.textContent=t.nom; var c=document.createElement("span"); c.textContent=t.prix?evtPrix(t.prix)+(parJour?" / jour":""):"Gratuit";
      b.appendChild(a); b.appendChild(c); b.addEventListener("click",function(){ tIdx=i; peindre(); }); tBox.appendChild(b);
    });
    payG.style.display=(tarifs[tIdx]&&montantCourant()>0)?"block":"none";
    if(parJour) jTot.textContent=evtTotalTxt(tarifs[tIdx],sel,pageJ.jours.length);
    mBox.innerHTML="";
    modes.forEach(function(m){
      var b=document.createElement("button"); b.type="button"; b.style.cssText=chip(mode===m); b.textContent=EVT_MODES[m];
      b.addEventListener("click",function(){ mode=m; peindre(); }); mBox.appendChild(b);
    });
  }
  peindre();
  if(parJour){
    evtSelecteurJours(jBox,pageJ,sel,peindre);
    // Places restantes par jour : lues sur la page publique
    window.fbGetDoc(window.fbDoc(window.fbDb,"evt_pages",evtPageId(e.id))).then(function(sn){
      if(!sn.exists()) return;
      var d=sn.data(); pageJ.nbJ=d.nbJ||{}; if(d.jours&&d.jours.length) pageJ.jours=d.jours; pageJ.places=d.places||0;
      sel.length=0; pageJ.jours.forEach(function(j){ if(!(pageJ.places>0&&(pageJ.nbJ[j]||0)>=pageJ.places)) sel.push(j); });
      evtSelecteurJours(jBox,pageJ,sel,peindre); peindre();
    }).catch(function(){});
  }
  var go=gmBtn("Valider l'inscription","primary",function(btn){
    if(!pid) return askAlert("Choisissez l'enfant.");
    if(parJour&&!sel.length) return askAlert("Choisissez au moins un jour.");
    var gratuit=!(montantCourant()>0);
    if(!gratuit && !mode) return askAlert("Choisissez le mode de paiement.");
    var k=enfants.find(function(x){return String(x.id)===pid;})||{};
    var f=fiches[pid]||{};
    var naiss=/^\d{4}-\d{2}-\d{2}$/.test(f.naissance||"")?f.naissance:String((document.getElementById("evt-p-naiss")||{}).value||"");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(naiss)) return askAlert("Indiquez la date de naissance.");
    var u=window.ASMB_USER||{};
    var tel=String(u.phone||f.respTel||"").replace(/[\s.\-()]/g,"");
    if(!/^[+]?[0-9]{9,15}$/.test(tel)) return askAlert("Ajoutez votre numéro de téléphone dans vos paramètres.");
    var t=tarifs[tIdx];
    var data={
      eventId:String(e.id), prenom:String(f.prenom||k.prenom||"").slice(0,40), nom:String(f.nom||k.nom||"").slice(0,60), naissance:naiss, tel:tel,
      clubOrigine:"", tarifIdx:tIdx, tarifNom:String(t.nom||"").slice(0,40), montant:montantCourant(), mode:gratuit?"gratuit":mode,
      statut:"inscrit", paye:false, present:false, playerId:pid, auteurUid:(window.ASMB_USER&&window.ASMB_USER.uid)||(window.fbAuth&&window.fbAuth.currentUser&&window.fbAuth.currentUser.uid)||"", source:"app"
    };
    if(parJour) data.jours=sel.slice().sort();
    if(!data.prenom||!data.nom) return askAlert("Nom ou prénom manquant sur la fiche de l'enfant : contactez le club.");
    btn.disabled=true;
    var pageId=evtPageId(e.id);
    evtInscrire(pageId,data).then(function(r){
      var billet=Object.assign({code:r.code},data);
      evtGarderBillet(pageId,billet);
      s.body.innerHTML=evtBilletHtml(billet,Object.assign({},r.page))+
        ((mode==="helloasso"&&e.inscr.helloasso)?'<a href="'+authEsc(e.inscr.helloasso)+'" target="_blank" rel="noopener" style="display:block;text-align:center;padding:14px;border-radius:var(--rx);background:#49D38A;color:#0b1630;font-size:14px;font-weight:900;text-decoration:none">Payer '+authEsc(evtPrix(data.montant))+' sur HelloAsso</a>':
          (Number(data.montant)>0?'<div style="font-size:13px;color:var(--txt2);text-align:center">À régler sur place : '+authEsc(evtPrix(data.montant))+'</div>':''));
      evtDessinerQr(s.body,pageId);
    }).catch(function(err){
      btn.disabled=false;
      var c=err&&err.code;
      askAlert(c==="complet"?(err.jour?"Désolé, "+evtJourTxt(err.jour,true)+" est complet.":"Désolé, c'est complet."):c==="jours"?"Les jours ont changé : fermez et rouvrez l'inscription.":c==="ferme"?"Les inscriptions sont fermées.":"L'inscription n'a pas fonctionné. Réessayez dans un instant.");
    });
  });
  go.style.cssText+=";width:100%;padding:14px;border-radius:var(--rx);font-size:14px;margin-top:16px";
  s.body.appendChild(go);
}
