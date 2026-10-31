/* ===== 12b-planning-alertes.js — Conflits de salle et bénévoles manquants =====
   1. Conflit de salle : deux rendez-vous non annulés le même jour, dans le même lieu,
      dont les horaires se chevauchent. Heure lue dans « 17h30 - 19h00 », « 17:30-19:00 »
      ou « 17h30 » (sans fin : 1 h 30 pour un entraînement, 2 h sinon). Lieux génériques
      (vide, « Extérieur ») ignorés. Badge ⚠️ sur la carte du planning, question avant
      d'enregistrer un nouvel événement, message après un créneau récurrent.
   2. Bénévoles à J-7 : dans les 7 jours, match à domicile sans « Table de marque » ou
      « Chronomètre », tournoi ou soirée sans aucun bénévole.
   Les deux remontent dans « À faire » (accueil ordinateur) et dans « À surveiller »
   (accueil téléphone) du dirigeant. Rien n'est bloquant. */

function plMinutes(h,m){ return parseInt(h,10)*60+(parseInt(m||"0",10)||0); }
function plHoraire(e){
  var t=String(e&&e.heure||"").toLowerCase(), r=/(\d{1,2})\s*[h:]\s*(\d{2})?/g, m, l=[];
  while((m=r.exec(t))&&l.length<2){ var v=plMinutes(m[1],m[2]); if(v<24*60) l.push(v); }
  if(!l.length) return null;
  var fin=l[1]>l[0]?l[1]:l[0]+(e.type==="entrainement"?90:120);
  return [l[0],fin];
}
function plLieu(e){
  var s=String(e&&e.lieu||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g," ").trim();
  if(!s||/exterieur|deplacement|a definir|visio/.test(s)) return "";
  return s;
}
function plChevauche(a,b){
  if(!a||!b||a.id===b.id||a.cancelled||b.cancelled||a.statut==="refusee"||b.statut==="refusee") return false;
  if(a.date!==b.date) return false;
  var la=plLieu(a); if(!la||la!==plLieu(b)) return false;
  var ha=plHoraire(a), hb=plHoraire(b); if(!ha||!hb) return false;
  return ha[0]<hb[1]&&hb[0]<ha[1];
}
// Rendez-vous qui occupent déjà la salle de e.
function plConflitsDe(e,events){ return (events||getEvents()).filter(function(x){ return plChevauche(e,x); }); }
function plBadge(e,events){
  var c=plConflitsDe(e,events); if(!c.length) return "";
  var x=c[0];
  return '<div style="margin-top:6px;font-size:11px;font-weight:700;color:#b45309;background:rgba(180,83,9,.1);border-radius:8px;padding:5px 8px;display:inline-block">⚠️ Salle déjà occupée : '+authEsc((x.titre||eventTypeLabel(x.type))+(x.heure?" ("+x.heure+")":""))+(c.length>1?" + "+(c.length-1):"")+'</div>';
}
// Conflits à venir (chaque paire une seule fois).
function plConflitsAVenir(jours){
  var ev=getEvents(), auj=new Date().toISOString().slice(0,10), max=new Date(Date.now()+(jours||14)*86400000).toISOString().slice(0,10);
  var l=ev.filter(function(e){ return e.date>=auj&&e.date<=max&&!e.cancelled; }), out=[];
  l.forEach(function(a,i){ l.slice(i+1).forEach(function(b){ if(plChevauche(a,b)) out.push([a,b]); }); });
  return out;
}

// Bénévoles manquants sur un rendez-vous (null = rien à signaler).
function plBenManquants(e){
  if(!e||e.cancelled) return null;
  var l=(typeof benListe==="function")?benListe(e):(e.benevoles||[]);
  var postes=l.map(function(m){ return String(m.poste||"").toLowerCase(); });
  if(e.type==="match"){
    if(/exterieur|extérieur|déplacement|deplacement/i.test(e.lieu||"")) return null;
    var manque=[]; if(postes.indexOf("table de marque")<0) manque.push("table de marque"); if(postes.indexOf("chronomètre")<0) manque.push("chronomètre");
    return manque.length?manque:null;
  }
  if(["tournoi","soiree"].indexOf(e.type)>=0) return l.length?null:["aucun bénévole"];
  return null;
}
function plBenAlertes(){
  var auj=new Date().toISOString().slice(0,10), j7=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
  return getEvents().filter(function(e){ return e.date>=auj&&e.date<=j7&&(!e.statut||e.statut==="validee"); })
    .map(function(e){ return {e:e,manque:plBenManquants(e)}; }).filter(function(x){ return x.manque; })
    .sort(function(a,b){ return a.e.date>b.e.date?1:-1; });
}
function plJourCourt(d){ try{ return new Date(d+"T12:00:00").toLocaleDateString("fr-FR",{weekday:"short",day:"numeric",month:"short"}); }catch(x){ return d; } }

// Lignes « À faire » : [couleur, texte, bouton, action]
function plAlertesAFaire(){
  var t=[];
  plBenAlertes().slice(0,4).forEach(function(x){
    var e=x.e;
    t.push(["#b45309","Bénévoles "+plJourCourt(e.date)+" · "+(e.titre||eventTypeLabel(e.type))+" : "+x.manque.join(", "),"Placer","benOuvrir('"+authEsc(e.id)+"')"]);
  });
  var c=plConflitsAVenir(14);
  if(c.length){
    var a=c[0][0], b=c[0][1];
    t.push(["#C0392B",(c.length>1?c.length+" conflits de salle, dont ":"Conflit de salle ")+plJourCourt(a.date)+" : "+(a.titre||"")+" / "+(b.titre||""),"Voir","plOuvrirPlanning()"]);
  }
  return t;
}
function plOuvrirPlanning(){
  if(typeof gmDeskOn==="function"&&gmDeskOn()&&typeof gmDeskOuvrir==="function"){ gmDeskOuvrir("planning"); return; }
  if(typeof stack!=="undefined") stack=["portal"];
  openAdminModule("planning");
}
// Accueil téléphone du dirigeant : carte « À surveiller ».
function plCarteAccueil(){
  var l=plAlertesAFaire(); if(!l.length) return "";
  return '<div style="margin-top:10px;background:var(--card);border:1px solid var(--bdr);border-radius:18px;padding:12px 14px;box-shadow:0 2px 8px var(--shadow)">'+
    '<div style="font-size:10px;font-weight:800;color:var(--mut);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">À surveiller</div>'+
    l.map(function(x){
      return '<div style="display:flex;align-items:center;gap:10px;padding:7px 0;border-top:1px solid var(--bdr)"><span style="width:8px;height:8px;border-radius:50%;flex:none;background:'+x[0]+'"></span>'+
        '<span style="flex:1;min-width:0;font-size:12.5px;color:var(--txt)">'+authEsc(x[1])+'</span>'+
        '<button type="button" onclick="'+x[3]+'" style="flex:none;font-size:11px;font-weight:700;border:none;border-radius:10px;padding:6px 10px;background:var(--dkg);color:#fff;cursor:pointer">'+authEsc(x[2])+'</button></div>';
    }).join("")+'</div>';
}
