/* ===== 14k-stats-saisie.js — Stats avancées de match : saisie en direct, remplacements, feuille de match =====
 *
 * Écran plein écran (#ms-overlay) ouvert par le bouton « Stats » d'un match du planning (staff seulement).
 * Calcul : js/14j-stats-calcul.js. Données : collection `match_stats` (id = id de l'événement), synchro staff.
 * Standard : score, points, fautes, feuille de match. Premium (`hasPremium()`) : toutes les actions, chrono,
 * remplacements, temps de jeu, +/-, évaluation, export PDF, fiche joueur (14l).
 */
var MS_CLE="asmb_match_stats";
var msId=null, msVue="saisie", msSel=null, msTimer=null, msSaveT=null;
var msPendSort=null, msPendEntre=null, msPendTxt="";

function getMatchStats(){ try{ return JSON.parse(localStorage.getItem(MS_CLE)||"[]"); }catch(e){ return []; } }
// Écriture locale immédiate, envoi à Firestore légèrement différé (une action = un tap, pas un envoi).
function saveMatchStats(arr, tout){
  localStorage.setItem(MS_CLE, JSON.stringify(arr));
  clearTimeout(msSaveT);
  var envoyer=function(){ try{ fsWriteCollection("match_stats", getMatchStats()); }catch(e){} };
  if(tout) envoyer(); else msSaveT=setTimeout(envoyer, 1500);
}
function msMatch(){ return getMatchStats().filter(function(m){return String(m.id)===String(msId);})[0]||null; }
function msSauver(m, tout){
  var a=getMatchStats(), i=a.findIndex(function(x){return String(x.id)===String(m.id);});
  if(i>=0) a[i]=m; else a.push(m);
  saveMatchStats(a, tout);
}
function msPremium(){ return typeof hasPremium==="function" ? hasPremium() : true; }

function msNomJoueur(id){
  var p=getPlayers().filter(function(x){return String(x.id)===String(id);})[0];
  if(!p) return "Joueur";
  return ((p.prenom||"")+" "+((p.nom||"").charAt(0)?(p.nom||"").charAt(0)+".":"")).trim()||"Joueur";
}
function msNomComplet(id){
  var p=getPlayers().filter(function(x){return String(x.id)===String(id);})[0];
  return p?((p.prenom||"")+" "+(p.nom||"")).trim():"Joueur";
}
function msOverlay(){
  var o=document.getElementById("ms-overlay");
  if(!o){ o=document.createElement("div"); o.id="ms-overlay"; document.body.appendChild(o); }
  return o;
}
function msFermer(){
  clearInterval(msTimer); msTimer=null;
  var o=document.getElementById("ms-overlay"); if(o) o.remove();
  msId=null; msSel=null;
}
function msEntete(titre, sous, droite){
  return "<div class=\"ms-hdr\"><button class=\"ms-back\" onclick=\"msRetour()\" aria-label=\"Retour\">‹</button>"
    +"<div class=\"ms-t\"><b>"+authEsc(titre)+"</b><span>"+authEsc(sous||"")+"</span></div>"+(droite||"")+"</div>";
}
function msRetour(){
  if(msVue==="rempl"){ msVue="saisie"; msPendSort=msPendEntre=null; msPendTxt=""; msDessiner(); return; }
  msFermer();
  if(typeof buildPlanning==="function") buildPlanning();
}

// ── Point d'entrée : bouton « Stats » d'un match ─────────────────
function statsBoutonCarte(e){
  if(!e || e.type!=="match" || typeof isStaffUser!=="function" || !isStaffUser()) return "";
  var m=getMatchStats().filter(function(x){return String(x.id)===String(e.id);})[0];
  var lib=m?(m.statut==="termine"?"Feuille de match":"Stats en cours"):"Stats";
  var salle=(m&&msPremium())?"<button onclick=\"statsSalleOuvrir('"+authEsc(String(e.id))+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:10px;font-weight:700;border:none;cursor:pointer\">📺 Salle</button>":"";
  return salle+"<button onclick=\"statsOuvrir('"+authEsc(String(e.id))+"')\" style=\"margin-top:8px;margin-left:6px;padding:6px 12px;border-radius:20px;background:color-mix(in srgb, var(--dkg) 14%, transparent);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer\">📊 "+lib+"</button>";
}
function statsOuvrir(eventId){
  if(typeof isStaffUser==="function" && !isStaffUser()){ askAlert("Réservé aux coachs et au dirigeant."); return; }
  if(typeof isLimite==="function" && isLimite()){ askAlert("Accès limité : la saisie des stats est fermée. Tes feuilles de match restent consultables."); }
  var ev=getEvents().filter(function(e){return String(e.id)===String(eventId);})[0];
  if(!ev){ askAlert("Match introuvable."); return; }
  msId=String(eventId); msSel=null; msPendSort=msPendEntre=null;
  var m=msMatch();
  if(!m){ msVue="debut"; msDessiner(ev); return; }
  msVue = m.statut==="termine" ? "feuille" : "saisie";
  msDessiner();
}

