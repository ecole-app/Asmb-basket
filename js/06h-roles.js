// ═══ RÔLE D'UNE FICHE LICENCE + SUPPRESSION ═════════════════════════
// lic.role : "joueur" (défaut) | "coach" | "autre". Coach/autre : licence conservée mais
// jamais ajoutée aux joueurs/trombinoscope, ni comptée dans la limite du pack.
// licEstJoueur() est dans js/11-admin.js.
var LIC_ROLES={joueur:"Joueur",coach:"Coach",autre:"Autre (bureau, arbitre…)"};
function licRoleHtml(lic){
  var r=lic.role||"joueur";
  var opts=Object.keys(LIC_ROLES).map(function(k){return '<option value="'+k+'"'+(r===k?" selected":"")+'>'+LIC_ROLES[k]+'</option>';}).join("");
  return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:12px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">'+
    '<div style="font-size:12px;font-weight:700;color:var(--txt)">Cette personne est</div>'+
    '<select class="form-select" style="flex:1;min-width:140px" onchange="licChangerRole(\''+lic.code+'\',this.value)">'+opts+'</select>'+
    '<button onclick="licSupprimer(\''+lic.code+'\')" style="padding:9px 12px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:700;border:none;cursor:pointer">Supprimer la fiche</button>'+
    (typeof licEquipeHtml==="function"?licEquipeHtml(lic):'')+'</div>';
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
  saveLicences(lics);
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
