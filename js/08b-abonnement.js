// ══════════════════════════════════════════════════════════════
// ABONNEMENT DU CLUB (Paramètres › Abonnement, dirigeant seul)
// Le dirigeant décide seul, avec une double confirmation (dialogue puis mot
// à taper) :
//  - Geler 1 à 3 mois : le club passe en accès limité (isLimite) pendant le
//    gel ; l'échéance est repoussée de la durée réelle du gel par la
//    Plateforme (aboTraiterGels) à la prochaine ouverture du super admin.
//  - Relancer : fin du gel tout de suite, ou annulation d'une résiliation.
//  - Résilier : prend effet à l'échéance, rien n'est coupé avant.
// Champs sur clubs/{id} (liste blanche dirigeant dans firestore.rules) :
//  aboGels [{debut,fin,mois,par,relanceLe?,reporte?}] (ms), aboGelFin (ms,
//  0 hors gel : lu par les règles pour la buvette), aboResiliation
//  {le,par,motif,effet} | null, aboNotif {t,le,vu,detail} : ce que le super
//  admin voit en bandeau dans la Plateforme (push plus tard via functions).
// ══════════════════════════════════════════════════════════════
var GM_ABO_GEL_MAX_MOIS=3;

function aboGelActif(c){
  c=c||window.CURRENT_CLUB||{};
  var now=Date.now();
  return (c.aboGels||[]).filter(function(g){ return g&&!g.relanceLe&&g.debut<=now&&g.fin>now; })[0]||null;
}
function aboDateTxt(ms){ return ms?new Date(ms).toLocaleDateString("fr-FR"):""; }
function aboEcheanceMs(c){
  var e=(typeof aboEcheance==="function")?aboEcheance(c):null;
  return e?e.getTime():null;
}
function aboPackTxt(c){
  var p=c.plan;
  if(p==="premium") return {nom:"Premium",prix:(typeof prixPremium==="function"?prixPremium():"300 €/an")};
  if(p==="standard") return {nom:"Standard",prix:"200 €/an"};
  if(p==="gratuit") return {nom:"Offre gratuite",prix:"0 €"};
  if(p==="trial") return {nom:"Essai gratuit",prix:"0 €"};
  if(p==="limite") return {nom:"Accès limité",prix:""};
  return {nom:"Complet",prix:""};
}
function aboEstPayant(c){ return c.plan==="standard"||c.plan==="premium"||c.plan==="paid"; }

