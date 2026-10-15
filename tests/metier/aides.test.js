// Aides Pass'Sport / Pass'Région (js/06e-aides.js, montants dans js/06-licences.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(licences = [], club = {}) {
  const c = charger(["js/06e-aides.js"], { authEsc: (x) => x });
  c.licences = licences;
  c.CURRENT_CLUB = club;
  return c;
}
const jour = (iso) => new Date(iso + "T12:00:00");

describe("Pass'Sport : code", () => {
  it("format 26-XXXX-XXXX accepté", () => assert.equal(app().aidesCodePSValide("26-AB12-cd34"), true));
  it("mauvais format refusé", () => assert.equal(app().aidesCodePSValide("25-AB12-CD34"), false));
  it("doublon détecté sur une autre licence", () => {
    const c = app([{ code: "A", aides: [{ type: "passsport", ref: "26-AB12-CD34" }] }, { code: "B" }]);
    assert.ok(c.aidesDoublon("passsport", "26-ab12-cd34", "B"));
    assert.equal(c.aidesDoublon("passsport", "26-AB12-CD34", "A"), null);
  });
});

describe("Éligibilité d'affichage", () => {
  it("Pass'Sport 6 à 30 ans", () => {
    const c = app();
    const n = (a) => new Date(Date.now() - a * 365.25 * 86400000 - 86400000 * 30).toISOString().slice(0, 10);
    assert.equal(c.aidesPSPossible(n(10)), true);
    assert.equal(c.aidesPSPossible(n(4)), false);
    assert.equal(c.aidesPSPossible(n(40)), false);
  });
  it("Pass'Région : jamais sans date de naissance, jamais pour un enfant", () => {
    const c = app();
    assert.equal(c.aidesPRPossible(""), false);
    assert.equal(c.aidesPRPossible(new Date(Date.now() - 10 * 365.25 * 86400000).toISOString().slice(0, 10)), false);
    assert.equal(c.aidesPRPossible(new Date(Date.now() - 16.5 * 365.25 * 86400000).toISOString().slice(0, 10)), true);
  });
  it("aucune aide activée : rien dans l'index public", () => assert.equal(app([], {}).aidesPourCodes(), null));
  it("Pass'Sport activé : index public", () => assert.deepEqual({ ...app([], { aides: { passSport: true } }).aidesPourCodes() }, { ps: true, pr: false }));
});

describe("Montants et alertes", () => {
  it("les aides s'additionnent", () =>
    assert.equal(app().aidesTotalLicence({ aides: [{ montant: 50 }, { montant: 30 }] }), 80));
  it("alerte à 10 j puis 5 j avant le 31/12, seulement s'il reste des codes", () => {
    const c = app([{ code: "A", saison: "2026-2027", aides: [{ type: "passsport", ref: "x", statut: "a_saisir" }] }]);
    assert.equal(c.aidesNiveauAlerte(jour("2026-12-10")), 0);
    assert.equal(c.aidesNiveauAlerte(jour("2026-12-21")), 10);
    assert.equal(c.aidesNiveauAlerte(jour("2026-12-26")), 5);
    assert.equal(c.aidesNiveauAlerte(jour("2027-01-02")), -1);
  });
  it("pas d'alerte quand tout est saisi", () => {
    const c = app([{ code: "A", saison: "2026-2027", aides: [{ type: "passsport", ref: "x", statut: "saisi" }] }]);
    assert.equal(c.aidesNiveauAlerte(jour("2026-12-28")), 0);
  });
});
