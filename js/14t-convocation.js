/* ===== 14t-convocation.js — Convocation du lundi et assiduité aux entraînements =====
   1. Assiduité d'une joueuse : présence aux entraînements de son équipe depuis le 1er septembre
      de la saison (séances pointées seulement). Les absences EXCUSÉES ne comptent pas dans le
      pourcentage : excusée = la famille a répondu « Absent » avant (fiche checkins), ou le coach
      l'a marquée excusée (ev.excuses[pid]=true ; false = non excusée, même si prévenue).
      Vert ≥ 75 %, orange 50-74 %, rouge < 50 %.
   2. Coach : carte en haut de « Mon équipe » pour le match de la semaine (≤ 7 jours) :
      « convocation à envoyer » (bouton Convoquer) ou « convocation envoyée » avec les réponses.
      La convocation s'ouvre avec les joueuses du dernier match déjà cochées (js/14 showConvocation),
      classées par assiduité.
   3. Parent : carte « Convocation · match » sur l'accueil dès l'envoi, avec Présent / Absent,
      en plus du prochain entraînement (js/19 buildParentHome).
   Rien n'est envoyé sans le coach. */

// Début de la saison en cours : 1er septembre (septembre-décembre = cette année, janvier-août = l'an passé).
function assidDebut(){ var n=new Date(), a=n.getMonth()>=8?n.getFullYear():n.getFullYear()-1; return a+"-09-01"; }

function assidEquipeDe(pid){ return getTeams().filter(function(t){ return (t.members||[]).map(String).indexOf(String(pid))>=0; })[0]||null; }
function assidMatchEquipe(e,team){ return !!(e&&team&&e.equipe&&String(e.equipe).toUpperCase().indexOf(String(team.name).toUpperCase())>=0); }

// Séances passées et pointées de l'équipe sur la période.
function assidSeances(team){
  var auj=new Date().toISOString().slice(0,10), debut=assidDebut();
  return getEvents().filter(function(e){
    return e.type==="entrainement"&&!e.cancelled&&e.date<auj&&e.date>=debut&&assidMatchEquipe(e,team)&&e.presences&&Object.keys(e.presences).length;
  });
}
function assidPrevenu(eid,pid){
  var r=(typeof repDe==="function")?repDe(eid,pid):null;
  return !!(r&&(r.statut==="absent"||r.statut==="retard"));
}
function assidExcusee(e,pid){
  var x=e.excuses&&e.excuses[pid];
  if(x===true) return true;
  if(x===false) return false;
  return assidPrevenu(e.id,pid);
}
// {present, compte, excusees, absences:[{e,excusee}], pct|null}
function assidPour(pid,team){
  team=team||assidEquipeDe(pid);
  var o={present:0,compte:0,excusees:0,absences:[],pct:null};
  if(!team) return o;
  assidSeances(team).forEach(function(e){
    var st=e.presences[pid]; if(st==null) st=e.presences[String(pid)]; if(st==null) return;
    if(st==="present"||st==="retard"){ o.present++; o.compte++; return; }
    var exc=assidExcusee(e,pid);
    o.absences.push({e:e,excusee:exc});
    if(exc) o.excusees++; else o.compte++;
  });
  o.pct=o.compte?Math.round(o.present*100/o.compte):null;
  return o;
}
function assidCouleur(p){ return p==null?"var(--mut)":(p>=75?"var(--ltg)":(p>=50?"#E8670A":"#C0392B")); }
function assidHtml(a,pid,teamId){
  var c=assidCouleur(a.pct), txt=a.pct==null?"—":a.pct+" %";
  return '<button type="button" onclick="event.preventDefault();event.stopPropagation();assidDetail(\''+authEsc(String(pid))+'\',\''+authEsc(String(teamId||""))+'\')" title="Assiduité aux entraînements (depuis septembre)" '+
    'style="margin-left:auto;flex:none;display:flex;align-items:center;gap:6px;border:0;background:none;cursor:pointer;font-size:12px;font-weight:800;color:'+c+';font-variant-numeric:tabular-nums;padding:2px 0">'+
    '<span style="width:42px;height:6px;border-radius:9px;background:var(--bdr);overflow:hidden;display:inline-block"><i style="display:block;height:100%;width:'+(a.pct||0)+'%;background:'+c+'"></i></span>'+txt+'</button>';
}
function assidSousTitre(a){
  if(!a.compte&&!a.excusees) return "Pas encore de séance pointée";
  return a.present+" / "+a.compte+" entraînement"+(a.compte>1?"s":"")+(a.excusees?" · "+a.excusees+" absence"+(a.excusees>1?"s":"")+" excusée"+(a.excusees>1?"s":""):"");
}

