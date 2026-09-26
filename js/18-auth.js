/* ===== 18-auth.js — Authentification, comptes, changement d'e-mail ===== */
// ═══ AUTHENTIFICATION (comptes réels e-mail/mot de passe) ═══════════
var BOOTSTRAP_DIRIGEANT_UID = "7f2br1aTiJVWHTEbqVePbMLD0uc2"; // compte dirigeant bootstrap (console Firebase)
var BOOTSTRAP_CLUB_ID = "asmb"; // club d'origine, rattaché au compte bootstrap
var AUTH_STATE = {}; // état transitoire (numéro saisi, résultat lookup)

function authNormPhone(p){ return (p||"").trim().replace(/\s+/g,""); }

function authEsc(s){ return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

// Cherche un numéro dans les données club (localStorage pour l'instant ; Firestore plus tard)
function authLookupPhoneLocal(phone){
  var np=authNormPhone(phone);
  if(!np) return {found:false, phone:np};
  try{
    var lics=(typeof getLicences==="function")?getLicences():[];
    for(var i=0;i<lics.length;i++){
      var l=lics[i]; if(!l||!l.fiche) continue;
      var phones=[l.fiche.telephone,l.fiche.respTel,l.fiche.resp2Tel].filter(Boolean).map(function(x){return x.replace(/\s+/g,"");});
      if(phones.indexOf(np)>=0){
        var prenom=l.fiche.prenom||"", nom=l.fiche.nom||"";
        return {found:true, phone:np, role:"parent", playerName:(prenom+" "+nom).trim(), playerIds:[l.id].filter(Boolean), teamIds:[l.fiche.equipe].filter(Boolean)};
      }
    }
  }catch(e){ console.log("lookup licences:",e); }
  return {found:false, phone:np};
}

// Repli Firestore (phone_index, lecture publique) : couvre le cas d'un appareil
// qui n'a jamais eu de cache local synchronise (nouveau telephone).
function authLookupPhoneRemote(phone){
  var np=authNormPhone(phone);
  if(!window.fbDb||!window.fbGetDoc) return Promise.resolve({found:false,phone:np});
  return window.fbGetDoc(window.fbDoc(window.fbDb,"phone_index",np)).then(function(snap){
    if(snap && snap.exists()){
      var d=snap.data();
      return {found:true, phone:np, role:d.role||"parent", playerName:d.playerName||"", playerIds:d.playerIds||[], teamIds:d.teamIds||[], clubId:d.clubId||null};
    }
    return {found:false, phone:np};
  }).catch(function(){ return {found:false, phone:np}; });
}

// Multi-club : l'index Firestore fait foi (il connaît le club du numéro).
// Le cache local n'est plus utilisé ici : sur un appareil partagé, il appartient au
// dernier club consulté et pourrait rattacher un numéro au mauvais club.
function authLookupPhone(phone){
  return authLookupPhoneRemote(phone);
}

async function authContinue(){
  var inp=document.getElementById("auth-phone");
  var phone=authNormPhone(inp?inp.value:"");
  if(phone.length<6){ alert("Numéro invalide"); return; }
  AUTH_STATE.phone=phone;
  var res=await authLookupPhone(phone);
  AUTH_STATE.lookup=res;
  if(!res.found){ showAuth("unknown"); return; }
  // Pas de requête sur la collection users ici (protégée avant connexion).
  // Si un compte existe déjà, createUser renverra email-already-in-use et on renvoie vers la connexion.
  showAuth("signup",res);
}

function authLogoHtml(){
  var hl=document.getElementById("home-logo");
  if(hl && hl.innerHTML && hl.innerHTML.indexOf("img")>=0){
    return '<div style="width:64px;height:64px;border-radius:14px;overflow:hidden;background:#fff;display:flex;align-items:center;justify-content:center">'+hl.innerHTML.replace(/width="\d+"/,'width="64"').replace(/height="\d+"/,'height="64"')+'</div>';
  }
  return '<div style="width:64px;height:64px;border-radius:14px;background:rgba(255,255,255,.12);border:1.5px solid rgba(242,213,126,.5);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#F2D57E;letter-spacing:1px">ASMB</div>';
}

function authHero(title, tag){
  return '<div style="background:linear-gradient(160deg,#10203d,#1A2E5A,#10203d);padding:30px 22px 26px;text-align:center">'
    +'<div style="display:flex;justify-content:center;margin-bottom:12px">'+authLogoHtml()+'</div>'
    +'<div style="font-size:22px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:-.3px">'+authEsc(title)+'</div>'
    +'<div style="font-size:12px;font-weight:700;color:#F2D57E;margin-top:7px;text-transform:uppercase;letter-spacing:.5px">'+authEsc(tag)+'</div>'
    +'</div>';
}

var AUTH_LBL='font-size:9px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--dkg);display:block;margin:14px 2px 6px';
var AUTH_INP='width:100%;padding:14px;border:1.5px solid var(--bdr);border-radius:var(--rs);font-size:15px;background:#fff;color:var(--txt);outline:none;-webkit-appearance:none';
var AUTH_BTN='width:100%;padding:15px;border:none;border-radius:var(--rs);background:var(--grn);color:#fff;font-size:15px;font-weight:800;margin-top:22px;cursor:pointer';
var AUTH_BTN2='width:100%;padding:14px;border:1.5px solid var(--bdr);border-radius:var(--rs);background:transparent;color:var(--dkg);font-size:14px;font-weight:800;margin-top:10px;cursor:pointer';

var AUTH_EYE_OPEN='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
var AUTH_EYE_CLOSED='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-2.61 3.94M14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function authPassField(id, placeholder){
  return '<div style="position:relative">'
    +'<input id="'+id+'" type="password" style="'+AUTH_INP+';padding-right:46px" placeholder="'+authEsc(placeholder)+'">'
    +'<button type="button" class="auth-eye-btn" data-target="'+id+'" aria-label="Afficher le mot de passe" style="position:absolute;right:10px;top:0;bottom:0;margin:auto;height:36px;width:36px;border:none;background:transparent;color:var(--mut);display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0">'+AUTH_EYE_CLOSED+'</button>'
    +'</div>';
}

