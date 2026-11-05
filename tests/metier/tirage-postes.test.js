// Tirage au sort : postes du basket (délégué, marqueur, chronométreur, chronométreur des tirs, aide-marqueur,
// arbitrage), officiels (table N3+, arbitres désignés) et données du PDF (js/14q-tirage-table.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const t = (x) => JSON.parse(JSON.stringify(x));
function app(events = [], teams = []) {
  const c = charger(["js/14g-benevoles.js", "js/14q-tirage-table.js"], {
    getEvents: () => events, getTeams: () => teams, eventTypeLabel: () => "", authEsc: (x) => x,
  });
  return c;
}
const match = (id, date, over = {}) => ({ id, type: "match", date, heure: "15h00", lieu: "Domicile", equipe: "U15 Garçons", titre: "U15 vs Roanne", ...over });

describe("Réglages des postes", () => {
  it("par défaut : délégué, marqueur, chronométreur, chronométreur des tirs, arbitrage ; pas d'aide-marqueur", () => {
    const p = t(app().tirPrefs().postes);
    assert.deepEqual(p, { "Délégué de club": 1, Marqueur: 1, Chronométreur: 1, "Chronométreur des tirs": 1, "Aide-marqueur": 0, Arbitrage: 1 });
  });
  it("ancien réglage : Table de marque devient Marqueur, Chronomètre devient Chronométreur", () => {
    const c = app();
    c.localStorage.setItem("gm_tirage_prefs", JSON.stringify({ zone: "B", postes: { "Table de marque": 2, Chronomètre: 0, Arbitrage: 1 } }));
    const p = t(c.tirPrefs());
    assert.equal(p.zone, "B"); assert.equal(p.postes.Marqueur, 2); assert.equal(p.postes.Chronométreur, 0);
    assert.equal(p.postes["Table de marque"], undefined);
  });
});

describe("Officiels", () => {
  it("l'équipe dit officiel, le match peut dire le contraire", () => {
    const eq = [{ id: "a", name: "U15 Garçons", tableOfficielle: true }];
    const c = app([], eq);
    assert.deepEqual(t(c.tirOfficiels({ equipe: "U15 Garçons" })), { table: true, arbitres: false });
    assert.deepEqual(t(c.tirOfficiels({ equipe: "U15 Garçons", tableOfficielle: false })), { table: false, arbitres: false });
    assert.deepEqual(t(c.tirOfficiels({ equipe: "Seniors", arbitresDesignes: true })), { table: false, arbitres: true });
  });
});

describe("Données du PDF", () => {
  it("une ligne par match à domicile, noms placés, « Officiels » et « à désigner »", () => {
    const ev = [
      match("m1", "2026-11-07", { benevoles: [{ poste: "Marqueur", nom: "Karim B." }, { poste: "Chronomètre", nom: "Sofia L." }, { poste: "Délégué de club", nom: "Marc D." }] }),
      match("m2", "2026-11-14", { lieu: "Extérieur" }),
      match("m3", "2026-12-05", { equipe: "Seniors Filles", titre: "S vs Firminy" }),
    ];
    const c = app(ev, [{ id: "s", name: "Seniors Filles", tableOfficielle: true }]);
    const d = t(c.tirPdfDonnees("2026-11-01", "2026-12-31", { zone: "A", postes: { Marqueur: 1, Chronométreur: 1, Arbitrage: 1 } }));
    assert.equal(d.nb, 2);
    assert.deepEqual(d.mois.map((m) => m.cle), ["2026-11", "2026-12"]);
    const l1 = d.mois[0].lignes[0].cases, l2 = d.mois[1].lignes[0].cases;
    assert.equal(l1.Marqueur, "Karim B."); assert.equal(l1.Chronométreur, "Sofia L."); assert.equal(l1["Délégué de club"], "Marc D.");
    assert.equal(l1.Arbitrage, "à désigner");
    assert.equal(l2.Marqueur, "Officiels"); assert.equal(l2.Arbitrage, "à désigner");
  });
  it("jamais de téléphone dans les données", () => {
    const c = app([match("m1", "2026-11-07", { benevoles: [{ poste: "Marqueur", nom: "Karim B.", tel: "0612345678" }] })]);
    assert.ok(!JSON.stringify(c.tirPdfDonnees("2026-11-01", "2026-11-30", { zone: "A", postes: {} })).includes("0612345678"));
  });
});
