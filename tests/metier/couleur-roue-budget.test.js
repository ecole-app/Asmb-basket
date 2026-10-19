// Roue de couleurs (js/08c-couleur-roue.js) : toute teinte choisie reste lisible avec du texte blanc.
// Subventions du budget (js/15-compta-inventaire.js) : prévu = accordées + versées.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/08c-couleur-roue.js"]);

describe("Roue de couleurs", () => {
  it("contraste : blanc sur noir = 21, sur blanc = 1", () => {
    assert.ok(Math.abs(c.gmContrasteBlanc("#000000") - 21) < 0.01);
    assert.ok(Math.abs(c.gmContrasteBlanc("#ffffff") - 1) < 0.01);
  });
  it("aucune teinte de la roue, même très claire, ne sort sous 4,5:1", () => {
    for (let h = 0; h < 360; h += 15) for (const s of [0.2, 0.5, 0.8, 1]) for (const v of [0.3, 0.6, 1]) {
      const hex = c.gmCouleurLisible(h, s, v);
      assert.match(hex, /^#[0-9a-f]{6}$/);
      assert.ok(c.gmContrasteBlanc(hex) >= 4.5, `${h}/${s}/${v} -> ${hex}`);
    }
  });
  it("une teinte déjà sombre n'est pas modifiée", () => {
    assert.equal(c.gmCouleurLisible(120, 0.7, 0.4), c.gmHsvVersHex(120, 0.7, 0.4));
  });
  it("rouge pur, vert pur", () => {
    assert.equal(c.gmHsvVersHex(0, 1, 1), "#ff0000");
    assert.equal(c.gmHsvVersHex(120, 1, 1), "#00ff00");
  });
});

const b = charger(["js/15-compta-inventaire.js"]);
describe("Subventions du budget", () => {
  it("accordées et versées comptent au prévu, demandées en attente, le reste à demander", () => {
    const t = b.budgetSubvTotaux([
      { nom: "Mairie", montant: 3000, statut: "accordee" }, { nom: "ANS", montant: 1500, statut: "versee" },
      { nom: "Département", montant: 2000, statut: "demandee" }, { nom: "Région", montant: 800, statut: "a_demander" },
    ]);
    assert.deepEqual({ ...t }, { accorde: 4500, attente: 2000, ademander: 800 });
  });
  it("liste vide : zéro partout", () => assert.deepEqual({ ...b.budgetSubvTotaux([]) }, { accorde: 0, attente: 0, ademander: 0 }));
});
