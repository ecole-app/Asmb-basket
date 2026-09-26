/* ===== 11-admin.js — Espace Admin, acces coach, fiches recues, notes de frais ===== */
// ═══ ADMIN ════════════════════════════════════════════════════════
var ADMIN_MODULES=[
 {id:"parametres",name:"Paramètres",sub:"Notifications - Compte - Données",icon:"⚙",color:"#5a76aa",scr:"parametres"},
 {id:"communaute",name:"Communauté",sub:"Canaux · Membres · Discussions",icon:"💬",color:"#16A085",scr:"admin-comm"},
 {id:"licences",name:"Licences",sub:"Envoi · Suivi · Validation",icon:"📋",color:"#27AE60",scr:"licences"},
 {id:"inscriptions",name:"Inscriptions",sub:"Fiches joueurs · Licences",icon:"📝",color:"#1B5C28",scr:"inscriptions"},
 {id:"equipes",name:"Équipes",sub:"Composition · Staff · Maillots",icon:"👥",color:"#16A085",scr:"equipes"},
 {id:"planning",name:"Planning",sub:"Salles · Créneaux · Matchs",icon:"📅",color:"#1A2E5A",scr:"planning"},
 {id:"documents",name:"Documents",sub:"Fichiers · Formulaires",icon:"📁",color:"#8E44AD",scr:"documents"},
 {id:"acces",name:"Accès coach",sub:"Rôles · Équipes des comptes",icon:"🔑",color:"#E8670A",scr:"admin"},
 {id:"avis",name:"Avis & suggestions",sub:"Retours des membres",icon:"💡",color:"#8E44AD",scr:"admin"},
 {id:"fiches",name:"Fiches reçues",sub:"Inscriptions à valider",icon:"📥",color:"#16A085",scr:"admin"},
 {id:"comptabilite",name:"Comptabilité",sub:"Recettes · Dépenses",icon:"💶",color:"#1A2E5A",scr:"comptabilite"},
 {id:"notesfrais",name:"Notes de frais",sub:"Dépenses des coachs/bénévoles",icon:"🧾",color:"#E8670A",scr:"admin"},
 {id:"inventaire",name:"Inventaire",sub:"Buvette · Matériel",icon:"📦",color:"#16A085",scr:"inventaire"},
];
var CATS=["U7","U9","U11","U13","U15","U17","Senior"];
var CAT_COLORS={"U7":"#E8670A","U9":"#8E44AD","U11":"#16A085","U13":"#27AE60","U15":"#1A2E5A","U17":"#C0392B","U18":"#0B7285","U21":"#5B3A8E","Senior":"#E8670A"};
var currentCatFilter="all";
var editingPlayerId=null;

function tryLogin(){
 // Demo mode - direct access
 enterAdmin();
}
function enterAdmin(){
 buildAdminHome();
 stack.push("admin");
 showScr("admin");
}
// ── APPUI LONG + GLISSER (reordonnancement tactile, generique) ─────
var PRESS_DRAG_STATE={active:false,item:null,placeholder:null,offsetY:0,onDrop:null};
var PRESS_DRAG_GLOBAL_WIRED=false;
function wirePressDragGlobalListenersOnce(){
  if(PRESS_DRAG_GLOBAL_WIRED) return;
  PRESS_DRAG_GLOBAL_WIRED=true;
  var autoScrollInterval=null;
  var lastPointerY=0;
  function getScrollEl(){
    return document.getElementById("main-scroll") || document.scrollingElement;
  }
  function startAutoScroll(){
    if(autoScrollInterval) return;
    autoScrollInterval=setInterval(function(){
      var s=PRESS_DRAG_STATE;
      if(!s.active){ stopAutoScroll(); return; }
      var scrollEl=getScrollEl();
      if(!scrollEl) return;
      var vh=window.innerHeight;
      var edge=90; // zone sensible en haut/bas de l'ecran
      var speed=0;
      if(lastPointerY<edge) speed=-(edge-lastPointerY)/edge*16;
      else if(lastPointerY>vh-edge) speed=(lastPointerY-(vh-edge))/edge*16;
      if(speed!==0){
        scrollEl.scrollTop+=speed;
        // L'element glisse suit le doigt (position:fixed), pas besoin de recalculer sa position ici :
        // le prochain pointermove recalculera item.style.top normalement.
      }
    },16);
  }
  function stopAutoScroll(){
    if(autoScrollInterval){ clearInterval(autoScrollInterval); autoScrollInterval=null; }
  }
  document.addEventListener("pointermove",function(e){
    var s=PRESS_DRAG_STATE;
    if(!s.active) return;
    e.preventDefault();
    lastPointerY=e.clientY;
    startAutoScroll();
    var item=s.item;
    item.style.top=(e.clientY-s.offsetY)+"px";
    var siblings=Array.prototype.slice.call(item.parentNode.children).filter(function(c){return c!==item && c!==s.placeholder;});
    for(var i=0;i<siblings.length;i++){
      var r=siblings[i].getBoundingClientRect();
      if(e.clientY<r.top+r.height/2){ item.parentNode.insertBefore(s.placeholder,siblings[i]); break; }
      if(i===siblings.length-1){ item.parentNode.insertBefore(s.placeholder,siblings[i].nextSibling); }
    }
  },{passive:false});
  document.addEventListener("pointerup",function(){stopAutoScroll();finishPressDrag();});
  document.addEventListener("pointercancel",function(){stopAutoScroll();finishPressDrag();});
}
function finishPressDrag(){
  var s=PRESS_DRAG_STATE;
  if(!s.active) return;
  s.active=false;
  var item=s.item, placeholder=s.placeholder, onDrop=s.onDrop;
  item.classList.remove("press-dragging");
  item.style.position="";item.style.left="";item.style.top="";item.style.width="";
  item.parentNode.insertBefore(item,placeholder);
  placeholder.remove();
  var order=Array.prototype.slice.call(item.parentNode.children)
    .filter(function(c){return c.classList&&(c.classList.contains("admin-card")||c.classList.contains("param-block"));})
    .map(function(c){return c.dataset.moduleId||c.dataset.sec;});
  s.item=null;s.placeholder=null;s.onDrop=null;
  if(onDrop) onDrop(order);
}
// items : tableau d'elements DOM freres (deja dans l'ordre affiche) ; onDrop(newOrderIds) est
// appele avec la nouvelle liste d'ids (data-module-id ou data-sec) apres relachement.
function enablePressDrag(items, onDrop){
  wirePressDragGlobalListenersOnce();
  items.forEach(function(item){
    var handle=item.querySelector(".drag-handle")||item;
    handle.style.touchAction="none"; // seule la poignee bloque le scroll natif, pas toute la carte
    var pressTimer=null, startY=0, startX=0;
    function cancelPress(){ if(pressTimer){clearTimeout(pressTimer);pressTimer=null;} }
    handle.addEventListener("pointerdown",function(e){
      startY=e.clientY; startX=e.clientX;
      pressTimer=setTimeout(function(){
        var rect=item.getBoundingClientRect();
        var placeholder=document.createElement("div");
        placeholder.style.cssText="height:"+rect.height+"px;margin:"+getComputedStyle(item).marginTop+" 0";
        item.parentNode.insertBefore(placeholder,item.nextSibling);
        item.classList.add("press-dragging");
        item.style.position="fixed";
        item.style.left=rect.left+"px";
        item.style.top=rect.top+"px";
        item.style.width=rect.width+"px";
        PRESS_DRAG_STATE={active:true,item:item,placeholder:placeholder,offsetY:startY-rect.top,onDrop:onDrop};
        if(navigator.vibrate) navigator.vibrate(15);
      }, 380);
    });
    handle.addEventListener("pointermove",function(e){
      if(PRESS_DRAG_STATE.active) return;
      if(Math.abs(e.clientY-startY)>18 || Math.abs(e.clientX-startX)>18) cancelPress();
    });
    handle.addEventListener("pointerup",cancelPress);
    handle.addEventListener("pointerleave",function(){ if(!PRESS_DRAG_STATE.active) cancelPress(); });
  });
}

