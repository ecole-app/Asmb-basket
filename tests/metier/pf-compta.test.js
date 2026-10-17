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
