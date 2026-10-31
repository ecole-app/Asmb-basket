/* ===== 03d-premiers-pas.js — « Premiers pas » du dirigeant (accueil) =====
   Carte de démarrage d'un nouveau club : 5 étapes qui se cochent toutes seules
   (logo, équipes, coachs, licenciés, premier entraînement ou match), barre de progression,
   bouton de l'étape qui ouvre le bon écran. « Masquer pour l'instant » = cachée 3 jours.
   Tout fait → carte « Ton club est prêt ! » une fois, puis plus jamais (« J'ai compris »).
   Un club déjà complet à la première visite ne voit rien. Mémoire par appareil et par club
   (localStorage gm_pp_<clubId>). Téléphone : #gm-premiers-pas (index.html) ;
   ordinateur : #dk-pp dans renderDeskHome (js/03c). */

var PP_COACHS=null, PP_COACHS_CLUB=""; // null = pas encore vérifié, sinon true/false (comptes coach du club)

function ppCle(){ return "gm_pp_"+(window.CURRENT_CLUB_ID||""); }
function ppEtat(){ try{ return JSON.parse(localStorage.getItem(ppCle())||"{}")||{}; }catch(e){ return {}; } }
function ppSauver(e){ try{ localStorage.setItem(ppCle(),JSON.stringify(e)); }catch(x){} }

function ppVerifierCoachs(){
  if(PP_COACHS_CLUB!==window.CURRENT_CLUB_ID){ PP_COACHS=null; PP_COACHS_CLUB=window.CURRENT_CLUB_ID||""; }
  if(PP_COACHS!==null||!window.fbGetDocs||!window.fbDb||!window.CURRENT_CLUB_ID) return;
  PP_COACHS=false;
  window.fbGetDocs(window.fbQuery(window.fbCollection(window.fbDb,"users"),window.fbWhere("clubId","==",window.CURRENT_CLUB_ID))).then(function(sn){
    var ok=false; sn.forEach(function(d){ var r=(d.data()||{}).roles||[]; if(r.indexOf("coach")>=0) ok=true; });
    PP_COACHS=ok; ppAfficher();
  }).catch(function(){});
}

function ppEtapes(){
  var c=window.CURRENT_CLUB||{};
  var equipes=(typeof getTeams==="function")?getTeams():[];
  var joueurs=(typeof getPlayers==="function")?getPlayers():[];
  var lics=(typeof getLicences==="function")?getLicences():[];
  var evts=(typeof getEvents==="function")?getEvents():[];
  var nEq=equipes.length;
  return [
    {id:"logo", titre:"Logo et couleurs du club", sous:"Ton club à ton image dans toute l'appli", bouton:"Ajouter",
      fait:!!c.logo, go:function(){ paramsOuvrirGroupe("club","identite"); }},
    {id:"equipes", titre:"Créer tes équipes", sous:nEq?(nEq+(nEq>1?" équipes créées":" équipe créée")):"Une équipe par catégorie", bouton:"Créer",
      fait:nEq>0, go:function(){ ppOuvrirModule("equipes"); }},
    {id:"coachs", titre:"Inviter tes coachs", sous:"Ils gèrent leurs équipes et convocations", bouton:"Inviter",
      fait:PP_COACHS===true, go:function(){ ppOuvrirModule("invitations"); }},
    {id:"licencies", titre:"Ajouter tes licenciés", sous:"Import Excel / FBI ou lien d'inscription", bouton:"Ajouter",
      fait:joueurs.length>0||lics.length>0, go:function(){ ppOuvrirModule("licences"); }},
    {id:"planning", titre:"Placer un premier entraînement ou match", sous:"Les familles le voient tout de suite", bouton:"Planifier",
      fait:evts.some(function(e){ return e.type==="entrainement"||e.type==="match"; }), go:function(){ ppOuvrirModule("planning"); }}
  ];
}
function ppOuvrirModule(mod){
  if(typeof gmDeskOn==="function"&&gmDeskOn()&&typeof gmDeskOuvrir==="function"){ gmDeskOuvrir(mod); return; }
  if(typeof stack!=="undefined") stack=["portal"];
  openAdminModule(mod);
}
function ppGo(id){ var e=ppEtapes().filter(function(x){ return x.id===id; })[0]; if(e) e.go(); }

function ppVisible(){
  var roles=(window.ASMB_USER&&window.ASMB_USER.roles)||[];
  if(roles.indexOf("dirigeant")<0) return false;
  if(localStorage.getItem("asmb_profile")==="coach") return false;
  var c=window.CURRENT_CLUB||{};
  if(c.type==="independant") return false;
  if(typeof isLimite==="function"&&isLimite()) return false;
  return true;
}

function ppHtml(){
  if(!ppVisible()) return "";
  var et=ppEtat();
  if(et.fini) return "";
  if(et.masque&&Date.now()<et.masque) return "";
  ppVerifierCoachs();
  var l=ppEtapes(), n=l.filter(function(x){ return x.fait; }).length;
  if(n===l.length){
    // Club déjà complet la première fois qu'on le voit : rien à fêter.
    if(!et.vu){ et.fini=true; ppSauver(et); return ""; }
    return '<div class="pp-card pp-fin"><div style="font-size:26px">🎉</div><b>Ton club est prêt !</b>'+
      '<div class="pp-fin-tx">Coachs, licenciés et planning sont en place. Prochaine étape conseillée : installer l\'appli sur ton téléphone.</div>'+
      '<button class="pp-go pp-or" onclick="ppFinir()">J\'ai compris</button></div>';
  }
  if(!et.vu){ et.vu=true; ppSauver(et); }
  var suivante=l.filter(function(x){ return !x.fait; })[0];
  var h='<div class="pp-card"><div class="pp-t"><b>🚀 Premiers pas</b><span class="pp-pct">'+n+' / '+l.length+'</span></div>'+
    '<div class="pp-bar"><i style="width:'+Math.round(n/l.length*100)+'%"></i></div>'+
    '<div class="pp-sub">Ton club est prêt en 5 étapes, environ 15 minutes.</div>';
  l.forEach(function(x,i){
    var cl=x.fait?"ok":(x===suivante?"todo next":"todo");
    h+='<div class="pp-st '+cl+'"><div class="pp-ck">'+(x.fait?"✓":(i+1))+'</div>'+
      '<div class="pp-tx">'+(x===suivante?'<b>'+x.titre+'</b>':x.titre)+'<small>'+authEsc(x.sous)+'</small></div>'+
      (x.fait?'':'<button class="pp-go'+(x===suivante?'':' pp-clair')+'" onclick="ppGo(\''+x.id+'\')">'+x.bouton+'</button>')+'</div>';
  });
  return h+'<button class="pp-masquer" onclick="ppMasquer()">Masquer pour l\'instant</button></div>';
}
function ppAfficher(){
  var h=ppHtml();
  var m=document.getElementById("gm-premiers-pas"); if(m){ m.innerHTML=h; m.style.display=h?"block":"none"; }
  var d=document.getElementById("dk-pp"); if(d) d.innerHTML=h;
}
function ppMasquer(){ var e=ppEtat(); e.masque=Date.now()+3*86400000; ppSauver(e); ppAfficher(); }
function ppFinir(){ var e=ppEtat(); e.fini=true; ppSauver(e); ppAfficher(); }
