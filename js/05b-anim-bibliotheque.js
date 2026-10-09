/* ===== 05b-anim-bibliotheque.js — Bibliotheque d'animations rattachables ===== */
//
// POURQUOI CE FICHIER
// Les 47 animations de 05-animations.js etaient adressees par leur POSITION :
// la cle "1.1-2" signifiait "2e situation de la seance 1.1". Trois consequences :
//   1. une seance creee par le coach n'avait jamais d'animation (sa cle n'existe pas) ;
//   2. une seance modifiee pouvait afficher l'animation d'un autre exercice ;
//   3. les six autres categories (U9, U11, U15, U17M, U18F, U21M) n'en avaient aucune,
//      alors que les memes gestes y sont travailles.
// Ici les animations deviennent une bibliotheque nommee et taguee, que le coach
// rattache a n'importe quelle situation de n'importe quelle categorie. Le dessin
// lui-meme n'est pas touche : seule la facon de le designer change.

// Les cles positionnelles ne font foi que pour la categorie pour laquelle ces
// animations ont ete dessinees. Les appliquer ailleurs afficherait silencieusement
// le mauvais exercice — exactement le defaut qu'on corrige ici.
var ANIM_LEGACY_CAT="u13";

// Chaque entree porte le nom de la situation pour laquelle elle a ete dessinee,
// et des themes qui permettent de la retrouver hors de son contexte d'origine.
var ANIM_LIB=[
 {id:"1.1-1",n:"Circuit de dribble slalom",tags:["Dribble","Motricité"]},
 {id:"1.1-2",n:"Jeu du requin",tags:["Dribble","Duel"]},
 {id:"1.1-3",n:"Tir libre - Bombe",tags:["Tir"]},
 {id:"1.2-1",n:"Dribble miroir",tags:["Dribble","Réactivité"]},
 {id:"1.2-2",n:"Navettes dribble",tags:["Dribble","Athlétique"]},
 {id:"1.2-3",n:"1c1 attaque défense",tags:["Duel","Dribble","Défense"]},
 {id:"1.3-1",n:"Mur de passes",tags:["Passe"]},
 {id:"1.3-2",n:"Triangles - passe et déplacement",tags:["Passe","Démarquage"]},
 {id:"1.3-3",n:"2c0 - montée collective",tags:["Passe","Transition"]},
 {id:"1.4-1",n:"BEEF sans ballon",tags:["Tir"]},
 {id:"1.4-2",n:"5 spots de tir",tags:["Tir"]},
 {id:"1.4-3",n:"Lay-up droit puis gauche",tags:["Tir","Motricité"]},
 {id:"1.5-1",n:"Glissades défensives",tags:["Défense","Athlétique"]},
 {id:"1.5-2",n:"Pivot",tags:["Fondamentaux"]},
 {id:"1.5-3",n:"3v3 défense individuelle",tags:["Défense","Opposition"]},
 {id:"2.1-1",n:"Passe-et-va",tags:["Passe","Jeu à deux"]},
 {id:"2.1-2",n:"Surnombre 2v1",tags:["Surnombre","Transition"]},
 {id:"2.1-3",n:"3v2 demi-terrain",tags:["Surnombre","Jeu collectif"]},
 {id:"2.2-1",n:"Tag et démarquage",tags:["Démarquage","Motricité"]},
 {id:"2.2-2",n:"3v3 sans dribble",tags:["Jeu collectif","Démarquage","Opposition"]},
 {id:"2.2-3",n:"Match 4v4",tags:["Opposition"]},
 {id:"2.3-1",n:"Remontée en 3 couloirs",tags:["Transition","Jeu collectif"]},
 {id:"2.3-2",n:"Rebond défensif et contre-attaque",tags:["Rebond","Transition"]},
 {id:"2.3-3",n:"Match : contre-attaque valorisée",tags:["Transition","Opposition"]},
 {id:"3.1-1",n:"1v1 tout terrain",tags:["Défense","Duel"]},
 {id:"3.1-2",n:"1v1 avec tir",tags:["Défense","Duel","Tir"]},
 {id:"3.1-3",n:"Boxout et rebond 2v2",tags:["Rebond","Défense"]},
 {id:"3.2-1",n:"Sprint retour",tags:["Défense","Transition","Athlétique"]},
 {id:"3.2-2",n:"Transition défensive 3v3",tags:["Défense","Transition"]},
 {id:"3.2-3",n:"Match - retour obligatoire",tags:["Défense","Opposition"]},
 {id:"3.3-1",n:"Contest de tir",tags:["Défense"]},
 {id:"3.3-2",n:"Défense sur poste bas",tags:["Défense","Postes"]},
 {id:"3.3-3",n:"Match 5v5 évaluation défensive",tags:["Opposition","Défense"]},
 {id:"4.1-1",n:"Fixation-passe",tags:["Jeu à deux","Passe"]},
 {id:"4.1-2",n:"Jeu intérieur-extérieur",tags:["Postes","Jeu collectif"]},
 {id:"4.1-3",n:"3v3 décalage par déplacement",tags:["Jeu collectif","Démarquage"]},
 {id:"4.2-1",n:"Les 5 postes",tags:["Postes","Jeu collectif"]},
 {id:"4.2-2",n:"4v4 avec rôles",tags:["Jeu collectif","Opposition"]},
 {id:"4.2-3",n:"5v5 pression tout terrain",tags:["Défense","Opposition","Transition"]},
 {id:"4.3-1",n:"3v3 transition en alternance",tags:["Transition","Opposition"]},
 {id:"4.3-2",n:"Signal de transition",tags:["Transition","Réactivité"]},
 {id:"4.3-3",n:"Match 5v5 évaluation",tags:["Opposition"]},
 {id:"5.1-1",n:"Dernière action - 10 secondes",tags:["Fin de match","Opposition"]},
 {id:"5.1-2",n:"Remise en jeu rapide",tags:["Fin de match","Transition"]},
 {id:"5.1-3",n:"Communication à voix haute",tags:["Fin de match","Jeu collectif"]},
 {id:"5.2-1",n:"Tournoi 3v3 FIBA",tags:["Opposition","3x3"]},
 {id:"5.2-2",n:"Bilan individuel par stations",tags:["Bilan"]}
];

