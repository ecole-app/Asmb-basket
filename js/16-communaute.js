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
    alert("Aucune fiche trouvee pour ce numéro.");
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
  document.getElementById("fiche-view-content").innerHTML=html||'<div style="font-size:12px;color:var(--mut)">Fiche incomplete</div>';
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
 if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
 var name=document.getElementById("ch-name").value.trim();
 var icon=document.getElementById("ch-icon").value.trim()||"";
 var desc=document.getElementById("ch-desc").value.trim();
 var teamId=(document.getElementById("ch-team")||{}).value||"";
 var clubWide=!!(document.getElementById("ch-clubwide")||{}).checked;
 if(!name){alert("Nom du canal obligatoire");return;}
 if(editingChannelId){
   window.fbSetDoc(window.fbDoc(window.fbDb,"channels",editingChannelId),{
     name:name,icon:icon,desc:desc,teamId:teamId,clubWide:clubWide
   },{merge:true});
   editingChannelId=null;
 }else{
   var id=name.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-");
   window.fbSetDoc(window.fbDoc(window.fbDb,"channels",id),{
   id:id,name:name,icon:icon,desc:desc,members:[],teamId:teamId,clubWide:clubWide
   },{merge:true});
 }
 closeModal("modal-channel");
 document.getElementById("ch-name").value="";document.getElementById("ch-desc").value="";
}

async function deleteChannel(id,name){
 if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
 var ok=await askConfirm('Le canal "'+name+'" et tous ses messages seront définitivement supprimés.', {title:"Supprimer ce canal ?", confirmText:"Supprimer", danger:true});
 if(!ok)return;
 // Supprime tous les messages du canal
 var msgsSnap=await window.fbGetDocs(window.fbCollection(window.fbDb,"channels",id,"messages"));
 for(const d of msgsSnap.docs){
   await window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",id,"messages",d.id));
 }
 // Supprime le canal lui-meme
 await window.fbDeleteDoc(window.fbDoc(window.fbDb,"channels",id));
 alert("Canal supprimé");
}

function openChannelDetail(ch){
 currentAdminChannelId=ch.id;
 document.getElementById("chdet-hdr").innerHTML='<div style="display:flex;align-items:center;gap:10px"><div style="font-size:22px">'+ch.icon+'</div><div><div style="font-size:15px;font-weight:800;color:var(--txt)">'+ch.name+'</div><div style="font-size:11px;color:var(--mut)">'+ch.desc+'</div></div></div>';
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
    div.innerHTML='<div class="member-avatar"></div><div style="flex:1;min-width:0">'+(label?'<div style="font-size:13px;font-weight:700;color:var(--txt)">'+label+'</div><div style="font-size:11px;color:var(--mut)">'+phone+'</div>':'<div style="font-size:13px;font-weight:600;color:var(--txt)">'+phone+'</div>')+'</div><div style="display:flex;flex-direction:column;gap:5px"><button onclick="editMemberLabel(\''+phone+'\',\''+(label||"").replace(/'/g,"")+'\')" style="padding:5px 10px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:10px;font-weight:600;border:none;cursor:pointer">Modifier</button><button onclick="removeMemberFromChannel(\''+phone+'\')" style="padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer">Révoquer</button></div>';
    el.appendChild(div);
  });
}

async function editMemberLabel(phone,currentLabel){
  var newLabel=await askPrompt("Nom d'identification", {defaultValue:currentLabel||"", placeholder:"ex: Lucas-U13", confirmText:"Enregistrer"});
  if(newLabel===null)return;
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var updated=members.map(function(m){
    var p=typeof m==="string"?m:m.phone;
    if(p===phone)return {phone:p,label:newLabel.trim()||null};
    return m;
  });
  await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:updated},{merge:true});
  chData.members=updated;
  renderMembers(chData);
}

async function addMemberToChannel(){
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var input=document.getElementById("member-phone");
  var phone=input.value.trim().replace(/\s+/g,"");
  if(!phone){alert("Entrez un numéro de téléphone");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===phone;});
  if(exists){alert("Ce numéro est déjà membre");return;}
  members.push({phone:phone,label:null});
  await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
  input.value="";
  chData.members=members;
  renderMembers(chData);
  buildAdminComm();
}

