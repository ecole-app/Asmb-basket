/* ===== 16b-messagerie.js — Messagerie façon WhatsApp =====
   Affichage des messages d'un canal ou d'une discussion privée, menu par appui
   long (réagir, répondre, copier, modifier 2 min, transférer, infos, épingler,
   supprimer), coches de lecture (✓ / ✓✓ / ✓✓ bleu), glisser pour répondre,
   séparateurs de jour, bouton « nouveaux messages » (pas de vocaux : écrit seulement),
   discussions privées staff ↔ adulte, convocations reliées aux présences
   (checkins) de l'écran d'accueil.
   S'appuie sur les globales de 16-communaute.js (currentChannelId,
   currentChannelData, savedPseudo, myPhone, renderedMsgs, replyingTo...).
   Règles côté serveur : firestore.rules (auteurPeut, champsPartages, dms). */

var CHAT_EDIT_MS=120000;          // fenêtre de modification d'un message (non affichée)
var currentConvKind="channel";     // "channel" | "dm"
function convColl(){ return currentConvKind==="dm"?"dms":"channels"; }
function myUid(){ return (window.ASMB_USER&&window.ASMB_USER.uid)||null; }

// Un message est "à moi" si je l'ai signé (uid) ; les anciens messages sans uid
// retombent sur le pseudo.
function chatIsMine(msg){
  if(!msg) return false;
  if(msg.senderUid) return msg.senderUid===myUid();
  return msg.pseudo===(savedPseudo||"moi");
}
function chatMsgTime(msg){
  return msg&&msg.ts&&msg.ts.toDate?msg.ts.toDate().getTime():Date.now();
}
function chatIsStaff(){ return !!window.asmbCoachMode; }
function chatMsgPlain(msg){
  if(!msg) return "";
  if(msg.type==="media"){
    return msg.mediaType==="pdf"?"📄 "+(msg.fileName||"Document"):(msg.mediaType==="audio"?"🎤 Message vocal":"📷 Photo");
  }
  if(msg.type==="poll") return "📊 "+(msg.question||"Sondage");
  if(msg.type==="convocation") return "📋 Convocation : "+(msg.eventTitre||"");
  if(msg.type==="carpool") return "🚗 Covoiturage : "+(msg.eventTitre||"");
  return String(msg.text||"").replace(/<[^>]*>/g,"");
}

// ── Messages masqués « pour moi » (cet appareil seulement) ─────────
function chatHiddenIds(){ try{ return JSON.parse(localStorage.getItem("asmb_hidden_msgs")||"[]"); }catch(e){ return []; } }
function chatHideForMe(msgId){
  var h=chatHiddenIds(); if(h.indexOf(msgId)<0) h.push(msgId);
  try{ localStorage.setItem("asmb_hidden_msgs",JSON.stringify(h.slice(-500))); }catch(e){}
  var w=document.getElementById("msgwrap-"+msgId); if(w) w.remove();
}

// ── Libellés de jour : Aujourd'hui / Hier / lundi 5 octobre ────────
function chatDayLabel(d){
  var today=new Date(); today.setHours(0,0,0,0);
  var x=new Date(d.getTime()); x.setHours(0,0,0,0);
  var diff=Math.round((today-x)/86400000);
  if(diff===0) return "Aujourd'hui";
  if(diff===1) return "Hier";
  var opts=diff<7?{weekday:"long"}:{weekday:"long",day:"numeric",month:"long"};
  if(x.getFullYear()!==today.getFullYear()) opts.year="numeric";
  var s=d.toLocaleDateString("fr-FR",opts);
  return s.charAt(0).toUpperCase()+s.slice(1);
}

// Texte échappé, mentions en gras, liens cliquables.
function chatFormatText(text){
  var h=authEsc(String(text||""));
  h=h.replace(/(https?:\/\/[^\s<]+)/g,function(u){
    var clean=u.replace(/[.,;:!?)]+$/,"");
    var rest=u.slice(clean.length);
    return '<a href="'+clean+'" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:underline;word-break:break-all">'+clean+'</a>'+rest;
  });
  return h.replace(/@([A-Za-zÀ-ÿ0-9_-]+)/g,'<span style="font-weight:800">@$1</span>');
}
function chatLinkCard(text){
  var m=String(text||"").match(/https?:\/\/[^\s<]+/);
  if(!m) return "";
  var host="";
  try{ host=new URL(m[0].replace(/[.,;:!?)]+$/,"")).hostname.replace(/^www\./,""); }catch(e){ return ""; }
  return '<div style="margin:0 0 6px;padding:8px 10px;border-radius:10px;background:rgba(0,0,0,.08);font-size:11.5px;display:flex;align-items:center;gap:8px"><span style="font-size:16px">🔗</span><span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+authEsc(host)+'</span></div>';
}

// ═══ ÉLÉMENTS D'INTERFACE CRÉÉS À LA DEMANDE ═══════════════════════
function chatEnsureUi(){
  if(document.getElementById("chat-msg-menu")) return;
  var ov=document.createElement("div");
  ov.id="chat-msg-overlay";
  ov.style.cssText="display:none;position:fixed;inset:0;background:rgba(10,20,40,.35);z-index:300";
  ov.addEventListener("click",chatCloseMenu);
  document.body.appendChild(ov);
  var menu=document.createElement("div");
  menu.id="chat-msg-menu";
  menu.style.cssText="display:none;position:fixed;z-index:301;width:270px;max-width:calc(100vw - 24px)";
  document.body.appendChild(menu);
  var sheet=document.createElement("div");
  sheet.id="chat-sheet";
  sheet.style.cssText="display:none;position:fixed;left:0;right:0;bottom:0;z-index:302;background:var(--sf);border-radius:18px 18px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom,0px));max-height:75vh;overflow-y:auto;box-shadow:0 -4px 20px var(--shadow)";
  document.body.appendChild(sheet);
  var nb=document.createElement("div");
  nb.id="chat-new-btn";
  nb.style.cssText="display:none;position:fixed;right:16px;bottom:calc(52px + env(safe-area-inset-bottom,0px) + 74px);z-index:11;background:var(--sf);color:var(--txt);border:1px solid var(--bdr);border-radius:18px;padding:8px 14px;font-size:12px;font-weight:800;box-shadow:0 3px 10px var(--shadow);cursor:pointer";
  nb.addEventListener("click",function(){
    var el=document.getElementById("chat-messages"); if(el) el.scrollTop=el.scrollHeight;
    nb.style.display="none"; chatNewCount=0;
  });
  document.body.appendChild(nb);
  var msgs=document.getElementById("chat-messages");
  if(msgs && !msgs.__scrollBound){
    msgs.__scrollBound=true;
    msgs.addEventListener("scroll",function(){
      if(chatNearBottom(msgs)){ var b=document.getElementById("chat-new-btn"); if(b) b.style.display="none"; chatNewCount=0; }
    });
  }
}
function chatNearBottom(el){ return el.scrollTop+el.clientHeight>=el.scrollHeight-80; }
var chatNewCount=0;

