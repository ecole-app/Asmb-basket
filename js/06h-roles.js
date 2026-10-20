// ═══ RÔLE D'UNE FICHE LICENCE + SUPPRESSION ═════════════════════════
// lic.role : "joueur" (défaut) | "coach" | "autre". Coach/autre : licence conservée mais
// jamais ajoutée aux joueurs/trombinoscope, ni comptée dans la limite du pack.
// licEstJoueur() est dans js/11-admin.js.
var LIC_ROLES={joueur:"Joueur",coach:"Coach",benevole:"Bénévole",autre:"Autre (bureau, arbitre…)"};
function licRoleHtml(lic){
  var r=lic.role||"joueur";
  var opts=Object.keys(LIC_ROLES).map(function(k){return '<option value="'+k+'"'+(r===k?" selected":"")+'>'+LIC_ROLES[k]+'</option>';}).join("");
  return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<div style="font-size:12px;font-weight:700;color:var(--txt)">Cette personne est</div>'+
    '<select class="form-select" style="flex:1;min-width:140px" onchange="licChangerRole(\''+lic.code+'\',this.value)">'+opts+'</select>'+
    '<button onclick="licSupprimer(\''+lic.code+'\')" style="padding:9px 12px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:700;border:none;cursor:pointer">Supprimer la fiche</button>'+
    (typeof licEquipeHtml==="function"?licEquipeHtml(lic):'')+'</div>'+licPecHtml(lic);
}
function licChangerRole(code, role){
  var lics=getLicences(), lic=lics.find(function(l){return l.code===code;});
  if(!lic||!LIC_ROLES[role]) return;
  if(role==="joueur") delete lic.role; else lic.role=role;
  if(role!=="joueur"){
    // retire des joueurs (trombinoscope) la personne déjà ajoutée à la validation
    var f=lic.fiche||{};
    if(f.nom&&typeof getPlayers==="function"&&typeof savePlayers==="function"){
      var norm=function(s){return String(s||"").trim().toLowerCase();};
      var pl=getPlayers(), reste=pl.filter(function(p){
        return !(norm(p.nom)===norm(f.nom)&&norm(p.prenom)===norm(f.prenom)&&(p.naissance||"")===(f.naissance||""));
      });
      if(reste.length!==pl.length) savePlayers(reste);
    }
  }
  if(role==="joueur"){ delete lic.priseEnCharge; delete lic.clubAilleurs; delete lic.numAilleurs; delete lic.coutClub; licPecLigneCompta(lic); }
  saveLicences(lics);
  if(role==="benevole") licPassBenevole(lic);
  renderLicenceDetail(lic); buildLicences();
  if(typeof buildAdminHome==="function") buildAdminHome();
  showToast(role==="joueur"?"Remis comme joueur":"Enregistré comme "+LIC_ROLES[role].split(" ")[0].toLowerCase());
}
async function licSupprimer(code){
  var lics=getLicences(), lic=lics.find(function(l){return l.code===code;});
  if(!lic) return;
  var f=lic.fiche||{}, nom=((f.prenom||"")+" "+(f.nom||"")).trim()||code;
  var avert=lic.paiement?" Un paiement est enregistré : la ligne de comptabilité liée sera aussi supprimée.":"";
  var ok=await askConfirm("Supprimer la fiche de "+nom+" ? Cette action est définitive."+avert);
  if(!ok) return;
  var refs={}; refs["Licence "+code]=true;
  (lic.aides||[]).forEach(function(a){ refs[a.comptaId]=true; });
  var compta=getComptabilite(), restes=compta.filter(function(c){return !(refs[c.reference]||refs[c.id]);});
  if(restes.length!==compta.length) saveComptabilite(restes);
  saveLicences(lics.filter(function(l){return l.code!==code;}));
  buildLicences(); if(typeof buildAdminHome==="function") buildAdminHome();
  if(typeof goBack==="function") goBack();
  showToast("Fiche supprimée");
}

