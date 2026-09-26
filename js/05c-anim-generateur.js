/* ===== 05c-anim-generateur.js — Animation generee pour chaque situation ===== */
//
// POURQUOI
// La bibliotheque (05b) suffit en U9/U11, ou les situations sont des jeux :
// un meme clip de dribble illustre dix variantes. A partir de U13 le contenu
// devient tactique et precis — un pick and roll, une zone, une presse — et
// rejouer un clip generique induirait le coach en erreur.
// Ici chaque situation est lue (titre, description, organisation, mots cles)
// et sa propre scene est dessinee : effectif reel, terrain reel, motif reel.
//
// Ces schemas sont generes, donc approximatifs : ils montrent l'intention de
// l'exercice, pas une position FFBB validee. L'etiquette "Schema genere" le dit
// a l'ecran, et le coach peut toujours rattacher une animation dessinee a la main.

// ── OUTILS ──────────────────────────────────────────────────────────
function gNorm(s){
 return String(s||"").toLowerCase()
   .replace(/[àâä]/g,"a").replace(/[éèêë]/g,"e").replace(/[îï]/g,"i")
   .replace(/[ôö]/g,"o").replace(/[ûüù]/g,"u").replace(/ç/g,"c");
}
var G_ATT="#1A2E5A", G_DEF="#C0392B", G_NEU="#16A085";

function gArrow(ctx,x1,y1,x2,y2,col,dash){
 var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy);
 if(L<2)return;
 ctx.save();ctx.strokeStyle=col||"rgba(255,255,255,.85)";ctx.lineWidth=2;
 if(dash)ctx.setLineDash([4,3]);
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
 ctx.setLineDash([]);
 var a=Math.atan2(dy,dx);
 ctx.fillStyle=col||"rgba(255,255,255,.85)";
 ctx.beginPath();ctx.moveTo(x2,y2);
 ctx.lineTo(x2-8*Math.cos(a-0.4),y2-8*Math.sin(a-0.4));
 ctx.lineTo(x2-8*Math.cos(a+0.4),y2-8*Math.sin(a+0.4));
 ctx.closePath();ctx.fill();ctx.restore();
}
// Trait epais perpendiculaire : convention des schemas de basket pour un ecran.
function gScreen(ctx,x,y,ang,col){
 ctx.save();ctx.translate(x,y);ctx.rotate(ang||0);
 ctx.strokeStyle=col||"#D4AF37";ctx.lineWidth=3.5;ctx.lineCap="round";
 ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.stroke();ctx.restore();
}
function gCone(ctx,x,y){
 ctx.fillStyle="#E8670A";ctx.beginPath();
 ctx.moveTo(x,y-7);ctx.lineTo(x+5,y+3);ctx.lineTo(x-5,y+3);ctx.closePath();ctx.fill();
}
function gLegend(ctx,W,H,txt){
 ctx.fillStyle="rgba(0,0,0,.35)";ctx.fillRect(0,H-14,W,14);
 ctx.fillStyle="rgba(255,255,255,.75)";ctx.font="8px system-ui";
 ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,W/2,H-7);
}
function gTag(ctx,W,txt){
 ctx.font="7.5px system-ui";ctx.textAlign="right";ctx.textBaseline="top";
 var w=ctx.measureText(txt).width+8;
 ctx.fillStyle="rgba(0,0,0,.4)";ctx.beginPath();ctx.roundRect(W-w-5,4,w,12,6);ctx.fill();
 ctx.fillStyle="rgba(255,255,255,.7)";ctx.fillText(txt,W-9,7);
}
// Mouvement cyclique borne, pour les joueurs qui ne portent pas l'action.
function gDrift(base,amp,t,ph){ return base+Math.sin(t*Math.PI*2+(ph||0))*amp; }

// Positions d'attaque sur demi-terrain, panier en haut.
// Choisies pour rester lisibles a 320px de large et ne jamais se superposer.
function gSpots(W,H,n){
 var all=[
  {x:W/2,     y:H-42},   // meneur
  {x:38,      y:H-88},   // aile gauche
  {x:W-38,    y:H-88},   // aile droite
  {x:W/2-58,  y:H*0.42}, // poste gauche
  {x:W/2+58,  y:H*0.42}  // poste droit
 ];
 if(n<=1)return [all[0]];
 if(n===2)return [all[0],all[2]];
 if(n===3)return [all[0],all[1],all[2]];
 if(n===4)return [all[0],all[1],all[2],all[4]];
 return all.slice(0,5);
}