// ═══ LECTURES (coches) ═════════════════════════════════════════════
var chatReads={};          // uid -> {ts:ms, pseudo}
var chatReadsUnsub=null;
var chatLastMark=0;
function chatStartReads(convId){
  if(chatReadsUnsub){ chatReadsUnsub(); chatReadsUnsub=null; }
  chatReads={};
  if(!window.fbReady||!convId) return;
  chatReadsUnsub=window.fbOnSnapshot(window.fbCollection(window.fbDb,convColl(),convId,"reads"),function(snap){
    chatReads={};
    snap.forEach(function(d){
      var r=d.data({serverTimestamps:"estimate"})||{};
      chatReads[d.id]={ts:r.ts&&r.ts.toDate?r.ts.toDate().getTime():0, pseudo:r.pseudo||"?"};
    });
    chatRefreshTicks();
  },function(){});
  chatMarkRead(true);
}
function chatMarkRead(force){
  var uid=myUid();
  if(!uid||!window.fbReady||!currentChannelId) return;
  if(!force && Date.now()-chatLastMark<4000) return;
  if(document.hidden) return;
  chatLastMark=Date.now();
  window.fbSetDoc(window.fbDoc(window.fbDb,convColl(),currentChannelId,"reads",uid),
    {uid:uid,pseudo:myChatPseudo(),ts:window.fbServerTimestamp()}).catch(function(){});
}
// Lecteurs d'un message : tous ceux dont la dernière lecture du canal est
// postérieure au message. "Tout le monde" = toutes les personnes qui ont
// déjà ouvert ce canal (pour une discussion privée : l'autre personne).
function chatReadersOf(msgTs){
  var me=myUid(), lu=[], pasLu=[];
  Object.keys(chatReads).forEach(function(uid){
    if(uid===me) return;
    var r=chatReads[uid];
    (r.ts>=msgTs?lu:pasLu).push({uid:uid,pseudo:r.pseudo,ts:r.ts});
  });
  return {lu:lu,pasLu:pasLu};
}
function chatTickHtml(msgTs,pending){
  if(pending) return '<span title="Envoi en cours" style="font-size:10px;opacity:.8">🕓</span>';
  var r=chatReadersOf(msgTs);
  var total=r.lu.length+r.pasLu.length;
  if(!r.lu.length) return '<span title="Envoyé" style="letter-spacing:-3px;opacity:.75">✓</span>';
  var tous=(r.lu.length===total);
  return '<span title="'+(tous?"Lu par tous":"Lu par "+r.lu.length)+'" style="letter-spacing:-3px;font-weight:800;color:'+(tous?"#53bdeb":"inherit")+';opacity:'+(tous?"1":".75")+'">✓✓</span>';
}
function chatRefreshTicks(){
  document.querySelectorAll("[data-tick-ts]").forEach(function(el){
    el.innerHTML=chatTickHtml(parseInt(el.getAttribute("data-tick-ts"),10), el.getAttribute("data-pending")==="1");
  });
}
document.addEventListener("visibilitychange",function(){
  if(!document.hidden && document.getElementById("scr-chat") && document.getElementById("scr-chat").classList.contains("on")) chatMarkRead(true);
});

// ═══ CONVOCATIONS = présences de l'accueil (checkins) ══════════════
// La convocation postée dans le canal et les boutons Présent/Absent de
// l'écran d'accueil écrivent la même fiche : checkins/{eventId}_{playerId}.
var convocStatus={};        // eventId -> {playerId: status}
var convocUnsubs={};        // eventId -> unsubscribe
function chatWatchConvocation(eventId){
  if(!eventId||convocUnsubs[eventId]||!window.fbReady) return;
  var q=window.fbQuery(window.fbCollection(window.fbDb,"checkins"),window.fbWhere("eventId","==",eventId));
  convocUnsubs[eventId]=window.fbOnSnapshot(q,function(snap){
    var m={};
    snap.forEach(function(d){ var c=d.data(); if(c&&c.playerId) m[c.playerId]=c.status; });
    convocStatus[eventId]=m;
    document.querySelectorAll('[data-convoc-event="'+eventId+'"]').forEach(function(el){
      var id=el.getAttribute("data-msg-id");
      if(renderedMsgs[id]) el.innerHTML=chatConvocInner(renderedMsgs[id],id);
    });
  },function(){});
}
function chatStopConvocWatchers(){
  Object.keys(convocUnsubs).forEach(function(k){ try{ convocUnsubs[k](); }catch(e){} });
  convocUnsubs={};
}
function chatCanAnswerFor(playerId){
  if(isStaffUser()) return true;
  var linked=(window.ASMB_USER&&window.ASMB_USER.linkedPlayerIds)||[];
  if(linked.map(String).indexOf(String(playerId))>=0) return true;
  var lp=(typeof getLinkedPlayerForCheckin==="function")?getLinkedPlayerForCheckin():null;
  return !!(lp && String(lp.id)===String(playerId));
}
function chatConvocInner(msg,msgId){
  var st=convocStatus[msg.eventId]||{};
  var old=msg.responses||{};
  var pres=0,abs=0;
  var rows=(msg.players||[]).map(function(p){
    var s=st[p.id]||old[p.id]||null;
    if(s==="present") pres++; else if(s==="absent"||s==="retard") abs++;
    var peut=chatCanAnswerFor(p.id);
    var btn=function(val,lbl,col){
      var on=(s===val);
      return '<span data-convoc-btn="'+val+'" data-player="'+authEsc(String(p.id))+'" style="cursor:'+(peut?"pointer":"default")+';font-size:10px;font-weight:700;padding:5px 10px;border-radius:12px;background:'+(on?col:"rgba(0,0,0,.08)")+';color:'+(on?"#fff":"var(--mut)")+';opacity:'+(peut||on?"1":".45")+'">'+lbl+'</span>';
    };
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-top:1px solid var(--bdr)">'+
      '<span style="font-size:12px;color:var(--txt)">'+authEsc(p.nom||"")+'</span>'+
      '<div style="display:flex;gap:5px">'+btn("present","✓ Présent","var(--ltg)")+btn("absent","✕ Absent","#C0392B")+'</div></div>';
  }).join("");
  return '<div class="poll-q">📋 Convocation</div>'+
    '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:2px">'+authEsc(msg.eventTitre||"")+'</div>'+
    '<div style="font-size:11px;color:var(--mut);margin-bottom:6px">'+authEsc(msg.eventDate||"")+(msg.eventHeure?" · "+authEsc(msg.eventHeure):"")+(msg.eventLieu?" · "+authEsc(msg.eventLieu):"")+'</div>'+
    '<div style="font-size:11px;font-weight:700;margin-bottom:4px"><span style="color:var(--ltg)">'+pres+' présent'+(pres>1?"s":"")+'</span> · <span style="color:#C0392B">'+abs+' absent'+(abs>1?"s":"")+'</span></div>'+
    rows;
}
function respondConvocation(channelId,msgId,playerId,status){
  if(!window.fbReady) return;
  var msg=renderedMsgs[msgId]; if(!msg||!msg.eventId) return;
  if(!chatCanAnswerFor(playerId)){ askAlert("Seuls le coach et les parents de ce joueur peuvent répondre."); return; }
  var cur=(convocStatus[msg.eventId]||{})[playerId]||null;
  var ref=window.fbDoc(window.fbDb,"checkins",msg.eventId+"_"+playerId);
  var p=(msg.players||[]).find(function(x){return String(x.id)===String(playerId);})||{};
  var w;
  if(cur===status) w=window.fbDeleteDoc(ref);
  else w=window.fbSetDoc(ref,{eventId:msg.eventId,playerId:playerId,playerName:p.nom||"",
    eventTitre:msg.eventTitre||"",eventDate:msg.eventDate||"",status:status,ts:window.fbServerTimestamp(),source:"canal"});
  w.then(function(){ if(typeof refreshEventCounts==="function") refreshEventCounts(msg.eventId); })
   .catch(function(e){ askAlert("La réponse n'a pas pu être enregistrée : "+((e&&e.code)||e)); });
}

