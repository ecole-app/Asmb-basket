// ═══ IMPORT DES LICENCES (CSV / Excel, dont l'export FBI) ═══════════
// Licences › « Importer ». Colonnes reconnues automatiquement (corrigeables),
// aperçu avant validation. Doublon = nom + prénom + date de naissance sur la saison
// en cours : la fiche existante est complétée, jamais écrasée par des cases vides.
// Les fiches créées sont en statut « reçue », sans paiement, sans équipe.
var IMP_CHAMPS=[
  {id:"nom",label:"Nom",syn:["nom","nomdefamille","nomlicencie","nomjoueur","lastname","surname"]},
  {id:"prenom",label:"Prénom",syn:["prenom","prenomlicencie","prenomjoueur","firstname"]},
  {id:"naissance",label:"Date de naissance",syn:["datedenaissance","naissance","datenaissance","ne le","nele","dob","birthdate"]},
  {id:"genre",label:"Genre / sexe",syn:["sexe","genre","civilite","gender"]},
  {id:"email",label:"E-mail",syn:["email","mail","courriel","adresseemail","adressemail"]},
  {id:"telephone",label:"Téléphone",syn:["telephone","tel","mobile","portable","telmobile","telephonemobile","gsm"]},
  {id:"adresse",label:"Adresse",syn:["adresse","adresse1","rue","adressepostale"]},
  {id:"categorie",label:"Catégorie",syn:["categorie","cat","categoriejeu","categoriedage"]},
  {id:"role",label:"Fonction / rôle",syn:["fonction","role","qualite","typedelicencie","typedepratiquant"]},
  {id:"numLicence",label:"N° de licence",syn:["numerodelicence","ndelicence","numlicence","nlicence","licence","nolicence","numerolicence"]}
];
var IMP_ETAT={entetes:[],lignes:[],map:{},fichier:""};

