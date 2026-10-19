/* ===== 15e-documents-club.js — Documents du club : fichiers réellement stockés, publiés ou non aux parents =====
 *
 * Avant : l'écran Documents ne gardait que le nom du fichier (rien à ouvrir, rien de partagé).
 * Maintenant : `clubs/{id}/club_docs/{docId}` = fiche (nom, catégorie, type, taille, `publie`) et
 * `clubs/{id}/club_docs_parts/{docId}_{n}` = le fichier en morceaux de ~800 Ko (base64), car un document
 * Firestore fait 1 Mo au plus. 3 Mo maximum par fichier.
 *
 * Qui voit quoi : le dirigeant (et un compte bureau/coach à qui il a donné l'accès « Documents ») voit tout
 * et choisit pour chaque document « publié aux parents » ou « réservé au bureau ». Les parents, joueurs et
 * coachs sans accès ne reçoivent que les documents publiés (requête filtrée + règle Firestore).
 */
var DOCS_MAX_OCTETS=3*1024*1024;
var DOCS_MORCEAU=600*1024;               // octets d'origine par morceau (≈ 800 Ko en base64)
var DOCS_CLE="asmb_club_docs";

function getClubDocs(){ try{ return JSON.parse(localStorage.getItem(DOCS_CLE)||"[]"); }catch(e){ return []; } }
function docsGestionnaire(){ return typeof hasModulePermission==="function" && hasModulePermission("documents"); }

