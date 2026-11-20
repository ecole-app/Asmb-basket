// Vocabulaire « adhérent / adhésion » réservé à l'ASMB (outils/vocab-asmb.js, js/00-i18n.js, js/18-auth.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const racine = new URL("../../", import.meta.url);
const lire = (f) => readFileSync(new URL(f, racine), "utf8");

describe("Vocabulaire ASMB", () => {
  it("le dictionnaire est à jour (node outils/vocab-asmb.js si un texte « licence » a été ajouté)", () => {
    const r = spawnSync(process.execPath, ["outils/vocab-asmb.js", "verifier"], { cwd: racine.pathname, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
  it("jamais renommé : numéro de licence fédéral, colonnes d'import, catégories compta", () => {
    const v = JSON.parse(lire("i18n/vocab-asmb.json"));
    for (const k of Object.keys(v)) assert.doesNotMatch(k, /numlicence|typelicence|n° de licence|Code licence|Cotisations\/Licences/i, k);
    assert.equal(v["Licence"], undefined);
  });
  it("accords et élisions", () => {
    const v = JSON.parse(lire("i18n/vocab-asmb.json"));
    assert.equal(v["Licences"], "Adhérents");
    assert.equal(v["Renouveler la licence"], "Renouveler l'adhésion");
    assert.equal(v["Sa licence"], "Son adhésion");
    assert.equal(v["Limite de licences du pack : seules"], "Limite d'adhésions du pack : seules");
  });
  it("activé pour le club d'origine seulement", () => {
    assert.match(lire("js/18-auth.js"), /clubId===BOOTSTRAP_CLUB_ID && typeof gmVocabClub==="function"\) gmVocabClub\(\)/);
    assert.match(lire("js/00-i18n.js"), /gmVocabClub=function\(\)\{\s*if\(LANG!=="fr"\|\|ACTIF\) return;/);
  });
});
