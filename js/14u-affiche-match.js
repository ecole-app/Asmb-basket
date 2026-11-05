/* ===== 14u-affiche-match.js — Affiche d'un match de championnat (avant-match et résultat) ===== */
// Réutilise le moteur d'affiches de js/14d-affiche.js (Canvas 2D, polices, logo, couleurs du club).
// Deux modes : « À venir » (adversaire, date, heure, lieu) et « Résultat » (score, victoire / défaite).
// Formats : post carré et story. Partage par la fenêtre de partage de l'appareil (WhatsApp...), sinon téléchargement.

var AFM_FORMATS=["carre","story"];

function afmAdversaire(e){
  var a=(e.score&&e.score.adversaire)||e.adversaire||"";
  if(!a||a==="Adversaire"){
    var m=/(?:vs\.?|contre|face à|@)\s+(.+)$/i.exec(e.titre||"");
    a=m?m[1]:(e.titre||"");
  }
  return String(a).trim()||"Adversaire";
}
function afmDateTxt(e){
  var p=String(e.date||"").split("-");
  if(p.length!==3) return {jour:"",num:"",mois:""};
  var d=new Date(+p[0],+p[1]-1,+p[2]);
  return {jour:AF_JOURS[d.getDay()],num:String(+p[2]),mois:AF_MOIS_C[+p[1]-1]};
}
function afmContenu(e, mode, imgs){
  var club=window.CURRENT_CLUB||{};
  var c1=afHex(club.couleur)||"#1A2E5A", c2=afHex(club.couleur2)||afMix(c1,-0.45);
  var s=e.score||null;
  var res=mode==="resultat"&&s;
  var nous=Number(s&&s.asmb), eux=Number(s&&s.adv);
  return {
    c1:c1, c2:c2, logo:imgs.logo, initiales:afInitiales(clubLabel("Club")),
    club:clubLabel("Club"), equipe:e.equipe||"", adversaire:afmAdversaire(e),
    resultat:!!res, nous:nous, eux:eux,
    issue:res?(nous>eux?"VICTOIRE":(nous<eux?"DÉFAITE":"MATCH NUL")):"",
    date:afmDateTxt(e), heure:e.heure||"", lieu:e.lieu||""
  };
}
function afmRendre(canvas, C, format){
  var F=AF_FORMATS[format]||AF_FORMATS.carre;
  canvas.width=F.W; canvas.height=F.H;
  var c=canvas.getContext("2d"), u=F.W/F.bw, w=F.bw, h=F.bh;
  c.setTransform(u,0,0,u,0,0); c.textBaseline="top"; c.clearRect(0,0,w,h);
  var D={ctx:c,dry:false};
  // Fond : dégradé aux couleurs du club + deux grands disques discrets.
  var g=c.createLinearGradient(0,0,w*0.6,h); g.addColorStop(0,C.c1); g.addColorStop(1,C.c2);
  c.fillStyle=g; c.fillRect(0,0,w,h);
  c.fillStyle="rgba(255,255,255,.06)"; c.beginPath(); c.arc(w*0.95,h*0.08,w*0.42,0,Math.PI*2); c.fill();
  c.fillStyle="rgba(0,0,0,.10)"; c.beginPath(); c.arc(w*0.02,h*0.98,w*0.5,0,Math.PI*2); c.fill();
  var story=format==="story", k=story?1.1:1, y=story?60:30;
  // Bandeau du haut : type + équipe.
  afTexte(D,C.resultat?"RÉSULTAT":"MATCH",w/2,y,{size:13*k,weight:800,ls:3*k,color:"rgba(255,255,255,.75)",align:"center",lh:1,fam:AF_F.sans});
  y+=22*k;
  if(C.equipe) y+=afTexte(D,C.equipe,w/2,y,{size:22*k,weight:400,fam:AF_F.anton,ls:1.5*k,color:"#fff",align:"center",upper:true,maxW:w-60,fit:true,maxLines:1,lh:1.1});
  // Les deux équipes.
  var d=(C.resultat?(story?84:78):(story?96:104))*k, cy=story?(C.resultat?h*0.31:h*0.36):(C.resultat?h*0.31:h*0.40), gap=w*0.27;
  var xN=w/2-gap, xE=w/2+gap;
  afLogo(D,{logo:C.logo,initiales:C.initiales,c1:C.c1},xN-d/2,cy-d/2,d,{ring:"rgba(255,255,255,.85)"});
  // Adversaire : rond blanc avec initiales.
  afLogo(D,{logo:null,initiales:afInitiales(C.adversaire),c1:C.c1},xE-d/2,cy-d/2,d,{bg:"#fff",fg:C.c1,ring:"rgba(255,255,255,.85)"});
  var nomW=w*0.36;
  afTexte(D,C.club,xN,cy+d/2+10*k,{size:14*k,weight:800,color:"#fff",align:"center",maxW:nomW,maxLines:2,fit:true,lh:1.15});
  afTexte(D,C.adversaire,xE,cy+d/2+10*k,{size:14*k,weight:800,color:"#fff",align:"center",maxW:nomW,maxLines:2,fit:true,lh:1.15});
  // Centre : score ou VS.
  var by=story?h*0.62:h*0.64;
  if(C.resultat){
    // Le score passe sous les noms des équipes, en grand, pour ne jamais être caché par un logo.
    by=cy+d/2+(story?70:62)*k;
    by+=afTexte(D,C.nous+" - "+C.eux,w/2,by,{size:(story?72:58)*k,weight:400,fam:AF_F.anton,color:"#fff",align:"center",lh:1.05,maxW:w-80,fit:true,maxLines:1})+(story?18:10)*k;
  } else {
    afTexte(D,"VS",w/2,cy-24*k,{size:46*k,weight:400,fam:AF_F.anton,color:"rgba(255,255,255,.9)",align:"center",lh:1});
  }
  // Bas : issue (résultat) ou date, heure, lieu (avant-match).
  if(C.resultat){
    var col=C.nous>C.eux?"#4ade80":(C.nous<C.eux?"#fca5a5":"#fde68a");
    afRect(D,w/2-90*k,by,180*k,40*k,20*k,"rgba(255,255,255,.14)",col,2);
    afTexte(D,C.issue,w/2,by+11*k,{size:17*k,weight:800,ls:3*k,color:col,align:"center",lh:1});
    by+=(story?66:56)*k;
    if(C.date.num) afTexte(D,C.date.jour+" "+C.date.num+" "+C.date.mois,w/2,by,{size:15*k,weight:800,ls:2*k,color:"rgba(255,255,255,.85)",align:"center",lh:1});
    by+=24*k;
    if(C.lieu) afTexte(D,C.lieu,w/2,by,{size:13*k,weight:600,color:"rgba(255,255,255,.7)",align:"center",maxW:w-70,maxLines:2,fit:true,lh:1.2});
  } else {
    if(C.date.num){
      afTexte(D,C.date.jour,w/2,by,{size:15*k,weight:800,ls:4*k,color:"rgba(255,255,255,.8)",align:"center",lh:1});
      by+=22*k;
      by+=afTexte(D,C.date.num+" "+C.date.mois,w/2,by,{size:44*k,weight:400,fam:AF_F.anton,color:"#fff",align:"center",lh:1.05,ls:1*k});
    }
    by+=8*k;
    if(C.heure) by+=afTexte(D,C.heure,w/2,by,{size:24*k,weight:800,color:"#fde68a",align:"center",lh:1.1})+6*k;
    if(C.lieu) afTexte(D,"📍 "+C.lieu,w/2,by,{size:13*k,weight:600,color:"rgba(255,255,255,.8)",align:"center",maxW:w-70,maxLines:2,fit:true,lh:1.2});
  }
  // Pied : nom du club.
  afTexte(D,C.club.toUpperCase(),w/2,h-(story?70:34),{size:11*k,weight:800,ls:3*k,color:"rgba(255,255,255,.55)",align:"center",lh:1,maxW:w-60,maxLines:1,fit:true});
}

