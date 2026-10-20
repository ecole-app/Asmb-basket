/* ===== 24b-independant-argent.js — Argent de l'indépendant : suivi des paiements et pass (Premium) ===== */
// Suite de 24-independant.js (même portée globale, chargé juste après). L'indépendant encaisse
// lui-même (espèces, virement, chèque, en ligne) : l'appli SUIT ce qui est dû et payé, elle ne
// touche jamais à l'argent. Reçus et livre des recettes viendront ensuite sur les mêmes données.
// Données : clubs/{id}/indep_lignes/{id}, écrites par l'indépendant seul, lues par lui et par le
// compte payeur (champ « compte » : le client, ou le parent pour un enfant).
//  type "seance" : une présence à payer. id = s_<séance>__<personne> (une seule ligne par présence)
//     {type, uid (personne), compte, date, seance, libelle, montant, statut:"du"|"paye"|"pass", passId?,
//      mode?, datePaiement?}
//  type "pass"   : un carnet de séances vendu {debut, fin (6 mois par défaut), seances, usages:[id de séances], montant,
//     statut:"du"|"paye", mode?, datePaiement?}. Restant = seances − usages.length. Une présence
//     pointée consomme le pass valide de la personne qui expire en premier (statut « pass », montant 0).
// Pointer une présence crée la ligne (« à payer » au prix de la séance, ou « pass ») ; retirer la
// présence supprime la ligne si elle n'est pas encore payée (une ligne payée est conservée).

var IND_MODES=[["especes","Espèces"],["virement","Virement"],["cheque","Chèque"],["en_ligne","En ligne"]];
var IND_PASS_MOIS=6;
IND_ICONES.argent='<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.5-.8-1.5-1.2-2.8-1.2-1.6 0-2.7.8-2.7 2s1 1.7 2.7 2c1.8.3 2.9.8 2.9 2.1 0 1.2-1.2 2-2.9 2-1.4 0-2.5-.5-3-1.4M12 6.5V8m0 8v1.5"/></svg>';

function indModeTxt(m){ for(var i=0;i<IND_MODES.length;i++) if(IND_MODES[i][0]===m) return IND_MODES[i][1]; return ""; }
function indArrondi(n){ return Math.round((Number(n)||0)*100)/100; }
function indEuros(n){ n=indArrondi(n); return (n%1===0?String(n):n.toFixed(2).replace(".",","))+" €"; }
function indAjoutMois(iso,n){
  var d=indDate(iso), j=d.getDate(); d.setDate(1); d.setMonth(d.getMonth()+n);
  var max=new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); d.setDate(Math.min(j,max));
  return indIso(d);
}
// Le suivi de l'argent est une fonction Premium (mêmes règles de pack que le club, voir hasPremium).
function indPremium(){
  var c=IND.club||{};
  if(window.SUPPORT_MODE) return true;
  if(typeof isSuperAdmin==="function" && isSuperAdmin()) return true;
  if(typeof aboGelActif==="function" && aboGelActif(c)) return false; // abonnement gelé : l'argent est fermé
  if(c.plan==="trial"){ var je=(typeof joursEssaiRestants==="function")?joursEssaiRestants(c):null; return je===null||je>0; }
  return c.plan!=="standard" && c.plan!=="gratuit" && c.plan!=="limite";
}

