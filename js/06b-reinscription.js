/* ===== 06b-reinscription.js — Réinscription en ligne des familles déjà inscrites ===== */
// Le dirigeant ouvre les réinscriptions pour une saison (app_data/reinscriptions).
// Le parent voit alors sur son Accueil une carte « Réinscrire X », avec la fiche
// de l'an dernier pré-remplie (publiée dans son rattachement, voir
// publierRattachements dans 06-licences.js). Sa demande va dans
// clubs/{id}/reinscriptions ; un appareil du staff la transforme en licence
// « Reçue » de la nouvelle saison, comme une fiche d'inscription classique.
// Pas de code : le code d'inscription reste pour les nouvelles familles.

var REINSC_CFG=null, REINSC_CFG_TS=0;
function chargerConfigReinscription(){
  if(!window.fbGetDoc||!window.fbDb) return Promise.resolve(null);
  return window.fbGetDoc(window.fbDoc(window.fbDb,"app_data","reinscriptions")).then(function(s){
    REINSC_CFG=(s&&s.exists())?s.data():{ouvert:false};
    REINSC_CFG_TS=Date.now();
    return REINSC_CFG;
  }).catch(function(){ return null; });
}
function configReinscriptionFraiche(){ return REINSC_CFG && Date.now()-REINSC_CFG_TS<5*60000; }

// Saison visée : celle qui commence dans les 2-3 mois (réinscriptions de
// mai-juin pour la rentrée), jamais une saison déjà passée.
function saisonReinscriptionCible(){
  var cur=getCurrentSeason();
  var nat=computeNaturalSeason(new Date(Date.now()+75*86400000));
  return nat>cur?nat:cur;
}

// ── Côté club : ouverture / fermeture + import automatique ──────────
function renderReinscriptionAdmin(){
  var box=document.getElementById("lic-reinsc-box"); if(!box) return;
  if(typeof isStaffUser!=="function"||!isStaffUser()){ box.innerHTML=""; return; }
  if(!configReinscriptionFraiche()){
    chargerConfigReinscription().then(function(c){ if(c) renderReinscriptionAdmin(); });
    if(!REINSC_CFG) return;
  }
  importerReinscriptions();
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.indexOf("dirigeant")<0){ box.innerHTML=""; return; }
  var ouvert=REINSC_CFG.ouvert===true;
  var saison=ouvert?REINSC_CFG.saison:saisonReinscriptionCible();
  box.innerHTML=
    '<div style="margin:0 12px 10px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;box-shadow:0 2px 8px var(--shadow)">'+
      '<div style="display:flex;align-items:center;gap:8px;justify-content:space-between">'+
        '<div style="font-size:13px;font-weight:800;color:var(--txt)">Réinscriptions en ligne</div>'+
        (ouvert?'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:var(--ltg)">Ouvertes · '+authEsc(saison)+'</span>'
               :'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:var(--mut);background:var(--bdr)">Fermées</span>')+
      '</div>'+
      '<div style="font-size:11px;color:var(--mut);line-height:1.45;margin-top:6px">'+
        (ouvert?"Les familles déjà inscrites réinscrivent leur enfant depuis leur Accueil, sans code. Chaque demande arrive ici comme une fiche reçue."
               :"Les familles déjà dans l'appli réinscrivent leur enfant en 1 minute, fiche pré-remplie, sans code.")+
      '</div>'+
      '<button onclick="'+(ouvert?"fermerReinscriptions()":"ouvrirReinscriptions()")+'" style="width:100%;padding:10px;border-radius:var(--rx);border:none;cursor:pointer;font-size:12px;font-weight:700;margin-top:10px;'+
        (ouvert?'background:var(--bdr);color:var(--mut)">Fermer les réinscriptions':'background:var(--dkg);color:#fff">Ouvrir pour la saison '+authEsc(saison))+'</button>'+
    '</div>';
}
function ecrireConfigReinscription(cfg){
  if(!window.fbSetDoc||!window.fbDb){ askAlert("Connexion en cours, réessayez."); return Promise.resolve(false); }
  return window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","reinscriptions"),cfg).then(function(){
    REINSC_CFG=cfg; REINSC_CFG_TS=Date.now(); renderReinscriptionAdmin(); return true;
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); return false; });
}
async function ouvrirReinscriptions(){
  var saison=saisonReinscriptionCible();
  var ok=await askConfirm("Les familles déjà inscrites verront une carte « Réinscrire » sur leur Accueil, avec la fiche de l'an dernier pré-remplie. Les demandes arrivent dans vos licences comme des fiches reçues, à valider comme d'habitude.",
    {title:"Ouvrir les réinscriptions "+saison+" ?", confirmText:"Ouvrir"});
  if(!ok) return;
  if(await ecrireConfigReinscription({ouvert:true, saison:saison, majLe:Date.now()})) showToast("Réinscriptions "+saison+" ouvertes");
}
async function fermerReinscriptions(){
  var ok=await askConfirm("Les familles ne verront plus la carte « Réinscrire ». Les demandes déjà reçues sont conservées.",{title:"Fermer les réinscriptions ?", confirmText:"Fermer"});
  if(!ok) return;
  if(await ecrireConfigReinscription({ouvert:false, saison:(REINSC_CFG&&REINSC_CFG.saison)||"", majLe:Date.now()})) showToast("Réinscriptions fermées");
}