// Intitules (normalises) dont l'exercice est exactement celui d'une animation
// dessinee a la main, quelle que soit la categorie.
var ANIM_EQUIV_TITRE={
 "les 5 postes":"4.2-1",
 "les 5 zones":"4.2-1",
 "glissades defensives":"1.5-1",
 "glissements defensifs":"1.5-1",
 "glissements et distance de garde":"1.5-1"
};
function animById(id){
 for(var i=0;i<ANIM_LIB.length;i++){ if(ANIM_LIB[i].id===id) return ANIM_LIB[i]; }
 return null;
}
function animNom(id){ var a=animById(id); return a?a.n:id; }
// Themes presents, par ordre alphabetique, sans doublon.
function animTags(){
 var seen={},out=[];
 ANIM_LIB.forEach(function(a){ a.tags.forEach(function(t){ if(!seen[t]){seen[t]=1;out.push(t);} }); });
 return out.sort();
}
// Une animation declaree au catalogue mais absente du moteur ne doit pas etre
// proposee : le selecteur afficherait une vignette vide sans rien expliquer.
function animDisponibles(){
 if(typeof SIT_ANIMS==="undefined") return [];
 return ANIM_LIB.filter(function(a){ return !!SIT_ANIMS[a.id]; });
}

// ── RATTACHEMENTS ───────────────────────────────────────────────────
// Stockes a part du contenu pedagogique : une seance peut donc etre modifiee,
// renommee ou reecrite sans que son animation soit perdue.
// La cle inclut la categorie : deux categories peuvent numeroter leurs seances
// pareil, et un rattachement ne doit jamais deborder de la sienne.
function animKey(catId,seaNum,sitIdx){ return catId+"|"+seaNum+"|"+sitIdx; }
function getAnimAttachments(){
 try{ return JSON.parse(localStorage.getItem("gm_anim_attach")||"{}"); }catch(e){ return {}; }
}
function saveAnimAttachments(o){
 try{ localStorage.setItem("gm_anim_attach",JSON.stringify(o)); }catch(e){}
 if(window.fbDb&&window.fbSetDoc&&window.CURRENT_CLUB_ID){
   window.fbSetDoc(window.fbDoc(window.fbDb,"app_data","anim_attachments"),{data:JSON.stringify(o)},{merge:true}).catch(function(){});
 }
}
function fetchAnimAttachmentsFromCloud(){
 if(!window.fbDb||!window.fbGetDoc||!window.CURRENT_CLUB_ID) return;
 window.fbGetDoc(window.fbDoc(window.fbDb,"app_data","anim_attachments")).then(function(snap){
   if(snap&&snap.exists()&&snap.data().data){
     try{ localStorage.setItem("gm_anim_attach",snap.data().data); }catch(e){}
     if(document.querySelector("#scr-seance.on")&&typeof curCy!=="undefined"&&curCy&&typeof curSea!=="undefined"&&curSea){
       buildSeance(curCy,curSea);
     }
   }
 }).catch(function(){});
}

