// ═══ PLUSIEURS CLUBS POUR UN MÊME COMPTE (« Mes clubs ») ══════════════
// Un compte a toujours UN club actif : users/{uid}.clubId (toutes les règles s'appuient
// dessus). Ses autres clubs gardent une copie de sa fiche (users/{uid}__{clubId}, écrite
// par le serveur), pour que chaque club continue de le voir dans ses listes.
// La liste vient de users/{uid}/clubs (lecture seule). Changer de club ou rejoindre un
// autre club passe par la fonction serveur clubCompte (functions/index.js), qui vérifie.
// En-tête : quand la personne a au moins 2 clubs, le titre (nom du club) devient un menu ▾
// sur les écrans d'accueil.
var MC_URL="https://europe-west1-asmb-app.cloudfunctions.net/clubCompte";
var MC_ECRANS=["portal","parent-home","coach-equipe","joueur","admin"];
window.GM_MES_CLUBS=[];
// Identifiant réel d'une personne à partir d'une fiche de la liste du club : la copie
// users/{uid}__{clubId} renvoie {uid}. Pour écrire sur la fiche elle-même, garder d.id.
function gmUidDoc(d){ var id=String(d&&d.id||""); var i=id.indexOf("__"); return i>0?id.slice(0,i):id; }

function mcCharger(){
  var u=window.ASMB_USER;
  if(window.GM_DEMO||window.SUPPORT_MODE||!u||!u.uid||!window.fbGetDocs||!window.fbDb) return;
  window.fbGetDocs(window.fbCollection(window.fbDb,"users",u.uid,"clubs")).then(function(snap){
    var l=[];
    snap.forEach(function(d){ var x=d.data()||{}; l.push({clubId:d.id, nom:String(x.nom||d.id), roles:x.roles||[]}); });
    var actif=window.CURRENT_CLUB_ID;
    var a=l.filter(function(x){ return x.clubId===actif; })[0];
    if(!a){ a={clubId:actif, nom:"", roles:u.roles||[]}; l.push(a); }
    a.roles=u.roles||a.roles;
    l.sort(function(x,y){ return (x.clubId===actif?-1:y.clubId===actif?1:x.nom.localeCompare(y.nom)); });
    window.GM_MES_CLUBS=l;
    var on=document.querySelector(".scr.on");
    mcMajEntete(on?on.id.replace(/^scr-/,""):"");
  }).catch(function(){});
}

// Appelé par showScr (js/03-nav-portal.js) : le titre devient un menu quand il y a 2 clubs ou plus.
function mcMajEntete(id){
  var h=document.querySelector(".hdr .hinfo"); if(!h) return;
  var voir=(window.GM_MES_CLUBS||[]).length>=2 && MC_ECRANS.indexOf(id)>=0 && !window.SUPPORT_MODE;
  h.classList.toggle("gm-mc",voir);
  if(voir){ h.setAttribute("role","button"); h.setAttribute("tabindex","0"); h.setAttribute("aria-label",(typeof gmT==="function"?gmT("Mes clubs"):"Mes clubs")); }
  else { h.removeAttribute("role"); h.removeAttribute("tabindex"); h.removeAttribute("aria-label"); }
  if(!h.__mc){
    h.__mc=true;
    h.addEventListener("click",function(){ if(h.classList.contains("gm-mc")) mcOuvrir(); });
    h.addEventListener("keydown",function(e){ if((e.key==="Enter"||e.key===" ")&&h.classList.contains("gm-mc")){ e.preventDefault(); mcOuvrir(); } });
  }
}

function mcRoles(roles){
  return (roles||[]).map(function(r){ return typeof roleLabel==="function"?roleLabel(r):r; }).join(" · ");
}

