/* ===== 14f-tournoi-jourj.js — Tournois, le jour J : codes de table de marque, scores, classements, inscriptions par lien ===== */
// Chaque match a un code généré tout seul (6 caractères, comme l'e-Marque) :
//   trn_matchs/{CODE} = {clubId, eventId, matchId, cat, label, terrain, debut, nomA, nomB, sa, sb, statut, forfait}
// Le bénévole de la table de marque ouvre ?marque, tape le code, saisit le score, puis
// retape le code pour clôturer. Une fois clôturé, seul le staff peut rouvrir ou corriger.
// Les codes ne sont jamais publics : seul le staff liste trn_matchs. L'écran « Jour J »
// du responsable (ouvert sur son téléphone ou son ordinateur) écoute les matchs et
// recopie scores, classements et équipes qualifiées sur la page publique (trn_pages).
// Inscription d'une équipe par le lien public : trn_inscriptions (contact visible du staff seul).
var TRN_MARQUE_URL="https://generalmanagerapp.fr/?marque";
var TRN_ALPHA="ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// ── Outils purs (tests/metier/tournoi.test.js) ────────────────────────
function trnCodeMatch(){
  var s="", a=new Uint32Array(6);
  try{ (window.crypto||crypto).getRandomValues(a); }catch(e){ for(var j=0;j<6;j++) a[j]=Math.floor(Math.random()*1e9); }
  for(var i=0;i<6;i++) s+=TRN_ALPHA.charAt(a[i]%TRN_ALPHA.length);
  return s;
}
// Résultat publié (trn_live) : la page publique l'affiche même sans l'écran Jour J ouvert.
// (un « / » est interdit dans un id Firestore : une catégorie « U11/U13 » devient « U11_U13 »)
function trnLiveId(clubId,eventId,matchId){ return String(clubId)+"__"+String(eventId)+"__"+String(matchId).replace(/\//g,"_"); }
function trnLiveEcrire(x,sa,sb,extra){
  if(!window.fbSetDoc||!x||!x.matchId) return Promise.resolve();
  var d=Object.assign({clubId:String(x.clubId),eventId:String(x.eventId),matchId:String(x.matchId),sa:sa,sb:sb,le:Date.now()},extra||{});
  if(!d.stats&&x.stats&&typeof x.stats==="object") d.stats=x.stats;
  return window.fbSetDoc(window.fbDoc(window.fbDb,"trn_live",trnLiveId(x.clubId,x.eventId,x.matchId)),d).catch(function(){});
}
// Score en cours (sans stats) : la page publique l'affiche « EN COURS » pendant le match, sans l'écran Jour J ouvert.
function trnLiveEncours(x,sa,sb,code){
  if(!window.fbSetDoc||!x||!x.matchId) return Promise.resolve();
  var d={clubId:String(x.clubId),eventId:String(x.eventId),matchId:String(x.matchId),sa:sa,sb:sb,code:String(code),statut:"encours",le:Date.now()};
  return window.fbSetDoc(window.fbDoc(window.fbDb,"trn_live",trnLiveId(x.clubId,x.eventId,x.matchId)),d).catch(function(){});
}
function trnLiveRetirer(x){
  if(!window.fbDeleteDoc||!x||!x.matchId) return Promise.resolve();
  return window.fbDeleteDoc(window.fbDoc(window.fbDb,"trn_live",trnLiveId(x.clubId,x.eventId,x.matchId))).catch(function(){});
}
function trnCodeNet(s){ return String(s||"").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6); }
// Classement FIBA : victoire 2 pts, défaite 1 pt, forfait 0 pt. À égalité de points :
// d'abord les matchs entre équipes à égalité (points, puis écart, puis points marqués),
// ensuite l'écart général, puis les points marqués.
function trnClassement(ids,matchs,res){
  var st={}, joues=[];
  ids.forEach(function(id){ st[id]={id:id,j:0,g:0,p:0,pts:0,pour:0,contre:0}; });
  function compter(t,x,pour,contre,gagne,forfait){ x.j++; x.pour+=pour; x.contre+=contre; if(gagne){ x.g++; x.pts+=2; } else { x.p++; x.pts+=forfait?0:1; } }
  matchs.forEach(function(m){
    var r=res&&res[m.id]; if(!r||r.statut!=="termine") return;
    var a=m.a, b=m.b; if(!st[a]||!st[b]) return;
    var sa=Number(r.sa)||0, sb=Number(r.sb)||0;
    joues.push({a:a,b:b,sa:sa,sb:sb,f:r.forfait||""});
    compter(st,st[a],sa,sb,sa>sb,r.forfait==="a");
    compter(st,st[b],sb,sa,sb>sa,r.forfait==="b");
  });
  var l=ids.map(function(id){ var x=st[id]; x.diff=x.pour-x.contre; return x; });
  function mini(groupe){
    var g={}; groupe.forEach(function(x){ g[x.id]={pts:0,diff:0,pour:0}; });
    joues.forEach(function(j){
      if(!g[j.a]||!g[j.b]) return;
      g[j.a].pour+=j.sa; g[j.b].pour+=j.sb; g[j.a].diff+=j.sa-j.sb; g[j.b].diff+=j.sb-j.sa;
      if(j.sa>j.sb){ g[j.a].pts+=2; g[j.b].pts+=(j.f==="b"?0:1); } else { g[j.b].pts+=2; g[j.a].pts+=(j.f==="a"?0:1); }
    });
    return g;
  }
  l.sort(function(x,y){ return y.pts-x.pts; });
  var out=[], i=0;
  while(i<l.length){
    var k=i; while(k<l.length&&l[k].pts===l[i].pts) k++;
    var gr=l.slice(i,k);
    if(gr.length>1){
      var m=mini(gr);
      gr.sort(function(x,y){ var a=m[x.id], b=m[y.id]; return b.pts-a.pts||b.diff-a.diff||b.pour-a.pour||y.diff-x.diff||y.pour-x.pour; });
    }
    out=out.concat(gr); i=k;
  }
  out.forEach(function(x,n){ x.rang=n+1; });
  return out;
}
// Équipes des phases finales, dès qu'on les connaît (poule finie, match précédent clôturé).
function trnResoudre(matchs,poules,res){
  var rangs={}, connus={};
  Object.keys(poules||{}).forEach(function(cat){
    (poules[cat]||[]).forEach(function(po){
      var ms=matchs.filter(function(m){ return m.cat===cat&&m.phase==="poule"&&m.poule===po.nom; });
      var fini=ms.length&&ms.every(function(m){ var r=res[m.id]; return r&&r.statut==="termine"; });
      if(fini) rangs[cat+"|"+po.nom]=trnClassement(po.equipes,ms,res).map(function(x){ return x.id; });
    });
  });
  function eq(m,cote){ var r=connus[m.id]; return (r&&r[cote])||m[cote]||null; }
  function ref(m,r){
    if(!r) return null;
    if(r.r==="rang"){ var l=rangs[m.cat+"|"+r.poule]; return l?(l[r.rang-1]||null):null; }
    var x=matchs.filter(function(z){ return z.id===r.match; })[0], rr=x&&res[x.id];
    if(!x||!rr||rr.statut!=="termine"||rr.sa===rr.sb) return null;
    var a=eq(x,"a"), b=eq(x,"b"); if(!a||!b) return null;
    var gagnant=rr.sa>rr.sb?a:b, perdant=rr.sa>rr.sb?b:a;
    return r.r==="vainq"?gagnant:perdant;
  }
  for(var tour=0;tour<4;tour++){
    matchs.forEach(function(m){
      if(m.phase!=="finale") return;
      var a=m.a||ref(m,m.aRef), b=m.b||ref(m,m.bRef);
      if(a||b) connus[m.id]={a:a||null,b:b||null};
    });
  }
  return connus;
}

// Équipes absentes (forfait général) : tout match non clôturé où elles jouent
// compte comme un forfait 20-0, y compris les phases finales dès que l'équipe
// y est qualifiée. Calcul « virtuel » : la page publique et le classement sont
// justes même si personne n'a encore enregistré le forfait. (Recopié dans tournoi/index.html.)
function trnAppliquerAbsentes(matchs,poules,res,absentes){
  var abs={}; (absentes||[]).forEach(function(id){ abs[id]=1; });
  var r=Object.assign({},res||{}), resolus=trnResoudre(matchs,poules,r);
  if(!Object.keys(abs).length) return {res:r,resolus:resolus};
  for(var tour=0;tour<6;tour++){
    var change=false;
    matchs.forEach(function(m){
      var x=r[m.id]; if(x&&x.statut==="termine") return;
      var a=(resolus[m.id]&&resolus[m.id].a)||m.a, b=(resolus[m.id]&&resolus[m.id].b)||m.b;
      if(!(a&&abs[a])&&!(b&&abs[b])) return;
      var fa=!!(a&&abs[a]);
      r[m.id]={sa:fa?0:20,sb:fa?20:0,statut:"termine",forfait:fa?"a":"b",auto:true}; change=true;
    });
    if(!change) break;
    resolus=trnResoudre(matchs,poules,r);
  }
  return {res:r,resolus:resolus};
}
function trnAbsentes(e){ return ((e&&e.trn&&e.trn.absentes)||[]).slice(); }

// ── Staff : préparer les codes de table de marque ─────────────────────
function trnListerCodes(eid){
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"trn_matchs"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid)))).then(function(snap){
    var l=[]; snap.forEach(function(d){ var x=d.data(); x._code=d.id; l.push(x); }); return l;
  });
}
function trnNomMatch(c,m,cote,resolus){
  var id=(resolus&&resolus[m.id]&&resolus[m.id][cote])||m[cote];
  if(id) return trnNom(c,id);
  var labels={}; c.matchs.forEach(function(x){ labels[x.id]=x.label; });
  return trnRefTxt(m[cote==="a"?"aRef":"bRef"],labels);
}
// Crée un code par match (une seule fois), met à jour horaires et noms, retire les
// matchs disparus du planning s'ils n'ont pas encore de score.
// Joueurs (numéro + prénom) d'une équipe du match, pour la table de marque.
function trnJoueursMatch(c,m,cote,resolus){
  var id=(resolus&&resolus[m.id]&&resolus[m.id][cote])||m[cote];
  var q=id&&c.equipes.filter(function(x){ return x.id===id; })[0];
  return ((q&&q.joueurs)||[]).map(function(j){ return {n:String(j.n||""),p:String(j.p||"")}; }).slice(0,15);
}
function trnPreparerCodes(eid,resolus){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return Promise.reject({code:"introuvable"});
  var c=trnCfg(e);
  return trnListerCodes(eid).then(function(exist){
    var parMatch={}; exist.forEach(function(x){ parMatch[x.matchId]=x; });
    var ops=[];
    c.matchs.forEach(function(m){
      var info={cat:m.cat,label:m.label,terrain:m.terrain,debut:m.debut,nomA:trnNomMatch(c,m,"a",resolus).slice(0,60),nomB:trnNomMatch(c,m,"b",resolus).slice(0,60),
        joueursA:trnJoueursMatch(c,m,"a",resolus),joueursB:trnJoueursMatch(c,m,"b",resolus),fautesMax:trnConfCat(c,m.cat).fautes};
      var x=parMatch[m.id];
      if(!x){ var code=trnCodeMatch(); ops.push(["set",code,Object.assign({clubId:window.CURRENT_CLUB_ID,eventId:String(eid),matchId:m.id,sa:0,sb:0,statut:"prevu",creeLe:Date.now()},info)]); }
      else if(Object.keys(info).some(function(k){ return JSON.stringify(x[k]==null?null:x[k])!==JSON.stringify(info[k]); })) ops.push(["update",x._code,info]);
    });
    var ids={}; c.matchs.forEach(function(m){ ids[m.id]=1; });
    exist.forEach(function(x){ if(!ids[x.matchId]&&x.statut==="prevu") ops.push(["delete",x._code]); });
    if(!ops.length) return exist;
    // Lots de 400 écritures au plus (limite Firestore : 500 par lot).
    var lots=[]; for(var i=0;i<ops.length;i+=400) lots.push(ops.slice(i,i+400));
    return lots.reduce(function(p,lot){ return p.then(function(){
      var bb=window.fbWriteBatch();
      lot.forEach(function(o){ var ref=window.fbDoc(window.fbDb,"trn_matchs",o[1]); if(o[0]==="set") bb.set(ref,o[2]); else if(o[0]==="update") bb.update(ref,o[2]); else bb.delete(ref); });
      return bb.commit();
    }); },Promise.resolve()).then(function(){ return trnListerCodes(eid); });
  });
}

