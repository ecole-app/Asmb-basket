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
    if (pfcEstDepense(l)) return;
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
// ── Tableau de bord, statuts de facture, dépenses (sans écran, testés) ──
var PFC_PLAFOND_DEFAUT = 83600;   // plafond annuel de chiffre d'affaires (modifiable dans « Mes informations »)
var PFC_TAUX_DEFAUT = 21.2;       // cotisations sociales en % du chiffre d'affaires encaissé (modifiable)
function pfcEstDepense(l) { return !!l && l.sens === "depense"; }
function pfcEcheance(l) { return (l && l.echeance) || pfcPlusJours(l && l.date, 30); }
function pfcJoursEntre(a, b) { // nombre de jours de a à b (AAAA-MM-JJ)
  var ma = /^(\d{4})-(\d{2})-(\d{2})/.exec(a || ""), mb = /^(\d{4})-(\d{2})-(\d{2})/.exec(b || "");
  if (!ma || !mb) return 0;
  return Math.round((Date.UTC(+mb[1], +mb[2] - 1, +mb[3]) - Date.UTC(+ma[1], +ma[2] - 1, +ma[3])) / 86400000);
}
// brouillon (pas encore de PDF/numéro) → envoyee (PDF émis) → retard (échéance dépassée) | paye
function pfcStatut(l, auj) {
  if (pfcEstDepense(l)) return "depense";
  if (l.statut === "paye") return "paye";
  if (!l.numero) return "brouillon";
  return pfcEcheance(l) < auj ? "retard" : "envoyee";
}
function pfcJoursRetard(l, auj) { return Math.max(0, pfcJoursEntre(pfcEcheance(l), auj)); }
function pfcTableau(lignes, auj, cfg) {
  cfg = cfg || {};
  var annee = auj.slice(0, 4), mois = auj.slice(0, 7);
  var tAn = pfcTotaux(lignes, annee + "-01-01", annee + "-12-31");
  var tTri = pfcTotaux(lignes, pfcBornesTrimestre(auj)[0], pfcBornesTrimestre(auj)[1]);
  var tMois = pfcTotaux(lignes, mois + "-01", mois + "-31");
  var plafond = Number(cfg.plafond) > 0 ? Number(cfg.plafond) : PFC_PLAFOND_DEFAUT;
  var taux = (cfg.tauxCotis !== undefined && cfg.tauxCotis !== "" && isFinite(Number(cfg.tauxCotis)) && Number(cfg.tauxCotis) >= 0) ? Number(cfg.tauxCotis) : PFC_TAUX_DEFAUT;
  var r = { annee: annee, encaisseMois: tMois.encaisse.total, encaisseTrimestre: tTri.encaisse.total, encaisseAnnee: tAn.encaisse.total,
    aEncaisser: 0, enRetard: 0, nbRetard: 0, nbBrouillons: 0, depensesAnnee: 0, plafond: plafond, taux: taux };
  (lignes || []).forEach(function (l) {
    var st = pfcStatut(l, auj), m = Number(l.montant) || 0;
    if (st === "depense") { if ((l.date || "").slice(0, 4) === annee) r.depensesAnnee = pfcArrondi(r.depensesAnnee + m); }
    else if (st === "envoyee" || st === "retard") r.aEncaisser = pfcArrondi(r.aEncaisser + m);
    else if (st === "brouillon") r.nbBrouillons++;
    if (st === "retard") { r.enRetard = pfcArrondi(r.enRetard + m); r.nbRetard++; }
  });
  r.pourcentPlafond = Math.round(r.encaisseAnnee / plafond * 1000) / 10;
  r.cotisTrimestre = pfcArrondi(r.encaisseTrimestre * taux / 100);
  r.cotisAnnee = pfcArrondi(r.encaisseAnnee * taux / 100);
  return r;
}
// Registre des achats (dépenses) d'une année, en CSV.
function pfcAchatsCsv(lignes, annee) {
  var b = pfcBornesAnnee(annee), tot = 0;
  var dep = (lignes || []).filter(function (l) { return pfcEstDepense(l) && (l.date || "") >= b[0] && (l.date || "") <= b[1]; })
    .sort(function (a, c) { return (a.date || "").localeCompare(c.date || ""); });
  var out = ["Date;Fournisseur;Libellé;Mode de règlement;Montant"];
  dep.forEach(function (l) {
    tot = pfcArrondi(tot + Number(l.montant));
    out.push([pfcDateFr(l.date), l.clientNom || "", l.libelle || "", PFC_MODES[l.mode] || "", String(pfcArrondi(l.montant)).replace(".", ",")].map(pfcCsvCase).join(";"));
  });
  out.push(["", "", "", "TOTAL " + annee, String(tot).replace(".", ",")].join(";"));
  return "\ufeff" + out.join("\r\n");
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
    return !pfcEstDepense(l) && l.statut === "paye" && d >= b[0] && d <= b[1];
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
    haut.appendChild(pfcTableauCarte(pfcTableau(etat.lignes, auj, etat.cfg)));
    haut.appendChild(carteTotaux("Ce trimestre (" + pfcTrimestre(auj).replace("-", " ") + ") : pour ta déclaration trimestrielle", tri));
    haut.appendChild(carteTotaux("Cette année (" + auj.slice(0, 4) + ")", pfcBornesAnnee(auj.slice(0, 4))));
    var act = gmRow(haut);
    act.appendChild(gmBtn("+ Nouvelle ligne", "primary", function () { pfcLigneForm(null, rafraichir); }));
    act.appendChild(gmBtn("📷 Justificatif", "soft", function () { pfcDepenseForm(null, rafraichir, null, true); }));
    act.appendChild(gmBtn("+ Dépense", "soft", function () { pfcDepenseForm(null, rafraichir); }));
    var act2 = gmRow(haut);
    act2.appendChild(gmBtn("Mes informations", "soft", function () { pfcInfosForm(etat.cfg, rafraichir); }));
    act2.appendChild(gmBtn("Livre des recettes (CSV)", "soft", function () { pfcExporterCsv(pfcLivreCsv(etat.lignes, auj.slice(0, 4)), "livre-des-recettes-" + auj.slice(0, 4) + ".csv"); }));
    act2.appendChild(gmBtn("Registre des achats (CSV)", "soft", function () { pfcExporterCsv(pfcAchatsCsv(etat.lignes, auj.slice(0, 4)), "registre-des-achats-" + auj.slice(0, 4) + ".csv"); }));
    var note = document.createElement("div");
    note.style.cssText = "font-size:11px;color:var(--mut);line-height:1.45;margin:10px 0 4px";
    note.textContent = "Factures en PDF classique : valables jusqu'à l'obligation d'émission électronique (1er septembre 2027 pour les micro-entreprises). Le format électronique, via une plateforme agréée, se branchera sur ces mêmes lignes.";
    haut.appendChild(note);
    var f = document.createElement("div"); f.style.cssText = "display:flex;gap:6px;margin:12px 0 8px;flex-wrap:wrap";
    [["tous", "Toutes"], ["abonnement", "Abonnements"], ["independant", "Indépendants"], ["retard", "En retard"], ["depense", "Dépenses"]].forEach(function (o) {
      var b = gmBtn(o[1], etat.filtre === o[0] ? "primary" : "ghost", function () { etat.filtre = o[0]; dessiner(); });
      f.appendChild(b);
    });
    haut.appendChild(f);

    liste.innerHTML = "";
    function genre(l) { return pfcEstDepense(l) ? "depense" : (l.type === "independant" ? "independant" : "abonnement"); }
    var vues = etat.lignes.filter(function (l) {
      if (etat.filtre === "tous") return true;
      if (etat.filtre === "retard") return pfcStatut(l, auj) === "retard";
      return genre(l) === etat.filtre;
    });
    if (!vues.length) {
      var v = document.createElement("div"); v.style.cssText = "text-align:center;color:var(--mut);font-size:12px;padding:20px;line-height:1.5";
      v.textContent = etat.lignes.length ? "Aucune ligne dans ce filtre." : "Aucune ligne pour l'instant. Appuie sur « + Nouvelle ligne » ou sur « Facturer » depuis la carte d'un club.";
      liste.appendChild(v);
    }
    vues.forEach(function (l) { liste.appendChild(pfcCarteLigne(l, etat, rafraichir)); });
  }
  rafraichir();
}

