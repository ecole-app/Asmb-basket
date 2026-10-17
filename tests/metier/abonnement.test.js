// Abonnement (gel, résiliation, report d'échéance) — js/08b-abonnement.js.
// aboEcheance() vit dans 20b-plateforme.js (super admin) : on la simule ici
// plutôt que de charger tout ce module, pour rester un test unitaire ciblé.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger, jours } from "./contexte.js";

function app() {
  const c = charger(["js/08b-abonnement.js"], {
    aboEcheance: (club) => (club && club.aboEcheance ? new Date(club.aboEcheance) : null),
  });
  c.ecritures = [];
  c.fbDb = {};
  c.fbDoc = (_db, ...segs) => segs.join("/");
  c.fbUpdateDoc = (ref, maj) => { c.ecritures.push({ ref, maj }); return Promise.resolve(); };
  return c;
}

describe("Gel actif (aboGelActif)", () => {
  it("aucun gel : rien d'actif", () => {
    const c = app();
    assert.equal(c.aboGelActif({ aboGels: [] }), null);
  });
  it("gel en cours (début passé, fin à venir, jamais relancé) : actif", () => {
    const c = app();
    const g = { debut: jours(-5).getTime(), fin: jours(10).getTime() };
    assert.equal(c.aboGelActif({ aboGels: [g] }), g);
  });
  it("gel relancé manuellement : plus actif même si la fin prévue n'est pas passée", () => {
    const c = app();
    const g = { debut: jours(-5).getTime(), fin: jours(10).getTime(), relanceLe: Date.now() };
    assert.equal(c.aboGelActif({ aboGels: [g] }), null);
  });
  it("gel déjà terminé (fin passée, jamais relancé) : plus actif", () => {
    const c = app();
    const g = { debut: jours(-30).getTime(), fin: jours(-1).getTime() };
    assert.equal(c.aboGelActif({ aboGels: [g] }), null);
  });
  it("plusieurs gels dans l'historique : seul celui en cours ressort", () => {
    const c = app();
    const vieux = { debut: jours(-60).getTime(), fin: jours(-30).getTime() };
    const courant = { debut: jours(-2).getTime(), fin: jours(5).getTime() };
    assert.equal(c.aboGelActif({ aboGels: [vieux, courant] }), courant);
  });
});

describe("Pack payant (aboEstPayant)", () => {
  it("standard, premium et paid (ancien) sont payants", () => {
    const c = app();
    assert.equal(c.aboEstPayant({ plan: "standard" }), true);
    assert.equal(c.aboEstPayant({ plan: "premium" }), true);
    assert.equal(c.aboEstPayant({ plan: "paid" }), true);
  });
  it("essai, gratuit et accès limité ne sont pas payants", () => {
    const c = app();
    assert.equal(c.aboEstPayant({ plan: "trial" }), false);
    assert.equal(c.aboEstPayant({ plan: "gratuit" }), false);
    assert.equal(c.aboEstPayant({ plan: "limite" }), false);
    assert.equal(c.aboEstPayant({}), false);
  });
});

describe("Libellé du pack (aboPackTxt)", () => {
  it("chaque pack a son nom et son prix par défaut", () => {
    const c = app();
    assert.deepEqual({ ...c.aboPackTxt({ plan: "premium" }) }, { nom: "Premium", prix: "300 €/an" });
    assert.deepEqual({ ...c.aboPackTxt({ plan: "standard" }) }, { nom: "Standard", prix: "200 €/an" });
    assert.deepEqual({ ...c.aboPackTxt({ plan: "gratuit" }) }, { nom: "Offre gratuite", prix: "0 €" });
    assert.deepEqual({ ...c.aboPackTxt({ plan: "trial" }) }, { nom: "Essai gratuit", prix: "0 €" });
    assert.deepEqual({ ...c.aboPackTxt({ plan: "limite" }) }, { nom: "Accès limité", prix: "" });
    assert.deepEqual({ ...c.aboPackTxt({}) }, { nom: "Complet", prix: "" });
  });
});

