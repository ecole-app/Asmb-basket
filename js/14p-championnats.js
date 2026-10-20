/* ===== 14p-championnats.js — Compétition : championnats, import de l'export FBI, classement =====
 * Un « championnat » = une équipe du club dans une division (ex. DFU18-2). On l'alimente avec
 * l'export FBI « Rechercher rencontre » (Excel) : calendrier, salles, heures, scores.
 *   - Les matchs de NOTRE équipe deviennent des événements du planning (type "match", champKey
 *     = division|n° de match). Une réimportation met à jour scores / nouveaux matchs.
 *   - Date, heure et salle corrigées dans GM ne sont jamais écrasées : on compare avec la
 *     dernière valeur FBI (ev.fbi) ; si l'événement a été retouché, on n'y touche plus.
 *   - Un match sans date reste dans le championnat (« À confirmer ») jusqu'à ce qu'on la saisisse.
 *   - Toutes les rencontres du fichier (même d'autres équipes) sont gardées dans le championnat
 *     (`rencontres`) : si l'export couvre toute la poule, le classement se calcule tout seul.
 * Données : collection `championnats` (id = division + saison). Événements : collection `events`.
 * Le calcul (champLireFbi, champFusionner, champClassement) est pur : voir tests/metier.
 */
var CHAMP_CLE="asmb_championnats";
function getChampionnats(){ try{ return JSON.parse(localStorage.getItem(CHAMP_CLE)||"[]"); }catch(e){ return []; } }
function saveChampionnats(a){ localStorage.setItem(CHAMP_CLE,JSON.stringify(a)); fsWriteCollection("championnats",a); }

function champNorm(s){
  return String(s==null?"":s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
// « ASSOCIATION SPORTIVE MAGIQUE BASKET (6) » → {nom, num}
function champEquipe(s){
  var t=String(s==null?"":s).trim(), m=t.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m?{nom:m[1].trim(),num:parseInt(m[2],10)}:{nom:t,num:null};
}
function champDateIso(v){
  if(v==null||v==="") return "";
  if(v instanceof Date && !isNaN(v)) return v.getFullYear()+"-"+("0"+(v.getMonth()+1)).slice(-2)+"-"+("0"+v.getDate()).slice(-2);
  var s=String(v).trim(), m=s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if(m) return m[3]+"-"+("0"+m[2]).slice(-2)+"-"+("0"+m[1]).slice(-2);
  m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m?m[1]+"-"+m[2]+"-"+m[3]:"";
}
function champHeure(v){
  if(v==null||v==="") return "";
  if(typeof v==="number"&&v>=0&&v<1){ var mn=Math.round(v*1440); return ("0"+Math.floor(mn/60)).slice(-2)+":"+("0"+(mn%60)).slice(-2); }
  var m=String(v).trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})/);
  return m?("0"+m[1]).slice(-2)+":"+m[2]:"";
}
function champScore(v){ var s=String(v==null?"":v).trim(); return /^\d+$/.test(s)?parseInt(s,10):null; }
function champOui(v){ return /^(oui|o|1|true|vrai|yes)$/.test(champNorm(v)); }

