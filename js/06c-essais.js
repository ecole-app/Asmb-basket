/* ===== 06c-essais.js — Séances d'essai : page publique du club, demandes, suivi ===== */
// Le dirigeant ouvre une page « Venir essayer » (essai_pages/{clubId}, globale,
// lisible par son lien) avec les équipes et créneaux qu'il choisit. Une famille
// y demande une séance sans créer de compte (clubs/{id}/essais, création seule).
// Le club répond par SMS (lien sms: pré-rempli, jamais d'envoi automatique) en
// fixant la séance, puis transforme l'essai en licence s'il veut s'inscrire.
// Le coach voit les essais prévus pour son équipe.

var ESSAI_URL_BASE="https://generalmanagerapp.fr/?essai=";
var ESSAI_PAGE=null, ESSAI_PAGE_TS=0;
var ESSAI_STATUTS={nouvelle:["Nouvelle","#E8670A"],planifie:["Séance prévue","#1A2E5A"],inscrit:["Inscrit","var(--grn)"],annule:["Sans suite","var(--mut)"]};

function essaiLien(){ return ESSAI_URL_BASE+encodeURIComponent(window.CURRENT_CLUB_ID||""); }
function essaiAge(naiss){
  var d=new Date(naiss); if(isNaN(d)) return "";
  var n=new Date(), a=n.getFullYear()-d.getFullYear();
  if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--;
  return a>=0&&a<100?a+" ans":"";
}
function essaiDateTxt(iso){
  var d=new Date(iso+"T12:00:00"); if(isNaN(d)) return iso||"";
  return d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
}
function chargerEssaiPage(){
  if(!window.fbGetDoc||!window.CURRENT_CLUB_ID) return Promise.resolve(null);
  return window.fbGetDoc(window.fbDoc(window.fbDb,"essai_pages",window.CURRENT_CLUB_ID)).then(function(s){
    ESSAI_PAGE=(s&&s.exists())?s.data():{actif:false,equipes:[]}; ESSAI_PAGE_TS=Date.now(); return ESSAI_PAGE;
  }).catch(function(){ return null; });
}

// ── Bloc dans Licences (dirigeant et staff) ────────────────────────
var ESSAIS_NOUVEAUX=0, ESSAIS_TS=0;
function renderEssaisAdmin(){
  var box=document.getElementById("lic-essai-box"); if(!box) return;
  if(typeof isStaffUser!=="function"||!isStaffUser()){ box.innerHTML=""; return; }
  var dir=((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0;
  if(!ESSAI_PAGE||Date.now()-ESSAI_PAGE_TS>5*60000){
    chargerEssaiPage().then(function(p){ if(p) renderEssaisAdmin(); });
    if(!ESSAI_PAGE) return;
  }
  if(Date.now()-ESSAIS_TS>60000 && window.fbGetDocs && window.fbQuery){
    ESSAIS_TS=Date.now();
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"essais"),window.fbWhere("statut","==","nouvelle")))
      .then(function(s){ var n=0; s.forEach(function(){n++;}); if(n!==ESSAIS_NOUVEAUX){ ESSAIS_NOUVEAUX=n; renderEssaisAdmin(); } })
      .catch(function(){});
  }
  var ouvert=ESSAI_PAGE.actif===true;
  if(!dir && !ouvert && !ESSAIS_NOUVEAUX){ box.innerHTML=""; return; }
  box.innerHTML=
    '<div style="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;box-shadow:0 2px 8px var(--shadow)">'+
      '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between">'+
        '<div style="font-size:13px;font-weight:800;color:var(--txt)">Séances d\'essai</div>'+
        (ouvert?'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:var(--ltg)">Page ouverte</span>'
               :'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:var(--mut);background:var(--bdr)">Page fermée</span>')+
      '</div>'+
      '<div style="font-size:11px;color:var(--mut);line-height:1.45;margin-top:6px">'+
        (ouvert?"Les familles demandent une séance d'essai depuis votre lien ou QR code, sans créer de compte."
               :"Un lien et un QR code « Venir essayer » à partager : les familles choisissent une équipe et vous laissent leur numéro.")+
      '</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">'+
        '<button onclick="ouvrirListeEssais()" style="flex:1;min-width:140px;padding:10px;border-radius:var(--rx);border:none;cursor:pointer;font-size:12px;font-weight:700;background:'+(ESSAIS_NOUVEAUX?'#E8670A;color:#fff':'var(--bdr);color:var(--txt)')+'">Demandes'+(ESSAIS_NOUVEAUX?' ('+ESSAIS_NOUVEAUX+' nouvelle'+(ESSAIS_NOUVEAUX>1?'s':'')+')':'')+'</button>'+
        (dir?'<button onclick="configurerEssais()" style="flex:1;min-width:140px;padding:10px;border-radius:var(--rx);border:none;cursor:pointer;font-size:12px;font-weight:700;background:var(--dkg);color:#fff">'+(ouvert?"Équipes et lien":"Ouvrir la page")+'</button>':'')+
      '</div>'+
    '</div>';
}

