/* ===== 06-licences.js — Licences, codes d'inscription, fiche publique, paiement ===== */
// ═══ SYSTÈME LICENCES ════════════════════════════════════════════

function getLicences(){try{return JSON.parse(localStorage.getItem("asmb_licences")||"[]");}catch(e){return [];}}
// ── PHONE_INDEX (lecture publique) : permet a un appareil neuf de retrouver
// un numero deja connu du club sans etre encore connecte.
var PHONE_INDEX_PREV={};
function syncPhoneIndexFromLicences(lics){
  if(!window.fbDb||!window.fbSetDoc||!window.CURRENT_CLUB_ID) return;
  var entries={};
  (lics||[]).forEach(function(l){
    if(!l||!l.fiche) return;
    var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(x){return x.replace(/\s+/g,"");});
    var prenom=l.fiche.prenom||"", nom=l.fiche.nom||"";
    var playerName=(prenom+" "+nom).trim();
    var teamIds=[l.fiche.equipe].filter(Boolean);
    phones.forEach(function(p){
      if(!p) return;
      if(!entries[p]) entries[p]={role:"parent",playerIds:[],playerName:playerName,teamIds:teamIds.slice(),clubId:window.CURRENT_CLUB_ID||null};
      if(entries[p].playerIds.indexOf(l.id)<0) entries[p].playerIds.push(l.id);
    });
  });
  Object.keys(entries).forEach(function(phone){
    var s=JSON.stringify(entries[phone]);
    if(PHONE_INDEX_PREV[phone]!==s){
      window.fbSetDoc(window.fbDoc(window.fbDb,"phone_index",phone), entries[phone]).catch(function(e){console.log("phone_index write",phone,e);});
    }
  });
  Object.keys(PHONE_INDEX_PREV).forEach(function(phone){
    if(!(phone in entries) && window.fbDeleteDoc){
      window.fbDeleteDoc(window.fbDoc(window.fbDb,"phone_index",phone)).catch(function(){});
    }
  });
  PHONE_INDEX_PREV={};
  Object.keys(entries).forEach(function(p){PHONE_INDEX_PREV[p]=JSON.stringify(entries[p]);});
}
// ── INDEX DES CODES D'INSCRIPTION (lecture publique) ──────────────
// Ne contient QUE : l'id interne de la licence + le type deja choisi.
// Aucun nom, aucune adresse, aucun contact, aucun document. Sert uniquement
// a repondre "ce code existe-t-il ?" sur un appareil non connecte.
var INSCRIPTION_CODES_PREV={};
function syncInscriptionCodes(lics){
  if(!window.fbDb||!window.fbSetDoc||!window.CURRENT_CLUB_ID) return;
  var entries={};
  (lics||[]).forEach(function(l){
    if(!l||!l.code) return;
    entries[l.code]={licenceId:l.id||l.code, typeLicence:l.typeLicence||null, clubId:window.CURRENT_CLUB_ID||null};
  });
  Object.keys(entries).forEach(function(code){
    var s=JSON.stringify(entries[code]);
    if(INSCRIPTION_CODES_PREV[code]!==s){
      window.fbSetDoc(window.fbDoc(window.fbDb,"inscription_codes",code), entries[code]).catch(function(e){console.log("inscription_codes write",code,e);});
    }
  });
  Object.keys(INSCRIPTION_CODES_PREV).forEach(function(code){
    if(!(code in entries) && window.fbDeleteDoc){
      window.fbDeleteDoc(window.fbDoc(window.fbDb,"inscription_codes",code)).catch(function(){});
    }
  });
  INSCRIPTION_CODES_PREV={};
  Object.keys(entries).forEach(function(c){INSCRIPTION_CODES_PREV[c]=JSON.stringify(entries[c]);});
}

// Vrai si l'utilisateur courant est connecte avec un role staff (peut ecrire dans licences)
function isStaffUser(){
  var r=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  return r.indexOf("dirigeant")>=0||r.indexOf("coach")>=0;
}

// Recherche d'un code : cache local (appareil staff) puis index public (appareil neuf)
function lookupInscriptionCode(code, attempt){
  attempt=attempt||0;
  var lics=getLicences();
  var local=lics.find(function(l){return l.code===code;});
  if(local) return Promise.resolve({found:true, local:local, code:code, clubId:localStorage.getItem("gm_active_club")});
  if(!window.fbDb||!window.fbGetDoc){
    // Firebase pas encore initialise (appareil neuf, page qui vient de charger) : on reessaie brievement.
    if(attempt<30){
      return new Promise(function(resolve){
        setTimeout(function(){ resolve(lookupInscriptionCode(code, attempt+1)); }, 150);
      });
    }
    return Promise.resolve({found:false, code:code});
  }
  return window.fbGetDoc(window.fbDoc(window.fbDb,"inscription_codes",code)).then(function(snap){
    if(snap&&snap.exists()){
      var d=snap.data();
      return {found:true, local:null, code:code, typeLicence:d.typeLicence||null, clubId:d.clubId||null};
    }
    return {found:false, code:code};
  }).catch(function(){ return {found:false, code:code}; });
}

function saveLicences(l){localStorage.setItem("asmb_licences",JSON.stringify(l));fsWriteCollection("licences",l);syncPhoneIndexFromLicences(l);syncInscriptionCodes(l);}

// ── GESTION DE SAISON (archivage annuel des licences) ──────────────
// Saison "naturelle" deduite de la date du jour (nouvelle saison des debut juillet,
// pour que les licences entrees en ete comptent deja pour l'annee suivante)
// computeNaturalSeason() et getCurrentSeason() sont dans 01-config.js
// (ELITE_CATS les appelle des sa declaration).
function setCurrentSeason(s){
  localStorage.setItem("asmb_current_season", s);
  if(window.fbDb && window.fbSetDoc){
    window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","season"),{value:s},{merge:true}).catch(function(){});
  }
}
function nextSeasonLabel(season){
  var m=/^(\d{4})-(\d{4})$/.exec(season||"");
  if(!m) return computeNaturalSeason();
  var y=parseInt(m[2],10);
  return y+"-"+(y+1);
}
// Applique le label de saison courant partout ou il est affiche
function applySeasonLabels(){
  var season=getCurrentSeason();
  var heroEl=document.getElementById("hero-season-sub");
  if(heroEl) heroEl.textContent="ASMB · Saison "+season;
}
async function startNewSeason(){
  if(!window.ASMB_USER || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){alert("Réservé au dirigeant.");return;}
  var current=getCurrentSeason();
  var next=nextSeasonLabel(current);
  var lics=getLicences();
  var activeCount=lics.filter(function(l){return (l.saison||current)===current;}).length;
  var ok=await askConfirm("Saison actuelle : "+current+" ("+activeCount+" licence(s) active(s)).\n\nLa nouvelle saison "+next+" va démarrer. Les licences de "+current+" seront archivées (elles restent consultables, mais ne comptent plus comme actives). Les joueurs et équipes ne sont pas touchés.", {title:"Passer à la saison "+next+" ?", confirmText:"Démarrer la saison "+next});
  if(!ok)return;
  lics.forEach(function(l){ if(!l.saison) l.saison=current; });
  saveLicences(lics);
  setCurrentSeason(next);
  applySeasonLabels();
  await askAlert("Saison "+next+" démarrée. Les licences de "+current+" sont archivées.");
  buildLicences();
  buildAdminHome();
}

function genCode(){
 var chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 var part=function(n){var s="";for(var i=0;i<n;i++)s+=chars[Math.floor(Math.random()*chars.length)];return s;};
 var existing={};
 getLicences().forEach(function(l){ if(l&&l.code) existing[l.code]=true; });
 var code, attempts=0;
 do{
   code="ASMB-"+part(4)+"-"+part(4);
   attempts++;
 } while(existing[code] && attempts<50);
 return code;
}

var STATUTS=[
 {id:"envoyee",label:"Envoyée",icon:"",color:"#7a8caa"},
 {id:"ouverte",label:"Ouverte",icon:"",color:"#E8670A"},
 {id:"en_cours",label:"En cours",icon:"",color:"#1A2E5A"},
 {id:"recue",label:"Reçue",icon:"",color:"#8E44AD"},
 {id:"validee",label:"Validée",icon:"",color:"#D4AF37"},
];
var CATS_LIC=["U7","U9","U11","U13","U15","U18","U21","Senior"];
var CAT_COLS_LIC={"U7":"#E8670A","U9":"#8E44AD","U11":"#16A085","U13":"#D4AF37","U15":"#1A2E5A","U18":"#0B7285","U21":"#5B3A8E","Senior":"#E8670A"};