// ── ANALYSE ─────────────────────────────────────────────────────────
// L'ordre des tests va du plus specifique au plus general : une situation
// "5c5 avec ecran porteur" doit montrer l'ecran, pas un 5c5 quelconque,
// car l'ecran est le point d'enseignement.
// Les mots cles sont volontairement exclus de la detection : ce sont des
// consignes courtes ("Course interieure", "Zone de reussite") qui declenchent
// le mauvais schema sans rien dire de l'organisation reelle de l'exercice.
// Le titre et l'organisation portent le signal ; la description ne sert qu'a
// confirmer un motif tactique deja plausible.
function analyseSituation(sit,catId){
 var ti=gNorm(sit&&sit.ti||""), og=gNorm(sit&&sit.org||""), de=gNorm(sit&&sit.desc||"");
 var head=ti+" . "+og;          // signal fort
 var full=head+" . "+de;        // signal complet
 // En U9 et U11 le contenu est fait de jeux : il n'y a ni pick and roll, ni zone,
 // ni presse. Proposer ces schemas la serait faux, quel que soit le vocabulaire.
 var mini=(catId==="u9"||catId==="u11");
 var sc={natt:0,ndef:0,terr:"half",note:""};

 var m=full.match(/(\d)\s*(?:c|v|contre)\s*(\d)/);
 if(m){ sc.natt=Math.min(5,+m[1]); sc.ndef=Math.min(5,+m[2]); }
 // "Equipes de 5" decrit un 5c5 sans l'ecrire : sans cette lecture, la situation
 // tomberait dans l'atelier generique alors que c'est une opposition complete.
 if(!m){
   var eq=og.match(/equipes? de (\d)/);
   if(eq){ sc.natt=Math.min(5,+eq[1]); sc.ndef=sc.natt; }
 }
 var oppo=!!(sc.natt&&sc.ndef);
 if(/tout le terrain|tout terrain|full court|terrain complet|sur la longueur|d un panier a l autre/.test(full)) sc.terr="full";

 // Ce que le texte annonce doit se retrouver a l'image. Un exercice qui finit
 // au panier dessine sur un parquet nu, sans cercle, se contredit a l'ecran :
 // ces deux drapeaux permettent aux scenes hors terrain de s'adapter.
 // "Cercle" designe le panier, sauf quand le groupe est dispose en cercle.
 var cercleTir=/\bcercle\b/.test(full) && !/en (demi-)?cercle|demi-cercle|cercle de \d|cercle de joueurs|en ronde/.test(full);
 sc.panier=/\btirs?\b|\btireu/.test(full)
   || /panier|lay-?up|double pas|finition|\bfinir\b|shoot|adresse|lancer franc|arceau|planche|marquer|scorer|conclure|mi-distance|3 points/.test(full)
   || cercleTir;
 sc.def=!!sc.ndef
   || /defenseur|defensive|\bdefense\b|adversaire|genneur|passif|aidant|opposant|vis-a-vis|contestation|contester|kick-?out|ressortie|prise a deux|close ?out/.test(full)
   || (/\baide\b/.test(full) && !/a l aide de/.test(full));

 function set(type,note){ sc.type=type; sc.note=note; return sc; }

 // Theorie : un tableau affiche est un tableau de marque, pas un tableau blanc.
 if(/\b(assis|video|debrief|reunion|entretien|questionnaire|plan de jeu|scouting|projet joueur|temps d echange|echange verbal)\b/.test(head)
    || (/tableau|paperboard/.test(og) && !/affich|score|marque/.test(og)))
   return set("theorie","Temps d'echange");

 if(!oppo && /echauffement|gainage|pliometr|proprioce|prevention|renforcement|mobilite|etirement|hygiene|nutrition|sommeil|recuperation|souplesse/.test(head))
   return set("athletique","Travail athletique");

 // "Ecran retard" designe la sortie en ecran au rebond, pas un ecran d'attaque.
 if(/ecran retard/.test(full)) return set("rebond","Ecran retard au rebond");

 if(!mini){
   if(/pick and roll|pick-and-roll|ecran porteur|ecran sur porteur|ecran et roule|p&r/.test(full))
     return set("pnr","Pick and roll");
   if(/ecran|screen/.test(full))
     return set("ecran","Ecran non porteur");
   // "Zone" designe aussi bien une aire de jeu qu'une defense. Seule la seconde
   // doit produire un schema de zone : l'aire delimitee n'a rien de defensif.
   var zoneAire=/zone (delimitee|reduite|offensive|arriere|avant|de marque|interdite|de reussite|de 5|de tir)|zones? de \d|dans la zone/.test(full);
   var zoneDef=/(defense de zone|contre (une |la )?zone|face a une zone|mise en place d une zone|zone (simple|placee|2-3|3-2|1-3-1|1-2-2)|rebond en zone|la zone ne|alternance .{0,40}zone|\b2-3\b|\b3-2\b|\b1-3-1\b|\b1-2-2\b)/.test(full)
      || (/\bzone\b/.test(ti) && /defens|contre|match|alternance|rebond|intervalle|renversement|placee/.test(full));
   if(zoneDef && !zoneAire) return set("zone","Defense de zone");
   if(/presse|pressing|tout terrain defensif/.test(full))
     return set("presse","Presse tout terrain");
   // Le vocabulaire de l'aide defensive est plus large que le mot "aide" :
   // "un aidant", "kick-out", "ressortie" decrivent la meme chose, et ces
   // termes vivent souvent dans la description plutot que dans le titre.
   if(/aide et recup|aide defensive|rotation defensive|prise a deux|close ?out|flash defensif|kick-?out|ressortie|aidant/.test(full)
      || (/\baide\b/.test(full) && !/a l aide de/.test(full)))
     return set("aide","Aide et ressortie");
   if(/poste bas|poste haut|jeu interieur|pivot bas|joueur interieur|\binterieurs\b|ailier fort|dos au panier/.test(full)
      && !/course interieure|ligne interieure|couloir interieur/.test(full))
     return set("interieur","Jeu interieur");
 }

 if(/rebond (defensif|offensif)|boxout|box ?out|prise de rebond|au rebond|contester le rebond|\brebonds?\b/.test(head)
    && !/rebondi|rebondir/.test(head))
   return set("rebond","Rebond");
 if(/transition|contre-attaque|contre attaque|jeu rapide|remontee rapide|3 couloirs|trois couloirs|outlet|sprint retour|repli defensif|retour defensif/.test(full))
   return set("transition","Transition");
 // Remise en jeu : une opposition placee, pas un atelier.
 if(/remise (en jeu|touche|ligne de fond|de la touche)|sortie de balle/.test(head))
   return set("opposition","Remise en jeu");

 if(sc.natt&&sc.ndef&&sc.natt>sc.ndef) return set("surnombre",sc.natt+"c"+sc.ndef+" · surnombre");
 if(sc.natt===1&&sc.ndef===1)          return set("duel","1c1");
 if(oppo)                              return set("opposition",sc.natt+"c"+sc.ndef);

 // Circulation sans opposition (5c0, 4c0) : la balle tourne, personne ne defend.
 if(sc.natt&&!sc.ndef&&/\dc0|\dv0|sans defense|a vide/.test(full))
   return set("passe","Circulation sans opposition");
 // Jeux nommes du mini-basket, reconnaissables a leur seul titre.
 if(/epervier|beret|mouchoir|requin|demenageur|balles brulantes|feu rouge|chat perche|voleur|gendarme|douaniers/.test(ti))
   return set("jeu","Jeu collectif");
 // Un parcours reste un parcours meme s'il finit au panier : le titre tranche
 // avant le vocabulaire de tir, sinon tout atelier deviendrait un exercice de tir.
 if(/parcours|atelier|colonnes?|\bfiles?\b|vagues?|stations?|relais|navette|circuit|echelle|slalom/.test(ti))
   return set("circuit","Atelier");
 if(/lancer franc/.test(head)) return set("tir","Lancers francs");
 if(/\btirs?\b|shoot|lay-?up|double pas|spot|finition|adresse|panier|beef/.test(head)) return set("tir","Travail de tir");
 if(/cercle|ronde|demi-cercle|etoile/.test(og)) return set("cercle","Jeu en cercle");
 if(/colonnes?|\bfiles?\b|vagues?|stations?|plots?|atelier|parcours/.test(og)) return set("circuit","Atelier");
 if(/passe|renversement|triangle|reception|circulation/.test(head)) return set("passe","Circulation de balle");
 if(/1 ballon (par joueur|chacun)|un ballon (par joueur|chacun)|ballon par joueur/.test(og))
   return set("dribble","Maniement de balle");
 if(/dribble|handle|maniement|conduite de balle|pivot|appuis|changement de main/.test(head))
   return set("dribble","Maniement de balle");
 if(/glissement|pas chasse|defensi/.test(head)) return set("aide","Travail defensif");
 // Binomes : deux joueurs qui echangent, pas un atelier en colonne.
 if(/binomes?|par deux|\bpar 2\b|face a face|duos?/.test(og)) return set("passe","Travail par deux");
 if(/delimitee|equipes equilibrees|deux equipes|zones? de \d|\btag\b/.test(head))
   return set("jeu","Jeu sur aire delimitee");
 // Defaut selon l'age : un jeu en mini-basket, un atelier au-dela.
 return mini?set("jeu","Jeu collectif"):set("circuit","Atelier");
}