// ── MODE ORGANISATION DES MODULES ADMIN (ordre + masquage) ─────────
var ADMIN_EDIT_MODE=false;
function getAdminModuleOrder(){try{return JSON.parse(localStorage.getItem("asmb_admin_module_order")||"[]");}catch(e){return [];}}
function saveAdminModuleOrder(o){localStorage.setItem("asmb_admin_module_order",JSON.stringify(o));}
function getHiddenAdminModules(){try{return JSON.parse(localStorage.getItem("asmb_admin_module_hidden")||"[]");}catch(e){return [];}}
function saveHiddenAdminModules(h){localStorage.setItem("asmb_admin_module_hidden",JSON.stringify(h));}
function getOrderedAdminModules(){
  var order=getAdminModuleOrder();
  var byId={};ADMIN_MODULES.forEach(function(m){byId[m.id]=m;});
  var ordered=order.map(function(id){return byId[id];}).filter(Boolean);
  ADMIN_MODULES.forEach(function(m){ if(ordered.indexOf(m)<0) ordered.push(m); });
  return ordered;
}
function moveAdminModule(id,delta){
  var ids=getOrderedAdminModules().map(function(m){return m.id;});
  var from=ids.indexOf(id);
  if(from<0) return;
  var to=from+delta;
  if(to<0||to>=ids.length) return;
  ids.splice(from,1);
  ids.splice(to,0,id);
  saveAdminModuleOrder(ids);
  buildAdminHome();
}
function toggleHiddenAdminModule(id){
  var h=getHiddenAdminModules();
  var i=h.indexOf(id);
  if(i>=0) h.splice(i,1); else h.push(id);
  saveHiddenAdminModules(h);
  buildAdminHome();
}
function toggleAdminEditMode(){
  ADMIN_EDIT_MODE=!ADMIN_EDIT_MODE;
  var btn=document.getElementById("admin-edit-toggle");
  if(btn){
    btn.textContent=ADMIN_EDIT_MODE?"Terminé":"Organiser";
    btn.style.background=ADMIN_EDIT_MODE?"#fff":"rgba(255,255,255,.15)";
    btn.style.color=ADMIN_EDIT_MODE?"var(--dkg)":"#fff";
  }
  buildAdminHome();
}

function buildAdminHome(){
 var el=document.getElementById("adminCards");if(!el)return;el.innerHTML="";
 var banner=document.getElementById("season-banner");
 if(banner){
   var cur=getCurrentSeason(), natural=computeNaturalSeason();
   if(natural!==cur){
     banner.innerHTML='<div style="margin:0 12px 14px;background:rgba(232,103,10,.1);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:12px 14px">'+
       '<div style="font-size:13px;font-weight:700;color:#E8670A">La saison '+natural+' a commencé</div>'+
       '<div style="font-size:11px;color:var(--mut);margin-top:2px">Vous affichez encore la saison '+cur+'. Archivez les licences et passez à la nouvelle saison depuis Paramètres → Données.</div>'+
       '</div>';
   } else { banner.innerHTML=""; }
   var mismatched=findMiscategorizedPlayers();
   if(mismatched.length){
     banner.innerHTML+='<div onclick="openReclassementModal()" style="margin:0 12px 14px;background:rgba(11,114,133,.1);border:1px solid rgba(11,114,133,.3);border-radius:var(--rs);padding:12px 14px;cursor:pointer">'+
       '<div style="font-size:13px;font-weight:700;color:#0B7285">'+mismatched.length+' joueur'+(mismatched.length>1?"s":"")+' à reclasser</div>'+
       '<div style="font-size:11px;color:var(--mut);margin-top:2px">Leur âge ne correspond plus à leur catégorie actuelle. Appuyez pour vérifier.</div>'+
       '</div>';
   }
   var mismatchedTeams=findMiscategorizedTeams();
   if(mismatchedTeams.length){
     banner.innerHTML+='<div onclick="openTeamReclassementModal()" style="margin:0 12px 14px;background:rgba(94,53,177,.1);border:1px solid rgba(94,53,177,.3);border-radius:var(--rs);padding:12px 14px;cursor:pointer">'+
       '<div style="font-size:13px;font-weight:700;color:#5E35B1">'+mismatchedTeams.length+' équipe'+(mismatchedTeams.length>1?"s":"")+' à reclasser</div>'+
       '<div style="font-size:11px;color:var(--mut);margin-top:2px">La catégorie ne correspond plus à la majorité des joueurs de l\'équipe. Appuyez pour vérifier.</div>'+
       '</div>';
   }
   var pendingEvts=getPendingEvents();
   if(pendingEvts.length){
     banner.innerHTML+='<div onclick="openEventsValidationModal()" style="margin:0 12px 14px;background:rgba(232,103,10,.1);border:1px solid rgba(232,103,10,.3);border-radius:var(--rs);padding:12px 14px;cursor:pointer">'+
       '<div style="font-size:13px;font-weight:700;color:#E8670A">'+pendingEvts.length+' événement'+(pendingEvts.length>1?"s":"")+' à valider</div>'+
       '<div style="font-size:11px;color:var(--mut);margin-top:2px">Proposé par un coach. Appuyez pour valider ou refuser.</div>'+
       '</div>';
   }
   var lowStockItems=getInventaire().filter(function(it){return it.seuil!=null && it.seuil!=="" && Number(it.qte)<Number(it.seuil);});
   if(lowStockItems.length){
     banner.innerHTML+='<div onclick="openAdminModule(\'inventaire\')" style="margin:0 12px 14px;background:rgba(22,160,133,.1);border:1px solid rgba(22,160,133,.3);border-radius:var(--rs);padding:12px 14px;cursor:pointer">'+
       '<div style="font-size:13px;font-weight:700;color:#16A085">'+lowStockItems.length+' article'+(lowStockItems.length>1?"s":"")+' en stock bas</div>'+
       '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+lowStockItems.slice(0,4).map(function(it){return authEsc(it.nom);}).join(", ")+(lowStockItems.length>4?"…":"")+'</div>'+
       '</div>';
   }
   cleanupExpiredEventChannelAccess();
 }
 getOrderedAdminModules().forEach(function(m,i,arr){
 var hidden=getHiddenAdminModules();
 var isHidden=hidden.indexOf(m.id)>=0;
 if(isHidden && !ADMIN_EDIT_MODE) return;
 var d=document.createElement("div");d.className="admin-card"+(ADMIN_EDIT_MODE?" editing":"");
 d.dataset.moduleId=m.id;
 d.style.cssText="position:relative"+(isHidden?";opacity:.45":"");
 if(!ADMIN_EDIT_MODE) d.onclick=function(){openAdminModule(m.id);};
 var count=getAdminCount(m.id);
 d.innerHTML='<div class="admin-ci"><div class="admin-icon" style="background:'+m.color+'">'+m.icon+'</div><div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:800;color:var(--txt)">'+m.name+'</div><div style="font-size:10px;color:var(--ltg);font-weight:600;margin-bottom:2px">'+m.sub+'</div><div style="font-size:11px;color:var(--mut)">'+count+'</div></div>'+(ADMIN_EDIT_MODE?'<div class="drag-handle" style="color:var(--mut);font-size:20px;padding:10px;cursor:grab">\u2807</div>':'<div style="color:var(--mut);font-size:18px">\u203a</div>')+'</div>';
 if(ADMIN_EDIT_MODE){
   var ctrl=document.createElement("div");
   ctrl.style.cssText="display:flex;justify-content:flex-end;padding:0 12px 10px";
   var hideBtn=document.createElement("button");
   hideBtn.textContent=isHidden?"Afficher":"Masquer";
   hideBtn.style.cssText="padding:0 14px;height:34px;border-radius:17px;border:none;background:"+(isHidden?"rgba(39,174,96,.15)":"rgba(192,57,43,.1)")+";color:"+(isHidden?"var(--dkg)":"var(--red)")+";font-size:11px;font-weight:700;cursor:pointer";
   hideBtn.addEventListener("click",function(e){e.stopPropagation();toggleHiddenAdminModule(m.id);});
   ctrl.appendChild(hideBtn);
   d.appendChild(ctrl);
 }
    el.appendChild(d);
  });
  if(ADMIN_EDIT_MODE){
    var cards=Array.prototype.slice.call(el.querySelectorAll(".admin-card"));
    enablePressDrag(cards, function(newOrder){
      saveAdminModuleOrder(newOrder);
      buildAdminHome();
    });
  }
}
function getAdminCount(id){
  if(id==="parametres")return "Configuration";
  if(id==="communaute")return "Gestion des canaux";
  if(id==="licences"){var l=getLicences();return l.length+" fiche"+(l.length>1?"s":"");}
  if(id==="inscriptions"){var p=getPlayers();return p.length+" joueur"+(p.length>1?"s":"");}
  if(id==="equipes"){var t=getTeams();return t.length+" equipe"+(t.length>1?"s":"");}
  if(id==="planning"){var e=getEvents();return e.length+" evenement"+(e.length>1?"s":"");}
  if(id==="documents"){var d=getDocs();return d.length+" document"+(d.length>1?"s":"");}
  if(id==="comptabilite"){var c=getComptabilite();return c.length+" ligne"+(c.length>1?"s":"");}
  if(id==="notesfrais"){var nf=getNotesFrais().filter(function(n){return n.statut==="soumise";});return nf.length+" en attente";}
  if(id==="inventaire"){var inv=getInventaire();return inv.length+" article"+(inv.length>1?"s":"");}
  if(id==="acces")return "Rôles & équipes";
  if(id==="avis")return "Retours des membres";
  return "";
}
function openAdminModule(id){
  var m=ADMIN_MODULES.find(function(x){return x.id===id;});
  if(!m)return;
  if(id==="acces"){openAccesCoach();return;}
  if(id==="avis"){openAvisModule();return;}
  if(id==="fiches"){openFichesRecues();return;}
  if(id==="notesfrais"){openNotesFrais();return;}
  stack.push(m.scr);
  if(id==="parametres"){buildParametres();}
  else if(id==="communaute"){buildAdminComm();}
  else if(id==="licences"){buildLicences();}
  else if(id==="inscriptions")buildPlayers();
  else if(id==="equipes")buildTeams();
  else if(id==="planning")buildPlanning();
  else if(id==="documents")buildDocs();
  else if(id==="comptabilite")buildComptabilite();
  else if(id==="inventaire")buildInventaire();
  showScr(m.scr);
}

