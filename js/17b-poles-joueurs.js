/* ===== 17b-poles-joueurs.js — Pôles : coachs choisis par le dirigeant, joueurs choisis par les coachs ===== */
// - Le dirigeant choisit les coachs de chaque pôle : clubs/{clubId}.polesCoachs
//   = {poleId: [{uid, nom}]} (nom gardé pour l'affichage sans relire les comptes).
// - Les coachs d'un pôle (et le dirigeant) y mettent des joueurs : la fiche joueur
//   porte players/{id}.poles = {poleId: {depuis, ...infos du pôle}}.
// - Formation et Événements n'ont que des coachs (séances, organisation) ;
//   Élite, 5x5, 3x3 et Basket Pour Tous ont aussi des joueurs, avec 1 ou 2 infos propres.
var POLES_JOUEURS={
  elite:{court:"Élite",champs:[{id:"niveau",label:"Niveau",options:["Débutant","Espoir","Confirmé"]},{id:"objectif",label:"Objectif",ph:"ex. Sélection départementale",max:60}]},
  competition:{court:"5x5",champs:[{id:"equipe",label:"Équipe",type:"team"}]},
  "3x3":{court:"3x3",champs:[{id:"equipe",label:"Équipe 3x3",ph:"ex. Les Verts U15",max:40}]},
  basketpourtous:{court:"Basket Pour Tous",champs:[{id:"groupe",label:"Groupe",ph:"ex. Mercredi 14h",max:40}]}
};
var currentPoleFilter="all";

function polesJoueursActifs(){
  var act=(typeof activePoles==="function")?activePoles():[];
  return act.filter(function(p){ return !!POLES_JOUEURS[p.id]; });
}
function poleDef(id){ return (typeof POLES!=="undefined"?POLES:[]).filter(function(p){ return p.id===id; })[0]||{id:id,name:id,color:"var(--dkg)"}; }
function poleCourt(id){ return (POLES_JOUEURS[id]&&POLES_JOUEURS[id].court)||poleDef(id).name; }
function poleCoachs(id){ var m=(window.CURRENT_CLUB&&window.CURRENT_CLUB.polesCoachs)||{}; return Array.isArray(m[id])?m[id]:[]; }
function poleEstDirigeant(){ return ((window.ASMB_USER&&window.ASMB_USER.roles)||[]).indexOf("dirigeant")>=0; }
function poleMonUid(){ return (window.ASMB_USER&&window.ASMB_USER.uid)||(window.fbAuth&&window.fbAuth.currentUser&&window.fbAuth.currentUser.uid)||""; }
// Qui peut mettre des joueurs dans un pôle : le dirigeant, ou un coach choisi pour ce pôle.
function peutGererPole(id){
  if(poleEstDirigeant()) return true;
  var uid=poleMonUid(); if(!uid) return false;
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  return roles.indexOf("coach")>=0&&poleCoachs(id).some(function(c){ return c.uid===uid; });
}
function joueursDuPole(id){ return getPlayers().filter(function(p){ return p.poles&&p.poles[id]; }); }
function poleInfosTxt(id,info){
  var d=POLES_JOUEURS[id]; if(!d||!info) return "";
  return d.champs.map(function(f){ return info[f.id]; }).filter(Boolean).join(" · ");
}
function polePastilles(p){
  var ids=Object.keys((p&&p.poles)||{}).filter(function(id){ return POLES_JOUEURS[id]; });
  return ids.map(function(id){ var c=poleDef(id).color||"var(--dkg)";
    return '<span style="display:inline-block;font-size:9.5px;font-weight:800;padding:2px 7px;border-radius:10px;margin:2px 4px 0 0;color:'+c+';background:color-mix(in srgb, '+c+' 13%, transparent)">'+authEsc(poleCourt(id))+'</span>'; }).join("");
}