// Tableau de bord : encaissé, à encaisser, retards, plafond, cotisations à mettre de côté.
function pfcTableauCarte(t) {
  var c = gmCard();
  var h = document.createElement("div"); h.style.cssText = "font-size:12px;font-weight:800;color:var(--txt);margin-bottom:8px"; h.textContent = "Tableau de bord " + t.annee;
  c.appendChild(h);
  var g = document.createElement("div"); g.style.cssText = "display:grid;grid-template-columns:1fr 1fr;gap:8px";
  function tuile(lib, val, sous, col) {
    var d = document.createElement("div"); d.style.cssText = "background:var(--bg,#f4f6fa);border-radius:12px;padding:10px 12px;min-width:0";
    var a = document.createElement("div"); a.style.cssText = "font-size:11px;color:var(--mut);font-weight:700"; a.textContent = lib;
    var b = document.createElement("div"); b.style.cssText = "font-size:18px;font-weight:800;margin-top:2px;color:" + (col || "var(--txt)"); b.textContent = val;
    d.appendChild(a); d.appendChild(b);
    if (sous) { var e = document.createElement("div"); e.style.cssText = "font-size:10.5px;color:var(--mut);margin-top:2px;line-height:1.35"; e.textContent = sous; d.appendChild(e); }
    g.appendChild(d);
  }
  tuile("Encaissé ce mois", pfcEur(t.encaisseMois));
  tuile("Encaissé ce trimestre", pfcEur(t.encaisseTrimestre), "à mettre de côté : " + pfcEur(t.cotisTrimestre));
  tuile("À encaisser", pfcEur(t.aEncaisser), t.nbBrouillons ? t.nbBrouillons + " brouillon" + (t.nbBrouillons > 1 ? "s" : "") + " sans facture" : "");
  tuile("En retard", pfcEur(t.enRetard), t.nbRetard ? t.nbRetard + " facture" + (t.nbRetard > 1 ? "s" : "") : "aucune", t.nbRetard ? "var(--red)" : "");
  c.appendChild(g);
  var pct = Math.min(100, t.pourcentPlafond), col = t.pourcentPlafond >= 100 ? "var(--red)" : (t.pourcentPlafond >= 80 ? "#E8670A" : "var(--grn)");
  var jt = document.createElement("div"); jt.style.cssText = "display:flex;justify-content:space-between;gap:8px;font-size:12px;margin:12px 0 4px;color:var(--txt)";
  var j1 = document.createElement("span"); j1.style.fontWeight = "700"; j1.textContent = "Plafond annuel";
  var j2 = document.createElement("span"); j2.textContent = pfcEur(t.encaisseAnnee) + " / " + Math.round(t.plafond).toLocaleString("fr-FR") + " €" + " (" + String(t.pourcentPlafond).replace(".", ",") + " %)";
  jt.appendChild(j1); jt.appendChild(j2); c.appendChild(jt);
  var bar = document.createElement("div"); bar.style.cssText = "height:8px;border-radius:6px;background:var(--bdr);overflow:hidden";
  var fill = document.createElement("div"); fill.style.cssText = "height:100%;border-radius:6px;width:" + pct + "%;background:" + col;
  bar.appendChild(fill); c.appendChild(bar);
  var n = document.createElement("div"); n.style.cssText = "font-size:11px;color:var(--mut);line-height:1.45;margin-top:8px";
  n.textContent = "Cotisations de l'année à mettre de côté : " + pfcEur(t.cotisAnnee) + " (taux " + String(t.taux).replace(".", ",") + " %, modifiable dans « Mes informations »)."
    + (t.depensesAnnee ? " Dépenses enregistrées : " + pfcEur(t.depensesAnnee) + " (en micro-entreprise, elles ne se déduisent pas du chiffre d'affaires)." : "");
  c.appendChild(n);
  return c;
}

