// Charge les vrais fichiers de l'appli (portée globale, sans bundler) dans un
// bac à sable Node, avec le strict minimum simulé (DOM, stockage, Firebase).
import vm from "node:vm";
import { readFileSync } from "node:fs";

const RACINE = new URL("../../", import.meta.url);

export function charger(fichiers, extra = {}) {
  const store = {};
  const ctx = {
    console, setTimeout, clearTimeout, Date, Math, JSON, Promise, URL, crypto,
    document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, createElement() { return { style: {}, appendChild() {}, addEventListener() {} }; } },
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    location: { search: "" }, navigator: {},
    alertes: [],
    ecritures: [],
  };
  ctx.window = ctx;
  ctx.askAlert = (m) => { ctx.alertes.push(String(m)); return Promise.resolve(); };
  ctx.askConfirm = () => Promise.resolve(false);
  ctx.showToast = () => {};
  ctx.getCurrentSeason = () => "2026-2027";
  ctx.licences = [];
  ctx.getLicences = () => ctx.licences;
  Object.assign(ctx, extra);
  vm.createContext(ctx);
  for (const f of fichiers) vm.runInContext(readFileSync(new URL(f, RACINE), "utf8"), ctx, { filename: f });
  return ctx;
}
export const jours = (n) => new Date(Date.now() + n * 86400000);
export const licences = (n, saison = "2026-2027") => Array.from({ length: n }, (_, i) => ({ id: "l" + i, saison }));