async function removeMemberFromChannel(phone){
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var ok=await askConfirm("Révoquer l'accès de "+phone+" à ce canal ?", {title:"Révoquer l'accès", confirmText:"Révoquer", danger:true});
  if(!ok)return;
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=((chData&&chData.members)||[]).filter(function(m){return (typeof m==="string"?m:m.phone)!==phone;});
  await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
  chData.members=members;
  renderMembers(chData);
  buildAdminComm();
}


function showLicenceContactPicker(){
  var contacts=getLicencedContacts();
  var el=document.getElementById("lic-picker-list");
  if(!contacts.length){el.innerHTML='<div class="empty-state"><div style="font-size:13px;font-weight:600">Aucun contact disponible</div><div style="font-size:11px;margin-top:4px">Les licences validees avec téléphone apparaitront ici</div></div>';}
  else{
    el.innerHTML="";
    contacts.forEach(function(c){
      var div=document.createElement("div");div.className="member-card";div.style.cursor="pointer";
      div.onclick=function(){addMemberFromLicence(c.phone,c.label);};
      div.innerHTML='<div class="member-avatar"></div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+c.label+'</div><div style="font-size:11px;color:var(--mut)">'+c.phone+'</div></div><span style="color:var(--ltg);font-size:18px">+</span>';
      el.appendChild(div);
    });
  }
  document.getElementById("modal-lic-picker").style.display="flex";
}

async function addMemberFromLicence(phone,label){
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var chDoc=await window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"channels")));
  var chData=null;
  chDoc.forEach(function(d){if(d.id===currentAdminChannelId)chData=d.data();});
  var members=(chData&&chData.members)||[];
  var exists=members.some(function(m){return (typeof m==="string"?m:m.phone)===phone;});
  if(exists){alert("Ce contact est déjà membre");return;}
  members.push({phone:phone,label:label});
  await window.fbSetDoc(window.fbDoc(window.fbDb,"channels",currentAdminChannelId),{members:members},{merge:true});
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
var savedPseudo=localStorage.getItem("asmb_pseudo")||"";

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
    renderChannelList(channels);
  });
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
    div.innerHTML=unreadBadge+'<div class="ch-icon">'+ch.icon+'</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt)">'+ch.name+'</div><div style="font-size:11px;color:var(--mut);margin-top:2px">'+ch.desc+'</div>'+(lockBadge?'<div style="margin-top:3px">'+lockBadge+'</div>':'')+'</div><div style="color:var(--mut);font-size:18px">'+(isMember?"›":"")+'</div>';
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
    if(!isAuth){alert("Ce canal est réservé aux membres autorisés. Contactez un responsable ASMB.");return;}
  }
  currentChannelId=ch.id;currentChannelData=ch;
  document.getElementById("chat-icon").textContent=ch.icon;
  document.getElementById("chat-name").textContent=ch.name;
  document.getElementById("chat-desc").textContent=ch.desc;
  var pseudo=document.getElementById("chat-pseudo");
  if(pseudo)pseudo.value=savedPseudo;
  var pollBtn=document.getElementById("poll-btn");
  if(pollBtn)pollBtn.style.display=window.asmbCoachMode?"flex":"none";
  stack.push("chat");
  showScr("chat");
  // On capture le seuil "dernier lu" AVANT de le mettre a jour, pour savoir
  // ou placer le repere "Nouveaux messages" dans cette ouverture du canal.
  var prevLastRead=parseInt(localStorage.getItem("asmb_lastread_"+ch.id)||"0",10);
  listenMessages(ch.id, prevLastRead);
  listenTyping(ch.id);
  // Marquer comme lu
  localStorage.setItem("asmb_lastread_"+ch.id, Date.now().toString());
}

// ── INDICATEUR "EN TRAIN D'ECRIRE" ──────────────────────────────
function notifyTyping(){
  if(!window.fbReady||!currentChannelId)return;
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
      descEl.textContent=(typers.length===1?typers[0]+" ecrit...":typers.join(", ")+" ecrivent...");
      descEl.style.color="#D4AF37";
      descEl.style.fontStyle="italic";
    } else {
      descEl.textContent=baseDesc;
      descEl.style.color="";
      descEl.style.fontStyle="";
    }
  });
}

var REACTION_EMOJIS=["",""];

