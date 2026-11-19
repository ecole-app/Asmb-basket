// Composition d'équipe (js/14v-composition.js) : qui y a droit, bouton de la carte match.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(teams) {
  return charger(["js/01-config.js", "js/14v-composition.js"], {
    gmJs: (x) => x, getTeams: () => teams,
    assidEquipeDeEvt: (e) => teams.find((t) => t.name === e.equipe) || null,
  });
}
const match = (equipe, over = {}) => ({ id: "e1", type: "match", equipe, ...over });

describe("Composition d'équipe", () => {
  it("seniors : actif d'office, bouton présent", () => {
    const c = app([{ id: 1, name: "Seniors 1", cat: "Senior" }]);
    assert.equal(c.compoActive(c.getTeams()[0]), true);
    assert.match(c.compoBoutonCarte(match("Seniors 1")), /Composition/);
  });
  it("U15 : bouton présent mais inactif tant que le coach n'a pas activé", () => {
    const t = { id: 2, name: "U15", cat: "U15" }; const c = app([t]);
    assert.match(c.compoBoutonCarte(match("U15")), /Composition/);
    assert.equal(c.compoActive(t), false);
    assert.equal(c.compoActive({ ...t, compo: true }), true);
  });
  it("moins de U13 : pas de bouton", () => {
    const c = app([{ id: 3, name: "U11", cat: "U11" }]);
    assert.equal(c.compoBoutonCarte(match("U11")), "");
  });
  it("match annulé ou autre type : pas de bouton", () => {
    const c = app([{ id: 1, name: "Seniors 1", cat: "Senior" }]);
    assert.equal(c.compoBoutonCarte(match("Seniors 1", { cancelled: true })), "");
    assert.equal(c.compoBoutonCarte({ id: "x", type: "entrainement", equipe: "Seniors 1" }), "");
  });
});
