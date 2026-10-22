// ══════════════════════════════════════════════════════════════
// BÉNÉVOLES — le dirigeant ou un coach place des personnes sur des postes
// (buvette, table de marque, chrono…) pour un match ou un événement.
// Stocké sur l'événement : e.benevoles = [{id, poste, heure, uid?, nom}].
// Aucun numéro de téléphone n'est stocké sur l'événement (lisible par tous
// les membres) : le SMS pré-rempli lit le numéro du compte au moment de l'envoi.
// La personne voit sa mission sur l'accueil de son appli (7 jours avant).
// ══════════════════════════════════════════════════════════════
var BEN_POSTES=["Buvette","Table de marque","Chronomètre","Arbitrage","Accueil","Installation / rangement"];
var BEN_COMPTES=null; // cache des comptes du club : [{uid, label, phone, prenom}]

// Sur un événement de plusieurs jours, un bénévole peut être placé un jour précis (m.jour) ;
// sans m.jour il vaut pour toute la durée. benListe(e,jour) filtre sur ce jour.
function benListe(e,jour){
  var l=(e&&Array.isArray(e.benevoles))?e.benevoles:[];
  return jour?l.filter(function(m){ return !m.jour||m.jour===jour; }):l;
}
function benEstStaff(){ return ["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0; }
function benJourTxt(e){
  try{ return new Date(e.date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}); }catch(x){ return e.date||""; }
}
function benSauver(eid,liste){
  var evs=getEvents(), i=evs.findIndex(function(x){ return x.id===eid; });
  if(i<0) return false;
  evs[i].benevoles=liste;
  saveEvents(evs);
  benSyncPlanifier();
  return true;
}
// Comptes du club, avec un nom lisible tiré des fiches de licence (le compte n'a pas de nom).
function benChargerComptes(){
  if(BEN_COMPTES) return Promise.resolve(BEN_COMPTES);
  if(!window.fbGetDocs||!window.fbDb) return Promise.resolve([]);
  var noms={};
  (getLicences()||[]).forEach(function(l){
    var f=l&&l.fiche; if(!f) return;
    var enfant=((f.prenom||"")+" "+(f.nom||"")).trim(), net=function(t){ return String(t||"").replace(/[^+0-9]/g,""); };
    if(f.telephone&&enfant) noms[net(f.telephone)]=noms[net(f.telephone)]||{nom:enfant};
    if(f.respTel) noms[net(f.respTel)]=noms[net(f.respTel)]||{nom:f.respNom||"",de:f.prenom||enfant};
    if(f.resp2Tel) noms[net(f.resp2Tel)]=noms[net(f.resp2Tel)]||{nom:f.resp2Nom||"",de:f.prenom||enfant};
  });
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(sn){
    var out=[];
    sn.forEach(function(d){
      var u=d.data()||{}, tel=String(u.phone||"").replace(/[^+0-9]/g,""), tel0=tel.replace(/^\+33/,"0"), n=noms[tel]||noms[tel0]||{};
      var roles=(u.roles||[]).filter(function(r){ return r!=="parent"; });
      // Nom saisi sur le compte (prénom + nom), sinon fiche de licence, sinon e-mail en dernier recours.
      var vrai=((typeof compteNom==="function"?compteNom(u):"")||n.nom||"").trim();
      var nom=vrai||u.email||u.phone||"Compte";
      var label=nom+(vrai&&u.email?" ("+u.email+")":"")+(n.de?" · parent de "+n.de:"")+(roles.length?" · "+roles.join(", "):"");
      out.push({uid:d.id, label:label, nom:nom, phone:tel0||tel, prenom:vrai?String(u.prenom||vrai.split(" ")[0]):""});
    });
    out.sort(function(a,b){ return a.label.localeCompare(b.label,"fr"); });
    BEN_COMPTES=out; return out;
  }).catch(function(){ return []; });
}