// ═══ AFFICHAGE DES MESSAGES ════════════════════════════════════════
function listenMessages(channelId, prevLastRead){
  chatEnsureUi();
  if(chatUnsubscribe) chatUnsubscribe();
  chatStopConvocWatchers();
  var msgsEl=document.getElementById("chat-messages");
  if(!msgsEl) return;
  msgsEl.innerHTML="";
  chatNewCount=0;
  var nb=document.getElementById("chat-new-btn"); if(nb) nb.style.display="none";
  var isFirstLoad=true;
  var q=window.fbQuery(window.fbCollection(window.fbDb,convColl(),channelId,"messages"),window.fbOrderBy("ts"));
  chatUnsubscribe=window.fbOnSnapshot(q,{includeMetadataChanges:true},function(snap){
    var myPseudoForMention=(savedPseudo||"moi").toLowerCase();
    var ajoutsAutres=0;
    if(!isFirstLoad){
      snap.docChanges().forEach(function(change){
        if(change.type!=="added") return;
        var m=change.doc.data();
        if(chatIsMine(m)) return;
        ajoutsAutres++;
        if(localStorage.getItem("asmb_notif")==="on"&&localStorage.getItem("asmb_notif_messages")!=="off"&&"Notification" in window&&Notification.permission==="granted"){
          var mentioned=m.text&&m.text.toLowerCase().indexOf("@"+myPseudoForMention)>=0;
          if(mentioned||!isChannelMuted(channelId)){
            try{
              var ch=currentChannelData;
              new Notification((ch?(ch.icon||"")+" "+ch.name:clubLabel())+" - "+(m.pseudo||"")+(mentioned?" vous a mentionné":""),
                {body:chatMsgPlain(m).substring(0,100),tag:"asmb-msg"});
              if(localStorage.getItem("asmb_notif_sound")==="on"&&typeof playNotifSound==="function") playNotifSound();
            }catch(e){}
          }
        }
      });
    }
    var thisLoadIsFirst=isFirstLoad;
    isFirstLoad=false;
    var wasNearBottom=chatNearBottom(msgsEl);
    var prevScroll=msgsEl.scrollTop;
    msgsEl.innerHTML="";
    var pinnedIds=(currentChannelData&&currentChannelData.pinnedMessageIds)||[];
    var pinnedMsgs=[];
    var hidden=chatHiddenIds();
    var docs=[]; snap.forEach(function(d){ docs.push(d); });
    var seen=[];
    docs.forEach(function(d){ var m=d.data(); if(m.pseudo&&seen.indexOf(m.pseudo)<0) seen.push(m.pseudo); });
    channelKnownPseudos=seen;
    var bannerIndex=-1;
    if(thisLoadIsFirst&&prevLastRead>0){
      for(var i=0;i<docs.length;i++){
        var t0=docs[i].data().ts; t0=t0&&t0.toDate?t0.toDate().getTime():0;
        if(t0>prevLastRead){ bannerIndex=i; break; }
      }
      if(bannerIndex===0) bannerIndex=-1;
    }
    var bannerEl=null;
    renderedMsgs={};
    var archiveDays=parseInt(localStorage.getItem("asmb_archive_days")||"0",10);
    var archiveCutoff=archiveDays>0?(Date.now()-archiveDays*86400000):0;
    var hiddenArchivedCount=0;
    var lastDay="";
    docs.forEach(function(d,idx){
      var msg=d.data({serverTimestamps:"estimate"});
      renderedMsgs[d.id]=msg;
      if(hidden.indexOf(d.id)>=0) return;
      var ms=chatMsgTime(msg);
      if(archiveCutoff&&!chatShowArchived&&pinnedIds.indexOf(d.id)<0&&ms<archiveCutoff){ hiddenArchivedCount++; return; }
      if(idx===bannerIndex){
        bannerEl=document.createElement("div");
        bannerEl.className="unread-divider";
        bannerEl.style.cssText="display:flex;align-items:center;gap:10px;margin:14px 0;color:var(--grn);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.5px";
        bannerEl.innerHTML='<div style="flex:1;height:1px;background:var(--grn);opacity:.4"></div><span>Nouveaux messages</span><div style="flex:1;height:1px;background:var(--grn);opacity:.4"></div>';
        msgsEl.appendChild(bannerEl);
      }
      if(pinnedIds.indexOf(d.id)>=0) pinnedMsgs.push({id:d.id,text:chatMsgPlain(msg)||"Message"});
      var dt=new Date(ms);
      var day=chatDayLabel(dt);
      if(day!==lastDay){
        lastDay=day;
        var dayDiv=document.createElement("div");
        dayDiv.className="msg-day";
        dayDiv.innerHTML='<span style="display:inline-block;background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:3px 10px">'+authEsc(day)+'</span>';
        msgsEl.appendChild(dayDiv);
      }
      msgsEl.appendChild(chatRenderMessage(channelId,d.id,msg,d.metadata&&d.metadata.hasPendingWrites,pinnedIds));
      if(msg.type==="convocation"&&msg.eventId) chatWatchConvocation(msg.eventId);
    });
    if(hiddenArchivedCount>0){
      var archBanner=document.createElement("div");
      archBanner.style.cssText="text-align:center;margin:6px 0 14px";
      archBanner.innerHTML='<span style="display:inline-block;padding:7px 16px;border-radius:14px;background:var(--bdr);color:var(--mut);font-size:11px;font-weight:700;cursor:pointer">🗄 Afficher '+hiddenArchivedCount+' message'+(hiddenArchivedCount>1?"s":"")+' archivé'+(hiddenArchivedCount>1?"s":"")+'</span>';
      archBanner.onclick=function(){ chatShowArchived=true; listenMessages(channelId,prevLastRead); };
      msgsEl.insertBefore(archBanner,msgsEl.firstChild);
    }
    var pinEl=document.getElementById("chat-pinned");
    if(pinEl){
      if(pinnedMsgs.length){
        pinEl.style.display="flex";
        pinEl.innerHTML=pinnedMsgs.map(function(pm){
          return '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span onclick="scrollToMsg(\''+pm.id+'\')" style="cursor:pointer;font-size:11px;color:var(--txt);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📌 '+authEsc(pm.text)+'</span>'+(chatIsStaff()?'<span onclick="togglePin(\''+channelId+'\',\''+pm.id+'\')" style="cursor:pointer;font-size:10px;color:var(--mut)">✕</span>':"")+'</div>';
        }).join("");
      } else { pinEl.style.display="none"; pinEl.innerHTML=""; }
    }
    if(thisLoadIsFirst){
      setTimeout(function(){
        if(bannerEl) bannerEl.scrollIntoView({block:"center"});
        else msgsEl.scrollTop=msgsEl.scrollHeight;
      },50);
    } else if(wasNearBottom){
      msgsEl.scrollTop=msgsEl.scrollHeight;
    } else {
      msgsEl.scrollTop=prevScroll;
      if(ajoutsAutres){
        chatNewCount+=ajoutsAutres;
        var b=document.getElementById("chat-new-btn");
        if(b){ b.textContent="⬇ "+chatNewCount+" nouveau"+(chatNewCount>1?"x":"")+" message"+(chatNewCount>1?"s":""); b.style.display="block"; }
      }
    }
    if(!thisLoadIsFirst) localStorage.setItem((currentConvKind==="dm"?"asmb_lastread_dm_":"asmb_lastread_")+channelId,Date.now().toString());
    chatMarkRead(false);
  });
}

