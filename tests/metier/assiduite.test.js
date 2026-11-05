// Assiduité aux entraînements (js/14t-convocation.js : assidPour).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const j = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const equipe = { id: "u13", name: "U13 Filles", members: ["a", "b"] };
const seance = (id, n, pres, excuses) => ({ id, type: "entrainement", equipe: "U13 Filles", date: j(n), presences: pres, excuses });
const prevenus = { "e2_a": { statut: "absent" } };
const c = charger(["js/14t-convocation.js"], {
  getTeams: () => [equipe],
  repDe: (eid, pid) => prevenus[eid + "_" + pid] || null,
  getEvents: () => [
    seance("e1", -3, { a: "present", b: "present" }),
    seance("e2", -5, { a: "absent", b: "present" }),          // a prévenue : excusée
    seance("e3", -8, { a: "absent", b: "absent" }),           // a non prévenue
    seance("e4", -10, { a: "retard", b: "absent" }, { b: true }), // retard = présente ; b excusée par le coach
    seance("e5", -60, { a: "absent", b: "absent" }),          // hors des 6 semaines
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

// Absences répétées (alerte du coach) : absences NON excusées d'affilée, depuis la plus récente séance pointée.
describe("Absences répétées", () => {
  const eq = { id: "u15", name: "U15 Garçons", members: ["x", "y", "z"] };
  const s = (id, n, pres, exc) => ({ id, type: "entrainement", equipe: "U15 Garçons", date: j(n), presences: pres, excuses: exc });
  const ev = [
    s("f1", -2, { x: "absent", y: "absent", z: "present" }),
    s("f2", -9, { x: "absent", y: "absent", z: "absent" }),
    s("f3", -16, { x: "absent", y: "present", z: "absent" }),
    s("f4", -23, { x: "present", y: "absent", z: "absent" }),
  ];
  const k = charger(["js/14t-convocation.js"], { getTeams: () => [eq], repDe: () => null, getEvents: () => ev });
  it("3 absences non excusées d'affilée = alerte", () => {
    assert.equal(k.assidSerie("x", eq).n, 3);
    assert.equal(k.assidAlerteListe(eq).map((r) => r.pid).join(), "x");
  });
  it("une présence interrompt la série", () => {
    assert.equal(k.assidSerie("y", eq).n, 2);
    assert.equal(k.assidSerie("z", eq).n, 0);
  });
  it("une absence excusée interrompt la série", () => {
    const k2 = charger(["js/14t-convocation.js"], { getTeams: () => [eq], repDe: () => null, getEvents: () => [
      s("g1", -2, { x: "absent" }), s("g2", -9, { x: "absent" }, { x: true }), s("g3", -16, { x: "absent" }) ] });
    assert.equal(k2.assidSerie("x", eq).n, 1);
  });
});