// Détail des absences, avec correction excusée / non excusée par le staff.
function assidDetail(pid,teamId){
  var team=getTeams().filter(function(t){ return t.id===teamId; })[0]||assidEquipeDe(pid);
  var a=assidPour(pid,team), nom=(typeof repNom==="function")?repNom(pid):"Joueuse";
  var s=gmSheet("Assiduité · "+nom), box=document.createElement("div");
  var h='<div style="font-size:13px;color:var(--txt2);margin-bottom:10px">'+authEsc(assidSousTitre(a))+(a.pct!=null?' · <b style="color:'+assidCouleur(a.pct)+'">'+a.pct+' %</b>':'')+
    '<br><span style="font-size:11.5px;color:var(--mut)">Entraînements depuis septembre. Les absences excusées ne comptent pas dans le pourcentage.</span></div>';
  if(!a.absences.length) h+='<div style="font-size:13px;color:var(--mut)">Aucune absence sur la période.</div>';
  var staff=typeof isStaffUser==="function"&&isStaffUser();
  a.absences.forEach(function(x){
    var r=(typeof repDe==="function")?repDe(x.e.id,pid):null;
    h+='<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--bdr)">'+
      '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(typeof plJourCourt==="function"?plJourCourt(x.e.date):x.e.date)+'</div>'+
      '<div style="font-size:11.5px;color:var(--mut)">'+(r&&r.motif?authEsc(r.motif):(assidPrevenu(x.e.id,pid)?"Prévenu par la famille":"Pas prévenu"))+'</div></div>'+
      (staff?'<button type="button" data-eid="'+authEsc(x.e.id)+'" data-exc="'+(x.excusee?"0":"1")+'" style="flex:none;border:0;border-radius:20px;padding:6px 12px;font-size:11.5px;font-weight:800;cursor:pointer;'+
        (x.excusee?'background:color-mix(in srgb, var(--ltg) 14%, transparent);color:var(--ltg)">Excusée':'background:rgba(192,57,43,.12);color:#C0392B">Non excusée')+'</button>'
        :'<span style="font-size:11.5px;font-weight:800;color:'+(x.excusee?'var(--ltg)':'#C0392B')+'">'+(x.excusee?"Excusée":"Non excusée")+'</span>')+'</div>';
  });
  box.innerHTML=h; s.body.appendChild(box);
  box.addEventListener("click",function(ev){
    var b=ev.target.closest("[data-eid]"); if(!b) return;
    var evs=getEvents(), i=evs.findIndex(function(x){ return x.id===b.dataset.eid; }); if(i<0) return;
    evs[i].excuses=Object.assign({},evs[i].excuses||{}); evs[i].excuses[pid]=b.dataset.exc==="1";
    saveEvents(evs); s.modal.remove(); assidDetail(pid,teamId);
    if(document.getElementById("modal-convocation")&&document.getElementById("modal-convocation").style.display==="flex"&&typeof showConvocation==="function"&&window.convocEventId) showConvocation(window.convocEventId);
  });
}

// ── Convocation : match de la semaine, dernier match convoqué ─────────────
function convocMatchSemaine(team){
  var auj=new Date().toISOString().slice(0,10), fin=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  return getEvents().filter(function(e){ return e.type==="match"&&!e.cancelled&&e.date>=auj&&e.date<=fin&&assidMatchEquipe(e,team); })
    .sort(function(a,b){ return a.date<b.date?-1:1; })[0]||null;
}
function convocDernier(ev){
  var team=assidEquipeDeEvt(ev);
  return getEvents().filter(function(e){ return e.type==="match"&&e.id!==ev.id&&e.date<ev.date&&(e.convocations||[]).length&&assidMatchEquipe(e,team); })
    .sort(function(a,b){ return a.date>b.date?-1:1; })[0]||null;
}
function assidEquipeDeEvt(ev){ return getTeams().filter(function(t){ return assidMatchEquipe(ev,t); })[0]||null; }

