// Lecture d'un ticket par Gemini (js/15c-compta-ticket.js) : ordre des modèles,
// repli quand un modèle est retiré (404), arrêt net si l'API n'est pas activée (403),
// aucune clé secrète dans le fichier.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { charger } from "./contexte.js";

const REPONSE = JSON.stringify({ date: new Date().toISOString().slice(0, 10), montant: 12.5, fournisseur: "Decathlon", description: "ballons", categorie: "Matériel sportif", moyen: "CB" });
function app(reponses, appels) {
  const ctrl = function () { this.signal = {}; this.abort = () => {}; };
  return charger(["js/15-compta-inventaire.js", "js/15c-compta-ticket.js"], {
    fbApiKey: "AIzaTest", fbProjectId: "asmb-app", AbortController: ctrl,
    COMPTA_CATS: { depense: ["Matériel sportif", "Autre"], recette: [] },
    fetch: (url) => {
      const mod = /models\/([^:]+):/.exec(url)[1]; appels.push(mod);
      const r = reponses[mod] || { st: 200, corps: { candidates: [{ content: { parts: [{ text: REPONSE }] } }] } };
      return Promise.resolve({ status: r.st, text: () => Promise.resolve(JSON.stringify(r.corps)) });
    },
  });
}

describe("Photo de ticket → Gemini", () => {
  it("le premier modèle répond : pas d'autre appel, JSON vérifié", async () => {
    const appels = []; const c = app({}, appels);
    const r = await c.comptaTicketGemini("data:image/jpeg;base64,AAAA");
    assert.deepEqual(appels, ["gemini-3.5-flash-lite"]);
    assert.equal(r.montant, 12.5); assert.equal(r.fournisseur, "Decathlon"); assert.equal(r.moyen, "CB");
  });
  it("un modèle retiré (404) : on passe au suivant", async () => {
    const appels = []; const c = app({ "gemini-3.5-flash-lite": { st: 404, corps: { error: { message: "no longer available" } } } }, appels);
    const r = await c.comptaTicketGemini("data:image/jpeg;base64,AAAA");
    assert.deepEqual(appels, ["gemini-3.5-flash-lite", "gemini-3.5-flash"]);
    assert.equal(r.montant, 12.5);
  });
  it("API non activée (403) : arrêt tout de suite, message lisible", async () => {
    const appels = []; const c = app({ "gemini-3.5-flash-lite": { st: 403, corps: { error: { message: "API disabled" } } } }, appels);
    await assert.rejects(c.comptaTicketGemini("data:image/jpeg;base64,AAAA"), (e) => /Gemini 403/.test(e.detail));
    assert.equal(appels.length, 1);
  });
  it("tous les modèles refusent : erreur avec le détail du dernier", async () => {
    const appels = []; const nok = { st: 404, corps: { error: { message: "gone" } } };
    const c = app({ "gemini-3.5-flash-lite": nok, "gemini-3.5-flash": nok, "gemini-3.1-flash-lite": nok }, appels);
    await assert.rejects(c.comptaTicketGemini("data:image/jpeg;base64,AAAA"), (e) => /gemini-3.1-flash-lite/.test(e.detail));
    assert.equal(appels.length, 3);
  });
  it("aucune clé secrète ni OpenRouter dans le fichier", () => {
    const src = readFileSync(new URL("../../js/15c-compta-ticket.js", import.meta.url), "utf8");
    assert.ok(!/sk-or-|sk-ant-|openrouter/i.test(src));
  });
});
