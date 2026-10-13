/* ===== 14c-entree.js — Entrée d'un événement : liste à cocher, scan des billets, code bénévole ===== */
// Écran plein page, comme un contrôle de pass : la liste des billets (on coche
// à la main) et, en bas, « Scanner un billet » (caméra du téléphone).
// - Staff connecté : lit et écrit directement clubs/{id}/evt_inscrits.
// - Bénévole sans compte : code XXXX-XXXX (evt_entrees/{code}, global) envoyé par
//   le staff avec un lien ?entree=CODE. Le doc porte la liste figée des billets
//   (sans téléphone) ; le bénévole coche presents / payes, le club les reporte
//   ensuite sur les billets (et en compta pour les paiements).

var ENTREE_URL_BASE="https://generalmanagerapp.fr/?entree=";
var ENTREE_JSQR="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

function entreeHeure(ms){ if(!ms) return ""; var d=new Date(ms); return isNaN(d)?"":d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); }
function entreeCodeDepuis(txt){
  txt=String(txt||"").trim();
  try{ var u=new URL(txt); var b=u.searchParams.get("billet"); if(b) return b.toUpperCase(); }catch(e){}
  var m=txt.toUpperCase().match(/(STG|TRN|SOI|EVT)-[0-9]{5}/);
  return m?m[0]:"";
}
// Jours au choix : l'écran Entrée travaille sur UN jour à la fois (aujourd'hui si c'est un jour de l'événement).
function entreeJourDefaut(jours){
  if(!jours||!jours.length) return null;
  var auj=new Date().toISOString().slice(0,10);
  return jours.indexOf(auj)>=0?auj:jours[0];
}
function entreeFiltrerJour(src){
  var tous=src.tous||[];
  if(!src.jours){ src.items=tous; return; }
  src.items=tous.filter(function(x){ return x.j&&x.j.indexOf(src.jour)>=0; });
  tous.forEach(function(x){ x.pr=(x.prj||{})[src.jour]||0; });
}
function entreeEvent(eid){ return (typeof getEvents==="function"?getEvents():[]).find(function(x){return x.id===eid;}); }

// Reporte sur les billets ce que les bénévoles ont coché (présents, paiements).
function entreeReporter(eid, items){
  if(!window.fbGetDocs||!window.fbQuery) return Promise.resolve([]);
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_entrees"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID)))
    .then(function(snap){
      var docs=[]; snap.forEach(function(d){ var v=d.data(); if(String(v.eventId)===String(eid)){ v._id=d.id; docs.push(v); } });
      var e=entreeEvent(eid)||{id:eid};
      var ops=[];
      items.forEach(function(x){
        var pr=0, py=0;
        docs.forEach(function(d){ var a=(d.presents||{})[x._id]; if(a) pr=pr||a; if((d.payes||{})[x._id]) py=1; });
        if(x.jours&&x.jours.length){
          x.jours.forEach(function(j){
            var aj=0; docs.forEach(function(d){ var a=(d.presents||{})[x._id+"@"+j]; if(a) aj=aj||a; });
            if(aj && !(x.presentJ||{})[j]){
              x.presentJ=x.presentJ||{}; x.presentJ[j]=aj; x.present=aj;
              var m={present:aj}; m["presentJ."+j]=aj;
              ops.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",x._id),m).catch(function(){}));
            }
          });
          pr=0;
        }
        if(pr && !x.present){
          x.present=pr;
          ops.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",x._id),{present:pr}).catch(function(){}));
        }
        if(py && !x.paye && Number(x.montant)>0 && typeof evtMarquerPaye==="function") ops.push(evtMarquerPaye(x,e,true).catch(function(){}));
      });
      return Promise.all(ops).then(function(){ return docs; });
    }).catch(function(){ return []; });
}