function impNorm(s){
  return String(s==null?"":s).normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
}
// ── Lecture des fichiers ────────────────────────────────────────────
function impDecoder(buf){
  try{ return new TextDecoder("utf-8",{fatal:true}).decode(buf); }
  catch(e){ return new TextDecoder("windows-1252").decode(buf); }
}
function impParseCsv(txt){
  txt=txt.replace(/^﻿/,"");
  var prem=txt.split(/\r?\n/)[0]||"";
  var cand=[";",",","\t"], sep=";", best=-1;
  cand.forEach(function(c){ var n=prem.split(c).length; if(n>best){best=n;sep=c;} });
  var rows=[], row=[], cur="", q=false;
  for(var i=0;i<txt.length;i++){
    var ch=txt[i];
    if(q){
      if(ch==='"'){ if(txt[i+1]==='"'){cur+='"';i++;} else q=false; }
      else cur+=ch;
    } else if(ch==='"') q=true;
    else if(ch===sep){ row.push(cur); cur=""; }
    else if(ch==="\n"||ch==="\r"){
      if(ch==="\r"&&txt[i+1]==="\n") i++;
      row.push(cur); cur=""; rows.push(row); row=[];
    } else cur+=ch;
  }
  if(cur!==""||row.length){ row.push(cur); rows.push(row); }
  return rows;
}
function impLireFichier(file){
  return new Promise(function(resolve,reject){
    var rd=new FileReader();
    rd.onerror=function(){reject(new Error("Lecture impossible"));};
    rd.onload=function(){
      var buf=rd.result, nom=(file.name||"").toLowerCase();
      if(/\.(xlsx|xls|xlsm)$/.test(nom)){
        chargerXlsx().then(function(){
          var wb=XLSX.read(buf,{type:"array",cellDates:true});
          var ws=wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:"yyyy-mm-dd",defval:""}));
        }).catch(reject);
      } else resolve(impParseCsv(impDecoder(buf)));
    };
    rd.readAsArrayBuffer(file);
  });
}
// ── Valeurs ─────────────────────────────────────────────────────────
function impDate(v){
  v=String(v==null?"":v).trim(); if(!v) return "";
  var m=v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(m) return m[1]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[3]).slice(-2);
  m=v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})/);
  if(m){
    var a=m[3]; if(a.length===2) a=(parseInt(a,10)>30?"19":"20")+a;
    return a+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2);
  }
  return "";
}
function impGenre(v){
  var s=impNorm(v); if(!s) return "";
  if(/^(f|feminin|femme|fille|female|mme|madame)/.test(s)) return "F";
  if(/^(m|masculin|homme|garcon|male|mr|monsieur)/.test(s)) return "M";
  return "";
}
// "Entraîneur", "Technicien" → coach ; "Dirigeant", "Arbitre"… → autre ; sinon joueur.
function impRole(v){
  var s=impNorm(v); if(!s) return "joueur";
  if(/entraineur|coach|technicien|educateur|animateur/.test(s)) return "coach";
  if(/dirigeant|arbitre|officiel|benevole|bureau|president|tresorier|secretaire/.test(s)) return "autre";
  return "joueur";
}
function impCle(nom,prenom,naiss){ return impNorm(nom)+"|"+impNorm(prenom)+"|"+naiss; }
function impAutoMap(entetes){
  var map={};
  IMP_CHAMPS.forEach(function(c){
    var idx=-1;
    entetes.forEach(function(h,i){ if(idx<0&&c.syn.indexOf(impNorm(h))>=0) idx=i; });
    map[c.id]=idx;
  });
  return map;
}
// Analyse les lignes avec la correspondance de colonnes choisie.
function impAnalyser(entetes, lignes, map, existantes){
  var idx={}; (existantes||[]).forEach(function(l){
    var f=l.fiche; if(f&&f.nom&&f.naissance) idx[impCle(f.nom,f.prenom,f.naissance)]=l;
  });
  var res={nouvelles:[],maj:[],aVerifier:[]}, vus={};
  lignes.forEach(function(r,n){
    var g=function(id){ var i=map[id]; return (i>=0&&r[i]!=null)?String(r[i]).trim():""; };
    var nom=g("nom"), prenom=g("prenom"), nais=impDate(g("naissance"));
    if(!nom&&!prenom&&!r.some(function(x){return String(x).trim();})) return; // ligne vide
    if(!nom||!prenom){ res.aVerifier.push({n:n+2,raison:"nom ou prénom manquant",nom:nom,prenom:prenom}); return; }
    if(!nais){ res.aVerifier.push({n:n+2,raison:"date de naissance absente ou illisible",nom:nom,prenom:prenom}); return; }
    var cle=impCle(nom,prenom,nais);
    if(vus[cle]){ res.aVerifier.push({n:n+2,raison:"doublon dans le fichier",nom:nom,prenom:prenom}); return; }
    vus[cle]=true;
    var d={nom:nom,prenom:prenom,naissance:nais,genre:impGenre(g("genre")),email:g("email"),
      telephone:g("telephone"),adresse:g("adresse"),categorie:g("categorie"),numLicence:g("numLicence"),role:impRole(g("role"))};
    var ex=idx[cle];
    if(ex) res.maj.push({donnees:d,licence:ex}); else res.nouvelles.push(d);
  });
  return res;
}
// ── Application ─────────────────────────────────────────────────────
var IMP_CHAMPS_FICHE={genre:"genre",email:"emailLic",telephone:"telephone",adresse:"adresse",numLicence:"numLicenceFFBB"};
function impAppliquer(res, lics, saison){
  var nbMaj=0, nbNew=0;
  res.maj.forEach(function(x){
    var cible=lics.find(function(l){return l.id===x.licence.id;});
    var f=cible&&cible.fiche, change=false;
    if(!f) return;
    Object.keys(IMP_CHAMPS_FICHE).forEach(function(k){
      var v=x.donnees[k], cle=IMP_CHAMPS_FICHE[k];
      if(v && !f[cle]){ f[cle]=v; change=true; }
    });
    if(change) nbMaj++;
  });
  res.nouvelles.forEach(function(d,i){
    var cat=null;
    var catFichier=(d.categorie||"").toUpperCase().replace(/\s+/g,"");
    if(CATS_LIC.indexOf(catFichier)>=0) cat=catFichier;
    else if(typeof categorieFromNaissance==="function"){
      var c=categorieFromNaissance(d.naissance,d.genre); if(c&&CATS_LIC.indexOf(c)>=0) cat=c;
    }
    var fiche={genre:d.genre,prenom:d.prenom,nom:d.nom,naissance:d.naissance,adresse:d.adresse,
      telephone:d.telephone,emailLic:d.email,numLicenceFFBB:d.numLicence,importee:true,
      soumisLe:new Date().toLocaleDateString("fr-FR")};
    lics.push({
      id:(Date.now()+i).toString(), code:genCode(), email:d.email, nomDest:(d.prenom+" "+d.nom).trim(),
      statut:"recue", createdAt:Date.now(), ouvertLe:null, fiche:fiche, categorie:cat, saison:saison
    });
    if(d.role&&d.role!=="joueur") lics[lics.length-1].role=d.role;
    nbNew++;
  });
  return {nbNew:nbNew,nbMaj:nbMaj};
}