// Transforme les demandes reçues en licences « Reçue ». Uniquement quand la
// liste des licences est synchronisée : écrire depuis une copie locale périmée
// écraserait des fiches plus récentes.
var REINSC_IMPORT={enCours:false, ts:0};
function importerReinscriptions(){
  if(typeof isStaffUser!=="function"||!isStaffUser()) return;
  if(typeof FS_PREV==="undefined"||!FS_PREV.licences) return;
  if(!window.fbGetDocs||!window.fbQuery||!window.fbWhere) return;
  if(REINSC_IMPORT.enCours||Date.now()-REINSC_IMPORT.ts<20000) return;
  REINSC_IMPORT.enCours=true; REINSC_IMPORT.ts=Date.now();
  var q=window.fbQuery(window.fbCollection(window.fbDb,"reinscriptions"),window.fbWhere("statut","==","nouvelle"));
  window.fbGetDocs(q).then(function(snap){
    var demandes=[]; snap.forEach(function(d){ var v=d.data(); v._id=d.id; demandes.push(v); });
    if(!demandes.length) return;
    var lics=getLicences(), players=getPlayers(), crees=[], marques=[];
    demandes.forEach(function(r){
      var id="re_"+r._id;
      var p=players.find(function(x){return String(x.id)===String(r.playerId);});
      var memeEnfant=function(l){
        var f=l&&l.fiche; if(!f||!p) return false;
        return normNomPrenom(f.prenom)===normNomPrenom(p.prenom)&&normNomPrenom(f.nom)===normNomPrenom(p.nom);
      };
      var deja=lics.find(function(l){ return l.id===id || (memeEnfant(l) && (l.saison||getCurrentSeason())===r.saison); });
      if(deja){ marques.push({doc:r._id, licenceId:deja.id}); return; }
      var anciennes=lics.filter(memeEnfant).sort(function(a,b){ return String(b.saison||"").localeCompare(String(a.saison||"")); });
      var old=anciennes[0]||null;
      var fiche=Object.assign({}, old&&old.fiche?old.fiche:{}, r.fiche||{});
      lics.push({
        id:id, code:genCode(),
        email:(old&&old.email)||fiche.respEmail||fiche.emailLic||"",
        nomDest:(old&&old.nomDest)||fiche.respNom||"",
        statut:"recue", createdAt:Date.now(), ouvertLe:null,
        fiche:fiche, categorie:null,
        typeLicence:r.typeLicence||(old&&old.typeLicence)||null,
        saison:r.saison, renouveleeDeCode:old?old.code:null,
        reinscriptionEnLigne:true
      });
      crees.push(r._id);
      marques.push({doc:r._id, licenceId:id});
    });
    if(crees.length && saveLicences(lics)===false) return; // limite du Pack Standard : on réessaiera
    marques.forEach(function(m){
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"reinscriptions",m.doc),{statut:"importee", licenceId:m.licenceId}).catch(function(){});
    });
    if(crees.length){
      showToast(crees.length+" réinscription"+(crees.length>1?"s":"")+" reçue"+(crees.length>1?"s":"")+" en ligne");
      if(typeof buildLicences==="function") buildLicences();
    }
  }).catch(function(e){ console.log("reinscriptions:", e&&e.code); })
    .then(function(){ REINSC_IMPORT.enCours=false; });
}

