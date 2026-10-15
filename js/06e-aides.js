// ═══ AIDES PASS'SPORT / PASS'RÉGION (licences) ══════════════════════
// Le club active les aides dans Paramètres (clubs/{id}.aides = {passSport, passRegion}).
// Ce réglage est recopié dans inscription_codes/{code}.aides (le visiteur public ne
// peut pas lire la fiche club) pour que la fiche d'inscription affiche les bons champs.
// Une aide = une part du paiement : lic.aides = [{type, ref, montant, statut, ...}].
// Statut : a_saisir → saisi (sur Le Compte Asso / Partenaires Pass'Région) → rembourse.
// Jamais bloquant : la validation d'une licence ne dépend pas des aides.
var AIDES_TYPES={
  passsport:{nom:"Pass'Sport",montant:50,categorie:"Aide Pass'Sport",court:"PS"},
  passregion:{nom:"Pass'Région",montant:30,categorie:"Aide Pass'Région",court:"PR"}
};
var AIDES_LIMITE="2026-12-31";          // date limite de saisie Pass'Sport 2026-27
var AIDES_LIEN_PS="https://lecompteasso.associations.gouv.fr";
var FICHE_AIDES=null;                   // aides proposées sur la fiche publique en cours

// ── Réglage club ────────────────────────────────────────────────────
function aidesClub(){
  var a=(window.CURRENT_CLUB&&window.CURRENT_CLUB.aides)||{};
  return {passSport:!!a.passSport,passRegion:!!a.passRegion};
}
// Version publique (index inscription_codes) : null si aucune aide activée.
function aidesPourCodes(){
  var a=aidesClub();
  return (a.passSport||a.passRegion)?{ps:a.passSport,pr:a.passRegion}:null;
}
function aidesRemplirParams(){
  var a=aidesClub();
  var ps=document.getElementById("aide-ps"), pr=document.getElementById("aide-pr");
  if(ps)ps.checked=a.passSport; if(pr)pr.checked=a.passRegion;
}
function aidesEnregistrerParams(){
  var ps=document.getElementById("aide-ps"), pr=document.getElementById("aide-pr");
  var aides={passSport:!!(ps&&ps.checked),passRegion:!!(pr&&pr.checked)};
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{aides:aides})
    .then(function(){
      if(window.CURRENT_CLUB) window.CURRENT_CLUB.aides=aides;
      if(typeof syncInscriptionCodes==="function"){
        // force la réécriture des index publics avec le nouveau réglage
        INSCRIPTION_CODES_PREV={};
        syncInscriptionCodes(getLicences());
      }
      showToast("Aides enregistrées !");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}

// ── Formats et règles ───────────────────────────────────────────────
function aidesNormPS(v){ return String(v||"").trim().toUpperCase().replace(/\s+/g,""); }
function aidesCodePSValide(v){ return /^26-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(aidesNormPS(v)); }
function aidesNormPR(v){ return String(v||"").trim().replace(/\s+/g,""); }
function aidesCartePRValide(v){ return /^[A-Za-z0-9]{6,20}$/.test(aidesNormPR(v)); }
function aidesAge(naissance, ref){
  var d=new Date(naissance); if(!naissance||isNaN(d)) return null;
  var n=ref||new Date(), a=n.getFullYear()-d.getFullYear();
  if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate())) a--;
  return a;
}
// Pass'Sport : 6 à 30 ans (âge inconnu = on laisse le champ visible).
function aidesPSPossible(naissance){ var a=aidesAge(naissance); return a==null||(a>=6&&a<=30); }
// Pass'Région : lycéens / apprentis, donc ~14 à 25 ans (âge inconnu = masqué).
function aidesPRPossible(naissance){ var a=aidesAge(naissance); return a!=null&&a>=14&&a<=25; }
// Code déjà utilisé par une autre licence du club ?
function aidesDoublon(type, ref, exceptCode){
  var r=type==="passsport"?aidesNormPS(ref):aidesNormPR(ref);
  if(!r) return null;
  var found=null;
  getLicences().forEach(function(l){
    if(l.code===exceptCode) return;
    (l.aides||[]).forEach(function(a){ if(a.type===type && String(a.ref).toUpperCase()===r.toUpperCase()) found=l; });
  });
  return found;
}