// ── Écran ───────────────────────────────────────────────────────────
function impOuvrir(){
  if(typeof verifierLimiteLicences==="function" && !verifierLimiteLicences(true)) return;
  var modal=document.createElement("div"); modal.id="imp-modal";
  modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
  var inner=document.createElement("div"); inner.id="imp-inner";
  inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:20px;width:100%;max-height:90vh;overflow-y:auto";
  inner.addEventListener("click",function(e){e.stopPropagation();});
  modal.appendChild(inner); modal.addEventListener("click",impFermer);
  document.body.appendChild(modal);
  IMP_ETAT={entetes:[],lignes:[],map:{},fichier:""};
  impRendre();
}
function impFermer(){ var m=document.getElementById("imp-modal"); if(m) m.remove(); }
function impEntete(){
  return '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="font-size:15px;font-weight:800;color:var(--txt)">Importer des licences</div>'+
    '<button onclick="impFermer()" style="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)">✕</button></div>';
}
function impRendre(){
  var el=document.getElementById("imp-inner"); if(!el) return;
  if(!IMP_ETAT.entetes.length){
    el.innerHTML=impEntete()+
      '<div style="font-size:12px;color:var(--txt2);line-height:1.5;margin-bottom:12px">Choisis un fichier CSV ou Excel (.xlsx), par exemple l\'export FBI. Les colonnes sont reconnues automatiquement, tu pourras les corriger avant de valider.</div>'+
      '<input type="file" id="imp-file" accept=".csv,.txt,.xlsx,.xls" style="width:100%;font-size:13px">'+
      '<div id="imp-msg" style="font-size:12px;color:var(--mut);margin-top:10px"></div>';
    document.getElementById("imp-file").addEventListener("change",impChoisi);
    return;
  }
  var saison=getCurrentSeason();
  var res=impAnalyser(IMP_ETAT.entetes,IMP_ETAT.lignes,IMP_ETAT.map,getLicences().filter(function(l){return !l.saison||l.saison===saison;}));
  IMP_ETAT.res=res;
  var opts=function(sel){
    return '<option value="-1"'+(sel<0?" selected":"")+'>— ignorer —</option>'+
      IMP_ETAT.entetes.map(function(h,i){return '<option value="'+i+'"'+(i===sel?" selected":"")+'>'+authEsc(h||("Colonne "+(i+1)))+'</option>';}).join("");
  };
  var maps=IMP_CHAMPS.map(function(c){
    return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><div style="flex:0 0 120px;font-size:12px;font-weight:700;color:var(--txt)">'+c.label+'</div>'+
      '<select class="form-select" style="flex:1" onchange="impChangeMap(\''+c.id+'\',this.value)">'+opts(IMP_ETAT.map[c.id])+'</select></div>';
  }).join("");
  var peutNew=res.nouvelles.length, maxNew=peutNew;
  if(typeof hasPremium==="function"&&!hasPremium()){
    var reste=limiteLicencesClub()-nbLicencesSaison(); maxNew=Math.max(0,Math.min(peutNew,reste));
  }
  var verif=res.aVerifier.slice(0,5).map(function(x){
    return '<div style="font-size:11px;color:var(--mut)">Ligne '+x.n+' : '+authEsc((x.prenom+" "+x.nom).trim()||"(vide)")+' — '+authEsc(x.raison)+'</div>';
  }).join("");
  el.innerHTML=impEntete()+
    '<div style="font-size:11px;color:var(--mut);margin-bottom:8px">Fichier : '+authEsc(IMP_ETAT.fichier)+' · '+IMP_ETAT.lignes.length+' lignes</div>'+
    '<div style="font-size:12px;font-weight:800;color:var(--txt);margin-bottom:6px">Colonnes</div>'+maps+
    '<div style="margin:12px 0;padding:12px;border-radius:var(--rs);background:var(--card);border:1px solid var(--bdr);font-size:13px;color:var(--txt);line-height:1.6">'+
      '<b>'+peutNew+'</b> nouvelle'+(peutNew>1?"s":"")+' fiche'+(peutNew>1?"s":"")+'<br>'+
      (res.nouvelles.some(function(x){return x.role!=="joueur";})?'dont <b>'+res.nouvelles.filter(function(x){return x.role!=="joueur";}).length+'</b> coach / autre (hors joueurs)<br>':'')+
      '<b>'+res.maj.length+'</b> déjà existante'+(res.maj.length>1?"s":"")+' (complétées si des infos manquent)<br>'+
      '<b>'+res.aVerifier.length+'</b> ligne'+(res.aVerifier.length>1?"s":"")+' à vérifier (non importées)'+
      (verif?'<div style="margin-top:6px">'+verif+(res.aVerifier.length>5?'<div style="font-size:11px;color:var(--mut)">… et '+(res.aVerifier.length-5)+' autres</div>':'')+'</div>':'')+
      (maxNew<peutNew?'<div style="margin-top:6px;color:var(--red);font-size:12px">Limite de licences du pack : seules '+maxNew+' fiches seront créées.</div>':'')+
    '</div>'+
    '<button onclick="impValider()" '+((maxNew||res.maj.length)?'':'disabled ')+'style="width:100%;padding:13px;border-radius:var(--rx);background:var(--dkg);color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;'+((maxNew||res.maj.length)?'':'opacity:.5')+'">Importer</button>'+
    '<button onclick="IMP_ETAT.entetes=[];impRendre()" style="width:100%;margin-top:8px;padding:11px;border-radius:var(--rx);background:var(--bdr);color:var(--mut);font-size:12px;font-weight:600;border:none;cursor:pointer">Choisir un autre fichier</button>';
}
function impChoisi(){
  var f=this.files&&this.files[0]; if(!f) return;
  var msg=document.getElementById("imp-msg"); if(msg) msg.textContent="Lecture…";
  impLireFichier(f).then(function(rows){
    rows=rows.filter(function(r){return r.some(function(x){return String(x).trim();});});
    if(rows.length<2){ if(msg) msg.textContent="Fichier vide ou illisible."; return; }
    IMP_ETAT.entetes=rows[0].map(function(x){return String(x).trim();});
    IMP_ETAT.lignes=rows.slice(1); IMP_ETAT.fichier=f.name;
    IMP_ETAT.map=impAutoMap(IMP_ETAT.entetes);
    impRendre();
  }).catch(function(e){ if(msg) msg.textContent="Erreur : "+((e&&e.message)||e); });
}
function impChangeMap(id,val){ IMP_ETAT.map[id]=parseInt(val,10); impRendre(); }
async function impValider(){
  var res=IMP_ETAT.res; if(!res) return;
  if(typeof hasPremium==="function"&&!hasPremium()){
    var reste=Math.max(0,limiteLicencesClub()-nbLicencesSaison());
    res={nouvelles:res.nouvelles.slice(0,reste),maj:res.maj,aVerifier:res.aVerifier};
  }
  var ok=await askConfirm("Créer "+res.nouvelles.length+" fiche(s) et compléter "+res.maj.length+" fiche(s) existante(s) ?");
  if(!ok) return;
  var lics=getLicences();
  var r=impAppliquer(res,lics,getCurrentSeason());
  saveLicences(lics);
  impFermer(); buildLicences(); if(typeof buildAdminHome==="function") buildAdminHome();
  askAlert(r.nbNew+" fiche(s) créée(s), "+r.nbMaj+" complétée(s). Les fiches importées sont en « reçue » : ouvre-les pour les valider.");
}