function pfcCarteLigne(l, etat, rafraichir) {
  var auj = pfcAujourdhui(), st0 = pfcStatut(l, auj), dep = st0 === "depense", paye = st0 === "paye";
  var t = dep ? { lib: "Dépense", col: "#6B7280" } : (PFC_TYPES[l.type] || PFC_TYPES.abonnement);
  var c = gmCard();
  var h = document.createElement("div"); h.style.cssText = "display:flex;justify-content:space-between;gap:8px;align-items:flex-start";
  var g = document.createElement("div"); g.style.cssText = "min-width:0;flex:1";
  var n = document.createElement("div"); n.style.cssText = "font-size:13px;font-weight:800;color:var(--txt)"; n.textContent = l.clientNom || (dep ? "(fournisseur)" : "(client)");
  var m = document.createElement("div"); m.style.cssText = "font-size:11px;color:var(--mut);margin-top:2px;line-height:1.4";
  var tag = document.createElement("b"); tag.style.color = t.col; tag.textContent = t.lib;
  m.appendChild(tag);
  m.appendChild(document.createTextNode(" · " + pfcDateFr(l.date) + (l.numero ? " · " + l.numero : "") + (l.libelle ? " · " + l.libelle : "")));
  g.appendChild(n); g.appendChild(m);
  var p = document.createElement("div"); p.style.cssText = "text-align:right;flex:none";
  var mo = document.createElement("div"); mo.style.cssText = "font-size:14px;font-weight:800;color:var(--txt)"; mo.textContent = (dep ? "− " : "") + pfcEur(l.montant);
  var st = document.createElement("div"); st.style.cssText = "font-size:11px;font-weight:700;margin-top:2px";
  var txt = { brouillon: ["Brouillon", "var(--mut)"], envoyee: ["Envoyée · échéance " + pfcDateFr(pfcEcheance(l)), "#E8670A"],
    retard: ["En retard de " + pfcJoursRetard(l, auj) + " j", "var(--red)"], paye: ["Payé le " + pfcDateFr(l.dateEncaissement), "var(--grn)"],
    depense: [PFC_MODES[l.mode] || "", "var(--mut)"] }[st0];
  st.style.color = txt[1]; st.textContent = txt[0];
  p.appendChild(mo); p.appendChild(st);
  h.appendChild(g); h.appendChild(p); c.appendChild(h);
  var r = gmRow(c);
  if (st0 === "retard") {
    var mail = pfcEmailOk(l.clientEmail), tel = pfcTelNet(l.clientTel);
    if (mail) r.appendChild(gmBtn("Relancer par e-mail", "primary", function () { pfcRelance(l, etat.cfg, "email"); }));
    if (tel) r.appendChild(gmBtn("Relancer par SMS", mail ? "soft" : "primary", function () { pfcRelance(l, etat.cfg, "sms"); }));
    if (!mail && !tel) r.appendChild(gmBtn("Relancer", "primary", function () { askAlert("Ajoute l'e-mail ou le téléphone du client (bouton Modifier) pour pouvoir le relancer."); }));
  }
  if (st0 === "envoyee" || st0 === "retard") r.appendChild(gmBtn("Marquer payé", st0 === "retard" ? "soft" : "primary", function () { pfcPayeForm(l, rafraichir); }));
  if (!dep) r.appendChild(gmBtn("Facture PDF", st0 === "brouillon" ? "primary" : "soft", function () { pfcFacturePdf(l, etat, rafraichir); }));
  if (dep && pfcJustifOk(l.justif)) r.appendChild(gmBtn("Justificatif", "soft", function () { pfcJustifVoir(l); }));
  r.appendChild(gmBtn("Modifier", "ghost", function () { if (dep) pfcDepenseForm(l, rafraichir); else pfcLigneForm(l, rafraichir); }));
  r.appendChild(gmBtn("Supprimer", "danger", function () {
    if (l.numero) { askAlert("La facture " + l.numero + " a été émise : son numéro ne peut pas disparaître de ta numérotation. Modifie la ligne si besoin."); return; }
    askConfirm("Supprimer cette ligne ?", { danger: true, confirmText: "Supprimer" }).then(function (ok) {
      if (!ok) return;
      window.fbDeleteDoc(window.fbDoc(window.fbDb, "pf_compta", l.id)).then(rafraichir).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
    });
  }));
  return c;
}