// ── STEP 7 : ACCÈS COACH (attribution rôles/équipes par le dirigeant) ──
function openAccesCoach(){
  if(!window.ASMB_USER || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){alert("Réservé au dirigeant.");return;}
  if(!window.fbDb||!window.fbGetDocs){alert("Firestore indisponible.");return;}
  var modal=document.createElement("div");
  modal.className="acces-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Accès coach";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var note=document.createElement("div");
  note.style.cssText="font-size:11px;color:var(--mut);background:#e6f0e9;border-radius:var(--rx);padding:10px 12px;margin-bottom:12px;line-height:1.4";
  note.textContent="La personne concernée doit se déconnecter puis se reconnecter pour que le changement de rôle prenne effet.";
  var searchWrap=document.createElement("div");
  searchWrap.style.cssText="margin-bottom:12px";
  var searchInp=document.createElement("input");
  searchInp.type="text";
  searchInp.placeholder="Rechercher : prénom, nom, e-mail ou numéro...";
  searchInp.style.cssText="width:100%;padding:11px 12px;border:1.5px solid var(--bdr);border-radius:10px;font-size:13px;background:var(--bg);color:var(--txt)";
  searchWrap.appendChild(searchInp);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Chargement…</div>';
  inner.appendChild(hdr);inner.appendChild(note);inner.appendChild(searchWrap);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);

  // Croise les numéros de téléphone des comptes avec les fiches de licence,
  // pour pouvoir chercher/afficher les comptes par prénom/nom du licencié.
  var phoneToName={};
  getLicences().forEach(function(l){
    if(!l||!l.fiche) return;
    var name=((l.fiche.prenom||"")+" "+(l.fiche.nom||"")).trim();
    if(!name) return;
    [l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).forEach(function(p){
      phoneToName[p.replace(/\s+/g,"")]=name;
    });
  });

  var allUsers=[];
  function renderDefaultView(){
    var configured=allUsers.filter(function(u){return (u.roles||[]).length>0;});
    if(!configured.length){
      list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Aucun compte configuré pour le moment. Recherchez un licencié ci-dessus pour lui attribuer un rôle.</div>';
      return;
    }
    renderAccesList(list,configured);
  }
  searchInp.addEventListener("input",function(){
    var q=searchInp.value.trim().toLowerCase();
    if(q.length<2){ renderDefaultView(); return; }
    var matches=allUsers.filter(function(u){
      var name=(phoneToName[(u.phone||"").replace(/\s+/g,"")]||"").toLowerCase();
      return (u.email||"").toLowerCase().indexOf(q)>=0 || (u.phone||"").indexOf(q)>=0 || name.indexOf(q)>=0;
    });
    if(!matches.length){
      list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Aucun compte trouvé.</div>';
      return;
    }
    renderAccesList(list,matches,phoneToName);
  });
  // Multi-club : uniquement les comptes du club actif (requête aussi exigée par les règles de sécurité)
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"), window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
    snap.forEach(function(d){var v=d.data();v._uid=d.id;allUsers.push(v);});
    renderDefaultView();
  }).catch(function(e){list.innerHTML='<div style="color:var(--red);padding:20px;text-align:center">Erreur : '+((e&&e.code)||e)+'</div>';});
}
// Ajoute/retire le coach des canaux liés à ses équipes selon son affectation actuelle
function syncCoachChannels(u, newTeamIds){
  if(!window.fbGetDocs||!window.fbDb) return Promise.resolve();
  var phone=u.phone;
  if(!phone) return Promise.resolve();
  return window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(snap){
    var tasks=[];
    snap.forEach(function(d){
      var ch=d.data();
      if(!ch.teamId) return;
      var members=ch.members||[];
      var idx=members.findIndex(function(m){return (typeof m==="string"?m:m.phone)===phone;});
      var shouldBeMember=newTeamIds.indexOf(ch.teamId)>=0;
      if(shouldBeMember && idx<0){
        members=members.concat([{phone:phone,label:u.email||""}]);
        tasks.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"channels",d.id),{members:members}));
      } else if(!shouldBeMember && idx>=0){
        members=members.filter(function(m){return (typeof m==="string"?m:m.phone)!==phone;});
        tasks.push(window.fbUpdateDoc(window.fbDoc(window.fbDb,"channels",d.id),{members:members}));
      }
    });
    return Promise.all(tasks);
  }).catch(function(e){console.log("syncCoachChannels:",e);});
}
function renderAccesList(list,users,phoneToName){
  phoneToName=phoneToName||{};
  list.innerHTML="";
  if(!users.length){list.innerHTML='<div style="color:var(--mut);padding:24px;text-align:center">Aucun compte enregistré</div>';return;}
  var teams=getTeams();
  users.forEach(function(u){
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px";
    var name=phoneToName[(u.phone||"").replace(/\s+/g,"")];
    var head=document.createElement("div");
    head.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    head.textContent=name||u.email||u.phone||u._uid;
    card.appendChild(head);
    if(name){
      var subEmail=document.createElement("div");
      subEmail.style.cssText="font-size:11px;color:var(--mut)";
      subEmail.textContent=u.email||u.phone||"";
      card.appendChild(subEmail);
    }
    var sub=document.createElement("div");
    sub.style.cssText="font-size:11px;color:var(--mut);margin-bottom:10px";
    sub.textContent=(u.phone||"")+((u.roles&&u.roles.length)?(" · "+u.roles.join(", ")):" · aucun rôle");
    card.appendChild(sub);
    var state={roles:(u.roles||[]).slice(),teams:(u.linkedTeamIds||[]).slice()};
    var teamBox=document.createElement("div");
    var roleWrap=document.createElement("div");
    roleWrap.style.cssText="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px";
    ["dirigeant","coach","parent"].forEach(function(r){
      var chip=document.createElement("button");
      function paint(){var on=state.roles.indexOf(r)>=0;chip.style.cssText="padding:6px 12px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1.5px solid "+(on?"var(--grn)":"var(--bdr)")+";background:"+(on?"var(--grn)":"transparent")+";color:"+(on?"#fff":"var(--mut)");}
      chip.textContent=roleLabel(r);paint();
      chip.addEventListener("click",function(e){e.stopPropagation();var i=state.roles.indexOf(r);if(i>=0)state.roles.splice(i,1);else state.roles.push(r);paint();teamBox.style.display=(state.roles.indexOf("coach")>=0)?"block":"none";});
      roleWrap.appendChild(chip);
    });
    card.appendChild(roleWrap);
    teamBox.style.cssText="margin-bottom:10px;display:"+((state.roles.indexOf("coach")>=0)?"block":"none");
    var tl=document.createElement("div");
    tl.style.cssText="font-size:10px;font-weight:700;color:var(--ltg);text-transform:uppercase;margin-bottom:4px";
    tl.textContent="Équipes du coach";
    teamBox.appendChild(tl);
    if(!teams.length){var no=document.createElement("div");no.style.cssText="font-size:11px;color:var(--mut)";no.textContent="Aucune équipe";teamBox.appendChild(no);}
    teams.forEach(function(t){
      var lbl=document.createElement("label");
      lbl.style.cssText="display:flex;align-items:center;gap:8px;padding:4px 0;font-size:12px;color:var(--txt);cursor:pointer";
      var chk=document.createElement("input");chk.type="checkbox";chk.checked=state.teams.indexOf(t.id)>=0;
      chk.style.cssText="width:16px;height:16px;accent-color:var(--dkg)";
      chk.addEventListener("change",function(){var i=state.teams.indexOf(t.id);if(chk.checked){if(i<0)state.teams.push(t.id);}else if(i>=0)state.teams.splice(i,1);});
      lbl.appendChild(chk);lbl.appendChild(document.createTextNode(t.name));
      teamBox.appendChild(lbl);
    });
    card.appendChild(teamBox);
    var save=document.createElement("button");
    save.textContent="Enregistrer";
    save.style.cssText="padding:8px 16px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer";
    save.addEventListener("click",function(e){
      e.stopPropagation();save.textContent="…";
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",u._uid),{roles:state.roles,linkedTeamIds:state.teams}).then(function(){
        return syncCoachChannels(u,state.teams);
      }).then(function(){
        save.textContent="\u2713 Enregistré";
        sub.textContent=(u.phone||"")+" · "+(state.roles.join(", ")||"aucun rôle");
        setTimeout(function(){save.textContent="Enregistrer";},1500);
      }).catch(function(err){save.textContent="Erreur";alert((err&&err.code)||err);});
    });
    card.appendChild(save);
    list.appendChild(card);
  });
}

