/* ===== 14o-responsable-evt.js — Responsable d'un événement (stage…) =====
 * Le dirigeant / directeur technique désigne, dans la fiche de l'événement, un compte du staff
 * (`ev.responsableUid`, `ev.responsableNom`). Ce responsable gère les inscriptions (liste, validation)
 * ou les délègue (code bénévole d'entrée). Sur son accueil, un bandeau l'envoie vers l'écran des
 * entrées (`evtEntree`) et la liste des inscrits (`evtTableau`) le jour J puis chaque jour jusqu'à
 * la fin de l'événement. Les accès restent ceux des règles Firestore (staff = dirigeant ou coach).
 */
var respUsers=null;

function respJourLocal(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }

// Événements dont je suis responsable et qui sont en cours (du jour J à la dernière date). Fonction pure.
function respMesEvenements(events, uid, auj){
  if(!uid) return [];
  return (events||[]).filter(function(e){
    return e&&e.responsableUid===uid&&e.date&&e.statut!=="annule"&&auj>=e.date&&auj<=(e.dateFin&&e.dateFin>=e.date?e.dateFin:e.date);
  }).sort(function(a,b){ return String(a.date).localeCompare(String(b.date)); });
}

// Liste déroulante du formulaire d'événement (comptes dirigeant/coach du club).
function respRemplirChoix(valeur){
  var sel=document.getElementById("ev-responsable"); if(!sel) return;
  function peindre(){
    var l=(respUsers||[]).slice();
    if(valeur&&!l.some(function(u){return u._uid===valeur;})) l.push({_uid:valeur,prenom:"(compte introuvable)",nom:""});
    sel.innerHTML='<option value="">— Aucun —</option>'+l.map(function(u){
      var n=((u.prenom||"")+" "+(u.nom||"")).trim()||u.email||u._uid;
      return '<option value="'+authEsc(u._uid)+'">'+authEsc(n)+'</option>';
    }).join("");
    sel.value=valeur||"";
  }
  peindre();
  if(respUsers!==null||!window.fbGetDocs||!window.fbDb||!window.CURRENT_CLUB_ID) return;
  respUsers=[];
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
    var a=[]; snap.forEach(function(d){ var v=d.data(); v._uid=d.id; if((v.roles||[]).some(function(r){return r==="dirigeant"||r==="coach";})) a.push(v); });
    respUsers=a.sort(function(x,y){ return ((x.prenom||"")+(x.nom||"")).localeCompare((y.prenom||"")+(y.nom||"")); });
    var cur=sel.value||valeur; valeur=cur; peindre();
  }).catch(function(){ respUsers=null; });
}
function respLireChoix(){
  var sel=document.getElementById("ev-responsable");
  if(!sel) return {uid:undefined,nom:undefined};
  var uid=sel.value||"", o=sel.options[sel.selectedIndex];
  return {uid:uid, nom:uid&&o?o.textContent:""};
}

// Bandeau d'accueil : à poser devant le bloc repéré (même principe que benBandeau).
function respBandeau(refId,marge){
  var ref=document.getElementById(refId); if(!ref||!ref.parentNode) return;
  var id="resp-"+refId, box=document.getElementById(id);
  var uid=window.ASMB_USER&&window.ASMB_USER.uid;
  var ms=(typeof getEvents==="function")?respMesEvenements(getEvents(),uid,respJourLocal()):[];
  if(!ms.length){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement("div"); box.id=id; ref.parentNode.insertBefore(box,ref); }
  box.style.cssText="margin:"+(marge||"0 0 14px")+";padding:14px 16px;border-radius:var(--rs);background:color-mix(in srgb, var(--dkg) 10%, var(--card));border:1.5px solid var(--dkg)";
  box.innerHTML='<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:var(--dkg);margin-bottom:6px">🎟️ Vous êtes responsable</div>'+
    ms.map(function(e){
      var eid=authEsc(e.id), insc=!!e.inscr;
      return '<div style="margin-top:8px"><div style="font-size:15px;font-weight:900;color:var(--txt)">'+authEsc(e.titre||"")+'</div>'+
        '<div style="font-size:12px;color:var(--txt2);margin-bottom:8px">'+(typeof evtDateTxt==="function"?authEsc(evtDateTxt(e)):authEsc(e.date))+'</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
        (insc?'<button type="button" onclick="evtEntree(\''+eid+'\')" style="padding:10px 16px;border-radius:20px;background:var(--dkg);color:#fff;font-size:13px;font-weight:800;border:none;cursor:pointer">🎟️ Entrées du jour</button>':'')+
        '<button type="button" onclick="evtTableau(\''+eid+'\')" style="padding:10px 16px;border-radius:20px;background:var(--card);color:var(--dkg);font-size:13px;font-weight:800;border:1.5px solid var(--dkg);cursor:pointer">📋 Inscrits</button>'+
        '</div></div>';
    }).join("");
}
function respBandeaux(){
  respBandeau("dashboard-dirigeant","0 12px 14px");
  respBandeau("coach-matchday-banner","12px 0 0");
}
