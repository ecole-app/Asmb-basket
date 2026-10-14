// ══════════════════════════════════════════════════════════════
// BÉNÉVOLES — le dirigeant ou un coach place des personnes sur des postes
// (buvette, table de marque, chrono…) pour un match ou un événement.
// Stocké sur l'événement : e.benevoles = [{id, poste, heure, uid?, nom}].
// Aucun numéro de téléphone n'est stocké sur l'événement (lisible par tous
// les membres) : le SMS pré-rempli lit le numéro du compte au moment de l'envoi.
// La personne voit sa mission sur l'accueil de son appli (7 jours avant).
// ══════════════════════════════════════════════════════════════
var BEN_POSTES=["Buvette","Table de marque","Chronomètre","Arbitrage","Accueil","Installation / rangement"];
var BEN_COMPTES=null; // cache des comptes du club : [{uid, label, phone, prenom}]

function benListe(e){ return (e&&Array.isArray(e.benevoles))?e.benevoles:[]; }
function benEstStaff(){ return ["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0; }
function benJourTxt(e){
  try{ return new Date(e.date+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}); }catch(x){ return e.date||""; }
}
function benSauver(eid,liste){
  var evs=getEvents(), i=evs.findIndex(function(x){ return x.id===eid; });
  if(i<0) return false;
  evs[i].benevoles=liste;
  saveEvents(evs);
  return true;
}
// Comptes du club, avec un nom lisible tiré des fiches de licence (le compte n'a pas de nom).
function benChargerComptes(){
  if(BEN_COMPTES) return Promise.resolve(BEN_COMPTES);
  if(!window.fbGetDocs||!window.fbDb) return Promise.resolve([]);
  var noms={};
  (getLicences()||[]).forEach(function(l){
    var f=l&&l.fiche; if(!f) return;
    var enfant=((f.prenom||"")+" "+(f.nom||"")).trim(), net=function(t){ return String(t||"").replace(/[^+0-9]/g,""); };
    if(f.telephone&&enfant) noms[net(f.telephone)]=noms[net(f.telephone)]||{nom:enfant};
    if(f.respTel) noms[net(f.respTel)]=noms[net(f.respTel)]||{nom:f.respNom||"",de:f.prenom||enfant};
    if(f.resp2Tel) noms[net(f.resp2Tel)]=noms[net(f.resp2Tel)]||{nom:f.resp2Nom||"",de:f.prenom||enfant};
  });
  return window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(sn){
    var out=[];
    sn.forEach(function(d){
      var u=d.data()||{}, tel=String(u.phone||"").replace(/[^+0-9]/g,""), tel0=tel.replace(/^\+33/,"0"), n=noms[tel]||noms[tel0]||{};
      var roles=(u.roles||[]).filter(function(r){ return r!=="parent"; });
      var nom=n.nom||u.email||u.phone||"Compte";
      var label=nom+(n.de?" · parent de "+n.de:"")+(roles.length?" · "+roles.join(", "):"");
      out.push({uid:d.id, label:label, nom:nom, phone:tel0||tel, prenom:String(n.nom||"").split(" ")[0]});
    });
    out.sort(function(a,b){ return a.label.localeCompare(b.label,"fr"); });
    BEN_COMPTES=out; return out;
  }).catch(function(){ return []; });
}

