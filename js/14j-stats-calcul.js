/* ===== 14j-stats-calcul.js — Stats avancées de match : calcul pur (sans écran) =====
 *
 * Un match = un document `match_stats/{eventId}` :
 *   { id, eventId, saison, equipe, adversaire, statut:"en_cours"|"termine",
 *     joueurs:[ids du match], evts:[…], q:1, dureeQ:10 (minutes), qDebut:[0,…] (secondes de jeu),
 *     chrono:{sec, depuis}, sFin, minCorr:{pid:secondes} }
 *
 * Chaque événement : { a: action, p: id joueur (null pour l'adversaire), q: quart-temps, s: secondes de jeu }.
 * Actions : voir MS_ACTIONS. « in » / « out » = entrée / sortie du terrain.
 * Tout (score, minutes, +/-, évaluation) est RECALCULÉ à partir de cette liste :
 * annuler = retirer le dernier événement, rien d'autre à défaire.
 * Ce fichier ne touche ni au DOM ni au stockage (testé dans tests/metier/stats-match.test.js).
 */
var MS_ACTIONS = {
  lf1:{lib:"+1 LF réussi", pts:1, groupe:"ok"},
  p2:{lib:"+2 pts réussi", pts:2, groupe:"ok"},
  p3:{lib:"+3 pts réussi", pts:3, groupe:"ok"},
  lfx:{lib:"LF raté", groupe:"neutre"},
  p2x:{lib:"2 pts raté", groupe:"neutre"},
  p3x:{lib:"3 pts raté", groupe:"neutre"},
  ro:{lib:"Rebond off.", groupe:"neutre"},
  rd:{lib:"Rebond déf.", groupe:"neutre"},
  pd:{lib:"Passe déc.", groupe:"neutre"},
  int:{lib:"Interception", groupe:"neutre"},
  ct:{lib:"Contre", groupe:"neutre"},
  bp:{lib:"Balle perdue", groupe:"mal"},
  fc:{lib:"Faute commise", groupe:"mal"},
  fp:{lib:"Faute provoquée", groupe:"neutre"}
};
// Ordre d'affichage des 14 boutons d'action joueur (le 15e, « Remplacement », ouvre un autre écran).
var MS_ORDRE = ["lf1","p2","p3","lfx","p2x","p3x","ro","rd","pd","int","ct","bp","fc","fp"];
// Standard : score, points et fautes. Le reste (rebonds, passes, temps de jeu, +/-…) est Premium.
var MS_ORDRE_STANDARD = ["lf1","p2","p3","fc"];
var MS_ADV = {a1:1, a2:2, a3:3};   // points de l'adversaire (+1, +2, +3)

function msPointsAction(a){
  if(MS_ACTIONS[a] && MS_ACTIONS[a].pts) return MS_ACTIONS[a].pts;
  if(MS_ADV[a]) return MS_ADV[a];
  return 0;
}
function msPct(reussis, tentes){ return tentes>0 ? Math.round(reussis*100/tentes) : null; }

// Durée (en minutes) d'un quart-temps : la durée choisie pour les 4 premiers, 5 min en prolongation.
function msDureeQuart(match, q){ return q>4 ? 5 : (Number(match && match.dureeQ)||10); }

// Secondes de jeu écoulées (le chrono ne tourne que quand il est lancé).
function msSecJeu(match, maintenant){
  var c=(match&&match.chrono)||{};
  var s=Number(c.sec)||0;
  if(c.depuis) s += Math.max(0, ((maintenant||Date.now())-Number(c.depuis))/1000);
  return Math.floor(s);
}
// Secondes restantes dans le quart-temps en cours.
function msRestantQuart(match, maintenant){
  var q=Number(match&&match.q)||1;
  var debut=((match&&match.qDebut)||[])[q-1]||0;
  return Math.max(0, msDureeQuart(match,q)*60 - (msSecJeu(match,maintenant)-debut));
}
function msMMSS(sec){
  sec=Math.max(0,Math.round(sec));
  return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
}

// Joueurs actuellement sur le terrain (rejoue les entrées / sorties).
function msTerrain(match){
  var sur=[];
  ((match&&match.evts)||[]).forEach(function(e){
    if(e.a==="in" && sur.indexOf(e.p)<0) sur.push(e.p);
    if(e.a==="out") sur=sur.filter(function(x){return x!==e.p;});
  });
  return sur;
}

function msLigneVide(){
  return {pts:0, ro:0, rd:0, reb:0, pd:0, int:0, ct:0, bp:0, fc:0, fp:0,
          lf:{r:0,t:0}, p2:{r:0,t:0}, p3:{r:0,t:0}, tirs:{r:0,t:0},
          sec:0, min:0, pm:0, eval:0};
}