// ── Bloc en tête de chaque page de pôle ───────────────────────────────
function poleRendreEquipe(poleId,avant){
  if(!avant||!avant.parentNode) return;
  var box=document.getElementById("pole-equipe-"+poleId);
  if(!box){ box=document.createElement("div"); box.id="pole-equipe-"+poleId; box.style.cssText="padding:12px 12px 0"; avant.parentNode.insertBefore(box,avant); }
  var col=poleDef(poleId).color||"var(--dkg)", coachs=poleCoachs(poleId), dir=poleEstDirigeant();
  var h='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:10px">'+
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px"><div style="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)">Coachs du pôle</div>'+
    (dir?'<button type="button" data-act="coachs" style="padding:5px 11px;border-radius:20px;border:none;background:color-mix(in srgb, '+col+' 12%, transparent);color:'+col+';font-size:11px;font-weight:800;cursor:pointer">Choisir les coachs</button>':'')+'</div>'+
    (coachs.length?'<div style="display:flex;flex-wrap:wrap;gap:6px">'+coachs.map(function(c){ return '<span style="font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--bdr);color:var(--txt2)">'+authEsc(c.nom||"Coach")+'</span>'; }).join("")+'</div>'
      :'<div style="font-size:12px;color:var(--mut)">'+(dir?"Aucun coach pour l'instant : choisissez qui gère ce pôle.":"Aucun coach désigné.")+'</div>')+
    '</div>';
  if(POLES_JOUEURS[poleId]){
    var js=joueursDuPole(poleId).sort(function(a,b){ return (typeof catRank==="function"?catRank(a.cat)-catRank(b.cat):0)||((a.nom||"")+(a.prenom||"")).localeCompare((b.nom||"")+(b.prenom||"")); });
    var gere=peutGererPole(poleId), cats={};
    js.forEach(function(p){ cats[p.cat||"?"]=1; });
    h+='<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:10px">'+
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px"><div style="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut)">Joueurs du pôle · '+js.length+(js.length?' · '+Object.keys(cats).length+' catégorie'+(Object.keys(cats).length>1?"s":""):'')+'</div>'+
      (gere?'<button type="button" data-act="ajout" style="padding:5px 11px;border-radius:20px;border:none;background:'+col+';color:#fff;font-size:11px;font-weight:800;cursor:pointer">+ Joueurs</button>':'')+'</div>';
    if(!js.length) h+='<div style="font-size:12px;color:var(--mut);padding:6px 0">'+(gere?"Ajoutez les joueurs suivis dans ce pôle.":"Aucun joueur pour l'instant.")+'</div>';
    js.forEach(function(p){
      var info=poleInfosTxt(poleId,p.poles[poleId]);
      h+='<div data-pid="'+authEsc(String(p.id))+'" style="display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--bdr)'+(gere?';cursor:pointer':'')+'">'+
        '<div style="flex:1;min-width:0"><div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc((p.prenom||"")+" "+(p.nom||""))+'</div>'+
        '<div style="font-size:11.5px;color:var(--mut)">'+authEsc([p.cat,info].filter(Boolean).join(" · "))+'</div></div>'+(gere?'<span style="color:var(--mut)">›</span>':'')+'</div>';
    });
    h+='</div>';
  }
  box.innerHTML=h;
  box.onclick=function(e){
    var b=e.target.closest("[data-act]");
    if(b&&b.dataset.act==="coachs") return poleChoisirCoachs(poleId,function(){ poleRendreEquipe(poleId,avant); });
    if(b&&b.dataset.act==="ajout") return poleChoisirJoueurs(poleId,function(){ poleRendreEquipe(poleId,avant); });
    var r=e.target.closest("[data-pid]");
    if(r&&peutGererPole(poleId)) poleModifierJoueur(poleId,r.dataset.pid,function(){ poleRendreEquipe(poleId,avant); });
  };
}