// ── Écran du staff : postes de l'événement ───────────────────────────
function benOuvrir(eid,jour){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var s=gmSheet("Bénévoles · "+(e.titre||eventTypeLabel(e.type)));
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px";
  info.textContent=(jour?benJourTxt({date:jour}):benJourTxt(e))+(e.heure?" · "+e.heure:"")+(e.lieu?" · "+e.lieu:"");
  s.body.appendChild(info);
  gmRow(s.body).appendChild(gmBtn("🎫 Mes bénévoles (pass)","ghost",function(){ benCarnetOuvrir(); }));
  benCarnetCharger();
  var liste=document.createElement("div"); s.body.appendChild(liste);
  function rendre(){
    var ev=getEvents().find(function(x){ return x.id===eid; })||e, l=benListe(ev,jour);
    liste.innerHTML="";
    if(!l.length){ var v=document.createElement("div"); v.style.cssText="font-size:12.5px;color:var(--mut);padding:6px 0 10px"; v.textContent="Personne n'est encore placé. Ajoutez un poste ci-dessous."; liste.appendChild(v); }
    l.forEach(function(m){
      var d=document.createElement("div");
      d.style.cssText="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 10px;margin-bottom:6px";
      d.innerHTML='<div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase">'+authEsc(m.poste+(m.heure?" · "+m.heure:""))+'</div>'+
        '<div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(m.nom||"?")+(m.uid?'':' <span style="font-size:11px;color:var(--mut);font-weight:600">(sans compte)</span>')+'</div></div>';
      var rep=m.benId&&BEN_REPONSES[m.benId]&&BEN_REPONSES[m.benId][m.id];
      if(rep) d.firstChild.lastChild.insertAdjacentHTML("beforeend",' <span style="font-size:11px;font-weight:800;color:'+(rep==="oui"?"#1F8A4C":"#C0392B")+'">'+(rep==="oui"?"✓ confirmé":"✗ ne peut pas")+'</span>');
      var sms=gmBtn("📱 SMS","soft",function(){ benSms(ev,m); }); sms.style.flex="0 0 auto";
      var del=gmBtn("✕","ghost",function(){
        benSauver(eid,benListe(getEvents().find(function(x){ return x.id===eid; })).filter(function(x){ return x.id!==m.id; })); rendre();
      }); del.style.flex="0 0 auto"; del.title="Retirer";
      d.appendChild(sms); d.appendChild(del); liste.appendChild(d);
    });
  }
  rendre();
  benReponsesCharger().then(rendre);
  gmSection(s.body,"Placer quelqu'un");
  var g=document.createElement("div"); g.style.cssText="display:grid;grid-template-columns:2fr 1fr;gap:8px";
  var wp=document.createElement("div"); wp.className="form-group"; wp.innerHTML='<label class="form-label">Poste</label>';
  var poste=document.createElement("select"); poste.className="form-input";
  BEN_POSTES.concat(["Autre…"]).forEach(function(p){ var o=document.createElement("option"); o.value=p; o.textContent=p; poste.appendChild(o); });
  wp.appendChild(poste);
  var wh=document.createElement("div"); wh.className="form-group"; wh.innerHTML='<label class="form-label">Heure</label>';
  var heure=document.createElement("input"); heure.className="form-input"; heure.placeholder=""; heure.maxLength=12; heure.value=String(e.heure||"").slice(0,12);
  wh.appendChild(heure); g.appendChild(wp); g.appendChild(wh); s.body.appendChild(g);
  var quand=null;
  if(jour){
    var wq=document.createElement("div"); wq.className="form-group"; wq.innerHTML='<label class="form-label">Quand</label>';
    quand=document.createElement("select"); quand.className="form-input";
    [["jour","Ce jour seulement ("+benJourTxt({date:jour})+")"],["tous","Tous les jours de l'événement"]].forEach(function(o){ var op=document.createElement("option"); op.value=o[0]; op.textContent=o[1]; quand.appendChild(op); });
    wq.appendChild(quand); s.body.appendChild(wq);
  }
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Choisir la personne","primary",function(){
    var nomPoste=poste.value;
    var suite=function(p){
      if(!p) return;
      benChoisirPersonne(function(pers){
        if(!pers) return;
        var ev=getEvents().find(function(x){ return x.id===eid; }); if(!ev) return;
        var m={id:"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), poste:String(p).slice(0,40), heure:heure.value.trim().slice(0,12), nom:String(pers.nom||"").slice(0,60)};
        if(jour&&quand&&quand.value==='jour') m.jour=jour;
        if(pers.uid) m.uid=pers.uid;
        if(pers.prenom) m.prenom=String(pers.prenom).slice(0,40);
        if(pers.benId) m.benId=pers.benId;
        benSauver(eid,benListe(ev).concat([m])); rendre();
        askConfirm("Prévenir "+m.nom+" par SMS maintenant ?",{confirmText:"Envoyer le SMS"}).then(function(ok){ if(ok) benSms(ev,m,pers.phone); });
      });
    };
    if(nomPoste==="Autre…") askPrompt("Nom du poste",{placeholder:"",confirmText:"OK"}).then(function(v){ suite(v&&v.trim()); });
    else suite(nomPoste);
  }));
}
// Liste des comptes du club + « personne sans compte ».
function benChoisirPersonne(cb){
  var s=gmSheet("Qui ?"), fini=false;
  function choisir(p){ if(fini) return; fini=true; s.modal.remove(); cb(p); }
  var q=document.createElement("input"); q.className="form-input"; q.placeholder="Rechercher un nom…"; q.style.marginBottom="8px";
  s.body.appendChild(q);
  var l=document.createElement("div"); l.innerHTML='<div style="color:var(--mut);font-size:12px;padding:8px 0">Chargement…</div>'; s.body.appendChild(l);
  var carnetBox=document.createElement("div"); s.body.insertBefore(carnetBox,l);
  benCarnetCharger().then(function(c){
    var actifs=c.filter(function(x){ return x.actif!==false; });
    if(!actifs.length) return;
    var t=document.createElement("div"); t.style.cssText="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase;margin:2px 0 6px"; t.textContent="Mes bénévoles (avec pass)";
    carnetBox.appendChild(t);
    actifs.forEach(function(x){
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="display:block;width:100%;text-align:left;padding:11px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
      b.textContent="🎫 "+x.nom;
      b.addEventListener("click",function(){ choisir({nom:x.nom,benId:x.id,phone:x.tel||""}); });
      carnetBox.appendChild(b);
    });
  });
  var nouveau=gmBtn("🎫 Nouveau bénévole avec pass (lien / QR)","soft",function(){
    benNouveau().then(function(x){ if(x) choisir({nom:x.nom,benId:x.id}); });
  });
  gmRow(s.body).appendChild(nouveau);
  var autre=gmBtn("Personne sans compte dans l'appli","ghost",function(){
    askPrompt("Nom de la personne",{placeholder:"",confirmText:"OK"}).then(function(v){ v=v&&v.trim(); if(v) choisir({nom:v}); });
  });
  gmRow(s.body).appendChild(autre);
  benChargerComptes().then(function(cs){
    function rendre(){
      var t=q.value.trim().toLowerCase();
      l.innerHTML="";
      var vus=cs.filter(function(c){ return !t||c.label.toLowerCase().indexOf(t)>=0; }).slice(0,60);
      if(!vus.length){ l.innerHTML='<div style="color:var(--mut);font-size:12px;padding:8px 0">Aucun compte trouvé.</div>'; return; }
      vus.forEach(function(c){
        var b=document.createElement("button"); b.type="button";
        b.style.cssText="display:block;width:100%;text-align:left;padding:11px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
        b.textContent=c.label;
        b.addEventListener("click",function(){ choisir(c); });
        l.appendChild(b);
      });
    }
    q.addEventListener("input",rendre); rendre();
  });
}
function benSmsTexte(e,m){
  var club=(typeof clubLabel==="function")?clubLabel(""):"";
  var pass=m.benId&&BEN_CARNET?BEN_CARNET.find(function(x){ return x.id===m.benId&&x.actif!==false; }):null;
  // Prénom si on l'a, sinon le nom ; jamais d'e-mail ni de Monsieur/Madame.
  var nomPropre=String(m.nom||"").indexOf("@")>=0?"":String(m.nom||"").trim();
  var prenom=String(m.prenom||"").trim()||nomPropre.split(" ")[0];
  return (club?club+" : ":"")+"Bonjour"+(prenom?" "+prenom:"")+", vous êtes bénévole au poste « "+m.poste+" » "+(m.jour?benJourTxt({date:m.jour}):benJourTxt(e))+(m.heure?" à "+m.heure:"")+" ("+(e.titre||eventTypeLabel(e.type))+(e.lieu?", "+e.lieu:"")+"). Merci pour votre aide ! "+(pass?"Confirmez ou signalez un empêchement ici : "+benPassUrl(pass.code):"En cas d'empêchement, prévenez-nous au plus vite.");
}
function benSms(e,m,tel){
  var envoyer=function(t){
    t=String(t||"").replace(/[^+0-9]/g,"");
    if(!/^\+?[0-9]{9,15}$/.test(t)) return askAlert("Numéro de téléphone invalide.");
    window.location.href="sms:"+t+"?&body="+encodeURIComponent(benSmsTexte(e,m));
  };
  if(tel) return envoyer(tel);
  if(m.uid) return benChargerComptes().then(function(cs){
    var c=cs.find(function(x){ return x.uid===m.uid; });
    if(c&&c.phone) envoyer(c.phone);
    else askPrompt("Numéro de "+m.nom,{placeholder:"0612345678",confirmText:"Envoyer"}).then(function(v){ if(v) envoyer(v); });
  });
  askPrompt("Numéro de "+m.nom,{placeholder:"0612345678",confirmText:"Envoyer"}).then(function(v){ if(v) envoyer(v); });
}


