/* ===== 14l-stats-fiche.js — Stats avancées : fiche d'un joueur sur la saison =====
 * Vue du staff : cumul des matchs terminés de la saison (`match_stats`) via msFicheJoueur (14j). Premium.
 *
 * Vue joueur / parent (« chacun voit les siennes ») : le staff publie, à chaque enregistrement d'un
 * match, un document par joueur `stats_joueurs/{pid}` qui ne contient QUE ses lignes de match
 * (msLignesJoueurs) et le score final, jamais les chiffres des coéquipiers. La règle Firestore ne
 * le laisse lire qu'au staff et au compte rattaché à ce joueur (rattachements / linkedPlayerIds).
 * Le parent voit la fiche dans l'onglet Stats ; « 📄 PDF » exporte la fiche (staff et parent).
 */
function statsMatchsSaison(saison){
  saison=saison||(typeof getCurrentSeason==="function"?getCurrentSeason():"");
  return getMatchStats().filter(function(m){
    return m.statut==="termine" && (!saison || !m.saison || m.saison===saison);
  });
}
function statsFicheFermer(){ var o=document.getElementById("ms-fiche"); if(o) o.remove(); }
function statsVirg(v){ return v==null?"–":String(v).replace(".",","); }

// Corps de la fiche (partagé staff / parent). f = résultat de msFicheJoueur / msFicheDepuisLignes.
function statsFicheCorps(f){
  if(!f.n) return "<div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\">Aucun match terminé pour l'instant. Les statistiques apparaîtront après la première feuille de match.</div>";
  function tend(v){ return v==null?"":(v>0?"+"+statsVirg(v)+" sur les 3 derniers":v<0?statsVirg(v)+" sur les 3 derniers":"stable"); }
  var kp=[["Points / match",f.moyennes.pts,f.tendances.pts],["Rebonds / match",f.moyennes.reb,f.tendances.reb],
          ["Passes / match",f.moyennes.pd,f.tendances.pd],["Évaluation / match",f.moyennes.eval,f.tendances.eval]];
  var h="<div class=\"ms-grid2\" style=\"gap:8px\">"+kp.map(function(k){
    return "<div class=\"ms-k\"><div class=\"ms-lbl\">"+k[0]+"</div><div class=\"v\">"+statsVirg(k[1])+"</div><div class=\"t"+(k[2]<0?" neg":"")+"\">"+tend(k[2])+"</div></div>";
  }).join("")+"</div>";
  var ad=f.adresse;
  h+="<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0 0 8px\">Adresse au tir</div>"
    +[["Tirs",ad.tirs],["3 points",ad.p3],["Lancers francs",ad.lf]].map(function(b){
      return "<div class=\"ms-barre\"><div class=\"l\">"+b[0]+"</div><div class=\"b\"><div style=\"width:"+(b[1]||0)+"%\"></div></div><div class=\"v\">"+(b[1]==null?"–":b[1]+" %")+"</div></div>";
    }).join("")
    +"<div style=\"display:flex;gap:16px;font-size:12px;color:var(--mut);margin-top:4px\"><div>Efficacité de tir <b style=\"color:var(--txt)\">"+(ad.efg==null?"–":ad.efg+" %")+"</b></div><div>Passes / pertes <b style=\"color:var(--txt)\">"+statsVirg(ad.ratio)+"</b></div></div></div>";
  var maxEv=Math.max.apply(null,f.matchs.map(function(x){return x.eval;}).concat([1]));
  h+="<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0\">Évaluation match par match</div><div class=\"ms-hist\">"
    +f.matchs.slice(-8).map(function(x){ return "<div>"+x.eval+"<i style=\"height:"+Math.max(4,Math.round(Math.max(x.eval,0)*70/maxEv))+"px\"></i></div>"; }).join("")
    +"</div><div style=\"display:flex;gap:8px;margin-top:4px\">"+f.matchs.slice(-8).map(function(x){return "<div class=\"ms-nom\">"+authEsc(x.nom)+"</div>";}).join("")+"</div></div>";
  if(f.meilleur) h+="<div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\"><b>Meilleur match</b> : "+f.meilleur.pts+" pts, "+f.meilleur.reb+" rebond"+(f.meilleur.reb>1?"s":"")+", "+f.meilleur.pd+" passe"+(f.meilleur.pd>1?"s":"")+" ("+authEsc(f.meilleur.nom)+")</div>";
  h+="<div style=\"font-size:12px;color:var(--mut);line-height:1.4\">Temps de jeu moyen : "+statsVirg(f.moyennes.min)+" min. Les moyennes se calculent sur les matchs terminés de la saison.</div>";
  return h;
}
function statsFicheOuvrir(titre, sous, pill, f, pdf){
  var o=document.getElementById("ms-fiche");
  if(!o){ o=document.createElement("div"); o.id="ms-fiche"; o.style.cssText="position:fixed;inset:0;z-index:360;background:var(--bg);color:var(--txt);display:flex;flex-direction:column;overflow-y:auto"; document.body.appendChild(o); }
  o.innerHTML="<div class=\"ms-hdr\"><button class=\"ms-back\" onclick=\"statsFicheFermer()\" aria-label=\"Retour\">‹</button>"
    +"<div class=\"ms-t\"><b>"+authEsc(titre)+"</b><span>"+authEsc(sous)+"</span></div>"
    +(pill?"<span class=\"ms-pill\">"+authEsc(pill)+"</span>":"")
    +(f.n&&pdf?"<button id=\"ms-fiche-pdf\" style=\"margin-left:8px;padding:7px 12px;border-radius:20px;border:none;background:var(--bdr);color:var(--txt);font-size:12px;font-weight:700;cursor:pointer\">📄 PDF</button>":"")
    +"</div><div class=\"ms-body\">"+statsFicheCorps(f)+"</div>";
  var b=document.getElementById("ms-fiche-pdf"); if(b&&pdf) b.addEventListener("click",pdf);
}
function statsFicheJoueur(pid){
  if(typeof msPremium==="function" && !msPremium()){ askAlert("La fiche joueur fait partie du Pack Premium."); return; }
  var f=msFicheJoueur(pid, statsMatchsSaison());
  var p=getPlayers().filter(function(x){return String(x.id)===String(pid);})[0]||{};
  var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
  var nom=((p.prenom||"")+" "+(p.nom||"")).trim()||"Joueur";
  var lignes=(msLignesJoueurs(statsMatchsSaison())[pid])||[];
  statsFicheOuvrir(nom,"Saison "+saison+" · "+f.n+" match"+(f.n>1?"s":"")+" joué"+(f.n>1?"s":""),p.cat||"",f,function(){ statsFichePdf(nom,saison,f,lignes); });
}