// ── Fiche d'inscription (public) ────────────────────────────────────
function aidesFicheHtml(f){
  var a=FICHE_AIDES; f=f||{};
  if(!a||(!a.ps&&!a.pr)) return "";
  setTimeout(function(){ aidesMaj(); },0);
  var h='<div id="f-aides" style="margin:4px 0 16px">';
  if(a.ps){
    h+='<div class="form-group" id="f-ps-wrap"><label class="form-label" for="f-passSport">Code Pass\'Sport (facultatif)</label>'+
      '<input class="form-input" id="f-passSport" value="'+authEsc(f.passSport||"")+'" placeholder="26-XXXX-XXXX" autocapitalize="characters" maxlength="14">'+
      '<div style="font-size:11px;color:var(--mut);margin-top:4px;line-height:1.4">Si vous avez reçu un code Pass\'Sport (50 €), indiquez-le : il sera déduit de votre licence. Un code ne sert qu\'une fois.</div></div>';
  }
  if(a.pr){
    h+='<div class="form-group" id="f-pr-wrap" style="display:none">'+
      '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer"><input type="checkbox" id="f-prOui" onchange="aidesMaj()" '+(f.passRegionOui?"checked":"")+' style="width:20px;height:20px;margin-top:1px;flex-shrink:0">'+
      '<span style="font-size:13px;color:var(--txt)">Le/la licencié·e est lycéen·ne, apprenti·e ou en formation en Auvergne-Rhône-Alpes (Pass\'Région)</span></label>'+
      '<div id="f-pr-num" style="display:none;margin-top:8px"><label class="form-label" for="f-passRegionNumero">N° de carte Pass\'Région</label>'+
      '<input class="form-input" id="f-passRegionNumero" value="'+authEsc(f.passRegionNumero||"")+'" placeholder="Numéro de la carte" maxlength="20">'+
      '<div style="font-size:11px;color:var(--mut);margin-top:4px">Uniquement le numéro, jamais le code secret de la carte.</div></div></div>';
  }
  return h+'</div>';
}
// Affiche/masque les champs selon l'âge saisi et la case Pass'Région.
function aidesMaj(){
  var n=(document.getElementById("f-naissance")||{}).value||"";
  var ps=document.getElementById("f-ps-wrap"); if(ps) ps.style.display=aidesPSPossible(n)?"block":"none";
  var pr=document.getElementById("f-pr-wrap"); if(pr) pr.style.display=aidesPRPossible(n)?"block":"none";
  var oui=document.getElementById("f-prOui"), num=document.getElementById("f-pr-num");
  if(num) num.style.display=(oui&&oui.checked&&aidesPRPossible(n))?"block":"none";
}
// Lit les champs aides de la fiche (null = erreur déjà affichée).
function aidesLireFiche(){
  var n=(document.getElementById("f-naissance")||{}).value||"";
  var out={passSport:"",passRegionOui:false,passRegionNumero:""};
  var psEl=document.getElementById("f-passSport"), ps=document.getElementById("f-ps-wrap");
  if(psEl&&ps&&ps.style.display!=="none"&&psEl.value.trim()){
    if(!aidesCodePSValide(psEl.value)){ askAlert("Le code Pass'Sport doit ressembler à 26-XXXX-XXXX. Vérifiez-le ou laissez le champ vide."); return null; }
    out.passSport=aidesNormPS(psEl.value);
  }
  var oui=document.getElementById("f-prOui");
  if(oui&&oui.checked&&aidesPRPossible(n)){
    var num=(document.getElementById("f-passRegionNumero")||{}).value||"";
    if(num.trim()&&!aidesCartePRValide(num)){ askAlert("Le n° de carte Pass'Région n'est pas valide (lettres et chiffres, 6 à 20 caractères)."); return null; }
    out.passRegionOui=true; out.passRegionNumero=aidesNormPR(num);
  }
  return out;
}

// ── Montants ────────────────────────────────────────────────────────
function aidesTotalLicence(lic){
  return (lic.aides||[]).reduce(function(s,a){return s+(Number(a.montant)||0);},0);
}