// Lit les lignes (tableau de tableaux) d'un export FBI « rechercherRencontre ».
// Renvoie {ok, erreur, division, rencontres:[...], candidats:[{nom,num,n}]}.
function champLireFbi(rows){
  var COL={division:"division",num:"n de match",eq1:"equipe 1",eq2:"equipe 2",date:"date de rencontre",heure:"heure",salle:"salle",emarque:"e marque v2",s1:"score 1",f1:"forfait 1",s2:"score 2",f2:"forfait 2"};
  var h=-1, idx={};
  for(var i=0;i<Math.min((rows||[]).length,10);i++){
    var heads=(rows[i]||[]).map(champNorm);
    if(heads.indexOf("equipe 1")>=0 && heads.indexOf("equipe 2")>=0){
      h=i; Object.keys(COL).forEach(function(k){ idx[k]=heads.indexOf(COL[k]); }); break;
    }
  }
  if(h<0) return {ok:false,erreur:"Ce fichier ne ressemble pas à l'export FBI « Rechercher rencontre » (colonnes Équipe 1 / Équipe 2 introuvables)."};
  var cell=function(r,k){ return idx[k]>=0?r[idx[k]]:""; };
  var rencontres=[], divisions={};
  for(var j=h+1;j<rows.length;j++){
    var r=rows[j]||[];
    var e1=champEquipe(cell(r,"eq1")), e2=champEquipe(cell(r,"eq2"));
    if(!e1.nom||!e2.nom) continue;
    var div=String(cell(r,"division")||"").trim(), num=String(cell(r,"num")==null?"":cell(r,"num")).trim();
    divisions[div]=(divisions[div]||0)+1;
    rencontres.push({
      key:div+"|"+num, division:div, num:num,
      e1:e1.nom, n1:e1.num, e2:e2.nom, n2:e2.num,
      date:champDateIso(cell(r,"date")), heure:champHeure(cell(r,"heure")), salle:String(cell(r,"salle")||"").trim(),
      emarque:String(cell(r,"emarque")||"").trim(),
      s1:champScore(cell(r,"s1")), s2:champScore(cell(r,"s2")), f1:champOui(cell(r,"f1")), f2:champOui(cell(r,"f2"))
    });
  }
  if(!rencontres.length) return {ok:false,erreur:"Aucune rencontre dans ce fichier."};
  var divNoms=Object.keys(divisions).sort(function(a,b){ return divisions[b]-divisions[a]; });
  // Équipes présentes, de la plus fréquente à la moins fréquente : la nôtre est en tête.
  var cnt={};
  rencontres.forEach(function(m){ [[m.e1,m.n1],[m.e2,m.n2]].forEach(function(p){ var k=p[0]+"|"+(p[1]==null?"":p[1]); cnt[k]=cnt[k]||{nom:p[0],num:p[1],n:0}; cnt[k].n++; }); });
  var candidats=Object.keys(cnt).map(function(k){ return cnt[k]; }).sort(function(a,b){ return b.n-a.n||a.nom.localeCompare(b.nom); });
  return {ok:true,division:divNoms[0]||"",divisions:divNoms,rencontres:rencontres,candidats:candidats};
}

function champEstNous(m,nous){ // nous = {nom,num}
  if(!nous) return 0;
  var a=m.e1===nous.nom&&(nous.num==null||m.n1===nous.num), b=m.e2===nous.nom&&(nous.num==null||m.n2===nous.num);
  return a?1:(b?2:0);
}
// Un match vu de notre équipe.
function champMatchNous(m,nous){
  var c=champEstNous(m,nous); if(!c) return null;
  var dom=c===1, adv=dom?{nom:m.e2,num:m.n2}:{nom:m.e1,num:m.n1};
  var sn=dom?m.s1:m.s2, se=dom?m.s2:m.s1;
  return {
    key:m.key, division:m.division, num:m.num, domicile:dom,
    adversaire:adv.nom+(adv.num!=null?" ("+adv.num+")":""), advNom:adv.nom,
    date:m.date, heure:m.heure, salle:m.salle, emarque:m.emarque,
    scoreNous:sn, scoreEux:se, forfaitNous:dom?m.f1:m.f2, forfaitEux:dom?m.f2:m.f1,
    joue:(sn!=null&&se!=null)
  };
}