// ── BUILD LICENCES SCREEN ────────────────────────────────────────
var licShowArchived=false;
function buildLicences(){
 var season=getCurrentSeason();
 var allLics=getLicences();
 var lics=licShowArchived ? allLics.filter(function(l){return l.saison && l.saison!==season;})
                           : allLics.filter(function(l){return !l.saison || l.saison===season;});
 var el=document.getElementById("licenceList");if(!el)return;
 document.getElementById("lic-count").textContent=lics.length+" fiche"+(lics.length>1?"s":"")+" · Saison "+season+(licShowArchived?" (archives)":"");

 var archBox=document.getElementById("lic-archive-toggle");
 if(archBox){
   var archivedCount=allLics.filter(function(l){return l.saison && l.saison!==season;}).length;
   if(archivedCount>0){
     archBox.style.display="block";
     archBox.innerHTML='<button onclick="licShowArchived=!licShowArchived;buildLicences();" style="width:100%;padding:9px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:11px;font-weight:700;border:none;cursor:pointer;margin:0 12px 10px;width:calc(100% - 24px)">'+(licShowArchived?"← Retour à la saison "+season:"Voir les saisons précédentes ("+archivedCount+")")+'</button>';
   } else { archBox.style.display="none"; archBox.innerHTML=""; }
 }

 var counterEl=document.getElementById("lic-counter-box");
 if(counterEl){
 var byCat={};
 lics.forEach(function(l){
 var cat=l.categorie||"Non classee";
 if(!byCat[cat])byCat[cat]={valid:0,pending:0};
 if(l.statut==="validee")byCat[cat].valid++;
 else byCat[cat].pending++;
 });
 var catKeys=Object.keys(byCat);
 if(!catKeys.length){counterEl.innerHTML="";}
 else{
 var chtml='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;box-shadow:0 2px 8px var(--shadow)">';
      chtml+='<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Validees vs en attente</div>';
      catKeys.forEach(function(cat){
        var c=byCat[cat];
        chtml+='<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px"><span style="color:var(--txt);font-weight:600">'+cat+'</span><span><span style="color:#D4AF37;font-weight:700">'+c.valid+' validée'+(c.valid>1?"s":"")+'</span> <span style="color:var(--mut)">· </span><span style="color:#E8670A;font-weight:700">'+c.pending+' en attente</span></span></div>';
      });
      chtml+='</div>';
      counterEl.innerHTML=chtml;
    }
  }

  el.innerHTML="";
  if(!lics.length){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucune fiche envoyée</div><div style="font-size:11px;margin-top:4px">Appuyez sur + Nouvelle fiche</div></div>';
    return;
  }
  // Tri par date décroissante
  lics.sort(function(a,b){return b.createdAt-a.createdAt;});
  lics.forEach(function(lic){
    var st=STATUTS.find(function(s){return s.id===lic.statut;})||STATUTS[0];
    var div=document.createElement("div");
    div.style.cssText="margin:0 12px 8px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);box-shadow:0 2px 8px var(--shadow);overflow:hidden;cursor:pointer";
    div.onclick=function(){openLicenceDetail(lic.code);};
    var catBadge=lic.categorie?'<span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+(CAT_COLS_LIC[lic.categorie]||"#1A2E5A")+'">'+lic.categorie+'</span>':'';
    var photoHtml=lic.fiche&&lic.fiche.photo?'<img src="'+lic.fiche.photo+'" style="width:42px;height:42px;border-radius:50%;object-fit:cover;flex-shrink:0">':'<div style="width:42px;height:42px;border-radius:50%;background:var(--dkg);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0"></div>';
    var nom=lic.fiche?(lic.fiche.prenom+" "+lic.fiche.nom):"Fiche en attente";
    var daysSince=(Date.now()-lic.createdAt)/86400000;
    var needsRelance=lic.statut==="envoyee"&&daysSince>=5;
    var relanceBadge=needsRelance?'<span style="font-size:9px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:#E8670A">Relance recommandee</span>':"";
    div.innerHTML='<div style="padding:13px 14px;display:flex;align-items:center;gap:12px">'+photoHtml+'<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:2px">'+nom+'</div><div style="font-size:11px;color:var(--mut);margin-bottom:4px">Code : <b>'+lic.code+'</b>'+(lic.email?' · '+lic.email:'')+'</div><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap"><span style="font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;color:#fff;background:'+st.color+'">'+st.icon+' '+st.label+'</span>'+catBadge+(lic.ouvertLe?'<span style="font-size:9px;color:var(--mut)">Ouvert le '+lic.ouvertLe+'</span>':'')+relanceBadge+'</div></div><div style="color:var(--mut);font-size:16px">›</div></div>';
    el.appendChild(div);
  });
}

function showNewLicence(){
  var tip=document.getElementById("lic-mail-tip");
  if(tip)tip.style.display=localStorage.getItem("asmb_tip_lic_mail_dismissed")?"none":"flex";
  document.getElementById("modal-new-lic").style.display="flex";
}
function closeNewLicence(){
  document.getElementById("modal-new-lic").style.display="none";
}

function createLicence(){
  var email=document.getElementById("lic-email").value.trim();
  var nom=document.getElementById("lic-nom-dest").value.trim();
  if(!email){alert("Adresse mail obligatoire");return;}
  var code=genCode();
  var lic={
    id:Date.now().toString(),
    code:code,email:email,nomDest:nom,
    statut:"envoyee",createdAt:Date.now(),
    ouvertLe:null,fiche:null,categorie:null,
    saison:getCurrentSeason()
  };
  var lics=getLicences();lics.push(lic);saveLicences(lics);
  closeNewLicence();
  // Ouvrir le mail
  sendLicenceMail(lic);
  buildLicences();buildAdminHome();
}

function sendLicenceMail(lic){
  var sujet="Votre inscription ASMB - Code "+lic.code;
  var appUrl="https://ecole-app.github.io/Asmb-basket/?inscription=1";
  var body=
    "Bonjour"+(lic.nomDest?" "+lic.nomDest:"")+",\n\n"+
    "L'ASMB (Saint-Étienne Métropole Basket) vous invite a completer votre fiche d'inscription en ligne.\n\n"+
    "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"+
    "  VOTRE CODE D'INSCRIPTION\n\n"+
    "        "+lic.code+"\n\n"+
    "━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"+
    "Comment proceder :\n"+
    "1. Ouvrez ce lien : "+appUrl+"\n"+
    "2. Appuyez sur l'onglet « Inscription »\n"+
    "3. Entrez votre code ci-dessus\n"+
    "4. Remplissez et validez votre fiche\n\n"+
    "Astuce : vous pouvez aussi ajouter cette page a votre ecran d'accueil pour un acces rapide.\n\n"+
    "Ce code est personnel et valable pour une seule inscription.\n\n"+
    "En cas de probleme, contactez le club directement.\n\n"+
    "Secrétariat\n"+
 "Saint-Étienne Métropole Basket\n"+
 "—\n"+
 " ASMB · EST. 2022";
 var mailto="mailto:"+lic.email+"?subject="+encodeURIComponent(sujet)+"&body="+encodeURIComponent(body);
 window.location.href=mailto;
}

// ── DETAIL LICENCE ───────────────────────────────────────────────
var currentLicCode=null;
function openLicenceDetail(code){
 currentLicCode=code;
 var lics=getLicences();
 var lic=lics.find(function(l){return l.code===code;});
 if(!lic)return;
 stack.push("licence-detail");
 renderLicenceDetail(lic);
 showScr("licence-detail");
}

