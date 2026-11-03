// Jarvis, le robot de l'appli : ouvre la vraie appli dans Chrome (sans écran), en mode démo, et passe partout
// avant chaque mise en ligne. Si un écran plante, reste vide ou si un fichier ne se charge pas,
// il échoue : la mise en ligne est bloquée (.github/workflows/pages.yml, job « jarvis ») et une capture de l'écran
// fautif est gardée dans tests/jarvis/captures/.
//   - 4 profils de la démo (dirigeant, coach, parent, joueur) × téléphone et ordinateur
//   - dirigeant : barre du bas, chaque module de l'Espace Admin, chaque pôle, Paramètres ;
//     sur ordinateur, chaque rubrique du menu latéral
//   - pages publiques : tournoi, buvette, bénévole, fil d'événement, formulaire d'inscription
//   - réseau qui coupe juste après une mise à jour (le bug du 31/10/2026)
// Firebase n'est jamais contacté : la démo remplace Firestore, firebase-init.js est remplacé
// par un module vide. Lancement : cd tests && npm run jarvis
import { createRequire } from "node:module";
import http from "node:http";
import { readFile, mkdir, rm } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { join, extname, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright"); // installé dans tests/ (CI) ou global
const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CAPTURES = join(RACINE, "tests", "jarvis", "captures");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg",
  ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".woff2": "font/woff2" };
const STUB_FB = "window.__gmRobot=1;";
const STUB_FB_SW = "self.firebase=self.firebase||{initializeApp:function(){},messaging:function(){return{onBackgroundMessage:function(){}}}};";
const TELEPHONE = { width: 390, height: 844 }, ORDI = { width: 1366, height: 860 };

// ── Petit serveur du site (comme GitHub Pages : 404 en HTML) ─────────────────
function serveur() {
  return new Promise((ok) => {
    const s = http.createServer(async (req, res) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = normalize(join(RACINE, p));
      if (!f.startsWith(RACINE) || !existsSync(f) || statSync(f).isDirectory()) {
        res.writeHead(404, { "Content-Type": "text/html" }); res.end("<!doctype html><h1>404</h1>"); return;
      }
      res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream", "Cache-Control": "no-cache" });
      res.end(await readFile(f));
    });
    s.listen(0, "127.0.0.1", () => ok(s));
  });
}

const echecs = [], notes = [], vus = [];
let nVerifs = 0;
let nCaptures = 0;
async function capture(page, nom) {
  try { await mkdir(CAPTURES, { recursive: true }); await page.screenshot({ path: join(CAPTURES, (++nCaptures) + "-" + nom.replace(/[^a-z0-9]+/gi, "-") + ".png"), fullPage: false }); } catch (e) { /* page fermée */ }
}
async function echec(page, ou, quoi) {
  echecs.push(ou + " : " + quoi);
  console.log("  ✗ " + ou + " : " + quoi);
  await capture(page, ou);
}

async function nouvelOnglet(navigateur, base, taille, { sw = false } = {}) {
  const ctx = await navigateur.newContext({ viewport: taille, locale: "fr-FR", timezoneId: "Europe/Paris", serviceWorkers: sw ? "allow" : "block" });
  await ctx.route("**/js/firebase-init.js*", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB_FB }));
  await ctx.route("**/firebasejs/**/*-compat.js", (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: STUB_FB_SW }));
  const page = await ctx.newPage();
  const journal = { erreurs: [], fichiers: [] };
  page.on("pageerror", (e) => journal.erreurs.push(String(e && e.message || e).slice(0, 300)));
  page.on("response", (r) => {
    const u = r.url();
    if (u.startsWith(base) && r.status() >= 400 && !/favicon/.test(u)) journal.fichiers.push(r.status() + " " + u.slice(base.length));
  });
  page.on("requestfailed", (r) => {
    const u = r.url();
    if (u.startsWith(base) && !/favicon/.test(u)) journal.fichiers.push("échec " + u.slice(base.length) + " (" + (r.failure() || {}).errorText + ")");
  });
  return { ctx, page, journal };
}

