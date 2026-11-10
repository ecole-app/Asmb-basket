// Équipe de caisse buvette : seuls « Prénom I. » des bénévoles du jour passent dans le code de la caisse
// (la caisse n'a jamais accès aux licences).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function ladate(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function app(events) {
  return charger(["js/14g-benevoles.js", "js/15-compta-inventaire.js"], { getEvents: () => events, eventTypeLabel: () => "" });
}

describe("Équipe de caisse (15)", () => {
  it("nom court : prénom + initiale, sans parenthèses", () => {
    const c = app([]);
    assert.equal(c.buvetteNomCourt("léa martin"), "Léa M.");
    assert.equal(c.buvetteNomCourt("Camille Durand (Démo)"), "Camille D.");
    assert.equal(c.buvetteNomCourt("Sam"), "Sam");
    assert.equal(c.buvetteNomCourt(""), "");
  });
  it("prend les bénévoles d'aujourd'hui (tous postes), sans doublon, pas ceux d'un autre jour", () => {
    const c = app([
      { id: "a", date: ladate(0), benevoles: [{ nom: "Léa Martin" }, { nom: "lea martin" }, { nom: "Paul Robin", poste: "Accueil" }] },
      { id: "b", date: ladate(3), benevoles: [{ nom: "Demain Absent" }] },
      { id: "c", date: ladate(-1), dateFin: ladate(1), benevoles: [{ nom: "Tournoi Long" }] }
    ]);
    const n = c.buvetteEquipeDuJour().map(x => x.n).sort();
    assert.equal(JSON.stringify(n), JSON.stringify(["Léa M.", "Paul R.", "Tournoi L."]));
  });
});