function authTogglePass(id, btn){
  var inp=document.getElementById(id);
  if(!inp) return;
  var show = inp.type==="password";
  inp.type = show ? "text" : "password";
  btn.innerHTML = show ? AUTH_EYE_OPEN : AUTH_EYE_CLOSED;
  btn.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
}
function authWirePassToggles(){
  document.querySelectorAll(".auth-eye-btn").forEach(function(btn){
    if(btn.dataset.wired) return;
    btn.dataset.wired="1";
    btn.addEventListener("click",function(e){
      e.preventDefault();e.stopPropagation();
      authTogglePass(btn.getAttribute("data-target"), btn);
    });
  });
}

function showAuth(step, data){
  data=data||{};
  var el=document.getElementById("auth-content");
  if(!el) return;
  stack=["auth"]; showScr("auth");
  var h="";
  if(step==="entry"){
    var savedPhone=AUTH_STATE.phone||localStorage.getItem("asmb_phone")||"";
    h=authHero("ASMB Basket","Espace du club")
      +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
      +'<p style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:6px;line-height:1.45">Saisir le numéro de téléphone pour accéder à l\'espace du club.</p>'
      +'<label style="'+AUTH_LBL+'">Téléphone</label>'
      +'<input id="auth-phone" type="tel" inputmode="tel" style="'+AUTH_INP+'" value="'+authEsc(savedPhone)+'" placeholder="06 12 34 56 78">'
      +'<button style="'+AUTH_BTN+'" onclick="authContinue()">Continuer</button>'
      +'<p style="text-align:center;font-size:13px;color:var(--grn);font-weight:800;margin-top:18px;cursor:pointer" onclick="showAuth(\'login\')">J\'ai déjà un compte</p>'
      +'<p style="text-align:center;font-size:12px;color:var(--mut);font-weight:700;margin-top:12px;cursor:pointer;text-decoration:underline" onclick="openJoueurCheckin()">Je suis joueur, pointage rapide</p>'
      +'<div style="flex:1"></div>'
      +'<p style="font-size:11px;color:var(--mut);line-height:1.5;margin-top:16px;padding:12px;background:#e8edf5;border-radius:var(--rx)">App réservée aux membres. Seuls les numéros déjà enregistrés par le club peuvent créer un compte.</p>'
      +'</div>';
  } else if(step==="signup"){
    var chips="";
    if(data.playerName){ chips='<div style="margin-top:10px"><span style="font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;background:rgba(212,175,55,.12);color:var(--dkg);border:1px solid rgba(212,175,55,.3)">'+authEsc(data.playerName)+'</span></div>'; }
    h=authHero("Bienvenue","Numéro reconnu")
      +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
      +'<p style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:4px">Ce numéro est rattaché au club.</p>'
      +chips
      +'<label style="'+AUTH_LBL+'">E-mail (pour la connexion)</label>'
      +'<input id="auth-email" type="email" inputmode="email" autocapitalize="off" style="'+AUTH_INP+'" placeholder="prenom@email.fr">'
      +'<label style="'+AUTH_LBL+'">Mot de passe (6 caractères min.)</label>'
      +authPassField("auth-pass","••••••••")
      +'<div id="auth-err" style="display:none;color:var(--red);font-size:12px;font-weight:600;margin-top:12px;text-align:center"></div>'
      +'<button style="'+AUTH_BTN+'" onclick="authDoSignup()">Créer le compte</button>'
      +'<button style="'+AUTH_BTN2+'" onclick="showAuth(\'entry\')">Retour</button>'
      +'</div>';
  } else if(step==="login"){
    var savedEmail=data.email||localStorage.getItem("asmb_last_email")||"";
    h=authHero("Connexion","Espace du club")
      +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
      +'<label style="'+AUTH_LBL+'">E-mail</label>'
      +'<input id="auth-email" type="email" inputmode="email" autocapitalize="off" style="'+AUTH_INP+'" value="'+authEsc(savedEmail)+'" placeholder="prenom@email.fr">'
      +'<label style="'+AUTH_LBL+'">Mot de passe</label>'
      +authPassField("auth-pass","••••••••")
      +'<div id="auth-err" style="display:none;color:var(--red);font-size:12px;font-weight:600;margin-top:12px;text-align:center"></div>'
      +'<button style="'+AUTH_BTN+'" onclick="authDoLogin()">Se connecter</button>'
      +'<p style="text-align:center;font-size:13px;color:var(--grn);font-weight:800;margin-top:16px;cursor:pointer" onclick="showAuth(\'reset\')">Mot de passe oublié ?</p>'
      +'<button style="'+AUTH_BTN2+'" onclick="showAuth(\'entry\')">Retour</button>'
      +'</div>';
  } else if(step==="unknown"){
    h=authHero("Numéro inconnu","Pas enregistré au club")
      +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
      +'<div style="background:rgba(192,57,43,.1);color:var(--red);font-size:13px;font-weight:600;padding:14px;border-radius:var(--rs);text-align:center;line-height:1.45">Ce numéro n\'est pas reconnu. Se rapprocher du club pour l\'ajouter, puis réessayer.</div>'
      +'<button style="'+AUTH_BTN2+'" onclick="showAuth(\'entry\')">Réessayer avec un autre numéro</button>'
      +'</div>';
  } else if(step==="reset"){
    h=authHero("Réinitialiser","Nouveau mot de passe")
      +'<div style="padding:22px 18px 26px;display:flex;flex-direction:column;flex:1">'
      +'<p style="font-size:13px;color:var(--txt2);text-align:center;margin-bottom:4px;line-height:1.45">Saisir l\'e-mail : un lien de réinitialisation sera envoyé.</p>'
      +'<label style="'+AUTH_LBL+'">E-mail</label>'
      +'<input id="auth-email" type="email" inputmode="email" autocapitalize="off" style="'+AUTH_INP+'" placeholder="prenom@email.fr">'
      +'<div id="auth-err" style="display:none;color:var(--red);font-size:12px;font-weight:600;margin-top:12px;text-align:center"></div>'
      +'<button style="'+AUTH_BTN+'" onclick="authDoReset()">Envoyer le lien</button>'
      +'<button style="'+AUTH_BTN2+'" onclick="showAuth(\'login\')">Retour</button>'
      +'</div>';
  }
  el.innerHTML=h;
  authWirePassToggles();
}

