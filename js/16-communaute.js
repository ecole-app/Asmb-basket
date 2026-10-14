/* ===== 16-communaute.js — Canaux de discussion, messages, reactions, sondages ===== */
// ── MODAL UTILS ──────────────────────────────────────────────────
function closeModal(id){var m=document.getElementById(id);if(m)m.style.display="none";}

// Fermer n'importe quelle modale en cliquant en dehors (sur le fond sombre)
document.addEventListener("click",function(ev){
  var t=ev.target;
  if(!t||!t.id)return;
  if(t.id.indexOf("modal-")!==0)return;
  // On ne ferme que si on clique sur le voile lui-meme (pas sur le contenu)
  if(t.style&&t.style.position==="fixed"&&t.style.display!=="none"){
    t.style.display="none";
  }
});




// ═══ ADMIN COMMUNAUTE - GESTION CANAUX/MEMBRES ═══════════════════
var currentAdminChannelId=null;

function buildAdminComm(){
  var el=document.getElementById("admcomm-list");if(!el)return;
  if(!window.fbReady){window.addEventListener("fb-ready",buildAdminComm,{once:true});return;}
  var q=window.fbQuery(window.fbCollection(window.fbDb,"channels"),window.fbOrderBy("name"));
  window.fbOnSnapshot(q,function(snap){
    el.innerHTML="";
    document.getElementById("admcomm-count").textContent=snap.size+(snap.size>1?" canaux":" canal");
    if(!snap.size){el.innerHTML='<div class="empty-state"><div>Aucun canal</div></div>';return;}
    snap.forEach(function(d){
      var ch=d.data();ch.id=d.id;
      var memberCount=(ch.members||[]).length;
      var div=document.createElement("div");div.className="admin-card";
      div.addEventListener("click",function(){openChannelDetail(ch);});
      var ci=document.createElement("div");ci.className="admin-ci";
      var icon=document.createElement("div");icon.className="admin-icon";icon.style.background="var(--dkg)";icon.textContent=ch.icon||"";
      var info=document.createElement("div");info.style.cssText="flex:1;min-width:0";
      var nm=document.createElement("div");nm.style.cssText="font-size:14px;font-weight:800;color:var(--txt)";nm.textContent=ch.name||"";
      var desc=document.createElement("div");desc.style.cssText="font-size:10px;color:var(--ltg);font-weight:600;margin-bottom:2px";desc.textContent=ch.desc||"";
      var meta=document.createElement("div");meta.style.cssText="font-size:11px;color:var(--mut)";
      meta.textContent=memberCount+" membre"+(memberCount>1?"s":"")+" autorise"+(memberCount>1?"s":"")+(ch.teamId?" · lié":"")+(ch.clubWide?" · public":"");
      info.appendChild(nm);info.appendChild(desc);info.appendChild(meta);
      var editBtn=document.createElement("button");
      editBtn.textContent="✎";
      editBtn.style.cssText="padding:6px 10px;border-radius:var(--rx);background:rgba(0,0,0,.06);color:var(--txt);font-size:10px;font-weight:600;border:none;cursor:pointer;margin-right:6px";
      editBtn.addEventListener("click",function(e){e.stopPropagation();editChannelInfo(ch);});
      var delBtn=document.createElement("button");
      delBtn.textContent="✕";
      delBtn.style.cssText="padding:6px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer";
      delBtn.addEventListener("click",function(e){e.stopPropagation();deleteChannel(ch.id,ch.name||"");});
      ci.appendChild(icon);ci.appendChild(info);ci.appendChild(editBtn);ci.appendChild(delBtn);
      div.appendChild(ci);
      el.appendChild(div);
    });
  });
}

// ── DEMANDES D'ADHESION ──────────────────────────────────────────
var currentJoinReqId=null;
var currentJoinReqData=null;
var pendingJoinReqsList=[];

function listenJoinRequestsGlobal(){
  if(!window.fbReady)return;
  if(!window.asmbCoachMode)return;
  window.fbOnSnapshot(window.fbQuery(window.fbCollection(window.fbDb,"joinRequests"),window.fbOrderBy("ts")),function(snap){
    var pending=[];
    snap.forEach(function(d){var r=d.data();if(r.status==="pending"){r.id=d.id;pending.push(r);}});
    pendingJoinReqsList=pending;
    renderJoinReqBanner();
  });
}

function renderJoinReqBanner(){
  var banner=document.getElementById("join-req-banner");
  if(!banner)return;
  if(!pendingJoinReqsList.length){banner.style.display="none";currentJoinReqId=null;return;}
  var r=pendingJoinReqsList[0];
  currentJoinReqId=r.id;
  currentJoinReqData=r;
  var extra=pendingJoinReqsList.length>1?" (+"+(pendingJoinReqsList.length-1)+" autre"+(pendingJoinReqsList.length>2?"s":"")+")":"";
  document.getElementById("join-req-text").textContent=(r.childName||"Un parent")+" souhaite rejoindre le groupe "+(r.teamNames||"?")+extra;
  banner.style.display="flex";
}

function acceptJoinRequest(reqId){
  var req=pendingJoinReqsList.find(function(r){return r.id===reqId;})||currentJoinReqData;
  if(!req)return;
  var teams=getTeams().filter(function(t){return (req.teamIds||[]).indexOf(t.id)>=0;});
  var catSet=[];
  teams.forEach(function(t){if(catSet.indexOf(t.cat)<0)catSet.push(t.cat);});
  var promises=catSet.map(function(cat){
    var channelId=findChannelForTeamText(cat);
    return window.fbGetDocs(window.fbCollection(window.fbDb,"channels")).then(function(chSnap){
      var chData=null;
      chSnap.forEach(function(d){if(d.id===channelId)chData=d.data();});
      var members=(chData&&chData.members)||[];
      var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===req.phone;});
      if(!exists){
        members.push({phone:req.phone,label:(req.childName||"Parent")+"-"+cat});
        return window.fbSetDoc(window.fbDoc(window.fbDb,"channels",channelId),{members:members},{merge:true});
      }
    });
  });
  Promise.all(promises).then(function(){
    window.fbSetDoc(window.fbDoc(window.fbDb,"joinRequests",reqId),{status:"accepted"},{merge:true});
  });
}

function rejectJoinRequest(reqId){
  askConfirm("Refuser cette demande d'adhésion ?", {danger:true, confirmText:"Refuser"}).then(function(ok){
    if(!ok)return;
    window.fbSetDoc(window.fbDoc(window.fbDb,"joinRequests",reqId),{status:"rejected"},{merge:true});
  });
}

function showJoinReqFiche(){
  if(!currentJoinReqData)return;
  viewFicheModal(currentJoinReqData.phone);
}