function renderLicenceDetail(lic){
 var el=document.getElementById("lic-detail-content");if(!el)return;
 var st=STATUTS.find(function(s){return s.id===lic.statut;})||STATUTS[0];
 var fiche=lic.fiche||{};

 // Auto-suggestion de la catégorie FFBB depuis la date de naissance + genre,
 // si aucune catégorie n'a encore été choisie manuellement.
 if(!lic.categorie && fiche.naissance){
   var suggested=categorieFromNaissance(fiche.naissance, fiche.genre);
   if(suggested && CATS_LIC.indexOf(suggested)>=0){
     lic.categorie=suggested;
     var lics=getLicences();
     var idx=lics.findIndex(function(l){return l.code===lic.code;});
     if(idx>=0 && !lics[idx].categorie){ lics[idx].categorie=suggested; saveLicences(lics); }
   }
 }

 // Statut steps
 var steps=STATUTS.map(function(s,i){
 var done=STATUTS.findIndex(function(x){return x.id===lic.statut;})>=i;
 return'<div style="display:flex;flex-direction:column;align-items:center;gap:3px;flex:1"><div style="width:28px;height:28px;border-radius:50%;background:'+(done?s.color:"var(--bdr)")+';color:'+(done?"#fff":"var(--mut)")+';display:flex;align-items:center;justify-content:center;font-size:12px">'+s.icon+'</div><div style="font-size:8px;color:'+(done?s.color:"var(--mut)")+';font-weight:600;text-align:center">'+s.label+'</div></div>';
  }).join('<div style="flex:1;height:2px;background:var(--bdr);margin-top:14px"></div>');

  // Catégorie selector
  var catSel=CATS_LIC.map(function(c){
    var sel=lic.categorie===c;
    return '<button onclick="setLicCat(\''+c+'\')" style="padding:7px 14px;border-radius:20px;font-size:12px;font-weight:700;border:2px solid '+(sel?CAT_COLS_LIC[c]:"var(--bdr)")+';background:'+(sel?CAT_COLS_LIC[c]:"var(--card)")+';color:'+(sel?"#fff":"var(--mut)")+';cursor:pointer;transition:all .2s">'+c+'</button>';
 }).join("");

 // Fiche data
 var ficheHtml="";
 if(lic.fiche){
 var f=lic.fiche;
 var rows=[
 ["Genre",f.genre==="F"?"Féminin":"Masculin"],
 ["Prénom",f.prenom],["Nom",f.nom],
 ["Date de naissance",f.naissance],
 ["Ne(e) a l etranger",f.neEtranger?"Oui - "+(f.villeNaiss||"?")+", "+(f.paysNaiss||"?"):"Non"],["Adresse",f.adresse],
 ["Téléphone",f.telephone],["Email",f.emailLic],
 ["Responsable legal 1",f.respNom+(f.respLien?" ("+f.respLien+")":"")],
 ["Tel resp. 1",f.respTel],
 ["Email resp. 1",f.respEmail],
 ["Responsable legal 2",f.resp2Nom+(f.resp2Lien?" ("+f.resp2Lien+")":"")],
 ["Tel resp. 2",f.resp2Tel],
 ["Email resp. 2",f.resp2Email],
 ["Contact urgence",f.urgenceNom+(f.urgenceTel?" · "+f.urgenceTel:"")],
 ["Notes",f.notes],
 ["Certificat medical",f.certDate?(f.certMedecin?" Dr "+f.certMedecin+" · ":"")+f.certDate+(f.certificat?" ✓ Fichier joint":""):"Non fourni"],
 ].filter(function(r){return r[1];});
 ficheHtml='<div style="margin-top:12px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);overflow:hidden">';
    if(f.photo)ficheHtml+='<div style="text-align:center;padding:16px;border-bottom:1px solid var(--bdr)"><img src="'+f.photo+'" style="width:80px;height:80px;border-radius:50%;object-fit:cover"></div>';
    if(f.certificat){var isImg=f.certificat.startsWith("data:image");ficheHtml+='<div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:8px"><span style="font-size:16px"></span><div style="flex:1"><div style="font-size:11px;font-weight:600;color:var(--mut)">Certificat medical</div><div style="font-size:11px;color:var(--ltg)">✓ Fichier joint</div></div>'+(isImg?'<a href="'+f.certificat+'" target="_blank" style="padding:6px 12px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:10px;font-weight:600;text-decoration:none">Voir</a>':'')+'</div>';}
    rows.forEach(function(r){
      ficheHtml+='<div style="padding:10px 14px;border-bottom:1px solid var(--bdr);display:flex;gap:10px"><span style="font-size:11px;font-weight:600;color:var(--mut);width:120px;flex-shrink:0">'+r[0]+'</span><span style="font-size:12px;color:var(--txt)">'+r[1]+'</span></div>';
    });
    ficheHtml+='</div>';
  }

  // Paiement
  var paiementHtml="";
  if(lic.fiche){
    if(lic.paiement){
      var p=lic.paiement;
      paiementHtml='<div style="margin-top:12px;background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.3);border-radius:var(--rs);padding:14px">'+
        '<div style="font-size:13px;font-weight:800;color:var(--dkg)">✓ Paiement reçu</div>'+
        '<div style="font-size:12px;color:var(--txt2);margin-top:4px">'+p.moyen+' · '+(p.montant||0).toFixed(2)+' € · '+(p.date?new Date(p.date).toLocaleDateString("fr-FR"):"")+'</div>'+
        '<div style="display:flex;gap:8px;margin-top:10px">'+
          '<button onclick="printFactureLicence(\''+lic.code+'\')" style="flex:1;padding:9px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">Imprimer</button>'+
          '<button onclick="sendFactureLicenceMail(\''+lic.code+'\')" style="flex:1;padding:9px;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:11px;font-weight:700;border:none;cursor:pointer">Envoyer</button>'+
          '<button onclick="openPaiementLicenceModal(\''+lic.code+'\')" style="flex:1;padding:9px;border-radius:var(--rx);background:transparent;border:1px solid var(--bdr);color:var(--mut);font-size:11px;font-weight:700;cursor:pointer">Modifier</button>'+
        '</div></div>';
    } else {
      paiementHtml='<div style="margin-top:12px;background:rgba(232,103,10,.08);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:14px">'+
        '<div style="font-size:13px;font-weight:800;color:#E8670A">⏳ Paiement non enregistré</div>'+
        '<button onclick="openPaiementLicenceModal(\''+lic.code+'\')" style="width:100%;padding:11px;border-radius:var(--rx);background:#E8670A;color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;margin-top:10px">Enregistrer un paiement</button>'+
        '</div>';
    }
  }

  // Actions
  var actions="";
  var curSeason=getCurrentSeason();
  if(lic.saison && lic.saison!==curSeason){
    actions+='<button onclick="renewLicence(\''+lic.code+'\')" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:12px">Renouveler pour la saison '+curSeason+'</button>';
    actions+='<div style="font-size:11px;color:var(--mut);text-align:center;margin-top:4px">Recopie la fiche existante (identité, contacts...) sans tout ressaisir.</div>';
  }
  if(lic.statut==="recue"){
    actions='<button onclick="validerLicence()" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:12px">Valider la licence</button>';
  }
  if(lic.statut!=="validee"){
    actions+='<button onclick="resendLicMail()" style="width:100%;padding:11px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:12px;font-weight:600;border:none;cursor:pointer;margin-top:8px">Renvoyer le mail</button>';
  }
  if(lic.fiche){
    actions+='<button onclick="showEditFiche()" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(26,46,90,.12);color:#1A2E5A;font-size:12px;font-weight:700;border:none;cursor:pointer;margin-top:8px">Modifier la fiche (dirigeant)</button>';
    actions+='<button onclick="addLicenceAsBenevole(\''+lic.code+'\')" style="width:100%;padding:11px;border-radius:var(--rx);background:rgba(232,103,10,.1);color:#E8670A;font-size:12px;font-weight:700;border:none;cursor:pointer;margin-top:8px">Ajouter comme bénévole</button>';
  }

  el.innerHTML=
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px">'+steps+'</div>'+
    '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:12px">'+
      '<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Code</div>'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        '<div style="font-size:18px;font-weight:900;color:var(--txt);font-family:monospace;letter-spacing:2px">'+lic.code+'</div>'+
        (lic.typeLicence?'<div style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;color:#fff;background:'+(lic.typeLicence==="competition"?"#C0392B":"#D4AF37")+'">'+( lic.typeLicence==="competition"?" Compétition":" Loisir")+'</div>':'')+
        '<button onclick="copyCode(\''+lic.code+'\')" style="padding:6px 12px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:11px;font-weight:600;border:none;cursor:pointer">Copier</button>'+
      '</div>'+
      (lic.email?'<div style="font-size:11px;color:var(--mut);margin-top:4px">'+lic.email+'</div>':'')+
      (lic.ouvertLe?'<div style="font-size:11px;color:#E8670A;margin-top:4px">Ouvert le '+lic.ouvertLe+'</div>':'')+
    '</div>'+
    '<div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Catégorie</div>'+
    '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:12px">'+catSel+'</div>'+
    ficheHtml+paiementHtml+actions;
}