// Bloc rangé dans le groupe « Abonnement » des Paramètres.
function aboBlocParam(){
  var b=document.getElementById("abo-param");
  if(!b){ b=document.createElement("div"); b.id="abo-param"; b.style.cssText="padding:4px 14px 10px"; }
  aboPeindre(b);
  return b;
}
function aboPeindre(box){
  box=box||document.getElementById("abo-param"); if(!box) return;
  var c=window.CURRENT_CLUB||{};
  var own=(c.id&&typeof BOOTSTRAP_CLUB_ID!=="undefined"&&c.id===BOOTSTRAP_CLUB_ID);
  var pk=aboPackTxt(c), ech=aboEcheanceMs(c), gel=aboGelActif(c), res=c.aboResiliation||null;
  var etat, coul;
  if(gel){ etat="⏸ Gelé jusqu'au "+aboDateTxt(gel.fin)+" (accès limité)"; coul="#8a4500"; }
  else if(res){ etat="✖ Résiliation programmée"+(res.effet?" au "+aboDateTxt(res.effet):""); coul="var(--red)"; }
  else { etat="✓ Actif"; coul="var(--grn)"; }
  box.innerHTML=
    '<div style="background:var(--bg);border-radius:var(--rs);padding:12px 14px;margin:6px 0 10px">'+
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline"><div style="font-size:15px;font-weight:800;color:var(--txt)">Pack '+authEsc(pk.nom)+'</div>'+
        (pk.prix?'<div style="font-size:13px;font-weight:700;color:var(--txt2)">'+authEsc(pk.prix)+'</div>':'')+'</div>'+
      (ech?'<div style="font-size:12.5px;color:var(--txt2);margin-top:4px">Échéance : <b>'+aboDateTxt(ech)+'</b> · reconduction tacite de 12 mois</div>':'')+
      '<div style="font-size:13px;font-weight:800;color:'+coul+';margin-top:6px">'+authEsc(etat)+'</div>'+
      (res&&res.motif?'<div style="font-size:12px;color:var(--mut);margin-top:2px">Motif : '+authEsc(res.motif)+'</div>':'')+
    '</div>';
  var row=document.createElement("div"); row.style.cssText="display:flex;flex-direction:column;gap:8px";
  function bouton(txt,style,fn){
    var x=document.createElement("button"); x.type="button"; x.textContent=txt;
    x.style.cssText="width:100%;padding:12px;border-radius:var(--rx);font-size:14px;font-weight:800;cursor:pointer;"+style;
    x.addEventListener("click",fn); row.appendChild(x);
  }
  var ro=!!window.SUPPORT_MODE;
  if(own){
    row.innerHTML='<div style="font-size:12.5px;color:var(--mut)">Club d\'origine de la plateforme : accès complet, pas d\'abonnement à gérer.</div>';
  } else if(!ro){
    if(gel) bouton("▶️ Relancer maintenant","background:var(--dkg);color:#fff;border:none",aboRelancerGel);
    else if(res) bouton("↩️ Relancer l'abonnement (annuler la résiliation)","background:var(--dkg);color:#fff;border:none",aboAnnulerResiliation);
    else {
      if(aboEstPayant(c)) bouton("⏸ Geler l'abonnement","background:var(--card);color:var(--txt);border:1.5px solid var(--bdr)",aboGeler);
      bouton("✖ Résilier l'abonnement","background:var(--card);color:var(--red);border:1.5px solid color-mix(in srgb, var(--red) 40%, var(--bdr))",aboResilier);
    }
  }
  var pied=document.createElement("div"); pied.style.cssText="font-size:12px;color:var(--mut);margin-top:10px;line-height:1.5";
  pied.innerHTML='Vos données restent exportables à tout moment : <a href="#" id="abo-export" style="color:var(--dkg);font-weight:700">Exporter mes données</a> · <a href="legal/cgv.html" target="_blank" style="color:var(--dkg);font-weight:700">CGV</a>';
  box.appendChild(row); box.appendChild(pied);
  if(!own) aboRibAfficher(box,row,c);
  var ex=box.querySelector("#abo-export");
  if(ex) ex.addEventListener("click",function(ev){ ev.preventDefault(); if(typeof openExportDonnees==="function") openExportDonnees(); });
}

// Double sécurité : 1) dialogue qui explique les conséquences, 2) mot à taper.
function aboDoubleConfirmation(texte,titre,motCle,bouton){
  return askConfirm(texte,{title:titre,danger:true,confirmText:"Continuer"}).then(function(ok){
    if(!ok) return false;
    return askPrompt("Pour confirmer, tapez "+motCle,{placeholder:motCle,confirmText:bouton}).then(function(v){
      if(v===null||v===undefined) return false;
      var n=function(s){ return String(s||"").normalize("NFD").replace(/[̀-ͯ]/g,"").trim().toUpperCase(); };
      if(n(v)!==n(motCle)){ askAlert("Mot de confirmation incorrect : rien n'a été modifié."); return false; }
      return true;
    });
  });
}
function aboEcrire(maj,toast){
  var c=window.CURRENT_CLUB||{};
  if(!c.id||!window.fbUpdateDoc) return Promise.reject(new Error("club"));
  return window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),maj).then(function(){
    Object.keys(maj).forEach(function(k){ c[k]=maj[k]; });
    aboPeindre();
    if(toast&&typeof showToast==="function") showToast(toast);
    if(typeof buildParametres==="function"){ try{ buildParamsAccordeon(); }catch(e){} }
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); throw e; });
}
function aboNotif(t,detail){ return {t:t,le:Date.now(),vu:false,detail:String(detail||"").slice(0,200)}; }
function aboPar(){ var u=window.ASMB_USER||{}; return u.uid||""; }

