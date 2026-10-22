// ── Dossier du participant à un événement (extérieurs) ──────────────────────
// Le dirigeant choisit, par événement, ce qu'il demande à l'inscription publique : photo, fiche santé simple
// (allergies, points à savoir, contact d'urgence), documents à accepter, signature au doigt (le responsable
// légal signe pour un mineur). Les documents viennent de la bibliothèque du club (clubs/{id}/docs_club),
// avec des modèles génériques prêts à l'emploi, réutilisables partout.
// Le dossier est rangé à part (clubs/{id}/evt_dossiers/{code du billet}), lisible par le staff seul.
// La fiche santé est effacée 10 jours après la fin de l'événement (Cloud Function dossiersPurge).

var DOS_MODELES=[
  {id:"droit-image", titre:"Droit à l'image",
   texte:"J'autorise {club} à photographier et filmer {participant} pendant « {evenement} » et à utiliser ces images, sans contrepartie, pour sa communication (site, réseaux sociaux, affiches, presse locale). Cette autorisation peut être retirée à tout moment sur simple demande au club."},
  {id:"reglement", titre:"Règlement intérieur",
   texte:"Je m'engage à respecter les horaires, les consignes de l'encadrement, le matériel et les installations, ainsi que les autres participants. Le club peut exclure un participant dont le comportement est dangereux ou irrespectueux, sans remboursement."},
  {id:"urgence", titre:"Autorisation de soins et assurance",
   texte:"J'autorise l'encadrement de {club} à prendre toutes les mesures nécessaires en cas d'accident ou d'urgence (appel des secours, transport vers un hôpital). Je certifie que {participant} est couvert(e) par une assurance responsabilité civile."}
];
var DOS_BIBLIO=null;
var DOS_SANTE_JOURS=10;

function dosTexte(t, ctx){
  return String(t||"").replace(/\{club\}/g,ctx.club||"le club").replace(/\{participant\}/g,ctx.participant||"le participant").replace(/\{evenement\}/g,ctx.evenement||"l'événement");
}
function dosPlusJours(iso,n){ var d=new Date(iso+"T12:00:00"); d.setDate(d.getDate()+n); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2)+"-"+("0"+d.getDate()).slice(-2); }