// ── Avant le match : adversaire, joueurs présents, 5 de départ ──────
var msChoix={presents:{}, titulaires:{}, adversaire:"", dureeQ:10};
function msDebut(ev){
  var o=msOverlay();
  if(!msChoix.init || msChoix.evId!==String(ev.id)){
    var joueurs=getPlayersForEvent(ev), conv=ev.convocations||[];
    msChoix={init:true, evId:String(ev.id), presents:{}, titulaires:{}, dureeQ:10,
             adversaire:(ev.score&&ev.score.adversaire)||""};
    joueurs.forEach(function(p){ if(!conv.length || conv.indexOf(p.id)>=0) msChoix.presents[p.id]=true; });
  }
  var prem=msPremium();
  var liste=getPlayersForEvent(ev);
  var nb=Object.keys(msChoix.presents).filter(function(k){return msChoix.presents[k];}).length;
  var nbT=Object.keys(msChoix.titulaires).filter(function(k){return msChoix.titulaires[k];}).length;
  var h=msEntete("Stats du match",(ev.titre||"Match")+" · "+(ev.date||""));
  h+="<div class=\"ms-body\">";
  h+="<div class=\"ms-card\"><div class=\"ms-lbl\">Adversaire</div>"
    +"<input id=\"ms-adv\" type=\"text\" value=\""+authEsc(msChoix.adversaire)+"\" placeholder=\"Nom de l'équipe adverse\" oninput=\"msChoix.adversaire=this.value\" style=\"width:100%;box-sizing:border-box;margin-top:6px;padding:10px;font-size:14px;border:1.5px solid var(--bdr);border-radius:12px;background:var(--bg);color:var(--txt)\">";
  if(prem) h+="<div class=\"ms-lbl\" style=\"margin-top:10px\">Durée d'un quart-temps</div><div style=\"display:flex;gap:8px;margin-top:6px\">"
    +[8,10,12].map(function(d){return "<button class=\"ms-btn"+(msChoix.dureeQ===d?" plein":"")+"\" onclick=\"msChoix.dureeQ="+d+";msDebutRedessiner()\">"+d+" min</button>";}).join("")+"</div>";
  h+="</div>";
  h+="<div class=\"ms-h\">Qui joue ? ("+nb+")</div>";
  if(prem) h+="<div style=\"font-size:12px;color:var(--mut)\">Touche « Titulaire » pour les 5 de départ ("+nbT+"/5).</div>";
  if(!liste.length) h+="<div class=\"ms-card\" style=\"font-size:13px\">Aucun joueur trouvé pour cette équipe. Ajoute les joueurs à l'équipe ou convoque-les d'abord.</div>";
  liste.forEach(function(p){
    var on=!!msChoix.presents[p.id], tit=!!msChoix.titulaires[p.id];
    h+="<div class=\"ms-ligne"+(on?" entre":"")+"\" style=\"cursor:default\">"
      +"<b onclick=\"msBasculePresent('"+authEsc(String(p.id))+"')\" style=\"cursor:pointer\">"+(on?"✓ ":"")+authEsc(((p.prenom||"")+" "+(p.nom||"")).trim())+"</b>"
      +(prem&&on?"<button class=\"ms-btn"+(tit?" plein":"")+"\" style=\"min-height:36px\" onclick=\"msBasculeTitulaire('"+authEsc(String(p.id))+"')\">Titulaire</button>":"")
      +"</div>";
  });
  h+="</div><div class=\"ms-pied\"><button class=\"ms-btn plein\" onclick=\"msCommencer()\">Commencer le match</button></div>";
  o.innerHTML=h;
}
function msDebutRedessiner(){
  var ev=getEvents().filter(function(e){return String(e.id)===String(msId);})[0]; if(ev) msDebut(ev);
}
function msBasculePresent(id){
  msChoix.presents[id]=!msChoix.presents[id];
  if(!msChoix.presents[id]) delete msChoix.titulaires[id];
  msDebutRedessiner();
}
function msBasculeTitulaire(id){
  if(!msChoix.titulaires[id]){
    var nb=Object.keys(msChoix.titulaires).filter(function(k){return msChoix.titulaires[k];}).length;
    if(nb>=5){ showToast("5 titulaires au maximum"); return; }
  }
  msChoix.titulaires[id]=!msChoix.titulaires[id];
  msDebutRedessiner();
}
function msCommencer(){
  var ev=getEvents().filter(function(e){return String(e.id)===String(msId);})[0]; if(!ev) return;
  var ids=getPlayersForEvent(ev).map(function(p){return p.id;}).filter(function(id){return msChoix.presents[id];});
  if(!ids.length){ askAlert("Coche au moins un joueur."); return; }
  var prem=msPremium();
  var tit=ids.filter(function(id){return msChoix.titulaires[id];});
  if(prem && tit.length!==Math.min(5,ids.length)){ askAlert("Choisis tes "+Math.min(5,ids.length)+" titulaires (touche « Titulaire »)."); return; }
  var m=msNouveau(ev, ids, (typeof getCurrentSeason==="function"?getCurrentSeason():""), msChoix.dureeQ);
  m.adversaire=(msChoix.adversaire||"").trim()||"Adversaire";
  if(prem) tit.forEach(function(id){ msAjouter(m,"in",id,Date.now()); });
  msSauver(m, true);
  msVue="saisie"; msSel=prem?tit[0]:ids[0];
  msDessiner();
}