// ── Fonctions pures (testées dans tests/metier/documents.test.js) ──────
function docsDecouper(b64, taille){
  var max=Math.ceil((taille||DOCS_MORCEAU)/3)*4, out=[];
  for(var i=0;i<b64.length;i+=max) out.push(b64.slice(i,i+max));
  return out.length?out:[""];
}
function docsVisibles(docs, gestionnaire){
  return (docs||[]).filter(function(d){ return gestionnaire || d.publie===true; });
}
function docsNouvelId(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function docsTaille(o){ return o>1024*1024?(o/1024/1024).toFixed(1).replace(".",",")+" Mo":Math.max(1,Math.round(o/1024))+" Ko"; }
function docsTypeDe(nom, mime){
  mime=mime||""; nom=nom||"";
  if(mime.indexOf("pdf")>=0||/\.pdf$/i.test(nom)) return "pdf";
  if(mime.indexOf("image")>=0) return "image";
  if(/\.docx?$/i.test(nom)) return "word";
  if(/\.xlsx?$/i.test(nom)) return "excel";
  return "autre";
}

// ── Synchro ───────────────────────────────────────────────────────
// Appelée par initFirestoreSync : tout pour le gestionnaire, seulement le publié pour les autres.
function docsClubSync(){
  if(FS_UNSUB["club_docs"] || !window.fbDb || !window.fbOnSnapshot) return;
  var tout=docsGestionnaire();
  var col=window.fbCollection(window.fbDb,"club_docs");
  var ref=tout?col:window.fbQuery(col,window.fbWhere("publie","==",true));
  FS_LSKEY["club_docs"]=DOCS_CLE;
  FS_UNSUB["club_docs"]=window.fbOnSnapshot(ref,function(snap){
    var a=fsArrFromSnap(snap);
    FS_PREV["club_docs"]=a.slice();
    localStorage.setItem(DOCS_CLE,JSON.stringify(a));
    if(typeof refreshCurrentScreen==="function") refreshCurrentScreen();
    if(document.getElementById("docs-parents")) docsParentsDessiner();
  },function(err){ console.log("sync club_docs:",(err&&err.code)||err); });
}

// ── Ajout (dirigeant) ─────────────────────────────────────────────
function docsFichierEnB64(file){
  return new Promise(function(ok,ko){
    var r=new FileReader();
    r.onload=function(){ var s=String(r.result||""); ok(s.slice(s.indexOf(",")+1)); };
    r.onerror=function(){ ko(r.error); };
    r.readAsDataURL(file);
  });
}
async function docsAjouter(files, categorie, publie){
  if(!files||!files.length) return;
  if(typeof isLimite==="function" && isLimite()){ askAlert("Accès limité : consultation seule, tu ne peux pas ajouter de document."); return; }
  if(!window.fbReady||!window.fbSetDoc){ askAlert("Connexion en cours, réessaie dans un instant."); return; }
  var ok=0, trop=[];
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(f.size>DOCS_MAX_OCTETS){ trop.push(f.name); continue; }
    try{
      showToast("Envoi de « "+f.name+" »…");
      var b64=await docsFichierEnB64(f), parts=docsDecouper(b64), id=docsNouvelId();
      for(var n=0;n<parts.length;n++){
        await window.fbSetDoc(window.fbDoc(window.fbDb,"club_docs_parts",id+"_"+n),{n:n,data:parts[n]});
      }
      var fiche={id:id,name:f.name,type:docsTypeDe(f.name,f.type),mime:f.type||"application/octet-stream",
        size:docsTaille(f.size),octets:f.size,parts:parts.length,category:categorie||"autre",publie:!!publie,
        date:new Date().toLocaleDateString("fr-FR"),ts:Date.now()};
      await window.fbSetDoc(window.fbDoc(window.fbDb,"club_docs",id),fiche);
      var cur=getClubDocs(); cur.push(fiche); localStorage.setItem(DOCS_CLE,JSON.stringify(cur));
      ok++;
    }catch(e){ console.log("doc",e); askAlert("« "+f.name+" » n'a pas pu être envoyé ("+((e&&e.code)||"erreur")+")."); }
  }
  if(trop.length) askAlert("Fichier trop gros (3 Mo maximum) :\n"+trop.join("\n")+"\n\nRéduis-le (PDF compressé) puis réessaie.");
  if(ok){ showToast(ok+" document"+(ok>1?"s":"")+" ajouté"+(ok>1?"s":"")+(publie?" et publié aux parents":"")); }
  if(typeof buildDocs==="function") buildDocs();
  if(typeof buildAdminHome==="function") buildAdminHome();
}
function docsBasculerPublication(id){
  if(typeof isLimite==="function" && isLimite()){ askAlert("Accès limité : consultation seule."); return; }
  var docs=getClubDocs(), d=docs.filter(function(x){return x.id===id;})[0]; if(!d) return;
  var nouveau=!d.publie;
  askConfirm(nouveau?"Publier « "+d.name+" » aux parents ? Tous les parents et joueurs du club pourront l'ouvrir.":"Retirer « "+d.name+" » aux parents ? Il restera visible par le bureau seulement.",
    {confirmText:nouveau?"Publier":"Retirer"}).then(function(ok){
    if(!ok) return;
    d.publie=nouveau;
    window.fbSetDoc(window.fbDoc(window.fbDb,"club_docs",id),d).then(function(){
      localStorage.setItem(DOCS_CLE,JSON.stringify(docs)); buildDocs();
      showToast(nouveau?"Publié aux parents":"Retiré aux parents");
    }).catch(function(e){ askAlert("Erreur : "+((e&&e.code)||e)); });
  });
}
function docsSupprimer(id){
  if(typeof isLimite==="function" && isLimite()){ askAlert("Accès limité : consultation seule."); return; }
  var d=getClubDocs().filter(function(x){return x.id===id;})[0]; if(!d) return;
  askConfirm("Supprimer « "+d.name+" » ? Les parents ne pourront plus l'ouvrir.",{danger:true,confirmText:"Supprimer"}).then(async function(ok){
    if(!ok) return;
    try{
      for(var n=0;n<(d.parts||1);n++) await window.fbDeleteDoc(window.fbDoc(window.fbDb,"club_docs_parts",id+"_"+n));
      await window.fbDeleteDoc(window.fbDoc(window.fbDb,"club_docs",id));
      localStorage.setItem(DOCS_CLE,JSON.stringify(getClubDocs().filter(function(x){return x.id!==id;})));
      buildDocs(); if(typeof buildAdminHome==="function") buildAdminHome();
      showToast("Document supprimé");
    }catch(e){ askAlert("Erreur : "+((e&&e.code)||e)); }
  });
}