// ── Bibliothèque des documents du club ─────────────────────────────────────
function dosBiblioCharger(force){
  if(DOS_BIBLIO&&!force) return Promise.resolve(DOS_BIBLIO);
  if(!window.fbGetDocs||!window.fbDb) return Promise.resolve(DOS_MODELES.slice());
  return window.fbGetDocs(window.fbCollection(window.fbDb,"docs_club")).then(function(sn){
    var l=[]; sn.forEach(function(d){ var x=d.data()||{}; x.id=d.id; l.push(x); });
    l.sort(function(a,b){ return (a.ordre||0)-(b.ordre||0); });
    DOS_BIBLIO=l.length?l:DOS_MODELES.map(function(m){ return Object.assign({modele:true},m); });
    return DOS_BIBLIO;
  }).catch(function(){ return DOS_MODELES.slice(); });
}
function dosBibliotheque(apres){
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.indexOf("dirigeant")<0){ askAlert("Seul le dirigeant modifie les documents du club."); return; }
  dosBiblioCharger(true).then(function(liste){
    var docs=liste.map(function(d){ return {id:d.id,titre:d.titre||"",texte:d.texte||""}; });
    var s=gmSheet("Documents du club");
    var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);line-height:1.5;margin-bottom:10px";
    info.textContent="Textes que les participants acceptent en s'inscrivant. Modèles génériques prêts à l'emploi : relisez-les et adaptez-les à votre club. {club}, {participant} et {evenement} sont remplacés automatiquement.";
    s.body.appendChild(info);
    var box=document.createElement("div"); s.body.appendChild(box);
    function peindre(){
      box.innerHTML="";
      docs.forEach(function(d,i){
        var c=gmCard();
        var t=document.createElement("input"); t.className="form-input"; t.maxLength=80; t.value=d.titre; t.placeholder="Titre du document"; t.style.marginBottom="6px";
        t.addEventListener("input",function(){ d.titre=t.value; });
        var x=document.createElement("textarea"); x.className="form-input"; x.rows=5; x.maxLength=3000; x.value=d.texte;
        x.addEventListener("input",function(){ d.texte=x.value; });
        c.appendChild(t); c.appendChild(x);
        var r=gmRow(c);
        r.appendChild(gmBtn("Retirer","danger",function(){ docs.splice(i,1); peindre(); }));
        box.appendChild(c);
      });
      if(docs.length<10){
        var add=gmBtn("+ Ajouter un document","soft",function(){ docs.push({id:"d"+Date.now().toString(36),titre:"",texte:""}); peindre(); });
        box.appendChild(add);
      }
    }
    peindre();
    var row=gmRow(s.body);
    row.appendChild(gmBtn("Enregistrer","primary",function(b){
      var propres=docs.filter(function(d){ return String(d.titre).trim()&&String(d.texte).trim(); });
      b.disabled=true;
      var anciens=liste.filter(function(d){ return !d.modele; }).map(function(d){ return d.id; });
      var bt=window.fbWriteBatch();
      anciens.forEach(function(id){ if(!propres.some(function(d){ return d.id===id; })) bt.delete(window.fbDoc(window.fbDb,"docs_club",id)); });
      propres.forEach(function(d,k){ bt.set(window.fbDoc(window.fbDb,"docs_club",d.id),{titre:String(d.titre).trim().slice(0,80),texte:String(d.texte).trim().slice(0,3000),ordre:k,majLe:Date.now()}); });
      bt.commit().then(function(){ DOS_BIBLIO=null; s.modal.remove(); showToast("Documents enregistrés"); if(apres) apres(); })
        .catch(function(e){ b.disabled=false; askAlert("Erreur : "+((e&&e.code)||e)); });
    }));
  });
}

// ── Réglage par événement (dans « Inscriptions ») ──────────────────────────
// Renvoie {get()} : l'état choisi, sauvé dans e.inscr.dossier.
function dosConfigSection(host, actuel){
  var etat={photo:!!(actuel&&actuel.photo), sante:!!(actuel&&actuel.sante), signature:!!(actuel&&actuel.signature), docs:((actuel&&actuel.docs)||[]).slice()};
  gmSection(host,"Dossier du participant","Ce que vous demandez à l'inscription, en plus des coordonnées. Visible par le staff seul.");
  var opts=document.createElement("div"); opts.style.cssText="display:flex;flex-direction:column;gap:6px;margin-bottom:8px"; host.appendChild(opts);
  [["photo","Photo du participant"],["sante","Fiche santé (allergies, points à savoir, contact d'urgence), effacée "+DOS_SANTE_JOURS+" jours après l'événement"],["signature","Signature (du responsable légal pour un mineur)"]].forEach(function(o){
    var l=document.createElement("label"); l.style.cssText="display:flex;align-items:flex-start;gap:10px;font-size:13px;color:var(--txt);cursor:pointer;line-height:1.35";
    var c=document.createElement("input"); c.type="checkbox"; c.checked=etat[o[0]]; c.style.cssText="width:18px;height:18px;accent-color:var(--dkg);flex-shrink:0";
    c.addEventListener("change",function(){ etat[o[0]]=c.checked; });
    l.appendChild(c); l.appendChild(document.createTextNode(o[1])); opts.appendChild(l);
  });
  var dl=document.createElement("div"); dl.style.cssText="font-size:12px;font-weight:800;color:var(--txt);margin:6px 0 4px"; dl.textContent="Documents à accepter"; host.appendChild(dl);
  var dBox=document.createElement("div"); dBox.innerHTML='<div style="font-size:12px;color:var(--mut)">Chargement…</div>'; host.appendChild(dBox);
  function peindre(){
    dosBiblioCharger().then(function(l){
      dBox.innerHTML="";
      l.forEach(function(d){
        var lab=document.createElement("label"); lab.style.cssText="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--txt);cursor:pointer;padding:3px 0";
        var c=document.createElement("input"); c.type="checkbox"; c.checked=etat.docs.indexOf(d.id)>=0; c.style.cssText="width:18px;height:18px;accent-color:var(--dkg)";
        c.addEventListener("change",function(){ etat.docs=etat.docs.filter(function(x){ return x!==d.id; }); if(c.checked) etat.docs.push(d.id); });
        lab.appendChild(c); lab.appendChild(document.createTextNode(d.titre)); dBox.appendChild(lab);
      });
      var g=document.createElement("button"); g.type="button"; g.textContent="Modifier les documents du club";
      g.style.cssText="border:none;background:none;color:var(--dkg);font-size:12px;font-weight:700;cursor:pointer;padding:6px 0";
      g.addEventListener("click",function(){ dosBibliotheque(peindre); });
      dBox.appendChild(g);
    });
  }
  peindre();
  return {get:function(){ return (etat.photo||etat.sante||etat.signature||etat.docs.length)?{photo:etat.photo,sante:etat.sante,signature:etat.signature,docs:etat.docs.slice(0,10)}:null; }};
}
// Version publiée sur la page de l'événement : textes des documents recopiés (la page est lisible sans compte).
function dosPagePublique(e, d){
  if(!d) return Promise.resolve(null);
  return dosBiblioCharger().then(function(l){
    var docs=(d.docs||[]).map(function(id){ return l.find(function(x){ return x.id===id; }); }).filter(Boolean)
      .map(function(x){ return {id:String(x.id).slice(0,40), titre:String(x.titre).slice(0,80), texte:String(x.texte).slice(0,3000)}; });
    return {photo:!!d.photo, sante:!!d.sante, signature:!!d.signature, docs:docs, purgeLe:dosPlusJours(e.dateFin||e.date||new Date().toISOString().slice(0,10), DOS_SANTE_JOURS)};
  });
}