// Fusionne les matchs de notre équipe dans la liste d'événements du planning.
// Ne modifie pas `events` : renvoie {events, ajoutes, majs, gardes, sansDate:[...]}.
// champId : id du championnat ; equipeGm : nom de l'équipe GM (facultatif).
function champFusionner(events,champId,matchsNous,equipeGm){
  var out=(events||[]).slice(), ajoutes=0, majs=0, gardes=0, sansDate=[];
  matchsNous.forEach(function(m){
    var i=-1; for(var k=0;k<out.length;k++){ if(out[k].champId===champId&&out[k].champKey===m.key){ i=k; break; } }
    var score=m.joue?{adversaire:m.advNom,asmb:m.scoreNous,adv:m.scoreEux}:null;
    if(i<0){
      if(!m.date){ sansDate.push(m); return; }          // pas de date : on attend qu'elle soit saisie
      var ev={
        id:"champ-"+champId+"-"+m.num, champId:champId, champKey:m.key, type:"match",
        titre:"Match · "+(equipeGm||m.division)+" · "+(m.domicile?"vs ":"à ")+m.advNom,
        date:m.date, heure:m.heure, lieu:m.salle, equipe:equipeGm||"",
        notes:"Division "+m.division+" · match n°"+m.num+(m.emarque?" · e-Marque "+m.emarque:"")+(m.domicile?" · à domicile":" · à l'extérieur"),
        domicile:m.domicile, adversaire:m.adversaire,
        fbi:{date:m.date,heure:m.heure,lieu:m.salle}
      };
      if(score) ev.score=score;
      out.push(ev); ajoutes++; return;
    }
    var e=Object.assign({},out[i]), f=e.fbi||{}, change=false, garde=false;
    // Date, heure, salle : on met à jour seulement si personne ne les a retouchées dans GM.
    ["date","heure","lieu"].forEach(function(champ){
      var cleFbi=champ, nouveau=(champ==="lieu")?m.salle:m[champ];
      if((e[champ]||"")===(f[cleFbi]||"")){ if(nouveau && nouveau!==(e[champ]||"")){ e[champ]=nouveau; change=true; } }
      else garde=true;
    });
    e.fbi={date:m.date||f.date||"",heure:m.heure||f.heure||"",lieu:m.salle||f.lieu||""};
    if(score && (!e.score||e.score.asmb!==score.asmb||e.score.adv!==score.adv)){ e.score=score; change=true; }
    e.adversaire=m.adversaire; e.domicile=m.domicile;
    out[i]=e; if(change) majs++; if(garde) gardes++;
  });
  return {events:out,ajoutes:ajoutes,majs:majs,gardes:gardes,sansDate:sansDate};
}

// Classement de la poule d'après les rencontres jouées : victoire 2 pts, défaite 1, forfait 0.
function champClassement(rencontres){
  var T={}, get=function(nom,num){ var k=nom+"|"+(num==null?"":num); return T[k]||(T[k]={nom:nom,num:num,j:0,g:0,p:0,f:0,pts:0,pp:0,pc:0}); };
  (rencontres||[]).forEach(function(m){
    var a=get(m.e1,m.n1), b=get(m.e2,m.n2);   // l'équipe existe au classement même sans match joué
    var joue=(m.s1!=null&&m.s2!=null)||m.f1||m.f2;
    if(!joue) return;
    a.j++; b.j++;
    if(m.f1||m.f2){
      if(m.f1&&!m.f2){ a.f++; a.p++; b.g++; b.pts+=2; }
      else if(m.f2&&!m.f1){ b.f++; b.p++; a.g++; a.pts+=2; }
      else { a.f++; b.f++; a.p++; b.p++; }
    } else if(m.s1>m.s2){ a.g++; a.pts+=2; b.p++; b.pts+=1; }
    else if(m.s2>m.s1){ b.g++; b.pts+=2; a.p++; a.pts+=1; }
    else { a.pts+=1; b.pts+=1; }
    if(m.s1!=null&&m.s2!=null){ a.pp+=m.s1; a.pc+=m.s2; b.pp+=m.s2; b.pc+=m.s1; }
  });
  return Object.keys(T).map(function(k){ var t=T[k]; t.diff=t.pp-t.pc; return t; })
    .sort(function(x,y){ return y.pts-x.pts||y.diff-x.diff||y.pp-x.pp||x.nom.localeCompare(y.nom); })
    .map(function(t,i){ t.rang=i+1; return t; });
}

// Le classement n'a de sens que si le fichier contient aussi des matchs d'autres équipes (toute la poule).
function champPouleComplete(c){
  var autres=(c.rencontres||[]).filter(function(m){ return !champEstNous(m,c.nous); });
  return autres.length>=3;
}
// Bilan de notre équipe : {j,g,p}
function champBilan(matchsNous){
  var b={j:0,g:0,p:0};
  matchsNous.forEach(function(m){ if(!m.joue&&!m.forfaitNous&&!m.forfaitEux) return; b.j++; if(m.forfaitNous||(m.joue&&m.scoreNous<m.scoreEux)) b.p++; else b.g++; });
  return b;
}
function champId(division,saison){ return String(division||"").replace(/[^A-Za-z0-9]+/g,"-")+"_"+String(saison||"").replace(/[^0-9]+/g,"-"); }


