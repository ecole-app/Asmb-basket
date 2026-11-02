// Numéro de version lisible (versionnage sémantique) : le même partout, et jamais oublié
// quand on met l'appli à jour (js/21-main.js APP_SEMVER, version.json, tête de changelog.json).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lire = (f) => readFileSync(join(racine, f), "utf8");
const SEMVER = /^\d+\.\d+\.\d+$/;
const main = lire("js/21-main.js");
const dansMain = (main.match(/var APP_SEMVER="([^"]*)"/) || [])[1];
const jeton = (main.match(/var APP_VERSION="([^"]*)"/) || [])[1];
const version = JSON.parse(lire("version.json"));
const changelog = JSON.parse(lire("changelog.json"));

describe("Numéro de version", () => {
  it("APP_SEMVER est de la forme MAJEUR.MINEUR.CORRECTIF", () => {
    assert.match(dansMain || "", SEMVER);
  });
  it("version.json porte le même numéro lisible et le même jeton technique", () => {
    assert.equal(version.semver, dansMain);
    assert.equal(version.v, jeton);
  });
  it("la première entrée du changelog porte ce numéro", () => {
    assert.equal(changelog[0].semver, dansMain);
    assert.equal(changelog[0].v, jeton);
  });
});
