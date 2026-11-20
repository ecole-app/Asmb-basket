// Lecture d'un ticket (js/15c-compta-ticket.js) : passe par la fonction serveur lireTicket
// (jeton de connexion, photo, catégories), JSON vérifié, quota, aucune clé dans le fichier.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { charger } from "./contexte.js";

const TEXTE = JSON.stringify({ date: new Date().toISOString().slice(0, 10), montant: 12.5, fournisseur: "Decathlon", description: "ballons", categorie: "Matériel sportif", moyen: "CB" });
function app(reponse, appels, connecte = true) {
  const ctrl = function () { this.signal = {}; this.abort = () => {}; };
  return charger(["js/15-compta-inventaire.js", "js/15c-compta-ticket.js"], {
    AbortController: ctrl,
    fbAuth: { currentUser: connecte ? { getIdToken: () => Promise.resolve("JETON") } : null },
    COMPTA_CATS: { depense: ["Matériel sportif", "Autre"], recette: [] },
    fetch: (url, o) => {
      appels.push({ url, auth: o.headers.Authorization, corps: JSON.parse(o.body) });
      return Promise.resolve({ status: reponse.st, json: () => Promise.resolve(reponse.corps) });
    },
  });
}

describe("Photo de ticket → serveur lireTicket", () => {
  it("réponse du serveur : JSON vérifié, jeton et catégories envoyés", async () => {
    const appels = []; const c = app({ st: 200, corps: { ok: true, texte: TEXTE, modele: "m" } }, appels);
    const r = await c.comptaTicketServeur("data:image/jpeg;base64,AAAA");
    assert.equal(r.montant, 12.5); assert.equal(r.fournisseur, "Decathlon"); assert.equal(r.moyen, "CB");
    assert.match(appels[0].url, /lireTicket$/);
    assert.equal(appels[0].auth, "Bearer JETON");
    assert.equal(appels[0].corps.image, "AAAA");
    assert.ok(appels[0].corps.categories.length > 0);
  });
  it("quota atteint (429) : erreur « quota »", async () => {
    const c = app({ st: 429, corps: { erreur: "quota" } }, []);
    await assert.rejects(c.comptaTicketServeur("data:image/jpeg;base64,AAAA"), (e) => e.detail === "quota");
  });
  it("échec de l'IA : détail du serveur", async () => {
    const c = app({ st: 502, corps: { erreur: "ia", detail: "m trop long" } }, []);
    await assert.rejects(c.comptaTicketServeur("data:image/jpeg;base64,AAAA"), (e) => /502.*trop long/.test(e.detail));
  });
  it("pas connecté : aucun appel", async () => {
    const appels = []; const c = app({ st: 200, corps: {} }, appels, false);
    await assert.rejects(c.comptaTicketServeur("data:image/jpeg;base64,AAAA"));
    assert.equal(appels.length, 0);
  });
  it("aucune clé secrète ni OpenRouter dans le fichier", () => {
    const src = readFileSync(new URL("../../js/15c-compta-ticket.js", import.meta.url), "utf8");
    assert.ok(!/sk-or-|sk-ant-|openrouter/i.test(src));
  });
});
