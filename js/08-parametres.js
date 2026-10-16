/* ===== 08-parametres.js — Ecran Parametres et sa personnalisation ===== */
// ═══ PARAMETRES ══════════════════════════════════════════════════
function buildParametres(){
  var isDirigeant=localStorage.getItem("asmb_profile")==="dirigeant";
  var adminOnly=document.getElementById("params-dirigeant-only");
  if(adminOnly) adminOnly.style.display=isDirigeant?"block":"none";
  var seasonEl=document.getElementById("season-status");
  if(seasonEl){
    var cur=getCurrentSeason(), natural=computeNaturalSeason();
    if(natural!==cur){
      seasonEl.innerHTML='Saison affichée : <b>'+cur+'</b><br><span style="color:#E8670A;font-weight:700">La saison '+natural+' a commencé — pensez à archiver.</span>';
    } else {
      seasonEl.textContent="Saison affichée : "+cur;
    }
  }
  var gd=document.getElementById("gp-dark");
  if(gd)gd.checked=document.documentElement.getAttribute("data-theme")==="dark";
  buildVisualThemePicker(); if(typeof gmDeskThemeBuild==="function") gmDeskThemeBuild();
  buildPaletteClub();
  var toggle=document.getElementById("notif-toggle");
  if(toggle)toggle.checked=(typeof pushStatus==="function")?pushStatus()==="granted":localStorage.getItem("asmb_notif")==="on";
  ["messages","match","entrainement","evenement"].forEach(function(t){
    var tg=document.getElementById("notif-"+t+"-toggle");
    if(tg)tg.checked=localStorage.getItem("asmb_notif_"+t)!=="off";
  });
  var accEl=document.getElementById("account-info-box");
  if(accEl){
    var u=window.ASMB_USER;
    accEl.innerHTML = u
      ? "Connecté en tant que <b>"+authEsc(u.email||"")+"</b>"
      : "Connexion en cours...";
  }
  buildClubStats();
  majApercuLogo();
  var lpEl=document.getElementById("club-lien-paiement");
  if(lpEl) lpEl.value=(window.CURRENT_CLUB && window.CURRENT_CLUB.lienPaiement) || "";
  remplirFormLiensClub();
  remplirFormCerfa();
  remplirFormFacturation();
  remplirFormRelances();
  var fbBtn=document.getElementById("feedback-send-btn");
  if(fbBtn && !fbBtn.dataset.wired){
    fbBtn.dataset.wired="1";
    fbBtn.addEventListener("click", function(){ sendFeedback(""); });
  }
  wireThemeAnimSettings("");
  buildParametresLayout();
}

// ═══ LOGO DU CLUB ════════════════════════════════════════════════
// L'application ne se sert pas de Firebase Storage : toutes ses images passent
// par Firestore en base64. On garde ce mecanisme, avec une limite stricte —
// un document Firestore ne peut pas depasser 1 Mo, logo compris.
var CLUB_LOGO_PX=256;
var CLUB_LOGO_OCTETS_MAX=400000;

