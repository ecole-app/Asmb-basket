// ══════════════════════════════════════════════════════════════
// TOURNOI — JOUEURS DES ÉQUIPES (numéro + prénom)
// • Équipe inscrite par le lien : le responsable saisit ses joueurs et reçoit
//   un code « Mon équipe » (trn_equipes/{CODE}) pour les modifier jusqu'au
//   premier match (verrou posé par l'écran Jour J).
// • Équipes du club : joueurs repris des effectifs (numéro de maillot).
// • Le staff peut tout modifier (onglet Équipes).
// Stocké sur e.trn.equipes[].joueurs = [{n:"7", p:"Lina"}], publié sur
// trn_pages (numéro + prénom seulement, jamais le nom de famille).
// ══════════════════════════════════════════════════════════════
var TRN_JOUEURS_MAX=15;
var TRN_EQUIPE_URL="https://generalmanagerapp.fr/?trnequipe=";
function trnJoueursNet(l){
  return (l||[]).map(function(j){ return {n:String((j&&j.n)||"").replace(/[^0-9]/g,"").slice(0,3), p:String((j&&j.p)||"").trim().slice(0,20)}; })
    .filter(function(j){ return j.n||j.p; }).slice(0,TRN_JOUEURS_MAX);
}
function trnJoueursTri(l){ return l.slice().sort(function(a,b){ return (parseInt(a.n,10)||999)-(parseInt(b.n,10)||999)||a.p.localeCompare(b.p); }); }
// Joueurs d'une équipe du club, avec leur numéro de maillot.
function trnJoueursClub(team){
  var ps=[]; try{ ps=(typeof getPlayersForTeam==="function")?getPlayersForTeam(team):[]; }catch(e){}
  return trnJoueursTri(trnJoueursNet(ps.map(function(p){ return {n:p.maillot||"", p:p.prenom||String(p.nom||"").split(" ")[0]}; })));
}
// Éditeur : une ligne par joueur (numéro + prénom). Renvoie {lire()}.
function trnEditeurJoueurs(host,joueurs){
  var l=trnJoueursNet(joueurs); if(!l.length) l=[{n:"",p:""}];
  var box=document.createElement("div"); host.appendChild(box);
  function peindre(){
    box.innerHTML="";
    l.forEach(function(j,i){
      var r=document.createElement("div"); r.style.cssText="display:flex;gap:6px;margin-bottom:6px;align-items:center";
      var n=document.createElement("input"); n.className="form-input"; n.inputMode="numeric"; n.maxLength=3; n.value=j.n; n.placeholder="N°"; n.setAttribute("aria-label","Numéro"); n.style.cssText="width:68px;flex:0 0 68px;text-align:center;font-weight:800";
      n.addEventListener("input",function(){ n.value=n.value.replace(/[^0-9]/g,""); j.n=n.value; });
      var p=document.createElement("input"); p.className="form-input"; p.maxLength=20; p.value=j.p; p.placeholder="Prénom"; p.setAttribute("aria-label","Prénom"); p.style.flex="1";
      p.addEventListener("input",function(){ j.p=p.value; });
      var x=document.createElement("button"); x.type="button"; x.textContent="✕"; x.setAttribute("aria-label","Retirer ce joueur");
      x.style.cssText="border:none;background:none;color:var(--red);font-size:15px;cursor:pointer;padding:6px";
      x.addEventListener("click",function(){ l.splice(i,1); if(!l.length) l.push({n:"",p:""}); peindre(); });
      r.appendChild(n); r.appendChild(p); r.appendChild(x); box.appendChild(r);
    });
    if(l.length<TRN_JOUEURS_MAX){
      var a=document.createElement("button"); a.type="button"; a.textContent="+ Ajouter un joueur";
      a.style.cssText="border:none;background:none;color:var(--dkg);font-size:13px;font-weight:800;cursor:pointer;padding:4px 0";
      a.addEventListener("click",function(){ l.push({n:"",p:""}); peindre(); var ins=box.querySelectorAll("input"); if(ins.length>1) ins[ins.length-2].focus(); });
      box.appendChild(a);
    }
  }
  peindre();
  return {lire:function(){ return trnJoueursTri(trnJoueursNet(l)); }, doublons:function(){ var v={}, d=[]; trnJoueursNet(l).forEach(function(j){ if(!j.n) return; if(v[j.n]) d.push(j.n); v[j.n]=1; }); return d; }};
}
function trnCodeEquipe(){ return trnCodeMatch(); }