// ── Données ──────────────────────────────────────────────────────────
function indArgentEcouter(ecoute,db){
  ecoute(IND.role==="coach"?window.fbCollection(db,"indep_lignes"):window.fbQuery(window.fbCollection(db,"indep_lignes"),window.fbWhere("compte","==",IND.uid)),function(sn){
    var m={}; sn.forEach(function(d){ m[d.id]=d.data(); }); IND.lignes=m; indRendre();
  });
  // Identité de l'émetteur + compteur des reçus (lisible par les clients : leur PDF en a besoin).
  ecoute(window.fbDoc(db,"indep_reglages","recus"),function(sn){ IND.recusCfg=sn.exists()?sn.data():{}; });
}
function indLigneId(sid,pid){ return "s_"+sid+"__"+pid; }
function indLignes(){ return Object.keys(IND.lignes||{}).map(function(k){ return Object.assign({id:k},IND.lignes[k]); }); }
function indLignesCompte(compte){
  return indLignes().filter(function(l){ return l.compte===compte; })
    .sort(function(a,b){ return (b.date||"").localeCompare(a.date||"") || (b.id>a.id?1:-1); });
}
function indDuLignes(l){ return l.filter(function(x){ return x.statut==="du"; }); }
function indSomme(l){ return indArrondi(l.reduce(function(s,x){ return s+(Number(x.montant)||0); },0)); }
function indPassRestantes(p){ return (Number(p.seances)||0)-((p.usages||[]).length); }
function indPassEnCours(l){ return l.filter(function(p){ return p.type==="pass" && indPassRestantes(p)>0 && (p.fin||"")>=indAuj(); }); }
// Pass valide ce jour-là pour cette personne, celui qui expire en premier.
function indPassPour(pid,dateIso){
  var l=indLignes().filter(function(p){ return p.type==="pass" && p.uid===pid && p.debut<=dateIso && dateIso<=p.fin && indPassRestantes(p)>0; });
  l.sort(function(a,b){ return (a.fin||"").localeCompare(b.fin||""); });
  return l[0]||null;
}
// Compte payeur : le client lui-même, ou le parent pour un enfant.
function indCompteDe(pid){
  if(IND.role==="coach"){ var c=IND.clients[pid]; return (c&&c.mineur&&c.parentUid)?c.parentUid:pid; }
  return IND.uid;
}
function indNomPers(pid){
  if(IND.role==="coach") return indNom(pid,"Client");
  var p=indPersonne(pid); return p?p.prenom:"Moi";
}

// ── Présence pointée → ligne à payer ou séance prise sur un pass ─────
// s : séance (indSeanceParId), pid : personne, present : true/false
function indArgentPresence(s,pid,present){
  if(IND.role!=="coach") return;
  var prem=indPremium(); // Standard : le pass se décompte, mais aucune ligne « à payer » n'est créée
  var id=indLigneId(s.id,pid), ex=IND.lignes[id], b=window.fbWriteBatch(), ref=function(k){ return window.fbDoc(indDb(),"indep_lignes",k); };
  if(present){
    if(ex) return;
    var prix=indArrondi(s.prix), pass=indPassPour(pid,s.date);
    var base={type:"seance", uid:pid, compte:indCompteDe(pid), date:s.date, seance:s.id, libelle:String(s.titre||"Séance").slice(0,120), createdAt:window.fbServerTimestamp()};
    if(pass){
      b.set(ref(id),Object.assign(base,{montant:0, statut:"pass", passId:pass.id}));
      b.update(ref(pass.id),{usages:window.fbArrayUnion(s.id)});
    } else if(prix>0 && prem){
      b.set(ref(id),Object.assign(base,{montant:prix, statut:"du"}));
    } else return;
  } else {
    if(!ex) return;
    if(ex.statut==="paye"){ showToast("Séance déjà payée : la ligne est conservée."); return; }
    b.delete(ref(id));
    if(ex.statut==="pass" && ex.passId && IND.lignes[ex.passId]) b.update(ref(ex.passId),{usages:window.fbArrayRemove(s.id)});
  }
  b.commit().catch(indErr);
}
// Petite pastille dans la liste des présences d'une séance.
function indArgentPill(sid,pid){
  var l=IND.lignes[indLigneId(sid,pid)]; if(!l) return "";
  if(!indPremium() && l.statut!=="pass") return "";
  if(l.statut==="du") return '<span class="ind-pill w">'+indEsc(indEuros(l.montant))+' à payer</span>';
  if(l.statut==="paye") return '<span class="ind-pill ok">Payé</span>';
  return '<span class="ind-pill a">Pass</span>';
}