// Le logo est centre dans un carre transparent plutot que deforme ou recadre :
// un ecusson de club est rarement carre, et l'etirer le rend meconnaissable.
function compresserLogo(file){
  return new Promise(function(resolve,reject){
    var reader=new FileReader();
    reader.onload=function(e){
      var img=new Image();
      img.onload=function(){
        var cote=Math.max(img.width,img.height)||1;
        var ech=Math.min(1,CLUB_LOGO_PX/cote);
        var w=Math.max(1,Math.round(img.width*ech)), h=Math.max(1,Math.round(img.height*ech));
        var canvas=document.createElement("canvas");
        canvas.width=CLUB_LOGO_PX;canvas.height=CLUB_LOGO_PX;
        var ctx=canvas.getContext("2d");
        ctx.drawImage(img,Math.round((CLUB_LOGO_PX-w)/2),Math.round((CLUB_LOGO_PX-h)/2),w,h);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror=function(){reject(new Error("Image illisible"));};
      img.src=e.target.result;
    };
    reader.onerror=function(){reject(new Error("Lecture impossible"));};
    reader.readAsDataURL(file);
  });
}

// ── Couleurs du club (palette de 50 teintes, 2 au plus, dirigeant uniquement) ──
// 1re touche = couleur principale (en-tête, boutons, PDF), 2e = couleur
// secondaire (accent, fin des dégradés). Toucher une couleur choisie la retire.
function buildPaletteClub(){
  var box=document.getElementById("club-palette");
  if(!box||typeof CLUB_PALETTE==="undefined") return;
  var c1=clubCouleurBrute(), c2=clubCouleur2Brute();
  box.innerHTML="";
  CLUB_PALETTE.forEach(function(hex){
    var h=hex.toLowerCase();
    var rang=(h===c1)?1:((h===c2)?2:0);
    var blanc=(h==="#ffffff");
    var b=document.createElement("button");
    b.type="button";
    b.setAttribute("aria-label","Couleur "+(blanc?"blanc":hex)+(rang?(rang===1?" (principale)":" (secondaire)"):""));
    b.title=blanc?"Blanc":hex;
    b.style.cssText="aspect-ratio:1;border-radius:50%;border:"+(rang?"3px solid var(--txt)":(blanc?"2px solid var(--bdr)":"2px solid transparent"))+";background:"+hex+";cursor:pointer;padding:0;box-shadow:0 1px 3px rgba(0,0,0,.25);color:"+(blanc?"#14141f":"#fff")+";font-size:11px;font-weight:900";
    if(rang) b.textContent=String(rang);
    b.onclick=function(){ toucherCouleurClub(h); };
    box.appendChild(b);
  });
  var etat=document.getElementById("club-couleur-etat");
  if(etat) etat.textContent=c1?("Couleur principale : "+(c1==="#ffffff"?"blanc":c1)+(c2?" · secondaire : "+(c2==="#ffffff"?"blanc":c2):" · touchez une 2e couleur si vous voulez")):"Couleurs General Manager (par défaut)";
  var rs=document.getElementById("club-couleur-reset");
  if(rs) rs.style.display=c1?"block":"none";
  if(typeof majBoutonPalette==="function") majBoutonPalette();
}
function toucherCouleurClub(hex){
  var c1=clubCouleurBrute(), c2=clubCouleur2Brute(), n1=c1, n2=c2, msg=null;
  if(hex===c1){ n1=c2||null; n2=null; }
  else if(hex===c2){ n2=null; }
  else if(!c1){ n1=hex; }
  else if(!c2){ n2=hex; }
  else { n2=hex; msg="2 couleurs maximum : la couleur secondaire a été remplacée"; }
  enregistrerCouleursClub(n1,n2,msg);
}
// Compatibilité : ancien point d'entrée (bouton « Revenir aux couleurs GM »).
function choisirCouleurClub(hex){ if(hex===null) enregistrerCouleursClub(null,null); else toucherCouleurClub(String(hex).toLowerCase()); }
function enregistrerCouleursClub(c1,c2,msg){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var ok=function(x){ return x===null || (typeof CLUB_PALETTE!=="undefined" && CLUB_PALETTE.map(function(p){return p.toLowerCase();}).indexOf(x)>=0); };
  if(!ok(c1)||!ok(c2)) return;
  if(!c1) c2=null;
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{couleur:c1,couleur2:c2})
    .then(function(){
      if(window.CURRENT_CLUB){ window.CURRENT_CLUB.couleur=c1; window.CURRENT_CLUB.couleur2=c2; clubNormaliserCouleurs(window.CURRENT_CLUB); }
      applyClubColor();
      buildPaletteClub();
      showToast(msg||(c1?"Couleurs du club enregistrées":"Couleurs General Manager rétablies"));
    }).catch(function(e){ askAlert("Erreur : "+((e&&(e.message||e.code))||e)); });
}

function majApercuLogo(){
  var ap=document.getElementById("club-logo-apercu");
  if(ap && typeof clubLogoHtml==="function") ap.innerHTML=clubLogoHtml(64);
  var etat=document.getElementById("club-logo-etat");
  if(etat) etat.textContent=(typeof clubLogo==="function"&&clubLogo())
    ? "Logo du club" : "Aucun logo : les initiales sont affichées";
  var rm=document.getElementById("club-logo-retirer");
  if(rm) rm.style.display=(typeof clubLogo==="function"&&clubLogo())?"block":"none";
  var ri=document.getElementById("club-logo-reinstall");
  if(ri) ri.style.display=(typeof clubLogo==="function"&&clubLogo())?"block":"none";
}

function televerserLogoClub(input){
  if(!input||!input.files||!input.files[0])return;
  var file=input.files[0];
  input.value="";
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  if(file.type.indexOf("image/")!==0){ askAlert("Choisissez un fichier image."); return; }
  compresserLogo(file).then(function(dataUrl){
    if(dataUrl.length>CLUB_LOGO_OCTETS_MAX){
      askAlert("Logo trop lourd même après réduction. Un PNG au fond transparent, sans photo, passera sans problème.");
      return null;
    }
    return window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{logo:dataUrl})
      .then(function(){
        if(window.CURRENT_CLUB) window.CURRENT_CLUB.logo=dataUrl;
        if(typeof applyClubLogo==="function") applyClubLogo();
        majApercuLogo();
        if(typeof iconeReinstallerTuto==="function") iconeReinstallerTuto();
      });
  }).catch(function(e){ askAlert("Erreur : "+((e&&(e.message||e.code))||e)); });
}

function retirerLogoClub(){
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc)return;
  askConfirm("Retirer le logo du club ? Les initiales seront affichées à la place.",
    {danger:true,confirmText:"Retirer"}).then(function(ok){
    if(!ok)return;
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{logo:null})
      .then(function(){
        if(window.CURRENT_CLUB) window.CURRENT_CLUB.logo=null;
        if(typeof applyClubLogo==="function") applyClubLogo();
        majApercuLogo();
        if(typeof iconeReinstallerTuto==="function") iconeReinstallerTuto();
      }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  });
}