// Carte en haut de « Mon équipe » (coach).
function convocCarteCoach(team){
  var m=team&&convocMatchSemaine(team); if(!m) return "";
  var jour=(typeof plJourCourt==="function"?plJourCourt(m.date):m.date)+(m.heure?" · "+m.heure:"")+(m.lieu?" · "+m.lieu:"");
  var envoyee=(m.convocations||[]).length>0;
  var corps;
  if(!envoyee){
    corps='<div style="font-size:10px;font-weight:800;color:#E8670A;text-transform:uppercase;letter-spacing:1px">À faire cette semaine</div>'+
      '<div style="font-size:14px;font-weight:800;color:var(--txt);margin-top:4px">Match '+authEsc((typeof plJourCourt==="function"?plJourCourt(m.date):m.date).split(" ")[0])+' : convocation à envoyer</div>'+
      '<div style="font-size:11.5px;color:var(--mut);margin-top:2px">'+authEsc((m.titre||"")+" · "+jour)+'</div>'+
      '<button type="button" onclick="showConvocation(\''+authEsc(m.id)+'\')" style="width:100%;margin-top:10px;padding:11px;border:0;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:13px;font-weight:800;cursor:pointer">Convoquer</button>';
  } else {
    var b=(typeof repBilan==="function")?repBilan(m):{present:[],absent:[],sans:[]};
    corps='<div style="font-size:10px;font-weight:800;color:var(--ltg);text-transform:uppercase;letter-spacing:1px">Convocation envoyée</div>'+
      '<div style="font-size:14px;font-weight:800;color:var(--txt);margin-top:4px">'+authEsc(m.titre||"Match")+'</div>'+
      '<div style="font-size:11.5px;color:var(--mut);margin-top:2px">'+authEsc(jour)+'</div>'+
      '<div style="font-size:12px;font-weight:800;margin-top:8px"><span style="color:var(--ltg)">'+b.present.length+' présente'+(b.present.length>1?"s":"")+'</span> · <span style="color:#C0392B">'+b.absent.length+' absente'+(b.absent.length>1?"s":"")+'</span> · <span style="color:#E8670A">'+b.sans.length+' sans réponse</span></div>'+
      '<div style="display:flex;gap:8px;margin-top:10px">'+
        '<button type="button" onclick="repOuvrir(\''+authEsc(m.id)+'\')" style="flex:1;padding:10px;border:0;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:12.5px;font-weight:800;cursor:pointer">Voir les réponses</button>'+
        '<button type="button" onclick="showConvocation(\''+authEsc(m.id)+'\')" style="flex:1;padding:10px;border:0;border-radius:var(--rx);background:var(--bdr);color:var(--txt);font-size:12.5px;font-weight:800;cursor:pointer">Modifier</button></div>';
  }
  return '<div id="coach-convoc-carte" style="margin:0 0 10px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid '+(envoyee?'var(--ltg)':'#E8670A')+';border-radius:var(--r);padding:14px;box-shadow:0 2px 12px var(--shadow)">'+corps+'</div>';
}
function convocCarteCoachAfficher(el,team){
  if(!el||!el.parentNode) return;
  var box=document.getElementById("coach-convoc-zone");
  if(!box){ box=document.createElement("div"); box.id="coach-convoc-zone"; el.parentNode.insertBefore(box,el); }
  box.innerHTML=convocCarteCoach(team);
}

// Accueil parent : la convocation du match (si ce n'est pas déjà le prochain rendez-vous affiché).
function convocCarteParent(enfants,dejaAffiche){
  if(!enfants||!enfants.length||typeof repBoutonsHtml!=="function") return "";
  var auj=new Date().toISOString().slice(0,10), ids=enfants.map(function(c){ return String(c.id); });
  var m=getEvents().filter(function(e){ return e.type==="match"&&!e.cancelled&&e.date>=auj&&e.id!==dejaAffiche&&(e.convocations||[]).map(String).some(function(id){ return ids.indexOf(id)>=0; }); })
    .sort(function(a,b){ return a.date<b.date?-1:1; })[0];
  if(!m) return "";
  var rdv=(typeof rdvTimeFor==="function")?rdvTimeFor(m):null;
  return '<div style="margin-top:12px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid #E8670A;border-radius:var(--r);padding:16px;box-shadow:0 2px 12px var(--shadow)">'+
    '<div style="font-size:10px;font-weight:800;color:#E8670A;text-transform:uppercase;letter-spacing:1px">Convocation · match</div>'+
    '<div style="font-size:16px;font-weight:900;color:var(--txt);margin-top:6px;line-height:1.25">'+authEsc(m.titre||"Match")+'</div>'+
    '<div style="font-size:13px;color:var(--mut);margin-top:4px">'+authEsc((typeof plJourCourt==="function"?plJourCourt(m.date):m.date)+(m.heure?" · "+m.heure:"")+(m.lieu?" · "+m.lieu:""))+(rdv?' · RDV '+authEsc(rdv.txt):'')+'</div>'+
    repBoutonsHtml(m,enfants)+'</div>';
}
