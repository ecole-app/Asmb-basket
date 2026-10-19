// Comptabilité de la micro-entreprise : totaux, numérotation, livre des recettes (js/20c-pf-compta.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/20c-pf-compta.js"]);
const L = [
  { id: "1", type: "abonnement", clientNom: "Club A", montant: 200, date: "2026-10-05", statut: "paye", dateEncaissement: "2026-10-12", mode: "virement", numero: "F-2026-0001", libelle: "Abonnement Standard" },
  { id: "2", type: "independant", clientNom: "Coach B", montant: 150, date: "2026-11-02", statut: "a_encaisser" },
  { id: "3", type: "abonnement", clientNom: "Club C", montant: 300, date: "2026-07-01", statut: "paye", dateEncaissement: "2026-07-20", mode: "cheque", numero: "F-2026-0002" },
];

describe("Comptabilité plateforme", () => {
  it("lit un montant en euros avec virgule, refuse les valeurs absurdes", () => {
    assert.equal(c.pfcMontantLire("12,50"), 12.5);
    assert.equal(c.pfcMontantLire(" 200 "), 200);
    assert.equal(c.pfcMontantLire("0"), null);
    assert.equal(c.pfcMontantLire("abc"), null);
    assert.equal(c.pfcMontantLire("-5"), null);
  });
  it("numérote les factures par année sans trou ni doublon", () => {
    assert.equal(c.pfcNumeroSuivant([], 2026), "F-2026-0001");
    assert.equal(c.pfcNumeroSuivant(L, 2026), "F-2026-0003");
    assert.equal(c.pfcNumeroSuivant(L, 2027), "F-2027-0001");
  });
  it("sépare abonnements et indépendants dans les totaux, encaissé vs à encaisser", () => {
    const t = c.pfcTotaux(L, "2026-10-01", "2026-12-31");
    assert.equal(t.encaisse.abonnement, 200);
    assert.equal(t.encaisse.independant, 0);
    assert.equal(t.aEncaisser.independant, 150);
    assert.equal(t.encaisse.total, 200);
    const an = c.pfcTotaux(L, "2026-01-01", "2026-12-31");
    assert.equal(an.encaisse.total, 500);
  });
  it("trimestre civil et bornes", () => {
    assert.equal(c.pfcTrimestre("2026-10-17"), "2026-T4");
    assert.equal(c.pfcTrimestre("2026-03-31"), "2026-T1");
    assert.equal(JSON.stringify(c.pfcBornesTrimestre("2026-11-02")), JSON.stringify(["2026-10-01", "2026-12-31"]));
    assert.equal(JSON.stringify(c.pfcBornesTrimestre("2026-05-10")), JSON.stringify(["2026-04-01", "2026-06-30"]));
  });
  it("le livre des recettes ne contient que l'encaissé de l'année, trié, avec total", () => {
    const csv = c.pfcLivreCsv(L, 2026);
    const lignes = csv.replace("﻿", "").split("\r\n");
    assert.equal(lignes.length, 4); // en-tête + 2 payées + total
    assert.ok(lignes[1].startsWith("20/07/2026;F-2026-0002"));
    assert.ok(lignes[2].startsWith("12/10/2026;F-2026-0001"));
    assert.ok(lignes[3].endsWith("500"));
    assert.ok(!csv.includes("Coach B"));
  });
  it("neutralise les formules dans l'export", () => {
    const csv = c.pfcLivreCsv([{ type: "abonnement", clientNom: "=1+1", montant: 5, date: "2026-01-02", statut: "paye", dateEncaissement: "2026-01-02" }], 2026);
    assert.ok(csv.includes("'=1+1"));
  });
  it("valide le SIRET (14 chiffres + clé de Luhn)", () => {
    assert.equal(c.pfcSiretValide("13158073000011"), true);
    assert.equal(c.pfcSiretValide("131 580 730 00011"), true);
    assert.equal(c.pfcSiretValide("13158073000012"), false);
    assert.equal(c.pfcSiretValide("1234"), false);
  });
  it("échéance à 30 jours", () => {
    assert.equal(c.pfcPlusJours("2026-10-17", 30), "2026-11-16");
    assert.equal(c.pfcPlusJours("2026-12-15", 30), "2027-01-14");
  });
});