// ── Côté parent : carte sur l'Accueil ────────────────────────────────
var MES_REINSC=null; // { "playerId|saison": true } : demandes déjà envoyées par ce compte
function chargerMesReinscriptions(){
  if(!window.fbGetDocs||!window.ASMB_USER||!window.ASMB_USER.uid){ MES_REINSC={}; return Promise.resolve(); }
  var q=window.fbQuery(window.fbCollection(window.fbDb,"reinscriptions"),window.fbWhere("auteurUid","==",window.ASMB_USER.uid));
  return window.fbGetDocs(q).then(function(snap){
    MES_REINSC={}; snap.forEach(function(d){ var v=d.data(); MES_REINSC[String(v.playerId)+"|"+v.saison]=true; });
  }).catch(function(){ MES_REINSC={}; });
}

function renderReinscriptionParent(){
  var box=document.getElementById("parent-reinscription"); if(!box) return;
  box.innerHTML="";
  if(typeof isStaffUser==="function"&&isStaffUser()) return;
  var fiches=window.MES_FICHES||{};
  if(!Object.keys(fiches).length) return;
  if(!configReinscriptionFraiche()){
    chargerConfigReinscription().then(function(c){ if(c&&c.ouvert===true) renderReinscriptionParent(); });
    return;
  }
  if(REINSC_CFG.ouvert!==true||!REINSC_CFG.saison) return;
  if(MES_REINSC===null){ chargerMesReinscriptions().then(renderReinscriptionParent); return; }
  var S=REINSC_CFG.saison;
  var enAttente=Object.keys(fiches).filter(function(pid){ var f=fiches[pid]; return f && String(f.saison||"")<S; });
  if(!enAttente.length) return;
  var card=document.createElement("div");
  card.style.cssText="background:linear-gradient(135deg,var(--dkg),var(--ltg));color:#fff;border-radius:var(--r);padding:16px;margin-bottom:14px;box-shadow:0 4px 16px var(--shadow)";
  var t=document.createElement("div"); t.style.cssText="font-size:15px;font-weight:900"; t.textContent="Saison "+S;
  var st=document.createElement("div"); st.style.cssText="font-size:12px;opacity:.85;margin-top:2px;line-height:1.4";
  st.textContent="Les réinscriptions sont ouvertes. La fiche de l'an dernier est déjà remplie.";
  card.appendChild(t); card.appendChild(st);
  enAttente.forEach(function(pid){
    var f=fiches[pid], prenom=f.prenom||"mon enfant";
    if(MES_REINSC[pid+"|"+S]){
      var ok=document.createElement("div");
      ok.style.cssText="margin-top:10px;background:rgba(255,255,255,.16);border-radius:var(--rx);padding:10px 12px;font-size:12px;font-weight:700";
      ok.textContent="✓ "+prenom+" : demande envoyée, le club va la valider";
      card.appendChild(ok);
    } else {
      var b=document.createElement("button");
      b.style.cssText="display:block;width:100%;margin-top:10px;padding:12px;border-radius:var(--rx);border:none;background:#fff;color:var(--dkg);font-size:14px;font-weight:800;cursor:pointer";
      b.textContent="Réinscrire "+prenom;
      b.addEventListener("click",function(){ ouvrirFicheReinscription(pid); });
      card.appendChild(b);
    }
  });
  box.appendChild(card);
}