describe("Notification d'abonnement (aboNotif)", () => {
  it("garde le type et tronque le détail à 200 caractères", () => {
    const c = app();
    const n = c.aboNotif("gel", "x".repeat(250));
    assert.equal(n.t, "gel");
    assert.equal(n.vu, false);
    assert.equal(n.detail.length, 200);
    assert.ok(Math.abs(Date.now() - n.le) < 1000);
  });
});

describe("Report d'échéance après un gel (aboTraiterGels)", () => {
  it("gel terminé naturellement : marqué reporté, échéance repoussée du nombre de jours gelés, fin de gel remise à zéro", async () => {
    const c = app();
    const debut = jours(-20).getTime(), fin = jours(-10).getTime(); // 10 jours de gel
    const club = { id: "A", aboGels: [{ debut, fin }], aboGelFin: fin, aboEcheance: jours(5).toISOString() };
    const echeanceAvant = new Date(club.aboEcheance).getTime();
    await c.aboTraiterGels([club]);
    assert.equal(c.ecritures.length, 1);
    const maj = c.ecritures[0].maj;
    assert.equal(maj.aboGels[0].reporte, true);
    assert.equal(maj.aboGelFin, 0);
    assert.equal(maj.aboEcheance.getTime(), echeanceAvant + 10 * 86400000);
  });

  it("gel relancé avant son terme prévu : seuls les jours réellement gelés comptent", async () => {
    const c = app();
    const debut = jours(-10).getTime();
    const finPrevue = jours(20).getTime();     // gel prévu pour 30 jours...
    const relanceLe = jours(-4).getTime();     // ...mais relancé après seulement 6 jours
    const club = { id: "A", aboGels: [{ debut, fin: finPrevue, relanceLe }], aboEcheance: jours(5).toISOString() };
    const echeanceAvant = new Date(club.aboEcheance).getTime();
    await c.aboTraiterGels([club]);
    const maj = c.ecritures[0].maj;
    assert.equal(maj.aboEcheance.getTime(), echeanceAvant + 6 * 86400000);
  });

  it("gel déjà reporté : aucune écriture (jamais compté deux fois)", async () => {
    const c = app();
    const club = { id: "A", aboGels: [{ debut: jours(-20).getTime(), fin: jours(-10).getTime(), reporte: true }], aboEcheance: jours(5).toISOString() };
    await c.aboTraiterGels([club]);
    assert.equal(c.ecritures.length, 0);
  });

  it("un gel déjà traité et un nouveau sur le même club : seul le nouveau compte dans le report", async () => {
    const c = app();
    const ancien = { debut: jours(-100).getTime(), fin: jours(-90).getTime(), reporte: true }; // 10 j déjà reportés
    const nouveau = { debut: jours(-20).getTime(), fin: jours(-15).getTime() }; // 5 j à reporter
    const club = { id: "A", aboGels: [ancien, nouveau], aboEcheance: jours(5).toISOString() };
    const echeanceAvant = new Date(club.aboEcheance).getTime();
    await c.aboTraiterGels([club]);
    const maj = c.ecritures[0].maj;
    assert.equal(maj.aboEcheance.getTime(), echeanceAvant + 5 * 86400000);
    assert.equal(maj.aboGels[0].reporte, true);
    assert.equal(maj.aboGels[1].reporte, true);
  });

  it("gel toujours en cours : aucune écriture tant qu'il n'est pas terminé ni relancé", async () => {
    const c = app();
    const club = { id: "A", aboGels: [{ debut: jours(-2).getTime(), fin: jours(10).getTime() }], aboEcheance: jours(5).toISOString() };
    await c.aboTraiterGels([club]);
    assert.equal(c.ecritures.length, 0);
  });

  it("aucun gel du tout : pas d'erreur, pas d'écriture", async () => {
    const c = app();
    const club = { id: "A", aboGels: [] };
    await c.aboTraiterGels([club]);
    assert.equal(c.ecritures.length, 0);
  });
});