// ═══ PAIEMENT DES LICENCES (lien externe, ex. HelloAsso) ════════════
// L'appli ne touche jamais aux fonds : chaque club garde son propre compte
// HelloAsso (ou equivalent) et ses propres virements. On stocke seulement
// le lien vers son formulaire, affiche ensuite comme bouton aux familles.
function enregistrerLienPaiement(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var val=(document.getElementById("club-lien-paiement")||{}).value||"";
  val=val.trim();
  if(val && !/^https?:\/\//i.test(val)){ askAlert("Le lien doit commencer par http:// ou https://"); return; }
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{lienPaiement:val||null})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.lienPaiement=val||null;
      showToast(val?"Lien de paiement enregistré !":"Lien de paiement retiré.");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}

// ═══ RÉSEAUX SOCIAUX ET BOUTIQUE DU CLUB ════════════════════════════
function remplirFormLiensClub(){
  var box=document.getElementById("club-liens-form"); if(!box) return;
  var l=(window.CURRENT_CLUB&&window.CURRENT_CLUB.liens)||{};
  box.innerHTML="";
  CLUB_LIENS.forEach(function(d){
    var g=document.createElement("div"); g.className="form-group";
    var lab=document.createElement("label"); lab.className="form-label"; lab.htmlFor="club-lien-"+d.k; lab.textContent=d.label;
    var i=document.createElement("input"); i.className="form-input"; i.id="club-lien-"+d.k;
    i.type="url"; i.inputMode="url"; i.autocapitalize="off"; i.placeholder=d.ph; i.value=l[d.k]||"";
    g.appendChild(lab); g.appendChild(i); box.appendChild(g);
  });
}
function enregistrerLiensClub(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var liens={}, faux=[];
  CLUB_LIENS.forEach(function(d){
    var el=document.getElementById("club-lien-"+d.k); if(!el) return;
    var v=normaliserLienClub(d.k, el.value);
    if(v===null){ faux.push(d.label); return; }
    if(v){ liens[d.k]=v; el.value=v; }
  });
  if(faux.length){ askAlert("Lien non reconnu : "+faux.join(", ")+". Collez l'adresse complète (https://...)."); return; }
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{liens:liens})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.liens=liens;
      showToast(Object.keys(liens).length?"Liens enregistrés":"Liens retirés");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}

// Utilise par la fiche licence (06-licences.js) pour afficher (ou non) le
// bouton "Payer ma licence".
function clubLienPaiement(){
  return (window.CURRENT_CLUB && window.CURRENT_CLUB.lienPaiement) || null;
}

// ═══ REÇUS FISCAUX (CERFA n°11580) ═══════════════════════════════
// Toutes les infos légales nécessaires pour émettre un reçu fiscal valide
// sont saisies une fois ici, puis réutilisées sur chaque don (voir
// 15-compta-inventaire.js). cerfa.active conditionne l'apparition du
// bouton "Générer le reçu fiscal" sur les lignes de type Dons.
function remplirFormCerfa(){
  var c=(window.CURRENT_CLUB && window.CURRENT_CLUB.cerfa)||{};
  var activeEl=document.getElementById("cerfa-active"); if(activeEl)activeEl.checked=!!c.active;
  var adrEl=document.getElementById("cerfa-adresse"); if(adrEl)adrEl.value=c.adresse||"";
  var objEl=document.getElementById("cerfa-objet"); if(objEl)objEl.value=c.objet||"";
  var rnaEl=document.getElementById("cerfa-rna"); if(rnaEl)rnaEl.value=c.rna||"";
  var dateEl=document.getElementById("cerfa-date-declaration"); if(dateEl)dateEl.value=c.dateDeclaration||"";
}
function enregistrerInfosCerfa(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var cerfa={
    active:!!(document.getElementById("cerfa-active")||{}).checked,
    adresse:((document.getElementById("cerfa-adresse")||{}).value||"").trim(),
    objet:((document.getElementById("cerfa-objet")||{}).value||"").trim(),
    rna:((document.getElementById("cerfa-rna")||{}).value||"").trim(),
    dateDeclaration:(document.getElementById("cerfa-date-declaration")||{}).value||""
  };
  if(cerfa.active && (!cerfa.adresse||!cerfa.objet||!cerfa.rna||!cerfa.dateDeclaration)){
    askAlert("Renseignez tous les champs avant d'activer les reçus fiscaux.");
    return;
  }
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{cerfa:cerfa})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.cerfa=cerfa;
      showToast("Informations CERFA enregistrées !");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
// Utilisé par 15-compta-inventaire.js pour savoir si la génération de
// CERFA est possible (infos club complètes + club habilité).
function clubCerfaInfos(){
  var c=(window.CURRENT_CLUB && window.CURRENT_CLUB.cerfa)||null;
  if(!c||!c.active||!c.adresse||!c.objet||!c.rna||!c.dateDeclaration) return null;
  return c;
}

