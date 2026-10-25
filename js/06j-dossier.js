/* ===== 06j-dossier.js — Dossier d'inscription réglable par club ===== */
// Le dirigeant règle son dossier (Paramètres › Argent & documents › Dossier d'inscription) :
//  - infos complémentaires (champs en plus sur la fiche : taille, profession des parents...)
//  - tarifs (catégories, options, remise fratrie, modes de règlement)
//  - questionnaire de santé (questions OUI/NON + attestation sur l'honneur)
//  - charte / règlement intérieur (« lu et approuvé »)
//  - autorisations (droit à l'image, soins d'urgence, transport...)
//  - en-tête du club pour le PDF imprimable.
// Stocké sur clubs/{id}.dossier (dirigeant seul), recopié dans inscription_codes/{code}.dossier
// pour la fiche publique (comme les aides). L'ASMB part de son propre dossier papier ;
// les autres clubs partent d'une base simple qu'ils complètent.
// Santé : on ne garde JAMAIS les réponses une par une, seulement « toutes à NON » (vrai/faux).

var DOSSIER_QUESTIONS_BASE=[
  "Durant les 12 derniers mois, un membre de votre famille est-il décédé subitement d'une cause cardiaque inexpliquée ou lors d'un effort ?",
  "Avez-vous ressenti une douleur dans la poitrine, des palpitations ou un malaise (étourdissement, perte de connaissance) pendant ou après l'effort ?",
  "Avez-vous déjà eu un essoufflement anormalement court ou une crise d'asthme inhabituelle lors de la pratique physique ?",
  "Avez-vous eu un problème osseux, articulaire ou musculaire (entorse, fracture, luxation, déchirure) qui vous gêne encore aujourd'hui ?",
  "Prenez-vous un traitement médical quotidien ou régulier prescrit par un professionnel de santé ?",
  "Avez-vous arrêté le sport pendant plus de 30 jours consécutifs pour des raisons de santé au cours des 12 derniers mois ?",
  "Pensez-vous avoir besoin d'un avis médical pour reprendre ou continuer la pratique intensive du basketball ?"
];

function dossierBase(){
  return {
    v:1,
    entete:{adresse:"",telephone:"",email:"",web:"",rna:"",siret:""},
    perso:[],
    tarifs:{lignes:[],options:[],fratrie:"",reglement:"",enLigne:""},
    sante:{actif:false,questions:DOSSIER_QUESTIONS_BASE.slice()},
    charte:{titre:"",texte:""},
    autorisations:[]
  };
}

// Modèle tiré du dossier papier de l'ASMB 2026-2027 (coordonnées et IBAN à compléter dans l'appli).
function dossierModeleAsmb(){
  var d=dossierBase();
  d.sante.actif=true;
  d.perso=[
    {label:"Lieu de naissance",type:"texte",oblig:false},
    {label:"Taille (cm)",type:"nombre",oblig:false},
    {label:"Poids (kg)",type:"nombre",oblig:false},
    {label:"Profession de la mère",type:"texte",oblig:false},
    {label:"Profession du père",type:"texte",oblig:false}
  ];
  d.tarifs={
    lignes:[
      {label:"U3 à U7 (2023 à 2020)",prix:120},
      {label:"U9 (2019 / 2018) · U11 (2017 / 2016)",prix:140},
      {label:"U13 (2015 / 2014) · U15 (2013 / 2012)",prix:160},
      {label:"U18 (2011 / 2010 / 2009)",prix:180},
      {label:"U21 / Seniors (à partir de 2008)",prix:200},
      {label:"Basket pour tous (Loisirs, Santé, Inclusive)",prix:120},
      {label:"Basket Academy (hors ASMB)",prix:120}
    ],
    options:[
      {label:"Option Academy",prix:80},
      {label:"Option Garantie Supplémentaire",prix:10}
    ],
    fratrie:"-10 € sur la 2e licence, -20 € sur les suivantes.",
    reglement:"Espèces / Chèque(s) (noter nom + date d'encaissement au dos) / Virement. Échéancier en 4 fois maximum.\nIBAN : à compléter\nBIC : à compléter"
  };
  d.charte={
    titre:"Chartes du club & règlement intérieur",
    texte:[
      "NOS VALEURS : RESPECT, SOLIDARITÉ, ENGAGEMENT, FAIR-PLAY",
      "",
      "L'ADHÉRENT(E) S'ENGAGE À :",
      "- Être ponctuel, assidu et prévenir le coach de toute absence.",
      "- Venir avec une tenue adaptée, une gourde et des chaussures de salle propres.",
      "- Respecter ses coéquipiers, ses adversaires et les décisions des arbitres sans contester.",
      "- Écouter les consignes de l'entraîneur et donner le meilleur de soi.",
      "- Participer au rangement du matériel à la fin des séances.",
      "",
      "LES ENCADRANTS S'ENGAGENT À :",
      "- Accueillir chaque joueur avec bienveillance et respecter son rythme.",
      "- Faire preuve d'exemplarité en matière de comportement et de fair-play.",
      "- Garantir la sécurité physique et morale de tous les pratiquants.",
      "- Refuser toute forme d'humiliation, de discrimination ou de violence.",
      "",
      "LES PARENTS S'ENGAGENT À :",
      "- Encourager sans diriger (laisser l'entraîneur entraîner).",
      "- Respecter les arbitres, les officiels et les équipes adverses.",
      "- S'impliquer dans la vie du club (transports, table de marque, événements).",
      "- Privilégier le dialogue constructif en cas de désaccord, en dehors des matchs.",
      "",
      "RÈGLEMENT INTÉRIEUR (EXTRAITS) :",
      "- Locaux : le gymnase et les vestiaires doivent rester propres. Le matériel prêté (maillots, ballons) doit être restitué en bon état.",
      "- Comportement : tolérance zéro envers les insultes, la violence ou les discriminations. L'alcool et le tabac sont strictement interdits dans les locaux sportifs.",
      "- Sanctions disciplinaires : en cas de manquement grave aux règles de vie, le club applique une procédure graduée (échange, rappel, avertissement, suspension).",
      "",
      "LES 10 RÈGLES D'OR DU BASKETTEUR ASMB :",
      "1. Je respecte mes coéquipiers",
      "2. Je respecte mes adversaires",
      "3. Je respecte mon entraîneur",
      "4. Je respecte les arbitres et les bénévoles",
      "5. Je suis ponctuel et je préviens en cas d'absence",
      "6. J'encourage sans insulter ni provoquer",
      "7. Je respecte le matériel et les locaux",
      "8. J'accepte la victoire comme la défaite",
      "9. Je porte fièrement les valeurs et l'image de l'ASMB",
      "10. Je participe à la vie de mon équipe et du club"
    ].join("\n")
  };
  d.autorisations=[
    {titre:"Droit à l'image & supports de communication",texte:"J'autorise l'ASMB à photographier et filmer le licencié dans le cadre des activités du club pour diffusion sur le site officiel, réseaux sociaux et supports internes à des fins exclusives de valorisation sportive.",type:"choix"},
    {titre:"Soins médicaux d'urgence & secours (pompiers / SAMU)",texte:"En cas de nécessité médicale ou d'accident, j'autorise les éducateurs et dirigeants à faire appel aux services de secours et autorise la prise en charge médicale d'urgence et le transport vers un établissement hospitalier.",type:"choix"},
    {titre:"Enregistrement fédéral & assurances",texte:"J'autorise expressément le club ASMB à enregistrer mes coordonnées et celles de mon enfant auprès des instances et fédérations sportives compétentes, ainsi qu'auprès des organismes d'assurance partenaires, pour l'obtention de la licence officielle et la couverture assurantielle indispensable à la pratique.",type:"lu"},
    {titre:"Responsabilité civile & prise en charge",texte:"En dehors des heures prévues des entraînements, des compétitions ou événements de l'association, les adhérents restent sous la responsabilité de leurs parents ou de leur représentant légal.",type:"lu"},
    {titre:"Transport & covoiturage lors des déplacements",texte:"J'autorise les éducateurs, dirigeants ou parents mandatés à assurer le transport du licencié lors des rencontres et manifestations extérieures.",type:"choix"},
    {titre:"Photographie d'identité (enregistrement)",texte:"Afin de finaliser l'enregistrement de la licence, merci de faire parvenir obligatoirement une photo du visage de l'adhérent(e) au club.",type:"lu"}
  ];
  return d;
}