// ── PAIEMENT DE LICENCE + FACTURE (point 1) ─────────────────────────
function openPaiementLicenceModal(code){
  var lics=getLicences();
  var lic=lics.find(function(l){return l.code===code;});
  if(!lic)return;
  var p=lic.paiement||{};
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var moyens=["Espèces","Chèque","Virement","CB"];
  var moyenBtns=moyens.map(function(m){
    var sel=(p.moyen||"Espèces")===m;
    return '<button type="button" class="pl-moyen-btn" data-moyen="'+m+'" style="flex:1;padding:10px 6px;border-radius:var(--rx);border:2px solid '+(sel?"var(--grn)":"var(--bdr)")+';background:'+(sel?"rgba(212,175,55,.1)":"var(--card)")+';color:'+(sel?"var(--dkg)":"var(--mut)")+';font-size:11px;font-weight:700;cursor:pointer">'+m+'</button>';
  }).join("");
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">Enregistrer le paiement</div>'+
      '<button id="pl-close" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div style="font-size:12px;color:var(--mut);margin-bottom:14px">'+(lic.fiche?authEsc((lic.fiche.prenom||"")+" "+(lic.fiche.nom||"")):"")+(lic.typeLicence?" · "+(lic.typeLicence==="competition"?"Compétition":"Loisir"):"")+'</div>'+
    '<div class="form-group"><label class="form-label">Moyen de paiement</label><div id="pl-moyen-row" style="display:flex;gap:6px;flex-wrap:wrap">'+moyenBtns+'</div></div>'+
    '<div class="form-group"><label class="form-label">Montant (€)</label><input class="form-input" id="pl-montant" type="number" step="0.01" value="'+(p.montant!=null?p.montant:"")+'" placeholder="0.00"></div>'+
    '<div class="form-group"><label class="form-label">Date du paiement</label><input class="form-input" id="pl-date" type="date" value="'+(p.date||new Date().toISOString().slice(0,10))+'"></div>'+
    '<div class="form-group"><label class="form-label">Référence (optionnel)</label><input class="form-input" id="pl-reference" value="'+authEsc(p.reference||"")+'" placeholder="N° de chèque, etc."></div>'+
    '<button id="pl-save" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:4px">Enregistrer</button>';
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  var selectedMoyen=p.moyen||"Espèces";
  Array.prototype.forEach.call(document.querySelectorAll(".pl-moyen-btn"),function(btn){
    btn.addEventListener("click",function(){
      selectedMoyen=btn.dataset.moyen;
      Array.prototype.forEach.call(document.querySelectorAll(".pl-moyen-btn"),function(b){
        var sel=b.dataset.moyen===selectedMoyen;
        b.style.borderColor=sel?"var(--grn)":"var(--bdr)";
        b.style.background=sel?"rgba(212,175,55,.1)":"var(--card)";
        b.style.color=sel?"var(--dkg)":"var(--mut)";
      });
    });
  });
  document.getElementById("pl-close").addEventListener("click",function(){modal.remove();});
  document.getElementById("pl-save").addEventListener("click",function(){
    var montant=parseFloat(document.getElementById("pl-montant").value);
    var date=document.getElementById("pl-date").value;
    if(!montant||montant<=0){alert("Montant invalide");return;}
    if(!date){alert("Date obligatoire");return;}
    savePaiementLicence(code,{
      moyen:selectedMoyen,montant:montant,date:date,
      reference:document.getElementById("pl-reference").value.trim()
    });
    modal.remove();
  });
}
function savePaiementLicence(code,paiement){
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===code;});
  if(idx<0)return;
  var wasAlreadyRecorded=!!lics[idx].paiement;
  lics[idx].paiement=paiement;
  saveLicences(lics);
  // Cree (ou ne duplique pas) la ligne Comptabilite correspondante
  var compta=getComptabilite();
  var f=lics[idx].fiche||{};
  var nom=((f.prenom||"")+" "+(f.nom||"")).trim();
  var refCompta="Licence "+code;
  var existingLine=compta.find(function(c){return c.reference===refCompta;});
  var comptaData={
    date:paiement.date,montant:paiement.montant,type:"recette",
    categorie:"Licence",motif:"Licence "+nom+(lics[idx].typeLicence?" ("+(lics[idx].typeLicence==="competition"?"Compétition":"Loisir")+")":""),
    tiers:f.respNom||nom,moyen:paiement.moyen,reference:refCompta
  };
  if(existingLine){
    Object.assign(existingLine,comptaData);
  } else {
    comptaData.id=Date.now().toString();
    compta.push(comptaData);
  }
  saveComptabilite(compta);
  renderLicenceDetail(lics[idx]);
  buildLicences();
}
function generateFactureHtml(lic){
  var p=lic.paiement||{};
  var f=lic.fiche||{};
  var nom=((f.prenom||"")+" "+(f.nom||"")).trim();
  return '<h1>Reçu de paiement — ASMB Basket</h1>'+
    '<div class="row"><span>Licencié(e)</span><b>'+authEsc(nom)+'</b></div>'+
    '<div class="row"><span>Code licence</span><b>'+authEsc(lic.code)+'</b></div>'+
    '<div class="row"><span>Catégorie</span><b>'+authEsc(lic.categorie||"-")+'</b></div>'+
    '<div class="row"><span>Type</span><b>'+(lic.typeLicence==="competition"?"Compétition":"Loisir")+'</b></div>'+
    '<div class="row"><span>Date de paiement</span><b>'+(p.date?new Date(p.date).toLocaleDateString("fr-FR"):"")+'</b></div>'+
    '<div class="row"><span>Moyen de paiement</span><b>'+authEsc(p.moyen||"")+'</b></div>'+
    (p.reference?'<div class="row"><span>Référence</span><b>'+authEsc(p.reference)+'</b></div>':'')+
    '<div class="row" style="font-size:16px"><span>Montant réglé</span><b style="color:#1A2E5A">'+(p.montant||0).toFixed(2)+' €</b></div>';
}
function printFactureLicence(code){
  var lic=getLicences().find(function(l){return l.code===code;});
  if(!lic||!lic.paiement)return;
  var win=window.open("","_blank");
  var html='<html><head><title>Reçu de paiement</title><style>'+
    'body{font-family:system-ui,-apple-system,sans-serif;padding:30px;color:#1a2e1e}'+
    'h1{font-size:20px;border-bottom:2px solid #1A2E5A;padding-bottom:10px}'+
    '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}'+
    '.row b{color:#1A2E5A}'+
    '</style></head><body>'+generateFactureHtml(lic)+'</body></html>';
  win.document.write(html);
  win.document.close();
  setTimeout(function(){win.print();},400);
}
function sendFactureLicenceMail(code){
  var lic=getLicences().find(function(l){return l.code===code;});
  if(!lic||!lic.paiement)return;
  var f=lic.fiche||{};
  var p=lic.paiement;
  var nom=((f.prenom||"")+" "+(f.nom||"")).trim();
  var destEmail=f.respEmail||f.emailLic||lic.email||"";
  var subject="Reçu de paiement - Licence "+nom+" - ASMB Basket";
  var body="Bonjour,\n\nNous confirmons la bonne réception de votre paiement pour la licence de "+nom+".\n\n"+
    "Code licence : "+lic.code+"\n"+
    "Catégorie : "+(lic.categorie||"-")+"\n"+
    "Montant réglé : "+(p.montant||0).toFixed(2)+" €\n"+
    "Moyen de paiement : "+(p.moyen||"")+"\n"+
    "Date : "+(p.date?new Date(p.date).toLocaleDateString("fr-FR"):"")+"\n\n"+
    "Merci de votre confiance,\nASMB Basket";
  var mailto="mailto:"+encodeURIComponent(destEmail)+"?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  window.location.href=mailto;
}

async function addLicenceAsBenevole(code){
  var lics=getLicences();
  var lic=lics.find(function(l){return l.code===code;});
  if(!lic||!lic.fiche){alert("Fiche introuvable.");return;}
  var f=lic.fiche;
  var contacts=getAnnuaire();
  var existing=contacts.find(function(c){return c.linkedLicenceCode===code;});
  if(existing){
    if(existing.type==="benevole"){ alert("Déjà enregistré comme bénévole."); return; }
    existing.type="benevole";
    saveAnnuaireList(contacts);
    alert("Ajouté aux bénévoles.");
    return;
  }
  var nomComplet=((f.respNom||"").trim())||((f.prenom||"")+" "+(f.nom||"")).trim();
  var dispo=await askPrompt("Disponibilités / tâches proposées", {placeholder:"Ex: buvette, transport, arbitrage...", confirmText:"Ajouter"});
  contacts.push({
    id:Date.now().toString(),
    nom:nomComplet,
    role:"Bénévole ("+((f.prenom||"")+" "+(f.nom||"")).trim()+")",
    tel:f.respTel||f.telephone||"",
    email:f.respEmail||f.emailLic||"",
    type:"benevole",
    dispo:dispo||"",
    linkedLicenceCode:code
  });
  saveAnnuaireList(contacts);
  await askAlert("Ajouté aux bénévoles.");
}

function setLicCat(cat){
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===currentLicCode;});
  if(idx<0)return;
  lics[idx].categorie=cat;
  saveLicences(lics);
  renderLicenceDetail(lics[idx]);
  buildLicences();
}

async function renewLicence(oldCode){
  var lics=getLicences();
  var old=lics.find(function(l){return l.code===oldCode;});
  if(!old){alert("Fiche introuvable.");return;}
  var season=getCurrentSeason();
  var ok=await askConfirm("Une nouvelle fiche va être créée pour "+((old.fiche&&old.fiche.prenom)||"")+" "+((old.fiche&&old.fiche.nom)||"")+", saison "+season+", en recopiant les informations existantes (identité, contacts, adresse...). La catégorie sera recalculée selon son âge actuel.", {title:"Renouveler la licence", confirmText:"Renouveler"});
  if(!ok)return;
  var newFiche=old.fiche?Object.assign({},old.fiche):null;
  var newCat=newFiche&&newFiche.naissance?categorieFromNaissance(newFiche.naissance,newFiche.genre):null;
  var neu={
    id:Date.now().toString(),
    code:genCode(),
    email:old.email,
    nomDest:old.nomDest,
    statut:newFiche?"recue":"envoyee",
    createdAt:Date.now(),
    ouvertLe:null,
    fiche:newFiche,
    categorie:(newCat&&CATS_LIC.indexOf(newCat)>=0)?newCat:null,
    typeLicence:old.typeLicence||null,
    saison:season,
    renouveleeDeCode:oldCode
  };
  lics.push(neu);
  saveLicences(lics);
  buildLicences();
  await askAlert("Fiche renouvelée pour la saison "+season+". Vérifiez les informations puis validez.");
  openLicenceDetail(neu.code);
}