function listenMessages(channelId, prevLastRead){
  if(chatUnsubscribe)chatUnsubscribe();
  var msgsEl=document.getElementById("chat-messages");
  if(!msgsEl)return;
  msgsEl.innerHTML="";
  var isFirstLoad=true;
  var q=window.fbQuery(window.fbCollection(window.fbDb,"channels",channelId,"messages"),window.fbOrderBy("ts"));
  chatUnsubscribe=window.fbOnSnapshot(q,function(snap){
    // Notification locale sur nouveaux messages (app ouverte uniquement)
    if(!isFirstLoad&&localStorage.getItem("asmb_notif")==="on"&&localStorage.getItem("asmb_notif_messages")!=="off"&&"Notification" in window&&Notification.permission==="granted"){
      snap.docChanges().forEach(function(change){
        if(change.type==="added"){
          var m=change.doc.data();
          if(m.pseudo!==(savedPseudo||"moi")){
            try{
              var ch=currentChannelData;
              new Notification((ch?ch.icon+" "+ch.name:"ASMB")+" - "+m.pseudo,{body:m.text.replace(/<[^>]*>/g,"").substring(0,100),tag:"asmb-msg"});
            }catch(e){}
          }
        }
      });
    }
    var thisLoadIsFirst=isFirstLoad;
    isFirstLoad=false;
    msgsEl.innerHTML="";
    var lastDay="";
    var pinnedIds=(currentChannelData&&currentChannelData.pinnedMessageIds)||[];
    var pinnedMsgs=[];
    var allMsgs=[];snap.forEach(function(d){allMsgs.push(d.data());});
    // Repere "Nouveaux messages" : uniquement si on avait deja lu ce canal avant (pas la toute premiere visite),
    // et qu'il y a au moins un message plus ancien ET un message plus recent que ce seuil.
    var bannerIndex=-1;
    if(thisLoadIsFirst && prevLastRead>0){
      for(var i=0;i<allMsgs.length;i++){
        var t=allMsgs[i].ts&&allMsgs[i].ts.toDate?allMsgs[i].ts.toDate().getTime():0;
        if(t>prevLastRead){ bannerIndex=i; break; }
      }
      if(bannerIndex===0) bannerIndex=-1; // tout est "nouveau" : le repere n'apporte rien tout en haut
    }
    var bannerEl=null;
    var msgIndex=-1;
    snap.forEach(function(d){
      msgIndex++;
      var msg=d.data();
      if(msgIndex===bannerIndex){
        bannerEl=document.createElement("div");
        bannerEl.className="unread-divider";
        bannerEl.style.cssText="display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--grn);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px";
        bannerEl.innerHTML='<div style="flex:1;height:1px;background:var(--grn);opacity:.4"></div><span>Nouveaux messages</span><div style="flex:1;height:1px;background:var(--grn);opacity:.4"></div>';
        msgsEl.appendChild(bannerEl);
      }
      if(pinnedIds.indexOf(d.id)>=0)pinnedMsgs.push({id:d.id,text:msg.text||msg.question||"Message"});
      var isOut=msg.pseudo===(savedPseudo||"moi");
      var ts=msg.ts?msg.ts.toDate():new Date();
      var day=ts.toLocaleDateString("fr-FR");
      if(day!==lastDay){
        lastDay=day;
        var dayDiv=document.createElement("div");dayDiv.className="msg-day";dayDiv.textContent=day;
        msgsEl.appendChild(dayDiv);
      }
      var wrap=document.createElement("div");wrap.className="msg-wrap "+(isOut?"out":"in");
      var time=ts.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
      if(!isOut){var psd=document.createElement("div");psd.className="msg-pseudo";psd.textContent=msg.pseudo;wrap.appendChild(psd);}
      if(msg.type==="media"){
        var mediaWrap=document.createElement("div");
        mediaWrap.style.cssText="max-width:78%;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px var(--shadow)";
        if(msg.mediaType==="video"){
          mediaWrap.innerHTML='<video src="'+msg.mediaUrl+'" controls style="width:100%;display:block;max-height:300px;background:#000"></video><div style="padding:4px 10px;font-size:9px;color:var(--mut);background:var(--card)">'+time+'</div>';
        } else {
          mediaWrap.innerHTML='<img src="'+msg.mediaUrl+'" onclick="viewChatMedia(\''+msg.mediaUrl+'\')" style="width:100%;display:block;max-height:320px;object-fit:cover;cursor:pointer"><div style="padding:4px 10px;font-size:9px;color:var(--mut);background:var(--card)">'+time+'</div>';
        }
        wrap.appendChild(mediaWrap);
        msgsEl.appendChild(wrap);
        return;
      }
      if(msg.type==="convocation"){
        var cvDiv=document.createElement("div");cvDiv.className="poll-bubble";
        var responses=msg.responses||{};
        var cvHtml='<div class="poll-q"> Convocation</div>'+
          '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:2px">'+msg.eventTitre+'</div>'+
          '<div style="font-size:11px;color:var(--mut);margin-bottom:10px">'+msg.eventDate+(msg.eventHeure?" · "+msg.eventHeure:"")+(msg.eventLieu?" · "+msg.eventLieu:"")+'</div>';
        (msg.players||[]).forEach(function(p){
          var resp=responses[p.id];
          cvHtml+='<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-top:1px solid var(--bdr)">'+
            '<span style="font-size:12px;color:var(--txt)">'+p.nom+'</span>'+
            '<div style="display:flex;gap:5px">'+
              '<span onclick="respondConvocation(\''+channelId+'\',\''+d.id+'\',\''+p.id+'\',\'present\')" style="cursor:pointer;font-size:10px;font-weight:700;padding:4px 9px;border-radius:12px;background:'+(resp==="present"?"#D4AF37":"rgba(0,0,0,.08)")+';color:'+(resp==="present"?"#fff":"var(--mut)")+'">✓ Présent</span>'+
              '<span onclick="respondConvocation(\''+channelId+'\',\''+d.id+'\',\''+p.id+'\',\'absent\')" style="cursor:pointer;font-size:10px;font-weight:700;padding:4px 9px;border-radius:12px;background:'+(resp==="absent"?"#C0392B":"rgba(0,0,0,.08)")+';color:'+(resp==="absent"?"#fff":"var(--mut)")+'">✕ Absent</span>'+
            '</div></div>';
        });
        cvHtml+='<div style="font-size:10px;color:var(--mut);margin-top:8px">'+time+'</div>';
        cvDiv.innerHTML=cvHtml;
        wrap.appendChild(cvDiv);
        msgsEl.appendChild(wrap);
        return;
      }
      if(msg.type==="poll"){
        var pollDiv=document.createElement("div");pollDiv.className="poll-bubble";
        var myP=savedPseudo||"moi";
        var totalVotes=0;
        (msg.options||[]).forEach(function(o){totalVotes+=(o.votes||[]).length;});
        var isClosed=msg.deadline&&(new Date().toISOString().slice(0,10)>msg.deadline);
        var pollHtml='<div class="poll-q">'+msg.question+(msg.allowMultiple?' <span style="font-size:9px;color:var(--mut);font-weight:600">(choix multiple)</span>':"")+'</div>';
        (msg.options||[]).forEach(function(o,oi){
          var votes=(o.votes||[]).length;
          var pct=totalVotes?Math.round(votes/totalVotes*100):0;
          var votedByMe=(o.votes||[]).indexOf(myP)>=0;
          var checkbox=msg.allowMultiple?(votedByMe?" ":" "):(votedByMe?" ":" ");
          pollHtml+='<div class="poll-opt'+(votedByMe?" voted":"")+'" onclick="'+(isClosed?"":"votePoll(\'"+channelId+"\',\'"+d.id+"\',"+oi+")")+'" style="'+(isClosed?"cursor:default;opacity:.7":"")+'"><div class="poll-opt-fill" style="width:'+pct+'%"></div><div class="poll-opt-content"><span>'+checkbox+o.text+'</span><span style="color:var(--mut);font-size:10px">'+pct+'% ('+votes+')</span></div></div>';
        });
        pollHtml+='<div style="font-size:10px;color:var(--mut);margin-top:4px">'+totalVotes+' vote'+(totalVotes>1?"s":"")+' · '+time+(msg.deadline?' · '+(isClosed?"Cloture le "+msg.deadline:"Jusqu au "+msg.deadline):"")+'</div>';
        pollDiv.innerHTML=pollHtml;
        wrap.appendChild(pollDiv);
        msgsEl.appendChild(wrap);
        return;
      }
      var bubble=document.createElement("div");bubble.className="msg-bubble "+(isOut?"msg-out":"msg-in");
      if(msg.deleted){
        bubble.style.opacity=".55";bubble.style.fontStyle="italic";
        bubble.innerHTML="Message supprimé"+(msg.deletedBy?" par "+msg.deletedBy:"")+'<div class="msg-time">'+time+'</div>';
        wrap.appendChild(bubble);
        msgsEl.appendChild(wrap);
        return;
      }
      var reactions=msg.reactions||{};
      var myPseudo=savedPseudo||"moi";
      var myReaction=null;
      Object.keys(reactions).forEach(function(em){if((reactions[em]||[]).indexOf(myPseudo)>=0)myReaction=em;});
      var canDelete=isOut||window.asmbCoachMode;
      var reactHtml='<div style="display:flex;gap:6px;margin-top:5px;flex-wrap:wrap;align-items:center">';
      Object.keys(reactions).forEach(function(em){
        var users=reactions[em]||[];
        if(!users.length)return;
        var mine=users.indexOf(myPseudo)>=0;
        reactHtml+='<span onclick="setReaction(\''+channelId+'\',\''+d.id+'\',\''+em+'\')" style="cursor:pointer;font-size:12px;padding:2px 8px;border-radius:12px;background:'+(mine?"rgba(212,175,55,.22)":"rgba(0,0,0,.08)")+'">'+em+' '+users.length+'</span>';
      });
      reactHtml+='<span onclick="openReactionPicker(event,\''+channelId+'\',\''+d.id+'\')" style="cursor:pointer;font-size:12px;padding:2px 7px;border-radius:12px;background:rgba(0,0,0,.06);color:var(--mut)">+</span>';
      if(window.asmbCoachMode){
        reactHtml+='<span onclick="togglePin(\''+channelId+'\',\''+d.id+'\')" style="cursor:pointer;font-size:11px;padding:2px 7px;border-radius:12px;background:rgba(0,0,0,.08)">'+(pinnedIds.indexOf(d.id)>=0?"Retirer":"Epingler")+'</span>';
      }
      if(canDelete){
        reactHtml+='<span onclick="deleteMessage(\''+channelId+'\',\''+d.id+'\')" style="cursor:pointer;font-size:11px;padding:2px 7px;border-radius:12px;background:rgba(192,57,43,.12);color:var(--red)"></span>';
      }
      reactHtml+='</div>';
      bubble.setAttribute("onmousedown","startLongPress(event,'"+channelId+"','"+d.id+"')");
      bubble.setAttribute("onmouseup","cancelLongPress()");
      bubble.setAttribute("onmouseleave","cancelLongPress()");
      bubble.setAttribute("ontouchstart","startLongPress(event,'"+channelId+"','"+d.id+"')");
      bubble.setAttribute("ontouchend","cancelLongPress()");
      bubble.setAttribute("ontouchmove","cancelLongPress()");
      bubble.setAttribute("oncontextmenu","event.preventDefault();openReactionPicker(event,'"+channelId+"','"+d.id+"');return false;");
      bubble.innerHTML=msg.text+'<div class="msg-time">'+time+'</div>'+reactHtml;
      wrap.appendChild(bubble);
      msgsEl.appendChild(wrap);
    });
    var pinEl=document.getElementById("chat-pinned");
    if(pinEl){
      if(pinnedMsgs.length){
        pinEl.style.display="flex";
        pinEl.innerHTML=pinnedMsgs.map(function(pm){
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span style="font-size:11px;color:var(--txt);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+pm.text+'</span>'+(window.asmbCoachMode?'<span onclick="togglePin(\''+channelId+'\',\''+pm.id+'\')" style="cursor:pointer;font-size:10px;color:var(--mut)">✕</span>':"")+'</div>';
        }).join("");
      } else{pinEl.style.display="none";pinEl.innerHTML="";}
    }
    setTimeout(function(){
      if(thisLoadIsFirst && bannerEl){
        bannerEl.scrollIntoView({block:"center"});
      } else {
        msgsEl.scrollTop=msgsEl.scrollHeight;
      }
    },50);
    // Tant que le canal reste affiche, chaque nouvelle mise a jour (message recu ou envoye)
    // est consideree comme vue : on avance le seuil "dernier lu" en continu (pas seulement a l'ouverture).
    if(!thisLoadIsFirst){
      localStorage.setItem("asmb_lastread_"+channelId, Date.now().toString());
    }
  });
}

