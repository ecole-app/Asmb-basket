// ═══ IMPORT DES PHOTOS (trombinoscope) ══════════════════════════════
// Licences › « Photos ». Plusieurs images ou un ZIP (ex. export FBI). Chaque photo est
// rattachée à un licencié de la saison : par n° de licence FBI contenu dans le nom du
// fichier (rempli par l'import 06f), sinon par nom + prénom. Plusieurs candidats ou aucun
// = non rattachée (listée dans l'aperçu). Photos réduites (320 px max, JPEG).
var PHO_ETAT={items:[],res:null};
var JSZIP_URL="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
var jszipLoading=null;
function chargerJszip(){
  if(window.JSZip) return Promise.resolve();
  if(jszipLoading) return jszipLoading;
  jszipLoading=new Promise(function(resolve,reject){
    var s=document.createElement("script"); s.src=JSZIP_URL;
    s.onload=function(){resolve();};
    s.onerror=function(){jszipLoading=null;reject(new Error("Chargement du ZIP impossible"));};
    document.head.appendChild(s);
  });
  return jszipLoading;
}
function phoEstImage(nom){ return /\.(jpe?g|png|webp)$/i.test(nom||""); }
function phoBase(nom){ return String(nom||"").split("/").pop().replace(/\.[^.]+$/,""); }