// ── Dirigeant : choisir les coachs d'un pôle ──────────────────────────
function poleChoisirCoachs(poleId,apres){
  if(!poleEstDirigeant()) return;
  var s=gmSheet("Coachs · "+poleDef(poleId).name);
  var t=document.createElement("div"); t.style.cssText="font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:8px";
  t.textContent=POLES_JOUEURS[poleId]?"Les coachs cochés gèrent ce pôle : ils y ajoutent leurs joueurs et renseignent leurs infos.":"Les coachs cochés sont les responsables de ce pôle.";
  var list=document.createElement("div"); list.innerHTML='<div style="font-size:12px;color:var(--mut);padding:10px 0">Chargement des comptes…</div>';
  s.body.appendChild(t); s.body.appendChild(list);
  var noms={};
  (typeof getLicences==="function"?getLicences():[]).forEach(function(l){
    if(!l||!l.fiche) return; var n=((l.fiche.prenom||"")+" "+(l.fiche.nom||"")).trim(); if(!n) return;
    [l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).forEach(function(ph){ noms[String(ph).replace(/\s+/g,"")]=n; });
  });
  function nomDe(u){
    var n=((u.prenom||"")+" "+(u.nom||"")).trim()||u.displayName||noms[String(u.phone||"").replace(/\s+/g,"")];
    return n||String(u.email||"").split("@")[0]||u.phone||"Compte";
  }
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
    var users=[]; snap.forEach(function(d){ var u=d.data(); u._uid=d.id; var r=u.roles||[]; if(r.indexOf("coach")>=0||r.indexOf("dirigeant")>=0) users.push(u); });
    users.sort(function(a,b){ return nomDe(a).localeCompare(nomDe(b)); });
    list.innerHTML="";
    if(!users.length){ list.innerHTML='<div style="font-size:12px;color:var(--mut);padding:10px 0">Aucun compte coach dans le club. Invitez vos coachs depuis « Accès & invitations ».</div>'; return; }
    var deja={}; poleCoachs(poleId).forEach(function(c){ deja[c.uid]=1; });
    var coches=[];
    users.forEach(function(u){
      var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--bdr);cursor:pointer";
      var x=document.createElement("input"); x.type="checkbox"; x.checked=!!deja[u._uid]; x.style.cssText="width:18px;height:18px;accent-color:var(--dkg);flex-shrink:0";
      var txt=document.createElement("div"); txt.style.cssText="flex:1;min-width:0";
      txt.innerHTML='<div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(nomDe(u))+'</div><div style="font-size:11.5px;color:var(--mut)">'+authEsc([(u.roles||[]).indexOf("dirigeant")>=0?"Dirigeant":"Coach",u.email&&u.email.indexOf("@joueur.")<0?u.email:""].filter(Boolean).join(" · "))+'</div>';
      l.appendChild(x); l.appendChild(txt); list.appendChild(l); coches.push({x:x,u:u});
    });
    var row=gmRow(s.body);
    row.appendChild(gmBtn("Enregistrer","primary",function(btn){
      var m=Object.assign({},(window.CURRENT_CLUB&&window.CURRENT_CLUB.polesCoachs)||{});
      m[poleId]=coches.filter(function(o){ return o.x.checked; }).map(function(o){ return {uid:o.u._uid,nom:nomDe(o.u).slice(0,60)}; });
      btn.disabled=true;
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"clubs",window.CURRENT_CLUB_ID),{polesCoachs:m}).then(function(){
        if(window.CURRENT_CLUB) window.CURRENT_CLUB.polesCoachs=m;
        s.modal.remove(); showToast("Coachs du pôle enregistrés"); if(apres) apres();
      }).catch(function(e){ btn.disabled=false; askAlert("Enregistrement impossible ("+((e&&e.code)||"réseau")+"). Réessayez."); });
    }));
  }).catch(function(e){ list.innerHTML='<div style="color:var(--red);font-size:12px;padding:10px 0">Erreur : '+authEsc((e&&e.code)||String(e))+'</div>'; });
}