// ── Configuration de la page publique (dirigeant) ───────────────────
function configurerEssais(){
  var p=ESSAI_PAGE||{equipes:[]};
  var deja={}; (p.equipes||[]).forEach(function(e){ deja[e.id]=e; });
  var teams=getTeams();
  var s=gmSheet("Page « Venir essayer »");
  var intro=document.createElement("div");
  intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:6px";
  intro.textContent="Cochez les équipes qui accueillent des essais et indiquez leurs créneaux. Le logo, les couleurs et les réseaux du club sont repris automatiquement.";
  s.body.appendChild(intro);
  var actif=document.createElement("label");
  actif.style.cssText="display:flex;align-items:center;gap:10px;padding:12px 0;font-size:14px;font-weight:700;color:var(--txt);cursor:pointer";
  var cbA=document.createElement("input"); cbA.type="checkbox"; cbA.checked=(p.actif===true)||!p.majLe; cbA.style.cssText="width:20px;height:20px;accent-color:var(--dkg)"; // jamais configurée : ouverte par défaut
  actif.appendChild(cbA); actif.appendChild(document.createTextNode("Page ouverte aux demandes"));
  s.body.appendChild(actif);
  gmSection(s.body,"Équipes proposées");
  if(!teams.length){
    var v=document.createElement("div"); v.style.cssText="font-size:12px;color:var(--mut)"; v.textContent="Créez d'abord vos équipes.";
    s.body.appendChild(v);
  }
  var lignes=[];
  teams.forEach(function(t){
    var card=gmCard();
    var lab=document.createElement("label");
    lab.style.cssText="display:flex;align-items:center;gap:10px;font-size:13px;font-weight:700;color:var(--txt);cursor:pointer;min-height:36px";
    var cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!deja[t.id]; cb.style.cssText="width:18px;height:18px;accent-color:var(--dkg)";
    lab.appendChild(cb); lab.appendChild(document.createTextNode(t.name+(t.cat&&t.cat!==t.name?" · "+t.cat:"")));
    var inp=document.createElement("input"); inp.className="form-input"; inp.id="essai-cr-"+t.id;
    inp.placeholder="Créneaux (jour, heure, lieu)"; inp.maxLength=120;
    inp.value=(deja[t.id]&&deja[t.id].creneaux)||"";
    inp.style.marginTop="8px";
    card.appendChild(lab); card.appendChild(inp); s.body.appendChild(card);
    lignes.push({t:t,cb:cb,inp:inp});
  });
  gmSection(s.body,"Message aux familles (facultatif)");
  var msg=document.createElement("textarea"); msg.className="form-input"; msg.id="essai-msg"; msg.rows=2; msg.maxLength=200;
  msg.placeholder="";
  msg.value=p.message||"";
  s.body.appendChild(msg);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(b){
    var eq=lignes.filter(function(l){return l.cb.checked;}).map(function(l){
      return {id:String(l.t.id), nom:String(l.t.name||"").slice(0,60), cat:String(l.t.cat||"").slice(0,20), creneaux:l.inp.value.trim().slice(0,120)};
    });
    if(cbA.checked && !eq.length){ askAlert("Cochez au moins une équipe."); return; }
    var c=window.CURRENT_CLUB||{};
    var page={
      actif:cbA.checked, nom:c.name||"", logo:c.logo||null, couleur:c.couleur||null, couleur2:c.couleur2||null,
      liens:c.liens||{}, sport:c.sport||"", equipes:eq, message:msg.value.trim().slice(0,200), majLe:Date.now()
    };
    b.disabled=true;
    window.fbSetDoc(window.fbDoc(window.fbDb,"essai_pages",window.CURRENT_CLUB_ID),page).then(function(){
      ESSAI_PAGE=page; ESSAI_PAGE_TS=Date.now();
      s.modal.remove(); renderEssaisAdmin();
      if(page.actif) partagerEssais(); else showToast("Page fermée");
    }).catch(function(e){ b.disabled=false; askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
  if(p.actif) row.appendChild(gmBtn("Lien et QR code","soft",function(){ s.modal.remove(); partagerEssais(); }));
}
function partagerEssais(){
  var url=essaiLien();
  var s=gmSheet("Venir essayer");
  var t=document.createElement("div");
  t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Affichez ce QR code au gymnase, ou partagez le lien sur vos réseaux et dans vos messages.";
  var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;padding:12px;background:#fff;border-radius:var(--rs);margin-bottom:10px";
  var box=document.createElement("div");
  box.style.cssText="background:var(--card);border:1.5px dashed var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;word-break:break-all;color:var(--txt);font-family:monospace";
  box.textContent=url;
  s.body.appendChild(t); s.body.appendChild(qr); s.body.appendChild(box);
  if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:url,width:200,height:200,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(e){} }
  else qr.style.display="none";
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Partager","primary",function(){
    var txt=clubLabel()+" : venez essayer ! Demandez une séance d'essai gratuite ici : "+url;
    if(navigator.share) navigator.share({title:"Venir essayer",text:txt}).catch(function(){}); else copyToClipboard(url);
  }));
  row.appendChild(gmBtn("Copier le lien","soft",function(){ copyToClipboard(url); }));
}

