// Équipe 1, 2, 3 d'un joueur (js/06h-roles.js) et à l'import (js/06f-import.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(players, teams) {
  const st = { players, teams, saved: null };
  const c = charger(["js/06f-import.js", "js/06h-roles.js"], {
    authEsc: (x) => x,
    licEstJoueur: (l) => !l || !l.role || l.role === "joueur",
    getPlayers: () => st.players, getTeams: () => st.teams,
    saveTeams: (t) => { st.teams = t; st.saved = true; },
  });
  c.st = st; Object.defineProperty(c, "eq", { value: (k) => JSON.parse(JSON.stringify(st[k])) });
  return c;
}
const lic = (over = {}) => ({ code: "A", categorie: "U11", equipe: 2, fiche: { nom: "Dupont", prenom: "Léa", naissance: "2015-03-12" }, ...over });
const joueur = { id: "p1", nom: "DUPONT", prenom: "léa", naissance: "2015-03-12" };

describe("Placement en équipe", () => {
  it("crée « U11 Équipe 2 » et y place le joueur", () => {
    const c = app([joueur], []); c.licEquipePlacer(lic());
    assert.equal(c.st.teams.length, 1);
    assert.deepEqual(c.eq("teams").map((t) => [t.name, t.cat, t.members]), [["U11 Équipe 2", "U11", ["p1"]]]);
  });
  it("réutilise l'équipe existante, sans doublon", () => {
    const c = app([joueur], [{ id: "t", name: "U11 Équipe 2", cat: "U11", members: ["p1"] }]);
    c.licEquipePlacer(lic()); assert.equal(c.st.teams.length, 1); assert.equal(c.st.teams[0].members.length, 1);
  });
  it("changer d'équipe retire de l'ancienne", () => {
    const c = app([joueur], [{ id: "t1", name: "U11 Équipe 1", cat: "U11", members: ["p1"] }]);
    c.licEquipePlacer(lic());
    const t = c.eq("teams");
    assert.deepEqual(t.find((x) => x.name === "U11 Équipe 1").members, []);
    assert.deepEqual(t.find((x) => x.name === "U11 Équipe 2").members, ["p1"]);
  });
  it("une équipe que le club a nommée autrement n'est pas touchée", () => {
    const c = app([joueur], [{ id: "t", name: "Les Aigles", cat: "U11", members: ["p1"] }]);
    c.licEquipePlacer(lic()); assert.deepEqual(c.eq("teams").find((t) => t.name === "Les Aigles").members, ["p1"]);
  });
  it("coach ou sans catégorie : rien", () => {
    const c = app([joueur], []);
    c.licEquipePlacer(lic({ role: "coach" })); c.licEquipePlacer(lic({ categorie: null }));
    assert.equal(c.st.teams.length, 0);
  });
});

describe("Équipe à l'import", () => {
  it("la fiche créée garde le numéro d'équipe choisi", () => {
    const c = app([], []); c.genCode = () => "Z"; c.CATS_LIC = ["U11"]; c.categorieFromNaissance = () => "U11";
    const lics = [];
    const res = { nouvelles: [{ n: 0, nom: "A", prenom: "B", naissance: "2016-01-01", genre: "M", categorie: "U11", role: "joueur" }], maj: [] };
    c.impAppliquer(res, lics, "2026-2027", { 0: 3 });
    assert.equal(lics[0].equipe, 3);
  });
});