function aboGeler(){
  var c=window.CURRENT_CLUB||{};
  var s=gmSheet("Geler l'abonnement");
  s.body.innerHTML='<div style="font-size:13px;color:var(--txt2);line-height:1.5;margin-bottom:10px">Pendant le gel, le club passe en <b>accès limité</b> : consultation seule (licences toujours modifiables), et parents et coachs n\'ont plus accès à l\'appli. Rien n\'est supprimé. L\'échéance de l\'abonnement est repoussée de la durée du gel. Vous pouvez relancer à tout moment.</div>'+
    '<div style="font-size:12px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">Durée du gel</div>';
  var choix=1, wrap=document.createElement("div"); wrap.style.cssText="display:flex;gap:8px;margin-bottom:12px";
  function peindre(){
    wrap.innerHTML="";
    for(var m=1;m<=GM_ABO_GEL_MAX_MOIS;m++)(function(m){
      var b=document.createElement("button"); b.type="button"; b.textContent=m+" mois";
      var on=m===choix;
      b.style.cssText="flex:1;padding:12px;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--dkg) 12%, var(--card))":"var(--card)")+";color:var(--txt)";
      b.addEventListener("click",function(){ choix=m; peindre(); });
      wrap.appendChild(b);
    })(m);
  }
  peindre(); s.body.appendChild(wrap);
  s.body.appendChild(gmBtn("Geler","primary",function(){
    var debut=Date.now(), finD=new Date(debut); finD.setMonth(finD.getMonth()+choix);
    var fin=finD.getTime();
    aboDoubleConfirmation("Geler l'abonnement de "+(c.name||"votre club")+" pendant "+choix+" mois, jusqu'au "+aboDateTxt(fin)+" ?\n\nLe club passera en accès limité dès maintenant.","Geler l'abonnement","GELER","Geler").then(function(ok){
      if(!ok) return;
      var gels=(c.aboGels||[]).slice(-20).concat([{debut:debut,fin:fin,mois:choix,par:aboPar()}]);
      aboEcrire({aboGels:gels,aboGelFin:fin,aboNotif:aboNotif("gel",choix+" mois, jusqu'au "+aboDateTxt(fin))},"Abonnement gelé jusqu'au "+aboDateTxt(fin))
        .then(function(){ s.modal.remove(); }).catch(function(){});
    });
  }));
}
function aboRelancerGel(){
  var c=window.CURRENT_CLUB||{};
  askConfirm("Relancer l'abonnement maintenant ? Le club retrouve tous ses modules tout de suite.",{title:"Relancer",confirmText:"Relancer"}).then(function(ok){
    if(!ok) return;
    var now=Date.now();
    var gels=(c.aboGels||[]).map(function(g){ return (g&&!g.relanceLe&&g.debut<=now&&g.fin>now)?Object.assign({},g,{relanceLe:now}):g; });
    aboEcrire({aboGels:gels,aboGelFin:0,aboNotif:aboNotif("relance","fin du gel le "+aboDateTxt(now))},"Abonnement relancé").catch(function(){});
  });
}
function aboResilier(){
  var c=window.CURRENT_CLUB||{};
  var ech=aboEcheanceMs(c);
  var quand=ech?"le "+aboDateTxt(ech)+" (échéance)":"à la fin de la période en cours";
  askPrompt("Pourquoi souhaitez-vous résilier ? (facultatif)",{placeholder:"",confirmText:"Suivant"}).then(function(motif){
    if(motif===null||motif===undefined) return;
    aboDoubleConfirmation("Résilier l'abonnement de "+(c.name||"votre club")+" ?\n\nLa résiliation prendra effet "+quand+". D'ici là, tout reste ouvert. Pensez à exporter vos données avant cette date.\n\nVous pourrez annuler la résiliation tant qu'elle n'a pas pris effet.","Résilier l'abonnement","RESILIER","Résilier").then(function(ok){
      if(!ok) return;
      aboEcrire({aboResiliation:{le:Date.now(),par:aboPar(),motif:String(motif||"").trim().slice(0,300),effet:ech||null},
        aboNotif:aboNotif("resiliation","effet "+(ech?aboDateTxt(ech):"fin de période")+(motif?" · "+String(motif).trim().slice(0,120):""))},"Résiliation enregistrée").catch(function(){});
    });
  });
}
function aboAnnulerResiliation(){
  askConfirm("Annuler la résiliation ? L'abonnement continue normalement.",{title:"Relancer l'abonnement",confirmText:"Relancer"}).then(function(ok){
    if(!ok) return;
    aboEcrire({aboResiliation:null,aboNotif:aboNotif("annulation","résiliation annulée")},"Abonnement relancé").catch(function(){});
  });
}

