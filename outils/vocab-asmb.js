// Vocabulaire du club d'origine (ASMB) : « licence / licencié » -> « adhésion / adhérent », à l'affichage seulement.
//   node outils/vocab-asmb.js          -> régénère i18n/vocab-asmb.json depuis les textes du périmètre
//   node outils/vocab-asmb.js verifier -> échoue si le fichier n'est pas à jour (test tests/metier/vocab-asmb.test.js)
// Jamais renommé : numéro/code de licence (fédéral), noms de colonnes d'import, catégories compta (clés de données).
const fs = require("fs"), path = require("path"), cp = require("child_process");
const RACINE = path.join(__dirname, "..");
const FICHIER = path.join(RACINE, "i18n/vocab-asmb.json");
cp.execFileSync(process.execPath, [path.join(__dirname, "i18n.js"), "extraire"], { cwd: RACINE });
const sources = JSON.parse(fs.readFileSync(path.join(RACINE, "i18n/_sources.json"), "utf8"));

const GARDER = /numlicence|typelicence|n° de licence|N° de licence|numéro de licence|Code licence|Cotisations\/Licences|Affiliation\/Licences|licence officielle|licences fédérales|N° licence|Redevances/i;
const EXACT = { "Licences": "Adhérents", "Licences en attente": "Adhésions en attente", "Licences par catégorie": "Adhérents par catégorie", "Inscriptions & licences": "Inscriptions & adhérents" };
const NE_PAS = new Set(["Licence"]);   // mot seul : peut être une catégorie de la compta (donnée)

function renommer(t) {
  if (Object.prototype.hasOwnProperty.call(EXACT, t)) return EXACT[t];
  let r = t
    .replace(/\b([Ll])icenciée\b/g, (m, c) => (c === "L" ? "A" : "a") + "dhérente")
    .replace(/\b([Ll])icencié(s?)\b/g, (m, c, s) => (c === "L" ? "A" : "a") + "dhérent" + s)
    .replace(/\b([Ll])icencié·e\b/g, (m, c) => (c === "L" ? "A" : "a") + "dhérent·e")
    .replace(/\b([MmTtSs])(a) licence\b/g, (m, c) => c + "on adhésion")
    .replace(/\b([Ll])a licence\b/g, (m, c) => (c === "L" ? "L'" : "l'") + "adhésion")
    .replace(/\b([Dd])e licence\b/g, (m, c) => c + "'adhésion")
    .replace(/\b([Ll])icence(s?)\b/g, (m, c, s) => (c === "L" ? "A" : "a") + "dhésion" + s);
  return r.replace(/\b([Dd])e adh([ée])/g, (m, c, e) => c + "'adh" + e).replace(/\bLe\/la adhérent/g, "L'adhérent");
}
const vocab = {};
for (const t of sources) {
  if (!/licen[cs]/i.test(t) || GARDER.test(t) || NE_PAS.has(t)) continue;
  const r = renommer(t);
  if (r !== t) vocab[t] = r;
}
const trie = Object.fromEntries(Object.keys(vocab).sort().map((k) => [k, vocab[k]]));
const txt = "{\n" + Object.entries(trie).map(([k, v]) => JSON.stringify(k) + ":" + JSON.stringify(v)).join(",\n") + "\n}\n";
if (process.argv[2] === "verifier") {
  const actuel = fs.existsSync(FICHIER) ? fs.readFileSync(FICHIER, "utf8") : "";
  if (actuel !== txt) { console.error("i18n/vocab-asmb.json n'est pas à jour : node outils/vocab-asmb.js"); process.exit(1); }
  console.log("vocab-asmb à jour (" + Object.keys(trie).length + " textes)");
} else { fs.writeFileSync(FICHIER, txt); console.log(Object.keys(trie).length, "textes ->", "i18n/vocab-asmb.json"); }
