/* ===== 17-poles.js — Pages generiques des poles du club ===== */
// ═══ POLES GENERIQUES ════════════════════════════════════════════
var currentPoleId=null;
var currentPoleType=null;

var CATS_OPT=TEAM_CATS.slice(); // U6 → Senior, Loisir, 3x3 (défini dans 11-admin.js)
var POLE_FORMS={
  "session":    {title:"Nouvelle session",fields:[{id:"nom",label:"Nom de la session",ph:""},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"date",label:"Date",type:"date"},{id:"heure",label:"Heure",ph:""},{id:"lieu",label:"Lieu",ph:""},{id:"notes",label:"Notes",ph:""}]},
  "participant":{title:"Nouveau participant",fields:[{id:"nom",label:"Nom complet",ph:"Prénom Nom"},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"contact",label:"Contact",ph:"0612345678"}]},
  "equipe":     {title:"Nouvelle équipe",fields:[{id:"nom",label:"Nom de l'équipe",ph:""},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"coach",label:"Coach",ph:"Prénom Nom"},{id:"notes",label:"Notes",ph:""}]},
  "match":      {title:"Nouveau match",fields:[{id:"date",label:"Date",type:"date"},{id:"heure",label:"Heure",ph:""},{id:"adversaire",label:"Adversaire",ph:""},{id:"lieu",label:"Lieu",type:"select-lieu"},{id:"equipe",label:"Notre équipe",type:"select-team"},{id:"cat",label:"Catégorie",type:"select-cat"}]},
  "joueur":     {title:"Nouveau joueur",fields:[{id:"cat",label:"Catégorie",type:"select-cat"},{id:"nom",label:"Joueur (liste des inscrits)",type:"select-player"},{id:"poste",label:"Poste",ph:""},{id:"num",label:"Numéro de maillot",ph:""},{id:"equipe",label:"Équipe",type:"select-team"}]},
  "tournoi":    {title:"Nouveau tournoi",fields:[{id:"nom",label:"Nom du tournoi",ph:""},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"date",label:"Date",type:"date"},{id:"lieu",label:"Lieu",ph:""},{id:"format",label:"Format",ph:""},{id:"notes",label:"Notes",ph:""}]},
  "evenement":  {title:"Nouvel événement",fields:[{id:"nom",label:"Nom",ph:""},{id:"date_debut",label:"Date de début",type:"date"},{id:"date_fin",label:"Date de fin",type:"date"},{id:"lieu",label:"Lieu",ph:""},{id:"desc",label:"Description",ph:""},{id:"notes",label:"Notes",ph:""}]},
  "groupe":     {title:"Nouveau groupe",fields:[{id:"nom",label:"Nom du groupe",ph:""},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"niveau",label:"Niveau",ph:""},{id:"jour",label:"Jour",ph:""},{id:"heure",label:"Heure",ph:""},{id:"lieu",label:"Lieu",ph:""}]},
  "seance":     {title:"Nouvelle séance",fields:[{id:"date",label:"Date",type:"date"},{id:"heure",label:"Heure",ph:""},{id:"groupe",label:"Groupe",ph:"Nom du groupe"},{id:"cat",label:"Catégorie",type:"select-cat"},{id:"theme",label:"Thème",ph:""}]},
};

function getPoleData(poleId){
  try{return JSON.parse(localStorage.getItem("asmb_pole_"+poleId)||"[]");}catch(e){return [];}
}
function savePoleData(poleId,data){
  localStorage.setItem("asmb_pole_"+poleId,JSON.stringify(data));
}

function openPoleScreen(poleId){
  if(typeof isPoleActive==="function" && !isPoleActive(poleId)) return;
  currentPoleId=poleId;
  stack.push("pole-"+poleId);
  buildPoleScreen(poleId);
  showScr("pole-"+poleId);
}

