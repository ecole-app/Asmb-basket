/* ===== 14n-eval-stage.js — Évaluation en direct d'un stage : qui évaluer, jour par jour =====
 * Les évaluations (écran « Évaluer » d'un stage, 13-firestore-sync.js) concernent :
 *   - les joueurs du club cochés sur l'événement (participantsClub) ;
 *   - les invités externes saisis à la main (participantsExternes) ;
 *   - TOUS les inscrits du stage qui ne sont pas annulés (evt_inscrits, 14b) : licenciés rapprochés
 *     d'une fiche joueur et extérieurs. Sur un stage « jours au choix », seuls ceux inscrits ce jour-là.
 * Un stage de plusieurs jours s'évalue jour par jour : clé `eventId__AAAA-MM-JJ` dans la collection
 * `evaluations` (un stage d'un seul jour garde la clé `eventId`, comme avant).
 */
var evalJour=null, evalInscrits={};     // jour affiché ; inscrits chargés par événement

function evalNorm(s){ return String(s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim(); }
function evalJoursStage(ev){
  var j=(typeof evtJoursPlage==="function")?evtJoursPlage(ev.date,ev.dateFin):[];
  return j.length>1?j:[];
}
function evalCle(eventId, jour){ return jour?String(eventId)+"__"+jour:String(eventId); }
function evalCleCourante(){ return evalCle(currentEvalEventId, evalJour); }

// Liste des personnes à évaluer (fonction pure, testée dans tests/metier/eval-stage.test.js).
function evalParticipants(ev, inscrits, jour, players){
  var out=[], vus={};
  function ajouter(p){ if(vus[p.key]) return; vus[p.key]=1; out.push(p); }
  var parJour=!!(ev.inscr&&ev.inscr.parJour);
  (players||[]).forEach(function(p){
    if((ev.participantsClub||[]).map(String).indexOf(String(p.id))>=0) ajouter({key:String(p.id),prenom:p.prenom||"",nom:p.nom||"",ext:false});
  });
  (ev.participantsExternes||[]).forEach(function(x){
    if(x&&x.nom) ajouter({key:"x_"+evalNorm(x.nom),prenom:"",nom:x.nom,ext:true});
  });
  (inscrits||[]).forEach(function(x){
    if(!x||x.statut==="annule") return;
    if(jour&&parJour&&(x.jours||[]).indexOf(jour)<0) return;
    var joueur=x.playerId?(players||[]).filter(function(p){return String(p.id)===String(x.playerId);})[0]:null;
    if(joueur) ajouter({key:String(joueur.id),prenom:joueur.prenom||"",nom:joueur.nom||"",ext:false});
    else ajouter({key:"i_"+(x._id||evalNorm(x.nom+" "+x.prenom)),prenom:x.prenom||"",nom:x.nom||"",ext:!x.playerId});
  });
  return out.sort(function(a,b){ return evalNorm(a.nom).localeCompare(evalNorm(b.nom))||evalNorm(a.prenom).localeCompare(evalNorm(b.prenom)); });
}

// Charge les inscrits du stage (une fois), puis réaffiche l'écran.
function evalChargerInscrits(eventId){
  var ev=getEvents().find(function(e){return e.id===eventId;});
  if(!ev||!ev.inscr||!window.fbDb||!window.fbGetDocs||evalInscrits[eventId]!==undefined) return;
  evalInscrits[eventId]=null;   // chargement en cours
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_inscrits"),window.fbWhere("eventId","==",String(eventId))))
    .then(function(snap){
      var a=[]; snap.forEach(function(d){ var v=d.data(); v._id=d.id; a.push(v); });
      evalInscrits[eventId]=a;
      if(currentEvalEventId===eventId) buildLiveEval();
    }).catch(function(e){ evalInscrits[eventId]=[]; console.log("inscrits stage:",(e&&e.code)||e); });
}
function evalChoisirJour(j){ evalJour=j; buildLiveEval(); }