// ── Équipe 1, 2, 3… d'un joueur (badge sur la fiche et à l'import) ───
// lic.equipe = numéro. Équipe auto-nommée « U11 Équipe 2 » (créée si besoin), le joueur y est
// placé à la validation de sa licence (les joueurs n'existent qu'à ce moment) ou tout de suite
// s'il est déjà validé.
var EQ_NB=4;
function licEquipePlacer(lic){
  if(!lic||!lic.fiche||!licEstJoueur(lic)||!lic.categorie) return;
  var f=lic.fiche, nn=function(s){return String(s||"").trim().toLowerCase();};
  var pl=getPlayers().find(function(p){return nn(p.nom)===nn(f.nom)&&nn(p.prenom)===nn(f.prenom)&&(p.naissance||"")===(f.naissance||"");});
  if(!pl) return;
  var teams=getTeams(), prefixe=lic.categorie+" Équipe ", nom=lic.equipe?prefixe+lic.equipe:"", change=false, cree=null;
  teams.forEach(function(t){
    if(t.cat===lic.categorie&&String(t.name).indexOf(prefixe)===0&&t.name!==nom&&(t.members||[]).indexOf(pl.id)>=0){
      t.members=t.members.filter(function(id){return id!==pl.id;}); change=true;
    }
  });
  if(nom){
    var t=teams.find(function(x){return x.name===nom;});
    if(!t){ t={id:(Date.now()+Math.floor(Math.random()*1000)).toString(),name:nom,cat:lic.categorie,members:[]}; teams.push(t); cree=t; change=true; }
    t.members=t.members||[];
    if(t.members.indexOf(pl.id)<0){ t.members.push(pl.id); change=true; }
  }
  if(change){ saveTeams(teams); if(cree&&typeof ensureTeamChannel==="function") ensureTeamChannel(cree); }
}
function licEquipeHtml(lic){
  if(!licEstJoueur(lic)) return "";
  var e=lic.equipe||0, h='<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;width:100%"><div style="font-size:12px;font-weight:700;color:var(--txt);margin-right:4px">Équipe'+(lic.categorie?' '+authEsc(lic.categorie):'')+'</div>';
  for(var n=1;n<=EQ_NB;n++){
    h+='<button onclick="licEquipeSet(\''+lic.code+'\','+(e===n?0:n)+')" style="min-width:34px;padding:7px 10px;border-radius:20px;border:1.5px solid '+(e===n?'var(--dkg)':'var(--bdr)')+';background:'+(e===n?'var(--dkg)':'var(--card)')+';color:'+(e===n?'#fff':'var(--txt)')+';font-size:12px;font-weight:700;cursor:pointer">'+n+'</button>';
  }
  return h+'<div style="font-size:10px;color:var(--mut)">'+(lic.statut==="validee"?'':'placé à la validation')+'</div></div>';
}
function licEquipeSet(code,n){
  var lics=getLicences(), lic=lics.find(function(l){return l.code===code;});
  if(!lic) return;
  if(n) lic.equipe=n; else delete lic.equipe;
  saveLicences(lics);
  if(lic.statut==="validee") licEquipePlacer(lic);
  renderLicenceDetail(lic); buildLicences();
  if(typeof buildTeams==="function") buildTeams();
}