function viewFicheModal(phone){
  var lics=getLicences();
  var normPhone=phone.replace(/\s+/g,"");
  var matches=lics.filter(function(l){
    if(!l.fiche)return false;
    var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(p){return p.replace(/\s+/g,"");});
    return phones.indexOf(normPhone)>=0;
  });
  if(!matches.length){
    askAlert("Aucune fiche trouvée pour ce numéro.");
    return;
  }
  var lic=matches[0];
  var f=lic.fiche;
  var rows=[
    ["Prénom",f.prenom],["Nom",f.nom],["Date de naissance",f.naissance],
    ["Catégorie",lic.categorie||""],["Adresse",f.adresse],["Téléphone",f.telephone],["Email",f.emailLic],
    ["Responsable 1",f.respNom],["Tel responsable 1",f.respTel],
    ["Contact urgence",f.urgenceNom],["Tel urgence",f.urgenceTel],
    ["Notes / medical",f.notes]
  ];
  var html="";
  rows.forEach(function(r){
    if(!r[1])return;
    html+='<div style="padding:8px 0;border-bottom:1px solid var(--bdr)"><div style="font-size:10px;color:var(--mut);text-transform:uppercase;letter-spacing:.5px">'+r[0]+'</div><div style="font-size:13px;color:var(--txt);margin-top:2px">'+r[1]+'</div></div>';
  });
  document.getElementById("fiche-view-content").innerHTML=html||'<div style="font-size:12px;color:var(--mut)">Fiche incomplète</div>';
 document.getElementById("modal-fiche-view").style.display="flex";
}

var editingChannelId=null;
function showAddChannel(){
  editingChannelId=null;
  document.getElementById("modal-channel-title").textContent="Nouveau canal";
  document.getElementById("modal-channel-btn").textContent="Créer le canal";
  document.getElementById("ch-name").value="";document.getElementById("ch-desc").value="";
  document.getElementById("ch-icon").value="";
  document.getElementById("ch-clubwide").checked=false;
  fillChannelTeamSelect("");
  document.getElementById("modal-channel").style.display="flex";
}
function fillChannelTeamSelect(selectedId){
  var sel=document.getElementById("ch-team");if(!sel)return;
  sel.innerHTML='<option value="">Aucune</option>';
  getTeams().forEach(function(t){
    var o=document.createElement("option");o.value=t.id;o.textContent=t.name;
    if(t.id===selectedId)o.selected=true;
    sel.appendChild(o);
  });
}
function editChannelInfo(ch){
  editingChannelId=ch.id;
  document.getElementById("modal-channel-title").textContent="Modifier le canal";
  document.getElementById("modal-channel-btn").textContent="Enregistrer";
  document.getElementById("ch-name").value=ch.name||"";
  document.getElementById("ch-desc").value=ch.desc||"";
  document.getElementById("ch-icon").value=ch.icon||"";
  document.getElementById("ch-clubwide").checked=!!ch.clubWide;
  fillChannelTeamSelect(ch.teamId||"");
  document.getElementById("modal-channel").style.display="flex";
}

function createChannel(){
 if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
 var name=document.getElementById("ch-name").value.trim();
 var icon=document.getElementById("ch-icon").value.trim()||"";
 var desc=document.getElementById("ch-desc").value.trim();
 var teamId=(document.getElementById("ch-team")||{}).value||"";
 var clubWide=!!(document.getElementById("ch-clubwide")||{}).checked;
 if(!name){askAlert("Nom du canal obligatoire");return;}
 var savePromise;
 if(editingChannelId){
   savePromise=window.fbSetDoc(window.fbDoc(window.fbDb,"channels",editingChannelId),{
     name:name,icon:icon,desc:desc,teamId:teamId,clubWide:clubWide
   },{merge:true});
   editingChannelId=null;
 }else{
   var id=name.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-");
   savePromise=window.fbSetDoc(window.fbDoc(window.fbDb,"channels",id),{
   id:id,name:name,icon:icon,desc:desc,members:[],teamId:teamId,clubWide:clubWide
   },{merge:true});
 }
 savePromise.catch(function(e){ askAlert("Le canal n'a pas pu être enregistré : "+((e&&e.code)||e)); });
 closeModal("modal-channel");
 document.getElementById("ch-name").value="";document.getElementById("ch-desc").value="";
}

async function deleteChannel(id,name){
 if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
 var ok=await askConfirm('Le canal "'+name+'" et tous ses messages seront définitivement supprimés.', {title:"Supprimer ce canal ?", confirmText:"Supprimer", danger:true});
 if(!ok)return;
 // Supprime tous les messages du canal
 var msgsSnap=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels",id,"messages"));
 for(const d of msgsSnap.docs){
   await window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",id,"messages",d.id));
 }
 // Supprime le canal lui-meme
 await window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",id));
 showToast("Canal supprimé");
}

function openChannelDetail(ch){
 currentAdminChannelId=ch.id;
 document.getElementById("chdet-hdr").innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="font-size:22px">'+authEsc(ch.icon||"")+'</div><div><div style="font-size:15px;font-weight:800;color:var(--txt)">'+authEsc(ch.name)+'</div><div style="font-size:11px;color:var(--mut)">'+authEsc(ch.desc||"")+'</div></div></div>';
  stack.push("channel-detail");
  showScr("channel-detail");
  renderMembers(ch);
}

function renderMembers(ch){
  var el=document.getElementById("member-list");if(!el)return;
  var members=ch.members||[];
  if(!members.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun membre autorise</div><div style="font-size:11px;margin-top:4px">Tout le monde peut voir ce canal</div></div>';return;}
  el.innerHTML="";
  members.forEach(function(m){
    var phone=typeof m==="string"?m:m.phone;
    var label=typeof m==="string"?null:m.label;
    var div=document.createElement("div");div.className="member-card";
    div.innerHTML='<div class="member-avatar"></div><div style="flex:1;min-width:0">'+(label?'<div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(label)+'</div><div style="font-size:11px;color:var(--mut)">'+authEsc(phone)+'</div>':'<div style="font-size:13px;font-weight:600;color:var(--txt)">'+authEsc(phone)+'</div>')+'</div><div style="display:flex;flex-direction:column;gap:5px"><button onclick="editMemberLabel(\''+authEsc(String(phone).replace(/[^+0-9]/g,""))+'\',\''+authEsc((label||"").replace(/['\\]/g,""))+'\')" style="padding:5px 10px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:10px;font-weight:600;border:none;cursor:pointer">Modifier</button><button onclick="removeMemberFromChannel(\''+authEsc(String(phone).replace(/[^+0-9]/g,""))+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer">Révoquer</button></div>';
    el.appendChild(div);
  });
}

async function editMemberLabel(phone,currentLabel){
  var newLabel=await askPrompt("Nom d'identification", {defaultValue:currentLabel||"", placeholder:"", confirmText:"Enregistrer"});
  if(newLabel===null)return;
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var updated=members.map(function(m){
    var p=typeof m==="string"?m:m.phone;
    if(p===phone)return {phone:p,label:newLabel.trim()||null};
    return m;
  });
  try{
    await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:updated},{merge:true});
  }catch(e){ askAlert("Le nom n'a pas pu être enregistré : "+((e&&e.code)||e)); return; }
  chData.members=updated;
  renderMembers(chData);
}