function authErr(msg){
  var e=document.getElementById("auth-err");
  if(e){ e.textContent=msg; e.style.display="block"; }
  else alert(msg);
}


function authDoSignup(){
  var email=(document.getElementById("auth-email")||{}).value||"";
  var pass=(document.getElementById("auth-pass")||{}).value||"";
  email=email.trim();
  if(email.indexOf("@")<1){ authErr("E-mail invalide"); return; }
  if(pass.length<6){ authErr("Mot de passe : 6 caractères minimum"); return; }
  var res=AUTH_STATE.lookup||{};
  if(!res.clubId){ authErr("Ce numéro n'est rattaché à aucun club. Se rapprocher du club."); return; }
  window.fbCreateUser(window.fbAuth, email, pass).then(function(cred){
    var uid=cred.user.uid;
    return window.fbSetDoc(window.fbDoc(window.fbDb,"users",uid), {
      phone: AUTH_STATE.phone||"",
      email: email,
      roles: ["parent"],
      clubId: res.clubId||null, // club du licencié, fourni par l'index téléphone
      linkedPlayerIds: res.playerIds||[],
      linkedTeamIds: res.teamIds||[],
      createdAt: window.fbServerTimestamp()
    });
  }).catch(function(e){
    var c=e&&e.code||"";
    if(c==="auth/email-already-in-use") authErr("Cet e-mail a déjà un compte. Utiliser « J'ai déjà un compte ».");
    else if(c==="auth/weak-password") authErr("Mot de passe trop faible (6 caractères min.)");
    else if(c==="auth/invalid-email") authErr("E-mail invalide");
    else authErr("Erreur : "+(c||e.message||"inconnue"));
  });
  // la suite (routage) est gérée par onAuthStateChanged
}

