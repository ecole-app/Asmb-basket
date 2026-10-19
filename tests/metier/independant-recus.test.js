// Reçus numérotés et livre des recettes de l'indépendant (js/24d-independant-recus.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/24-independant.js", "js/24b-independant-argent.js", "js/24d-independant-recus.js"]);
const plat = (v) => JSON.parse(JSON.stringify(v));
const L = (id, o = {}) => Object.assign({ id, type: "seance", uid: "cli", compte: "cli", date: "2026-10-20", montant: 25, statut: "paye", mode: "especes", datePaiement: "2026-10-20", libelle: "Cross" }, o);

describe("Reçus", () => {
  it("numéro R-AAAA-0001 sur 4 chiffres", () => {
    assert.equal(c.indRecuNumero(2026, 1), "R-2026-0001");
    assert.equal(c.indRecuNumero(2027, 123), "R-2027-0123");
  });
  it("SIRET : 14 chiffres, espaces tolérés", () => {
    assert.equal(c.indSiretOk("123 456 789 01234"), true);
    assert.equal(c.indSiretOk("1234"), false);
    assert.equal(c.indSiretOk("1234567890123A"), false);
  });
  it("un reçu regroupe les lignes payées ensemble, pas les autres", () => {
    const toutes = [L("a"), L("b"), L("c", { datePaiement: "2026-10-21" }), L("d", { mode: "cheque" }), L("e", { compte: "autre" }), L("f", { recuNum: "R-2026-0001" })];
    assert.deepEqual(plat(c.indRecuGroupe(toutes[0], toutes)).map((x) => x.id), ["a", "b"]);
  });
  it("une ligne déjà reçue ne rejoint que son numéro", () => {
    const toutes = [L("a", { recuNum: "R-2026-0001" }), L("b", { recuNum: "R-2026-0001" }), L("c")];
    assert.deepEqual(plat(c.indRecuGroupe(toutes[0], toutes)).map((x) => x.id), ["a", "b"]);
  });
  it("données du reçu : total arrondi, enfant indiqué", () => {
    const r = plat(c.indRecuDonnees([L("a", { recuNum: "R-2026-0001", recuLe: "2026-10-20", recuNom: "Julie Durand", recuPour: "Léa", montant: 12.5 }), L("b", { montant: 12.6 })]));
    assert.equal(r.num, "R-2026-0001"); assert.equal(r.total, 25.1); assert.equal(r.lignes[0].pour, "Léa");
  });
});

describe("Livre des recettes", () => {
  it("garde les paiements de l'année par date de paiement, triés, avec totaux mois et trimestres", () => {
    const l = [L("a", { datePaiement: "2026-02-10", montant: 20 }), L("b", { datePaiement: "2026-01-05", montant: 10 }), L("c", { datePaiement: "2026-05-01", montant: 30 }),
      L("d", { datePaiement: "2025-12-31", montant: 99 }), L("e", { statut: "du", datePaiement: "" }), L("f", { statut: "pass", datePaiement: "" })];
    const r = plat(c.indLivreCalcul(l, 2026, () => "Julie"));
    assert.deepEqual(r.rows.map((x) => x.date), ["2026-01-05", "2026-02-10", "2026-05-01"]);
    assert.deepEqual(r.trim, [30, 30, 0, 0]); assert.equal(r.total, 60); assert.equal(r.mois[1], 20);
  });
});