async function addMemberToChannel(){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var input=document.getElementById("member-phone");
  var phone=input.value.trim().replace(/\s+/g,"");
  if(!phone){askAlert("Entrez un numéro de téléphone");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===phone;});
  if(exists){askAlert("Ce numéro est déjà membre");return;}
  members.push({phone:phone,label:null});
  try{
    await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
  }catch(e){ askAlert("Le membre n'a pas pu être ajouté : "+((e&&e.code)||e)); return; }
  input.value="";
  chData.members=members;
  renderMembers(chData);
  buildAdminComm();
}

async function removeMemberFromChannel(phone){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var ok=await askConfirm("Révoquer l'accès de "+phone+" à ce canal ?", {title:"Révoquer l'accès", confirmText:"Révoquer", danger:true});
  if(!ok)return;
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=((chData&&chData.members)||[]).filter(function(m){return (typeof m==="string"?m:m.phone)!==phone;});
  try{
    await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
  }catch(e){ askAlert("L'accès n'a pas pu être révoqué : "+((e&&e.code)||e)); return; }
  chData.members=members;
  renderMembers(chData);
  buildAdminComm();
}


function showLicenceContactPicker(){
  var contacts=getLicencedContacts();
  var el=document.getElementById("lic-picker-list");
  if(!contacts.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun contact disponible</div><div style="font-size:11px;margin-top:4px">Les licences validées avec téléphone apparaîtront ici</div></div>';}
  else{
    el.innerHTML="";
    contacts.forEach(function(c){
      var div=document.createElement("div");div.className="member-card";div.style.cursor="pointer";
      div.onclick=function(){addMemberFromLicence(c.phone,c.label);};
      div.innerHTML='<div class="member-avatar"></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(c.label)+'</div><div style="font-size:11px;color:var(--mut)">'+authEsc(c.phone)+'</div></div><span style="color:var(--ltg);font-size:18px">+</span>';
      el.appendChild(div);
    });
  }
  document.getElementById("modal-lic-picker").style.display="flex";
}

async function addMemberFromLicence(phone,label){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===phone;});
  if(exists){askAlert("Ce contact est déjà membre");return;}
  members.push({phone:phone,label:label});
  try{
    await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
  }catch(e){ askAlert("Le contact n'a pas pu être ajouté : "+((e&&e.code)||e)); return; }
  chData.members=members;
  renderMembers(chData);
  buildAdminComm();
  closeModal("modal-lic-picker");
}

// ═══ CONTACTS DEPUIS LES LICENCES ════════════════════════════════
function calcAge(dateNaissance){
  if(!dateNaissance)return null;
  var today=new Date();
  var birth=new Date(dateNaissance);
  var age=today.getFullYear()-birth.getFullYear();
  var m=today.getMonth()-birth.getMonth();
  if(m<0||(m===0&&today.getDate()<birth.getDate()))age--;
  return age;
}

function getLicencedContacts(){
  var lics=getLicences();
  var contacts=[];
  lics.forEach(function(lic){
    if(!lic.fiche)return;
    var f=lic.fiche;
    var age=calcAge(f.naissance);
    var isMajeur=age!==null&&age>=18;
    var cat=lic.categorie||"";
    var label=f.prenom+(cat?"-"+cat:"");
    if(isMajeur){
      if(f.telephone)contacts.push({phone:f.telephone.trim(),label:label});
    } else {
      if(f.respTel)contacts.push({phone:f.respTel.trim(),label:label+(f.respNom?" (parent: "+f.respNom+")":"")});
      if(f.resp2Tel)contacts.push({phone:f.resp2Tel.trim(),label:label+(f.resp2Nom?" (2e parent: "+f.resp2Nom+")":"")});
    }
  });
  return contacts.filter(function(c){return c.phone;});
}

// ═══ COTE MEMBRE - VERIFICATION TELEPHONE ═══════════════════════
var myPhone=localStorage.getItem("asmb_phone")||"";

async function checkMyPhone(){
  if(myPhone)return true;
  var phone=await askPrompt("Votre numéro de téléphone", {placeholder:"Le même que celui fourni au club", confirmText:"Valider"});
  if(!phone)return false;
  myPhone=phone.trim().replace(/\s+/g,"");
  localStorage.setItem("asmb_phone",myPhone);
  return true;
}

// ═══ COMMUNAUTE / CHAT ════════════════════════════════════════════
var currentChannelId=null;
var currentChannelData=null;
var chatUnsubscribe=null;
var typingUnsubscribe=null;
var typingDebounce=null;
var savedPseudo=(localStorage.getItem("asmb_pseudo")||"").substring(0,20);
// Pseudo à utiliser pour envoyer un message : le pseudo choisi dans les paramètres
// (édité une fois pour toutes, plus de champ à retaper à chaque message).
function myChatPseudo(){ return savedPseudo||"Anonyme"; }
// Identité technique jointe à chaque nouveau message : sert à résoudre la vraie
// identité et le badge de rôle au clic (voir openSenderIdentityModal), sans
// obliger à retaper quoi que ce soit.
function mySenderMeta(){
  return {
    senderUid:(window.ASMB_USER&&window.ASMB_USER.uid)||null,
    senderPhone:myPhone||null,
    badge:(typeof getMyBadgeSnapshot==="function")?getMyBadgeSnapshot():null
  };
}
var replyingTo=null; // {id,pseudo,text} le message auquel on repond, ou null
var channelKnownPseudos=[]; // pseudos vus dans le canal ouvert, pour l'autocomplete @mention
var renderedMsgs={}; // d.id -> message brut du dernier rendu, pour repondre/modifier sans tout re-echapper dans un onclick
var chatShowArchived=false; // si true, affiche aussi les messages plus vieux que le seuil d'archivage pour le canal ouvert

function cancelReply(){
  replyingTo=null;
  var bar=document.getElementById("chat-reply-bar");
  if(bar)bar.style.display="none";
}
function scrollToMsg(msgId){
  var el=document.getElementById("msgel-"+msgId);
  if(!el)return;
  el.scrollIntoView({block:"center",behavior:"smooth"});
  el.style.transition="background .3s";
  var prevBg=el.style.background;
  el.style.background="color-mix(in srgb, var(--ltg) 25%, transparent)";
  setTimeout(function(){el.style.background=prevBg;},900);
}