// ── Publication pour les familles (staff) ──────────────────────────
// Un document par joueur de la saison en cours ; réécrit seulement s'il a changé (empreinte gardée localement).
var STATS_PUB_T=null;
function statsJoueursDonnees(lignesParJoueur, saison){
  var out={};
  Object.keys(lignesParJoueur||{}).forEach(function(pid){
    out[pid]={pid:String(pid), saison:saison||"", matchs:lignesParJoueur[pid].slice(-60).map(function(x){
      var L=x.ligne;
      return {eventId:x.eventId, date:x.date, adversaire:String(x.adversaire||"").slice(0,60), nous:x.nous, eux:x.eux,
        ligne:{pts:L.pts,ro:L.ro,rd:L.rd,reb:L.reb,pd:L.pd,int:L.int,ct:L.ct,bp:L.bp,fc:L.fc,fp:L.fp,
          lf:{r:L.lf.r,t:L.lf.t},p2:{r:L.p2.r,t:L.p2.t},p3:{r:L.p3.r,t:L.p3.t},tirs:{r:L.tirs.r,t:L.tirs.t},sec:L.sec,min:L.min,pm:L.pm,eval:L.eval}};
    })};
  });
  return out;
}
function statsJoueursPublier(){
  if(!window.fbSetDoc||!window.fbDb||!window.CURRENT_CLUB_ID) return;
  var prof=localStorage.getItem("asmb_profile"); if(prof!=="dirigeant"&&prof!=="coach") return;
  clearTimeout(STATS_PUB_T);
  STATS_PUB_T=setTimeout(function(){
    var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
    var donnees=statsJoueursDonnees(msLignesJoueurs(statsMatchsSaison(saison)),saison);
    var empr={}; try{ empr=JSON.parse(localStorage.getItem("gm_stats_pub")||"{}"); }catch(e){}
    Object.keys(donnees).forEach(function(pid){
      var d=donnees[pid], cle=JSON.stringify(d);
      if(empr[pid]===cle) return;
      d.majLe=Date.now();
      window.fbSetDoc(window.fbDoc(window.fbDb,"stats_joueurs",String(pid)),d).then(function(){
        empr[pid]=cle; try{ localStorage.setItem("gm_stats_pub",JSON.stringify(empr)); }catch(e){}
      }).catch(function(){});
    });
  },2500);
}

