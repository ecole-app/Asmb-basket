// Évaluation d'un stage (js/14n-eval-stage.js) : on évalue les inscrits validés (licenciés + extérieurs),
// jour par jour, plus les joueurs cochés et les invités externes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/14n-eval-stage.js"]);
const joueurs = [{ id: "p1", prenom: "Léa", nom: "Martin" }, { id: "p2", prenom: "Tom", nom: "Durand" }];
const ev = { id: "e1", date: "2026-10-19", dateFin: "2026-10-21", participantsClub: ["p2"], inscr: { parJour: true } };
const ins = [
  { _id: "a", nom: "Martin", prenom: "Léa", playerId: "p1", statut: "valide", jours: ["2026-10-19"] },
  { _id: "b", nom: "Petit", prenom: "Zoé", playerId: "", statut: "valide", jours: ["2026-10-19", "2026-10-20"] },
  { _id: "c", nom: "Roux", prenom: "Max", playerId: "", statut: "annule", jours: ["2026-10-19"] },
];

describe("Qui évaluer sur un stage", () => {
  it("jour 1 : joueur coché + inscrit licencié + extérieur, pas l'annulé", () => {
    const l = c.evalParticipants(ev, ins, "2026-10-19", joueurs);
    assert.deepEqual(Array.from(l.map(p => p.key)).sort(), ["i_b", "p1", "p2"]);
    assert.equal(l.find(p => p.key === "i_b").ext, true);
    assert.equal(l.find(p => p.key === "p1").ext, false);
  });
  it("jour 2 : seulement ceux inscrits ce jour-là (+ coché)", () => {
    const l = c.evalParticipants(ev, ins, "2026-10-20", joueurs);
    assert.deepEqual(Array.from(l.map(p => p.key)).sort(), ["i_b", "p2"]);
  });
  it("pas de doublon si le joueur est coché ET inscrit", () => {
    const e2 = { ...ev, participantsClub: ["p1"] };
    assert.equal(c.evalParticipants(e2, ins, "2026-10-19", joueurs).filter(p => p.key === "p1").length, 1);
  });
  it("clé d'évaluation : par jour si stage multi-jours, sinon l'ancienne clé", () => {
    assert.equal(c.evalCle("e1", "2026-10-19"), "e1__2026-10-19");
    assert.equal(c.evalCle("e1", null), "e1");
  });
});