// ── RECHERCHE DANS LE CANAL (filtre cote client, deja tout charge) ──
function toggleChatSearch(){
  var bar=document.getElementById("chat-search-bar");
  if(!bar)return;
  var show=bar.style.display==="none";
  bar.style.display=show?"block":"none";
  if(show){document.getElementById("chat-search-input").focus();}
  else{document.getElementById("chat-search-input").value="";filterChatMessages("");}
}
function filterChatMessages(term){
  var msgsEl=document.getElementById("chat-messages");if(!msgsEl)return;
  term=(term||"").trim().toLowerCase();
  var rows=msgsEl.querySelectorAll(".msg-wrap, .msg-day, .unread-divider");
  rows.forEach(function(row){
    if(!term){row.style.display="";return;}
    var txt=row.textContent.toLowerCase();
    row.style.display=txt.indexOf(term)>=0?"":"none";
  });
}

// ── MENTIONS (@Pseudo) ───────────────────────────────────────────
function handleMentionInput(inputEl){
  var val=inputEl.value;
  var caret=inputEl.selectionStart||val.length;
  var uptoCaret=val.slice(0,caret);
  var m=uptoCaret.match(/@([A-Za-zÀ-ÿ0-9_-]*)$/);
  var list=document.getElementById("chat-mention-list");
  if(!m||!list){if(list)list.style.display="none";return;}
  var partial=m[1].toLowerCase();
  var matches=channelKnownPseudos.filter(function(p){return p.toLowerCase().indexOf(partial)===0 && p!==(savedPseudo||"");});
  if(!matches.length){list.style.display="none";return;}
  list.innerHTML=matches.slice(0,6).map(function(p){
    return '<div onclick="insertMention(\''+p.replace(/'/g,"")+'\')" style="padding:10px 14px;font-size:13px;color:var(--txt);cursor:pointer;border-bottom:1px solid var(--bdr)">@'+authEsc(p)+'</div>';
  }).join("");
  list.style.display="block";
  list.dataset.matchLen=m[0].length;
}
function insertMention(pseudo){
  var inputEl=document.getElementById("chat-msg");
  var list=document.getElementById("chat-mention-list");
  if(!inputEl||!list)return;
  var caret=inputEl.selectionStart||inputEl.value.length;
  var matchLen=parseInt(list.dataset.matchLen||"0",10);
  var before=inputEl.value.slice(0,caret-matchLen);
  var after=inputEl.value.slice(caret);
  inputEl.value=before+"@"+pseudo+" "+after;
  list.style.display="none";
  inputEl.focus();
}

function getMutedChannels(){try{return JSON.parse(localStorage.getItem("asmb_muted_channels")||"[]");}catch(e){return [];}}
function isChannelMuted(channelId){return getMutedChannels().indexOf(channelId)>=0;}
function toggleChannelMute(){
  if(!currentChannelId)return;
  var muted=getMutedChannels();
  var idx=muted.indexOf(currentChannelId);
  if(idx>=0){muted.splice(idx,1);showToast("Notifications réactivées pour ce canal");}
  else{muted.push(currentChannelId);showToast("Notifications coupées pour ce canal");}
  localStorage.setItem("asmb_muted_channels",JSON.stringify(muted));
  updateMuteBtn();
}
function updateMuteBtn(){
  var b=document.getElementById("chat-mute-btn");
  if(!b||!currentChannelId)return;
  b.textContent=isChannelMuted(currentChannelId)?"🔕":"🔔";
}

// Un canal est visible pour un coach si : il est explicitement marqué "public" (clubWide),
// ou lié à une équipe que ce coach entraîne. Sinon (pas taggé), il reste masqué par défaut.
// Dirigeant/parent voient toujours tout (badge Membre/Privé géré ailleurs par renderChannelList).
function channelVisibleToMe(ch){
  var profile=localStorage.getItem("asmb_profile");
  if(profile!=="coach") return true;
  if(ch.clubWide) return true;
  if(!ch.teamId) return false;
  return getCoachTeams().indexOf(ch.teamId)>=0;
}

function buildCommunaute(){
  var el=document.getElementById("channel-list");if(!el)return;
  if(typeof limiteOuvert==="function" && !limiteOuvert("messagerie")){
    el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">🔒 Messagerie fermée</div><div style="font-size:11px;margin-top:4px">Votre club est en accès limité. Les messages sont conservés.</div></div>';
    return;
  }
  window.asmbCoachMode=(["coach","dirigeant"].indexOf(localStorage.getItem("asmb_profile"))>=0);
  if(!window.fbReady){
    window.addEventListener("fb-ready",function(){buildCommunaute();},{once:true});
    return;
  }
  el.innerHTML="";
  var q=window.fbQuery(window.fbCollection(window.fbDb,"channels"),window.fbOrderBy("name"));
  window.fbOnSnapshot(q,function(snap){
    var channels=[];
    snap.forEach(function(d){
      var ch=d.data();ch.id=d.id;
      if(ch.deleted)return;
      if(!channelVisibleToMe(ch))return;
      channels.push(ch);
    });
    window.__chatChannelsCache=channels;
    renderChannelList(channels);
    dmRenderList();
  });
  dmListen();
}

function renderChannelList(channels){
  var el=document.getElementById("channel-list");if(!el)return;
  if(!channels.length){el.innerHTML='<div class="empty-state"><div>Aucun canal</div></div>';return;}

  // Trier par derniere activite (utilisation recente en premier)
  var lastUsed={};
  channels.forEach(function(ch){lastUsed[ch.id]=parseInt(localStorage.getItem("asmb_lastread_"+ch.id)||"0",10);});
  channels.sort(function(a,b){return (lastUsedActivity[b.id]||lastUsed[b.id]||0)-(lastUsedActivity[a.id]||lastUsed[a.id]||0);});

  el.innerHTML="";
  var isDirigeant=localStorage.getItem("asmb_profile")==="dirigeant";
  channels.forEach(function(ch){
    var members=ch.members||[];
    var isRestricted=members.length>0;
    var isMember=isDirigeant||!isRestricted||members.some(function(m){return (typeof m==="string"?m:m.phone)===myPhone;});
    var div=document.createElement("div");div.className="channel-card"+(isMember?"":" locked");
    div.style.position="relative";
    if(isMember){
      div.onclick=function(){openChannel(ch);};
    } else {
      div.style.opacity=".5";
    }
    var lockBadge=isRestricted?(isMember?'<span style="font-size:10px;color:var(--ltg)"> Membre</span>':'<span style="font-size:10px;color:var(--red)"> Prive</span>'):'';
    var unreadBadge='<span id="badge-'+ch.id+'" style="display:none;position:absolute;top:10px;right:14px;min-width:18px;height:18px;padding:0 5px;border-radius:10px;background:var(--red);color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center"></span>';
    div.innerHTML=unreadBadge+'<div class="ch-icon">'+authEsc(ch.icon||"")+'</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+authEsc(ch.name)+'</div><div style="font-size:11px;color:var(--mut);margin-top:2px">'+authEsc(ch.desc||"")+'</div>'+(lockBadge?'<div style="margin-top:3px">'+lockBadge+'</div>':'')+'</div><div style="color:var(--mut);font-size:18px">'+(isMember?"›":"")+'</div>';
    el.appendChild(div);
  });
  checkUnreadBadges();
}

async function openChannel(ch){
  var members=ch.members||[];
  var isDirigeant=localStorage.getItem("asmb_profile")==="dirigeant";
  if(members.length>0 && !isDirigeant){
    if(!myPhone){if(!(await checkMyPhone())){return;}}
    var isAuth=members.some(function(m){return (typeof m==="string"?m:m.phone)===myPhone;});
    if(!isAuth){askAlert("Ce canal est réservé aux membres autorisés. Contactez un responsable du club.");return;}
  }
  currentConvKind="channel";
  currentChannelId=ch.id;currentChannelData=ch;
  window.__chatChannelsCache=window.__chatChannelsCache||[];
  document.getElementById("chat-icon").textContent=ch.icon;
  document.getElementById("chat-name").textContent=ch.name;
  document.getElementById("chat-desc").textContent=(ch.desc?ch.desc+" · ":"")+"Voir les membres ›";
  var pollBtn=document.getElementById("poll-btn");
  if(pollBtn)pollBtn.style.display=window.asmbCoachMode?"flex":"none";
  var carBtn=document.getElementById("carpool-btn");
  if(carBtn)carBtn.style.display="flex";
  // Reinitialise recherche / reponse en cours / autocomplete d'un canal a l'autre
  channelKnownPseudos=[];
  chatShowArchived=false;
  cancelReply();
  var searchBar=document.getElementById("chat-search-bar"),searchInput=document.getElementById("chat-search-input");
  if(searchBar)searchBar.style.display="none";
  if(searchInput)searchInput.value="";
  updateMuteBtn();
  stack.push("chat");
  showScr("chat");
  // On capture le seuil "dernier lu" AVANT de le mettre a jour, pour savoir
  // ou placer le repere "Nouveaux messages" dans cette ouverture du canal.
  var prevLastRead=parseInt(localStorage.getItem("asmb_lastread_"+ch.id)||"0",10);
  listenMessages(ch.id, prevLastRead);
  listenTyping(ch.id);
  chatStartReads(ch.id);
  // Marquer comme lu
  localStorage.setItem("asmb_lastread_"+ch.id, Date.now().toString());
}

// ── MEMBRES D'UN CANAL (toucher le nom en haut de la discussion) ─────
// Reprend les vraies règles d'accès : canal réservé = sa liste + les
// dirigeants ; canal ouvert = tout le club, sauf les coachs non rattachés
// à l'équipe quand le canal n'est pas « tout le club ». Le staff voit les
// comptes un par un ; une famille voit la composition et qui a déjà écrit.
function chatNomCompte(u,noms){
  var tel=String(u.phone||"").replace(/\s+/g,"");
  var n=((u.prenom||"")+" "+(u.nom||"")).trim()||u.displayName||noms[tel];
  return n||String(u.email||"").split("@")[0]||u.phone||"Compte";
}
function chatRoleCompte(u){
  var r=u.roles||[];
  return r.indexOf("dirigeant")>=0?"Dirigeants":r.indexOf("coach")>=0?"Coachs":r.indexOf("bureau")>=0?"Bureau":r.indexOf("joueur")>=0?"Joueurs":"Familles";
}
var CHAT_ORDRE_ROLES=["Dirigeants","Bureau","Coachs","Familles","Joueurs"];
function chatMembresCanal(){
  if(currentConvKind!=="channel"||!currentChannelData) return;
  var ch=currentChannelData, restreint=(ch.members||[]).length>0;
  var s=gmSheet((ch.icon?ch.icon+" ":"")+(ch.name||"Canal")+" · membres");
  var intro=document.createElement("div"); intro.style.cssText="font-size:12.5px;color:var(--txt2);line-height:1.45;margin-bottom:10px";
  intro.textContent=restreint?"Canal réservé : seuls les membres ci-dessous et les dirigeants y ont accès."
    :(ch.clubWide||!ch.teamId?"Canal ouvert à tout le club.":"Canal de l'équipe : ouvert aux familles et joueurs du club, et aux coachs de cette équipe.");
  var zone=document.createElement("div"); zone.innerHTML='<div style="font-size:12px;color:var(--mut);padding:8px 0">Chargement…</div>';
  s.body.appendChild(intro); s.body.appendChild(zone);
  function groupes(par){
    var h="";
    CHAT_ORDRE_ROLES.concat(Object.keys(par).filter(function(k){ return CHAT_ORDRE_ROLES.indexOf(k)<0; })).forEach(function(g){
      var l=par[g]; if(!l||!l.length) return;
      l.sort(function(a,b){ return a.nom.localeCompare(b.nom); });
      h+='<div style="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin:12px 0 4px">'+authEsc(g)+' · '+l.length+'</div>'+
        l.map(function(m){ return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--bdr)"><div style="width:32px;height:32px;border-radius:50%;background:var(--bdr);color:var(--txt2);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0">'+authEsc(m.nom.charAt(0).toUpperCase())+'</div><div style="flex:1;min-width:0;font-size:13.5px;font-weight:700;color:var(--txt)">'+authEsc(m.nom)+(m.moi?' <span style="font-weight:600;color:var(--mut)">(vous)</span>':'')+(m.info?'<div style="font-size:11px;font-weight:500;color:var(--mut)">'+authEsc(m.info)+'</div>':'')+'</div></div>'; }).join("");
    });
    return h;
  }
  function ontEcrit(){
    var p=(typeof channelKnownPseudos!=="undefined"?channelKnownPseudos:[]).filter(Boolean);
    return p.length?'<div style="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin:14px 0 6px">Ont déjà écrit ici</div><div style="display:flex;flex-wrap:wrap;gap:6px">'+
      p.map(function(x){ return '<span style="font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--bdr);color:var(--txt2)">'+authEsc(x)+'</span>'; }).join("")+'</div>':"";
  }
  var staffVue=(typeof isStaffUser==="function"&&isStaffUser());
  if(!staffVue){
    // Famille / joueur : pas d'accès à la liste des comptes du club.
    var h="";
    if(restreint){
      var par={"Membres":[]};
      ch.members.forEach(function(m){ var lab=typeof m==="string"?null:m.label; par.Membres.push({nom:lab||"Membre",moi:(typeof myPhone!=="undefined"&&myPhone&&(typeof m==="string"?m:m.phone)===myPhone)}); });
      h=groupes(par)+'<div style="font-size:12px;color:var(--mut);margin-top:8px">+ les dirigeants du club</div>';
    } else h='<div style="font-size:13px;color:var(--txt);line-height:1.5">Dirigeants, coachs, familles et joueurs du club.</div>';
    zone.innerHTML=h+ontEcrit();
    return;
  }
  var noms=(typeof dmNameForPhone==="function")?dmNameForPhone():{};
  var moi=(typeof myUid==="function")?myUid():null;
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(snap){
    var par={}, total=0;
    var tels={}; (ch.members||[]).forEach(function(m){ var t=String(typeof m==="string"?m:m.phone).replace(/\s+/g,""); tels[t]=(typeof m==="string"?null:m.label)||true; });
    snap.forEach(function(d){
      var u=d.data()||{}, r=u.roles||[], g=chatRoleCompte(u), tel=String(u.phone||"").replace(/\s+/g,"");
      var ok;
      if(r.indexOf("dirigeant")>=0) ok=true;
      else if(restreint) ok=!!tels[tel];
      else if(r.indexOf("coach")>=0&&r.indexOf("bureau")<0) ok=!!(ch.clubWide||!ch.teamId||(u.linkedTeamIds||[]).indexOf(ch.teamId)>=0);
      else ok=true;
      if(!ok) return;
      var lab=(tel&&typeof tels[tel]==="string")?tels[tel]:"";
      if(tel) delete tels[tel];
      (par[g]=par[g]||[]).push({nom:chatNomCompte(u,noms),moi:d.id===moi,info:lab});
      total++;
    });
    // Numéros autorisés qui n'ont pas encore de compte dans l'appli.
    Object.keys(tels).forEach(function(t){ if(!t) return; (par["Pas encore de compte"]=par["Pas encore de compte"]||[]).push({nom:(typeof tels[t]==="string"?tels[t]:noms[t])||t,info:t}); });
    zone.innerHTML='<div style="font-size:13px;font-weight:800;color:var(--txt)">'+total+' compte'+(total>1?"s":"")+' ont accès</div>'+groupes(par)+ontEcrit()+
      (restreint&&localStorage.getItem("asmb_profile")==="dirigeant"?'<div style="font-size:11.5px;color:var(--mut);margin-top:10px">Ajouter ou retirer des membres : Admin › Communauté › ce canal.</div>':'');
  }).catch(function(e){ zone.innerHTML='<div style="color:var(--red);font-size:12.5px">Liste indisponible ('+authEsc((e&&e.code)||"réseau")+').</div>'+ontEcrit(); });
}

// ── INDICATEUR "EN TRAIN D'ECRIRE" ──────────────────────────────
function notifyTyping(){
  if(!window.fbReady||!currentChannelId||currentConvKind==="dm")return;
  var pseudo=savedPseudo||"moi";
  window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentChannelId,"typing",pseudo),{ts:window.fbServerTimestamp()},{merge:true});
}

