/* ===== 14s-reponses.js — Présent / Absent : la réponse des familles à chaque rendez-vous =====
   Pour chaque entraînement, match ou événement d'équipe à venir, le parent (ou l'enfant sur son
   propre compte) répond Présent ou Absent pour chaque enfant rattaché. Rien n'est supposé :
   sans réponse = « sans réponse », et le coach peut relancer.
   Données : clubs/{id}/reponses/{eventId}__{playerId} = {id, eventId, playerId, statut, motif, par, at}
   (règle Firestore : le staff, ou le compte rattaché à ce joueur, et rien d'autre). Lu par tous les
   membres (synchro asmb_reponses, js/13).
   Attendus d'un rendez-vous : les convoqués s'il y en a (matchs), sinon les joueurs de l'équipe.
   Une absence envoie aussi le message habituel dans le canal de l'équipe. */

function getReponses(){ try{ return JSON.parse(localStorage.getItem("asmb_reponses")||"[]"); }catch(e){ return []; } }
function repId(eid,pid){ return String(eid)+"__"+String(pid); }
function repDe(eid,pid){ var id=repId(eid,pid); return getReponses().filter(function(r){ return r.id===id; })[0]||null; }

function repEquipe(e){
  if(!e||!e.equipe) return null;
  var eq=String(e.equipe).toUpperCase();
  return getTeams().filter(function(t){ return t.name&&eq.indexOf(String(t.name).toUpperCase())>=0; })[0]||null;
}
// Joueurs attendus (ids) : convoqués, sinon l'équipe.
function repAttendus(e){
  if(e&&Array.isArray(e.convocations)&&e.convocations.length) return e.convocations.map(String);
  var t=repEquipe(e); return t?(t.members||[]).map(String):[];
}
function repConcerne(e){
  var auj=new Date().toISOString().slice(0,10);
  return !!e&&!e.cancelled&&(e.dateFin||e.date)>=auj&&repAttendus(e).length>0;
}
function repBilan(e){
  var ids=repAttendus(e), b={present:[],absent:[],sans:[]};
  ids.forEach(function(pid){ var r=repDe(e.id,pid); (r&&b[r.statut]?b[r.statut]:b.sans).push(pid); });
  return b;
}
function repNom(pid){
  var l=(typeof getPlayers==="function"?getPlayers():[]).concat(typeof getRoster==="function"?getRoster():[]);
  var p=l.filter(function(x){ return String(x.id)===String(pid); })[0];
  return p?((p.prenom||"")+" "+(p.nom||"")).trim():"Joueur";
}

// ── Réponse (parent ou enfant) ─────────────────────────────────
async function repRepondre(eid,pid,statut){
  var e=getEvents().filter(function(x){ return x.id===eid; })[0]; if(!e) return;
  var motif="";
  if(statut==="absent"){
    var m=await askPrompt("Motif de l'absence", {placeholder:"Optionnel", confirmText:"Envoyer"});
    if(m===null) return;
    motif=String(m||"").trim().slice(0,200);
  }
  var u=window.ASMB_USER||{};
  var doc={id:repId(eid,pid),eventId:String(eid),playerId:String(pid),statut:statut,motif:motif,par:u.uid||"",at:Date.now()};
  // Tout de suite à l'écran, puis envoyé (la synchro remet l'état du serveur).
  var l=getReponses().filter(function(r){ return r.id!==doc.id; }); l.push(doc);
  localStorage.setItem("asmb_reponses",JSON.stringify(l));
  if(window.fbSetDoc&&window.fbDb){
    window.fbSetDoc(window.fbDoc(window.fbDb,"reponses",doc.id),doc).catch(function(err){
      if(typeof showToast==="function") showToast("Réponse non enregistrée, réessayez");
      console.log("reponse:",err&&err.code);
    });
  }
  if(statut==="absent"&&!window.GM_DEMO&&window.fbAddDoc&&typeof findChannelForTeamText==="function"){
    try{
      var nom=repNom(pid), ch=findChannelForTeamText(e.equipe);
      if(ch) window.fbAddDoc(window.fbCollection(window.fbDb,"channels",ch,"messages"),{
        text:" Absence signalée\n"+nom+" sera absent(e) pour \""+e.titre+"\" le "+e.date+(motif?"\nMotif : "+motif:""),
        pseudo:" "+(u.prenom||"Parent"),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]}).catch(function(){});
    }catch(x){}
  }
  if(typeof showToast==="function") showToast(statut==="present"?"Présence confirmée":"Absence enregistrée");
  if(typeof refreshCurrentScreen==="function") refreshCurrentScreen();
}