// ── SCENES ──────────────────────────────────────────────────────────
var G_SCENES={};

// Opposition NcN : les attaquants font circuler la balle, les defenseurs suivent
// le porteur. Montre l'effectif et le terrain exacts de la situation.
G_SCENES.opposition=function(ctx,t,sc,W,H){
 sc.terr==="full"?dfc(ctx,W,H):dhc(ctx,W,H);
 var n=sc.natt||5, nd=sc.ndef||n;
 var sp=gSpots(W,H,n);
 var seq=Math.min(n,4), phase=t*seq, idx=Math.floor(phase)%seq, nxt=(idx+1)%seq;
 var f=phase-Math.floor(phase);
 var bx=lp(sp[idx].x,sp[nxt].x,ease(f)), by=lp(sp[idx].y,sp[nxt].y,ease(f));
 for(var i=0;i<nd;i++){
   var s=sp[i%sp.length];
   var tgt=(i===idx)?{x:bx,y:by}:s;
   ctx.globalAlpha=.95;
   pl(ctx,lp(s.x,(s.x+tgt.x)/2,.6)+Math.sin(t*6+i)*2,lp(s.y,tgt.y-26,.35),"D",G_DEF,11);
   ctx.globalAlpha=1;
 }
 for(var j=0;j<n;j++) pl(ctx,gDrift(sp[j].x,4,t,j),gDrift(sp[j].y,3,t,j*1.7),String(j+1),G_ATT,12);
 gArrow(ctx,sp[idx].x,sp[idx].y,sp[nxt].x,sp[nxt].y,"rgba(255,255,255,.55)",true);
 bl(ctx,bx,by-14,7);
 gLegend(ctx,W,H,sc.note+" · "+(sc.terr==="full"?"tout terrain":"demi-terrain"));
};

// Pick and roll : l'ecran est pose, le porteur l'utilise, le poseur plonge.
// Les trois temps sont separes pour que la lecture soit possible image par image.
G_SCENES.pnr=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var p1={x:W/2+40,y:H-50}, scr={x:W/2+4,y:H-96}, roll={x:W/2-6,y:60};
 var t1=cl(t/0.34,0,1), t2=cl((t-0.34)/0.33,0,1), t3=cl((t-0.67)/0.33,0,1);
 var sx=lp(W/2-52,scr.x,eOut(t1)), sy=lp(H*0.45,scr.y,eOut(t1));
 var hx=p1.x, hy=p1.y;
 if(t2>0){ hx=lp(p1.x,scr.x-26,ease(t2)); hy=lp(p1.y,scr.y-16,ease(t2)); }
 var rx=sx, ry=sy;
 if(t3>0){ rx=lp(scr.x,roll.x,ease(t3)); ry=lp(scr.y,roll.y,ease(t3)); }
 if(t1>=1&&t3<1) gScreen(ctx,sx,sy,Math.PI/2);
 pl(ctx,lp(p1.x,scr.x-6,ease(t2))+6,lp(p1.y-30,scr.y+6,ease(t2)),"D",G_DEF,11);
 pl(ctx,sx+14,sy-18,"D",G_DEF,11);
 pl(ctx,rx,ry,"5",G_NEU,12);
 pl(ctx,hx,hy,"1",G_ATT,12);
 bl(ctx,hx-13,hy-8,7);
 if(t3>0) gArrow(ctx,scr.x,scr.y,roll.x,roll.y,"#D4AF37");
 if(t2>0&&t3<1) gArrow(ctx,p1.x,p1.y,scr.x-26,scr.y-16,"rgba(255,255,255,.7)");
 gLegend(ctx,W,H,t3>0?"3 · le poseur plonge au panier":(t2>0?"2 · le porteur utilise l'ecran":"1 · pose de l'ecran"));
};

// Ecran non porteur : le coupeur se libere grace a l'ecran, puis recoit.
G_SCENES.ecran=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var meneur={x:W/2,y:H-44}, poseur={x:W/2-46,y:H*0.46}, recep={x:W-46,y:H-86};
 var t1=cl(t/0.45,0,1), t2=cl((t-0.45)/0.55,0,1);
 var cx=lp(48,poseur.x+30,eOut(t1)), cy=lp(H*0.5,poseur.y-6,eOut(t1));
 if(t2>0){ cx=lp(poseur.x+30,recep.x,ease(t2)); cy=lp(poseur.y-6,recep.y,ease(t2)); }
 gScreen(ctx,poseur.x,poseur.y,0);
 pl(ctx,poseur.x,poseur.y+11,"4",G_NEU,12);
 pl(ctx,lp(52,poseur.x+16,eOut(t1)),lp(H*0.5+22,poseur.y+22,eOut(t1)),"D",G_DEF,11);
 pl(ctx,meneur.x,meneur.y,"1",G_ATT,12);
 pl(ctx,cx,cy,"2",G_ATT,12);
 if(t2>0.35){
   var f=cl((t2-0.35)/0.65,0,1);
   gArrow(ctx,meneur.x,meneur.y,cx,cy,"rgba(255,255,255,.6)",true);
   bl(ctx,lp(meneur.x,cx,ease(f)),lp(meneur.y,cy,ease(f))-12,7);
 } else bl(ctx,meneur.x-13,meneur.y-8,7);
 gLegend(ctx,W,H,t2>0?"le coupeur sort de l'ecran et recoit":"pose de l'ecran, le coupeur prepare");
};