function authDoLogin(){
  var email=((document.getElementById("auth-email")||{}).value||"").trim();
  var pass=(document.getElementById("auth-pass")||{}).value||"";
  if(email.indexOf("@")<1){ authErr("E-mail invalide"); return; }
  if(!pass){ authErr("Mot de passe requis"); return; }
  window.fbSignIn(window.fbAuth, email, pass).catch(function(e){
    var c=e&&e.code||"";
    if(c==="auth/invalid-credential"||c==="auth/wrong-password"||c==="auth/user-not-found") authErr("E-mail ou mot de passe incorrect");
    else if(c==="auth/too-many-requests") authErr("Trop de tentatives. Réessayer plus tard.");
    else authErr("Erreur : "+(c||e.message||"inconnue"));
  });
}

function authDoReset(){
  var email=((document.getElementById("auth-email")||{}).value||"").trim();
  if(email.indexOf("@")<1){ authErr("E-mail invalide"); return; }
  window.fbSendReset(window.fbAuth, email).then(function(){
    var el=document.getElementById("auth-content");
    if(el) el.innerHTML=authHero("Lien envoyé","Vérifier la boîte mail")
      +'<div style="padding:24px 20px;text-align:center"><p style="font-size:14px;color:var(--txt2);line-height:1.5">Un e-mail de réinitialisation vient d\'être envoyé à<br><b>'+authEsc(email)+'</b></p>'
      +'<button style="'+AUTH_BTN2+'" onclick="showAuth(\'login\')">Retour à la connexion</button></div>';
  }).catch(function(e){
    var c=e&&e.code||"";
    if(c==="auth/user-not-found") authErr("Aucun compte pour cet e-mail");
    else authErr("Erreur : "+(c||e.message||"inconnue"));
  });
}