// ── Staff : onglet « Jour J » (dans la fenêtre Tournoi) ────────────────
function trnJourJ(zone,eid,refaire){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var c=trnCfg(e);
  if(!c.matchs.length){ var v=document.createElement("div"); v.style.cssText="font-size:12.5px;color:var(--mut);line-height:1.5"; v.textContent="Générez d'abord le planning (onglet Planning)."; zone.appendChild(v); return; }
  var aide=document.createElement("div"); aide.style.cssText="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:8px";
  aide.textContent="Chaque match a son code. La table de marque ouvre le lien « Table de marque », tape le code du match, saisit le score, puis retape le code pour clôturer. Les matchs clôturés s'affichent tout seuls sur la page publique (scores, classements, équipes qualifiées). Gardez cet écran ouvert si vous voulez aussi les scores en cours et le nom des équipes qualifiées chez la table de marque.";
  zone.appendChild(aide);
  var row=gmRow(zone); row.style.marginTop="0";
  var etat=document.createElement("div"); etat.style.cssText="font-size:11.5px;color:var(--mut);margin-top:8px";
  var liste=document.createElement("div");
  zone.appendChild(etat); zone.appendChild(liste);
  var codes=[], unsub=null, pousse=null, dernier="";
  row.appendChild(gmBtn("Table de marque : lien + QR","primary",function(){ trnPartagerMarque(); }));
  row.appendChild(gmBtn("Codes à imprimer (PDF)","soft",function(){ trnCodesPdf(eid,codes); }));
  // Équipes absentes : appel avant le premier match, forfait général ensuite.
  var rowAbs=gmRow(zone); rowAbs.style.marginTop="6px";
  var bAppel=gmBtn("📋 Appel des équipes","soft",function(){ trnAppel(eid,codes,refaire); });
  var bAbs=gmBtn("🚫 Équipe absente ou partie","danger",function(){ trnDeclarerAbsente(eid,codes,rendre); });
  rowAbs.appendChild(bAppel); rowAbs.appendChild(bAbs);
  var ecrits={};
  function res(){ var r={}; codes.forEach(function(x){ r[x.matchId]={sa:x.sa||0,sb:x.sb||0,statut:x.statut,forfait:x.forfait||""}; if(x.stats) r[x.matchId].stats=x.stats; }); return r; }
  var verrouille=false;
  function rendre(){
    var e2=getEvents().find(function(x){ return x.id===eid; })||e, cc=trnCfg(e2), abs=trnAbsentes(e2);
    var ap=trnAppliquerAbsentes(cc.matchs,(e2.trn&&e2.trn.poules)||{},res(),abs), r=ap.res, resolus=ap.resolus;
    var commence=codes.some(function(x){ return x.statut!=="prevu"; });
    bAppel.style.display=commence?"none":""; bAbs.style.display=commence?"":"none";
    if(commence&&!verrouille&&typeof trnVerrouillerJoueurs==="function"){ verrouille=true; trnVerrouillerJoueurs(eid); }
    // Forfaits des absentes pas encore enregistrés (ex. finale où l'équipe vient de se qualifier).
    codes.forEach(function(x){
      var v=r[x.matchId]; if(!v||!v.auto||x.statut==="termine"||ecrits[x._code]) return;
      ecrits[x._code]=1;
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),{sa:v.sa,sb:v.sb,statut:"termine",forfait:v.forfait,clotureLe:Date.now()})
        .then(function(){ trnLiveEcrire(x,v.sa,v.sb,{forfait:v.forfait}); }).catch(function(){ delete ecrits[x._code]; });
    });
    var parM={}; codes.forEach(function(x){ parM[x.matchId]=x; });
    var nbT=codes.filter(function(x){ return x.statut==="termine"; }).length, nbE=codes.filter(function(x){ return x.statut==="encours"; }).length;
    etat.textContent=codes.length?(nbT+" match"+(nbT>1?"s":"")+" terminé"+(nbT>1?"s":"")+" · "+nbE+" en cours · "+(codes.length-nbT-nbE)+" à venir"):"Codes en préparation…";
    liste.innerHTML="";
    cc.matchs.forEach(function(m){
      var x=parM[m.id]; if(!x) return;
      var d=document.createElement("div");
      var coul=x.statut==="termine"?"var(--grn)":x.statut==="encours"?"#d97706":"var(--bdr)";
      d.style.cssText="background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+coul+";border-radius:10px;padding:8px 10px;margin-top:6px";
      var nA=trnNomMatch(cc,m,"a",resolus), nB=trnNomMatch(cc,m,"b",resolus);
      d.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div style="min-width:0"><div style="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase">'+authEsc(m.debut+" · "+trnTerrainTxt(cc.typesTerrains,m.terrain,true)+" · "+m.cat+" · "+m.label)+'</div>'+
        '<div style="font-size:13px;font-weight:800;color:var(--txt)">'+authEsc(nA)+' <span style="color:var(--mut)">'+(x.statut==="prevu"?"vs":(x.sa+" – "+x.sb))+'</span> '+authEsc(nB)+(x.forfait?' <span style="color:var(--red);font-size:11px">(forfait '+authEsc(x.forfait==="a"?nA:nB)+')</span>':'')+'</div></div>'+
        '<div style="text-align:right;flex-shrink:0"><div style="font-family:monospace;font-size:15px;font-weight:900;letter-spacing:1.5px;color:var(--dkg)">'+authEsc(x._code)+'</div>'+
        '<div style="font-size:10.5px;font-weight:800;color:'+coul+'">'+(x.statut==="termine"?"Clôturé":x.statut==="encours"?"En cours":"À venir")+'</div></div></div>';
      var act=document.createElement("div"); act.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";
      act.appendChild(gmBtn("Corriger le score","ghost",function(){ trnCorriger(x,nA,nB); }));
      if(x.statut==="termine") act.appendChild(gmBtn("Rouvrir","ghost",function(){ window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),{statut:"encours",forfait:null}).then(function(){ trnLiveRetirer(x); }).catch(erreur); }));
      act.appendChild(gmBtn("Forfait…","danger",function(){ trnForfait(x,nA,nB); }));
      d.appendChild(act); liste.appendChild(d);
    });
    // Recopie sur la page publique (au plus toutes les 2 s, seulement si quelque chose a changé).
    var cle=JSON.stringify([r,resolus]);
    if(cle!==dernier){
      dernier=cle; clearTimeout(pousse);
      pousse=setTimeout(function(){
        var maj={resultats:r,resolus:resolus,resultatsLe:Date.now()};
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_pages",trnPageId(eid)),maj).catch(function(){
          return trnPublier(eid).then(function(){ return window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_pages",trnPageId(eid)),maj); });
        }).catch(function(){});
        // Équipes qualifiées connues : leur nom s'affiche aussi chez la table de marque.
        trnPreparerCodes(eid,resolus).catch(function(){});
      },2000);
    }
  }
  function erreur(err){ askAlert("Action impossible ("+((err&&err.code)||"réseau")+"). Réessayez."); }
  (typeof trnSyncJoueurs==="function"?trnSyncJoueurs(eid):Promise.resolve()).then(function(){ return trnPreparerCodes(eid,null); }).then(function(l){
    codes=l; rendre();
    if(!window.fbOnSnapshot) return;
    unsub=window.fbOnSnapshot(window.fbQuery(window.fbCollection(window.fbDb,"trn_matchs"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid))),function(snap){
      if(!document.body.contains(zone)){ if(unsub) unsub(); return; }
      var l2=[]; snap.forEach(function(d){ var x=d.data(); x._code=d.id; l2.push(x); }); codes=l2; rendre();
    },function(){});
  }).catch(function(err){ etat.textContent="Préparation des codes impossible ("+((err&&err.code)||"réseau")+")."; });
}
// ── Appel avant le premier match : les absentes sont retirées, le planning est refait ──
function trnAppel(eid,codes,refaire){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  if((codes||[]).some(function(x){ return x.statut!=="prevu"; })) return askAlert("Le tournoi a commencé : utilisez « Équipe absente ou partie ».");
  var c=trnCfg(e), s=gmSheet("Appel des équipes");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Décochez les équipes qui ne sont pas venues. Elles seront retirées et le planning refait avec les équipes présentes (nouveaux codes de table de marque).";
  s.body.appendChild(t);
  var coches=[];
  trnCatsDe(c.equipes).forEach(function(cat){
    gmSection(s.body,cat);
    c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===cat; }).forEach(function(q){
      var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:10px;padding:10px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);font-size:14px;font-weight:700;color:var(--txt);cursor:pointer";
      var i=document.createElement("input"); i.type="checkbox"; i.checked=true; i.style.cssText="width:20px;height:20px";
      var n=document.createElement("span"); n.style.flex="1"; n.textContent=q.nom;
      var st=document.createElement("span"); st.style.cssText="font-size:11px;font-weight:800";
      function maj(){ st.textContent=i.checked?"Présente":"Absente"; st.style.color=i.checked?"var(--grn)":"var(--red)"; l.style.opacity=i.checked?"1":".65"; }
      i.addEventListener("change",maj); maj();
      l.appendChild(i); l.appendChild(n); l.appendChild(st); s.body.appendChild(l);
      coches.push({q:q,i:i});
    });
  });
  gmRow(s.body).appendChild(gmBtn("Valider l'appel","primary",function(){
    var absentes=coches.filter(function(o){ return !o.i.checked; }).map(function(o){ return o.q; });
    if(!absentes.length){ s.modal.remove(); showToast("Toutes les équipes sont là"); return; }
    var restantes=c.equipes.filter(function(q){ return absentes.indexOf(q)<0; });
    var seules=trnCatsDe(c.equipes).filter(function(k){ return restantes.filter(function(q){ return (q.cat||"Sans catégorie")===k; }).length===1; });
    askConfirm(absentes.length+" équipe"+(absentes.length>1?"s absentes":" absente")+" : "+absentes.map(function(q){ return q.nom; }).join(", ")+". Le planning est refait et les codes de table de marque changent (réimprimez la feuille des codes)."+
      (seules.length?" Attention : il ne reste qu'une équipe en "+seules.join(", ")+", sa catégorie n'aura pas de match.":""),{confirmText:"Refaire le planning"}).then(function(ok){
      if(!ok) return;
      var c2=Object.assign({},c,{equipes:restantes}), g=trnGenerer(c2);
      trnSauver(eid,{equipes:restantes,absentesAppel:(e.trn.absentesAppel||[]).concat(absentes.map(function(q){ return {id:q.id,nom:q.nom,cat:q.cat||""}; })),matchs:g.matchs,poules:g.poules,formats:g.formats,genereLe:Date.now()},true);
      s.modal.remove();
      // Anciens codes supprimés (aucun match n'a commencé), puis nouveaux codes et page publique.
      trnListerCodes(eid).then(function(exist){
        var bb=window.fbWriteBatch(); exist.forEach(function(x){ bb.delete(window.fbDoc(window.fbDb,"trn_matchs",x._code)); });
        return exist.length?bb.commit():null;
      }).then(function(){ return trnPreparerCodes(eid,null); }).then(function(){ return trnPublier(eid); }).then(function(){
        showToast("Planning refait : "+g.matchs.length+" matchs, fin vers "+g.finReelle);
        if(g.hors) askAlert(g.hors+" match"+(g.hors>1?"s finissent":" finit")+" après "+c.fin+" (fin réelle : "+g.finReelle+").");
        if(typeof refaire==="function") refaire();
      }).catch(function(err){ askAlert("Planning refait, mais les codes n'ont pas pu être mis à jour ("+((err&&err.code)||"réseau")+"). Rouvrez l'onglet Jour J."); if(typeof refaire==="function") refaire(); });
    });
  }));
}
// ── Tournoi commencé : forfait général d'une équipe (ses matchs restants perdus 20-0) ──
function trnDeclarerAbsente(eid,codes,apres){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var c=trnCfg(e), abs=trnAbsentes(e), s=gmSheet("Équipe absente ou partie");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Les matchs déjà joués restent. Tous ses matchs restants (phases finales comprises) sont perdus par forfait 20-0 : 0 point au classement, l'adversaire gagne.";
  s.body.appendChild(t);
  trnCatsDe(c.equipes).forEach(function(cat){
    gmSection(s.body,cat);
    c.equipes.filter(function(q){ return (q.cat||"Sans catégorie")===cat; }).forEach(function(q){
      var d=document.createElement("div"); d.style.cssText="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card)";
      var n=document.createElement("div"); n.style.cssText="flex:1;min-width:0;font-size:14px;font-weight:700;color:var(--txt)"; n.textContent=q.nom;
      d.appendChild(n);
      if(abs.indexOf(q.id)>=0){
        var tag=document.createElement("span"); tag.style.cssText="font-size:11px;font-weight:800;color:var(--red)"; tag.textContent="Absente";
        d.appendChild(tag);
        d.appendChild(gmBtn("Annuler","ghost",function(){
          askConfirm("« "+q.nom+" » est revenue ? Les forfaits déjà enregistrés restent : corrigez les scores un par un si besoin.",{confirmText:"Elle rejoue"}).then(function(ok){
            if(!ok) return; trnSauver(eid,{absentes:trnAbsentes(getEvents().find(function(x){ return x.id===eid; })).filter(function(id){ return id!==q.id; })},true);
            trnPublier(eid).catch(function(){}); s.modal.remove(); showToast(q.nom+" rejoue"); if(typeof apres==="function") apres();
          });
        }));
      } else {
        d.appendChild(gmBtn("Absente","danger",function(){
          askConfirm("Forfait général de « "+q.nom+" » : tous ses matchs restants sont perdus 20-0.",{danger:true,confirmText:"Déclarer forfait"}).then(function(ok){
            if(!ok) return;
            var e2=getEvents().find(function(x){ return x.id===eid; });
            trnSauver(eid,{absentes:trnAbsentes(e2).concat([q.id])},true);
            trnPublier(eid).catch(function(){});
            s.modal.remove(); showToast("Forfait général : "+q.nom); if(typeof apres==="function") apres();
            // Les forfaits des matchs déjà connus sont enregistrés par l'écran Jour J (resynchro).
          });
        }));
      }
      s.body.appendChild(d);
    });
  });
}
function trnCorriger(x,nA,nB){
  var s=gmSheet("Score · "+x.label), g=document.createElement("div"); g.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
  function champ(n,v){ var w=document.createElement("div"); w.className="form-group"; w.innerHTML='<label class="form-label">'+authEsc(n)+'</label>'; var i=document.createElement("input"); i.type="number"; i.min=0; i.max=250; i.className="form-input"; i.value=v; w.appendChild(i); g.appendChild(w); return i; }
  var a=champ(nA,x.sa||0), b=champ(nB,x.sb||0); s.body.appendChild(g);
  gmRow(s.body).appendChild(gmBtn("Enregistrer et clôturer","primary",function(){
    var sa=Math.max(0,Math.min(250,parseInt(a.value,10)||0)), sb=Math.max(0,Math.min(250,parseInt(b.value,10)||0));
    if(sa===sb) return askAlert("Pas de match nul au basket : vérifiez le score.");
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),{sa:sa,sb:sb,statut:"termine",forfait:null,clotureLe:Date.now()}).then(function(){ s.modal.remove(); trnLiveEcrire(x,sa,sb); }).catch(function(err){ askAlert("Enregistrement impossible ("+((err&&err.code)||"réseau")+")."); });
  }));
}
function trnForfait(x,nA,nB){
  var s=gmSheet("Forfait · "+x.label);
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);margin-bottom:8px;line-height:1.45"; t.textContent="L'équipe qui déclare forfait perd 20 à 0 et marque 0 point au classement.";
  s.body.appendChild(t);
  var row=gmRow(s.body);
  [["a",nA],["b",nB]].forEach(function(o){
    row.appendChild(gmBtn("Forfait de "+o[1],"danger",function(){
      var maj=o[0]==="a"?{sa:0,sb:20}:{sa:20,sb:0};
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),Object.assign(maj,{statut:"termine",forfait:o[0],clotureLe:Date.now()})).then(function(){ s.modal.remove(); trnLiveEcrire(x,maj.sa,maj.sb,{forfait:o[0]}); }).catch(function(err){ askAlert("Enregistrement impossible ("+((err&&err.code)||"réseau")+")."); });
    }));
  });
}
function trnPartagerMarque(){
  var s=gmSheet("Table de marque");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Le bénévole ouvre ce lien sur le téléphone ou la tablette de la table, sans compte, puis tape le code du match (sur la feuille des codes).";
  var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;padding:12px;background:#fff;border-radius:var(--rs);margin-bottom:10px";
  var box=document.createElement("div"); box.style.cssText="background:var(--card);border:1.5px dashed var(--bdr);border-radius:var(--rs);padding:12px;font-size:12px;word-break:break-all;color:var(--txt);font-family:monospace"; box.textContent=TRN_MARQUE_URL;
  s.body.appendChild(t); s.body.appendChild(qr); s.body.appendChild(box);
  if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:TRN_MARQUE_URL,width:180,height:180,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(err){} } else qr.style.display="none";
  gmRow(s.body).appendChild(gmBtn("Copier le lien","soft",function(){ copyToClipboard(TRN_MARQUE_URL); }));
}
// Feuille des codes : une page par terrain, à poser sur la table de marque.
function trnCodesPdf(eid,codes){
  if(typeof window.jspdf==="undefined") return askAlert("Chargement du générateur PDF, réessayez dans quelques secondes");
  if(!codes.length) return askAlert("Codes en préparation : réessayez dans un instant.");
  var e=getEvents().find(function(x){ return x.id===eid; })||{}, c=trnCfg(e), parM={};
  codes.forEach(function(x){ parM[x.matchId]=x; });
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), premier=true;
  for(var t=1;t<=c.terrains;t++){
    var ms=c.matchs.filter(function(m){ return m.terrain===t&&parM[m.id]; }); if(!ms.length) continue;
    if(!premier) doc.addPage(); premier=false;
    var y=18;
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb); doc.text((e.titre||"Tournoi")+" - "+trnTerrainTxt(trnCfg(e).typesTerrains,t),14,y); y+=7;
    doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110,110,110);
    doc.text("Codes de la table de marque : "+TRN_MARQUE_URL.replace("https://","")+"  -  à ne pas afficher au public",14,y); y+=10;
    ms.forEach(function(m){
      if(y>275){ doc.addPage(); y=20; }
      var x=parM[m.id];
      doc.setDrawColor(220,220,220); doc.line(14,y+3,196,y+3);
      doc.setFont("helvetica","bold"); doc.setFontSize(11); doc.setTextColor(20,20,20); doc.text(m.debut,14,y);
      doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(110,110,110); doc.text(m.cat+" - "+m.label,32,y-3.5);
      doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor(20,20,20); doc.text(doc.splitTextToSize((x.nomA||"")+"  -  "+(x.nomB||""),110)[0],32,y+1);
      doc.setFont("courier","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb); doc.text(x._code,196,y,{align:"right"});
      y+=12;
    });
  }
  doc.save(clubSlug()+"_tournoi_codes_table.pdf");
}

