// Tableau des factures sponsors (js/17b-factures.js) : statut affiché (retard
// automatique), « payée » = une seule ligne de comptabilité (jamais en double),
// « remettre en attente » la retire, annuler garde la facture.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(factures = []) {
  const c = charger(["js/17b-factures.js"]);
  let compta = []; let liste = factures.map((f) => ({ ...f }));
  c.getFactures = () => liste; // remplace la lecture localStorage
  c.saveFactures = (l) => { liste = l; };
  c.getComptabilite = () => compta;
  c.saveComptabilite = (l) => { compta = l; };
  c.askConfirm = () => Promise.resolve(true);
  c.factOuvrir = () => {}; // l'écran n'est pas testé ici
  c.__etat = () => ({ liste, compta });
  return c;
}
const tick = () => new Promise((r) => setTimeout(r, 0));
const iso = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const fac = (o = {}) => ({ id: "f1", numero: "FAC-00001", client: "Boulangerie Martin", montantTtc: 250, date: iso(-20), echeance: iso(10), statut: "envoyee", ...o });

describe("Statut affiché d'une facture (factStatut)", () => {
  it("envoyée avant l'échéance : en attente ; après l'échéance : en retard", () => {
    const c = app();
    assert.equal(c.factStatut(fac({ echeance: iso(3) })), "attente");
    assert.equal(c.factStatut(fac({ echeance: iso(-1) })), "retard");
  });
  it("brouillon, payée, annulée : statut gardé tel quel, même échéance dépassée", () => {
    const c = app();
    for (const s of ["brouillon", "payee", "annulee"]) assert.equal(c.factStatut(fac({ statut: s, echeance: iso(-30) })), s);
  });
});

describe("Marquer payée / remettre en attente", () => {
  it("payée : une recette Sponsors/Partenaires du bon montant arrive en comptabilité", async () => {
    const c = app([fac()]);
    await c.factPayer("f1"); await tick();
    const { liste, compta } = c.__etat();
    assert.equal(liste[0].statut, "payee");
    assert.equal(compta.length, 1);
    assert.equal(compta[0].type, "recette"); assert.equal(compta[0].montant, 250);
    assert.equal(compta[0].categorie, "Sponsors/Partenaires"); assert.equal(compta[0].reference, "FAC-00001");
  });
  it("payée deux fois : toujours une seule ligne de comptabilité", async () => {
    const c = app([fac()]);
    await c.factPayer("f1"); await tick(); await c.factPayer("f1"); await tick();
    assert.equal(c.__etat().compta.length, 1);
  });
  it("remise en attente : la ligne de comptabilité disparaît, la facture reste", async () => {
    const c = app([fac()]);
    await c.factPayer("f1"); await tick(); await c.factRemettre("f1"); await tick();
    const { liste, compta } = c.__etat();
    assert.equal(compta.length, 0); assert.equal(liste[0].statut, "envoyee"); assert.equal(liste[0].comptaId, null);
  });
});

describe("Annuler et envoyer", () => {
  it("annuler : la facture est gardée (numéro non réutilisable), statut annulée", async () => {
    const c = app([fac()]);
    await c.factAnnuler("f1"); await tick();
    assert.equal(c.__etat().liste.length, 1); assert.equal(c.__etat().liste[0].statut, "annulee");
  });
});