// ── Liste des demandes (staff) ──────────────────────────────────────
function ouvrirListeEssais(){
  var s=gmSheet("Demandes d'essai");
  var list=document.createElement("div");
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Chargement…</div>';
  s.body.appendChild(list);
  window.fbGetDocs(window.fbCollection(window.fbDb,"essais")).then(function(snap){
    var items=[]; snap.forEach(function(d){ var v=d.data(); v._id=d.id; items.push(v); });
    var ordre={nouvelle:0,planifie:1,inscrit:2,annule:3};
    items.sort(function(a,b){
      var o=(ordre[a.statut]||0)-(ordre[b.statut]||0); if(o) return o;
      return ((b.at&&b.at.toMillis)?b.at.toMillis():0)-((a.at&&a.at.toMillis)?a.at.toMillis():0);
    });
    rendreListeEssais(list, items, s);
  }).catch(function(e){ list.innerHTML='<div style="color:var(--red);padding:16px;text-align:center">Erreur : '+authEsc((e&&e.code)||String(e))+'</div>'; });
}
function rendreListeEssais(list, items, sheet){
  list.innerHTML="";
  if(!items.length){ list.innerHTML='<div style="color:var(--mut);padding:20px;text-align:center;font-size:13px">Aucune demande pour le moment.</div>'; return; }
  items.forEach(function(it){
    var st=ESSAI_STATUTS[it.statut]||ESSAI_STATUTS.nouvelle;
    var card=gmCard();
    if(it.statut==="annule"||it.statut==="inscrit") card.style.opacity=".6";
    var h=document.createElement("div");
    h.style.cssText="display:flex;justify-content:space-between;align-items:center;gap:8px";
    var nom=document.createElement("div"); nom.style.cssText="font-size:14px;font-weight:800;color:var(--txt)";
    nom.textContent=(it.prenom||"")+(essaiAge(it.naissance)?" · "+essaiAge(it.naissance):"");
    var pill=document.createElement("span");
    pill.style.cssText="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:"+st[1];
    pill.textContent=st[0];
    h.appendChild(nom); h.appendChild(pill);
    var d=document.createElement("div"); d.style.cssText="font-size:12px;color:var(--txt2);line-height:1.5;margin-top:4px";
    d.textContent=(it.equipeNom||"")+" · "+(it.parentNom||"")+" · "+(it.tel||"");
    card.appendChild(h); card.appendChild(d);
    if(it.seance&&it.seance.date){
      var se=document.createElement("div"); se.style.cssText="font-size:12px;color:var(--dkg);font-weight:700;margin-top:4px";
      se.textContent="Séance : "+essaiDateTxt(it.seance.date)+(it.seance.heure?" · "+it.seance.heure:"");
      card.appendChild(se);
    }
    if(it.message){
      var m=document.createElement("div"); m.style.cssText="font-size:12px;color:var(--mut);font-style:italic;margin-top:4px";
      m.textContent="« "+it.message+" »"; card.appendChild(m);
    }
    var row=gmRow(card);
    if(it.statut!=="inscrit"){
      row.appendChild(gmBtn(it.statut==="planifie"?"Changer la séance":"Répondre par SMS","primary",function(){ repondreEssai(it, function(){ sheet.modal.remove(); ouvrirListeEssais(); }); }));
      row.appendChild(gmBtn("Inscrire","soft",function(){ inscrireDepuisEssai(it, function(){ sheet.modal.remove(); ouvrirListeEssais(); }); }));
      if(it.statut!=="annule") row.appendChild(gmBtn("Sans suite","ghost",function(){
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"essais",it._id),{statut:"annule"}).then(function(){ it.statut="annule"; ESSAIS_TS=0; rendreListeEssais(list,items,sheet); renderEssaisAdmin(); });
      }));
    }
    row.appendChild(gmBtn("Supprimer","danger",function(){
      askConfirm("Supprimer cette demande d'essai ? Le numéro de la famille sera effacé.",{danger:true,confirmText:"Supprimer"}).then(function(ok){
        if(!ok) return;
        window.fbDeleteDoc(window.fbDoc(window.fbDb,"essais",it._id)).then(function(){
          items.splice(items.indexOf(it),1); ESSAIS_TS=0; rendreListeEssais(list,items,sheet); renderEssaisAdmin();
        });
      });
    }));
    list.appendChild(card);
  });
}