// ── REACTIONS (style WhatsApp : appui long ou clic droit) ──────────
var QUICK_REACTIONS=["👍","👎","❤️","😂","😮","🙏"];
var MORE_REACTIONS=["😢","🔥","🎉","👏","😍","🤔","😅","💪","🏀","🥳","👀","🙌","😴","😡","🤝","✅","❌","💯"];
var longPressTimer=null;
var reactionPickerTarget=null;

function startLongPress(ev,channelId,msgId){
  cancelLongPress();
  longPressTimer=setTimeout(function(){
    openReactionPicker(ev,channelId,msgId);
  },450);
}
function cancelLongPress(){
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null;}
}

function openReactionPicker(ev,channelId,msgId){
  if(ev&&ev.preventDefault)ev.preventDefault();
  reactionPickerTarget={channelId:channelId,msgId:msgId};
  var picker=document.getElementById("reaction-picker");
  var inner=document.getElementById("reaction-picker-inner");
  inner.innerHTML="";
  QUICK_REACTIONS.forEach(function(em){
    var b=document.createElement("span");
    b.textContent=em;
    b.style.cssText="cursor:pointer;font-size:22px;padding:2px 4px";
    b.onclick=function(){setReaction(channelId,msgId,em);closeReactionPicker();};
    inner.appendChild(b);
  });
  var plus=document.createElement("span");
  plus.textContent="+";
  plus.style.cssText="cursor:pointer;font-size:18px;font-weight:800;color:var(--mut);padding:2px 8px;border-radius:50%;background:rgba(0,0,0,.06)";
  plus.onclick=function(){openMoreReactions();};
  inner.appendChild(plus);

  var x=(ev&&(ev.touches&&ev.touches[0]?ev.touches[0].clientX:ev.clientX))||window.innerWidth/2;
  var y=(ev&&(ev.touches&&ev.touches[0]?ev.touches[0].clientY:ev.clientY))||window.innerHeight/2;
  picker.style.display="block";
  var pw=Math.min(320,QUICK_REACTIONS.length*34+50);
  var left=Math.max(8,Math.min(window.innerWidth-pw-8,x-pw/2));
  var top=Math.max(8,y-60);
  picker.style.left=left+"px";
  picker.style.top=top+"px";
}

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
  var msgRef=window.fbDoc(window.fbDb,"channels",channelId,"messages",msgId);
  window.fbGetDocs(window.fbCollection(window.fbDb,"channels",channelId,"messages")).then(function(snap){
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
      window.fbSetDoc(msgRef,{reactions:reactions},{merge:true});
    });
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
    if(current.length>=3){alert("Maximum 3 messages epingles. Retirez-en un d'abord.");return;}
    updated=current.concat([msgId]);
  }
  window.fbSetDoc(window.fbDoc(window.fbDb,"channels",channelId),{pinnedMessageIds:updated},{merge:true});
  if(currentChannelData)currentChannelData.pinnedMessageIds=updated;
}