// ── CHANGER L'E-MAIL DE CONNEXION (par la personne elle-meme) ──────
// Firebase exige une reconnexion recente (mot de passe actuel) pour ce type
// d'operation sensible : impossible de le faire "a la place de" quelqu'un.
function openChangeEmailModal(){
  var user=window.fbAuth&&window.fbAuth.currentUser;
  if(!user){alert("Vous devez être connecté.");return;}
  var modal=document.createElement("div");
  modal.className="change-email-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div");
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:85vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  inner.innerHTML=
    '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'+
      '<div style="font-size:15px;font-weight:800;color:var(--txt)">Changer mon e-mail de connexion</div>'+
      '<button id="ce-close-btn" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button>'+
    '</div>'+
    '<div style="font-size:11px;color:var(--mut);margin-bottom:16px;line-height:1.4">Actuellement : <b>'+authEsc(user.email||"")+'</b><br>Pour des raisons de sécurité, votre mot de passe actuel est requis.</div>'+
    '<label style="'+AUTH_LBL+'">Nouvel e-mail</label>'+
    '<input id="ce-new-email" type="email" inputmode="email" autocapitalize="off" style="'+AUTH_INP+'" placeholder="nouveau@email.fr">'+
    '<label style="'+AUTH_LBL+'">Mot de passe actuel</label>'+
    '<div id="ce-pass-wrap"></div>'+
    '<div id="ce-err" style="display:none;color:var(--red);font-size:12px;font-weight:600;margin-top:12px;text-align:center"></div>'+
    '<button id="ce-submit-btn" style="'+AUTH_BTN+'">Changer mon e-mail</button>';
  modal.appendChild(inner);
  modal.addEventListener("click",function(){modal.remove();});
  document.body.appendChild(modal);
  document.getElementById("ce-pass-wrap").innerHTML=authPassField("ce-password","••••••••");
  authWirePassToggles();
  document.getElementById("ce-close-btn").addEventListener("click",function(){modal.remove();});
  document.getElementById("ce-submit-btn").addEventListener("click",function(){ submitChangeEmail(modal); });
}
function submitChangeEmail(modal){
  var user=window.fbAuth&&window.fbAuth.currentUser;
  var newEmail=(document.getElementById("ce-new-email")||{}).value||"";
  var pass=(document.getElementById("ce-password")||{}).value||"";
  var errEl=document.getElementById("ce-err");
  function showErr(msg){ if(errEl){errEl.textContent=msg;errEl.style.display="block";} }
  newEmail=newEmail.trim();
  if(newEmail.indexOf("@")<1){ showErr("E-mail invalide"); return; }
  if(!pass){ showErr("Mot de passe requis"); return; }
  var btn=document.getElementById("ce-submit-btn");
  if(btn){ btn.disabled=true; btn.textContent="Vérification..."; }
  var cred=window.fbEmailAuthProvider.credential(user.email, pass);
  window.fbReauth(user, cred).then(function(){
    return window.fbUpdateEmail(user, newEmail);
  }).then(function(){
    // Garde Firestore et la session locale synchronisees avec le nouvel email
    if(window.fbDb && window.fbSetDoc){
      window.fbSetDoc(window.fbDoc(window.fbDb,"users",user.uid), {email:newEmail}, {merge:true}).catch(function(){});
    }
    if(window.ASMB_USER) window.ASMB_USER.email=newEmail;
    localStorage.setItem("asmb_last_email", newEmail);
    modal.remove();
    askAlert("E-mail de connexion mis à jour : "+newEmail);
    if(document.getElementById("scr-parametres")) buildParametres();
  }).catch(function(e){
    var c=e&&e.code||"";
    if(btn){ btn.disabled=false; btn.textContent="Changer mon e-mail"; }
    if(c==="auth/wrong-password"||c==="auth/invalid-credential") showErr("Mot de passe incorrect");
    else if(c==="auth/email-already-in-use") showErr("Cet e-mail est déjà utilisé par un autre compte");
    else if(c==="auth/invalid-email") showErr("E-mail invalide");
    else if(c==="auth/requires-recent-login") showErr("Reconnexion nécessaire : déconnectez-vous puis reconnectez-vous et réessayez");
    else showErr("Erreur : "+(c||e.message||"inconnue"));
  });
}