// Prochains entraînements de l'équipe (planning) pour proposer une date.
function essaiProchainesSeances(equipeNom){
  var auj=new Date().toISOString().slice(0,10);
  var n=String(equipeNom||"").toUpperCase();
  return (typeof getEvents==="function"?getEvents():[]).filter(function(e){
    return e.type==="entrainement" && !e.cancelled && e.date>=auj && e.equipe && String(e.equipe).toUpperCase().indexOf(n)>=0;
  }).sort(function(a,b){ return a.date>b.date?1:-1; }).slice(0,6);
}
function repondreEssai(it, fini){
  var s=gmSheet("Séance d'essai de "+(it.prenom||""));
  var choix=it.seance||null;
  var seances=essaiProchainesSeances(it.equipeNom);
  gmSection(s.body,"Quand ?", seances.length?"Prochains entraînements "+(it.equipeNom||""):"Aucun entraînement planifié pour cette équipe : choisissez une date.");
  var chips=document.createElement("div"); chips.style.cssText="display:flex;flex-direction:column;gap:6px";
  var autre=document.createElement("div"); autre.style.cssText="display:flex;gap:8px;margin-top:8px";
  var iD=document.createElement("input"); iD.type="date"; iD.className="form-input"; iD.style.flex="1";
  var iH=document.createElement("input"); iH.type="text"; iH.className="form-input"; iH.placeholder="Heure"; iH.style.flex="1"; iH.maxLength=30;
  var iL=document.createElement("input"); iL.type="text"; iL.className="form-input"; iL.placeholder="Lieu"; iL.maxLength=80; iL.style.marginTop="8px";
  autre.appendChild(iD); autre.appendChild(iH);
  var txt=document.createElement("textarea"); txt.className="form-input"; txt.rows=4; txt.style.marginTop="6px";
  function message(){
    var c=choix||{};
    var club=clubLabel("")||"Le club";
    var quand=c.date?essaiDateTxt(c.date)+(c.heure?" à "+c.heure:""):"[date]";
    var p=(ESSAI_PAGE&&ESSAI_PAGE.message)?" "+ESSAI_PAGE.message.replace(/[.\s]*$/,"")+".":"";
    return club+" : bonjour "+(String(it.parentNom||"").split(/\s+/)[0]||"")+", on attend "+(it.prenom||"votre enfant")+" pour une séance d'essai "+quand+(c.lieu?", "+c.lieu:"")+"."+p+" À bientôt !";
  }
  function peindre(){
    chips.innerHTML="";
    seances.forEach(function(e){
      var on=choix&&choix.eventId===e.id;
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="text-align:left;padding:10px 12px;border-radius:var(--rx);font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt)");
      b.textContent=essaiDateTxt(e.date)+(e.heure?" · "+e.heure:"")+(e.lieu?" · "+e.lieu:"");
      b.addEventListener("click",function(){ choix={eventId:e.id,date:e.date,heure:e.heure||"",lieu:e.lieu||""}; iD.value=""; peindre(); });
      chips.appendChild(b);
    });
    txt.value=message();
  }
  function libre(){ if(iD.value){ choix={eventId:null,date:iD.value,heure:iH.value.trim(),lieu:iL.value.trim()}; peindre(); } }
  [iD,iH,iL].forEach(function(x){ x.addEventListener("change",libre); x.addEventListener("input",libre); });
  s.body.appendChild(chips);
  var lab=document.createElement("div"); lab.style.cssText="font-size:11px;color:var(--mut);margin-top:10px"; lab.textContent="Ou une autre date :";
  s.body.appendChild(lab); s.body.appendChild(autre); s.body.appendChild(iL);
  gmSection(s.body,"Message","Vous pouvez le modifier avant l'envoi.");
  s.body.appendChild(txt);
  peindre();
  var go=gmBtn("Ouvrir le SMS","primary",function(b){
    if(!choix||!choix.date){ askAlert("Choisissez la date de la séance."); return; }
    b.disabled=true;
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"essais",it._id),{statut:"planifie",seance:choix,repondueLe:Date.now()}).then(function(){
      ESSAIS_TS=0; s.modal.remove(); if(fini) fini();
      window.location.href="sms:"+String(it.tel||"").replace(/[^+0-9]/g,"")+"?&body="+encodeURIComponent(txt.value);
    }).catch(function(e){ b.disabled=false; askAlert("Erreur : "+((e&&e.code)||e)); });
  });
  go.style.cssText+=";width:100%;padding:14px;border-radius:var(--rx);font-size:14px;margin-top:14px";
  s.body.appendChild(go);
}
// Essai concluant : une licence « Envoyée » est créée, et le lien de la fiche
// part par SMS (le code est dans le lien, comme pour le mail d'inscription).
function inscrireDepuisEssai(it, fini){
  if(typeof verifierLimiteLicences==="function" && !verifierLimiteLicences()) return;
  var lics=getLicences();
  var deja=lics.find(function(l){ return l.essaiId===it._id; });
  var lic=deja||{
    id:Date.now().toString(), code:genCode(), email:"", nomDest:it.parentNom||"",
    statut:"envoyee", createdAt:Date.now(), ouvertLe:null, fiche:null, categorie:null,
    saison:getCurrentSeason(), essaiId:it._id
  };
  if(!deja){ lics.push(lic); if(saveLicences(lics)===false) return; }
  var url="https://generalmanagerapp.fr/?inscription=1&code="+encodeURIComponent(lic.code);
  var txt=(clubLabel("")||"Le club")+" : pour inscrire "+(it.prenom||"votre enfant")+", remplissez sa fiche ici : "+url;
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"essais",it._id),{statut:"inscrit",licenceCode:lic.code}).catch(function(){});
  ESSAIS_TS=0;
  if(typeof buildLicences==="function") buildLicences();
  askConfirm("Fiche d'inscription créée pour "+(it.prenom||"l'enfant")+". Envoyer le lien à "+(it.parentNom||"la famille")+" par SMS ?",{confirmText:"Ouvrir le SMS"}).then(function(ok){
    if(fini) fini();
    if(ok) window.location.href="sms:"+String(it.tel||"").replace(/[^+0-9]/g,"")+"?&body="+encodeURIComponent(txt);
  });
}