function chatRenderMessage(channelId,msgId,msg,pending,pinnedIds){
  var mine=chatIsMine(msg);
  var wrap=document.createElement("div");
  wrap.className="msg-wrap "+(mine?"out":"in");
  wrap.id="msgwrap-"+msgId;
  var ms=chatMsgTime(msg);
  var time=new Date(ms).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
  if(!mine && msg.pseudo){
    var psd=document.createElement("div");
    psd.className="msg-pseudo"; psd.style.cursor="pointer";
    var badgeHtml=(msg.badge&&msg.badge.label)?('<span style="font-weight:800">'+authEsc(msg.badge.emoji||"")+' '+authEsc(msg.badge.label)+'</span> · '):"";
    psd.innerHTML=badgeHtml+authEsc(msg.pseudo||"");
    psd.onclick=function(){ if(typeof openSenderIdentityModal==="function") openSenderIdentityModal(msg); };
    wrap.appendChild(psd);
  }
  var tick=mine?'<span data-tick-ts="'+ms+'" data-pending="'+(pending?"1":"0")+'" style="margin-left:4px">'+chatTickHtml(ms,pending)+'</span>':"";
  var meta='<div class="msg-time" style="display:flex;justify-content:flex-end;align-items:center;gap:2px">'+(msg.edited&&!msg.deleted?'<span style="font-style:italic;margin-right:4px">modifié</span>':'')+time+tick+'</div>';
  var bubble=document.createElement("div");
  bubble.id="msgel-"+msgId;

  // Message supprimé
  if(msg.deleted){
    bubble.className="msg-bubble "+(mine?"msg-out":"msg-in");
    bubble.style.opacity=".7"; bubble.style.fontStyle="italic";
    var admin=msg.deletedByAdmin||msg.deletedBy==="le coach";
    var lbl=admin?"Supprimé par un admin":(mine?"Vous avez supprimé ce message":"Ce message a été supprimé");
    bubble.innerHTML=authEsc(lbl)+'<div class="msg-time">'+time+'</div>';
    wrap.appendChild(bubble);
    if(chatIsStaff()||mine) chatBindGestures(bubble,wrap,channelId,msgId,true);
    return wrap;
  }

  var fwd=msg.forwarded?'<div style="font-size:10.5px;font-style:italic;opacity:.75;margin-bottom:3px">↪ Transféré</div>':"";
  var reply="";
  if(msg.replyTo&&msg.replyTo.id){
    reply='<div data-goto="'+authEsc(msg.replyTo.id)+'" style="cursor:pointer;border-left:3px solid rgba(120,120,120,.6);padding:4px 8px;margin-bottom:6px;font-size:11px;border-radius:4px;background:rgba(0,0,0,.08)"><b>'+authEsc(msg.replyTo.pseudo||"")+'</b><br>'+authEsc(msg.replyTo.text||"")+'</div>';
  }

  if(msg.type==="convocation"){
    bubble.className="poll-bubble";
    bubble.setAttribute("data-convoc-event",msg.eventId||"");
    bubble.setAttribute("data-msg-id",msgId);
    bubble.innerHTML=chatConvocInner(msg,msgId);
    bubble.addEventListener("click",function(ev){
      var t=ev.target.closest("[data-convoc-btn]");
      if(t) respondConvocation(channelId,msgId,t.getAttribute("data-player"),t.getAttribute("data-convoc-btn"));
    });
    wrap.appendChild(bubble);
    var cm=document.createElement("div"); cm.className="msg-time"; cm.style.color="var(--mut)"; cm.textContent=time;
    wrap.appendChild(cm);
    chatBindGestures(bubble,wrap,channelId,msgId,false);
    return wrap;
  }
  if(msg.type==="carpool"||msg.type==="poll"){
    bubble.className="poll-bubble";
    bubble.innerHTML=(msg.type==="poll")?chatPollInner(channelId,msgId,msg,time):chatCarpoolInner(channelId,msgId,msg,time);
    wrap.appendChild(bubble);
    chatAppendReactions(wrap,channelId,msgId,msg,mine);
    chatBindGestures(bubble,wrap,channelId,msgId,false);
    return wrap;
  }
  if(msg.type==="media"){
    bubble.style.cssText="max-width:78%;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px var(--shadow);background:"+(mine?"var(--dkg)":"var(--card)")+";color:"+(mine?"#fff":"var(--txt)")+";border:1px solid var(--bdr)";
    var body="";
    if(msg.mediaType==="pdf"){
      body='<a href="'+authEsc(msg.mediaUrl||"")+'" download="'+authEsc(msg.fileName||"document.pdf")+'" style="display:flex;align-items:center;gap:10px;padding:12px;text-decoration:none;color:inherit"><div style="width:36px;height:36px;border-radius:10px;background:rgba(192,57,43,.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">📄</div><div style="flex:1;min-width:0;font-size:12px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(msg.fileName||"Document.pdf")+'</div></a>';
    } else if(msg.mediaType==="audio"){
      body='<div style="padding:10px 10px 0"><audio controls preload="metadata" src="'+authEsc(msg.mediaUrl||"")+'" style="width:230px;max-width:100%;height:36px"></audio></div>';
    } else if(msg.mediaType==="video"){
      body='<video src="'+authEsc(msg.mediaUrl||"")+'" controls style="width:100%;display:block;max-height:300px;background:#000"></video>';
    } else {
      body='<img data-view="1" src="'+authEsc(msg.mediaUrl||"")+'" style="width:100%;display:block;max-height:320px;object-fit:cover;cursor:pointer">';
    }
    bubble.innerHTML=(fwd||reply?'<div style="padding:8px 10px 0">'+fwd+reply+'</div>':"")+body+'<div style="padding:2px 10px 6px">'+meta+'</div>';
    var img=bubble.querySelector("img[data-view]");
    if(img) img.addEventListener("click",function(){ if(typeof viewChatMedia==="function") viewChatMedia(msg.mediaUrl); });
    wrap.appendChild(bubble);
    chatAppendReactions(wrap,channelId,msgId,msg,mine);
    chatBindGestures(bubble,wrap,channelId,msgId,false);
    return wrap;
  }
  // Texte
  bubble.className="msg-bubble "+(mine?"msg-out":"msg-in");
  bubble.innerHTML=fwd+reply+chatLinkCard(msg.text)+chatFormatText(msg.text)+meta;
  var go=bubble.querySelector("[data-goto]");
  if(go) go.addEventListener("click",function(e){ e.stopPropagation(); scrollToMsg(go.getAttribute("data-goto")); });
  wrap.appendChild(bubble);
  chatAppendReactions(wrap,channelId,msgId,msg,mine);
  chatBindGestures(bubble,wrap,channelId,msgId,false);
  return wrap;
}

function chatAppendReactions(wrap,channelId,msgId,msg,mine){
  var reactions=msg.reactions||{};
  var me=savedPseudo||"moi";
  var parts=[];
  Object.keys(reactions).forEach(function(em){
    var users=reactions[em]||[];
    if(!users.length) return;
    var on=users.indexOf(me)>=0;
    parts.push('<span data-react="'+authEsc(em)+'" title="'+authEsc(users.join(", "))+'" style="cursor:pointer;font-size:12px;padding:2px 7px;border-radius:12px;background:var(--card);border:1px solid '+(on?"var(--ltg)":"var(--bdr)")+';box-shadow:0 1px 3px var(--shadow)">'+authEsc(em)+(users.length>1?" "+users.length:"")+'</span>');
  });
  if(!parts.length) return;
  var r=document.createElement("div");
  r.style.cssText="display:flex;gap:4px;flex-wrap:wrap;margin-top:-6px;padding:0 8px;position:relative;z-index:1";
  r.innerHTML=parts.join("");
  r.addEventListener("click",function(e){
    var t=e.target.closest("[data-react]");
    if(t) setReaction(channelId,msgId,t.getAttribute("data-react"));
  });
  wrap.appendChild(r);
}