// ── Source « staff » : les billets eux-mêmes ────────────────────────
function evtEntree(eid){
  var e=entreeEvent(eid); if(!e) return;
  var jj=(e.inscr&&e.inscr.parJour)?evtJoursPlage(e.date,e.dateFin):null;
  var src={
    titre:e.titre||eventTypeLabel(e.type), sous:(typeof evtDateTxt==="function"?evtDateTxt(e):e.date)+(e.lieu?" · "+e.lieu:""),
    items:[], tous:[], docs:[], jours:jj, jour:entreeJourDefaut(jj),
    filtrer:function(){ entreeFiltrerJour(src); },
    charger:function(){
      return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_inscrits"),window.fbWhere("eventId","==",String(eid))))
        .then(function(snap){
          var l=[]; snap.forEach(function(d){ var v=d.data(); v._id=d.id; if(v.statut!=="annule") l.push(v); });
          return entreeReporter(eid,l).then(function(docs){
            src.docs=docs.filter(function(d){ var t=d.expiresAt&&d.expiresAt.toMillis?d.expiresAt.toMillis():0; return t>Date.now(); });
            src.tous=l.map(function(v){ return {c:v._id,p:v.prenom,n:v.nom,t:v.tarifNom,m:v.montant,mo:v.mode,py:!!v.paye,pr:v.present||0,j:v.jours||null,prj:v.presentJ||{},_x:v}; });
            src.filtrer();
          });
        });
    },
    present:function(it,val){
      var ms=val?Date.now():false;
      if(src.jours){
        var jr=src.jour, maj={}; maj["presentJ."+jr]=ms;
        var autres=Object.keys(it.prj||{}).filter(function(k){ return k!==jr&&it.prj[k]; });
        maj.present=ms||(autres.length?it.prj[autres[0]]:false);
        var opsJ=[window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",it.c),maj)];
        src.docs.forEach(function(d){ var m={}; m["presents."+it.c+"@"+jr]=ms; opsJ.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_entrees",d._id),m).catch(function(){})); });
        return Promise.all(opsJ).then(function(){ it.prj=it.prj||{}; it.prj[jr]=ms; it.pr=ms; it._x.presentJ=Object.assign({},it._x.presentJ||{}); it._x.presentJ[jr]=ms; it._x.present=maj.present; });
      }
      var ops=[window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_inscrits",it.c),{present:ms})];
      src.docs.forEach(function(d){ var m={}; m["presents."+it.c]=ms; ops.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_entrees",d._id),m).catch(function(){})); });
      return Promise.all(ops).then(function(){ it.pr=ms; it._x.present=ms; });
    },
    payer:function(it){ return evtMarquerPaye(it._x,e,true).then(function(){ it.py=true; }); }
  };
  entreeEcran(src);
}

// ── Source « bénévole » : le doc evt_entrees/{code} ────────────────
function showEntreeBenevole(code){
  code=String(code||"").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,9);
  if(typeof gmModePublic==="function") gmModePublic(true);
  if(!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)){ entreeSaisieCode(); return; }
  var n=0;
  (function attendre(){
    if(!window.fbGetDoc||!window.fbDb){ if(n++<60){ setTimeout(attendre,100); return; } askAlert("Connexion impossible. Réessayez dans un instant."); return; }
    var ref=window.fbDoc(window.fbDb,"evt_entrees",code);
    window.fbGetDoc(ref).then(function(snap){
      if(!snap.exists()){ entreeSaisieCode("Code inconnu ou révoqué."); return; }
      var d=snap.data();
      var fin=d.expiresAt&&d.expiresAt.toMillis?d.expiresAt.toMillis():0;
      if(fin<Date.now()){ entreeSaisieCode("Ce code a expiré."); return; }
      try{ localStorage.setItem("gm_entree",JSON.stringify({code:code,pid:d.clubId+"__"+d.eventId,fin:fin})); }catch(e){}
      window.CURRENT_CLUB_ID=d.clubId;
      window.CURRENT_CLUB={id:d.clubId,name:d.clubNom||"",couleur:d.couleur||null,couleur2:d.couleur2||null};
      if(typeof applyClubColor==="function") applyClubColor();
      try{ document.title="Entrée · "+(d.titre||""); }catch(e){}
      var src={
        titre:d.titre||"Entrée", sous:(d.sous||"")+" · Accès bénévole", items:[], tous:[], benevole:true,
        jours:(d.jours&&d.jours.length>1)?d.jours:null, jour:entreeJourDefaut(d.jours&&d.jours.length>1?d.jours:null),
        filtrer:function(){ entreeFiltrerJour(src); },
        appliquer:function(v){
          var pres=v.presents||{}, pays=v.payes||{};
          src.tous=(v.liste||[]).map(function(x){
            var prj=Object.assign({},x.pj||{});
            if(x.j) x.j.forEach(function(j){ var k=x.c+"@"+j; if(k in pres) prj[j]=pres[k]; });
            return {c:x.c,p:x.p,n:x.n,t:x.t,m:x.m,mo:x.mo,py:!!(x.py||pays[x.c]),j:x.j||null,prj:prj,pr:(x.c in pres)?pres[x.c]:(x.pr||0)};
          });
          src.filtrer();
        },
        charger:function(){ return window.fbGetDoc(ref).then(function(s){ if(s.exists()) src.appliquer(s.data()); }); },
        present:function(it,val){
          var k="presents."+it.c+(src.jours?"@"+src.jour:""), m={}; m[k]=val?Date.now():false;
          return window.fbUpdateDoc(ref,m).then(function(){ it.pr=m[k]; if(src.jours){ it.prj=it.prj||{}; it.prj[src.jour]=m[k]; } });
        },
        payer:function(it){ var m={}; m["payes."+it.c]=Date.now(); return window.fbUpdateDoc(ref,m).then(function(){ it.py=true; }); },
        ecouter:function(cb){
          if(window.fbOnSnapshot) return window.fbOnSnapshot(ref,function(s){ if(s.exists()){ src.appliquer(s.data()); cb(); } },function(){});
          var t=setInterval(function(){ src.charger().then(cb); },6000); return function(){ clearInterval(t); };
        }
      };
      src.appliquer(d);
      entreeEcran(src,{dejaCharge:true});
      var b=new URLSearchParams(location.search).get("billet");
      if(b) setTimeout(function(){ entreeResultat(src, entreeCodeDepuis(b)); },300);
    }).catch(function(){ entreeSaisieCode("Connexion impossible. Réessayez dans un instant."); });
  })();
}
function entreeSaisieCode(err){
  var o=entreeOverlay();
  o.innerHTML='<div style="max-width:380px;margin:0 auto;padding:60px 22px;text-align:center">'+
    '<div style="font-size:42px">🎟️</div>'+
    '<div style="font-size:20px;font-weight:900;color:var(--txt);margin-top:8px">Entrée bénévole</div>'+
    '<div style="font-size:13px;color:var(--mut);line-height:1.5;margin:8px 0 18px">Saisissez le code donné par le club pour accéder à la liste et scanner les billets.</div>'+
    (err?'<div style="font-size:13px;color:var(--red);font-weight:700;margin-bottom:10px">'+authEsc(err)+'</div>':'')+
    '<input id="entree-code-in" class="form-input" maxlength="9" placeholder="ABCD-EFGH" autocapitalize="characters" autocomplete="off" style="text-align:center;font-size:22px;font-weight:900;letter-spacing:3px;font-family:monospace">'+
    '<button id="entree-code-go" style="width:100%;margin-top:12px;padding:15px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:15px;font-weight:800;border:none;cursor:pointer">Ouvrir la liste</button></div>';
  var i=document.getElementById("entree-code-in");
  i.addEventListener("input",function(){ var v=i.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8); i.value=v.length>4?v.slice(0,4)+"-"+v.slice(4):v; });
  document.getElementById("entree-code-go").addEventListener("click",function(){ o.remove(); showEntreeBenevole(i.value); });
}

// ── Écran commun ────────────────────────────────────────────────────
function entreeOverlay(){
  var old=document.getElementById("entree-ecran"); if(old) old.remove();
  var o=document.createElement("div"); o.id="entree-ecran";
  o.style.cssText="position:fixed;inset:0;z-index:350;background:var(--bg);display:flex;flex-direction:column;overflow:hidden";
  document.body.appendChild(o); return o;
}
function entreeEcran(src, opt){
  opt=opt||{};
  var o=entreeOverlay();
  var filtre="tous", q="", stop=null;
  o.innerHTML=
    '<div style="background:linear-gradient(135deg,var(--dkg),var(--ltg));color:#fff;padding:calc(env(safe-area-inset-top) + 12px) 16px 14px;flex-shrink:0">'+
      '<div style="display:flex;align-items:center;gap:10px">'+
        (src.benevole?'':'<button id="entree-x" aria-label="Fermer" style="border:none;background:rgba(255,255,255,.18);color:#fff;width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;flex-shrink:0">✕</button>')+
        '<div style="min-width:0;flex:1"><div style="font-size:11px;font-weight:800;opacity:.85;text-transform:uppercase;letter-spacing:1px">Entrée</div>'+
        '<div style="font-size:17px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(src.titre)+'</div>'+
        '<div style="font-size:11px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(src.sous||"")+'</div></div>'+
        '<div style="text-align:right;flex-shrink:0"><div id="entree-cpt" style="font-size:22px;font-weight:900;line-height:1">0</div><div style="font-size:10px;font-weight:800;opacity:.85">ENTRÉS</div></div>'+
      '</div>'+
      '<input id="entree-q" type="search" placeholder="Rechercher un nom ou un code" style="margin-top:12px;width:100%;box-sizing:border-box;padding:10px 14px;border-radius:20px;border:none;font-size:14px;background:rgba(255,255,255,.95);color:#0b1630">'+
    '</div>'+
    '<div id="entree-jours" style="display:none;gap:6px;padding:10px 12px 0;flex-shrink:0;overflow-x:auto"></div>'+
    '<div id="entree-filtres" style="display:flex;gap:6px;padding:10px 12px 4px;flex-shrink:0;overflow-x:auto"></div>'+
    '<div id="entree-liste" style="flex:1;overflow-y:auto;padding:4px 12px 110px;-webkit-overflow-scrolling:touch"><div style="text-align:center;color:var(--mut);padding:30px;font-size:13px">Chargement…</div></div>'+
    '<div style="position:absolute;left:0;right:0;bottom:0;padding:12px 16px calc(env(safe-area-inset-bottom) + 14px);background:linear-gradient(transparent,var(--bg) 30%)">'+
      '<button id="entree-scan" style="width:100%;padding:17px;border-radius:30px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;gap:10px">'+
        '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 12h10"/></svg>'+
        'Scanner un billet</button>'+
    '</div>';
  var liste=document.getElementById("entree-liste");
  function fermer(){ if(stop) stop(); o.remove(); if(src.ferme) src.ferme(); }
  var bx=document.getElementById("entree-x"); if(bx) bx.addEventListener("click",fermer);
  document.getElementById("entree-q").addEventListener("input",function(){ q=evtNorm(this.value)+"|"+this.value.toUpperCase().trim(); peindre(); });
  document.getElementById("entree-scan").addEventListener("click",function(){ entreeScanner(src, peindre); });
  function peindre(){
    var its=src.items;
    var entres=its.filter(function(x){return x.pr;}).length;
    document.getElementById("entree-cpt").textContent=entres+" / "+its.length;
    var aPayer=its.filter(function(x){return !x.py&&Number(x.m)>0;}).length;
    var fj=document.getElementById("entree-jours");
    if(src.jours){
      fj.style.display="flex"; fj.innerHTML="";
      src.jours.forEach(function(j){
        var n=(src.tous||[]).filter(function(x){ return x.j&&x.j.indexOf(j)>=0; }).length, on=src.jour===j;
        var b=document.createElement("button"); b.type="button";
        b.style.cssText="flex-shrink:0;padding:8px 12px;border-radius:12px;font-size:12px;font-weight:800;cursor:pointer;border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--dkg) 12%, var(--card))":"var(--card)")+";color:var(--txt)";
        b.textContent=evtJourTxt(j)+" ("+n+")";
        b.addEventListener("click",function(){ src.jour=j; src.filtrer(); peindre(); });
        fj.appendChild(b);
      });
    }
    var f=document.getElementById("entree-filtres"); f.innerHTML="";
    [["tous","Tous ("+its.length+")"],["attente","À entrer ("+(its.length-entres)+")"],["entres","Entrés ("+entres+")"]].concat(aPayer?[["payer","À payer ("+aPayer+")"]]:[]).forEach(function(k){
      var b=document.createElement("button"); b.type="button"; var on=filtre===k[0];
      b.style.cssText="flex-shrink:0;padding:7px 12px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt2)");
      b.textContent=k[1]; b.addEventListener("click",function(){ filtre=k[0]; peindre(); }); f.appendChild(b);
    });
    var parts=q.split("|"), qn=parts[0]||"", qc=parts[1]||"";
    var l=its.filter(function(x){
      if(filtre==="attente"&&x.pr) return false;
      if(filtre==="entres"&&!x.pr) return false;
      if(filtre==="payer"&&(x.py||!(Number(x.m)>0))) return false;
      if(qn||qc) return evtNorm((x.p||"")+(x.n||"")).indexOf(qn)>=0||evtNorm((x.n||"")+(x.p||"")).indexOf(qn)>=0||(qc&&String(x.c).indexOf(qc)>=0);
      return true;
    }).sort(function(a,b){ return (!!a.pr-!!b.pr)||evtNorm(a.n).localeCompare(evtNorm(b.n))||evtNorm(a.p).localeCompare(evtNorm(b.p)); });
    liste.innerHTML="";
    if(!l.length){ liste.innerHTML='<div style="text-align:center;color:var(--mut);padding:30px;font-size:13px">'+(its.length?"Personne dans cette liste.":"Aucun inscrit pour le moment.")+'</div>'; return; }
    l.forEach(function(x){
      var r=document.createElement("div");
      r.style.cssText="display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:10px 12px;margin-bottom:8px"+(x.pr?";opacity:.75":"");
      var ck=document.createElement("button"); ck.type="button"; ck.setAttribute("aria-label",(x.pr?"Annuler l'entrée de ":"Valider l'entrée de ")+(x.p||""));
      ck.style.cssText="flex-shrink:0;width:44px;height:44px;border-radius:50%;cursor:pointer;font-size:20px;font-weight:900;border:2.5px solid "+(x.pr?"var(--grn)":"var(--bdr)")+";background:"+(x.pr?"var(--grn)":"var(--card)")+";color:#fff";
      ck.textContent=x.pr?"✓":"";
      ck.addEventListener("click",function(){
        if(x.pr){ askConfirm("Annuler l'entrée de "+(x.p||"")+" ?",{confirmText:"Annuler l'entrée"}).then(function(ok){ if(ok) src.present(x,false).then(peindre).catch(entreeErr); }); }
        else src.present(x,true).then(peindre).catch(entreeErr);
      });
      var g=document.createElement("div"); g.style.cssText="flex:1;min-width:0";
      var nm=document.createElement("div"); nm.style.cssText="font-size:15px;font-weight:800;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis";
      nm.textContent=(x.p||"")+" "+(x.n||"");
      var sb=document.createElement("div"); sb.style.cssText="font-size:11px;color:var(--mut);margin-top:2px";
      sb.textContent=(x.t||"")+" · "+x.c+(x.pr?" · entré à "+entreeHeure(x.pr):"");
      g.appendChild(nm); g.appendChild(sb);
      r.appendChild(ck); r.appendChild(g);
      if(Number(x.m)>0 && !x.py){
        var pb=document.createElement("button"); pb.type="button";
        pb.style.cssText="flex-shrink:0;padding:7px 10px;border-radius:20px;border:none;background:rgba(192,57,43,.12);color:var(--red);font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap";
        pb.textContent=evtPrix(x.m)+" à payer";
        pb.addEventListener("click",function(){ entreeEncaisser(src,x,peindre); });
        r.appendChild(pb);
      }
      liste.appendChild(r);
    });
  }
  src.repeindre=peindre;
  var pret=opt.dejaCharge?Promise.resolve():src.charger();
  pret.then(function(){ peindre(); if(src.ecouter) stop=src.ecouter(peindre); })
    .catch(function(e){ liste.innerHTML='<div style="color:var(--red);padding:16px;text-align:center">Erreur : '+authEsc((e&&e.code)||String(e))+'</div>'; });
}
function entreeErr(e){ askAlert("Pas enregistré : "+((e&&e.code)||e)+". Vérifiez la connexion."); }
function entreeEncaisser(src,x,fini){
  askConfirm((x.p||"")+" "+(x.n||"")+" : "+evtPrix(x.m)+" reçus ("+(EVT_MODES[x.mo]||"sur place")+") ?",{confirmText:"Paiement reçu"}).then(function(ok){
    if(ok) src.payer(x).then(fini).catch(entreeErr);
  });
}

// ── Scanner (BarcodeDetector, sinon jsQR chargé à la demande) ───────
function entreeChargerJsQR(){
  if(window.jsQR) return Promise.resolve();
  return new Promise(function(ok,ko){ var s=document.createElement("script"); s.src=ENTREE_JSQR; s.onload=ok; s.onerror=ko; document.head.appendChild(s); });
}
function entreeScanner(src, repeindre){
  var o=document.createElement("div");
  o.style.cssText="position:fixed;inset:0;z-index:360;background:#000;display:flex;flex-direction:column";
  o.innerHTML=
    '<video playsinline muted style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>'+
    '<div style="position:absolute;left:50%;top:42%;width:min(68vw,280px);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:22px;box-shadow:0 0 0 9999px rgba(0,0,0,.55);border:3px solid rgba(255,255,255,.9)"></div>'+
    '<div style="position:relative;padding:calc(env(safe-area-inset-top) + 14px) 16px;display:flex;justify-content:space-between;align-items:center;color:#fff">'+
      '<div style="font-size:15px;font-weight:800">Placez le QR code du billet dans le cadre</div>'+
      '<button class="sc-x" aria-label="Fermer le scanner" style="border:none;background:rgba(255,255,255,.2);color:#fff;width:38px;height:38px;border-radius:50%;font-size:18px;cursor:pointer">✕</button></div>'+
    '<div class="sc-msg" style="position:relative;margin:auto 16px 0;color:#fff;text-align:center;font-size:13px;opacity:.85"></div>'+
    '<div style="position:relative;padding:14px 16px calc(env(safe-area-inset-bottom) + 18px)">'+
      '<button class="sc-code" style="width:100%;padding:14px;border-radius:30px;border:1.5px solid rgba(255,255,255,.6);background:transparent;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Saisir le code du billet</button></div>'+
    '<div class="sc-res" style="position:absolute;inset:0;display:none"></div>';
  document.body.appendChild(o);
  var video=o.querySelector("video"), msg=o.querySelector(".sc-msg"), res=o.querySelector(".sc-res");
  var stream=null, actif=true, pause=false, det=null, canvas=document.createElement("canvas"), ctx=canvas.getContext("2d",{willReadFrequently:true});
  function fermer(){ actif=false; if(stream) stream.getTracks().forEach(function(t){t.stop();}); o.remove(); repeindre(); }
  o.querySelector(".sc-x").addEventListener("click",fermer);
  o.querySelector(".sc-code").addEventListener("click",function(){
    pause=true;
    var c=prompt("Code du billet (ex : STG-12345)");
    if(c) montrer(entreeCodeDepuis(c)||String(c).toUpperCase().trim()); else pause=false;
  });
  function montrer(code){
    pause=true;
    entreeResultat(src, code, res, function(){ res.style.display="none"; res.innerHTML=""; pause=false; repeindre(); boucle(); }, fermer);
  }
  function lu(txt){ var c=entreeCodeDepuis(txt); if(c) montrer(c); }
  function boucle(){
    if(!actif||pause) return;
    if(video.readyState>=2){
      if(det){
        det.detect(video).then(function(r){ if(r&&r.length&&!pause) lu(r[0].rawValue); }).catch(function(){}).then(function(){ setTimeout(boucle,180); });
        return;
      }
      if(window.jsQR){
        var w=video.videoWidth, h=video.videoHeight, k=Math.min(1,640/Math.max(w,h));
        canvas.width=Math.round(w*k); canvas.height=Math.round(h*k);
        ctx.drawImage(video,0,0,canvas.width,canvas.height);
        var img=ctx.getImageData(0,0,canvas.width,canvas.height);
        var r=window.jsQR(img.data,img.width,img.height,{inversionAttempts:"dontInvert"});
        if(r&&r.data){ lu(r.data); return; }
      }
    }
    setTimeout(boucle,200);
  }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){ msg.textContent="Caméra indisponible sur cet appareil : saisissez le code du billet."; return; }
  var prep=("BarcodeDetector" in window)?(window.BarcodeDetector.getSupportedFormats?window.BarcodeDetector.getSupportedFormats():Promise.resolve(["qr_code"])).then(function(f){ if(f.indexOf("qr_code")>=0) det=new window.BarcodeDetector({formats:["qr_code"]}); else return entreeChargerJsQR(); }).catch(entreeChargerJsQR):entreeChargerJsQR();
  prep.catch(function(){}).then(function(){
    return navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:"environment"}},audio:false});
  }).then(function(s){
    if(!actif){ s.getTracks().forEach(function(t){t.stop();}); return; }
    stream=s; video.srcObject=s; return video.play();
  }).then(function(){ boucle(); })
    .catch(function(){ msg.textContent="Accès à la caméra refusé. Autorisez-le dans les réglages du navigateur, ou saisissez le code du billet."; });
}
// Résultat d'un scan : vert = entrée validée, orange = déjà entré, rouge = inconnu.
function entreeResultat(src, code, host, suivant, fermer){
  var it=src.items.find(function(x){ return x.c===code; });
  var hj=(!it&&src.jours)?(src.tous||[]).find(function(x){ return x.c===code; }):null;
  if(!host){ host=document.createElement("div"); host.style.cssText="position:fixed;inset:0;z-index:370"; document.body.appendChild(host); var h0=host; suivant=suivant||function(){ h0.remove(); if(src.repeindre) src.repeindre(); }; }
  var etat=hj?"horsjour":(!it?"inconnu":(it.pr?"deja":"ok"));
  var col={ok:"#1E9E57",deja:"#E8670A",inconnu:"#C0392B",horsjour:"#C0392B"}[etat];
  function peindre(){
    var aPayer=it&&Number(it.m)>0&&!it.py;
    host.style.display="flex";
    host.innerHTML='<div style="margin:auto;width:100%;height:100%;background:'+col+';color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;box-sizing:border-box">'+
      '<div style="width:96px;height:96px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:54px;font-weight:900">'+(etat==="ok"?"✓":etat==="deja"?"!":"✕")+'</div>'+
      '<div style="font-size:24px;font-weight:900;margin-top:16px">'+(etat==="ok"?"Entrée validée":etat==="deja"?"Déjà entré"+(it.pr?" à "+authEsc(entreeHeure(it.pr)):""):etat==="horsjour"?"Pas inscrit ce jour":"Billet inconnu")+'</div>'+
      (hj?'<div style="font-size:20px;font-weight:800;margin-top:10px">'+authEsc((hj.p||"")+" "+(hj.n||""))+'</div><div style="font-size:14px;opacity:.95;margin-top:6px;max-width:320px;line-height:1.45">Inscrit : '+authEsc(evtJoursTxt(hj.j,src.jours.length))+'<br>Aujourd\'hui : '+authEsc(evtJourTxt(src.jour,true))+'</div>':'')+
      (it?'<div style="font-size:20px;font-weight:800;margin-top:10px">'+authEsc((it.p||"")+" "+(it.n||""))+'</div><div style="font-size:14px;opacity:.9;margin-top:4px">'+authEsc((it.t||"")+" · "+it.c)+'</div>'
         :hj?'':'<div style="font-size:14px;opacity:.9;margin-top:8px;max-width:300px;line-height:1.45">'+authEsc(code||"Code illisible")+(src.benevole?" n'est pas dans la liste. Inscription récente ? Demandez au responsable d'actualiser la liste.":" n'est pas un billet de cet événement.")+'</div>')+
      (aPayer?'<div style="margin-top:18px;background:#fff;color:#C0392B;border-radius:14px;padding:12px 16px;font-size:15px;font-weight:900">'+authEsc(evtPrix(it.m))+' à payer ('+authEsc(EVT_MODES[it.mo]||"sur place")+')</div>'+
        '<button class="sr-pay" style="margin-top:10px;padding:12px 20px;border-radius:30px;border:2px solid #fff;background:transparent;color:#fff;font-size:14px;font-weight:800;cursor:pointer">Paiement reçu</button>':'')+
      '<button class="sr-next" style="margin-top:26px;width:100%;max-width:320px;padding:16px;border-radius:30px;border:none;background:#fff;color:#0b1630;font-size:16px;font-weight:900;cursor:pointer">Scanner le suivant</button>'+
      (fermer?'<button class="sr-fin" style="margin-top:10px;padding:10px;border:none;background:none;color:#fff;font-size:13px;font-weight:700;cursor:pointer;opacity:.9">Retour à la liste</button>':'')+
    '</div>';
    host.querySelector(".sr-next").addEventListener("click",suivant);
    var f=host.querySelector(".sr-fin"); if(f) f.addEventListener("click",fermer);
    var p=host.querySelector(".sr-pay"); if(p) p.addEventListener("click",function(){ p.disabled=true; src.payer(it).then(peindre).catch(function(e){ p.disabled=false; entreeErr(e); }); });
  }
  try{ if(navigator.vibrate) navigator.vibrate(etat==="ok"?80:[60,60,60]); }catch(e){}
  if(etat==="ok") src.present(it,true).then(peindre).catch(function(e){ etat="inconnu"; col="#C0392B"; peindre(); entreeErr(e); });
  peindre();
}