// ── Écritures ────────────────────────────────────────────────────────
function indPayerLignes(ids,mode,date){
  var b=window.fbWriteBatch();
  ids.forEach(function(id){ b.update(window.fbDoc(indDb(),"indep_lignes",id),{statut:"paye", mode:mode, datePaiement:date}); });
  return b.commit();
}
function indAnnulerPaiement(id){
  var l=IND.lignes[id]||{}, recu=l.recuNum;
  askConfirm("Remettre cette ligne en « à payer » ?"+(recu?"\n\nLe reçu "+recu+" sera annulé (son numéro n'est pas réutilisé).":""),{title:"Annuler le paiement",confirmText:"Remettre à payer"}).then(function(ok){
    if(!ok) return;
    var b=window.fbWriteBatch(), maj={statut:"du", mode:"", datePaiement:""};
    if(recu){
      maj.recuNum=""; maj.recuLe=""; maj.recusAnnules=window.fbArrayUnion(recu);
      if(typeof indRecuAnnulerOps==="function") indRecuAnnulerOps(Object.assign({id:id},l),b);
    }
    b.update(window.fbDoc(indDb(),"indep_lignes",id),maj);
    b.commit().then(function(){ showToast("Remis en « à payer »"); }).catch(indErr);
  });
}
// o : {pid, n, prix, mois, paye, mode, date}
function indVendrePass(o){
  var debut=indAuj();
  var d={type:"pass", uid:o.pid, compte:indCompteDe(o.pid), date:debut, debut:debut, fin:indAjoutMois(debut,o.mois||IND_PASS_MOIS), seances:o.n, usages:[],
    libelle:("Pass "+o.n+" séance"+(o.n>1?"s":"")).slice(0,120), montant:indArrondi(o.prix), statut:o.paye?"paye":"du", createdAt:window.fbServerTimestamp()};
  if(!indPremium()){ d.statut="paye"; d.mode=""; d.datePaiement=debut; } // Standard : pas de suivi des paiements ; ces ventes apparaîtront au passage en Premium
  else if(o.paye){ d.mode=o.mode; d.datePaiement=o.date; }
  return window.fbSetDoc(window.fbDoc(indDb(),"indep_lignes",indId("p_")),d);
}

// ── Affichage d'une ligne ────────────────────────────────────────────
function indLigneHtml(l,coach,multi){
  var droite;
  if(l.statut==="du") droite=coach?'<button type="button" class="ind-btn p mini" data-act="lig-payer" data-id="'+indEsc(l.id)+'">Encaisser</button>':'<span class="ind-pill w">À régler</span>';
  else if(l.statut==="paye") droite='<span class="ind-pill ok">Payé</span>'+((coach||l.recuNum)?'<button type="button" class="ind-btn s mini" data-act="recu" data-id="'+indEsc(l.id)+'">Reçu</button>':'')+(coach?'<button type="button" class="ind-btn s mini" data-act="lig-annuler" data-id="'+indEsc(l.id)+'" aria-label="Annuler le paiement">↺</button>':'');
  else droite='<span class="ind-pill a">Pass</span>';
  var sous=[];
  if(multi) sous.push(indNomPers(l.uid));
  if(l.type==="pass") sous.push(indPassRestantes(l)+" / "+l.seances+" restantes · jusqu'au "+indDateTxt(l.fin));
  if(l.statut==="paye") sous.push((indModeTxt(l.mode)||"Payé")+(l.datePaiement?" le "+indDateTxt(l.datePaiement):"")+(l.recuNum?" · reçu "+l.recuNum:""));
  var montant=l.statut==="pass"?"":" · "+indEuros(l.montant);
  return '<div class="ind-row"><div class="t"><strong>'+indEsc(indDateTxt(l.date)+" · "+(l.libelle||"")+montant)+'</strong>'
    +(sous.length?'<span>'+indEsc(sous.join(" · "))+'</span>':'')+'</div>'+droite+'</div>';
}