// Vérifie l'état après une action : pas d'erreur, fichiers chargés, écran non vide.
async function verifier(page, journal, ou, { contenuMin = 15 } = {}) {
  await page.waitForTimeout(700);
  nVerifs++;
  const err = journal.erreurs.splice(0), fic = journal.fichiers.splice(0);
  for (const e of err) await echec(page, ou, "erreur « " + e + " »");
  for (const f of fic) await echec(page, ou, "fichier " + f);
  const etat = await page.evaluate(() => {
    const on = document.querySelector(".scr.on");
    const txt = on ? on.innerText.trim() : "";
    const bandeau = document.getElementById("gm-reprise");
    // Fenêtre ouverte par l'action (feuille, dialogue) : c'est elle qu'on juge.
    const fen = !document.body.querySelector(":scope > [data-robot-base]") ? null : [...document.body.children].filter((n) => !n.hasAttribute("data-robot-base") && n.id !== "gm-reprise"
      && getComputedStyle(n).position === "fixed" && n.offsetParent !== null || (!n.hasAttribute("data-robot-base") && getComputedStyle(n).position === "fixed" && n.getBoundingClientRect().height > 50)).pop();
    return { ecran: on ? on.id : "", n: txt.length, reprise: bandeau ? bandeau.innerText : "",
      fenetre: fen ? (fen.className || fen.id || fen.tagName) : "", nf: fen ? fen.innerText.trim().length : 0, tf: fen ? fen.innerText.trim().slice(0, 80) : "" };
  });
  if (etat.fenetre) {
    if (etat.nf < contenuMin) await echec(page, ou, "fenêtre « " + etat.fenetre + " » vide");
    if (/erreur|error|undefined|NaN|null\b/i.test(etat.tf)) await echec(page, ou, "fenêtre « " + etat.tf.replace(/\s+/g, " ") + " »");
  } else if (!etat.ecran) await echec(page, ou, "aucun écran affiché");
  else if (etat.n < contenuMin) await echec(page, ou, "écran « " + etat.ecran + " » vide (" + etat.n + " caractères)");
  if (etat.reprise) await echec(page, ou, "message de chargement raté affiché");
  vus.push(ou + " → " + (etat.fenetre ? "fenêtre « " + etat.tf.split("\n")[0] + " » (" + etat.nf + ")" : etat.ecran + " (" + etat.n + ")"));
  return etat;
}

// Ferme ce qui peut rester ouvert (feuilles, dialogues) avant l'action suivante.
async function fermer(page) {
  await page.evaluate(() => {
    [...document.body.children].forEach((n) => { if (!n.hasAttribute("data-robot-base") && getComputedStyle(n).position === "fixed") n.remove(); });
  }).catch(() => {});
  await page.keyboard.press("Escape").catch(() => {});
}

async function ouvrirDemo(page, journal, base, profil, ou) {
  await page.goto(base + "/index.html?demo=" + profil, { waitUntil: "load" });
  try {
    await page.waitForFunction(() => { const on = document.querySelector(".scr.on"); return on && on.innerText.trim().length > 40; }, null, { timeout: 15000 });
  } catch (e) { /* vérifié juste après */ }
  return verifier(page, journal, ou + " · démarrage", { contenuMin: 40 });
}

async function action(page, journal, ou, code, arg) {
  await page.evaluate(() => { for (const n of document.body.children) n.setAttribute("data-robot-base", ""); });
  try { await page.evaluate(code, arg); }
  catch (e) { await echec(page, ou, "action impossible : " + String(e.message).split("\n")[0].slice(0, 200)); return; }
  await verifier(page, journal, ou);
  await fermer(page);
}