function listenTyping(channelId){
  if(typingUnsubscribe)typingUnsubscribe();
  var descEl=document.getElementById("chat-desc");
  var baseDesc=currentChannelData?currentChannelData.desc:"";
  typingUnsubscribe=window.fbOnSnapshot(window.fbCollection(window.fbDb,"channels",channelId,"typing"),function(snap){
    var myPseudo=savedPseudo||"moi";
    var typers=[];
    var now=Date.now();
    snap.forEach(function(d){
      if(d.id===myPseudo)return;
      var data=d.data();
      var ts=data.ts&&data.ts.toDate?data.ts.toDate().getTime():0;
      if(now-ts<3000)typers.push(d.id);
    });
    if(!descEl)return;
    if(typers.length){
      descEl.textContent=(typers.length===1?typers[0]+" écrit...":typers.join(", ")+" écrivent...");
      descEl.style.color="var(--ltg)";
      descEl.style.fontStyle="italic";
    } else {
      descEl.textContent=baseDesc;
      descEl.style.color="";
      descEl.style.fontStyle="";
    }
  });
}

var REACTION_EMOJIS=["",""];


// ── REACTIONS (style WhatsApp : appui long ou clic droit) ──────────
var QUICK_REACTIONS=["👍","👎","❤️","😂","😮","🙏"];
var MORE_REACTIONS=["😢","🔥","🎉","👏","😍","🤔","😅","💪","🏀","🥳","👀","🙌","😴","😡","🤝","✅","❌","💯"];
var longPressTimer=null;
var reactionPickerTarget=null;