// ═══ FACTURATION (sponsors/partenaires) ═══════════════════════════
// Identité légale (adresse/SIRET/TVA) : dirigeant uniquement, stockée sur
// clubs/{clubId}.facturation comme le CERFA. Le compteur de numérotation,
// lui, doit pouvoir être incrémenté par un trésorier/bureau délégué sur
// Sponsors — il vit donc à part, dans clubs/{clubId}/facturation_compteur,
// une collection avec sa propre règle hasPermission(clubId,'sponsors')
// (voir firestore.rules et reserverNumeroFacture() dans 17-sponsors.js).
function remplirFormFacturation(){
  var f=(window.CURRENT_CLUB && window.CURRENT_CLUB.facturation)||{};
  var adrEl=document.getElementById("fact-adresse"); if(adrEl)adrEl.value=f.adresse||"";
  var siretEl=document.getElementById("fact-siret"); if(siretEl)siretEl.value=f.siret||"";
  var tvaEl=document.getElementById("fact-tva-active"); if(tvaEl)tvaEl.checked=!!f.tvaActive;
  var tauxBox=document.getElementById("fact-tva-taux-box"); if(tauxBox)tauxBox.style.display=f.tvaActive?"block":"none";
  var tauxEl=document.getElementById("fact-tva-taux"); if(tauxEl)tauxEl.value=(f.tvaTaux!=null?f.tvaTaux:20);
  if(typeof remplirProchainNumeroFacture==="function") remplirProchainNumeroFacture();
}
function enregistrerInfosFacturation(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var fact={
    adresse:((document.getElementById("fact-adresse")||{}).value||"").trim(),
    siret:((document.getElementById("fact-siret")||{}).value||"").trim(),
    tvaActive:!!(document.getElementById("fact-tva-active")||{}).checked,
    tvaTaux:parseFloat((document.getElementById("fact-tva-taux")||{}).value)||20
  };
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{facturation:fact})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.facturation=fact;
      showToast("Informations de facturation enregistrées !");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
// Utilisé par 17-sponsors.js : renvoie les infos de facturation si
// l'adresse (minimum légal) est renseignée, sinon null (bloque la génération).
function clubFacturationInfos(){
  var f=(window.CURRENT_CLUB && window.CURRENT_CLUB.facturation)||null;
  if(!f||!f.adresse) return null;
  return f;
}

// ═══ RELANCES IMPAYÉS (licences) ════════════════════════════════════
// Le seuil (nb de relances sans paiement avant que le bouton "Suspendre"
// n'apparaisse) est au choix du dirigeant, pas une valeur figée dans le
// code — voir licenceEligibleSuspension() dans 06-licences.js qui lit
// clubSeuilRelances().
function remplirFormRelances(){
  if(typeof aidesRemplirParams==="function") aidesRemplirParams();
  var r=(window.CURRENT_CLUB && window.CURRENT_CLUB.relances)||{};
  var seuilEl=document.getElementById("rel-seuil"); if(seuilEl)seuilEl.value=(r.seuilSuspension!=null?r.seuilSuspension:3);
}
function enregistrerInfosRelances(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  if(!window.CURRENT_CLUB_ID||!window.fbUpdateDoc){ askAlert("Club en cours de chargement, réessayez dans un instant."); return; }
  var seuil=parseInt((document.getElementById("rel-seuil")||{}).value,10);
  if(!seuil||seuil<1){ askAlert("Le nombre de relances doit être au moins 1."); return; }
  var relances={seuilSuspension:seuil};
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{relances:relances})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.relances=relances;
      showToast("Seuil de relances enregistré !");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
// Utilisé par 06-licences.js : nb de relances sans paiement avant que la
// suspension soit proposée au dirigeant (jamais automatique). Défaut : 3.
function clubSeuilRelances(){
  var r=(window.CURRENT_CLUB && window.CURRENT_CLUB.relances)||{};
  return r.seuilSuspension!=null ? r.seuilSuspension : 3;
}

// ═══ PERSONNALISATION DES PARAMETRES (ordre, masquage, raccourcis) ═══
var PARAMS_EDIT_MODE=false;
var PARAMS_SECTION_NAMES={
  identite:"Identité du club",couleurs:"Couleurs du club",paiement:"Paiement des licences",cerfa:"Reçus fiscaux (CERFA)",facturation:"Facturation (sponsors/partenaires)",relances:"Relances impayés (licences)",aides:"Aides Pass'Sport / Pass'Région",themes:"Thèmes animés",avis:"Avis et suggestions",notesfrais:"Notes de frais",stats:"Statistiques du club",
  apparence:"Apparence",qr:"Partage & QR codes",notifications:"Notifications",
  communication:"Communication",donnees:"Données",demo:"Démonstration"
};
function getParamsOrder(){try{return JSON.parse(localStorage.getItem("asmb_params_order")||"[]");}catch(e){return [];}}
function saveParamsOrder(o){localStorage.setItem("asmb_params_order",JSON.stringify(o));}
function getParamsHidden(){try{return JSON.parse(localStorage.getItem("asmb_params_hidden")||"[]");}catch(e){return [];}}
function saveParamsHidden(h){localStorage.setItem("asmb_params_hidden",JSON.stringify(h));}
function getCustomShortcuts(){try{return JSON.parse(localStorage.getItem("asmb_params_shortcuts")||"[]");}catch(e){return [];}}
function saveCustomShortcuts(s){localStorage.setItem("asmb_params_shortcuts",JSON.stringify(s));}