// ── Vue joueur / parent (onglet Stats) ─────────────────────────────
function statsMesJoueursBloc(el){
  if(!el||!window.fbGetDoc||!window.fbDb) return;
  var ids=(typeof mesJoueursIds==="function"?mesJoueursIds():[]).map(String);
  if(!ids.length) return;
  var players=typeof getRoster==="function"?getRoster():(typeof getPlayers==="function"?getPlayers():[]);
  var zone=document.createElement("div"); el.insertBefore(zone,el.firstChild);
  var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
  Promise.all(ids.map(function(pid){
    return window.fbGetDoc(window.fbDoc(window.fbDb,"stats_joueurs",pid)).then(function(sn){ return sn.exists()?sn.data():null; }).catch(function(){ return null; });
  })).then(function(docs){
    var h="";
    docs.forEach(function(d,i){
      if(!d||!Array.isArray(d.matchs)||!d.matchs.length) return;
      if(d.saison&&saison&&d.saison!==saison) return;
      var pid=ids[i], p=(players||[]).filter(function(x){ return String(x.id)===pid; })[0]||{};
      var nom=((p.prenom||"")+" "+(p.nom||"")).trim()||"Mes stats";
      var f=msFicheDepuisLignes(d.matchs), prem=(typeof hasPremium!=="function")||hasPremium();
      var tot=d.matchs.reduce(function(s,x){ return s+(x.ligne.pts||0); },0);
      h+="<div role=\"button\" data-pid=\""+authEsc(pid)+"\" style=\"cursor:pointer;background:var(--card);border:1px solid var(--bdr);border-radius:var(--r);padding:16px;box-shadow:0 2px 12px var(--shadow);margin-bottom:12px\">"
        +"<div style=\"display:flex;justify-content:space-between;align-items:baseline\"><div style=\"font-size:11px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:1px\">Stats de match · "+authEsc(nom)+"</div><div style=\"color:var(--mut);font-size:18px\">›</div></div>"
        +"<div style=\"display:flex;justify-content:space-around;text-align:center;margin-top:12px\">"
        +(prem?[["Pts / match",f.moyennes.pts],["Reb / match",f.moyennes.reb],["Éval / match",f.moyennes.eval]]:[["Matchs",f.n],["Points",tot],["Pts / match",f.moyennes.pts]]).map(function(k){
          return "<div><div style=\"font-size:22px;font-weight:900;color:var(--txt)\">"+statsVirg(k[1])+"</div><div style=\"font-size:10px;color:var(--mut);margin-top:2px\">"+k[0]+"</div></div>";
        }).join("")+"</div>"
        +"<div style=\"font-size:11px;color:var(--mut);margin-top:10px\">"+f.n+" match"+(f.n>1?"s":"")+" · dernier : "+authEsc(statsDateFr(d.matchs[d.matchs.length-1].date))+"</div></div>";
    });
    zone.innerHTML=h;
    Array.prototype.forEach.call(zone.querySelectorAll("[data-pid]"),function(c){
      c.addEventListener("click",function(){
        var i=ids.indexOf(c.getAttribute("data-pid")), d=docs[i], p=(players||[]).filter(function(x){ return String(x.id)===ids[i]; })[0]||{};
        statsMaFiche(((p.prenom||"")+" "+(p.nom||"")).trim()||"Mes stats", d, p.cat||"");
      });
    });
  });
}
function statsDateFr(d){ var x=String(d||"").split("-"); return x.length===3?x[2]+"/"+x[1]+"/"+x[0]:(d||""); }
function statsMaFiche(nom, d, cat){
  var saison=d.saison||(typeof getCurrentSeason==="function"?getCurrentSeason():"");
  var prem=(typeof hasPremium!=="function")||hasPremium();
  var f=msFicheDepuisLignes(d.matchs);
  if(prem){ statsFicheOuvrir(nom,"Saison "+saison+" · "+f.n+" match"+(f.n>1?"s":""),cat,f,function(){ statsFichePdf(nom,saison,f,d.matchs); }); return; }
  // Pack Standard : points et fautes match par match
  statsFicheOuvrir(nom,"Saison "+saison+" · "+f.n+" match"+(f.n>1?"s":""),cat,{n:0},null);
  var b=document.querySelector("#ms-fiche .ms-body");
  if(b) b.innerHTML="<div class=\"ms-card\">"+d.matchs.slice().reverse().map(function(x){
    return "<div style=\"display:flex;justify-content:space-between;gap:8px;padding:8px 0;border-bottom:1px solid var(--bdr);font-size:13px\"><div>"+authEsc(statsDateFr(x.date))+(x.adversaire?" · "+authEsc(x.adversaire):"")+"<div style=\"font-size:11px;color:var(--mut)\">"+x.nous+" – "+x.eux+"</div></div><div style=\"text-align:right\"><b>"+x.ligne.pts+" pts</b><div style=\"font-size:11px;color:var(--mut)\">"+x.ligne.fc+" faute"+(x.ligne.fc>1?"s":"")+"</div></div></div>";
  }).join("")+"</div>";
}