function closeReactionPicker(){
  var picker=document.getElementById("reaction-picker");
  if(picker)picker.style.display="none";
}

document.addEventListener("click",function(ev){
  var picker=document.getElementById("reaction-picker");
  if(picker&&picker.style.display==="block"&&!picker.contains(ev.target)){
    closeReactionPicker();
  }
});

function openMoreReactions(){
  closeReactionPicker();
  var grid=document.getElementById("reaction-more-grid");
  grid.innerHTML="";
  QUICK_REACTIONS.concat(MORE_REACTIONS).forEach(function(em){
    var b=document.createElement("button");
    b.textContent=em;
    b.style.cssText="font-size:22px;padding:10px 0;border-radius:var(--rx);border:1.5px solid var(--bdr);background:var(--bg);cursor:pointer";
    b.onclick=function(){
      if(reactionPickerTarget)setReaction(reactionPickerTarget.channelId,reactionPickerTarget.msgId,em);
      closeModal("modal-reaction-more");
    };
    grid.appendChild(b);
  });
  document.getElementById("modal-reaction-more").style.display="flex";
}

async function setReaction(channelId,msgId,emoji){
  if(!window.fbReady)return;
  if(!(await checkMyPhone()))return;
  var pseudo=savedPseudo||"moi";
  var msgRef=window.fbDoc(window.fbDb,convColl(),channelId,"messages",msgId);
  // Lecture puis ecriture : fenetre de course possible si 2 clics simultanes,
  // mais impact limite (reaction perso sur un message de chat) -- non critique.
  window.fbGetDoc(msgRef).then(function(one){
    var snap={forEach:function(cb){ if(one.exists()) cb(one); }};
    var reactions={};
    snap.forEach(function(d){if(d.id===msgId){reactions=JSON.parse(JSON.stringify(d.data().reactions||{}));}});
    var hadThis=(reactions[emoji]||[]).indexOf(pseudo)>=0;
    // Retire mon pseudo de toutes les reactions existantes (une seule reaction par personne)
    Object.keys(reactions).forEach(function(em){
      reactions[em]=(reactions[em]||[]).filter(function(p){return p!==pseudo;});
    });
    if(!hadThis){
      reactions[emoji]=(reactions[emoji]||[]);
      reactions[emoji].push(pseudo);
    }
    window.fbUpdateDoc(msgRef,{reactions:reactions}).catch(function(){
      window.fbSetDoc(msgRef,{reactions:reactions},{merge:true}).catch(function(e){
        askAlert("La réaction n'a pas pu être enregistrée : "+((e&&e.code)||e));
      });
    });
  }).catch(function(e){
    askAlert("La réaction n'a pas pu être enregistrée : "+((e&&e.code)||e));
  });
}