function dossierEstAsmb(){
  var c=window.CURRENT_CLUB||{};
  return !!(c.id && typeof BOOTSTRAP_CLUB_ID!=="undefined" && c.id===BOOTSTRAP_CLUB_ID);
}
// Dossier du club : celui enregistré, sinon le modèle ASMB (pour l'ASMB) ou la base.
function dossierClub(){
  var c=window.CURRENT_CLUB||{};
  if(c.dossier&&c.dossier.v) return dossierNormaliser(c.dossier);
  return dossierEstAsmb()?dossierModeleAsmb():dossierBase();
}
function dossierNormaliser(d){
  var b=dossierBase(); d=d||{};
  var s=function(v,n){ return String(v==null?"":v).slice(0,n); };
  var e=d.entete||{};
  return {
    v:1,
    entete:{adresse:s(e.adresse,160),telephone:s(e.telephone,30),email:s(e.email,80),web:s(e.web,80),rna:s(e.rna,30),siret:s(e.siret,30)},
    perso:(d.perso||[]).slice(0,20).map(function(p){ return {label:s(p.label,60),type:["texte","nombre","ouinon","choix","date"].indexOf(p.type)>=0?p.type:"texte",options:s(p.options,200),oblig:!!p.oblig}; }).filter(function(p){return p.label.trim();}),
    tarifs:{
      lignes:((d.tarifs||{}).lignes||[]).slice(0,20).map(function(l){ return {label:s(l.label,80),prix:Number(l.prix)||0}; }).filter(function(l){return l.label.trim();}),
      options:((d.tarifs||{}).options||[]).slice(0,10).map(function(l){ return {label:s(l.label,80),prix:Number(l.prix)||0}; }).filter(function(l){return l.label.trim();}),
      fratrie:s((d.tarifs||{}).fratrie,200), reglement:s((d.tarifs||{}).reglement,600),
      enLigne:/^https:\/\/[^\s"'<>]+$/.test(String((d.tarifs||{}).enLigne||"").trim())?String(d.tarifs.enLigne).trim().slice(0,300):""
    },
    sante:{actif:d.sante?d.sante.actif!==false:b.sante.actif, questions:((d.sante&&d.sante.questions)||b.sante.questions).slice(0,25).map(function(q){return s(q,300);}).filter(function(q){return q.trim();})},
    charte:{titre:s((d.charte||{}).titre,80),texte:s((d.charte||{}).texte,6000)},
    autorisations:(d.autorisations||[]).slice(0,15).map(function(a){ return {titre:s(a.titre,80),texte:s(a.texte,600),type:a.type==="lu"?"lu":"choix"}; }).filter(function(a){return a.titre.trim()||a.texte.trim();})
  };
}
// Version publique (recopiée dans inscription_codes) : sans l'en-tête (inutile au formulaire).
function dossierPourCodes(){
  var d=dossierClub();
  return {v:1,perso:d.perso,tarifs:d.tarifs,sante:d.sante,charte:d.charte,autorisations:d.autorisations};
}

// ═══ ÉDITEUR (dirigeant) ═══════════════════════════════════════════
function dossierEditeur(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  var d=JSON.parse(JSON.stringify(dossierClub()));
  var fa=(window.CURRENT_CLUB&&window.CURRENT_CLUB.facturation)||{}, ce=(window.CURRENT_CLUB&&window.CURRENT_CLUB.cerfa)||{};
  if(!d.entete.adresse) d.entete.adresse=fa.adresse||ce.adresse||"";
  if(!d.entete.siret) d.entete.siret=fa.siret||"";
  if(!d.entete.rna) d.entete.rna=ce.rna||"";
  var sh=gmSheet("Dossier d'inscription"), body=sh.body;
  var inS="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font:inherit;font-size:13px";
  function champ(parent,label,val,onCh,opt){
    opt=opt||{};
    var w=document.createElement("label"); w.style.cssText="display:block;margin-bottom:8px;font-size:11.5px;font-weight:700;color:var(--mut)";
    w.textContent=label;
    var i=document.createElement(opt.multi?"textarea":"input");
    if(opt.multi) i.rows=opt.rows||3; else i.type=opt.type||"text";
    i.style.cssText=inS+";margin-top:4px;display:block"; i.value=val==null?"":val;
    if(opt.max) i.maxLength=opt.max;
    if(opt.ph) i.placeholder=opt.ph;
    i.addEventListener("input",function(){ onCh(i.value); });
    w.appendChild(i); parent.appendChild(w); return i;
  }
  function sup(onClick){ var b=gmBtn("Retirer","danger",onClick); b.style.padding="6px 10px"; return b; }
  function render(){
    body.innerHTML="";
    var intro=document.createElement("div"); intro.style.cssText="font-size:12.5px;color:var(--txt2);line-height:1.5";
    intro.textContent="Ce que les familles remplissent sur la fiche d'inscription (lien public et réinscription), et le dossier PDF à imprimer. La base (identité, responsables, urgence, certificat) est toujours là.";
    body.appendChild(intro);
    var rm=gmRow(body);
    if(dossierEstAsmb()) rm.appendChild(gmBtn("Repartir du modèle ASMB","ghost",function(){ askConfirm("Remplacer le réglage en cours par le modèle ASMB (dossier papier 2026-2027) ?").then(function(ok){ if(ok){ var e=d.entete; d=dossierModeleAsmb(); d.entete=e; render(); } }); }));
    rm.appendChild(gmBtn("Repartir de la base","ghost",function(){ askConfirm("Remplacer le réglage en cours par la base simple ?").then(function(ok){ if(ok){ var e=d.entete; d=dossierBase(); d.entete=e; render(); } }); }));

    // En-tête PDF
    gmSection(body,"En-tête du dossier PDF","Coordonnées imprimées en haut du dossier.");
    var c1=gmCard(); body.appendChild(c1);
    champ(c1,"Adresse",d.entete.adresse,function(v){d.entete.adresse=v;},{max:160});
    champ(c1,"Téléphone",d.entete.telephone,function(v){d.entete.telephone=v;},{max:30,ph:"0612345678"});
    champ(c1,"E-mail",d.entete.email,function(v){d.entete.email=v;},{max:80,ph:"mail@gmail.com"});
    champ(c1,"Site web",d.entete.web,function(v){d.entete.web=v;},{max:80});
    champ(c1,"N° RNA",d.entete.rna,function(v){d.entete.rna=v;},{max:30});
    champ(c1,"SIRET",d.entete.siret,function(v){d.entete.siret=v;},{max:30});

    // Infos complémentaires
    gmSection(body,"Infos complémentaires","Champs en plus de la base sur la fiche (taille, poids, profession des parents...).");
    d.perso.forEach(function(p,i){
      var c=gmCard(); body.appendChild(c);
      champ(c,"Intitulé",p.label,function(v){p.label=v;},{max:60});
      var w=document.createElement("label"); w.style.cssText="display:block;margin-bottom:8px;font-size:11.5px;font-weight:700;color:var(--mut)"; w.textContent="Type de réponse";
      var se=document.createElement("select"); se.style.cssText=inS+";margin-top:4px;display:block";
      [["texte","Texte"],["nombre","Nombre"],["date","Date"],["ouinon","Oui / Non"],["choix","Liste de choix"]].forEach(function(o){ var op=document.createElement("option"); op.value=o[0]; op.textContent=o[1]; if(p.type===o[0]) op.selected=true; se.appendChild(op); });
      se.addEventListener("change",function(){ p.type=se.value; render(); });
      w.appendChild(se); c.appendChild(w);
      if(p.type==="choix") champ(c,"Choix possibles (séparés par ;)",p.options,function(v){p.options=v;},{max:200,ph:"Petit ; Moyen ; Grand"});
      var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px";
      var ob=document.createElement("label"); ob.style.cssText="display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--txt)";
      var cb=document.createElement("input"); cb.type="checkbox"; cb.checked=!!p.oblig; cb.style.cssText="width:18px;height:18px"; cb.addEventListener("change",function(){p.oblig=cb.checked;});
      ob.appendChild(cb); ob.appendChild(document.createTextNode("Obligatoire"));
      r.appendChild(ob); r.appendChild(sup(function(){ d.perso.splice(i,1); render(); }));
      c.appendChild(r);
    });
    gmRow(body).appendChild(gmBtn("+ Ajouter un champ","soft",function(){ d.perso.push({label:"",type:"texte",oblig:false}); render(); }));

    // Tarifs
    gmSection(body,"Tarifs","Affichés sur la fiche et dans le PDF (pour information : le montant de chaque licence se règle toujours sur sa fiche).");
    var ct=gmCard(); body.appendChild(ct);
    function lignesPrix(liste,titre,ph){
      var h=document.createElement("div"); h.style.cssText="font-size:12px;font-weight:800;color:var(--txt);margin:4px 0 6px"; h.textContent=titre; ct.appendChild(h);
      liste.forEach(function(l,i){
        var r=document.createElement("div"); r.style.cssText="display:flex;gap:6px;align-items:center;margin-bottom:6px";
        var a=document.createElement("input"); a.style.cssText=inS+";flex:1;min-width:0"; a.value=l.label; a.maxLength=80; a.placeholder=ph; a.addEventListener("input",function(){l.label=a.value;});
        var p=document.createElement("input"); p.type="number"; p.min="0"; p.style.cssText=inS+";width:80px;flex:none"; p.value=l.prix; p.addEventListener("input",function(){l.prix=Number(p.value)||0;});
        var eu=document.createElement("span"); eu.textContent="€"; eu.style.cssText="font-size:12px;color:var(--mut)";
        var x=document.createElement("button"); x.type="button"; x.textContent="✕"; x.setAttribute("aria-label","Retirer"); x.style.cssText="width:30px;height:30px;border-radius:50%;border:none;background:rgba(192,57,43,.1);color:var(--red);cursor:pointer;flex:none";
        x.addEventListener("click",function(){ liste.splice(i,1); render(); });
        r.appendChild(a); r.appendChild(p); r.appendChild(eu); r.appendChild(x); ct.appendChild(r);
      });
      var b=gmBtn("+ Ajouter","soft",function(){ liste.push({label:"",prix:0}); render(); }); b.style.marginBottom="10px"; ct.appendChild(b);
    }
    lignesPrix(d.tarifs.lignes,"Licences par catégorie","U11 (2017 / 2016)");
    lignesPrix(d.tarifs.options,"Options (cases à cocher)","Option Academy");
    champ(ct,"Remise fratrie",d.tarifs.fratrie,function(v){d.tarifs.fratrie=v;},{max:200});
    champ(ct,"Modes de règlement (et IBAN si virement)",d.tarifs.reglement,function(v){d.tarifs.reglement=v;},{multi:true,rows:4,max:600});
    if(!d.tarifs.enLigne&&window.CURRENT_CLUB&&window.CURRENT_CLUB.lienPaiement) d.tarifs.enLigne=window.CURRENT_CLUB.lienPaiement;
    champ(ct,"Paiement en ligne HelloAsso (lien, facultatif)",d.tarifs.enLigne,function(v){d.tarifs.enLigne=v.trim();},{max:300,ph:"https://www.helloasso.com/associations/..."});

    // Santé
    gmSection(body,"Questionnaire de santé","Questions OUI/NON. Tout à NON : attestation sur l'honneur, pas de certificat. Un OUI : certificat de moins de 6 mois. Le club ne voit que le résultat, jamais les réponses.");
    var cs=gmCard(); body.appendChild(cs);
    var ac=document.createElement("label"); ac.style.cssText="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--txt);margin-bottom:10px";
    var acb=document.createElement("input"); acb.type="checkbox"; acb.checked=d.sante.actif; acb.style.cssText="width:18px;height:18px"; acb.addEventListener("change",function(){ d.sante.actif=acb.checked; render(); });
    ac.appendChild(acb); ac.appendChild(document.createTextNode("Questionnaire sur la fiche")); cs.appendChild(ac);
    if(d.sante.actif){
      d.sante.questions.forEach(function(q,i){
        var r=document.createElement("div"); r.style.cssText="display:flex;gap:6px;align-items:flex-start;margin-bottom:6px";
        var n=document.createElement("span"); n.textContent=(i+1)+"."; n.style.cssText="font-size:12px;font-weight:800;color:var(--mut);padding-top:10px;width:18px;flex:none";
        var t=document.createElement("textarea"); t.rows=2; t.maxLength=300; t.style.cssText=inS+";flex:1;min-width:0"; t.value=q; t.addEventListener("input",function(){ d.sante.questions[i]=t.value; });
        var x=document.createElement("button"); x.type="button"; x.textContent="✕"; x.setAttribute("aria-label","Retirer"); x.style.cssText="width:30px;height:30px;border-radius:50%;border:none;background:rgba(192,57,43,.1);color:var(--red);cursor:pointer;flex:none;margin-top:4px";
        x.addEventListener("click",function(){ d.sante.questions.splice(i,1); render(); });
        r.appendChild(n); r.appendChild(t); r.appendChild(x); cs.appendChild(r);
      });
      var bq=gmRow(cs);
      bq.appendChild(gmBtn("+ Ajouter une question","soft",function(){ d.sante.questions.push(""); render(); }));
      bq.appendChild(gmBtn("Questions de départ","ghost",function(){ d.sante.questions=DOSSIER_QUESTIONS_BASE.slice(); render(); }));
    }

    // Charte
    gmSection(body,"Charte & règlement intérieur","Vide = pas de charte. Sinon la famille coche « lu et approuvé ».");
    var cc=gmCard(); body.appendChild(cc);
    champ(cc,"Titre",d.charte.titre,function(v){d.charte.titre=v;},{max:80,ph:"Charte du club"});
    champ(cc,"Texte",d.charte.texte,function(v){d.charte.texte=v;},{multi:true,rows:8,max:6000});

    // Autorisations
    gmSection(body,"Autorisations","« J'autorise / Je refuse » ou « Lu et approuvé » (case obligatoire).");
    d.autorisations.forEach(function(a,i){
      var c=gmCard(); body.appendChild(c);
      champ(c,"Titre",a.titre,function(v){a.titre=v;},{max:80});
      champ(c,"Texte",a.texte,function(v){a.texte=v;},{multi:true,rows:3,max:600});
      var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:8px";
      var se=document.createElement("select"); se.style.cssText=inS+";width:auto";
      [["choix","J'autorise / Je refuse"],["lu","Lu et approuvé (obligatoire)"]].forEach(function(o){ var op=document.createElement("option"); op.value=o[0]; op.textContent=o[1]; if(a.type===o[0]) op.selected=true; se.appendChild(op); });
      se.addEventListener("change",function(){ a.type=se.value; });
      r.appendChild(se); r.appendChild(sup(function(){ d.autorisations.splice(i,1); render(); }));
      c.appendChild(r);
    });
    gmRow(body).appendChild(gmBtn("+ Ajouter une autorisation","soft",function(){ d.autorisations.push({titre:"",texte:"",type:"choix"}); render(); }));

    var fin=gmRow(body); fin.style.cssText+=";margin:18px 0 8px;position:sticky;bottom:0;background:var(--bg);padding:10px 0";
    fin.appendChild(gmBtn("Enregistrer","primary",function(b){ dossierEnregistrer(d,b,sh); }));
    fin.appendChild(gmBtn("Dossier PDF","soft",function(){ dossierPdf(dossierNormaliser(d)); }));
  }
  render();
}
function dossierEnregistrer(d,btn,sh){
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var propre=dossierNormaliser(d);
  if(btn){ btn.disabled=true; btn.textContent="Enregistrement..."; }
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{dossier:propre})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.dossier=propre;
      if(typeof syncInscriptionCodes==="function"){ INSCRIPTION_CODES_PREV={}; syncInscriptionCodes(getLicences()); }
      if(sh&&sh.modal) sh.modal.remove();
      showToast("Dossier d'inscription enregistré !");
    }).catch(function(e){
      if(btn){ btn.disabled=false; btn.textContent="Enregistrer"; }
      askAlert("Erreur : "+((e&&e.code)||e));
    });
}

