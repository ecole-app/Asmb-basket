// RIB de la plateforme : contrôle de l'IBAN et du BIC saisis (js/08b-abonnement.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/08b-abonnement.js"]);

describe("RIB", () => {
  it("accepte un IBAN valide, avec ou sans espaces", () => {
    assert.equal(c.ribIbanValide("FR76 3000 6000 0112 3456 7890 189"), true);
    assert.equal(c.ribIbanValide("fr7630006000011234567890189"), true);
    assert.equal(c.ribIbanValide("GB82 WEST 1234 5698 7654 32"), true);
  });
  it("refuse un IBAN avec une faute de frappe ou une mauvaise longueur", () => {
    assert.equal(c.ribIbanValide("FR76 3000 6000 0112 3456 7890 188"), false);
    assert.equal(c.ribIbanValide("FR76 3000 6000 0112 3456 7890 18"), false);
    assert.equal(c.ribIbanValide(""), false);
  });
  it("met l'IBAN en groupes de 4", () => {
    assert.equal(c.ribIbanFmt("fr7630006000011234567890189"), "FR76 3000 6000 0112 3456 7890 189");
  });
  it("BIC de 8 ou 11 caractères", () => {
    assert.equal(c.ribBicValide("agrifrpp"), true);
    assert.equal(c.ribBicValide("AGRIFRPP839"), true);
    assert.equal(c.ribBicValide("AGRI12"), false);
  });
});