// ── Bloc dans la fiche licence (staff) ──────────────────────────────
function aidesBlockHtml(lic){
  var a=aidesClub(), f=lic.fiche||{}, liste=lic.aides||[];
  var aPS=liste.some(function(x){return x.type==="passsport";}), aPR=liste.some(function(x){return x.type==="passregion";});
  var showPS=a.passSport||f.passSport||aPS, showPR=a.passRegion||f.passRegionOui||aPR;
  if(!showPS&&!showPR) return "";
  var h='<div style="margin-top:12px;border:1px solid var(--bdr);border-radius:var(--rs);padding:12px;background:var(--card)">'+
    '<div style="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:8px">Aides Pass\'Sport / Pass\'Région</div>';
  var noms={a_saisir:"À saisir",saisi:"Saisi",rembourse:"Remboursé"};
  liste.forEach(function(x,i){
    var t=AIDES_TYPES[x.type]||{nom:x.type};
    h+='<div style="font-size:12px;color:var(--txt2);margin-bottom:8px;padding-bottom:8px;border-bottom:1px solid var(--bdr)">'+
      '<b>'+authEsc(t.nom)+'</b> · '+(Number(x.montant)||0).toFixed(2)+' € · n° '+authEsc(x.ref)+' · <b>'+authEsc(noms[x.statut]||x.statut)+'</b>'+
      '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'+
      (x.statut==="a_saisir"?'<button onclick="aidesStatut(\''+lic.code+'\','+i+',\'saisi\')" style="padding:6px 10px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Marquer saisi</button>':'')+
      (x.statut==="saisi"?'<button onclick="aidesStatut(\''+lic.code+'\','+i+',\'rembourse\')" style="padding:6px 10px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Marquer remboursé</button>':'')+
      '<button onclick="aidesRetirer(\''+lic.code+'\','+i+')" style="padding:6px 10px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:11px;font-weight:600;border:none;cursor:pointer">Retirer</button>'+
      '</div></div>';
  });
  if(showPS&&!aPS){
    h+='<div style="display:flex;gap:6px;margin-bottom:8px"><input class="form-input" id="aide-add-passsport" value="'+authEsc(f.passSport||"")+'" placeholder="Code Pass\'Sport 26-XXXX-XXXX" style="flex:1">'+
      '<button onclick="aidesAjouter(\''+lic.code+'\',\'passsport\')" style="padding:8px 12px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Compter 50 €</button></div>';
  }
  if(showPR&&!aPR){
    h+='<div style="display:flex;gap:6px"><input class="form-input" id="aide-add-passregion" value="'+authEsc(f.passRegionNumero||"")+'" placeholder="N° de carte Pass\'Région" style="flex:1">'+
      '<button onclick="aidesAjouter(\''+lic.code+'\',\'passregion\')" style="padding:8px 12px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Compter 30 €</button></div>';
  }
  if(liste.length) h+='<div style="font-size:11px;color:var(--mut);margin-top:8px">Les aides comptent dans le paiement : la famille règle la différence.</div>';
  return h+'</div>';
}
function aidesLicence(code){
  var lics=getLicences(), i=lics.findIndex(function(l){return l.code===code;});
  return {lics:lics,i:i,lic:i>=0?lics[i]:null};
}
function aidesLigneCompta(lic, aide){
  var t=AIDES_TYPES[aide.type], f=lic.fiche||{};
  var nom=((f.prenom||"")+" "+(f.nom||"")).trim();
  var l={
    id:aide.comptaId, date:new Date().toISOString().slice(0,10), montant:aide.montant, type:"recette",
    categorie:t.categorie, motif:t.categorie+" n° "+aide.ref+" — "+nom,
    tiers:t.nom, moyen:"Aide", reference:"Aide "+t.court+" "+aide.ref
  };
  if(typeof hasPremium==="function"&&!hasPremium()) l.horsPremium=true;
  return l;
}
function aidesAjouter(code, type){
  var ctx=aidesLicence(code); if(!ctx.lic) return;
  var el=document.getElementById("aide-add-"+type);
  var ref=el?el.value:"";
  if(type==="passsport"){
    if(!aidesCodePSValide(ref)){ askAlert("Code Pass'Sport invalide : format 26-XXXX-XXXX."); return; }
    ref=aidesNormPS(ref);
  } else {
    if(!aidesCartePRValide(ref)){ askAlert("N° de carte Pass'Région invalide (6 à 20 lettres ou chiffres)."); return; }
    ref=aidesNormPR(ref);
  }
  var dbl=aidesDoublon(type, ref, code);
  if(dbl){ var fd=dbl.fiche||{}; askAlert("Ce numéro est déjà utilisé sur la licence de "+((fd.prenom||"")+" "+(fd.nom||"")).trim()+". Un code ne sert qu'une fois."); return; }
  var lic=ctx.lic;
  lic.aides=lic.aides||[];
  var aide={type:type, ref:ref, montant:AIDES_TYPES[type].montant, statut:"a_saisir", ajouteLe:new Date().toISOString().slice(0,10), comptaId:"aide"+Date.now()};
  lic.aides.push(aide);
  var compta=getComptabilite(); compta.push(aidesLigneCompta(lic, aide));
  saveLicences(ctx.lics); saveComptabilite(compta);
  renderLicenceDetail(lic); buildLicences();
}
function aidesStatut(code, i, statut){
  var ctx=aidesLicence(code); if(!ctx.lic||!ctx.lic.aides||!ctx.lic.aides[i]) return;
  var a=ctx.lic.aides[i]; a.statut=statut;
  var j=new Date().toISOString().slice(0,10);
  if(statut==="saisi") a.saisiLe=j; if(statut==="rembourse") a.rembourseLe=j;
  saveLicences(ctx.lics);
  renderLicenceDetail(ctx.lic); buildLicences();
}
async function aidesRetirer(code, i){
  var ctx=aidesLicence(code); if(!ctx.lic||!ctx.lic.aides||!ctx.lic.aides[i]) return;
  var ok=await askConfirm("Retirer cette aide ? La ligne de comptabilité liée sera supprimée.");
  if(!ok) return;
  var a=ctx.lic.aides.splice(i,1)[0];
  var compta=getComptabilite().filter(function(c){return c.id!==a.comptaId;});
  saveLicences(ctx.lics); saveComptabilite(compta);
  renderLicenceDetail(ctx.lic); buildLicences();
}