async function profil(navigateur, base, nom, taille, libTaille) {
  const ou = nom + " (" + libTaille + ")";
  console.log("• " + ou);
  const { ctx, page, journal } = await nouvelOnglet(navigateur, base, taille);
  try {
    await ouvrirDemo(page, journal, base, nom, ou);
    // Barre du bas (téléphone)
    {
      const boutons = await page.$$eval("#bnav-main .bni", (bs) => bs.filter((b) => b.offsetParent !== null).map((b) => b.id).filter(Boolean));
      if (!boutons.length && libTaille === "téléphone") await echec(page, ou, "barre du bas vide");
      if (nom === "joueur" && boutons.join() !== "bni-j-home,bni-j-communaute,bni-j-params") await echec(page, ou, "barre du compte enfant : " + boutons.join(", ") + " (attendu : Accueil, Communauté, Paramètres)");
      for (const id of boutons) await action(page, journal, ou + " › " + id, (i) => document.getElementById(i).click(), id);
    }
    if (nom !== "dirigeant") {
      // Un compte non dirigeant ne doit jamais atteindre l'Espace Admin par la navigation du dirigeant.
      const ecran = await page.evaluate(() => { try { window.navTo("admin"); } catch (e) {} const on = document.querySelector(".scr.on"); return on ? on.id : ""; });
      if (ecran === "scr-admin") await echec(page, ou, "l'Espace Admin s'ouvre pour ce profil");
    }
    if (nom === "dirigeant") {
      if (libTaille === "ordinateur") {
        const ids = await page.evaluate(() => (window.GM_DESK_ITEMS || []).map((x) => x.id));
        if (!ids.length) await echec(page, ou, "menu ordinateur introuvable");
        for (const id of ids) await action(page, journal, ou + " › menu " + id, (i) => window.gmDeskOuvrir(i), id);
      } else {
        const mods = await page.evaluate(() => (window.ADMIN_MODULES || []).map((m) => m.id));
        for (const id of mods) await action(page, journal, ou + " › admin " + id, (i) => { window.stack = ["admin"]; window.openAdminModule(i); }, id);
        for (const pole of ["formation", "competition", "evenement"])
          await action(page, journal, ou + " › pôle " + pole, (p) => { window.stack = ["portal"]; window.openPole(p); }, pole);
        await action(page, journal, ou + " › paramètres", () => { window.stack = ["portal"]; window.openParametres(); });
      }
    }
    // Plusieurs clubs : avec 2 clubs, le titre de l'en-tête devient un menu « Mes clubs ».
    await action(page, journal, ou + " › mes clubs", () => {
      const ecran = { dirigeant: "portal", coach: "coach-equipe", parent: "parent-home", joueur: "joueur" }[localStorage.getItem("asmb_profile")] || "portal";
      window.stack = [ecran]; window.showScr(ecran);
      window.GM_MES_CLUBS = [{ clubId: window.CURRENT_CLUB_ID, nom: "Club", roles: ["dirigeant"] }, { clubId: "autre", nom: "Autre club", roles: ["parent"], nonLus: 3 }];
      window.mcMajEntete(ecran);
      const h = document.querySelector(".hdr .hinfo");
      if (window.MC_ECRANS.indexOf(ecran) >= 0) {
        if (!h.classList.contains("gm-mc")) throw new Error("menu Mes clubs absent de l'en-tête");
        if (!h.classList.contains("gm-mc-nl")) throw new Error("point rouge des notifications absent");
        h.click();
        if (!document.querySelector(".gm-sheet")) throw new Error("Mes clubs ne s'ouvre pas");
        document.querySelector(".gm-sheet").remove();
      }
      window.GM_MES_CLUBS = []; window.mcMajEntete(ecran);
    });
    if (nom === "dirigeant" || nom === "coach") {
      // Recherche partout (loupe) : on tape 2 lettres, la fenêtre doit montrer des résultats.
      await action(page, journal, ou + " › recherche", () => {
        const b = document.getElementById("hdr-search-btn");
        if (!b || b.style.display === "none") throw new Error("loupe absente de l'en-tête");
        b.click();
        const i = document.getElementById("rech-input"); i.value = "an"; i.dispatchEvent(new Event("input"));
      });
      if (libTaille === "téléphone") {
        // Bouton + : il doit être sur l'accueil, s'ouvrir, puis chaque geste disponible doit marcher.
        await action(page, journal, ou + " › bouton +", (n) => {
          window.stack = [n === "coach" ? "coach-equipe" : "portal"]; window.showScr(window.stack[0]);
          const b = document.getElementById("gm-plus-fab");
          if (!b || b.style.display === "none") throw new Error("bouton + absent de l'accueil");
          b.click();
        }, nom);
        const gestes = await page.evaluate(() => window.plusDisponibles().map((g) => g.id));
        for (const g of gestes) await action(page, journal, ou + " › geste " + g, (x) => {
          const n = localStorage.getItem("asmb_profile"); window.stack = [n === "coach" ? "coach-equipe" : "portal"]; window.showScr(window.stack[0]);
          window.PLUS_GESTES.find((y) => y.id === x).go();
        }, g);
      }
    }
  } catch (e) {
    await echec(page, ou, "Jarvis interrompu : " + String(e.message).split("\n")[0]);
  }
  await ctx.close();
}