// ── Codes bénévoles (staff) ─────────────────────────────────────────
function entreeListeFigee(eid){
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_inscrits"),window.fbWhere("eventId","==",String(eid)))).then(function(snap){
    var l=[]; snap.forEach(function(d){ var v=d.data(); if(v.statut!=="annule") l.push({c:d.id,p:v.prenom||"",n:v.nom||"",t:v.tarifNom||"",m:Number(v.montant)||0,mo:v.mode||"",py:!!v.paye,pr:v.jours?0:(v.present||0),j:v.jours||null,pj:v.presentJ||{}}); });
    return l;
  });
}
function evtCodesBenevoles(eid){
  var e=entreeEvent(eid); if(!e) return;
  var s=gmSheet("Code bénévole · Entrée");
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  t.textContent="Un bénévole sans compte tient l'entrée avec son téléphone : il ouvre le lien, voit la liste des inscrits (sans leurs numéros) et scanne les billets. Le code expire le lendemain de l'événement.";
  s.body.appendChild(t);
  var box=document.createElement("div"); s.body.appendChild(box);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Créer un code","primary",function(b){
    b.disabled=true;
    var code=genSecureCode(2,4);
    var fin=new Date((e.dateFin||e.date||new Date().toISOString().slice(0,10))+"T23:59:59"); fin.setDate(fin.getDate()+1);
    var c=window.CURRENT_CLUB||{};
    entreeListeFigee(eid).then(function(l){
      return window.fbSetDoc(window.fbDoc(window.fbDb,"evt_entrees",code),{
        clubId:window.CURRENT_CLUB_ID, eventId:String(eid), titre:String(e.titre||eventTypeLabel(e.type)).slice(0,100),
        sous:(typeof evtDateTxt==="function"?evtDateTxt(e):e.date)+(e.lieu?" · "+e.lieu:""), clubNom:c.name||"", couleur:c.couleur||null, couleur2:c.couleur2||null,
        liste:l, jours:(e.inscr&&e.inscr.parJour)?evtJoursPlage(e.date,e.dateFin):[], presents:{}, payes:{}, expiresAt:fin, creePar:(window.ASMB_USER&&window.ASMB_USER.uid)||null, majLe:Date.now()
      });
    }).then(function(){ b.disabled=false; charger(); entreeEnvoyerCode(code,e); })
      .catch(function(err){ b.disabled=false; askAlert("Erreur : "+((err&&err.code)||err)); });
  }));
  function charger(){
    box.innerHTML='<div style="font-size:12px;color:var(--mut);padding:6px 0">Chargement…</div>';
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_entrees"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
      box.innerHTML="";
      var n=0;
      snap.forEach(function(d){
        var v=d.data(); if(String(v.eventId)!==String(eid)) return;
        var fin=v.expiresAt&&v.expiresAt.toMillis?v.expiresAt.toMillis():0;
        if(fin<Date.now()) return;
        n++;
        var card=gmCard();
        var h=document.createElement("div"); h.style.cssText="font-size:20px;font-weight:900;letter-spacing:2px;font-family:monospace;color:var(--dkg)"; h.textContent=d.id;
        var m=document.createElement("div"); m.style.cssText="font-size:11px;color:var(--mut);margin-top:2px";
        m.textContent=(v.liste||[]).length+" inscrit"+((v.liste||[]).length>1?"s":"")+" dans la liste · "+Object.keys(v.presents||{}).filter(function(k){return v.presents[k];}).length+" entré(s) par ce code · expire le "+new Date(fin).toLocaleDateString("fr-FR");
        card.appendChild(h); card.appendChild(m);
        var r=gmRow(card);
        r.appendChild(gmBtn("Envoyer","primary",function(){ entreeEnvoyerCode(d.id,e); }));
        r.appendChild(gmBtn("Actualiser la liste","soft",function(bb){
          bb.disabled=true;
          entreeListeFigee(eid).then(function(l){ return window.fbUpdateDoc(window.fbDoc(window.fbDb,"evt_entrees",d.id),{liste:l,majLe:Date.now()}); })
            .then(function(){ showToast("Liste à jour"); charger(); }).catch(function(err){ bb.disabled=false; askAlert("Erreur : "+((err&&err.code)||err)); });
        }));
        r.appendChild(gmBtn("Révoquer","danger",function(){
          askConfirm("Révoquer le code "+d.id+" ? Le bénévole n'aura plus accès à la liste.",{danger:true,confirmText:"Révoquer"}).then(function(ok){
            if(!ok) return;
            entreeReporterDoc(eid).then(function(){ return window.fbDeleteDoc(window.fbDoc(window.fbDb,"evt_entrees",d.id)); }).then(charger)
              .catch(function(err){ askAlert("Erreur : "+((err&&err.code)||err)); });
          });
        }));
        box.appendChild(card);
      });
      if(!n) box.innerHTML='<div style="font-size:12px;color:var(--mut);padding:6px 0 10px">Aucun code actif.</div>';
    }).catch(function(err){ box.innerHTML='<div style="color:var(--red);font-size:12px">Erreur : '+authEsc((err&&err.code)||String(err))+'</div>'; });
  }
  charger();
}
// Avant de révoquer un code, on reporte ce qu'il a coché.
function entreeReporterDoc(eid){
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"evt_inscrits"),window.fbWhere("eventId","==",String(eid)))).then(function(snap){
    var l=[]; snap.forEach(function(d){ var x=d.data(); x._id=d.id; if(x.statut!=="annule") l.push(x); });
    return entreeReporter(eid,l);
  }).catch(function(){});
}
function entreeEnvoyerCode(code,e){
  var url=ENTREE_URL_BASE+encodeURIComponent(code);
  var txt=(clubLabel("")||"Le club")+" : merci de tenir l'entrée de « "+(e.titre||eventTypeLabel(e.type))+" » ! Ouvre ce lien sur ton téléphone : "+url+" (code "+code+"). Tu pourras scanner les billets.";
  var s=gmSheet("Envoyer le code");
  var big=document.createElement("div"); big.style.cssText="text-align:center;font-size:30px;font-weight:900;letter-spacing:3px;font-family:monospace;color:var(--dkg);padding:10px 0";
  big.textContent=code; s.body.appendChild(big);
  var l=document.createElement("div"); l.style.cssText="font-size:12px;color:var(--mut);text-align:center;word-break:break-all;margin-bottom:12px"; l.textContent=url; s.body.appendChild(l);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("WhatsApp","primary",function(){ window.open("https://wa.me/?text="+encodeURIComponent(txt),"_blank"); }));
  row.appendChild(gmBtn("SMS","soft",function(){ window.location.href="sms:?&body="+encodeURIComponent(txt); }));
  row.appendChild(gmBtn("Copier","soft",function(){ copyToClipboard(txt); }));
}