function chatPollInner(channelId,msgId,msg,time){
  var myP=savedPseudo||"moi", total=0;
  (msg.options||[]).forEach(function(o){ total+=(o.votes||[]).length; });
  var isClosed=msg.deadline&&(new Date().toISOString().slice(0,10)>msg.deadline);
  var h='<div class="poll-q">📊 '+authEsc(msg.question||"")+(msg.allowMultiple?' <span style="font-size:9px;color:var(--mut);font-weight:600">(choix multiple)</span>':"")+'</div>';
  (msg.options||[]).forEach(function(o,oi){
    var v=(o.votes||[]).length, pct=total?Math.round(v/total*100):0, mineV=(o.votes||[]).indexOf(myP)>=0;
    h+='<div class="poll-opt'+(mineV?" voted":"")+'" onclick="'+(isClosed?"":"votePoll(\'"+channelId+"\',\'"+msgId+"\',"+oi+")")+'" style="'+(isClosed?"cursor:default;opacity:.7":"")+'"><div class="poll-opt-fill" style="width:'+pct+'%"></div><div class="poll-opt-content"><span>'+(mineV?"✓ ":"")+authEsc(o.text||"")+'</span><span style="color:var(--mut);font-size:10px">'+pct+'% ('+v+')</span></div></div>';
  });
  return h+'<div style="font-size:10px;color:var(--mut);margin-top:4px">'+total+' vote'+(total>1?"s":"")+' · '+time+(msg.deadline?' · '+(isClosed?"Clôturé le "+authEsc(msg.deadline):"Jusqu'au "+authEsc(msg.deadline)):"")+'</div>';
}
function chatCarpoolInner(channelId,msgId,msg,time){
  var passagers=msg.passagers||[];
  var reste=(msg.places||0)-passagers.length;
  var meIn=passagers.indexOf(savedPseudo||"moi")>=0;
  var full=reste<=0&&!meIn;
  return '<div class="poll-q">🚗 Covoiturage</div>'+
    '<div style="font-size:12px;font-weight:700;color:var(--txt);margin-bottom:2px">'+authEsc(msg.eventTitre||"")+'</div>'+
    '<div style="font-size:11px;color:var(--mut);margin-bottom:6px">'+authEsc(msg.eventDate||"")+(msg.eventLieu?" · "+authEsc(msg.eventLieu):"")+'</div>'+
    '<div style="font-size:11.5px;color:var(--txt)">Conducteur·rice : <b>'+authEsc(msg.conducteur||"")+'</b></div>'+
    (msg.depart?'<div style="font-size:11px;color:var(--mut);margin-top:2px">Départ : '+authEsc(msg.depart)+'</div>':"")+
    '<div style="font-size:11px;color:var(--mut);margin-top:6px">'+(passagers.length?authEsc(passagers.join(", ")):"Personne pour l'instant")+'</div>'+
    '<div onclick="reserverCarpool(\''+channelId+'\',\''+msgId+'\')" style="cursor:'+(full?"default":"pointer")+';margin-top:8px;text-align:center;padding:8px;border-radius:12px;font-size:11px;font-weight:700;background:'+(meIn?"#1B5C28":(full?"rgba(0,0,0,.08)":"color-mix(in srgb, var(--ltg) 15%, transparent)"))+';color:'+(meIn?"#fff":(full?"var(--mut)":"var(--ltg)"))+'">'+(meIn?"✓ Vous avez une place — annuler":(full?"Complet":"Réserver une place ("+reste+" restante"+(reste>1?"s":"")+")"))+'</div>'+
    '<div style="font-size:10px;color:var(--mut);margin-top:8px">'+time+'</div>';
}

// ── Appui long / clic droit / glisser pour répondre ────────────────
function chatBindGestures(bubble,wrap,channelId,msgId,isDeleted){
  var timer=null,sx=0,sy=0,dx=0,swiping=false,moved=false;
  bubble.addEventListener("contextmenu",function(e){ e.preventDefault(); chatOpenMenu(channelId,msgId,bubble); });
  bubble.addEventListener("touchstart",function(e){
    var t=e.touches[0]; sx=t.clientX; sy=t.clientY; dx=0; swiping=false; moved=false;
    timer=setTimeout(function(){ if(!moved){ if(navigator.vibrate) try{navigator.vibrate(15);}catch(er){} chatOpenMenu(channelId,msgId,bubble); } },450);
  },{passive:true});
  bubble.addEventListener("touchmove",function(e){
    var t=e.touches[0]; var mx=t.clientX-sx, my=t.clientY-sy;
    if(Math.abs(mx)>8||Math.abs(my)>8){ moved=true; clearTimeout(timer); }
    if(isDeleted) return;
    if(!swiping && mx>12 && Math.abs(mx)>Math.abs(my)*1.5) swiping=true;
    if(swiping){ dx=Math.max(0,Math.min(mx,80)); bubble.style.transform="translateX("+dx+"px)"; }
  },{passive:true});
  var end=function(){
    clearTimeout(timer);
    if(swiping){ bubble.style.transition="transform .15s"; bubble.style.transform=""; setTimeout(function(){bubble.style.transition="";},160); if(dx>60) setReplyTo(msgId); }
    swiping=false; dx=0;
  };
  bubble.addEventListener("touchend",end);
  bubble.addEventListener("touchcancel",end);
}

