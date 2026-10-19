/* ===== 14l-stats-fiche.js — Stats avancées : fiche d'un joueur sur la saison (vue du staff) =====
 * Cumul des matchs terminés de la saison (`match_stats`) via msFicheJoueur (14j). Premium.
 * La vue « chacun voit ses stats » (joueur / parent) viendra ensuite : elle ne doit montrer
 * que les chiffres de l'enfant, jamais ceux des autres.
 */
function statsMatchsSaison(saison){
  saison=saison||(typeof getCurrentSeason==="function"?getCurrentSeason():"");
  return getMatchStats().filter(function(m){
    return m.statut==="termine" && (!saison || !m.saison || m.saison===saison);
  });
}
function statsFicheFermer(){ var o=document.getElementById("ms-fiche"); if(o) o.remove(); }
function statsFicheJoueur(pid){
  if(typeof msPremium==="function" && !msPremium()){ askAlert("La fiche joueur fait partie du Pack Premium."); return; }
  var f=msFicheJoueur(pid, statsMatchsSaison());
  var p=getPlayers().filter(function(x){return String(x.id)===String(pid);})[0]||{};
  var o=document.getElementById("ms-fiche");
  if(!o){ o=document.createElement("div"); o.id="ms-fiche"; o.style.cssText="position:fixed;inset:0;z-index:360;background:var(--bg);color:var(--txt);display:flex;flex-direction:column;overflow-y:auto"; document.body.appendChild(o); }
  var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
  var h="<div class=\"ms-hdr\"><button class=\"ms-back\" onclick=\"statsFicheFermer()\" aria-label=\"Retour\">‹</button>"
    +"<div class=\"ms-t\"><b>"+authEsc(((p.prenom||"")+" "+(p.nom||"")).trim()||"Joueur")+"</b><span>Saison "+authEsc(saison)+" · "+f.n+" match"+(f.n>1?"s":"")+" joué"+(f.n>1?"s":"")+"</span></div>"
    +(p.cat?"<span class=\"ms-pill\">"+authEsc(p.cat)+"</span>":"")+"</div><div class=\"ms-body\">";
  if(!f.n){
    h+="<div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\">Aucun match terminé avec ce joueur pour l'instant. Ses statistiques apparaîtront après la première feuille de match.</div></div>";
    o.innerHTML=h; return;
  }
  function virg(v){ return v==null?"–":String(v).replace(".",","); }
  function tend(v){ return v==null?"":(v>0?"+"+virg(v)+" sur les 3 derniers":v<0?virg(v)+" sur les 3 derniers":"stable"); }
  var kp=[["Points / match",f.moyennes.pts,f.tendances.pts],["Rebonds / match",f.moyennes.reb,f.tendances.reb],
          ["Passes / match",f.moyennes.pd,f.tendances.pd],["Évaluation / match",f.moyennes.eval,f.tendances.eval]];
  h+="<div class=\"ms-grid2\" style=\"gap:8px\">"+kp.map(function(k){
    return "<div class=\"ms-k\"><div class=\"ms-lbl\">"+k[0]+"</div><div class=\"v\">"+virg(k[1])+"</div><div class=\"t\">"+tend(k[2])+"</div></div>";
  }).join("")+"</div>";
  var ad=f.adresse;
  h+="<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0 0 8px\">Adresse au tir</div>"
    +[["Tirs",ad.tirs],["3 points",ad.p3],["Lancers francs",ad.lf]].map(function(b){
      return "<div class=\"ms-barre\"><div class=\"l\">"+b[0]+"</div><div class=\"b\"><div style=\"width:"+(b[1]||0)+"%\"></div></div><div class=\"v\">"+(b[1]==null?"–":b[1]+" %")+"</div></div>";
    }).join("")
    +"<div style=\"display:flex;gap:16px;font-size:12px;color:var(--mut);margin-top:4px\"><div>Efficacité de tir <b style=\"color:var(--txt)\">"+(ad.efg==null?"–":ad.efg+" %")+"</b></div><div>Passes / pertes <b style=\"color:var(--txt)\">"+virg(ad.ratio)+"</b></div></div></div>";
  var maxEv=Math.max.apply(null,f.matchs.map(function(x){return x.eval;}).concat([1]));
  h+="<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0\">Évaluation match par match</div><div class=\"ms-hist\">"
    +f.matchs.slice(-8).map(function(x){ return "<div>"+x.eval+"<i style=\"height:"+Math.max(4,Math.round(Math.max(x.eval,0)*70/maxEv))+"px\"></i></div>"; }).join("")
    +"</div><div style=\"display:flex;gap:8px;margin-top:4px\">"+f.matchs.slice(-8).map(function(x){return "<div class=\"ms-nom\">"+authEsc(x.nom)+"</div>";}).join("")+"</div></div>";
  if(f.meilleur) h+="<div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\"><b>Meilleur match</b> : "+f.meilleur.pts+" pts, "+f.meilleur.reb+" rebonds, "+f.meilleur.pd+" passes ("+authEsc(f.meilleur.nom)+")</div>";
  h+="<div style=\"font-size:12px;color:var(--mut);line-height:1.4\">Temps de jeu moyen : "+virg(f.moyennes.min)+" min. Les moyennes se calculent sur les matchs terminés de la saison.</div></div>";
  o.innerHTML=h;
}