// ── Onglet Argent (indépendant) ──────────────────────────────────────
// Formule Standard : les pass de séances (vente et décompte automatique) ; le reste est Premium.
function indPassLigneStd(p){
  return '<div class="ind-row"><div class="t"><strong>'+indEsc(indNomPers(p.uid))+'</strong><span>'
    +indEsc(indPassRestantes(p)+" / "+p.seances+" restantes · jusqu'au "+indDateTxt(p.fin))+'</span></div></div>';
}
function indArgentVueStandard(){
  var pass=indPassEnCours(indLignes()).sort(function(a,b){ return (a.fin||"").localeCompare(b.fin||""); });
  var h='<div class="ind-k">Pass en cours</div>';
  h+=pass.length?'<div class="ind-c ind-list">'+pass.map(indPassLigneStd).join("")+'</div>':'<div class="ind-c ind-vide">Aucun pass en cours. Vends un pass de séances : il se décompte tout seul à chaque présence pointée.</div>';
  h+='<button type="button" class="ind-btn p" data-act="pass-vendre">+ Vendre un pass</button>';
  h+='<div class="ind-c" style="margin-top:14px"><div class="ind-row"><div class="t"><strong>Suivi des paiements : formule Premium</strong>'
    +'<span>Vois qui te doit quoi, encaisse, garde l\'historique. Reçus numérotés, livre des recettes et stats inclus.</span></div></div></div>';
  return h;
}
function indArgentVue(){
  if(!indPremium()) return indArgentVueStandard();
  var l=indLignes(), du=indDuLignes(l), mois=indAuj().slice(0,7);
  var encaisse=indSomme(l.filter(function(x){ return x.statut==="paye" && (x.datePaiement||"").slice(0,7)===mois; }));
  var h='<div class="ind-stats"><div class="ind-c"><div class="ind-big">'+indEsc(indEuros(indSomme(du)))+'</div><span>à encaisser</span></div>'
    +'<div class="ind-c"><div class="ind-big">'+indEsc(indEuros(encaisse))+'</div><span>encaissé ce mois-ci</span></div></div>';
  // À encaisser, par compte payeur
  var parCompte={}; du.forEach(function(x){ (parCompte[x.compte]=parCompte[x.compte]||[]).push(x); });
  var comptes=Object.keys(parCompte).sort(function(a,b){ return indSomme(parCompte[b])-indSomme(parCompte[a]); });
  h+='<div class="ind-k">À encaisser</div>';
  h+=comptes.length?'<div class="ind-c ind-list">'+comptes.map(function(k){
    var nb=parCompte[k].length;
    return '<div class="ind-row tap" data-act="argent-fiche" data-compte="'+indEsc(k)+'" role="button" tabindex="0" style="cursor:pointer"><div class="ind-av">'
      +indEsc(indInitiales((IND.clients[k]||{}).prenom,(IND.clients[k]||{}).nom))+'</div><div class="t"><strong>'+indEsc(indNom(k,"Client"))+'</strong><span>'
      +nb+' ligne'+(nb>1?"s":"")+'</span></div><span class="ind-pill w">'+indEsc(indEuros(indSomme(parCompte[k])))+'</span></div>';
  }).join("")+'</div>':'<div class="ind-c ind-vide">Rien à encaisser. Quand tu pointes une présence, la séance apparaît ici si elle est payante.</div>';
  // Pass en cours
  var pass=indPassEnCours(l).sort(function(a,b){ return (a.fin||"").localeCompare(b.fin||""); });
  h+='<div class="ind-k">Pass en cours</div>';
  h+=pass.length?'<div class="ind-c ind-list">'+pass.map(function(p){
    return '<div class="ind-row tap" data-act="argent-fiche" data-compte="'+indEsc(p.compte)+'" role="button" tabindex="0" style="cursor:pointer"><div class="t"><strong>'+indEsc(indNomPers(p.uid))+'</strong><span>'
      +indEsc(indPassRestantes(p)+" / "+p.seances+" restantes · jusqu'au "+indDateTxt(p.fin))+'</span></div>'
      +(p.statut==="du"?'<span class="ind-pill w">À payer</span>':'')+'</div>';
  }).join("")+'</div>':'<div class="ind-c ind-vide">Aucun pass en cours.</div>';
  h+='<button type="button" class="ind-btn p" data-act="pass-vendre">+ Vendre un pass</button>';
  if(typeof indRecusBoutons==="function") h+=indRecusBoutons();
  return h;
}

// ── Fiche argent d'un compte (indépendant : actions ; client : lecture) ──
function indArgentFiche(compte){
  var coach=IND.role==="coach";
  var sh=gmSheet(coach?"Argent · "+indNom(compte,"Client"):"Mes paiements");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.addEventListener("click",indClic);
  IND.feuille={s:sh, peindre:function(){
    var l=indLignesCompte(compte), du=indDuLignes(l), pass=indPassEnCours(l);
    if(!indPremium()){
      sh.body.innerHTML='<div class="ind-k">Pass</div>'+(pass.length?'<div class="ind-c ind-list">'+pass.map(indPassLigneStd).join("")+'</div>':'<div class="ind-c ind-vide">Aucun pass en cours.</div>')
        +(coach?'<button type="button" class="ind-btn p" data-act="pass-vendre" data-compte="'+indEsc(compte)+'">+ Vendre un pass</button>':'');
      return;
    }
    var multi=false, vus={}; l.forEach(function(x){ vus[x.uid]=1; }); multi=Object.keys(vus).length>1;
    var h='<div class="ind-c"><div class="ind-row"><div class="t"><strong style="font-size:22px">'+indEsc(indEuros(indSomme(du)))+'</strong><span>'
      +(du.length?"à régler ("+du.length+" ligne"+(du.length>1?"s":"")+")":"Tout est réglé")+'</span></div>'
      +(coach&&du.length?'<button type="button" class="ind-btn p mini" data-act="solde-regler" data-compte="'+indEsc(compte)+'">Tout encaisser</button>':'')+'</div></div>';
    h+='<div class="ind-k">Pass</div>';
    h+=pass.length?'<div class="ind-c ind-list">'+pass.map(function(p){ return indLigneHtml(p,coach,multi); }).join("")+'</div>':'<div class="ind-c ind-vide">Aucun pass en cours.</div>';
    if(coach) h+='<button type="button" class="ind-btn s" data-act="pass-vendre" data-compte="'+indEsc(compte)+'">+ Vendre un pass</button>';
    h+='<div class="ind-k">Historique</div>';
    h+=l.length?'<div class="ind-c ind-list">'+l.slice(0,60).map(function(x){ return indLigneHtml(x,coach,multi); }).join("")+'</div>':'<div class="ind-c ind-vide">Aucun paiement pour l\'instant.</div>';
    sh.body.innerHTML=h;
  }};
  IND.feuille.peindre();
}

