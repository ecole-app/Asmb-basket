/* ===== 14d-affiche.js — Éditeur d'affiche d'un événement (réseaux et impression) ===== */
// Dessinée en Canvas 2D (pas de capture HTML) : le même rendu sert d'aperçu,
// d'image PNG (post carré 1080×1080, story 1080×1917) et de PDF A4.
// 6 modèles, infos à cocher, logo et couleurs du club, intervenants avec photo,
// sponsors dans un bandeau SOUS l'affiche (jamais dessus), QR code d'inscription,
// places restantes en temps réel (à 5 places : proposition de republier ;
// à 0 : tampon « COMPLET »). Réglages gardés dans l'événement (e.affiche) ;
// la photo de fond reste sur l'appareil (trop lourde pour la base).

var AF_MODELES=[["degrade","Dégradé"],["plein","Couleur pleine"],["sport","Sport"],["photo","Photo plein écran"],["epure","Épurée"],["calendrier","Calendrier"]];
var AF_FORMATS={
  carre:{nom:"Post carré",bw:520,bh:520,W:1080,H:1080},
  story:{nom:"Story",bw:338,bh:600,W:1080,H:1917},
  a4:{nom:"A4 à imprimer",bw:424,bh:600,W:1240,H:1754}
};
var AF_INFOS=[["accroche","Accroche"],["dates","Dates"],["horaires","Horaires"],["lieu","Lieu"],["prix","Tarifs"],["places","Places restantes"],["texte","Texte libre"],["programme","Programme"],["intervenants","Intervenants"],["qr","QR code d'inscription"],["sponsors","Logos des sponsors"]];
var AF_TAGS={stage:"Stage",tournoi:"Tournoi",soiree:"Soirée"};
var AF_F={sans:"'Plus Jakarta Sans', system-ui, -apple-system, sans-serif",anton:"Anton, Impact, 'Arial Narrow', sans-serif",serif:"Fraunces, Georgia, serif",mono:"'JetBrains Mono', ui-monospace, monospace"};
var AF_JOURS=["DIM","LUN","MAR","MER","JEU","VEN","SAM"];
var AF_MOIS=["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
var AF_MOIS_C=["JANV.","FÉVR.","MARS","AVR.","MAI","JUIN","JUIL.","AOÛT","SEPT.","OCT.","NOV.","DÉC."];

// ── Polices (chargées une fois, à la demande) ────────────────────────
var AF_FONTS_OK=null;
function afPolices(){
  if(AF_FONTS_OK) return AF_FONTS_OK;
  AF_FONTS_OK=new Promise(function(ok){
    var fin=setTimeout(ok,4000);
    function charger(){
      if(!document.fonts||!document.fonts.load){ clearTimeout(fin); ok(); return; }
      Promise.all(["40px Anton","800 40px Fraunces","italic 500 40px Fraunces","800 40px 'JetBrains Mono'","800 40px 'Plus Jakarta Sans'","600 40px 'Plus Jakarta Sans'","500 40px 'Plus Jakarta Sans'"].map(function(f){ return document.fonts.load(f).catch(function(){}); }))
        .then(function(){ clearTimeout(fin); ok(); });
    }
    var l=document.getElementById("af-fonts");
    if(l){ charger(); return; }
    l=document.createElement("link"); l.id="af-fonts"; l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=Anton&family=Fraunces:ital,opsz,wght@0,9..144,800;1,9..144,500&family=JetBrains+Mono:wght@800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap";
    l.onload=charger; l.onerror=function(){ clearTimeout(fin); ok(); };
    document.head.appendChild(l);
  });
  return AF_FONTS_OK;
}
function afImage(src){
  return new Promise(function(ok){
    if(!src){ ok(null); return; }
    var i=new Image(); i.onload=function(){ ok(i); }; i.onerror=function(){ ok(null); }; i.src=src;
  });
}
function afQr(texte){
  if(typeof QRCode==="undefined"||!texte) return null;
  var d=document.createElement("div");
  try{ new QRCode(d,{text:texte,width:256,height:256,colorDark:"#111827",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M}); }catch(e){ return null; }
  return d.querySelector("canvas")||d.querySelector("img");
}
function afInitiales(s){
  var m=String(s||"").replace(/[^A-Za-zÀ-ÿ0-9 ]/g," ").split(/\s+/).filter(function(w){return w.length>1||/[0-9]/.test(w);});
  return ((m[0]||"C").charAt(0)+(m[1]?m[1].charAt(0):"")).toUpperCase();
}
function afHex(c){ c=String(c||"").trim(); return /^#[0-9a-f]{6}$/i.test(c)?c:null; }
function afMix(hex, k){ // k<0 : plus sombre, k>0 : plus clair
  var h=afHex(hex)||"#1A2E5A", r=parseInt(h.substr(1,2),16), g=parseInt(h.substr(3,2),16), b=parseInt(h.substr(5,2),16);
  function f(v){ return Math.round(k<0?v*(1+k):v+(255-v)*k); }
  return "rgb("+f(r)+","+f(g)+","+f(b)+")";
}

// ── Dates sous plusieurs formes ─────────────────────────────────────
function afDates(e){
  if(!e||!e.date) return null;
  var a=new Date(e.date+"T12:00:00"), b=new Date((e.dateFin||e.date)+"T12:00:00");
  if(isNaN(a)) return null; if(isNaN(b)||b<a) b=a;
  var meme=a.getTime()===b.getTime(), mm=a.getMonth()===b.getMonth()&&a.getFullYear()===b.getFullYear();
  var jours=Math.round((b-a)/86400000)+1;
  var long=meme?(a.toLocaleDateString("fr-FR",{weekday:"long"})+" "+a.getDate()+" "+AF_MOIS[a.getMonth()]+" "+a.getFullYear())
    :mm?(a.getDate()+" – "+b.getDate()+" "+AF_MOIS[a.getMonth()]+" "+a.getFullYear())
    :(a.getDate()+" "+AF_MOIS_C[a.getMonth()].toLowerCase()+" – "+b.getDate()+" "+AF_MOIS_C[b.getMonth()].toLowerCase()+" "+b.getFullYear());
  var court=meme?(a.getDate()+" "+AF_MOIS_C[a.getMonth()]+" "+a.getFullYear())
    :mm?(a.getDate()+" → "+b.getDate()+" "+AF_MOIS_C[a.getMonth()]+" "+a.getFullYear())
    :(a.getDate()+" "+AF_MOIS_C[a.getMonth()]+" → "+b.getDate()+" "+AF_MOIS_C[b.getMonth()]);
  var liste=null;
  if(jours<=7){ liste=[]; for(var i=0;i<jours;i++){ var d=new Date(a.getTime()+i*86400000); liste.push({j:AF_JOURS[d.getDay()],n:String(d.getDate())}); } }
  return {
    long:long, court:court.toUpperCase(), espace:long.toUpperCase().replace(/ – /," — "),
    badge:meme?String(a.getDate()):(mm?a.getDate()+"-"+b.getDate():a.getDate()+"/"+(a.getMonth()+1)),
    badgeMois:(mm||meme)?AF_MOIS[a.getMonth()].toUpperCase():AF_MOIS_C[a.getMonth()]+"→"+AF_MOIS_C[b.getMonth()],
    mois:(AF_MOIS[a.getMonth()]+" "+a.getFullYear()).toUpperCase()+(mm?"":" → "+AF_MOIS[b.getMonth()].toUpperCase()),
    jours:liste
  };
}
function afPlacesTxt(n){ return n===1?"DERNIÈRE PLACE !":(n<=5?"PLUS QUE "+n+" PLACES":n+" PLACES RESTANTES"); }
function afAlerteTxt(n){ return n===0?"C'est complet":(n===1?"Il ne reste plus qu'une place":"Il ne reste plus que "+n+" places"); }

// ── Primitives de dessin (coordonnées en unités de maquette) ─────────
function afFont(o){ return (o.italic?"italic ":"")+(o.weight||500)+" "+o.size+"px "+(o.fam||AF_F.sans); }
function afMesure(ctx,s,ls){ return ctx.measureText(s).width+(ls?ls*Math.max(0,s.length-1):0); }
function afEcrire(ctx,s,x,y,ls){
  if(!ls){ ctx.fillText(s,x,y); return; }
  for(var i=0;i<s.length;i++){ ctx.fillText(s[i],x,y); x+=ctx.measureText(s[i]).width+ls; }
}
function afCouper(ctx,s,maxW,ls,pre){
  var out=[];
  if(pre){
    // Texte saisi tel quel : retours à la ligne et espaces multiples conservés.
    String(s).split("\n").forEach(function(par){
      var morceaux=par.split(/( +)/).filter(function(x){return x!=="";}), ligne="";
      morceaux.forEach(function(m){
        var t=ligne+m;
        if(!ligne||afMesure(ctx,t.replace(/ +$/,""),ls)<=maxW) ligne=t;
        else { out.push(ligne.replace(/ +$/,"")); ligne=/^ +$/.test(m)?"":m; }
      });
      out.push(ligne.replace(/ +$/,""));
    });
    return out;
  }
  String(s).split("\n").forEach(function(par){
    var mots=par.split(/\s+/).filter(Boolean), ligne="";
    mots.forEach(function(m){
      var t=ligne?ligne+" "+m:m;
      if(!ligne||afMesure(ctx,t,ls)<=maxW) ligne=t; else { out.push(ligne); ligne=m; }
    });
    out.push(ligne);
  });
  return out;
}
// Texte (retour à la ligne, nb de lignes max) ; renvoie la hauteur utilisée.
// fit:true → la taille baisse jusqu'à ce que tout tienne (aucun mot coupé).
function afTexte(D,s,x,y,o){
  if(s==null||s==="") return 0;
  var ctx=D.ctx; s=o.upper?String(s).toUpperCase():String(s);
  var size=o.size, lignes;
  for(var essai=0;essai<14;essai++){
    ctx.font=afFont({italic:o.italic,weight:o.weight,size:size,fam:o.fam});
    lignes=o.maxW?afCouper(ctx,s,o.maxW,o.ls,o.pre):[s];
    var tropLarge=o.maxW&&lignes.some(function(l){ return afMesure(ctx,l,o.ls)>o.maxW+0.5; });
    if(!o.fit||((!o.maxLines||lignes.length<=o.maxLines)&&!tropLarge)) break;
    size*=0.92;
  }
  if(o.maxLines&&lignes.length>o.maxLines){
    lignes=lignes.slice(0,o.maxLines);
    var d=lignes[o.maxLines-1];
    while(d.length>1&&afMesure(ctx,d+"…",o.ls)>o.maxW) d=d.slice(0,-1);
    lignes[o.maxLines-1]=d.replace(/\s+$/,"")+"…";
  }
  var lh=(o.lh||1.22)*size, larg=0;
  lignes.forEach(function(l,i){
    var w=afMesure(ctx,l,o.ls); larg=Math.max(larg,w);
    if(D.dry) return;
    var xx=o.align==="center"?x-w/2:(o.align==="right"?x-w:x);
    ctx.fillStyle=o.color||"#fff"; ctx.textBaseline="top";
    afEcrire(ctx,l,xx,y+i*lh+(o.dy||0)*size,o.ls);
  });
  D.lastW=larg;
  return lignes.length*lh;
}
function afRect(D,x,y,w,h,r,fill,stroke,sw){
  if(D.dry) return; var c=D.ctx;
  c.beginPath();
  if(c.roundRect) c.roundRect(x,y,w,h,r||0); else c.rect(x,y,w,h);
  if(fill){ c.fillStyle=fill; c.fill(); }
  if(stroke){ c.strokeStyle=stroke; c.lineWidth=sw||1; c.stroke(); }
}
function afImgCouvre(c,img,x,y,w,h){
  var r=Math.max(w/img.width,h/img.height), iw=img.width*r, ih=img.height*r;
  c.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
function afImgContient(c,img,x,y,w,h){
  var r=Math.min(w/img.width,h/img.height), iw=img.width*r, ih=img.height*r;
  c.drawImage(img,x+(w-iw)/2,y+(h-ih)/2,iw,ih);
}
// Logo du club dans un rond (ou carré arrondi), sinon ses initiales.
function afLogo(D,C,x,y,d,o){
  if(D.dry) return; var c=D.ctx; o=o||{};
  c.save(); c.beginPath();
  if(o.carre&&c.roundRect) c.roundRect(x,y,d,d,d*0.2); else c.arc(x+d/2,y+d/2,d/2,0,Math.PI*2);
  c.fillStyle=C.logo?"#fff":(o.bg||"#fff"); c.fill();
  if(o.ring){ c.lineWidth=1.5; c.strokeStyle=o.ring; c.stroke(); }
  c.clip();
  if(C.logo) afImgContient(c,C.logo,x+d*0.12,y+d*0.12,d*0.76,d*0.76);
  c.restore();
  if(!C.logo){ D.ctx.textAlign="left"; afTexte(D,C.initiales,x+d/2,y+d*0.3,{size:d*0.33,weight:800,color:o.fg||C.c1,align:"center",lh:1}); }
}
function afQrBox(D,C,x,y,s,pad,o){
  if(D.dry||!C.qr) return; o=o||{};
  afRect(D,x,y,s+pad*2,s+pad*2,o.r||0,o.bg||"#fff",o.stroke,o.sw);
  D.ctx.imageSmoothingEnabled=false; D.ctx.drawImage(C.qr,x+pad,y+pad,s,s); D.ctx.imageSmoothingEnabled=true;
}
// Intervenants : « AVEC », puis photo ronde + nom + rôle (4 max).
function afIntervenants(D,C,x,y,w,col,align,k){
  var l=C.interv; if(!l.length) return 0;
  var h=afTexte(D,"AVEC",align==="center"?x+w/2:x,y,{size:10*k,weight:800,ls:2*k,color:col,align:align==="center"?"center":"left",lh:1.1});
  y+=h+6*k;
  var n=l.length, iw=Math.min(w/n,118*k), d=Math.min(44*k,iw-10*k), x0=align==="center"?x+(w-n*iw)/2:x, hMax=0;
  l.forEach(function(it,i){
    var cx=x0+i*iw+iw/2;
    if(!D.dry){
      var c=D.ctx; c.save(); c.beginPath(); c.arc(cx,y+d/2,d/2,0,Math.PI*2); c.fillStyle=it.img?"#fff":C.c2; c.fill(); c.clip();
      if(it.img) afImgCouvre(c,it.img,cx-d/2,y,d,d);
      c.restore();
      c.beginPath(); c.arc(cx,y+d/2,d/2,0,Math.PI*2); c.lineWidth=2*k; c.strokeStyle=col; c.globalAlpha=.85; c.stroke(); c.globalAlpha=1;
      if(!it.img) afTexte(D,afInitiales(it.nom),cx,y+d*0.3,{size:d*0.34,weight:800,color:"#fff",align:"center",lh:1});
    }
    var hh=d+5*k;
    hh+=afTexte(D,it.nom,cx,y+hh,{size:11*k,weight:800,color:col,align:"center",maxW:iw-6*k,maxLines:1,lh:1.2});
    if(it.role) hh+=afTexte(D,it.role,cx,y+hh,{size:9.5*k,weight:600,color:col,align:"center",maxW:iw-6*k,maxLines:2,lh:1.2});
    hMax=Math.max(hMax,hh);
  });
  return h+6*k+hMax;
}
function afPrixLignes(C){ return C.prix.map(function(t){ return (t.prix>0?evtPrix(t.prix):"Gratuit")+" · "+t.nom; }); }

// ── Les 6 modèles. Chacun renvoie true s'il déborde (mode mesure). ──
function afModeleSimple(D,C,L,k,plein){
  var c=D.ctx, x=L.x+24, w=L.w-48, y=L.y+24, bas=L.y+L.h-24, S=C.show;
  if(!D.dry){
    if(plein){ c.fillStyle=C.c1; c.fillRect(L.x,L.y,L.w,L.h); }
    else { var g=c.createLinearGradient(L.x,L.y,L.x+L.w*0.6,L.y+L.h); g.addColorStop(0,C.c1); g.addColorStop(1,C.c2); c.fillStyle=g; c.fillRect(L.x,L.y,L.w,L.h); }
  }
  // Bas : tarifs (encadré blanc) + QR
  var qrS=S.qr&&C.qr?64:0, hb=qrS?qrS+12+14:0, pl=S.prix?afPrixLignes(C):[];
  if(pl.length){
    var D2={ctx:c,dry:true}; var hp=afTexte(D2,pl.join("\n"),0,0,{size:13,weight:800,lh:1.4,maxW:w-qrS-40}); var wp=D2.lastW+20;
    hb=Math.max(hb,hp+12);
    afRect(D,x,bas-hp-12,wp,hp+12,8,"#fff");
    afTexte(D,pl.join("\n"),x+10,bas-hp-6,{size:13,weight:800,lh:1.4,color:"#111827",maxW:w-qrS-40});
  }
  if(qrS){
    afRect(D,x+w-qrS-12,bas-qrS-26,qrS+12,qrS+26,8,"#fff");
    if(!D.dry&&C.qr){ c.imageSmoothingEnabled=false; c.drawImage(C.qr,x+w-qrS-6,bas-qrS-20,qrS,qrS); c.imageSmoothingEnabled=true; }
    afTexte(D,"S'INSCRIRE",x+w-qrS/2-6,bas-14,{size:9,weight:800,color:"#111827",align:"center",lh:1});
  }
  var limite=bas-hb-12;
  afLogo(D,C,x,y,46,{fg:C.c1});
  afTexte(D,C.club.toUpperCase(),x+56,y+15,{size:13,weight:800,ls:1,maxW:w-56,maxLines:1,color:"#fff"});
  y+=46+16*k;
  if(C.tag){
    var tag=C.tag.toUpperCase(); c.font=afFont({size:12,weight:800});
    var tw=afMesure(c,tag,2)+20;
    afRect(D,x,y,tw,22,4,plein?"rgba(0,0,0,.22)":C.c2);
    afTexte(D,tag,x+10,y+5,{size:12,weight:800,ls:2,color:"#fff",lh:1});
    y+=22+10*k;
  }
  y+=afTexte(D,C.titre,x,y,{size:(C.carre?50:40)*k,fam:plein?AF_F.serif:AF_F.anton,weight:plein?800:400,upper:!plein,lh:1,maxW:w,maxLines:3,fit:true,color:"#fff"});
  if(S.dates&&C.dates) y+=10*k+afTexte(D,C.dates.long,x,y+10*k,{size:17*k,weight:800,maxW:w,color:"#fff"});
  if(S.horaires&&C.horaires) y+=3*k+afTexte(D,C.horaires,x,y+3*k,{size:14*k,weight:600,maxW:w,color:"rgba(255,255,255,.9)"});
  if(S.lieu&&C.lieu) y+=3*k+afTexte(D,C.lieu,x,y+3*k,{size:14*k,weight:600,maxW:w,maxLines:3,color:"rgba(255,255,255,.9)"});
  if(S.texte&&C.texte) y+=10*k+afTexte(D,C.texte,x,y+10*k,{size:14*k,weight:700,maxW:w,pre:true,maxLines:9,color:"#fff"});
  if(S.intervenants&&C.interv.length) y+=14*k+afIntervenants(D,C,x,y+14*k,w,"#fff","left",k);
  return y>limite;
}
function afModeleSport(D,C,L,k){
  var c=D.ctx, x=L.x+22, w=L.w-44, y=L.y+22, bas=L.y+L.h-22, S=C.show;
  if(!D.dry){
    c.fillStyle=C.c1; c.fillRect(L.x,L.y,L.w,L.h);
    c.save(); c.beginPath(); c.rect(L.x,L.y,L.w,L.h); c.clip();
    c.translate(L.x+L.w/2,L.y+L.h*0.87); c.rotate(-9*Math.PI/180); c.fillStyle=C.c2; c.fillRect(-L.w*0.7,-L.h*0.31,L.w*1.4,L.h*0.62); c.restore();
  }
  var qrS=S.qr&&C.qr?70:0, gw=w-(qrS?qrS+22:0);
  // Bas gauche : infos + tarifs (mesurés puis posés au-dessus du bas)
  function colonne(D3,y0){
    var h=0;
    if(S.horaires&&C.horaires) h+=4+afTexte(D3,C.horaires,x,y0+h,{size:13,weight:700,maxW:gw,color:"#fff"});
    if(S.lieu&&C.lieu) h+=4+afTexte(D3,C.lieu,x,y0+h,{size:13,weight:700,maxW:gw,maxLines:3,color:"#fff"});
    if(S.texte&&C.texte) h+=4+afTexte(D3,C.texte,x,y0+h,{size:13,weight:700,maxW:gw,pre:true,maxLines:9,color:"rgba(255,255,255,.85)"});
    if(S.prix) C.prix.forEach(function(t){
      var p=t.prix>0?evtPrix(t.prix):"GRATUIT";
      var hh=afTexte(D3,p,x,y0+h+2,{size:22,fam:AF_F.anton,weight:400,color:"#fff",lh:1.12});
      var pw=D3.lastW;
      afTexte(D3,t.nom,x+pw+6,y0+h+10,{size:13,weight:600,color:"#fff",maxW:gw-pw-6,maxLines:1,lh:1});
      h+=hh+2;
    });
    return h;
  }
  var hc=colonne({ctx:c,dry:true},0), hb=Math.max(hc,qrS?qrS+12:0);
  colonne(D,bas-hc);
  if(qrS) afQrBox(D,C,x+w-qrS-12,bas-qrS-12,qrS,6);
  var limite=bas-hb-12;
  afLogo(D,C,x,y,50,{fg:C.c1});
  if(C.tag){
    var tag=C.tag.toUpperCase(); c.font=afFont({size:18,fam:AF_F.anton,weight:400});
    var tw=afMesure(c,tag,3)+20;
    afRect(D,x+w-tw,y+9,tw,32,0,null,"#fff",2);
    afTexte(D,tag,x+w-tw+10,y+14,{size:18,fam:AF_F.anton,weight:400,ls:3,color:"#fff",lh:1.1});
  }
  y+=50+16*k;
  y+=afTexte(D,C.titre,x,y,{size:(C.carre?72:50)*k,fam:AF_F.anton,weight:400,upper:true,lh:.92,maxW:w,maxLines:3,fit:true,color:"#fff"});
  if(S.dates&&C.dates) y+=10*k+afTexte(D,C.dates.court,x,y+10*k,{size:26*k,fam:AF_F.anton,weight:400,maxW:w,color:"#fde68a",lh:1.1});
  if(S.intervenants&&C.interv.length) y+=14*k+afIntervenants(D,C,x,y+14*k,w,"#fff","left",k);
  return y>limite;
}
function afModelePhoto(D,C,L,k){
  var c=D.ctx, S=C.show, x=L.x+22, w=L.w-44, bas=L.y+L.h-22;
  if(!D.dry){
    if(C.photo) afImgCouvre(c,C.photo,L.x,L.y,L.w,L.h);
    else { var r=c.createRadialGradient(L.x+L.w*0.6,L.y+L.h*0.3,10,L.x+L.w*0.6,L.y+L.h*0.3,L.w); r.addColorStop(0,afMix(C.c1,-0.2)); r.addColorStop(1,"#111827"); c.fillStyle=r; c.fillRect(L.x,L.y,L.w,L.h); }
    var g=c.createLinearGradient(0,L.y,0,L.y+L.h); g.addColorStop(0,"rgba(0,0,0,.25)"); g.addColorStop(.35,"rgba(0,0,0,0)"); g.addColorStop(.8,"rgba(0,0,0,.85)"); g.addColorStop(1,"rgba(0,0,0,.9)");
    c.fillStyle=g; c.fillRect(L.x,L.y,L.w,L.h);
  }
  afLogo(D,C,L.x+18,L.y+18,40,{fg:C.c1});
  var bw=S.dates&&C.dates?92:0;
  afTexte(D,C.club.toUpperCase(),L.x+66,L.y+31,{size:12,weight:800,ls:1,maxW:L.w-84-(bw?bw+10:0),maxLines:1,color:"#fff"});
  if(bw&&!D.dry){
    var bx=L.x+L.w-18-bw, by=L.y+18;
    c.save(); c.shadowColor="rgba(0,0,0,.35)"; c.shadowBlur=20; c.shadowOffsetY=6;
    c.beginPath(); c.arc(bx+bw/2,by+bw/2,bw/2,0,Math.PI*2); c.fillStyle=C.c1; c.fill(); c.restore();
    afTexte(D,C.dates.badge,bx+bw/2,by+24,{size:C.dates.badge.length>5?22:28,weight:800,color:"#fff",align:"center",lh:1,maxW:bw-12,fit:true});
    afTexte(D,C.dates.badgeMois,bx+bw/2,by+56,{size:11,weight:800,ls:1.2,color:"#fff",align:"center",lh:1,maxW:bw-14,fit:true});
  }
  var haut=L.y+18+Math.max(40,bw)+14;
  function bloc(D3,y){
    var y0=y;
    y+=afTexte(D3,C.tag.toUpperCase(),x,y,{size:12*k,weight:800,ls:3*k,color:"#fde68a",maxW:w,maxLines:1});
    y+=6*k+afTexte(D3,C.titre,x,y+6*k,{size:(C.carre?40:34)*k,weight:800,lh:1.02,maxW:w,maxLines:3,fit:true,color:"#fff"});
    var info=[S.horaires&&C.horaires,S.lieu&&C.lieu].filter(Boolean).join("   ·   ");
    if(info) y+=6*k+afTexte(D3,info,x,y+6*k,{size:13*k,weight:600,maxW:w,maxLines:2,color:"rgba(255,255,255,.9)"});
    if(S.dates&&C.dates&&!bw) y+=4*k+afTexte(D3,C.dates.long,x,y+4*k,{size:13*k,weight:700,maxW:w,color:"#fff"});
    if(S.texte&&C.texte) y+=6*k+afTexte(D3,C.texte,x,y+6*k,{size:13*k,weight:500,maxW:w,pre:true,maxLines:9,color:"rgba(255,255,255,.85)"});
    if(S.intervenants&&C.interv.length) y+=12*k+afIntervenants(D3,C,x,y+12*k,w,"#fff","left",k);
    var qrS=S.qr&&C.qr?46:0;
    if(S.prix||qrS){
      y+=8*k;
      if(!D3.dry){ D3.ctx.fillStyle="rgba(255,255,255,.3)"; D3.ctx.fillRect(x,y,w,1); }
      y+=10*k;
      var rowH=Math.max(qrS?qrS+8:0,20);
      if(S.prix&&C.prix.length){
        var min=Math.min.apply(null,C.prix.map(function(t){return Number(t.prix)||0;}));
        var max=Math.max.apply(null,C.prix.map(function(t){return Number(t.prix)||0;}));
        var txt=max===0?"Gratuit":(min===max?evtPrix(min):(min===0?"Gratuit ou "+evtPrix(max):"Dès "+evtPrix(min)));
        afTexte(D3,txt,x,y+rowH/2-9,{size:15,weight:800,color:"#fff",lh:1.2});
      }
      if(qrS){ afQrBox(D3,C,x+w-qrS-8,y,qrS,4); afTexte(D3,"Inscription",x+w-qrS-16,y+rowH/2-6,{size:12,weight:800,color:"#fff",align:"right",lh:1}); }
      y+=rowH;
    }
    return y-y0;
  }
  var h=bloc({ctx:c,dry:true,lastW:0},0);
  bloc(D,bas-h);
  return bas-h<haut;
}
function afModeleEpure(D,C,L,k){
  var c=D.ctx, S=C.show, cx=L.x+L.w/2, w=L.w-56, y=L.y+30, bas=L.y+L.h-30, ink="#1c1917";
  if(!D.dry){ c.fillStyle="#faf8f4"; c.fillRect(L.x,L.y,L.w,L.h); }
  // Bas : tarifs + QR, centrés ensemble
  var qrS=S.qr&&C.qr?58:0, D2={ctx:c,dry:true};
  function tarifs(D3,x0,y0){
    var h=0;
    C.prix.forEach(function(t){
      var p=t.prix>0?evtPrix(t.prix):"Gratuit";
      var hh=afTexte(D3,p,x0,y0+h,{size:20,fam:AF_F.serif,weight:800,color:C.c1,lh:1.25});
      var pw=D3.lastW; afTexte(D3,t.nom,x0+pw+6,y0+h+7,{size:13,weight:500,color:ink,lh:1,maxW:w-qrS-pw-30,maxLines:1});
      D3.lastW=pw+6+(D3.dry?0:0);
      h+=hh;
    });
    return h;
  }
  var hp=S.prix?tarifs(D2,0,0):0, wp=0;
  if(S.prix){ c.font=afFont({size:13,weight:500}); C.prix.forEach(function(t){ c.font=afFont({size:20,fam:AF_F.serif,weight:800}); var a=afMesure(c,t.prix>0?evtPrix(t.prix):"Gratuit"); c.font=afFont({size:13,weight:500}); wp=Math.max(wp,Math.min(a+6+afMesure(c,t.nom),w-qrS-30)); }); }
  var hb=Math.max(hp,qrS?qrS+13:0), gw=wp+(qrS?(wp?16:0)+qrS+13:0), gx=cx-gw/2;
  if(S.prix) tarifs(D,gx,bas-hb/2-hp/2);
  if(qrS) afQrBox(D,C,gx+gw-qrS-13,bas-qrS-13,qrS,5,{bg:"#faf8f4",stroke:ink,sw:1.5});
  var limite=bas-hb-12;
  afLogo(D,C,cx-22,y,44,{bg:"#faf8f4",ring:C.c1,fg:C.c1});
  y+=44+10*k;
  y+=afTexte(D,(C.club+" présente").toUpperCase(),cx,y,{size:11*k,weight:600,ls:4*k,color:"#78716c",align:"center",maxW:w,maxLines:2});
  y+=18*k; afRect(D,cx-20,y,40,1.5,0,C.c1); y+=1.5+18*k;
  y+=afTexte(D,C.accrocheEpure,cx,y,{size:18*k,fam:AF_F.serif,italic:true,weight:500,color:C.c1,align:"center",maxW:w,maxLines:1});
  y+=6*k+afTexte(D,C.titre,cx,y+6*k,{size:(C.carre?46:38)*k,fam:AF_F.serif,weight:800,color:ink,align:"center",lh:1.02,maxW:w,maxLines:3,fit:true});
  if(S.dates&&C.dates) y+=14*k+afTexte(D,C.dates.espace,cx,y+14*k,{size:14*k,weight:600,ls:3*k,color:ink,align:"center",maxW:w,maxLines:2});
  y+=8*k;
  if(S.horaires&&C.horaires) y+=4*k+afTexte(D,C.horaires,cx,y+4*k,{size:13*k,color:"#57534e",align:"center",maxW:w});
  if(S.lieu&&C.lieu) y+=4*k+afTexte(D,C.lieu,cx,y+4*k,{size:13*k,color:"#57534e",align:"center",maxW:w,maxLines:3});
  if(S.texte&&C.texte) y+=4*k+afTexte(D,C.texte,cx,y+4*k,{size:13*k,italic:true,color:"#57534e",align:"center",maxW:w,pre:true,maxLines:9});
  if(S.intervenants&&C.interv.length) y+=14*k+afIntervenants(D,C,L.x+28,y+14*k,w,ink,"center",k);
  return y>limite;
}
function afModeleCalendrier(D,C,L,k){
  var c=D.ctx, S=C.show, x=L.x+20, w=L.w-40, y=L.y+20, bas=L.y+L.h-20;
  if(!D.dry){ c.fillStyle="#111827"; c.fillRect(L.x,L.y,L.w,L.h); }
  // Bas : carte blanche tarifs + QR
  var qrS=S.qr&&C.qr?50:0, D2={ctx:c,dry:true};
  var lignes=S.prix?C.prix:[];
  function tarifs(D3,x0,y0){
    var h=0;
    lignes.forEach(function(t){
      var hh=afTexte(D3,t.nom,x0,y0+h+4,{size:13,weight:700,color:"#111827",lh:1.2,maxW:w-qrS-120,maxLines:1});
      var nw=D3.lastW;
      afTexte(D3,t.prix>0?evtPrix(t.prix):"Gratuit",x0+nw+8,y0+h,{size:18,weight:800,color:C.c1,lh:1.3});
      h+=Math.max(hh+4,23);
    });
    return h;
  }
  var hp=tarifs(D2,0,0), hc=Math.max(hp,qrS)+20;
  if(hp||qrS){
    afRect(D,x,bas-hc,w,hc,10,"#fff");
    tarifs(D,x+12,bas-hc+10+(Math.max(hp,qrS)-hp)/2);
    if(qrS&&!D.dry){ c.imageSmoothingEnabled=false; c.drawImage(C.qr,x+w-12-qrS,bas-hc+10,qrS,qrS); c.imageSmoothingEnabled=true; }
  }
  var limite=bas-(hp||qrS?hc:0)-12;
  afLogo(D,C,x,y,40,{carre:true,bg:C.c1,fg:"#fff"});
  afTexte(D,(C.club+(C.tag?" · "+C.tag:"")).toUpperCase(),x+50,y+14,{size:12,weight:800,ls:1.5,maxW:w-50,maxLines:1,color:"#fff"});
  y+=40+12*k;
  y+=afTexte(D,C.titre,x,y,{size:(C.carre?38:32)*k,weight:800,lh:1.04,maxW:w,maxLines:3,fit:true,color:"#fff"});
  if(S.dates&&C.dates){
    var js=C.dates.jours;
    if(js&&js.length>1){
      y+=12*k; var gap=6, tw=(w-gap*(js.length-1))/js.length, th=58*k;
      js.forEach(function(j,i){
        var tx=x+i*(tw+gap);
        afRect(D,tx,y,tw,th,8,i%2?C.c2:C.c1);
        afTexte(D,j.j,tx+tw/2,y+8*k,{size:Math.min(10*k,tw*0.28),fam:AF_F.mono,weight:800,color:"rgba(255,255,255,.8)",align:"center",lh:1});
        afTexte(D,j.n,tx+tw/2,y+22*k,{size:Math.min(24*k,tw*0.5),fam:AF_F.mono,weight:800,color:"#fff",align:"center",lh:1});
      });
      y+=th+8*k;
      y+=afTexte(D,C.dates.mois,x,y,{size:12*k,fam:AF_F.mono,weight:800,ls:2*k,color:"#fde68a",maxW:w,maxLines:1});
    } else y+=12*k+afTexte(D,C.dates.long.toUpperCase(),x,y+12*k,{size:16*k,fam:AF_F.mono,weight:800,ls:1*k,color:"#fde68a",maxW:w,maxLines:2});
  }
  y+=6*k;
  if(S.horaires&&C.horaires) y+=4*k+afTexte(D,C.horaires,x,y+4*k,{size:13*k,color:"#d1d5db",maxW:w});
  if(S.lieu&&C.lieu) y+=4*k+afTexte(D,C.lieu,x,y+4*k,{size:13*k,color:"#d1d5db",maxW:w,maxLines:3});
  if(S.texte&&C.texte) y+=4*k+afTexte(D,C.texte,x,y+4*k,{size:13*k,color:"#d1d5db",maxW:w,pre:true,maxLines:9});
  if(S.intervenants&&C.interv.length) y+=14*k+afIntervenants(D,C,x,y+14*k,w,"#fff","left",k);
  return y>limite;
}
var AF_DESSIN={degrade:function(D,C,L,k){return afModeleSimple(D,C,L,k,false);},plein:function(D,C,L,k){return afModeleSimple(D,C,L,k,true);},sport:afModeleSport,photo:afModelePhoto,epure:afModeleEpure,calendrier:afModeleCalendrier};

// Rendu complet : bandeau places (haut), affiche, tampon complet, bandeau sponsors (bas).
function afRendre(canvas, C){
  var F=AF_FORMATS[C.format]||AF_FORMATS.carre;
  canvas.width=F.W; canvas.height=F.H;
  var c=canvas.getContext("2d"), u=F.W/F.bw;
  c.setTransform(u,0,0,u,0,0); c.textBaseline="top"; c.clearRect(0,0,F.bw,F.bh);
  var D={ctx:c,dry:false}, top=0, bot=F.bh;
  if(C.placesBandeau){
    afRect(D,0,0,F.bw,30,0,"#facc15");
    afTexte(D,afPlacesTxt(C.restant),F.bw/2,9,{size:13,weight:800,ls:1,color:"#111827",align:"center",lh:1});
    top=30;
  }
  var sp=C.show.sponsors?C.sponsors.slice(0,6):[];
  if(sp.length) bot=F.bh-34;
  var L={x:0,y:top,w:F.bw,h:bot-top};
  var dessin=AF_DESSIN[C.modele]||AF_DESSIN.degrade;
  var ks=[1,.92,.85,.78,.71,.64,.58,.52], k=ks[ks.length-1];
  for(var i=0;i<ks.length;i++){ if(!dessin({ctx:c,dry:true},C,L,ks[i])){ k=ks[i]; break; } }
  c.save(); c.beginPath(); c.rect(L.x,L.y,L.w,L.h); c.clip();
  dessin(D,C,L,k);
  if(C.qrLibre&&C.qrLibre.img){
    var q=C.qrLibre, qs=q.s*F.bw, qx=q.x*F.bw, qy=q.y*F.bh, pad=qs*0.07, lab=Math.max(9,qs*0.11);
    afRect(D,qx,qy,qs,qs+lab*1.6,qs*0.06,"#fff");
    c.imageSmoothingEnabled=false; c.drawImage(q.img,qx+pad,qy+pad,qs-2*pad,qs-2*pad); c.imageSmoothingEnabled=true;
    afTexte(D,"S'INSCRIRE",qx+qs/2,qy+qs+lab*0.15,{size:lab,weight:800,color:"#111827",align:"center",lh:1});
    C.qrRect={x:qx/F.bw,y:qy/F.bh,w:qs/F.bw,h:(qs+lab*1.6)/F.bh};
  }
  if(C.complet){
    c.fillStyle="rgba(17,24,39,.55)"; c.fillRect(L.x,L.y,L.w,L.h);
    c.save(); c.translate(L.x+L.w/2,L.y+L.h/2); c.rotate(-12*Math.PI/180);
    var fs=Math.min(64,L.w/6.2); c.font=afFont({size:fs,fam:AF_F.anton,weight:400});
    var tw=afMesure(c,"COMPLET",fs/10);
    c.lineWidth=fs/10; c.strokeStyle="#fff"; c.strokeRect(-tw/2-fs*0.4,-fs*0.68,tw+fs*0.8,fs*1.36);
    c.fillStyle="#fff"; c.textBaseline="middle"; afEcrire(c,"COMPLET",-tw/2,fs*0.04,fs/10); c.textBaseline="top";
    c.restore();
  }
  c.restore();
  if(sp.length){
    afRect(D,0,bot,F.bw,34,0,"#fff");
    var g=6, bw=(F.bw-20-g*(sp.length-1))/sp.length;
    sp.forEach(function(s,i){
      var bx=10+i*(bw+g);
      if(s.img) afImgContient(c,s.img,bx,bot+6,bw,22);
      else { afRect(D,bx,bot+6,bw,22,4,"#f3f4f6"); afTexte(D,s.nom,bx+bw/2,bot+12,{size:10,weight:800,color:"#6b7280",align:"center",maxW:bw-6,maxLines:1,lh:1}); }
    });
  }
}

// ── Contenu de l'affiche à partir de l'événement et des réglages ─────
function afContenu(e, st, page, imgs){
  var club=window.CURRENT_CLUB||{};
  var c1=afHex(club.couleur)||"#1A2E5A", c2=afHex(club.couleur2)||afMix(c1,-0.45);
  var parJ=!!(e.inscr&&e.inscr.parJour), places=parJ?0:((e.inscr&&e.inscr.places)||0), nb=(page&&page.nb)||0, restant=places?Math.max(0,places-nb):null;
  var tag=st.show.accroche===false?"":(st.accroche||AF_TAGS[e.type]||"Événement").trim();
  var prog=(st.show.programme&&e.inscr&&e.inscr.programme)?String(e.inscr.programme).trim():"";
  var txt=[(st.show.texte?(st.texte||""):"").replace(/^\n+|\s+$/g,""),prog].filter(Boolean).join("\n");
  var qrLibre=!!(st.qrPos&&st.show.qr&&imgs.qr);
  return {
    modele:st.modele, format:st.format, carre:st.format==="carre", show:Object.assign({},st.show,{texte:!!txt}),
    c1:c1, c2:c2, club:club.name||"", initiales:afInitiales(club.name), logo:imgs.logo,
    tag:tag, accrocheEpure:!tag?"":(st.accroche?st.accroche.trim():(e.type==="soiree"?"la ":"le ")+tag.toLowerCase()),
    titre:(st.titre||e.titre||"").trim(), dates:afDates(e), horaires:e.heure||"", lieu:[e.lieu||"",e.adresse||""].filter(Boolean).join("\n"), texte:txt,
    prix:((e.inscr&&e.inscr.tarifs)||[]).reduce(function(l,t){
      l.push({nom:t.nom+(parJ&&Number(t.prix)>0?" (par jour)":""),prix:Number(t.prix)||0});
      if(parJ&&Number(t.forfait)>0) l.push({nom:"Forfait tous les jours"+((e.inscr.tarifs.length>1)?" · "+t.nom:""),prix:Number(t.forfait)});
      return l;
    },[]),
    qr:qrLibre?null:imgs.qr, qrLibre:qrLibre?{img:imgs.qr,x:st.qrPos.x,y:st.qrPos.y,s:st.qrPos.s}:null, photo:imgs.photo,
    interv:(st.intervenants||[]).filter(function(x){return x.nom;}).map(function(x,i){ return {nom:x.nom,role:x.role||"",img:imgs.interv[i]||null}; }),
    sponsors:imgs.sponsors||[],
    restant:restant, placesBandeau:!!(st.show.places&&places&&restant>0), complet:!!(places&&restant===0)
  };
}
function afReglagesDefaut(e){
  var a=e.affiche||{};
  return {
    modele:a.modele||"degrade", format:a.format||"carre",
    show:Object.assign({accroche:true,dates:true,horaires:true,lieu:true,prix:true,places:true,texte:true,programme:true,intervenants:true,qr:true,sponsors:false},a.show||{}),
    titre:a.titre||"", accroche:a.accroche||"", texte:a.texte||"", qrPos:a.qrPos||null,
    intervenants:(a.intervenants||[]).map(function(x){return Object.assign({},x);})
  };
}
function afRedim(file, max, qualite){
  return new Promise(function(ok,ko){
    var r=new FileReader();
    r.onload=function(){
      var i=new Image();
      i.onload=function(){
        var k=Math.min(1,max/Math.max(i.width,i.height)), cv=document.createElement("canvas");
        cv.width=Math.round(i.width*k); cv.height=Math.round(i.height*k);
        cv.getContext("2d").drawImage(i,0,0,cv.width,cv.height);
        ok(cv.toDataURL("image/jpeg",qualite||0.8));
      };
      i.onerror=ko; i.src=r.result;
    };
    r.onerror=ko; r.readAsDataURL(file);
  });
}
function afChoisirImage(cb, max){
  var inp=document.createElement("input"); inp.type="file"; inp.accept="image/*";
  inp.addEventListener("change",function(){ var f=inp.files&&inp.files[0]; if(f) afRedim(f,max||240,0.8).then(cb).catch(function(){ askAlert("Image illisible."); }); });
  inp.click();
}

// ── Éditeur (plein écran) ────────────────────────────────────────────
function evtAffiche(eid){
  var e=getEvents().find(function(x){return x.id===eid;}); if(!e) return;
  var st=afReglagesDefaut(e), page=null, unsub=null;
  var cleePhoto="gm_af_photo_"+(window.CURRENT_CLUB_ID||"")+"_"+eid, photoSrc=null;
  try{ photoSrc=localStorage.getItem(cleePhoto); }catch(err){}
  var imgs={logo:null,qr:null,photo:null,interv:[],sponsors:[]};
  var old=document.getElementById("af-ecran"); if(old) old.remove();
  var o=document.createElement("div"); o.id="af-ecran";
  o.style.cssText="position:fixed;inset:0;z-index:350;background:var(--bg);display:flex;flex-direction:column;overflow:hidden";
  o.innerHTML=
    '<div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;background:var(--card);border-bottom:1px solid var(--bdr)">'+
      '<button id="af-x" aria-label="Fermer" style="border:none;background:var(--bdr);color:var(--txt);width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer;flex-shrink:0">✕</button>'+
      '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:var(--txt)">Affiche</div><div style="font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc(e.titre||"")+'</div></div>'+
    '</div>'+
    '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch">'+
      '<div id="af-alerte"></div>'+
      '<div style="display:flex;flex-wrap:wrap;gap:18px;padding:14px;align-items:flex-start;justify-content:center">'+
        '<div style="flex:1 1 300px;max-width:460px;display:flex;flex-direction:column;align-items:center;gap:12px">'+
          '<canvas id="af-cv" style="width:100%;height:auto;border-radius:4px;box-shadow:0 14px 34px rgba(17,24,39,.22);background:#fff"></canvas>'+
          '<div style="display:flex;gap:8px;width:100%;flex-wrap:wrap">'+
            '<button id="af-wa" style="flex:1 1 130px;padding:13px;border-radius:var(--rx);border:none;background:#25D366;color:#073b1f;font-size:14px;font-weight:900;cursor:pointer">WhatsApp</button>'+
            '<button id="af-share" style="flex:1 1 110px;padding:13px;border-radius:var(--rx);border:1px solid var(--bdr);background:var(--card);color:var(--txt);font-size:14px;font-weight:800;cursor:pointer">Partager</button>'+
            '<button id="af-dl" style="flex:1 1 130px;padding:13px;border-radius:var(--rx);border:none;background:var(--dkg);color:#fff;font-size:14px;font-weight:800;cursor:pointer">Télécharger</button>'+
          '</div>'+
        '</div>'+
        '<div id="af-ctrl" style="flex:1 1 300px;max-width:460px;display:flex;flex-direction:column;gap:16px;padding-bottom:40px"></div>'+
      '</div>'+
    '</div>';
  document.body.appendChild(o);
  var cv=document.getElementById("af-cv"), ctrl=document.getElementById("af-ctrl");
  function lien(){ return e.inscr?evtLien(e.id):""; }
  var redessinT=null;
  var cacheF=null, cacheT=null, partageEnCours=false;
  function redessiner(){
    clearTimeout(redessinT); redessinT=setTimeout(function(){ afRendre(cv,afContenu(e,st,page,imgs)); alerte(); },30);
    // Fichier prêt d'avance : le partage doit partir tout de suite au clic, sinon
    // le téléphone le refuse (le geste de l'utilisateur est « périmé »).
    cacheF=null; clearTimeout(cacheT); cacheT=setTimeout(function(){ fichier().then(function(f){ cacheF=f; }).catch(function(){}); },500);
  }
  function alerte(){
    var a=document.getElementById("af-alerte"); if(!a) return;
    var C=afContenu(e,st,page,imgs);
    if(C.restant==null||C.restant>5){ a.innerHTML=""; return; }
    a.innerHTML='<div style="margin:14px 14px 0;display:flex;flex-wrap:wrap;align-items:center;gap:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;border-radius:14px;padding:12px 14px;font-size:13px;font-weight:700">'+
      '<span style="flex:1 1 220px">'+authEsc(afAlerteTxt(C.restant))+(C.restant===0?" : l'affiche affiche « Complet ». La republier ?":" : republier l'affiche à jour sur vos réseaux ?")+'</span>'+
      '<button id="af-repub" style="padding:9px 14px;border-radius:20px;border:none;background:#9a3412;color:#fff;font-size:13px;font-weight:800;cursor:pointer">Republier</button></div>';
    document.getElementById("af-repub").addEventListener("click",function(){ partager(true); });
  }
  function nomFichier(ext){ return "affiche-"+String(st.titre||e.titre||"evenement").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)+"."+ext; }
  function fichier(){
    return new Promise(function(ok,ko){
      afRendre(cv,afContenu(e,st,page,imgs));
      if(st.format==="a4"){
        if(!window.jspdf||!window.jspdf.jsPDF){ ko("pdf"); return; }
        var pdf=new window.jspdf.jsPDF({unit:"mm",format:"a4"});
        pdf.addImage(cv.toDataURL("image/jpeg",0.92),"JPEG",0,0,210,297);
        ok(new File([pdf.output("blob")],nomFichier("pdf"),{type:"application/pdf"}));
      } else cv.toBlob(function(b){ b?ok(new File([b],nomFichier("png"),{type:"image/png"})):ko("png"); },"image/png");
    });
  }
  function telecharger(f){
    var a=document.createElement("a"); a.href=URL.createObjectURL(f); a.download=f.name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
  }
  function message(){
    var C=afContenu(e,st,page,imgs);
    return (C.club?C.club+" : ":"")+(C.titre||"")+(C.dates?" ("+C.dates.long+")":"")+(C.complet?" : c'est complet, merci à tous !":(C.restant!=null&&C.restant<=5?" : plus que "+C.restant+" place"+(C.restant>1?"s":"")+" !":""))+(lien()&&!C.complet?" Inscriptions : "+lien():"");
  }
  // Partage : avec le fichier déjà prêt quand c'est possible (dans le geste), une seule feuille à la fois.
  function partagerFichier(f, avecTitre, secours){
    if(partageEnCours) return;
    if(navigator.canShare&&navigator.canShare({files:[f]})){
      partageEnCours=true;
      var data={files:[f],text:message()}; if(avecTitre) data.title=st.titre||e.titre||"Affiche";
      navigator.share(data).catch(function(err){ if(!err||err.name!=="AbortError") secours(f); })
        .then(function(){ partageEnCours=false; });
      return;
    }
    secours(f);
  }
  function viaFichier(fn){
    garder();
    if(cacheF){ fn(cacheF); return; }
    fichier().then(function(f){ cacheF=f; fn(f); }).catch(function(){ askAlert("L'affiche n'a pas pu être créée."); });
  }
  function partager(){
    viaFichier(function(f){ partagerFichier(f,true,function(ff){ telecharger(ff); copyToClipboard(message()); showToast("Image téléchargée, texte copié : collez-les dans votre publication"); }); });
  }
  document.getElementById("af-x").addEventListener("click",function(){ garder(); if(unsub) try{unsub();}catch(err){} o.remove(); });
  document.getElementById("af-dl").addEventListener("click",function(){ garder(); fichier().then(telecharger).catch(function(){ askAlert("L'affiche n'a pas pu être créée."); }); });
  document.getElementById("af-share").addEventListener("click",partager);
  // WhatsApp : sur téléphone, la feuille de partage envoie l'image (choisir WhatsApp) ;
  // sinon, l'image est téléchargée et WhatsApp s'ouvre avec le texte et le lien.
  document.getElementById("af-wa").addEventListener("click",function(){
    var wa=function(f){ if(f) telecharger(f); window.open("https://wa.me/?text="+encodeURIComponent(message()),"_blank"); };
    viaFichier(function(f){ partagerFichier(f,false,wa); });
  });
  function garder(){
    var evs=getEvents(), i=evs.findIndex(function(x){return x.id===eid;}); if(i<0) return;
    var a={modele:st.modele,format:st.format,show:st.show,titre:st.titre,accroche:st.accroche,texte:st.texte,qrPos:st.qrPos||null,
      intervenants:st.intervenants.filter(function(x){return x.nom;}).slice(0,4)};
    if(JSON.stringify(evs[i].affiche||null)===JSON.stringify(a)) return;
    evs[i].affiche=a; e.affiche=a; saveEvents(evs);
  }

  // Contrôles
  function bloc(titre){ var d=document.createElement("div"); var l=document.createElement("div"); l.className="form-label"; l.style.marginBottom="8px"; l.textContent=titre; d.appendChild(l); ctrl.appendChild(d); return d; }
  function chips(parent, liste, val, set){
    var box=document.createElement("div"); box.style.cssText="display:flex;flex-wrap:wrap;gap:8px"; parent.appendChild(box);
    function p(){ box.innerHTML=""; liste.forEach(function(m){
      var on=val()===m[0], b=document.createElement("button"); b.type="button"; b.textContent=m[1];
      b.style.cssText="min-height:38px;padding:0 14px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid "+(on?"var(--txt)":"var(--bdr)")+";background:"+(on?"var(--txt)":"var(--card)")+";color:"+(on?"var(--bg)":"var(--txt)");
      b.addEventListener("click",function(){ set(m[0]); p(); peindrePhoto(); redessiner(); }); box.appendChild(b); }); }
    p();
  }
  chips(bloc("Modèle"),AF_MODELES,function(){return st.modele;},function(v){st.modele=v;});
  var photoBox=document.createElement("div"); photoBox.style.cssText="margin-top:10px"; ctrl.lastChild.appendChild(photoBox);
  function peindrePhoto(){
    photoBox.innerHTML=""; if(st.modele!=="photo") return;
    var b=document.createElement("button"); b.type="button"; b.textContent=photoSrc?"Changer la photo":"Choisir une photo";
    b.style.cssText="padding:10px 14px;border-radius:var(--rx);border:1.5px dashed var(--bdr);background:var(--card);color:var(--txt);font-size:13px;font-weight:700;cursor:pointer";
    b.addEventListener("click",function(){ afChoisirImage(function(src){ photoSrc=src; try{ localStorage.setItem(cleePhoto,src); }catch(err){} afImage(src).then(function(i){ imgs.photo=i; peindrePhoto(); redessiner(); }); },1600); });
    var n=document.createElement("div"); n.style.cssText="font-size:11px;color:var(--mut);margin-top:4px"; n.textContent="La photo reste sur cet appareil.";
    photoBox.appendChild(b); photoBox.appendChild(n);
  }
  peindrePhoto();
  chips(bloc("Format"),Object.keys(AF_FORMATS).map(function(k){return [k,AF_FORMATS[k].nom];}),function(){return st.format;},function(v){st.format=v; majDl();});
  function majDl(){ document.getElementById("af-dl").textContent=st.format==="a4"?"Télécharger le PDF":"Télécharger"; }
  majDl();
  var infos=bloc("Ce qui s'affiche");
  AF_INFOS.forEach(function(it){
    if(it[0]==="qr"&&!e.inscr) return;
    if(it[0]==="programme"&&!(e.inscr&&e.inscr.programme)) return;
    if(it[0]==="places"&&(!(e.inscr&&e.inscr.places)||e.inscr.parJour)) return;
    if(it[0]==="prix"&&!(e.inscr&&e.inscr.tarifs&&e.inscr.tarifs.length)) return;
    var l=document.createElement("label"); l.style.cssText="display:flex;align-items:center;gap:10px;min-height:38px;font-size:14px;font-weight:600;color:var(--txt);cursor:pointer";
    var c=document.createElement("input"); c.type="checkbox"; c.checked=!!st.show[it[0]]; c.style.cssText="width:20px;height:20px;accent-color:var(--dkg)";
    c.addEventListener("change",function(){ st.show[it[0]]=c.checked; redessiner(); });
    l.appendChild(c); l.appendChild(document.createTextNode(it[1]));
    if(it[0]==="sponsors"&&!(typeof getSponsors==="function"&&getSponsors().length)){ var h=document.createElement("span"); h.style.cssText="font-size:11px;color:var(--mut);font-weight:500"; h.textContent="(aucun sponsor enregistré)"; l.appendChild(h); }
    infos.appendChild(l);
  });
  if(e.inscr){
    var qb=bloc("Position du QR code");
    var qh=document.createElement("div"); qh.style.cssText="font-size:12px;color:var(--mut);line-height:1.45;margin-bottom:8px"; qb.appendChild(qh);
    var qrow=document.createElement("div"); qrow.style.cssText="display:flex;gap:8px;flex-wrap:wrap"; qb.appendChild(qrow);
    var qTaille=document.createElement("input"); qTaille.type="range"; qTaille.min="12"; qTaille.max="45"; qTaille.step="1";
    qTaille.setAttribute("aria-label","Taille du QR code"); qTaille.style.cssText="width:100%;margin-top:10px;accent-color:var(--dkg)";
    qTaille.addEventListener("input",function(){ if(!st.qrPos) return; var ns=Number(qTaille.value)/100; st.qrPos.x=Math.min(st.qrPos.x,1-ns); st.qrPos.s=ns; redessiner(); });
    qb.appendChild(qTaille);
    var peindreQr=function(){
      qrow.innerHTML="";
      var libre=!!st.qrPos;
      qh.textContent=libre?"Faites glisser le QR code sur l'affiche. Le curseur change sa taille.":"Le QR code est placé par le modèle. Activez le placement libre pour le déplacer et changer sa taille.";
      var b1=document.createElement("button"); b1.type="button"; b1.textContent=libre?"Remettre à sa place":"Déplacer / redimensionner";
      b1.style.cssText="min-height:38px;padding:0 14px;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;border:1.5px solid var(--txt);background:"+(libre?"var(--card)":"var(--txt)")+";color:"+(libre?"var(--txt)":"var(--bg)");
      b1.addEventListener("click",function(){ st.qrPos=libre?null:{x:0.66,y:0.62,s:0.26}; st.show.qr=true; peindreQr(); redessiner(); });
      qrow.appendChild(b1);
      qTaille.style.display=libre?"block":"none"; if(libre) qTaille.value=Math.round(st.qrPos.s*100);
      cv.style.touchAction=libre?"none":"auto"; cv.style.cursor=libre?"grab":"default";
    };
    peindreQr();
    // Glisser le QR code sur l'aperçu
    var drag=null;
    var pt=function(ev){ var r=cv.getBoundingClientRect(); return {x:(ev.clientX-r.left)/r.width, y:(ev.clientY-r.top)/r.height}; };
    cv.addEventListener("pointerdown",function(ev){
      if(!st.qrPos) return;
      var F=AF_FORMATS[st.format]||AF_FORMATS.carre, p0=pt(ev), q=st.qrPos, hq=q.s*F.bw/F.bh*1.2;
      if(p0.x<q.x||p0.x>q.x+q.s||p0.y<q.y||p0.y>q.y+hq) return;
      drag={dx:p0.x-q.x, dy:p0.y-q.y, hq:hq}; cv.setPointerCapture(ev.pointerId); cv.style.cursor="grabbing"; ev.preventDefault();
    });
    cv.addEventListener("pointermove",function(ev){
      if(!drag) return; var p1=pt(ev), q=st.qrPos;
      q.x=Math.max(0,Math.min(1-q.s,p1.x-drag.dx)); q.y=Math.max(0,Math.min(1-drag.hq,p1.y-drag.dy));
      afRendre(cv,afContenu(e,st,page,imgs));
    });
    var fin=function(){ if(!drag) return; drag=null; cv.style.cursor="grab"; redessiner(); };
    cv.addEventListener("pointerup",fin); cv.addEventListener("pointercancel",fin);
  }
  function champ(titre, cle, ph, max){
    var b=bloc(titre), i=document.createElement("input"); i.className="form-input"; i.maxLength=max; i.placeholder=ph; i.value=st[cle]||"";
    i.addEventListener("input",function(){ st[cle]=i.value; redessiner(); }); b.appendChild(i);
  }
  champ("Titre","titre",e.titre||"",70);
  champ("Accroche","accroche",AF_TAGS[e.type]||"Événement",30);
  (function(){
    var b=bloc("Texte libre"), t=document.createElement("textarea"); t.className="form-input"; t.rows=5; t.maxLength=500;
    t.placeholder="Ex : Ouvert aux U9 à U15\nRepas tiré du sac\nVendredi de 15h à 19h";
    t.style.cssText="resize:vertical;min-height:110px;line-height:1.45;white-space:pre-wrap";
    t.value=st.texte||"";
    t.addEventListener("input",function(){ st.texte=t.value; redessiner(); });
    var h=document.createElement("div"); h.style.cssText="font-size:11px;color:var(--mut);margin-top:4px"; h.textContent="Les retours à la ligne et les espaces s'affichent tels quels sur l'affiche.";
    b.appendChild(t); b.appendChild(h);
  })();
  var iv=bloc("Intervenants"); var ivL=document.createElement("div"); iv.appendChild(ivL);
  var ivH=document.createElement("div"); ivH.style.cssText="font-size:11px;color:var(--mut);margin-bottom:8px;line-height:1.4"; ivH.textContent="Coachs, joueurs pros, invités : nom, rôle et photo (4 maximum).";
  iv.insertBefore(ivH,ivL);
  function peindreInterv(){
    ivL.innerHTML="";
    st.intervenants.forEach(function(x,i){
      var r=document.createElement("div"); r.style.cssText="display:flex;gap:8px;align-items:center;margin-bottom:8px";
      var ph=document.createElement("button"); ph.type="button"; ph.setAttribute("aria-label","Photo de l'intervenant");
      ph.style.cssText="flex-shrink:0;width:46px;height:46px;border-radius:50%;border:1.5px dashed var(--bdr);cursor:pointer;background:var(--card) center/cover no-repeat;font-size:18px;color:var(--mut)";
      if(x.photo) ph.style.backgroundImage="url("+x.photo+")"; else ph.textContent="📷";
      ph.addEventListener("click",function(){ afChoisirImage(function(src){ x.photo=src; afImage(src).then(function(im){ imgs.interv[i]=im; peindreInterv(); redessiner(); }); },240); });
      var g=document.createElement("div"); g.style.cssText="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px";
      var n=document.createElement("input"); n.className="form-input"; n.placeholder="Nom"; n.maxLength=40; n.value=x.nom||""; n.style.padding="8px 10px";
      n.addEventListener("input",function(){ x.nom=n.value; redessiner(); });
      var ro=document.createElement("input"); ro.className="form-input"; ro.placeholder="Rôle (ex : joueur pro N1)"; ro.maxLength=50; ro.value=x.role||""; ro.style.padding="8px 10px";
      ro.addEventListener("input",function(){ x.role=ro.value; redessiner(); });
      g.appendChild(n); g.appendChild(ro);
      var del=document.createElement("button"); del.type="button"; del.textContent="✕"; del.setAttribute("aria-label","Retirer");
      del.style.cssText="border:none;background:none;color:var(--red);font-size:15px;cursor:pointer;padding:6px";
      del.addEventListener("click",function(){ st.intervenants.splice(i,1); imgs.interv.splice(i,1); peindreInterv(); redessiner(); });
      r.appendChild(ph); r.appendChild(g); r.appendChild(del); ivL.appendChild(r);
    });
    if(st.intervenants.length<4){
      var add=document.createElement("button"); add.type="button"; add.textContent="+ Ajouter un intervenant";
      add.style.cssText="border:none;background:none;color:var(--dkg);font-size:13px;font-weight:800;cursor:pointer;padding:4px 0";
      add.addEventListener("click",function(){ st.intervenants.push({nom:"",role:"",photo:null}); st.show.intervenants=true; peindreInterv(); });
      ivL.appendChild(add);
    }
  }
  peindreInterv();

  // Chargements : polices, logo, QR, photos, sponsors, compteur en direct
  var club=window.CURRENT_CLUB||{};
  imgs.qr=afQr(lien());
  var sponsors=(typeof getSponsors==="function"?getSponsors():[]).filter(function(s){ return s&&(s.logo||s.nom||s.name); }).slice(0,6);
  Promise.all([
    afPolices(),
    afImage(typeof club.logo==="string"&&/^data:image\//.test(club.logo)?club.logo:null).then(function(i){ imgs.logo=i; }),
    afImage(photoSrc).then(function(i){ imgs.photo=i; }),
    Promise.all(st.intervenants.map(function(x){ return afImage(x.photo); })).then(function(l){ imgs.interv=l; }),
    Promise.all(sponsors.map(function(s){ return afImage(s.logo).then(function(i){ return {img:i,nom:s.nom||s.name||""}; }); })).then(function(l){ imgs.sponsors=l; })
  ]).then(redessiner);
  redessiner();
  if(e.inscr&&window.fbDoc){
    var ref=window.fbDoc(window.fbDb,"evt_pages",evtPageId(eid));
    if(window.fbOnSnapshot) unsub=window.fbOnSnapshot(ref,function(s){ if(s.exists()){ page=s.data(); redessiner(); } },function(){});
    else window.fbGetDoc(ref).then(function(s){ if(s.exists()){ page=s.data(); redessiner(); } }).catch(function(){});
  }
}
