/* ===== 08c-couleur-roue.js — Couleur du club : roue de couleurs (comme iro.js / Google) =====
 * Roue : teinte = angle, intensité = distance au centre (centre blanc, bord vif).
 * Barre : luminosité, de la couleur à fond (gauche) au noir (droite).
 * Toutes les couleurs sont permises : sur une couleur claire, l'appli met le texte en noir
 * (en-tête, bandeau d'accueil) et garde une version foncée de la teinte pour les boutons
 * (clubNormaliserCouleurs, js/01-config.js).
 */
function gmLuminance(hex){
  var c=[1,3,5].map(function(i){ var v=parseInt(hex.slice(i,i+2),16)/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
function gmContrasteBlanc(hex){ return 1.05/(gmLuminance(hex)+0.05); }
function gmHslVersHex(h,s,l){
  var c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2, r=0,g=0,b=0;
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
  return "#"+[r+m,g+m,b+m].map(function(t){ return ("0"+Math.round(Math.max(0,Math.min(1,t))*255).toString(16)).slice(-2); }).join("");
}
// Assombrit (même teinte, même intensité) jusqu'à un contraste >= 4,5 avec le blanc.
function gmCouleurLisible(h,s,l){
  var hex=gmHslVersHex(h,s,l), n=0;
  while(gmContrasteBlanc(hex)<4.5&&n<80){ l*=0.96; hex=gmHslVersHex(h,s,l); n++; }
  return hex;
}

function gmHsvVersHex(h,s,v){
  var f=function(n){ var k=(n+h/60)%6; return v-v*s*Math.max(0,Math.min(k,4-k,1)); };
  return "#"+[f(5),f(3),f(1)].map(function(t){ return ("0"+Math.round(Math.max(0,Math.min(1,t))*255).toString(16)).slice(-2); }).join("");
}
function gmHexVersHsv(hex){
  var c=[1,3,5].map(function(i){ return parseInt(hex.slice(i,i+2),16)/255; }), mx=Math.max.apply(null,c), mn=Math.min.apply(null,c), d=mx-mn, h=0;
  if(d){ h=mx===c[0]?((c[1]-c[2])/d+6)%6:mx===c[1]?(c[2]-c[0])/d+2:(c[0]-c[1])/d+4; h*=60; }
  return {h:h,s:mx?d/mx:0,v:mx};
}
function couleurRoueOuvrir(rang){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  var s=gmSheet(rang===2?"Couleur secondaire":"Couleur principale");
  var dep=(rang===2?clubCouleur2Brute():clubCouleurBrute())||"#2477cb";
  var T=260, R=T/2, etat=gmHexVersHsv(dep);
  var cv=document.createElement("canvas"); cv.width=T; cv.height=T;
  cv.style.cssText="display:block;margin:4px auto 12px;border-radius:50%;touch-action:none;cursor:crosshair;max-width:100%";
  var ctx=cv.getContext("2d");
  var curseur=document.createElement("div");
  var zone=document.createElement("div"); zone.style.cssText="position:relative;width:"+T+"px;max-width:100%;margin:0 auto";
  curseur.style.cssText="position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.45);pointer-events:none";
  zone.appendChild(cv); zone.appendChild(curseur); s.body.appendChild(zone);
  var barre=document.createElement("div");
  barre.style.cssText="position:relative;height:30px;border-radius:15px;margin:2px 0 14px;border:1px solid var(--bdr);touch-action:none;cursor:pointer";
  var poignee=document.createElement("div");
  poignee.style.cssText="position:absolute;top:-3px;width:14px;height:34px;margin-left:-7px;border-radius:7px;background:#fff;border:2px solid #333;box-shadow:0 1px 3px rgba(0,0,0,.4);pointer-events:none";
  barre.appendChild(poignee); barre.setAttribute("role","slider"); barre.setAttribute("aria-label","Luminosité, de la couleur au noir");
  s.body.appendChild(barre);
  var apercu=document.createElement("div");
  apercu.style.cssText="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border-radius:12px;font-weight:800;font-size:15px;margin-bottom:6px";
  var note=document.createElement("div"); note.style.cssText="font-size:11px;color:var(--mut);min-height:16px;text-align:center;margin-bottom:10px";
  s.body.appendChild(apercu); s.body.appendChild(note);
  var vDessin=-1;
  function dessiner(){
    if(vDessin===etat.v) return; vDessin=etat.v;
    var img=ctx.createImageData(T,T), v=etat.v;
    for(var y=0;y<T;y++) for(var x=0;x<T;x++){
      var dx=x-R+0.5, dy=y-R+0.5, d=Math.sqrt(dx*dx+dy*dy), i=(y*T+x)*4;
      if(d>R){ img.data[i+3]=0; continue; }
      var h=(Math.atan2(dy,dx)*180/Math.PI+360)%360, sat=d/R;
      for(var n=0;n<3;n++){ var k=([5,3,1][n]+h/60)%6; img.data[i+n]=Math.round((v-v*sat*Math.max(0,Math.min(k,4-k,1)))*255); }
      img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
  var choisie=dep;
  function maj(){
    choisie=gmHsvVersHex(etat.h,etat.s,etat.v);
    barre.style.background="linear-gradient(to right,"+gmHsvVersHex(etat.h,etat.s,1)+",#000)";
    poignee.style.left=((1-etat.v)*100)+"%";
    var ang=etat.h*Math.PI/180, k=(cv.clientWidth/T||1);
    curseur.style.left=(R+Math.cos(ang)*etat.s*R)*k+"px"; curseur.style.top=(R+Math.sin(ang)*etat.s*R)*k+"px";
    curseur.style.background=choisie;
    var clair=gmContrasteBlanc(choisie)<4.5;
    apercu.style.background=choisie; apercu.style.color=clair?"#14141f":"#fff"; apercu.style.border=clair?"1px solid var(--bdr)":"none";
    apercu.innerHTML='<span>Aa</span><span style="font-size:12px;font-weight:600;opacity:.9">'+choisie+'</span>';
    note.textContent=clair?"Couleur claire : texte noir sur l'en-tête et l'accueil, boutons dans une version plus foncée de la teinte.":"";
  }
  function pointer(e){
    var r=cv.getBoundingClientRect(), k=T/r.width;
    var dx=(e.clientX-r.left)*k-R, dy=(e.clientY-r.top)*k-R, d=Math.min(Math.sqrt(dx*dx+dy*dy),R);
    etat.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360; etat.s=d/R<0.04?0:d/R;   // tout au centre = blanc pur (si la barre est à gauche)
    maj();
  }
  var bas=false;
  cv.addEventListener("pointerdown",function(e){ bas=true; try{cv.setPointerCapture(e.pointerId);}catch(x){} pointer(e); });
  cv.addEventListener("pointermove",function(e){ if(bas) pointer(e); });
  cv.addEventListener("pointerup",function(){ bas=false; });
  var basB=false;
  function pointerB(e){ var r=barre.getBoundingClientRect(); var t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(t<0.03) t=0; else if(t>0.97) t=1; etat.v=1-t; dessiner(); maj(); }
  barre.addEventListener("pointerdown",function(e){ basB=true; try{barre.setPointerCapture(e.pointerId);}catch(x){} pointerB(e); });
  barre.addEventListener("pointermove",function(e){ if(basB) pointerB(e); });
  barre.addEventListener("pointerup",function(){ basB=false; });
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Utiliser cette couleur","primary",function(){ s.modal.remove(); couleurRoueValider(choisie,rang); }));
  row.appendChild(gmBtn("Blanc","soft",function(){ s.modal.remove(); couleurRoueValider("#ffffff",rang); }));
  dessiner(); maj();
}
// rang 1 = couleur principale, 2 = secondaire. Toute couleur est permise (claire = texte noir).
function couleurRoueValider(hex,rang){
  hex=String(hex).toLowerCase();
  if(!/^#[0-9a-f]{6}$/.test(hex)) return;
  var c1=clubCouleurBrute(), c2=clubCouleur2Brute();
  if(rang===2&&c1) enregistrerCouleursClub(c1,hex);
  else enregistrerCouleursClub(hex,c2);
}
