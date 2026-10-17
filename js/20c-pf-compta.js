// ═══ Ma comptabilité (micro-entreprise de la plateforme) ═════════════
// Réservé au super admin (Plateforme › Comptabilité). Collection globale
// `pf_compta` : une ligne par facture / recette, + un document `_config` avec
// les informations de l'entreprise (nom, SIRET, adresse). Rien n'est visible
// par les clubs. Deux natures de lignes, séparées partout : « Abonnement club »
// et « Indépendant ».
// Facture PDF classique (valable jusqu'à l'obligation d'émission électronique,
// 1er septembre 2027 pour les micro-entreprises) ; le format électronique via
// une plateforme agréée viendra se brancher plus tard sur les mêmes lignes.

var PFC_SIRET_DEFAUT = "13158073000011";
var PFC_TYPES = {
  abonnement:  { lib: "Abonnement club", col: "#2F5DA8" },
  independant: { lib: "Indépendant",     col: "#0E7C7B" }
};
var PFC_MODES = { virement: "Virement", especes: "Espèces", cheque: "Chèque", cb: "Carte / en ligne", autre: "Autre" };
var PFC_PRIX_PACK = { standard: 200, premium: 300 };

// ── Calculs (sans écran, couverts par tests/metier/pf-compta.test.js) ──
function pfcArrondi(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function pfcMontantLire(v) {
  var n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", "."));
  if (!isFinite(n) || n <= 0 || n > 1000000) return null;
  return pfcArrondi(n);
}
function pfcEur(n) { return pfcArrondi(n).toFixed(2).replace(".", ",") + " €"; }
function pfcDateFr(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
}
function pfcAujourdhui() {
  var d = new Date();
  return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
}
function pfcPlusJours(iso, n) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); if (!m) return "";
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n));
  return d.getUTCFullYear() + "-" + ("0" + (d.getUTCMonth() + 1)).slice(-2) + "-" + ("0" + d.getUTCDate()).slice(-2);
}
// Trimestre civil d'une date AAAA-MM-JJ → "2026-T4"
function pfcTrimestre(iso) {
  var m = /^(\d{4})-(\d{2})/.exec(iso || ""); if (!m) return "";
  return m[1] + "-T" + (Math.floor((+m[2] - 1) / 3) + 1);
}
// Prochain numéro de facture de l'année : F-2026-0001, 0002…
function pfcNumeroSuivant(lignes, annee) {
  var pre = "F-" + annee + "-", max = 0;
  (lignes || []).forEach(function (l) {
    if (l.numero && String(l.numero).indexOf(pre) === 0) {
      var n = parseInt(String(l.numero).slice(pre.length), 10);
      if (n > max) max = n;
    }
  });
  return pre + ("000" + (max + 1)).slice(-4);
}
// Totaux sur une période [debut, fin] (AAAA-MM-JJ, bornes comprises) :
// encaissé = lignes payées dont la date d'encaissement est dans la période ;
// à encaisser = lignes non payées dont la date de facture est dans la période.
function pfcTotaux(lignes, debut, fin) {
  var r = { encaisse: { abonnement: 0, independant: 0, total: 0 }, aEncaisser: { abonnement: 0, independant: 0, total: 0 } };
  (lignes || []).forEach(function (l) {
    var t = l.type === "independant" ? "independant" : "abonnement", m = Number(l.montant) || 0;
    if (l.statut === "paye") {
      var d = l.dateEncaissement || l.date || "";
      if (d >= debut && d <= fin) { r.encaisse[t] = pfcArrondi(r.encaisse[t] + m); r.encaisse.total = pfcArrondi(r.encaisse.total + m); }
    } else {
      var d2 = l.date || "";
      if (d2 >= debut && d2 <= fin) { r.aEncaisser[t] = pfcArrondi(r.aEncaisser[t] + m); r.aEncaisser.total = pfcArrondi(r.aEncaisser.total + m); }
    }
  });
  return r;
}
function pfcBornesAnnee(annee) { return [annee + "-01-01", annee + "-12-31"]; }
function pfcBornesTrimestre(iso) {
  var m = /^(\d{4})-(\d{2})/.exec(iso), q = Math.floor((+m[2] - 1) / 3);
  var d1 = ("0" + (q * 3 + 1)).slice(-2), d2 = ("0" + (q * 3 + 3)).slice(-2);
  var fin = { "03": "31", "06": "30", "09": "30", "12": "31" }[d2];
  return [m[1] + "-" + d1 + "-01", m[1] + "-" + d2 + "-" + fin];
}
function pfcCsvCase(v) {
  var s = String(v == null ? "" : v);
  if (/^[=+\-@]/.test(s)) s = "'" + s; // pas de formule exécutée à l'ouverture dans Excel
  return /[;"\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
// Livre des recettes d'une année : seulement les sommes encaissées, par date d'encaissement.
function pfcLivreCsv(lignes, annee) {
  var b = pfcBornesAnnee(annee);
  var payees = (lignes || []).filter(function (l) {
    var d = l.dateEncaissement || l.date || "";
    return l.statut === "paye" && d >= b[0] && d <= b[1];
  }).sort(function (a, c) { return (a.dateEncaissement || a.date || "").localeCompare(c.dateEncaissement || c.date || ""); });
  var out = ["Date d'encaissement;N° facture;Client;Nature;Libellé;Mode de règlement;Montant"];
  var tot = 0;
  payees.forEach(function (l) {
    tot = pfcArrondi(tot + Number(l.montant));
    out.push([pfcDateFr(l.dateEncaissement || l.date), l.numero || "", l.clientNom || "", (PFC_TYPES[l.type] || PFC_TYPES.abonnement).lib,
      l.libelle || "", PFC_MODES[l.mode] || "", String(pfcArrondi(l.montant)).replace(".", ",")].map(pfcCsvCase).join(";"));
  });
  out.push(["", "", "", "", "", "TOTAL " + annee, String(tot).replace(".", ",")].join(";"));
  return "﻿" + out.join("\r\n");
}
// SIRET : 14 chiffres + clé de Luhn
function pfcSiretValide(s) {
  var n = String(s || "").replace(/\s/g, "");
  if (!/^\d{14}$/.test(n)) return false;
  var somme = 0;
  for (var i = 0; i < 14; i++) {
    var d = parseInt(n.charAt(13 - i), 10);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    somme += d;
  }
  return somme % 10 === 0;
}

// ── Données ──
function pfcCol() { return window.fbCollection(window.fbDb, "pf_compta"); }
function pfcChargerTout() {
  return window.fbGetDocs(pfcCol()).then(function (snap) {
    var lignes = [], cfg = {};
    snap.forEach(function (d) {
      if (d.id === "_config") cfg = d.data() || {};
      else lignes.push(Object.assign({ id: d.id }, d.data()));
    });
    lignes.sort(function (a, b) { return (b.date || "").localeCompare(a.date || "") || String(b.numero || "").localeCompare(String(a.numero || "")); });
    return { lignes: lignes, cfg: cfg };
  });
}

// ── Écran principal ──
function pfcOuvrir() {
  if (typeof isSuperAdmin !== "function" || !isSuperAdmin()) return;
  var s = gmSheet("Ma comptabilité");
  var etat = { filtre: "tous", lignes: [], cfg: {} };
  var haut = document.createElement("div"); s.body.appendChild(haut);
  var liste = document.createElement("div"); s.body.appendChild(liste);
  liste.innerHTML = '<div style="text-align:center;color:var(--mut);padding:20px;font-size:12px">Chargement…</div>';

  function rafraichir() {
    pfcChargerTout().then(function (r) { etat.lignes = r.lignes; etat.cfg = r.cfg; dessiner(); })
      .catch(function (e) { liste.innerHTML = ""; var m = document.createElement("div"); m.style.cssText = "color:var(--red);font-size:12px;padding:14px"; m.textContent = "Erreur : " + ((e && e.code) || e) + " (règles Firestore publiées ?)"; liste.appendChild(m); });
  }

  function carteTotaux(titre, bornes) {
    var t = pfcTotaux(etat.lignes, bornes[0], bornes[1]);
    var c = gmCard();
    var h = document.createElement("div"); h.style.cssText = "font-size:12px;font-weight:800;color:var(--txt);margin-bottom:6px"; h.textContent = titre; c.appendChild(h);
    function ligne(lib, col, enc, att, gras) {
      var r = document.createElement("div"); r.style.cssText = "display:flex;justify-content:space-between;gap:8px;padding:5px 0;border-top:1px solid var(--bdr);font-size:12px;" + (gras ? "font-weight:800" : "");
      var a = document.createElement("span"); a.style.color = col || "var(--txt)"; a.textContent = lib;
      var b = document.createElement("span"); b.style.cssText = "text-align:right;color:var(--txt)"; b.textContent = pfcEur(enc) + (att ? "  ·  à encaisser " + pfcEur(att) : "");
      r.appendChild(a); r.appendChild(b); c.appendChild(r);
    }
    ligne(PFC_TYPES.abonnement.lib + "s", PFC_TYPES.abonnement.col, t.encaisse.abonnement, t.aEncaisser.abonnement);
    ligne(PFC_TYPES.independant.lib + "s", PFC_TYPES.independant.col, t.encaisse.independant, t.aEncaisser.independant);
    ligne("Total encaissé", "", t.encaisse.total, t.aEncaisser.total, true);
    return c;
  }

  function dessiner() {
    haut.innerHTML = "";
    var auj = pfcAujourdhui();
    var tri = pfcBornesTrimestre(auj);
    haut.appendChild(carteTotaux("Ce trimestre (" + pfcTrimestre(auj).replace("-", " ") + ") : pour ta déclaration trimestrielle", tri));
    haut.appendChild(carteTotaux("Cette année (" + auj.slice(0, 4) + ")", pfcBornesAnnee(auj.slice(0, 4))));
    var act = gmRow(haut);
    act.appendChild(gmBtn("+ Nouvelle ligne", "primary", function () { pfcLigneForm(null, rafraichir); }));
    act.appendChild(gmBtn("Mes informations", "soft", function () { pfcInfosForm(etat.cfg, rafraichir); }));
    act.appendChild(gmBtn("Livre des recettes (CSV)", "soft", function () { pfcExporterLivre(etat.lignes, auj.slice(0, 4)); }));
    var note = document.createElement("div");
    note.style.cssText = "font-size:11px;color:var(--mut);line-height:1.45;margin:10px 0 4px";
    note.textContent = "Factures en PDF classique : valables jusqu'à l'obligation d'émission électronique (1er septembre 2027 pour les micro-entreprises). Le format électronique, via une plateforme agréée, se branchera sur ces mêmes lignes.";
    haut.appendChild(note);
    var f = document.createElement("div"); f.style.cssText = "display:flex;gap:6px;margin:12px 0 8px;flex-wrap:wrap";
    [["tous", "Toutes"], ["abonnement", "Abonnements"], ["independant", "Indépendants"]].forEach(function (o) {
      var b = gmBtn(o[1], etat.filtre === o[0] ? "primary" : "ghost", function () { etat.filtre = o[0]; dessiner(); });
      f.appendChild(b);
    });
    haut.appendChild(f);

    liste.innerHTML = "";
    var vues = etat.lignes.filter(function (l) { return etat.filtre === "tous" || (l.type === "independant" ? "independant" : "abonnement") === etat.filtre; });
    if (!vues.length) {
      var v = document.createElement("div"); v.style.cssText = "text-align:center;color:var(--mut);font-size:12px;padding:20px;line-height:1.5";
      v.textContent = etat.lignes.length ? "Aucune ligne dans ce filtre." : "Aucune ligne pour l'instant. Appuie sur « + Nouvelle ligne » ou sur « Facturer » depuis la carte d'un club.";
      liste.appendChild(v);
    }
    vues.forEach(function (l) { liste.appendChild(pfcCarteLigne(l, etat, rafraichir)); });
  }
  rafraichir();
}

function pfcCarteLigne(l, etat, rafraichir) {
  var t = PFC_TYPES[l.type] || PFC_TYPES.abonnement, paye = l.statut === "paye";
  var c = gmCard();
  var h = document.createElement("div"); h.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:flex-start";
  var g = document.createElement("div"); g.style.cssText = "min-width:0;flex:1";
  var n = document.createElement("div"); n.style.cssText = "font-size:13px;font-weight:800;color:var(--txt)"; n.textContent = l.clientNom || "(client)";
  var m = document.createElement("div"); m.style.cssText = "font-size:11px;color:var(--mut);margin-top:2px;line-height:1.4";
  var tag = document.createElement("b"); tag.style.color = t.col; tag.textContent = t.lib;
  m.appendChild(tag);
  m.appendChild(document.createTextNode(" · " + pfcDateFr(l.date) + (l.numero ? " · " + l.numero : "") + (l.libelle ? " · " + l.libelle : "")));
  g.appendChild(n); g.appendChild(m);
  var p = document.createElement("div"); p.style.cssText = "text-align:right;flex:none";
  var mo = document.createElement("div"); mo.style.cssText = "font-size:14px;font-weight:800;color:var(--txt)"; mo.textContent = pfcEur(l.montant);
  var st = document.createElement("div"); st.style.cssText = "font-size:11px;font-weight:700;margin-top:2px;color:" + (paye ? "var(--grn)" : "#E8670A");
  st.textContent = paye ? "Payé le " + pfcDateFr(l.dateEncaissement) : "À encaisser";
  p.appendChild(mo); p.appendChild(st);
  h.appendChild(g); h.appendChild(p); c.appendChild(h);
  var r = gmRow(c);
  if (!paye) r.appendChild(gmBtn("Marquer payé", "primary", function () { pfcPayeForm(l, rafraichir); }));
  r.appendChild(gmBtn("Facture PDF", "soft", function () { pfcFacturePdf(l, etat, rafraichir); }));
  r.appendChild(gmBtn("Modifier", "ghost", function () { pfcLigneForm(l, rafraichir); }));
  r.appendChild(gmBtn("Supprimer", "danger", function () {
    if (l.numero) { askAlert("La facture " + l.numero + " a été émise : son numéro ne peut pas disparaître de ta numérotation. Modifie la ligne si besoin."); return; }
    askConfirm("Supprimer cette ligne ?", { danger: true, confirmText: "Supprimer" }).then(function (ok) {
      if (!ok) return;
      window.fbDeleteDoc(window.fbDoc(window.fbDb, "pf_compta", l.id)).then(rafraichir).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
    });
  }));
  return c;
}

// ── Formulaires ──
function pfcChamp(parent, lib, type, val, ph) {
  var w = document.createElement("div"); w.style.marginBottom = "10px";
  var lb = document.createElement("label"); lb.style.cssText = "display:block;font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:4px"; lb.textContent = lib;
  var i = document.createElement("input"); i.type = type || "text"; i.value = val == null ? "" : val; if (ph) i.placeholder = ph;
  i.style.cssText = "width:100%;padding:11px 12px;border-radius:var(--rx);border:1.5px solid var(--bdr);background:var(--card);color:var(--txt);font-size:14px;box-sizing:border-box";
  w.appendChild(lb); w.appendChild(i); parent.appendChild(w);
  return i;
}
function pfcSelect(parent, lib, options, val) {
  var w = document.createElement("div"); w.style.marginBottom = "10px";
  var lb = document.createElement("label"); lb.style.cssText = "display:block;font-size:12px;font-weight:700;color:var(--txt2);margin-bottom:4px"; lb.textContent = lib;
  var sel = document.createElement("select");
  sel.style.cssText = "width:100%;padding:11px 12px;border-radius:var(--rx);border:1.5px solid var(--bdr);background:var(--card);color:var(--txt);font-size:14px;box-sizing:border-box";
  Object.keys(options).forEach(function (k) { var o = document.createElement("option"); o.value = k; o.textContent = options[k]; if (k === val) o.selected = true; sel.appendChild(o); });
  w.appendChild(lb); w.appendChild(sel); parent.appendChild(w);
  return sel;
}

// Création / modification d'une ligne. `pre` peut préremplir (Facturer depuis une carte club).
function pfcLigneForm(l, apres, pre) {
  var s = gmSheet(l ? "Modifier la ligne" : "Nouvelle ligne");
  var d = l || pre || {};
  var tp = {}; Object.keys(PFC_TYPES).forEach(function (k) { tp[k] = PFC_TYPES[k].lib; });
  var type = pfcSelect(s.body, "Nature", tp, d.type === "independant" ? "independant" : "abonnement");
  var client = pfcChamp(s.body, "Client (club ou indépendant)", "text", d.clientNom, "Nom du client");
  var adr = pfcChamp(s.body, "Adresse du client (pour la facture)", "text", d.clientAdresse, "Rue, code postal, ville");
  var lib = pfcChamp(s.body, "Libellé", "text", d.libelle, "ex. Abonnement Standard, 12 mois");
  var mont = pfcChamp(s.body, "Montant (€, TVA non applicable)", "text", d.montant ? String(d.montant).replace(".", ",") : "", "ex. 200");
  var date = pfcChamp(s.body, "Date de la facture / de la vente", "date", d.date || pfcAujourdhui());
  var go = gmBtn("Enregistrer", "primary", function () {
    var m = pfcMontantLire(mont.value);
    if (!client.value.trim()) { askAlert("Indique le client."); return; }
    if (m === null) { askAlert("Montant incorrect."); return; }
    if (!date.value) { askAlert("Indique la date."); return; }
    var doc = {
      type: type.value, clientNom: client.value.trim().slice(0, 100), clientAdresse: adr.value.trim().slice(0, 160),
      libelle: lib.value.trim().slice(0, 120), montant: m, date: date.value,
      statut: d.statut === "paye" ? "paye" : "a_encaisser"
    };
    if (d.clubId) doc.clubId = d.clubId;
    if (l && l.numero) doc.numero = l.numero;
    if (l && l.statut === "paye") { doc.dateEncaissement = l.dateEncaissement || ""; doc.mode = l.mode || "autre"; }
    var p = l ? window.fbSetDoc(window.fbDoc(window.fbDb, "pf_compta", l.id), doc)
              : window.fbAddDoc(pfcCol(), Object.assign({ createdAt: Date.now() }, doc));
    p.then(function () { s.modal.remove(); if (apres) apres(); }).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  });
  s.body.appendChild(go);
}

// Marquer payé : date d'encaissement + mode de règlement.
function pfcPayeForm(l, apres) {
  var s = gmSheet("Paiement reçu");
  var info = document.createElement("div"); info.style.cssText = "font-size:12px;color:var(--txt2);margin-bottom:12px";
  info.textContent = (l.clientNom || "") + " · " + pfcEur(l.montant); s.body.appendChild(info);
  var date = pfcChamp(s.body, "Date d'encaissement", "date", pfcAujourdhui());
  var mode = pfcSelect(s.body, "Mode de règlement", PFC_MODES, "virement");
  s.body.appendChild(gmBtn("Enregistrer", "primary", function () {
    if (!date.value) { askAlert("Indique la date."); return; }
    window.fbUpdateDoc(window.fbDoc(window.fbDb, "pf_compta", l.id), { statut: "paye", dateEncaissement: date.value, mode: mode.value })
      .then(function () { s.modal.remove(); if (apres) apres(); }).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  }));
}

// Informations de l'entreprise (figurent sur la facture).
function pfcInfosForm(cfg, apres) {
  var s = gmSheet("Mes informations");
  var h = document.createElement("div"); h.style.cssText = "font-size:12px;color:var(--txt2);line-height:1.45;margin-bottom:12px";
  h.textContent = "Ces informations apparaissent sur tes factures. Elles ne sont visibles que par toi, jamais par les clubs.";
  s.body.appendChild(h);
  var nom = pfcChamp(s.body, "Nom de l'entreprise (ou ton nom)", "text", cfg.nom, "Nom ou nom commercial");
  var siret = pfcChamp(s.body, "SIRET", "text", cfg.siret || PFC_SIRET_DEFAUT, "14 chiffres");
  var adr = pfcChamp(s.body, "Adresse (siège ou domiciliation)", "text", cfg.adresse, "Rue, code postal, ville");
  var mail = pfcChamp(s.body, "E-mail", "email", cfg.email, "");
  var tel = pfcChamp(s.body, "Téléphone", "tel", cfg.tel, "");
  var chk = document.createElement("div"); chk.style.cssText = "font-size:12px;min-height:16px;margin:-4px 0 10px";
  s.body.appendChild(chk);
  function verif() { var ok = pfcSiretValide(siret.value); chk.textContent = ok ? "✓ SIRET valide" : "✖ SIRET incorrect (14 chiffres)"; chk.style.color = ok ? "var(--grn)" : "var(--red)"; return ok; }
  siret.addEventListener("input", verif); verif();
  s.body.appendChild(gmBtn("Enregistrer", "primary", function () {
    if (!verif()) return;
    var d = { nom: nom.value.trim().slice(0, 100), siret: siret.value.replace(/\s/g, ""), adresse: adr.value.trim().slice(0, 160), email: mail.value.trim().slice(0, 100), tel: tel.value.trim().slice(0, 30), maj: Date.now() };
    window.fbSetDoc(window.fbDoc(window.fbDb, "pf_compta", "_config"), d)
      .then(function () { s.modal.remove(); if (typeof showToast === "function") showToast("Informations enregistrées ✓"); if (apres) apres(); })
      .catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  }));
}

function pfcExporterLivre(lignes, annee) {
  var csv = pfcLivreCsv(lignes, annee);
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "livre-des-recettes-" + annee + ".csv";
  document.body.appendChild(a); a.click(); a.remove();
}

// ── Facture PDF ──
// Le numéro est attribué à la première émission, puis reste le même.
function pfcFacturePdf(l, etat, rafraichir) {
  var cfg = etat.cfg || {}, manque = [];
  if (!cfg.nom) manque.push("nom"); if (!cfg.adresse) manque.push("adresse"); if (!pfcSiretValide(cfg.siret)) manque.push("SIRET");
  if (manque.length) { askAlert("Complète d'abord « Mes informations » (" + manque.join(", ") + ") : ils doivent figurer sur la facture."); return; }
  if (!l.clientAdresse) { askAlert("Ajoute l'adresse du client (bouton Modifier) : elle doit figurer sur la facture."); return; }
  var numPromise = l.numero ? Promise.resolve(l.numero) : (function () {
    var num = pfcNumeroSuivant(etat.lignes, (l.date || pfcAujourdhui()).slice(0, 4));
    return window.fbUpdateDoc(window.fbDoc(window.fbDb, "pf_compta", l.id), { numero: num }).then(function () { l.numero = num; return num; });
  })();
  Promise.all([numPromise, (typeof ribCharger === "function" ? ribCharger() : Promise.resolve(null))]).then(function (r) {
    var num = r[0], rib = r[1] || {};
    var jsPDF = window.jspdf && window.jspdf.jsPDF; if (!jsPDF) { askAlert("Le générateur de PDF n'est pas chargé."); return; }
    var doc = new jsPDF(), y = 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(cfg.nom, 14, y); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    doc.text(cfg.adresse, 14, y); y += 5;
    doc.text("SIRET : " + String(cfg.siret).replace(/(\d{3})(\d{3})(\d{3})(\d{5})/, "$1 $2 $3 $4"), 14, y); y += 5;
    if (cfg.email) { doc.text(cfg.email, 14, y); y += 5; }
    if (cfg.tel) { doc.text(cfg.tel, 14, y); y += 5; }
    doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("FACTURE", 196, 20, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text("N° " + num, 196, 27, { align: "right" });
    doc.text("Date : " + pfcDateFr(l.date), 196, 32, { align: "right" });
    doc.text("Échéance : " + pfcDateFr(pfcPlusJours(l.date, 30)), 196, 37, { align: "right" });
    y = Math.max(y, 44) + 6;
    doc.setFont("helvetica", "bold"); doc.text("Facturé à", 14, y); y += 5;
    doc.setFont("helvetica", "normal"); doc.text(l.clientNom || "", 14, y); y += 5;
    doc.text(doc.splitTextToSize(l.clientAdresse, 90), 14, y); y += 14;
    doc.setFillColor(235, 238, 245); doc.rect(14, y, 182, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.text("Désignation", 16, y + 5.5); doc.text("Qté", 120, y + 5.5); doc.text("Prix HT", 140, y + 5.5); doc.text("Total HT", 194, y + 5.5, { align: "right" });
    y += 14; doc.setFont("helvetica", "normal");
    var lignesLib = doc.splitTextToSize(l.libelle || (PFC_TYPES[l.type] || PFC_TYPES.abonnement).lib, 95);
    doc.text(lignesLib, 16, y);
    doc.text("1", 120, y); doc.text(pfcEur(l.montant), 140, y); doc.text(pfcEur(l.montant), 194, y, { align: "right" });
    y += lignesLib.length * 5 + 8;
    doc.setDrawColor(200); doc.line(14, y, 196, y); y += 7;
    doc.setFont("helvetica", "bold"); doc.text("Total à payer : " + pfcEur(l.montant), 194, y, { align: "right" }); y += 6;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text("TVA non applicable, art. 293 B du CGI", 194, y, { align: "right" }); y += 12;
    doc.setFontSize(10);
    if (l.statut === "paye") {
      doc.setFont("helvetica", "bold"); doc.text("Facture acquittée le " + pfcDateFr(l.dateEncaissement) + " (" + (PFC_MODES[l.mode] || "") + ").", 14, y); y += 10;
    } else if (rib.iban) {
      doc.setFont("helvetica", "bold"); doc.text("Règlement par virement", 14, y); y += 5;
      doc.setFont("helvetica", "normal");
      if (rib.titulaire) { doc.text("Titulaire : " + rib.titulaire, 14, y); y += 5; }
      doc.text("IBAN : " + (typeof ribIbanFmt === "function" ? ribIbanFmt(rib.iban) : rib.iban), 14, y); y += 5;
      if (rib.bic) { doc.text("BIC : " + rib.bic, 14, y); y += 5; }
      doc.text("Référence : " + num, 14, y); y += 10;
    }
    doc.setFontSize(8); doc.setTextColor(110);
    doc.text(doc.splitTextToSize("Pas d'escompte pour paiement anticipé. En cas de retard de paiement : pénalités au taux de trois fois le taux d'intérêt légal et indemnité forfaitaire pour frais de recouvrement de 40 €.", 182), 14, 280);
    doc.save("Facture-" + num + ".pdf");
    if (rafraichir) rafraichir();
  }).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
}

// « Facturer » depuis la carte d'un club ou d'un indépendant de la Plateforme.
function pfcFacturerClub(c) {
  var indep = c.type === "independant";
  var prix = PFC_PRIX_PACK[c.plan];
  pfcLigneForm(null, function () { pfcOuvrir(); }, {
    type: indep ? "independant" : "abonnement", clientNom: c.name || c.id, clubId: c.id,
    libelle: indep ? "" : (c.plan === "premium" ? "Abonnement Premium, 12 mois" : (c.plan === "standard" ? "Abonnement Standard, 12 mois" : "Abonnement")),
    montant: (!indep && prix) ? prix : ""
  });
}
