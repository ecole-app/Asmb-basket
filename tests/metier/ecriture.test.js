// Garde d'écriture de l'accès limité (fsWriteCollection, js/13-firestore-sync.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(club) {
  const c = charger(["js/11-admin.js", "js/13-firestore-sync.js"], { BOOTSTRAP_CLUB_ID: "asmb" });
  c.CURRENT_CLUB = club;
  c.CURRENT_CLUB_ID = club.id;
  c.envoyes = [];
  c.fbDb = {};
  c.fbDoc = (...a) => a.slice(1).join("/");
  c.fbSetDoc = (ref) => { c.envoyes.push(ref); return Promise.resolve(); };
  c.fbDeleteDoc = () => Promise.resolve();
  c.fbWriteBatch = () => ({ set: (ref) => c.envoyes.push(ref), delete() {}, commit: () => Promise.resolve() });
  return c;
}

describe("Accès limité : rien n'est envoyé hors des modules gardés", () => {
  it("un événement modifié en accès limité n'est pas enregistré", () => {
    const c = app({ id: "A", plan: "limite" });
    c.fsWriteCollection("events", [{ id: "e1", titre: "Match" }]);
    assert.equal(c.envoyes.length, 0);
  });
  it("une licence saisie en accès limité est bien enregistrée", () => {
    const c = app({ id: "A", plan: "limite" });
    c.fsWriteCollection("licences", [{ id: "l1", nom: "Martin" }]);
    assert.ok(c.envoyes.length > 0);
  });
  it("club normal : l'événement est enregistré", () => {
    const c = app({ id: "A", plan: "standard" });
    c.fsWriteCollection("events", [{ id: "e1", titre: "Match" }]);
    assert.ok(c.envoyes.length > 0);
  });
  it("session support : jamais d'écriture", () => {
    const c = app({ id: "A", plan: "premium" });
    c.SUPPORT_MODE = true;
    c.fsWriteCollection("licences", [{ id: "l1" }]);
    assert.equal(c.envoyes.length, 0);
  });
});
