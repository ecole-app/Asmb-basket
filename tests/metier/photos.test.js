// Import des photos (js/06g-photos.js) : rattachement nom de fichier → licencié.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/06f-import.js", "js/06g-photos.js"], { authEsc: (x) => x });
const lics = [
  { id: "1", fiche: { nom: "Dupont", prenom: "Léa", numLicenceFFBB: "VT123456" } },
  { id: "2", fiche: { nom: "Martin", prenom: "Tom" } },
  { id: "3", fiche: { nom: "Martin", prenom: "Tomas" } },
];
const id = (n) => { const r = c.phoTrouver(n, lics); return r.lic ? r.lic.id : r.raison; };

describe("Rattachement des photos", () => {
  it("par n° de licence dans le nom du fichier", () => assert.equal(id("VT123456.jpg"), "1"));
  it("par nom et prénom, accents et ordre libres", () => {
    assert.equal(id("LEA_DUPONT.png"), "1");
    assert.equal(id("Dupont Léa.jpeg"), "1");
  });
  it("aucun licencié reconnu", () => assert.equal(id("inconnu.jpg"), "aucun licencié reconnu"));
  it("ambigu : plusieurs candidats", () => assert.equal(id("martin_tomas.jpg"), "plusieurs licenciés possibles"));
  it("deux photos pour la même personne : la 2e est refusée", () => {
    const r = c.phoAnalyser([{ nom: "VT123456.jpg" }, { nom: "dupont_lea.jpg" }], lics, true);
    assert.equal(r.ok.length, 1);
    assert.equal(r.sans.length, 1);
  });
  it("photo déjà présente : conservée sauf demande de remplacement", () => {
    const l = [{ id: "9", fiche: { nom: "Roux", prenom: "Ana", photo: "data:x" } }];
    assert.equal(c.phoAnalyser([{ nom: "roux_ana.jpg" }], l, false).deja.length, 1);
    assert.equal(c.phoAnalyser([{ nom: "roux_ana.jpg" }], l, true).ok.length, 1);
  });
});