// Zone : la forme defensive glisse vers le cote du ballon, la balle est renversee.
G_SCENES.zone=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var forme=/1-3-1/.test(sc.note)?"1-3-1":(/3-2/.test(sc.note)?"3-2":"2-3");
 var per=[{x:W/2,y:H-44},{x:40,y:H-86},{x:W-40,y:H-86},{x:26,y:H*0.44},{x:W-26,y:H*0.44}];
 var seq=4, ph=t*seq, i=Math.floor(ph)%seq, n=(i+1)%seq, f=ph-Math.floor(ph);
 var bx=lp(per[i].x,per[n].x,ease(f)), by=lp(per[i].y,per[n].y,ease(f));
 var base = forme==="2-3"
   ? [{x:W/2-40,y:H*0.62},{x:W/2+40,y:H*0.62},{x:W/2-62,y:H*0.34},{x:W/2,y:H*0.26},{x:W/2+62,y:H*0.34}]
   : forme==="3-2"
   ? [{x:W/2,y:H*0.66},{x:W/2-56,y:H*0.56},{x:W/2+56,y:H*0.56},{x:W/2-34,y:H*0.28},{x:W/2+34,y:H*0.28}]
   : [{x:W/2,y:H*0.68},{x:W/2-58,y:H*0.46},{x:W/2,y:H*0.44},{x:W/2+58,y:H*0.46},{x:W/2,y:H*0.24}];
 var dec=cl((bx-W/2)/(W/2),-1,1);
 base.forEach(function(p,k){ pl(ctx,p.x+dec*16,p.y+Math.sin(t*5+k)*2,"D",G_DEF,11); });
 per.forEach(function(p,k){ if(k<5) pl(ctx,p.x,p.y,String(k+1),G_ATT,11); });
 gArrow(ctx,per[i].x,per[i].y,per[n].x,per[n].y,"rgba(255,255,255,.55)",true);
 bl(ctx,bx,by-13,7);
 gLegend(ctx,W,H,"Zone "+forme+" · elle glisse cote ballon");
};

// Presse : la balle remonte contre une defense etagee sur tout le terrain.
G_SCENES.presse=function(ctx,t,sc,W,H){
 dfc(ctx,W,H);
 var path=[{x:W/2,y:H-34},{x:60,y:H-86},{x:W/2-14,y:H*0.54},{x:W-58,y:H*0.3},{x:W/2,y:44}];
 var seg=path.length-1, ph=cl(t,0,0.999)*seg, i=Math.floor(ph), f=ph-i;
 var bx=lp(path[i].x,path[i+1].x,ease(f)), by=lp(path[i].y,path[i+1].y,ease(f));
 var lignes=[H-70,H*0.56,H*0.3];
 lignes.forEach(function(y,k){
   var d=(k===0)?2:(k===1?2:1);
   for(var j=0;j<d;j++){
     var x=W/2+(j===0?-46:46)*(d>1?1:0);
     pl(ctx,x+cl((bx-W/2)*0.35,-40,40),y+Math.sin(t*6+k+j)*3,"D",G_DEF,11);
   }
 });
 for(var k2=0;k2<2;k2++) pl(ctx,path[k2+1].x,path[k2+1].y,String(k2+2),G_ATT,11);
 pl(ctx,path[0].x,path[0].y,"1",G_ATT,12);
 for(var s=0;s<seg;s++) gArrow(ctx,path[s].x,path[s].y,path[s+1].x,path[s+1].y,s<=i?"rgba(255,255,255,.65)":"rgba(255,255,255,.18)",true);
 bl(ctx,bx,by-13,7);
 gLegend(ctx,W,H,"Remontee de balle sous presse");
};

// Aide et rotation : penetration, l'aide se ferme, ressortie et close out.
G_SCENES.aide=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var dep={x:W/2+46,y:H-58}, pen={x:W/2+8,y:H*0.36}, kick={x:44,y:H-84};
 var t1=cl(t/0.42,0,1), t2=cl((t-0.42)/0.28,0,1), t3=cl((t-0.7)/0.3,0,1);
 var px=lp(dep.x,pen.x,ease(t1)), py=lp(dep.y,pen.y,ease(t1));
 var ax=lp(W/2-56,pen.x-22,eOut(t2)), ay=lp(H*0.42,pen.y+6,eOut(t2));
 pl(ctx,px+10,py+16,"D",G_DEF,11);
 pl(ctx,ax,ay,"D",G_DEF,11);
 var cx=lp(W/2-56,kick.x+12,ease(t3));
 var cy=lp(H*0.42,kick.y-18,ease(t3));
 if(t3>0) pl(ctx,cx,cy,"D",G_DEF,11);
 pl(ctx,kick.x,kick.y,"2",G_ATT,12);
 pl(ctx,px,py,"1",G_ATT,12);
 if(t2>0&&t3<1) gArrow(ctx,W/2-56,H*0.42,pen.x-22,pen.y+6,"#D4AF37");
 if(t3>0){
   gArrow(ctx,pen.x,pen.y,kick.x,kick.y,"rgba(255,255,255,.65)",true);
   bl(ctx,lp(pen.x,kick.x,ease(t3)),lp(pen.y,kick.y,ease(t3))-12,7);
 } else bl(ctx,px-13,py-8,7);
 gLegend(ctx,W,H,t3>0?"3 · ressortie et close out":(t2>0?"2 · l'aide se ferme":"1 · penetration"));
};

// Jeu interieur : appel de balle au poste, passe, jeu dos au panier.
G_SCENES.interieur=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var ext={x:44,y:H-82}, poste={x:W/2-52,y:H*0.38}, fin={x:W/2-14,y:52};
 var t1=cl(t/0.3,0,1), t2=cl((t-0.3)/0.3,0,1), t3=cl((t-0.6)/0.4,0,1);
 var pxx=lp(poste.x-16,poste.x,eOut(t1)), pyy=lp(poste.y+18,poste.y,eOut(t1));
 var fx=pxx, fy=pyy;
 if(t3>0){ fx=lp(poste.x,fin.x,ease(t3)); fy=lp(poste.y,fin.y,ease(t3)); }
 pl(ctx,fx-16,fy-4,"D",G_DEF,11);
 pl(ctx,ext.x,ext.y,"2",G_ATT,12);
 pl(ctx,fx,fy,"5",G_NEU,13);
 if(t1>=1&&t2<1){
   gArrow(ctx,ext.x,ext.y,pxx,pyy,"rgba(255,255,255,.65)",true);
   bl(ctx,lp(ext.x,pxx,ease(t2)),lp(ext.y,pyy,ease(t2))-12,7);
 } else if(t2>=1) bl(ctx,fx-14,fy-8,7);
 else bl(ctx,ext.x-13,ext.y-8,7);
 if(t3>0) gArrow(ctx,poste.x,poste.y,fin.x,fin.y,"#D4AF37");
 gLegend(ctx,W,H,t3>0?"3 · finition dos au panier":(t2>0?"2 · passe au poste":"1 · appel de balle"));
};

