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
// Côté dirigeant / coach : les réponses des bénévoles avec compte pour un événement (affichées dans « Bénévoles »).
var BENEV_REP_STAFF={};
function benevReponsesStaffCharger(eid){
  if(!window.fbGetDocs||!window.fbDb||!window.CURRENT_CLUB_ID) return Promise.resolve();
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"checkins"),window.fbWhere("eventId","==",eid))).then(function(snap){
    snap.forEach(function(d){ var c=d.data()||{}; if(c.source==="benevole"&&c.missionId) BENEV_REP_STAFF[c.eventId+"|"+c.missionId]=c.status; });
  }).catch(function(){});
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
        +(x.e.equipe?'<div style="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:20px;background:color-mix(in srgb, var(--dkg) 12%, transparent);color:var(--dkg);font-size:12px;font-weight:800">Équipe : '+authEsc(x.e.equipe)+'</div>':'')
        +'<div style="font-size:12px;color:var(--txt2);margin-top:4px">'+authEsc(q+((x.m.heure||x.e.heure)?" à "+(x.m.heure||x.e.heure):"")+(x.e.lieu?" · "+x.e.lieu:""))+'</div>'
        +'<div style="display:flex;gap:8px;margin-top:10px">'
        +'<button type="button" onclick="benevRepondre(\''+gmJs(x.e.id)+'\',\''+gmJs(x.m.id)+'\',\'present\')" style="flex:1;min-height:44px;border-radius:var(--rx);font:inherit;font-weight:800;cursor:pointer;border:1.5px solid '+(rep==="present"?"#1F8A4C":"var(--bdr)")+';background:'+(rep==="present"?"rgba(31,138,76,.14)":"var(--bg)")+';color:'+(rep==="present"?"#1F8A4C":"var(--txt)")+'">✓ Je viens</button>'
        +'<button type="button" onclick="benevRepondre(\''+gmJs(x.e.id)+'\',\''+gmJs(x.m.id)+'\',\'absent\')" style="flex:1;min-height:44px;border-radius:var(--rx);font:inherit;font-weight:800;cursor:pointer;border:1.5px solid '+(rep==="absent"?"#C0392B":"var(--bdr)")+';background:'+(rep==="absent"?"rgba(192,57,43,.12)":"var(--bg)")+';color:'+(rep==="absent"?"#C0392B":"var(--txt)")+'">✗ Je ne peux pas</button></div></div>';
    });
  }
  var ap=benevAppelsOuverts();
  if(ap.length){
    h+='<div class="sec" style="padding:14px 16px 6px">📣 Appels à bénévoles</div>';
    ap.slice(0,6).forEach(function(e){
      var reste=benevAppelPlaces(e).reduce(function(a,x){ return a+x.reste; },0);
      h+='<div style="margin:0 16px 10px;padding:14px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr)">'
        +'<div style="font-size:15px;font-weight:900;color:var(--txt)">'+authEsc(e.titre||eventTypeLabel(e.type))+'</div>'
        +'<div style="font-size:12px;color:var(--txt2);margin-top:4px">'+authEsc(benJourTxt(e)+(e.heure?" à "+e.heure:"")+(e.equipe?" · "+e.equipe:""))+'</div>'
        +'<button type="button" onclick="benevAppelOuvrir(\''+gmJs(e.id)+'\')" style="margin-top:10px;width:100%;min-height:44px;border-radius:var(--rx);border:none;background:var(--dkg);color:#fff;font:inherit;font-weight:800;cursor:pointer">'+(authEsc(reste?"Je m'inscris ("+reste+" place"+(reste>1?"s":"")+")":"Complet · voir"))+'</button></div>';
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
  h+='<div style="margin:0 16px 24px"><button type="button" id="push-toggle-btn" style="width:100%;min-height:48px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--card);color:var(--txt);font:inherit;font-weight:800;cursor:pointer">🔔 Activer les notifications</button>'
    +'<div style="font-size:11.5px;color:var(--mut);margin-top:6px;line-height:1.45">Pour être prévenu dès que le club vous place sur une mission.</div></div>';
  el.innerHTML=h;
  if(typeof refreshPushButton==="function") refreshPushButton();
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

// ── Dirigeant : un bénévole dit « Je ne peux pas » → remplaçant tiré en un appui ─────────────
// Retire sa mission, relance le tirage sur ce seul poste (sans lui) ; à défaut, choix à la main.
function benevRemplacant(eid,m,fait){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  askConfirm("Retirer "+(m.nom||"ce bénévole")+" et tirer un remplaçant pour « "+m.poste+" » ?",{confirmText:"Tirer un remplaçant"}).then(function(ok){
    if(!ok) return;
    Promise.all([typeof benChargerComptes==="function"?benChargerComptes():[],typeof benCarnetCharger==="function"?benCarnetCharger():[]]).then(function(r){
      var avant=benListe(e), cle=tirCleMission(m);
      var reste=avant.filter(function(x){ return x.id!==m.id; });
      benSauver(eid,reste);
      var existants=reste.filter(function(x){ return x.poste===m.poste; }).length, postes={}; postes[m.poste]=existants+1;
      var t=tirTirer(e.date,e.date,{zone:tirPrefs().zone,postes:postes},r[0]||[],r[1]||[],{eid:eid,forcer:true,exclure:[cle]});
      var l=t.lignes[0], a=l&&l.affectes[0];
      if(fait) fait();
      if(!a){ showToast("Personne de disponible : choisis à la main"); if(typeof benOuvrir==="function") benOuvrir(eid); return; }
      askConfirm("Remplaçant : "+a.m.nom+". Le prévenir par SMS ?",{confirmText:"Envoyer le SMS"}).then(function(ok2){
        var ev2=getEvents().find(function(x){ return x.id===eid; })||e;
        if(ok2&&typeof benSms==="function") benSms(ev2,a.m,a.tel);
      });
    }).catch(function(err){ askAlert("Erreur : "+((err&&err.message)||err)); });
  });
}

// ── Dirigeant : relance des invitations bénévoles pas encore activées (3 jours) ──────────────
function benevInvitesCharger(){
  window.__invitesBenAttente=0; window.__invitesBen=[];
  if(!window.fbGetDocs||!window.CURRENT_CLUB_ID) return Promise.resolve([]);
  var il=Date.now()-3*86400000;
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"club_invites"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
    var l=[]; snap.forEach(function(d){ var x=d.data()||{}; if(x.role!=="benevole"||x.usedBy) return;
      var cr=x.createdAt&&x.createdAt.toDate?x.createdAt.toDate().getTime():0, ex=x.expiresAt&&x.expiresAt.toDate?x.expiresAt.toDate().getTime():0;
      if(cr&&cr<=il) l.push({code:d.id,tel:x.tel||"",canauxIds:x.canauxIds||[],expiree:!!(ex&&ex<Date.now()),cree:cr}); });
    window.__invitesBen=l; window.__invitesBenAttente=l.length; return l;
  }).catch(function(){ return []; });
}
function benevInviteSms(code,tel){
  var club=(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"le club";
  var txt=club+" : bonjour, votre invitation General Manager n'est pas encore activée. Créez votre compte ici : "+inviteLink(code);
  location.href="sms:"+String(tel||"").replace(/[^0-9+]/g,"")+"?&body="+encodeURIComponent(txt);
}
function benevInvitesRelance(){
  benevInvitesCharger().then(function(l){
    var s=gmSheet("Invitations bénévoles à relancer");
    if(!l.length){ var v=document.createElement("div"); v.style.cssText="font-size:13px;color:var(--mut)"; v.textContent="Aucune invitation en attente depuis plus de 3 jours."; s.body.appendChild(v); return; }
    l.forEach(function(x){
      var d=document.createElement("div"); d.style.cssText="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;margin-bottom:8px";
      var j=Math.max(3,Math.floor((Date.now()-x.cree)/86400000));
      d.innerHTML='<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:800;color:var(--txt)">'+authEsc(x.tel||"Sans numéro")+'</div><div style="font-size:11.5px;color:var(--mut)">Envoyée il y a '+j+' jours'+(x.expiree?" · expirée":"")+'</div></div>';
      var go=gmBtn(x.expiree?"Nouveau lien":"Relancer","primary",function(){
        if(!x.expiree){ benevInviteSms(x.code,x.tel); return; }
        createClubInvite(window.CURRENT_CLUB_ID,(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"","benevole",{},{canauxIds:x.canauxIds,tel:x.tel}).then(function(code){
          window.fbDeleteDoc(window.fbDoc(window.fbDb,"club_invites",x.code)).catch(function(){});
          s.modal.remove(); if(x.tel) benevInviteSms(code,x.tel); else showInviteResult(code,"benevole",(window.CURRENT_CLUB&&window.CURRENT_CLUB.name)||"");
        }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
      }); go.style.flex="0 0 auto"; d.appendChild(go); s.body.appendChild(d);
    });
  });
}

// ── Dirigeant : bilan des missions de la saison (qui a fait combien) ─────────────────────────
function benevBilan(){
  var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
  var an=parseInt(String(saison).slice(0,4),10), debut=an?(an+"-08-01"):"0000-00-00", fin=an?((an+1)+"-07-31"):"9999-12-31";
  var par={};
  getEvents().forEach(function(e){
    if(!e||e.cancelled||!e.date||e.date<debut||e.date>fin) return;
    benListe(e).forEach(function(m){ var k=tirCleMission(m); var x=par[k]=par[k]||{nom:m.nom||"?",n:0,postes:{}}; x.n++; x.postes[m.poste]=(x.postes[m.poste]||0)+1; });
  });
  var l=Object.keys(par).map(function(k){ return par[k]; }).sort(function(a,b){ return b.n-a.n||String(a.nom).localeCompare(String(b.nom)); });
  var s=gmSheet("Bilan des bénévoles"+(saison?" · "+saison:""));
  if(!l.length){ var v=document.createElement("div"); v.style.cssText="font-size:13px;color:var(--mut)"; v.textContent="Aucune mission cette saison pour l'instant."; s.body.appendChild(v); return; }
  var tot=l.reduce(function(a,x){ return a+x.n; },0);
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px"; info.textContent=l.length+" bénévoles · "+tot+" missions"; s.body.appendChild(info);
  l.forEach(function(x){
    var d=document.createElement("div"); d.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 12px;margin-bottom:6px";
    d.innerHTML='<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(x.nom)+'</div><div style="font-size:11px;color:var(--mut)">'+authEsc(Object.keys(x.postes).map(function(p){ return p+" ×"+x.postes[p]; }).join(" · "))+'</div></div><div style="font-size:18px;font-weight:900;color:var(--dkg)">'+x.n+'</div>';
    s.body.appendChild(d);
  });
  var msg="Merci à nos "+l.length+" bénévoles"+(saison?" de la saison "+saison:"")+" : "+tot+" missions assurées (buvette, table de marque, arbitrage…). Sans vous, rien ne serait possible !";
  s.body.appendChild(gmBtn("📣 Copier le message de remerciement","primary",function(){ copyToClipboard(msg); }));
}


// ── Appel à bénévoles (auto-inscription contrôlée par le dirigeant) ───────────────────────────
// Le dirigeant ouvre un appel sur un événement (`event.appel={postes:{poste:n}, ouvert, publieLe}`) et le publie dans un canal
// (message `type:"appel"`, carte avec bouton). Un membre (bénévole, parent, enfant) s'inscrit en direct : il crée
// `ben_inscriptions/{eventId}_{uid}_{poste}` (règles : seulement le sien) et la Cloud Function `onInscriptionBenevole`
// ajoute la mission dans `event.benevoles` (`auto:true`), ou répond « complet ». Se retirer = supprimer son document.
// Le dirigeant retire quelqu'un dans « Bénévoles » comme pour n'importe quelle mission. Enfant (compte joueur) : sa mission
// porte `pid` ; ses parents sont prévenus (push serveur) et voient un pop-up à l'ouverture (`benevAppelParents`).
function benevAppelPlaces(e){
  var postes=(e&&e.appel&&e.appel.postes)||{}, l=(e&&Array.isArray(e.benevoles))?e.benevoles:[];
  return Object.keys(postes).map(function(p){
    var n=Math.max(0,Number(postes[p])||0);
    var pris=l.filter(function(m){ return m.poste===p&&(m.nom||m.uid); }).length;
    return {poste:p,n:n,pris:pris,reste:Math.max(0,n-pris)};
  }).filter(function(x){ return x.n>0; });
}
function benevAppelsOuverts(){
  var auj=benJourLocal();
  return (getEvents()||[]).filter(function(e){
    return e&&e.appel&&e.appel.ouvert!==false&&!e.cancelled&&e.statut!=="attente"&&e.date&&String(e.date).slice(0,10)>=auj&&benevAppelPlaces(e).length;
  }).sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
}
function benevAppelEvenements(){
  var auj=benJourLocal();
  return (getEvents()||[]).filter(function(e){ return e&&!e.cancelled&&e.statut!=="attente"&&e.date&&String(e.date).slice(0,10)>=auj; })
    .sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
}
function benevEvLibelle(e){ return benJourTxt(e).replace(/^./,function(c){ return c.toUpperCase(); })+" · "+(e.equipe?e.equipe+" · ":"")+(e.titre||eventTypeLabel(e.type)); }

// Côté dirigeant : choisir l'événement (liste ou recherche), les postes et le nombre de places, puis publier.
function benevAppel(eid){
  var s=gmSheet("📣 Appel à bénévoles");
  var intro=document.createElement("div"); intro.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px";
  intro.textContent="Les membres s'inscrivent en direct, premier arrivé premier servi. Vous pouvez retirer quelqu'un à tout moment dans « Bénévoles ». Les enfants peuvent s'inscrire : leurs parents sont prévenus.";
  s.body.appendChild(intro);
  var evs=benevAppelEvenements(), choisi=eid||"";
  var lq=document.createElement("div"); lq.className="form-label"; lq.textContent="Événement ou match"; s.body.appendChild(lq);
  var q=document.createElement("input"); q.className="form-input"; q.placeholder="Rechercher (équipe, adversaire, date…)"; q.style.marginBottom="6px"; s.body.appendChild(q);
  var sel=document.createElement("select"); sel.className="form-input"; sel.style.marginBottom="12px"; s.body.appendChild(sel);
  function remplir(){
    var t=String(q.value||"").toLowerCase().trim(); sel.innerHTML="";
    var o0=document.createElement("option"); o0.value=""; o0.textContent="— Choisir dans la liste —"; sel.appendChild(o0);
    evs.forEach(function(e){ var lib=benevEvLibelle(e); if(t&&(lib+" "+e.date).toLowerCase().indexOf(t)<0&&e.id!==choisi) return;
      var o=document.createElement("option"); o.value=e.id; o.textContent=lib; if(e.id===choisi) o.selected=true; sel.appendChild(o); });
  }
  q.addEventListener("input",function(){ remplir(); var n=sel.options.length; if(n===2&&q.value.trim()){ sel.selectedIndex=1; choisi=sel.value; chargerPostes(); } });
  sel.addEventListener("change",function(){ choisi=sel.value; chargerPostes(); });
  remplir();
  var lp=document.createElement("div"); lp.className="form-label"; lp.textContent="Postes et nombre de places"; s.body.appendChild(lp);
  var grille=document.createElement("div"); grille.style.cssText="display:grid;gap:6px;margin-bottom:12px"; s.body.appendChild(grille);
  var champs={};
  BEN_POSTES.forEach(function(p){
    var r=document.createElement("label"); r.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:8px 12px;font-size:13.5px;font-weight:700;color:var(--txt)";
    var t=document.createElement("span"); t.style.flex="1"; t.textContent=p;
    var i=document.createElement("input"); i.type="number"; i.min="0"; i.max="20"; i.value="0"; i.className="form-input"; i.style.cssText="width:70px;text-align:center;margin:0";
    r.appendChild(t); r.appendChild(i); grille.appendChild(r); champs[p]=i;
  });
  function chargerPostes(){
    var e=evs.find(function(x){ return x.id===choisi; }), po=(e&&e.appel&&e.appel.postes)||{};
    BEN_POSTES.forEach(function(p){ champs[p].value=String(po[p]||0); });
  }
  chargerPostes();
  var lc=document.createElement("div"); lc.className="form-label"; lc.textContent="Publier dans le canal"; s.body.appendChild(lc);
  var canal=document.createElement("select"); canal.className="form-input"; canal.style.marginBottom="14px"; s.body.appendChild(canal);
  benevCanauxDispo().then(function(l){ l.forEach(function(c){ var o=document.createElement("option"); o.value=c.id; o.textContent=(c.icon?c.icon+" ":"")+c.name; if(c.id==="general") o.selected=true; canal.appendChild(o); }); }).catch(function(){});
  s.body.appendChild(gmBtn("Publier l'appel","primary",function(){
    if(!choisi){ askAlert("Choisissez d'abord l'événement."); return; }
    var postes={}; BEN_POSTES.forEach(function(p){ var n=Math.max(0,Math.min(20,parseInt(champs[p].value,10)||0)); if(n) postes[p]=n; });
    if(!Object.keys(postes).length){ askAlert("Mettez au moins une place sur un poste."); return; }
    var all=getEvents(), i=all.findIndex(function(x){ return x.id===choisi; }); if(i<0) return;
    var e=all[i]; all[i].appel={postes:postes,ouvert:true,publieLe:Date.now()}; saveEvents(all);
    var resume=Object.keys(postes).map(function(p){ return postes[p]+" × "+p; }).join(", ");
    var cid=canal.value||"general";
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",cid,"messages"),Object.assign({
      type:"appel",eventId:e.id,eventTitre:(e.equipe?e.equipe+" · ":"")+(e.titre||eventTypeLabel(e.type)),eventDate:e.date,eventHeure:e.heure||"",eventLieu:e.lieu||"",resume:resume,
      pseudo:myChatPseudo(),ts:window.fbServerTimestamp()
    },mySenderMeta())).then(function(){ s.modal.remove(); showToast("Appel publié"); }).catch(function(er){ askAlert("Appel enregistré, mais pas publié : "+((er&&er.code)||er)); });
  }));
  var ex=evs.find(function(x){ return x.id===choisi&&x.appel; });
  if(ex||!eid) s.body.appendChild(gmBtn("Fermer l'appel de cet événement","ghost",function(){
    if(!choisi) return;
    var all=getEvents(), i=all.findIndex(function(x){ return x.id===choisi; }); if(i<0||!all[i].appel){ showToast("Pas d'appel ouvert ici"); return; }
    delete all[i].appel; saveEvents(all); s.modal.remove(); showToast("Appel fermé");
  }));
}

// Côté membre : places restantes, « Je m'inscris », « Me retirer ».
function benevAppelMoi(e,poste){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||"";
  return benListe(e).filter(function(m){ return m.uid===uid&&m.poste===poste; })[0]||null;
}
function benevAppelNom(){
  var u=window.ASMB_USER||{}, enfant=(u.roles||[]).indexOf("joueur")>=0&&(u.roles||[]).indexOf("parent")<0;
  var n=String(u.nom||""); return (String(u.prenom||"")+" "+(enfant?n.charAt(0):n)).trim().slice(0,40)||"Membre";
}
function benevAppelOuvrir(eid){
  var e=getEvents().find(function(x){ return x.id===eid; });
  if(!e||!e.appel||e.appel.ouvert===false){ askAlert("Cet appel est terminé."); return; }
  var s=gmSheet("📣 "+(e.titre||eventTypeLabel(e.type)));
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--txt2);margin-bottom:12px;line-height:1.45";
  info.textContent=benevEvLibelle(e).split(" · ")[0]+(e.heure?" à "+e.heure:"")+(e.lieu?" · "+e.lieu:"")+(e.equipe?" · Équipe : "+e.equipe:"");
  s.body.appendChild(info);
  var liste=document.createElement("div"); s.body.appendChild(liste);
  function rendre(){
    var ev=getEvents().find(function(x){ return x.id===eid; })||e; liste.innerHTML="";
    var pl=benevAppelPlaces(ev);
    if(!pl.length){ liste.textContent="Plus de place à pourvoir."; return; }
    pl.forEach(function(x){
      var moi=benevAppelMoi(ev,x.poste);
      var d=document.createElement("div"); d.style.cssText="display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:10px 12px;margin-bottom:8px";
      var t=document.createElement("div"); t.style.cssText="flex:1;min-width:0";
      t.innerHTML='<div style="font-size:14px;font-weight:800;color:var(--txt)">'+authEsc(x.poste)+'</div><div style="font-size:12px;color:var(--mut)">'+(moi?"Vous êtes inscrit·e":x.reste?x.reste+" place"+(x.reste>1?"s":"")+" sur "+x.n:"Complet")+'</div>';
      d.appendChild(t);
      if(moi) d.appendChild(gmBtn("Me retirer","ghost",function(){ benevAppelRetirer(eid,x.poste,rendre); }));
      else if(x.reste) d.appendChild(gmBtn("Je m'inscris","primary",function(){ benevAppelInscrire(eid,x.poste,rendre); }));
      liste.appendChild(d);
    });
  }
  rendre();
}
function benevAppelId(eid,uid,poste){ return eid+"_"+uid+"_"+String(poste).toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,30); }
function benevAppelInscrire(eid,poste,fait){
  var u=window.ASMB_USER||{}, uid=u.uid; if(!uid||!window.fbDb) return;
  var ref=window.fbDoc(window.fbDb,"ben_inscriptions",benevAppelId(eid,uid,poste));
  window.fbDeleteDoc(ref).catch(function(){}).then(function(){
    return window.fbSetDoc(ref,{eventId:eid,poste:poste,uid:uid,nom:benevAppelNom(),ts:window.fbServerTimestamp()});
  }).then(function(){
    showToast("Inscription envoyée…");
    setTimeout(function(){
      window.fbGetDoc(ref).then(function(d){
        var st=d.exists()?(d.data()||{}).statut:"";
        if(st==="complet"){ window.fbDeleteDoc(ref).catch(function(){}); showToast("Désolé, la dernière place vient d'être prise"); }
        else showToast("C'est noté, merci !");
        if(fait) fait();
        if(typeof benevHomeBuild==="function"&&document.getElementById("benevole-home-body")) benevHomeBuild();
      }).catch(function(){ if(fait) fait(); });
    },2200);
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}
function benevAppelRetirer(eid,poste,fait){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid) return;
  window.fbDeleteDoc(window.fbDoc(window.fbDb,"ben_inscriptions",benevAppelId(eid,uid,poste))).then(function(){
    showToast("Vous êtes retiré·e"); setTimeout(function(){ if(fait) fait(); if(document.getElementById("benevole-home-body")) benevHomeBuild(); },1800);
  }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
}

// Parents : un enfant s'est inscrit comme bénévole (mission avec `pid`, `auto`). Pop-up une seule fois par mission.
function benevAppelParents(){
  var u=window.ASMB_USER||{}; if((u.roles||[]).indexOf("parent")<0) return;
  var mes=u.linkedPlayerIds||[]; if(!mes.length) return;
  var auj=benJourLocal(), vus; try{ vus=JSON.parse(localStorage.getItem("gm_appel_vus")||"[]"); }catch(x){ vus=[]; }
  var trouve=null;
  (getEvents()||[]).forEach(function(e){
    if(trouve||!e||e.cancelled||!e.date) return;
    benListe(e).forEach(function(m){ if(trouve||!m.auto||!m.pid||mes.indexOf(m.pid)<0||vus.indexOf(e.id+"|"+m.id)>=0) return; if(String(m.jour||e.date).slice(0,10)<auj) return; trouve={e:e,m:m}; });
  });
  if(!trouve) return;
  var cle=trouve.e.id+"|"+trouve.m.id;
  var s=gmSheet("Votre enfant s'est inscrit");
  var t=document.createElement("div"); t.style.cssText="font-size:14px;color:var(--txt);line-height:1.5;margin-bottom:14px";
  t.textContent=(trouve.m.nom||"Votre enfant")+" s'est inscrit comme bénévole : « "+trouve.m.poste+" » — "+(trouve.e.titre||eventTypeLabel(trouve.e.type))+", "+benJourTxt(trouve.e)+(trouve.e.heure?" à "+trouve.e.heure:"")+". Le club peut le retirer si besoin.";
  s.body.appendChild(t);
  s.body.appendChild(gmBtn("Je refuse sa participation","ghost",function(){
    var uid=u.uid; if(!uid) return;
    window.fbSetDoc(window.fbDoc(window.fbDb,"checkins",trouve.e.id+"_refus_"+uid+"_"+trouve.m.id),{eventId:trouve.e.id,missionId:trouve.m.id,benUid:uid,status:"refus",source:"parent_refus",ts:window.fbServerTimestamp()})
      .then(function(){ vus.push(cle); try{ localStorage.setItem("gm_appel_vus",JSON.stringify(vus.slice(-80))); }catch(x){} s.modal.remove(); showToast("Refus envoyé : le club est prévenu"); setTimeout(benevAppelParents,300); })
      .catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  }));
  s.body.appendChild(gmBtn("OK, j'ai vu","primary",function(){ vus.push(cle); try{ localStorage.setItem("gm_appel_vus",JSON.stringify(vus.slice(-80))); }catch(x){} s.modal.remove(); setTimeout(benevAppelParents,300); }));
}

// ── Suivi des appels côté dirigeant/coach (dans l'appli, jamais en notification) ──
// Nouvelles inscriptions depuis la dernière fois qu'on a vu la liste « À faire aujourd'hui » : l'horodatage est dans l'identifiant de la mission (« a » + Date.now() en base 36).
function benevAppelHorodatage(m){
  var id=String((m&&m.id)||""); if(id.charAt(0)!=="a") return 0;
  var t=parseInt(id.slice(1,9),36); return isFinite(t)?t:0;
}
function benevAppelVuLe(){ try{ return Number(localStorage.getItem("gm_appel_dir_vu")||0); }catch(e){ return 0; } }
function benevAppelVu(){ try{ localStorage.setItem("gm_appel_dir_vu",String(Date.now())); }catch(e){} }
function benevAppelNouveaux(){
  var depuis=benevAppelVuLe(), res=[];
  (getEvents()||[]).forEach(function(e){
    if(!e||!e.appel||e.cancelled||!Array.isArray(e.benevoles)) return;
    var n=e.benevoles.filter(function(m){ return m&&m.auto&&benevAppelHorodatage(m)>depuis; }).length;
    if(n) res.push({e:e,n:n});
  });
  return res;
}
// Appels ouverts dont le jour est dans 3 jours ou moins et qui ont encore des places libres.
function benevAppelManques(){
  var auj=benJourLocal(), lim=benJourLocal(new Date(Date.now()+3*86400000));
  return benevAppelsOuverts().filter(function(e){ var d=String(e.date).slice(0,10); return d>=auj&&d<=lim; })
    .map(function(e){ var pl=benevAppelPlaces(e).filter(function(x){ return x.reste>0; }); return {e:e,places:pl,reste:pl.reduce(function(a,x){ return a+x.reste; },0)}; })
    .filter(function(x){ return x.reste>0; });
}
// Republie l'appel dans un canal, avec seulement les places qui restent.
function benevAppelRelancer(eid){
  var e=getEvents().find(function(x){ return x.id===eid; });
  if(!e||!e.appel||e.appel.ouvert===false){ askAlert("Cet appel est terminé."); return; }
  var pl=benevAppelPlaces(e).filter(function(x){ return x.reste>0; });
  if(!pl.length){ showToast("Toutes les places sont prises"); return; }
  var resume=pl.map(function(x){ return x.reste+" × "+x.poste; }).join(", ");
  askConfirm("Republier l'appel dans le canal Général ? Il reste : "+resume+".",{confirmText:"Relancer"}).then(function(ok){
    if(!ok) return;
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels","general","messages"),Object.assign({
      type:"appel",eventId:e.id,eventTitre:(e.equipe?e.equipe+" · ":"")+(e.titre||eventTypeLabel(e.type)),eventDate:e.date,eventHeure:e.heure||"",eventLieu:e.lieu||"",resume:resume,
      pseudo:myChatPseudo(),ts:window.fbServerTimestamp()
    },mySenderMeta())).then(function(){ showToast("Appel relancé"); }).catch(function(er){ askAlert("Pas publié : "+((er&&er.code)||er)); });
  });
}
function benevAppelChoisir(liste,action,titre){
  if(liste.length===1){ action(liste[0].e.id); return; }
  var s=gmSheet(titre);
  liste.forEach(function(x){
    var b=document.createElement("button"); b.type="button"; b.className="gm-plus-choix";
    b.innerHTML='<span style="display:block;font-weight:800" data-notr>'+authEsc(benevEvLibelle(x.e))+'</span>';
    b.addEventListener("click",function(){ s.modal.remove(); action(x.e.id); });
    s.body.appendChild(b);
  });
}