// Rattache un nom de fichier à une licence (ou null + raison).
function phoTrouver(nomFichier, lics){
  var n=impNorm(phoBase(nomFichier));
  if(!n) return {lic:null,raison:"nom de fichier vide"};
  var cands=lics.filter(function(l){
    var num=impNorm(l.fiche&&l.fiche.numLicenceFFBB);
    return num.length>=5 && n.indexOf(num)>=0;
  });
  if(!cands.length){
    cands=lics.filter(function(l){
      var f=l.fiche||{}, a=impNorm(f.nom), b=impNorm(f.prenom);
      return a && b && n.indexOf(a)>=0 && n.indexOf(b)>=0;
    });
  }
  if(cands.length===1) return {lic:cands[0]};
  return {lic:null,raison:cands.length?"plusieurs licenciés possibles":"aucun licencié reconnu"};
}
function phoAnalyser(items, lics, remplacer){
  var res={ok:[],sans:[],deja:[]}, pris={};
  items.forEach(function(it){
    var t=phoTrouver(it.nom,lics);
    if(!t.lic){ res.sans.push({nom:it.nom,raison:t.raison}); return; }
    if(pris[t.lic.id]){ res.sans.push({nom:it.nom,raison:"deux photos pour la même personne"}); return; }
    if(t.lic.fiche.photo && !remplacer){ res.deja.push({nom:it.nom}); pris[t.lic.id]=true; return; }
    pris[t.lic.id]=true; res.ok.push({item:it,licId:t.lic.id,nom:((t.lic.fiche.prenom||"")+" "+(t.lic.fiche.nom||"")).trim()});
  });
  return res;
}
// Réduit une image à 320 px max, JPEG.
function phoReduire(blob){
  return new Promise(function(resolve,reject){
    var url=URL.createObjectURL(blob), img=new Image();
    img.onerror=function(){URL.revokeObjectURL(url);reject(new Error("image illisible"));};
    img.onload=function(){
      var max=320, k=Math.min(1,max/Math.max(img.width,img.height));
      var c=document.createElement("canvas"); c.width=Math.round(img.width*k); c.height=Math.round(img.height*k);
      c.getContext("2d").drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url); resolve(c.toDataURL("image/jpeg",0.8));
    };
    img.src=url;
  });
}
// ── Écran ───────────────────────────────────────────────────────────
function phoOuvrir(){
  if(typeof verifierLimiteLicences==="function" && !verifierLimiteLicences(true)) return;
  var modal=document.createElement("div"); modal.id="pho-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div"); inner.id="pho-inner";
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:90vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  modal.appendChild(inner); modal.addEventListener("click",phoFermer);
  document.body.appendChild(modal);
  PHO_ETAT={items:[],res:null};
  phoRendre();
}
function phoFermer(){ var m=document.getElementById("pho-modal"); if(m) m.remove(); }
function phoLicences(){
  var s=getCurrentSeason();
  return getLicences().filter(function(l){return l.fiche&&(!l.saison||l.saison===s);});
}
function phoRendre(){
  var el=document.getElementById("pho-inner"); if(!el) return;
  var tete='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:800;color:var(--txt)">Importer des photos</div>'+
    '<button onclick="phoFermer()" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button></div>';
  if(!PHO_ETAT.items.length){
    el.innerHTML=tete+
      '<div style="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:12px">Choisis plusieurs photos (JPG, PNG) ou un fichier ZIP, par exemple l\'export photos de FBI. Chaque photo est rattachée au licencié grâce à son n° de licence ou à son nom dans le nom du fichier (ex. DUPONT_Lea.jpg).</div>'+
      '<input type="file" id="pho-file" accept="image/*,.zip" multiple style="width:100%;font-size:13px">'+
      '<div id="pho-msg" style="font-size:12px;color:var(--mut);margin-top:10px"></div>';
    document.getElementById("pho-file").addEventListener("change",phoChoisis);
    return;
  }
  var rempl=!!(document.getElementById("pho-rempl")||{}).checked;
  var res=phoAnalyser(PHO_ETAT.items,phoLicences(),rempl); PHO_ETAT.res=res;
  var sans=res.sans.slice(0,6).map(function(x){return '<div style="font-size:11px;color:var(--mut)">'+authEsc(x.nom)+' — '+authEsc(x.raison)+'</div>';}).join("");
  el.innerHTML=tete+
    '<div style="padding:12px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr);font-size:13px;color:var(--txt);line-height:1.6;margin-bottom:10px">'+
      '<b>'+res.ok.length+'</b> photo'+(res.ok.length>1?'s':'')+' prête'+(res.ok.length>1?'s':'')+' à importer<br>'+
      '<b>'+res.deja.length+'</b> licencié'+(res.deja.length>1?'s':'')+' ont déjà une photo<br>'+
      '<b>'+res.sans.length+'</b> photo'+(res.sans.length>1?'s':'')+' non rattachée'+(res.sans.length>1?'s':'')+
      (sans?'<div style="margin-top:6px">'+sans+(res.sans.length>6?'<div style="font-size:11px;color:var(--mut)">… et '+(res.sans.length-6)+' autres</div>':'')+'</div>':'')+
    '</div>'+
    '<label style="display:flex;align-items:center;gap:8px;font-size:12px;color:var(--txt2);margin-bottom:10px"><input type="checkbox" id="pho-rempl" onchange="phoRendre()"'+(rempl?' checked':'')+'> Remplacer les photos déjà présentes</label>'+
    '<button id="pho-go" onclick="phoValider()" '+(res.ok.length?'':'disabled ')+'style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;'+(res.ok.length?'':'opacity:.5')+'">Importer les photos</button>'+
    '<button onclick="PHO_ETAT.items=[];phoRendre()" style="width:100%;margin-top:8px;padding:11px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:12px;font-weight:600;border:none;cursor:pointer">Choisir d\'autres fichiers</button>';
}
async function phoChoisis(){
  var files=[].slice.call(this.files||[]); if(!files.length) return;
  var msg=document.getElementById("pho-msg"); if(msg) msg.textContent="Lecture…";
  var items=[];
  try{
    for(var i=0;i<files.length;i++){
      var f=files[i];
      if(/\.zip$/i.test(f.name)){
        await chargerJszip();
        var zip=await JSZip.loadAsync(f);
        var noms=Object.keys(zip.files).filter(function(n){return !zip.files[n].dir && phoEstImage(n) && n.indexOf("__MACOSX")<0;});
        for(var j=0;j<noms.length;j++) items.push({nom:noms[j].split("/").pop(),blob:await zip.files[noms[j]].async("blob")});
      } else if(phoEstImage(f.name)||/^image\//.test(f.type)) items.push({nom:f.name,blob:f});
    }
  }catch(e){ if(msg) msg.textContent="Erreur : "+((e&&e.message)||e); return; }
  if(!items.length){ if(msg) msg.textContent="Aucune image trouvée."; return; }
  PHO_ETAT.items=items; phoRendre();
}
async function phoValider(){
  var res=PHO_ETAT.res; if(!res||!res.ok.length) return;
  var btn=document.getElementById("pho-go"); if(btn){btn.disabled=true;btn.textContent="Import en cours…";}
  var lics=getLicences(), nb=0, echecs=0;
  for(var i=0;i<res.ok.length;i++){
    var x=res.ok[i], lic=lics.find(function(l){return l.id===x.licId;});
    if(!lic||!lic.fiche) continue;
    try{ lic.fiche.photo=await phoReduire(x.item.blob); nb++; }catch(e){ echecs++; }
  }
  if(nb) saveLicences(lics);
  phoFermer(); buildLicences();
  askAlert(nb+" photo(s) importée(s)"+(echecs?(", "+echecs+" illisible(s)"):"")+".");
}