// Rebond : tir, ecran retard, puis conquete du ballon.
G_SCENES.rebond=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var tir={x:W/2+52,y:H-64}, panier={x:W/2,y:34};
 var t1=cl(t/0.4,0,1), t2=cl((t-0.4)/0.6,0,1);
 var bxx=bz(t1,tir.x,tir.x-10,panier.x+18,panier.x);
 var byy=bz(t1,tir.y,tir.y-96,panier.y-56,panier.y);
 var duos=[{x:W/2-44,y:H*0.42},{x:W/2+44,y:H*0.42}];
 duos.forEach(function(p,k){
   var push=t2*16*(k?1:-1);
   pl(ctx,p.x-push*0.4,p.y-t2*20,"D",G_DEF,11);
   pl(ctx,p.x+push,p.y-t2*8,String(k+4),G_ATT,11);
   if(t2>0.1) gScreen(ctx,p.x-push*0.4,p.y-t2*20+13,0,"rgba(255,255,255,.5)");
 });
 pl(ctx,tir.x,tir.y,"2",G_ATT,12);
 if(t1<1) bl(ctx,bxx,byy,7);
 else { var r=cl((t2-0.15)/0.5,0,1); bl(ctx,lp(panier.x,duos[0].x+10,r),lp(panier.y+10,duos[0].y-14,r),7); }
 gLegend(ctx,W,H,t2>0.1?"ecran retard puis conquete du rebond":"tir : tout le monde se retourne");
};

// Transition : rebond, relance, trois couloirs, conclusion.
G_SCENES.transition=function(ctx,t,sc,W,H){
 dfc(ctx,W,H);
 var dep=[{x:W/2,y:H-52},{x:36,y:H-76},{x:W-36,y:H-76}];
 var arr=[{x:W/2,y:H*0.3},{x:44,y:66},{x:W-44,y:66}];
 var t1=cl(t/0.22,0,1), t2=cl((t-0.18)/0.62,0,1), t3=cl((t-0.8)/0.2,0,1);
 dep.forEach(function(p,k){
   var x=lp(p.x,arr[k].x,ease(t2)), y=lp(p.y,arr[k].y,ease(t2));
   pl(ctx,x,y,String(k+1),G_ATT,12);
   if(t2>0.05&&t2<1) gArrow(ctx,p.x,p.y,arr[k].x,arr[k].y,"rgba(255,255,255,.28)",true);
 });
 for(var k2=0;k2<2;k2++) pl(ctx,lp(W/2+(k2?40:-40),W/2+(k2?26:-26),ease(t2)),lp(H*0.72,H*0.24,ease(t2)*0.8),"D",G_DEF,11);
 var bx,by;
 if(t1<1){ bx=lp(W/2-8,dep[0].x,ease(t1)); by=lp(H-30,dep[0].y,ease(t1)); }
 else if(t3<1){ bx=lp(dep[0].x,arr[0].x,ease(t2)); by=lp(dep[0].y,arr[0].y,ease(t2)); }
 else { bx=lp(arr[0].x,W/2,ease(t3)); by=lp(arr[0].y,34,ease(t3)); }
 bl(ctx,bx,by-13,7);
 gLegend(ctx,W,H,t3>0?"conclusion":(t1<1?"rebond et relance":"trois couloirs"));
};

// Surnombre : l'attaque a un joueur de plus, la defense doit choisir.
G_SCENES.surnombre=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var n=sc.natt||3, nd=sc.ndef||(n-1);
 var sp=gSpots(W,H,n);
 var cible=Math.min(n-1,1);
 var t1=cl(t/0.55,0,1), t2=cl((t-0.55)/0.45,0,1);
 var px=lp(sp[0].x,W/2-4,ease(t1)), py=lp(sp[0].y,H*0.42,ease(t1));
 for(var i=0;i<nd;i++){
   var dx=lp(W/2+(i?52:-52),px+(i?26:-26),ease(t1)*0.85);
   pl(ctx,dx,H*0.5+Math.sin(t*5+i)*3,"D",G_DEF,11);
 }
 for(var j=1;j<n;j++) pl(ctx,sp[j].x,sp[j].y,String(j+1),G_ATT,12);
 pl(ctx,px,py,"1",G_ATT,12);
 if(t2>0){
   gArrow(ctx,px,py,sp[cible].x,sp[cible].y,"rgba(255,255,255,.65)",true);
   bl(ctx,lp(px,sp[cible].x,ease(t2)),lp(py,sp[cible].y,ease(t2))-12,7);
 } else bl(ctx,px-13,py-8,7);
 gLegend(ctx,W,H,sc.note+" · fixer puis donner");
};

// Duel 1c1 : attaque, changement de rythme, la defense recule.
G_SCENES.duel=function(ctx,t,sc,W,H){
 sc.terr==="full"?dfc(ctx,W,H):dhc(ctx,W,H);
 var y0=sc.terr==="full"?H-50:H-60, y1=sc.terr==="full"?60:52;
 var w=Math.sin(t*Math.PI*2.4)*34*(1-t*0.55);
 var ax=W/2+w, ay=lp(y0,y1,ease(t));
 pl(ctx,ax*0.5+W/2*0.5,ay+30,"D",G_DEF,12);
 pl(ctx,ax,ay,"1",G_ATT,13);
 bl(ctx,ax-14,ay-9,7);
 gArrow(ctx,W/2,y0,ax,ay,"rgba(255,255,255,.3)",true);
 gLegend(ctx,W,H,"1c1 · changement de rythme");
};

// Tir : plusieurs spots, la balle part en cloche vers le cercle.
G_SCENES.tir=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var spots=/lancer/.test(gNorm(sc.note))
  ? [{x:W/2,y:H*0.60}]
  : [{x:44,y:H-80},{x:W/2,y:H-52},{x:W-44,y:H-80},{x:W/2-62,y:H*0.44},{x:W/2+62,y:H*0.44}];
 var n=spots.length, ph=t*n, i=Math.floor(ph)%n, f=ph-Math.floor(ph);
 var panier={x:W/2,y:30};
 spots.forEach(function(s,k){ pl(ctx,s.x,s.y,String(k+1),G_ATT,k===i?13:11,k===i?1:.55); });
 var s0=spots[i];
 // Tir conteste : le defenseur ferme sur le tireur actif, main haute.
 if(sc.def) pl(ctx,lp(s0.x+30,s0.x+6,eOut(cl(f*2,0,1))),lp(s0.y-34,s0.y-26,eOut(cl(f*2,0,1))),"D",G_DEF,11,0.92);
 var bxx=bz(f,s0.x,s0.x,panier.x,panier.x), byy=bz(f,s0.y-12,s0.y-120,panier.y-90,panier.y);
 bl(ctx,bxx,byy,7);
 ctx.save();ctx.strokeStyle="rgba(255,255,255,.25)";ctx.setLineDash([3,3]);ctx.lineWidth=1.4;
 ctx.beginPath();
 for(var q=0;q<=20;q++){
   var qq=q/20;
   var X=bz(qq,s0.x,s0.x,panier.x,panier.x), Y=bz(qq,s0.y-12,s0.y-120,panier.y-90,panier.y);
   q?ctx.lineTo(X,Y):ctx.moveTo(X,Y);
 }
 ctx.stroke();ctx.restore();
 gLegend(ctx,W,H,sc.note+" · arc et equilibre");
};

