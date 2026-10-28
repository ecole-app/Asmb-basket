// Numérotation des factures sponsors (js/17-sponsors.js) : lecture-puis-écriture
// d'un compteur partagé, sans transaction (risque assumé, voir le commentaire du
// code). Une régression ici veut dire des numéros de facture dupliqués ou
// sautés — un vrai problème de conformité comptable, pas juste un affichage.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(prochainNumero) {
  const c = charger(["js/17-sponsors.js"]);
  c.ecritures = [];
  c.CURRENT_CLUB_ID = "A";
  c.fbDb = {};
  c.fbDoc = (_db, ...segs) => segs.join("/");
  c.fbSetDoc = (ref, maj) => { c.ecritures.push({ ref, maj }); return Promise.resolve(); };
  c.fbGetDoc = () => Promise.resolve({
    exists: () => prochainNumero != null,
    data: () => ({ prochainNumero }),
  });
  return c;
}
function sansFirebase() {
  const c = charger(["js/17-sponsors.js"]);
  c.ecritures = [];
  c.fbDb = undefined;
  c.fbGetDoc = undefined;
  return c;
}
function reserver(c) { return new Promise((resolve) => c.reserverNumeroFacture(resolve)); }

describe("Premier numéro (loadFactureCounter)", () => {
  it("sans Firebase disponible : on démarre à 1 quand même", async () => {
    const c = sansFirebase();
    assert.equal(await reserver(c), "FAC-00001");
  });
  it("aucun compteur enregistré en base : démarre à 1", async () => {
    const c = app(null);
    assert.equal(await reserver(c), "FAC-00001");
  });
  it("reprend le compteur existant en base", async () => {
    const c = app(42);
    assert.equal(await reserver(c), "FAC-00042");
  });
});

describe("Réservation d'un numéro (reserverNumeroFacture)", () => {
  it("formate sur 5 chiffres", async () => {
    const c = app(7);
    assert.equal(await reserver(c), "FAC-00007");
  });
  it("au-delà de 5 chiffres : pas de troncature", async () => {
    const c = app(100000);
    assert.equal(await reserver(c), "FAC-100000");
  });
  it("persiste le compteur incrémenté (le suivant, pas celui qu'on vient de donner)", async () => {
    const c = app(10);
    const numero = await reserver(c);
    assert.equal(numero, "FAC-00010");
    assert.equal(c.ecritures.length, 1);
    assert.equal(c.ecritures[0].maj.prochainNumero, 11);
  });
  it("réservations successives dans la même session : jamais deux fois le même numéro", async () => {
    const c = app(1);
    const a = await reserver(c);
    const b = await reserver(c);
    const d = await reserver(c);
    assert.deepEqual([a, b, d], ["FAC-00001", "FAC-00002", "FAC-00003"]);
    assert.equal(c.ecritures.length, 3);
    assert.equal(c.ecritures[2].maj.prochainNumero, 4);
  });
  it("le compteur n'est lu qu'une fois en base, même après plusieurs réservations", async () => {
    const c = app(1);
    let lectures = 0;
    const vraiGetDoc = c.fbGetDoc;
    c.fbGetDoc = (...a) => { lectures++; return vraiGetDoc(...a); };
    await reserver(c); await reserver(c); await reserver(c);
    assert.equal(lectures, 1);
  });
});

describe("Compteur de facture sans club actif (écran de connexion)", () => {
  it("ne plante pas et ne met rien en cache : « Aucun club actif pour accéder à facturation_compteur »", () => {
    const c = charger(["js/17-sponsors.js"]);
    c.fbDb = {};
    c.fbGetDoc = () => { throw new Error("ne doit pas lire"); };
    c.fbDoc = () => { throw new Error("Aucun club actif pour accéder à 'facturation_compteur'"); };
    let appele = false;
    assert.doesNotThrow(() => c.loadFactureCounter(() => { appele = true; }));
    assert.equal(appele, false);
    assert.equal(c.SP_FACT_COUNTER, null);
    assert.doesNotThrow(() => c.remplirProchainNumeroFacture());
  });
});
