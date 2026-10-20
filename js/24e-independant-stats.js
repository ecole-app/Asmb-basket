/* ===== 24e-independant-stats.js — stats perso de l'indépendant (Premium) ===== */
// Les réservations ne sont chargées que sur 14 jours (IND_PASSE) : pour compter sur plusieurs mois, chaque
// présence pointée laisse une trace légère dans `indep_presences/{séance}__{personne}`
// {pid, compte, date, seance} (écrite pour toutes les formules, pour que l'historique existe déjà au
// passage en Premium ; supprimée si la présence est retirée). Seul l'indépendant la lit (120 jours).
// L'écran « Stats » (Premium) montre le mois en cours comparé au précédent et les clients à relancer
// (aucune venue depuis IND_RELANCE_JOURS jours), avec un SMS pré-rempli à envoyer à la main.
var IND_STATS_JOURS=120, IND_RELANCE_JOURS=21;

// ── Fonctions pures ──────────────────────────────────────────────────
function indStatsJoursEntre(a,b){ return Math.round((new Date(b+"T12:00:00")-new Date(a+"T12:00:00"))/86400000); }
function indStatsMoisPrec(iso){
  var y=+iso.slice(0,4), m=+iso.slice(5,7)-1;
  var d=new Date(y,m-1,1); return d.getFullYear()+"-"+("0"+(d.getMonth()+1)).slice(-2);
}
function indStatsUnMois(presences,lignes,cle){
  var seances={}, nb=0;
  presences.forEach(function(p){ if((p.date||"").slice(0,7)===cle){ seances[p.seance]=1; nb++; } });
  var n=Object.keys(seances).length, enc=0;
  lignes.forEach(function(l){ if(l.statut==="paye" && (l.datePaiement||"").slice(0,7)===cle) enc+=Number(l.montant)||0; });
  return {seances:n, presents:nb, moyenne:n?Math.round(nb/n*10)/10:0, encaisse:Math.round(enc*100)/100};
}
function indStatsMois(presences,lignes,aujIso){
  var cle=aujIso.slice(0,7);
  return {mois:indStatsUnMois(presences,lignes,cle), prec:indStatsUnMois(presences,lignes,indStatsMoisPrec(cle))};
}
// Personnes venues au moins une fois (dans l'historique gardé) mais pas depuis `jours` jours, les plus
// anciennes d'abord.
function indStatsARelancer(presences,aujIso,jours){
  var derniere={};
  presences.forEach(function(p){ if(p.pid && p.date && (!derniere[p.pid] || p.date>derniere[p.pid])) derniere[p.pid]=p.date; });
  return Object.keys(derniere).map(function(pid){ return {pid:pid, derniere:derniere[pid], jours:indStatsJoursEntre(derniere[pid],aujIso)}; })
    .filter(function(x){ return x.jours>=(jours||IND_RELANCE_JOURS); })
    .sort(function(a,b){ return b.jours-a.jours; });
}

// ── Données ──────────────────────────────────────────────────────────
function indStatsEcouter(ecoute,db){
  if(IND.role!=="coach") return;
  var debut=indAjout(indAuj(),-IND_STATS_JOURS);
  ecoute(window.fbQuery(window.fbCollection(db,"indep_presences"),window.fbWhere("date",">=",debut)),function(sn){
    var m={}; sn.forEach(function(d){ m[d.id]=d.data(); }); IND.presences=m;
  });
}
// Appelé par indPresence (24) à chaque pointage.
function indStatsPresence(s,pid,present){
  if(IND.role!=="coach") return;
  var k=s.id+"__"+pid, ref=window.fbDoc(indDb(),"indep_presences",k);
  IND.presences=IND.presences||{};
  if(present){
    var d={pid:pid, compte:(typeof indCompteDe==="function"?indCompteDe(pid):pid), date:s.date, seance:s.id};
    IND.presences[k]=d;
    window.fbSetDoc(ref,d).catch(function(e){ console.log("indépendant (stats):",e&&e.code||e); });
  } else {
    delete IND.presences[k];
    window.fbDeleteDoc(ref).catch(function(e){ console.log("indépendant (stats):",e&&e.code||e); });
  }
}

// ── Écran ────────────────────────────────────────────────────────────
function indTelDe(pid){
  var c=IND.clients[pid]||{}, par=(typeof indParentDe==="function")?indParentDe(c):null;
  return String((c.mineur&&par?par.tel:c.tel)||"").replace(/[^+0-9]/g,"");
}
function indStatsEvol(a,b,euro){
  var d=Math.round((a-b)*100)/100;
  if(!b && !a) return "";
  if(d===0) return "comme le mois dernier";
  return (d>0?"+":"")+(euro?indEuros(d):String(d).replace(".",","))+" vs mois dernier";
}
function indStats(){
  var sh=gmSheet("Stats");
  sh.body.classList.add("ind-t"); sh.body.style.setProperty("--ia",indCouleur());
  var pres=Object.keys(IND.presences||{}).map(function(k){ return IND.presences[k]; });
  var r=indStatsMois(pres,indLignes(),indAuj()), m=r.mois, p=r.prec;
  var h='<div class="ind-stats"><div class="ind-c"><div class="ind-big">'+m.seances+'</div><span>séance'+(m.seances>1?"s":"")+' ce mois-ci</span><span style="display:block">'+indEsc(indStatsEvol(m.seances,p.seances,false))+'</span></div>'
    +'<div class="ind-c"><div class="ind-big">'+indEsc(String(m.moyenne).replace(".",","))+'</div><span>présents en moyenne</span><span style="display:block">'+indEsc(indStatsEvol(m.moyenne,p.moyenne,false))+'</span></div></div>'
    +'<div class="ind-c"><div class="ind-big">'+indEsc(indEuros(m.encaisse))+'</div><span>encaissé ce mois-ci</span><span style="display:block">'+indEsc(indStatsEvol(m.encaisse,p.encaisse,true))+'</span></div>';
  var rel=indStatsARelancer(pres,indAuj(),IND_RELANCE_JOURS);
  h+='<div class="ind-k">À relancer · sans venir depuis '+IND_RELANCE_JOURS+' jours</div>';
  h+=rel.length?'<div class="ind-c ind-list">'+rel.slice(0,10).map(function(x){
    var tel=indTelDe(x.pid), prenom=((IND.clients[x.pid]||{}).prenom||"");
    return '<div class="ind-row"><div class="t"><strong>'+indEsc(indNom(x.pid,"Client"))+'</strong><span>'+indEsc("dernière venue le "+indFr(x.derniere)+" · "+x.jours+" jours")+'</span></div>'
      +(tel?'<a class="ind-btn s mini" style="text-decoration:none" data-sms="'+indEsc(tel)+'" data-p="'+indEsc(prenom)+'" href="#">SMS</a>':'')+'</div>';
  }).join("")+'</div>':'<div class="ind-c ind-vide">Personne à relancer pour l\'instant.</div>';
  h+='<p class="ind-note" style="margin-top:10px">Les stats se construisent à partir des présences pointées depuis la mise en place de cet écran.</p>';
  sh.body.innerHTML=h;
  sh.body.addEventListener("click",function(e){
    var a=e.target.closest("a[data-sms]"); if(!a) return; e.preventDefault();
    var pr=a.dataset.p, txt="Bonjour"+(pr?" "+pr:"")+", ça fait un moment qu'on ne t'a pas vu à l'entraînement. Tout va bien ? À bientôt !";
    location.href="sms:"+a.dataset.sms+"?&body="+encodeURIComponent(txt);
  });
}
function indStatsClic(act){ if(act==="stats"){ indStats(); return true; } return false; }
