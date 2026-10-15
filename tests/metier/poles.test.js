// Pôles (js/17b-poles-joueurs.js) : qui gère quel pôle, quels pôles ont des joueurs.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(user, club) {
  const c = charger(["js/01-config.js", "js/17b-poles-joueurs.js"]);
  c.ASMB_USER = user; c.CURRENT_CLUB = club;
  return c;
}
const club = { id: "x", poles: ["formation", "competition", "evenement", "3x3", "basketpourtous", "basketsante"], polesCoachs: { "3x3": [{ uid: "c1", nom: "Karim" }], formation: [{ uid: "c2", nom: "Lucie" }] } };

describe("Pôles", () => {
  it("seuls les pôles avec joueurs proposent des pastilles (pas Formation ni Événements)", () => {
    const c = app({ uid: "d", roles: ["dirigeant"] }, club);
    // Club Standard (hasPremium absent du contexte) : Compétition seulement
    assert.deepEqual(JSON.parse(JSON.stringify(c.polesJoueursActifs().map((p) => p.id))), ["competition"]);
  });
  it("Standard : 3 pôles ; Premium : + 3x3 et Basket Santé ; Basket Pour Tous jamais hors ASMB", () => {
    const ids = (c) => JSON.parse(JSON.stringify(c.activePoles().map((p) => p.id)));
    const std = app({ uid: "d", roles: ["dirigeant"] }, { id: "x", plan: "standard" });
    assert.deepEqual(ids(std), ["formation", "competition", "evenement"]);
    const prem = app({ uid: "d", roles: ["dirigeant"] }, { id: "x", plan: "premium" });
    prem.hasPremium = () => true;
    assert.deepEqual(ids(prem), ["formation", "competition", "3x3", "evenement", "basketsante"]);
    const asmb = app({ uid: "d", roles: ["dirigeant"] }, { id: "asmb" });
    assert.equal(ids(asmb).includes("basketpourtous"), true);
  });
  it("le dirigeant gère tous les pôles", () => {
    const c = app({ uid: "d", roles: ["dirigeant"] }, club);
    assert.equal(c.peutGererPole("competition"), true);
  });
  it("un coach ne gère que les pôles où le dirigeant l'a mis", () => {
    const c = app({ uid: "c1", roles: ["coach"] }, club);
    assert.equal(c.peutGererPole("3x3"), true);
    assert.equal(c.peutGererPole("competition"), false);
    const p = app({ uid: "c1", roles: ["parent"] }, club);
    assert.equal(p.peutGererPole("3x3"), false);
  });
  it("infos du pôle en texte court", () => {
    const c = app({ uid: "d", roles: ["dirigeant"] }, club);
    assert.equal(c.poleInfosTxt("elite", { niveau: "Espoir", objectif: "Sélection", depuis: "2026-09-01" }), "Espoir · Sélection");
  });
});

describe("Élite Academy", () => {
  it("réservée au club d'origine, même si un autre club l'avait dans sa liste", () => {
    const autre = app({ uid: "d", roles: ["dirigeant"] }, { id: "x", poles: ["formation", "elite", "competition"] });
    assert.equal(autre.activePoles().some((p) => p.id === "elite"), false);
    const asmb = app({ uid: "d", roles: ["dirigeant"] }, { id: "asmb" });
    assert.equal(asmb.activePoles().some((p) => p.id === "elite"), true);
  });
});