// ── Saisie en direct ─────────────────────────────────────────────
function msDessiner(ev){
  if(msVue==="debut"){ clearInterval(msTimer); msTimer=null; msDebut(ev||getEvents().filter(function(e){return String(e.id)===String(msId);})[0]); return; }
  var m=msMatch(); if(!m){ msFermer(); return; }
  if(msVue==="rempl") return msRempl(m);
  if(msVue==="feuille"){ clearInterval(msTimer); msTimer=null; return msFeuille(m); }
  msSaisie(m);
  clearInterval(msTimer);
  if(msPremium()) msTimer=setInterval(msTic, 500);
}
function msSaisie(m){
  var o=msOverlay(), prem=msPremium();
  var r=msCalcul(m), q=Number(m.q)||1;
  var terrain=prem?msTerrain(m):m.joueurs.slice();
  if(msSel && terrain.indexOf(msSel)<0) msSel=terrain[0]||null;
  if(!msSel) msSel=terrain[0]||null;
  var h=msEntete("Saisie du match",(m.equipe||"")+" · "+(m.date||""),
    (prem?"<button class=\"ms-pill\" onclick=\"statsSalleOuvrir('"+authEsc(String(m.id))+"')\">📺</button> ":"")+"<button class=\"ms-pill\" onclick=\"msVoirFeuille()\">Feuille</button>");
  h+="<div class=\"ms-body\" style=\"padding-bottom:0\">";
  h+="<div class=\"ms-card\"><div class=\"ms-score\">"
    +"<div><div class=\"ms-lbl\">"+authEsc(clubLabel("Nous"))+"</div><div class=\"ms-big\">"+r.score.nous+"</div></div>"
    +"<div style=\"flex:0 0 auto;min-width:76px\"><div class=\"ms-lbl\">Quart-temps</div><div class=\"ms-clock\">"+msLibQuart(q)+"</div>"
    +(prem?"<div class=\"ms-clock\" id=\"ms-clock\">"+msMMSS(msRestantQuart(m))+"</div>"
        +"<button class=\"ms-btn\" id=\"ms-pause\" onclick=\"msBasculeChrono()\" style=\"min-width:76px\">"+(msChronoMarche(m)?"Pause":"Démarrer")+"</button>":"")
    +"<div class=\"ms-lbl\" style=\"margin-top:2px\">Fautes éq. "+(r.fautesEq[q-1]||0)+"</div></div>"
    +"<div><div class=\"ms-lbl\">"+authEsc(m.adversaire||"Adversaire")+"</div><div class=\"ms-big\">"+r.score.eux+"</div>"
    +"<div class=\"ms-adv\">"+["a1","a2","a3"].map(function(a){return "<button class=\"ms-btn\" onclick=\"msAction('"+a+"')\">+"+MS_ADV[a]+"</button>";}).join("")+"</div></div>"
    +"</div></div>";
  h+="<div class=\"ms-joueurs"+(prem?"":" defile")+"\">";
  terrain.forEach(function(id){
    var L=r.joueurs[id]||msLigneVide();
    h+="<button class=\"ms-j"+(id===msSel?" sel":"")+"\" onclick=\"msChoisir('"+authEsc(String(id))+"')\"><div class=\"n\">"+authEsc(msNomJoueur(id))+"</div><div class=\"p\">"+L.pts+"</div><div class=\"f\">"+L.fc+" faute(s)</div></button>";
  });
  h+="</div>";
  h+="<div style=\"font-size:12px;color:var(--mut)\">Joueur sélectionné : <b style=\"color:var(--txt)\">"+authEsc(msSel?msNomJoueur(msSel):"aucun")+"</b> · touche une action pour l'enregistrer</div>";
  h+="<div class=\"ms-actions\">";
  (prem?MS_ORDRE:MS_ORDRE_STANDARD).forEach(function(a){
    h+="<button class=\"ms-a "+MS_ACTIONS[a].groupe+"\" onclick=\"msAction('"+a+"')\">"+MS_ACTIONS[a].lib+"</button>";
  });
  if(prem) h+="<button class=\"ms-a\" onclick=\"msOuvrirRempl()\">Remplacement</button>";
  h+="</div>";
  var d=m.evts.filter(function(e){return e.a!=="in"&&e.a!=="out";}).slice(-1)[0];
  h+="<div class=\"ms-card\" style=\"display:flex;align-items:center;gap:10px;padding:10px 12px\"><div style=\"flex:1;font-size:13px\">Dernière action : <b>"+authEsc(d?msTexteEvt(d):"aucune")+"</b></div>"
    +"<button class=\"ms-btn\" onclick=\"msUndo()\""+(m.evts.length?"":" disabled")+">Annuler</button></div>";
  h+="</div>";
  h+="<div class=\"ms-pied\"><button class=\"ms-btn\" onclick=\"msQuartSuiv()\">Quart-temps suivant</button><button class=\"ms-btn plein\" onclick=\"msFinir()\">Terminer le match</button></div>";
  o.innerHTML=h;
}
function msTexteEvt(e){
  var lib=MS_ACTIONS[e.a]?MS_ACTIONS[e.a].lib:(MS_ADV[e.a]?"Adversaire +"+MS_ADV[e.a]:e.a);
  return (e.p?msNomJoueur(e.p)+" · ":"")+lib;
}
function msTic(){
  var m=msMatch(); if(!m||msVue!=="saisie"){ clearInterval(msTimer); msTimer=null; return; }
  var c=document.getElementById("ms-clock"); if(!c) return;
  var reste=msRestantQuart(m);
  c.textContent=msMMSS(reste);
  if(msChronoMarche(m) && reste<=0){
    msChronoPause(m); msSauver(m);
    showToast("Fin du quart-temps");
    try{ if(navigator.vibrate) navigator.vibrate([200,100,200]); }catch(e){}
    msDessiner();
  }
}
function msChoisir(id){ msSel=id; var m=msMatch(); if(m) msSaisie(m); }
function msBasculeChrono(){
  var m=msMatch(); if(!m) return;
  if(msChronoMarche(m)) msChronoPause(m);
  else{
    if(msRestantQuart(m)<=0){ showToast("Quart-temps terminé : passe au suivant"); return; }
    msChronoDemarre(m);
  }
  msSauver(m); msSaisie(m);
}
function msAction(a){
  var m=msMatch(); if(!m) return;
  var adv=!!MS_ADV[a];
  if(!adv && !msSel){ showToast("Choisis d'abord un joueur"); return; }
  msAjouter(m, a, adv?null:msSel);
  msSauver(m); msSaisie(m);
  try{ if(navigator.vibrate) navigator.vibrate(15); }catch(e){}
}
function msUndo(){
  var m=msMatch(); if(!m||!m.evts.length) return;
  msAnnuler(m); msSauver(m); msSaisie(m);
}
function msQuartSuiv(){
  var m=msMatch(); if(!m) return;
  askConfirm("Passer au quart-temps suivant ?",{confirmText:"Oui, suivant"}).then(function(ok){
    if(!ok) return;
    msQuartSuivant(m); msSauver(m); msSaisie(m);
  });
}
function msFinir(){
  var m=msMatch(); if(!m) return;
  askConfirm("Terminer le match ? Tu pourras toujours corriger ensuite.",{confirmText:"Terminer"}).then(function(ok){
    if(!ok) return;
    msTerminer(m); msSauver(m, true);
    var r=msCalcul(m);
    // Le score s'affiche aussi sur la carte du match dans le planning.
    var evs=getEvents(), ev=evs.filter(function(e){return String(e.id)===String(m.eventId);})[0];
    if(ev){ ev.score={adversaire:m.adversaire||"Adversaire", asmb:r.score.nous, adv:r.score.eux}; saveEvents(evs); }
    msVue="feuille"; msDessiner();
  });
}
function msVoirFeuille(){ msVue="feuille"; msDessiner(); }