// ═══ FICHE D'INSCRIPTION (famille) ════════════════════════════════
var FICHE_DOSSIER=null;   // dossier du club de la fiche en cours (public ou staff)
var DOSSIER_QS={};        // réponses en cours (jamais envoyées une par une)
function dossierFiche(){ return FICHE_DOSSIER?dossierNormaliser(FICHE_DOSSIER):(window.CURRENT_CLUB?dossierClub():null); }
function dossierTitre(t){ return '<div style="background:var(--bdr);height:1px;margin:16px 0"></div><div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">'+authEsc(t)+'</div>'; }
function dossierFicheHtml(f){
  var d=dossierFiche(); f=f||{}; DOSSIER_QS={};
  if(!d) return "";
  var h="", deja={};
  (f.infosPlus||[]).forEach(function(x){ deja[x.l]=x.v; });
  if(d.perso.length){
    h+=dossierTitre("Informations complémentaires");
    d.perso.forEach(function(p,i){
      var id="f-dp-"+i, v=deja[p.label]!=null?deja[p.label]:"", lab=authEsc(p.label)+(p.oblig?" *":"");
      if(p.type==="ouinon"||p.type==="choix"){
        var ops=p.type==="ouinon"?["Oui","Non"]:String(p.options||"").split(";").map(function(s){return s.trim();}).filter(Boolean);
        h+='<div class="form-group"><label class="form-label" for="'+id+'">'+lab+'</label><select class="form-input" id="'+id+'"><option value="">Choisir…</option>'+
          ops.map(function(o){ return '<option'+(o===v?' selected':'')+'>'+authEsc(o)+'</option>'; }).join("")+'</select></div>';
      } else {
        h+='<div class="form-group"><label class="form-label" for="'+id+'">'+lab+'</label><input class="form-input" id="'+id+'" type="'+(p.type==="nombre"?"number":p.type==="date"?"date":"text")+'" maxlength="120" value="'+authEsc(v)+'"></div>';
      }
    });
  }
  var t=d.tarifs;
  if(t.lignes.length||t.options.length||t.fratrie||t.reglement||t.enLigne){
    h+=dossierTitre("Tarifs des licences");
    h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;font-size:12.5px;color:var(--txt);line-height:1.5">';
    t.lignes.forEach(function(l){ h+='<div style="display:flex;justify-content:space-between;gap:10px;padding:3px 0"><span>'+authEsc(l.label)+'</span><b style="white-space:nowrap">'+l.prix+' €</b></div>'; });
    if(t.fratrie) h+='<div style="margin-top:8px;color:var(--txt2)">Remise fratrie : '+authEsc(t.fratrie)+'</div>';
    if(t.reglement) h+='<div style="margin-top:8px;color:var(--txt2);white-space:pre-line">'+authEsc(t.reglement)+'</div>';
    if(t.enLigne) h+='<a href="'+authEsc(t.enLigne)+'" target="_blank" rel="noopener" style="display:block;margin-top:10px;padding:11px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:13px;font-weight:700;text-align:center;text-decoration:none">Payer en ligne (HelloAsso)</a>';
    h+='</div>';
    if(t.options.length){
      var opts=(f.optionsTarif||[]);
      h+='<div style="margin-top:10px">'+t.options.map(function(o,i){
        return '<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--txt);margin-bottom:8px"><input type="checkbox" id="f-dopt-'+i+'"'+(opts.indexOf(o.label)>=0?' checked':'')+' style="width:20px;height:20px;accent-color:var(--dkg)"> '+authEsc(o.label)+' (+'+o.prix+' €)</label>';
      }).join("")+'</div>';
    }
  }
  if(d.sante.actif&&d.sante.questions.length){
    h+=dossierTitre("Questionnaire de santé");
    h+='<div style="font-size:11.5px;color:var(--txt2);line-height:1.5;margin-bottom:10px">Confidentiel : le club voit seulement si toutes les réponses sont NON. Pour un mineur, à remplir avec le responsable légal.</div>';
    d.sante.questions.forEach(function(q,i){
      h+='<div style="padding:10px 0;border-bottom:1px solid var(--bdr)"><div style="font-size:12.5px;color:var(--txt);line-height:1.45;margin-bottom:8px"><b style="color:var(--mut)">'+(i+1)+'.</b> '+authEsc(q)+'</div>'+
        '<div style="display:flex;gap:8px"><button type="button" id="dqs-o-'+i+'" onclick="dossierQS('+i+',true)" style="flex:1;padding:9px;border-radius:var(--rx);border:1.5px solid var(--bdr);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">OUI</button>'+
        '<button type="button" id="dqs-n-'+i+'" onclick="dossierQS('+i+',false)" style="flex:1;padding:9px;border-radius:var(--rx);border:1.5px solid var(--bdr);background:transparent;color:var(--txt);font-size:13px;font-weight:700;cursor:pointer">NON</button></div></div>';
    });
    h+='<div id="dqs-res" style="margin-top:12px;font-size:12.5px;color:var(--mut)">Répondez à chaque question.</div>';
  }
  if(d.charte.texte.trim()){
    h+=dossierTitre(d.charte.titre||"Charte du club");
    h+='<div style="max-height:220px;overflow-y:auto;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;font-size:12px;color:var(--txt);line-height:1.55;white-space:pre-line">'+authEsc(d.charte.texte)+'</div>'+
      '<label style="display:flex;align-items:flex-start;gap:10px;margin-top:10px;font-size:13px;color:var(--txt)"><input type="checkbox" id="f-dcharte"'+(f.charteLue?' checked':'')+' style="width:20px;height:20px;accent-color:var(--dkg);flex-shrink:0"> J\'ai lu et j\'approuve la charte et le règlement du club *</label>';
  }
  if(d.autorisations.length){
    var av={}; (f.autorisations||[]).forEach(function(a){ av[a.t]=a.v; });
    h+=dossierTitre("Autorisations");
    d.autorisations.forEach(function(a,i){
      h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:8px">'+
        (a.titre?'<div style="font-size:12.5px;font-weight:800;color:var(--txt);margin-bottom:4px">'+authEsc(a.titre)+'</div>':'')+
        (a.texte?'<div style="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:8px">'+authEsc(a.texte)+'</div>':'');
      if(a.type==="lu"){
        h+='<label style="display:flex;align-items:center;gap:10px;font-size:13px;color:var(--txt)"><input type="checkbox" id="f-daut-'+i+'"'+(av[a.titre]==="lu"?' checked':'')+' style="width:20px;height:20px;accent-color:var(--dkg)"> Lu et approuvé *</label>';
      } else {
        h+='<div style="display:flex;gap:14px;font-size:13px;color:var(--txt)">'+
          '<label style="display:flex;align-items:center;gap:6px"><input type="radio" name="f-daut-'+i+'" value="oui"'+(av[a.titre]==="oui"?' checked':'')+' style="width:18px;height:18px;accent-color:var(--dkg)"> J\'autorise</label>'+
          '<label style="display:flex;align-items:center;gap:6px"><input type="radio" name="f-daut-'+i+'" value="non"'+(av[a.titre]==="non"?' checked':'')+' style="width:18px;height:18px;accent-color:var(--dkg)"> Je refuse</label></div>';
      }
      h+='</div>';
    });
  }
  return h;
}
function dossierQS(i,oui){
  DOSSIER_QS[i]=oui;
  var d=dossierFiche(); if(!d) return;
  var n=d.sante.questions.length, rep=0, unOui=false;
  for(var k=0;k<n;k++){
    var o=document.getElementById("dqs-o-"+k), no=document.getElementById("dqs-n-"+k);
    var v=DOSSIER_QS[k];
    if(v!==undefined){ rep++; if(v) unOui=true; }
    if(o){ o.style.background=v===true?"#B85C00":"transparent"; o.style.color=v===true?"#fff":"var(--txt)"; o.style.borderColor=v===true?"#B85C00":"var(--bdr)"; }
    if(no){ no.style.background=v===false?"var(--ltg)":"transparent"; no.style.color=v===false?"#fff":"var(--txt)"; no.style.borderColor=v===false?"var(--ltg)":"var(--bdr)"; }
  }
  var r=document.getElementById("dqs-res"); if(!r) return;
  if(unOui){
    r.innerHTML='<div style="background:rgba(184,92,0,.08);border:1px solid #B85C00;border-radius:var(--rs);padding:12px 14px;color:var(--txt);line-height:1.5"><b>Certificat médical obligatoire</b><br>Au moins une réponse est OUI : un certificat de non-contre-indication au basket de moins de 6 mois est nécessaire. Ajoutez-le plus bas, ou le club vous le réclamera.</div>';
  } else if(rep<n){
    r.textContent="Encore "+(n-rep)+" question(s).";
  } else {
    r.innerHTML='<div style="background:color-mix(in srgb, var(--ltg) 10%, transparent);border:1px solid var(--ltg);border-radius:var(--rs);padding:12px 14px;color:var(--txt);line-height:1.5"><b>Pas de certificat médical à fournir</b>'+
      '<label style="display:flex;align-items:flex-start;gap:10px;margin-top:8px;font-size:13px"><input type="checkbox" id="f-dattest" style="width:20px;height:20px;accent-color:var(--dkg);flex-shrink:0"> J\'atteste sur l\'honneur (responsable légal ou licencié majeur) avoir répondu NON à toutes les questions du questionnaire de santé. *</label></div>';
  }
}
// Lit et vérifie la partie « dossier » de la fiche. null = il manque quelque chose (message déjà affiché).
function dossierLireFiche(){
  var d=dossierFiche(); if(!d) return {};
  var out={};
  var infos=[];
  for(var i=0;i<d.perso.length;i++){
    var p=d.perso[i], el=document.getElementById("f-dp-"+i), v=el?String(el.value||"").trim().slice(0,120):"";
    if(p.oblig&&!v){ askAlert("« "+p.label+" » est obligatoire."); return null; }
    if(v) infos.push({l:p.label,v:v});
  }
  if(infos.length) out.infosPlus=infos;
  var opts=[]; d.tarifs.options.forEach(function(o,i){ var c=document.getElementById("f-dopt-"+i); if(c&&c.checked) opts.push(o.label); });
  if(opts.length) out.optionsTarif=opts;
  if(d.sante.actif&&d.sante.questions.length){
    var n=d.sante.questions.length, rep=0, unOui=false;
    for(var k=0;k<n;k++){ if(DOSSIER_QS[k]!==undefined){ rep++; if(DOSSIER_QS[k]) unOui=true; } }
    if(!unOui&&rep<n){ askAlert("Répondez à toutes les questions du questionnaire de santé."); return null; }
    if(unOui){ out.questionnaireSanteNon=false; }
    else {
      var at=document.getElementById("f-dattest");
      if(!at||!at.checked){ askAlert("Cochez l'attestation sur l'honneur du questionnaire de santé."); return null; }
      out.questionnaireSanteNon=true; out.attestationSante=true;
    }
  }
  if(d.charte.texte.trim()){
    var ch=document.getElementById("f-dcharte");
    if(!ch||!ch.checked){ askAlert("Cochez « J'ai lu et j'approuve la charte »."); return null; }
    out.charteLue=true;
  }
  var auts=[];
  for(var j=0;j<d.autorisations.length;j++){
    var a=d.autorisations[j], nom=a.titre||("Autorisation "+(j+1));
    if(a.type==="lu"){
      var c=document.getElementById("f-daut-"+j);
      if(!c||!c.checked){ askAlert("« "+nom+" » : cochez « Lu et approuvé »."); return null; }
      auts.push({t:nom,v:"lu"});
    } else {
      var r=document.querySelector('input[name="f-daut-'+j+'"]:checked');
      if(!r){ askAlert("« "+nom+" » : choisissez J'autorise ou Je refuse."); return null; }
      auts.push({t:nom,v:r.value});
    }
  }
  if(auts.length) out.autorisations=auts;
  return out;
}
// Lignes ajoutées au détail d'une fiche (écran Licences, staff).
function dossierDetailLignes(f){
  f=f||{}; var l=[];
  (f.infosPlus||[]).forEach(function(x){ l.push([x.l,x.v]); });
  if(f.optionsTarif&&f.optionsTarif.length) l.push(["Options",f.optionsTarif.join(", ")]);
  if(f.charteLue) l.push(["Charte","Lue et approuvée"]);
  (f.autorisations||[]).forEach(function(a){ l.push([a.t,a.v==="oui"?"Autorise":a.v==="non"?"Refuse":"Lu et approuvé"]); });
  return l;
}

