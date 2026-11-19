// Supprimer une fiche de licence : le joueur quitte aussi le trombinoscope et les équipes ; compta liée supprimée.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(st) {
  const c = charger(["js/06h-roles.js"], {
    authEsc: (x) => x, gmJs: (x) => x,
    getPlayers: () => st.players, savePlayers: (p) => { st.players = p; },
    getTeams: () => st.teams, saveTeams: (t) => { st.teams = t; },
    getComptabilite: () => st.compta, saveComptabilite: (x) => { st.compta = x; },
    saveLicences: (l) => { st.lics = l; },
    buildLicences() {}, showUndoToast() {},
  });
  c.getLicences = () => st.lics;
  c.askConfirm = () => Promise.resolve(true);
  return c;
}
const fiche = { nom: "Dupont", prenom: "Léa", naissance: "2010-01-02" };

describe("Suppression d'un licencié", () => {
  it("retire le joueur, l'équipe et la compta", async () => {
    const st = { lics: [{ code: "A", fiche }], players: [{ id: "p1", ...fiche }, { id: "p2", nom: "Autre", prenom: "X" }],
      teams: [{ id: "t", name: "U15", members: ["p1", "p2"] }], compta: [{ id: "c1", reference: "Licence A" }, { id: "c2", reference: "x" }] };
    const c = app(st); await c.licSupprimer("A");
    assert.deepEqual(st.players.map((p) => p.id), ["p2"]);
    assert.deepEqual(st.teams[0].members, ["p2"]);
    assert.deepEqual(st.compta.map((x) => x.id), ["c2"]);
    assert.equal(st.lics.length, 0);
  });
  it("garde le joueur s'il a une autre fiche", async () => {
    const st = { lics: [{ code: "A", fiche }, { code: "B", fiche }], players: [{ id: "p1", ...fiche }], teams: [{ id: "t", name: "U15", members: ["p1"] }], compta: [] };
    const c = app(st); await c.licSupprimer("A");
    assert.equal(st.players.length, 1); assert.deepEqual(st.teams[0].members, ["p1"]);
  });
});