function toggleParamsEditMode(){
  PARAMS_EDIT_MODE=!PARAMS_EDIT_MODE;
  var btn=document.getElementById("params-edit-toggle");
  if(btn){
    btn.textContent=PARAMS_EDIT_MODE?"Terminé":"Organiser";
    btn.style.background=PARAMS_EDIT_MODE?"var(--dkg)":"var(--bdr)";
    btn.style.color=PARAMS_EDIT_MODE?"#fff":"var(--mut)";
  }
  buildParametresLayout();
}

function moveParamBlock(secId,delta){
  // On ne reordonne qu'a l'interieur du meme groupe (sections partagees vs reservees dirigeant),
  // pour ne jamais faire sortir une section admin de son conteneur protege.
  var block=document.querySelector('#scr-parametres .param-block[data-sec="'+secId+'"]');
  if(!block) return;
  var siblings=Array.prototype.slice.call(block.parentNode.children).filter(function(c){return c.classList&&c.classList.contains("param-block");});
  var ids=siblings.map(function(b){return b.dataset.sec;});
  var from=ids.indexOf(secId);
  var to=from+delta;
  if(from<0||to<0||to>=ids.length) return;
  ids.splice(from,1);
  ids.splice(to,0,secId);
  // Fusionne dans l'ordre global enregistre
  var globalOrder=getParamsOrder().filter(function(id){return ids.indexOf(id)<0;});
  saveParamsOrder(globalOrder.concat(ids));
  buildParametresLayout();
}
function toggleParamHidden(secId){
  var h=getParamsHidden();
  var i=h.indexOf(secId);
  if(i>=0) h.splice(i,1); else h.push(secId);
  saveParamsHidden(h);
  buildParametresLayout();
}

function buildParametresLayout(){ buildParamsAccordeon(); }

