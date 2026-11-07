// ── Double authentification (application d'authentification, TOTP) ─────────────────────────────
// Activée par la personne elle-même (Paramètres › « Double authentification ») : QR code ou clé à copier dans
// Google Authenticator / Microsoft Authenticator…, puis code à 6 chiffres. Ensuite, chaque connexion demande ce code
// (window.fbSignIn de js/firebase-init.js appelle gmMfaResoudre). Codes de secours : créés par la fonction serveur
// `securite` (empreintes dans `mfa_secours/{uid}`, serveur seul) ; un code de secours retire la double
// authentification du compte, que la personne réactive ensuite. Le super admin peut aussi la retirer (Plateforme).
// Jamais par SMS (payant à l'envoi). Firebase exige un e-mail vérifié pour l'activer.
var SECU_URL="https://europe-west1-asmb-app.cloudfunctions.net/securite";

function mfaFacteurs(){
  var u=window.fbAuth&&window.fbAuth.currentUser;
  if(!u||!window.fbMultiFactor) return [];
  try{ return window.fbMultiFactor(u).enrolledFactors||[]; }catch(e){ return []; }
}
function mfaActive(){ return mfaFacteurs().length>0; }
function mfaAppel(corps,avecJeton){
  var cu=window.fbAuth&&window.fbAuth.currentUser;
  var jeton=(avecJeton&&cu)?cu.getIdToken(true):Promise.resolve("");
  return jeton.then(function(j){
    var h={"Content-Type":"application/json"}; if(j) h.Authorization="Bearer "+j;
    return fetch(SECU_URL,{method:"POST",headers:h,body:JSON.stringify(corps)});
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(d){ if(!r.ok||!d.ok) throw {code:d.erreur||("http-"+r.status)}; return d; });
  });
}
function mfaMessage(e){
  var c=(e&&e.code)||"";
  var m={
    "auth/invalid-verification-code":"Code incorrect. Vérifiez l'heure de votre téléphone et réessayez.",
    "auth/missing-code":"Saisissez le code à 6 chiffres.",
    "auth/wrong-password":"Mot de passe incorrect.","auth/invalid-credential":"Mot de passe incorrect.",
    "auth/too-many-requests":"Trop de tentatives. Réessayez dans quelques minutes.",
    "auth/code-expired":"Délai dépassé : recommencez.",
    "code":"Code de secours incorrect ou déjà utilisé.",
    "trop":"Trop de tentatives. Réessayez dans une heure.",
    "connexion":"E-mail ou mot de passe incorrect.",
    "compte":"Aucun compte trouvé pour cet e-mail.",
    "interdit":"Action réservée au gestionnaire de la plateforme."
  };
  return m[c]||("Erreur : "+(c||(e&&e.message)||"inconnue"));
}
function mfaChamp(parent,label,opts){
  opts=opts||{};
  var l=document.createElement("label"); l.className="form-label"; l.textContent=label; parent.appendChild(l);
  var i=document.createElement("input"); i.className="form-input"; i.type=opts.type||"text";
  if(opts.code){ i.inputMode="numeric"; i.autocomplete="one-time-code"; i.maxLength=6; i.placeholder="123456"; i.style.cssText="font-size:22px;letter-spacing:6px;text-align:center;font-variant-numeric:tabular-nums"; }
  if(opts.placeholder) i.placeholder=opts.placeholder;
  i.style.marginBottom="10px"; parent.appendChild(i); return i;
}
function mfaErreur(parent){
  var d=document.createElement("div"); d.style.cssText="display:none;color:var(--red);font-size:12.5px;font-weight:700;margin:4px 0 10px;line-height:1.4"; parent.appendChild(d);
  return function(t){ d.textContent=t||""; d.style.display=t?"block":"none"; };
}
function mfaTexte(parent,t,style){ var d=document.createElement("div"); d.style.cssText="font-size:13px;color:var(--txt2);line-height:1.5;margin-bottom:12px;"+(style||""); d.textContent=t; parent.appendChild(d); return d; }