// ── Formulaire public ──────────────────────────────────────────────────────
function dosAgeA(naiss, dateIso){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(naiss||"")) return null;
  var n=new Date(naiss+"T12:00:00"), d=new Date((dateIso||new Date().toISOString().slice(0,10))+"T12:00:00");
  var a=d.getFullYear()-n.getFullYear(); if(d.getMonth()<n.getMonth()||(d.getMonth()===n.getMonth()&&d.getDate()<n.getDate())) a--; return a;
}
function dosReduirePhoto(file){
  return new Promise(function(ok,ko){
    var fr=new FileReader();
    fr.onload=function(){ var img=new Image(); img.onload=function(){
      var m=320, k=Math.min(1,m/Math.max(img.width,img.height)), c=document.createElement("canvas");
      c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height); ok(c.toDataURL("image/jpeg",0.8));
    }; img.onerror=ko; img.src=fr.result; };
    fr.onerror=ko; fr.readAsDataURL(file);
  });
}
// Zone de signature au doigt / à la souris.
function dosPadSignature(host){
  var c=document.createElement("canvas"); c.width=600; c.height=200;
  c.style.cssText="width:100%;height:150px;background:#fff;border:1.5px dashed var(--bdr);border-radius:12px;touch-action:none;display:block";
  c.setAttribute("aria-label","Zone de signature");
  host.appendChild(c);
  var ctx=c.getContext("2d"), trace=false, vide=true, dernier=null;
  ctx.lineWidth=3; ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111";
  function pt(ev){ var r=c.getBoundingClientRect(); return {x:(ev.clientX-r.left)*c.width/r.width, y:(ev.clientY-r.top)*c.height/r.height}; }
  c.addEventListener("pointerdown",function(ev){ ev.preventDefault(); trace=true; dernier=pt(ev); try{ c.setPointerCapture(ev.pointerId); }catch(x){} });
  c.addEventListener("pointermove",function(ev){ if(!trace) return; var p=pt(ev); ctx.beginPath(); ctx.moveTo(dernier.x,dernier.y); ctx.lineTo(p.x,p.y); ctx.stroke(); dernier=p; vide=false; });
  ["pointerup","pointercancel","pointerleave"].forEach(function(t){ c.addEventListener(t,function(){ trace=false; }); });
  var eff=document.createElement("button"); eff.type="button"; eff.textContent="Effacer la signature";
  eff.style.cssText="border:none;background:none;color:var(--mut);font-size:12px;font-weight:700;cursor:pointer;padding:6px 0";
  eff.addEventListener("click",function(){ ctx.clearRect(0,0,c.width,c.height); vide=true; });
  host.appendChild(eff);
  return {vide:function(){ return vide; }, image:function(){ return c.toDataURL("image/png"); }};
}
// Bloc du formulaire public. Renvoie {lire(data)} : l'objet dossier, ou null (avec une alerte) s'il manque quelque chose.
function dosFormPublic(host, p){
  var d=p.dossier; if(!host||!d) return null;
  var h='<div class="form-label" style="margin:6px 0 8px">Dossier du participant</div>';
  if(d.photo) h+='<div class="form-group"><label class="form-label" for="dos-photo">Photo du participant (facultatif)</label><input class="form-input" id="dos-photo" type="file" accept="image/*"><img id="dos-photo-ap" alt="" style="display:none;margin-top:8px;width:84px;height:84px;object-fit:cover;border-radius:12px"></div>';
  if(d.sante) h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;margin-bottom:14px">'
    +'<div style="font-size:13px;font-weight:800;margin-bottom:4px">Fiche santé</div><div style="font-size:11px;color:var(--mut);line-height:1.4;margin-bottom:8px">Vue par l\'encadrement seulement, effacée '+DOS_SANTE_JOURS+' jours après l\'événement.</div>'
    +'<div class="form-group"><label class="form-label" for="dos-allergies">Allergies (alimentaires, médicaments…)</label><textarea class="form-input" id="dos-allergies" rows="2" maxlength="300" placeholder="Aucune"></textarea></div>'
    +'<div class="form-group"><label class="form-label" for="dos-infos">Autres points à savoir (traitement, asthme…)</label><textarea class="form-input" id="dos-infos" rows="2" maxlength="300" placeholder="Rien de particulier"></textarea></div>'
    +'<div class="form-group"><label class="form-label" for="dos-urg-nom">Contact en cas d\'urgence</label><input class="form-input" id="dos-urg-nom" maxlength="60" placeholder="Nom"></div>'
    +'<div class="form-group" style="margin-bottom:0"><label class="form-label" for="dos-urg-tel">Téléphone d\'urgence</label><input class="form-input" id="dos-urg-tel" type="tel" maxlength="20" placeholder="0612345678"></div></div>';
  (d.docs||[]).forEach(function(x,i){
    h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;margin-bottom:10px">'
      +'<div style="font-size:13px;font-weight:800;margin-bottom:6px">'+authEsc(x.titre)+'</div>'
      +'<div class="dos-doc-txt" data-i="'+i+'" style="font-size:12px;color:var(--txt2);line-height:1.5;white-space:pre-line;max-height:120px;overflow-y:auto"></div>'
      +'<label style="display:flex;align-items:center;gap:10px;margin-top:8px;font-size:13px;font-weight:700;cursor:pointer"><input type="checkbox" class="dos-ok" data-id="'+authEsc(x.id)+'" style="width:20px;height:20px;accent-color:var(--dkg)">J\'ai lu et j\'accepte</label></div>';
  });
  if(d.signature) h+='<div class="form-group"><label class="form-label" id="dos-sig-lab">Signature</label><div id="dos-sig"></div>'
    +'<label class="form-label" for="dos-signataire" style="margin-top:6px">Nom de la personne qui signe</label><input class="form-input" id="dos-signataire" maxlength="60"></div>';
  host.innerHTML=h;
  var ctxTxt=function(){
    var pr=String((document.getElementById("evt-prenom")||{}).value||"").trim(), nm=String((document.getElementById("evt-nom")||{}).value||"").trim();
    return {club:p.nom||"", participant:(pr+" "+nm).trim()||"le participant", evenement:p.titre||""};
  };
  function peindreTextes(){
    host.querySelectorAll(".dos-doc-txt").forEach(function(el){ var x=d.docs[+el.getAttribute("data-i")]; el.textContent=dosTexte(x.texte,ctxTxt()); });
    var lab=document.getElementById("dos-sig-lab");
    if(lab){ var a=dosAgeA((document.getElementById("evt-naiss")||{}).value,p.date); lab.textContent=(a!=null&&a<18)?"Signature du responsable légal (participant mineur)":"Signature"; }
  }
  peindreTextes();
  ["evt-prenom","evt-nom","evt-naiss"].forEach(function(id){ var el=document.getElementById(id); if(el) el.addEventListener("input",peindreTextes); });
  var photo=null, pad=d.signature?dosPadSignature(document.getElementById("dos-sig")):null;
  var fi=document.getElementById("dos-photo");
  if(fi) fi.addEventListener("change",function(){
    var f=fi.files&&fi.files[0]; if(!f) return;
    dosReduirePhoto(f).then(function(u){ photo=u; var ap=document.getElementById("dos-photo-ap"); ap.src=u; ap.style.display="block"; }).catch(function(){ askAlert("Cette image ne peut pas être lue. Essayez une autre photo."); });
  });
  return {lire:function(data){
    var v=function(id){ return String((document.getElementById(id)||{}).value||"").trim(); };
    var out={purgeLe:d.purgeLe};
    if(d.photo&&photo) out.photo=photo;
    if(d.sante){
      var ut=v("dos-urg-tel").replace(/[\s.\-()]/g,"");
      if(!v("dos-urg-nom")||!/^[+]?[0-9]{9,15}$/.test(ut)){ askAlert("Indiquez un contact d'urgence (nom et téléphone)."); return null; }
      out.sante={allergies:v("dos-allergies").slice(0,300), infos:v("dos-infos").slice(0,300), urgenceNom:v("dos-urg-nom").slice(0,60), urgenceTel:ut};
    }
    var acc=[], manque=null;
    host.querySelectorAll(".dos-ok").forEach(function(c){
      var id=c.getAttribute("data-id"), doc=(d.docs||[]).find(function(x){ return x.id===id; });
      if(c.checked) acc.push(String((doc&&doc.titre)||id).slice(0,80)); else if(!manque) manque=c;
    });
    if(manque){ askAlert("Lisez et acceptez tous les documents pour vous inscrire."); return null; }
    if(acc.length) out.docs=acc;
    if(pad){
      if(pad.vide()){ askAlert("Signez dans le cadre prévu."); return null; }
      var a=dosAgeA(data.naissance,p.date), sg=v("dos-signataire");
      if(sg.length<2){ askAlert((a!=null&&a<18)?"Indiquez le nom du responsable légal qui signe.":"Indiquez le nom de la personne qui signe."); return null; }
      out.signature=pad.image(); out.signataire=sg.slice(0,60); out.mineur=(a!=null&&a<18);
    }
    return out;
  }};
}

