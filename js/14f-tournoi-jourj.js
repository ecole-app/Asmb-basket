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
function trnPreparerCodes(eid,resolus){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return Promise.reject({code:"introuvable"});
  var c=trnCfg(e);
  return trnListerCodes(eid).then(function(exist){
    var parMatch={}; exist.forEach(function(x){ parMatch[x.matchId]=x; });
    var ops=[];
    c.matchs.forEach(function(m){
      var info={cat:m.cat,label:m.label,terrain:m.terrain,debut:m.debut,nomA:trnNomMatch(c,m,"a",resolus).slice(0,60),nomB:trnNomMatch(c,m,"b",resolus).slice(0,60)};
      var x=parMatch[m.id];
      if(!x){ var code=trnCodeMatch(); ops.push(["set",code,Object.assign({clubId:window.CURRENT_CLUB_ID,eventId:String(eid),matchId:m.id,sa:0,sb:0,statut:"prevu",creeLe:Date.now()},info)]); }
      else if(Object.keys(info).some(function(k){ return x[k]!==info[k]; })) ops.push(["update",x._code,info]);
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
function trnJourJ(zone,eid){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var c=trnCfg(e);
  if(!c.matchs.length){ var v=document.createElement("div"); v.style.cssText="font-size:12.5px;color:var(--mut);line-height:1.5"; v.textContent="Générez d'abord le planning (onglet Planning)."; zone.appendChild(v); return; }
  var aide=document.createElement("div"); aide.style.cssText="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:8px";
  aide.textContent="Chaque match a son code. La table de marque ouvre le lien « Table de marque », tape le code du match, saisit le score, puis retape le code pour clôturer. Gardez cet écran ouvert pendant le tournoi : il met à jour la page publique (scores, classements, équipes qualifiées).";
  zone.appendChild(aide);
  var row=gmRow(zone); row.style.marginTop="0";
  var etat=document.createElement("div"); etat.style.cssText="font-size:11.5px;color:var(--mut);margin-top:8px";
  var liste=document.createElement("div");
  zone.appendChild(etat); zone.appendChild(liste);
  var codes=[], unsub=null, pousse=null, dernier="";
  row.appendChild(gmBtn("Table de marque : lien + QR","primary",function(){ trnPartagerMarque(); }));
  row.appendChild(gmBtn("Codes à imprimer (PDF)","soft",function(){ trnCodesPdf(eid,codes); }));
  function res(){ var r={}; codes.forEach(function(x){ r[x.matchId]={sa:x.sa||0,sb:x.sb||0,statut:x.statut,forfait:x.forfait||""}; }); return r; }
  function rendre(){
    var e2=getEvents().find(function(x){ return x.id===eid; })||e, cc=trnCfg(e2), r=res(), resolus=trnResoudre(cc.matchs,(e2.trn&&e2.trn.poules)||{},r);
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
      d.innerHTML='<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div style="min-width:0"><div style="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase">'+authEsc(m.debut+" · T"+m.terrain+" · "+m.cat+" · "+m.label)+'</div>'+
        '<div style="font-size:13px;font-weight:800;color:var(--txt)">'+authEsc(nA)+' <span style="color:var(--mut)">'+(x.statut==="prevu"?"vs":(x.sa+" – "+x.sb))+'</span> '+authEsc(nB)+(x.forfait?' <span style="color:var(--red);font-size:11px">(forfait '+authEsc(x.forfait==="a"?nA:nB)+')</span>':'')+'</div></div>'+
        '<div style="text-align:right;flex-shrink:0"><div style="font-family:monospace;font-size:15px;font-weight:900;letter-spacing:1.5px;color:var(--dkg)">'+authEsc(x._code)+'</div>'+
        '<div style="font-size:10.5px;font-weight:800;color:'+coul+'">'+(x.statut==="termine"?"Clôturé":x.statut==="encours"?"En cours":"À venir")+'</div></div></div>';
      var act=document.createElement("div"); act.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px";
      act.appendChild(gmBtn("Corriger le score","ghost",function(){ trnCorriger(x,nA,nB); }));
      if(x.statut==="termine") act.appendChild(gmBtn("Rouvrir","ghost",function(){ window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),{statut:"encours",forfait:null}).catch(erreur); }));
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
  trnPreparerCodes(eid,null).then(function(l){
    codes=l; rendre();
    if(!window.fbOnSnapshot) return;
    unsub=window.fbOnSnapshot(window.fbQuery(window.fbCollection(window.fbDb,"trn_matchs"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID),window.fbWhere("eventId","==",String(eid))),function(snap){
      if(!document.body.contains(zone)){ if(unsub) unsub(); return; }
      var l2=[]; snap.forEach(function(d){ var x=d.data(); x._code=d.id; l2.push(x); }); codes=l2; rendre();
    },function(){});
  }).catch(function(err){ etat.textContent="Préparation des codes impossible ("+((err&&err.code)||"réseau")+")."; });
}
function trnCorriger(x,nA,nB){
  var s=gmSheet("Score · "+x.label), g=document.createElement("div"); g.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:8px";
  function champ(n,v){ var w=document.createElement("div"); w.className="form-group"; w.innerHTML='<label class="form-label">'+authEsc(n)+'</label>'; var i=document.createElement("input"); i.type="number"; i.min=0; i.max=250; i.className="form-input"; i.value=v; w.appendChild(i); g.appendChild(w); return i; }
  var a=champ(nA,x.sa||0), b=champ(nB,x.sb||0); s.body.appendChild(g);
  gmRow(s.body).appendChild(gmBtn("Enregistrer et clôturer","primary",function(){
    var sa=Math.max(0,Math.min(250,parseInt(a.value,10)||0)), sb=Math.max(0,Math.min(250,parseInt(b.value,10)||0));
    if(sa===sb) return askAlert("Pas de match nul au basket : vérifiez le score.");
    window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),{sa:sa,sb:sb,statut:"termine",forfait:null,clotureLe:Date.now()}).then(function(){ s.modal.remove(); }).catch(function(err){ askAlert("Enregistrement impossible ("+((err&&err.code)||"réseau")+")."); });
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
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",x._code),Object.assign(maj,{statut:"termine",forfait:o[0],clotureLe:Date.now()})).then(function(){ s.modal.remove(); }).catch(function(err){ askAlert("Enregistrement impossible ("+((err&&err.code)||"réseau")+")."); });
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
    doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb); doc.text((e.titre||"Tournoi")+" - Terrain "+t,14,y); y+=7;
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
      '<input id="mq-code" autocomplete="off" autocapitalize="characters" maxlength="8" placeholder="ex. K7P2XR" style="width:100%;box-sizing:border-box;text-align:center;font-family:monospace;font-size:28px;font-weight:900;letter-spacing:6px;padding:14px;border-radius:14px;border:2px solid var(--bdr);background:var(--card);color:var(--txt)">'+
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
    var sa=Number(m.sa)||0, sb=Number(m.sb)||0, envoi=null, envoye=JSON.stringify([sa,sb]);
    function rendre(){
      var fini=m.statut==="termine";
      el.innerHTML='<div style="max-width:560px;margin:0 auto;padding:18px 16px 40px">'+
        '<div style="font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--mut);text-align:center">'+authEsc((m.debut||"")+" · Terrain "+(m.terrain||"")+" · "+(m.cat||"")+" · "+(m.label||""))+'</div>'+
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">'+cote("a",m.nomA,sa,fini)+cote("b",m.nomB,sb,fini)+'</div>'+
        '<div id="mq-etat" style="text-align:center;font-size:12px;color:var(--mut);margin-top:12px">'+(fini?"":"Score enregistré au fur et à mesure.")+'</div>'+
        (fini?'<div style="text-align:center;margin-top:16px;padding:14px;border-radius:14px;background:color-mix(in srgb, var(--grn) 12%, transparent);color:var(--grn);font-weight:900">✓ Match clôturé : '+sa+' – '+sb+'</div><div style="text-align:center;font-size:12px;color:var(--mut);margin-top:8px">Une erreur ? Seul le responsable du tournoi peut rouvrir le match.</div>'
          :'<button id="mq-clore" style="width:100%;margin-top:18px;padding:16px;border-radius:14px;border:none;background:var(--dkg);color:#fff;font-size:16px;font-weight:900;cursor:pointer">Clôturer le match</button>')+
        '<button id="mq-autre" style="width:100%;margin-top:10px;padding:13px;border-radius:14px;border:none;background:var(--bdr);color:var(--txt);font-size:14px;font-weight:700;cursor:pointer">Saisir un autre match</button></div>';
      el.querySelectorAll("[data-pts]").forEach(function(b){
        b.addEventListener("click",function(){
          var c=b.dataset.cote, v=parseInt(b.dataset.pts,10);
          if(c==="a") sa=Math.max(0,Math.min(250,sa+v)); else sb=Math.max(0,Math.min(250,sb+v));
          rendre(); envoyer();
        });
      });
      var cl=document.getElementById("mq-clore"); if(cl) cl.addEventListener("click",clore);
      document.getElementById("mq-autre").addEventListener("click",function(){ saisieCode(""); });
    }
    function cote(c,nom,v,fini){
      var btn=function(p,txt,fond){ return '<button data-cote="'+c+'" data-pts="'+p+'" style="flex:1;padding:14px 0;border-radius:12px;border:none;background:'+fond+';color:'+(p<0?"var(--txt)":"#fff")+';font-size:17px;font-weight:900;cursor:pointer">'+txt+'</button>'; };
      return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:12px;text-align:center">'+
        '<div style="font-size:14px;font-weight:900;color:var(--txt);min-height:36px;display:flex;align-items:center;justify-content:center">'+authEsc(nom||"")+'</div>'+
        '<div style="font-size:56px;font-weight:900;color:var(--dkg);font-variant-numeric:tabular-nums;line-height:1.1">'+v+'</div>'+
        (fini?'':'<div style="display:flex;gap:6px;margin-top:8px">'+btn(1,"+1","var(--ltg)")+btn(2,"+2","var(--dkg)")+btn(3,"+3","var(--dkg)")+'</div><div style="display:flex;margin-top:6px">'+btn(-1,"−1","var(--bdr)")+'</div>')+'</div>';
    }
    function envoyer(){
      clearTimeout(envoi);
      envoi=setTimeout(function(){
        var cle=JSON.stringify([sa,sb]); if(cle===envoye) return;
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",k),{sa:sa,sb:sb,statut:"encours",majLe:Date.now()}).then(function(){
          envoye=cle; m.statut="encours"; var x=document.getElementById("mq-etat"); if(x) x.textContent="Score enregistré ("+new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})+").";
        }).catch(function(){ var x=document.getElementById("mq-etat"); if(x){ x.style.color="var(--red)"; x.textContent="Pas de connexion : le score sera renvoyé au prochain point."; } envoye=""; });
      },800);
    }
    function clore(){
      if(sa===sb) return askAlert("Pas de match nul au basket : vérifiez le score avant de clôturer.");
      askPrompt("Retapez le code du match pour clôturer ("+sa+" – "+sb+")",{placeholder:"Code du match",confirmText:"Clôturer"}).then(function(v){
        if(v==null) return;
        if(trnCodeNet(v)!==k) return askAlert("Ce n'est pas le code de ce match. Le match n'est pas clôturé.");
        clearTimeout(envoi);
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"trn_matchs",k),{sa:sa,sb:sb,statut:"termine",clotureLe:Date.now(),majLe:Date.now()}).then(function(){
          m.statut="termine"; rendre(); showToast("Match clôturé");
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
  f.innerHTML=champ("ti-nom","Nom de l'équipe *",'maxlength="40" placeholder="ex. BC Firminy U13"')+champ("ti-club","Club *",'maxlength="50"')+
    '<div class="form-group"><label class="form-label" for="ti-cat">Catégorie *</label><select class="form-select" id="ti-cat">'+cats.map(function(c){ return '<option>'+authEsc(c)+'</option>'; }).join("")+'</select></div>'+
    champ("ti-contact","Responsable *",'maxlength="60" placeholder="Prénom Nom"')+champ("ti-tel","Téléphone *",'type="tel" maxlength="20"')+champ("ti-email","E-mail (facultatif)",'type="email" maxlength="100"');
  s.body.appendChild(f);
  gmRow(s.body).appendChild(gmBtn("Envoyer l'inscription","primary",function(btn){
    function v(id){ return String((document.getElementById(id)||{}).value||"").trim(); }
    var d={clubId:p.clubId,eventId:p.eventId,nom:v("ti-nom").slice(0,40),club:v("ti-club").slice(0,50),cat:v("ti-cat").slice(0,20),contact:v("ti-contact").slice(0,60),tel:v("ti-tel").slice(0,20),email:v("ti-email").slice(0,100),at:Date.now()};
    if(!d.nom||!d.club||!d.cat||!d.contact||!d.tel) return askAlert("Remplissez les champs marqués d'une étoile.");
    if(!/^[0-9 +.]{8,20}$/.test(d.tel)) return askAlert("Numéro de téléphone invalide.");
    btn.disabled=true;
    window.fbAddDoc(window.fbCollection(window.fbDb,"trn_inscriptions"),d).then(function(){
      s.body.innerHTML='<div style="text-align:center;padding:20px 6px"><div style="font-size:18px;font-weight:900;color:var(--txt)">✅ Demande envoyée</div><div style="font-size:13px;color:var(--txt2);margin-top:8px;line-height:1.5">Le club valide les équipes et publie les poules et le planning sur cette page. Vous serez contacté au '+authEsc(d.tel)+' si besoin.</div></div>';
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
        '<div style="font-size:12px;color:var(--txt2);margin-top:2px">'+authEsc(x.club)+' · '+authEsc(x.contact)+' · '+authEsc(x.tel)+(x.email?' · '+authEsc(x.email):'')+'</div>';
      var r=gmRow(card); r.style.marginTop="8px";
      r.appendChild(gmBtn("Accepter","primary",function(){
        var c=trnCfg(getEvents().find(function(z){ return z.id===eid; })), eq=c.equipes.slice();
        eq.push({id:"q"+Date.now().toString(36)+Math.random().toString(36).slice(2,4),nom:x.nom,club:x.club,cat:x.cat,source:"lien",contact:x.contact,tel:x.tel,email:x.email||""});
        trnSauver(eid,{equipes:eq});
        window.fbDeleteDoc(window.fbDoc(window.fbDb,"trn_inscriptions",x._id)).catch(function(){}).then(apres);
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
