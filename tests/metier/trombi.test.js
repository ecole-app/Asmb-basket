// Lecture d'un trombinoscope PDF FBI (js/06i-trombi-pdf.js) : texte des cartes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/06f-import.js", "js/06i-trombi-pdf.js"], { authEsc: (x) => x });
const m = (s, x, y) => ({ s, x, y, w: s.length * 4 });
const page = [
  m("Généralités", 140, 700), m("Sportif", 395, 700),
  m("Amin -", 128, 685), m("BENMESSAOUD", 160, 685),
  m("BC162479 - 24/09/2026", 128, 670), m("ARA0042019 - ASSOCIATION SPORTIVE", 128, 655),
  m("20/07/2016 - Masculin", 128, 625),
  m("Licence 0C - U11", 386, 685), m("A - Formule A", 386, 655),
  m("Généralités", 140, 600), m("Sportif", 395, 600),
  m("Al-amine - Cisse", 128, 585), m("JH545489 - 29/08/2026", 128, 570),
  m("11/11/2016 - Féminin - Française", 128, 525),
  m("Licence 2C - Seniors", 386, 585), m("N - Pas d'assurance", 386, 555),
];
const cartes = JSON.parse(JSON.stringify(c.impTrombiCartes(page)));

describe("Trombinoscope FBI", () => {
  it("deux cartes", () => assert.equal(cartes.length, 2));
  it("identité, licence, naissance, genre", () => {
    assert.deepEqual([cartes[0].prenom, cartes[0].nom, cartes[0].numLicence, cartes[0].naissance, cartes[0].genre],
      ["Amin", "BENMESSAOUD", "BC162479", "20/07/2016", "M"]);
  });
  it("prénom composé avec tiret, nationalité, genre féminin", () => {
    assert.deepEqual([cartes[1].prenom, cartes[1].nom, cartes[1].genre, cartes[1].nationalite], ["Al-amine", "Cisse", "F", "Française"]);
  });
  it("catégorie et assurance", () => {
    assert.deepEqual([cartes[0].categorie, cartes[0].assurance, cartes[1].categorie], ["U11", "Formule A", "Senior"]);
  });
  it("catégories FBI → appli", () => {
    assert.equal(c.impTrombiCat("U10"), "U11");
    assert.equal(c.impTrombiCat("U9"), "U9");
    assert.equal(c.impTrombiCat("U17"), "U18");
    assert.equal(c.impTrombiCat("Seniors"), "Senior");
  });
});