// ── Fenêtre « Encaisser » (mode + date) ──────────────────────────────
function indPayerSheet(ids,total){
  if(!ids.length) return;
  var sh=gmSheet("Encaisser "+indEuros(total));
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.innerHTML='<form class="ind-f" id="ind-py-f" novalidate>'
    +'<div style="font-size:12px;font-weight:800;color:var(--txt2)">Mode de paiement</div>'
    +IND_MODES.map(function(m,i){ return '<label class="case"><input type="radio" name="ind-py-mode" value="'+m[0]+'"'+(i===0?" checked":"")+'>'+m[1]+'</label>'; }).join("")
    +'<label>Date du paiement<input id="ind-py-date" type="date" max="'+indAuj()+'" value="'+indAuj()+'"></label>'
    +'<div class="err" id="ind-py-err"></div><div class="actions"><button type="submit" class="ok">Valider le paiement</button></div></form>';
  var f=sh.body.querySelector("#ind-py-f");
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var mode=f.querySelector("input[name=ind-py-mode]:checked").value, date=f.querySelector("#ind-py-date").value;
    if(!date){ f.querySelector("#ind-py-err").textContent="Indique la date du paiement (JJ/MM/AAAA)."; return; }
    f.querySelector("button[type=submit]").disabled=true;
    indPayerLignes(ids,mode,date).then(function(){ sh.modal.remove(); showToast("Paiement enregistré"); }).catch(function(e2){ f.querySelector("button[type=submit]").disabled=false; indErr(e2); });
  });
}