// Écran « Double authentification » (Paramètres, tous les profils)
function mfaOuvrir(){
  if(window.GM_DEMO){ showToast("Pas disponible en démo"); return; }
  var u=window.fbAuth&&window.fbAuth.currentUser; if(!u){ askAlert("Vous devez être connecté."); return; }
  var s=gmSheet("Double authentification");
  var actif=mfaActive();
  var etat=document.createElement("div");
  etat.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--card);border:1px solid var(--bdr);border-radius:12px;padding:12px;margin-bottom:12px";
  etat.innerHTML='<div><div style="font-size:14px;font-weight:800;color:var(--txt)">Application d\'authentification</div><div style="font-size:12px;color:var(--mut)">'+(actif?"Un code est demandé à chaque connexion":"Désactivée")+'</div></div>'
    +'<span style="font-size:11px;font-weight:800;border-radius:20px;padding:3px 10px;'+(actif?'background:rgba(31,138,76,.14);color:#1F8A4C">Active':'background:var(--bdr);color:var(--mut)">Désactivée')+'</span>';
  s.body.appendChild(etat);
  if(!actif){
    var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
    mfaTexte(s.body,"Après votre mot de passe, l'appli demandera un code à 6 chiffres donné par une application d'authentification (Google Authenticator, Microsoft Authenticator…).");
    if(roles.indexOf("dirigeant")>=0) mfaTexte(s.body,"Recommandé pour les dirigeants : votre compte ouvre toutes les données du club.","font-weight:700;color:var(--txt)");
    s.body.appendChild(gmBtn("Activer","primary",function(){ s.modal.remove(); mfaActiver(); }));
  } else {
    mfaTexte(s.body,"Vous avez perdu vos codes de secours ? Créez-en de nouveaux : les anciens ne marcheront plus.");
    gmRow(s.body).appendChild(gmBtn("Nouveaux codes de secours","soft",function(){ s.modal.remove(); mfaCodesSecours(); }));
    gmRow(s.body).appendChild(gmBtn("Désactiver","ghost",function(){ s.modal.remove(); mfaDesactiver(); }));
  }
}

// Mot de passe demandé avant d'activer / désactiver (Firebase exige une connexion récente).
function mfaMotDePasse(titre,suite){
  var u=window.fbAuth.currentUser;
  var s=gmSheet(titre);
  mfaTexte(s.body,"Pour votre sécurité, confirmez votre mot de passe.");
  var l=document.createElement("label"); l.className="form-label"; l.textContent="Mot de passe"; s.body.appendChild(l);
  var w=document.createElement("div"); w.style.marginBottom="10px"; w.innerHTML=authPassField("mfa-mdp","••••••••"); s.body.appendChild(w);
  authWirePassToggles();
  var p=document.getElementById("mfa-mdp");
  p.addEventListener("keydown",function(e){ if(e.key==="Enter") b.click(); });
  var err=mfaErreur(s.body);
  var b=gmBtn("Continuer","primary",function(){
    if(!p.value){ err("Mot de passe requis."); return; }
    b.disabled=true; err("");
    window.fbReauth(u,window.fbEmailAuthProvider.credential(u.email,p.value)).then(function(){ s.modal.remove(); suite(); })
      .catch(function(e){ b.disabled=false; err(mfaMessage(e)); });
  });
  s.body.appendChild(b);
  setTimeout(function(){ try{ p.focus(); }catch(e){} },50);
}