// Boutons d'un enfant pour un rendez-vous (carte « Prochain événement »).
function repBoutonsHtml(e,enfants){
  if(!repConcerne(e)) return "";
  var att=repAttendus(e), h="";
  (enfants||[]).forEach(function(c){
    if(att.indexOf(String(c.id))<0) return;
    var r=repDe(e.id,c.id), st=r&&r.statut, prenom=authEsc(c.prenom||"Mon enfant");
    var b=function(val,lib,coul){
      var on=st===val;
      return '<button type="button" onclick="repRepondre(\''+authEsc(e.id)+'\',\''+authEsc(String(c.id))+'\',\''+val+'\')" style="flex:1;padding:10px;border-radius:var(--rx);font-size:13px;font-weight:800;cursor:pointer;'+
        (on?'border:none;background:'+coul+';color:#fff':'border:1.5px solid '+coul+';background:transparent;color:'+coul)+'">'+lib+'</button>';
    };
    h+='<div style="margin-top:12px"><div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:6px">'+prenom+(st?'':' · <span style="color:#E8670A">réponse attendue</span>')+'</div>'+
      '<div style="display:flex;gap:8px">'+b("present","✓ Présent(e)","var(--ltg)")+b("absent","✕ Absent(e)","#C0392B")+'</div>'+
      (st==="absent"&&r.motif?'<div style="font-size:11px;color:var(--mut);margin-top:5px">Motif : '+authEsc(r.motif)+'</div>':'')+'</div>';
  });
  return h;
}

// ── Côté staff : badge sur la carte du planning + détail avec relance ──
function repBadge(e){
  if(!repConcerne(e)||typeof isStaffUser!=="function"||!isStaffUser()) return "";
  var b=repBilan(e);
  return '<div><button type="button" onclick="event.stopPropagation();repOuvrir(\''+authEsc(e.id)+'\')" style="margin-top:6px;font-size:11px;font-weight:700;border:none;border-radius:8px;padding:5px 9px;cursor:pointer;background:var(--bdr);color:var(--txt)">'+
    '<span style="color:var(--ltg)">✓ '+b.present.length+'</span> · <span style="color:#C0392B">✕ '+b.absent.length+'</span> · <span style="color:#E8670A">? '+b.sans.length+'</span></button></div>';
}
function repOuvrir(eid){
  var e=getEvents().filter(function(x){ return x.id===eid; })[0]; if(!e) return;
  var s=gmSheet("Réponses · "+(e.titre||eventTypeLabel(e.type))), b=repBilan(e);
  var bloc=function(titre,coul,ids,motifs){
    var h='<div style="font-size:11px;font-weight:800;color:'+coul+';text-transform:uppercase;letter-spacing:.6px;margin:12px 0 6px">'+titre+' ('+ids.length+')</div>';
    if(!ids.length) return h+'<div style="font-size:12px;color:var(--mut)">Personne</div>';
    return h+ids.map(function(pid){ var r=motifs?repDe(e.id,pid):null;
      return '<div style="font-size:13px;color:var(--txt);padding:5px 0;border-bottom:1px solid var(--bdr)">'+authEsc(repNom(pid))+(r&&r.motif?' <span style="color:var(--mut);font-size:11px">· '+authEsc(r.motif)+'</span>':'')+'</div>'; }).join("");
  };
  var box=document.createElement("div");
  box.innerHTML='<div style="font-size:12px;color:var(--mut)">'+authEsc((typeof plJourCourt==="function"?plJourCourt(e.date):e.date)+(e.heure?" · "+e.heure:""))+'</div>'+
    bloc("Sans réponse","#E8670A",b.sans)+bloc("Absents","#C0392B",b.absent,true)+bloc("Présents","var(--ltg)",b.present);
  s.body.appendChild(box);
  if(b.sans.length) s.body.appendChild(gmBtn("Relancer les "+b.sans.length+" sans réponse","primary",function(){ repRelancer(e,b.sans); s.modal.remove(); }));
}
// Relance : un message dans le canal de l'équipe (notification aux familles), avec les prénoms.
function repRelancer(e,ids){
  var noms=ids.map(function(pid){ return repNom(pid).split(" ")[0]; }).join(", ");
  var txt="Réponse attendue pour « "+(e.titre||eventTypeLabel(e.type))+" » ("+(typeof plJourCourt==="function"?plJourCourt(e.date):e.date)+(e.heure?" · "+e.heure:"")+") : "+noms+
    ". Merci d'indiquer Présent ou Absent sur l'accueil de l'appli.";
  if(window.GM_DEMO){ askAlert("Relance envoyée dans le canal de l'équipe :\n\n"+txt); return; }
  var ch=(typeof findChannelForTeamText==="function")?findChannelForTeamText(e.equipe):null;
  if(!ch||!window.fbAddDoc){ askAlert("Canal de l'équipe introuvable."); return; }
  window.fbAddDoc(window.fbCollection(window.fbDb,"channels",ch,"messages"),{text:txt,pseudo:clubPseudo("Coach"),ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]})
    .then(function(){ if(typeof showToast==="function") showToast("Relance envoyée dans le canal"); })
    .catch(function(){ askAlert("La relance n'a pas pu partir. Réessayez."); });
}