function buildPoleScreen(poleId){
  if(poleId==="evenement"){var rel=document.getElementById("real-events-list");if(rel)buildRealEventsList();}
  var data=getPoleData(poleId);
  var pole=POLES.find(function(p){return p.id===poleId;});
  var countEl=document.getElementById(poleId+"-count");
  var listEl=document.getElementById(poleId+"-list");
  // Coachs du pôle (choisis par le dirigeant) et joueurs (choisis par les coachs) : js/17b-poles-joueurs.js
  if(listEl&&typeof poleRendreEquipe==="function"){
    // Événements : le bloc coachs passe au-dessus de la liste du calendrier.
    var rel=poleId==="evenement"&&document.getElementById("real-events-list");
    poleRendreEquipe(poleId,(rel&&rel.previousElementSibling)||listEl);
  }
  if(countEl)countEl.textContent=data.length+" élément"+(data.length>1?"s":"");
  if(!listEl)return;
  // About section
  var aboutHtml="";
  if(pole&&pole.about){
    var col=pole.color||"var(--dkg)";
    var itemsHtml=(pole.items||[]).map(function(it){return '<div style="font-size:11px;color:var(--txt2);padding:3px 0 3px 14px;position:relative"><span style="position:absolute;left:0;color:'+col+'">→</span>'+it+'</div>';}).join("");
    aboutHtml='<div style="margin:8px 12px 12px;background:var(--card);border:1px solid var(--bdr);border-left:4px solid '+col+';border-radius:var(--rs);padding:14px;box-shadow:0 2px 8px var(--shadow)"><div style="font-size:12px;color:var(--txt2);line-height:1.55;margin-bottom:10px">'+pole.about+'</div>'+itemsHtml+'</div>';
  }
  listEl.innerHTML=aboutHtml;
  if(!data.length){
    listEl.innerHTML+='<div class="empty-state" style="padding-top:16px"><div class="empty-state-icon">'+getPoleIcon(poleId)+'</div><div style="font-size:13px;font-weight:600">Aucun élément ajouté</div><div style="font-size:11px;margin-top:4px">Utilisez les boutons ci-dessus pour ajouter</div></div>';
    return;
  }
  listEl.innerHTML="";

  function renderItemCard(item,indent){
    var div=document.createElement("div");
    div.style.cssText="margin:0 12px 8px 0 12px;margin-left:"+(12+indent)+"px;background:var(--card);border:1px solid var(--bdr);border-radius:var(--rs);padding:13px 14px;box-shadow:0 2px 8px var(--shadow);display:flex;align-items:flex-start;justify-content:space-between"+(indent?";border-left:3px solid var(--dkg)":"");
    var mainInfo=item.nom||item.adversaire||item.titre||"Sans nom";
    var dateRange=item.date_debut?(item.date_fin&&item.date_fin!==item.date_debut?(item.date_debut+" → "+item.date_fin):item.date_debut):item.date;
    var subInfo=[item.cat,dateRange,item.heure,item.lieu,item.groupe].filter(Boolean).join(" · ");
    var subHtml=subInfo?"<div style=\"font-size:11px;color:var(--mut)\">"+subInfo+"</div>":"";
 // Ancien « tournoi » noté à la main : on le transforme en vrai tournoi (équipes, planning, jour J).
    var orgBtn=(item.type==="tournoi"&&typeof trnOuvrir==="function")?"<button onclick=\"poleTournoiVersEvenement('"+poleId+"','"+item.id+"')\" style=\"padding:5px 10px;border-radius:var(--rx);background:#b7791f;color:#fff;font-size:10px;font-weight:700;border:none;cursor:pointer;flex-shrink:0;margin-left:8px\">🏆 Organiser</button>":"";
    var delBtn="<button onclick=\"deletePoleItem('"+poleId+"','"+item.id+"')\" style=\"padding:5px 10px;border-radius:var(--rx);background:rgba(192,57,43,.1);color:var(--red);font-size:10px;font-weight:600;border:none;cursor:pointer;flex-shrink:0;margin-left:8px\">✕</button>";
    div.innerHTML="<div style=\"flex:1;min-width:0\"><div style=\"font-size:13px;font-weight:700;color:var(--txt);margin-bottom:3px\">"+(indent?" ":"")+mainInfo+"</div>"+subHtml+"</div>"+orgBtn+delBtn;
    listEl.appendChild(div);
  }

  var equipes=data.filter(function(d){return d.type==="equipe";});
  var joueurs=data.filter(function(d){return d.type==="joueur";});
  var matchs=data.filter(function(d){return d.type==="match";});
  var others=data.filter(function(d){return d.type!=="equipe"&&d.type!=="joueur"&&d.type!=="match";});

  if(equipes.length||joueurs.length){
    if(equipes.length)listEl.innerHTML+='<div class="sec" style="padding-left:0">Équipes</div>';
    equipes.forEach(function(eq){
      renderItemCard(eq,0);
      var assigned=joueurs.filter(function(j){return j.equipe===eq.nom;});
      assigned.forEach(function(j){renderItemCard(j,0);});
    });
    var unassigned=joueurs.filter(function(j){return !equipes.some(function(eq){return eq.nom===j.equipe;});});
    if(unassigned.length){
      listEl.innerHTML+='<div class="sec" style="padding-left:0">Joueurs sans équipe assignée</div>';
      unassigned.forEach(function(j){renderItemCard(j,0);});
    }
  }

  if(matchs.length){
    listEl.innerHTML+='<div class="sec" style="padding-left:0">Matchs</div>';
    matchs.forEach(function(m){renderItemCard(m,0);});
  }

  others.forEach(function(o){renderItemCard(o,0);});
}