function afficheMatch(eid){
  var e=getEvents().find(function(x){return x.id===eid;}); if(!e) return;
  var mode=(e.score&&(e.date<=new Date().toISOString().slice(0,10)))?"resultat":"avenir", format="carre", imgs={logo:null};
  var old=document.getElementById("afm-ecran"); if(old) old.remove();
  var o=document.createElement("div"); o.id="afm-ecran";
  o.style.cssText="position:fixed;inset:0;z-index:350;background:var(--bg);display:flex;flex-direction:column;overflow:hidden";
  var btn="flex:1 1 110px;padding:13px;border-radius:var(--rx);font-size:14px;font-weight:800;cursor:pointer;";
  o.innerHTML=
    '<div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 10px) 14px 10px;background:var(--card);border-bottom:1px solid var(--bdr)">'+
      '<button id="afm-x" aria-label="Fermer" style="border:none;background:var(--bdr);color:var(--txt);width:34px;height:34px;border-radius:50%;font-size:15px;cursor:pointer;flex-shrink:0">✕</button>'+
      '<div style="flex:1;min-width:0"><div style="font-size:16px;font-weight:900;color:var(--txt)">Affiche du match</div><div style="font-size:11px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+authEsc((e.equipe?e.equipe+" · ":"")+afmAdversaire(e))+'</div></div>'+
    '</div>'+
    '<div style="flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px;display:flex;flex-direction:column;align-items:center;gap:12px">'+
      '<div id="afm-modes" style="display:flex;gap:8px;width:100%;max-width:460px"></div>'+
      '<div id="afm-fmt" style="display:flex;gap:8px;width:100%;max-width:460px"></div>'+
      '<canvas id="afm-cv" style="width:100%;max-width:460px;height:auto;border-radius:4px;box-shadow:0 14px 34px rgba(17,24,39,.22);background:#fff"></canvas>'+
      '<div style="display:flex;gap:8px;width:100%;max-width:460px;flex-wrap:wrap">'+
        '<button id="afm-wa" style="'+btn+'border:none;background:#25D366;color:#073b1f">WhatsApp</button>'+
        '<button id="afm-share" style="'+btn+'border:1px solid var(--bdr);background:var(--card);color:var(--txt)">Partager</button>'+
        '<button id="afm-dl" style="'+btn+'border:none;background:var(--dkg);color:#fff">Télécharger</button>'+
      '</div>'+
    '</div>';
  document.body.appendChild(o);
  var cv=document.getElementById("afm-cv");
  function chip(id,label,on,fn){
    var b=document.createElement("button"); b.type="button"; b.textContent=label;
    b.style.cssText="flex:1;padding:9px;border-radius:20px;font-size:12px;font-weight:800;cursor:pointer;border:1.5px solid "+(on?"var(--dkg)":"var(--bdr)")+";background:"+(on?"var(--dkg)":"var(--card)")+";color:"+(on?"#fff":"var(--txt)");
    b.addEventListener("click",fn); document.getElementById(id).appendChild(b);
  }
  function barres(){
    document.getElementById("afm-modes").innerHTML=""; document.getElementById("afm-fmt").innerHTML="";
    chip("afm-modes",gmT("À venir"),mode==="avenir",function(){ mode="avenir"; maj(); });
    if(e.score) chip("afm-modes",gmT("Résultat"),mode==="resultat",function(){ mode="resultat"; maj(); });
    chip("afm-fmt",gmT("Post carré"),format==="carre",function(){ format="carre"; maj(); });
    chip("afm-fmt",gmT("Story"),format==="story",function(){ format="story"; maj(); });
  }
  function dessiner(){ afmRendre(cv,afmContenu(e,mode,imgs),format); }
  function maj(){ barres(); dessiner(); }
  function nomFichier(){ return "match-"+String(afmAdversaire(e)).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,40)+".png"; }
  function message(){
    var C=afmContenu(e,mode,imgs);
    if(C.resultat) return C.club+(C.equipe?" "+C.equipe:"")+" : "+C.issue.toLowerCase()+" "+C.nous+"-"+C.eux+" contre "+C.adversaire+" !";
    return C.club+(C.equipe?" "+C.equipe:"")+" joue contre "+C.adversaire+" le "+C.date.jour+" "+C.date.num+" "+C.date.mois+(C.heure?" à "+C.heure:"")+(C.lieu?" · "+C.lieu:"");
  }
  function fichier(){
    dessiner();
    var d=cv.toDataURL("image/png"), bin=atob(d.split(",")[1]), u=new Uint8Array(bin.length);
    for(var i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i);
    return new File([u],nomFichier(),{type:"image/png"});
  }
  function telecharger(f){
    var a=document.createElement("a"); a.href=URL.createObjectURL(f); a.download=f.name; document.body.appendChild(a); a.click();
    setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1500);
  }
  function peutPartager(f){ try{ return !!(navigator.share&&navigator.canShare&&navigator.canShare({files:[f]})); }catch(err){ return false; } }
  function secours(f){ telecharger(f); if(typeof copyToClipboard==="function") copyToClipboard(message()); showToast("Image téléchargée et texte copié : collez-les dans votre message"); }
  function partager(){
    var f=fichier();
    if(peutPartager(f)) navigator.share({files:[f],text:message()}).catch(function(err){ var n=err&&err.name; if(n==="AbortError"||n==="InvalidStateError") return; secours(f); });
    else secours(f);
  }
  document.getElementById("afm-x").addEventListener("click",function(){ o.remove(); });
  document.getElementById("afm-dl").addEventListener("click",function(){ telecharger(fichier()); });
  document.getElementById("afm-share").addEventListener("click",partager);
  document.getElementById("afm-wa").addEventListener("click",function(){
    var f=fichier();
    if(peutPartager(f)) navigator.share({files:[f],text:message()}).catch(function(err){ var n=err&&err.name; if(n==="AbortError"||n==="InvalidStateError") return; secours(f); });
    else { telecharger(f); window.open("https://wa.me/?text="+encodeURIComponent(message()),"_blank"); }
  });
  // Polices et logo puis premier dessin.
  maj();
  Promise.all([afPolices(),afImage(typeof clubLogo==="function"?clubLogo():null)]).then(function(r){ imgs.logo=r[1]; dessiner(); });
}
