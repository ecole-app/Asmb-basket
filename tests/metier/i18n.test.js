// Traductions (i18n/*.json, outils/i18n.js) : toutes les langues complètes et cohérentes.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const racine = new URL("../../", import.meta.url);
const LANGUES = ["en", "ar", "es", "it", "de"];
const dico = (l) => JSON.parse(readFileSync(new URL("i18n/" + l + ".json", racine), "utf8"));

describe("Traductions", () => {
  it("aucun texte du périmètre sans traduction (node outils/i18n.js manquants)", () => {
    const r = spawnSync(process.execPath, ["outils/i18n.js", "manquants"], { cwd: new URL(".", racine).pathname, encoding: "utf8" });
    assert.equal(r.status, 0, r.stdout + r.stderr);
  });
  it("les 5 langues ont exactement les mêmes textes", () => {
    const cles = Object.keys(dico("en")).sort().join("\n");
    for (const l of LANGUES) assert.equal(Object.keys(dico(l)).sort().join("\n"), cles, l);
  });
  it("aucune traduction vide", () => {
    for (const l of LANGUES) for (const [k, v] of Object.entries(dico(l))) assert.ok(String(v).trim(), l + " : " + k);
  });
});