// ═══ PARAMÈTRES EN BLOCS REPLIABLES ══════════════════════════════
// Les sections existantes (param-block) sont rangées dans 5 blocs repliables,
// tous fermés à l'ouverture. Rien n'est dupliqué : on déplace les vrais noeuds.
var PARAMS_GROUPES=[
  {id:"compte", ic:"👤", titre:"Mon compte", secs:["@compte","notifications","notesfrais","avis"]},
  {id:"apparence", ic:"🎨", titre:"Apparence", secs:["apparence","themes"]},
  {id:"club", ic:"🏀", titre:"Mon club", dir:true, secs:["identite","couleurs","liens","stats","qr"]},
  {id:"argent", ic:"💶", titre:"Argent & documents", dir:true, secs:["paiement","aides","relances","facturation","cerfa"]},
  {id:"abonnement", ic:"🧾", titre:"Abonnement", dir:true, secs:["@abonnement"]},
  {id:"donnees", ic:"💾", titre:"Données & saison", dir:true, secs:["donnees"]},
  {id:"demo", ic:"🧪", titre:"Démonstration (super admin)", sa:true, secs:["demo"]}
];
function paramsResume(id){
  var u=window.ASMB_USER||{}, c=window.CURRENT_CLUB||{};
  if(id==="compte") return (u.email||"Mon compte")+" · notifications";
  if(id==="apparence"){
    var vt=document.documentElement.getAttribute("data-visual-theme")||"moderne";
    var noms={moderne:"Moderne",classique:"Marine/doré",epure:"Épuré",bento:"Bento",feuille:"Feuille",carnet:"Carnet",editorial:"Éditorial"};
    return "Thème "+(noms[vt]||vt)+" · mode "+(document.documentElement.getAttribute("data-theme")==="dark"?"sombre":"clair");
  }
  if(id==="club") return "Logo · "+(clubCouleur()?(clubCouleur2()?"2 couleurs":"1 couleur"):"couleurs GM")+" · "+(clubLiens().length?clubLiens().length+" lien"+(clubLiens().length>1?"s":""):"réseaux")+" · QR codes";
  if(id==="argent") return "Paiement licences · relances · factures · CERFA";
  if(id==="abonnement"){
    var c2=window.CURRENT_CLUB||{}, pk=(typeof aboPackTxt==="function")?aboPackTxt(c2):{nom:""};
    var g=(typeof aboGelActif==="function")&&aboGelActif(c2);
    return "Pack "+pk.nom+(g?" · gelé":(c2.aboResiliation?" · résiliation programmée":""))+" · geler, résilier";
  }
  if(id==="donnees") return "Saison "+getCurrentSeason()+" · sauvegarde auto";
  if(id==="danger") return "Réinitialiser les données du club ou la comptabilité (irréversible)";
  if(id==="demo") return "Données fictives pour tester";
  return "";
}
function paramsNoeuds(scr,key){
  if(key==="@compte"){
    var box=document.getElementById("account-info-box");
    var cont=box&&box.parentNode; if(!cont) return [];
    var sec=cont.previousElementSibling;
    return (sec&&sec.classList.contains("sec"))?[sec,cont]:[cont];
  }
  if(key==="@abonnement") return (typeof aboBlocParam==="function")?[aboBlocParam()]:[];
  if(key==="@danger"){
    var out=[], secs=scr.querySelectorAll(".sec");
    for(var i=0;i<secs.length;i++){
      if(secs[i].textContent.trim()==="Réinitialisation"){
        out.push(secs[i]);
        var n=secs[i].nextElementSibling;
        while(n && !n.classList.contains("sec") && !n.classList.contains("param-block") && !n.classList.contains("pgrp")){ out.push(n); n=n.nextElementSibling; }
        break;
      }
    }
    return out;
  }
  var b=scr.querySelector('.param-block[data-sec="'+key+'"]');
  return b?[b]:[];
}
function buildParamsAccordeon(){
  var scr=document.getElementById("scr-parametres"); if(!scr) return;
  var profil=localStorage.getItem("asmb_profile");
  var isDir=(profil==="dirigeant"), isStaff=(profil==="dirigeant"||profil==="coach");
  var isSA=(typeof isSuperAdmin==="function"&&isSuperAdmin()&&!window.SUPPORT_MODE);
  var zone=document.getElementById("params-groupes");
  if(!zone){
    zone=document.createElement("div");
    zone.id="params-groupes";
    zone.style.cssText="padding:12px 12px 4px";
    var hdr=scr.firstElementChild;
    scr.insertBefore(zone,hdr.nextSibling);
    PARAMS_GROUPES.forEach(function(g){
      var grp=document.createElement("div");
      grp.className="pgrp"; grp.setAttribute("data-grp",g.id);
      grp.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);margin-bottom:10px;overflow:hidden;box-shadow:0 1px 4px var(--shadow)";
      var btn=document.createElement("button");
      btn.type="button";
      btn.setAttribute("aria-expanded","false");
      btn.style.cssText="width:100%;display:flex;align-items:center;gap:12px;border:0;background:none;padding:14px;min-height:60px;cursor:pointer;text-align:left;color:var(--txt);font:inherit";
      btn.innerHTML='<span class="pgrp-ic" style="width:36px;height:36px;border-radius:10px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:18px;flex:none">'+g.ic+'</span>'+
        '<span style="flex:1;min-width:0"><span class="pgrp-tit" style="display:block;font-size:15px;font-weight:800">'+g.titre+'</span><span class="pgrp-res" style="display:block;font-size:12px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></span></span>'+
        '<span class="pgrp-chev" style="color:var(--mut);font-size:16px;transition:transform .2s">›</span>';
      var cont=document.createElement("div");
      cont.className="pgrp-cont";
      cont.style.cssText="display:none;border-top:1px solid var(--bdr);padding:8px 0 4px";
      btn.addEventListener("click",function(){
        var open=cont.style.display==="none";
        cont.style.display=open?"block":"none";
        grp.classList.toggle("ouvert",open);   // ordinateur : le bloc ouvert prend les 2 colonnes
        btn.setAttribute("aria-expanded",open?"true":"false");
        btn.querySelector(".pgrp-chev").style.transform=open?"rotate(90deg)":"";
      });
      grp.appendChild(btn); grp.appendChild(cont);
      zone.appendChild(grp);
      g.secs.forEach(function(k){ paramsNoeuds(scr,k).forEach(function(n){ cont.appendChild(n); }); });
    });
    // Liens légaux en bas de l'écran
    var legal=scr.querySelector('a[href="legal/cgu.html"]');
    if(legal&&legal.parentNode) scr.appendChild(legal.parentNode);
    // Ce qui n'a plus d'usage dans cet écran
    var cl=document.getElementById("params-custom-list"); if(cl) cl.style.display="none";
    paramsPaletteRepliable();
  }
  // Le conteneur "dirigeant seul" ne sert plus : la visibilité se fait par bloc.
  var adminOnly=document.getElementById("params-dirigeant-only"); if(adminOnly) adminOnly.style.display="block";
  PARAMS_GROUPES.forEach(function(g){
    var grp=zone.querySelector('[data-grp="'+g.id+'"]'); if(!grp) return;
    var vis=g.sa?isSA:(g.dir?isDir:true);
    grp.style.display=vis?"":"none";
    var r=grp.querySelector(".pgrp-res"); if(r) r.textContent=paramsResume(g.id);
  });
  if(typeof aboPeindre==="function") aboPeindre();
  var nf=scr.querySelector('.param-block[data-sec="notesfrais"]'); if(nf) nf.style.display=isStaff?"":"none";
}
// Palette des couleurs repliée derrière une ligne qui montre les couleurs choisies.
function paramsPaletteRepliable(){
  var pal=document.getElementById("club-palette");
  if(!pal||document.getElementById("club-palette-btn")) return;
  var btn=document.createElement("button");
  btn.type="button"; btn.id="club-palette-btn";
  btn.style.cssText="width:100%;display:flex;align-items:center;gap:10px;border:1.5px solid var(--bdr);border-radius:var(--rx);padding:10px 12px;min-height:46px;background:var(--bg);color:var(--txt);font:inherit;font-size:13px;font-weight:700;cursor:pointer;text-align:left;margin-bottom:8px";
  btn.innerHTML='<span id="club-palette-sw" style="display:flex;gap:4px"></span><span id="club-palette-lbl" style="flex:1">Choisir les couleurs</span><span style="color:var(--mut)">▾</span>';
  pal.parentNode.insertBefore(btn,pal);
  pal.style.display="none";
  btn.addEventListener("click",function(){ pal.style.display=(pal.style.display==="none")?"grid":"none"; });
  majBoutonPalette();
}
function majBoutonPalette(){
  var sw=document.getElementById("club-palette-sw"), lbl=document.getElementById("club-palette-lbl");
  if(!sw||!lbl) return;
  var c=[clubCouleur(),clubCouleur2()].filter(Boolean);
  sw.innerHTML=c.map(function(x){ return '<i style="width:20px;height:20px;border-radius:6px;display:block;background:'+x+'"></i>'; }).join("");
  lbl.textContent=c.length?(c.length===2?"2 couleurs choisies":"1 couleur choisie"):"Couleurs General Manager (par défaut)";
}