// ── Coach / dirigeant : choisir les joueurs d'un pôle ─────────────────
function poleChoisirJoueurs(poleId,apres){
  if(!peutGererPole(poleId)) return;
  var s=gmSheet("Joueurs · "+poleDef(poleId).name);
  var q=document.createElement("input"); q.type="search"; q.className="form-input"; q.placeholder="Rechercher un joueur…"; q.style.marginBottom="8px";
  var f=document.createElement("div"); f.style.cssText="display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;margin-bottom:6px";
  var list=document.createElement("div");
  s.body.appendChild(q); s.body.appendChild(f); s.body.appendChild(list);
  var players=getPlayers(), choix={}, cat="all";
  players.forEach(function(p){ if(p.poles&&p.poles[poleId]) choix[p.id]=true; });
  var cats=[]; players.forEach(function(p){ if(p.cat&&cats.indexOf(p.cat)<0) cats.push(p.cat); });
  if(typeof catRank==="function") cats.sort(function(a,b){ return catRank(a)-catRank(b); });
  function rendre(){
    f.innerHTML=["all"].concat(cats).map(function(c){ return '<button type="button" class="cat-filter'+(c===cat?" on":"")+'" data-c="'+authEsc(c)+'">'+(c==="all"?"Tous":authEsc(c))+'</button>'; }).join("");
    var t=q.value.trim().toLowerCase();
    var l=players.filter(function(p){ return (cat==="all"||p.cat===cat)&&(!t||((p.prenom||"")+" "+(p.nom||"")).toLowerCase().indexOf(t)>=0); });
    l.sort(function(a,b){ return ((a.nom||"")+(a.prenom||"")).localeCompare((b.nom||"")+(b.prenom||"")); });
    list.innerHTML=l.length?l.map(function(p){ return '<label style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--bdr);cursor:pointer"><input type="checkbox" data-id="'+authEsc(String(p.id))+'"'+(choix[p.id]?" checked":"")+' style="width:18px;height:18px;accent-color:var(--dkg);flex-shrink:0"><span style="flex:1;min-width:0;font-size:13.5px;font-weight:700;color:var(--txt)">'+authEsc((p.prenom||"")+" "+(p.nom||""))+'</span><span style="font-size:11.5px;color:var(--mut)">'+authEsc(p.cat||"")+'</span></label>'; }).join("")
      :'<div style="font-size:12px;color:var(--mut);padding:10px 0">Aucun joueur.</div>';
  }
  f.addEventListener("click",function(e){ var b=e.target.closest("[data-c]"); if(!b) return; cat=b.dataset.c; rendre(); });
  list.addEventListener("change",function(e){ var x=e.target; if(x.dataset&&x.dataset.id) choix[x.dataset.id]=x.checked; });
  q.addEventListener("input",rendre); rendre();
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(){
    var auj=new Date().toISOString().slice(0,10), all=getPlayers(), n=0;
    all.forEach(function(p){
      var dedans=!!(p.poles&&p.poles[poleId]), veut=!!choix[p.id];
      if(veut===dedans) return;
      p.poles=Object.assign({},p.poles||{});
      if(veut) p.poles[poleId]={depuis:auj}; else delete p.poles[poleId];
      n++;
    });
    if(n) savePlayers(all);
    s.modal.remove(); if(n) showToast("Pôle mis à jour ("+n+" joueur"+(n>1?"s":"")+")"); if(apres) apres();
  }));
}
function poleChampsHtml(poleId,info,prefixe){
  var d=POLES_JOUEURS[poleId]; if(!d) return "";
  return d.champs.map(function(f){
    var id=prefixe+poleId+"-"+f.id, v=(info&&info[f.id])||"";
    var ctl;
    if(f.options) ctl='<select class="form-select" id="'+id+'"><option value="">—</option>'+f.options.map(function(o){ return '<option'+(o===v?" selected":"")+'>'+authEsc(o)+'</option>'; }).join("")+'</select>';
    else if(f.type==="team"){ var teams=(typeof getTeams==="function"?getTeams():[]); ctl='<select class="form-select" id="'+id+'"><option value="">—</option>'+teams.map(function(t){ var n=(t.name||"")+(t.cat?" ("+t.cat+")":""); return '<option value="'+authEsc(t.name||"")+'"'+(t.name===v?" selected":"")+'>'+authEsc(n)+'</option>'; }).join("")+'</select>'; }
    else ctl='<input class="form-input" id="'+id+'" maxlength="'+(f.max||40)+'" placeholder="'+authEsc(f.ph||"")+'" value="'+authEsc(v)+'">';
    return '<div class="form-group" style="margin-bottom:8px"><label class="form-label" for="'+id+'">'+authEsc(f.label)+'</label>'+ctl+'</div>';
  }).join("");
}
function poleLireChamps(poleId,prefixe,base){
  var d=POLES_JOUEURS[poleId], o=Object.assign({},base||{});
  if(!d) return o;
  d.champs.forEach(function(f){ var el=document.getElementById(prefixe+poleId+"-"+f.id); if(!el) return; var v=String(el.value||"").trim().slice(0,f.max||60); if(v) o[f.id]=v; else delete o[f.id]; });
  return o;
}
function poleModifierJoueur(poleId,pid,apres){
  var p=getPlayers().filter(function(x){ return String(x.id)===String(pid); })[0]; if(!p||!p.poles||!p.poles[poleId]) return;
  var s=gmSheet((p.prenom||"")+" "+(p.nom||"")+" · "+poleCourt(poleId));
  var w=document.createElement("div"); w.innerHTML=poleChampsHtml(poleId,p.poles[poleId],"pm-")+
    '<div style="font-size:11.5px;color:var(--mut);margin-bottom:6px">Dans le pôle depuis le '+authEsc(String(p.poles[poleId].depuis||"").split("-").reverse().join("/"))+'</div>';
  s.body.appendChild(w);
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Enregistrer","primary",function(){
    var all=getPlayers(), x=all.filter(function(z){ return String(z.id)===String(pid); })[0]; if(!x) return;
    x.poles=Object.assign({},x.poles||{}); x.poles[poleId]=poleLireChamps(poleId,"pm-",x.poles[poleId]);
    savePlayers(all); s.modal.remove(); if(apres) apres();
  }));
  row.appendChild(gmBtn("Retirer du pôle","danger",function(){
    askConfirm("Retirer "+(p.prenom||"ce joueur")+" du pôle "+poleDef(poleId).name+" ?",{danger:true,confirmText:"Retirer"}).then(function(ok){
      if(!ok) return;
      var all=getPlayers(), x=all.filter(function(z){ return String(z.id)===String(pid); })[0]; if(!x) return;
      x.poles=Object.assign({},x.poles||{}); delete x.poles[poleId];
      savePlayers(all); s.modal.remove(); if(apres) apres();
    });
  }));
}