// ═══ MENU DU MESSAGE ═══════════════════════════════════════════════
function chatCloseMenu(){
  var m=document.getElementById("chat-msg-menu"), o=document.getElementById("chat-msg-overlay"), s=document.getElementById("chat-sheet");
  if(m) m.style.display="none";
  if(o) o.style.display="none";
  if(s) s.style.display="none";
}
function chatCanEdit(msg){
  return chatIsMine(msg)&&!msg.deleted&&(!msg.type||msg.type==="text")&&(Date.now()-chatMsgTime(msg))<(CHAT_EDIT_MS-5000);
}
function chatOpenMenu(channelId,msgId,anchor){
  chatEnsureUi();
  var msg=renderedMsgs[msgId]; if(!msg) return;
  var mine=chatIsMine(msg), staff=chatIsStaff(), dm=(currentConvKind==="dm");
  var acts=[];
  if(!msg.deleted){
    acts.push(["Répondre","↩",function(){ setReplyTo(msgId); }]);
    if(msg.type!=="convocation"&&msg.type!=="poll"&&msg.type!=="carpool"&&(msg.text||msg.type==="media"&&msg.mediaType!=="audio")) {
      if(msg.text) acts.push(["Copier","⧉",function(){ chatCopy(msg.text); }]);
    }
    if(chatCanEdit(msg)) acts.push(["Modifier","✎",function(){ editMessage(channelId,msgId); }]);
    if(!msg.type||msg.type==="text"||msg.type==="media") acts.push(["Transférer","↪",function(){ chatForward(msgId); }]);
    if(mine) acts.push(["Infos","ⓘ",function(){ chatInfo(msgId); }]);
    if(staff&&!dm){
      var pinned=((currentChannelData&&currentChannelData.pinnedMessageIds)||[]).indexOf(msgId)>=0;
      acts.push([pinned?"Désépingler":"Épingler","📌",function(){ togglePin(channelId,msgId); }]);
    }
  }
  acts.push(["Supprimer pour moi","🙈",function(){ chatHideForMe(msgId); }]);
  if(!msg.deleted){
    if(mine) acts.push(["Supprimer pour tout le monde","🗑",function(){ deleteMessage(channelId,msgId,false); },true]);
    else if(staff&&!dm) acts.push(["Supprimer (admin)","🗑",function(){ deleteMessage(channelId,msgId,true); },true]);
  }
  var menu=document.getElementById("chat-msg-menu");
  var h='';
  if(!msg.deleted){
    h+='<div id="chat-menu-emo" style="background:var(--sf);border-radius:26px;padding:6px 10px;display:flex;justify-content:space-between;margin-bottom:8px;box-shadow:0 3px 14px var(--shadow)">';
    QUICK_REACTIONS.forEach(function(em){ h+='<span data-emo="'+em+'" style="font-size:22px;cursor:pointer;padding:2px">'+em+'</span>'; });
    h+='<span data-emo="+" style="font-size:18px;font-weight:800;color:var(--mut);cursor:pointer;padding:2px 6px">＋</span></div>';
  }
  h+='<div style="background:var(--sf);border-radius:14px;overflow:hidden;box-shadow:0 3px 14px var(--shadow)">';
  acts.forEach(function(a,i){
    h+='<button type="button" data-act="'+i+'" style="display:flex;width:100%;justify-content:space-between;align-items:center;border:0;border-bottom:1px solid var(--bdr);background:none;padding:12px 14px;min-height:44px;font-size:14px;color:'+(a[3]?"var(--red)":"var(--txt)")+';cursor:pointer;text-align:left"><span>'+a[0]+'</span><span style="opacity:.7">'+a[1]+'</span></button>';
  });
  h+='</div>';
  menu.innerHTML=h;
  menu.onclick=function(e){
    var em=e.target.closest("[data-emo]");
    if(em){
      chatCloseMenu();
      var v=em.getAttribute("data-emo");
      if(v==="+"){ reactionPickerTarget={channelId:channelId,msgId:msgId}; openMoreReactions(); }
      else setReaction(channelId,msgId,v);
      return;
    }
    var b=e.target.closest("[data-act]");
    if(b){ chatCloseMenu(); acts[parseInt(b.getAttribute("data-act"),10)][2](); }
  };
  menu.style.display="block";
  document.getElementById("chat-msg-overlay").style.display="block";
  var r=anchor.getBoundingClientRect();
  var mh=menu.offsetHeight, mw=menu.offsetWidth;
  var top=r.bottom+6;
  if(top+mh>window.innerHeight-16) top=Math.max(12,r.top-mh-6);
  var left=chatIsMine(msg)?Math.max(12,r.right-mw):Math.min(window.innerWidth-mw-12,Math.max(12,r.left));
  menu.style.top=top+"px"; menu.style.left=left+"px";
}
// Ancien point d'entrée (réactions) : redirige vers le menu complet.
function openReactionPicker(ev,channelId,msgId){
  var el=document.getElementById("msgel-"+msgId)||document.getElementById("msgwrap-"+msgId);
  if(el) chatOpenMenu(channelId,msgId,el);
}
function startLongPress(){} function cancelLongPress(){}

function chatCopy(text){
  var t=String(text||"").replace(/<[^>]*>/g,"");
  var done=function(){ if(typeof showToast==="function") showToast("Message copié"); };
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(t).then(done).catch(function(){ chatCopyFallback(t); done(); }); }
  else { chatCopyFallback(t); done(); }
}
function chatCopyFallback(t){
  var ta=document.createElement("textarea"); ta.value=t; ta.style.cssText="position:fixed;opacity:0";
  document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); }catch(e){} ta.remove();
}

function setReplyTo(msgId){
  var m=renderedMsgs[msgId]; if(!m||m.deleted) return;
  replyingTo={id:msgId,pseudo:chatIsMine(m)?"Vous":(m.pseudo||"?"),text:chatMsgPlain(m).slice(0,80)};
  var bar=document.getElementById("chat-reply-bar");
  document.getElementById("chat-reply-pseudo").textContent="Réponse à "+replyingTo.pseudo;
  document.getElementById("chat-reply-text").textContent=replyingTo.text;
  if(bar) bar.style.display="flex";
  var input=document.getElementById("chat-msg"); if(input) input.focus();
}

async function editMessage(channelId,msgId){
  var m=renderedMsgs[msgId]; if(!m) return;
  if(!chatCanEdit(m)){ askAlert("Ce message ne peut plus être modifié."); return; }
  var current=String(m.text||"");
  var v=await askPrompt("Modifier le message",{defaultValue:current,confirmText:"Enregistrer"});
  if(v===null) return;
  v=v.trim();
  if(!v||v===current) return;
  if(!chatCanEdit(m)){ askAlert("Trop tard : le message ne peut plus être modifié."); return; }
  window.fbUpdateDoc(window.fbDoc(window.fbDb,convColl(),channelId,"messages",msgId),{text:v,edited:true,editedAt:window.fbServerTimestamp()})
    .catch(function(e){ askAlert("Le message n'a pas pu être modifié : "+((e&&e.code)||e)); });
}

function deleteMessage(channelId,msgId,asAdmin){
  var m=renderedMsgs[msgId]; if(!m) return;
  askConfirm(asAdmin?"Supprimer ce message pour tout le monde ? Il sera remplacé par « Supprimé par un admin ».":"Supprimer ce message pour tout le monde ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
    if(!ok) return;
    var upd={deleted:true,deletedBy:myChatPseudo(),deletedAt:window.fbServerTimestamp()};
    if(asAdmin) upd.deletedByAdmin=true;
    // Le contenu disparaît vraiment (pas seulement masqué à l'écran).
    ["text","mediaUrl","fileName","question","replyTo"].forEach(function(k){ if(m[k]!==undefined&&m[k]!==null) upd[k]=(k==="replyTo")?null:""; });
    window.fbUpdateDoc(window.fbDoc(window.fbDb,convColl(),channelId,"messages",msgId),upd)
      .catch(function(e){ askAlert("Le message n'a pas pu être supprimé : "+((e&&e.code)||e)); });
  });
}

// ── Infos du message : lu par / pas encore lu ──────────────────────
function chatInfo(msgId){
  var m=renderedMsgs[msgId]; if(!m) return;
  var r=chatReadersOf(chatMsgTime(m));
  var fmt=function(ts){ return ts?new Date(ts).toLocaleString("fr-FR",{weekday:"short",hour:"2-digit",minute:"2-digit"}):""; };
  var row=function(x,withTime){ return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--bdr);font-size:13px;color:var(--txt)"><span>'+authEsc(x.pseudo)+'</span>'+(withTime?'<span style="color:var(--mut);font-size:11px">'+fmt(x.ts)+'</span>':"")+'</div>'; };
  var h='<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:6px">Infos du message</div>'+
    '<div style="font-size:12px;color:var(--mut);margin-bottom:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(chatMsgPlain(m))+'</div>'+
    '<div style="font-size:11px;font-weight:800;color:#53bdeb;text-transform:uppercase;letter-spacing:.05em;margin:10px 0 2px">✓✓ Lu par '+r.lu.length+'</div>'+
    (r.lu.length?r.lu.sort(function(a,b){return a.ts-b.ts;}).map(function(x){return row(x,true);}).join(""):'<div style="font-size:12px;color:var(--mut);padding:6px 0">Personne pour l\'instant</div>')+
    (r.pasLu.length?'<div style="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:.05em;margin:14px 0 2px">Pas encore lu</div>'+r.pasLu.map(function(x){return row(x,false);}).join(""):"")+
    '<div style="font-size:10.5px;color:var(--mut);margin-top:10px">Seules les personnes qui ont déjà ouvert cette discussion apparaissent.</div>'+
    '<button type="button" onclick="chatCloseMenu()" style="margin-top:14px;width:100%;min-height:44px;border:0;border-radius:12px;background:var(--bdr);color:var(--txt);font-weight:800;cursor:pointer">Fermer</button>';
  var s=document.getElementById("chat-sheet");
  s.innerHTML=h; s.style.display="block";
  document.getElementById("chat-msg-overlay").style.display="block";
}