// ── Fenêtre « Vendre un pass » ───────────────────────────────────────
function indPersonnesDuCompte(compte){
  var l=[], c=IND.clients[compte];
  if(c && !c.parentSeul) l.push({id:compte, nom:indNom(compte,"Client")});
  indEnfantsDe(compte).forEach(function(e){ l.push({id:e.uid, nom:(e.prenom||"Enfant")}); });
  return l;
}
function indPassForm(compte){
  var cands=compte?indPersonnesDuCompte(compte):indClientsActifs().map(function(c){ return {id:c.uid, nom:(c.prenom||"")+" "+(c.nom||"")}; });
  if(!cands.length) return askAlert("Aucun client à qui vendre un pass pour l'instant.");
  var sh=gmSheet("Vendre un pass");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  sh.body.innerHTML='<form class="ind-f" id="ind-ps-f" novalidate>'
    +'<label>Pour qui<select id="ind-ps-qui">'+cands.map(function(c){ return '<option value="'+indEsc(c.id)+'">'+indEsc(c.nom)+'</option>'; }).join("")+'</select></label>'
    +'<div class="deux"><label>Nombre de séances<input id="ind-ps-n" type="number" inputmode="numeric" min="1" max="200" value="10"></label>'
    +'<label>Prix total (€)<input id="ind-ps-prix" type="number" inputmode="decimal" min="0" step="0.01" placeholder="200"></label></div>'
    +'<label>Valable (mois)<input id="ind-ps-mois" type="number" inputmode="numeric" min="1" max="36" value="'+IND_PASS_MOIS+'"></label>'
    +(indPremium()?'<label class="case"><input type="checkbox" id="ind-ps-paye">Déjà payé</label>'
    +'<div id="ind-ps-pay" class="ind-f" hidden><label>Mode de paiement<select id="ind-ps-mode">'+IND_MODES.map(function(m){ return '<option value="'+m[0]+'">'+m[1]+'</option>'; }).join("")+'</select></label>'
    +'<label>Date du paiement<input id="ind-ps-date" type="date" max="'+indAuj()+'" value="'+indAuj()+'"></label></div>':'')
    +'<p class="ind-note">Chaque séance pointée « présent » est prise sur le pass tant qu\'il est valable et qu\'il reste des séances.</p>'
    +'<div class="err" id="ind-ps-err"></div><div class="actions"><button type="submit" class="ok">Créer le pass</button></div></form>';
  var f=sh.body.querySelector("#ind-ps-f");
  var cbPaye=f.querySelector("#ind-ps-paye");
  if(cbPaye) cbPaye.addEventListener("change",function(){ f.querySelector("#ind-ps-pay").hidden=!this.checked; });
  f.addEventListener("submit",function(e){
    e.preventDefault();
    var err=f.querySelector("#ind-ps-err");
    var n=parseInt(f.querySelector("#ind-ps-n").value,10), prix=parseFloat(String(f.querySelector("#ind-ps-prix").value).replace(",",".")), mois=parseInt(f.querySelector("#ind-ps-mois").value,10);
    var paye=!!(cbPaye&&cbPaye.checked), dEl=f.querySelector("#ind-ps-date"), date=dEl?dEl.value:"";
    if(!(n>=1&&n<=200)) { err.textContent="Indique le nombre de séances (1 à 200)."; return; }
    if(!(prix>=0)) { err.textContent="Indique le prix du pass."; return; }
    if(!(mois>=1&&mois<=36)) { err.textContent="Indique la durée de validité en mois."; return; }
    if(paye && !date) { err.textContent="Indique la date du paiement (JJ/MM/AAAA)."; return; }
    f.querySelector("button[type=submit]").disabled=true;
    indVendrePass({pid:f.querySelector("#ind-ps-qui").value, n:n, prix:prix, mois:mois, paye:paye, mode:(f.querySelector("#ind-ps-mode")||{}).value, date:date})
      .then(function(){ sh.modal.remove(); showToast("Pass créé"); }).catch(function(e2){ f.querySelector("button[type=submit]").disabled=false; indErr(e2); });
  });
}

// ── Client : encart sur l'Accueil ────────────────────────────────────
function indArgentClientBloc(){
  var l=indLignesCompte(IND.uid); if(!l.length) return "";
  if(!indPremium()){
    var ps=indPassEnCours(l); if(!ps.length) return "";
    return '<div class="ind-k">Mon pass</div><div class="ind-c ind-list">'+ps.map(indPassLigneStd).join("")+'</div>';
  }
  var du=indSomme(indDuLignes(l)), pass=indPassEnCours(l);
  var sous=[];
  pass.forEach(function(p){ sous.push((indPersonnes().length>1?indNomPers(p.uid)+" : ":"")+indPassRestantes(p)+" séance"+(indPassRestantes(p)>1?"s":"")+" restante"+(indPassRestantes(p)>1?"s":"")+" (jusqu'au "+indDateTxt(p.fin)+")"); });
  return '<div class="ind-k">Mes paiements</div><div class="ind-c tap" data-act="argent-fiche" data-compte="'+indEsc(IND.uid)+'" role="button" tabindex="0"><div class="ind-row"><div class="t"><strong>'
    +indEsc(du>0?indEuros(du)+" à régler":"Tout est réglé")+'</strong><span>'+indEsc(sous.length?sous.join(" · "):"Voir mon historique")+'</span></div>'
    +(du>0?'<span class="ind-pill w">À régler</span>':'<span aria-hidden="true">›</span>')+'</div></div>';
}

// ── Actions (appelées par indClic) ───────────────────────────────────
function indArgentClic(act,el){
  var id=el.dataset.id, compte=el.dataset.compte;
  if(act==="argent-fiche") return indArgentFiche(compte||IND.uid), true;
  if(act==="lig-payer"){ var l=IND.lignes[id]; if(l) indPayerSheet([id],l.montant); return true; }
  if(act==="lig-annuler"){ indAnnulerPaiement(id); return true; }
  if(act==="solde-regler"){ var ids=indDuLignes(indLignesCompte(compte)).map(function(x){ return x.id; }); indPayerSheet(ids,indSomme(indDuLignes(indLignesCompte(compte)))); return true; }
  if(act==="pass-vendre"){ indPassForm(compte||null); return true; }
  if(typeof indRecusClic==="function") return indRecusClic(act,el);
  return false;
}
