#!/usr/bin/env node
// Traductions de l'appli (voir i18n/LISEZMOI.md).
//   node outils/i18n.js extraire            -> i18n/_sources.json (textes français du périmètre)
//   node outils/i18n.js manquants [n]       -> i18n/_manquants.json (textes sans traduction), n par lot
//   node outils/i18n.js fusionner lot.json  -> ajoute un lot {"texte fr":{"en":..,"ar":..,"es":..,"it":..,"de":..}}
//   node outils/i18n.js compter             -> nombre de textes par fichier du périmètre
const fs = require("fs"), path = require("path");
const RACINE = path.join(__dirname, "..");
const LANGUES = ["en", "ar", "es", "it", "de"];
const PERIM = JSON.parse(fs.readFileSync(path.join(RACINE, "i18n/perimetre.json"), "utf8"));

const norm = (t) => String(t).replace(/&nbsp;/g, " ").replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
function humain(t) {
  if (!t || t.length < 2 || t.length > 400) return false;
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(t)) return false;
  if (/^[a-z0-9_\-\.\/:#]+$/.test(t)) return false;                    // identifiants, classes, chemins
  if (/[{};=]|=>|\bfunction\b|\bvar\b|\breturn\b|\(\)|https?:\/\/|\.js\b|\.png\b|\bpx\b|rgba?\(|var\(--|#[0-9a-fA-F]{3,6}\b|^\s*[\.#][a-z]/.test(t)) return false;
  if (/\d(px|em|rem|vh|vw|dvh|ms|deg)\b/.test(t)) return false;
  if (/^[A-Z_]+$/.test(t)) return false;                                  // CONSTANTES
  if (/^(on|off|auto|none|block|flex|center|left|right|true|false|null|bold|normal|hidden|solid|inherit)$/i.test(t)) return false;
  if (/^[a-z]+([A-Z][a-z]+)+$/.test(t)) return false;                     // camelCase
  const mots = t.split(/\s+/);
  if (mots.length === 1 && !/^[A-ZÀ-Ý]/.test(t) && !/[à-ÿ]/.test(t)) return false; // mot seul en minuscules sans accent : identifiant
  if (/^(application|text|image|data|font|charset|mailto|tel|sms|blob)[\/:]/i.test(t)) return false;
  return true;
}
function depuisLitteral(lit, out) {
  // un littéral JS peut contenir du HTML : on garde les morceaux de texte entre les balises
  lit.split(/<[^>]*>|<[^>]*$|^[^<]*>/).forEach((seg) => {
    const t = norm(seg);
    if (humain(t)) out.add(t);
  });
  // attributs lisibles dans le HTML du littéral
  for (const m of lit.matchAll(/(?:placeholder|title|aria-label|alt)=\\?["']([^"'\\]{2,200})\\?["']/g)) { const t = norm(m[1]); if (humain(t)) out.add(t); }
}
function extraireJs(src, out) {
  // retire les commentaires
  src = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'\\])\/\/[^\n]*/g, "$1");
  for (const m of src.matchAll(/"((?:[^"\\\n]|\\.)*)"|'((?:[^'\\\n]|\\.)*)'|`((?:[^`\\]|\\.)*)`/g)) {
    const lit = m[1] ?? m[2] ?? m[3] ?? "";
    if (m[3] !== undefined) { lit.split(/\$\{[^}]*\}/).forEach((x) => depuisLitteral(x, out)); continue; }
    depuisLitteral(lit, out);
  }
}
function extraireHtml(src, out) {
  src = src.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<style[\s\S]*?<\/style>/g, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const m of src.matchAll(/>([^<>]+)</g)) { const t = norm(m[1]); if (humain(t)) out.add(t); }
  for (const m of src.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]{2,200})"/g)) { const t = norm(m[1]); if (humain(t)) out.add(t); }
  // gestionnaires inline : askAlert('...') etc.
  for (const m of src.matchAll(/on[a-z]+="([^"]*)"/g)) extraireJs(m[1].replace(/&quot;/g, '"'), out);
}
function extraire(fichiers) {
  const out = new Set();
  for (const f of fichiers) {
    const src = fs.readFileSync(path.join(RACINE, f), "utf8");
    if (f.endsWith(".html")) extraireHtml(src, out); else extraireJs(src, out);
  }
  for (const x of PERIM.exclus || []) out.delete(x);
  return [...out].sort();
}
const dico = (l) => { const p = path.join(RACINE, "i18n", l + ".json"); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}; };
const ecrire = (p, o) => fs.writeFileSync(path.join(RACINE, p), JSON.stringify(o, null, 0).replace(/","/g, '",\n"') + "\n");

const [cmd, arg] = process.argv.slice(2);
if (cmd === "compter") {
  for (const f of PERIM.fichiers) console.log(String(extraire([f]).length).padStart(5), f);
  console.log(String(extraire(PERIM.fichiers).length).padStart(5), "TOTAL");
} else if (cmd === "extraire") {
  const s = extraire(PERIM.fichiers); ecrire("i18n/_sources.json", s); console.log(s.length, "textes");
} else if (cmd === "manquants") {
  const s = extraire(PERIM.fichiers), d = Object.fromEntries(LANGUES.map((l) => [l, dico(l)]));
  const manq = s.filter((t) => LANGUES.some((l) => !(t in d[l])));
  fs.writeFileSync(path.join(RACINE, "i18n/_manquants.json"), JSON.stringify(arg ? manq.slice(0, +arg) : manq, null, 1));
  console.log(manq.length, "textes à traduire sur", s.length);
  process.exitCode = manq.length ? 1 : 0;
} else if (cmd === "fusionner") {
  const lot = JSON.parse(fs.readFileSync(arg, "utf8"));
  for (const l of LANGUES) {
    const d = dico(l); let n = 0;
    for (const [fr, tr] of Object.entries(lot)) if (tr && typeof tr[l] === "string" && tr[l].trim()) { d[fr] = tr[l]; n++; }
    const trie = Object.fromEntries(Object.keys(d).sort().map((k) => [k, d[k]]));
    ecrire("i18n/" + l + ".json", trie);
    console.log(l, "+" + n, "=", Object.keys(trie).length);
  }
} else console.log("commandes : extraire | manquants [n] | fusionner lot.json | compter");