function authLogout(){
  window.fbSignOut(window.fbAuth).then(function(){
    localStorage.removeItem("asmb_profile");
    try{ location.reload(); }catch(e){ showAuth("entry"); }
  });
}

// ═══ MULTI-CLUB : club actif de l'utilisateur ═══════════════════════
// Préférences propres à l'APPAREIL, conservées quand le club change.
// Tout le reste (clés "asmb_*") est considéré comme donnée de club et purgé,
// pour qu'aucune donnée en cache d'un club ne puisse être renvoyée dans un autre.
var DEVICE_PREF_PREFIXES = ["asmb_theme","asmb_notif","asmb_last_email","asmb_pwa_hint",
  "asmb_tuto_done","asmb_tip_","asmb_params_","asmb_admin_module_","asmb_joueur_phone",
  "asmb_phone","asmb_pseudo","gm_"];

function purgeClubLocalData(){
  var toRemove=[];
  for(var i=0;i<localStorage.length;i++){
    var k=localStorage.key(i);
    if(!k || k.indexOf("asmb_")!==0) continue;
    var keep=DEVICE_PREF_PREFIXES.some(function(p){ return k.indexOf(p)===0; });
    if(!keep) toRemove.push(k);
  }
  toRemove.forEach(function(k){ localStorage.removeItem(k); });
  return toRemove.length;
}

// File d'attente : tâches à lancer dès qu'un club est actif (minuteries de démarrage).
var __clubReadyQueue=[];
function whenClubReady(fn){
  if(window.CURRENT_CLUB_ID){ try{ fn(); }catch(e){ console.log("whenClubReady:",e); } }
  else __clubReadyQueue.push(fn);
}

function setActiveClub(clubId){
  var prev=localStorage.getItem("gm_active_club");
  // Purge aussi quand aucun club n'était mémorisé (premier passage en multi-club) :
  // le cache éventuel date d'avant le cloisonnement et n'est rattaché à aucun club.
  if(prev!==clubId){
    var n=purgeClubLocalData();
    if(n) console.log("Cache local purgé ("+n+" clés) : changement de club");
  }
  localStorage.setItem("gm_active_club", clubId);
  window.CURRENT_CLUB_ID=clubId;
  loadClubProfile(clubId);
  var q=__clubReadyQueue; __clubReadyQueue=[];
  q.forEach(function(fn){ try{ fn(); }catch(e){ console.log("clubReady task:",e); } });
}

// Charge la fiche du club (nom, sport, couleurs...) et crée ses canaux par défaut.
function loadClubProfile(clubId){
  if(!window.fbGetDoc) return;
  window.fbGetDoc(window.fbDoc(window.fbDb,"clubs",clubId)).then(function(snap){
    if(snap && snap.exists()){
      window.CURRENT_CLUB=Object.assign({id:clubId}, snap.data());
      if(snap.data().status==="suspended" && !window.SUPPORT_MODE && !isSuperAdmin()){
        alert("L'accès de votre club à General Manager est suspendu. Contactez General Manager.");
        window.fbSignOut(window.fbAuth); showAuth("entry");
        return;
      }
    } else if(window.ASMB_USER && window.ASMB_USER.uid===BOOTSTRAP_DIRIGEANT_UID && clubId===BOOTSTRAP_CLUB_ID){
      // Premier démarrage multi-club : création de la fiche du club d'origine
      var club={ name:"ASMB Basket", sport:"basket", ownerUid:BOOTSTRAP_DIRIGEANT_UID,
                 status:"active", createdAt:window.fbServerTimestamp() };
      window.fbSetDoc(window.fbDoc(window.fbDb,"clubs",clubId), club).catch(function(e){ console.log("création club:",e&&e.code); });
      window.CURRENT_CLUB=Object.assign({id:clubId}, club);
    }
    var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
    if(roles.indexOf("dirigeant")>=0 && window.fbInitClubChannels && !window.SUPPORT_MODE){ window.fbInitClubChannels(clubId); }
  }).catch(function(e){ console.log("loadClubProfile:", e&&e.code||e); });
}