function deleteMessage(channelId,msgId){
  if(!window.fbReady)return;
  askConfirm("Supprimer ce message ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var deletedBy=window.asmbCoachMode?"le coach":(savedPseudo||"vous");
    var msgRef=window.fbDoc(window.fbDb,"channels",channelId,"messages",msgId);
    window.fbUpdateDoc(msgRef,{deleted:true,deletedBy:deletedBy}).catch(function(){
      window.fbSetDoc(msgRef,{deleted:true,deletedBy:deletedBy},{merge:true});
    });
  });
}

async function sendMsg(){
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  if(!(await checkMyPhone()))return;
  var msgEl=document.getElementById("chat-msg");
  var pseudoEl=document.getElementById("chat-pseudo");
  if(!msgEl||!pseudoEl)return;
  var text=msgEl.value.trim();
  var pseudo=pseudoEl.value.trim()||"Anonyme";
  if(!text)return;
  savedPseudo=pseudo;localStorage.setItem("asmb_pseudo",pseudo);
  msgEl.value="";
  window.fbAddDoc(window.fbCollection(window.fbDb,"channels",currentChannelId,"messages"),{
    text:text,pseudo:pseudo,ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
  });
}

async function sendMediaMessage(input){
  if(!input.files||!input.files[0])return;
  if(!window.fbReady){alert("Connexion en cours, patientez et réessayez");return;}
  if(!(await checkMyPhone()))return;
  var file=input.files[0];
  if(file.type.indexOf("image")!==0){alert("Seules les photos sont acceptees (pas de video)");input.value="";return;}
  var pseudoEl=document.getElementById("chat-pseudo");
  var pseudo=(pseudoEl&&pseudoEl.value.trim())||savedPseudo||"Anonyme";
  savedPseudo=pseudo;localStorage.setItem("asmb_pseudo",pseudo);
  input.value="";
  compressImageFile(file,900,0.55).then(function(dataUrl){
    if(dataUrl.length>900000)return compressImageFile(file,600,0.4);
    return dataUrl;
  }).then(function(dataUrl){
    window.fbAddDoc(window.fbCollection(window.fbDb,"channels",currentChannelId,"messages"),{
      type:"media",mediaUrl:dataUrl,mediaType:"image",
      pseudo:pseudo,ts:window.fbServerTimestamp(),likeUsers:[],heartUsers:[]
    });
  }).catch(function(err){
    alert("Erreur lors de l'envoi de la photo. Réessayez avec une image plus petite.");
    console.error(err);
  });
}