// Calcul complet d'un match. opts.maintenant : pour les tests (horloge simulée).
function msCalcul(match, opts){
  opts=opts||{};
  var evts=(match&&match.evts)||[];
  var ids=((match&&match.joueurs)||[]).slice();
  evts.forEach(function(e){ if(e.p && ids.indexOf(e.p)<0) ids.push(e.p); });
  var j={}; ids.forEach(function(id){ j[id]=msLigneVide(); });

  var finS = (match && match.statut==="termine" && match.sFin!=null) ? Number(match.sFin) : msSecJeu(match, opts.maintenant);
  var surTerrain={};   // pid → seconde d'entrée
  var parQuart={nous:[], eux:[]};
  var fautesEq=[];     // fautes d'équipe par quart-temps
  var nous=0, eux=0;

  function quart(tab,q){ while(tab.length<q) tab.push(0); }

  evts.forEach(function(e){
    var q=Number(e.q)||1, s=Number(e.s)||0, L=e.p?j[e.p]:null;
    quart(parQuart.nous,q); quart(parQuart.eux,q); quart(fautesEq,q);
    if(e.a==="in"){ if(L && surTerrain[e.p]==null) surTerrain[e.p]=s; return; }
    if(e.a==="out"){
      if(L && surTerrain[e.p]!=null){ L.sec += Math.max(0, s-surTerrain[e.p]); delete surTerrain[e.p]; }
      return;
    }
    var pts=msPointsAction(e.a);
    if(MS_ADV[e.a]){
      eux+=pts; parQuart.eux[q-1]+=pts;
      Object.keys(surTerrain).forEach(function(id){ if(j[id]) j[id].pm-=pts; });
      return;
    }
    if(!L) return;
    if(pts){
      nous+=pts; parQuart.nous[q-1]+=pts; L.pts+=pts;
      Object.keys(surTerrain).forEach(function(id){ if(j[id]) j[id].pm+=pts; });
    }
    if(e.a==="lf1"){ L.lf.r++; L.lf.t++; }
    else if(e.a==="lfx"){ L.lf.t++; }
    else if(e.a==="p2"){ L.p2.r++; L.p2.t++; L.tirs.r++; L.tirs.t++; }
    else if(e.a==="p2x"){ L.p2.t++; L.tirs.t++; }
    else if(e.a==="p3"){ L.p3.r++; L.p3.t++; L.tirs.r++; L.tirs.t++; }
    else if(e.a==="p3x"){ L.p3.t++; L.tirs.t++; }
    else if(e.a==="ro"){ L.ro++; L.reb++; }
    else if(e.a==="rd"){ L.rd++; L.reb++; }
    else if(e.a==="pd"||e.a==="int"||e.a==="ct"||e.a==="bp"||e.a==="fp"){ L[e.a]++; }
    else if(e.a==="fc"){ L.fc++; fautesEq[q-1]++; }
  });
  // Joueurs encore sur le terrain à la fin (ou maintenant).
  Object.keys(surTerrain).forEach(function(id){ if(j[id]) j[id].sec += Math.max(0, finS-surTerrain[id]); });

  var tot=msLigneVide();
  ids.forEach(function(id){
    var L=j[id];
    var corr=match&&match.minCorr&&match.minCorr[id];
    if(corr!=null && corr!=="") L.sec=Number(corr)||0;
    L.min=Math.round(L.sec/60);
    L.eval = L.pts + L.reb + L.pd + L.int + L.ct + L.fp
           - ((L.tirs.t-L.tirs.r) + (L.lf.t-L.lf.r) + L.bp + L.fc);
    ["pts","ro","rd","reb","pd","int","ct","bp","fc","fp","eval"].forEach(function(k){ tot[k]+=L[k]; });
    ["lf","p2","p3","tirs"].forEach(function(k){ tot[k].r+=L[k].r; tot[k].t+=L[k].t; });
  });
  return {joueurs:j, ids:ids, equipe:tot, score:{nous:nous, eux:eux}, parQuart:parQuart, fautesEq:fautesEq,
          nbQuarts:Math.max(parQuart.nous.length,4)};
}

// Pourcentages et rapports d'un total ou d'un cumul de plusieurs matchs.
function msAdresse(L){
  var fga=L.tirs.t, fgm=L.tirs.r;
  return {
    tirs:msPct(L.tirs.r,L.tirs.t), p3:msPct(L.p3.r,L.p3.t), lf:msPct(L.lf.r,L.lf.t),
    efg: fga>0 ? Math.round((fgm+0.5*L.p3.r)*100/fga) : null,
    ratio: L.bp>0 ? Math.round(L.pd*10/L.bp)/10 : (L.pd>0 ? L.pd : null)
  };
}