function getPoleIcon(id){
  var icons={"elite":"","competition":"","3x3":"","evenement":"","basketpourtous":"","basketsante":""};
  return icons[id]||"";
}

function showAddPoleItem(poleId,type){
  currentPoleId=poleId;currentPoleType=type;
  var form=POLE_FORMS[type];if(!form)return;
  document.getElementById("modal-pole-title").textContent=form.title;
  var html="";
  form.fields.forEach(function(f){
    html+='<div class="form-group"><label class="form-label">'+f.label+'</label>';
    if(f.type==="date"){
      html+='<input class="form-input" id="pf-'+f.id+'" type="date">';
    } else if(f.type==="select-cat"){
      var opts=CATS_OPT.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join("");
      var catOnchange=(currentPoleType==="joueur")?' onchange="refreshPlayerSelect(this.value)"':"";
      html+='<select class="form-select" id="pf-'+f.id+'"'+catOnchange+'><option value="">Sélectionnez une catégorie...</option>'+opts+'</select>';
    } else if(f.type==="select-team"){
      var teamOpts=getTeams().map(function(t){return '<option value="'+t.name+'">'+t.name+' ('+t.cat+')</option>';}).join("");
      if(!getTeams().length){
        html+='<select class="form-select" id="pf-'+f.id+'"><option value="">Aucune équipe créée - Admin > Équipes</option></select>';
      } else {
        html+='<select class="form-select" id="pf-'+f.id+'"><option value="">Sélectionnez une équipe...</option>'+teamOpts+'</select>';
      }
    } else if(f.type==="select-lieu"){
      html+='<select class="form-select" id="pf-'+f.id+'"><option value="">Sélectionnez...</option><option value="Domicile">Domicile</option><option value="Extérieur">Extérieur</option></select>';
    } else if(f.type==="select-player"){
      html+='<select class="form-select" id="pf-'+f.id+'" onchange="prefillFromPlayer(this.value)"><option value="">D\'abord choisir une catégorie...</option></select>';
    } else {
      html+='<input class="form-input" id="pf-'+f.id+'" placeholder="'+(f.ph||'')+'">';
    }
    html+='</div>';
  });
  document.getElementById("modal-pole-form").innerHTML=html;
  document.getElementById("modal-pole-item").style.display="flex";
}

