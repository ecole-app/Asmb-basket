// Plateforme (super admin, js/20b-plateforme.js) : cycle de vie d'un club
// (suspension → régularisation → suppression possible), échéance d'abonnement
// et identifiants générés. aboARappeler/expirerEssaisPerimes/gmPlusUnAn sont
// déjà testés dans packs.test.js ; ici, ce qui ne l'était pas encore — à
// commencer par delaiDepasse, qui décide quand un club suspendu devient
// supprimable.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger, jours } from "./contexte.js";

function app() { return charger(["js/20b-plateforme.js"]); }

describe("Normalisation d'une date (gmDate)", () => {
  it("Timestamp Firestore (.toDate), vraie Date, chaîne ISO", () => {
    const c = app();
    const d = new Date("2026-11-01");
    assert.equal(c.gmDate({ toDate: () => d }).getTime(), d.getTime());
    assert.equal(c.gmDate(d).getTime(), d.getTime());
    assert.equal(c.gmDate("2026-11-01").getTime(), d.getTime());
  });
  it("valeur absente ou invalide : null, jamais une exception", () => {
    const c = app();
    assert.equal(c.gmDate(null), null);
    assert.equal(c.gmDate(undefined), null);
    assert.equal(c.gmDate("n'importe quoi"), null);
  });
});

describe("Délai de régularisation après suspension (joursRestants / delaiDepasse)", () => {
  it("club non suspendu (pas de graceUntil) : pas de délai à afficher", () => {
    const c = app();
    assert.equal(c.joursRestants({}), null);
    assert.equal(c.delaiDepasse({}), false);
  });
  it("délai encore en cours : jours positifs, pas encore supprimable", () => {
    const c = app();
    assert.equal(c.joursRestants({ graceUntil: jours(5) }), 5);
    assert.equal(c.delaiDepasse({ graceUntil: jours(5) }), false);
  });
  it("délai pile à zéro ou dépassé : supprimable", () => {
    const c = app();
    assert.equal(c.delaiDepasse({ graceUntil: jours(0) }), true);
    assert.equal(c.delaiDepasse({ graceUntil: jours(-3) }), true);
    assert.equal(c.joursRestants({ graceUntil: jours(-3) }), -3);
  });
});

describe("Échéance d'abonnement (aboEcheance / aboJours)", () => {
  it("pas d'échéance enregistrée : rien à afficher", () => {
    const c = app();
    assert.equal(c.aboEcheance({}), null);
    assert.equal(c.aboJours({}), null);
  });
  it("jours restants avant l'échéance, arrondis au jour supérieur", () => {
    const c = app();
    const dans10j = new Date(Date.now() + 10 * 86400000 + 1000); // un peu plus de 10 jours pile
    assert.equal(c.aboJours({ aboEcheance: dans10j }), 11);
  });
  it("échéance déjà passée : jours négatifs", () => {
    const c = app();
    assert.ok(c.aboJours({ aboEcheance: jours(-5) }) < 0);
  });
});

describe("Libellé du pack (packLabel)", () => {
  it("un libellé par plan, y compris l'ancien « payant » sans équivalent", () => {
    const c = app();
    assert.equal(c.packLabel({ plan: "gratuit" }), "Gratuit");
    assert.equal(c.packLabel({ plan: "standard" }), "Standard");
    assert.equal(c.packLabel({ plan: "premium" }), "Premium");
    assert.equal(c.packLabel({ plan: "trial" }), "Essai");
    assert.equal(c.packLabel({ plan: "limite" }), "Limité");
    assert.equal(c.packLabel({ plan: "paid" }), "Payant (complet)");
    assert.equal(c.packLabel({}), "Payant (complet)");
  });
});

describe("Identifiant d'un nouveau club (gmSlug)", () => {
  it("minuscules, accents retirés, espaces en tirets", () => {
    const c = app();
    assert.equal(c.gmSlug("Étoile de Lyon"), "etoile-de-lyon");
  });
  it("caractères spéciaux réduits à des tirets, pas de tiret en tête/fin", () => {
    const c = app();
    assert.equal(c.gmSlug("  C.O. Basket !! "), "c-o-basket");
  });
  it("plafonné à 24 caractères", () => {
    const c = app();
    assert.ok(c.gmSlug("Un Tres Tres Tres Long Nom De Club Basket").length <= 24);
  });
  it("vide ou uniquement des symboles : repli sur « club »", () => {
    const c = app();
    assert.equal(c.gmSlug(""), "club");
    assert.equal(c.gmSlug("!!!"), "club");
    assert.equal(c.gmSlug(undefined), "club");
  });
});

describe("Identifiant d'un compte joueur (identifiantJoueur)", () => {
  it("adresse au format attendu, sur le sous-domaine réservé", () => {
    const c = app();
    const id = c.identifiantJoueur();
    assert.match(id, /^[a-z0-9]{12}@joueur\.generalmanagerapp\.fr$/);
  });
  it("deux appels ne donnent jamais le même identifiant", () => {
    const c = app();
    assert.notEqual(c.identifiantJoueur(), c.identifiantJoueur());
  });
});
