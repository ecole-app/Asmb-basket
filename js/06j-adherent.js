// ── Fiche adhérent remplie par le dirigeant lui-même ─────────────────────────
// Alternative au lien envoyé à la famille (« + Nouvelle fiche » › « Je remplis la fiche moi-même »).
// L'adhérent peut n'être que bénévole, coach ou « autre » : pas de catégorie ni de limite de licences ;
// un bénévole reçoit aussitôt son pass (licPassBenevole).
function adhOuvrir(){
  var s=gmSheet("Nouvelle fiche adhérent");
  var champ=function(id,label,type,ph){
    return '<div class="form-group"><label class="form-label">'+label+'</label><input class="form-input" id="'+id+'" type="'+(type||"text")+'"'+(ph?' placeholder="'+ph+'"':'')+'></div>';
  };
  var roles=["joueur","benevole","coach","autre"].map(function(k){ return '<option value="'+k+'">'+authEsc(LIC_ROLES[k])+'</option>'; }).join("");
  s.body.innerHTML=
    '<div class="form-group"><label class="form-label">Cette personne est</label><select class="form-select" id="adh-role">'+roles+'</select></div>'+
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">'+champ("adh-prenom","Prénom *","text")+champ("adh-nom","Nom *","text")+'</div>'+
    '<div class="form-group"><label class="form-label">Genre</label><select class="form-select" id="adh-genre"><option value="">—</option><option value="F">Féminin</option><option value="M">Masculin</option></select></div>'+
    champ("adh-naiss","Date de naissance","date")+
    champ("adh-tel","Téléphone","tel","0612345678")+
    champ("adh-mail","E-mail","email","mail@gmail.com")+
    champ("adh-adr","Adresse","text")+
    '<div id="adh-resp" style="border-top:1px solid var(--bdr);padding-top:10px;margin-top:4px"><div style="font-size:11px;font-weight:800;color:var(--mut);text-transform:uppercase;margin-bottom:6px">Responsable légal (joueur mineur)</div>'+
      champ("adh-resp-nom","Nom du responsable","text")+champ("adh-resp-tel","Téléphone du responsable","tel")+'</div>';
  var role=s.body.querySelector("#adh-role"), resp=s.body.querySelector("#adh-resp");
  role.onchange=function(){ resp.style.display=role.value==="joueur"?"block":"none"; };
  var col=document.createElement("div"); col.style.cssText="margin-top:10px";
  col.appendChild(gmBtn("Créer la fiche","primary",function(b){ adhEnregistrer(s, b); }));
  s.body.appendChild(col);
}
function adhVal(s,id){ var e=s.body.querySelector("#"+id); return e?String(e.value||"").trim():""; }
function adhEnregistrer(s, bouton){
  var role=adhVal(s,"adh-role")||"joueur", prenom=adhVal(s,"adh-prenom"), nom=adhVal(s,"adh-nom");
  if(!prenom||!nom){ askAlert("Prénom et nom obligatoires."); return; }
  if(role==="joueur" && typeof verifierLimiteLicences==="function" && !verifierLimiteLicences()){ s.modal.remove(); return; }
  var naiss=adhVal(s,"adh-naiss"), genre=adhVal(s,"adh-genre"), mail=adhVal(s,"adh-mail"), tel=adhVal(s,"adh-tel");
  if(role==="joueur" && !naiss){ askAlert("La date de naissance est nécessaire pour un joueur (elle donne sa catégorie)."); return; }
  var fiche={genre:genre, prenom:prenom, nom:nom, naissance:naiss, adresse:adhVal(s,"adh-adr"), telephone:tel, emailLic:mail,
    respNom:role==="joueur"?adhVal(s,"adh-resp-nom"):"", respTel:role==="joueur"?adhVal(s,"adh-resp-tel"):"",
    creeParClub:true, soumisLe:new Date().toLocaleDateString("fr-FR")};
  var cat=null;
  if(role==="joueur" && naiss && typeof categorieFromNaissance==="function"){
    var c=categorieFromNaissance(naiss,genre); if(c&&CATS_LIC.indexOf(c)>=0) cat=c;
  }
  var lic={id:Date.now().toString(), code:genCode(), email:mail, nomDest:(prenom+" "+nom).trim(), statut:"recue",
    createdAt:Date.now(), ouvertLe:null, fiche:fiche, categorie:cat, saison:getCurrentSeason()};
  if(role!=="joueur") lic.role=role;
  bouton.disabled=true;
  var lics=getLicences(); lics.push(lic); saveLicences(lics);
  s.modal.remove();
  if(role==="benevole" && typeof licPassBenevole==="function") licPassBenevole(lic);
  if(typeof buildLicences==="function") buildLicences();
  if(typeof buildAdminHome==="function") buildAdminHome();
  showToast("Fiche créée : "+lic.nomDest);
  if(typeof openLicenceDetail==="function") openLicenceDetail(lic.code);
}