// ── Transférer vers un autre canal ou une discussion privée ────────
function chatForward(msgId){
  var m=renderedMsgs[msgId]; if(!m) return;
  var cibles=[];
  (window.__chatChannelsCache||[]).forEach(function(ch){
    var members=ch.members||[];
    var isDir=localStorage.getItem("asmb_profile")==="dirigeant";
    var ok=isDir||!members.length||members.some(function(x){return (typeof x==="string"?x:x.phone)===myPhone;});
    if(ok) cibles.push({kind:"channel",id:ch.id,label:(ch.icon?ch.icon+" ":"")+ch.name});
  });
  (window.__chatDmsCache||[]).forEach(function(dm){ cibles.push({kind:"dm",id:dm.id,label:"🔒 "+dmOtherLabel(dm)}); });
  if(!cibles.length){ askAlert("Aucune discussion disponible."); return; }
  var h='<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:10px">Transférer à…</div>';
  cibles.forEach(function(c,i){
    h+='<button type="button" data-fwd="'+i+'" style="display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--bdr);background:none;padding:12px 4px;min-height:44px;font-size:14px;color:var(--txt);cursor:pointer">'+authEsc(c.label)+'</button>';
  });
  h+='<button type="button" onclick="chatCloseMenu()" style="margin-top:12px;width:100%;min-height:44px;border:0;border-radius:12px;background:var(--bdr);color:var(--txt);font-weight:800;cursor:pointer">Annuler</button>';
  var s=document.getElementById("chat-sheet");
  s.innerHTML=h; s.style.display="block";
  document.getElementById("chat-msg-overlay").style.display="block";
  s.onclick=function(e){
    var b=e.target.closest("[data-fwd]"); if(!b) return;
    var c=cibles[parseInt(b.getAttribute("data-fwd"),10)];
    chatCloseMenu(); s.onclick=null;
    var payload=Object.assign({pseudo:myChatPseudo(),ts:window.fbServerTimestamp(),forwarded:true},mySenderMeta());
    if(m.type==="media"){ payload.type="media"; payload.mediaType=m.mediaType; payload.mediaUrl=m.mediaUrl; if(m.fileName) payload.fileName=m.fileName; }
    else payload.text=m.text||"";
    window.fbAddDoc(window.fbCollection(window.fbDb,c.kind==="dm"?"dms":"channels",c.id,"messages"),payload).then(function(){
      if(c.kind==="dm") dmTouch(c.id,chatMsgPlain(payload));
      if(typeof showToast==="function") showToast("Message transféré");
    }).catch(function(e){ askAlert("Le transfert a échoué : "+((e&&e.code)||e)); });
  };
}

