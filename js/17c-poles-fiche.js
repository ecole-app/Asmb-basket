/* ===== 17c-poles-fiche.js — Fiche « profil sportif » d'un joueur dans un pôle ===== */
// Ouverte depuis la liste des joueurs d'un pôle (dirigeant ou coach du pôle).
// Quatre onglets :
//  - Général   : identité sportive, équipes, assiduité, matchs, ancienneté.
//  - Paiements : licence du club (lecture) + cotisation propre au pôle
//                (montant attendu, versements ; recette en compta si l'utilisateur
//                y a accès, en arrière-plan horsPremium sinon comme ailleurs).
//  - Infos     : champs du pôle (niveau, objectif, équipe, groupe…), notes du
//                coach, contacts des responsables (appel / SMS).
//  - Réglages  : statut actif / en pause, date d'entrée, retrait du pôle.
// Tout vit dans players/{id}.poles[poleId] (fiche réservée au staff) :
// {depuis, statut, notes, cotis, versements:[{id,date,montant,mode}], ...champs}.
var POLE_FICHE_ONGLETS=[["general","Général"],["paiements","Paiements"],["infos","Infos"],["reglages","Réglages"]];
var POLE_MODES={especes:"Espèces",cheque:"Chèque",virement:"Virement",cb:"CB"};