function validerLicence(){
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===currentLicCode;});
  if(idx<0)return;
  if(!lics[idx].categorie){alert("Assignez une catégorie avant de valider");return;}
  var f0=lics[idx].fiche||{};
  if(f0.surclassement && (!f0.certificat || !f0.certDate)){
    alert("Surclassement coché sur cette fiche : le certificat médical (fichier + date) est obligatoire avant de valider.");
    return;
  }
  lics[idx].statut="validee";
  saveLicences(lics);
  renderLicenceDetail(lics[idx]);
  buildLicences();
  // Ajouter dans les joueurs si pas déjà là
  var f=lics[idx].fiche;
  if(f){
    var players=getPlayers();
    var exists=players.find(function(p){return p.email===f.emailLic;});
    if(!exists){
      players.push({id:Date.now().toString(),prenom:f.prenom,nom:f.nom,naissance:f.naissance,cat:lics[idx].categorie,poste:"---",licence:"ok",contact:f.telephone,notes:f.notes||""});
      savePlayers(players);
    }
  }
  alert("Licence validée ! Le joueur a ete ajouté aux inscriptions.");
}

function resendLicMail(){
  var lics=getLicences();
  var lic=lics.find(function(l){return l.code===currentLicCode;});
  if(lic)sendLicenceMail(lic);
}

// ── EDITION FICHE PAR DIRIGEANT ─────────────────────────────────────
function showEditFiche(){
  var lics=getLicences();
  var lic=lics.find(function(l){return l.code===currentLicCode;});
  if(!lic||!lic.fiche)return;
  var f=lic.fiche;
  var el=document.getElementById("edit-fiche-form");
  el.innerHTML=
    '<div class="form-group"><label class="form-label">Prénom</label><input class="form-input" id="ef-prenom" value="'+(f.prenom||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Nom</label><input class="form-input" id="ef-nom" value="'+(f.nom||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Date de naissance</label><input class="form-input" id="ef-naissance" type="date" value="'+(f.naissance||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Adresse</label><textarea class="form-input" id="ef-adresse" rows="2">'+(f.adresse||"")+'</textarea></div>'+
    '<div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="ef-telephone" value="'+(f.telephone||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="ef-emailLic" value="'+(f.emailLic||"")+'"></div>'+
    '<div style="background:var(--bdr);height:1px;margin:14px 0"></div>'+
    '<div class="form-group"><label class="form-label">Responsable legal 1 - Nom</label><input class="form-input" id="ef-respNom" value="'+(f.respNom||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Responsable legal 1 - Téléphone</label><input class="form-input" id="ef-respTel" value="'+(f.respTel||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Responsable legal 1 - Email</label><input class="form-input" id="ef-respEmail" value="'+(f.respEmail||"")+'"></div>'+
    '<div style="background:var(--bdr);height:1px;margin:14px 0"></div>'+
    '<div class="form-group"><label class="form-label">Contact urgence - Nom</label><input class="form-input" id="ef-urgenceNom" value="'+(f.urgenceNom||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Contact urgence - Téléphone</label><input class="form-input" id="ef-urgenceTel" value="'+(f.urgenceTel||"")+'"></div>'+
    '<div class="form-group"><label class="form-label">Notes / Informations medicales</label><textarea class="form-input" id="ef-notes" rows="3">'+(f.notes||"")+'</textarea></div>';
  document.getElementById("modal-edit-fiche").style.display="flex";
}

function saveEditedFiche(){
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===currentLicCode;});
  if(idx<0)return;
  var f=lics[idx].fiche;
  f.prenom=document.getElementById("ef-prenom").value.trim();
  f.nom=document.getElementById("ef-nom").value.trim();
  f.naissance=document.getElementById("ef-naissance").value;
  f.adresse=document.getElementById("ef-adresse").value.trim();
  f.telephone=document.getElementById("ef-telephone").value.trim();
  f.emailLic=document.getElementById("ef-emailLic").value.trim();
  f.respNom=document.getElementById("ef-respNom").value.trim();
  f.respTel=document.getElementById("ef-respTel").value.trim();
  f.respEmail=document.getElementById("ef-respEmail").value.trim();
  f.urgenceNom=document.getElementById("ef-urgenceNom").value.trim();
  f.urgenceTel=document.getElementById("ef-urgenceTel").value.trim();
  f.notes=document.getElementById("ef-notes").value.trim();
  saveLicences(lics);
  closeModal("modal-edit-fiche");
  renderLicenceDetail(lics[idx]);
  buildLicences();
  alert("Fiche mise a jour !");
}

function copyCode(code){
  if(navigator.clipboard){navigator.clipboard.writeText(code).then(function(){alert("Code copie : "+code);});}
  else{var t=document.createElement("textarea");t.value=code;document.body.appendChild(t);t.select();document.execCommand("copy");document.body.removeChild(t);alert("Code copie : "+code);}
}

// ── CÔTÉ LICENCIÉ : FICHE PUBLIQUE ───────────────────────────────
var licCurrentCode=null;
var licCurrentType=null;

function buildInscriptionPublic(){
  var el=document.getElementById("insc-public-content");if(!el)return;
  // Vérifier si code déjà renseigné
  licCurrentCode=null;
  el.innerHTML=renderCodeEntry();
}

function renderCodeEntry(){
  return '<div style="padding:24px 20px">'+
    '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:24px;box-shadow:0 4px 20px var(--shadow);text-align:center">'+
      '<div style="font-size:40px;margin-bottom:12px"></div>'+
      '<div style="font-size:16px;font-weight:800;color:var(--txt);margin-bottom:6px">Fiche d\'inscription</div>'+
      '<div style="font-size:12px;color:var(--mut);margin-bottom:20px">Entrez le code reçu par mail</div>'+
      '<input id="code-input" type="text" placeholder="ASMB-XXXX-XXXX" maxlength="14" style="width:100%;padding:14px;border-radius:var(--rx);border:2px solid var(--bdr);background:var(--bg);color:var(--txt);font-size:16px;font-family:monospace;letter-spacing:2px;text-align:center;outline:none;margin-bottom:12px" oninput="formatCodeInput(this)">'+
      '<button id="valider-code-btn" onclick="validerCode()" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer">Acceder a ma fiche</button>'+
    '</div>'+
  '</div>';
}

function formatCodeInput(el){
  var v=el.value.replace(/[^A-Z0-9]/gi,"").toUpperCase();
  var parts=[];
  if(v.length>0)parts.push(v.slice(0,4));
  if(v.length>4)parts.push(v.slice(4,8));
  if(v.length>8)parts.push(v.slice(8,12));
  el.value=parts.join("-");
}
async function validerCode(){
  var code=document.getElementById("code-input").value.trim().toUpperCase();
  if(!code){alert("Entrez votre code");return;}
  var btn=document.getElementById("valider-code-btn");
  if(btn){btn.disabled=true;btn.textContent="Vérification...";}
  var res=await lookupInscriptionCode(code);
  if(btn){btn.disabled=false;btn.textContent="Acceder a ma fiche";}
  if(!res.found){alert("Code invalide. Vérifiez votre mail.");return;}
  // Visiteur public (non connecté) : la fiche sera déposée dans le club du code.
  if(!window.CURRENT_CLUB_ID){
    if(!res.clubId){alert("Ce code n'est rattaché à aucun club. Contactez le club.");return;}
    window.CURRENT_CLUB_ID=res.clubId;
  }
  licCurrentCode=code;

  if(res.local){
    // Appareil du staff : on peut marquer l'ouverture et ecrire dans les licences
    var lics=getLicences();
    var idx=lics.findIndex(function(l){return l.code===code;});
    if(idx>=0 && !lics[idx].ouvertLe && isStaffUser()){
      var now=new Date();
      lics[idx].ouvertLe=now.toLocaleDateString("fr-FR")+" a "+now.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
      lics[idx].statut="ouverte";
      saveLicences(lics);
      buildLicences();
    }
    if(lics[idx] && lics[idx].typeLicence){ renderFicheForm(lics[idx]); }
    else { renderLicenceChoice(lics[idx]||{code:code}); }
    return;
  }

  // Appareil public (lien recu par mail) : aucune ecriture, on part d'une fiche vierge
  var stub={code:code, typeLicence:res.typeLicence||null, fiche:null};
  if(stub.typeLicence){ renderFicheForm(stub); }
  else { renderLicenceChoice(stub); }
}

function renderLicenceChoice(lic){
  var el=document.getElementById("insc-public-content");if(!el)return;
  var backBtn=document.createElement("div");
  backBtn.style.cssText="padding:16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px";
  backBtn.innerHTML='<button onclick="buildInscriptionPublic()" style="width:30px;height:30px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">←</button><div><div style="font-size:14px;font-weight:800;color:var(--txt)">Choix de licence</div><div style="font-size:10px;color:var(--mut)">'+lic.code+'</div></div>';
  el.innerHTML="";
  el.appendChild(backBtn);

  var wrap=document.createElement("div");
  wrap.style.cssText="padding:20px 16px";
  wrap.innerHTML='<div style="font-size:13px;color:var(--mut);text-align:center;margin-bottom:20px">Quel type de pratique vous correspond ?</div>';

  // Card Competition
  var cardComp=document.createElement("div");
  cardComp.style.cssText="cursor:pointer;margin-bottom:14px;background:linear-gradient(135deg,#1a0a0a,#2d0f0f);border:2px solid #C0392B;border-radius:var(--r);padding:20px;position:relative;overflow:hidden";
  cardComp.dataset.type="competition";
  cardComp.onclick=function(){choisirLicence(this.dataset.type);};
  cardComp.innerHTML=
    '<div style="position:absolute;top:12px;right:14px;font-size:28px;opacity:.15"></div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="background:#C0392B;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px">Compétition</div><div style="font-size:18px"></div></div>'+
    '<div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:8px">Pour se dépasser</div>'+
    '<div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:12px">Rejoindre l\'ASMB en compétition : un engagement collectif ambitieux.</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px">'+
      '<div style="font-size:11px;color:rgba(255,100,100,.9)"> Entraînements réguliers obligatoires</div>'+
      '<div style="font-size:11px;color:rgba(255,100,100,.9)"> Matchs officiels CD42 · Engagement saison complète</div>'+
      '<div style="font-size:11px;color:rgba(255,100,100,.9)"> Convocations obligatoires · Collectif avant tout</div>'+
      '<div style="font-size:11px;color:rgba(255,100,100,.9)"> Exigence · Respect · Depassement de soi</div>'+
    '</div>'+
    '<div style="margin-top:14px;padding:10px 14px;background:rgba(192,57,43,.2);border-radius:var(--rx);border-left:3px solid #C0392B"><div style="font-size:11px;font-style:italic;color:rgba(255,255,255,.8)">"Representer l\'ASMB, c\'est porter les couleurs du club avec fierté et engagement."</div></div>'+
    '<div style="margin-top:12px;text-align:right"><span style="font-size:12px;font-weight:700;color:#C0392B">Je choisis Compétition →</span></div>';

  // Card Loisir
  var cardLoisir=document.createElement("div");
  cardLoisir.style.cssText="cursor:pointer;background:linear-gradient(135deg,#0a1220,#142a4d);border:2px solid #D4AF37;border-radius:var(--r);padding:20px;position:relative;overflow:hidden";
  cardLoisir.dataset.type="loisir";
  cardLoisir.onclick=function(){choisirLicence(this.dataset.type);};
  cardLoisir.innerHTML=
    '<div style="position:absolute;top:12px;right:14px;font-size:28px;opacity:.15"></div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="background:#D4AF37;color:#fff;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:1px">Loisir</div><div style="font-size:18px"></div></div>'+
    '<div style="font-size:15px;font-weight:900;color:#fff;margin-bottom:8px">Pour le plaisir du jeu</div>'+
    '<div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.6;margin-bottom:12px">Joue, progresse et partage de bons moments sans pression. Accessible a tous.</div>'+
    '<div style="display:flex;flex-direction:column;gap:6px">'+
      '<div style="font-size:11px;color:rgba(80,200,120,.9)">✓ Viens quand tu peux, a ton rythme</div>'+
      '<div style="font-size:11px;color:rgba(80,200,120,.9)">✓ Aucune obligation de match ou compétition</div>'+
      '<div style="font-size:11px;color:rgba(80,200,120,.9)">✓ Progresser dans la bonne humeur</div>'+
      '<div style="font-size:11px;color:rgba(80,200,120,.9)">✓ Ouvert a tous les niveaux · Debutants bienvenus</div>'+
    '</div>'+
    '<div style="margin-top:14px;padding:10px 14px;background:rgba(212,175,55,.15);border-radius:var(--rx);border-left:3px solid #D4AF37"><div style="font-size:11px;font-style:italic;color:rgba(255,255,255,.8)">"Le basket pour se faire plaisir, bouger, rencontrer des gens et partager une passion."</div></div>'+
    '<div style="margin-top:12px;text-align:right"><span style="font-size:12px;font-weight:700;color:#D4AF37">Je choisis Loisir →</span></div>';

  wrap.appendChild(cardComp);
  wrap.appendChild(cardLoisir);
  el.appendChild(wrap);
}

function choisirLicence(type){
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===licCurrentCode;});
  if(idx>=0){
    lics[idx].typeLicence=type;
    if(isStaffUser()){ saveLicences(lics); buildLicences(); }
    renderFicheForm(lics[idx]);
    return;
  }
  // Appareil public : pas de licence en local, on garde le choix en memoire seulement
  renderFicheForm({code:licCurrentCode, typeLicence:type, fiche:null});
}