// ── Synchro FFBB (Cloud Function onFfbbDemande, voir functions/index.js) ──
// Le classement officiel et les scores viennent de la FFBB (API non officielle) : si elle
// ne répond pas, on garde ce qui est déjà là et on le dit.
function champDemande(data){
  if(!window.fbAddDoc||!window.fbDb) return Promise.reject(new Error("Connexion indisponible"));
  var d=Object.assign({at:new Date(),uid:window.ASMB_USER.uid},data);
  return window.fbAddDoc(window.fbCollection(window.fbDb,"ffbb_demandes"),d).then(function(ref){
    return new Promise(function(resolve,reject){
      var n=0, t=setInterval(function(){
        n++;
        window.fbGetDoc(ref).then(function(sn){
          var r=sn&&sn.exists&&sn.exists()?sn.data():null;
          if(r&&typeof r.ok==="boolean"){ clearInterval(t); r.ok?resolve(r):reject(new Error(r.erreur||"Échec")); }
          else if(n>=30){ clearInterval(t); reject(new Error("Pas de réponse du serveur (fonctions déployées ?)")); }
        }).catch(function(){});
      },1000);
    });
  });
}
// Extrait l'identifiant de poule d'un texte collé (nombre seul ou lien contenant le nombre).
function champPouleDepuisTexte(t){
  var m=String(t||"").match(/\d{4,}/g); return m?m[m.length-1]:"";
}
// Après une synchro serveur : les matchs de NOTRE équipe sont fusionnés dans le planning
// (dates corrigées dans GM jamais écrasées). Une fois par version de championnat et par appareil.
function champSyncPlanning(){
  try{
    if(!champPeutEcrire()) return;
    // Une seule fois par appareil : propose de lier les championnats déjà importés à la FFBB.
    if(!localStorage.getItem("gm_ffbb_invite") && getChampionnats().some(function(c){ return !c.ffbb; })){
      localStorage.setItem("gm_ffbb_invite","1");
      if(typeof showToast==="function") showToast("Nouveau : liez vos championnats à la FFBB (classement et scores automatiques) — Championnats › Lier à la FFBB");
    }
    var mk={}; try{ mk=JSON.parse(localStorage.getItem("gm_champ_merge")||"{}"); }catch(e){}
    var chg=false, ev=getEvents();
    getChampionnats().forEach(function(c){
      if(!c.ffbb||!c.maj||(mk[c.id]||0)>=c.maj||!c.nous) return;
      var mn=(c.rencontres||[]).map(function(m){ return champMatchNous(m,c.nous); }).filter(Boolean);
      ev=champFusionner(ev,c.id,mn,c.equipe).events; mk[c.id]=c.maj; chg=true;
    });
    if(chg){ saveEvents(ev); localStorage.setItem("gm_champ_merge",JSON.stringify(mk)); try{ buildPlanning(); }catch(e){} }
  }catch(e){ console.log("champSyncPlanning",e); }
}
// Classement à afficher : officiel FFBB s'il existe, sinon calculé par GM.
function champClassementAffiche(c){
  if(c.classementFfbb&&c.classementFfbb.length>=3) return {liste:c.classementFfbb,officiel:true};
  var cl=champPouleComplete(c)?champClassement(c.rencontres||[]):[];
  return cl.length>=3?{liste:cl,officiel:false}:null;
}
function champTableHtml(c,cl){
  var h='<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="text-align:left;color:var(--mut)"><th style="padding:6px 4px">#</th><th>Équipe</th><th>Pts</th><th>J</th><th>G</th><th>P</th><th>Diff</th></tr>';
  cl.forEach(function(t){
    var moi=c.nous&&t.nom===c.nous.nom&&t.num===c.nous.num;
    h+='<tr style="border-top:1px solid var(--bdr);'+(moi?'font-weight:800;background:color-mix(in srgb, var(--dkg) 10%, transparent)':'')+'"><td style="padding:7px 4px">'+t.rang+'</td><td>'+authEsc(t.nom)+(t.num!=null?' ('+t.num+')':'')+'</td><td>'+t.pts+'</td><td>'+t.j+'</td><td>'+t.g+'</td><td>'+t.p+'</td><td>'+(t.diff>0?'+':'')+t.diff+'</td></tr>';
  });
  return h+'</table>';
}
// Vue parents / joueurs : classement du championnat de l'équipe active.
function champParentBloc(el,team){
  if(!el||!team) return;
  var liste=getChampionnats().filter(function(c){ return c.equipe&&c.equipe===team.name&&champClassementAffiche(c); });
  if(!liste.length) return;
  var zone=document.createElement("div"); el.insertBefore(zone,el.firstChild);
  zone.innerHTML=liste.map(function(c){
    var a=champClassementAffiche(c);
    return '<div style="background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;margin-bottom:14px;box-shadow:0 2px 12px var(--sh,rgba(0,0,0,.06))">'
      +'<div style="font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Classement · '+authEsc(c.division)+'</div>'
      +'<div style="overflow-x:auto">'+champTableHtml(c,a.liste)+'</div>'
      +'<div style="font-size:10px;color:var(--mut);margin-top:8px">'+(a.officiel?'Classement FFBB':'Calculé par General Manager')+(c.maj?' · mis à jour le '+new Date(c.maj).toLocaleDateString("fr-FR"):'')+'</div></div>';
  }).join("");
}

