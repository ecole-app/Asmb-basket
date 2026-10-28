// ══════════════════════════════════════════════════════════════
// COMPTA — PHOTO DE TICKET → LIGNE PRÉ-REMPLIE
// Photo réduite (1280 px, JPEG) → lue par Gemini (Firebase AI Logic) →
// date, montant, fournisseur, catégorie, moyen de paiement pré-remplis
// dans « Nouvelle ligne ». La photo reste jointe en justificatif. Rien
// n'est enregistré sans validation : si la lecture échoue, on complète
// à la main comme avant. Aucune clé à part : l'appel passe par le projet
// Firebase (clé publique + jeton App Check), l'API « Gemini Developer »
// est activée dans la console Firebase.
// ══════════════════════════════════════════════════════════════
// Modèles stables (liste officielle Firebase AI Logic). Les « 2.5 » ne sont plus
// ouverts aux nouveaux projets (404) : à revoir si Google annonce un arrêt.
var GM_GEMINI_MODELES=["gemini-3.5-flash-lite","gemini-3.5-flash","gemini-3.1-flash-lite"];
var GM_TICKET_DELAI=20000; // par modèle essayé (3 au plus)

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
function comptaTicketPrompt(){
  return "Photo d'un ticket de caisse ou d'une facture française, payée par un club de basket. "+
    "Réponds UNIQUEMENT avec un objet JSON brut, sans markdown ni explication :\n"+
    '{"date":"AAAA-MM-JJ","montant":12.34,"fournisseur":"nom du magasin ou de la société","description":"achat en 2 à 5 mots","categorie":"une valeur de la liste","moyen":"CB ou Espèces ou Chèque ou Virement ou null"}\n'+
    "montant = TOTAL TTC payé (pas le sous-total, pas la TVA, pas le rendu monnaie). "+
    "categorie parmi : "+COMPTA_CATS.depense.join(" | ")+". "+
    "Utilise null si une information est illisible.";
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
// Lecture par Gemini (Firebase AI Logic). Essaie chaque modèle de la liste.
function comptaTicketGemini(dataUrl){
  if(!window.fbApiKey||!window.fbProjectId) return Promise.reject(comptaTicketErr("Gemini : Firebase non chargé"));
  var b64=String(dataUrl).split(",")[1]||"";
  var corps={contents:[{role:"user",parts:[{inlineData:{mimeType:"image/jpeg",data:b64}},{text:comptaTicketPrompt()}]}],
    generationConfig:{temperature:0,maxOutputTokens:1500,responseMimeType:"application/json"}};
  function essai(i,derniere){
    if(i>=GM_GEMINI_MODELES.length) return Promise.reject(derniere||comptaTicketErr("Gemini : aucun modèle"));
    var mod=GM_GEMINI_MODELES[i];
    var ctrl=window.AbortController?new AbortController():null;
    var t=setTimeout(function(){ if(ctrl) ctrl.abort(); },GM_TICKET_DELAI);
    var jeton=typeof window.fbAppCheckToken==="function"?window.fbAppCheckToken():Promise.resolve("");
    return jeton.then(function(ac){
      var h={"Content-Type":"application/json","x-goog-api-key":window.fbApiKey,"x-goog-api-client":"gl-js/ fire/10.7.1"};
      if(ac) h["X-Firebase-AppCheck"]=ac;
      return fetch("https://firebasevertexai.googleapis.com/v1beta/projects/"+encodeURIComponent(window.fbProjectId)+"/models/"+mod+":generateContent",
        {method:"POST",headers:h,body:JSON.stringify(corps),signal:ctrl?ctrl.signal:undefined});
    }).then(function(r){ return r.text().then(function(x){ var d=null; try{ d=JSON.parse(x); }catch(e){} return {st:r.status,d:d,x:x}; }); })
    .then(function(o){
      clearTimeout(t);
      if(o.st!==200||!o.d||o.d.error){
        var m=(o.d&&o.d.error&&o.d.error.message)||o.x.slice(0,100);
        throw comptaTicketErr("Gemini "+o.st+" ("+mod+") : "+m);
      }
      var parts=(o.d.candidates&&o.d.candidates[0]&&o.d.candidates[0].content&&o.d.candidates[0].content.parts)||[];
      var txt=parts.map(function(p){ return p.text||""; }).join("");
      var res=comptaTicketAnalyser(txt);
      if(!res) throw comptaTicketErr("Gemini illisible ("+mod+") : "+(txt.slice(0,80)||"vide"));
      return res;
    },function(e){ clearTimeout(t); throw (e&&e.detail)?e:comptaTicketErr("Gemini réseau ("+mod+") : "+(e&&e.name==="AbortError"?"trop long":(e&&e.message||e))); })
    .catch(function(e){
      // 403 = AI Logic pas activé : inutile d'essayer l'autre modèle.
      if(e&&/Gemini 403/.test(e.detail||"")) throw e;
      return essai(i+1,e);
    });
  }
  return essai(0,null);
}
// Lecture IA d'une photo de ticket, partagée (compta, notes de frais).
// statut(txt) : gardé pour les appelants, plus utilisé (un seul fournisseur). Renvoie {date,montant,fournisseur,...}.
function gmTicketIA(file,statut){
  if(!navigator.onLine) return Promise.reject(new Error("hors-ligne"));
  // Image plus légère pour l'IA (réponse plus rapide) ; le justificatif garde sa propre version.
  return comptaTicketReduire(file,1024,0.6).then(function(petite){ return comptaTicketGemini(petite); });
}
function gmTicketMsgErreur(e){
  var m=e&&e.message;
  return m==="image"?"⚠️ Photo illisible. Réessaie ou complète à la main.":
    m==="hors-ligne"?"⚠️ Pas de connexion : photo jointe, complète à la main.":
    (e&&e.name==="AbortError")?"⏱ Lecture trop longue : photo jointe, complète à la main.":
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