// Cumul d'un joueur sur une liste de matchs (documents match_stats). Un match compte si le joueur y figure.
function msFicheJoueur(pid, matchs, opts){
  var liste=[];
  (matchs||[]).forEach(function(m){
    if(!m) return;
    var c=msCalcul(m, opts);
    if(c.joueurs[pid]) liste.push({match:m, ligne:c.joueurs[pid]});
  });
  return msFicheDepuisListe(liste);
}
// Même fiche, depuis une liste [{match:{date, adversaire}, ligne}] : sert aussi à la vue joueur/parent,
// qui ne reçoit que ses propres lignes (stats_joueurs/{pid}), jamais les matchs complets.
function msFicheDepuisListe(liste){
  liste=(liste||[]).slice();
  liste.sort(function(a,b){ return String(a.match.date||"")>String(b.match.date||"") ? 1 : -1; });
  var cumul=msLigneVide();
  liste.forEach(function(x){
    var L=x.ligne;
    ["pts","ro","rd","reb","pd","int","ct","bp","fc","fp","eval","sec","pm"].forEach(function(k){ cumul[k]+=L[k]; });
    ["lf","p2","p3","tirs"].forEach(function(k){ cumul[k].r+=L[k].r; cumul[k].t+=L[k].t; });
  });
  var n=liste.length;
  function moy(k,debut,fin){
    var part=liste.slice(debut,fin); if(!part.length) return null;
    return part.reduce(function(s,x){return s+x.ligne[k];},0)/part.length;
  }
  function arr(v){ return v==null ? null : Math.round(v*10)/10; }
  // Tendance : moyenne des 3 derniers matchs moins celle des matchs d'avant (si assez de matchs).
  function tendance(k){
    if(n<4) return null;
    return arr(moy(k,n-3,n)-moy(k,0,n-3));
  }
  var meilleur=null;
  liste.forEach(function(x){ if(!meilleur || x.ligne.eval>meilleur.ligne.eval) meilleur=x; });
  return {
    n:n, cumul:cumul, adresse:msAdresse(cumul),
    moyennes:{pts:arr(moy("pts",0,n)), reb:arr(moy("reb",0,n)), pd:arr(moy("pd",0,n)), eval:arr(moy("eval",0,n)),
              int:arr(moy("int",0,n)), min:n?Math.round(cumul.sec/60/n*10)/10:null},
    tendances:{pts:tendance("pts"), reb:tendance("reb"), pd:tendance("pd"), eval:tendance("eval")},
    matchs:liste.map(function(x,i){ return {nom:"M"+(i+1), date:x.match.date||"", adversaire:x.match.adversaire||"", eval:x.ligne.eval, pts:x.ligne.pts}; }),
    meilleur: meilleur ? {nom:"M"+(liste.indexOf(meilleur)+1), pts:meilleur.ligne.pts, reb:meilleur.ligne.reb, pd:meilleur.ligne.pd, eval:meilleur.ligne.eval} : null
  };
}

// Lignes de chaque joueur sur une liste de matchs : {pid: [{eventId, date, adversaire, nous, eux, ligne}]}.
// C'est tout ce qui est publié pour un joueur (ses chiffres, le score final), rien sur ses coéquipiers.
function msLignesJoueurs(matchs, opts){
  var out={};
  (matchs||[]).forEach(function(m){
    if(!m||m.statut!=="termine") return;
    var c=msCalcul(m, opts);
    c.ids.forEach(function(pid){
      var L=c.joueurs[pid];
      var joue=L.sec>0||L.pts||L.reb||L.pd||L.fc||L.tirs.t||L.lf.t||(m.joueurs||[]).indexOf(pid)>=0;
      if(!joue) return;
      (out[pid]=out[pid]||[]).push({eventId:String(m.eventId||m.id||""), date:m.date||"", adversaire:m.adversaire||"", saison:m.saison||"",
        nous:c.score.nous, eux:c.score.eux, ligne:L});
    });
  });
  Object.keys(out).forEach(function(pid){ out[pid].sort(function(a,b){ return String(a.date)>String(b.date)?1:-1; }); });
  return out;
}
function msFicheDepuisLignes(lignes){
  return msFicheDepuisListe((lignes||[]).map(function(x){ return {match:{date:x.date, adversaire:x.adversaire}, ligne:x.ligne}; }));
}