// Circulation de balle : le ballon tourne, chacun se replace apres sa passe.
G_SCENES.passe=function(ctx,t,sc,W,H){
 dhc(ctx,W,H);
 var n=Math.max(3,sc.natt||4);
 var sp=gSpots(W,H,Math.min(5,n));
 var ph=t*sp.length, i=Math.floor(ph)%sp.length, nx=(i+1)%sp.length, f=ph-Math.floor(ph);
 // Un defenseur annonce par le texte doit etre visible, sinon l'exercice parait
 // se derouler sans opposition alors qu'il en comporte une.
 if(sc.def){
   pl(ctx,gDrift(sp[i].x+22,6,t,1),gDrift(sp[i].y-20,5,t,2),"D",G_DEF,11,0.92);
   if(sp.length>3) pl(ctx,gDrift(sp[2].x-20,6,t,3),gDrift(sp[2].y-18,5,t,1),"D",G_DEF,11,0.92);
 }
 sp.forEach(function(p,k){ pl(ctx,gDrift(p.x,5,t,k),gDrift(p.y,4,t,k*1.3),String(k+1),G_ATT,12); });
 gArrow(ctx,sp[i].x,sp[i].y,sp[nx].x,sp[nx].y,"rgba(255,255,255,.6)",true);
 bl(ctx,lp(sp[i].x,sp[nx].x,ease(f)),lp(sp[i].y,sp[nx].y,ease(f))-13,7);
 gLegend(ctx,W,H,sc.def?"Circulation sous opposition":"Circulation · passer puis se deplacer");
};

// Dribble : chacun son ballon, changements de main sur la largeur.
G_SCENES.dribble=function(ctx,t,sc,W,H){
 if(sc.panier){
   // Le maniement debouche sur une finition : il faut le cercle a l'image.
   dhc(ctx,W,H);
   var panier={x:W/2,y:30};
   for(var j=0;j<3;j++){
     var av=cl(t*1.25-j*0.16,0,1);
     var px=lp(46+j*((W-92)/2),W/2+(j-1)*22,ease(av));
     var py=lp(H-44,80,ease(av));
     var osc=Math.sin(t*Math.PI*8+j)*7;
     if(sc.def&&j===0) pl(ctx,px+16,py-20,"D",G_DEF,11,0.9);
     pl(ctx,px,py,"A",G_ATT,12);
     if(j===0&&av>=1){
       var ft=cl((t-0.8)/0.2,0,1);
       bl(ctx,bz(ft,px,px,panier.x,panier.x),bz(ft,py-12,py-52,panier.y-38,panier.y),7);
     } else bl(ctx,px+osc+(osc>0?12:-12),py+8,6);
   }
   gLegend(ctx,W,H,"Maniement puis finition");
   return;
 }
 pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=2;
 ctx.beginPath();ctx.roundRect(10,10,W-20,H-30,4);ctx.stroke();
 for(var k=0;k<4;k++){
   var y=36+k*((H-70)/3);
   var x=40+((t*1.6+k*0.22)%1)*(W-80);
   var w=Math.sin(t*Math.PI*8+k)*7;
   if(sc.def&&k===1) pl(ctx,cl(x-34,24,W-24),y,"D",G_DEF,10,0.85);
   pl(ctx,x,y,"A",G_ATT,11);
   bl(ctx,x+w+(w>0?12:-12),y+8,6);
 }
 for(var c=0;c<4;c++) gCone(ctx,40+c*((W-80)/3),H-26);
 gLegend(ctx,W,H,"1 ballon par joueur · changements de main");
};

// Atelier en colonnes : une file traverse un parcours de plots.
// Si l'exercice se conclut au panier, il est dessine sur un demi-terrain et le
// parcours debouche sur une finition : un atelier de tir sur parquet nu, sans
// cercle, contredirait sa propre description.
G_SCENES.circuit=function(ctx,t,sc,W,H){
 var auPanier=!!sc.panier;
 if(auPanier){ dhc(ctx,W,H); }
 else {
   pq(ctx,W,H);
   ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=2;
   ctx.beginPath();ctx.roundRect(10,10,W-20,H-30,4);ctx.stroke();
 }
 var cones=auPanier
   ? [{x:52,y:H-96},{x:104,y:H-136},{x:62,y:H*0.56},{x:112,y:H*0.44}]
   : [{x:70,y:H-60},{x:130,y:H*0.5},{x:200,y:H-70},{x:262,y:H*0.42}];
 var depart=auPanier?{x:40,y:H-46}:{x:32,y:H-40};
 var fin=auPanier?{x:W/2-30,y:78}:{x:W-28,y:38};
 var panier={x:W/2,y:30};
 cones.forEach(function(c){ gCone(ctx,c.x,c.y); });
 for(var f=0;f<3;f++) pl(ctx,depart.x-4,depart.y+f*24,"A",G_ATT,10,0.8-f*0.18);
 var pts=[depart].concat(cones).concat([fin]);
 var seg=pts.length-1;
 // Le dernier cinquieme est reserve a la finition quand il y en a une.
 var course=auPanier?cl(t/0.8,0,1):cl(t,0,0.999);
 var ph=course*seg*(auPanier?0.999:1), i=Math.min(seg-1,Math.floor(ph)), fr=ph-i;
 var x=lp(pts[i].x,pts[i+1].x,ease(fr)), y=lp(pts[i].y,pts[i+1].y,ease(fr));
 for(var s=0;s<seg;s++) gArrow(ctx,pts[s].x,pts[s].y,pts[s+1].x,pts[s+1].y,s<=i?"rgba(255,255,255,.5)":"rgba(255,255,255,.15)",true);
 if(sc.def) pl(ctx,auPanier?panier.x+26:fin.x-24,auPanier?panier.y+46:fin.y+20,"D",G_DEF,11,0.9);
 pl(ctx,x,y,"A",G_ATT,12);
 if(auPanier&&t>0.8){
   var ft=cl((t-0.8)/0.2,0,1);
   gArrow(ctx,fin.x,fin.y,panier.x,panier.y+12,"rgba(255,255,255,.5)");
   bl(ctx,bz(ft,fin.x,fin.x+6,panier.x,panier.x),bz(ft,fin.y-12,fin.y-56,panier.y-40,panier.y),7);
 } else bl(ctx,x-13,y+7,6);
 gLegend(ctx,W,H,auPanier?"Atelier · passage puis finition":"Atelier · passage en colonne");
};

