// Responsable d'un événement (js/14o-responsable-evt.js) : le bandeau d'accueil n'apparaît
// que pour le responsable désigné, du jour J jusqu'à la dernière date de l'événement.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/14o-responsable-evt.js"]);
const stage = { id: "e1", date: "2026-10-19", dateFin: "2026-10-21", responsableUid: "u1" };

describe("Bandeau du responsable", () => {
  it("avant le jour J : rien", () => assert.equal(c.respMesEvenements([stage], "u1", "2026-10-18").length, 0));
  it("jour J et jours suivants du stage : visible", () => {
    for (const j of ["2026-10-19", "2026-10-20", "2026-10-21"]) assert.equal(c.respMesEvenements([stage], "u1", j).length, 1);
  });
  it("après la fin : rien", () => assert.equal(c.respMesEvenements([stage], "u1", "2026-10-22").length, 0));
  it("un autre compte ne le voit pas", () => assert.equal(c.respMesEvenements([stage], "u2", "2026-10-19").length, 0));
  it("événement d'un seul jour", () => {
    const e = { id: "e2", date: "2026-10-19", responsableUid: "u1" };
    assert.equal(c.respMesEvenements([e], "u1", "2026-10-19").length, 1);
    assert.equal(c.respMesEvenements([e], "u1", "2026-10-20").length, 0);
  });
});