// ── Licence prise en charge (bénévole, coach, bureau) ────────────────
// Le président décide qu'une personne ne paie pas sa licence :
//  - « club » : le club la prend en charge (coût optionnel → dépense en comptabilité) ;
//  - « ailleurs » : la personne est déjà licenciée dans un autre club (club + n° de licence).
// Aucun reste à payer n'est suivi, aucune relance. Jamais pour un joueur (sa licence reste payante).
var LIC_PEC={club:"Offerte par le club",ailleurs:"Licencié dans un autre club"};
function licPecLibelle(lic){
  if(!lic||!lic.priseEnCharge||!LIC_PEC[lic.priseEnCharge]) return "";
  if(lic.priseEnCharge==="ailleurs") return "Licencié ailleurs"+(lic.clubAilleurs?" ("+lic.clubAilleurs+")":"");
  return "Licence offerte";
}
// Ligne de dépense du coût pris en charge (une seule par licence, remplacée à chaque modif).
function licPecLigne(lic){
  if(!lic||lic.priseEnCharge!=="club"||!(Number(lic.coutClub)>0)) return null;
  var f=lic.fiche||{}, nom=((f.prenom||"")+" "+(f.nom||"")).trim()||lic.code;
  var l={id:"pec_"+lic.code, date:new Date().toISOString().slice(0,10), montant:Math.round(Number(lic.coutClub)*100)/100, type:"depense",
    categorie:"Affiliation/Licences fédérales", motif:"Licence offerte — "+nom+(lic.role&&LIC_ROLES[lic.role]?" ("+LIC_ROLES[lic.role].split(" ")[0].toLowerCase()+")":""),
    tiers:"Fédération", moyen:"Virement", compte:"Banque", reference:"Licence offerte "+lic.code, pointe:false, justificatif:null};
  if(typeof hasPremium==="function"&&!hasPremium()) l.horsPremium=true;
  return l;
}
function licPecLigneCompta(lic){
  if(typeof getComptabilite!=="function") return;
  var c=getComptabilite(), id="pec_"+lic.code, i=c.findIndex(function(x){return x.id===id;}), l=licPecLigne(lic);
  var ancienne=i>=0?c[i]:null;
  if(l&&ancienne){ l.date=ancienne.date; l.pointe=ancienne.pointe; if(ancienne.montant===l.montant&&ancienne.motif===l.motif) return; c[i]=Object.assign({},ancienne,l); }
  else if(l) c.push(l);
  else if(i>=0) c.splice(i,1);
  else return;
  saveComptabilite(c);
}
function licPecHtml(lic){
  if(licEstJoueur(lic)) return "";
  var v=lic.priseEnCharge||"";
  function chip(k,txt){
    var on=v===k;
    return '<button type="button" onclick="licPecSet(\''+lic.code+'\',\''+k+'\')" style="padding:7px 12px;border-radius:20px;border:1.5px solid '+(on?'var(--dkg)':'var(--bdr)')+';background:'+(on?'var(--dkg)':'var(--card)')+';color:'+(on?'#fff':'var(--txt)')+';font-size:11.5px;font-weight:700;cursor:pointer">'+txt+'</button>';
  }
  var h='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:12px">'+
    '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:8px">Sa licence</div>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap">'+chip("","Payée par la personne")+chip("club",LIC_PEC.club)+chip("ailleurs",LIC_PEC.ailleurs)+'</div>';
  if(v==="club"){
    h+='<div style="font-size:11px;color:var(--mut);margin:10px 0 6px">Aucun paiement demandé. Coût de la licence pour le club (facultatif) : il est ajouté en dépense dans la comptabilité.</div>'+
      '<div style="display:flex;gap:8px"><input class="form-input" id="lic-pec-cout" type="number" step="0.01" min="0" placeholder="Coût (€)" value="'+(lic.coutClub!=null?authEsc(String(lic.coutClub)):"")+'" style="flex:1">'+
      '<button type="button" onclick="licPecCout(\''+lic.code+'\')" style="padding:0 14px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer">Enregistrer</button></div>';
  } else if(v==="ailleurs"){
    h+='<div style="font-size:11px;color:var(--mut);margin:10px 0 6px">Aucun paiement demandé. La personne garde son accès au club (coach, bénévole, bureau).</div>'+
      '<input class="form-input" id="lic-pec-club" placeholder="Club où il est licencié" value="'+authEsc(lic.clubAilleurs||"")+'" style="margin-bottom:6px">'+
      '<div style="display:flex;gap:8px"><input class="form-input" id="lic-pec-num" placeholder="N° de licence (facultatif)" value="'+authEsc(lic.numAilleurs||"")+'" style="flex:1">'+
      '<button type="button" onclick="licPecAilleurs(\''+lic.code+'\')" style="padding:0 14px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer">Enregistrer</button></div>';
  }
  return h+'</div>';
}
function licPecTrouver(code){ var lics=getLicences(); return {lics:lics,lic:lics.find(function(l){return l.code===code;})}; }
function licPecSet(code,k){
  var x=licPecTrouver(code), lic=x.lic; if(!lic||licEstJoueur(lic)) return;
  if(k&&LIC_PEC[k]){
    lic.priseEnCharge=k;
    // plus rien à suivre : on retire le reste à payer et les relances
    delete lic.montantAttendu; delete lic.attenduDepuis;
    if(lic.suspendue) lic.suspendue=false;
  } else delete lic.priseEnCharge;
  if(k!=="club") delete lic.coutClub;
  if(k!=="ailleurs"){ delete lic.clubAilleurs; delete lic.numAilleurs; }
  saveLicences(x.lics); licPecLigneCompta(lic);
  renderLicenceDetail(lic); buildLicences();
  showToast(k?LIC_PEC[k]:"Licence payée par la personne");
}
function licPecCout(code){
  var x=licPecTrouver(code), lic=x.lic; if(!lic) return;
  var el=document.getElementById("lic-pec-cout"), v=el&&el.value!==""?parseFloat(String(el.value).replace(",",".")):null;
  if(v!=null&&(isNaN(v)||v<0)){ askAlert("Montant invalide"); return; }
  if(v) lic.coutClub=v; else delete lic.coutClub;
  saveLicences(x.lics); licPecLigneCompta(lic);
  renderLicenceDetail(lic);
  showToast(v?"Coût ajouté en dépense":"Enregistré");
}
function licPecAilleurs(code){
  var x=licPecTrouver(code), lic=x.lic; if(!lic) return;
  var c=document.getElementById("lic-pec-club"), n=document.getElementById("lic-pec-num");
  lic.clubAilleurs=String(c&&c.value||"").trim().slice(0,80);
  lic.numAilleurs=String(n&&n.value||"").trim().slice(0,30);
  if(!lic.clubAilleurs) delete lic.clubAilleurs;
  if(!lic.numAilleurs) delete lic.numAilleurs;
  saveLicences(x.lics); renderLicenceDetail(lic); buildLicences();
  showToast("Enregistré");
}
// Bénévole : un pass perso (lien/QR, sans compte) dans le carnet, pour voir ses missions.
function licPassBenevole(lic){
  if(typeof benCarnetCharger!=="function"||!window.fbSetDoc||!lic||!lic.fiche) return;
  var f=lic.fiche, nom=((f.prenom||"")+" "+(f.nom||"")).trim().slice(0,60);
  if(!nom) return;
  benCarnetCharger(true).then(function(c){
    if((c||[]).some(function(x){ return x.licCode===lic.code||String(x.nom).toLowerCase()===nom.toLowerCase(); })) return;
    var id="v"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), code=genSecureCode(3,4);
    var x={nom:nom,code:code,actif:true,createdAt:Date.now(),licCode:lic.code};
    return window.fbSetDoc(window.fbDoc(window.fbDb,"benevoles",id),x).then(function(){
      x.id=id; var d=benPassDonnees(x); d.createdAt=Date.now();
      return window.fbSetDoc(window.fbDoc(window.fbDb,"ben_pass",code),d);
    }).then(function(){ BEN_CARNET=(BEN_CARNET||[]).concat([x]); showToast("Pass bénévole créé (Événements › Bénévoles)"); });
  }).catch(function(){});
}