// ── Ouverture d'un fichier ────────────────────────────────────────
async function docsOuvrir(id){
  var d=getClubDocs().filter(function(x){return x.id===id;})[0]; if(!d) return;
  showToast("Ouverture…");
  try{
    var morceaux=[];
    for(var n=0;n<(d.parts||1);n++){
      var s=await window.fbGetDoc(window.fbDoc(window.fbDb,"club_docs_parts",id+"_"+n));
      if(!s.exists()) throw new Error("morceau manquant");
      morceaux.push(s.data().data||"");
    }
    var bin=atob(morceaux.join("")), octets=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) octets[i]=bin.charCodeAt(i);
    var url=URL.createObjectURL(new Blob([octets],{type:d.mime||"application/octet-stream"}));
    if(d.type==="pdf"||d.type==="image"){
      var w=null; try{ w=window.open(url,"_blank"); }catch(e){}
      if(w) return;
    }
    var a=document.createElement("a"); a.href=url; a.download=d.name||"document"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); },60000);
  }catch(e){ console.log("ouvrir doc",e); askAlert("Impossible d'ouvrir ce document pour l'instant. Réessaie avec du réseau."); }
}

// ── Écran des parents : « Documents du club » ────────────────────
function docsParentsFermer(){ var o=document.getElementById("docs-parents"); if(o) o.remove(); }
function docsParentsOuvrir(){
  var o=document.getElementById("docs-parents");
  if(!o){
    o=document.createElement("div"); o.id="docs-parents";
    o.style.cssText="position:fixed;inset:0;z-index:340;background:var(--bg);color:var(--txt);display:flex;flex-direction:column;overflow-y:auto";
    document.body.appendChild(o);
  }
  docsParentsDessiner();
}
function docsParentsDessiner(){
  var o=document.getElementById("docs-parents"); if(!o) return;
  var docs=docsVisibles(getClubDocs(),false).sort(function(a,b){return (b.ts||0)-(a.ts||0);});
  var h="<div style=\"background:var(--dkg);color:#fff;padding:14px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0\">"
    +"<button onclick=\"docsParentsFermer()\" aria-label=\"Retour\" style=\"background:none;border:none;color:#fff;font-size:22px;cursor:pointer;min-width:32px;min-height:44px\">‹</button>"
    +"<div><div style=\"font-size:16px;font-weight:800\">Documents du club</div><div style=\"font-size:12px;opacity:.85\">Règlement, charte, organisation…</div></div></div>"
    +"<div style=\"padding:14px 16px;display:flex;flex-direction:column;gap:10px\">";
  if(!docs.length){
    h+="<div style=\"background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:16px;font-size:13px;line-height:1.5;color:var(--mut)\">Le club n'a pas encore publié de document. Ils apparaîtront ici : règlement intérieur, charte, organisation de la saison…</div>";
  }
  var icones={pdf:"📕",image:"🖼️",word:"📘",excel:"📗",autre:"📄"};
  docs.forEach(function(d){
    var cat=d.category||"autre";
    h+="<button onclick=\"docsOuvrir('"+authEsc(d.id)+"')\" style=\"display:flex;align-items:center;gap:12px;text-align:left;background:var(--card);border:1px solid var(--bdr);border-radius:16px;padding:12px 14px;cursor:pointer;color:var(--txt);width:100%;min-height:60px\">"
      +"<span style=\"font-size:26px\">"+(icones[d.type]||"📄")+"</span><span style=\"flex:1;min-width:0\"><span style=\"display:block;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis\">"+authEsc(d.name)+"</span>"
      +"<span style=\"display:block;font-size:11px;color:var(--mut);margin-top:2px\">"+authEsc(DOC_CAT_LABELS[cat]||"Autre")+" · "+authEsc(d.size||"")+" · "+authEsc(d.date||"")+"</span></span>"
      +"<span style=\"font-size:12px;font-weight:700;color:var(--dkg)\">Ouvrir</span></button>";
  });
  o.innerHTML=h+"</div>";
}