// ── Vue du staff ───────────────────────────────────────────────────────────
function dosVoir(x, e){
  window.fbGetDoc(window.fbDoc(window.fbDb,"evt_dossiers",x._id)).then(function(snap){
    var s=gmSheet("Dossier · "+((x.prenom||"")+" "+(x.nom||"")).trim());
    if(!snap.exists()){ s.body.innerHTML='<div style="font-size:13px;color:var(--mut)">Pas de dossier pour cette inscription (inscrite avant l\'activation du dossier, ou depuis l\'appli).</div>'; return; }
    var d=snap.data()||{}, h="";
    if(d.photo) h+='<img src="'+authEsc(d.photo)+'" alt="" style="width:110px;height:110px;object-fit:cover;border-radius:14px;margin-bottom:10px">';
    if(d.sante) h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:10px 12px;margin-bottom:10px;font-size:13px;line-height:1.5">'
      +'<b>Fiche santé</b><br>Allergies : '+authEsc(d.sante.allergies||"aucune")+'<br>À savoir : '+authEsc(d.sante.infos||"rien de particulier")
      +'<br>Urgence : '+authEsc(d.sante.urgenceNom||"")+' · <a href="tel:'+authEsc(d.sante.urgenceTel||"")+'">'+authEsc(d.sante.urgenceTel||"")+'</a></div>';
    else if(d.santePurgee) h+='<div style="font-size:12px;color:var(--mut);margin-bottom:10px">Fiche santé effacée '+DOS_SANTE_JOURS+' jours après l\'événement.</div>';
    if(d.docs&&d.docs.length) h+='<div style="font-size:13px;margin-bottom:10px"><b>Documents acceptés</b><br>'+d.docs.map(function(t){ return "✓ "+authEsc(t); }).join("<br>")+'</div>';
    if(d.signature) h+='<div style="font-size:13px"><b>Signature</b>'+(d.mineur?" (responsable légal)":"")+' : '+authEsc(d.signataire||"")+'</div><img src="'+authEsc(d.signature)+'" alt="Signature" style="width:100%;max-width:300px;background:#fff;border:1px solid var(--bdr);border-radius:10px;margin-top:6px">';
    s.body.innerHTML=h;
    var r=gmRow(s.body); r.appendChild(gmBtn("PDF du dossier","primary",function(){ dosPdf(x,e,d); }));
  }).catch(function(err){ askAlert("Erreur : "+((err&&err.code)||err)); });
}
function dosPdf(x, e, d){
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes."); return; }
  var doc=new window.jspdf.jsPDF(), y=18, nom=((x.prenom||"")+" "+(x.nom||"")).trim();
  doc.setFontSize(15); doc.setTextColor.apply(doc,clubPdfRgb()); doc.text("Dossier de "+nom,14,y); y+=7;
  doc.setFontSize(10); doc.setTextColor(90,90,90); doc.text((e.titre||"")+" · "+(e.date||"")+" · "+clubLabel(),14,y); y+=10;
  doc.setTextColor(30,30,30);
  if(d.photo){ try{ doc.addImage(d.photo,"JPEG",150,12,40,40); }catch(er){} }
  doc.text("Né(e) le : "+(x.naissance||"")+"   Téléphone : "+(x.tel||""),14,y); y+=8;
  if(d.sante){
    doc.setFont(undefined,"bold"); doc.text("Fiche santé",14,y); doc.setFont(undefined,"normal"); y+=6;
    [["Allergies",d.sante.allergies||"aucune"],["À savoir",d.sante.infos||"rien de particulier"],["Urgence",(d.sante.urgenceNom||"")+" · "+(d.sante.urgenceTel||"")]].forEach(function(l){
      var t=doc.splitTextToSize(l[0]+" : "+l[1],130); doc.text(t,14,y); y+=t.length*5+1;
    });
    y+=4;
  }
  if(d.docs&&d.docs.length){
    doc.setFont(undefined,"bold"); doc.text("Documents acceptés",14,y); doc.setFont(undefined,"normal"); y+=6;
    d.docs.forEach(function(t){ doc.text("- "+t,14,y); y+=5; }); y+=4;
  }
  if(d.signature){
    doc.setFont(undefined,"bold"); doc.text("Signature"+(d.mineur?" du responsable légal":"")+" : "+(d.signataire||""),14,y); doc.setFont(undefined,"normal"); y+=4;
    try{ doc.addImage(d.signature,"PNG",14,y,75,25); }catch(er){} y+=30;
  }
  doc.setFontSize(8); doc.setTextColor(120,120,120); doc.text("Données réservées à l'encadrement du club.",14,285);
  doc.save(clubSlug()+"_dossier_"+nom.replace(/[^a-z0-9]+/gi,"-").toLowerCase()+".pdf");
}