// ── Écran du staff : postes de l'événement ───────────────────────────
function benOuvrir(eid){
  var e=getEvents().find(function(x){ return x.id===eid; }); if(!e) return;
  var s=gmSheet("Bénévoles · "+(e.titre||eventTypeLabel(e.type)));
  var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px";
  info.textContent=benJourTxt(e)+(e.heure?" · "+e.heure:"")+(e.lieu?" · "+e.lieu:"");
  s.body.appendChild(info);
  var liste=document.createElement("div"); s.body.appendChild(liste);
  function rendre(){
    var ev=getEvents().find(function(x){ return x.id===eid; })||e, l=benListe(ev);
    liste.innerHTML="";
    if(!l.length){ var v=document.createElement("div"); v.style.cssText="font-size:12.5px;color:var(--mut);padding:6px 0 10px"; v.textContent="Personne n'est encore placé. Ajoutez un poste ci-dessous."; liste.appendChild(v); }
    l.forEach(function(m){
      var d=document.createElement("div");
      d.style.cssText="display:flex;align-items:center;gap:8px;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px 10px;margin-bottom:6px";
      d.innerHTML='<div style="flex:1;min-width:0"><div style="font-size:10.5px;font-weight:800;color:var(--mut);text-transform:uppercase">'+authEsc(m.poste+(m.heure?" · "+m.heure:""))+'</div>'+
        '<div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(m.nom||"?")+(m.uid?'':' <span style="font-size:11px;color:var(--mut);font-weight:600">(sans compte)</span>')+'</div></div>';
      var sms=gmBtn("📱 SMS","soft",function(){ benSms(ev,m); }); sms.style.flex="0 0 auto";
      var del=gmBtn("✕","ghost",function(){
        benSauver(eid,benListe(getEvents().find(function(x){ return x.id===eid; })).filter(function(x){ return x.id!==m.id; })); rendre();
      }); del.style.flex="0 0 auto"; del.title="Retirer";
      d.appendChild(sms); d.appendChild(del); liste.appendChild(d);
    });
  }
  rendre();
  gmSection(s.body,"Placer quelqu'un");
  var g=document.createElement("div"); g.style.cssText="display:grid;grid-template-columns:2fr 1fr;gap:8px";
  var wp=document.createElement("div"); wp.className="form-group"; wp.innerHTML='<label class="form-label">Poste</label>';
  var poste=document.createElement("select"); poste.className="form-input";
  BEN_POSTES.concat(["Autre…"]).forEach(function(p){ var o=document.createElement("option"); o.value=p; o.textContent=p; poste.appendChild(o); });
  wp.appendChild(poste);
  var wh=document.createElement("div"); wh.className="form-group"; wh.innerHTML='<label class="form-label">Heure</label>';
  var heure=document.createElement("input"); heure.className="form-input"; heure.placeholder=""; heure.maxLength=12; heure.value=String(e.heure||"").slice(0,12);
  wh.appendChild(heure); g.appendChild(wp); g.appendChild(wh); s.body.appendChild(g);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Choisir la personne","primary",function(){
    var nomPoste=poste.value;
    var suite=function(p){
      if(!p) return;
      benChoisirPersonne(function(pers){
        if(!pers) return;
        var ev=getEvents().find(function(x){ return x.id===eid; }); if(!ev) return;
        var m={id:"b"+Date.now().toString(36)+Math.random().toString(36).slice(2,5), poste:String(p).slice(0,40), heure:heure.value.trim().slice(0,12), nom:String(pers.nom||"").slice(0,60)};
        if(pers.uid) m.uid=pers.uid;
        benSauver(eid,benListe(ev).concat([m])); rendre();
        askConfirm("Prévenir "+m.nom+" par SMS maintenant ?",{confirmText:"Envoyer le SMS"}).then(function(ok){ if(ok) benSms(ev,m,pers.phone); });
      });
    };
    if(nomPoste==="Autre…") askPrompt("Nom du poste",{placeholder:"",confirmText:"OK"}).then(function(v){ suite(v&&v.trim()); });
    else suite(nomPoste);
  }));
}
// Liste des comptes du club + « personne sans compte ».
function benChoisirPersonne(cb){
  var s=gmSheet("Qui ?"), fini=false;
  function choisir(p){ if(fini) return; fini=true; s.modal.remove(); cb(p); }
  var q=document.createElement("input"); q.className="form-input"; q.placeholder="Rechercher un nom…"; q.style.marginBottom="8px";
  s.body.appendChild(q);
  var l=document.createElement("div"); l.innerHTML='<div style="color:var(--mut);font-size:12px;padding:8px 0">Chargement…</div>'; s.body.appendChild(l);
  var autre=gmBtn("Personne sans compte dans l'appli","ghost",function(){
    askPrompt("Nom de la personne",{placeholder:"",confirmText:"OK"}).then(function(v){ v=v&&v.trim(); if(v) choisir({nom:v}); });
  });
  gmRow(s.body).appendChild(autre);
  benChargerComptes().then(function(cs){
    function rendre(){
      var t=q.value.trim().toLowerCase();
      l.innerHTML="";
      var vus=cs.filter(function(c){ return !t||c.label.toLowerCase().indexOf(t)>=0; }).slice(0,60);
      if(!vus.length){ l.innerHTML='<div style="color:var(--mut);font-size:12px;padding:8px 0">Aucun compte trouvé.</div>'; return; }
      vus.forEach(function(c){
        var b=document.createElement("button"); b.type="button";
        b.style.cssText="display:block;width:100%;text-align:left;padding:11px 12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
        b.textContent=c.label;
        b.addEventListener("click",function(){ choisir(c); });
        l.appendChild(b);
      });
    }
    q.addEventListener("input",rendre); rendre();
  });
}
function benSmsTexte(e,m){
  var club=(typeof clubLabel==="function")?clubLabel(""):"";
  var prenom=String(m.nom||"").split(" ")[0];
  return (club?club+" : ":"")+"Bonjour"+(prenom?" "+prenom:"")+", vous êtes bénévole au poste « "+m.poste+" » "+benJourTxt(e)+(m.heure?" à "+m.heure:"")+" ("+(e.titre||eventTypeLabel(e.type))+(e.lieu?", "+e.lieu:"")+"). Merci pour votre aide ! En cas d'empêchement, prévenez-nous au plus vite.";
}
function benSms(e,m,tel){
  var envoyer=function(t){
    t=String(t||"").replace(/[^+0-9]/g,"");
    if(!/^\+?[0-9]{9,15}$/.test(t)) return askAlert("Numéro de téléphone invalide.");
    window.location.href="sms:"+t+"?&body="+encodeURIComponent(benSmsTexte(e,m));
  };
  if(tel) return envoyer(tel);
  if(m.uid) return benChargerComptes().then(function(cs){
    var c=cs.find(function(x){ return x.uid===m.uid; });
    if(c&&c.phone) envoyer(c.phone);
    else askPrompt("Numéro de "+m.nom,{placeholder:"0612345678",confirmText:"Envoyer"}).then(function(v){ if(v) envoyer(v); });
  });
  askPrompt("Numéro de "+m.nom,{placeholder:"0612345678",confirmText:"Envoyer"}).then(function(v){ if(v) envoyer(v); });
}