function renderParamsAddTile(){
  var old=document.getElementById("params-add-tile");
  if(old) old.remove();
  if(!PARAMS_EDIT_MODE) return;
  var tile=document.createElement("div");
  tile.id="params-add-tile";
  tile.style.cssText="margin:4px 12px 20px";
  tile.innerHTML='<button onclick="openAddShortcutModal()" style="width:100%;padding:13px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--dkg);font-size:13px;font-weight:700;cursor:pointer">+ Ajouter un raccourci</button>';
  var container=document.getElementById("params-custom-list");
  if(container && container.parentNode) container.parentNode.insertBefore(tile, container.nextSibling);
}

// ── Raccourcis personnalises : vers une destination existante de l'app ──
var SHORTCUT_TARGETS=[
  {id:"comptabilite",label:"Comptabilité",icon:"💶"},
  {id:"fiches",label:"Fiches reçues",icon:"📥"},
  {id:"acces",label:"Accès coach",icon:"🔑"},
  {id:"avis",label:"Avis & suggestions",icon:"💡"},
  {id:"licences",label:"Licences",icon:"📋"},
  {id:"inscriptions",label:"Inscriptions",icon:"📝"},
  {id:"equipes",label:"Équipes",icon:"👥"},
  {id:"planning",label:"Planning",icon:"📅"},
  {id:"documents",label:"Documents",icon:"📁"}
];
function renderCustomShortcuts(){
  var container=document.getElementById("params-custom-list");
  if(!container) return;
  container.innerHTML="";
  getCustomShortcuts().forEach(function(sc){
    var target=SHORTCUT_TARGETS.find(function(t){return t.id===sc.target;});
    var block=document.createElement("div");
    block.className="param-block";
    block.dataset.sec="custom-"+sc.id;
    block.innerHTML='<div class="sec">'+authEsc(sc.label)+'</div>';
    var card=document.createElement("div");
    card.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow);cursor:pointer;display:flex;align-items:center;gap:12px";
    card.innerHTML='<span style="font-size:22px;flex-shrink:0">'+(target?target.icon:"⭐")+'</span>'+
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(sc.label)+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">Ouvre : '+(target?authEsc(target.label):"destination inconnue")+'</div></div>'+
      '<div style="color:var(--mut);font-size:18px">\u203a</div>';
    card.addEventListener("click",function(){
      if(PARAMS_EDIT_MODE) return;
      if(target) openAdminModule(target.id);
    });
    block.appendChild(card);
    container.appendChild(block);
  });
}
function openAddShortcutModal(){
  var modal=document.createElement("div");
  modal.className="shortcut-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:80vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px";
  hdr.innerHTML='<div style="font-size:15px;font-weight:800;color:var(--txt)">Nouveau raccourci</div>';
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(){modal.remove();});
  hdr.appendChild(closeBtn);
  var hint=document.createElement("div");
  hint.style.cssText="font-size:11px;color:var(--mut);margin-bottom:14px;line-height:1.4";
  hint.textContent="Choisir la page que ce raccourci doit ouvrir.";
  inner.appendChild(hdr);inner.appendChild(hint);
  SHORTCUT_TARGETS.forEach(function(t){
    var row=document.createElement("button");
    row.style.cssText="width:100%;display:flex;align-items:center;gap:12px;padding:13px;margin-bottom:8px;border-radius:var(--rs);border:1.5px solid var(--bdr);background:var(--card);cursor:pointer;text-align:left";
    row.innerHTML='<span style="font-size:20px">'+t.icon+'</span><span style="font-size:13px;font-weight:700;color:var(--txt)">'+t.label+'</span>';
    row.addEventListener("click",function(){ modal.remove(); finishAddShortcut(t); });
    inner.appendChild(row);
  });
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
}
async function finishAddShortcut(target){
  var label=await askPrompt("Nom du raccourci",{defaultValue:target.label,confirmText:"Ajouter"});
  if(label===null) return;
  var list=getCustomShortcuts();
  list.push({id:Date.now().toString(),label:(label.trim()||target.label),target:target.id});
  saveCustomShortcuts(list);
  buildParametresLayout();
}