// ── Carnet de bénévoles + pass (lien / QR) ───────────────────────────
// Carnet : clubs/{id}/benevoles/{benId} = {nom, tel?, code, actif}. Le pass public
// ben_pass/{CODE} (collection globale) reprend les missions à venir du bénévole, sans
// téléphone : la page /benevole/?p=CODE les affiche et enregistre « je confirme / je ne peux pas ».
var BEN_CARNET=null;      // cache : [{id, nom, tel, code, actif}]
var BEN_REPONSES={};      // benId -> {missionId: 'oui'|'non'}
var BEN_SYNC_T=null;
function benPassUrl(code){ return "https://generalmanagerapp.fr/benevole/?p="+encodeURIComponent(code); }
function benCarnetCharger(force){
  if(BEN_CARNET&&!force) return Promise.resolve(BEN_CARNET);
  if(!window.fbGetDocs||!window.fbDb||!window.CURRENT_CLUB_ID) return Promise.resolve([]);
  return window.fbGetDocs(window.fbCollection(window.fbDb,"benevoles")).then(function(sn){
    var out=[]; sn.forEach(function(d){ var x=d.data()||{}; x.id=d.id; out.push(x); });
    out.sort(function(a,b){ return String(a.nom).localeCompare(String(b.nom),"fr"); });
    BEN_CARNET=out; return out;
  }).catch(function(){ return []; });
}
function benReponsesCharger(){
  if(!window.fbGetDocs||!window.fbDb||!window.CURRENT_CLUB_ID) return Promise.resolve();
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"ben_pass"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(sn){
    BEN_REPONSES={}; sn.forEach(function(d){ var x=d.data()||{}; if(x.benId) BEN_REPONSES[x.benId]=x.reponses||{}; });
  }).catch(function(){});
}
// Missions à venir d'un bénévole du carnet, tirées des événements.
function benMissionsDe(benId){
  var auj=benJourLocal(), out=[];
  getEvents().forEach(function(e){
    if(!e||e.annule||e.cancelled) return;
    benListe(e).forEach(function(m){
      if(m.benId!==benId) return;
      if(String(m.jour||e.date||"")<auj) return;
      out.push({id:String(m.id).slice(0,30), eid:String(e.id).slice(0,60), poste:String(m.poste||"").slice(0,40), heure:String(m.heure||"").slice(0,12),
        date:String(m.jour||e.date||"").slice(0,10), titre:String(e.titre||eventTypeLabel(e.type)||"").slice(0,80), lieu:String(e.lieu||"").slice(0,80)});
    });
  });
  out.sort(function(a,b){ return (a.date+a.heure).localeCompare(b.date+b.heure); });
  return out.slice(0,40);
}
function benPassDonnees(x){
  var c=window.CURRENT_CLUB||{};
  return {clubId:window.CURRENT_CLUB_ID, clubName:String(c.name||"").slice(0,80), couleur:c.couleur||null, benId:x.id, nom:String(x.nom).slice(0,60),
    actif:x.actif!==false, missions:benMissionsDe(x.id), majLe:Date.now()};
}
// Remet à jour les pass après un changement d'événement (sans toucher aux réponses).
function benSyncPlanifier(){
  if(!BEN_CARNET||!BEN_CARNET.length||!benEstStaff()) return;
  clearTimeout(BEN_SYNC_T);
  BEN_SYNC_T=setTimeout(benSyncTous,1500);
}
function benSyncTous(){
  (BEN_CARNET||[]).forEach(function(x){
    if(!x.code) return;
    var d=benPassDonnees(x); delete d.clubId; delete d.benId;
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"ben_pass",x.code),d).catch(function(){});
  });
}
function benNouveau(){
  return askPrompt("Nom du bénévole",{placeholder:"Prénom Nom",confirmText:"Créer le pass"}).then(function(v){
    v=v&&v.trim().slice(0,60); if(!v) return null;
    var id="v"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), code=genSecureCode(3,4);
    var x={nom:v,code:code,actif:true,createdAt:Date.now()};
    return window.fbSetDoc(window.fbDoc(window.fbDb,"benevoles",id),x).then(function(){
      x.id=id;
      var d=benPassDonnees(x); d.createdAt=Date.now();
      return window.fbSetDoc(window.fbDoc(window.fbDb,"ben_pass",code),d);
    }).then(function(){ BEN_CARNET=(BEN_CARNET||[]).concat([x]); return x; })
      .catch(function(err){ askAlert("Erreur : "+((err&&err.code)||err)); return null; });
  });
}
// Fiche d'un pass : lien, QR, SMS, désactivation.
function benPassOuvrir(x){
  var s=gmSheet("Pass · "+x.nom), url=benPassUrl(x.code);
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Le bénévole ouvre ce lien (ou scanne le QR) : il voit ses missions et confirme sa venue. Pas de compte à créer.";
  s.body.appendChild(t);
  var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;padding:8px 0";
  s.body.appendChild(qr);
  if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:url,width:200,height:200,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(e){} }
  var u=document.createElement("div"); u.style.cssText="font-size:11.5px;word-break:break-all;color:var(--mut);text-align:center;margin-bottom:8px"; u.textContent=url; s.body.appendChild(u);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Copier le lien","soft",function(){ try{ navigator.clipboard.writeText(url); showToast("Lien copié"); }catch(e){ askAlert(url); } }));
  row.appendChild(gmBtn("Partager","primary",function(){
    var txt=(clubLabel("")?clubLabel("")+" : ":"")+"voici ton pass bénévole, tu y vois tes missions et tu confirmes ta venue : "+url;
    if(navigator.share) navigator.share({text:txt}).catch(function(){});
    else window.location.href="sms:"+(x.tel?String(x.tel).replace(/[^+0-9]/g,""):"")+"?&body="+encodeURIComponent(txt);
  }));
  var row2=gmRow(s.body);
  row2.appendChild(gmBtn(x.actif!==false?"Désactiver le pass":"Réactiver le pass","ghost",function(){
    var actif=x.actif===false;
    Promise.all([
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"benevoles",x.id),{actif:actif}),
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"ben_pass",x.code),{actif:actif,majLe:Date.now()})
    ]).then(function(){ x.actif=actif; s.modal.remove(); benCarnetOuvrir(); }).catch(function(err){ askAlert("Erreur : "+((err&&err.code)||err)); });
  }));
}
function benCarnetOuvrir(){
  var s=gmSheet("Mes bénévoles");
  var l=document.createElement("div"); s.body.appendChild(l);
  function rendre(){
    l.innerHTML="";
    var c=BEN_CARNET||[];
    if(!c.length) l.innerHTML='<div style="font-size:12.5px;color:var(--mut);padding:6px 0 10px">Aucun bénévole dans le carnet. Chacun reçoit un lien perso (ou QR) pour voir ses missions et confirmer.</div>';
    c.forEach(function(x){
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="display:block;width:100%;text-align:left;padding:11px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
      b.textContent="🎫 "+x.nom+(x.actif===false?" (désactivé)":"");
      b.addEventListener("click",function(){ benPassOuvrir(x); });
      l.appendChild(b);
    });
  }
  benCarnetCharger(true).then(rendre);
  gmRow(s.body).appendChild(gmBtn("+ Nouveau bénévole","primary",function(){ benNouveau().then(function(x){ if(x){ rendre(); benPassOuvrir(x); } }); }));
}