// ═══ DOSSIER PDF À IMPRIMER ═══════════════════════════════════════
function dossierPlanning(){
  // Créneaux d'entraînement des 14 prochains jours, regroupés par jour de semaine.
  if(typeof getEvents!=="function") return [];
  var auj=new Date(), fin=new Date(); fin.setDate(fin.getDate()+14);
  var iso=function(x){ return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0"); };
  var a=iso(auj), b=iso(fin), vu={}, l=[];
  getEvents().forEach(function(e){
    if(e.type!=="entrainement"||e.cancelled||!e.date||e.date<a||e.date>b) return;
    var j=(new Date(e.date+"T12:00:00").getDay()+6)%7;
    var k=j+"|"+(e.heure||"")+"|"+(e.equipe||e.titre||"")+"|"+(e.lieu||"");
    if(vu[k]) return; vu[k]=1;
    l.push({j:j,h:e.heure||"",q:e.equipe||e.titre||"",lieu:e.lieu||""});
  });
  return l.sort(function(x,y){ return x.j-y.j||String(x.h).localeCompare(String(y.h)); });
}
function dossierPdf(d,partie){
  if(!window.jspdf||!window.jspdf.jsPDF){ askAlert("Le module PDF n'est pas encore chargé, réessayez dans un instant."); return; }
  d=d||dossierClub();
  var doc=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
  var W=210, M=14, y=0, rgb=(typeof clubPdfRgb==="function")?clubPdfRgb():[27,92,40];
  var club=(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"Club", saison=(typeof getCurrentSeason==="function")?getCurrentSeason():"";
  var txt=function(s){ return String(s==null?"":s).replace(/[’‘]/g,"'").replace(/[“”«»]/g,'"').replace(/[–—]/g,"-").replace(/…/g,"..."); };
  function bandeau(titre,sous){
    doc.setFillColor(rgb[0],rgb[1],rgb[2]); doc.rect(0,0,W,22,"F");
    doc.setTextColor(255,255,255); doc.setFont("helvetica","bold"); doc.setFontSize(9); doc.text(txt(club.toUpperCase()),M,8);
    doc.setFontSize(14); doc.text(txt(titre),M,15);
    if(sous){ doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.text(txt(sous),M,19.5); }
    doc.setTextColor(30,30,30); y=30;
  }
  var vierge=true;
  function page(titre,sous){ if(vierge) vierge=false; else doc.addPage(); bandeau(titre,sous); }
  function place(h){ if(y+h>282){ page("Dossier d'inscription (suite)","Saison "+saison); } }
  function section(t){
    place(14);
    doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(rgb[0],rgb[1],rgb[2]);
    doc.text(txt(t.toUpperCase()),M,y); doc.setDrawColor(rgb[0],rgb[1],rgb[2]); doc.setLineWidth(.4); doc.line(M,y+1.5,W-M,y+1.5);
    doc.setTextColor(30,30,30); y+=7;
  }
  function para(s,taille,gras){
    doc.setFont("helvetica",gras?"bold":"normal"); doc.setFontSize(taille||9);
    var lignes=doc.splitTextToSize(txt(s),W-2*M);
    lignes.forEach(function(li){ place(5); doc.text(li,M,y); y+=(taille||9)*.45; });
    y+=1;
  }
  function boite(x,yy){ doc.setDrawColor(90,90,90); doc.setLineWidth(.3); doc.rect(x,yy-3,3.2,3.2); }
  function champLigne(label,x,w){
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(90,90,90);
    doc.text(txt(label),x,y); doc.setDrawColor(170,170,170); doc.setLineWidth(.2);
    doc.line(x,y+5.5,x+w,y+5.5); doc.setTextColor(30,30,30);
  }
  function rangee(champs){ // [[label,largeurRelative],...]
    place(11);
    var tot=champs.reduce(function(s,c){return s+c[1];},0), x=M, dispo=W-2*M-(champs.length-1)*4;
    champs.forEach(function(c){ var w=dispo*c[1]/tot; champLigne(c[0],x,w); x+=w+4; });
    y+=9;
  }
  function caseTexte(s){
    doc.setFont("helvetica","normal"); doc.setFontSize(9);
    var li=doc.splitTextToSize(txt(s),W-2*M-6);
    place(li.length*4.2+2); boite(M,y); li.forEach(function(x){ doc.text(x,M+5,y); y+=4.2; }); y+=2;
  }
  function cases(label,opts){
    place(7);
    doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(90,90,90); doc.text(txt(label),M,y);
    var x=M+Math.min(70,doc.getTextWidth(txt(label))+6); doc.setTextColor(30,30,30);
    opts.forEach(function(o){ boite(x,y); doc.text(txt(o),x+5,y); x+=doc.getTextWidth(txt(o))+12; });
    y+=7;
  }

  // ── Page 1 : fiche
  if(!partie){
  page("Fiche d'inscription","Saison sportive "+saison);
  var e=d.entete||{}, coord=[e.adresse,e.telephone?"Tél. "+e.telephone:"",e.email,e.web].filter(Boolean).join("  ·  "), leg=[e.rna?"RNA : "+e.rna:"",e.siret?"SIRET : "+e.siret:""].filter(Boolean).join("  ·  ");
  try{
    var logo=window.CURRENT_CLUB&&window.CURRENT_CLUB.logo;
    if(logo&&/^data:image\/(png|jpe?g)/i.test(logo)) doc.addImage(logo,/png/i.test(logo.slice(0,20))?"PNG":"JPEG",W-M-16,3,16,16);
  }catch(err){}
  if(coord) para(coord,8.5);
  if(leg) para(leg,8.5);
  section("1. Renseignements de l'adhérent(e)");
  rangee([["Nom",1],["Prénom",1]]);
  rangee([["Date de naissance",1],["Lieu de naissance",1],["Catégorie",1]]);
  rangee([["Adresse postale complète",1]]);
  rangee([["Téléphone",1],["E-mail",1.4]]);
  cases("Sexe :",["F","M"]);
  var persoTxt=d.perso.filter(function(p){ return !/lieu de naissance/i.test(p.label); });
  var tmp=[];
  persoTxt.forEach(function(p){
    if(p.type==="ouinon") cases(p.label+" :",["Oui","Non"]);
    else if(p.type==="choix") cases(p.label+" :",String(p.options||"").split(";").map(function(s){return s.trim();}).filter(Boolean).slice(0,6));
    else { tmp.push([p.label,1]); if(tmp.length===3){ rangee(tmp); tmp=[]; } }
  });
  if(tmp.length) rangee(tmp);
  section("2. Représentants légaux & urgence");
  rangee([["Responsable 1 - Nom & prénom",1.3],["Téléphone",.8],["E-mail",1.1]]);
  rangee([["Responsable 2 - Nom & prénom",1.3],["Téléphone",.8],["E-mail",1.1]]);
  rangee([["Urgence (hors parents) - Nom & prénom",1.3],["Téléphone",.8],["Infos médicales utiles (allergies, asthme...)",1.1]]);

  var t=d.tarifs;
  if(t.lignes.length||t.options.length||t.reglement||t.fratrie||t.enLigne){
    section("3. Tarifs des licences & règlement");
    doc.setFontSize(9);
    t.lignes.forEach(function(l){
      place(6); doc.setFont("helvetica","normal"); doc.text(txt(l.label),M,y);
      doc.setFont("helvetica","bold"); doc.text(l.prix+" €",W-M,y,{align:"right"});
      doc.setDrawColor(225,225,225); doc.line(M,y+1.6,W-M,y+1.6); y+=5.5;
    });
    y+=1;
    t.options.forEach(function(o){ place(6); boite(M,y); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(txt(o.label+" : +"+o.prix+" €"),M+5,y); y+=6; });
    if(t.fratrie) para("Remise fratrie : "+t.fratrie,9);
    if(t.reglement) para(t.reglement,9);
    if(t.enLigne) para("Paiement en ligne (HelloAsso) : "+t.enLigne,9);
    var aides=(window.CURRENT_CLUB&&window.CURRENT_CLUB.aides)||{};
    if(aides.passSport) rangee([["Code Pass'Sport",1]]);
    if(aides.passRegion) rangee([["Pass'Région (n° de carte)",1]]);
    place(30);
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.text("Échéancier",M,y); y+=4;
    for(var k=0;k<4;k++){ rangee([["Date",1],["Montant (€)",1],["N° de chèque",1],["Mode : Vir / Esp / Chq",1.2]]); y-=2; }
    y+=2;
  }

  }

  // ── Santé
  if((partie==="sante"||(!partie&&d.sante.actif))&&d.sante.questions.length){
    page("Questionnaire de santé & attestation","Confidentiel · Code du sport, art. A231-3");
    para("Si vous répondez NON à toutes les questions, le certificat médical n'est pas requis. Si vous répondez OUI à au moins une question, un certificat médical de non-contre-indication de moins de 6 mois est obligatoire.",8.5);
    y+=2;
    d.sante.questions.forEach(function(q,i){
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      var li=doc.splitTextToSize(txt((i+1)+". "+q),W-2*M-40);
      place(li.length*4.2+3);
      doc.text(li,M,y);
      boite(W-M-30,y); doc.text("OUI",W-M-25.5,y); boite(W-M-13,y); doc.text("NON",W-M-8.5,y);
      y+=li.length*4.2+2.5; doc.setDrawColor(225,225,225); doc.line(M,y-1.5,W-M,y-1.5);
    });
    y+=3;
    section("Attestation sur l'honneur");
    para("Je soussigné(e) ............................................................................., responsable légal de ............................................................................. (ou licencié majeur), atteste sur l'honneur avoir complété le questionnaire relatif à l'état de santé du sportif.",9);
    caseTexte("Cas 1 (dispense) : nous avons répondu NON à l'ensemble des questions.");
    caseTexte("Cas 2 (certificat obligatoire) : au moins une réponse est OUI, je fournis un certificat médical de moins de 6 mois.");
    y+=2; rangee([["Fait à",1],["Le",.7],["Signature",1.2]]);
  }

  // ── Planning
  var pl=dossierPlanning();
  if(!partie&&pl.length){
    page("Planning des entraînements","Saison "+saison+" · horaires susceptibles d'évoluer");
    var jours=["Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi","Dimanche"], dernier=-1;
    pl.forEach(function(c){
      place(6); doc.setFontSize(9);
      doc.setFont("helvetica","bold"); if(c.j!==dernier){ doc.text(jours[c.j],M,y); dernier=c.j; }
      doc.setFont("helvetica","normal"); doc.text(txt(c.h),M+28,y);
      doc.text(doc.splitTextToSize(txt(c.q),70)[0]||"",M+52,y); doc.text(doc.splitTextToSize(txt(c.lieu),55)[0]||"",M+126,y);
      doc.setDrawColor(225,225,225); doc.line(M,y+1.6,W-M,y+1.6); y+=5.5;
    });
  }

  // ── Charte
  if((!partie||partie==="charte")&&d.charte.texte.trim()){
    page(d.charte.titre||"Charte du club","Respect · Plaisir · Esprit d'équipe");
    d.charte.texte.split("\n").forEach(function(li){
      if(!li.trim()){ y+=2; return; }
      var titre=li===li.toUpperCase()&&/[A-Z]/.test(li);
      para(li,titre?9.5:9,titre);
    });
  }

  // ── Autorisations & signatures
  if(!partie||partie==="autorisations"){
  page("Autorisations, décharges & signatures","Validation du dossier · saison "+saison);
  d.autorisations.forEach(function(a,i){
    var titre=String.fromCharCode(65+i)+". "+(a.titre||"Autorisation");
    place(18); para(titre,9.5,true);
    if(a.texte) para(a.texte,8.5);
    place(7);
    if(a.type==="lu"){ boite(M,y); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("Lu et approuvé",M+5,y); }
    else { boite(M,y); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text("J'autorise",M+5,y); boite(M+32,y); doc.text("Je refuse",M+37,y); }
    y+=8;
  });
  if(d.charte.texte.trim()){ place(7); boite(M,y); doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.text(txt("J'ai lu et j'approuve "+(d.charte.titre||"la charte du club").toLowerCase()),M+5,y); y+=8; }
  section("Engagements & signatures");
  para("En signant ci-dessous, les parties attestent l'exactitude des renseignements, confirment l'adhésion sportive et s'engagent à respecter l'ensemble des règles du club présentées dans ce dossier.",8.5);
  place(40);
  var bw=(W-2*M-8)/3, bx=M;
  [["Le représentant légal","Lu et approuvé, bon pour accord"],["L'adhérent(e)","Je m'engage à respecter les règles"],["Pour le club","Validation du dossier complet"]].forEach(function(s){
    doc.setDrawColor(150,150,150); doc.setLineDashPattern([1,1],0); doc.rect(bx,y,bw,32); doc.setLineDashPattern([],0);
    doc.setFont("helvetica","bold"); doc.setFontSize(8.5); doc.text(txt(s[0].toUpperCase()),bx+3,y+5);
    doc.setFont("helvetica","italic"); doc.setFontSize(7.5); doc.text(txt(s[1]),bx+3,y+9);
    doc.setFont("helvetica","normal"); doc.text("Signature :",bx+3,y+28);
    bx+=bw+4;
  });
  y+=36;
  }
  if(vierge){ askAlert("Rien à imprimer : complète d'abord cette partie dans « Régler le dossier »."); return; }

  // ── Pied de page
  var n=doc.getNumberOfPages();
  for(var p=1;p<=n;p++){
    doc.setPage(p); doc.setFont("helvetica","normal"); doc.setFontSize(7.5); doc.setTextColor(120,120,120);
    doc.text(txt(club+" - Dossier d'inscription "+saison),M,292); doc.text("Page "+p+" / "+n,W-M,292,{align:"right"});
  }
  var slug=(typeof clubSlug==="function")?clubSlug():"club";
  doc.save(slug+"_"+({sante:"questionnaire-sante",charte:"charte",autorisations:"autorisations"}[partie]||"dossier-inscription")+"_"+String(saison).replace(/\//g,"-")+".pdf");
}

// ═══ ÉCRAN DOCUMENTS : les pièces du dossier d'inscription ═════════
// Questionnaire de santé (Formulaire), charte (Règlement), autorisations (Autorisation)
// et dossier complet : toujours à jour, générés depuis le réglage du dossier.
function dossierDocsCartes(cat){
  var d=dossierClub(), dir=localStorage.getItem("asmb_profile")==="dirigeant", out=[];
  var items=[
    {cat:"formulaire",titre:"Dossier d'inscription complet",sous:"Fiche, tarifs, santé, planning, charte, autorisations",partie:null,ok:true},
    {cat:"formulaire",titre:"Questionnaire de santé",sous:d.sante.questions.length+" questions · "+(d.sante.actif?"sur la fiche en ligne":"pas sur la fiche en ligne"),partie:"sante",ok:d.sante.questions.length>0},
    {cat:"reglement",titre:d.charte.titre||"Charte & règlement intérieur",sous:d.charte.texte.trim()?"À lire et approuver sur la fiche":"Pas encore écrite",partie:"charte",ok:!!d.charte.texte.trim()},
    {cat:"autorisation",titre:"Autorisations & signatures",sous:d.autorisations.length?d.autorisations.length+" autorisation(s) sur la fiche":"Aucune autorisation réglée",partie:"autorisations",ok:true}
  ];
  items.forEach(function(it){
    if(cat&&cat!=="all"&&cat!==it.cat) return;
    var c=document.createElement("div");
    c.style.cssText="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;display:flex;align-items:center;gap:12px";
    var g=document.createElement("div"); g.style.cssText="flex:1;min-width:0";
    var b=document.createElement("span"); b.textContent=(typeof DOC_CAT_LABELS!=="undefined"&&DOC_CAT_LABELS[it.cat])||it.cat;
    b.style.cssText="font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;color:#fff;background:"+((typeof DOC_CAT_COLORS!=="undefined"&&DOC_CAT_COLORS[it.cat])||"#8E44AD");
    var b2=document.createElement("span"); b2.textContent="Dossier d'inscription"; b2.style.cssText="font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;margin-left:6px;background:var(--bdr);color:var(--mut)";
    var t=document.createElement("div"); t.textContent=it.titre; t.style.cssText="font-size:13px;font-weight:700;color:var(--txt);margin-top:5px";
    var st=document.createElement("div"); st.textContent=it.sous; st.style.cssText="font-size:11px;color:var(--mut);margin-top:2px";
    g.appendChild(b); g.appendChild(b2); g.appendChild(t); g.appendChild(st); c.appendChild(g);
    var acts=document.createElement("div"); acts.style.cssText="display:flex;flex-direction:column;gap:6px;flex:none";
    if(it.ok) acts.appendChild(gmBtn("PDF","soft",function(){ dossierPdf(null,it.partie); }));
    if(dir) acts.appendChild(gmBtn("Modifier","ghost",function(){ dossierEditeur(); }));
    c.appendChild(acts);
    out.push(c);
  });
  return out;
}
