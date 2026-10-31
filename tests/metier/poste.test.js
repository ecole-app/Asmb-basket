// Poste de jeu masqué en mini-basket (js/01-config.js : posteVisible, posteDe).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/01-config.js"]);

describe("Poste de jeu", () => {
  it("n'apparaît pas avant les U13 (Baby, Micro, U7, U9, U11)", () => {
    for (const cat of ["Baby basket", "Micro", "U7", "U9", "U11"]) assert.equal(c.posteVisible(cat), false, cat);
  });
  it("apparaît à partir des U13 et chez les adultes", () => {
    for (const cat of ["U13", "U15", "U17", "U18", "U21", "Senior", "Loisir", "3x3"]) assert.equal(c.posteVisible(cat), true, cat);
  });
  it("posteDe rend le poste seulement s'il est affichable", () => {
    assert.equal(c.posteDe({ cat: "U11", poste: "Meneur" }), "");
    assert.equal(c.posteDe({ cat: "U13", poste: "Meneur" }), "Meneur");
    assert.equal(c.posteDe({ cat: "U15", poste: "---" }), "");
  });
});