function mcOuvrir(){
  var s=gmSheet("Mes clubs");
  var actif=window.CURRENT_CLUB_ID;
  (window.GM_MES_CLUBS||[]).forEach(function(c){
    var on=(c.clubId===actif);
    var nom=on?(typeof clubTitle==="function"?clubTitle():c.nom):c.nom;
    var b=document.createElement("button"); b.type="button";
    b.style.cssText="width:100%;display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;margin-bottom:8px;border-radius:var(--rs);border:2px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"color-mix(in srgb, var(--ltg) 10%, var(--card))":"var(--card)")+";cursor:pointer;text-align:left;font:inherit;color:var(--txt)";
    var av=document.createElement("span");
    av.style.cssText="width:40px;height:40px;border-radius:50%;background:var(--dkg);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:14px;flex-shrink:0";
    av.setAttribute("data-notr","");
    av.textContent=String(nom||"?").split(/\s+/).slice(0,2).map(function(w){ return w.charAt(0); }).join("").toUpperCase();
    var t=document.createElement("span"); t.style.cssText="flex:1;min-width:0";
    var n=document.createElement("span"); n.style.cssText="display:block;font-weight:800;font-size:15px"; n.setAttribute("data-notr",""); n.textContent=nom;
    var r=document.createElement("span"); r.style.cssText="display:block;font-size:12px;color:var(--mut)"; r.textContent=mcRoles(c.roles);
    t.appendChild(n); t.appendChild(r);
    var f=document.createElement("span"); f.style.cssText="font-weight:900;color:"+(on?"var(--dkg)":"var(--mut)"); f.textContent=on?"✓":"›";
    b.appendChild(av); b.appendChild(t); b.appendChild(f);
    b.addEventListener("click",function(){ if(on){ s.modal.remove(); return; } mcChanger(c, b); });
    s.body.appendChild(b);
  });
  var plus=document.createElement("button"); plus.type="button";
  plus.style.cssText="width:100%;min-height:52px;border-radius:var(--rs);border:2px dashed var(--bdr);background:none;color:var(--dkg);font:inherit;font-weight:800;font-size:14px;cursor:pointer";
  plus.textContent="+ Rejoindre un autre club";
  plus.addEventListener("click",function(){
    askAlert("Demandez au club de vous envoyer une invitation. Ouvrez le lien, puis choisissez « Me connecter avec mon compte » : le club s'ajoutera à cette liste.");
  });
  s.body.appendChild(plus);
}

function mcAppel(corps){
  var cu=window.fbAuth&&window.fbAuth.currentUser;
  if(!cu) return Promise.reject({code:"connexion"});
  return cu.getIdToken().then(function(jeton){
    return fetch(MC_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+jeton},body:JSON.stringify(corps)});
  }).then(function(r){
    return r.json().catch(function(){ return {}; }).then(function(j){ if(!r.ok||!j.ok) throw {code:j.erreur||("http-"+r.status)}; return j; });
  });
}
function mcMessage(code){
  var m={
    "pas-membre":"Vous n'êtes plus membre de ce club.",
    "club-ferme":"L'accès de ce club est suspendu pour le moment.",
    "invitation":"Invitation déjà utilisée ou expirée.",
    "deja-membre":"Vous êtes déjà membre de ce club : choisissez-le dans « Mes clubs », en touchant le nom du club en haut de l'écran.",
    "independant":"Un espace Indépendant ne peut pas être ajouté à un compte de club. Utilisez une autre adresse e-mail.",
    "connexion":"Connexion perdue : reconnectez-vous puis réessayez."
  };
  if(!m[code]) console.log("clubCompte:",code);
  return m[code]||"Impossible pour le moment. Vérifiez votre connexion et réessayez.";
}

function mcChanger(c, bouton){
  if(window.GM_DEMO){ askAlert("Démo : pas de changement de club."); return; }
  if(!navigator.onLine){ askAlert("Pas de connexion : le changement de club demande internet."); return; }
  if(bouton){ bouton.disabled=true; bouton.style.opacity=".6"; }
  // On coupe l'écoute du compte : l'appli repart de zéro sur le nouveau club.
  if(window.__userDocUnsub){ try{ window.__userDocUnsub(); }catch(e){} window.__userDocUnsub=null; }
  mcAppel({action:"changer", clubId:c.clubId}).then(function(){
    location.reload();
  }).catch(function(e){
    if(bouton){ bouton.disabled=false; bouton.style.opacity=""; }
    askAlert(mcMessage(e&&e.code||"")).then(function(){ location.reload(); });
  });
}

// Invitation d'un autre club acceptée avec un compte existant (js/20b-plateforme.js).
function mcRejoindre(code){ return mcAppel({action:"rejoindre", code:code}); }
