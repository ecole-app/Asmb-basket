// Fiche d'inscription : champs obligatoires pour avancer (js/06-licences.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/06-licences.js"], { authEsc: (x) => x, gmJs: (x) => x, isStaffUser: () => false });
const ids = (n) => Array.from(c.ficheObligatoires(n), (x) => x[0]);

describe("Fiche d'inscription : champs obligatoires", () => {
  it("adulte : photo, adresse, téléphone, email, urgence", () => {
    assert.deepEqual(ids("1990-05-01"), ["photo", "f-adresse", "f-telephone", "f-emailLic", "f-urgenceNom", "f-urgenceTel"]);
  });
  it("mineur : responsable légal au lieu du téléphone/email personnels", () => {
    const l = ids("2012-05-01");
    assert.ok(l.includes("f-respNom") && l.includes("f-respTel") && l.includes("f-respEmail") && l.includes("f-respLien"));
    assert.ok(!l.includes("f-telephone") && !l.includes("f-emailLic"));
    assert.ok(l.includes("photo") && l.includes("f-urgenceTel"));
  });
  it("18 ans pile aujourd'hui = adulte", () => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 18);
    assert.ok(ids(d.toISOString().slice(0, 10)).includes("f-telephone"));
  });
});