// ── Table de marque (page publique, sans compte) : ?marque ─────────────
function showMarque(code){
  if(typeof gmModePublic==="function") gmModePublic(true);
  stack=["marque"]; showScr("marque");
  var el=document.getElementById("marque-content"); if(!el) return;
  try{ document.title="Table de marque"; }catch(e){}
  function saisieCode(msg){
    el.innerHTML='<div style="max-width:420px;margin:0 auto;padding:40px 20px;text-align:center">'+
      '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)">Table de marque</div>'+
      '<div style="font-size:24px;font-weight:900;color:var(--txt);margin:6px 0 18px">Code du match</div>'+
      '<input id="mq-code" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="" style="width:100%;box-sizing:border-box;text-align:center;font-family:monospace;font-size:28px;font-weight:900;letter-spacing:6px;padding:14px;border-radius:14px;border:2px solid var(--bdr);background:var(--card);color:var(--txt)">'+
      (msg?'<div style="color:var(--red);font-size:13px;font-weight:700;margin-top:10px">'+authEsc(msg)+'</div>':'')+
      '<button id="mq-go" style="width:100%;margin-top:14px;padding:15px;border-radius:14px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer">Ouvrir le match</button></div>';
    var i=document.getElementById("mq-code"); i.focus();
    function go(){ var k=trnCodeNet(i.value); if(k.length!==6) return saisieCode("Le code fait 6 caractères."); ouvrir(k); }
    document.getElementById("mq-go").addEventListener("click",go);
    i.addEventListener("keydown",function(ev){ if(ev.key==="Enter") go(); });
  }
  function ouvrir(k){
    el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--mut)">Ouverture…</div>';
    var n=0;
    (function attendre(){
      if(!window.fbGetDoc||!window.fbDb){ if(n++<60){ setTimeout(attendre,100); return; } return saisieCode("Connexion impossible. Réessayez."); }
      window.fbGetDoc(window.fbDoc(window.fbDb,"trn_matchs",k)).then(function(snap){
        if(!snap.exists()) return saisieCode("Code inconnu. Vérifiez la feuille des codes.");
        feuille(k,snap.data());
      }).catch(function(){ saisieCode("Code inconnu ou connexion impossible."); });
    })();
  }
  function feuille(k,m){
    // Score + points et fautes par joueur. stats = {a:{"7":{p:12,f:2}}, b:{…}} ; "?" = sans numéro.
    var sa=Number(m.sa)||0, sb=Number(m.sb)||0, envoi=null, envoye="";
    var stats={a:Object.assign({},(m.stats&&m.stats.a)||{}),b:Object.assign({},(m.stats&&m.stats.b)||{})};
    var J={a:(m.joueursA||[]).filter(function(j){ return j.n; }),b:(m.joueursB||[]).filter(function(j){ return j.n; })};
    var attente=null, hist=[], FMAX=(m.fautesMax==null)?5:Number(m.fautesMax)||0; // 0 = pas d'exclusion
    envoye=JSON.stringify([sa,sb,stats]);
    function st(c,n){ return stats[c][n]||(stats[c][n]={p:0,f:0}); }
    function appliquer(c,act,n){
      n=n||"?";
      if(act==="f"){ st(c,n).f++; }
      else { var v=Number(act); if(c==="a") sa=Math.min(250,sa+v); else sb=Math.min(250,sb+v); st(c,n).p+=v; }
      hist.push({c:c,act:act,n:n}); attente=null; rendre(); envoyer();
    }
    function annuler(){
      var h=hist.pop(); if(!h) return;
      var x=stats[h.c][h.n]; if(!x) return;
      if(h.act==="f") x.f=Math.max(0,x.f-1);
      else { var v=Number(h.act); if(h.c==="a") sa=Math.max(0,sa-v); else sb=Math.max(0,sb-v); x.p=Math.max(0,x.p-v); }
      attente=null; rendre(); envoyer();
    }
    function rendre(){
      var fini=m.statut==="termine";
      el.innerHTML='<div style="max-width:720px;margin:0 auto;padding:18px 16px 40px">'+
        '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);text-align:center">'+authEsc((m.debut||"")+" · Terrain "+(m.terrain||"")+" · "+(m.cat||"")+" · "+(m.label||""))+'</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px">'+cote("a",m.nomA,sa,fini)+cote("b",m.nomB,sb,fini)+'</div>'+
        (fini?'':'<button id="mq-undo" style="width:100%;margin-top:10px;padding:12px;border-radius:14px;border:none;background:var(--bdr);color:var(--txt);font-size:14px;font-weight:800;cursor:pointer"'+(hist.length?'':' disabled')+'>↩ Annuler la dernière action</button>')+
        '<div id="mq-etat" style="text-align:center;font-size:12px;color:var(--mut);margin-top:10px">'+(fini?"":"Score enregistré au fur et à mesure.")+'</div>'+
        (fini?'<div style="text-align:center;margin-top:16px;padding:14px;border-radius:14px;background:color-mix(in srgb, var(--grn) 12%, transparent);color:var(--grn);font-weight:900">✓ Match clôturé : '+sa+' – '+sb+'</div><div style="text-align:center;font-size:12px;color:var(--mut);margin-top:6px">Une erreur ? Le responsable du tournoi peut corriger le score.</div>'
          :'<button id="mq-clore" style="width:100%;margin-top:14px;padding:16px;border-radius:14px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer">Clôturer le match</button>')+
        '<button id="mq-autre" style="width:100%;margin-top:10px;padding:13px;border-radius:14px;border:none;background:var(--bdr);color:var(--txt);font-size:14px;font-weight:700;cursor:pointer">Saisir un autre match</button></div>';
      el.querySelectorAll("[data-act]").forEach(function(b){
        b.addEventListener("click",function(){
          var c=b.dataset.cote, act=b.dataset.act;
          if(!J[c].length) return appliquer(c,act,"?");
          attente=(attente&&attente.c===c&&attente.act===act)?null:{c:c,act:act}; rendre();
        });
      });
      el.querySelectorAll("[data-num]").forEach(function(b){ b.addEventListener("click",function(){ if(attente) appliquer(attente.c,attente.act,b.dataset.num); }); });
      var u=document.getElementById("mq-undo"); if(u) u.addEventListener("click",annuler);
      var cl=document.getElementById("mq-clore"); if(cl) cl.addEventListener("click",clore);
      document.getElementById("mq-autre").addEventListener("click",function(){ saisieCode(""); });
    }
    function cote(c,nom,v,fini){
      var btn=function(act,txt,fond,fg){ var on=attente&&attente.c===c&&attente.act===act;
        return '<button data-cote="'+c+'" data-act="'+act+'" style="flex:1;padding:13px 0;border-radius:12px;border:'+(on?"3px solid #E8670A":"none")+';background:'+fond+';color:'+(fg||"#fff")+';font-size:16px;font-weight:900;cursor:pointer">'+txt+'</button>'; };
      var choix="";
      if(attente&&attente.c===c){
        choix='<div style="margin-top:8px;padding:8px;border-radius:12px;background:color-mix(in srgb, #E8670A 12%, transparent)"><div style="font-size:11.5px;font-weight:800;color:#E8670A;margin-bottom:6px">'+(attente.act==="f"?"Faute de qui ?":"Qui a marqué +"+attente.act+" ?")+'</div><div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">'+
          J[c].map(function(j){ var x=stats[c][j.n]||{p:0,f:0}, out=FMAX>0&&x.f>=FMAX;
            return '<button data-num="'+authEsc(j.n)+'"'+(out?' disabled':'')+' style="min-width:44px;padding:9px 8px;border-radius:10px;border:none;background:'+(out?"var(--bdr)":"var(--card)")+';color:var(--txt);font-size:15px;font-weight:900;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.15)">'+authEsc(j.n)+'</button>'; }).join("")+
          '<button data-num="?" style="padding:9px 10px;border-radius:10px;border:none;background:var(--card);color:var(--mut);font-size:12px;font-weight:800;cursor:pointer">Sans n°</button></div></div>';
      }
      var liste=J[c].length?'<div style="margin-top:8px;text-align:left">'+J[c].map(function(j){ var x=stats[c][j.n]||{p:0,f:0}, out=FMAX>0&&x.f>=FMAX, dots="";
          if(FMAX>0){ for(var i=0;i<FMAX;i++) dots+='<span style="display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:2px;background:'+(i<x.f?(x.f>=FMAX-1?"var(--red)":"#E8670A"):"var(--bdr)")+'"></span>'; }
          else dots='<span style="font-size:11px;color:var(--mut)">'+x.f+' f.</span>';
          return '<div style="display:flex;align-items:center;gap:6px;padding:4px 2px;border-top:1px solid var(--bdr);font-size:12.5px;color:var(--txt);opacity:'+(out?".45":"1")+'"><b style="width:24px;text-align:right">'+authEsc(j.n)+'</b><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+authEsc(j.p)+'</span><b>'+x.p+'</b><span>'+dots+'</span></div>'; }).join("")+'</div>':'';
      return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:12px;text-align:center;min-width:0">'+
        '<div style="font-size:14px;font-weight:900;color:var(--txt);min-height:36px;display:flex;align-items:center;justify-content:center">'+authEsc(nom||"")+'</div>'+
        '<div style="font-size:52px;font-weight:900;color:var(--dkg);font-variant-numeric:tabular-nums;line-height:1.1">'+v+'</div>'+
        (fini?'':'<div style="display:flex;gap:6px;margin-top:8px">'+btn("1","+1","var(--ltg)")+btn("2","+2","var(--dkg)")+btn("3","+3","var(--dkg)")+'</div><div style="display:flex;margin-top:6px">'+btn("f","Faute","var(--bdr)","var(--txt)")+'</div>'+choix)+
        liste+'</div>';
    }
    function envoyer(){
      clearTimeout(envoi);
      envoi=setTimeout(function(){
        var cle=JSON.stringify([sa,sb,stats]); if(cle===envoye) return;
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",k),{sa:sa,sb:sb,stats:stats,statut:"encours",majLe:Date.now()}).then(function(){
          envoye=cle; m.statut="encours"; trnLiveEncours(m,sa,sb,k); var x=document.getElementById("mq-etat"); if(x){ x.style.color="var(--mut)"; x.textContent="Score enregistré ("+new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+")."; }
        }).catch(function(){ var x=document.getElementById("mq-etat"); if(x){ x.style.color="var(--red)"; x.textContent="Pas de connexion : le score sera renvoyé au prochain point."; } envoye=""; });
      },800);
    }
    function clore(){
      if(sa===sb) return askAlert("Pas de match nul au basket : vérifiez le score avant de clôturer.");
      askPrompt("Retapez le code du match pour clôturer ("+sa+" – "+sb+")",{placeholder:"Code du match",confirmText:"Clôturer"}).then(function(v){
        if(v==null) return;
        if(trnCodeNet(v)!==k) return askAlert("Ce n'est pas le code de ce match. Le match n'est pas clôturé.");
        clearTimeout(envoi);
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",k),{sa:sa,sb:sb,stats:stats,statut:"termine",clotureLe:Date.now(),majLe:Date.now()}).then(function(){
          m.statut="termine"; m.stats=stats; rendre(); showToast("Match clôturé");
          trnLiveEcrire(m,sa,sb,{code:k,stats:stats});
        }).catch(function(){ askAlert("Clôture impossible : vérifiez la connexion et réessayez."); });
      });
    }
    rendre();
  }
  var k=trnCodeNet(code);
  if(k.length===6) ouvrir(k); else saisieCode("");
}

