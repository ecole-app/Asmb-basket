// Assiduité aux entraînements (js/14t-convocation.js : assidPour).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const j = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const equipe = { id: "u13", name: "U13 Filles", members: ["a", "b"] };
const seance = (id, n, pres, excuses) => ({ id, type: "entrainement", equipe: "U13 Filles", date: j(n), presences: pres, excuses });
const prevenus = { "e2_a": { statut: "absent" } };
let c0;
const c = c0 = charger(["js/14t-convocation.js"], {
  getTeams: () => [equipe],
  repDe: (eid, pid) => prevenus[eid + "_" + pid] || null,
  getEvents: () => [
    seance("e1", -3, { a: "present", b: "present" }),
    seance("e2", -5, { a: "absent", b: "present" }),          // a prévenue : excusée
    seance("e3", -8, { a: "absent", b: "absent" }),           // a non prévenue
    seance("e4", -10, { a: "retard", b: "absent" }, { b: true }), // retard = présente ; b excusée par le coach
    { id: "e5", type: "entrainement", equipe: "U13 Filles", date: c0.assidDebut().slice(0, 4) + "-08-15", presences: { a: "absent", b: "absent" } }, // avant le 1er septembre
    seance("e6", 2, { a: "absent" }),                          // à venir : ignorée
  ],
});

describe("Assiduité aux entraînements", () => {
  it("les absences excusées ne comptent pas dans le pourcentage", () => {
    const a = c.assidPour("a", equipe);
    assert.equal(a.present, 2); assert.equal(a.compte, 3); assert.equal(a.excusees, 1); assert.equal(a.pct, 67);
  });
  it("le coach peut excuser (ou non) une absence", () => {
    const b = c.assidPour("b", equipe);
    assert.equal(b.present, 2); assert.equal(b.compte, 3); assert.equal(b.excusees, 1); assert.equal(b.pct, 67);
  });
  it("couleurs : vert ≥ 75 %, orange 50-74 %, rouge < 50 %", () => {
    assert.equal(c.assidCouleur(80), "var(--ltg)");
    assert.equal(c.assidCouleur(60), "#E8670A");
    assert.equal(c.assidCouleur(40), "#C0392B");
  });
});