describe("Comptabilité plateforme : tableau de bord, statuts, dépenses", () => {
  const AUJ = "2026-10-19";
  const F = [
    { id: "a", type: "abonnement", clientNom: "Club A", montant: 200, date: "2026-10-05", statut: "paye", dateEncaissement: "2026-10-12", mode: "virement", numero: "F-2026-0001" },
    { id: "b", type: "independant", clientNom: "Coach B", montant: 150, date: "2026-09-01", statut: "a_encaisser", numero: "F-2026-0002" },          // échue le 01/10 → en retard
    { id: "c", type: "abonnement", clientNom: "Club C", montant: 300, date: "2026-10-15", statut: "a_encaisser", numero: "F-2026-0003" },          // échéance 14/11 → envoyée
    { id: "d", type: "abonnement", clientNom: "Club D", montant: 200, date: "2026-10-18", statut: "a_encaisser" },                                  // brouillon
    { id: "e", sens: "depense", clientNom: "Vistaprint", montant: 24.9, date: "2026-10-03", statut: "paye", dateEncaissement: "2026-10-03", mode: "cb" },
  ];
  it("statut de facture : brouillon, envoyée, en retard, payée, dépense", () => {
    assert.equal(c.pfcStatut(F[0], AUJ), "paye");
    assert.equal(c.pfcStatut(F[1], AUJ), "retard");
    assert.equal(c.pfcStatut(F[2], AUJ), "envoyee");
    assert.equal(c.pfcStatut(F[3], AUJ), "brouillon");
    assert.equal(c.pfcStatut(F[4], AUJ), "depense");
  });
  it("jours de retard depuis l'échéance, 0 si pas échue", () => {
    assert.equal(c.pfcJoursRetard(F[1], AUJ), 18);
    assert.equal(c.pfcJoursRetard(F[2], AUJ), 0);
    assert.equal(c.pfcEcheance({ date: "2026-10-01", echeance: "2026-10-20" }), "2026-10-20");
    assert.equal(c.pfcEcheance({ date: "2026-10-01" }), "2026-10-31");
  });
  it("les dépenses ne comptent jamais dans le chiffre d'affaires ni le livre des recettes", () => {
    const t = c.pfcTotaux(F, "2026-10-01", "2026-12-31");
    assert.equal(t.encaisse.total, 200);
    assert.ok(!c.pfcLivreCsv(F, 2026).includes("Vistaprint"));
  });
  it("tableau de bord : encaissé, à encaisser, retard, plafond, cotisations", () => {
    const t = c.pfcTableau(F, AUJ, {});
    assert.equal(t.encaisseMois, 200);
    assert.equal(t.encaisseAnnee, 200);
    assert.equal(t.aEncaisser, 450);      // en retard (150) + envoyée (300), pas le brouillon
    assert.equal(t.enRetard, 150);
    assert.equal(t.nbRetard, 1);
    assert.equal(t.nbBrouillons, 1);
    assert.equal(t.depensesAnnee, 24.9);
    assert.equal(t.plafond, 83600);
    assert.equal(t.taux, 21.2);
    assert.equal(t.cotisTrimestre, 42.4);
    assert.equal(t.pourcentPlafond, 0.2);
  });
  it("plafond et taux réglables, valeurs absurdes ignorées", () => {
    const t = c.pfcTableau(F, AUJ, { plafond: 77700, tauxCotis: 12.3 });
    assert.equal(t.plafond, 77700);
    assert.equal(t.cotisAnnee, 24.6);
    const u = c.pfcTableau(F, AUJ, { plafond: -5, tauxCotis: "abc" });
    assert.equal(u.plafond, 83600);
    assert.equal(u.taux, 21.2);
  });
  it("registre des achats : seulement les dépenses de l'année, avec total", () => {
    const csv = c.pfcAchatsCsv(F, 2026).replace("﻿", "").split("\r\n");
    assert.equal(csv.length, 3);
    assert.ok(csv[1].startsWith("03/10/2026;Vistaprint"));
    assert.ok(csv[2].endsWith("24,9"));
  });
  it("contacts de relance : e-mail et téléphone validés avant mailto: / sms:", () => {
    assert.equal(c.pfcEmailOk("a@b.fr"), "a@b.fr");
    assert.equal(c.pfcEmailOk("pas un mail"), "");
    assert.equal(c.pfcEmailOk('x"@y.fr'), "");
    assert.equal(c.pfcTelNet("06 12 34 56 78"), "0612345678");
    assert.equal(c.pfcTelNet("12"), "");
  });
  it("justificatif : seulement une image JPEG en data URL", () => {
    assert.equal(c.pfcJustifOk("data:image/jpeg;base64,/9j/4AAQ="), true);
    assert.equal(c.pfcJustifOk("javascript:alert(1)"), false);
    assert.equal(c.pfcJustifOk("data:text/html;base64,AAAA"), false);
  });
});