function wireThemeAnimSettings(prefix){
  prefix=prefix||"";
  var settings=taGetSettings();
  var enabledInp=document.getElementById(prefix+"ta-enabled");
  var styleMeteo=document.getElementById(prefix+"ta-style-meteo");
  var styleSaison=document.getElementById(prefix+"ta-style-saison");
  var cityInp=document.getElementById(prefix+"ta-city");
  var cityWrap=document.getElementById(prefix+"ta-city-wrap");
  if(!enabledInp) return;
  enabledInp.checked=settings.enabled;
  if(settings.style==="saison"){ styleSaison.checked=true; } else { styleMeteo.checked=true; }
  cityInp.value=settings.city;
  cityWrap.style.display=(settings.style==="saison")?"none":"block";
  var durInp=document.getElementById(prefix+"ta-dur-"+settings.duration);
  if(durInp) durInp.checked=true;

  // Rejoue l'animation immediatement en fond pour donner un retour visuel live du reglage
  function livePreview(){
    localStorage.removeItem("asmb_theme_anim_shown_date");
    ["home-hero-portal","home-hero-parent","home-hero-coach"].forEach(function(id){
      var h=document.getElementById(id);
      if(h){ h.querySelectorAll(".ta-flake,.ta-sun,.ta-cloud,.ta-drop,.ta-leaf,.ta-petal,.ta-moon,.ta-star").forEach(function(n){n.remove();}); delete h.dataset.taSpawned; }
    });
    maybeShowDailyThemeAnimation();
  }

  if(!enabledInp.dataset.wired){
    enabledInp.dataset.wired="1";
    enabledInp.addEventListener("change",function(){ taSaveSetting("enabled", enabledInp.checked?"on":"off"); livePreview(); });
    [styleMeteo,styleSaison].forEach(function(r){
      r.addEventListener("change",function(){
        taSaveSetting("style", r.value);
        cityWrap.style.display=(r.value==="saison")?"none":"block";
        livePreview();
      });
    });
    cityInp.addEventListener("change",function(){
      taSaveSetting("city", cityInp.value.trim());
      localStorage.removeItem("asmb_theme_weather_cache"); // invalide le cache si la ville change
      livePreview();
    });
    ["5","10","15","continu"].forEach(function(v){
      var r=document.getElementById(prefix+"ta-dur-"+v);
      if(r) r.addEventListener("change",function(){ taSaveSetting("duration", v); livePreview(); });
    });
  }
}

function sendFeedback(prefix){
  prefix=prefix||"";
  var ta=document.getElementById(prefix+"feedback-text");
  var msg=(ta&&ta.value||"").trim();
  if(!msg){ askAlert("Écrire un message avant d'envoyer."); return; }
  if(!window.fbDb || !window.fbAddDoc){ askAlert("Connexion en cours, réessayer dans quelques secondes."); return; }
  var btn=document.getElementById(prefix+"feedback-send-btn");
  if(btn){ btn.disabled=true; btn.textContent="Envoi..."; }
  var u=window.ASMB_USER||{};
  // Paramètres du dirigeant : l'avis part à l'équipe General Manager (Plateforme).
  var versPlateforme=true; // dirigeant, coach ou parent : tous les avis vont à la plateforme
  var envoi=versPlateforme
    ? window.fbAddDoc(window.fbCollection(window.fbDb,"avis_plateforme"),{
        clubId:window.CURRENT_CLUB_ID||"", clubName:(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"",
        uid:u.uid||"", email:u.email||"", message:msg.slice(0,2000), statut:"nouveau", ts:window.fbServerTimestamp()
      })
    : window.fbAddDoc(window.fbCollection(window.fbDb,"feedback"),{
        uid:u.uid||"", email:u.email||"", phone:u.phone||"",
        roles:u.roles||[], message:msg, status:"nouveau",
        ts:window.fbServerTimestamp()
      });
  envoi.then(function(){
    if(ta) ta.value="";
    var st=document.getElementById(prefix+"feedback-status");
    if(st){ st.style.display="block"; setTimeout(function(){st.style.display="none";},3000); }
  }).catch(function(e){
    askAlert("Erreur d'envoi : "+((e&&e.code)||e));
  }).finally(function(){
    if(btn){ btn.disabled=false; btn.textContent="Envoyer"; }
  });
}


// Ouvre Paramètres sur un bloc précis (ex. « Boutique & réseaux » du menu ordinateur).
// secId : section à faire défiler dans le bloc une fois ouvert.
function paramsOuvrirGroupe(id,secId){
  if(typeof stack!=="undefined"){ stack=["portal"]; }
  openParametres();
  setTimeout(function(){
    var grp=document.querySelector('#params-groupes [data-grp="'+id+'"]'); if(!grp) return;
    var btn=grp.querySelector("button");
    if(btn && btn.getAttribute("aria-expanded")!=="true") btn.click();
    var cible=secId?grp.querySelector('.param-block[data-sec="'+secId+'"]'):grp;
    if(cible&&cible.scrollIntoView) try{ cible.scrollIntoView({block:"start",behavior:"smooth"}); }catch(e){}
  },60);
}
