// ═══ LECTURE D'UN TROMBINOSCOPE PDF (FBI) ═══════════════════════════
// Un trombinoscope FBI = une carte par licencié : photo à gauche, bloc « Généralités »
// (Prénom - NOM / n° de licence - date / club / naissance - genre [- nationalité]) et bloc
// « Sportif » (Licence 0C - U11 / assurance). On lit le texte de chaque carte et on
// découpe la photo. Résultat : les mêmes lignes que l'import CSV (js/06f-import.js),
// plus rows.photos (une photo par ligne). Les photos sont recadrées sur la page rendue.
function impTrombiDetecte(brutes){
  var g=0,s=0;
  brutes.forEach(function(b){ b.items.forEach(function(t){
    var x=(t.str||"").trim(); if(x==="Généralités") g++; else if(x==="Sportif") s++;
  }); });
  return g>=1&&s>=1;
}
// Catégorie FBI (U10, Seniors…) → catégorie de l'appli
function impTrombiCat(txt){
  var m=String(txt||"").match(/U\s*(\d{1,2})/i);
  if(m){
    var n=parseInt(m[1],10);
    if(n<=7) return "U7"; if(n<=9) return "U9"; if(n<=11) return "U11"; if(n<=13) return "U13";
    if(n<=15) return "U15"; if(n<=18) return "U18"; return "U21";
  }
  return /senior/i.test(txt||"")?"Senior":"";
}
// Découpe en cartes à partir des morceaux de texte d'une page.
// morceaux : [{s,x,y,w}] ; renvoie [{yHaut,yBas,nom,prenom,...}]
function impTrombiCartes(morceaux){
  var labels=morceaux.filter(function(m){return m.s==="Généralités";}).sort(function(a,b){return b.y-a.y;});
  var sportif=morceaux.filter(function(m){return m.s==="Sportif";})[0];
  if(!labels.length||!sportif) return [];
  var sx=sportif.x, gx=labels[0].x, cartes=[];
  labels.forEach(function(lab,i){
    var yHaut=lab.y+14, suivant=labels[i+1], yBas=suivant?suivant.y+10:-1e9;
    var dedans=morceaux.filter(function(m){return m.y<lab.y-3&&m.y>yBas&&m.s!=="Généralités"&&m.s!=="Sportif";});
    // le texte démarre un peu à gauche de son titre de bloc (« Généralités » / « Sportif »)
    var gauche=dedans.filter(function(m){return m.x>=gx-30&&m.x<sx-25;});
    var droite=dedans.filter(function(m){return m.x>=sx-25;});
    var lignesG=impPdfLignesPage(gauche.map(function(m){return {str:m.s,transform:[0,0,0,0,m.x,m.y],width:m.w};}));
    var txt=lignesG.map(function(l){return l.items.map(function(i){return i.s;}).join(" ").replace(/\s+/g," ").trim();});
    var c={yHaut:lab.y+14,yBas:yBas,centre:null,nom:"",prenom:"",numLicence:"",naissance:"",genre:"",nationalite:"",categorie:"",assurance:"",typeLicence:""};
    if(txt[0]){
      var k=txt[0].lastIndexOf(" - ");
      if(k>0){ c.prenom=txt[0].slice(0,k).trim(); c.nom=txt[0].slice(k+3).trim(); }
      else { c.nom=txt[0]; }
    }
    txt.forEach(function(t){
      var m=t.match(/^([A-Z]{1,3}\d{4,8})\s*-\s*(\d{2}\/\d{2}\/\d{4})/);
      if(m){ c.numLicence=m[1]; return; }
      m=t.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(Masculin|Féminin|Feminin)(?:\s*-\s*(.+))?/i);
      if(m){ c.naissance=m[1]; c.genre=/^m/i.test(m[2])?"M":"F"; c.nationalite=(m[3]||"").trim(); }
    });
    var lignesD=impPdfLignesPage(droite.map(function(m){return {str:m.s,transform:[0,0,0,0,m.x,m.y],width:m.w};}));
    lignesD.forEach(function(l){
      var t=l.items.map(function(i){return i.s;}).join(" ").replace(/\s+/g," ").trim(), m;
      if((m=t.match(/^Licence\s+(\S+)\s*-\s*(.+)$/i))){ c.typeLicence=m[1]; c.categorie=impTrombiCat(m[2]); }
      else if((m=t.match(/^[A-Z]\s*-\s*(.+)$/))){ c.assurance=m[1].trim(); }
    });
    cartes.push(c);
  });
  return cartes;
}
// Positions des images d'une page (suivi de la matrice de transformation).
function impTrombiImages(page){
  return page.getOperatorList().then(function(ol){
    var OPS=window.pdfjsLib.OPS, ctm=[1,0,0,1,0,0], pile=[], imgs=[];
    var mul=function(m,n){ return [m[0]*n[0]+m[1]*n[2], m[0]*n[1]+m[1]*n[3], m[2]*n[0]+m[3]*n[2], m[2]*n[1]+m[3]*n[3], m[4]*n[0]+m[5]*n[2]+n[4], m[4]*n[1]+m[5]*n[3]+n[5]]; };
    for(var i=0;i<ol.fnArray.length;i++){
      var f=ol.fnArray[i], a=ol.argsArray[i];
      if(f===OPS.save) pile.push(ctm.slice());
      else if(f===OPS.restore) ctm=pile.pop()||[1,0,0,1,0,0];
      else if(f===OPS.transform) ctm=mul(a,ctm);
      else if(f===OPS.paintImageXObject||f===OPS.paintInlineImageXObject||f===OPS.paintJpegXObject){
        var x0=ctm[4], y0=ctm[5], x1=ctm[0]+ctm[2]+ctm[4], y1=ctm[1]+ctm[3]+ctm[5];
        var r={x0:Math.min(x0,x1),x1:Math.max(x0,x1),y0:Math.min(y0,y1),y1:Math.max(y0,y1)};
        if(r.x1-r.x0>20&&r.y1-r.y0>20) imgs.push(r);
      }
    }
    return imgs;
  }).catch(function(){return [];});
}
function impTrombiRogner(canvas, vp, r){
  var q=vp.convertToViewportRectangle([r.x0,r.y0,r.x1,r.y1]);
  var x=Math.max(0,Math.min(q[0],q[2])), y=Math.max(0,Math.min(q[1],q[3]));
  var w=Math.min(canvas.width-x,Math.abs(q[2]-q[0])), h=Math.min(canvas.height-y,Math.abs(q[3]-q[1]));
  if(w<10||h<10) return "";
  var k=Math.min(1,320/Math.max(w,h)), out=document.createElement("canvas");
  out.width=Math.round(w*k); out.height=Math.round(h*k);
  out.getContext("2d").drawImage(canvas,x,y,w,h,0,0,out.width,out.height);
  return out.toDataURL("image/jpeg",0.8);
}
async function impTrombiLire(brutes){
  var entetes=["Nom","Prénom","Date de naissance","Sexe","N° de licence","Catégorie","Nationalité","Assurance"];
  var rows=[entetes], photos=[];
  for(var p=0;p<brutes.length;p++){
    var b=brutes[p];
    var morceaux=b.items.filter(function(t){return t.str&&t.str.trim();}).map(function(t){return {s:t.str.trim(),x:t.transform[4],y:t.transform[5],w:t.width||0};});
    var cartes=impTrombiCartes(morceaux);
    if(!cartes.length) continue;
    var imgs=await impTrombiImages(b.page), canvas=null, vp=null;
    if(imgs.length){
      vp=b.page.getViewport({scale:2});
      canvas=document.createElement("canvas"); canvas.width=Math.ceil(vp.width); canvas.height=Math.ceil(vp.height);
      await b.page.render({canvasContext:canvas.getContext("2d"),viewport:vp}).promise;
    }
    cartes.forEach(function(c){
      rows.push([c.nom,c.prenom,c.naissance,c.genre,c.numLicence,c.categorie,c.nationalite,c.assurance]);
      var img=null;
      imgs.forEach(function(r){ var cy=(r.y0+r.y1)/2; if(cy<=c.yHaut&&cy>c.yBas) img=r; });
      photos.push(img&&canvas?impTrombiRogner(canvas,vp,img):"");
    });
  }
  if(rows.length<2) throw new Error("Aucune fiche reconnue dans ce trombinoscope.");
  rows.photos=photos;
  return rows;
}
