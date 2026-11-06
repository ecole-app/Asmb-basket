// ── Bénévole avec compte (rôle « benevole ») ─────────────────────────────
// Invité par un lien comme un coach (js/20b), il renseigne ses infos, et le dirigeant choisit les canaux de la
// Communauté qu'il voit (`users/{uid}.canaux`, posé par l'invitation : `club_invites.canauxIds`). Rôle limité :
// accueil (ses missions, « Je viens / Je ne peux pas », matchs à domicile, outils), Communauté (ses canaux), Paramètres.
// Il ne voit ni licences, ni comptabilité, ni fiches joueurs. Sa réponse à une mission : `checkins/{eventId}_ben_{uid}`.
var BENEV_REPONSES={};   // "eventId|missionId" -> "present" | "absent"

function benevCanauxDispo(){
  return window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(snap){
    var l=[]; snap.forEach(function(d){ var c=d.data()||{}; if(c.evt||c.dm||c.kind==="dm") return; l.push({id:d.id,name:c.name||d.id,icon:c.icon||"💬"}); });
    var ordre={general:0,evenements:1};
    return l.sort(function(a,b){ return (ordre[a.id]!==undefined?ordre[a.id]:9)-(ordre[b.id]!==undefined?ordre[b.id]:9)||String(a.name).localeCompare(String(b.name)); });
  });
}