// ═══ DISCUSSIONS PRIVÉES ═══════════════════════════════════════════
// Ouvertes par le staff (dirigeant, coach) avec un adulte du club. Jamais
// avec un compte joueur : pas de discussion privée adulte ↔ mineur.
var dmUnsub=null;
function dmOtherLabel(dm){
  var me=myUid();
  var o=(dm.members||[]).find(function(x){return x.uid!==me;});
  return (o&&o.label)||"Discussion privée";
}
function dmListen(){
  if(dmUnsub||!window.fbReady||!myUid()) return;
  var q=window.fbQuery(window.fbCollection(window.fbDb,"dms"),window.fbWhere("memberUids","array-contains",myUid()));
  dmUnsub=window.fbOnSnapshot(q,function(snap){
    var dms=[]; snap.forEach(function(d){ var x=d.data(); x.id=d.id; dms.push(x); });
    dms.sort(function(a,b){ return chatMsgTime({ts:b.lastTs})-chatMsgTime({ts:a.lastTs}); });
    window.__chatDmsCache=dms;
    dmRenderList();
  },function(e){ console.log("dms:",e&&e.code); });
}
function dmUnreadOf(dm){
  if(!dm.lastTs||dm.lastSender===myUid()) return false;
  var lr=parseInt(localStorage.getItem("asmb_lastread_dm_"+dm.id)||"0",10);
  return chatMsgTime({ts:dm.lastTs})>lr;
}
function dmRenderList(){
  var list=document.getElementById("channel-list"); if(!list) return;
  var box=document.getElementById("dm-list");
  if(!box){
    box=document.createElement("div"); box.id="dm-list";
    var avant=list.previousElementSibling;
    var ancre=(avant&&avant.classList&&avant.classList.contains("sec"))?avant:list;
    list.parentNode.insertBefore(box,ancre);
  }
  var dms=window.__chatDmsCache||[];
  var staff=isStaffUser();
  var unread=0;
  var h='';
  if(dms.length||staff){
    h+='<div class="sec" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span>Discussions privées</span>'+
      (staff?'<button type="button" onclick="dmStartPicker()" style="border:1px solid var(--bdr);background:var(--card);color:var(--txt);border-radius:16px;padding:6px 12px;min-height:34px;font-size:12px;font-weight:700;cursor:pointer;text-transform:none;letter-spacing:0">＋ Nouvelle</button>':'')+'</div>';
  }
  dms.forEach(function(dm,i){
    var un=dmUnreadOf(dm); if(un) unread++;
    var t=dm.lastTs?new Date(chatMsgTime({ts:dm.lastTs})):null;
    h+='<div class="channel-card" data-dm="'+i+'" style="position:relative;cursor:pointer"><div class="ch-icon">🔒</div><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:700;color:var(--txt);display:flex;justify-content:space-between;gap:8px"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+authEsc(dmOtherLabel(dm))+'</span><span style="font-size:10px;font-weight:600;color:var(--mut)">'+(t?authEsc(chatDayLabel(t)==="Aujourd'hui"?t.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}):chatDayLabel(t)):"")+'</span></div><div style="font-size:11px;color:'+(un?"var(--txt)":"var(--mut)")+';font-weight:'+(un?"700":"400")+';margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+(dm.lastSender===myUid()?"Vous : ":"")+authEsc(dm.lastMsg||"Nouvelle discussion")+'</div></div>'+(un?'<span style="width:10px;height:10px;border-radius:50%;background:var(--red);flex-shrink:0"></span>':'')+'</div>';
  });
  box.innerHTML=h;
  // Appui long (0,6 s) sur une discussion privée : proposer de la supprimer.
  var lpT=null, lpFait=false;
  function lpStop(){ clearTimeout(lpT); lpT=null; }
  box.onpointerdown=function(e){
    var c=e.target.closest("[data-dm]"); if(!c) return;
    lpFait=false; lpStop();
    lpT=setTimeout(function(){
      lpFait=true;
      dmSupprimer((window.__chatDmsCache||[])[parseInt(c.getAttribute("data-dm"),10)]);
    },600);
  };
  box.onpointerup=box.onpointerleave=box.onpointercancel=lpStop;
  box.onpointermove=function(e){ if(lpT&&(Math.abs(e.movementX)>3||Math.abs(e.movementY)>3)) lpStop(); };
  box.oncontextmenu=function(e){ if(e.target.closest("[data-dm]")) e.preventDefault(); };
  box.onclick=function(e){
    var c=e.target.closest("[data-dm]"); if(!c) return;
    if(lpFait){ lpFait=false; return; }
    openDm((window.__chatDmsCache||[])[parseInt(c.getAttribute("data-dm"),10)]);
  };
  window.__dmUnread=unread;
  if(typeof updateNavBadge==="function") updateNavBadge(window.__chanUnread||0);
}
function dmSupprimer(dm){
  if(!dm||!window.fbDeleteDoc) return;
  askConfirm("Supprimer la discussion privée avec "+dmOtherLabel(dm)+" ? Les messages seront effacés pour vous deux.",
    {danger:true,confirmText:"Supprimer"}).then(function(ok){
    if(!ok) return;
    var col=window.fbCollection(window.fbDb,"dms",dm.id,"messages");
    window.fbGetDocs(col).then(function(snap){
      var ps=[]; snap.forEach(function(d){ ps.push(window.fbDeleteDoc(d.ref)); });
      return Promise.all(ps);
    }).then(function(){
      return window.fbDeleteDoc(window.fbDoc(window.fbDb,"dms",dm.id));
    }).then(function(){
      window.__chatDmsCache=(window.__chatDmsCache||[]).filter(function(x){ return x.id!==dm.id; });
      dmRenderList();
      if(typeof showToast==="function") showToast("Discussion supprimée");
    }).catch(function(e){ askAlert("Suppression impossible : "+((e&&e.code)||e)); });
  });
}
function openDm(dm){
  if(!dm) return;
  currentConvKind="dm";
  currentChannelId=dm.id;
  currentChannelData={name:dmOtherLabel(dm),desc:"Discussion privée",icon:"🔒",pinnedMessageIds:[]};
  document.getElementById("chat-icon").textContent="🔒";
  document.getElementById("chat-name").textContent=currentChannelData.name;
  document.getElementById("chat-desc").textContent="Discussion privée";
  ["poll-btn","carpool-btn"].forEach(function(id){ var b=document.getElementById(id); if(b) b.style.display="none"; });
  if(typingUnsubscribe){ typingUnsubscribe(); typingUnsubscribe=null; }
  channelKnownPseudos=[]; chatShowArchived=false; cancelReply();
  var pinEl=document.getElementById("chat-pinned"); if(pinEl){ pinEl.style.display="none"; pinEl.innerHTML=""; }
  stack.push("chat"); showScr("chat");
  var key="asmb_lastread_dm_"+dm.id;
  var prev=parseInt(localStorage.getItem(key)||"0",10);
  listenMessages(dm.id,prev);
  chatStartReads(dm.id);
  localStorage.setItem(key,Date.now().toString());
  dmRenderList();
}
function dmTouch(dmId,text){
  window.fbUpdateDoc(window.fbDoc(window.fbDb,"dms",dmId),{lastMsg:String(text||"").slice(0,80),lastTs:window.fbServerTimestamp(),lastSender:myUid()}).catch(function(){});
}
// Nom affiché d'un compte : fiche d'inscription (numéro) sinon e-mail.
function dmNameForPhone(){
  var map={};
  (typeof getLicences==="function"?getLicences():[]).forEach(function(lic){
    // Les coordonnées vivent dans la fiche d'inscription (lic.fiche) ; anciens formats à plat acceptés.
    var l=Object.assign({},lic,lic&&lic.fiche||{});
    var nom=((l.prenom||"")+" "+(l.nom||"")).trim();
    var n=function(t){ return String(t||"").replace(/\s+/g,""); };
    if(l.telephone) map[n(l.telephone)]=nom;
    if(l.respTel) map[n(l.respTel)]=l.respNom||("Parent de "+(l.prenom||nom));
    if(l.resp2Tel) map[n(l.resp2Tel)]=l.resp2Nom||("Parent de "+(l.prenom||nom));
  });
  return map;
}
function dmStartPicker(){
  if(!isStaffUser()) return;
  chatEnsureUi();
  var s=document.getElementById("chat-sheet");
  s.innerHTML='<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:10px">Nouvelle discussion privée</div><div style="font-size:12px;color:var(--mut)">Chargement…</div>';
  s.style.display="block"; document.getElementById("chat-msg-overlay").style.display="block";
  var q=window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID));
  window.fbGetDocs(q).then(function(snap){
    var names=dmNameForPhone(), me=myUid(), list=[];
    snap.forEach(function(d){
      var u=d.data()||{}; if(d.id===me) return;
      var roles=u.roles||[];
      if(roles.indexOf("joueur")>=0) return;
      var label=(typeof compteNom==="function"&&compteNom(u))||names[String(u.phone||"").replace(/\s+/g,"")]||u.email||u.phone||"Compte";
      var role=roles.indexOf("dirigeant")>=0?"Dirigeant":roles.indexOf("coach")>=0?"Coach":roles.indexOf("bureau")>=0?"Bureau":"Parent";
      list.push({uid:d.id,label:label,role:role});
    });
    list.sort(function(a,b){ return a.label.localeCompare(b.label); });
    var h='<div style="font-size:15px;font-weight:800;color:var(--txt);margin-bottom:8px">Nouvelle discussion privée</div>'+
      '<input id="dm-search" placeholder="Rechercher…" style="width:100%;padding:10px 14px;border-radius:20px;border:1.5px solid var(--bdr);background:var(--bg);color:var(--txt);font-size:14px;outline:none;margin-bottom:6px">'+
      '<div id="dm-people">';
    list.forEach(function(p,i){
      h+='<button type="button" data-p="'+i+'" data-q="'+authEsc((p.label+" "+p.role).toLowerCase())+'" style="display:flex;justify-content:space-between;width:100%;text-align:left;border:0;border-bottom:1px solid var(--bdr);background:none;padding:12px 4px;min-height:44px;font-size:14px;color:var(--txt);cursor:pointer"><span>'+authEsc(p.label)+'</span><span style="font-size:11px;color:var(--mut)">'+p.role+'</span></button>';
    });
    if(!list.length) h+='<div style="font-size:12px;color:var(--mut);padding:10px 0">Aucun compte dans le club.</div>';
    h+='</div><div style="font-size:10.5px;color:var(--mut);margin-top:10px">Les comptes joueurs ne sont pas proposés : pas de discussion privée avec un mineur.</div>'+
      '<button type="button" onclick="chatCloseMenu()" style="margin-top:12px;width:100%;min-height:44px;border:0;border-radius:12px;background:var(--bdr);color:var(--txt);font-weight:800;cursor:pointer">Annuler</button>';
    s.innerHTML=h;
    document.getElementById("dm-search").addEventListener("input",function(){
      var t=this.value.trim().toLowerCase();
      s.querySelectorAll("[data-p]").forEach(function(b){ b.style.display=(!t||b.getAttribute("data-q").indexOf(t)>=0)?"flex":"none"; });
    });
    s.onclick=function(e){
      var b=e.target.closest("[data-p]"); if(!b) return;
      s.onclick=null; chatCloseMenu();
      dmOpenWith(list[parseInt(b.getAttribute("data-p"),10)]);
    };
  }).catch(function(e){ s.innerHTML='<div style="color:var(--red);font-size:13px">Erreur : '+authEsc((e&&e.code)||String(e))+'</div>'; });
}
function dmOpenWith(p){
  var me=myUid(); if(!me||!p) return;
  var id=[me,p.uid].sort().join("__");
  var existing=(window.__chatDmsCache||[]).find(function(d){return d.id===id;});
  if(existing){ openDm(existing); return; }
  var dm={memberUids:[me,p.uid],members:[{uid:me,label:myChatPseudo()},{uid:p.uid,label:p.label}],createdBy:me,createdAt:window.fbServerTimestamp(),lastMsg:"",lastTs:window.fbServerTimestamp(),lastSender:""};
  window.fbSetDoc(window.fbDoc(window.fbDb,"dms",id),dm).then(function(){
    dm.id=id; openDm(dm);
  }).catch(function(e){ askAlert("La discussion n'a pas pu être créée : "+((e&&e.code)||e)); });
}