// ── FICHES D'INSCRIPTION RECUES (deposees via le lien public) ──────
function openFichesRecues(){
  if(!isStaffUser()){alert("Réservé au staff.");return;}
  if(!window.fbDb||!window.fbGetDocs){alert("Firestore indisponible.");return;}
  var modal=document.createElement("div");
  modal.className="fiches-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Fiches reçues";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px">Chargement…</div>';
  inner.appendChild(hdr);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  window.fbGetDocs(window.fbCollection(window.fbDb,"inscription_submissions")).then(function(snap){
    var items=[];snap.forEach(function(d){var v=d.data();v._id=d.id;items.push(v);});
    items.sort(function(a,b){
      var ta=a.ts&&a.ts.toDate?a.ts.toDate().getTime():0;
      var tb=b.ts&&b.ts.toDate?b.ts.toDate().getTime():0;
      return tb-ta;
    });
    renderFichesRecues(list,items);
  }).catch(function(e){list.innerHTML='<div style="color:var(--red);padding:20px;text-align:center">Erreur : '+((e&&e.code)||e)+'</div>';});
}
function renderFichesRecues(list,items){
  list.innerHTML="";
  if(!items.length){list.innerHTML='<div style="color:var(--mut);padding:24px;text-align:center">Aucune fiche reçue pour le moment</div>';return;}
  items.forEach(function(it){
    var f=it.fiche||{};
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px"+(it.status==="importee"?";opacity:.55":"");
    var name=document.createElement("div");
    name.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    name.textContent=((f.prenom||"")+" "+(f.nom||"")).trim()||"(sans nom)";
    var meta=document.createElement("div");
    meta.style.cssText="font-size:11px;color:var(--mut);margin-bottom:8px";
    meta.textContent="Code "+(it.code||"?")+(f.naissance?(" · né(e) le "+f.naissance):"")+(it.status==="importee"?" · déjà importée":"");
    var detail=document.createElement("div");
    detail.style.cssText="font-size:11px;color:var(--txt2);line-height:1.5;margin-bottom:10px";
    detail.textContent=[f.telephone,f.emailLic,f.respNom?("Resp. "+f.respNom):""].filter(Boolean).join(" · ");
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
    var importBtn=document.createElement("button");
    importBtn.textContent=it.status==="importee"?"Réimporter":"Importer dans la licence";
    importBtn.style.cssText="padding:7px 12px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer";
    importBtn.addEventListener("click",function(){
      var lics=getLicences();
      var idx=lics.findIndex(function(l){return l.code===it.code;});
      if(idx<0){alert("Aucune licence ne correspond au code "+it.code+".");return;}
      lics[idx].fiche=it.fiche;
      lics[idx].statut="recue";
      if(it.typeLicence) lics[idx].typeLicence=it.typeLicence;
      saveLicences(lics);
      buildLicences();
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"inscription_submissions",it._id),{status:"importee"}).catch(function(){});
      it.status="importee";
      card.style.opacity=".55";
      importBtn.textContent="Réimporter";
      meta.textContent="Code "+(it.code||"?")+(f.naissance?(" · né(e) le "+f.naissance):"")+" · déjà importée";
      alert("Fiche importée dans la licence "+it.code+".");
    });
    var delBtn=document.createElement("button");
    delBtn.textContent="Supprimer";
    delBtn.style.cssText="padding:7px 12px;border-radius:20px;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:600;border:none;cursor:pointer";
    delBtn.addEventListener("click",function(){
      askConfirm("Supprimer définitivement cette fiche reçue ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
        if(!ok)return;
        window.fbDeleteDoc(window.fbDoc(window.fbDb,"inscription_submissions",it._id)).then(function(){card.remove();});
      });
    });
    btnRow.appendChild(importBtn);btnRow.appendChild(delBtn);
    card.appendChild(name);card.appendChild(meta);card.appendChild(detail);card.appendChild(btnRow);
    list.appendChild(card);
  });
}

// ── AVIS & SUGGESTIONS (retours des membres) ──────────────────────
function openAvisModule(){
  if(!window.ASMB_USER || (window.ASMB_USER.roles||[]).indexOf("dirigeant")<0){alert("Réservé au dirigeant.");return;}
  if(!window.fbDb||!window.fbGetDocs){alert("Firestore indisponible.");return;}
  var modal=document.createElement("div");
  modal.className="avis-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Avis & suggestions";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px">Chargement…</div>';
  inner.appendChild(hdr);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"feedback"),window.fbOrderBy("ts","desc"))).then(function(snap){
    var items=[];snap.forEach(function(d){var v=d.data();v._id=d.id;items.push(v);});
    renderAvisList(list,items);
  }).catch(function(e){list.innerHTML='<div style="color:var(--red);padding:20px;text-align:center">Erreur : '+((e&&e.code)||e)+'</div>';});
}
function renderAvisList(list,items){
  list.innerHTML="";
  if(!items.length){list.innerHTML='<div style="color:var(--mut);padding:24px;text-align:center">Aucun avis pour le moment</div>';return;}
  items.forEach(function(it){
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px"+(it.status==="traite"?";opacity:.55":"");
    var meta=document.createElement("div");
    meta.style.cssText="font-size:11px;color:var(--mut);margin-bottom:6px";
    var when="";
    try{ when = it.ts&&it.ts.toDate? it.ts.toDate().toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}) : ""; }catch(e){}
    meta.textContent=(it.email||it.phone||"Anonyme")+(when?(" · "+when):"");
    var msg=document.createElement("div");
    msg.style.cssText="font-size:13px;color:var(--txt);line-height:1.4;margin-bottom:10px;white-space:pre-wrap";
    msg.textContent=it.message||"";
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px";
    var toggleBtn=document.createElement("button");
    toggleBtn.textContent=it.status==="traite"?"Marquer non traité":"Marquer traité";
    toggleBtn.style.cssText="padding:6px 12px;border-radius:20px;background:rgba(39,174,96,.12);color:var(--dkg);font-size:11px;font-weight:700;border:none;cursor:pointer";
    toggleBtn.addEventListener("click",function(){
      var newStatus=it.status==="traite"?"nouveau":"traite";
      window.fbUpdateDoc(window.fbDoc(window.fbDb,"feedback",it._id),{status:newStatus}).then(function(){
        it.status=newStatus;
        card.style.opacity=newStatus==="traite"?".55":"1";
        toggleBtn.textContent=newStatus==="traite"?"Marquer non traité":"Marquer traité";
      });
    });
    var delBtn=document.createElement("button");
    delBtn.textContent="Supprimer";
    delBtn.style.cssText="padding:6px 12px;border-radius:20px;background:rgba(192,57,43,.1);color:var(--red);font-size:11px;font-weight:600;border:none;cursor:pointer";
    delBtn.addEventListener("click",function(){
      askConfirm("Supprimer cet avis ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
        if(!ok)return;
        window.fbDeleteDoc(window.fbDoc(window.fbDb,"feedback",it._id)).then(function(){card.remove();});
      });
    });
    btnRow.appendChild(toggleBtn);btnRow.appendChild(delBtn);
    card.appendChild(meta);card.appendChild(msg);card.appendChild(btnRow);
    list.appendChild(card);
  });
}

