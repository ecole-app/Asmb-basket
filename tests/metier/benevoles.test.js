// Bénévoles placés sur un événement (js/14g-benevoles.js) : le vrai risque
// n'est pas l'argent mais la fiabilité du rappel — un bénévole qui n'est
// jamais relancé, ou relancé tous les jours à tort, c'est un poste vide le
// jour J. On teste le calcul de jours et la cadence exacte des rappels
// (J-14, J-7, puis tous les jours à partir de J-5).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

// Construit une date locale Y-M-D à N jours d'aujourd'hui, indépendamment du
// module (sert à vérifier son calcul, pas à le réutiliser).
function ladate(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function app(events = []) {
  const c = charger(["js/14g-benevoles.js"], { getEvents: () => events, eventTypeLabel: () => "" });
  return c;
}

describe("Jours avant l'événement (benJoursAvant)", () => {
  it("aujourd'hui, demain, hier, dans 14 jours", () => {
    const c = app();
    assert.equal(c.benJoursAvant(ladate(0)), 0);
    assert.equal(c.benJoursAvant(ladate(1)), 1);
    assert.equal(c.benJoursAvant(ladate(-1)), -1);
    assert.equal(c.benJoursAvant(ladate(14)), 14);
  });
});

describe("Libellé du délai (benQuand)", () => {
  it("aujourd'hui, demain, puis « dans N jours »", () => {
    const c = app();
    assert.equal(c.benQuand(0), "aujourd'hui");
    assert.equal(c.benQuand(1), "demain");
    assert.equal(c.benQuand(5), "dans 5 jours");
  });
});

describe("Cadence des rappels (benARappeler)", () => {
  const x = (j) => ({ e: { id: "e1" }, m: { id: "m1" }, j });
  it("jamais vu : toujours rappelé, quel que soit le délai", () => {
    const c = app();
    assert.equal(c.benARappeler(x(13)), true);
    assert.equal(c.benARappeler(x(9)), true);
  });
  it("déjà vu, hors des jours de rappel (J-14, J-7, J-5 à J-0) : pas de rappel", () => {
    const c = app();
    const m = x(13);
    c.benLs(c.benCle(m, "vu"), "1");
    assert.equal(c.benARappeler(m), false);
    const m2 = x(10);
    c.benLs(c.benCle(m2, "vu"), "1");
    assert.equal(c.benARappeler(m2), false);
    const m3 = x(6);
    c.benLs(c.benCle(m3, "vu"), "1");
    assert.equal(c.benARappeler(m3), false);
  });
  it("déjà vu mais J-14 ou J-7 pile : rappelé quand même (point d'étape)", () => {
    const c = app();
    const m14 = x(14); c.benLs(c.benCle(m14, "vu"), "1");
    assert.equal(c.benARappeler(m14), true);
    const m7 = x(7); c.benLs(c.benCle(m7, "vu"), "1");
    assert.equal(c.benARappeler(m7), true);
  });
  it("déjà vu, dans la fenêtre J-5 à J-0 : rappelé tous les jours", () => {
    const c = app();
    [5, 4, 3, 2, 1, 0].forEach((j) => {
      const m = x(j); c.benLs(c.benCle(m, "vu"), "1");
      assert.equal(c.benARappeler(m), true, "j=" + j);
    });
  });
  it("rappel fermé aujourd'hui : masqué même si on serait dans la fenêtre", () => {
    const c = app();
    const m = x(0);
    c.benLs(c.benCle(m, "ferme"), c.benJourLocal());
    assert.equal(c.benARappeler(m), false);
  });
});

describe("Mes missions à venir (benMesMissions)", () => {
  it("ne garde que les missions de ce compte, dans les 14 prochains jours", () => {
    const c = app([
      { id: "e1", date: ladate(3), benevoles: [{ id: "m1", uid: "moi", poste: "Buvette" }] },
      { id: "e2", date: ladate(3), benevoles: [{ id: "m2", uid: "quelquun-dautre", poste: "Chrono" }] },
      { id: "e3", date: ladate(20), benevoles: [{ id: "m3", uid: "moi", poste: "Accueil" }] }, // trop loin
      { id: "e4", date: ladate(-1), benevoles: [{ id: "m4", uid: "moi", poste: "Installation" }] }, // passé
    ]);
    c.ASMB_USER = { uid: "moi" };
    const mm = c.benMesMissions();
    assert.deepEqual([...mm.map((x) => x.m.id)], ["m1"]);
  });
  it("événement annulé : jamais de rappel", () => {
    const c = app([{ id: "e1", date: ladate(2), cancelled: true, benevoles: [{ id: "m1", uid: "moi" }] }]);
    c.ASMB_USER = { uid: "moi" };
    assert.equal(c.benMesMissions().length, 0);
  });
  it("triées par date puis heure", () => {
    const c = app([
      { id: "e1", date: ladate(5), heure: "20h", benevoles: [{ id: "m1", uid: "moi" }] },
      { id: "e2", date: ladate(2), heure: "10h", benevoles: [{ id: "m2", uid: "moi" }] },
      { id: "e3", date: ladate(2), heure: "09h", benevoles: [{ id: "m3", uid: "moi" }] },
    ]);
    c.ASMB_USER = { uid: "moi" };
    assert.deepEqual([...c.benMesMissions().map((x) => x.m.id)], ["m3", "m2", "m1"]);
  });
  it("sans compte connecté : aucune mission", () => {
    const c = app([{ id: "e1", date: ladate(2), benevoles: [{ id: "m1", uid: "moi" }] }]);
    c.ASMB_USER = null;
    assert.deepEqual([...c.benMesMissions()], []);
  });
});

describe("Missions d'un bénévole du carnet (benMissionsDe)", () => {
  it("ne garde que les missions de ce bénévole, événements passés exclus", () => {
    const c = app([
      { id: "e1", date: ladate(3), titre: "Match", benevoles: [{ id: "m1", benId: "ben1", poste: "Buvette" }] },
      { id: "e2", date: ladate(-1), benevoles: [{ id: "m2", benId: "ben1", poste: "Chrono" }] },
      { id: "e3", date: ladate(3), benevoles: [{ id: "m3", benId: "ben2", poste: "Accueil" }] },
    ]);
    const l = c.benMissionsDe("ben1");
    assert.equal(l.length, 1);
    assert.equal(l[0].poste, "Buvette");
  });
  it("plafonné à 40 missions", () => {
    const c = app(Array.from({ length: 50 }, (_, i) => ({ id: "e" + i, date: ladate(1), benevoles: [{ id: "m" + i, benId: "ben1" }] })));
    assert.equal(c.benMissionsDe("ben1").length, 40);
  });
});