// ── Accueil : « Ce week-end, tu es à la buvette » ───────────────────
// Rappels sur l'accueil : à J-14, à J-7, puis tous les jours à partir de J-5.
// La personne peut masquer le rappel du jour (il revient au prochain rappel).
// Une mission jamais vue s'affiche tout de suite, même hors de ces jours.
function benJourLocal(d){ d=d||new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function benJoursAvant(dateIso){ var a=new Date(benJourLocal()+"T12:00:00"), b=new Date(String(dateIso).slice(0,10)+"T12:00:00"); return Math.round((b-a)/86400000); }
function benCle(x,k){ return "gm_ben_"+k+"_"+x.e.id+"_"+x.m.id; }
function benLs(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function benMesMissions(){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid) return [];
  var out=[];
  (getEvents()||[]).forEach(function(e){
    if(!e||e.cancelled||e.statut==="attente"||!e.date) return;
    benListe(e).forEach(function(m){ if(m.uid!==uid) return; var j=benJoursAvant(m.jour||e.date); if(j<0||j>14) return; out.push({e:e,m:m,j:j}); });
  });
  return out.sort(function(a,b){ return ((a.m.jour||a.e.date)+(a.m.heure||a.e.heure||"")).localeCompare((b.m.jour||b.e.date)+(b.m.heure||b.e.heure||"")); });
}
function benARappeler(x){
  var auj=benJourLocal();
  if(benLs(benCle(x,"ferme"))===auj) return false;
  return !benLs(benCle(x,"vu"))||x.j===14||x.j===7||x.j<=5;
}
function benMasquer(cle,refId,marge){ benLs(cle,benJourLocal()); benBandeau(refId,marge); }
function benQuand(j){ return j===0?"aujourd'hui":j===1?"demain":"dans "+j+" jours"; }
// Bandeau inséré juste avant l'élément refId (accueil parent, coach, dirigeant).
function benBandeau(refId,marge){
  var ref=document.getElementById(refId); if(!ref||!ref.parentNode) return;
  var id="ben-"+refId, box=document.getElementById(id);
  var ms=benMesMissions().filter(benARappeler);
  if(!ms.length){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement("div"); box.id=id; ref.parentNode.insertBefore(box,ref); }
  ms.forEach(function(x){ benLs(benCle(x,"vu"),"1"); });
  var j0=ms[0].j;
  box.style.cssText="margin:"+(marge||"0 0 14px")+";padding:14px 16px;border-radius:var(--rs);background:color-mix(in srgb, #E8670A 12%, var(--card));border:1.5px solid #E8670A";
  box.innerHTML='<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#E8670A;margin-bottom:6px">🙋 '+(j0===0?"Vous êtes bénévole aujourd'hui":"Rappel : vous êtes bénévole "+benQuand(j0))+'</div>'+
    ms.map(function(x){
      var j=x.j===0?"Aujourd'hui":benJourTxt(x.e);
      return '<div style="display:flex;gap:10px;align-items:flex-start;margin-top:6px"><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:var(--txt)">'+authEsc(x.m.poste)+(x.j>1?' <span style="font-size:11px;font-weight:800;color:#E8670A">· '+benQuand(x.j)+'</span>':'')+'</div>'+
        '<div style="font-size:12px;color:var(--txt2)">'+authEsc(j.charAt(0).toUpperCase()+j.slice(1)+((x.m.heure||x.e.heure)?" à "+(x.m.heure||x.e.heure):"")+" · "+(x.e.titre||eventTypeLabel(x.e.type))+(x.e.lieu?" · "+x.e.lieu:""))+'</div></div>'+
        '<button type="button" title="Masquer ce rappel" aria-label="Masquer ce rappel" onclick="benMasquer(\''+benCle(x,"ferme")+'\',\''+refId+'\',\''+(marge||"")+'\')" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:color-mix(in srgb, #E8670A 18%, transparent);color:#E8670A;font-size:13px;font-weight:900;cursor:pointer">✕</button></div>';
    }).join("")+
    '<div style="font-size:11px;color:var(--mut);margin-top:8px">Un empêchement ? Prévenez le club au plus vite.</div>';
}
