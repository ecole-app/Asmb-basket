// Série d'événements répétés chaque semaine (js/14-evenements.js : evSerieCle / evSerieDe).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/14-evenements.js"], { addEventListener() {} });
const ev = (id, date, extra = {}) => Object.assign({ id, date, titre: "Entraînement", type: "entrainement" }, extra);

describe("Série d'événements répétés", () => {
  const tous = [
    ev("100-r0", "2026-11-09", { serieId: "100", recurrent: true }),
    ev("100-r1", "2026-11-16", { serieId: "100", recurrent: true }),
    ev("100-r2", "2026-11-23", { serieId: "100", recurrent: true }),
    ev("1700-Lundi-0", "2026-11-09", { recurrent: true }),   // ancien formulaire de créneaux
    ev("1700-Lundi-1", "2026-11-16", { recurrent: true }),
    ev("1700-Mardi-0", "2026-11-10", { recurrent: true }),   // autre jour du même ajout : autre série
    ev("seul", "2026-11-12"),
  ];
  it("« Répéter chaque semaine » : tous les événements du même serieId, triés par date", () => {
    const s = c.evSerieDe(tous[1], tous);
    assert.deepEqual(s.map((e) => e.id), ["100-r0", "100-r1", "100-r2"]);
  });
  it("ancien formulaire de créneaux : même graine et même jour", () => {
    assert.deepEqual(c.evSerieDe(tous[3], tous).map((e) => e.id), ["1700-Lundi-0", "1700-Lundi-1"]);
    assert.equal(c.evSerieDe(tous[5], tous).length, 1);
  });
  it("un événement seul n'a pas de série", () => {
    assert.equal(c.evSerieCle(tous[6]), null);
    assert.equal(c.evSerieDe(tous[6], tous).length, 1);
  });
});
