// Tournois (js/14e-tournoi.js) : poules, tous contre tous, phases finales, planning.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const J = (x) => JSON.parse(JSON.stringify(x));
const c = charger(["js/14e-tournoi.js"]);
const eq = (n, cat = "U13 M", club = (i) => "Club " + i) => Array.from({ length: n }, (_, i) => ({ id: cat + "#" + i, nom: "Équipe " + i, club: club(i), cat }));
const cfg = (equipes, o = {}) => c.trnCfg({ trn: Object.assign({ equipes, terrains: 2, debut: "09:00", fin: "18:00", battement: 5 }, o) });

describe("Poules et tous contre tous", () => {
  it("chaque équipe rencontre toutes les autres une seule fois, une fois par tour au plus", () => {
    for (const n of [3, 4, 5, 6, 7]) {
      const ids = Array.from({ length: n }, (_, i) => "t" + i), tours = J(c.trnTours(ids)), vus = new Set();
      for (const t of tours) {
        const dans = t.flat(); assert.equal(new Set(dans).size, dans.length);
        for (const [a, b] of t) vus.add([a, b].sort().join("-"));
      }
      assert.equal(vus.size, (n * (n - 1)) / 2, "n=" + n);
    }
  });
  it("équipes d'un même club réparties dans des poules différentes", () => {
    const e = [...eq(2, "U13 M", () => "ASMB"), ...eq(6, "U13 M").slice(2)];
    const p = J(c.trnPoules(e, 2));
    assert.deepEqual(p.map((x) => x.length), [3, 3]);
    assert.notEqual(p[0].includes(e[0].id), p[0].includes(e[1].id));
  });
  it("formats proposés selon les poules", () => {
    assert.deepEqual(J(c.trnSuitesPossibles(1, 5, 5)), ["aucune", "finale", "demis"]);
    assert.deepEqual(J(c.trnSuitesPossibles(2, 3, 6)), ["aucune", "finale", "demis", "classement"]);
    assert.deepEqual(J(c.trnSuitesPossibles(3, 2, 6)), ["aucune"]);
  });
});

describe("Phases finales", () => {
  it("2 poules + demis + petite finale : croisement 1A-2B / 1B-2A, finale entre vainqueurs", () => {
    const r = J(c.trnMatchsCat("U13 M", eq(8), { nbPoules: 2, suite: "demis", petiteFinale: true, duree: 20 }));
    const f = r.matchs.filter((m) => m.phase === "finale");
    assert.equal(r.matchs.filter((m) => m.phase === "poule").length, 12);
    assert.deepEqual(f.map((m) => m.label), ["Demi-finale 1", "Demi-finale 2", "Petite finale", "Finale"]);
    assert.deepEqual([f[0].aRef, f[0].bRef], [{ r: "rang", poule: "A", rang: 1 }, { r: "rang", poule: "B", rang: 2 }]);
    assert.equal(f[3].aRef.r, "vainq"); assert.equal(f[2].aRef.r, "perd");
    assert.equal(c.trnRefTxt(f[3].aRef, { [f[0].id]: "Demi-finale 1" }), "Vainqueur demi-finale 1");
  });
  it("matchs de classement : un match par rang entre les deux poules", () => {
    const r = J(c.trnMatchsCat("U11", eq(7, "U11"), { nbPoules: 2, suite: "classement", duree: 15 }));
    assert.deepEqual(r.matchs.filter((m) => m.phase === "finale").map((m) => m.label), ["Match pour la 5e place", "Match pour la 3e place", "Finale"]);
  });
  it("format impossible : on retombe sur le classement des poules", () => {
    const r = J(c.trnMatchsCat("U9", eq(6, "U9"), { nbPoules: 3, suite: "demis", duree: 15 }));
    assert.equal(r.suite, "aucune");
    assert.equal(r.matchs.filter((m) => m.phase === "finale").length, 0);
  });
});

describe("Planning", () => {
  const verifier = (g, conf) => {
    const parTerrain = {}, parEquipe = {};
    for (const m of g.matchs) {
      const d = c.trnMin(m.debut), f = c.trnMin(m.fin);
      (parTerrain[m.terrain] ||= []).push([d, f]);
      for (const q of [m.a, m.b]) if (q) (parEquipe[q] ||= []).push([d, f]);
      if (conf.pause) assert.ok(f <= c.trnMin(conf.pause.debut) || d >= c.trnMin(conf.pause.fin), "pendant la pause : " + m.debut);
    }
    for (const l of Object.values(parTerrain)) { l.sort((x, y) => x[0] - y[0]); for (let i = 1; i < l.length; i++) assert.ok(l[i][0] >= l[i - 1][1] + conf.battement, "terrain chevauché"); }
    for (const l of Object.values(parEquipe)) { l.sort((x, y) => x[0] - y[0]); for (let i = 1; i < l.length; i++) assert.ok(l[i][0] >= l[i - 1][1], "équipe sur deux matchs à la fois"); }
    return parEquipe;
  };
  it("deux catégories, pause de midi : pas de chevauchement, repos respecté, finales après les poules", () => {
    const conf = { pause: { debut: "12:00", fin: "13:30" }, cats: { "U13 M": { nbPoules: 2, suite: "demis", petiteFinale: true, duree: 20 }, "U11": { nbPoules: 1, suite: "finale", duree: 15 } } };
    const k = cfg([...eq(8), ...eq(5, "U11")], conf), g = J(c.trnGenerer(k));
    assert.equal(g.matchs.length, 12 + 4 + 10 + 1);
    const parEquipe = verifier(g, Object.assign({ battement: 5 }, conf));
    for (const [id, l] of Object.entries(parEquipe)) for (let i = 1; i < l.length; i++) {
      const duree = id.startsWith("U11") ? 15 : 20;
      assert.ok(l[i][0] - l[i - 1][1] >= 5 + duree, "repos " + id);
    }
    const finPoules = Math.max(...g.matchs.filter((m) => m.cat === "U13 M" && m.phase === "poule").map((m) => c.trnMin(m.fin)));
    const demis = g.matchs.filter((m) => m.label.startsWith("Demi"));
    assert.ok(demis.every((m) => c.trnMin(m.debut) > finPoules));
    const finale = g.matchs.find((m) => m.cat === "U13 M" && m.label === "Finale");
    assert.ok(demis.every((d) => c.trnMin(finale.debut) > c.trnMin(d.fin)));
    assert.equal(g.hors, 0);
  });
  it("journée trop courte : les matchs hors délai sont signalés", () => {
    const g = J(c.trnGenerer(cfg(eq(8), { fin: "10:30", terrains: 1, cats: { "U13 M": { nbPoules: 1, duree: 20 } } })));
    assert.ok(g.hors > 0);
    assert.ok(g.matchs.some((m) => m.hors));
  });
  it("sans repos imposé, le planning est plus court", () => {
    const base = { terrains: 2, cats: { "U13 M": { nbPoules: 1, duree: 20 } } };
    const avec = J(c.trnGenerer(cfg(eq(6), base))), sans = J(c.trnGenerer(cfg(eq(6), Object.assign({ repos: false }, base))));
    assert.ok(c.trnMin(sans.finReelle) <= c.trnMin(avec.finReelle));
  });
});