function refreshPlayerSelect(cat){
  var sel=document.getElementById("pf-nom");
  if(!sel)return;
  if(!cat){sel.innerHTML='<option value="">D\'abord choisir une catégorie...</option>';return;}
  var players=getPlayers().filter(function(p){return p.cat===cat;});
  if(!players.length){
    sel.innerHTML='<option value="">Aucun joueur inscrit dans cette catégorie</option>';
    return;
  }
  var opts=players.map(function(pl){
    var dot=pl.genre==="M"?"":(pl.genre==="F"?"":"");
    return '<option value="'+pl.prenom+' '+pl.nom+'">'+dot+' '+pl.prenom+' '+pl.nom+'</option>';
  }).join("");
  sel.innerHTML='<option value="">Sélectionnez un joueur...</option>'+opts;
}

function prefillFromPlayer(fullName){
  if(!fullName)return;
  var player=getPlayers().find(function(p){return (p.prenom+" "+p.nom)===fullName;});
  if(!player)return;
  var catEl=document.getElementById("pf-cat");
  if(catEl&&player.cat)catEl.value=player.cat;
  var posteEl=document.getElementById("pf-poste");
  if(posteEl&&player.poste&&player.poste!=="---")posteEl.value=player.poste;
  var numEl=document.getElementById("pf-num");
  if(numEl&&player.maillot)numEl.value="#"+player.maillot;
}

function savePoleItem(){
  var form=POLE_FORMS[currentPoleType];if(!form)return;
  var item={id:Date.now().toString(),type:currentPoleType};
  form.fields.forEach(function(f){
    var el=document.getElementById("pf-"+f.id);
    if(el)item[f.id]=el.value.trim();
  });
  // Check at least one field filled
  var filled=form.fields.some(function(f){return item[f.id];});
  if(!filled){askAlert("Remplissez au moins un champ");return;}
  var data=getPoleData(currentPoleId);
  data.push(item);
  savePoleData(currentPoleId,data);

  // Lien automatique : un match cree dans un pole cree aussi l'événement dans le Planning
  if(currentPoleType==="match"&&item.date){
    var events=getEvents();
    events.push({
      id:"planning-"+item.id,
      titre:(item.equipe?item.equipe+" ":"")+"vs "+(item.adversaire||"Adversaire"),
      type:"match",date:item.date,heure:item.heure||"",lieu:item.lieu||"",
      equipe:item.equipe||item.cat||"",
      presences:{}
    });
    saveEvents(events);
  }

  closeModal("modal-pole-item");
  buildPoleScreen(currentPoleId);
}

function deletePoleItem(poleId,id){
  askConfirm("Supprimer cet élément ?", {danger:true, confirmText:"Supprimer"}).then(function(ok){
    if(!ok)return;
    var data=getPoleData(poleId).filter(function(d){return d.id!==id;});
    savePoleData(poleId,data);
    var events=getEvents().filter(function(e){return e.id!=="planning-"+id;});
    saveEvents(events);
    buildPoleScreen(poleId);
  });
}

// Ancien « tournoi » noté dans un pôle → événement Tournoi du calendrier, ouvert dans l'outil Tournoi.
function poleTournoiVersEvenement(poleId,id){
  var item=getPoleData(poleId).filter(function(d){ return d.id===id; })[0]; if(!item) return;
  if(!item.date) return askAlert("Ajoutez d'abord une date : supprimez cette note et créez le tournoi avec « + Tournoi ».");
  var ev={id:Date.now().toString(),titre:item.nom||"Tournoi",type:"tournoi",date:item.date,dateFin:"",heure:"",lieu:item.lieu||"",adresse:"",equipe:"",
    participantsClub:[],participantsExternes:[],presences:{},evaluationEnabled:false,canalId:null,canalAutoTeamIds:[],canalAccessGranted:false,canalAccessRevoked:false,
    statut:"validee",creePar:(window.ASMB_USER&&window.ASMB_USER.email)||"",creeParRole:"dirigeant"};
  var events=getEvents(); events.push(ev); saveEvents(events);
  savePoleData(poleId,getPoleData(poleId).filter(function(d){ return d.id!==id; }));
  buildPoleScreen(poleId);
  if(typeof buildPlanning==="function") try{ buildPlanning(); }catch(e){}
  trnOuvrir(ev.id);
}
