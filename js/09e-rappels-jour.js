// ═══ FENÊTRES DU JOUR (première ouverture de la journée) ═══════════════
// 1. Dirigeant, sur son accueil : « À faire aujourd'hui » (licences en attente, paiements à
//    relancer, convocations à envoyer, familles sans réponse pour un match de la semaine).
//    Une fois par jour et par club, seulement s'il y a quelque chose. Chaque ligne ouvre l'écran.
// 2. Parent, sur son accueil : « Match demain » (ou aujourd'hui) quand son enfant est attendu et
//    qu'il n'a pas encore répondu. Présent / Absent en un appui (repRepondre, js/14s), ou Plus tard.
//    Une fois par jour tant qu'il n'a pas répondu.
// Rien n'est envoyé à personne : ce sont des rappels à l'écran.
var RJ_DELAI=2500; // laisse le temps à la synchro de ramener licences, matchs et réponses

function rjJour(){ var d=new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
function rjCle(k){ return "gm_rj_"+k+"_"+(window.CURRENT_CLUB_ID||"club")+"_"+rjJour(); }
function rjDejaVu(k){ try{ return !!localStorage.getItem(rjCle(k)); }catch(e){ return true; } }
function rjMarquer(k){ try{ localStorage.setItem(rjCle(k),"1"); }catch(e){} }
function rjTr(t){ return typeof gmT==="function"?gmT(t):t; }

// Appelé par showScr (js/03-nav-portal.js).
function rjVerifier(id){
  if(window.SUPPORT_MODE||document.getElementById("rj-modale")) return;
  var p=localStorage.getItem("asmb_profile");
  var k=(id==="portal"&&p==="dirigeant")?"dir":(id==="parent-home"&&p==="parent")?"par":"";
  if(!k||rjDejaVu(k)) return;
  clearTimeout(window.__rjT);
  if(k==="dir"&&typeof benevInvitesCharger==="function") benevInvitesCharger();
  window.__rjT=setTimeout(function(){
    var on=document.querySelector(".scr.on");
    if(!on||on.id!=="scr-"+id||rjDejaVu(k)||document.getElementById("rj-modale")) return;
    if(k==="dir") rjDirigeant(); else rjParent();
  },RJ_DELAI);
}

function rjModale(contenu){
  var ov=document.createElement("div"); ov.id="rj-modale";
  ov.style.cssText="position:fixed;inset:0;z-index:320;background:rgba(10,15,25,.55);display:flex;align-items:center;justify-content:center;padding:16px";
  var box=document.createElement("div");
  box.setAttribute("role","dialog"); box.setAttribute("aria-modal","true");
  box.style.cssText="background:var(--card);color:var(--txt);border-radius:22px;padding:22px 20px 16px;width:100%;max-width:420px;max-height:88vh;overflow-y:auto;box-shadow:0 20px 50px rgba(0,0,0,.35)";
  box.addEventListener("click",function(e){ e.stopPropagation(); });
  ov.addEventListener("click",function(){ ov.remove(); });
  ov.appendChild(box); document.body.appendChild(ov);
  contenu(box,function(){ ov.remove(); });
}
function rjBouton(txt,principal,fn){
  var b=document.createElement("button"); b.type="button"; b.textContent=txt;
  b.style.cssText="width:100%;min-height:50px;border-radius:14px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-top:8px;"+
    (principal?"border:0;background:var(--dkg);color:#fff":"border:2px solid var(--bdr);background:var(--card);color:var(--txt)");
  b.addEventListener("click",fn);
  return b;
}
function rjDateLongue(){
  try{ return new Date().toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase(); }catch(e){ return ""; }
}

// ── 1. Dirigeant ──────────────────────────────────────────────────────
function rjMatchsSemaine(){
  var auj=rjJour(), fin=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  return getEvents().filter(function(e){ return e.type==="match"&&!e.cancelled&&e.date>=auj&&e.date<=fin&&e.statut!=="attente"; })
    .sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
}
function rjTaches(){
  var t=[];
  var perm=function(m){ return typeof hasModulePermission!=="function"||hasModulePermission(m); };
  if(perm("licences")&&typeof getLicences==="function"){
    var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
    var lics=getLicences().filter(function(l){ return !l.saison||!saison||l.saison>=saison; });
    var att=lics.filter(function(l){ return l.statut!=="validee"; }).length;
    if(att) t.push({ic:"🪪",lib:"Licences en attente",n:att,go:function(){ openAdminModule("licences"); }});
    if(typeof licenceStatutPaiement==="function"){
      var imp=lics.filter(function(l){ var s=licenceStatutPaiement(l); return s==="impaye"||s==="partiel"||l.suspendue; }).length;
      if(imp) t.push({ic:"💶",lib:"Paiements à relancer",n:imp,rouge:true,go:function(){
        openAdminModule("licences");
        if(typeof licShowImpayesOnly!=="undefined"){ licShowImpayesOnly=true; if(typeof buildLicences==="function") buildLicences(); }
      }});
    }
  }
  if(window.__invitesBenAttente) t.push({ic:"✉️",lib:"Invitations bénévoles sans réponse",n:window.__invitesBenAttente,go:function(){ if(typeof benevInvitesRelance==="function") benevInvitesRelance(); }});
  var matchs=rjMatchsSemaine();
  var sansConvoc=matchs.filter(function(e){ return e.equipe&&!(e.convocations||[]).length; });
  if(sansConvoc.length) t.push({ic:"📋",lib:"Convocations à envoyer",n:sansConvoc.length,go:function(){ rjChoisirMatch(sansConvoc,showConvocation); }});
  if(typeof repBilan==="function"){
    var avecConvoc=matchs.filter(function(e){ return (e.convocations||[]).length; });
    var sans=0, concernes=[];
    avecConvoc.forEach(function(e){ var n=repBilan(e).sans.length; if(n){ sans+=n; concernes.push(e); } });
    if(sans) t.push({ic:"✋",lib:"Familles sans réponse (matchs de la semaine)",n:sans,go:function(){ rjChoisirMatch(concernes,repOuvrir); }});
  }
  return t;
}
function rjChoisirMatch(l,ouvrir){
  if(l.length===1){ ouvrir(l[0].id); return; }
  var s=gmSheet("Choisir le match");
  l.forEach(function(e){
    var b=document.createElement("button"); b.type="button"; b.className="gm-plus-choix";
    var jour=(typeof plJourCourt==="function"?plJourCourt(e.date):e.date)+(e.heure?" · "+e.heure:"");
    b.innerHTML='<span style="display:block;font-weight:800" data-notr>'+authEsc(e.titre||"")+'</span><span style="display:block;font-size:12px;color:var(--mut)">'+authEsc(jour)+'</span>';
    b.addEventListener("click",function(){ s.modal.remove(); ouvrir(e.id); });
    s.body.appendChild(b);
  });
}
function rjDirigeant(){
  var t=rjTaches();
  if(!t.length) return; // rien à faire (ou données pas encore arrivées) : on revérifiera au prochain passage
  rjMarquer("dir");
  rjModale(function(box,fermer){
    var d=document.createElement("div"); d.style.cssText="font-size:12px;font-weight:800;color:var(--dkg);letter-spacing:.04em"; d.textContent=rjDateLongue();
    var h=document.createElement("div"); h.style.cssText="font-weight:900;font-size:21px;margin:2px 0 14px"; h.textContent="À faire aujourd'hui";
    box.appendChild(d); box.appendChild(h);
    t.forEach(function(x){
      var b=document.createElement("button"); b.type="button"; b.className="rj-tache";
      b.style.cssText="width:100%;display:flex;align-items:center;gap:12px;min-height:56px;padding:8px 14px;margin-bottom:8px;border-radius:14px;border:1px solid var(--bdr);background:var(--bg);color:var(--txt);font:inherit;cursor:pointer;text-align:left";
      b.innerHTML='<span style="font-size:22px" aria-hidden="true">'+x.ic+'</span><span style="flex:1;font-weight:700;font-size:14px">'+authEsc(rjTr(x.lib))+'</span>'+
        '<span style="min-width:30px;height:30px;border-radius:15px;padding:0 8px;background:'+(x.rouge?'var(--red,#c0392b)':'var(--dkg)')+';color:#fff;font-weight:900;display:flex;align-items:center;justify-content:center" data-notr>'+x.n+'</span><span style="color:var(--mut)" aria-hidden="true">›</span>';
      b.addEventListener("click",function(){ fermer(); try{ x.go(); }catch(e){ if(typeof gmSignalerErreur==="function") gmSignalerErreur(e,"rj:"+x.lib); } });
      box.appendChild(b);
    });
    box.appendChild(rjBouton("Plus tard",false,fermer));
    var n=document.createElement("div"); n.style.cssText="text-align:center;font-size:11px;color:var(--mut);margin-top:10px"; n.textContent="Affiché une fois par jour, à la première ouverture.";
    box.appendChild(n);
  });
}

// ── 2. Parent ─────────────────────────────────────────────────────────
// Match aujourd'hui ou demain, enfant attendu (convoqué, sinon dans l'équipe), sans réponse.
function rjMatchParent(){
  if(typeof getParentChildren!=="function"||typeof repAttendus!=="function") return null;
  var enfants=getParentChildren(); if(!enfants.length) return null;
  var auj=rjJour(), dem=new Date(Date.now()+86400000).toISOString().slice(0,10);
  var l=getEvents().filter(function(e){ return e.type==="match"&&!e.cancelled&&e.statut!=="attente"&&(e.date===auj||e.date===dem); })
    .sort(function(a,b){ return (a.date+(a.heure||""))<(b.date+(b.heure||""))?-1:1; });
  for(var i=0;i<l.length;i++){
    var e=l[i], att=repAttendus(e);
    var sans=enfants.filter(function(c){ return att.indexOf(String(c.id))>=0 && !repStatut(repDe(e.id,c.id)); });
    if(sans.length) return {e:e,enfants:sans};
  }
  return null;
}
function rjParent(){
  var m=rjMatchParent();
  if(!m) return;
  rjMarquer("par");
  var e=m.e;
  rjModale(function(box,fermer){
    var d=document.createElement("div"); d.style.cssText="font-size:12px;font-weight:800;color:var(--red,#c0392b);letter-spacing:.04em";
    d.textContent=e.date===rjJour()?rjTr("MATCH AUJOURD'HUI"):rjTr("MATCH DEMAIN");
    var h=document.createElement("div"); h.style.cssText="font-weight:900;font-size:21px;margin:2px 0 6px;line-height:1.25"; h.setAttribute("data-notr",""); h.textContent=e.titre||"Match";
    var q=document.createElement("div"); q.style.cssText="font-size:14px;color:var(--txt2,var(--mut));margin-bottom:4px";
    var rdv=(typeof rdvTimeFor==="function")?rdvTimeFor(e):null;
    q.textContent=(typeof plJourCourt==="function"?plJourCourt(e.date):e.date)+(e.heure?" · "+e.heure:"")+(rdv?" · RDV "+rdv.txt:"");
    box.appendChild(d); box.appendChild(h); box.appendChild(q);
    if(e.lieu){ var li=document.createElement("div"); li.style.cssText="font-size:14px;color:var(--mut);margin-bottom:6px"; li.setAttribute("data-notr",""); li.textContent=e.lieu; box.appendChild(li); }
    m.enfants.forEach(function(c){
      var bloc=document.createElement("div"); bloc.style.cssText="margin-top:14px";
      var t=document.createElement("div"); t.style.cssText="font-size:14px;font-weight:800;margin-bottom:8px";
      var nom=document.createElement("span"); nom.setAttribute("data-notr",""); nom.textContent=(c.prenom||"Mon enfant");
      t.appendChild(nom); t.appendChild(document.createTextNode(" · ")); var r=document.createElement("span"); r.textContent=rjTr("réponse attendue"); r.style.color="#E8670A"; t.appendChild(r);
      var row=document.createElement("div"); row.style.cssText="display:flex;gap:10px";
      var mk=function(val,lib,coul){
        var b=document.createElement("button"); b.type="button"; b.textContent=lib;
        b.style.cssText="flex:1;min-height:50px;border-radius:14px;font:inherit;font-weight:900;font-size:15px;cursor:pointer;"+(val==="present"?"border:0;background:"+coul+";color:#fff":"border:2px solid "+coul+";background:var(--card);color:"+coul);
        b.addEventListener("click",function(){
          var reste=m.enfants.filter(function(x){ return x!==c; });
          Promise.resolve(repRepondre(e.id,c.id,val)).then(function(){
            if(repStatut(repDe(e.id,c.id))){ bloc.remove(); m.enfants=reste; if(!reste.length) fermer(); }
          });
        });
        return b;
      };
      row.appendChild(mk("present","✓ Présent(e)","var(--ltg)")); row.appendChild(mk("absent","✕ Absent(e)","#C0392B"));
      bloc.appendChild(t); bloc.appendChild(row); box.appendChild(bloc);
    });
    box.appendChild(rjBouton("Plus tard",false,fermer));
    var n=document.createElement("div"); n.style.cssText="text-align:center;font-size:11px;color:var(--mut);margin-top:10px"; n.textContent="Affiché une fois par jour tant que vous n'avez pas répondu.";
    box.appendChild(n);
  });
}
