// Pôles créés / masqués par le dirigeant (js/17d-poles-club.js, activePoles de js/01-config.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(club) {
  const c = charger(["js/01-config.js", "js/17d-poles-club.js"], { gmJs: (x) => x, hasPremium: () => true });
  c.window.CURRENT_CLUB = Object.assign({ id: "x" }, club);
  return c;
}
const ids = (c) => Array.from(c.activePoles().map((p) => p.id));

describe("Pôles du club", () => {
  it("sans réglage : les pôles standard + premium, comme avant", () => {
    assert.deepEqual(ids(app({})), ["formation", "competition", "3x3", "evenement", "basketsante"]);
  });
  it("un pôle masqué disparaît pour ce club, les autres restent", () => {
    const c = app({ polesMasques: ["3x3", "formation"] });
    assert.deepEqual(ids(c), ["competition", "evenement", "basketsante"]);
  });
  it("un pôle créé apparaît avec son nom et son id pc_", () => {
    const c = app({ polesCustom: [{ id: "pc_a1", name: "Féminin", about: "Section filles" }] });
    const p = c.activePoles().filter((x) => x.custom)[0];
    assert.equal(p.name, "Féminin"); assert.equal(p.id, "pc_a1"); assert.equal(p.ready, true);
  });
  it("entrées invalides ignorées", () => {
    const c = app({ polesCustom: [null, { id: 3 }, { id: "pc_b", name: "OK" }], polesMasques: [5, "3x3"] });
    assert.equal(c.polesClubCustom().length, 1);
    assert.deepEqual(Array.from(c.polesClubMasques()), ["3x3"]);
  });
});