// ── Lien d'un billet ouvert hors de l'appli (?billet=CODE&evt=…) ────
function showBilletPublic(code, pid){
  code=entreeCodeDepuis(code)||String(code||"").toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,9);
  pid=String(pid||"").replace(/[^a-z0-9_-]/gi,"").slice(0,140);
  // Bénévole déjà connecté par code sur ce téléphone : on valide directement.
  try{
    var g=JSON.parse(localStorage.getItem("gm_entree")||"null");
    if(g&&g.fin>Date.now()&&(!pid||g.pid===pid)){ showEntreeBenevole(g.code); return; }
  }catch(e){}
  if(pid && typeof showEvtPublic==="function"){
    if(typeof evtBilletDepuisLien==="function") evtBilletDepuisLien(code,pid);
    var mes=(typeof evtMesBillets==="function")?evtMesBillets(pid):[];
    showEvtPublic(pid);
    if(!mes.some(function(b){return b.code===code;})) setTimeout(function(){ showToast("Billet "+code+" : présentez ce QR code à l'entrée"); },800);
    return;
  }
  var o=entreeOverlay();
  o.innerHTML='<div style="padding:60px 22px;text-align:center"><div style="font-size:40px">🎟️</div><div style="font-size:22px;font-weight:900;font-family:monospace;color:var(--dkg);margin-top:10px">'+authEsc(code)+'</div><div style="font-size:13px;color:var(--mut);margin-top:8px">Présentez ce billet à l\'entrée.</div></div>';
}