function getPlayers(){try{return JSON.parse(localStorage.getItem("asmb_players")||"[]");}catch(e){return [];}}
function savePlayers(p){localStorage.setItem("asmb_players",JSON.stringify(p));fsWriteCollection("players",p);}

function filterCat(cat){
  currentCatFilter=cat;
  document.querySelectorAll(".cat-filter").forEach(function(b){b.classList.remove("on");});
  var btn=document.getElementById("cat-"+cat);if(btn)btn.classList.add("on");
  renderPlayers();
}
function buildPlayers(){renderPlayers();}
function renderPlayers(){
  var players=getPlayers();
  var filtered=currentCatFilter==="all"?players:players.filter(function(p){return p.cat===currentCatFilter;});
  var searchEl=document.getElementById("insc-search");
  var q=searchEl?searchEl.value.trim().toLowerCase():"";
  if(q){filtered=filtered.filter(function(p){return ((p.prenom||"")+" "+(p.nom||"")).toLowerCase().indexOf(q)>=0||(p.poste||"").toLowerCase().indexOf(q)>=0;});}
  var el=document.getElementById("playerList");if(!el)return;
  document.getElementById("insc-count").textContent=players.length+" joueur"+(players.length>1?"s":"");
  if(!filtered.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">'+(q?"Aucun résultat":"Aucun joueur")+'</div><div style="font-size:11px;margin-top:4px">'+(q?"Essayez un autre nom":"Appuyez sur + Ajouter")+'</div></div>';return;}
  el.innerHTML="";
  filtered.forEach(function(p){
    var initials=(p.prenom||"?")[0].toUpperCase()+(p.nom||"?")[0].toUpperCase();
    var col=CAT_COLORS[p.cat]||"#1B5C28";
    var status=p.licence==="ok"?'<span class="status-badge status-ok">Licence ✓</span>':p.licence==="attente"?'<span class="status-badge status-pending">En attente</span>':'<span class="status-badge status-no">Sans licence</span>';
    var genreBadge=p.genre==="F"?'<span class="status-badge" style="background:rgba(142,68,173,.12);color:#8E44AD;margin-left:5px">F</span>':p.genre==="M"?'<span class="status-badge" style="background:rgba(22,160,133,.12);color:#16A085;margin-left:5px">M</span>':'';
    var d=document.createElement("div");d.className="player-card";
    var meta=p.cat+" · "+p.naissance+(p.poste?" - "+p.poste:"");
    var btns='<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">';
    btns+='<button onclick="showPresenceHistory(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(39,174,96,.12);color:#27AE60;font-size:10px;font-weight:600;border:none;cursor:pointer">Historique</button>';
    btns+='<button onclick="editPlayer(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:10px;font-weight:600;border:none;cursor:pointer">Modifier</button>';
    btns+='<button onclick="deletePlayer(\''+p.id+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer">Suppr.</button></div>';
    d.innerHTML='<div class="player-avatar" style="background:'+col+'">'+initials+'</div>'
      +'<div class="player-info"><div class="player-name">'+p.prenom+" "+p.nom+'</div>'
      +'<div class="player-meta">'+meta+'</div>'
      +'<div style="margin-top:4px">'+status+genreBadge+'</div></div>'+btns;
    el.appendChild(d);
  });
}
function showAddPlayer(){
  editingPlayerId=null;
  document.getElementById("modal-player-title").textContent="Nouveau joueur";
  renderPlayerForm(null);
  document.getElementById("modal-player").style.display="flex";
}
function editPlayer(id){
  editingPlayerId=id;
  var p=getPlayers().find(function(x){return x.id===id;});if(!p)return;
  document.getElementById("modal-player-title").textContent="Modifier joueur";
  renderPlayerForm(p);
  document.getElementById("modal-player").style.display="flex";
}
// Catégorie FFBB à partir de l'année de naissance (règle officielle : âge apprécié
// au 1er janvier de la saison en cours). U15 est suivi de U18 (regroupe U16/U17/U18)
// puis, chez les garçons en région ARA, de U21 (regroupe U19/U20/U21) avant Senior.
// Chez les filles : U15 → U18 → Senior directement (pas de U21).
function categorieFromNaissance(dateStr, genre){
  if(!dateStr) return null;
  var birthYear=parseInt(dateStr.slice(0,4),10);
  if(!birthYear||isNaN(birthYear)) return null;
  var now=new Date();
  var seasonRefYear = (now.getMonth()>=8) ? now.getFullYear()+1 : now.getFullYear(); // saison sept->juin, reference = 1er janvier
  var age=seasonRefYear-birthYear;
  if(age<=6) return "U7";
  if(age<=8) return "U9";
  if(age<=10) return "U11";
  if(age<=12) return "U13";
  if(age<=14) return "U15";
  if(age<=17) return "U18";
  if(genre==="M" && age<=20) return "U21";
  return "Senior";
}
function wirePlayerCatAutofill(){
  var naissanceInp=document.getElementById("fp-naissance");
  var catSel=document.getElementById("fp-cat");
  var genreSel=document.getElementById("fp-genre");
  if(!naissanceInp||!catSel||naissanceInp.dataset.catWired)return;
  naissanceInp.dataset.catWired="1";
  function recompute(){
    var cat=categorieFromNaissance(naissanceInp.value,(genreSel||{}).value);
    if(cat) catSel.value=cat;
  }
  naissanceInp.addEventListener("change",recompute);
  if(genreSel) genreSel.addEventListener("change",recompute);
}
function renderPlayerForm(p){
  var CATS_ALL=["U7","U9","U11","U13","U15","U17","U18","U21","Senior","Loisir","3x3"];
    var cats=CATS_ALL.map(function(c){return '<option value="'+c+'"'+(p&&p.cat===c?' selected':'')+'>'+c+'</option>';}).join("");
  var postes=["Meneur","Arriere","Ailier","Ailier Fort","Pivot","---"].map(function(x){return '<option value="'+x+'"'+(p&&p.poste===x?' selected':'')+'>'+x+'</option>';}).join("");
  var licences=['<option value="ok"'+(p&&p.licence==="ok"?' selected':'')+'>Licencie</option>','<option value="attente"'+(p&&p.licence==="attente"?' selected':'')+'>En attente</option>','<option value="non"'+(p&&p.licence==="non"?' selected':'')+'>Sans licence</option>'].join("");
  document.getElementById("player-form").innerHTML=
    '<div class="form-group"><label class="form-label">Prénom *</label><input class="form-input" id="fp-prenom" value="'+(p?p.prenom:'')+'" placeholder="Prénom"></div>'+
    '<div class="form-group"><label class="form-label">Nom *</label><input class="form-input" id="fp-nom" value="'+(p?p.nom:'')+'" placeholder="Nom de famille"></div>'+
    '<div class="form-group"><label class="form-label">Genre</label><select class="form-select" id="fp-genre"><option value="">Non renseigne</option><option value="M"'+(p&&p.genre==="M"?" selected":"")+'>Masculin</option><option value="F"'+(p&&p.genre==="F"?" selected":"")+'>Féminin</option></select></div>'+
    '<div class="form-group"><label class="form-label">Date de naissance</label><input class="form-input" id="fp-naissance" type="date" value="'+(p?p.naissance:'')+'"></div>'+
    '<div class="form-group"><label class="form-label">Catégorie *</label><select class="form-select" id="fp-cat">'+cats+'</select></div>'+
    '<div class="form-group"><label class="form-label">Téléphone de l\'enfant (autonomie)</label><input class="form-input" id="fp-telEnfant" value="'+(p&&p.telEnfant?p.telEnfant:"")+'" placeholder="06... (pour se pointer seul aux entraînements)"></div>'+
    '<div class="form-group"><label class="form-label">Poste</label><select class="form-select" id="fp-poste">'+postes+'</select></div>'+
    '<div class="form-group"><label class="form-label">Numéro de maillot</label><input class="form-input" id="fp-maillot" type="number" min="0" max="99" value="'+(p&&p.maillot?p.maillot:"")+'" placeholder="Ex: 7"></div>'+
    '<div class="form-group"><label class="form-label">Statut licence</label><select class="form-select" id="fp-licence">'+licences+'</select></div>'+
    '<div class="form-group"><label class="form-label">Type de licence</label><select class="form-select" id="fp-typeLicence"><option value="competition"'+(p&&p.typeLicence==="competition"?" selected":"")+'>Compétition</option><option value="loisir"'+(!p||p.typeLicence!=="competition"?" selected":"")+'>Loisir</option></select></div>'+
    '<div class="form-group"><label class="form-label">Numéro de licence</label><input class="form-input" id="fp-numLicence" value="'+(p&&p.numLicence?p.numLicence:"0C")+'" placeholder="0C..."></div>'+
    '<div class="form-group"><label class="form-label">Contact (tel/email)</label><input class="form-input" id="fp-contact" value="'+(p?p.contact:'')+'" placeholder="06..."></div>'+
    '<div class="form-group"><label class="form-label">Notes</label><textarea class="form-input" id="fp-notes" rows="2" placeholder="Observations...">'+(p?p.notes:'')+'</textarea></div>';
  wirePlayerCatAutofill();
}
function savePlayer(){
  var prenom=document.getElementById("fp-prenom").value.trim();
  var nom=document.getElementById("fp-nom").value.trim();
  if(!prenom||!nom){alert("Prénom et nom obligatoires");return;}
  var players=getPlayers();
  var data={id:editingPlayerId||Date.now().toString(),prenom:prenom,nom:nom,naissance:document.getElementById("fp-naissance").value,cat:document.getElementById("fp-cat").value,genre:document.getElementById("fp-genre").value,poste:document.getElementById("fp-poste").value,maillot:document.getElementById("fp-maillot").value,licence:document.getElementById("fp-licence").value,typeLicence:document.getElementById("fp-typeLicence").value,numLicence:document.getElementById("fp-numLicence").value,contact:document.getElementById("fp-contact").value,telEnfant:document.getElementById("fp-telEnfant").value,notes:document.getElementById("fp-notes").value};
  if(editingPlayerId){var idx=players.findIndex(function(p){return p.id===editingPlayerId;});if(idx>=0)players[idx]=data;}
  else players.push(data);
  savePlayers(players);
  closeModal("modal-player");
  renderPlayers();
  buildAdminHome();
}
// ── NOTES DE FRAIS (point 2) ────────────────────────────────────────
function getNotesFrais(){try{return JSON.parse(localStorage.getItem("asmb_notes_frais")||"[]");}catch(e){return [];}}
function saveNotesFrais(list){localStorage.setItem("asmb_notes_frais",JSON.stringify(list));fsWriteCollection("notes_frais",list);}

function openNotesFrais(){
  var isDir=isStaffUser()&&(window.ASMB_USER.roles||[]).indexOf("dirigeant")>=0;
  var modal=document.createElement("div");
  modal.className="notesfrais-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:88vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Notes de frais";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var subLabel=document.createElement("div");
  subLabel.style.cssText="font-size:11px;color:var(--mut);margin-bottom:12px";
  subLabel.textContent=isDir?"Toutes les notes de l'équipe":"Vos notes de frais";
  var addBtn=document.createElement("button");
  addBtn.textContent="+ Nouvelle note de frais";
  addBtn.style.cssText="width:100%;padding:12px;border-radius:var(--rs);background:var(--dkg);color:#fff;font-size:13px;font-weight:700;border:none;cursor:pointer;margin-bottom:14px";
  addBtn.addEventListener("click",function(){ openNoteFraisForm(modal); });
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  inner.appendChild(hdr);inner.appendChild(subLabel);inner.appendChild(addBtn);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  renderNotesFraisList(list,isDir);
}
function renderNotesFraisList(list,isDir){
  var all=getNotesFrais();
  var myEmail=(window.ASMB_USER&&window.ASMB_USER.email)||"";
  var notes=isDir?all:all.filter(function(n){return n.demandeurEmail===myEmail;});
  notes.sort(function(a,b){return (b.date||"").localeCompare(a.date||"");});
  list.innerHTML="";
  if(!notes.length){
    list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Aucune note de frais.</div>';
    return;
  }
  var statutColors={soumise:"#E8670A",remboursee:"#27AE60",refusee:"#C0392B"};
  var statutLabels={soumise:"Soumise",remboursee:"Remboursée",refusee:"Refusée"};
  notes.forEach(function(n){
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-left:4px solid "+(statutColors[n.statut]||"#8E44AD")+";border-radius:var(--rs);padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:flex-start";
    if(n.photo){
      var img=document.createElement("img");
      img.src=n.photo;
      img.style.cssText="width:52px;height:52px;object-fit:cover;border-radius:8px;flex-shrink:0;cursor:pointer";
      img.addEventListener("click",function(){window.open(n.photo,"_blank");});
      card.appendChild(img);
    }
    var body=document.createElement("div");
    body.style.cssText="flex:1;min-width:0";
    var top=document.createElement("div");
    top.style.cssText="display:flex;justify-content:space-between;align-items:flex-start;gap:8px";
    var left=document.createElement("div");
    left.innerHTML='<div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(n.motif||"(sans motif)")+'</div>'+
      '<div style="font-size:11px;color:var(--mut);margin-top:2px">'+(n.date?new Date(n.date).toLocaleDateString("fr-FR"):"")+(n.categorie?" · "+authEsc(n.categorie):"")+(isDir?" · "+authEsc(n.demandeurNom||n.demandeurEmail||""):"")+'</div>';
    var montant=document.createElement("div");
    montant.style.cssText="font-size:15px;font-weight:800;color:var(--txt);flex-shrink:0";
    montant.textContent=(n.montant||0).toFixed(2)+" €";
    top.appendChild(left);top.appendChild(montant);
    var statutBadge=document.createElement("div");
    statutBadge.style.cssText="display:inline-block;margin-top:6px;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:800;color:#fff;background:"+(statutColors[n.statut]||"#8E44AD");
    statutBadge.textContent=statutLabels[n.statut]||n.statut;
    body.appendChild(top);body.appendChild(statutBadge);
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap";
    var printBtn=document.createElement("button");
    printBtn.textContent="Imprimer";
    printBtn.style.cssText="padding:6px 12px;border-radius:16px;background:var(--bdr);color:var(--mut);font-size:10px;font-weight:700;border:none;cursor:pointer";
    printBtn.addEventListener("click",function(e){e.stopPropagation();printNoteFrais(n);});
    var sendBtn=document.createElement("button");
    sendBtn.textContent="Envoyer";
    sendBtn.style.cssText="padding:6px 12px;border-radius:16px;background:var(--bdr);color:var(--mut);font-size:10px;font-weight:700;border:none;cursor:pointer";
    sendBtn.addEventListener("click",function(e){e.stopPropagation();sendNoteFraisMail(n);});
    btnRow.appendChild(printBtn);btnRow.appendChild(sendBtn);
    if(isDir&&n.statut==="soumise"){
      var okBtn=document.createElement("button");
      okBtn.textContent="Marquer remboursée";
      okBtn.style.cssText="padding:6px 12px;border-radius:16px;background:rgba(39,174,96,.12);color:var(--dkg);font-size:10px;font-weight:700;border:none;cursor:pointer";
      okBtn.addEventListener("click",function(e){e.stopPropagation();markNoteFraisStatut(n.id,"remboursee",list,isDir);});
      var refBtn=document.createElement("button");
      refBtn.textContent="Refuser";
      refBtn.style.cssText="padding:6px 12px;border-radius:16px;background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:700;border:none;cursor:pointer";
      refBtn.addEventListener("click",function(e){e.stopPropagation();markNoteFraisStatut(n.id,"refusee",list,isDir);});
      btnRow.appendChild(okBtn);btnRow.appendChild(refBtn);
    }
    var delBtn=document.createElement("button");
    delBtn.textContent="Supprimer";
    delBtn.style.cssText="padding:6px 12px;border-radius:16px;background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:700;border:none;cursor:pointer";
    delBtn.addEventListener("click",function(e){
      e.stopPropagation();
      askConfirm("Supprimer cette note de frais ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
        if(!ok)return;
        saveNotesFrais(getNotesFrais().filter(function(x){return x.id!==n.id;}));
        renderNotesFraisList(list,isDir);
      });
    });
    btnRow.appendChild(delBtn);
    body.appendChild(btnRow);
    card.appendChild(body);
    list.appendChild(card);
  });
}
function markNoteFraisStatut(id,statut,list,isDir){
  var notes=getNotesFrais();
  var idx=notes.findIndex(function(n){return n.id===id;});
  if(idx<0)return;
  notes[idx].statut=statut;
  saveNotesFrais(notes);
  if(statut==="remboursee"){
    var n=notes[idx];
    var compta=getComptabilite();
    compta.push({
      id:Date.now().toString(),date:new Date().toISOString().slice(0,10),montant:n.montant||0,type:"depense",
      categorie:"Note de frais",motif:n.motif||"",tiers:n.demandeurNom||n.demandeurEmail||"",moyen:"Virement",
      reference:"Note de frais #"+n.id
    });
    saveComptabilite(compta);
  }
  renderNotesFraisList(list,isDir);
}
function openNoteFraisForm(parentModal){
  var modal=document.createElement("div");
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:88vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">Nouvelle note de frais</div>'+
      '<button id="nf-close" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div class="form-group"><label class="form-label">Date</label><input class="form-input" id="nf-date" type="date" value="'+new Date().toISOString().slice(0,10)+'"></div>'+
    '<div class="form-group"><label class="form-label">Montant (€)</label><input class="form-input" id="nf-montant" type="number" step="0.01" placeholder="0.00"></div>'+
    '<div class="form-group"><label class="form-label">Motif</label><input class="form-input" id="nf-motif" placeholder="Ex: Essence déplacement match"></div>'+
    '<div class="form-group"><label class="form-label">Catégorie</label><input class="form-input" id="nf-categorie" list="nf-cat-list" placeholder="Ex: Déplacement, Matériel, Repas..."><datalist id="nf-cat-list"></datalist></div>'+
    '<div class="form-group"><label class="form-label">Photo du justificatif</label>'+
      '<input type="file" id="nf-photo-input" accept="image/*" capture="environment" style="display:none" onchange="handleNoteFraisPhoto(this)">'+
      '<button type="button" id="nf-photo-btn" style="width:100%;padding:12px;border-radius:var(--rs);background:var(--card);border:1.5px dashed var(--bdr);color:var(--dkg);font-size:13px;font-weight:700;cursor:pointer">📷 Prendre / choisir une photo</button>'+
      '<div id="nf-photo-preview" style="margin-top:8px"></div>'+
    '</div>'+
    '<button id="nf-save" style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;margin-top:4px">Enregistrer</button>';
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  var dlCat=document.getElementById("nf-cat-list");
  var cats=getNotesFrais().map(function(n){return n.categorie;}).filter(Boolean);
  var uniqCats=cats.filter(function(c,i){return cats.indexOf(c)===i;});
  dlCat.innerHTML=uniqCats.map(function(c){return '<option value="'+c+'">';}).join("");
  document.getElementById("nf-photo-btn").addEventListener("click",function(){document.getElementById("nf-photo-input").click();});
  document.getElementById("nf-close").addEventListener("click",function(){modal.remove();});
  document.getElementById("nf-save").addEventListener("click",function(){ saveNoteFrais(modal,parentModal); });
}
var noteFraisPhotoData=null;
function handleNoteFraisPhoto(input){
  if(!input.files||!input.files[0])return;
  var file=input.files[0];
  var preview=document.getElementById("nf-photo-preview");
  var btn=document.getElementById("nf-photo-btn");
  btn.textContent="Compression...";btn.disabled=true;
  compressImageFile(file,900,0.55).then(function(dataUrl){
    if(dataUrl.length>700000){ return compressImageFile(file,600,0.4); }
    return dataUrl;
  }).then(function(dataUrl){
    noteFraisPhotoData=dataUrl;
    preview.innerHTML='<img src="'+dataUrl+'" style="width:80px;height:80px;object-fit:cover;border-radius:8px">';
    btn.textContent="📷 Changer la photo";btn.disabled=false;
  }).catch(function(){
    btn.textContent="📷 Prendre / choisir une photo";btn.disabled=false;
    alert("Erreur lors du traitement de la photo.");
  });
}
function saveNoteFrais(modal,parentModal){
  var date=document.getElementById("nf-date").value;
  var montant=parseFloat(document.getElementById("nf-montant").value);
  var motif=document.getElementById("nf-motif").value.trim();
  var categorie=document.getElementById("nf-categorie").value.trim();
  if(!date){alert("Date obligatoire");return;}
  if(!montant||montant<=0){alert("Montant invalide");return;}
  if(!motif){alert("Motif obligatoire");return;}
  var u=window.ASMB_USER||{};
  var notes=getNotesFrais();
  notes.push({
    id:Date.now().toString(),date:date,montant:montant,motif:motif,categorie:categorie,
    photo:noteFraisPhotoData||null,statut:"soumise",
    demandeurEmail:u.email||"",demandeurNom:u.email||"",
    ts:Date.now()
  });
  saveNotesFrais(notes);
  noteFraisPhotoData=null;
  modal.remove();
  if(parentModal){
    var list=parentModal.querySelector("div[style*='overflow-y']");
    var isDir=isStaffUser()&&(window.ASMB_USER.roles||[]).indexOf("dirigeant")>=0;
    if(list) renderNotesFraisList(list,isDir);
  }
}
function printNoteFrais(n){
  var win=window.open("","_blank");
  var html='<html><head><title>Note de frais</title><style>'+
    'body{font-family:system-ui,-apple-system,sans-serif;padding:30px;color:#1a2e1e}'+
    'h1{font-size:20px;border-bottom:2px solid #1B5C28;padding-bottom:10px}'+
    '.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee;font-size:14px}'+
    '.row b{color:#1B5C28}'+
    'img{max-width:100%;margin-top:20px;border-radius:8px}'+
    '</style></head><body>'+
    '<h1>Note de frais — ASMB Basket</h1>'+
    '<div class="row"><span>Demandeur</span><b>'+authEsc(n.demandeurNom||n.demandeurEmail||"")+'</b></div>'+
    '<div class="row"><span>Date</span><b>'+(n.date?new Date(n.date).toLocaleDateString("fr-FR"):"")+'</b></div>'+
    '<div class="row"><span>Motif</span><b>'+authEsc(n.motif||"")+'</b></div>'+
    '<div class="row"><span>Catégorie</span><b>'+authEsc(n.categorie||"-")+'</b></div>'+
    '<div class="row"><span>Montant</span><b>'+(n.montant||0).toFixed(2)+' €</b></div>'+
    '<div class="row"><span>Statut</span><b>'+authEsc(n.statut||"")+'</b></div>'+
    (n.photo?'<img src="'+n.photo+'">':'')+
    '</body></html>';
  win.document.write(html);
  win.document.close();
  setTimeout(function(){win.print();},400);
}
function sendNoteFraisMail(n){
  var subject="Note de frais - "+(n.motif||"")+" ("+(n.montant||0).toFixed(2)+" €)";
  var body="Note de frais\n\nDemandeur : "+(n.demandeurNom||n.demandeurEmail||"")+"\nDate : "+(n.date||"")+"\nMotif : "+(n.motif||"")+"\nCatégorie : "+(n.categorie||"-")+"\nMontant : "+(n.montant||0).toFixed(2)+" €\nStatut : "+(n.statut||"")+
    (n.photo?"\n\n(Photo du justificatif disponible dans l'application, section Notes de frais)":"");
  var mailto="mailto:?subject="+encodeURIComponent(subject)+"&body="+encodeURIComponent(body);
  window.location.href=mailto;
}