function renderFicheForm(lic){
  var el=document.getElementById("insc-public-content");if(!el)return;
  licCurrentType=(lic&&lic.typeLicence)||null;
  var f=lic.fiche||{};
  ficheSurclassement=(f.surclassement===true);
  el.innerHTML=
    '<div style="padding:16px;border-bottom:1px solid var(--bdr);display:flex;align-items:center;gap:10px">'+
      '<button onclick="renderLicenceChoice(getLicences().find(function(l){return l.code===licCurrentCode;})||{code:licCurrentCode})" style="width:30px;height:30px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">←</button>'+
      '<div style="flex:1"><div style="font-size:14px;font-weight:800;color:var(--txt)">Ma fiche</div><div style="font-size:10px;color:var(--mut)">'+lic.code+'</div></div>'+
      (lic.typeLicence?'<div style="font-size:10px;font-weight:700;padding:4px 10px;border-radius:20px;color:#fff;background:'+(lic.typeLicence==="competition"?"#C0392B":"#D4AF37")+'">'+( lic.typeLicence==="competition"?"Compétition":"Loisir")+'</div>':'')+
    '</div>'+
    '<div style="padding:16px;padding-bottom:80px">'+
      // Photo
      '<div style="text-align:center;margin-bottom:20px">'+
        '<div id="photo-preview" style="width:90px;height:90px;border-radius:50%;background:var(--bdr);margin:0 auto 10px;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:32px">'+(f.photo?'<img src="'+f.photo+'" style="width:100%;height:100%;object-fit:cover">':'')+'</div>'+
        '<button onclick="document.getElementById(\'photo-input\').click()" style="padding:8px 18px;border-radius:20px;background:var(--dkg);color:#fff;font-size:12px;font-weight:600;border:none;cursor:pointer"> Ajouter une photo</button>'+
        '<input type="file" id="photo-input" accept="image/*" capture="user" style="display:none" onchange="handlePhoto(this)">'+
      '</div>'+
      // Genre
      '<div class="form-group"><label class="form-label">Genre *</label>'+
        '<div style="display:flex;gap:10px">'+
          '<button id="btn-M" onclick="selectGenre(\'M\')" style="flex:1;padding:11px;border-radius:var(--rx);font-size:13px;font-weight:700;border:2px solid '+(f.genre==="M"?"var(--dkg)":"var(--bdr)")+';background:'+(f.genre==="M"?"var(--dkg)":"var(--bg)")+';color:'+(f.genre==="M"?"#fff":"var(--mut)")+';cursor:pointer">Masculin</button>'+
          '<button id="btn-F" onclick="selectGenre(\'F\')" style="flex:1;padding:11px;border-radius:var(--rx);font-size:13px;font-weight:700;border:2px solid '+(f.genre==="F"?"var(--dkg)":"var(--bdr)")+';background:'+(f.genre==="F"?"var(--dkg)":"var(--bg)")+';color:'+(f.genre==="F"?"#fff":"var(--mut)")+';cursor:pointer">Féminin</button>'+
        '</div>'+
      '</div>'+
      '<div class="form-group"><label class="form-label">Prénom *</label><input class="form-input" id="f-prenom" value="'+(f.prenom||'')+'" placeholder="Prénom"></div>'+
      '<div class="form-group"><label class="form-label">Nom *</label><input class="form-input" id="f-nom" value="'+(f.nom||'')+'" placeholder="Nom de famille"></div>'+
      '<div class="form-group"><label class="form-label">Date de naissance *</label><input class="form-input" id="f-naissance" type="date" value="'+(f.naissance||'')+'"></div>'+
      '<div class="form-group"><label class="form-label">Ne(e) a l\'etranger ?</label>'+
        '<div style="display:flex;gap:10px">'+
          '<button type="button" id="btn-etr-non" onclick="selectEtranger(false)" style="flex:1;padding:10px;border-radius:var(--rx);font-size:13px;font-weight:700;border:2px solid '+(f.neEtranger?"var(--bdr)":"var(--dkg)")+';background:'+(f.neEtranger?"var(--bg)":"var(--dkg)")+';color:'+(f.neEtranger?"var(--mut)":"#fff")+';cursor:pointer">Non</button>'+
          '<button type="button" id="btn-etr-oui" onclick="selectEtranger(true)" style="flex:1;padding:10px;border-radius:var(--rx);font-size:13px;font-weight:700;border:2px solid '+(f.neEtranger?"var(--dkg)":"var(--bdr)")+';background:'+(f.neEtranger?"var(--dkg)":"var(--bg)")+';color:'+(f.neEtranger?"#fff":"var(--mut)")+';cursor:pointer">Oui</button>'+
        '</div>'+
      '</div>'+
      '<div id="etranger-fields" style="'+(f.neEtranger?"":"display:none")+'">'+
        '<div class="form-group"><label class="form-label">Ville de naissance</label><input class="form-input" id="f-villeNaiss" value="'+(f.villeNaiss||'')+'" placeholder="Ville"></div>'+
        '<div class="form-group"><label class="form-label">Pays de naissance</label><input class="form-input" id="f-paysNaiss" value="'+(f.paysNaiss||'')+'" placeholder="Pays"></div>'+
      '</div>'+
      '<div class="form-group"><label class="form-label">Adresse complète</label><textarea class="form-input" id="f-adresse" rows="2" placeholder="Adresse, code postal, ville">'+(f.adresse||'')+'</textarea></div>'+
      '<div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="f-telephone" type="tel" value="'+(f.telephone||'')+'" placeholder="06..."></div>'+
      '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-emailLic" type="email" value="'+(f.emailLic||lic.email||'')+'" placeholder="email@..."></div>'+
      '<div style="background:var(--bdr);height:1px;margin:16px 0"></div>'+
      '<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Responsable legal</div>'+
      '<div class="form-group"><label class="form-label">Nom du responsable</label><input class="form-input" id="f-respNom" value="'+(f.respNom||'')+'" placeholder="Prénom Nom"></div>'+
      '<div class="form-group"><label class="form-label">Lien de parente</label><input class="form-input" id="f-respLien" value="'+(f.respLien||'')+'" placeholder="Pere, Mere, Tuteur..."></div>'+
      '<div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="f-respTel" type="tel" value="'+(f.respTel||'')+'" placeholder="06..."></div>'+
      '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-respEmail" type="email" value="'+(f.respEmail||'')+'" placeholder="email@..."></div>'+
      '<div style="margin:4px 0 16px" id="resp2-toggle-wrap">'+
        (f.resp2Nom ?
          '<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Responsable legal 2</div>'+
          '<div class="form-group"><label class="form-label">Nom</label><input class="form-input" id="f-resp2Nom" value="'+(f.resp2Nom||'')+'" placeholder="Prénom Nom"></div>'+
          '<div class="form-group"><label class="form-label">Lien de parente</label><input class="form-input" id="f-resp2Lien" value="'+(f.resp2Lien||'')+'" placeholder="Pere, Mere, Tuteur..."></div>'+
          '<div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="f-resp2Tel" type="tel" value="'+(f.resp2Tel||'')+'" placeholder="06..."></div>'+
          '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-resp2Email" type="email" value="'+(f.resp2Email||'')+'" placeholder="email@..."></div>'+
          '<button type="button" onclick="removeResp2()" style="padding:6px 14px;border-radius:20px;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:600;border:none;cursor:pointer;margin-bottom:8px">✕ Supprimer le 2ème responsable</button>'
        :
          '<button type="button" onclick="addResp2()" style="padding:8px 16px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:12px;font-weight:600;border:1.5px dashed var(--bdr);cursor:pointer;display:flex;align-items:center;gap:6px"><span style="font-size:16px">+</span> Ajouter un 2ème responsable légal</button>'
        )+'</div>'+
      '<div style="background:var(--bdr);height:1px;margin:16px 0"></div>'+
      '<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Contact en cas d\'urgence</div>'+
      '<div class="form-group"><label class="form-label">Nom du contact</label><input class="form-input" id="f-urgenceNom" value="'+(f.urgenceNom||'')+'" placeholder="Prénom Nom"></div>'+
      '<div class="form-group"><label class="form-label">Téléphone urgence</label><input class="form-input" id="f-urgenceTel" type="tel" value="'+(f.urgenceTel||'')+'" placeholder="06..."></div>'+
      '<div class="form-group"><label class="form-label">Notes / Informations medicales</label><textarea class="form-input" id="f-notes" rows="3" placeholder="Allergies, traitements, remarques...">'+(f.notes||'')+'</textarea></div>'+
      '<div style="background:var(--bdr);height:1px;margin:16px 0"></div>'+
      '<div class="form-group" style="background:rgba(232,103,10,.06);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:12px 14px">'+
        '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer">'+
          '<input type="checkbox" id="f-surclassement" onchange="toggleSurclassement(this.checked)" '+(f.surclassement?"checked":"")+' style="width:20px;height:20px;margin-top:1px;accent-color:#E8670A;flex-shrink:0">'+
          '<span><span style="font-size:13px;font-weight:700;color:var(--txt)">Surclassement</span><br>'+
          '<span style="font-size:11px;color:var(--txt2);line-height:1.4">Le joueur évolue dans une catégorie d\'âge supérieure à la sienne. Un certificat médical devient alors obligatoire pour valider la fiche.</span></span>'+
        '</label>'+
      '</div>'+
      '<div style="background:var(--bdr);height:1px;margin:16px 0"></div>'+
      '<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">Certificat medical</div>'+
      '<div id="cert-banner" style="background:rgba(212,175,55,.08);border:1px solid rgba(212,175,55,.25);border-radius:var(--rs);padding:12px 14px;margin-bottom:14px">'+
        '<div style="font-size:11px;color:var(--txt2);line-height:1.5">Un certificat medical de non contre-indication a la pratique sportive est obligatoire pour valider votre licence. Il doit dater de moins d&#39;un an.</div>'+
      '</div>'+
      '<div class="form-group">'+
        '<label class="form-label">Telecharger le certificat (PDF ou photo)</label>'+
        '<div id="cert-preview" style="margin-bottom:8px"></div>'+
        '<button type="button" id="cert-btn" style="width:100%;padding:12px;border-radius:var(--rx);background:var(--card);border:1.5px dashed var(--bdr);color:var(--mut);font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"><span style="font-size:18px"></span> Ajouter le certificat</button>'+
        '<input type="file" id="cert-input" accept="image/*,application/pdf" style="display:none" onchange="handleCertificat(this)">'+
      '</div>'+
      '<div class="form-group">'+
        '<label class="form-label">Date du certificat</label>'+
        '<input class="form-input" id="f-certDate" type="date" value="'+(f.certDate||'')+'">'+
      '</div>'+
      '<div class="form-group">'+
        '<label class="form-label">Medecin / Établissement</label>'+
        '<input class="form-input" id="f-certMedecin" value="'+(f.certMedecin||'')+'" placeholder="Dr ...">'+
      '</div>'+
      '<button id="fiche-submit-btn" onclick="soumettreFiche()" style="width:100%;padding:14px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:8px"> Valider ma fiche</button>'+
    '</div>';

  // Bind cert button
  setTimeout(function(){
    var btn=document.getElementById("cert-btn");
    if(btn)btn.onclick=function(){var inp=document.getElementById("cert-input");if(inp)inp.click();};
    updateCertBanner();
  },50);
  // Mise a jour statut en cours si fiche déjà partiellement remplie
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===licCurrentCode;});
  if(idx>=0&&lics[idx].statut==="ouverte"){lics[idx].statut="en_cours";saveLicences(lics);buildLicences();}
}