// Invitation : numéro (pour relier ses missions) + canaux ouverts. Lien à usage unique, 7 jours.
function benevInviter(){
  var clubId=window.CURRENT_CLUB_ID, clubName=(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"";
  if(!clubId) return;
  var s=gmSheet("Inviter un bénévole");
  var intro=document.createElement("div"); intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px";
  intro.textContent="Le bénévole crée son compte avec le lien et renseigne ses infos. Il n'a qu'un accès basique : ses missions, la Communauté (les canaux cochés) et ses paramètres. Jamais les licences, la comptabilité ni les fiches joueurs.";
  s.body.appendChild(intro);
  var lt=document.createElement("div"); lt.className="form-label"; lt.textContent="Son téléphone (pour retrouver ses missions)"; s.body.appendChild(lt);
  var tel=document.createElement("input"); tel.type="tel"; tel.className="form-input"; tel.placeholder="0612345678"; tel.maxLength=20; tel.style.marginBottom="12px"; s.body.appendChild(tel);
  var lc=document.createElement("div"); lc.className="form-label"; lc.textContent="Canaux de la Communauté qu'il peut voir"; s.body.appendChild(lc);
  var liste=document.createElement("div"); liste.style.cssText="display:grid;gap:6px;margin-bottom:14px"; s.body.appendChild(liste);
  liste.textContent="Chargement…";
  var cases=[];
  benevCanauxDispo().then(function(l){
    liste.textContent="";
    if(!l.length){ liste.textContent="Aucun canal pour l'instant."; return; }
    l.forEach(function(c){
      var lab=document.createElement("label"); lab.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;font-size:13.5px;font-weight:700;color:var(--txt);cursor:pointer";
      var cb=document.createElement("input"); cb.type="checkbox"; cb.value=c.id; cb.style.cssText="width:18px;height:18px"; cb.checked=(c.id==="general"||c.id==="evenements");
      lab.appendChild(cb); lab.appendChild(document.createTextNode((c.icon?c.icon+" ":"")+c.name)); liste.appendChild(lab); cases.push(cb);
    });
  }).catch(function(){ liste.textContent="Impossible de charger les canaux."; });
  s.body.appendChild(gmBtn("Créer le lien d'invitation","primary",function(){
    var ids=cases.filter(function(c){ return c.checked; }).map(function(c){ return c.value; });
    var t=String(tel.value||"").replace(/[^0-9+]/g,"");
    createClubInvite(clubId,clubName,"benevole",{}, {canauxIds:ids, tel:t}).then(function(code){ s.modal.remove(); showInviteResult(code,"benevole",clubName); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
}

// Canaux d'un compte bénévole déjà créé : le dirigeant les modifie depuis la fiche du compte.
function benevCanauxModifier(uid,actuels,fait){
  var s=gmSheet("Canaux de ce bénévole"), cases=[];
  var liste=document.createElement("div"); liste.style.cssText="display:grid;gap:6px;margin-bottom:14px"; s.body.appendChild(liste); liste.textContent="Chargement…";
  benevCanauxDispo().then(function(l){
    liste.textContent="";
    l.forEach(function(c){
      var lab=document.createElement("label"); lab.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;font-size:13.5px;font-weight:700;color:var(--txt);cursor:pointer";
      var cb=document.createElement("input"); cb.type="checkbox"; cb.value=c.id; cb.style.cssText="width:18px;height:18px"; cb.checked=(actuels||[]).indexOf(c.id)>=0;
      lab.appendChild(cb); lab.appendChild(document.createTextNode((c.icon?c.icon+" ":"")+c.name)); liste.appendChild(lab); cases.push(cb);
    });
  });
  s.body.appendChild(gmBtn("Enregistrer","primary",function(){
    var ids=cases.filter(function(c){ return c.checked; }).map(function(c){ return c.value; });
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",uid),{canaux:ids}).then(function(){ s.modal.remove(); if(fait) fait(ids); showToast("Canaux enregistrés"); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
}

// ── Accueil du bénévole ─────────────────────────────────────────────────
function benevMesMissions(){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid) return [];
  var auj=benJourLocal(), out=[];
  (getEvents()||[]).forEach(function(e){
    if(!e||e.cancelled||e.statut==="attente"||!e.date) return;
    benListe(e).forEach(function(m){ if(m.uid!==uid) return; var jr=String(m.jour||e.date).slice(0,10); if(jr<auj) return; out.push({e:e,m:m,jr:jr,j:benJoursAvant(jr)}); });
  });
  return out.sort(function(a,b){ return (a.jr+(a.m.heure||a.e.heure||"")).localeCompare(b.jr+(b.m.heure||b.e.heure||"")); });
}
function benevCle(x){ return x.e.id+"|"+x.m.id; }
function benevChargerReponses(fini){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid||!window.fbGetDocs){ if(fini) fini(); return; }
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"checkins"),window.fbWhere("benUid","==",uid))).then(function(snap){
    BENEV_REPONSES={}; snap.forEach(function(d){ var c=d.data()||{}; BENEV_REPONSES[c.eventId+"|"+c.missionId]=c.status; });
    if(fini) fini();
  }).catch(function(){ if(fini) fini(); });
}
function benevRepondre(eid,mid,statut){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid) return;
  var ref=window.fbDoc(window.fbDb,"checkins",eid+"_ben_"+uid+"_"+mid);
  window.fbSetDoc(ref,{eventId:eid,missionId:mid,benUid:uid,status:statut,source:"benevole",ts:window.fbServerTimestamp()}).then(function(){
    BENEV_REPONSES[eid+"|"+mid]=statut; benevHomeBuild();
    showToast(statut==="present"?"Merci, c'est noté":"Le club est prévenu");
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
// Matchs à domicile à venir (planning, lecture seule)
function benevMatchsDomicile(){
  var auj=benJourLocal();
  return (getEvents()||[]).filter(function(e){
    if(!e||e.type!=="match"||e.cancelled||!e.date||e.date<auj) return false;
    return e.domicile===true||(e.domicile===undefined&&/domicile/i.test(e.lieu||""));
  }).sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; }).slice(0,12);
}
function benevOutilCode(titre,aide,construire){
  askPrompt(titre,{placeholder:aide,confirmText:"Ouvrir"}).then(function(v){
    if(v===null) return; v=String(v).trim().toUpperCase(); if(!v) return;
    location.href=construire(encodeURIComponent(v));
  });
}
function benevHomeBuild(){
  var el=document.getElementById("benevole-home-body"); if(!el) return;
  var u=window.ASMB_USER||{}, prenom=authEsc(u.prenom||"");
  var club=authEsc((window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"");
  var h='<div style="padding:18px 16px 4px"><div style="font-size:11px;font-weight:800;letter-spacing:1.5px;color:var(--mut);text-transform:uppercase">Espace bénévole'+(club?" · "+club:"")+'</div>'
    +'<div style="font-size:22px;font-weight:900;color:var(--txt);margin-top:4px">Bonjour'+(prenom?" "+prenom:"")+' 👋</div></div>';
  var ms=benevMesMissions();
  h+='<div class="sec" style="padding:14px 16px 6px">Mes missions</div>';
  if(!ms.length){
    h+='<div style="margin:0 16px;padding:16px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr);font-size:13px;color:var(--mut);line-height:1.5">Aucune mission pour l\'instant. Quand le club vous placera sur un match ou un événement, elle apparaîtra ici.</div>';
  } else {
    ms.forEach(function(x){
      var rep=BENEV_REPONSES[benevCle(x)];
      var quand=x.j===0?"Aujourd'hui":x.j===1?"Demain":benJourTxt({date:x.jr});
      var q=quand.charAt(0).toUpperCase()+quand.slice(1);
      h+='<div style="margin:0 16px 10px;padding:14px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr)">'
        +'<div style="font-size:11px;font-weight:800;color:#E8670A;text-transform:uppercase;letter-spacing:.6px">'+authEsc(x.m.poste)+'</div>'
        +'<div style="font-size:15px;font-weight:900;color:var(--txt);margin-top:2px">'+authEsc(x.e.titre||eventTypeLabel(x.e.type))+'</div>'
        +'<div style="font-size:12px;color:var(--txt2);margin-top:2px">'+authEsc(q+((x.m.heure||x.e.heure)?" à "+(x.m.heure||x.e.heure):"")+(x.e.lieu?" · "+x.e.lieu:""))+'</div>'
        +'<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button type="button" onclick="benevRepondre(\''+authEsc(x.e.id)+'\',\''+authEsc(x.m.id)+'\',\'present\')" style="flex:1;min-height:44px;border-radius:var(--rx);font:inherit;font-weight:800;cursor:pointer;border:1.5px solid '+(rep==="present"?"#1F8A4C":"var(--bdr)")+';background:'+(rep==="present"?"rgba(31,138,76,.14)":"var(--bg)")+';color:'+(rep==="present"?"#1F8A4C":"var(--txt)")+'">✓ Je viens</button>'
        +'<button type="button" onclick="benevRepondre(\''+authEsc(x.e.id)+'\',\''+authEsc(x.m.id)+'\',\'absent\')" style="flex:1;min-height:44px;border-radius:var(--rx);font:inherit;font-weight:800;cursor:pointer;border:1.5px solid '+(rep==="absent"?"#C0392B":"var(--bdr)")+';background:'+(rep==="absent"?"rgba(192,57,43,.12)":"var(--bg)")+';color:'+(rep==="absent"?"#C0392B":"var(--txt)")+'">✗ Je ne peux pas</button></div></div>';
    });
  }
  var dom=benevMatchsDomicile();
  h+='<div class="sec" style="padding:14px 16px 6px">Matchs à domicile</div>';
  if(!dom.length) h+='<div style="margin:0 16px;padding:16px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr);font-size:13px;color:var(--mut)">Aucun match à domicile à venir.</div>';
  else h+='<div style="margin:0 16px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr);overflow:hidden">'+dom.map(function(e,i){
    return '<div style="padding:10px 14px;'+(i?'border-top:1px solid var(--bdr);':'')+'"><div style="font-size:13px;font-weight:800;color:var(--txt)">'+authEsc((e.equipe?e.equipe+" · ":"")+(e.titre||"Match"))+'</div>'
      +'<div style="font-size:12px;color:var(--txt2)">'+authEsc(benJourTxt(e)+(e.heure?" à "+e.heure:""))+'</div></div>'; }).join("")+'</div>';
  h+='<div class="sec" style="padding:14px 16px 6px">Outils</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 16px 24px">'
    +'<button type="button" onclick="location.href=location.origin+\'/buvette/\'" style="min-height:64px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--card);color:var(--txt);font:inherit;font-weight:800;cursor:pointer">🥤 Caisse buvette</button>'
    +'<button type="button" onclick="benevOutilCode(\'Code de l\\\'entrée\',\'Code donné par le club\',function(c){ return location.origin+\'/?entree=\'+c; })" style="min-height:64px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--card);color:var(--txt);font:inherit;font-weight:800;cursor:pointer">🎫 Scanner les billets</button></div>';
  el.innerHTML=h;
}
function benevHome(){
  stack=["benevole-home"]; showScr("benevole-home"); benevHomeBuild(); benevChargerReponses(benevHomeBuild);
}
function navToBenevole(which){
  document.querySelectorAll("#bnav-main .bni").forEach(function(b){ b.classList.remove("on"); });
  if(which==="communaute"){ stack=["communaute"]; showScr("communaute"); buildCommunaute(); }
  else if(which==="params"){ stack=["parent-params"]; showScr("parent-params"); buildParentSettings(); }
  else benevHome();
  var b=document.getElementById("bni-b-"+which); if(b) b.classList.add("on");
}