// ── Suivi : codes à saisir + alertes 10 j / 5 j ─────────────────────
function aidesJoursRestants(now){
  var n=now||new Date(), fin=new Date(AIDES_LIMITE+"T00:00:00");
  var auj=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  return Math.round((fin-auj)/86400000);   // jours calendaires : le 21/12 = 10, le 26/12 = 5
}
function aidesAFaire(type){
  var season=getCurrentSeason(), out=[];
  getLicences().forEach(function(l){
    if(l.saison&&l.saison!==season) return;
    (l.aides||[]).forEach(function(a,i){ if(a.type===type&&a.statut==="a_saisir") out.push({lic:l,aide:a,i:i}); });
  });
  return out;
}
// 0 = pas d'alerte, 10 = à 10 jours ou moins, 5 = à 5 jours ou moins, -1 = délai dépassé
function aidesNiveauAlerte(now){
  if(!aidesAFaire("passsport").length) return 0;
  var j=aidesJoursRestants(now);
  if(j<0) return -1;
  if(j<=5) return 5;
  if(j<=10) return 10;
  return 0;
}
function aidesAdminHtml(){
  var ps=aidesAFaire("passsport"), pr=aidesAFaire("passregion");
  if(!ps.length&&!pr.length) return "";
  var niv=aidesNiveauAlerte(), j=aidesJoursRestants();
  var rouge=(niv===5||niv===-1);
  var msg=ps.length+" code"+(ps.length>1?"s":"")+" Pass'Sport à saisir";
  if(ps.length) msg+=niv===-1?" · date limite dépassée (31/12)":" · avant le 31/12 ("+j+" j)";
  if(pr.length) msg+=(ps.length?" · ":"")+pr.length+" Pass'Région à saisir";
  return '<div style="margin:0 12px 10px;padding:12px;border-radius:var(--rs);border:1px solid '+(rouge?"var(--red)":niv?"#E8670A":"var(--bdr)")+';background:'+(rouge?"rgba(192,57,43,.08)":niv?"rgba(232,103,10,.08)":"var(--card)")+'">'+
    '<div style="font-size:12px;font-weight:800;color:var(--txt)">'+(niv?"⚠️ ":"💳 ")+authEsc(msg)+'</div>'+
    '<button onclick="aidesOuvrirListe()" style="margin-top:8px;padding:8px 12px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Voir les codes à saisir</button></div>';
}
function renderAidesAdmin(){
  var box=document.getElementById("lic-aides-box"); if(!box) return;
  var isDir=((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0;
  box.innerHTML=isDir?aidesAdminHtml():"";
  if(isDir&&aidesNiveauAlerte()){
    try{
      var cle="gm_aides_alerte_"+new Date().toISOString().slice(0,10);
      if(!localStorage.getItem(cle)){ localStorage.setItem(cle,"1"); showToast("Codes Pass'Sport à saisir avant le 31/12 !"); }
    }catch(e){}
  }
}
function aidesCopier(txt){
  if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){showToast("Copié !");}).catch(function(){askAlert(txt);});
  else askAlert(txt);
}
function aidesOuvrirListe(){
  var ps=aidesAFaire("passsport"), pr=aidesAFaire("passregion");
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  function nom(l){ var f=l.fiche||{}; return ((f.prenom||"")+" "+(f.nom||"")).trim(); }
  function ligne(x,type){
    var f=x.lic.fiche||{};
    return '<div style="padding:8px 0;border-bottom:1px solid var(--bdr);font-size:12px;color:var(--txt2)">'+
      '<b>'+authEsc(nom(x.lic))+'</b>'+(f.naissance?' · né(e) le '+authEsc(f.naissance):'')+'<br><span style="font-family:monospace;font-size:13px;color:var(--txt)">'+authEsc(x.aide.ref)+'</span>'+
      '<div style="display:flex;gap:6px;margin-top:6px"><button class="aide-cp" data-ref="'+authEsc(x.aide.ref)+'" style="padding:6px 10px;border-radius:20px;background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">Copier le code</button>'+
      '<button onclick="aidesStatut(\''+x.lic.code+'\','+x.i+',\'saisi\');aidesFermerListe()" style="padding:6px 10px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer">Saisi ✓</button></div></div>';
  }
  var h='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:800;color:var(--txt)">Codes à saisir</div>'+
    '<button id="aide-close" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button></div>';
  if(ps.length){
    h+='<div style="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:4px">Pass\'Sport ('+ps.length+')</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-bottom:6px;line-height:1.4">À saisir sur Le Compte Asso avant le 31/12 : Gérer les inscriptions pass Sport › Suivi. Vérifiez l\'identité du jeune.</div>'+
      '<div style="display:flex;gap:6px;margin-bottom:6px"><a href="'+AIDES_LIEN_PS+'" target="_blank" rel="noopener" style="flex:1;text-align:center;padding:9px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:11px;font-weight:700;text-decoration:none">Ouvrir Le Compte Asso</a>'+
      '<button id="aide-all" style="flex:1;padding:9px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">Copier toute la liste</button></div>'+
      ps.map(function(x){return ligne(x,"passsport");}).join("");
  }
  if(pr.length){
    h+='<div style="font-size:12px;font-weight:800;color:var(--txt);margin:14px 0 4px">Pass\'Région ('+pr.length+')</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-bottom:6px;line-height:1.4">À saisir dans « Partenaires Pass\'Région » (n° de carte + date de naissance).</div>'+
      pr.map(function(x){return ligne(x,"passregion");}).join("");
  }
  inner.innerHTML=h; modal.appendChild(inner); modal.id="aide-modal";
  modal.addEventListener("click",aidesFermerListe);
  document.body.appendChild(modal);
  document.getElementById("aide-close").addEventListener("click",aidesFermerListe);
  Array.prototype.forEach.call(inner.querySelectorAll(".aide-cp"),function(b){ b.addEventListener("click",function(){aidesCopier(b.dataset.ref);}); });
  var all=document.getElementById("aide-all");
  if(all) all.addEventListener("click",function(){
    aidesCopier(ps.map(function(x){return nom(x.lic)+";"+x.aide.ref;}).join("\n"));
  });
}
function aidesFermerListe(){ var m=document.getElementById("aide-modal"); if(m) m.remove(); }
