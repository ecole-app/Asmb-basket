/* ===== 14m-stats-ecrans.js — Stats avancées : écran de la salle (TV) et tableau de saison de l'équipe =====
 * Écran de la salle : plein écran sombre, relit le match toutes les secondes. Un 2e appareil (TV, tablette)
 * connecté avec un compte coach reçoit les saisies par la synchro Firestore, rien n'est public.
 * Stats équipe : cumul des matchs terminés (msEquipeSaison, 14j) pour le staff, Premium.
 * La feuille de match « ordinateur » est dans 14k (msFeuille) : mise en page à 2 colonnes via css/style.css.
 */
var msSalleTimer=null, msSalleId=null;

// ── Écran de la salle (A) ────────────────────────────────────────
function statsSalleOuvrir(eventId){
  if(typeof isStaffUser==="function" && !isStaffUser()){ askAlert("Réservé aux coachs et au dirigeant."); return; }
  if(typeof msPremium==="function" && !msPremium()){ askAlert("L'écran de la salle fait partie du Pack Premium."); return; }
  msSalleId=String(eventId);
  var o=document.getElementById("ms-salle");
  if(!o){ o=document.createElement("div"); o.id="ms-salle"; document.body.appendChild(o); }
  clearInterval(msSalleTimer);
  statsSalleDessiner();
  msSalleTimer=setInterval(statsSalleDessiner,1000);
  try{ if(o.requestFullscreen) o.requestFullscreen().catch(function(){}); }catch(e){}
}
function statsSalleFermer(){
  clearInterval(msSalleTimer); msSalleTimer=null; msSalleId=null;
  try{ if(document.fullscreenElement) document.exitFullscreen(); }catch(e){}
  var o=document.getElementById("ms-salle"); if(o) o.remove();
}
function statsSalleDessiner(){
  var o=document.getElementById("ms-salle"); if(!o) return;
  var m=getMatchStats().filter(function(x){return String(x.id)===String(msSalleId);})[0];
  if(!m){
    o.innerHTML="<div class=\"sl-vide\"><button class=\"sl-x\" onclick=\"statsSalleFermer()\">✕</button>En attente du début du match…</div>"; return;
  }
  var r=msCalcul(m), ter=msTerrain(m);
  if(!ter.length) ter=r.ids.slice().sort(function(a,b){return r.joueurs[b].pts-r.joueurs[a].pts;}).slice(0,5);
  var etat=m.statut==="termine"?"Terminé":(msChronoMarche(m)?"En direct":"Pause");
  function meilleur(k){
    var a=r.ids.slice().sort(function(x,y){return r.joueurs[y][k]-r.joueurs[x][k];})[0];
    return a?{nom:msNomJoueur(a),v:r.joueurs[a][k]}:{nom:"–",v:0};
  }
  var ad=msAdresse(r.equipe), q=Number(m.q)||1;
  var h="<button class=\"sl-x\" onclick=\"statsSalleFermer()\" aria-label=\"Fermer\">✕</button>"
    +"<div class=\"sl-top\"><span class=\"sl-logo\">"+authEsc((clubLabel("Club")||"C").slice(0,2).toUpperCase())+"</span><b>"+authEsc(clubLabel("Club"))+"</b><span>"+authEsc((m.equipe||"")+(m.date?" · "+m.date:""))+"</span></div>"
    +"<div class=\"sl-score\"><div><i>"+authEsc(clubLabel("Nous"))+"</i><b>"+r.score.nous+"</b></div>"
    +"<div class=\"sl-mid\"><span class=\"sl-pill"+(etat==="En direct"?" live":"")+"\">"+etat+"</span><div class=\"sl-q\">"+msLibQuart(q,m.nbQ)+"</div><div class=\"sl-clk\">"+msMMSS(msRestantQuart(m))+"</div>"
    +"<div class=\"sl-qs\">"+Array.apply(null,Array(Math.max(Number(m.nbQ)||4,q))).map(function(_,i){
        var n=i+1, a=r.parQuart.nous[i], e=r.parQuart.eux[i];
        return "<span"+(n===q&&m.statut!=="termine"?" class=\"on\"":"")+">"+msLibQuart(n,m.nbQ)+(a!=null?" "+a+"-"+e:"")+"</span>";}).join("")+"</div></div>"
    +"<div class=\"d\"><i>"+authEsc(m.adversaire||"Adversaire")+"</i><b>"+r.score.eux+"</b></div></div>"
    +"<div class=\"sl-bas\"><div><h3>Sur le terrain</h3><div class=\"sl-cinq\">"+ter.map(function(id){
        var L=r.joueurs[id]||msLigneVide(), pts=[];
        for(var i=0;i<5;i++) pts.push("<u"+(i<L.fc?" class=\"x\"":"")+"></u>");
        return "<div class=\"sl-jo"+(L.fc>=4?" al":"")+"\"><b>"+authEsc(msNomJoueur(id))+"</b><div class=\"p\">"+L.pts+"</div><small>PTS · "+L.min+" min</small><span class=\"fa\">"+pts.join("")+"</span></div>";}).join("")+"</div></div>"
    +"<div><h3>Meilleurs du match</h3><div class=\"sl-ld\">"+[["Points","pts"],["Rebonds","reb"],["Passes","pd"]].map(function(x){
        var t=meilleur(x[1]); return "<div><em>"+x[0]+"</em><b>"+authEsc(t.nom)+"</b><strong>"+t.v+"</strong></div>";}).join("")+"</div></div></div>"
    +"<div class=\"sl-tk\"><span><b>Tirs</b> "+(ad.tirs==null?"–":ad.tirs+" %")+"</span><span><b>3 points</b> "+(ad.p3==null?"–":ad.p3+" %")+"</span><span><b>Lancers francs</b> "+(ad.lf==null?"–":ad.lf+" %")+"</span><span><b>Fautes équipe "+msLibQuart(q,m.nbQ)+"</b> "+(r.fautesEq[q-1]||0)+"</span></div>";
  o.innerHTML=h;
}