// Resolution : le choix du coach prime, puis la cle d'origine — et celle-ci
// uniquement dans la categorie pour laquelle les animations ont ete dessinees.
// Ordre : le choix du coach, puis l'animation dessinee a la main quand il en
// existe une, puis le schema genere a partir du texte de la situation. Aucune
// situation ne reste donc sans illustration.
function resolveAnimForSit(catId,seaNum,sitIdx,sit){
 if(typeof SIT_ANIMS==="undefined") return null;
 var att=getAnimAttachments()[animKey(catId,seaNum,sitIdx)];
 if(att==="none") return null;              // animation retiree volontairement
 if(att&&SIT_ANIMS[att]) return att;
 if(catId===ANIM_LEGACY_CAT){
   var legacy=seaNum+"-"+(sitIdx+1);
   if(SIT_ANIMS[legacy]) return legacy;
 }
 // Meme exercice qu'une animation dessinee a la main, sous le meme intitule
 // (ou son equivalent) : on montre le dessin plutot qu'un schema genere.
 if(sit&&typeof gNorm==="function"){
   var eq=ANIM_EQUIV_TITRE[gNorm(sit.ti||"").trim()];
   if(eq&&SIT_ANIMS[eq]) return eq;
 }
 if(sit&&typeof genAnimFor==="function") return genAnimFor(catId,seaNum,sitIdx,sit);
 return null;
}
// Un schema genere n'est pas un contenu de la bibliotheque : il ne doit pas
// apparaitre comme "animation actuelle" dans le selecteur.
function estAnimGeneree(id){ return typeof id==="string" && id.indexOf("gen|")===0; }
function attachAnim(catId,seaNum,sitIdx,animId){
 var o=getAnimAttachments();
 o[animKey(catId,seaNum,sitIdx)]=animId;
 saveAnimAttachments(o);
}
// Retirer doit etre memorise ("none") et non efface : sans cela, une situation
// d'origine retrouverait son animation par la cle positionnelle au rechargement.
function detachAnim(catId,seaNum,sitIdx){
 var o=getAnimAttachments();
 o[animKey(catId,seaNum,sitIdx)]="none";
 saveAnimAttachments(o);
}

// ── APERCU ──────────────────────────────────────────────────────────
// Dessine une image fixe de l'animation, prise en cours de mouvement : a t=0
// beaucoup de situations montrent des joueurs immobiles, ce qui ne permet pas
// de les distinguer les unes des autres dans une grille.
function drawAnimPreview(canvas,animId,t){
 if(!canvas||typeof SIT_ANIMS==="undefined") return;
 var fn=SIT_ANIMS[animId];
 if(!fn) return;
 canvas.width=320;
 canvas.height=fn.height||240;
 try{ fn(canvas.getContext("2d"),(t===undefined?0.45:t)); }catch(e){}
}

