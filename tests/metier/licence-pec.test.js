// Licence prise en charge (bénévole, coach, bureau) : js/06h-roles.js.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(premium = true) {
  const c = charger(["js/06h-roles.js"], {
    authEsc: (x) => x,
    licEstJoueur: (l) => !l || !l.role || l.role === "joueur",
    hasPremium: () => premium,
  });
  c.compta = [];
  c.getComptabilite = () => c.compta;
  c.saveComptabilite = (l) => { c.compta = l; };
  return c;
}
const lic = (o) => Object.assign({ code: "AB12", role: "benevole", fiche: { prenom: "Léa", nom: "Martin" } }, o);

describe("Licence prise en charge : libellé", () => {
  it("rien quand la personne paie", () => assert.equal(app().licPecLibelle(lic({})), ""));
  it("offerte par le club", () => assert.equal(app().licPecLibelle(lic({ priseEnCharge: "club" })), "Licence offerte"));
  it("licencié ailleurs avec le club", () =>
    assert.equal(app().licPecLibelle(lic({ priseEnCharge: "ailleurs", clubAilleurs: "Roanne" })), "Licencié ailleurs (Roanne)"));
  it("valeur inconnue ignorée", () => assert.equal(app().licPecLibelle(lic({ priseEnCharge: "x" })), ""));
});

describe("Licence offerte : dépense en comptabilité", () => {
  it("pas de coût = pas de ligne", () => assert.equal(app().licPecLigne(lic({ priseEnCharge: "club" })), null));
  it("licencié ailleurs = pas de ligne", () => assert.equal(app().licPecLigne(lic({ priseEnCharge: "ailleurs", coutClub: 50 })), null));
  it("coût = dépense Affiliation/Licences fédérales", () => {
    const l = app().licPecLigne(lic({ priseEnCharge: "club", coutClub: 62.5 }));
    assert.equal(l.type, "depense");
    assert.equal(l.montant, 62.5);
    assert.equal(l.categorie, "Affiliation/Licences fédérales");
    assert.equal(l.id, "pec_AB12");
    assert.equal(l.horsPremium, undefined);
  });
  it("Standard : écriture gardée hors Premium", () =>
    assert.equal(app(false).licPecLigne(lic({ priseEnCharge: "club", coutClub: 40 })).horsPremium, true));
  it("une seule ligne par licence, retirée quand on repasse en payante", () => {
    const c = app();
    const l = lic({ priseEnCharge: "club", coutClub: 40 });
    c.licPecLigneCompta(l);
    l.coutClub = 45; c.licPecLigneCompta(l);
    assert.equal(c.compta.length, 1);
    assert.equal(c.compta[0].montant, 45);
    delete l.priseEnCharge; c.licPecLigneCompta(l);
    assert.equal(c.compta.length, 0);
  });
});