function togglePin(channelId,msgId){
  if(!window.fbReady)return;
  var current=(currentChannelData&&currentChannelData.pinnedMessageIds)||[];
  var idx=current.indexOf(msgId);
  var updated;
  if(idx>=0){
    updated=current.slice();updated.splice(idx,1);
  } else {
    if(current.length>=3){askAlert("Maximum 3 messages epingles. Retirez-en un d'abord.");return;}
    updated=current.concat([msgId]);
  }
  window.fbSetDoc(window.fbDoc(window.fbDb,"channels",channelId),{pinnedMessageIds:updated},{merge:true});
  if(currentChannelData)currentChannelData.pinnedMessageIds=updated;
}


async function sendMsg(){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  if(!(await checkMyPhone()))return;
  var msgEl=document.getElementById("chat-msg");
  if(!msgEl)return;
  var text=msgEl.value.trim();
  if(!text)return;
  var pseudo=myChatPseudo();
  msgEl.value="";
  var payload=Object.assign({text:text,pseudo:pseudo,ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]},mySenderMeta());
  if(replyingTo)payload.replyTo={id:replyingTo.id,pseudo:replyingTo.pseudo,text:replyingTo.text};
  cancelReply();
  var mentionList=document.getElementById("chat-mention-list");
  if(mentionList)mentionList.style.display="none";
  // La notif push part automatiquement (Cloud Function déclenchée par l'écriture
  // Firestore ci-dessous, voir functions/index.js) — rien à appeler ici.
  var convId=currentChannelId, isDm=(currentConvKind==="dm");
  window.fbAddDoc(window.fbCollection(window.fbDb,convColl(),convId,"messages"),payload).then(function(){
    if(isDm) dmTouch(convId,text);
  }).catch(function(e){ askAlert("Le message n'a pas pu être envoyé : "+((e&&e.code)||e)); });
}

async function sendMediaMessage(input){
  if(!input.files||!input.files[0])return;
  if(!window.fbReady){askAlert("Connexion en cours, patientez et réessayez");return;}
  if(!(await checkMyPhone()))return;
  var file=input.files[0];
  var isPdf=file.type==="application/pdf";
  var isImage=file.type.indexOf("image")===0;
  if(!isPdf&&!isImage){askAlert("Seules les photos et les PDF sont acceptés");input.value="";return;}
  var pseudo=myChatPseudo();
  input.value="";
  if(isPdf){
    if(file.size>700*1024){askAlert("Ce PDF est trop volumineux (700 Ko max). Compressez-le puis réessayez.");return;}
    var reader=new FileReader();
    reader.onload=function(){
      window.fbAddDoc(window.fbCollection(window.fbDb,convColl(),currentChannelId,"messages"),Object.assign({
        type:"media",mediaUrl:reader.result,mediaType:"pdf",fileName:file.name,
        pseudo:pseudo,ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
      },mySenderMeta())).then(function(){ if(currentConvKind==="dm") dmTouch(currentChannelId,"📄 "+file.name); });
    };
    reader.onerror=function(){askAlert("Erreur lors de la lecture du fichier.");};
    reader.readAsDataURL(file);
    return;
  }
  compressImageFile(file,900,0.55).then(function(dataUrl){
    if(dataUrl.length>900000)return compressImageFile(file,600,0.4);
    return dataUrl;
  }).then(function(dataUrl){
    window.fbAddDoc(window.fbCollection(window.fbDb,convColl(),currentChannelId,"messages"),Object.assign({
      type:"media",mediaUrl:dataUrl,mediaType:"image",
      pseudo:pseudo,ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
    },mySenderMeta())).then(function(){ if(currentConvKind==="dm") dmTouch(currentChannelId,"📷 Photo"); });
  }).catch(function(err){
    askAlert("Erreur lors de l'envoi de la photo. Réessayez avec une image plus petite.");
    console.error(err);
  });
}

// ── SONDAGES (style WhatsApp) ────────────────────────────────────
function showPollCreator(){
  if(!window.asmbCoachMode){askAlert("Seuls les coachs et dirigeants peuvent créer un sondage");return;}
  document.getElementById("poll-question").value="";
  for(var i=0;i<4;i++){document.getElementById("poll-opt-"+i).value="";}
  document.getElementById("modal-poll").style.display="flex";
}

function createPoll(){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var question=document.getElementById("poll-question").value.trim();
  if(!question){askAlert("Entrez une question");return;}
  var options=[];
  for(var i=0;i<4;i++){
    var v=document.getElementById("poll-opt-"+i).value.trim();
    if(v)options.push({text:v,votes:[]});
  }
  if(options.length<2){askAlert("Au moins 2 options sont necessaires");return;}
  var allowMultiple=document.getElementById("poll-multiple").checked;
  var deadline=document.getElementById("poll-deadline").value||null;
  var pseudo=myChatPseudo();
  window.fbAddDoc(window.fbCollection(window.fbDb,convColl(),currentChannelId,"messages"),Object.assign({
    type:"poll",question:question,options:options,allowMultiple:allowMultiple,deadline:deadline,pseudo:pseudo,ts:window.fbServerTimestamp()
  },mySenderMeta()));
  closeModal("modal-poll");
}

async function votePoll(channelId,msgId,optionIndex){
  if(!window.fbReady)return;
  if(!(await checkMyPhone()))return;
  var pseudo=savedPseudo||"moi";
  var msgRef=window.fbDoc(window.fbDb,convColl(),channelId,"messages",msgId);
  window.fbGetDoc(msgRef).then(function(one){
    var snap={forEach:function(cb){ if(one.exists()) cb(one); }};
    var msgData=null;
    snap.forEach(function(d){if(d.id===msgId)msgData=d.data();});
    if(!msgData||!msgData.options)return;
    if(msgData.deadline){
      var today=new Date().toISOString().slice(0,10);
      if(today>msgData.deadline){askAlert("Ce sondage est cloture");return;}
    }
    var allowMultiple=!!msgData.allowMultiple;
    var options=msgData.options.map(function(o,i){
      var votes=(o.votes||[]).slice();
      var idx=votes.indexOf(pseudo);
      if(i===optionIndex){
        if(idx>=0)votes.splice(idx,1);
        else votes.push(pseudo);
      } else if(!allowMultiple){
        var idx2=votes.indexOf(pseudo);
        if(idx2>=0)votes.splice(idx2,1);
      }
      return {text:o.text,votes:votes};
    });
    window.fbUpdateDoc(msgRef,{options:options}).catch(function(){
      window.fbSetDoc(msgRef,{options:options},{merge:true}).catch(function(e){
        askAlert("Le vote n'a pas pu être enregistré : "+((e&&e.code)||e));
      });
    });
  }).catch(function(e){
    askAlert("Le vote n'a pas pu être enregistré : "+((e&&e.code)||e));
  });
}