// Jeu en cercle : passes croisees, tout le groupe actif.
G_SCENES.cercle=function(ctx,t,sc,W,H){
 pq(ctx,W,H);
 var cx=W/2, cy=H/2-6, R=Math.min(W,H)*0.33, n=8;
 var pos=[];
 for(var i=0;i<n;i++){ var a=-Math.PI/2+i*2*Math.PI/n; pos.push({x:cx+Math.cos(a)*R,y:cy+Math.sin(a)*R}); }
 var ph=t*n, k=Math.floor(ph)%n, nx=(k+3)%n, f=ph-Math.floor(ph);
 pos.forEach(function(p,j){ pl(ctx,p.x,p.y,String(j+1),j===k?G_NEU:G_ATT,11); });
 gArrow(ctx,pos[k].x,pos[k].y,pos[nx].x,pos[nx].y,"rgba(255,255,255,.55)",true);
 bl(ctx,lp(pos[k].x,pos[nx].x,ease(f)),lp(pos[k].y,pos[nx].y,ease(f)),7);
 gLegend(ctx,W,H,"Cercle · passes croisees");
};

// Travail athletique : atelier au sol, repetitions marquees.
G_SCENES.athletique=function(ctx,t,sc,W,H){
 pq(ctx,W,H);
 ctx.strokeStyle="rgba(255,255,255,.45)";ctx.lineWidth=1.6;
 for(var l=0;l<6;l++){ var x=44+l*((W-88)/5); ctx.beginPath();ctx.moveTo(x,H*0.30);ctx.lineTo(x,H*0.62);ctx.stroke(); }
 ctx.beginPath();ctx.moveTo(44,H*0.30);ctx.lineTo(W-44,H*0.30);ctx.stroke();
 ctx.beginPath();ctx.moveTo(44,H*0.62);ctx.lineTo(W-44,H*0.62);ctx.stroke();
 var prog=(t*1.4)%1;
 var x2=44+prog*(W-88);
 var saut=Math.abs(Math.sin(prog*Math.PI*6))*14;
 pl(ctx,x2,H*0.46-saut,"A",G_ATT,12);
 fp(ctx,x2,H*0.46+6,0.5);
 pl(ctx,60,H-46,"A",G_ATT,10,0.6);
 pl(ctx,84,H-46,"A",G_ATT,10,0.45);
 gLegend(ctx,W,H,sc.note+" · qualite avant quantite");
};

// Temps d'echange : tableau, groupe assis, points qui apparaissent.
G_SCENES.theorie=function(ctx,t,sc,W,H){
 ctx.fillStyle="#16261c";ctx.beginPath();ctx.roundRect(0,0,W,H,8);ctx.fill();
 ctx.fillStyle="#0e1a13";ctx.beginPath();ctx.roundRect(38,18,W-76,H*0.42,6);ctx.fill();
 ctx.strokeStyle="rgba(255,255,255,.35)";ctx.lineWidth=2;ctx.stroke();
 var lignes=4;
 for(var i=0;i<lignes;i++){
   var on=t>(i+1)/(lignes+1.6);
   ctx.fillStyle=on?"rgba(212,175,55,.85)":"rgba(255,255,255,.14)";
   var w=(W-110)*(i===lignes-1?0.55:(0.9-i*0.1));
   ctx.beginPath();ctx.roundRect(54,34+i*((H*0.42-34)/lignes),w,6,3);ctx.fill();
 }
 pl(ctx,W-52,H*0.30,"C",G_NEU,12);
 for(var j=0;j<5;j++){
   var x=48+j*((W-96)/4);
   pl(ctx,x,H*0.76,"A",G_ATT,11,0.9);
 }
 gLegend(ctx,W,H,sc.note);
};

// Jeu du mini-basket : aire delimitee, deux equipes en mouvement, plusieurs
// ballons. Volontairement generique — l'intention est de montrer l'organisation
// (tout le monde actif, sur un espace borne), pas un placement tactique.
G_SCENES.jeu=function(ctx,t,sc,W,H){
 if(sc.panier){ dhc(ctx,W,H); } else { pq(ctx,W,H); }
 ctx.strokeStyle="rgba(255,255,255,.55)";ctx.lineWidth=2;
 ctx.beginPath();ctx.roundRect(14,14,W-28,H-42,6);ctx.stroke();
 ctx.setLineDash([5,4]);ctx.strokeStyle="rgba(255,255,255,.28)";
 ctx.beginPath();ctx.moveTo(W/2,14);ctx.lineTo(W/2,H-28);ctx.stroke();ctx.setLineDash([]);
 var eq=[{c:G_ATT,l:"A"},{c:G_NEU,l:"B"}];
 for(var e=0;e<2;e++){
   for(var i=0;i<4;i++){
     var ph=t*Math.PI*2+i*1.5+e*0.8;
     var cxb=e?W*0.72:W*0.28;
     var x=cl(cxb+Math.cos(ph)*(38+i*4),28,W-28);
     var y=cl(H*0.46+Math.sin(ph*1.3)*(30+i*3),28,H-40);
     pl(ctx,x,y,eq[e].l,eq[e].c,10);
     if(i<2) bl(ctx,x+11,y+7,5);
   }
 }
 for(var c2=0;c2<4;c2++) gCone(ctx,30+c2*((W-60)/3),H-32);
 gLegend(ctx,W,H,sc.note+" · tout le groupe actif");
};

var G_DUREES={jeu:5500,pnr:6500,ecran:6000,zone:7000,presse:7000,aide:6500,interieur:6000,rebond:5500,
 transition:6000,surnombre:5500,duel:5000,tir:6000,passe:6000,dribble:5000,circuit:6000,
 cercle:6000,athletique:5000,theorie:5000,opposition:7000};
var G_HAUTEURS={theorie:200,dribble:210,cercle:230,athletique:210,jeu:220};

// ── FABRIQUE ────────────────────────────────────────────────────────
// L'animation est construite a la demande puis enregistree dans le moteur,
// pour que lecture, pause et vitesse fonctionnent comme pour les autres.
function genAnimFor(catId,seaNum,sitIdx,sit){
 if(typeof SIT_ANIMS==="undefined"||!sit) return null;
 var id="gen|"+catId+"|"+seaNum+"|"+sitIdx;
 if(SIT_ANIMS[id]) return id;
 var sc;
 try{ sc=analyseSituation(sit,catId); }catch(e){ return null; }
 var rend=G_SCENES[sc.type]||G_SCENES.circuit;
 var H=G_HAUTEURS[sc.type]||(sc.terr==="full"?260:240);
 var fn=function(ctx,t){
   if(!ctx)return;
   var W=320;
   ctx.clearRect(0,0,W,H);
   try{ rend(ctx,cl(t,0,1),sc,W,H); }catch(e){
     pq(ctx,W,H);
     gLegend(ctx,W,H,sc.note||"Situation");
   }
   gTag(ctx,W,"Schema genere");
 };
 fn.height=H;
 SIT_ANIMS[id]=fn;
 SIT_DUR[id]=G_DUREES[sc.type]||6000;
 return id;
}