// ── Coach : essais prévus pour son équipe ───────────────────────────
function renderEssaisCoach(team){
  var box=document.getElementById("coach-essais"); if(!box) return;
  box.innerHTML="";
  if(!team||!window.fbGetDocs||!window.fbQuery) return;
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"essais"),window.fbWhere("equipeId","==",String(team.id))))
    .then(function(snap){
      var auj=new Date().toISOString().slice(0,10), l=[];
      snap.forEach(function(d){ var v=d.data(); if(v.statut==="planifie"&&v.seance&&v.seance.date>=auj) l.push(v); });
      if(!l.length) return;
      l.sort(function(a,b){ return a.seance.date>b.seance.date?1:-1; });
      var c=document.createElement("div");
      c.style.cssText="margin:0 12px 12px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid var(--ltg);border-radius:var(--rs);padding:12px 14px";
      var t=document.createElement("div"); t.style.cssText="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:6px";
      t.textContent="Séances d'essai prévues ("+l.length+")";
      c.appendChild(t);
      l.forEach(function(v){
        var r=document.createElement("div"); r.style.cssText="font-size:12px;color:var(--txt2);padding:3px 0";
        r.textContent=(v.prenom||"")+(essaiAge(v.naissance)?" ("+essaiAge(v.naissance)+")":"")+" · "+essaiDateTxt(v.seance.date)+(v.seance.heure?" · "+v.seance.heure:"");
        c.appendChild(r);
      });
      box.appendChild(c);
    }).catch(function(){});
}