function deletePlayer(id){
  askConfirm("Supprimer ce joueur ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var players=getPlayers().filter(function(p){return p.id!==id;});
    savePlayers(players);renderPlayers();buildAdminHome();
  });
}

// ── RECLASSEMENT DE CATEGORIE (age qui a change de tranche) ────────
function findMiscategorizedPlayers(){
  return getPlayers().filter(function(p){
    if(!p.naissance) return false;
    var suggested=categorieFromNaissance(p.naissance,p.genre);
    return suggested && p.cat && suggested!==p.cat;
  });
}

// ── RECLASSEMENT DES EQUIPES (categorie de l'equipe qui ne colle plus a ses joueurs) ──
function findMiscategorizedTeams(){
  var players=getPlayers();
  var out=[];
  getTeams().forEach(function(t){
    var members=(t.members||[]).map(function(id){return players.find(function(p){return p.id===id;});}).filter(Boolean);
    if(!members.length) return;
    var tally={};
    members.forEach(function(p){ if(p.cat) tally[p.cat]=(tally[p.cat]||0)+1; });
    var bestCat=null, bestCount=0;
    Object.keys(tally).forEach(function(c){ if(tally[c]>bestCount){bestCount=tally[c];bestCat=c;} });
    if(bestCat && bestCat!==t.cat && CATS_LIC.indexOf(bestCat)>=0){
      out.push({team:t, suggested:bestCat, matchCount:bestCount, totalCount:members.length});
    }
  });
  return out;
}
function openTeamReclassementModal(){
  var modal=document.createElement("div");
  modal.className="team-reclass-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Équipes à reclasser";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  inner.appendChild(hdr);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  renderTeamReclassementList(list);
}
function renderTeamReclassementList(list){
  var mismatched=findMiscategorizedTeams();
  list.innerHTML="";
  if(!mismatched.length){
    list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Toutes les équipes correspondent à leurs joueurs.</div>';
    return;
  }
  mismatched.forEach(function(entry){
    var t=entry.team;
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px";
    var name=document.createElement("div");
    name.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    name.textContent=t.name;
    var meta=document.createElement("div");
    meta.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px";
    meta.innerHTML="Catégorie actuelle <b>"+t.cat+"</b> · "+entry.matchCount+"/"+entry.totalCount+" joueurs en <b style=\"color:var(--dkg)\">"+entry.suggested+"</b>";
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px;flex-wrap:wrap";
    var renameBtn=document.createElement("button");
    renameBtn.textContent="Renommer et reclasser";
    renameBtn.style.cssText="padding:7px 12px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer";
    renameBtn.addEventListener("click",async function(){
      var suggestedName=t.name.split(t.cat).join(entry.suggested);
      var newName=await askPrompt("Nom de l'équipe", {defaultValue:suggestedName, confirmText:"Appliquer"});
      if(newName===null) return;
      var teams=getTeams();
      var idx=teams.findIndex(function(x){return x.id===t.id;});
      if(idx>=0){ teams[idx].cat=entry.suggested; teams[idx].name=newName.trim()||suggestedName; saveTeams(teams); }
      card.remove();
      buildAdminHome();
      if(!findMiscategorizedTeams().length){ list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Toutes les équipes correspondent à leurs joueurs.</div>'; }
    });
    var catOnlyBtn=document.createElement("button");
    catOnlyBtn.textContent="Catégorie seule ("+entry.suggested+")";
    catOnlyBtn.style.cssText="padding:7px 12px;border-radius:20px;background:rgba(39,174,96,.12);color:var(--dkg);font-size:11px;font-weight:700;border:none;cursor:pointer";
    catOnlyBtn.addEventListener("click",function(){
      var teams=getTeams();
      var idx=teams.findIndex(function(x){return x.id===t.id;});
      if(idx>=0){ teams[idx].cat=entry.suggested; saveTeams(teams); }
      card.remove();
      buildAdminHome();
      if(!findMiscategorizedTeams().length){ list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Toutes les équipes correspondent à leurs joueurs.</div>'; }
    });
    var ignoreBtn=document.createElement("button");
    ignoreBtn.textContent="Ignorer";
    ignoreBtn.style.cssText="padding:7px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:11px;font-weight:600;border:none;cursor:pointer";
    ignoreBtn.addEventListener("click",function(){card.remove();});
    btnRow.appendChild(renameBtn);btnRow.appendChild(catOnlyBtn);btnRow.appendChild(ignoreBtn);
    card.appendChild(name);card.appendChild(meta);card.appendChild(btnRow);
    list.appendChild(card);
  });
}

function openReclassementModal(){
  var mismatched=findMiscategorizedPlayers();
  var modal=document.createElement("div");
  modal.className="reclass-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:300;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;display:flex;flex-direction:column";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  var hdr=document.createElement("div");
  hdr.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px";
  var title=document.createElement("div");
  title.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
  title.textContent="Joueurs à reclasser";
  var closeBtn=document.createElement("button");
  closeBtn.textContent="\u2715";
  closeBtn.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
  closeBtn.addEventListener("click",function(e){e.stopPropagation();modal.remove();});
  hdr.appendChild(title);hdr.appendChild(closeBtn);
  var list=document.createElement("div");
  list.style.cssText="overflow-y:auto;flex:1";
  inner.appendChild(hdr);inner.appendChild(list);
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  renderReclassementList(list);
}
function renderReclassementList(list){
  var mismatched=findMiscategorizedPlayers();
  list.innerHTML="";
  if(!mismatched.length){
    list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Tous les joueurs sont dans la bonne catégorie.</div>';
    return;
  }
  mismatched.forEach(function(p){
    var suggested=categorieFromNaissance(p.naissance,p.genre);
    var card=document.createElement("div");
    card.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:14px;margin-bottom:10px";
    var name=document.createElement("div");
    name.style.cssText="font-size:13px;font-weight:800;color:var(--txt)";
    name.textContent=p.prenom+" "+p.nom;
    var meta=document.createElement("div");
    meta.style.cssText="font-size:12px;color:var(--mut);margin-bottom:10px";
    meta.innerHTML="Actuellement <b>"+p.cat+"</b> → devrait être <b style=\"color:var(--dkg)\">"+suggested+"</b>";
    var btnRow=document.createElement("div");
    btnRow.style.cssText="display:flex;gap:8px";
    var applyBtn=document.createElement("button");
    applyBtn.textContent="Appliquer "+suggested;
    applyBtn.style.cssText="padding:7px 12px;border-radius:20px;background:var(--dkg);color:#fff;font-size:11px;font-weight:700;border:none;cursor:pointer";
    applyBtn.addEventListener("click",function(){
      var players=getPlayers();
      var idx=players.findIndex(function(x){return x.id===p.id;});
      if(idx>=0){ players[idx].cat=suggested; savePlayers(players); }
      card.remove();
      buildAdminHome();
      if(!findMiscategorizedPlayers().length){ list.innerHTML='<div style="text-align:center;color:var(--mut);padding:24px;font-size:12px">Tous les joueurs sont dans la bonne catégorie.</div>'; }
    });
    var ignoreBtn=document.createElement("button");
    ignoreBtn.textContent="Ignorer";
    ignoreBtn.style.cssText="padding:7px 12px;border-radius:20px;background:var(--bdr);color:var(--mut);font-size:11px;font-weight:600;border:none;cursor:pointer";
    ignoreBtn.addEventListener("click",function(){card.remove();});
    btnRow.appendChild(applyBtn);btnRow.appendChild(ignoreBtn);
    card.appendChild(name);card.appendChild(meta);card.appendChild(btnRow);
    list.appendChild(card);
  });
}