// ── GARDE-FOU ───────────────────────────────────────────────────────
// Un schema qui contredit son propre texte est pire que pas de schema :
// un atelier de finition dessine sans cercle fait douter le coach de tout le
// reste. Ce controle compare ce que la situation annonce et ce que la scene
// dessine reellement. A lancer depuis la console apres toute modification du
// contenu pedagogique : verifierCoherenceSchemas().
// Les scenes hors terrain (temps d'echange, travail athletique, jeu en cercle)
// en sont exemptees : elles n'ont pas vocation a montrer un panier.
var G_HORS_TERRAIN=["theorie","athletique","cercle"];
var G_TRAITS={
 opposition:{panier:1,def:1}, pnr:{panier:1,def:1}, ecran:{panier:1,def:1},
 zone:{panier:1,def:1}, presse:{panier:1,def:1}, aide:{panier:1,def:1},
 interieur:{panier:1,def:1}, rebond:{panier:1,def:1}, transition:{panier:1,def:1},
 surnombre:{panier:1,def:1}, duel:{panier:1,def:1}, tir:{panier:1,def:function(sc){return !!sc.def;}},
 passe:{panier:1,def:function(sc){return !!sc.def;}},
 circuit:{panier:function(sc){return !!sc.panier;},def:function(sc){return !!sc.def;}},
 dribble:{panier:function(sc){return !!sc.panier;},def:function(sc){return !!sc.def;}},
 jeu:{panier:function(sc){return !!sc.panier;},def:1}, // deux equipes opposees a l'image
 cercle:{panier:0,def:0}, athletique:{panier:0,def:0}, theorie:{panier:0,def:0}
};
function gTrait(type,cle,sc){
 var tr=G_TRAITS[type]; if(!tr) return false;
 var v=tr[cle];
 return (typeof v==="function")?v(sc):!!v;
}
// Second controle, independant du premier. Le controle ci-dessus compare le
// texte au dessin en s'appuyant sur les memes drapeaux que l'analyse : si
// l'analyse passe a cote d'un mot, le controle passe a cote aussi — c'est ce
// qui a laisse passer "Penetration et kick-out", dessine en atelier.
// Celui-ci part du vocabulaire metier et verifie que la scene retenue fait
// partie de celles qui peuvent legitimement l'illustrer.
// Les listes acceptables couvrent les chevauchements reels du basket — un
// exercice de rebond qui enchaine sur contre-attaque peut legitimement etre
// illustre par l'un ou l'autre. Ce qu'elles excluent volontairement, ce sont
// les scenes generiques (atelier, jeu, dribble, circulation) : une situation
// tactique illustree par un parcours de plots est l'erreur a attraper.
var G_ATTENDU=[
 {mot:/pick and roll|ecran porteur|ecran sur porteur/, ok:["pnr"]},
 {mot:/defense de zone|contre une zone|zone 2-3|zone 3-2|zone 1-3-1/, ok:["zone"]},
 {mot:/kick-?out|ressortie|aidant|aide defensive|rotation defensive/, ok:["aide","opposition","surnombre","zone","interieur","transition","pnr","ecran"]},
 {mot:/\becrans?\b|screen/, ok:["ecran","pnr","rebond","opposition","interieur","duel"]},
 {mot:/presse|pressing/, ok:["presse","transition","opposition","zone"]},
 {mot:/boxout|box out|rebond (defensif|offensif)/, ok:["rebond","opposition","duel","transition"]},
 {mot:/contre-attaque|3 couloirs|trois couloirs/, ok:["transition","opposition","surnombre","rebond","presse"]},
 {mot:/poste bas|poste haut|dos au panier/, ok:["interieur","opposition","duel","rebond","ecran","zone","tir"]},
 {mot:/lancer franc/, ok:["tir"]}
];
// Les scenes generiques ne doivent illustrer aucun motif tactique : si l'une
// d'elles entrait dans une liste ci-dessus, le controle perdrait son objet.
var G_GENERIQUES=["circuit","jeu","dribble","passe","cercle","theorie","athletique"];
function verifierArchetypes(){
 if(typeof ELITE_CATS==="undefined"||typeof getCyclesForCat!=="function") return [];
 var ecarts=[];
 ELITE_CATS.forEach(function(cat){
   getCyclesForCat(cat.id).forEach(function(cy){
     (cy.seas||[]).forEach(function(s){
       (s.sits||[]).forEach(function(sit,i){
         var sc; try{ sc=analyseSituation(sit,cat.id); }catch(e){ return; }
         var t=gNorm((sit.ti||"")+" . "+(sit.org||"")+" . "+(sit.desc||""));
         G_ATTENDU.forEach(function(r){
           if(r.mot.test(t) && r.ok.indexOf(sc.type)<0)
             ecarts.push(cat.id+" "+s.num+"."+(i+1)+" \""+(sit.ti||"")+"\" : texte "+r.mot.source.slice(0,28)+"... mais scene \""+sc.type+"\"");
         });
       });
     });
   });
 });
 if(ecarts.length) console.warn("Scenes douteuses au regard du vocabulaire ("+ecarts.length+") :\n"+ecarts.join("\n"));
 else console.log("Scenes : archetype coherent avec le vocabulaire de chaque situation.");
 return ecarts;
}
function verifierCoherenceSchemas(){
 if(typeof ELITE_CATS==="undefined"||typeof getCyclesForCat!=="function") return [];
 var ecarts=[];
 ELITE_CATS.forEach(function(cat){
   getCyclesForCat(cat.id).forEach(function(cy){
     (cy.seas||[]).forEach(function(s){
       (s.sits||[]).forEach(function(sit,i){
         var sc; try{ sc=analyseSituation(sit,cat.id); }catch(e){ return; }
         if(G_HORS_TERRAIN.indexOf(sc.type)>=0) return;
         if(sc.panier&&!gTrait(sc.type,"panier",sc))
           ecarts.push(cat.id+" "+s.num+"."+(i+1)+" ("+sc.type+") : parle de panier, n'en dessine pas");
         if(sc.def&&!gTrait(sc.type,"def",sc))
           ecarts.push(cat.id+" "+s.num+"."+(i+1)+" ("+sc.type+") : parle de defenseur, n'en dessine pas");
       });
     });
   });
 });
 if(ecarts.length) console.warn("Schemas incoherents avec leur texte ("+ecarts.length+") :\n"+ecarts.join("\n"));
 else console.log("Schemas : texte et dessin coherents sur toutes les situations.");
 return ecarts;
}