// ── Staff : joueurs d'une équipe (onglet Équipes) ─────────────────────
function trnEquipeJoueurs(eid,qid,apres){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var q=trnCfg(e).equipes.find(function(x){ return x.id===qid; }); if(!q) return;
  var s=gmSheet("Joueurs · "+q.nom);
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Numéro et prénom : ils s'affichent à la table de marque (points et fautes de chaque joueur) et sur la page du tournoi. Jamais le nom de famille.";
  s.body.appendChild(t);
  var ed=trnEditeurJoueurs(s.body,q.joueurs);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(){
    var d=ed.doublons(); if(d.length) return askAlert("Numéro en double : "+d.join(", ")+".");
    var j=ed.lire(), e2=getEvents().find(function(x){ return x.id===eid; });
    var eq=trnCfg(e2).equipes.map(function(x){ return x.id===qid?Object.assign({},x,{joueurs:j,joueursLe:Date.now()}):x; });
    trnSauver(eid,{equipes:eq},true);
    if(q.code&&window.fbUpdateDoc) window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_equipes",q.code),{joueurs:j,majLe:Date.now()}).catch(function(){});
    trnPublier(eid).catch(function(){});
    s.modal.remove(); showToast(j.length+" joueur"+(j.length>1?"s":"")+" enregistré"+(j.length>1?"s":"")); if(apres) apres();
  }));
  if(q.source==="club"&&typeof getTeams==="function"){
    var t2=getTeams().find(function(x){ return x.name===q.nom; });
    if(t2) row.appendChild(gmBtn("Reprendre l'effectif du club","soft",function(){ s.modal.remove(); var eq=trnCfg(getEvents().find(function(x){ return x.id===eid; })).equipes.map(function(x){ return x.id===qid?Object.assign({},x,{joueurs:trnJoueursClub(t2),joueursLe:Date.now()}):x; }); trnSauver(eid,{equipes:eq},true); trnEquipeJoueurs(eid,qid,apres); }));
  }
  if(q.code){
    var c=document.createElement("div"); c.style.cssText="font-size:11.5px;color:var(--mut);margin-top:10px";
    c.textContent="Code « Mon équipe » du responsable : "+q.code+" (modifiable par lui jusqu'au premier match).";
    s.body.appendChild(c);
  }
}
// Joueurs saisis par les responsables (trn_equipes) recopiés sur les équipes du tournoi.
function trnSyncJoueurs(eid){
  if(!window.fbGetDocs||!window.CURRENT_CLUB_ID) return Promise.resolve(false);
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"trn_equipes"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid)))).then(function(sn){
    var parCode={}; sn.forEach(function(d){ parCode[d.id]=d.data(); });
    var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return false;
    var change=false, eq=trnCfg(e).equipes.map(function(q){
      var x=q.code&&parCode[q.code]; if(!x) return q;
      var j=trnJoueursTri(trnJoueursNet(x.joueurs));
      if(JSON.stringify(j)===JSON.stringify(q.joueurs||[])||(Number(x.majLe)||0)<=(Number(q.joueursLe)||0)) return q;
      change=true; return Object.assign({},q,{joueurs:j,joueursLe:Number(x.majLe)||Date.now()});
    });
    if(change){ trnSauver(eid,{equipes:eq},true); return trnPublier(eid).then(function(){ return true; },function(){ return true; }); }
    return false;
  }).catch(function(){ return false; });
}
// Premier match commencé : les responsables ne peuvent plus modifier leurs joueurs.
function trnVerrouillerJoueurs(eid){
  if(!window.fbGetDocs||!window.fbWriteBatch) return Promise.resolve();
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"trn_equipes"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid)))).then(function(sn){
    var bb=window.fbWriteBatch(), n=0;
    sn.forEach(function(d){ if(!d.data().verrou){ bb.update(window.fbDoc(window.fbDb,"trn_equipes",d.id),{verrou:true}); n++; } });
    return n?bb.commit():null;
  }).catch(function(){});
}

