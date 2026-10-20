// Projets avec budget prévisionnel : js/15f-projets.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const app = () => charger(["js/15f-projets.js"], {
  BUDGET_SUBV_STATUTS: [["a_demander", "À demander"], ["demandee", "Demandée"], ["accordee", "Accordée"], ["versee", "Versée"]],
});
const projet = {
  nom: "Stage d'été",
  charges: [{ lib: "Gymnase", montant: 800 }, { lib: "Repas", montant: "400" }],
  subv: [{ nom: "Mairie", montant: 300, statut: "versee" }, { nom: "ANS", montant: 500, statut: "demandee" }, { nom: "Département", montant: 200, statut: "a_demander" }],
  autres: [{ lib: "Fonds propres", montant: 100 }],
};

describe("Projet : totaux", () => {
  it("coût = somme des charges", () => assert.equal(app().projetTotaux(projet).cout, 1200));
  it("acquis = subventions accordées/versées + autres financements", () => assert.equal(app().projetTotaux(projet).finance, 400));
  it("en attente et à demander séparés", () => {
    const t = app().projetTotaux(projet);
    assert.equal(t.attente, 500);
    assert.equal(t.ademander, 200);
  });
  it("reste à financer = coût - acquis", () => assert.equal(app().projetTotaux(projet).reste, 800));
  it("financé à 100 % : reste 0, jamais négatif", () =>
    assert.equal(app().projetTotaux({ charges: [{ montant: 100 }], autres: [{ montant: 150 }] }).reste, 0));
  it("montants invalides comptés à 0", () =>
    assert.equal(app().projetTotaux({ charges: [{ montant: "abc" }, { montant: -50 }, { montant: "12,5" }] }).cout, 12.5));
});

describe("Projet : équilibre et nettoyage", () => {
  it("non équilibré : 1100 prévus pour 1200", () => assert.equal(app().projetEquilibre(projet), false));
  it("équilibré quand les ressources couvrent le coût", () =>
    assert.equal(app().projetEquilibre({ ...projet, autres: [{ lib: "Fonds propres", montant: 200 }] }), true));
  it("lignes vides retirées, statut inconnu = à demander", () => {
    const p = app().projetNettoyer({ nom: " Minibus ", charges: [{ lib: "", montant: "" }, { lib: "Achat", montant: "15000" }], subv: [{ nom: "Région", montant: 3000, statut: "x" }] });
    assert.equal(p.nom, "Minibus");
    assert.equal(p.charges.length, 1);
    assert.equal(p.charges[0].montant, 15000);
    assert.equal(p.subv[0].statut, "a_demander");
    assert.ok(p.id);
  });
  it("liste vide si aucun projet", () => assert.equal(app().projetsListe({}).length, 0));
});
