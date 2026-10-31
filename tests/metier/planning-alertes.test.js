// Conflits de salle et bénévoles manquants (js/12b-planning-alertes.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const t = (x) => JSON.parse(JSON.stringify(x));
const J = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
function app(events) {
  return charger(["js/12b-planning-alertes.js"], {
    getEvents: () => events, eventTypeLabel: (t) => t,
    authEsc: (s) => String(s),
  });
}

describe("Conflit de salle", () => {
  it("lit les horaires sous toutes les formes", () => {
    const c = app([]);
    assert.deepEqual(t(c.plHoraire({ heure: "17h30 - 19h00" })), [1050, 1140]);
    assert.deepEqual(t(c.plHoraire({ heure: "17:30-19:00" })), [1050, 1140]);
    assert.deepEqual(t(c.plHoraire({ heure: "18h", type: "entrainement" })), [1080, 1170]);
    assert.deepEqual(t(c.plHoraire({ heure: "15h00", type: "match" })), [900, 1020]);
    assert.equal(c.plHoraire({ heure: "" }), null);
  });
  it("même jour, même salle, horaires qui se chevauchent", () => {
    const a = { id: "a", date: J(2), lieu: "Gymnase Giraudet", heure: "17h30 - 19h00" };
    const b = { id: "b", date: J(2), lieu: "gymnase  giraudet", heure: "18h30 - 20h00" };
    const c = { id: "c", date: J(2), lieu: "Gymnase Giraudet", heure: "19h00 - 20h30" };
    const d = { id: "d", date: J(3), lieu: "Gymnase Giraudet", heure: "17h30 - 19h00" };
    const e = { id: "e", date: J(2), lieu: "Gymnase Giraudet", heure: "18h00", cancelled: true };
    const ctx = app([a, b, c, d, e]);
    assert.deepEqual(ctx.plConflitsDe(a).map((x) => x.id), ["b"]);
    assert.deepEqual(ctx.plConflitsDe(c).map((x) => x.id), ["b"]); // 19h-20h30 touche 18h30-20h, pas 17h30-19h
    assert.equal(ctx.plConflitsDe(d).length, 0);
    assert.equal(ctx.plConflitsAVenir(14).length, 2);
  });
  it("lieux génériques ignorés (extérieur, vide)", () => {
    const a = { id: "a", date: J(1), lieu: "Extérieur", heure: "15h" }, b = { id: "b", date: J(1), lieu: "À l'extérieur", heure: "15h" };
    const c = { id: "c", date: J(1), lieu: "", heure: "15h" }, d = { id: "d", date: J(1), lieu: "", heure: "15h" };
    assert.equal(app([a, b, c, d]).plConflitsAVenir(14).length, 0);
  });
});

describe("Bénévoles à J-7", () => {
  it("match à domicile : table de marque et chronomètre attendus", () => {
    const c = app([]);
    assert.deepEqual(t(c.plBenManquants({ type: "match", lieu: "Domicile", benevoles: [] })), ["table de marque", "chronomètre"]);
    assert.deepEqual(t(c.plBenManquants({ type: "match", lieu: "Domicile", benevoles: [{ poste: "Table de marque" }] })), ["chronomètre"]);
    assert.equal(c.plBenManquants({ type: "match", lieu: "Domicile", benevoles: [{ poste: "Table de marque" }, { poste: "Chronomètre" }] }), null);
    assert.equal(c.plBenManquants({ type: "match", lieu: "Extérieur", benevoles: [] }), null);
    assert.deepEqual(t(c.plBenManquants({ type: "tournoi", benevoles: [] })), ["aucun bénévole"]);
    assert.equal(c.plBenManquants({ type: "entrainement" }), null);
  });
  it("seulement dans les 7 jours et pour les événements validés", () => {
    const ev = [
      { id: "1", type: "match", lieu: "Domicile", date: J(3), titre: "M1" },
      { id: "2", type: "match", lieu: "Domicile", date: J(10), titre: "M2" },
      { id: "3", type: "match", lieu: "Domicile", date: J(2), titre: "M3", statut: "attente" },
      { id: "4", type: "match", lieu: "Domicile", date: J(-1), titre: "M4" },
    ];
    assert.deepEqual(app(ev).plBenAlertes().map((x) => x.e.id), ["1"]);
  });
});
