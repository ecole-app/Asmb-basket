// ══════════════════════════════════════════════════════════════
// COMPTA — PHOTO DE TICKET → LIGNE PRÉ-REMPLIE
// Photo réduite (1280 px, JPEG) → lue par un modèle d'IA gratuit
// via la fonction serveur lireTicket (functions/index.js, clé dans Secret
// Manager, 40 lectures/jour/compte) → date, montant, fournisseur, catégorie,
// moyen de paiement pré-remplis dans « Nouvelle ligne ». La photo reste jointe
// en justificatif. Rien n'est enregistré sans validation : si la lecture
// échoue, on complète à la main comme avant.
// ══════════════════════════════════════════════════════════════
var GM_TICKET_URL="https://europe-west1-asmb-app.cloudfunctions.net/lireTicket";
var GM_TICKET_DELAI=110000; // le serveur essaie jusqu'à 3 modèles gratuits

// Bouton de la barre : ouvre une nouvelle ligne (dépense) puis l'appareil photo.
function comptaTicketNouveau(){
  if(typeof hasPremium==="function"&&!hasPremium()){ askComptaVerrouillee(); return; }
  showAddComptaLine();
  setComptaType("depense");
  comptaTicketChoisir();
}
function comptaTicketChoisir(){
  var inp=document.getElementById("cl-ticket-file");
  if(!inp){
    inp=document.createElement("input"); inp.type="file"; inp.id="cl-ticket-file"; inp.accept="image/*";
    inp.setAttribute("capture","environment"); inp.style.display="none";
    inp.addEventListener("change",function(){ var f=inp.files&&inp.files[0]; inp.value=""; if(f) comptaTicketLire(f); });
    document.body.appendChild(inp);
  }
  inp.click();
}
function comptaTicketStatut(txt,couleur){
  var el=document.getElementById("cl-ticket-st"); if(!el) return;
  el.style.display=txt?"block":"none";
  el.style.color=couleur||"var(--mut)";
  el.textContent=txt||""; el.style.whiteSpace="pre-line"; el.style.wordBreak="break-word";
}
// Réduit la photo : 1280 px max sur le grand côté, JPEG. Renvoie une data URL.
function comptaTicketReduire(file,maxPx,qualite){
  return new Promise(function(ok,ko){
    var url=URL.createObjectURL(file), img=new Image();
    img.onload=function(){
      var r=Math.min(1,maxPx/Math.max(img.width,img.height)), w=Math.round(img.width*r), h=Math.round(img.height*r);
      var c=document.createElement("canvas"); c.width=w; c.height=h;
      var g=c.getContext("2d"); g.fillStyle="#fff"; g.fillRect(0,0,w,h); g.drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url);
      var q=qualite, d=c.toDataURL("image/jpeg",q);
      // Le justificatif est limité à 700 Ko : on baisse la qualité si besoin.
      while(d.length>900000&&q>0.35){ q-=0.1; d=c.toDataURL("image/jpeg",q); }
      ok(d);
    };
    img.onerror=function(){ URL.revokeObjectURL(url); ko(new Error("image")); };
    img.src=url;
  });
}
// Erreur avec le détail technique, affiché sous le message pour le diagnostic.
function comptaTicketErr(detail){ var e=new Error("ia"); e.detail=String(detail||"").slice(0,160); return e; }
// Extrait et vérifie le JSON renvoyé par l'IA (rien d'aberrant n'est gardé).
function comptaTicketAnalyser(txt){
  var s=String(txt||"").replace(/```json|```/g,""), a=s.indexOf("{"), b=s.lastIndexOf("}");
  if(a<0||b<=a) return null;
  var d; try{ d=JSON.parse(s.slice(a,b+1)); }catch(e){ return null; }
  if(!d||typeof d!=="object") return null;
  var out={};
  if(typeof d.date==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(d.date)){
    var t=new Date(d.date+"T12:00:00").getTime(), now=Date.now();
    if(t&&t<=now+2*86400000&&t>now-3*365*86400000) out.date=d.date;
  }
  var m=typeof d.montant==="string"?parseFloat(d.montant.replace(",",".").replace(/[^\d.]/g,"")):Number(d.montant);
  if(m>0&&m<100000) out.montant=Math.round(m*100)/100;
  if(typeof d.fournisseur==="string"&&d.fournisseur.trim()&&d.fournisseur!=="null") out.fournisseur=d.fournisseur.trim().slice(0,60);
  if(typeof d.description==="string"&&d.description.trim()&&d.description!=="null") out.description=d.description.trim().slice(0,80);
  if(COMPTA_CATS.depense.indexOf(d.categorie)>=0) out.categorie=d.categorie;
  if(["CB","Espèces","Chèque","Virement"].indexOf(d.moyen)>=0) out.moyen=d.moyen;
  return (out.montant||out.date||out.fournisseur)?out:null;
}
// Lecture par le serveur (fonction lireTicket) : il pose la question et renvoie le texte de l'IA.
function comptaTicketServeur(dataUrl){
  var cu=window.fbAuth&&window.fbAuth.currentUser;
  if(!cu) return Promise.reject(comptaTicketErr("pas connecté"));
  var b64=String(dataUrl).split(",")[1]||"";
  var ctrl=window.AbortController?new AbortController():null;
  var t=setTimeout(function(){ if(ctrl) ctrl.abort(); },GM_TICKET_DELAI);
  return cu.getIdToken().then(function(jeton){
    return fetch(GM_TICKET_URL,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+jeton},
      body:JSON.stringify({image:b64,categories:(typeof COMPTA_CATS!=="undefined"&&COMPTA_CATS.depense)||[]}),signal:ctrl?ctrl.signal:undefined});
  }).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ return {st:r.status,j:j}; }); })
  .then(function(o){
    clearTimeout(t);
    if(o.st===429) throw comptaTicketErr("quota");
    if(o.st!==200||!o.j.ok) throw comptaTicketErr("serveur "+o.st+" : "+(o.j.detail||o.j.erreur||""));
    var res=comptaTicketAnalyser(o.j.texte);
    if(!res) throw comptaTicketErr("illisible ("+(o.j.modele||"")+")");
    return res;
  },function(e){ clearTimeout(t); throw (e&&e.detail)?e:comptaTicketErr("réseau : "+(e&&e.name==="AbortError"?"trop long":(e&&e.message||e))); });
}
// Lecture IA d'une photo de ticket, partagée (compta, notes de frais).
// statut(txt) : gardé pour les appelants, plus utilisé (un seul fournisseur). Renvoie {date,montant,fournisseur,...}.
function gmTicketIA(file,statut){
  if(!navigator.onLine) return Promise.reject(new Error("hors-ligne"));
  // Image plus légère pour l'IA (réponse plus rapide) ; le justificatif garde sa propre version.
  if(window.GM_DEMO) return Promise.reject(comptaTicketErr("démo"));
  return comptaTicketReduire(file,1024,0.6).then(function(petite){ return comptaTicketServeur(petite); });
}
function gmTicketMsgErreur(e){
  var m=e&&e.message;
  return m==="image"?"⚠️ Photo illisible. Réessaie ou complète à la main.":
    m==="hors-ligne"?"⚠️ Pas de connexion : photo jointe, complète à la main.":
    (e&&e.name==="AbortError")?"⏱ Lecture trop longue : photo jointe, complète à la main.":
    (e&&e.detail==="quota")?"⚠️ Limite de 40 lectures par jour atteinte : photo jointe, complète à la main.":
    (e&&e.detail==="démo")?"Démo : la lecture du ticket marche avec un vrai compte. Complète à la main.":
    "⚠️ Lecture impossible : photo jointe, complète à la main."+(e&&e.detail?"\n("+e.detail+")":"");
}
function comptaTicketLire(file){
  if(file.type&&file.type.indexOf("image")!==0){ askAlert("Choisissez une photo du ticket."); return; }
  comptaTicketStatut("⏳ Lecture du ticket… (jusqu'à 1 minute)");
  var btn=document.getElementById("cl-ticket-btn"); if(btn) btn.disabled=true;
  comptaTicketReduire(file,1280,0.7).then(function(dataUrl){
    // La photo est jointe tout de suite, même si la lecture échoue.
    comptaJustifDataUrl=dataUrl;
    var prev=document.getElementById("cl-justif-preview"); if(prev) prev.textContent="📎 Photo du ticket (jointe)";
    if(!navigator.onLine) throw new Error("hors-ligne");
    return gmTicketIA(file,comptaTicketStatut);
  }).then(function(r){
    comptaTicketRemplir(r);
    var manque=[]; if(!r.date) manque.push("la date"); if(!r.montant) manque.push("le montant");
    comptaTicketStatut(manque.length?"⚠️ Ticket lu en partie : vérifie "+manque.join(" et ")+".":"✓ Ticket lu : vérifie puis enregistre.",manque.length?"var(--org,#c77700)":"var(--grn)");
  }).catch(function(e){
    comptaTicketStatut(gmTicketMsgErreur(e),"var(--red)");
  }).then(function(){ if(btn) btn.disabled=false; });
}
function comptaTicketRemplir(r){
  if(comptaCurrentType!=="depense") setComptaType("depense");
  var set=function(id,v){ var el=document.getElementById(id); if(el&&v!=null&&v!=="") el.value=v; };
  set("cl-date",r.date);
  set("cl-montant",r.montant!=null?r.montant.toFixed(2):"");
  if(r.categorie){
    var cat=document.getElementById("cl-categorie"); if(cat){ cat.value=r.categorie; cat.dispatchEvent(new Event("change")); }
  }
  var motif=document.getElementById("cl-motif");
  if(motif&&!motif.value.trim()) motif.value=r.description||(r.fournisseur?"Achat "+r.fournisseur:"");
  var tiers=document.getElementById("cl-tiers");
  if(tiers&&!tiers.value.trim()&&r.fournisseur) tiers.value=r.fournisseur;
  if(r.moyen){
    var moy=document.getElementById("cl-moyen");
    if(moy){ moy.value=r.moyen; moy.dispatchEvent(new Event("change")); }
  }
}
