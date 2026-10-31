// Démarrage de l'appli : chaque script chargé par index.html doit exister, être lisible par le
// navigateur et être mis en réserve par le service worker (sw.js, PRECACHE). Un script oublié du
// précache se retrouvait remplacé par la page d'accueil quand le réseau flanchait au lancement
// (« Unexpected token '<' », écran bloqué). Ce test empêche l'oubli quand on ajoute un fichier.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, copyFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const lire = (f) => readFileSync(join(racine, f), "utf8");
const index = lire("index.html");
const sw = lire("sw.js");
const scripts = [...index.matchAll(/<script[^>]*\ssrc="(js\/[^"?#]+)/g)].map((m) => m[1]);
const precache = new Set([...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]));

describe("Démarrage de l'appli", () => {
  it("index.html charge bien des scripts", () => {
    assert.ok(scripts.length > 50, "scripts trouvés : " + scripts.length);
  });
  it("chaque script d'index.html existe", () => {
    const absents = scripts.filter((s) => !existsSync(join(racine, s)));
    assert.deepEqual(absents, []);
  });
  it("chaque script d'index.html est dans le précache du service worker", () => {
    const oublies = scripts.filter((s) => !precache.has(s));
    assert.deepEqual(oublies, [], "à ajouter dans PRECACHE (sw.js)");
  });
  it("chaque fichier local du précache existe", () => {
    const absents = [...precache].filter((f) => !/^https?:/.test(f) && f !== "" && !existsSync(join(racine, f)));
    assert.deepEqual(absents, []);
  });
  it("chaque script se lit sans erreur de syntaxe", () => {
    const tmp = mkdtempSync(join(tmpdir(), "gm-"));
    const erreurs = [];
    for (const s of scripts) {
      let f = join(racine, s);
      if (/firebase-init\.js$/.test(s)) { const m = join(tmp, "fi.mjs"); copyFileSync(f, m); f = m; }
      try { execFileSync(process.execPath, ["--check", f], { stdio: "pipe" }); }
      catch (e) { erreurs.push(s + " : " + String(e.stderr || e.message).split("\n").slice(0, 5).join(" ")); }
    }
    assert.deepEqual(erreurs, []);
  });
  it("le service worker ne sert jamais la page d'accueil à la place d'un script", () => {
    assert.match(sw, /req\.mode !== 'navigate' && \/\\\.\(js\|css\|json\)\$\/\.test\(url\.pathname\)/);
    assert.match(sw, /Response\.error\(\)/);
  });
});