// ── Page du responsable : ?trnequipe=CODE ─────────────────────────────
function showTrnEquipe(code){
  if(typeof gmModePublic==="function") gmModePublic(true);
  stack=["trnequipe"]; showScr("trnequipe");
  var el=document.getElementById("trnequipe-content"); if(!el) return;
  try{ document.title="Mon équipe"; }catch(e){}
  function saisie(msg){
    el.innerHTML='<div style="max-width:420px;margin:0 auto;padding:40px 20px;text-align:center">'+
      '<div style="font-size:12px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:var(--mut)">Tournoi</div>'+
      '<div style="font-size:24px;font-weight:900;color:var(--txt);margin:6px 0 6px">Mes joueurs</div>'+
      '<div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Tapez le code reçu à l\'inscription de votre équipe.</div>'+
      '<input id="te-code" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="Code" style="width:100%;box-sizing:border-box;text-align:center;font-family:monospace;font-size:26px;font-weight:900;letter-spacing:6px;padding:14px;border-radius:14px;border:2px solid var(--bdr);background:var(--card);color:var(--txt)">'+
      (msg?'<div style="color:var(--red);font-size:13px;font-weight:700;margin-top:10px">'+authEsc(msg)+'</div>':'')+
      '<button id="te-go" style="width:100%;margin-top:14px;padding:15px;border-radius:14px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer">Ouvrir</button></div>';
    var i=document.getElementById("te-code"); i.focus();
    function go(){ var k=trnCodeNet(i.value); if(k.length!==6) return saisie("Le code fait 6 caractères."); ouvrir(k); }
    document.getElementById("te-go").addEventListener("click",go);
    i.addEventListener("keydown",function(ev){ if(ev.key==="Enter") go(); });
  }
  function ouvrir(k){
    el.innerHTML='<div style="padding:40px 20px;text-align:center;color:var(--mut)">Ouverture…</div>';
    var n=0;
    (function attendre(){
      if(!window.fbGetDoc||!window.fbDb){ if(n++<60){ setTimeout(attendre,100); return; } return saisie("Connexion impossible. Réessayez."); }
      window.fbGetDoc(window.fbDoc(window.fbDb,"trn_equipes",k)).then(function(sn){
        if(!sn.exists()) return saisie("Code inconnu.");
        page(k,sn.data());
      }).catch(function(){ saisie("Code inconnu ou connexion impossible."); });
    })();
  }
  function page(k,d){
    el.innerHTML='<div style="max-width:520px;margin:0 auto;padding:24px 16px 40px"><div style="font-size:12px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut)">'+authEsc(d.cat||"")+'</div>'+
      '<div style="font-size:24px;font-weight:900;color:var(--txt);margin:2px 0 6px">'+authEsc(d.nom||"Mon équipe")+'</div>'+
      '<div style="font-size:13px;color:var(--txt2);line-height:1.45;margin-bottom:14px">'+(d.verrou?"Le tournoi a commencé : la liste ne peut plus être modifiée. Voyez la table de marque en cas d'erreur.":"Numéro et prénom de chaque joueur (le nom de famille n'est jamais demandé). Modifiable jusqu'au premier match.")+'</div><div id="te-liste"></div></div>';
    var host=document.getElementById("te-liste");
    if(d.verrou){
      host.innerHTML=trnJoueursTri(trnJoueursNet(d.joueurs)).map(function(j){ return '<div style="display:flex;gap:10px;padding:9px 12px;margin-bottom:6px;border-radius:10px;background:var(--card);border:1px solid var(--bdr);font-size:15px;color:var(--txt)"><b style="width:36px">'+authEsc(j.n||"–")+'</b>'+authEsc(j.p)+'</div>'; }).join("")||'<div style="color:var(--mut)">Aucun joueur.</div>';
      return;
    }
    var ed=trnEditeurJoueurs(host,d.joueurs);
    var b=document.createElement("button"); b.type="button"; b.textContent="Enregistrer mes joueurs";
    b.style.cssText="width:100%;margin-top:14px;padding:15px;border-radius:14px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer";
    host.appendChild(b);
    b.addEventListener("click",function(){
      var dd=ed.doublons(); if(dd.length) return askAlert("Numéro en double : "+dd.join(", ")+".");
      b.disabled=true;
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_equipes",k),{joueurs:ed.lire(),majLe:Date.now()}).then(function(){
        b.disabled=false; showToast("Joueurs enregistrés");
      }).catch(function(){ b.disabled=false; askAlert("Enregistrement impossible : le tournoi a peut-être commencé."); });
    });
  }
  var k=trnCodeNet(code||"");
  if(k.length===6) ouvrir(k); else saisie("");
}
