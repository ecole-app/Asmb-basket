/* ===== 24c-independant-abonnement.js — abonnement de l'indépendant (Mon activité › Mon abonnement) ===== */
// Tarif décidé le 15/10/2026 : Standard 15 €/mois ou 150 €/an, Premium 20 €/mois ou 200 €/an.
//  - « mensuel » : engagement de 12 mois la première année (jusqu'à clubs/{id}.aboEcheance), puis sans
//    engagement : résiliation à tout moment, effet à la fin du mois en cours ;
//  - « annuel » : toujours engagé jusqu'à l'échéance (le renouvellement +12 mois est fait par le super admin).
// Champs : `aboRythme` ("mensuel"|"annuel") et `aboEcheance` écrits par le super admin seul ;
// gel / résiliation / relance écrits par l'indépendant (mêmes champs que les clubs : aboGels, aboGelFin,
// aboResiliation, aboNotif, déjà en liste blanche des règles). Le gel repousse l'échéance de sa durée réelle
// (aboTraiterGels, Plateforme). Facturation manuelle (RIB) : ici, uniquement suivi et affichage.
var IND_ABO_PRIX={standard:{mensuel:15,annuel:150},premium:{mensuel:20,annuel:200}};

function indAboFormule(c,now){
  c=c||{}; now=now||Date.now();
  var plan=(c.plan==="standard"||c.plan==="premium")?c.plan:null;
  var rythme=c.aboRythme==="annuel"?"annuel":"mensuel";
  var ech=(typeof aboEcheanceMs==="function")?aboEcheanceMs(c):null;
  var engage=(rythme==="annuel")?true:(ech?now<ech:true);
  var prix=plan?IND_ABO_PRIX[plan][rythme]:null;
  var gel=(c.aboGels||[]).filter(function(g){ return g&&!g.relanceLe&&g.debut<=now&&g.fin>now; })[0]||null;
  return {plan:plan,nom:plan==="premium"?"Premium":plan==="standard"?"Standard":"",rythme:rythme,ech:ech,engage:engage,prix:prix,
    prixTxt:prix?(prix+" €"+(rythme==="annuel"?"/an":"/mois")):"",gel:gel,res:c.aboResiliation||null};
}
// Date d'effet d'une résiliation demandée maintenant : l'échéance si l'indépendant est engagé,
// sinon la fin du mois en cours.
function indAboEffet(c,now){
  now=now||Date.now();
  var f=indAboFormule(c,now);
  if(f.engage) return f.ech||null;
  var d=new Date(now);
  return new Date(d.getFullYear(),d.getMonth()+1,1).getTime()-1;
}
// Pour la Plateforme : « engagé jusqu'au … » / « sans engagement ».
function indAboEtatCourt(c){
  var f=indAboFormule(c);
  if(!f.plan) return "";
  if(f.rythme==="annuel") return "annuel"+(f.ech?" · échéance "+aboDateTxt(f.ech):"");
  return f.engage?("mensuel · engagé"+(f.ech?" jusqu'au "+aboDateTxt(f.ech):"")):"mensuel · sans engagement";
}

