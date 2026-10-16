// Couleurs du club dans tous les thèmes visuels (js/01-config.js, js/03-nav-portal.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const THEMES = ["moderne", "classique", "epure", "bento", "feuille", "carnet", "editorial"];
const c = charger(["js/01-config.js", "js/03-nav-portal.js"]);

describe("Couleurs du club", () => {
  it("chaque thème reçoit des valeurs valides, avec 1 ou 2 couleurs", () => {
    for (const c2 of [null, "#1f844b"]) {
      const tv = c.clubThemeVars("#a5272f", c2);
      for (const t of THEMES) {
        assert.ok(tv[t], t);
        for (const v of tv[t]) if (v) assert.ok(!/undefined|null|NaN/.test(v), t + " : " + v);
      }
    }
  });
  it("la 2e couleur devient l'accent de chaque thème (y compris l'or du thème marine)", () => {
    const tv = c.clubThemeVars("#a5272f", "#1f844b");
    for (const t of ["moderne", "classique", "epure", "editorial"]) assert.match(tv[t][0], /--ltg:#1f844b/, t);
  });
  it("sans 2e couleur, le thème marine garde son or", () => {
    assert.doesNotMatch(c.clubThemeVars("#a5272f", null).classique[0], /--ltg/);
  });
  it("dégradé : de la 1re à la 2e couleur", () => {
    assert.equal(c.clubDegrade("#a5272f", "#1f844b"), "linear-gradient(135deg,#a5272f,#1f844b)");
  });
  it("une 2e couleur sans 1re est ignorée", () => {
    c.CURRENT_CLUB = { couleur2: "#1f844b" };
    assert.equal(c.clubCouleur2(), null);
    c.CURRENT_CLUB = { couleur: "#A5272F", couleur2: "#1F844B" };
    assert.equal(c.clubCouleur(), "#a5272f");
    assert.equal(c.clubCouleur2(), "#1f844b");
  });
  it("le blanc ne fait rien disparaître : couleur de remplacement lisible, valeur choisie gardée", () => {
    c.CURRENT_CLUB = { couleur: "#ffffff", couleur2: "#FFFFFF" };
    c.clubNormaliserCouleurs(c.CURRENT_CLUB);
    assert.equal(c.clubCouleur(), "#1f2937");
    assert.equal(c.clubCouleur2(), "#64748b");
    assert.equal(c.clubCouleurBrute(), "#ffffff");
    assert.equal(c.clubBlanc(), true);
    // Un club en couleur n'est pas touché.
    c.CURRENT_CLUB = { couleur: "#a5272f", couleur2: "#1f844b" };
    c.clubNormaliserCouleurs(c.CURRENT_CLUB);
    assert.equal(c.clubCouleur(), "#a5272f");
    assert.equal(c.clubBlanc(), false);
  });
  it("blanc en 2e couleur avec un club en couleur : la 1re reste, l'accent devient lisible", () => {
    c.CURRENT_CLUB = { couleur: "#a5272f", couleur2: "#ffffff" };
    c.clubNormaliserCouleurs(c.CURRENT_CLUB);
    assert.equal(c.clubCouleur(), "#a5272f");
    assert.equal(c.clubCouleur2(), "#64748b");
    assert.equal(c.clubCouleur2Brute(), "#ffffff");
  });
  it("la palette propose le blanc et le reste garde son contraste avec le blanc", () => {
    assert.ok(c.CLUB_PALETTE.includes("#ffffff"));
    for (const h of c.CLUB_PALETTE.filter((x) => x !== "#ffffff")) assert.equal(c.gmCouleurClaire(h), false, h);
  });
});