// ── Fiche joueur (fenêtre Modifier) : pastilles Pôles + infos ─────────
function polesFicheHtml(p){
  var ps=polesJoueursActifs(); if(!ps.length) return "";
  var h='<div class="form-group" id="fp-poles"><label class="form-label">Pôles</label><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px">';
  ps.forEach(function(po){
    var on=!!(p&&p.poles&&p.poles[po.id]), ok=peutGererPole(po.id), c=po.color||"var(--dkg)";
    h+='<button type="button" class="fp-pole" data-pole="'+po.id+'" aria-pressed="'+on+'"'+(ok?'':' disabled title="Réservé au dirigeant et aux coachs de ce pôle"')+' style="--c:'+c+';padding:6px 11px;border-radius:20px;font-size:12px;font-weight:800;cursor:'+(ok?"pointer":"not-allowed")+';opacity:'+(ok?1:.6)+';border:1.5px solid '+(on?c:"var(--bdr)")+';background:'+(on?"color-mix(in srgb, "+c+" 14%, var(--card))":"var(--card)")+';color:var(--txt)">'+authEsc(poleCourt(po.id))+'</button>';
  });
  h+='</div>';
  ps.forEach(function(po){
    var on=!!(p&&p.poles&&p.poles[po.id]);
    h+='<div class="fp-pole-champs" data-pole="'+po.id+'" style="display:'+(on?"block":"none")+';border-left:3px solid '+(po.color||"var(--dkg)")+';padding:6px 0 2px 10px;margin:6px 0">'+
      '<div style="font-size:11px;font-weight:800;color:var(--mut);margin-bottom:4px">'+authEsc(po.name)+'</div>'+
      (peutGererPole(po.id)?poleChampsHtml(po.id,p&&p.poles&&p.poles[po.id],"fpp-"):'<div style="font-size:12px;color:var(--txt2)">'+authEsc(poleInfosTxt(po.id,p&&p.poles&&p.poles[po.id])||"—")+'</div>')+'</div>';
  });
  return h+'</div>';
}
function polesFicheBrancher(){
  var box=document.getElementById("fp-poles"); if(!box) return;
  box.addEventListener("click",function(e){
    var b=e.target.closest(".fp-pole"); if(!b||b.disabled) return;
    var on=b.getAttribute("aria-pressed")!=="true", c=b.style.getPropertyValue("--c");
    b.setAttribute("aria-pressed",String(on));
    b.style.borderColor=on?c:"var(--bdr)"; b.style.background=on?"color-mix(in srgb, "+c+" 14%, var(--card))":"var(--card)";
    var z=box.querySelector('.fp-pole-champs[data-pole="'+b.dataset.pole+'"]'); if(z) z.style.display=on?"block":"none";
  });
}
// Appelé par savePlayer : on ne touche qu'aux pôles que l'utilisateur gère.
function polesFicheLire(base){
  var box=document.getElementById("fp-poles"), out=Object.assign({},base||{});
  if(!box) return out;
  Array.prototype.forEach.call(box.querySelectorAll(".fp-pole"),function(b){
    var id=b.dataset.pole; if(!peutGererPole(id)) return;
    if(b.getAttribute("aria-pressed")==="true") out[id]=poleLireChamps(id,"fpp-",Object.assign({depuis:new Date().toISOString().slice(0,10)},out[id]||{}));
    else delete out[id];
  });
  return out;
}