// Applique l'utilisateur authentifié : lit users/{uid}, amorce le dirigeant si besoin, puis route
function applyAuthedUser(user){
  // Indice local (non securitaire) pour le tout prochain chargement de page :
  // evite d'afficher le portail d'un club au premier rendu pour ce compte,
  // voir le tout debut de js/21-main.js.
  try{ localStorage.setItem("gm_is_su", (user.uid===BOOTSTRAP_DIRIGEANT_UID)?"1":"0"); }catch(e){}
  if(window.__userDocUnsub){ try{window.__userDocUnsub();}catch(e){} }
  var firstLoad=true;
  var rattachementTente=false; // garde-fou : un seul essai par session, jamais de boucle si le serveur refuse
  window.__userDocUnsub = window.fbOnSnapshot(window.fbDoc(window.fbDb,"users",user.uid), function(snap){
    if(snap && snap.exists()){
      var data=snap.data();
      // Compte d'origine créé avant le multi-club : rattachement au club d'origine
      if(!data.clubId && user.uid===BOOTSTRAP_DIRIGEANT_UID && !rattachementTente){
        rattachementTente=true;
        window.fbUpdateDoc(window.fbDoc(window.fbDb,"users",user.uid),{clubId:BOOTSTRAP_CLUB_ID})
          .catch(function(e){ console.log("rattachement club:",e&&e.code); });
        data=Object.assign({},data,{clubId:BOOTSTRAP_CLUB_ID});
      }
      finishAuthedUser(user, data, !firstLoad);
      firstLoad=false;
    } else if(firstLoad && user.uid===BOOTSTRAP_DIRIGEANT_UID && BOOTSTRAP_DIRIGEANT_UID){
      var seed={ phone:"", email:user.email||"", roles:["dirigeant"], clubId:BOOTSTRAP_CLUB_ID, linkedPlayerIds:[], linkedTeamIds:[], createdAt:window.fbServerTimestamp() };
      window.fbSetDoc(window.fbDoc(window.fbDb,"users",user.uid), seed).then(function(){ finishAuthedUser(user, seed); firstLoad=false; });
    } else if(firstLoad){
      alert("Compte non rattaché à un club. Contacter un dirigeant.");
      window.fbSignOut(window.fbAuth);
      showAuth("entry");
    }
  }, function(err){
    console.log("applyAuthedUser:",err);
    if(firstLoad){ alert("Erreur de connexion aux données. Réessayer."); firstLoad=false; }
  });
}