// Contacts du client : validés avant d'aller dans un mailto: / sms:.
function pfcEmailOk(v) { v = String(v || "").trim(); return /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(v) ? v : ""; }
function pfcTelNet(v) { var t = String(v || "").replace(/[^+0-9]/g, ""); return t.replace(/\D/g, "").length >= 6 ? t : ""; }
// Relance manuelle (jamais d'envoi automatique) : e-mail ou SMS pré-rempli, vouvoiement.
function pfcRelanceTexte(l, cfg) {
  return "Bonjour,\n\nSauf erreur de ma part, la facture " + (l.numero || "") + " d'un montant de " + pfcEur(l.montant)
    + " (échéance le " + pfcDateFr(pfcEcheance(l)) + ") n'a pas encore été réglée.\nMerci de bien vouloir procéder au règlement dès que possible.\n\nCordialement,\n" + ((cfg && cfg.nom) || "");
}
function pfcRelance(l, cfg, canal) {
  var texte = pfcRelanceTexte(l, cfg);
  if (canal === "email") { var a = pfcEmailOk(l.clientEmail); if (a) window.location.href = "mailto:" + a + "?subject=" + encodeURIComponent("Facture " + (l.numero || "") + " : rappel de paiement") + "&body=" + encodeURIComponent(texte); }
  else { var t = pfcTelNet(l.clientTel); if (t) window.location.href = "sms:" + t + "?&body=" + encodeURIComponent(texte); }
}
// Justificatif : image JPEG générée par l'appli (data URL), contrôlée avant affichage.
function pfcJustifOk(d) { return typeof d === "string" && /^data:image\/jpeg;base64,[A-Za-z0-9+\/=]+$/.test(d); }
function pfcJustifVoir(l) {
  if (!pfcJustifOk(l.justif)) return;
  var s = gmSheet("Justificatif");
  var img = document.createElement("img"); img.src = l.justif; img.alt = "Justificatif"; img.style.cssText = "width:100%;border-radius:10px";
  s.body.appendChild(img);
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

function pfcSansId(l) { var o = Object.assign({}, l); delete o.id; return o; }
// Création / modification d'une ligne. `pre` peut préremplir (Facturer depuis une carte club).
function pfcLigneForm(l, apres, pre) {
  var s = gmSheet(l ? "Modifier la ligne" : "Nouvelle ligne");
  var d = l || pre || {};
  var tp = {}; Object.keys(PFC_TYPES).forEach(function (k) { tp[k] = PFC_TYPES[k].lib; });
  var type = pfcSelect(s.body, "Nature", tp, d.type === "independant" ? "independant" : "abonnement");
  var client = pfcChamp(s.body, "Client (club ou indépendant)", "text", d.clientNom, "Nom du client");
  var adr = pfcChamp(s.body, "Adresse du client (pour la facture)", "text", d.clientAdresse, "Rue, code postal, ville");
  var cmail = pfcChamp(s.body, "E-mail du client (pour les relances, facultatif)", "email", d.clientEmail, "");
  var ctel = pfcChamp(s.body, "Téléphone du client (pour les relances, facultatif)", "tel", d.clientTel, "");
  var lib = pfcChamp(s.body, "Libellé", "text", d.libelle, "ex. Abonnement Standard, 12 mois");
  var mont = pfcChamp(s.body, "Montant (€, TVA non applicable)", "text", d.montant ? String(d.montant).replace(".", ",") : "", "ex. 200");
  var date = pfcChamp(s.body, "Date de la facture / de la vente", "date", d.date || pfcAujourdhui());
  var ech = pfcChamp(s.body, "Échéance (30 jours par défaut)", "date", d.echeance || "");
  var go = gmBtn("Enregistrer", "primary", function () {
    var m = pfcMontantLire(mont.value);
    if (!client.value.trim()) { askAlert("Indique le client."); return; }
    if (m === null) { askAlert("Montant incorrect."); return; }
    if (!date.value) { askAlert("Indique la date."); return; }
    var doc = {
      type: type.value, clientNom: client.value.trim().slice(0, 100), clientAdresse: adr.value.trim().slice(0, 160),
      libelle: lib.value.trim().slice(0, 120), montant: m, date: date.value,
      clientEmail: cmail.value.trim().slice(0, 100), clientTel: ctel.value.trim().slice(0, 30),
      echeance: ech.value || pfcPlusJours(date.value, 30),
      statut: d.statut === "paye" ? "paye" : "a_encaisser"
    };
    if (d.clubId) doc.clubId = d.clubId;
    if (l && l.numero) doc.numero = l.numero;
    if (l && l.statut === "paye") { doc.dateEncaissement = l.dateEncaissement || ""; doc.mode = l.mode || "autre"; }
    var p = l ? window.fbSetDoc(window.fbDoc(window.fbDb, "pf_compta", l.id), Object.assign({}, pfcSansId(l), doc))
              : window.fbAddDoc(pfcCol(), Object.assign({ createdAt: Date.now() }, doc));
    p.then(function () { s.modal.remove(); if (apres) apres(); }).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  });
  s.body.appendChild(go);
}

// Dépense : saisie à la main ou par photo du justificatif (lue par Gemini, comme les tickets des clubs).
// Rien n'est enregistré sans ta validation ; si la lecture échoue, tu complètes à la main.
var PFC_MOYEN_IA = { "CB": "cb", "Espèces": "especes", "Chèque": "cheque", "Virement": "virement" };
function pfcJustifReduire(file) {
  if (typeof comptaTicketReduire !== "function") return Promise.reject(new Error("image"));
  return comptaTicketReduire(file, 1100, 0.6).then(function (d) {
    if (d.length <= 800000) return d;
    return comptaTicketReduire(file, 800, 0.5).then(function (d2) { return d2.length <= 800000 ? d2 : ""; });
  });
}
function pfcDepenseForm(l, apres, pre, photoDirecte) {
  var s = gmSheet(l ? "Modifier la dépense" : "Nouvelle dépense");
  var d = l || pre || {};
  var justif = pfcJustifOk(d.justif) ? d.justif : "";
  var etatLect = document.createElement("div"); etatLect.style.cssText = "display:none;font-size:12px;line-height:1.4;margin-bottom:10px;white-space:pre-line;word-break:break-word";
  var file = document.createElement("input"); file.type = "file"; file.accept = "image/*"; file.setAttribute("capture", "environment"); file.style.display = "none";
  s.body.appendChild(file);
  var bt = gmBtn(justif ? "📷 Changer la photo" : "📷 Photo du justificatif", "soft", function () { file.click(); });
  s.body.appendChild(bt); s.body.appendChild(etatLect);
  function statut(txt, col) { etatLect.style.display = txt ? "block" : "none"; etatLect.style.color = col || "var(--mut)"; etatLect.textContent = txt || ""; }
  var four = pfcChamp(s.body, "Fournisseur", "text", d.clientNom, "ex. Vistaprint");
  var lib = pfcChamp(s.body, "Libellé", "text", d.libelle, "ex. Cartes de visite");
  var mont = pfcChamp(s.body, "Montant (€)", "text", d.montant ? String(d.montant).replace(".", ",") : "", "ex. 24,90");
  var date = pfcChamp(s.body, "Date", "date", d.date || pfcAujourdhui());
  var mode = pfcSelect(s.body, "Moyen de paiement", PFC_MODES, d.mode || "cb");
  file.addEventListener("change", function () {
    var f = file.files && file.files[0]; file.value = ""; if (!f) return;
    if (f.type && f.type.indexOf("image") !== 0) { askAlert("Choisis une photo du justificatif."); return; }
    statut("⏳ Lecture du justificatif… (jusqu'à 1 minute)");
    bt.disabled = true;
    pfcJustifReduire(f).then(function (url) {
      justif = url; // jointe tout de suite, même si la lecture échoue
      if (!navigator.onLine) throw new Error("hors-ligne");
      return (typeof gmTicketIA === "function" ? gmTicketIA(f, statut) : Promise.reject(new Error("ia")));
    }).then(function (r) {
      if (r.fournisseur && !four.value.trim()) four.value = r.fournisseur;
      if (r.description && !lib.value.trim()) lib.value = r.description;
      if (r.montant) mont.value = String(r.montant).replace(".", ",");
      if (r.date) date.value = r.date;
      if (r.moyen && PFC_MOYEN_IA[r.moyen]) mode.value = PFC_MOYEN_IA[r.moyen];
      statut("✓ Justificatif lu : vérifie puis enregistre.", "var(--grn)");
    }).catch(function (e) {
      statut(typeof gmTicketMsgErreur === "function" ? gmTicketMsgErreur(e) : "⚠️ Lecture impossible : complète à la main.", "var(--red)");
    }).then(function () { bt.disabled = false; });
  });
  s.body.appendChild(gmBtn("Enregistrer", "primary", function () {
    var m = pfcMontantLire(mont.value);
    if (!four.value.trim()) { askAlert("Indique le fournisseur."); return; }
    if (m === null) { askAlert("Montant incorrect."); return; }
    if (!date.value) { askAlert("Indique la date."); return; }
    var doc = { sens: "depense", type: "abonnement", clientNom: four.value.trim().slice(0, 100), libelle: lib.value.trim().slice(0, 120),
      montant: m, date: date.value, mode: mode.value, statut: "paye", dateEncaissement: date.value };
    if (justif) doc.justif = justif;
    var p = l ? window.fbSetDoc(window.fbDoc(window.fbDb, "pf_compta", l.id), Object.assign({}, pfcSansId(l), doc))
              : window.fbAddDoc(pfcCol(), Object.assign({ createdAt: Date.now() }, doc));
    p.then(function () { s.modal.remove(); if (apres) apres(); }).catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  }));
  if (photoDirecte) file.click();
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
  var plaf = pfcChamp(s.body, "Plafond annuel de chiffre d'affaires (€)", "text", cfg.plafond || PFC_PLAFOND_DEFAUT, "");
  var taux = pfcChamp(s.body, "Cotisations sociales (% du chiffre d'affaires encaissé)", "text", cfg.tauxCotis !== undefined ? String(cfg.tauxCotis).replace(".", ",") : String(PFC_TAUX_DEFAUT).replace(".", ","), "");
  var hint = document.createElement("div"); hint.style.cssText = "font-size:11px;color:var(--mut);line-height:1.45;margin:-4px 0 10px";
  hint.textContent = "Le plafond et le taux dépendent de ton activité : vérifie-les sur autoentrepreneur.urssaf.fr. Ils servent seulement à la jauge et au montant « à mettre de côté ».";
  s.body.appendChild(hint);
  var chk = document.createElement("div"); chk.style.cssText = "font-size:12px;min-height:16px;margin:-4px 0 10px";
  s.body.appendChild(chk);
  function verif() { var ok = pfcSiretValide(siret.value); chk.textContent = ok ? "✓ SIRET valide" : "✖ SIRET incorrect (14 chiffres)"; chk.style.color = ok ? "var(--grn)" : "var(--red)"; return ok; }
  siret.addEventListener("input", verif); verif();
  s.body.appendChild(gmBtn("Enregistrer", "primary", function () {
    if (!verif()) return;
    var pl = pfcMontantLire(plaf.value), tx = parseFloat(String(taux.value).replace(",", "."));
    if (pl === null) { askAlert("Plafond incorrect."); return; }
    if (!isFinite(tx) || tx < 0 || tx > 100) { askAlert("Taux de cotisations incorrect (entre 0 et 100)."); return; }
    var d = { nom: nom.value.trim().slice(0, 100), siret: siret.value.replace(/\s/g, ""), adresse: adr.value.trim().slice(0, 160), email: mail.value.trim().slice(0, 100), tel: tel.value.trim().slice(0, 30), plafond: pl, tauxCotis: tx, maj: Date.now() };
    window.fbSetDoc(window.fbDoc(window.fbDb, "pf_compta", "_config"), d)
      .then(function () { s.modal.remove(); if (typeof showToast === "function") showToast("Informations enregistrées ✓"); if (apres) apres(); })
      .catch(function (e) { askAlert("Erreur : " + ((e && e.code) || e)); });
  }));
}

function pfcExporterCsv(csv, nomFichier) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
}
function pfcExporterLivre(lignes, annee) { pfcExporterCsv(pfcLivreCsv(lignes, annee), "livre-des-recettes-" + annee + ".csv"); }

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
    doc.text("Échéance : " + pfcDateFr(pfcEcheance(l)), 196, 37, { align: "right" });
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