// ── Côté Plateforme (super admin) ─────────────────────────────────────
var ABO_NOTIF_TXT={gel:"⏸ a gelé son abonnement",relance:"▶️ a relancé son abonnement",resiliation:"✖ a résilié son abonnement",annulation:"↩️ a annulé sa résiliation"};
function aboEtatCourt(c){
  var g=aboGelActif(c);
  if(g) return '<span style="color:#8a4500">gelé jusqu\'au '+aboDateTxt(g.fin)+'</span>';
  if(c.aboResiliation) return '<span style="color:var(--red)">résilié'+(c.aboResiliation.effet?' au '+aboDateTxt(c.aboResiliation.effet):'')+'</span>';
  return "";
}
// Gels terminés (date de fin passée ou relance) : l'échéance est repoussée
// de la durée réelle du gel, une seule fois (reporte:true).
function aboTraiterGels(clubs){
  var now=Date.now();
  return Promise.all(clubs.map(function(c){
    var gels=c.aboGels||[], change=false, jours=0;
    var maj=gels.map(function(g){
      if(!g||g.reporte) return g;
      var finReelle=g.relanceLe||(g.fin<=now?g.fin:null);
      if(!finReelle) return g;
      change=true;
      jours+=Math.max(0,Math.round((finReelle-g.debut)/86400000));
      return Object.assign({},g,{reporte:true});
    });
    if(!change) return null;
    var up={aboGels:maj};
    var e=(typeof aboEcheance==="function")?aboEcheance(c):null;
    if(e&&jours>0) up.aboEcheance=new Date(e.getTime()+jours*86400000);
    if(!aboGelActif(Object.assign({},c,{aboGels:maj}))&&c.aboGelFin) up.aboGelFin=0;
    return window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),up).then(function(){ Object.assign(c,up); }).catch(function(){});
  }));
}
function renderAboNotifs(box, clubs, list){
  box.innerHTML="";
  var a=clubs.filter(function(c){ return c.aboNotif&&!c.aboNotif.vu&&c.status!=="deleted"; });
  if(typeof pfNotifN==="function") pfNotifN("abo",a.length);
  if(!a.length) return;
  var head=document.createElement("div");
  head.style.cssText="background:#8a4500;color:#fff;border-radius:var(--rx);padding:10px 12px;font-size:13px;font-weight:800;margin-bottom:8px";
  head.textContent="🔔 "+a.length+" changement"+(a.length>1?"s":"")+" d'abonnement";
  box.appendChild(head);
  a.sort(function(x,y){ return (y.aboNotif.le||0)-(x.aboNotif.le||0); }).forEach(function(c){
    var n=c.aboNotif, card=gmCard();
    var t=document.createElement("div"); t.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    t.textContent=(c.name||c.id)+" "+(ABO_NOTIF_TXT[n.t]||n.t);
    var d=document.createElement("div"); d.style.cssText="font-size:12px;color:var(--txt2);margin:4px 0 6px";
    d.textContent=(n.le?new Date(n.le).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"})+" · ":"")+(n.detail||"");
    card.appendChild(t); card.appendChild(d);
    gmRow(card).appendChild(gmBtn("Vu","soft",function(b){
      b.disabled=true;
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",c.id),{"aboNotif.vu":true})
        .then(function(){ c.aboNotif.vu=true; renderAboNotifs(box,clubs,list); })
        .catch(function(err){ b.disabled=false; askAlert("Erreur : "+((err&&err.code)||err)); });
    }));
    box.appendChild(card);
  });
}

// ═══ RIB DE LA PLATEFORME ═════════════════════════════════════════════
// Saisi une fois par le super admin (Plateforme › RIB), stocké dans plateforme_config/rib
// (jamais dans le code public), lisible par les dirigeants connectés : affiché dans
// Paramètres › Abonnement avec un bouton « Copier » par ligne (aucune ressaisie, aucune erreur).
function ribIbanNet(s){ return String(s||"").replace(/[^0-9A-Za-z]/g,"").toUpperCase(); }
function ribIbanFmt(s){ return ribIbanNet(s).replace(/(.{4})/g,"$1 ").trim(); }
function ribIbanValide(s){
  var n=ribIbanNet(s);
  if(!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(n)) return false;
  if(n.indexOf("FR")===0 && n.length!==27) return false;
  var r=n.slice(4)+n.slice(0,4), reste=0;
  for(var i=0;i<r.length;i++){
    var c=r.charAt(i), v=/[A-Z]/.test(c)?String(c.charCodeAt(0)-55):c;
    for(var j=0;j<v.length;j++) reste=(reste*10+parseInt(v.charAt(j),10))%97;
  }
  return reste===1;
}
function ribBicNet(s){ return String(s||"").replace(/\s+/g,"").toUpperCase(); }
function ribBicValide(s){ return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(ribBicNet(s)); }

function ribCopier(txt,quoi){
  var ok=function(){ if(typeof showToast==="function") showToast((quoi||"Texte")+" copié ✓"); };
  var secours=function(){
    try{
      var t=document.createElement("textarea"); t.value=txt; t.style.cssText="position:fixed;opacity:0";
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); ok();
    }catch(e){ if(typeof askAlert==="function") askAlert(txt); }
  };
  try{ navigator.clipboard.writeText(txt).then(ok,secours); }catch(e){ secours(); }
}
function ribCharger(){
  if(window.__gmRib!==undefined) return Promise.resolve(window.__gmRib);
  return window.fbGetDoc(window.fbDoc(window.fbDb,"plateforme_config","rib")).then(function(s){
    window.__gmRib=(s&&s.exists&&s.exists())?(s.data()||null):null; return window.__gmRib;
  }).catch(function(){ return null; });
}
// Carte « Payer par virement » : une ligne par information, chacune avec son bouton Copier.
function ribCarte(rib,reference){
  var card=document.createElement("div");
  card.style.cssText="background:var(--bg);border-radius:var(--rs);padding:12px 14px;margin:0 0 10px";
  var t=document.createElement("div"); t.style.cssText="font-size:13px;font-weight:800;color:var(--txt);margin-bottom:8px";
  t.textContent="Payer par virement"; card.appendChild(t);
  function ligne(lib,val,aff){
    if(!val) return;
    var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px solid var(--bdr)";
    var g=document.createElement("div"); g.style.cssText="flex:1;min-width:0";
    var a=document.createElement("div"); a.style.cssText="font-size:11px;color:var(--mut)"; a.textContent=lib;
    var b=document.createElement("div"); b.style.cssText="font-size:13px;font-weight:700;color:var(--txt);word-break:break-all"; b.textContent=aff||val;
    g.appendChild(a); g.appendChild(b); r.appendChild(g);
    var c=document.createElement("button"); c.type="button"; c.textContent="Copier";
    c.style.cssText="flex:none;padding:6px 12px;border-radius:99px;border:none;background:color-mix(in srgb, var(--ltg) 14%, transparent);color:var(--dkg);font-size:12px;font-weight:800;cursor:pointer";
    c.addEventListener("click",function(){ ribCopier(val,lib); });
    r.appendChild(c); card.appendChild(r);
  }
  ligne("Titulaire",rib.titulaire);
  ligne("IBAN",ribIbanNet(rib.iban),ribIbanFmt(rib.iban));
  ligne("BIC",ribBicNet(rib.bic));
  ligne("Banque",rib.banque);
  ligne("Référence à indiquer",reference);
  return card;
}
// Affichage dans Paramètres › Abonnement (clubs payants ou en essai, pas le club d'origine).
function aboRibAfficher(box,row,c){
  ribCharger().then(function(rib){
    if(!rib||!rib.iban||!box.isConnected) return;
    var old=box.querySelector("#abo-rib"); if(old) old.remove();
    var card=ribCarte(rib,"GM "+(c.name||c.id||""));
    card.id="abo-rib";
    box.insertBefore(card,row);
  });
}
// Saisie côté Plateforme (super admin) : contrôle de l'IBAN et du BIC avant d'enregistrer.
function pfRibOuvrir(){
  if(typeof isSuperAdmin!=="function"||!isSuperAdmin()) return;
  var s=gmSheet("RIB de General Manager");
  var rib=window.__gmRib||{};
  function champ(lib,id,val,ph){
    var w=document.createElement("div"); w.style.marginBottom="10px";
    w.innerHTML='<label for="'+id+'" style="display:block;font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:4px">'+lib+'</label>'+
      '<input id="'+id+'" type="text" autocomplete="off" autocapitalize="characters" placeholder="'+ph+'" style="width:100%;padding:11px 12px;border-radius:var(--rx);border:1.5px solid var(--bdr);background:var(--card);color:var(--txt);font-size:14px">'+
      '<div id="'+id+'-m" style="font-size:12px;margin-top:3px;min-height:16px"></div>';
    w.querySelector("input").value=val||"";
    s.body.appendChild(w); return w.querySelector("input");
  }
  var ti=champ("Titulaire du compte","rib-tit",rib.titulaire,"Nom de ton entreprise");
  var ib=champ("IBAN","rib-iban",ribIbanFmt(rib.iban),"FR76 …");
  var bi=champ("BIC","rib-bic",rib.bic,"ex. AGRIFRPP");
  var ba=champ("Banque (facultatif)","rib-ban",rib.banque,"");
  var go=gmBtn("Enregistrer","primary",function(){});
  function maj(){
    var mi=document.getElementById("rib-iban-m"), mb=document.getElementById("rib-bic-m");
    var iok=ribIbanValide(ib.value), bok=ribBicValide(bi.value);
    mi.textContent=!ib.value?"":(iok?"✓ IBAN valide":"✖ IBAN incorrect (vérifie les chiffres)"); mi.style.color=iok?"var(--grn)":"var(--red)";
    mb.textContent=!bi.value?"":(bok?"✓ BIC valide":"✖ BIC incorrect (8 ou 11 caractères)"); mb.style.color=bok?"var(--grn)":"var(--red)";
    var pret=iok&&bok&&ti.value.trim().length>=2;
    go.disabled=!pret; go.style.opacity=pret?"1":".5";
  }
  ib.addEventListener("input",function(){ ib.value=ribIbanFmt(ib.value); maj(); });
  bi.addEventListener("input",function(){ bi.value=ribBicNet(bi.value); maj(); });
  ti.addEventListener("input",maj);
  go.addEventListener("click",function(){
    var d={titulaire:ti.value.trim().slice(0,80),iban:ribIbanNet(ib.value),bic:ribBicNet(bi.value),banque:ba.value.trim().slice(0,60),maj:Date.now()};
    window.fbSetDoc(window.fbDoc(window.fbDb,"plateforme_config","rib"),d).then(function(){
      window.__gmRib=d; s.modal.remove(); if(typeof showToast==="function") showToast("RIB enregistré ✓");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  });
  s.body.appendChild(go);
  maj();
  ribCharger().then(function(r){
    if(r&&r.iban){ var ap=document.createElement("div"); ap.style.marginTop="14px"; ap.appendChild(ribCarte(r,"")); s.body.appendChild(ap); }
  });
}