// Lecture d'une vignette, independante du moteur des situations : une vignette
// de la bibliotheque n'a ni bouton de vitesse ni etat a conserver.
var animPreviewRafs={};
function stopPreview(cid){
 if(animPreviewRafs[cid]){ cancelAnimationFrame(animPreviewRafs[cid]); delete animPreviewRafs[cid]; }
}
function playPreview(canvas,animId,cid){
 if(!canvas||typeof SIT_ANIMS==="undefined") return;
 var fn=SIT_ANIMS[animId]; if(!fn) return;
 stopPreview(cid);
 var dur=SIT_DUR[animId]||5000, start=null, ctx=canvas.getContext("2d");
 function step(ts){
   if(!start) start=ts;
   var t=Math.min((ts-start)/dur,1);
   try{ fn(ctx,t); }catch(e){}
   if(t<1) animPreviewRafs[cid]=requestAnimationFrame(step);
   else { delete animPreviewRafs[cid]; }
 }
 animPreviewRafs[cid]=requestAnimationFrame(step);
}
function stopAllPreviews(){
 Object.keys(animPreviewRafs).forEach(function(k){ cancelAnimationFrame(animPreviewRafs[k]); });
 animPreviewRafs={};
}

// ── SELECTEUR / BIBLIOTHEQUE ────────────────────────────────────────
// Deux usages pour une seule vue : rattacher une animation a une situation
// precise, ou simplement parcourir ce que la bibliotheque contient.
// opts : {catId, seaNum, sitIdx, current, onDone} pour rattacher, {browse:true} pour parcourir.
function openAnimPicker(opts){
 opts=opts||{};
 var browse=!!opts.browse;
 var current=opts.current||null;

 var modal=document.createElement("div");
 modal.style.cssText="position:fixed;inset:0;background:rgba(10,20,12,.55);z-index:400;display:flex;align-items:flex-end";
 var inner=document.createElement("div");
 inner.style.cssText="background:var(--bg);border-radius:20px 20px 0 0;padding:18px;width:100%;max-height:90vh;overflow-y:auto";
 inner.addEventListener("click",function(e){e.stopPropagation();});

 function fermer(){ stopAllPreviews(); modal.remove(); }

 var head=document.createElement("div");
 head.style.cssText="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px";
 var titre=document.createElement("div");
 titre.style.cssText="font-size:15px;font-weight:800;color:var(--txt)";
 titre.textContent=browse?"Bibliothèque d'animations":"Choisir une animation";
 var close=document.createElement("button");
 close.style.cssText="width:28px;height:28px;border-radius:50%;background:var(--bdr);border:none;cursor:pointer;font-size:14px;color:var(--mut)";
 close.textContent="✕";
 close.addEventListener("click",fermer);
 head.appendChild(titre);head.appendChild(close);
 inner.appendChild(head);

 var sous=document.createElement("div");
 sous.style.cssText="font-size:11px;color:var(--mut);line-height:1.45;margin-bottom:12px";
 sous.textContent=browse
   ? "Ces animations peuvent être rattachées à n'importe quelle situation, dans n'importe quelle catégorie."
   : "L'animation choisie reste attachée à cette situation, même si la séance est modifiée plus tard.";
 inner.appendChild(sous);

 var rech=document.createElement("input");
 rech.className="form-input";
 rech.setAttribute("placeholder","Rechercher (dribble, tir, défense...)");
 rech.style.cssText="margin-bottom:10px";
 inner.appendChild(rech);

 var tagWrap=document.createElement("div");
 tagWrap.style.cssText="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px";
 inner.appendChild(tagWrap);

 var grille=document.createElement("div");
 grille.style.cssText="display:grid;grid-template-columns:1fr 1fr;gap:10px";
 inner.appendChild(grille);

 var vide=document.createElement("div");
 vide.style.cssText="font-size:12px;color:var(--mut);text-align:center;padding:24px 0;display:none";
 vide.textContent="Aucune animation ne correspond.";
 inner.appendChild(vide);

 var tagActif=null;
 function majTags(){
   tagWrap.innerHTML="";
   var tous=[null].concat(animTags());
   tous.forEach(function(t){
     var b=document.createElement("button");
     var on=(tagActif===t);
     b.textContent=t||"Tous";
     b.style.cssText="padding:5px 11px;border-radius:14px;border:1px solid "+(on?"var(--dkg)":"var(--bdr)")+
       ";background:"+(on?"var(--dkg)":"transparent")+";color:"+(on?"#fff":"var(--txt2)")+
       ";font-size:10.5px;font-weight:700;cursor:pointer";
     b.addEventListener("click",function(){ tagActif=t; majTags(); majGrille(); });
     tagWrap.appendChild(b);
   });
 }

 function majGrille(){
   stopAllPreviews();
   grille.innerHTML="";
   var q=rech.value.trim().toLowerCase();
   var liste=animDisponibles().filter(function(a){
     if(tagActif && a.tags.indexOf(tagActif)<0) return false;
     if(!q) return true;
     return (a.n+" "+a.tags.join(" ")).toLowerCase().indexOf(q)>=0;
   });
   vide.style.display=liste.length?"none":"block";
   liste.forEach(function(a){
     var cid="apv-"+a.id;
     var card=document.createElement("div");
     var sel=(current===a.id);
     card.style.cssText="background:var(--card);border:1.5px solid "+(sel?"var(--dkg)":"var(--bdr)")+
       ";border-radius:var(--rs);overflow:hidden;cursor:pointer";

     var cvWrap=document.createElement("div");
     cvWrap.style.cssText="position:relative;background:var(--bg)";
     var cv=document.createElement("canvas");
     cv.style.cssText="width:100%;height:auto;display:block";
     drawAnimPreview(cv,a.id);
     var play=document.createElement("button");
     play.textContent="▶";
     play.style.cssText="position:absolute;right:6px;bottom:6px;width:26px;height:26px;border-radius:50%;"+
       "background:rgba(0,0,0,.55);color:#fff;border:none;font-size:10px;cursor:pointer;line-height:1";
     play.addEventListener("click",function(e){ e.stopPropagation(); playPreview(cv,a.id,cid); });
     cvWrap.appendChild(cv);cvWrap.appendChild(play);

     var bas=document.createElement("div");
     bas.style.cssText="padding:8px 9px";
     var nom=document.createElement("div");
     nom.style.cssText="font-size:11.5px;font-weight:700;color:var(--txt);line-height:1.3;margin-bottom:4px";
     nom.textContent=a.n;
     var tg=document.createElement("div");
     tg.style.cssText="display:flex;flex-wrap:wrap;gap:3px";
     a.tags.forEach(function(t,j){
       var s=document.createElement("span");
       s.textContent=t;
       s.style.cssText="font-size:8.5px;font-weight:700;color:#fff;background:"+KC[j%KC.length]+";padding:2px 6px;border-radius:8px";
       tg.appendChild(s);
     });
     bas.appendChild(nom);bas.appendChild(tg);
     if(sel){
       var mk=document.createElement("div");
       mk.style.cssText="font-size:9.5px;font-weight:800;color:var(--dkg);margin-top:5px";
       mk.textContent="✓ Animation actuelle";
       bas.appendChild(mk);
     }

     card.appendChild(cvWrap);card.appendChild(bas);
     card.addEventListener("click",function(){
       if(browse){ playPreview(cv,a.id,cid); return; }
       attachAnim(opts.catId,opts.seaNum,opts.sitIdx,a.id);
       fermer();
       if(typeof opts.onDone==="function") opts.onDone();
     });
     grille.appendChild(card);
   });
 }

 rech.addEventListener("input",majGrille);

 if(!browse && (current||opts.removable)){
   var retirer=document.createElement("button");
   retirer.textContent="Retirer l'animation de cette situation";
   retirer.style.cssText="width:100%;margin-top:14px;padding:11px;border-radius:var(--rx);background:rgba(192,57,43,.1);"+
     "color:var(--red);font-size:12px;font-weight:700;border:none;cursor:pointer";
   retirer.addEventListener("click",function(){
     detachAnim(opts.catId,opts.seaNum,opts.sitIdx);
     fermer();
     if(typeof opts.onDone==="function") opts.onDone();
   });
   inner.appendChild(retirer);
 }

 modal.appendChild(inner);
 modal.addEventListener("click",fermer);
 document.body.appendChild(modal);
 majTags();
 majGrille();
}