// ── Inscription d'une équipe par le lien public ────────────────────────
function trnInscrireEquipe(p,apres){
  var s=gmSheet("Inscrire une équipe");
  var cats=(p.catsInscr||[]).filter(Boolean);
  var f=document.createElement("div");
  function champ(id,lab,attrs){ return '<div class="form-group"><label class="form-label" for="'+id+'">'+lab+'</label><input class="form-input" id="'+id+'" '+(attrs||"")+'></div>'; }
  f.innerHTML=champ("ti-nom","Nom de l'équipe *",'maxlength="40" placeholder=""')+champ("ti-club","Club *",'maxlength="50"')+
    '<div class="form-group"><label class="form-label" for="ti-cat">Catégorie *</label><select class="form-select" id="ti-cat">'+cats.map(function(c){ return '<option>'+authEsc(c)+'</option>'; }).join("")+'</select></div>'+
    champ("ti-contact","Responsable *",'maxlength="60" placeholder="Prénom Nom"')+champ("ti-tel","Téléphone *",'type="tel" maxlength="20"')+champ("ti-email","E-mail (facultatif)",'type="email" maxlength="100"');
  s.body.appendChild(f);
  // Joueurs : numéro + prénom (modifiables ensuite avec le code « Mon équipe »).
  var ed=null;
  if(typeof trnEditeurJoueurs==="function"){
    gmSection(s.body,"Joueurs","Numéro et prénom (pas de nom de famille). Vous pourrez les modifier jusqu'au premier match.");
    ed=trnEditeurJoueurs(s.body,[]);
  }
  gmRow(s.body).appendChild(gmBtn("Envoyer l'inscription","primary",function(btn){
    function v(id){ return String((document.getElementById(id)||{}).value||"").trim(); }
    var d={clubId:p.clubId,eventId:p.eventId,nom:v("ti-nom").slice(0,40),club:v("ti-club").slice(0,50),cat:v("ti-cat").slice(0,20),contact:v("ti-contact").slice(0,60),tel:v("ti-tel").slice(0,20),email:v("ti-email").slice(0,100),at:Date.now()};
    if(!d.nom||!d.club||!d.cat||!d.contact||!d.tel) return askAlert("Remplissez les champs marqués d'une étoile.");
    if(!/^[0-9 +.]{8,20}$/.test(d.tel)) return askAlert("Numéro de téléphone invalide.");
    if(ed){ var dbl=ed.doublons(); if(dbl.length) return askAlert("Numéro en double : "+dbl.join(", ")+"."); d.joueurs=ed.lire(); d.code=trnCodeMatch(); }
    btn.disabled=true;
    window.fbAddDoc(window.fbCollection(window.fbDb,"trn_inscriptions"),d).then(function(ref){
      var lien=d.code?TRN_EQUIPE_URL+d.code:"";
      if(d.code) window.fbSetDoc(window.fbDoc(window.fbDb,"trn_equipes",d.code),{clubId:d.clubId,eventId:d.eventId,inscId:(ref&&ref.id)||"",nom:d.nom,cat:d.cat,joueurs:d.joueurs,majLe:Date.now()}).catch(function(){});
      s.body.innerHTML='<div style="text-align:center;padding:20px 6px"><div style="font-size:18px;font-weight:900;color:var(--txt)">✅ Demande envoyée</div><div style="font-size:13px;color:var(--txt2);margin-top:8px;line-height:1.5">Le club valide les équipes et publie les poules et le planning sur cette page. Vous serez contacté au '+authEsc(d.tel)+' si besoin.</div>'+
        (d.code?'<div style="margin-top:16px;padding:14px;border-radius:14px;background:var(--card);border:1.5px dashed var(--bdr)"><div style="font-size:12px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.6px">Code « Mon équipe »</div><div style="font-family:monospace;font-size:28px;font-weight:900;letter-spacing:5px;color:var(--dkg);margin:4px 0">'+authEsc(d.code)+'</div><div style="font-size:12px;color:var(--txt2)">Gardez-le : il sert à modifier vos joueurs jusqu\'au premier match.</div></div>':'')+'</div>';
      if(d.code){
        var r=gmRow(s.body), txt="Tournoi : mon code équipe "+d.nom+" = "+d.code+" ("+lien+")";
        r.appendChild(gmBtn("M'envoyer par WhatsApp","primary",function(){ window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank"); }));
        r.appendChild(gmBtn("Copier le lien","soft",function(){ if(typeof copyToClipboard==="function") copyToClipboard(lien); }));
        try{ var mem=JSON.parse(localStorage.getItem("gm_trn_codes")||"{}"); mem[p.clubId+"__"+p.eventId]=d.code; localStorage.setItem("gm_trn_codes",JSON.stringify(mem)); }catch(e){}
      }
      if(apres) apres();
    }).catch(function(){ btn.disabled=false; askAlert("Envoi impossible : les inscriptions sont peut-être fermées. Contactez le club."); });
  }));
}
// Staff : demandes d'inscription reçues par le lien.
function trnDemandesEquipes(eid){
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"trn_inscriptions"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid)))).then(function(snap){
    var l=[]; snap.forEach(function(d){ var x=d.data(); x._id=d.id; l.push(x); }); l.sort(function(a,b){ return (a.at||0)-(b.at||0); }); return l;
  });
}
function trnRendreDemandes(box,eid,apres){
  trnDemandesEquipes(eid).then(function(l){
    if(!l.length){ box.innerHTML=""; return; }
    box.innerHTML="";
    gmSection(box,"Demandes reçues par le lien · "+l.length);
    l.forEach(function(x){
      var card=gmCard(); card.style.padding="10px 12px";
      card.innerHTML='<div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(x.nom)+' <span style="font-weight:700;color:var(--mut);font-size:12px">· '+authEsc(x.cat)+'</span></div>'+
        '<div style="font-size:12px;color:var(--txt2);margin-top:2px">'+authEsc(x.club)+' · '+authEsc(x.contact)+' · '+authEsc(x.tel)+(x.email?' · '+authEsc(x.email):'')+(x.joueurs&&x.joueurs.length?' · 👕 '+x.joueurs.length+' joueur'+(x.joueurs.length>1?'s':''):'')+'</div>';
      var r=gmRow(card); r.style.marginTop="8px";
      r.appendChild(gmBtn("Accepter","primary",function(){
        var c=trnCfg(getEvents().find(function(z){ return z.id===eid; })), eq=c.equipes.slice();
        var nq={id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,4),nom:x.nom,club:x.club,cat:x.cat,source:"lien",contact:x.contact,tel:x.tel,email:x.email||""};
        if(x.joueurs&&typeof trnJoueursNet==="function"){ nq.joueurs=trnJoueursTri(trnJoueursNet(x.joueurs)); nq.joueursLe=x.at||Date.now(); }
        if(x.code){ nq.code=String(x.code).slice(0,6); window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_equipes",nq.code),{equipeId:nq.id}).catch(function(){}); }
        eq.push(nq);
        trnSauver(eid,{equipes:eq});
        // Liste éventuellement modifiée depuis par le responsable (code « Mon équipe »).
        window.fbDeleteDoc(window.fbDoc(window.fbDb,"trn_inscriptions",x._id)).catch(function(){})
          .then(function(){ return typeof trnSyncJoueurs==="function"?trnSyncJoueurs(eid):null; }).then(apres,apres);
      }));
      r.appendChild(gmBtn("Refuser","danger",function(){
        askConfirm("Refuser l'équipe « "+x.nom+" » ? Pensez à prévenir "+x.contact+" ("+x.tel+").",{danger:true,confirmText:"Refuser"}).then(function(ok){
          if(ok) window.fbDeleteDoc(window.fbDoc(window.fbDb,"trn_inscriptions",x._id)).catch(function(){}).then(apres);
        });
      }));
      box.appendChild(card);
    });
  }).catch(function(){ box.innerHTML=""; });
}