// Nouveau match vide.
function msNouveau(ev, joueurs, saison, dureeQ){
  return {
    id:String(ev.id), eventId:String(ev.id), saison:saison||"", equipe:ev.equipe||"", date:ev.date||"",
    adversaire:(ev.score&&ev.score.adversaire)||"", statut:"en_cours",
    joueurs:joueurs.slice(), evts:[], q:1, dureeQ:dureeQ||10, qDebut:[0],
    chrono:{sec:0, depuis:null}, sFin:null, minCorr:{}
  };
}
// Ajoute un événement à l'instant présent (retourne l'événement).
function msAjouter(match, action, pid, maintenant){
  var e={a:action, p:pid||null, q:Number(match.q)||1, s:msSecJeu(match, maintenant)};
  match.evts.push(e);
  return e;
}
// Annule le dernier événement ; si c'est un changement (sortie + entrée au même instant), annule les deux.
function msAnnuler(match){
  var ev=match.evts, d=ev[ev.length-1];
  if(!d) return null;
  ev.pop();
  if(d.a==="in" && ev.length && ev[ev.length-1].a==="out" && ev[ev.length-1].s===d.s) ev.pop();
  return d;
}
function msChronoMarche(match){ return !!(match.chrono && match.chrono.depuis); }
function msChronoPause(match, maintenant){
  if(!match.chrono) match.chrono={sec:0,depuis:null};
  match.chrono.sec=msSecJeu(match, maintenant); match.chrono.depuis=null;
}
function msChronoDemarre(match, maintenant){
  if(!match.chrono) match.chrono={sec:0,depuis:null};
  if(!match.chrono.depuis) match.chrono.depuis=maintenant||Date.now();
}
// Quart-temps suivant : met le chrono en pause et note le début du nouveau quart-temps.
function msQuartSuivant(match, maintenant){
  msChronoPause(match, maintenant);
  var q=(Number(match.q)||1)+1;
  match.qDebut=match.qDebut||[0];
  while(match.qDebut.length<q-1) match.qDebut.push(match.chrono.sec);
  match.qDebut[q-1]=match.chrono.sec;
  match.q=q;
  return q;
}
function msTerminer(match, maintenant){
  msChronoPause(match, maintenant);
  match.statut="termine"; match.sFin=match.chrono.sec;
}
function msRouvrir(match){ match.statut="en_cours"; match.sFin=null; }
function msLibQuart(q){ return q>4 ? "P"+(q-4) : "Q"+q; }

// ── Tableau de saison d'une équipe (écran « Stats équipe ») ──────────
// matchs : documents match_stats terminés (déjà filtrés par saison / équipe / période).
// Résultat : bilan, points pour / contre par match, adresse et ratio de l'équipe, leaders et une ligne par joueur.
function msEquipeSaison(matchs, opts){
  var liste=(matchs||[]).filter(function(m){return m&&m.statut==="termine";});
  liste.sort(function(a,b){ return String(a.date||"")>String(b.date||"") ? 1 : -1; });
  var v=0,d=0,n=0,pour=0,contre=0, tot=msLigneVide(), serie=[];
  var ids=[];
  liste.forEach(function(m){
    var c=msCalcul(m,opts);
    n++; pour+=c.score.nous; contre+=c.score.eux;
    if(c.score.nous>c.score.eux){ v++; serie.push("V"); } else if(c.score.nous<c.score.eux){ d++; serie.push("D"); } else serie.push("N");
    ["pts","ro","rd","reb","pd","int","ct","bp","fc","fp","eval"].forEach(function(k){ tot[k]+=c.equipe[k]; });
    ["lf","p2","p3","tirs"].forEach(function(k){ tot[k].r+=c.equipe[k].r; tot[k].t+=c.equipe[k].t; });
    c.ids.forEach(function(id){ if(ids.indexOf(id)<0) ids.push(id); });
  });
  // Victoires (ou défaites) de suite à la fin de la série.
  var suite=0, dernier=serie.length?serie[serie.length-1]:"";
  for(var i=serie.length-1;i>=0&&serie[i]===dernier;i--) suite++;
  function moy(x){ return n?Math.round(x*10/n)/10:null; }
  var joueurs=ids.map(function(id){
    var f=msFicheJoueur(id,liste,opts);
    return {id:id, n:f.n, min:f.moyennes.min, pts:f.moyennes.pts, reb:f.moyennes.reb, pd:f.moyennes.pd,
            eval:f.moyennes.eval, adresse:f.adresse, evals:f.matchs.map(function(x){return x.eval;})};
  }).filter(function(j){return j.n>0;});
  function leaders(cle){
    return joueurs.filter(function(j){return j[cle]!=null;}).sort(function(a,b){return b[cle]-a[cle];}).slice(0,3);
  }
  return {
    n:n, v:v, d:d, nuls:n-v-d, suite:{type:dernier, n:suite},
    pour:moy(pour), contre:moy(contre), adresse:msAdresse(tot), total:tot,
    joueurs:joueurs.sort(function(a,b){return (b.eval||0)-(a.eval||0);}),
    leaders:{pts:leaders("pts"), reb:leaders("reb"), pd:leaders("pd"), eval:leaders("eval")}
  };
}