// ── Accueil : « Ce week-end, tu es à la buvette » ───────────────────
// Rappels sur l'accueil : à J-14, à J-7, puis tous les jours à partir de J-5.
// La personne peut masquer le rappel du jour (il revient au prochain rappel).
// Une mission jamais vue s'affiche tout de suite, même hors de ces jours.
function benJourLocal(d){ d=d||new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function benJoursAvant(dateIso){ var a=new Date(benJourLocal()+"T12:00:00"), b=new Date(String(dateIso).slice(0,10)+"T12:00:00"); return Math.round((b-a)/86400000); }
function benCle(x,k){ return "gm_ben_"+k+"_"+x.e.id+"_"+x.m.id; }
function benLs(k,v){ try{ if(v===undefined) return localStorage.getItem(k); localStorage.setItem(k,v); }catch(e){ return null; } }
function benMesMissions(){
  var uid=(window.ASMB_USER&&window.ASMB_USER.uid)||""; if(!uid) return [];
  var out=[];
  (getEvents()||[]).forEach(function(e){
    if(!e||e.cancelled||e.statut==="attente"||!e.date) return;
    var j=benJoursAvant(e.date); if(j<0||j>14) return;
    benListe(e).forEach(function(m){ if(m.uid===uid) out.push({e:e,m:m,j:j}); });
  });
  return out.sort(function(a,b){ return (a.e.date+(a.m.heure||a.e.heure||"")).localeCompare(b.e.date+(b.m.heure||b.e.heure||"")); });
}
function benARappeler(x){
  var auj=benJourLocal();
  if(benLs(benCle(x,"ferme"))===auj) return false;
  return !benLs(benCle(x,"vu"))||x.j===14||x.j===7||x.j<=5;
}
function benMasquer(cle,refId,marge){ benLs(cle,benJourLocal()); benBandeau(refId,marge); }
function benQuand(j){ return j===0?"aujourd'hui":j===1?"demain":"dans "+j+" jours"; }
// Bandeau inséré juste avant l'élément refId (accueil parent, coach, dirigeant).
function benBandeau(refId,marge){
  var ref=document.getElementById(refId); if(!ref||!ref.parentNode) return;
  var id="ben-"+refId, box=document.getElementById(id);
  var ms=benMesMissions().filter(benARappeler);
  if(!ms.length){ if(box) box.remove(); return; }
  if(!box){ box=document.createElement("div"); box.id=id; ref.parentNode.insertBefore(box,ref); }
  ms.forEach(function(x){ benLs(benCle(x,"vu"),"1"); });
  var j0=ms[0].j;
  box.style.cssText="margin:"+(marge||"0 0 14px")+";padding:14px 16px;border-radius:var(--rs);background:color-mix(in srgb, #E8670A 12%, var(--card));border:1.5px solid #E8670A";
  box.innerHTML='<div style="font-size:11px;font-weight:900;letter-spacing:.8px;text-transform:uppercase;color:#E8670A;margin-bottom:6px">🙋 '+(j0===0?"Vous êtes bénévole aujourd'hui":"Rappel : vous êtes bénévole "+benQuand(j0))+'</div>'+
    ms.map(function(x){
      var j=x.j===0?"Aujourd'hui":benJourTxt(x.e);
      return '<div style="display:flex;gap:10px;align-items:flex-start;margin-top:6px"><div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:900;color:var(--txt)">'+authEsc(x.m.poste)+(x.j>1?' <span style="font-size:11px;font-weight:800;color:#E8670A">· '+benQuand(x.j)+'</span>':'')+'</div>'+
        '<div style="font-size:12px;color:var(--txt2)">'+authEsc(j.charAt(0).toUpperCase()+j.slice(1)+((x.m.heure||x.e.heure)?" à "+(x.m.heure||x.e.heure):"")+" · "+(x.e.titre||eventTypeLabel(x.e.type))+(x.e.lieu?" · "+x.e.lieu:""))+'</div></div>'+
        '<button type="button" title="Masquer ce rappel" aria-label="Masquer ce rappel" onclick="benMasquer(\''+benCle(x,"ferme")+'\',\''+refId+'\',\''+(marge||"")+'\')" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;border:none;background:color-mix(in srgb, #E8670A 18%, transparent);color:#E8670A;font-size:13px;font-weight:900;cursor:pointer">✕</button></div>';
    }).join("")+
    '<div style="font-size:11px;color:var(--mut);margin-top:8px">Un empêchement ? Prévenez le club au plus vite.</div>';
}