function poleFicheJoueur(poleId,pid,apres,onglet){
  var p=getPlayers().filter(function(x){ return String(x.id)===String(pid); })[0];
  if(!p||!p.poles||!p.poles[poleId]) return;
  var col=poleDef(poleId).color||"var(--dkg)";
  var s=gmSheet(poleCourt(poleId)+" · profil");
  var tab=onglet||"general";
  var head=document.createElement("div"), bar=document.createElement("div"), body=document.createElement("div");
  bar.setAttribute("role","tablist");
  bar.style.cssText="display:flex;gap:4px;background:var(--bg);border-radius:12px;padding:4px;margin:12px 0";
  s.body.appendChild(head); s.body.appendChild(bar); s.body.appendChild(body);
  function joueur(){ return getPlayers().filter(function(x){ return String(x.id)===String(pid); })[0]; }
  function info(){ var j=joueur(); return (j&&j.poles&&j.poles[poleId])||{}; }
  // Écrit dans players (et donc Firestore) puis repeint l'onglet courant.
  function maj(fn,toast){
    var all=getPlayers(), x=all.filter(function(z){ return String(z.id)===String(pid); })[0];
    if(!x||!x.poles||!x.poles[poleId]) return false;
    x.poles=Object.assign({},x.poles); x.poles[poleId]=Object.assign({},x.poles[poleId]);
    fn(x.poles[poleId],x);
    savePlayers(all);
    if(toast) showToast(toast);
    peindre(); if(apres) apres();
    return true;
  }
  function peindreTete(){
    var j=joueur()||p, i=info();
    var ini=((j.prenom||"?").charAt(0)+(j.nom||"").charAt(0)).toUpperCase();
    var age=(typeof essaiAge==="function"&&j.naissance)?essaiAge(j.naissance):"";
    var photo=(j.photo&&j.photoAutorisee!==false&&/^data:image\/|^https:\/\//.test(j.photo))?'<img src="'+authEsc(j.photo)+'" alt="" style="width:100%;height:100%;object-fit:cover">':authEsc(ini);
    var pause=i.statut==="pause";
    head.innerHTML='<div style="display:flex;align-items:center;gap:12px">'+
      '<div style="width:58px;height:58px;border-radius:16px;overflow:hidden;flex-shrink:0;background:'+col+';color:#fff;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:900">'+photo+'</div>'+
      '<div style="flex:1;min-width:0"><div style="font-size:18px;font-weight:900;color:var(--txt);line-height:1.15">'+authEsc((j.prenom||"")+" "+(j.nom||""))+'</div>'+
      '<div style="font-size:12.5px;color:var(--txt2);margin-top:2px">'+authEsc([j.cat,age,j.poste,j.maillot?"n°"+j.maillot:""].filter(Boolean).join(" · "))+'</div>'+
      '<div style="margin-top:5px"><span style="font-size:10.5px;font-weight:800;padding:3px 9px;border-radius:20px;color:'+(pause?"#8a4500":col)+';background:color-mix(in srgb, '+(pause?"#8a4500":col)+' 13%, transparent)">'+(pause?"⏸ En pause":"● Actif")+' · '+authEsc(poleCourt(poleId))+'</span></div></div></div>';
  }
  function peindreBarre(){
    bar.innerHTML="";
    POLE_FICHE_ONGLETS.forEach(function(o){
      var b=document.createElement("button"); b.type="button"; b.setAttribute("role","tab"); b.setAttribute("aria-selected",String(o[0]===tab));
      b.textContent=o[1];
      b.style.cssText="flex:1;min-width:0;padding:9px 4px;border-radius:9px;border:none;font-size:12.5px;font-weight:800;cursor:pointer;white-space:nowrap;"+
        (o[0]===tab?"background:var(--card);color:"+col+";box-shadow:0 1px 4px var(--shadow)":"background:transparent;color:var(--mut)");
      b.addEventListener("click",function(){ tab=o[0]; peindre(); });
      bar.appendChild(b);
    });
  }
  function peindre(){
    peindreTete(); peindreBarre(); body.innerHTML="";
    var j=joueur(); if(!j||!j.poles||!j.poles[poleId]){ s.modal.remove(); return; }
    if(tab==="general") ongletGeneral(body,j);
    else if(tab==="paiements") ongletPaiements(body,j);
    else if(tab==="infos") ongletInfos(body,j);
    else ongletReglages(body,j);
  }
  function carte(titre){
    var c=document.createElement("div"); c.style.cssText="background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:12px 14px;margin-bottom:10px";
    if(titre){ var t=document.createElement("div"); t.style.cssText="font-size:10.5px;font-weight:800;letter-spacing:.8px;text-transform:uppercase;color:var(--mut);margin-bottom:8px"; t.textContent=titre; c.appendChild(t); }
    body.appendChild(c); return c;
  }
  function tuiles(c,items){
    var w=document.createElement("div"); w.style.cssText="display:grid;grid-template-columns:repeat("+items.length+",1fr);gap:8px";
    w.innerHTML=items.map(function(x){ return '<div style="background:var(--bg);border-radius:12px;padding:10px 6px;text-align:center"><div style="font-size:19px;font-weight:900;color:'+(x.c||"var(--txt)")+';font-variant-numeric:tabular-nums">'+authEsc(String(x.v))+'</div><div style="font-size:10px;font-weight:700;color:var(--mut);text-transform:uppercase;letter-spacing:.3px;margin-top:2px">'+authEsc(x.l)+'</div></div>'; }).join("");
    c.appendChild(w);
  }

  // ── Général ──
  function ongletGeneral(b,j){
    var i=j.poles[poleId], st=poleFicheStats(j);
    var c=carte("Saison");
    tuiles(c,[
      {v:st.pct===null?"—":st.pct+" %",l:"Assiduité",c:st.pct===null?null:(st.pct>=75?"var(--grn)":st.pct>=50?"#c77700":"var(--red)")},
      {v:st.entr,l:"Séances"},
      {v:st.matchs,l:"Matchs"}
    ]);
    if(st.pct!==null){ var n=document.createElement("div"); n.style.cssText="font-size:11.5px;color:var(--mut);margin-top:8px"; n.textContent=st.pres+" présence"+(st.pres>1?"s":"")+" sur "+st.total+" pointage"+(st.total>1?"s":"")+" (entraînements et matchs, 90 derniers jours)."; c.appendChild(n); }
    var c2=carte("Dans le pôle");
    var dep=i.depuis?new Date(i.depuis+"T12:00:00"):null, mois=dep?Math.max(0,Math.round((Date.now()-dep.getTime())/(30.44*86400000))):null;
    c2.innerHTML+='<div style="font-size:13.5px;color:var(--txt)">'+(dep?'Depuis le <b>'+dep.toLocaleDateString("fr-FR")+'</b>'+(mois!==null?' · '+(mois<1?"moins d'un mois":mois+" mois"):''):"Date d'entrée non renseignée")+'</div>'+
      (poleInfosTxt(poleId,i)?'<div style="font-size:12.5px;color:var(--txt2);margin-top:4px">'+authEsc(poleInfosTxt(poleId,i))+'</div>':'')+
      (poleCoachs(poleId).length?'<div style="font-size:12px;color:var(--mut);margin-top:6px">Coachs : '+authEsc(poleCoachs(poleId).map(function(x){ return x.nom; }).join(", "))+'</div>':'');
    var eqs=poleFicheEquipes(j);
    if(eqs.length){
      var c3=carte("Équipes");
      c3.innerHTML+='<div style="display:flex;flex-wrap:wrap;gap:6px">'+eqs.map(function(t){ return '<span style="font-size:12px;font-weight:700;padding:5px 10px;border-radius:20px;background:var(--bg);color:var(--txt2)">'+authEsc(t.name+(t.cat?" ("+t.cat+")":""))+'</span>'; }).join("")+'</div>';
    }
    var autres=Object.keys(j.poles).filter(function(k){ return k!==poleId&&POLES_JOUEURS[k]; });
    if(autres.length){ var o4={}; autres.forEach(function(k){ o4[k]=j.poles[k]; }); var c4=carte("Autres pôles"); c4.innerHTML+=polePastilles({poles:o4}); }
  }

  // ── Paiements ──
  function ongletPaiements(b,j){
    var i=j.poles[poleId];
    var lic=poleFicheLicence(j), c=carte("Licence du club");
    if(lic){
      var du=typeof licenceMontantDu==="function"?licenceMontantDu(lic):0, paye=typeof licenceMontantPaye==="function"?licenceMontantPaye(lic):0;
      var stp=typeof licenceStatutPaiement==="function"?licenceStatutPaiement(lic):"";
      var lib={paye:["Payée","var(--grn)"],partiel:["Partiel","#c77700"],impaye:["Impayée","var(--red)"]}[stp]||["Montant non défini","var(--mut)"];
      c.innerHTML+='<div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><div style="font-size:13.5px;color:var(--txt)">'+authEsc(lic.saison||"")+(lic.montantAttendu!=null?' · '+poleEuros(lic.montantAttendu):'')+'</div><div style="font-size:12.5px;font-weight:800;color:'+lib[1]+'">'+lib[0]+'</div></div>'+
        (lic.montantAttendu!=null?'<div style="font-size:12px;color:var(--mut);margin-top:3px">Payé '+poleEuros(paye)+(du>0?' · reste '+poleEuros(du):'')+'</div>':'');
    } else c.innerHTML+='<div style="font-size:12.5px;color:var(--mut)">Aucune licence trouvée pour ce joueur cette saison.</div>';

    var vers=(i.versements||[]).slice().sort(function(a,b2){ return String(b2.date).localeCompare(String(a.date)); });
    var tot=vers.reduce(function(t,v){ return t+(Number(v.montant)||0); },0), att=Number(i.cotis)||0;
    var c2=carte("Cotisation du pôle");
    tuiles(c2,[{v:att?poleEuros(att):"—",l:"Attendu"},{v:poleEuros(tot),l:"Versé",c:"var(--grn)"},{v:att?poleEuros(Math.max(0,att-tot)):"—",l:"Reste",c:att&&tot<att?"var(--red)":null}]);
    var rowA=document.createElement("div"); rowA.style.cssText="display:flex;gap:8px;margin-top:10px";
    rowA.appendChild(gmBtn(att?"Modifier le montant":"Définir le montant","soft",function(){
      askPrompt("Cotisation du pôle pour la saison (€)",{type:"number",defaultValue:att?String(att):"",confirmText:"Enregistrer"}).then(function(v){
        if(v===null||v===undefined) return;
        var n=Math.round((parseFloat(String(v).replace(",","."))||0)*100)/100;
        if(n<0||n>100000){ askAlert("Montant invalide."); return; }
        maj(function(o){ if(n) o.cotis=n; else delete o.cotis; },"Montant enregistré");
      });
    }));
    rowA.appendChild(gmBtn("+ Versement","primary",function(){ poleFicheVersement(poleId,j,maj); }));
    c2.appendChild(rowA);
    if(vers.length){
      var l=document.createElement("div"); l.style.marginTop="8px";
      vers.forEach(function(v){
        var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--bdr)";
        r.innerHTML='<div style="flex:1;min-width:0;font-size:13px;color:var(--txt)">'+authEsc(String(v.date||"").split("-").reverse().join("/"))+' · '+authEsc(POLE_MODES[v.mode]||v.mode||"")+'</div><div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+poleEuros(v.montant)+'</div>';
        var x=document.createElement("button"); x.type="button"; x.textContent="✕"; x.setAttribute("aria-label","Supprimer ce versement");
        x.style.cssText="width:28px;height:28px;border-radius:50%;border:none;background:var(--bdr);color:var(--mut);cursor:pointer;flex-shrink:0";
        x.addEventListener("click",function(){
          askConfirm("Supprimer ce versement de "+poleEuros(v.montant)+" ?",{danger:true,confirmText:"Supprimer"}).then(function(ok){
            if(!ok) return;
            maj(function(o){ o.versements=(o.versements||[]).filter(function(z){ return z.id!==v.id; }); },"Versement supprimé");
            poleFicheCompta(poleId,j,v,false);
          });
        });
        r.appendChild(x); l.appendChild(r);
      });
      c2.appendChild(l);
    }
    if(!poleFicheComptaOk()){ var n=document.createElement("div"); n.style.cssText="font-size:11.5px;color:var(--mut);margin-top:8px"; n.textContent="Les versements sont suivis ici ; la recette est à saisir en comptabilité par le trésorier ou le dirigeant."; c2.appendChild(n); }
  }

  // ── Infos ──
  function ongletInfos(b,j){
    var i=j.poles[poleId];
    var c=carte("Suivi du pôle");
    var w=document.createElement("div");
    w.innerHTML=poleChampsHtml(poleId,i,"pf-")+
      '<div class="form-group" style="margin-bottom:8px"><label class="form-label" for="pf-notes">Notes du coach</label><textarea class="form-input" id="pf-notes" rows="4" maxlength="800" style="resize:vertical;min-height:90px">'+authEsc(i.notes||"")+'</textarea></div>';
    c.appendChild(w);
    c.appendChild(gmBtn("Enregistrer","primary",function(){
      var notes=String((document.getElementById("pf-notes")||{}).value||"").trim().slice(0,800);
      var champs=poleLireChamps(poleId,"pf-",i);
      maj(function(o){ Object.keys(champs).forEach(function(k){ o[k]=champs[k]; }); (POLES_JOUEURS[poleId]||{champs:[]}).champs.forEach(function(f){ if(!champs[f.id]) delete o[f.id]; }); if(notes) o.notes=notes; else delete o.notes; },"Infos enregistrées");
    }));
    var contacts=poleFicheContacts(j);
    var c2=carte("Contacts");
    if(!contacts.length) c2.innerHTML+='<div style="font-size:12.5px;color:var(--mut)">Aucun numéro sur la fiche.</div>';
    contacts.forEach(function(x){
      var r=document.createElement("div"); r.style.cssText="display:flex;align-items:center;gap:8px;padding:8px 0;border-top:1px solid var(--bdr)";
      var t=document.createElement("div"); t.style.cssText="flex:1;min-width:0";
      t.innerHTML='<div style="font-size:13.5px;font-weight:800;color:var(--txt)">'+authEsc(x.nom)+'</div><div style="font-size:12px;color:var(--mut)">'+authEsc(x.role+" · "+x.tel)+'</div>';
      r.appendChild(t);
      var tel=String(x.tel).replace(/[^+0-9]/g,"");
      r.appendChild(gmBtn("Appeler","soft",function(){ window.location.href="tel:"+tel; }));
      r.appendChild(gmBtn("SMS","soft",function(){ window.location.href="sms:"+tel; }));
      c2.appendChild(r);
    });
  }

  // ── Réglages ──
  function ongletReglages(b,j){
    var i=j.poles[poleId], pause=i.statut==="pause";
    var c=carte("Statut");
    c.innerHTML+='<div style="font-size:12.5px;color:var(--txt2);line-height:1.45;margin-bottom:10px">'+(pause?"Le joueur est en pause : il reste dans le pôle, marqué « en pause » dans la liste.":"Mettre en pause (blessure, absence longue…) sans retirer le joueur du pôle.")+'</div>';
    c.appendChild(gmBtn(pause?"▶ Réactiver":"⏸ Mettre en pause","soft",function(){
      maj(function(o){ if(pause) delete o.statut; else o.statut="pause"; },pause?"Joueur réactivé":"Joueur mis en pause");
    }));
    var c2=carte("Date d'entrée dans le pôle");
    var d=document.createElement("input"); d.type="date"; d.className="form-input"; d.value=i.depuis||""; d.style.marginBottom="8px";
    c2.appendChild(d);
    c2.appendChild(gmBtn("Enregistrer la date","soft",function(){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(d.value)){ askAlert("Date invalide."); return; }
      maj(function(o){ o.depuis=d.value; },"Date enregistrée");
    }));
    var c3=carte("Retirer du pôle");
    c3.innerHTML+='<div style="font-size:12.5px;color:var(--txt2);line-height:1.45;margin-bottom:10px">Les infos, notes et versements de ce pôle seront effacés de la fiche. Le joueur reste au club.</div>';
    c3.appendChild(gmBtn("Retirer du pôle","danger",function(){
      askConfirm("Retirer "+(j.prenom||"ce joueur")+" du pôle "+poleDef(poleId).name+" ?",{danger:true,confirmText:"Retirer"}).then(function(ok){
        if(!ok) return;
        var all=getPlayers(), x=all.filter(function(z){ return String(z.id)===String(pid); })[0]; if(!x) return;
        x.poles=Object.assign({},x.poles||{}); delete x.poles[poleId];
        savePlayers(all); s.modal.remove(); showToast("Retiré du pôle"); if(apres) apres();
      });
    }));
  }
  peindre();
}