// ── COVOITURAGE ───────────────────────────────────────────────────
// Un message de type "carpool" par trajet propose : n'importe qui dans le
// canal (parent ou coach) peut le creer, et n'importe qui peut reserver une
// des places (max = "places"). Meme mecanique de lecture-puis-ecriture que
// les sondages -- acceptable ici pour la meme raison (faible frequentation).
function showCarpoolCreator(){
  if(!currentChannelId){askAlert("Ouvrez d'abord un canal");return;}
  var sel=document.getElementById("carpool-event");
  var todayStr=new Date().toISOString().slice(0,10);
  var events=getEvents().filter(function(e){return e.date>=todayStr&&!e.cancelled;}).sort(function(a,b){return a.date>b.date?1:-1;});
  // Priorite aux evenements de l'equipe de ce canal, mais on laisse le choix
  // sur tous les evenements a venir (un canal general peut aussi organiser
  // un covoiturage pour un tournoi multi-equipes).
  sel.innerHTML=events.map(function(e){
    return '<option value="'+e.id+'">'+e.titre+' · '+e.date+(e.lieu?" · "+e.lieu:"")+'</option>';
  }).join("");
  if(!events.length){sel.innerHTML='<option value="">Aucun événement à venir</option>';}
  document.getElementById("carpool-places").value="3";
  document.getElementById("carpool-depart").value="";
  document.getElementById("modal-carpool").style.display="flex";
}

async function createCarpool(){
  if(!window.fbReady){askAlert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  if(!(await checkMyPhone()))return;
  var eventId=document.getElementById("carpool-event").value;
  if(!eventId){askAlert("Sélectionnez un événement");return;}
  var ev=getEvents().find(function(e){return e.id===eventId;});
  if(!ev){askAlert("Événement introuvable");return;}
  var places=parseInt(document.getElementById("carpool-places").value,10)||1;
  if(places<1)places=1;
  var depart=document.getElementById("carpool-depart").value.trim();
  var pseudo=myChatPseudo();
  window.fbAddDoc(window.fbCollection(window.fbDb,convColl(),currentChannelId,"messages"),Object.assign({
    type:"carpool",eventId:ev.id,eventTitre:ev.titre,eventDate:ev.date,eventLieu:ev.lieu||"",
    conducteur:pseudo,places:places,depart:depart,passagers:[],pseudo:clubPseudo("Covoiturage"),ts:window.fbServerTimestamp()
  },mySenderMeta())).catch(function(e){
    askAlert("Le covoiturage n'a pas pu être publié : "+((e&&e.code)||e));
  });
  closeModal("modal-carpool");
}

async function reserverCarpool(channelId,msgId){
  if(!window.fbReady)return;
  if(!(await checkMyPhone()))return;
  var pseudo=savedPseudo||"moi";
  var msgRef=window.fbDoc(window.fbDb,convColl(),channelId,"messages",msgId);
  window.fbGetDoc(msgRef).then(function(one){
    var snap={forEach:function(cb){ if(one.exists()) cb(one); }};
    var msgData=null;
    snap.forEach(function(d){if(d.id===msgId)msgData=d.data();});
    if(!msgData)return;
    var passagers=(msgData.passagers||[]).slice();
    var idx=passagers.indexOf(pseudo);
    if(idx>=0){
      passagers.splice(idx,1);
    } else {
      if(passagers.length>=(msgData.places||0)){askAlert("Complet, plus de place disponible.");return;}
      passagers.push(pseudo);
    }
    window.fbUpdateDoc(msgRef,{passagers:passagers}).catch(function(e){
      askAlert("La réservation n'a pas pu être enregistrée : "+((e&&e.code)||e));
    });
  }).catch(function(e){
    askAlert("La réservation n'a pas pu être enregistrée : "+((e&&e.code)||e));
  });
}

// ── BADGE NON-LU ──────────────────────────────────────────────────
var lastUsedActivity={};

function checkUnreadBadges(){
  if(!window.fbReady)return;
  var q=window.fbQuery(window.fbCollection(window.fbDb,"channels"),window.fbOrderBy("name"));
  window.fbGetDocs(q).then(function(snap){
    var totalUnread=0;
    var checks=[];
    snap.forEach(function(d){
      var ch=d.data();ch.id=d.id;
      if(ch.deleted)return;
      if(!channelVisibleToMe(ch))return;
      checks.push(d.id);
    });
    var pending=checks.length;
    if(!pending){updateNavBadge(0);return;}
    checks.forEach(function(chId){
      var lastRead=parseInt(localStorage.getItem("asmb_lastread_"+chId)||"0",10);
      window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels",chId,"messages"),window.fbOrderBy("ts"))).then(function(msnap){
        var msgs=[];msnap.forEach(function(m){msgs.push(m.data());});
        var last=msgs[msgs.length-1];
        if(last&&last.ts){
          lastUsedActivity[chId]=last.ts.toDate?last.ts.toDate().getTime():0;
        }
        var unreadCount=0;
        msgs.forEach(function(m){
          var ts=m.ts&&m.ts.toDate?m.ts.toDate().getTime():0;
          if(ts>lastRead)unreadCount++;
        });
        var badgeEl=document.getElementById("badge-"+chId);
        if(badgeEl){
          if(unreadCount>0){badgeEl.style.display="flex";badgeEl.textContent=unreadCount>99?"99+":unreadCount;}
          else{badgeEl.style.display="none";}
        }
        totalUnread+=unreadCount;
        pending--;
        if(pending<=0)updateNavBadge(totalUnread);
      }).catch(function(){pending--;if(pending<=0)updateNavBadge(totalUnread);});
    });
  }).catch(function(){});
}
function updateNavBadge(count){
  window.__chanUnread=count;
  count=count+(window.__dmUnread||0);
  ["bni-communaute","bni-c-communaute"].forEach(function(btnId){
    var btn=document.getElementById(btnId);
    if(!btn)return;
    var dot=btn.querySelector(".nav-dot");
    if(!dot){
      dot=document.createElement("span");
      dot.className="nav-dot";
      dot.style.cssText="position:absolute;top:2px;right:calc(50% - 18px);min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--red);color:#fff;font-size:9px;font-weight:800;align-items:center;justify-content:center";
      btn.style.position="relative";
      btn.appendChild(dot);
    }
    if(count>0){dot.style.display="flex";dot.textContent=count>99?"99+":count;}
    else{dot.style.display="none";}
  });
}