function mfaActiver(){
  var u=window.fbAuth.currentUser;
  if(!u.emailVerified){ mfaVerifierEmail(); return; }
  mfaMotDePasse("Activer la double authentification",function(){
    var mf=window.fbMultiFactor(u);
    mf.getSession().then(function(sess){ return window.fbTotp.generateSecret(sess); }).then(function(secret){
      var url=secret.generateQrCodeUrl(u.email||"compte","General Manager");
      var s=gmSheet("Activer la double authentification");
      mfaTexte(s.body,"1. Sur ordinateur : scannez ce QR code avec l'application d'authentification de votre téléphone. Sur le téléphone : touchez « Ouvrir l'application » ou copiez la clé.");
      var qr=document.createElement("div"); qr.style.cssText="display:flex;justify-content:center;background:#fff;border-radius:12px;padding:12px;margin:0 auto 10px;width:max-content"; s.body.appendChild(qr);
      if(typeof QRCode!=="undefined"){ try{ new QRCode(qr,{text:url,width:180,height:180,colorDark:"#0b1630",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(e){ qr.remove(); } } else qr.remove();
      var cle=document.createElement("div"); cle.setAttribute("data-notr","");
      cle.style.cssText="font-family:ui-monospace,Menlo,monospace;font-size:13px;word-break:break-all;text-align:center;background:var(--card);border:1px solid var(--bdr);border-radius:10px;padding:9px;margin-bottom:8px;user-select:all";
      cle.textContent=String(secret.secretKey||"").replace(/(.{4})/g,"$1 ").trim(); s.body.appendChild(cle);
      var r=gmRow(s.body);
      r.appendChild(gmBtn("Copier la clé","soft",function(){
        var t=secret.secretKey||"";
        if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(function(){ showToast("Clé copiée"); }).catch(function(){ showToast("Sélectionnez la clé pour la copier"); });
      }));
      r.appendChild(gmBtn("Ouvrir l'application","ghost",function(){ location.href=url; }));
      mfaTexte(s.body,"2. Saisissez le code à 6 chiffres affiché par l'application.","margin-top:6px");
      var c=mfaChamp(s.body,"Code",{code:true});
      var err=mfaErreur(s.body);
      var b=gmBtn("Confirmer","primary",function(){
        var v=String(c.value||"").replace(/\D/g,"");
        if(v.length!==6){ err("Saisissez le code à 6 chiffres."); return; }
        b.disabled=true; err("");
        var a=window.fbTotp.assertionForEnrollment(secret,v);
        mf.enroll(a,"Application d'authentification").then(function(){
          s.modal.remove(); showToast("Double authentification activée");
          mfaCodesSecours(true);
        }).catch(function(e){ b.disabled=false; err(mfaMessage(e)); });
      });
      s.body.appendChild(b);
    }).catch(function(e){
      if(e&&e.code==="auth/unverified-email"){ mfaVerifierEmail(); return; }
      askAlert(mfaMessage(e));
    });
  });
}
// Firebase n'active la double authentification que sur un e-mail vérifié.
function mfaVerifierEmail(){
  var u=window.fbAuth.currentUser;
  var s=gmSheet("Vérifiez d'abord votre e-mail");
  mfaTexte(s.body,"La double authentification demande une adresse e-mail vérifiée. Nous envoyons un lien à votre adresse : ouvrez-le, puis revenez ici et touchez « C'est fait ».");
  mfaTexte(s.body,u.email||"","font-weight:800;color:var(--txt)").setAttribute("data-notr","");
  var b=gmBtn("Envoyer le lien","primary",function(){
    b.disabled=true;
    window.fbSendVerification(u).then(function(){ showToast("Lien envoyé"); b.textContent="Lien envoyé"; })
      .catch(function(e){ b.disabled=false; askAlert(mfaMessage(e)); });
  });
  s.body.appendChild(b);
  var r=gmRow(s.body);
  r.appendChild(gmBtn("C'est fait","soft",function(){
    u.reload().then(function(){
      if(window.fbAuth.currentUser.emailVerified){ s.modal.remove(); mfaActiver(); }
      else showToast("Pas encore vérifié : ouvrez le lien reçu par e-mail");
    }).catch(function(){ showToast("Réessayez dans un instant"); });
  }));
}
function mfaCodesSecours(apresActivation){
  var s=gmSheet("Codes de secours");
  var info=mfaTexte(s.body,"Création des codes…");
  mfaAppel({action:"codes"},true).then(function(d){
    if(apresActivation) s.body.insertBefore(mfaTexte(s.body,"Double authentification activée","font-weight:800;color:#1F8A4C"),info);
    info.textContent="Gardez ces codes ailleurs que sur ce téléphone (papier, autre appareil). Chacun sert une seule fois si vous n'avez plus votre téléphone : il retire la double authentification, que vous réactivez ensuite.";
    var g=document.createElement("div"); g.setAttribute("data-notr","");
    g.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-family:ui-monospace,Menlo,monospace;font-size:14px;margin-bottom:12px";
    (d.codes||[]).forEach(function(c){ var x=document.createElement("div"); x.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:8px;padding:8px;text-align:center"; x.textContent=c; g.appendChild(x); });
    s.body.appendChild(g);
    var txt=(d.codes||[]).join("\n");
    gmRow(s.body).appendChild(gmBtn("Copier les codes","soft",function(){
      if(navigator.clipboard&&navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function(){ showToast("Codes copiés"); }).catch(function(){ showToast("Sélectionnez les codes pour les copier"); });
    }));
    s.body.appendChild(gmBtn("C'est noté","primary",function(){ s.modal.remove(); }));
  }).catch(function(e){ info.textContent="Codes de secours non créés. Réessayez depuis Paramètres › Double authentification."; console.warn("mfa codes",e); });
}
function mfaDesactiver(){
  askConfirm("Votre compte ne sera plus protégé que par votre mot de passe.",{title:"Désactiver la double authentification ?",confirmText:"Désactiver",danger:true}).then(function(ok){
    if(!ok) return;
    mfaMotDePasse("Désactiver la double authentification",function(){
      var u=window.fbAuth.currentUser, mf=window.fbMultiFactor(u);
      var f=(mf.enrolledFactors||[])[0]; if(!f){ showToast("Déjà désactivée"); return; }
      mf.unenroll(f).then(function(){ showToast("Double authentification désactivée"); mfaAppel({action:"oublier"},true).catch(function(){}); })
        .catch(function(e){ askAlert(mfaMessage(e)); });
    });
  });
}

// Connexion : le mot de passe est bon, l'appli demande le code (appelé par window.fbSignIn / fbReauth).
// Renvoie la même chose que signInWithEmailAndPassword (UserCredential), ou une erreur si la personne abandonne.
function gmMfaResoudre(resolver,fini){
  fini=fini||{};
  return new Promise(function(ok,ko){
    var hint=(resolver.hints||[]).filter(function(h){ return h.factorId===(window.fbTotp&&window.fbTotp.FACTOR_ID||"totp"); })[0]||(resolver.hints||[])[0];
    var termine=false;
    var s=gmSheet("Code de vérification"); s.modal.style.zIndex="600";
    var veille=setInterval(function(){ if(!document.body.contains(s.modal)){ clearInterval(veille); if(!termine){ termine=true; ko({code:"auth/mfa-annule"}); } } },400);
    function fin(v){ termine=true; clearInterval(veille); s.modal.remove(); ok(v); }
    mfaTexte(s.body,"Ouvrez votre application d'authentification et saisissez le code à 6 chiffres de « General Manager ».");
    var c=mfaChamp(s.body,"Code",{code:true});
    var err=mfaErreur(s.body);
    var b=gmBtn("Valider","primary",function(){
      var v=String(c.value||"").replace(/\D/g,"");
      if(v.length!==6){ err("Saisissez le code à 6 chiffres."); return; }
      if(!hint||!window.fbTotp){ err("Aucune méthode de vérification trouvée."); return; }
      b.disabled=true; err("");
      resolver.resolveSignIn(window.fbTotp.assertionForSignIn(hint.uid,v)).then(fin).catch(function(e){ b.disabled=false; err(mfaMessage(e)); });
    });
    s.body.appendChild(b);
    c.addEventListener("keydown",function(e){ if(e.key==="Enter") b.click(); });
    if(fini.email&&fini.pass){
      var lien=document.createElement("button"); lien.type="button";
      lien.style.cssText="width:100%;margin-top:10px;background:none;border:none;color:var(--dkg);font:inherit;font-size:13px;font-weight:700;cursor:pointer;min-height:40px";
      lien.textContent="Plus de téléphone ? Utiliser un code de secours";
      lien.addEventListener("click",function(){
        s.body.innerHTML="";
        mfaTexte(s.body,"Le code de secours retire la double authentification de votre compte. Vous pourrez la réactiver dans Paramètres.");
        var k=mfaChamp(s.body,"Code de secours",{placeholder:"XXXX-XXXX"}); k.setAttribute("autocapitalize","characters");
        var er2=mfaErreur(s.body);
        var b2=gmBtn("Utiliser ce code","primary",function(){
          var v=String(k.value||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
          if(v.length<8){ er2("Code de secours incomplet."); return; }
          b2.disabled=true; er2("");
          mfaAppel({action:"secours",email:fini.email,password:fini.pass,code:v},false).then(function(){
            return window.fbSignIn(window.fbAuth,fini.email,fini.pass);
          }).then(function(cred){ showToast("Double authentification retirée : pensez à la réactiver"); fin(cred); })
            .catch(function(e){ b2.disabled=false; er2(mfaMessage(e)); });
        });
        s.body.appendChild(b2);
      });
      s.body.appendChild(lien);
    }
    setTimeout(function(){ try{ c.focus(); }catch(e){} },50);
  });
}
window.gmMfaResoudre=gmMfaResoudre;

// Plateforme (super admin) : retirer la double authentification d'un compte qui a tout perdu.
function mfaDebloquer(){
  var s=gmSheet("Débloquer un compte");
  mfaTexte(s.body,"Retire la double authentification d'un compte qui a perdu son téléphone et ses codes de secours. Vérifiez d'abord que c'est bien la personne (appel, SMS).");
  var e=mfaChamp(s.body,"E-mail du compte",{type:"email",placeholder:"mail@gmail.com"});
  var err=mfaErreur(s.body);
  var b=gmBtn("Retirer la double authentification","primary",function(){
    var v=String(e.value||"").trim();
    if(v.indexOf("@")<1){ err("E-mail invalide."); return; }
    b.disabled=true; err("");
    mfaAppel({action:"debloquer",email:v},true).then(function(d){
      s.modal.remove(); askAlert(d.avait?"Double authentification retirée. La personne se connecte avec son mot de passe et peut la réactiver.":"Ce compte n'avait pas de double authentification.");
    }).catch(function(x){ b.disabled=false; err(mfaMessage(x)); });
  });
  s.body.appendChild(b);
}