// ── Écran « Mon abonnement » (coach) ────────────────────────────────
function indAboEcrire(maj,toast){
  return window.fbUpdateDoc(window.fbDoc(indDb(),"clubs",IND.clubId),maj).then(function(){
    if(toast&&typeof showToast==="function") showToast(toast);
    setTimeout(indAboRafraichir,500); // le temps que la fiche club se remette à jour
  }).catch(function(e){ indErr(e); throw e; });
}
// Branche le bloc dans un conteneur de l'écran Réglages (clics gérés ici : la feuille est hors de #ind).
function indAboMonter(zone){
  zone.id="ind-abo-zone";
  zone.innerHTML=indAboBloc();
  zone.onclick=function(e){
    var b=e.target.closest("button[data-act]"); if(!b) return;
    var a=b.dataset.act;
    if(a==="abo-geler") indAboGeler();
    else if(a==="abo-resilier") indAboResilier();
    else if(a==="abo-relancer") indAboRelancer();
    else if(a==="abo-annuler-res") indAboAnnulerRes();
  };
}
function indAboRafraichir(){
  var z=document.getElementById("ind-abo-zone");
  if(z&&z.isConnected) z.innerHTML=indAboBloc();
}
function indAboBloc(){
  var c=IND.club||{}, f=indAboFormule(c);
  var h='<div class="ind-c" id="ind-abo"><strong>Mon abonnement</strong>';
  if(!f.plan){
    var lib=c.plan==="trial"?"Essai gratuit":c.plan==="gratuit"?"Offre gratuite":c.plan==="limite"?"Accès limité":"Accès complet";
    return h+'<p class="ind-note">'+indEsc(lib)+'. Ta formule est gérée par la plateforme.</p></div>';
  }
  var etat, cls="ok";
  if(f.gel){ etat="⏸ Gelé jusqu'au "+aboDateTxt(f.gel.fin); cls="no"; }
  else if(f.res){ etat="✖ Résiliation programmée"+(f.res.effet?" au "+aboDateTxt(f.res.effet):""); cls="no"; }
  else etat="✓ Actif";
  h+='<div class="ind-row" style="margin-top:6px"><div class="t"><strong>Formule '+indEsc(f.nom)+'</strong><span>'
    +indEsc(f.prixTxt+(f.rythme==="annuel"?" · 2 mois offerts":""))+'</span></div><span class="ind-pill '+cls+'">'+indEsc(etat)+'</span></div>';
  var eng;
  if(f.rythme==="annuel") eng="Abonnement annuel"+(f.ech?", payé jusqu'au "+aboDateTxt(f.ech):"")+".";
  else if(f.engage) eng="Engagement de 12 mois"+(f.ech?" jusqu'au "+aboDateTxt(f.ech):"")+". Ensuite, sans engagement : tu pourras arrêter quand tu veux.";
  else eng="Sans engagement : tu peux arrêter à tout moment, ça prend effet à la fin du mois en cours.";
  h+='<p class="ind-note" style="margin-top:8px">'+indEsc(eng)+'</p>';
  if(!window.SUPPORT_MODE && IND.role==="coach"){
    h+='<div class="ind-btns" style="margin-top:10px">';
    if(f.gel) h+='<button type="button" class="ind-btn p" data-act="abo-relancer">▶️ Relancer maintenant</button>';
    else if(f.res) h+='<button type="button" class="ind-btn p" data-act="abo-annuler-res">↩️ Annuler la résiliation</button>';
    else h+='<button type="button" class="ind-btn s" data-act="abo-geler">⏸ Geler</button><button type="button" class="ind-btn s" data-act="abo-resilier">✖ Résilier</button>';
    h+='</div>';
  }
  return h+'</div>';
}
function indAboGeler(){
  var s=gmSheet("Geler mon abonnement");
  s.body.classList.add("ind-t"); s.body.style.setProperty("--ia",indCouleur());
  var choix=1;
  s.body.innerHTML='<p class="ind-note">Pendant le gel, l\'onglet Argent est fermé (tes données sont gardées) et l\'abonnement n\'est pas facturé. '
    +'Ton échéance est repoussée de la durée du gel, et tu peux relancer quand tu veux.</p>'
    +'<div class="ind-btns" id="ind-gel-m" style="margin:10px 0"></div><div class="actions"><button type="button" class="ok" id="ind-gel-ok">Geler</button></div>';
  var box=s.body.querySelector("#ind-gel-m");
  function peindre(){
    box.innerHTML=[1,2,3].map(function(m){ return '<button type="button" class="ind-btn '+(m===choix?"p":"s")+'" data-m="'+m+'">'+m+' mois</button>'; }).join("");
  }
  peindre();
  box.addEventListener("click",function(e){ var b=e.target.closest("button[data-m]"); if(b){ choix=+b.dataset.m; peindre(); } });
  s.body.querySelector("#ind-gel-ok").addEventListener("click",function(){
    var debut=Date.now(), d=new Date(debut); d.setMonth(d.getMonth()+choix); var fin=d.getTime();
    aboDoubleConfirmation("Geler ton abonnement pendant "+choix+" mois, jusqu'au "+aboDateTxt(fin)+" ?","Geler l'abonnement","GELER","Geler").then(function(ok){
      if(!ok) return;
      var c=IND.club||{}, gels=(c.aboGels||[]).slice(-20).concat([{debut:debut,fin:fin,mois:choix,par:IND.uid}]);
      indAboEcrire({aboGels:gels,aboGelFin:fin,aboNotif:aboNotif("gel",choix+" mois, jusqu'au "+aboDateTxt(fin))},"Abonnement gelé jusqu'au "+aboDateTxt(fin))
        .then(function(){ s.modal.remove(); }).catch(function(){});
    });
  });
}
function indAboRelancer(){
  askConfirm("Relancer ton abonnement maintenant ?",{title:"Relancer",confirmText:"Relancer"}).then(function(ok){
    if(!ok) return;
    var now=Date.now(), c=IND.club||{};
    var gels=(c.aboGels||[]).map(function(g){ return (g&&!g.relanceLe&&g.debut<=now&&g.fin>now)?Object.assign({},g,{relanceLe:now}):g; });
    indAboEcrire({aboGels:gels,aboGelFin:0,aboNotif:aboNotif("relance","fin du gel le "+aboDateTxt(now))},"Abonnement relancé").catch(function(){});
  });
}
function indAboResilier(){
  var c=IND.club||{}, f=indAboFormule(c), effet=indAboEffet(c);
  var quand=effet?"le "+aboDateTxt(effet):"à la fin de la période en cours";
  askPrompt("Pourquoi veux-tu arrêter ? (facultatif)",{placeholder:"",confirmText:"Suivant"}).then(function(motif){
    if(motif===null||motif===undefined) return;
    aboDoubleConfirmation("Résilier ton abonnement ?\n\nÇa prendra effet "+quand+(f.engage?" (fin de ton engagement)":"")+". D'ici là, tout reste ouvert. Tu peux annuler tant que ce n'est pas effectif.","Résilier l'abonnement","RESILIER","Résilier").then(function(ok){
      if(!ok) return;
      indAboEcrire({aboResiliation:{le:Date.now(),par:IND.uid,motif:String(motif||"").trim().slice(0,300),effet:effet||null},
        aboNotif:aboNotif("resiliation","effet "+(effet?aboDateTxt(effet):"fin de période")+(motif?" · "+String(motif).trim().slice(0,120):""))},"Résiliation enregistrée").catch(function(){});
    });
  });
}
function indAboAnnulerRes(){
  askConfirm("Annuler la résiliation ? Ton abonnement continue normalement.",{title:"Annuler la résiliation",confirmText:"Annuler la résiliation"}).then(function(ok){
    if(!ok) return;
    indAboEcrire({aboResiliation:null,aboNotif:aboNotif("annulation","résiliation annulée")},"Résiliation annulée").catch(function(){});
  });
}