var ficheGenre="";
var ficheNeEtranger=false;
var ficheSurclassement=false;
var fichePhoto="";
var ficheCertificat="";

function toggleSurclassement(val){
  ficheSurclassement=val;
  updateCertBanner();
}
function updateCertBanner(){
  var box=document.getElementById("cert-banner");
  if(!box)return;
  if(ficheSurclassement){
    box.style.background="rgba(192,57,43,.08)";
    box.style.borderColor="rgba(192,57,43,.3)";
    box.innerHTML='<div style="font-size:11px;color:var(--red);line-height:1.5;font-weight:700">Surclassement coché : le certificat médical est obligatoire pour valider la fiche.</div>';
  } else {
    box.style.background="rgba(212,175,55,.08)";
    box.style.borderColor="rgba(212,175,55,.25)";
    box.innerHTML='<div style="font-size:11px;color:var(--txt2);line-height:1.5">Un certificat medical de non contre-indication a la pratique sportive est obligatoire pour valider votre licence. Il doit dater de moins d&#39;un an.</div>';
  }
}


function addResp2(){
  var wrap=document.getElementById("resp2-toggle-wrap");
  if(!wrap)return;
  wrap.innerHTML=
    '<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Responsable legal 2</div>'+
    '<div class="form-group"><label class="form-label">Nom</label><input class="form-input" id="f-resp2Nom" placeholder="Prénom Nom"></div>'+
    '<div class="form-group"><label class="form-label">Lien de parente</label><input class="form-input" id="f-resp2Lien" placeholder="Pere, Mere, Tuteur..."></div>'+
    '<div class="form-group"><label class="form-label">Téléphone</label><input class="form-input" id="f-resp2Tel" type="tel" placeholder="06..."></div>'+
    '<div class="form-group"><label class="form-label">Email</label><input class="form-input" id="f-resp2Email" type="email" placeholder="email@..."></div>'+
    '<button type="button" onclick="removeResp2()" style="padding:6px 14px;border-radius:20px;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:600;border:none;cursor:pointer;margin-bottom:8px">✕ Supprimer le 2ème responsable</button>';
}
function removeResp2(){
  var wrap=document.getElementById("resp2-toggle-wrap");
  if(!wrap)return;
  wrap.innerHTML='<button type="button" onclick="addResp2()" style="padding:8px 16px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:12px;font-weight:600;border:1.5px dashed var(--bdr);cursor:pointer;display:flex;align-items:center;gap:6px"><span style="font-size:16px">+</span> Ajouter un 2ème responsable légal</button>';
}