// ── Remplacement ─────────────────────────────────────────────────
function msOuvrirRempl(){ msVue="rempl"; msPendSort=msPendEntre=null; msPendTxt=""; msDessiner(); }
function msRempl(m){
  var o=msOverlay(), r=msCalcul(m), q=Number(m.q)||1;
  var sur=msTerrain(m), banc=m.joueurs.filter(function(id){return sur.indexOf(id)<0;});
  var h=msEntete("Remplacement", msLibQuart(q)+" · chrono "+(msChronoMarche(m)?"en marche":"arrêté à "+msMMSS(msRestantQuart(m))));
  h+="<div class=\"ms-body\"><div class=\"ms-h\">1. Qui sort ? (sur le terrain)</div><div style=\"display:flex;flex-direction:column;gap:6px\">";
  sur.forEach(function(id){
    var L=r.joueurs[id]||msLigneVide();
    h+="<div class=\"ms-ligne"+(msPendSort===id?" sort":"")+"\" onclick=\"msPendSort='"+authEsc(String(id))+"';msRempl(msMatch())\"><b>"+authEsc(msNomJoueur(id))+"</b><span>"+L.min+" min · "+L.fc+" faute(s)</span></div>";
  });
  h+="</div><div class=\"ms-h\">2. Qui entre ? (sur le banc)</div><div class=\"ms-grid2\">";
  if(!banc.length) h+="<div style=\"font-size:13px;color:var(--mut);grid-column:1/-1\">Personne sur le banc.</div>";
  banc.forEach(function(id){
    var L=r.joueurs[id]||msLigneVide();
    h+="<div class=\"ms-ligne"+(msPendEntre===id?" entre":"")+"\" onclick=\"msPendEntre='"+authEsc(String(id))+"';msRempl(msMatch())\"><b>"+authEsc(msNomJoueur(id))+"</b><span>"+L.min+" min</span></div>";
  });
  h+="</div><div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\">"
    +(msPendSort&&msPendEntre?"<b>"+authEsc(msNomJoueur(msPendSort))+"</b> sort, <b>"+authEsc(msNomJoueur(msPendEntre))+"</b> entre.":"Choisis le joueur qui sort et celui qui entre.")
    +(msPendTxt?"<br><span style=\"color:var(--grn)\">"+authEsc(msPendTxt)+"</span>":"")
    +"<br><span style=\"color:var(--mut)\">Le temps de jeu et le +/- de chacun se calculent à partir de ce moment.</span></div></div>";
  h+="<div class=\"ms-pied\" style=\"flex-direction:column\"><button class=\"ms-btn\" onclick=\"msValiderRempl(true)\">+ Ajouter un autre changement</button>"
    +"<div style=\"display:flex;gap:8px\"><button class=\"ms-btn\" style=\"flex:1;min-height:48px\" onclick=\"msRetour()\">Annuler</button>"
    +"<button class=\"ms-btn plein\" style=\"flex:1;min-height:48px\" onclick=\"msValiderRempl(false)\">Valider le changement</button></div></div>";
  o.innerHTML=h;
}
function msValiderRempl(encore){
  var m=msMatch(); if(!m) return;
  if(!msPendSort || !msPendEntre){
    if(!encore && !msPendSort && !msPendEntre){ msRetour(); return; }
    showToast("Choisis qui sort et qui entre"); return;
  }
  msAjouter(m,"out",msPendSort); msAjouter(m,"in",msPendEntre);
  msSel=msPendEntre;
  msPendTxt=msNomJoueur(msPendSort)+" ⇄ "+msNomJoueur(msPendEntre)+" enregistré";
  msPendSort=msPendEntre=null;
  msSauver(m, true);
  if(encore){ msRempl(m); return; }
  msVue="saisie"; msPendTxt=""; msDessiner();
}