// ── Stats équipe (C) ─────────────────────────────────────────────
var msEqFiltre={equipe:"", periode:"saison"};
function statsEquipeFermer(){ var o=document.getElementById("ms-equipe"); if(o) o.remove(); }
function statsEquipeOuvrir(){
  if(typeof isStaffUser==="function" && !isStaffUser()){ askAlert("Réservé aux coachs et au dirigeant."); return; }
  if(typeof msPremium==="function" && !msPremium()){ askAlert("Les stats de l'équipe font partie du Pack Premium."); return; }
  statsEquipeDessiner();
}
function statsEquipeDessiner(){
  var o=document.getElementById("ms-equipe");
  if(!o){ o=document.createElement("div"); o.id="ms-equipe"; document.body.appendChild(o); }
  var tous=statsMatchsSaison();
  var equipes=[]; tous.forEach(function(m){ if(m.equipe && equipes.indexOf(m.equipe)<0) equipes.push(m.equipe); });
  if(msEqFiltre.equipe && equipes.indexOf(msEqFiltre.equipe)<0) msEqFiltre.equipe="";
  var liste=tous.filter(function(m){return !msEqFiltre.equipe || m.equipe===msEqFiltre.equipe;});
  liste.sort(function(a,b){return String(a.date||"")>String(b.date||"")?1:-1;});
  if(msEqFiltre.periode==="3") liste=liste.slice(-3);
  var r=msEquipeSaison(liste);
  var saison=typeof getCurrentSeason==="function"?getCurrentSeason():"";
  function virg(v){ return v==null?"–":String(v).replace(".",","); }
  var h="<div class=\"ms-hdr\"><button class=\"ms-back\" onclick=\"statsEquipeFermer()\" aria-label=\"Retour\">‹</button>"
    +"<div class=\"ms-t\"><b>"+authEsc(msEqFiltre.equipe||"Statistiques de l'équipe")+"</b><span>Saison "+authEsc(saison)+" · "+r.n+" match"+(r.n>1?"s":"")+"</span></div></div>"
    +"<div class=\"ms-body ms-eq\">";
  h+="<div class=\"eq-chips\">"
    +[["saison","Saison"],["3","3 derniers"]].map(function(p){return "<button class=\"ms-btn mini"+(msEqFiltre.periode===p[0]?" plein":"")+"\" onclick=\"msEqFiltre.periode='"+p[0]+"';statsEquipeDessiner()\">"+p[1]+"</button>";}).join("")
    +(equipes.length>1?"<button class=\"ms-btn mini"+(!msEqFiltre.equipe?" plein":"")+"\" onclick=\"msEqFiltre.equipe='';statsEquipeDessiner()\">Toutes</button>"+equipes.map(function(e){return "<button class=\"ms-btn mini"+(msEqFiltre.equipe===e?" plein":"")+"\" data-eq=\""+authEsc(e)+"\" onclick=\"msEqFiltre.equipe=this.dataset.eq;statsEquipeDessiner()\">"+authEsc(e)+"</button>";}).join(""):"")
    +"</div>";
  if(!r.n){
    h+="<div class=\"ms-card\" style=\"font-size:13px;line-height:1.5\">Aucun match terminé pour l'instant. Les statistiques de l'équipe apparaîtront après la première feuille de match.</div></div>";
    o.innerHTML=h; return;
  }
  var ad=r.adresse, ratio=ad.ratio;
  var kpi=[["Bilan",r.v+" V · "+r.d+" D"+(r.nuls?" · "+r.nuls+" N":""),(r.suite.n>1?r.suite.n+(r.suite.type==="V"?" victoires":r.suite.type==="D"?" défaites":" nuls")+" de suite":"")],
           ["Points marqués / match",virg(r.pour),""],["Points encaissés / match",virg(r.contre),""],
           ["Tirs",ad.tirs==null?"–":ad.tirs+" %",""],["Passes / pertes",virg(ratio),""]];
  h+="<div class=\"eq-kpi\">"+kpi.map(function(k){return "<div class=\"ms-k\"><div class=\"ms-lbl\">"+k[0]+"</div><div class=\"v\">"+k[1]+"</div><div class=\"t"+(k[0]==="Bilan"&&r.suite.type==="D"?" neg":"")+"\">"+k[2]+"</div></div>";}).join("")+"</div>";
  function lead(titre,cle){
    var a=r.leaders[cle], mx=a.length?a[0][cle]:1;
    return "<div class=\"ms-card\"><div class=\"ms-h\" style=\"margin:0 0 8px\">"+titre+"</div>"+a.map(function(j,i){
      return "<div class=\"eq-l\"><i>"+(i+1)+"</i><div style=\"min-width:0\"><div class=\"nom\">"+authEsc(msNomJoueur(j.id))+"</div><div class=\"ms-bar\"><div style=\"width:"+Math.round((mx>0?j[cle]/mx:0)*100)+"%\"></div></div></div><b>"+virg(j[cle])+"</b></div>";}).join("")+"</div>";
  }
  h+="<div class=\"eq-lead\">"+lead("Points / match","pts")+lead("Rebonds / match","reb")+lead("Passes / match","pd")+lead("Évaluation / match","eval")+"</div>";
  function spark(v){
    if(!v.length) return "";
    var w=110,hh=24,mn=Math.min.apply(null,v),mx=Math.max.apply(null,v),rg=(mx-mn)||1;
    var pts=v.map(function(y,i){return ((v.length>1?i*(w-8)/(v.length-1):(w-8)/2)+4).toFixed(1)+","+(hh-4-(y-mn)/rg*(hh-8)).toFixed(1);});
    var l=pts[pts.length-1].split(",");
    return "<svg width=\""+w+"\" height=\""+hh+"\" viewBox=\"0 0 "+w+" "+hh+"\" aria-hidden=\"true\"><polyline points=\""+pts.join(" ")+"\" fill=\"none\" stroke=\"var(--dkg)\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\""+l[0]+"\" cy=\""+l[1]+"\" r=\"3.5\" fill=\"var(--live,#E8670A)\"/></svg>";
  }
  h+="<div class=\"ms-card eq-tab\"><table class=\"ms-tab\"><tr><th>Joueur</th><th>Matchs</th><th>MIN</th><th>PTS</th><th>REB</th><th>PD</th><th>Tirs</th><th>3 pts</th><th>LF</th><th>Éval</th><th class=\"eq-sp\">Évaluation par match</th></tr>"
    +r.joueurs.map(function(j){
      var a=j.adresse;
      return "<tr class=\"clic\" onclick=\"statsFicheJoueur('"+authEsc(String(j.id))+"')\"><td>"+authEsc(msNomJoueur(j.id))+"</td><td>"+j.n+"</td><td>"+virg(j.min)+"</td><td>"+virg(j.pts)+"</td><td>"+virg(j.reb)+"</td><td>"+virg(j.pd)+"</td><td>"+(a.tirs==null?"–":a.tirs+" %")+"</td><td>"+(a.p3==null?"–":a.p3+" %")+"</td><td>"+(a.lf==null?"–":a.lf+" %")+"</td><td class=\"ms-ev\">"+virg(j.eval)+"</td><td class=\"eq-sp\">"+spark(j.evals)+"</td></tr>";}).join("")
    +"</table></div>";
  h+="<div style=\"font-size:12px;color:var(--mut)\">Touche un joueur pour ouvrir sa fiche. Les joueurs et les parents ne verront que leurs propres chiffres, jamais ce tableau.</div></div>";
  o.innerHTML=h;
}
