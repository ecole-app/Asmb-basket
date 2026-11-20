// Taille du texte (js/09-ui-modales.js) : valeurs permises, multiplication avec le zoom de grand écran.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(val, largeur) {
  const styles = {}; const html = { style: { zoom: "", setProperty: (k, v) => { styles[k] = v; }, removeProperty: (k) => { delete styles[k]; if (k === "zoom") html.style.zoom = ""; } } };
  const c = charger(["js/09-ui-modales.js"], {
    matchMedia: (q) => ({ matches: largeur >= parseInt(q.match(/\d+/)[0], 10), addEventListener() {} }),
  });
  c.document.documentElement = html;
  if (val != null) c.localStorage.setItem("gm_taille_texte", val);
  c.gmZoomAppliquer();
  return { c, html, styles };
}
describe("Taille du texte", () => {
  it("valeur inconnue ou absente = Normal, rien n'est posé", () => {
    assert.equal(app(null, 390).c.gmTailleTexte(), 1);
    const r = app("7", 390); assert.equal(r.c.gmTailleTexte(), 1); assert.equal(r.html.style.zoom, "");
  });
  it("téléphone : Très grand = zoom 1,3 et unités d'écran compensées", () => {
    const r = app("1.3", 390);
    assert.equal(r.html.style.zoom, "1.3"); assert.equal(r.styles["--vh"], "calc(1vh / 1.3)");
  });
  it("grand écran : multiplié par le zoom d'écran (1,2 × 1,15)", () => {
    assert.equal(app("1.15", 1700).html.style.zoom, "1.38");
  });
});