// ── Écrans ──────────────────────────────────────────────────────────────
function champPeutEcrire(){
  var u=window.ASMB_USER, roles=(u&&u.roles)||[];
  return roles.indexOf("dirigeant")>=0||roles.indexOf("coach")>=0;
}
function champLireFichier(file){
  return new Promise(function(resolve,reject){
    var rd=new FileReader();
    rd.onerror=function(){ reject(new Error("Lecture du fichier impossible")); };
    rd.onload=function(){
      chargerXlsx().then(function(){
        try{
          var wb=XLSX.read(new Uint8Array(rd.result),{type:"array",cellDates:true});
          var ws=wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws,{header:1,raw:false,dateNF:"dd/mm/yyyy",defval:""}));
        }catch(e){ reject(e); }
      }).catch(reject);
    };
    rd.readAsArrayBuffer(file);
  });
}
function champOuvrir(){
  if(!champPeutEcrire()){ askAlert("Réservé au dirigeant et aux coachs."); return; }
  var s=gmSheet("Championnats");
  dessiner();
  function dessiner(){
    s.body.innerHTML="";
    var liste=getChampionnats();
    if(!liste.length){
      s.body.innerHTML=gmVide({icone:"equipe",titre:"Aucun championnat suivi",
        texte:"Importez l'export FBI « Rechercher rencontre » de votre équipe : le calendrier, les salles, les heures et les scores arrivent dans le planning, sans ressaisie.",
        bouton:{label:"Importer un export FBI",action:"window.__champChoisir()"}});
      window.__champChoisir=function(){ choisirFichier(null); };
      return;
    }
    gmSection(s.body,"Championnats suivis","Réimportez l'export FBI quand les scores ou le calendrier changent : vos dates corrigées ne sont jamais écrasées.");
    liste.forEach(function(c){
      var card=gmCard(), nous=c.nous, mn=(c.rencontres||[]).map(function(m){ return champMatchNous(m,nous); }).filter(Boolean);
      var b=champBilan(mn), apres=mn.filter(function(m){ return !m.joue&&m.date&&m.date>=new Date().toISOString().slice(0,10); }).sort(function(x,y){ return x.date<y.date?-1:1; })[0];
      var sans=mn.filter(function(m){ return !m.date; }).length;
      var t=document.createElement("div"); t.style.cssText="font-size:14px;font-weight:800;color:var(--txt)";
      t.textContent=c.division+(c.equipe?" · "+c.equipe:""); card.appendChild(t);
      var d=document.createElement("div"); d.style.cssText="font-size:12px;color:var(--mut);margin:4px 0 8px;line-height:1.5";
      d.textContent=mn.length+" match(s) · "+b.j+" joué(s) : "+b.g+" gagné(s), "+b.p+" perdu(s)"+(apres?" · prochain : "+apres.date.split("-").reverse().join("/")+(apres.heure?" à "+apres.heure:"")+" vs "+apres.advNom:"")+(sans?" · "+sans+" sans date":"")+" · mis à jour le "+new Date(c.maj||Date.now()).toLocaleDateString("fr-FR");
      card.appendChild(d);
      if(c.ffbb&&c.ffbb.pouleId){
        var fs=document.createElement("div"); fs.style.cssText="font-size:11px;color:"+(c.ffbb.erreur?"var(--red,#c0392b)":"var(--mut)")+";margin:-4px 0 8px";
        fs.textContent=c.ffbb.erreur?"FFBB : dernière actualisation en échec ("+c.ffbb.erreur+") — données précédentes conservées":"Lié à la FFBB · actualisé chaque nuit"+(c.ffbb.maj?" · dernière fois le "+new Date(c.ffbb.maj).toLocaleDateString("fr-FR"):"");
        card.appendChild(fs);
      }
      var r=gmRow(card);
      if(c.ffbb&&c.ffbb.pouleId) r.appendChild(gmBtn("Actualiser maintenant","primary",function(){ actualiser(c,this); }));
      else r.appendChild(gmBtn("Lier à la FFBB","primary",function(){ lierFfbb(c); }));
      r.appendChild(gmBtn("Réimporter","soft",function(){ choisirFichier(c); }));
      var aff=champClassementAffiche(c), cl=aff?aff.liste:[];
      if(cl.length>=3) r.appendChild(gmBtn("Classement","soft",function(){ afficherClassement(c,cl,aff.officiel); }));
      if(sans) r.appendChild(gmBtn("Dates à confirmer ("+sans+")","soft",function(){ confirmerDates(c); }));
      r.appendChild(gmBtn("Retirer","danger",function(){
        askConfirm("Retirer ce championnat ? Les matchs déjà au planning sont conservés.",{danger:true,confirmText:"Retirer"}).then(function(ok){
          if(!ok) return; saveChampionnats(getChampionnats().filter(function(x){ return x.id!==c.id; })); dessiner();
        });
      }));
      s.body.appendChild(card);
    });
    var r2=gmRow(s.body);
    r2.appendChild(gmBtn("+ Importer un export FBI","primary",function(){ choisirFichier(null); }));
  }
  function actualiser(c,btn){
    if(btn){ btn.disabled=true; btn.textContent="Actualisation…"; }
    champDemande({action:"actualiser",champId:c.id}).then(function(r){
      var ch=(r.changements||[]);
      showToast(ch.length?ch.join(" · "):"À jour, rien de nouveau");
      setTimeout(function(){ champSyncPlanning(); dessiner(); },700);
    }).catch(function(e){ askAlert("Actualisation impossible : "+((e&&e.message)||e)+"\nVos données actuelles sont conservées."); dessiner(); });
  }
  function lierFfbb(c){
    s.body.innerHTML='<div style="font-size:12px;color:var(--mut)">Recherche de la poule sur la FFBB…</div>';
    var nums=(c.rencontres||[]).map(function(m){ return m.num; }).filter(Boolean).slice(0,4);
    champDemande({action:"trouver",numeros:nums}).then(function(r){
      var p=(r.poules||[])[0];
      if(!p){ saisirPoule(c,"Poule non trouvée automatiquement."); return; }
      s.body.innerHTML="";
      gmSection(s.body,"Poule trouvée","Poule FFBB n° "+p.id+" ("+p.votes+" match(s) correspondent). Vérifiez après l'actualisation que le classement est bien celui de votre division.");
      var rr=gmRow(s.body);
      rr.appendChild(gmBtn("C'est bon, lier","primary",function(){ lier(c,p.id); }));
      rr.appendChild(gmBtn("Autre numéro","soft",function(){ saisirPoule(c,""); }));
      rr.appendChild(gmBtn("Annuler","ghost",dessiner));
    }).catch(function(e){ saisirPoule(c,"Recherche impossible ("+((e&&e.message)||e)+")."); });
  }
  function saisirPoule(c,msg){
    s.body.innerHTML="";
    gmSection(s.body,"Lier à la FFBB",(msg?msg+" ":"")+"Collez le lien de la poule (page de votre division sur ffbb.com) ou son numéro.");
    var inp=document.createElement("input"); inp.type="text"; inp.placeholder="Lien ou numéro de poule"; inp.style.cssText="width:100%;padding:10px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--bg);color:var(--txt);font-size:13px;margin-bottom:10px;box-sizing:border-box";
    s.body.appendChild(inp);
    var rr=gmRow(s.body);
    rr.appendChild(gmBtn("Lier","primary",function(){ var id=champPouleDepuisTexte(inp.value); if(!id){ askAlert("Numéro de poule introuvable dans ce texte."); return; } lier(c,id); }));
    rr.appendChild(gmBtn("Annuler","ghost",dessiner));
  }
  function lier(c,pouleId){
    s.body.innerHTML='<div style="font-size:12px;color:var(--mut)">Liaison et premier téléchargement…</div>';
    var liste=getChampionnats().map(function(x){ return x.id===c.id?Object.assign({},x,{ffbb:{pouleId:String(pouleId),maj:0,erreur:""}}):x; });
    saveChampionnats(liste);
    setTimeout(function(){ actualiser(c,null); },1200);   // laisse le temps à la liaison d'arriver sur le serveur
  }
  function choisirFichier(cible){
    var inp=document.createElement("input"); inp.type="file"; inp.accept=".xlsx,.xls,.csv";
    inp.onchange=function(){
      var f=inp.files&&inp.files[0]; if(!f) return;
      s.body.innerHTML='<div style="font-size:12px;color:var(--mut)">Lecture du fichier…</div>';
      champLireFichier(f).then(function(rows){
        var res=champLireFbi(rows);
        if(!res.ok){ askAlert(res.erreur); dessiner(); return; }
        apercu(res,cible);
      }).catch(function(e){ askAlert("Erreur : "+((e&&e.message)||e)); dessiner(); });
    };
    inp.click();
  }
  function apercu(res,cible){
    s.body.innerHTML="";
    gmSection(s.body,"Division "+res.division,res.rencontres.length+" rencontre(s) dans le fichier.");
    var c1=gmCard();
    var l1=document.createElement("div"); l1.style.cssText="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--txt)"; l1.textContent="Votre équipe dans ce fichier";
    var sel=document.createElement("select"); sel.style.cssText="width:100%;padding:10px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--bg);color:var(--txt);font-size:13px;margin-bottom:10px";
    var def=0;
    if(cible&&cible.nous){ res.candidats.forEach(function(c,i){ if(c.nom===cible.nous.nom&&c.num===cible.nous.num) def=i; }); }
    res.candidats.forEach(function(c,i){ var o=document.createElement("option"); o.value=String(i); o.textContent=c.nom+(c.num!=null?" ("+c.num+")":"")+" — "+c.n+" match(s)"; if(i===def) o.selected=true; sel.appendChild(o); });
    c1.appendChild(l1); c1.appendChild(sel);
    var l2=document.createElement("div"); l2.style.cssText="font-size:12px;font-weight:700;margin-bottom:4px;color:var(--txt)"; l2.textContent="Équipe dans General Manager (facultatif)";
    var sg=document.createElement("select"); sg.style.cssText=sel.style.cssText;
    var o0=document.createElement("option"); o0.value=""; o0.textContent="— Aucune —"; sg.appendChild(o0);
    (getTeams()||[]).forEach(function(t){ var o=document.createElement("option"); o.value=t.name||""; o.textContent=t.name||""; if(cible&&cible.equipe===t.name) o.selected=true; sg.appendChild(o); });
    c1.appendChild(l2); c1.appendChild(sg);
    var info=document.createElement("div"); info.style.cssText="font-size:12px;color:var(--mut);line-height:1.5";
    c1.appendChild(info); s.body.appendChild(c1);
    function maj(){
      var nous=res.candidats[+sel.value]; var mn=res.rencontres.map(function(m){ return champMatchNous(m,nous); }).filter(Boolean);
      var b=champBilan(mn), sans=mn.filter(function(m){ return !m.date; }).length;
      info.textContent=mn.length+" match(s) pour cette équipe · "+b.j+" joué(s) · "+sans+" sans date.";
    }
    sel.onchange=maj; maj();
    var r=gmRow(s.body);
    r.appendChild(gmBtn("Importer","primary",function(){ importer(res,res.candidats[+sel.value],sg.value); }));
    r.appendChild(gmBtn("Annuler","ghost",dessiner));
  }
  function importer(res,nous,equipeGm){
    var saison=(typeof getCurrentSeason==="function")?getCurrentSeason():"";
    var id=champId(res.division,saison);
    var mn=res.rencontres.map(function(m){ return champMatchNous(m,{nom:nous.nom,num:nous.num}); }).filter(Boolean);
    var f=champFusionner(getEvents(),id,mn,equipeGm);
    saveEvents(f.events);
    var liste=getChampionnats().filter(function(x){ return x.id!==id; });
    liste.push({id:id,division:res.division,saison:saison,equipe:equipeGm||"",nous:{nom:nous.nom,num:nous.num},rencontres:res.rencontres,maj:Date.now()});
    saveChampionnats(liste);
    try{ buildPlanning(); }catch(e){}
    showToast(f.ajoutes+" match(s) ajouté(s), "+f.majs+" mis à jour"+(f.gardes?", "+f.gardes+" date(s) corrigée(s) conservée(s)":"")+(f.sansDate.length?", "+f.sansDate.length+" sans date":""));
    dessiner();
  }
  function afficherClassement(c,cl,officiel){
    s.body.innerHTML="";
    gmSection(s.body,"Classement · "+c.division,(officiel?"Classement officiel de la FFBB, relu chaque nuit.":"Calculé par General Manager d'après les scores du fichier (victoire 2 pts, défaite 1, forfait 0). Il peut différer du classement officiel en cas d'égalité."));
    var tb=document.createElement("div"); tb.style.cssText="overflow-x:auto";
    var h='<table style="width:100%;border-collapse:collapse;font-size:12px"><tr style="text-align:left;color:var(--mut)"><th style="padding:6px 4px">#</th><th>Équipe</th><th>Pts</th><th>J</th><th>G</th><th>P</th><th>Diff</th></tr>';
    cl.forEach(function(t){
      var moi=c.nous&&t.nom===c.nous.nom&&t.num===c.nous.num;
      h+='<tr style="border-top:1px solid var(--bdr);'+(moi?'font-weight:800;background:color-mix(in srgb, var(--dkg) 10%, transparent)':'')+'"><td style="padding:7px 4px">'+t.rang+'</td><td>'+authEsc(t.nom)+(t.num!=null?' ('+t.num+')':'')+'</td><td>'+t.pts+'</td><td>'+t.j+'</td><td>'+t.g+'</td><td>'+t.p+'</td><td>'+(t.diff>0?"+":"")+t.diff+'</td></tr>';
    });
    tb.innerHTML=h+'</table>'; s.body.appendChild(tb);
    var r=gmRow(s.body); r.appendChild(gmBtn("Retour","ghost",dessiner));
  }
  function confirmerDates(c){
    var mn=(c.rencontres||[]).map(function(m){ return champMatchNous(m,c.nous); }).filter(function(m){ return m&&!m.date; });
    s.body.innerHTML="";
    gmSection(s.body,"Dates à confirmer","La FFBB n'a pas encore publié ces matchs. Saisissez la date et l'heure : elles ne seront jamais écrasées par un nouvel import.");
    var champs=[];
    mn.forEach(function(m){
      var card=gmCard(), t=document.createElement("div"); t.style.cssText="font-size:13px;font-weight:700;color:var(--txt);margin-bottom:8px";
      t.textContent=(m.domicile?"vs ":"à ")+m.advNom+" (match n°"+m.num+")"; card.appendChild(t);
      var d=document.createElement("input"); d.type="date"; d.style.cssText="padding:9px;border-radius:var(--rs);border:1px solid var(--bdr);background:var(--bg);color:var(--txt);margin-right:8px";
      var h=document.createElement("input"); h.type="time"; h.style.cssText=d.style.cssText;
      card.appendChild(d); card.appendChild(h); s.body.appendChild(card); champs.push({m:m,d:d,h:h});
    });
    var r=gmRow(s.body);
    r.appendChild(gmBtn("Enregistrer","primary",function(){
      var ev=getEvents(), n=0;
      champs.forEach(function(x){
        if(!x.d.value) return;
        var mm=Object.assign({},x.m,{date:x.d.value,heure:x.h.value||x.m.heure});
        var f=champFusionner(ev,c.id,[mm],c.equipe); ev=f.events; n++;
        // La date saisie ici est la nôtre : l'import FBI suivant ne la remplacera pas.
        ev=ev.map(function(e){ if(e.champId===c.id&&e.champKey===mm.key) e.fbi={date:"",heure:"",lieu:e.fbi&&e.fbi.lieu||""}; return e; });
      });
      if(n){ saveEvents(ev); try{ buildPlanning(); }catch(e){} showToast(n+" match(s) ajouté(s) au planning"); }
      dessiner();
    }));
    r.appendChild(gmBtn("Retour","ghost",dessiner));
  }
}
