// Séances d'essai (js/06c-essais.js) : page publique sans compte, suivi des
// demandes. Le gros du module est du DOM/Firestore ; on teste ici le calcul
// d'âge (utilisé pour trier/filtrer les demandes par catégorie) et le choix
// des prochains entraînements proposés comme séance d'essai.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger, jours } from "./contexte.js";

function app(events = []) {
  const c = charger(["js/06c-essais.js"], { getEvents: () => events });
  return c;
}
const iso = (d) => d.toISOString().slice(0, 10);

describe("Âge calculé (essaiAge)", () => {
  it("anniversaire déjà passé cette année : âge courant", () => {
    const c = app();
    const n = new Date();
    const naiss = new Date(n.getFullYear() - 10, 0, 1); // 1er janvier, forcément déjà passé
    assert.equal(c.essaiAge(naiss.toISOString()), "10 ans");
  });
  it("anniversaire pas encore atteint cette année : un an de moins", () => {
    const c = app();
    const n = new Date();
    const futur = new Date(n.getFullYear() - 10, n.getMonth() + 1, n.getDate()); // le mois prochain
    assert.equal(c.essaiAge(futur.toISOString()), "9 ans");
  });
  it("date invalide : rien à afficher", () => {
    const c = app();
    assert.equal(c.essaiAge("pas une date"), "");
    assert.equal(c.essaiAge(""), "");
  });
  it("date dans le futur (saisie erronée) : pas d'âge négatif affiché", () => {
    const c = app();
    const futur = new Date(); futur.setFullYear(futur.getFullYear() + 1);
    assert.equal(c.essaiAge(futur.toISOString()), "");
  });
});

describe("Prochains entraînements proposables (essaiProchainesSeances)", () => {
  const ev = (o) => Object.assign({ type: "entrainement", cancelled: false, equipe: "U13" }, o);
  it("ne garde que les entraînements à venir de l'équipe demandée", () => {
    const c = app([
      ev({ date: iso(jours(2)), equipe: "U13" }),
      ev({ date: iso(jours(3)), equipe: "U15" }), // autre équipe
      ev({ date: iso(jours(-1)), equipe: "U13" }), // passé
      ev({ date: iso(jours(5)), equipe: "U13", cancelled: true }), // annulé
    ]);
    const l = c.essaiProchainesSeances("U13");
    assert.equal(l.length, 1);
    assert.equal(l[0].date, iso(jours(2)));
  });
  it("comparaison insensible à la casse, par sous-chaîne (ex. « U13 Filles »)", () => {
    const c = app([ev({ date: iso(jours(1)), equipe: "u13 filles et garçons" })]);
    assert.equal(c.essaiProchainesSeances("U13").length, 1);
  });
  it("trié du plus proche au plus lointain", () => {
    const c = app([ev({ date: iso(jours(5)) }), ev({ date: iso(jours(1)) }), ev({ date: iso(jours(3)) })]);
    const l = c.essaiProchainesSeances("U13");
    assert.deepEqual(l.map((e) => e.date), [iso(jours(1)), iso(jours(3)), iso(jours(5))]);
  });
  it("plafonné à 6 séances proposées", () => {
    const c = app(Array.from({ length: 10 }, (_, i) => ev({ date: iso(jours(i + 1)) })));
    assert.equal(c.essaiProchainesSeances("U13").length, 6);
  });
  it("équipe inconnue ou événement sans équipe : rien à proposer", () => {
    const c = app([ev({ date: iso(jours(1)), equipe: "U15" }), ev({ date: iso(jours(1)), equipe: null })]);
    assert.equal(c.essaiProchainesSeances("U13").length, 0);
  });
});
