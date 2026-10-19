/* ===== 08c-couleur-roue.js — Couleur du club : roue libre en plus de la palette =====
 * Le dirigeant peut choisir n'importe quelle teinte sur une roue (teinte = angle, intensité = rayon)
 * avec une barre de luminosité (dégradé blanc vers noir). Comme le texte des boutons et de l'en-tête est blanc, la couleur
 * est automatiquement assombrie jusqu'à un contraste >= 4,5:1 avec le blanc (même exigence que la palette).
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

function couleurRoueOuvrir(rang){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  var s=gmSheet(rang===2?"Couleur secondaire":"Couleur principale");
  var T=260, R=T/2, etat={h:210,s:0.7,l:0.4};
  var cv=document.createElement("canvas"); cv.width=T; cv.height=T;
  cv.style.cssText="display:block;margin:4px auto 12px;border-radius:50%;touch-action:none;cursor:crosshair;max-width:100%";
  var ctx=cv.getContext("2d");
  var curseur=document.createElement("div");
  var zone=document.createElement("div"); zone.style.cssText="position:relative;width:"+T+"px;max-width:100%;margin:0 auto";
  curseur.style.cssText="position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.45);pointer-events:none";
  zone.appendChild(cv); zone.appendChild(curseur); s.body.appendChild(zone);
  // Barre de luminosité : dégradé blanc (à gauche) vers noir (à droite), à toucher ou faire glisser.
  var barre=document.createElement("div");
  barre.style.cssText="position:relative;height:30px;border-radius:15px;margin:2px 0 14px;background:linear-gradient(to right,#fff,#000);border:1px solid var(--bdr);touch-action:none;cursor:pointer";
  var poignee=document.createElement("div");
  poignee.style.cssText="position:absolute;top:-3px;width:14px;height:34px;margin-left:-7px;border-radius:7px;background:#fff;border:2px solid #333;box-shadow:0 1px 3px rgba(0,0,0,.4);pointer-events:none";
  barre.appendChild(poignee); barre.setAttribute("role","slider"); barre.setAttribute("aria-label","Luminosité, du blanc au noir");
  s.body.appendChild(barre);
  var apercu=document.createElement("div");
  apercu.style.cssText="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border-radius:12px;font-weight:800;font-size:15px;color:#fff;margin-bottom:6px";
  var note=document.createElement("div"); note.style.cssText="font-size:11px;color:var(--mut);min-height:16px;text-align:center;margin-bottom:10px";
  s.body.appendChild(apercu); s.body.appendChild(note);
  function dessiner(){
    var img=ctx.createImageData(T,T);
    for(var y=0;y<T;y++) for(var x=0;x<T;x++){
      var dx=x-R+0.5, dy=y-R+0.5, d=Math.sqrt(dx*dx+dy*dy), i=(y*T+x)*4;
      if(d>R){ img.data[i+3]=0; continue; }
      var h=(Math.atan2(dy,dx)*180/Math.PI+360)%360, hex=gmHslVersHex(h,d/R,etat.l);
      img.data[i]=parseInt(hex.slice(1,3),16); img.data[i+1]=parseInt(hex.slice(3,5),16); img.data[i+2]=parseInt(hex.slice(5,7),16); img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
  var choisie="#1f6b40";
  function maj(){
    var brute=gmHslVersHex(etat.h,etat.s,etat.l);
    if(brute!=="#ffffff"){
      /* la barre ne propose que des teintes lisibles : on bloque la poignée au plus clair possible (sinon la moitié claire de la barre donnait toujours la même couleur) */
      var l2=etat.l, n=0, hx=brute;
      while(gmContrasteBlanc(hx)<4.5&&n<80){ l2*=0.96; hx=gmHslVersHex(etat.h,etat.s,l2); n++; }
      if(l2!==etat.l){ etat.l=l2; dessiner(); brute=hx; }
    }
    choisie=brute;   // blanc = vrai blanc (l'appli gère le texte)
    poignee.style.left=((1-etat.l)*100)+"%";
    var ang=etat.h*Math.PI/180;
    curseur.style.left=(R+Math.cos(ang)*etat.s*R)*(cv.clientWidth/T||1)+"px"; curseur.style.top=(R+Math.sin(ang)*etat.s*R)*(cv.clientHeight/T||1)+"px";
    apercu.style.background=choisie; apercu.style.color=(choisie==="#ffffff")?"#1f2937":"#fff"; apercu.style.border=(choisie==="#ffffff")?"1px solid var(--bdr)":"none"; apercu.innerHTML='<span>Aa</span><span style="font-size:12px;font-weight:600;opacity:.9">'+choisie+'</span>';
    note.textContent=(choisie==="#ffffff")?"Blanc : l'appli utilise un gris foncé pour garder le texte lisible.":"";
  }
  function pointer(e){
    var r=cv.getBoundingClientRect(), k=T/r.width;
    var dx=(e.clientX-r.left)*k-R, dy=(e.clientY-r.top)*k-R, d=Math.min(Math.sqrt(dx*dx+dy*dy),R);
    etat.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360; etat.s=d/R; maj();
  }
  var bas=false;
  cv.addEventListener("pointerdown",function(e){ bas=true; try{cv.setPointerCapture(e.pointerId);}catch(x){} pointer(e); });
  cv.addEventListener("pointermove",function(e){ if(bas) pointer(e); });
  cv.addEventListener("pointerup",function(){ bas=false; });
  var basB=false;
  function pointerB(e){ var r=barre.getBoundingClientRect(); etat.l=1-Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)); if(etat.l>0.96) etat.l=1; else if(etat.l<0.04) etat.l=0; /* les deux bouts = vrai blanc / vrai noir */ dessiner(); maj(); }
  barre.addEventListener("pointerdown",function(e){ basB=true; try{barre.setPointerCapture(e.pointerId);}catch(x){} pointerB(e); });
  barre.addEventListener("pointermove",function(e){ if(basB) pointerB(e); });
  barre.addEventListener("pointerup",function(){ basB=false; });
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Utiliser cette couleur","primary",function(){ s.modal.remove(); couleurRoueValider(choisie,rang); }));
  row.appendChild(gmBtn("Blanc","soft",function(){ s.modal.remove(); couleurRoueValider("#ffffff",rang); }));
  dessiner(); maj();
}
// rang 1 = couleur principale, 2 = secondaire. Le blanc est permis (l'appli le remplace par un gris lisible).
function couleurRoueValider(hex,rang){
  hex=String(hex).toLowerCase();
  if(hex!=="#ffffff"&&(!/^#[0-9a-f]{6}$/.test(hex)||gmContrasteBlanc(hex)<4.5)) return;
  var c1=clubCouleurBrute(), c2=clubCouleur2Brute();
  if(rang===2&&c1) enregistrerCouleursClub(c1,hex);
  else enregistrerCouleursClub(hex,c2);
}