// ── Page publique (?essai=clubId), sans compte ──────────────────────
function showEssaiPublic(clubId){
  clubId=String(clubId||"").replace(/[^a-z0-9-]/gi,"").slice(0,60);
  var nav=document.getElementById("bnav-main"); if(nav) nav.style.display="none";
  ["hdr-settings-btn","hdr-profile-btn"].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display="none"; });
  stack=["essai"]; showScr("essai");
  var el=document.getElementById("essai-public-content"); if(!el) return;
  el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--mut)">Chargement…</div>';
  var essais=0;
  (function attendre(){
    if(!window.fbGetDoc||!window.fbDb){ if(essais++<60){ setTimeout(attendre,100); return; } el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); return; }
    window.fbGetDoc(window.fbDoc(window.fbDb,"essai_pages",clubId)).then(function(snap){
      if(!snap.exists()){ el.innerHTML=essaiErreur("Cette page n'existe pas. Vérifiez le lien reçu."); return; }
      var p=snap.data();
      window.CURRENT_CLUB_ID=clubId;
      window.CURRENT_CLUB={id:clubId,name:p.nom||"",logo:(typeof p.logo==="string"&&/^data:image\//.test(p.logo))?p.logo:null,couleur:p.couleur||null,couleur2:p.couleur2||null,liens:p.liens||{}};
      if(typeof applyClubColor==="function") applyClubColor();
      try{ document.title=(p.nom||"Club")+" · Venir essayer"; }catch(e){}
      if(p.actif!==true||!(p.equipes||[]).length){
        el.innerHTML=essaiEntete(p)+essaiErreur("Les demandes d'essai sont fermées pour le moment. Contactez directement le club.")+'<div style="padding:0 16px 24px">'+clubLiensHtml()+'</div>';
        return;
      }
      rendreFormEssai(el,p);
    }).catch(function(){ el.innerHTML=essaiErreur("Connexion impossible. Réessayez dans un instant."); });
  })();
}
function essaiErreur(t){ return '<div style="padding:30px 20px;text-align:center;font-size:14px;color:var(--txt2);line-height:1.5">'+authEsc(t)+'</div>'; }
function essaiEntete(p){
  return '<div style="background:var(--herograd,var(--dkg));background:linear-gradient(135deg,var(--dkg),var(--ltg));color:#fff;padding:22px 18px;display:flex;align-items:center;gap:14px">'+
    '<div style="flex-shrink:0;background:rgba(255,255,255,.95);border-radius:14px;padding:4px">'+clubLogoHtml(52)+'</div>'+
    '<div style="min-width:0"><div style="font-size:12px;opacity:.85;font-weight:700;text-transform:uppercase;letter-spacing:1px">Venir essayer</div>'+
    '<div style="font-size:20px;font-weight:900;line-height:1.15">'+authEsc(p.nom||"")+'</div></div></div>';
}
function rendreFormEssai(el,p){
  var eqId=(p.equipes.length===1)?p.equipes[0].id:null;
  el.innerHTML=essaiEntete(p)+
    '<div style="padding:16px 16px 40px">'+
      '<div style="font-size:14px;color:var(--txt2);line-height:1.5;margin-bottom:14px">Une séance d\'essai gratuite, sans engagement. Laissez-nous vos coordonnées : le club vous recontacte par SMS pour fixer le jour.</div>'+
      '<div class="form-label" style="margin-bottom:8px">Équipe</div><div id="essai-eqs" style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px"></div>'+
      '<div class="form-group"><label class="form-label" for="essai-prenom">Prénom de l\'enfant (ou le vôtre)</label><input class="form-input" id="essai-prenom" maxlength="40" autocomplete="off"></div>'+
      '<div class="form-group"><label class="form-label" for="essai-naiss">Date de naissance</label><input class="form-input" id="essai-naiss" type="date"></div>'+
      '<div class="form-group"><label class="form-label" for="essai-parent">Votre nom</label><input class="form-input" id="essai-parent" maxlength="60" autocomplete="name"></div>'+
      '<div class="form-group"><label class="form-label" for="essai-tel">Votre téléphone</label><input class="form-input" id="essai-tel" type="tel" maxlength="20" autocomplete="tel" placeholder="0612345678"></div>'+
      '<div class="form-group"><label class="form-label" for="essai-msg-f">Un message pour le club (facultatif)</label><textarea class="form-input" id="essai-msg-f" rows="2" maxlength="300"></textarea></div>'+
      '<input id="essai-hp" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-5000px;width:1px;height:1px;opacity:0">'+
      (p.message?'<div style="font-size:12px;color:var(--mut);margin-bottom:12px">'+authEsc(p.message)+'</div>':'')+
      '<button id="essai-envoyer" style="width:100%;padding:15px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:15px;font-weight:800;border:none;cursor:pointer">Demander une séance d\'essai</button>'+
      '<div style="font-size:11px;color:var(--mut);line-height:1.45;margin-top:10px">Vos coordonnées servent uniquement au club pour organiser la séance. Elles ne sont ni publiées ni transmises.</div>'+
      '<div style="margin-top:24px">'+clubLiensHtml()+'</div>'+
    '</div>';
  var box=document.getElementById("essai-eqs");
  function peindre(){
    box.innerHTML="";
    p.equipes.forEach(function(e){
      var on=eqId===e.id;
      var b=document.createElement("button"); b.type="button";
      b.style.cssText="text-align:left;padding:12px 14px;border-radius:var(--rs);cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--dkg) 8%, var(--card))":"var(--card)")+";color:var(--txt)";
      var n=document.createElement("div"); n.style.cssText="font-size:14px;font-weight:800"; n.textContent=(on?"✓ ":"")+(e.nom||"");
      b.appendChild(n);
      if(e.creneaux){ var c=document.createElement("div"); c.style.cssText="font-size:12px;color:var(--mut);margin-top:2px"; c.textContent=e.creneaux; b.appendChild(c); }
      b.addEventListener("click",function(){ eqId=e.id; peindre(); });
      box.appendChild(b);
    });
  }
  peindre();
  document.getElementById("essai-envoyer").addEventListener("click",function(){
    var btn=this;
    if(document.getElementById("essai-hp").value){ el.innerHTML=essaiEntete(p)+essaiMerci(""); return; }
    var v=function(id){ return String((document.getElementById(id)||{}).value||"").trim(); };
    var eq=p.equipes.find(function(e){return e.id===eqId;});
    var tel=v("essai-tel").replace(/[\s.\-()]/g,"");
    if(!eq) return askAlert("Choisissez une équipe.");
    if(!v("essai-prenom")) return askAlert("Indiquez le prénom.");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v("essai-naiss"))) return askAlert("Indiquez la date de naissance.");
    if(v("essai-parent").length<2) return askAlert("Indiquez votre nom.");
    if(!/^[+]?[0-9]{9,15}$/.test(tel)) return askAlert("Numéro de téléphone invalide.");
    btn.disabled=true; btn.textContent="Envoi…";
    window.fbAddDoc(window.fbCollection(window.fbDb,"essais"),{
      equipeId:String(eq.id), equipeNom:String(eq.nom||"").slice(0,60), prenom:v("essai-prenom").slice(0,40),
      naissance:v("essai-naiss"), parentNom:v("essai-parent").slice(0,60), tel:tel,
      message:v("essai-msg-f").slice(0,300), statut:"nouvelle", at:window.fbServerTimestamp()
    }).then(function(){
      el.innerHTML=essaiEntete(p)+essaiMerci(v("essai-parent"))+'<div style="padding:0 16px 24px">'+clubLiensHtml()+'</div>';
    }).catch(function(){
      btn.disabled=false; btn.textContent="Demander une séance d'essai";
      askAlert("L'envoi n'a pas fonctionné. Réessayez, ou contactez directement le club.");
    });
  });
}
function essaiMerci(nom){
  return '<div style="padding:36px 20px;text-align:center"><div style="font-size:44px;margin-bottom:10px">✅</div>'+
    '<div style="font-size:18px;font-weight:800;color:var(--txt);margin-bottom:8px">Demande envoyée'+(nom?", merci "+authEsc(String(nom).split(/\s+/)[0]):"")+' !</div>'+
    '<div style="font-size:13px;color:var(--mut);line-height:1.5;max-width:300px;margin:0 auto">Le club vous recontacte par SMS pour vous donner le jour et l\'heure de la séance.</div></div>';
}
