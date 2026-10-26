/* ===== 17c-convention.js — Convention de partenariat / mécénat (PDF) et formules par défaut =====
   Hors du périmètre des traductions : le PDF reste en français (décision du 25/10/2026, documents
   des clubs en France) et les formules de départ sont des données que le club modifie.
   Appelé depuis la fiche sponsor (js/17-sponsors.js). */
// Modèle de départ tant que le club n'a rien enregistré (montants à adapter).
function sponsorFormulesListe(){
  var l=getSponsorFormules();
  if(l&&l.length) return l.slice().sort(function(a,b){ return (Number(b.montant)||0)-(Number(a.montant)||0); });
  return [
    {id:"or",nom:"Or",montant:1500,contreparties:"Logo sur les maillots\nPanneau au gymnase\nPublications sur les réseaux du club\nInvitations aux matchs et à la soirée du club"},
    {id:"argent",nom:"Argent",montant:800,contreparties:"Panneau au gymnase\nPublications sur les réseaux du club\nLogo sur l'affiche des événements"},
    {id:"bronze",nom:"Bronze",montant:300,contreparties:"Logo sur le site et les réseaux du club\nRemerciements au micro lors des matchs"}
  ];
}
function sponsorConventionPdf(){
  if(typeof window.jspdf==="undefined"){ askAlert("Chargement du générateur PDF, réessayez dans quelques secondes"); return; }
  var v=function(id){ return ((document.getElementById(id)||{}).value||"").trim(); };
  var nom=v("sp-nom"); if(!nom){ askAlert("Le nom du sponsor est obligatoire"); return; }
  var mec=v("sp-type")==="mecenat", montant=parseFloat(v("sp-montant"))||0;
  var contre=v("sp-contreparties").split(/\n+/).map(function(x){ return x.trim(); }).filter(Boolean);
  var deb=v("sp-date-debut"), fin=v("sp-date-fin"), formule=v("sp-formule");
  if(formule==="__gerer") formule="";
  var fact=(typeof clubFacturationInfos==="function")?clubFacturationInfos():null;
  var cerfa=(typeof clubCerfaInfos==="function")?clubCerfaInfos():null;
  var club=clubTitle()||"L'association";
  var adrClub=(fact&&fact.adresse)||(cerfa&&cerfa.adresse)||"";
  var fr=function(d){ return d?d.split("-").reverse().join("/"):""; };
  var eur=function(n){ return n.toLocaleString("fr-FR",{minimumFractionDigits:2,maximumFractionDigits:2}).replace(/ | /g," ")+" EUR"; };
  var doc=new window.jspdf.jsPDF(), rgb=clubPdfRgb(), y=18, L=14, W=182;
  var logo=(typeof clubLogo==="function")?clubLogo():null;
  if(logo&&/^data:image\/(png|jpe?g)/.test(logo)){ try{ doc.addImage(logo,/png/.test(logo)?"PNG":"JPEG",170,10,26,26); }catch(e){} }
  doc.setFont("helvetica","bold"); doc.setFontSize(16); doc.setTextColor.apply(doc,rgb); doc.text(club,L,y); y+=9;
  doc.setFontSize(14); doc.setTextColor(25,25,25); doc.text(mec?"Convention de mécénat":"Convention de partenariat (parrainage)",L,y); y+=6;
  doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(110,110,110);
  doc.text((formule?"Formule "+formule+"  -  ":"")+"Saison / période : "+(deb||fin?(deb?"du "+fr(deb):"")+(fin?" au "+fr(fin):""):"à préciser"),L,y); y+=10;
  function para(t,opts){
    opts=opts||{};
    doc.setFont("helvetica",opts.gras?"bold":"normal"); doc.setFontSize(opts.taille||10); doc.setTextColor(30,30,30);
    doc.splitTextToSize(t,W-(opts.retrait||0)).forEach(function(l){ if(y>278){ doc.addPage(); y=20; } doc.text(l,L+(opts.retrait||0),y); y+=5; });
  }
  function article(titre){ y+=3; if(y>268){ doc.addPage(); y=20; } doc.setFont("helvetica","bold"); doc.setFontSize(10.5); doc.setTextColor.apply(doc,rgb); doc.text(titre,L,y); y+=6; }
  para("Entre les soussignés :",{gras:true});
  para(club+(adrClub?", "+adrClub:"")+(fact&&fact.siret?", SIRET "+fact.siret:"")+(cerfa&&cerfa.rna?", RNA "+cerfa.rna:"")+", représentée par son président ou sa présidente, ci-après « l'association »,");
  para("et "+nom+(v("sp-contact-nom")?", représentée par "+v("sp-contact-nom"):"")+", ci-après « "+(mec?"le mécène":"le partenaire")+" ».");
  article("Article 1 - Objet");
  para(mec
    ? "Le mécène apporte un soutien financier à l'association pour l'aider à mener ses activités sportives, sans attendre de contrepartie équivalente."
    : "Le partenaire apporte un soutien financier à l'association. En échange, l'association assure la promotion de son image selon les contreparties décrites à l'article 3.");
  article("Article 2 - Durée");
  para(deb||fin ? "La convention prend effet "+(deb?"le "+fr(deb):"à sa signature")+" et se termine "+(fin?"le "+fr(fin):"à la fin de la saison sportive")+"." : "La convention prend effet à sa signature et se termine à la fin de la saison sportive en cours.");
  article("Article 3 - "+(mec?"Montant du don":"Engagements des parties"));
  para((mec?"Le mécène verse à l'association la somme de ":"Le partenaire verse à l'association la somme de ")+(montant?eur(montant):"................ EUR")+(mec?".":", selon les modalités convenues entre les parties."));
  if(!mec){
    para("En contrepartie, l'association s'engage à :");
    (contre.length?contre:["................................................................"]).forEach(function(c){ para("-  "+c,{retrait:4}); });
  } else if(contre.length){
    para("Mentions de soutien prévues (de valeur nettement inférieure au don) :");
    contre.forEach(function(c){ para("-  "+c,{retrait:4}); });
  }
  article("Article 4 - "+(mec?"Reçu fiscal":"Facturation"));
  para(mec
    ? "Après encaissement, l'association remet au mécène un reçu fiscal (CERFA n° 11580). Le don peut ouvrir droit à la réduction d'impôt prévue à l'article 238 bis du Code général des impôts (60 % du don, dans les limites fixées par la loi), sous réserve que l'association remplisse les conditions d'intérêt général."
    : "L'association adresse au partenaire une facture du montant prévu"+(fact&&fact.tvaActive?" (TVA en sus au taux en vigueur).":" (TVA non applicable, article 293 B du CGI, sauf mention contraire sur la facture)."));
  article("Article 5 - Image et logos");
  para("Chaque partie autorise l'autre à utiliser son nom et son logo uniquement pour l'exécution de la présente convention et pendant sa durée.");
  article("Article 6 - Résiliation");
  para("En cas de manquement de l'une des parties à ses engagements, l'autre partie peut résilier la convention par écrit, après une mise en demeure restée sans effet pendant 15 jours.");
  y+=6; if(y>245){ doc.addPage(); y=30; }
  para("Fait en deux exemplaires, à ........................................., le ....../....../..........");
  y+=8;
  doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(30,30,30);
  doc.text("Pour l'association",L+6,y); doc.text(mec?"Pour le mécène":"Pour le partenaire",L+110,y); y+=5;
  doc.setFont("helvetica","normal"); doc.setFontSize(8.5); doc.setTextColor(110,110,110);
  doc.text("Nom, qualité, signature",L+6,y); doc.text("Nom, qualité, signature, cachet",L+110,y);
  doc.setFontSize(7.5); doc.setTextColor(140,140,140);
  doc.text("Modèle indicatif généré par General Manager : à relire et adapter par le club avant signature.",L,290);
  var slug=String(nom).normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^A-Za-z0-9]+/g,"_").slice(0,40);
  doc.save(clubSlug()+"_convention_"+slug+".pdf");
}
