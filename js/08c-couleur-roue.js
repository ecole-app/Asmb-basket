/* ===== 08c-couleur-roue.js — Couleur du club : roue libre en plus de la palette =====
 * Le dirigeant peut choisir n'importe quelle teinte sur une roue (teinte = angle, intensité = rayon)
 * avec un curseur de luminosité. Comme le texte des boutons et de l'en-tête est blanc, la couleur
 * est automatiquement assombrie jusqu'à un contraste >= 4,5:1 avec le blanc (même exigence que la palette).
 */
function gmLuminance(hex){
  var c=[1,3,5].map(function(i){ var v=parseInt(hex.slice(i,i+2),16)/255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); });
  return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
}
function gmContrasteBlanc(hex){ return 1.05/(gmLuminance(hex)+0.05); }
function gmHsvVersHex(h,s,v){
  var c=v*s, x=c*(1-Math.abs((h/60)%2-1)), m=v-c, r=0,g=0,b=0;
  if(h<60){r=c;g=x;} else if(h<120){r=x;g=c;} else if(h<180){g=c;b=x;} else if(h<240){g=x;b=c;} else if(h<300){r=x;b=c;} else {r=c;b=x;}
  return "#"+[r+m,g+m,b+m].map(function(t){ return ("0"+Math.round(Math.max(0,Math.min(1,t))*255).toString(16)).slice(-2); }).join("");
}
// Assombrit la teinte (même teinte et même intensité) jusqu'à un contraste >= 4,5 avec le blanc.
function gmCouleurLisible(h,s,v){
  var hex=gmHsvVersHex(h,s,v), n=0;
  while(gmContrasteBlanc(hex)<4.5&&n<60){ v*=0.96; hex=gmHsvVersHex(h,s,v); n++; }
  return hex;
}

function couleurRoueOuvrir(){
  if(localStorage.getItem("asmb_profile")!=="dirigeant"){ askAlert("Réservé au dirigeant."); return; }
  var s=gmSheet("Choisir une couleur");
  var T=260, R=T/2, etat={h:210,s:0.7,v:0.8};
  var cv=document.createElement("canvas"); cv.width=T; cv.height=T;
  cv.style.cssText="display:block;margin:4px auto 12px;border-radius:50%;touch-action:none;cursor:crosshair;max-width:100%";
  var ctx=cv.getContext("2d");
  var curseur=document.createElement("div");
  var zone=document.createElement("div"); zone.style.cssText="position:relative;width:"+T+"px;max-width:100%;margin:0 auto";
  curseur.style.cssText="position:absolute;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 1.5px rgba(0,0,0,.45);pointer-events:none";
  zone.appendChild(cv); zone.appendChild(curseur); s.body.appendChild(zone);
  var lum=document.createElement("input"); lum.type="range"; lum.min="25"; lum.max="100"; lum.value=String(Math.round(etat.v*100));
  lum.style.cssText="width:100%;margin:6px 0 10px"; lum.setAttribute("aria-label","Luminosité");
  s.body.appendChild(lum);
  var apercu=document.createElement("div");
  apercu.style.cssText="display:flex;align-items:center;justify-content:center;gap:10px;padding:14px;border-radius:12px;font-weight:800;font-size:15px;color:#fff;margin-bottom:6px";
  var note=document.createElement("div"); note.style.cssText="font-size:11px;color:var(--mut);min-height:16px;text-align:center;margin-bottom:10px";
  s.body.appendChild(apercu); s.body.appendChild(note);
  function dessiner(){
    var img=ctx.createImageData(T,T);
    for(var y=0;y<T;y++) for(var x=0;x<T;x++){
      var dx=x-R+0.5, dy=y-R+0.5, d=Math.sqrt(dx*dx+dy*dy), i=(y*T+x)*4;
      if(d>R){ img.data[i+3]=0; continue; }
      var h=(Math.atan2(dy,dx)*180/Math.PI+360)%360, hex=gmHsvVersHex(h,d/R,etat.v);
      img.data[i]=parseInt(hex.slice(1,3),16); img.data[i+1]=parseInt(hex.slice(3,5),16); img.data[i+2]=parseInt(hex.slice(5,7),16); img.data[i+3]=255;
    }
    ctx.putImageData(img,0,0);
  }
  var choisie="#1f6b40";
  function maj(){
    var brute=gmHsvVersHex(etat.h,etat.s,etat.v);
    choisie=gmCouleurLisible(etat.h,etat.s,etat.v);
    var ang=etat.h*Math.PI/180, px=R+Math.cos(ang)*etat.s*R*(cv.clientWidth/T||1), py=R+Math.sin(ang)*etat.s*R*(cv.clientHeight/T||1);
    curseur.style.left=(R+Math.cos(ang)*etat.s*R)*(cv.clientWidth/T||1)+"px"; curseur.style.top=(R+Math.sin(ang)*etat.s*R)*(cv.clientHeight/T||1)+"px";
    apercu.style.background=choisie; apercu.innerHTML='<span>Aa</span><span style="font-size:12px;font-weight:600;opacity:.9">'+choisie+'</span>';
    note.textContent=(choisie!==brute)?"Teinte assombrie pour que le texte blanc reste lisible.":"";
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
  lum.addEventListener("input",function(){ etat.v=Number(lum.value)/100; dessiner(); maj(); });
  var row=gmRow(s.body);
  row.appendChild(gmBtn("Utiliser cette couleur","primary",function(){ s.modal.remove(); couleurRoueValider(choisie); }));
  dessiner(); maj();
}
// Même logique que toucher une pastille : 1re touche = principale, 2e = secondaire.
function couleurRoueValider(hex){
  hex=String(hex).toLowerCase();
  if(!/^#[0-9a-f]{6}$/.test(hex)||gmContrasteBlanc(hex)<4.5) return;
  var c1=clubCouleurBrute(), c2=clubCouleur2Brute();
  if(hex===c1||hex===c2) return;
  toucherCouleurClub(hex);
}
