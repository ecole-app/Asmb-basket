// Billetterie des événements (tarifs, jours au choix, places) — js/14b-billetterie.js.
// evtMontant/evtTotalTxt sont le calcul du montant facturé à une famille : une
// erreur de rounding ou de bascule forfait/par-jour se traduit par un vrai
// sur- ou sous-paiement.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app() {
  return charger(["js/14b-billetterie.js"]);
}

describe("Prix affiché (evtPrix / evtTarifTxt)", () => {
  it("formate en virgule française, arrondi au centime", () => {
    const c = app();
    assert.equal(c.evtPrix(12.5), "12,5 €");
    assert.equal(c.evtPrix(10), "10 €");
    assert.equal(c.evtPrix(9.999), "10 €");
    assert.equal(c.evtPrix("abc"), "0 €");
  });
  it("gratuit en dessous ou à zéro, sinon le prix", () => {
    const c = app();
    assert.equal(c.evtTarifTxt(0), "Gratuit");
    assert.equal(c.evtTarifTxt(-5), "Gratuit");
    assert.equal(c.evtTarifTxt(15), "15 €");
  });
});

describe("Plage de jours (evtJoursPlage)", () => {
  it("un seul jour sans date de fin", () => {
    const c = app();
    assert.deepEqual([...c.evtJoursPlage("2026-07-10", "")], ["2026-07-10"]);
  });
  it("plage normale, bornes incluses", () => {
    const c = app();
    assert.deepEqual([...c.evtJoursPlage("2026-07-10", "2026-07-12")], ["2026-07-10", "2026-07-11", "2026-07-12"]);
  });
  it("fin antérieure au début : repli sur un seul jour", () => {
    const c = app();
    assert.deepEqual([...c.evtJoursPlage("2026-07-10", "2026-07-05")], ["2026-07-10"]);
  });
  it("plafonné à 14 jours même si la plage demandée est plus longue", () => {
    const c = app();
    assert.equal(c.evtJoursPlage("2026-07-01", "2026-08-01").length, 14);
  });
  it("date vide : aucun jour", () => {
    const c = app();
    assert.deepEqual([...c.evtJoursPlage("", "")], []);
  });
});

describe("Montant facturé (evtMontant) — par jour vs forfait", () => {
  it("sans tarif ou sans jour sélectionné : 0", () => {
    const c = app();
    assert.equal(c.evtMontant(null, ["2026-07-10"], 5), 0);
    assert.equal(c.evtMontant({ prix: 10 }, [], 5), 0);
  });
  it("au jour le jour quand tous les jours ne sont pas pris", () => {
    const c = app();
    const t = { prix: 10, forfait: 25 };
    assert.equal(c.evtMontant(t, ["a", "b", "c"], 5), 30); // 3 jours sur 5 : pas le forfait
  });
  it("le forfait s'applique seulement si TOUS les jours du stage sont pris", () => {
    const c = app();
    const t = { prix: 10, forfait: 25 };
    assert.equal(c.evtMontant(t, ["a", "b", "c", "d", "e"], 5), 25);
  });
  it("pas de forfait saisi : toujours au jour le jour, même tous les jours pris", () => {
    const c = app();
    const t = { prix: 10, forfait: 0 };
    assert.equal(c.evtMontant(t, ["a", "b", "c"], 3), 30);
  });
  it("arrondi correct au centime (pas d'erreur de flottant)", () => {
    const c = app();
    const t = { prix: 3.333 };
    assert.equal(c.evtMontant(t, ["a", "b", "c"], 10), 10);
  });
});

describe("Texte du total (evtTotalTxt)", () => {
  it("aucun jour choisi : invite à en choisir", () => {
    const c = app();
    assert.equal(c.evtTotalTxt({ prix: 10 }, [], 5), "Choisissez au moins un jour");
  });
  it("gratuit : l'indique avec le nombre de jours", () => {
    const c = app();
    assert.equal(c.evtTotalTxt({ prix: 0 }, ["a", "b"], 5), "Gratuit · 2 jours");
  });
  it("au jour le jour : total et nombre de jours", () => {
    const c = app();
    assert.equal(c.evtTotalTxt({ prix: 10 }, ["a", "b"], 5), "Total : 20 € · 2 jours");
  });
  it("forfait complet : libellé dédié, sans répéter le nombre de jours", () => {
    const c = app();
    assert.equal(c.evtTotalTxt({ prix: 10, forfait: 25 }, ["a", "b", "c"], 3), "Forfait tous les jours : 25 €");
  });
});

describe("Places restantes (evtPlacesTxt)", () => {
  it("pas de limite de places : rien à afficher", () => {
    const c = app();
    assert.equal(c.evtPlacesTxt(0, 12), "");
  });
  it("places restantes classiques", () => {
    const c = app();
    assert.equal(c.evtPlacesTxt(20, 15), "5 places restantes");
  });
  it("une seule place : singulier spécifique", () => {
    const c = app();
    assert.equal(c.evtPlacesTxt(20, 19), "Dernière place !");
  });
  it("complet, y compris en cas de sur-réservation", () => {
    const c = app();
    assert.equal(c.evtPlacesTxt(20, 20), "Complet");
    assert.equal(c.evtPlacesTxt(20, 25), "Complet");
  });
});

describe("Inscriptions ouvertes (evtOuvertes)", () => {
  const dansNjours = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  it("inscriptions non activées : fermé", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(5), inscr: { actif: false } }), false);
  });
  it("pas de bloc inscriptions du tout : fermé", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(5) }), false);
  });
  it("date limite dépassée : fermé même si l'événement est à venir", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(5), inscr: { actif: true, limite: dansNjours(-1) } }), false);
  });
  it("date limite à venir : ouvert", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(5), inscr: { actif: true, limite: dansNjours(2) } }), true);
  });
  it("sans date limite, événement passé : fermé", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(-2), inscr: { actif: true } }), false);
  });
  it("événement sur plusieurs jours : ouvert tant que la dernière date n'est pas passée", () => {
    const c = app();
    assert.equal(c.evtOuvertes({ date: dansNjours(-2), dateFin: dansNjours(1), inscr: { actif: true } }), true);
  });
});

describe("Code du billet (evtCode)", () => {
  it("préfixe correct selon le type, 5 chiffres + 4 caractères non devinables", () => {
    const c = app();
    assert.match(c.evtCode("stage"), /^STG-\d{5}-[A-HJ-NP-Z2-9]{4}$/);
    assert.match(c.evtCode("tournoi"), /^TRN-\d{5}-[A-HJ-NP-Z2-9]{4}$/);
    assert.match(c.evtCode("soiree"), /^SOI-\d{5}-[A-HJ-NP-Z2-9]{4}$/);
    assert.match(c.evtCode("autre"), /^EVT-\d{5}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("les codes ne se répètent pas (1000 tirages)", () => {
    const c = app();
    const vus = new Set(); for (let i = 0; i < 1000; i++) vus.add(c.evtCode("stage"));
    assert.ok(vus.size >= 999);
  });
});