// ── Feuille de match ─────────────────────────────────────────────
function msFeuille(m){
  var o=msOverlay(), prem=msPremium(), r=msCalcul(m);
  var gagne=r.score.nous>r.score.eux, nul=r.score.nous===r.score.eux;
  var h=msEntete("Feuille de match",(m.equipe||"")+" · "+(m.date||"")+(m.statut==="termine"?" · terminé":" · en cours"),
    (prem?"<button class=\"ms-pill\" onclick=\"statsSalleOuvrir('"+authEsc(String(m.id))+"')\">📺 Salle</button> ":"")
    +(m.statut==="termine"?"<span class=\"ms-pill\">"+(nul?"Nul":gagne?"Victoire":"Défaite")+"</span>":""));
  h+="<div class=\"ms-body ms-feuille\">";
  var nq=r.nbQuarts;
  // Colonne de gauche : tableau des joueurs
  var gauche="<div class=\"ms-card\" style=\"padding:10px;overflow-x:auto\"><table class=\"ms-tab\"><tr><th>Joueur</th>"
    +(prem?"<th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>INT</th><th>CT</th><th>BP</th><th>FC</th><th>+/-</th><th>ÉVAL</th>":"<th>PTS</th><th>FAUTES</th>")+"</tr>";
  var ids=r.ids.slice().sort(function(a,b){ return prem ? r.joueurs[b].sec-r.joueurs[a].sec || r.joueurs[b].pts-r.joueurs[a].pts : r.joueurs[b].pts-r.joueurs[a].pts; });
  var best={};
  if(prem) ["pts","reb","pd","int","ct","eval"].forEach(function(k){ best[k]=Math.max.apply(null,ids.map(function(id){return r.joueurs[id][k];})); });
  function cel(k,L){ var v=L[k]; return "<td"+(prem&&best[k]>0&&v===best[k]?" style=\"background:color-mix(in srgb,var(--or,#B7862B) 22%,transparent);font-weight:800\"":"")+">"+v+"</td>"; }
  ids.forEach(function(id){
    var L=r.joueurs[id];
    gauche+="<tr"+(prem?" class=\"clic\" onclick=\"msLigneJoueur('"+authEsc(String(id))+"')\"":"")+"><td>"+authEsc(msNomJoueur(id))+"</td>"
      +(prem?"<td>"+L.min+"</td>"+cel("pts",L)+cel("reb",L)+cel("pd",L)+cel("int",L)+cel("ct",L)+"<td>"+L.bp+"</td><td>"+L.fc+"</td><td>"+(L.pm>0?"+":"")+L.pm+"</td><td class=\"ms-ev\""+(best.eval>0&&L.eval===best.eval?" style=\"background:color-mix(in srgb,var(--or,#B7862B) 22%,transparent)\"":"")+">"+L.eval+"</td>"
            :"<td><b>"+L.pts+"</b></td><td>"+L.fc+"</td>")+"</tr>";
  });
  var t=r.equipe;
  gauche+="<tr style=\"font-weight:800\"><td>Équipe</td>"+(prem?"<td></td><td>"+t.pts+"</td><td>"+t.reb+"</td><td>"+t.pd+"</td><td>"+t.int+"</td><td>"+t.ct+"</td><td>"+t.bp+"</td><td>"+t.fc+"</td><td></td><td class=\"ms-ev\">"+t.eval+"</td>":"<td>"+t.pts+"</td><td>"+t.fc+"</td>")+"</tr></table></div>";
  if(prem) gauche+="<div style=\"font-size:12px;color:var(--mut)\">Touche une ligne pour voir la fiche du joueur ou corriger ses minutes. Le meilleur de chaque colonne est surligné.</div>";
  else gauche+="<div class=\"ms-card\" style=\"font-size:12.5px;line-height:1.5\">Rebonds, passes, temps de jeu, +/-, évaluation et fiche joueur font partie du Pack Premium.</div>";
  // Colonne de droite : quart-temps, adresse, écart au score
  var droite="<div class=\"ms-card\"><table class=\"ms-tab\"><tr><th></th>";
  for(var i=1;i<=nq;i++) droite+="<th>"+msLibQuart(i)+"</th>";
  droite+="<th>Total</th></tr>";
  [["nous",clubLabel("Nous")],["eux",m.adversaire||"Adversaire"]].forEach(function(x){
    droite+="<tr><td>"+authEsc(x[1])+"</td>";
    for(var i=0;i<nq;i++) droite+="<td>"+(r.parQuart[x[0]][i]!=null?r.parQuart[x[0]][i]:0)+"</td>";
    droite+="<td style=\"font-size:18px;font-weight:800\">"+r.score[x[0]]+"</td></tr>";
  });
  droite+="</table></div>";
  if(prem){
    var ad=msAdresse(t);
    droite+="<div class=\"ms-grid2\" style=\"grid-template-columns:repeat(3,minmax(0,1fr))\">"
      +[["Tirs",ad.tirs,t.tirs],["3 points",ad.p3,t.p3],["Lancers",ad.lf,t.lf]].map(function(x){
        return "<div class=\"ms-k\" style=\"text-align:center;padding:10px\"><div class=\"ms-lbl\" style=\"font-size:11px\">"+x[0]+"</div><div style=\"font-size:20px;font-weight:800\">"+(x[1]==null?"–":x[1]+" %")+"</div><div class=\"ms-lbl\" style=\"font-size:11px\">"+x[2].r+" / "+x[2].t+"</div></div>";
      }).join("")+"</div>";
    // Écart au score à la fin de chaque quart-temps
    var cum=0, cumE=0, barres="";
    var ecarts=[]; for(var i=0;i<nq;i++){ cum+=(r.parQuart.nous[i]||0); cumE+=(r.parQuart.eux[i]||0); ecarts.push(cum-cumE); }
    var mx=Math.max.apply(null,ecarts.map(Math.abs).concat([1]));
    barres="<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0 0 6px\">Écart au score</div><div style=\"display:flex;gap:10px;align-items:center;height:96px\">"
      +ecarts.map(function(e,i){
        var hh=Math.max(4,Math.round(Math.abs(e)*38/mx));
        return "<div style=\"flex:1;display:flex;flex-direction:column;align-items:center;font-size:12px;font-weight:800\"><div style=\"height:44px;display:flex;align-items:flex-end\">"+(e>=0?"<i style=\"display:block;width:26px;height:"+hh+"px;border-radius:5px;background:var(--dkg)\"></i>":"")+"</div><span>"+(e>0?"+":"")+e+"</span><div style=\"height:44px;display:flex;align-items:flex-start\">"+(e<0?"<i style=\"display:block;width:26px;height:"+hh+"px;border-radius:5px;background:var(--red)\"></i>":"")+"</div><small style=\"color:var(--mut);font-weight:700\">"+msLibQuart(i+1)+"</small></div>";}).join("")+"</div></div>";
    droite+=barres;
  }
  h+="<div class=\"ms-col1 ms-fcard\">"+gauche+"</div><div class=\"ms-col2 ms-fcard\">"+droite+"</div></div>";
  h+="<div class=\"ms-pied\">"
    +(prem?"<button class=\"ms-btn\" onclick=\"msExportPdf()\">Exporter en PDF</button>":"")
    +"<button class=\"ms-btn plein\" onclick=\"msCorriger()\">"+(m.statut==="termine"?"Corriger la saisie":"Reprendre la saisie")+"</button></div>";
  o.innerHTML=h;
}
function msCorriger(){
  var m=msMatch(); if(!m) return;
  if(m.statut==="termine"){ msRouvrir(m); msSauver(m, true); }
  msVue="saisie"; msDessiner();
}
function msLigneJoueur(id){
  var s=gmSheet(msNomComplet(id));
  s.modal.style.zIndex=400;
  var r=gmRow(s.body);
  r.appendChild(gmBtn("Fiche du joueur","primary",function(){ s.modal.remove(); if(typeof statsFicheJoueur==="function") statsFicheJoueur(id); }));
  r.appendChild(gmBtn("Corriger les minutes","soft",function(){
    s.modal.remove();
    var m=msMatch(); if(!m) return;
    var cur=msCalcul(m).joueurs[id];
    askPrompt("Minutes jouées par "+msNomJoueur(id),{defaultValue:String(cur?cur.min:0),type:"number",confirmText:"Enregistrer"}).then(function(v){
      if(v===null||v===undefined) return;
      var n=parseFloat(String(v).replace(",","."));
      if(isNaN(n)||n<0||n>80){ askAlert("Entre un nombre de minutes entre 0 et 80."); return; }
      m.minCorr=m.minCorr||{}; m.minCorr[id]=Math.round(n*60);
      msSauver(m, true); msFeuille(m);
    });
  }));
}