function ouvrirFicheReinscription(pid){
  var f=Object.assign({}, (window.MES_FICHES||{})[pid]||{});
  var S=REINSC_CFG&&REINSC_CFG.saison; if(!S) return;
  var s=gmSheet("Réinscrire "+(f.prenom||"mon enfant")+" · "+S);
  var intro=document.createElement("div");
  intro.style.cssText="font-size:12px;color:var(--mut);line-height:1.45;margin-bottom:6px";
  intro.textContent="Fiche reprise de la saison dernière. Corrigez ce qui a changé, puis envoyez.";
  s.body.appendChild(intro);
  function champ(id,label,type){
    var g=document.createElement("div"); g.className="form-group";
    var l=document.createElement("label"); l.className="form-label"; l.htmlFor="rf-"+id; l.textContent=label;
    var i=document.createElement(type==="textarea"?"textarea":"input"); i.className="form-input"; i.id="rf-"+id;
    if(type&&type!=="textarea") i.type=type; if(type==="textarea") i.rows=2;
    i.value=f[id]||"";
    g.appendChild(l); g.appendChild(i); s.body.appendChild(g);
  }
  function titre(txt){ gmSection(s.body,txt); }
  champ("prenom","Prénom"); champ("nom","Nom"); champ("naissance","Date de naissance","date");
  champ("adresse","Adresse","textarea"); champ("telephone","Téléphone","tel"); champ("emailLic","Email","email");
  titre("Responsable légal");
  champ("respNom","Nom du responsable"); champ("respTel","Téléphone","tel"); champ("respEmail","Email","email");
  titre("Contact en cas d'urgence");
  champ("urgenceNom","Nom du contact"); champ("urgenceTel","Téléphone","tel");

  titre("Pratique");
  var type=f.typeLicence||null;
  var row=document.createElement("div"); row.style.cssText="display:flex;gap:8px";
  var btns={};
  [["competition","Compétition"],["loisir","Loisir"]].forEach(function(x){
    var b=document.createElement("button"); b.type="button"; b.textContent=x[1];
    b.style.cssText="flex:1;padding:11px;border-radius:var(--rx);font-size:13px;font-weight:700;cursor:pointer";
    b.addEventListener("click",function(){ type=x[0]; peindre(); });
    btns[x[0]]=b; row.appendChild(b);
  });
  function peindre(){ Object.keys(btns).forEach(function(k){ var on=k===type, b=btns[k];
    b.style.border="2px solid "+(on?"var(--dkg)":"var(--bdr)"); b.style.background=on?"var(--dkg)":"var(--bg)"; b.style.color=on?"#fff":"var(--mut)"; }); }
  peindre(); s.body.appendChild(row);

  function caseACocher(id,txt){
    var l=document.createElement("label");
    l.style.cssText="display:flex;gap:10px;align-items:flex-start;margin-top:14px;font-size:12.5px;color:var(--txt2);line-height:1.4;cursor:pointer";
    var c=document.createElement("input"); c.type="checkbox"; c.id="rf-"+id; c.style.cssText="width:20px;height:20px;margin:0;flex-shrink:0;accent-color:var(--dkg)";
    var sp=document.createElement("span"); sp.textContent=txt;
    l.appendChild(c); l.appendChild(sp); s.body.appendChild(l);
    return c;
  }
  var sante=caseACocher("sante","J'ai répondu NON à toutes les questions du questionnaire de santé (sinon, le club vous demandera un certificat médical).");
  var regl=caseACocher("reglement","J'accepte le règlement du club pour la saison "+S+".");
  var note=document.createElement("div");
  note.style.cssText="font-size:11.5px;color:var(--mut);line-height:1.45;margin-top:12px";
  note.textContent="Le paiement de la cotisation se fait comme d'habitude avec le club. Il ne bloque pas la demande.";
  s.body.appendChild(note);

  var envoyer=gmBtn("Envoyer au club","primary",function(b){
    var v=function(k){ var e=document.getElementById("rf-"+k); return e?String(e.value||"").trim():""; };
    if(!v("prenom")||!v("nom")||!v("naissance")){ askAlert("Prénom, nom et date de naissance sont obligatoires."); return; }
    if(!type){ askAlert("Choisissez Compétition ou Loisir."); return; }
    if(!regl.checked){ askAlert("Cochez l'acceptation du règlement du club."); return; }
    var fiche={};
    ["genre","respLien","resp2Nom","resp2Lien","resp2Tel","resp2Email"].forEach(function(k){ if(f[k]) fiche[k]=f[k]; });
    ["prenom","nom","naissance","adresse","telephone","emailLic","respNom","respTel","respEmail","urgenceNom","urgenceTel"].forEach(function(k){ fiche[k]=v(k); });
    fiche.questionnaireSanteNon=sante.checked;
    fiche.reglementAccepte=true;
    var n=new Date();
    fiche.soumisLe=n.toLocaleDateString("fr-FR")+" a "+n.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    b.disabled=true; b.textContent="Envoi…";
    window.fbAddDoc(window.fbCollection(window.fbDb,"reinscriptions"),{
      auteurUid:window.ASMB_USER.uid, playerId:String(pid), saison:S, statut:"nouvelle",
      typeLicence:type, fiche:fiche, ts:window.fbServerTimestamp()
    }).then(function(){
      if(MES_REINSC) MES_REINSC[pid+"|"+S]=true;
      s.modal.remove();
      showToast("Demande envoyée au club");
      renderReinscriptionParent();
    }).catch(function(e){
      b.disabled=false; b.textContent="Envoyer au club";
      askAlert(e&&e.code==="permission-denied"
        ? "Les réinscriptions ne sont plus ouvertes, ou cet enfant n'est pas rattaché à votre compte. Contactez le club."
        : "Erreur lors de l'envoi : "+((e&&e.code)||e));
    });
  });
  envoyer.style.cssText+=";width:100%;padding:14px;border-radius:var(--rx);font-size:14px;margin-top:16px";
  s.body.appendChild(envoyer);
}