function poleEuros(n){ return (Math.round((Number(n)||0)*100)/100).toLocaleString("fr-FR",{minimumFractionDigits:(Number(n)%1)?2:0,maximumFractionDigits:2})+"\u00a0€"; }
// Assiduité sur 90 jours : pointages d'entraînements et de matchs de ce joueur.
function poleFicheStats(j){
  var lim=new Date(Date.now()-90*86400000).toISOString().slice(0,10), auj=new Date().toISOString().slice(0,10);
  var o={total:0,pres:0,entr:0,matchs:0,pct:null};
  (typeof getEvents==="function"?getEvents():[]).forEach(function(e){
    if(!e||!e.presences||e.cancelled||!e.date||e.date<lim||e.date>auj) return;
    var v=e.presences[j.id]; if(v==null) v=e.presences[String(j.id)]; if(v==null) return;
    o.total++; if(v==="present"||v==="retard"){ o.pres++; if(e.type==="match") o.matchs++; else o.entr++; }
  });
  if(o.total) o.pct=Math.round(o.pres*100/o.total);
  return o;
}
function poleFicheEquipes(j){
  return (typeof getTeams==="function"?getTeams():[]).filter(function(t){
    if(t.members&&t.members.length) return t.members.map(String).indexOf(String(j.id))>=0;
    return false;
  });
}
function poleFicheNorm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z]/g,""); }
// Licence de la saison en cours rapprochée par nom + prénom (+ naissance si connue).
function poleFicheLicence(j){
  var saison=(typeof getCurrentSeason==="function")?getCurrentSeason():"";
  var l=(typeof getLicences==="function"?getLicences():[]).filter(function(x){
    var f=x&&x.fiche; if(!f) return false;
    if(saison&&x.saison&&x.saison<saison) return false;
    return poleFicheNorm(f.nom)===poleFicheNorm(j.nom)&&poleFicheNorm(f.prenom)===poleFicheNorm(j.prenom)&&(!j.naissance||!f.naissance||f.naissance===j.naissance);
  });
  return l[0]||null;
}
function poleFicheContacts(j){
  var out=[], vus={};
  function aj(nom,role,tel){ var t=String(tel||"").replace(/\s+/g,""); if(!t||vus[t]) return; vus[t]=1; out.push({nom:nom||role,role:role,tel:tel}); }
  var lic=poleFicheLicence(j), f=(lic&&lic.fiche)||{};
  aj(f.respNom,"Responsable 1",f.respTel||j.respTel);
  aj(f.resp2Nom,"Responsable 2",f.resp2Tel||j.resp2Tel);
  aj((j.prenom||"")+" "+(j.nom||""),"Joueur",j.telEnfant||f.telephone);
  if(j.contact&&/[0-9]{6,}/.test(String(j.contact).replace(/\s+/g,""))) aj("Contact","Contact",String(j.contact).replace(/[^+0-9 ]/g,"").trim());
  return out;
}
function poleFicheComptaOk(){ return typeof evtPeutCompta==="function"&&evtPeutCompta(); }
function poleFicheVersement(poleId,j,maj){
  var s=gmSheet("Versement · "+poleCourt(poleId));
  var auj=new Date().toISOString().slice(0,10), mode="especes";
  s.body.innerHTML='<div class="form-group"><label class="form-label" for="pv-m">Montant (€)</label><input class="form-input" id="pv-m" type="number" step="0.01" inputmode="decimal"></div>'+
    '<div class="form-group"><label class="form-label" for="pv-d">Date</label><input class="form-input" id="pv-d" type="date" value="'+auj+'"></div>'+
    '<div class="form-label" style="margin-bottom:6px">Mode</div><div id="pv-modes" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>';
  var box=s.body.querySelector("#pv-modes");
  function peindre(){
    box.innerHTML="";
    Object.keys(POLE_MODES).forEach(function(k){
      var b=document.createElement("button"); b.type="button"; b.textContent=POLE_MODES[k];
      b.style.cssText="padding:8px 12px;border-radius:20px;font-size:12.5px;font-weight:800;cursor:pointer;border:1.5px solid "+(k===mode?"var(--dkg)":"var(--bdr)")+";background:"+(k===mode?"color-mix(in srgb, var(--dkg) 12%, var(--card))":"var(--card)")+";color:var(--txt)";
      b.addEventListener("click",function(){ mode=k; peindre(); });
      box.appendChild(b);
    });
  }
  peindre();
  s.body.appendChild(gmBtn("Enregistrer le versement","primary",function(){
    var m=Math.round((parseFloat(String(document.getElementById("pv-m").value).replace(",","."))||0)*100)/100;
    var d=document.getElementById("pv-d").value;
    if(!(m>0)||m>100000){ askAlert("Montant invalide."); return; }
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d)){ askAlert("Date invalide."); return; }
    var v={id:Date.now().toString(36),date:d,montant:m,mode:mode};
    if(maj(function(o){ o.versements=(o.versements||[]).concat([v]).slice(-60); },"Versement enregistré")){
      poleFicheCompta(poleId,j,v,true);
      s.modal.remove();
    }
  }));
}
// Recette en compta (même logique que les billets d'événement) : écrite si
// l'utilisateur a la compta, marquée horsPremium hors Premium.
function poleFicheCompta(poleId,j,v,ajout){
  if(!poleFicheComptaOk()) return;
  var compta=getComptabilite(), ref="Pôle "+poleId+" "+j.id+" "+v.id;
  var i=compta.findIndex(function(c){ return c.reference===ref; });
  if(!ajout){ if(i>=0){ compta.splice(i,1); saveComptabilite(compta); } return; }
  var nom=((j.prenom||"")+" "+(j.nom||"")).trim();
  var ligne={date:v.date,montant:Number(v.montant),type:"recette",categorie:"Cotisations/Licences",
    motif:"Cotisation "+poleDef(poleId).name+" · "+nom,tiers:nom,moyen:{especes:"Espèces",cheque:"Chèque",virement:"Virement",cb:"CB"}[v.mode]||"Espèces",reference:ref};
  if(typeof hasPremium==="function"&&!hasPremium()) ligne.horsPremium=true;
  if(i>=0) Object.assign(compta[i],ligne); else { ligne.id=Date.now().toString(); compta.push(ligne); }
  saveComptabilite(compta);
}