// ── Liste Joueurs : filtre par pôle ───────────────────────────────────
function polesFiltreJoueurs(players,liste){
  var ps=polesJoueursActifs(), bar=document.getElementById("insc-pole-filter");
  if(!bar){
    var g=document.getElementById("insc-genre-filter");
    if(g&&ps.length){ bar=document.createElement("div"); bar.id="insc-pole-filter"; bar.style.cssText="padding:8px 12px;overflow-x:auto;display:flex;gap:8px;scrollbar-width:none;border-bottom:1px solid var(--bdr)"; g.parentNode.insertBefore(bar,g.nextSibling); }
  }
  if(bar){
    if(!ps.length){ bar.style.display="none"; currentPoleFilter="all"; }
    else {
      if(currentPoleFilter!=="all"&&!ps.some(function(p){ return p.id===currentPoleFilter; })) currentPoleFilter="all";
      bar.style.display="flex";
      bar.innerHTML='<button class="cat-filter'+(currentPoleFilter==="all"?" on":"")+'" onclick="currentPoleFilter=\'all\';renderPlayers()">Tous les pôles</button>'+
        ps.map(function(p){ var n=players.filter(function(x){ return x.poles&&x.poles[p.id]; }).length;
          return '<button class="cat-filter'+(currentPoleFilter===p.id?" on":"")+'" onclick="currentPoleFilter=\''+p.id+'\';renderPlayers()">'+authEsc(poleCourt(p.id))+' · '+n+'</button>'; }).join("");
    }
  }
  return currentPoleFilter==="all"?liste:liste.filter(function(p){ return p.poles&&p.poles[currentPoleFilter]; });
}
