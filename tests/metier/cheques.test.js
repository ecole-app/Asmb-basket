// Licences payées par chèque, en plusieurs fois (js/06d-cheques.js). Les
// fonctions d'édition (chqEditeur, remise en banque) sont liées au DOM ; on
// teste ici la logique pure : formatage, calcul de date, et surtout
// chqEnregistrer/chqRetirer qui synchronisent la comptabilité — une ligne en
// trop, en moins, ou au mauvais montant est une vraie erreur comptable.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(dirigeant = true) {
  const c = charger(["js/06d-cheques.js"]);
  c.ASMB_USER = { roles: dirigeant ? ["dirigeant"] : ["coach"] };
  c.licences = [];
  c.getLicences = () => c.licences;
  c.saveLicences = (l) => { c.licences = l; };
  c.comptabilite = [];
  c.getComptabilite = () => c.comptabilite;
  c.saveComptabilite = (l) => { c.comptabilite = l; };
  return c;
}
const chq = (o = {}) => Object.assign({ id: "c1", num: "", banque: "", emetteur: "", montant: 50, encaissement: "2026-11-01", statut: "a_deposer", deposeLe: null }, o);

describe("Formatage (chqEuro / chqRef)", () => {
  it("arrondit au centime, virgule française", () => {
    const c = app();
    assert.equal(c.chqEuro(50), "50,00 €");
    assert.equal(c.chqEuro(19.999), "20,00 €");
    assert.equal(c.chqEuro("abc"), "0,00 €");
  });
  it("référence de compta stable pour un chèque donné", () => {
    const c = app();
    assert.equal(c.chqRef("L123", "c1"), "Licence L123 · chèque c1");
  });
});

describe("Encaissement +N mois (chqMoisPlus)", () => {
  it("mois simple, jour conservé", () => {
    const c = app();
    assert.equal(c.chqMoisPlus("2026-11-05", 1), "2026-12-05");
  });
  it("31 janvier + 1 mois : clampé à la fin février (non bissextile)", () => {
    const c = app();
    assert.equal(c.chqMoisPlus("2027-01-31", 1), "2027-02-28");
  });
  it("31 janvier + 1 mois sur année bissextile : 29 février", () => {
    const c = app();
    assert.equal(c.chqMoisPlus("2028-01-31", 1), "2028-02-29");
  });
  it("sans date de départ : part d'aujourd'hui", () => {
    const c = app();
    assert.equal(c.chqMoisPlus("", 0), c.chqAuj());
  });
});

describe("Enregistrement des chèques (chqEnregistrer)", () => {
  it("met à jour la licence : montant total, moyen, date = encaissement le plus proche", () => {
    const c = app();
    c.licences = [{ code: "L1", fiche: { prenom: "Léa", nom: "Martin" } }];
    c.chqEnregistrer("L1", [chq({ id: "a", montant: 50, encaissement: "2026-12-01" }), chq({ id: "b", montant: 30, encaissement: "2026-11-01" })]);
    const lic = c.licences.find((l) => l.code === "L1");
    assert.equal(lic.paiement.montant, 80);
    assert.equal(lic.paiement.moyen, "Chèque");
    assert.equal(lic.paiement.date, "2026-11-01");
    assert.equal(lic.cheques.length, 2);
  });
  it("retire une ancienne ligne de compta « paiement unique » pour cette licence", () => {
    const c = app();
    c.licences = [{ code: "L1", fiche: {} }];
    c.comptabilite = [{ id: "x", reference: "Licence L1", montant: 80 }];
    c.chqEnregistrer("L1", [chq({ id: "a" })]);
    assert.equal(c.comptabilite.some((l) => l.reference === "Licence L1"), false);
  });
  it("un chèque retiré (ex. 3 → 2) : sa ligne de compta disparaît, les autres restent", () => {
    const c = app();
    c.licences = [{ code: "L1", fiche: {}, cheques: [chq({ id: "a" }), chq({ id: "b" }), chq({ id: "c" })] }];
    c.comptabilite = [
      { id: "1", reference: "Licence L1 · chèque a", montant: 50 },
      { id: "2", reference: "Licence L1 · chèque b", montant: 50 },
      { id: "3", reference: "Licence L1 · chèque c", montant: 50 },
      { id: "4", reference: "Licence L2 · chèque a", montant: 999 }, // une autre licence : jamais touchée
    ];
    c.chqEnregistrer("L1", [chq({ id: "a" }), chq({ id: "b" })]); // le chèque "c" disparaît
    const refs = c.comptabilite.map((l) => l.reference);
    assert.deepEqual(refs.sort(), ["Licence L1 · chèque a", "Licence L1 · chèque b", "Licence L2 · chèque a"].sort());
  });
  it("chèque déjà déposé dont le montant est corrigé : la ligne de compta suit", () => {
    const c = app();
    c.licences = [{ code: "L1", fiche: {} }];
    c.comptabilite = [{ id: "1", reference: "Licence L1 · chèque a", montant: 50 }];
    c.chqEnregistrer("L1", [chq({ id: "a", montant: 45, statut: "depose" })]);
    assert.equal(c.comptabilite.find((l) => l.reference === "Licence L1 · chèque a").montant, 45);
  });
  it("sans droit comptabilité (coach non autorisé) : la compta n'est jamais touchée", () => {
    const c = app(false);
    c.licences = [{ code: "L1", fiche: {} }];
    c.comptabilite = [{ id: "1", reference: "Licence L1", montant: 80 }];
    c.chqEnregistrer("L1", [chq({ id: "a" })]);
    assert.equal(c.comptabilite.length, 1); // ligne inchangée, pas nettoyée
  });
  it("licence introuvable : ne modifie rien, ne plante pas", () => {
    const c = app();
    c.licences = [{ code: "L1", fiche: {} }];
    c.chqEnregistrer("INEXISTANT", [chq()]);
    assert.equal(c.licences.length, 1);
    assert.equal(c.licences[0].cheques, undefined);
  });
});

describe("Changement de moyen de paiement (chqRetirer)", () => {
  it("retire les chèques de la licence et leurs lignes de compta", () => {
    const c = app();
    const lic = { code: "L1", fiche: {}, cheques: [chq({ id: "a" })] };
    const compta = [
      { id: "1", reference: "Licence L1 · chèque a", montant: 50 },
      { id: "2", reference: "Licence L2 · chèque a", montant: 999 },
    ];
    const res = c.chqRetirer(lic, compta);
    assert.equal(lic.cheques, undefined);
    assert.deepEqual(res.map((l) => l.id), ["2"]);
  });
  it("licence sans chèques : rien à faire, compta renvoyée telle quelle", () => {
    const c = app();
    const lic = { code: "L1", fiche: {} };
    const compta = [{ id: "1", reference: "Licence L2 · chèque a" }];
    assert.equal(c.chqRetirer(lic, compta), compta);
  });
});
