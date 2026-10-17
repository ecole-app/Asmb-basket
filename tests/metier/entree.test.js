// Entrée d'un événement (js/14c-entree.js) : l'essentiel de l'écran est du
// DOM/Firestore (scanner, liste à cocher), mais la reconnaissance du code
// billet et le filtre par jour sont purs et critiques — un code mal reconnu,
// c'est un vrai billet refusé à l'entrée ou un faux positif validé.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger, jours } from "./contexte.js";

function app() { return charger(["js/14c-entree.js"]); }

describe("Reconnaissance du code billet (entreeCodeDepuis)", () => {
  it("code seul, insensible à la casse", () => {
    const c = app();
    assert.equal(c.entreeCodeDepuis("stg-12345"), "STG-12345");
    assert.equal(c.entreeCodeDepuis("TRN-00042"), "TRN-00042");
  });
  it("code noyé dans un texte (bruit de scan/OCR)", () => {
    const c = app();
    assert.equal(c.entreeCodeDepuis("Voici mon billet : soi-98765 merci"), "SOI-98765");
  });
  it("lien avec le paramètre ?billet=", () => {
    const c = app();
    assert.equal(c.entreeCodeDepuis("https://generalmanagerapp.fr/?evt=x&billet=evt-11111"), "EVT-11111");
  });
  it("pas de code reconnaissable : chaîne vide", () => {
    const c = app();
    assert.equal(c.entreeCodeDepuis("bonjour"), "");
    assert.equal(c.entreeCodeDepuis(""), "");
    assert.equal(c.entreeCodeDepuis(null), "");
  });
  it("préfixe invalide (pas STG/TRN/SOI/EVT) : non reconnu", () => {
    const c = app();
    assert.equal(c.entreeCodeDepuis("ABC-12345"), "");
  });
});

describe("Jour par défaut à l'ouverture de l'écran (entreeJourDefaut)", () => {
  it("pas de jours au choix : rien à sélectionner", () => {
    const c = app();
    assert.equal(c.entreeJourDefaut(null), null);
    assert.equal(c.entreeJourDefaut([]), null);
  });
  it("aujourd'hui fait partie des jours de l'événement : sélectionné", () => {
    const c = app();
    const auj = new Date().toISOString().slice(0, 10);
    assert.equal(c.entreeJourDefaut([jours(-5).toISOString().slice(0, 10), auj, jours(5).toISOString().slice(0, 10)]), auj);
  });
  it("aujourd'hui hors de la plage : premier jour de l'événement par défaut", () => {
    const c = app();
    const j1 = jours(3).toISOString().slice(0, 10), j2 = jours(4).toISOString().slice(0, 10);
    assert.equal(c.entreeJourDefaut([j1, j2]), j1);
  });
});

describe("Filtre par jour (entreeFiltrerJour)", () => {
  it("événement sans jours au choix : tous les inscrits, tel quel", () => {
    const c = app();
    const src = { tous: [{ c: "a" }, { c: "b" }] };
    c.entreeFiltrerJour(src);
    assert.deepEqual([...src.items], [{ c: "a" }, { c: "b" }]);
  });
  it("ne garde que les inscrits présents le jour sélectionné", () => {
    const c = app();
    const a = { c: "a", j: ["d1", "d2"], prj: { d1: 111 } };
    const b = { c: "b", j: ["d2"], prj: { d2: 222 } };
    const src = { tous: [a, b], jours: ["d1", "d2"], jour: "d1" };
    c.entreeFiltrerJour(src);
    assert.deepEqual(src.items.map((x) => x.c), ["a"]);
  });
  it("renseigne la présence (.pr) de chaque inscrit pour le jour affiché", () => {
    const c = app();
    const a = { c: "a", j: ["d1"], prj: { d1: 111 } };
    const b = { c: "b", j: ["d1"], prj: {} }; // pas encore pointé ce jour-là
    const src = { tous: [a, b], jours: ["d1"], jour: "d1" };
    c.entreeFiltrerJour(src);
    assert.equal(a.pr, 111);
    assert.equal(b.pr, 0);
  });
});