// ── SONDAGES (style WhatsApp) ────────────────────────────────────
function showPollCreator(){
  if(!window.asmbCoachMode){alert("Seuls les coachs et dirigeants peuvent creer un sondage");return;}
  document.getElementById("poll-question").value="";
  for(var i=0;i<4;i++){document.getElementById("poll-opt-"+i).value="";}
  document.getElementById("modal-poll").style.display="flex";
}

function createPoll(){
  if(!window.fbReady){alert("Connexion en cours, patientez 2 secondes et réessayez");return;}
  var question=document.getElementById("poll-question").value.trim();
  if(!question){alert("Entrez une question");return;}
  var options=[];
  for(var i=0;i<4;i++){
    var v=document.getElementById("poll-opt-"+i).value.trim();
    if(v)options.push({text:v,votes:[]});
  }
  if(options.length<2){alert("Au moins 2 options sont necessaires");return;}
  var allowMultiple=document.getElementById("poll-multiple").checked;
  var deadline=document.getElementById("poll-deadline").value||null;
  var pseudo=(document.getElementById("chat-pseudo")||{}).value.trim()||"Anonyme";
  savedPseudo=pseudo;localStorage.setItem("asmb_pseudo",pseudo);
  window.fbAddDoc(window.fbCollection(window.fbDb,"channels",currentChannelId,"messages"),{
    type:"poll",question:question,options:options,allowMultiple:allowMultiple,deadline:deadline,pseudo:pseudo,ts:window.fbServerTimestamp()
  });
  closeModal("modal-poll");
}