// ── PDF de la fiche (staff et parent) ──────────────────────────────
function statsFichePdf(nom, saison, f, lignes){
  if(!window.jspdf){ askAlert("Le générateur de PDF n'est pas chargé. Réessayez dans un instant."); return; }
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), tint=(typeof clubPdfTint==="function")?clubPdfTint(0.92):[240,240,240], y=18;
  doc.setFontSize(10); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb); doc.text(clubTitle()||"",14,y); y+=8;
  doc.setFontSize(16); doc.setTextColor(30,30,30); doc.text(nom,14,y); y+=6;
  doc.setFont(undefined,"normal"); doc.setFontSize(9.5); doc.setTextColor(90,90,90);
  doc.text("Saison "+saison+" · "+f.n+" match"+(f.n>1?"s":"")+" · document du "+new Date().toLocaleDateString("fr-FR"),14,y); y+=8;
  var v=function(x){ return x==null?"-":String(x).replace(".",","); };
  var k=[["Points / match",f.moyennes.pts],["Rebonds / match",f.moyennes.reb],["Passes / match",f.moyennes.pd],["Évaluation / match",f.moyennes.eval]];
  var bw=45;
  k.forEach(function(x,i){
    var bx=12+i*(bw+1.3); doc.setFillColor.apply(doc,tint); doc.roundedRect(bx,y,bw,18,2,2,"F");
    doc.setFontSize(15); doc.setFont(undefined,"bold"); doc.setTextColor.apply(doc,rgb); doc.text(v(x[1]),bx+bw/2,y+8.5,{align:"center"});
    doc.setFontSize(7.5); doc.setFont(undefined,"normal"); doc.setTextColor(70,70,70); doc.text(x[0],bx+bw/2,y+14,{align:"center"});
  });
  y+=26;
  var ad=f.adresse;
  doc.setFontSize(9.5); doc.setTextColor(40,40,40);
  doc.text("Adresse : tirs "+(ad.tirs==null?"-":ad.tirs+" %")+" · 3 points "+(ad.p3==null?"-":ad.p3+" %")+" · lancers francs "+(ad.lf==null?"-":ad.lf+" %")+" · temps de jeu moyen "+v(f.moyennes.min)+" min",14,y); y+=9;
  var cols=[{t:"Date",x:14},{t:"Adversaire",x:34},{t:"Score",x:86},{t:"Min",x:108},{t:"Pts",x:120},{t:"Reb",x:132},{t:"Pd",x:144},{t:"Int",x:155},{t:"Bp",x:166},{t:"Fte",x:177},{t:"Éval",x:188}];
  doc.setFillColor.apply(doc,rgb); doc.rect(12,y-4.5,186,6.5,"F"); doc.setTextColor(255,255,255); doc.setFont(undefined,"bold"); doc.setFontSize(8.5);
  cols.forEach(function(c){ doc.text(c.t,c.x,y); }); y+=6.5; doc.setFont(undefined,"normal"); doc.setTextColor(40,40,40);
  (lignes||[]).forEach(function(x,i){
    if(y>282){ doc.addPage(); y=20; }
    if(i%2===1){ doc.setFillColor.apply(doc,tint); doc.rect(12,y-4.5,186,6.2,"F"); }
    var L=x.ligne, d=String(x.date||"").split("-");
    [d.length===3?d[2]+"/"+d[1]:"",String(x.adversaire||"").slice(0,26),x.nous+"-"+x.eux,L.min,L.pts,L.reb,L.pd,L.int,L.bp,L.fc,L.eval].forEach(function(val,j){ doc.text(String(val==null?"":val),cols[j].x,y); });
    y+=6.2;
  });
  var fic=("stats-"+String(nom).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-")+"-"+saison).replace(/-+/g,"-");
  doc.save(fic+".pdf");
}