async function pagesPubliques(navigateur, base) {
  console.log("• pages publiques");
  const { ctx, page, journal } = await nouvelOnglet(navigateur, base, TELEPHONE);
  const pages = [["tournoi", "/tournoi/index.html"], ["buvette", "/buvette/index.html"], ["bénévole", "/benevole/index.html"],
    ["fil", "/fil/index.html"], ["inscription", "/index.html?inscription=ROBOT"]];
  for (const [nom, url] of pages) {
    if (!existsSync(join(RACINE, url.split("?")[0]))) { await echec(page, "page " + nom, "fichier absent"); continue; }
    await page.goto(base + url, { waitUntil: "load" }).catch(() => {});
    await page.waitForTimeout(2500);
    const err = journal.erreurs.splice(0), fic = journal.fichiers.splice(0);
    for (const e of err) await echec(page, "page " + nom, "erreur « " + e + " »");
    for (const f of fic) await echec(page, "page " + nom, "fichier " + f);
    const n = await page.evaluate(() => document.body ? document.body.innerText.trim().length : 0);
    if (n < 10) await echec(page, "page " + nom, "page vide");
  }
  await ctx.close();
}

// Le bug du 31/10/2026 : mise à jour, puis réseau qui coupe sur un script au lancement suivant.
async function reseauCoupe(navigateur, base) {
  console.log("• réseau coupé juste après une mise à jour");
  const ou = "réseau coupé";
  const { ctx, page, journal } = await nouvelOnglet(navigateur, base, TELEPHONE, { sw: true });
  try {
    await ouvrirDemo(page, journal, base, "dirigeant", ou + " (1er lancement)");
    await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller, null, { timeout: 15000 }).catch(() => {});
    await ctx.route("**/version.json*", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"v":"9999999999"}' }));
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(6000); // le nouveau service worker remplit sa réserve
    const scripts = await page.$$eval('script[src^="js/"]', (s) => s.map((x) => x.getAttribute("src")));
    const cible = scripts[Math.floor(scripts.length * 0.7)];
    await ctx.route("**/" + cible + "*", (r) => r.abort());
    journal.erreurs.length = 0; journal.fichiers.length = 0;
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(5000);
    const err = journal.erreurs.splice(0);
    journal.fichiers.splice(0); // l'échec réseau est voulu ici
    for (const e of err) await echec(page, ou, "erreur « " + e + " » (fichier coupé : " + cible + ")");
    const etat = await page.evaluate(() => { const on = document.querySelector(".scr.on"); return { n: on ? on.innerText.trim().length : 0, reprise: !!document.getElementById("gm-reprise") }; });
    if (etat.n < 40 && !etat.reprise) await echec(page, ou, "écran bloqué sans message (fichier coupé : " + cible + ")");
    notes.push("réseau coupé sur " + cible + " : " + (etat.n >= 40 ? "appli affichée depuis la réserve" : "message « Réessayer »"));
  } catch (e) {
    await echec(page, ou, "Jarvis interrompu : " + String(e.message).split("\n")[0]);
  }
  await ctx.close();
}

const t0 = Date.now();
await rm(CAPTURES, { recursive: true, force: true });
const srv = await serveur();
const base = "http://127.0.0.1:" + srv.address().port;
const navigateur = await chromium.launch();
try {
  for (const nom of ["dirigeant", "coach", "parent", "joueur"]) {
    await profil(navigateur, base, nom, TELEPHONE, "téléphone");
    await profil(navigateur, base, nom, ORDI, "ordinateur");
  }
  await pagesPubliques(navigateur, base);
  await reseauCoupe(navigateur, base);
} finally {
  await navigateur.close();
  srv.close();
}
if (process.env.ROBOT_DETAIL) for (const v of vus) console.log("  ✓ " + v);
for (const n of notes) console.log("  · " + n);
console.log("  " + nVerifs + " écrans vérifiés");
const duree = Math.round((Date.now() - t0) / 1000);
if (echecs.length) {
  console.log("\n✗ Jarvis : " + echecs.length + " problème(s) en " + duree + " s — mise en ligne bloquée");
  if (process.env.GITHUB_ACTIONS) for (const e of echecs.slice(0, 30)) console.log("::error title=Jarvis::" + e.replace(/%/g, "%25").replace(/\n/g, " "));
  process.exit(1);
}
console.log("\n✓ Jarvis : tout est bon (" + duree + " s)");