// ── Export PDF de la feuille de match ────────────────────────────
function msExportPdf(){
  var m=msMatch(); if(!m) return;
  if(!window.jspdf||!window.jspdf.jsPDF){ askAlert("Le module PDF n'est pas chargé. Réessaie dans un instant."); return; }
  var r=msCalcul(m), doc=new window.jspdf.jsPDF(), c=clubPdfRgb();
  doc.setFillColor(c[0],c[1],c[2]); doc.rect(0,0,210,24,"F");
  doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont(undefined,"bold");
  doc.text("Feuille de match - "+clubLabel("Club"),14,15);
  doc.setTextColor(20,20,31); doc.setFontSize(12);
  var y=36;
  doc.text(clubLabel("Nous")+" "+r.score.nous+" - "+r.score.eux+" "+(m.adversaire||"Adversaire"),14,y);
  doc.setFont(undefined,"normal"); doc.setFontSize(10);
  y+=7; doc.text((m.equipe||"")+" · "+(m.date||""),14,y);
  y+=8;
  var nq=r.nbQuarts, col=[14,50,64,78,92,106,120,134,148];
  doc.setFont(undefined,"bold");
  var tetes=["Quart-temps"].concat(Array.apply(null,Array(nq)).map(function(_,i){return msLibQuart(i+1);}));
  tetes.forEach(function(t,i){ doc.text(t,[14,70,84,98,112,126,140][i]||150,y); });
  doc.setFont(undefined,"normal"); y+=6;
  [["nous",clubLabel("Nous")],["eux",m.adversaire||"Adversaire"]].forEach(function(t){
    doc.text(String(t[1]).slice(0,28),14,y);
    for(var i=0;i<nq;i++) doc.text(String(r.parQuart[t[0]][i]||0),[70,84,98,112,126,140][i]||150,y);
    y+=6;
  });
  y+=6;
  var heads=["Joueur","MIN","PTS","REB","PD","INT","CT","BP","FC","+/-","EVAL"], xs=[14,76,92,106,120,134,146,158,170,182,194];
  doc.setFont(undefined,"bold"); heads.forEach(function(t,i){ doc.text(t,xs[i],y); });
  doc.setFont(undefined,"normal"); y+=2; doc.line(14,y,205,y); y+=5;
  r.ids.slice().sort(function(a,b){return r.joueurs[b].sec-r.joueurs[a].sec;}).forEach(function(id){
    var L=r.joueurs[id];
    var v=[msNomComplet(id).slice(0,26),L.min,L.pts,L.reb,L.pd,L.int,L.ct,L.bp,L.fc,(L.pm>0?"+":"")+L.pm,L.eval];
    v.forEach(function(t,i){ doc.text(String(t),xs[i],y); });
    y+=6; if(y>280){ doc.addPage(); y=20; }
  });
  var ad=msAdresse(r.equipe);
  y+=6;
  doc.text("Tirs "+(ad.tirs==null?"-":ad.tirs+" %")+" ("+r.equipe.tirs.r+"/"+r.equipe.tirs.t+")   3 pts "+(ad.p3==null?"-":ad.p3+" %")+" ("+r.equipe.p3.r+"/"+r.equipe.p3.t+")   LF "+(ad.lf==null?"-":ad.lf+" %")+" ("+r.equipe.lf.r+"/"+r.equipe.lf.t+")",14,y);
  doc.save((typeof clubSlug==="function"?clubSlug():"club")+"_feuille_match_"+(m.date||"")+".pdf");
}