async function votePoll(channelId,msgId,optionIndex){
  if(!window.fbReady)return;
  if(!(await checkMyPhone()))return;
  var pseudo=savedPseudo||"moi";
  var msgRef=window.fbDoc(window.fbDb,"channels",channelId,"messages",msgId);
  window.fbGetDocs(window.fbCollection(window.fbDb,"channels",channelId,"messages")).then(function(snap){
    var msgData=null;
    snap.forEach(function(d){if(d.id===msgId)msgData=d.data();});
    if(!msgData||!msgData.options)return;
    if(msgData.deadline){
      var today=new Date().toISOString().slice(0,10);
      if(today>msgData.deadline){alert("Ce sondage est cloture");return;}
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
      window.fbSetDoc(msgRef,{options:options},{merge:true});
    });
  });
}

async function respondConvocation(channelId,msgId,playerId,status){
  if(!window.fbReady)return;
  if(!(await checkMyPhone()))return;
  var msgRef=window.fbDoc(window.fbDb,"channels",channelId,"messages",msgId);
  window.fbGetDocs(window.fbCollection(window.fbDb,"channels",channelId,"messages")).then(function(snap){
    var msgData=null;
    snap.forEach(function(d){if(d.id===msgId)msgData=d.data();});
    if(!msgData)return;
    var responses=Object.assign({},msgData.responses||{});
    responses[playerId]=(responses[playerId]===status)?null:status;
    if(!responses[playerId])delete responses[playerId];
    window.fbUpdateDoc(msgRef,{responses:responses}).catch(function(){
      window.fbSetDoc(msgRef,{responses:responses},{merge:true});
    });
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