function finishAuthedUser(user, u, isUpdate){
  if(!u.clubId){
    alert("Compte non rattaché à un club. Contacter un dirigeant.");
    window.fbSignOut(window.fbAuth);
    showAuth("entry");
    return;
  }
  var roles=u.roles||[];
  var profile = roles.indexOf("dirigeant")>=0 ? "dirigeant"
              : roles.indexOf("coach")>=0 ? "coach"
              : roles.indexOf("parent")>=0 ? "parent"
              : "parent";
  var previousProfile=localStorage.getItem("asmb_profile");
  window.ASMB_USER = { uid:user.uid, email:u.email||user.email||"", phone:u.phone||"", roles:roles, clubId:u.clubId, linkedPlayerIds:u.linkedPlayerIds||[], linkedTeamIds:u.linkedTeamIds||[] };
  // Mode support : le super admin consulte un club qui lui a donné un code d'accès
  var activeClub=u.clubId;
  var sup=(typeof getSupportSession==="function")?getSupportSession():null;
  if(sup && sup.clubId && user.uid===BOOTSTRAP_DIRIGEANT_UID){ activeClub=sup.clubId; window.SUPPORT_MODE=sup; }
  // Club actif AVANT tout accès aux données (routage, synchro Firestore)
  if(!isUpdate || window.CURRENT_CLUB_ID!==activeClub){ setActiveClub(activeClub); }
  if(window.SUPPORT_MODE){ applySupportModeUI(window.SUPPORT_MODE); }
  localStorage.setItem("asmb_profile", profile);
  if(window.ASMB_USER.email){ localStorage.setItem("asmb_last_email", window.ASMB_USER.email); }
  if(u.phone){ myPhone=u.phone; localStorage.setItem("asmb_phone", u.phone); }
  if(profile==="parent" && (u.linkedTeamIds||[]).length){
    localStorage.setItem("asmb_parent_teams", JSON.stringify(u.linkedTeamIds));
  }
  if(roles.indexOf("coach")>=0 && (u.linkedTeamIds||[]).length){
    localStorage.setItem("asmb_coach_teams", JSON.stringify(u.linkedTeamIds));
    if(u.linkedTeamIds.indexOf(getCoachTeam())<0){ localStorage.setItem("asmb_coach_team", u.linkedTeamIds[0]); }
  }
  // Super admin : l'accueil est la Plateforme (clubs), jamais le portail d'un
  // club — décidé AVANT tout routage, pour ne jamais afficher le portail (même
  // une fraction de seconde) puis le remplacer. Ne concerne QUE ce compte (ou
  // ?plateforme, diagnostic) : tout dirigeant/coach/parent d'un club normal
  // continue de passer par initProfile() ci-dessous, sans aucun changement.
  var forcePf=false;
  try{ forcePf=new URLSearchParams(window.location.search).has("plateforme"); }catch(e){}
  var onPf=(typeof stack!=="undefined" && stack.length && stack[stack.length-1]==="plateforme");
  var wantsPlateforme = !window.SUPPORT_MODE && typeof showPlateformeHome==="function"
     && (isSuperAdmin() || forcePf) && (!isUpdate || forcePf || onPf);

  if(wantsPlateforme){
    showPlateformeHome({force:forcePf});
  } else if(!isUpdate || profile!==previousProfile){
    initProfile(); // routage existant, inchangé (au login, ou si le rôle actif change)
    applySeasonLabels();
  } else {
    refreshCurrentScreen(); // mise à jour silencieuse (ex: nouvelle équipe assignée), sans changer d'écran
  }
  initFirestoreSync(); // Step 3 : lecture/écriture live Firestore
  try{
    var btn=document.getElementById("hdr-profile-btn");
    if(btn) btn.style.display=(roles.length>1)?"flex":"none";
    var setBtn=document.getElementById("hdr-settings-btn");
    if(setBtn) setBtn.style.display=(profile==="dirigeant")?"none":"flex";
    // Retour à la plateforme, accessible depuis n'importe quel écran
    var gmb=document.getElementById("hdr-gm-btn");
    if(gmb) gmb.style.display=(isSuperAdmin() && !window.SUPPORT_MODE)?"flex":"none";
  }catch(e){}
}

// Gate au démarrage : remplace l'appel direct à initProfile
function initAuthGate(){
  var urlParams=new URLSearchParams(window.location.search);
  if(urlParams.has("inscription")){ initProfile(); return; } // inscription publique : pas d'auth
  if(urlParams.has("invite")){ showInviteScreen(urlParams.get("invite")); return; } // invitation staff
  if(!window.fbAuthReady || !window.fbAuth){
    // Firebase pas prêt : on retente brièvement, sinon fallback ancien comportement
    if(!window.__authWait){ window.__authWait=0; }
    if(window.__authWait++ < 40){ setTimeout(initAuthGate,100); return; }
    initProfile(); return;
  }
  window.fbOnAuthState(window.fbAuth, function(user){
    if(user){ applyAuthedUser(user); }
    else { showAuth("entry"); }
  });
}