function selectEtranger(val){
  ficheNeEtranger=val;
  var nonBtn=document.getElementById("btn-etr-non"),ouiBtn=document.getElementById("btn-etr-oui");
  var fields=document.getElementById("etranger-fields");
  if(nonBtn&&ouiBtn){
    nonBtn.style.background=val?"var(--bg)":"var(--dkg)";nonBtn.style.color=val?"var(--mut)":"#fff";nonBtn.style.borderColor=val?"var(--bdr)":"var(--dkg)";
    ouiBtn.style.background=val?"var(--dkg)":"var(--bg)";ouiBtn.style.color=val?"#fff":"var(--mut)";ouiBtn.style.borderColor=val?"var(--dkg)":"var(--bdr)";
  }
  if(fields)fields.style.display=val?"block":"none";
}
function selectGenre(g){
  ficheGenre=g;
  var m=document.getElementById("btn-M"),f=document.getElementById("btn-F");
  if(m&&f){
    m.style.background=g==="M"?"var(--dkg)":"var(--bg)";m.style.color=g==="M"?"#fff":"var(--mut)";m.style.borderColor=g==="M"?"var(--dkg)":"var(--bdr)";
    f.style.background=g==="F"?"var(--dkg)":"var(--bg)";f.style.color=g==="F"?"#fff":"var(--mut)";f.style.borderColor=g==="F"?"var(--dkg)":"var(--bdr)";
  }
}

function handlePhoto(input){
  if(!input.files||!input.files[0])return;
  var reader=new FileReader();
  reader.onload=function(e){
    fichePhoto=e.target.result;
    var prev=document.getElementById("photo-preview");
    if(prev)prev.innerHTML='<img src="'+fichePhoto+'" style="width:100%;height:100%;object-fit:cover">';
  };
  reader.readAsDataURL(input.files[0]);
}

function handleCertificat(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var isPdf=file.type==="application/pdf";
  var reader=new FileReader();
  reader.onload=function(e){
    ficheCertificat=e.target.result;
    var prev=document.getElementById("cert-preview");
    if(!prev)return;
    if(isPdf){
      prev.innerHTML='<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rx)"><span style="font-size:20px"></span><div style="flex:1;min-width:0"><div style="font-size:12px;font-weight:700;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+file.name+'</div><div style="font-size:10px;color:var(--mut)">PDF · '+(file.size/1024).toFixed(0)+'Ko</div></div><button onclick="removeCertificat()" style="padding:4px 8px;border-radius:6px;background:rgba(192,57,43,.1);color:var(--red);font-size:10px;border:none;cursor:pointer">✕</button></div>';
    } else {
      prev.innerHTML='<div style="position:relative;display:inline-block"><img src="'+e.target.result+'" style="width:100%;max-height:120px;object-fit:cover;border-radius:var(--rx);display:block"><button onclick="removeCertificat()" style="position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:12px;border:none;cursor:pointer">✕</button></div>';
    }
  };
  reader.readAsDataURL(file);
}
function removeCertificat(){
  ficheCertificat="";
  var prev=document.getElementById("cert-preview");
  if(prev)prev.innerHTML="";
  var inp=document.getElementById("cert-input");
  if(inp)inp.value="";
}
function soumettreFiche(){
  var prenom=(document.getElementById("f-prenom")||{}).value||"";
  var nom=(document.getElementById("f-nom")||{}).value||"";
  var naissance=(document.getElementById("f-naissance")||{}).value||"";
  if(!prenom||!nom||!naissance){alert("Prénom, nom et date de naissance sont obligatoires");return;}
  if(!ficheGenre){alert("Sélectionnez votre genre");return;}
  if(ficheSurclassement){
    var certDateVal=(document.getElementById("f-certDate")||{}).value||"";
    if(!ficheCertificat || !certDateVal){
      alert("Surclassement coché : le certificat médical (fichier + date) est obligatoire pour valider la fiche.");
      return;
    }
  }
  var fiche={
    genre:ficheGenre,prenom:prenom.trim(),nom:nom.trim(),
    naissance:naissance,
    neEtranger:ficheNeEtranger,
    surclassement:ficheSurclassement,
    villeNaiss:ficheNeEtranger?((document.getElementById("f-villeNaiss")||{}).value||""):"",
    paysNaiss:ficheNeEtranger?((document.getElementById("f-paysNaiss")||{}).value||""):"",
    adresse:(document.getElementById("f-adresse")||{}).value||"",
    telephone:(document.getElementById("f-telephone")||{}).value||"",
    emailLic:(document.getElementById("f-emailLic")||{}).value||"",
    respNom:(document.getElementById("f-respNom")||{}).value||"",
    respLien:(document.getElementById("f-respLien")||{}).value||"",
    respTel:(document.getElementById("f-respTel")||{}).value||"",
    respEmail:(document.getElementById("f-respEmail")||{}).value||"",
    resp2Nom:(document.getElementById("f-resp2Nom")||{}).value||"",
    resp2Lien:(document.getElementById("f-resp2Lien")||{}).value||"",
    resp2Tel:(document.getElementById("f-resp2Tel")||{}).value||"",
    resp2Email:(document.getElementById("f-resp2Email")||{}).value||"",
    urgenceNom:(document.getElementById("f-urgenceNom")||{}).value||"",
    urgenceTel:(document.getElementById("f-urgenceTel")||{}).value||"",
    notes:(document.getElementById("f-notes")||{}).value||"",
    certDate:(document.getElementById("f-certDate")||{}).value||"",
    certMedecin:(document.getElementById("f-certMedecin")||{}).value||"",
    certificat:ficheCertificat||null,
    photo:fichePhoto||null,
    soumisLe:new Date().toLocaleDateString("fr-FR")+" a "+new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),
  };
  var lics=getLicences();
  var idx=lics.findIndex(function(l){return l.code===licCurrentCode;});

  function showSuccess(){
    var el=document.getElementById("insc-public-content");
    if(el)el.innerHTML='<div style="padding:40px 20px;text-align:center"><div style="font-size:56px;margin-bottom:16px">✅</div><div style="font-size:18px;font-weight:800;color:var(--txt);margin-bottom:8px">Fiche envoyée !</div><div style="font-size:13px;color:var(--mut);margin-bottom:6px">Votre fiche a bien été transmise au club.</div><div style="font-size:12px;color:var(--mut);line-height:1.5;max-width:280px;margin:0 auto">Un responsable va la valider. Vous pourrez ensuite créer votre compte dans l\'application avec votre numéro de téléphone.</div></div>';
  }

  if(idx>=0 && isStaffUser()){
    // Saisie depuis un appareil du staff : ecriture directe dans la licence
    lics[idx].fiche=fiche;lics[idx].statut="recue";
    saveLicences(lics);buildLicences();
    showSuccess();
    setTimeout(function(){
      localStorage.removeItem("asmb_profile");
      stack=["role-select"];
      showScr("role-select");
      injectRoleLogo();
    },1800);
    return;
  }

  // Appareil public : depot dans une collection dediee, en creation seule.
  // Le visiteur ne peut ni relire, ni lister, ni modifier quoi que ce soit.
  if(!window.fbDb||!window.fbAddDoc){alert("Connexion en cours, réessayez dans quelques secondes.");return;}
  var btn=document.getElementById("fiche-submit-btn");
  if(btn){btn.disabled=true;btn.textContent="Envoi...";}
  window.fbAddDoc(window.fbCollection(window.fbDb,"inscription_submissions"),{
    code:licCurrentCode,
    typeLicence:(document.getElementById("f-type")||{}).value||licCurrentType||null,
    fiche:fiche,
    status:"nouvelle",
    ts:window.fbServerTimestamp()
  }).then(function(){
    showSuccess();
  }).catch(function(e){
    if(btn){btn.disabled=false;btn.textContent="Envoyer ma fiche";}
    alert("Erreur lors de l'envoi : "+((e&&e.code)||e)+"\nRéessayez ou contactez le club.");
  });
}


