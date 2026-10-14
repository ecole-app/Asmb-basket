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

describe("Jour J : classements et qualifiés", () => {
  const c2 = charger(["js/14e-tournoi.js", "js/14f-tournoi-jourj.js"]);
  const m = (id, a, b, poule = "A") => ({ id, cat: "U13", phase: "poule", poule, a, b });
  const fin = (sa, sb, o = {}) => Object.assign({ sa, sb, statut: "termine" }, o);
  it("victoire 2 pts, défaite 1 pt, forfait 0 pt", () => {
    const ms = [m("1", "A", "B"), m("2", "B", "C"), m("3", "A", "C")];
    const l = J(c2.trnClassement(["A", "B", "C"], ms, { 1: fin(30, 20), 2: fin(0, 20, { forfait: "a" }), 3: fin(25, 27) }));
    const pts = Object.fromEntries(l.map((x) => [x.id, x.pts]));
    assert.deepEqual(pts, { A: 3, B: 1, C: 4 });
    assert.deepEqual(l.map((x) => x.id), ["C", "A", "B"]);
  });
  it("égalité de points : la confrontation directe départage, avant l'écart général", () => {
    // A bat B de 1 point, B écrase C, C bat A de 1 : A, B, C à 5 pts ; entre elles, 3 pts chacune → écart entre elles
    const ms = [m("1", "A", "B"), m("2", "B", "C"), m("3", "C", "A"), m("4", "A", "D"), m("5", "B", "D"), m("6", "C", "D")];
    const res = { 1: fin(41, 40), 2: fin(60, 30), 3: fin(50, 49), 4: fin(40, 10), 5: fin(40, 39), 6: fin(40, 39) };
    const l = J(c2.trnClassement(["A", "B", "C", "D"], ms, res));
    assert.deepEqual(l.map((x) => x.id), ["B", "A", "C", "D"]); // écart entre elles : B +29, A 0, C -29
    assert.ok(l.every((x, i) => i === 3 || x.pts === 5));
  });
  it("demi-finales puis finale : les équipes apparaissent dès qu'on les connaît", () => {
    const e = Array.from({ length: 8 }, (_, i) => ({ id: "t" + i, nom: "T" + i, club: "C" + i, cat: "U13" }));
    const cfg = c.trnCfg({ trn: { equipes: e, cats: { U13: { nbPoules: 2, suite: "demis", duree: 20 } } } });
    const g = J(c2.trnGenerer(cfg)), res = {};
    assert.equal(Object.keys(J(c2.trnResoudre(g.matchs, g.poules, res))).length, 0);
    for (const x of g.matchs.filter((x) => x.poule === "A")) res[x.id] = fin(x.a < x.b ? 50 : 40, x.a < x.b ? 40 : 50);
    let r = J(c2.trnResoudre(g.matchs, g.poules, res));
    const d1 = g.matchs.find((x) => x.label === "Demi-finale 1"), d2 = g.matchs.find((x) => x.label === "Demi-finale 2"), f = g.matchs.find((x) => x.label === "Finale");
    const pa = g.poules.U13[0].equipes.slice().sort();
    assert.equal(r[d1.id].a, pa[0]); assert.equal(r[d1.id].b, null); assert.equal(r[d2.id].b, pa[1]);
    for (const x of g.matchs.filter((x) => x.poule === "B")) res[x.id] = fin(x.a < x.b ? 50 : 40, x.a < x.b ? 40 : 50);
    res[d1.id] = fin(60, 50); res[d2.id] = fin(40, 45);
    r = J(c2.trnResoudre(g.matchs, g.poules, res));
    assert.equal(r[f.id].a, r[d1.id].a); assert.equal(r[f.id].b, r[d2.id].b);
  });
  it("code de match : 6 caractères sans 0/O/1/I/L", () => {
    for (let i = 0; i < 50; i++) assert.match(c2.trnCodeMatch(), /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(c2.trnCodeNet(" k7p-2xr "), "K7P2XR");
  });
});

describe("Équipe absente : forfait général", () => {
  const j = charger(["js/14e-tournoi.js", "js/14f-tournoi-jourj.js"]);
  const e4 = eq(4, "U11");
  const conf = cfg(e4, { cats: { U11: { nbPoules: 1, suite: "finale", duree: 15 } } });
  const g = j.trnGenerer(conf);
  const poule = g.matchs.filter((m) => m.phase === "poule");
  it("ses matchs non joués sont perdus 20-0 et elle a 0 point par forfait", () => {
    const abs = e4[3].id, res = {};
    // un match déjà joué avant son départ reste tel quel
    const joue = poule.find((m) => m.a === abs || m.b === abs);
    res[joue.id] = { sa: 30, sb: 10, statut: "termine" };
    const ap = J(j.trnAppliquerAbsentes(g.matchs, g.poules, res, [abs]));
    assert.deepEqual(ap.res[joue.id], { sa: 30, sb: 10, statut: "termine" });
    poule.filter((m) => m !== joue && (m.a === abs || m.b === abs)).forEach((m) => {
      const r = ap.res[m.id], cote = m.a === abs ? "a" : "b";
      assert.equal(r.forfait, cote); assert.equal(cote === "a" ? r.sb : r.sa, 20);
    });
  });
  it("qualifiée en finale : l'adversaire gagne par forfait", () => {
    const abs = e4[0].id, res = {};
    // l'équipe absente a tout gagné en poule, puis s'en va
    poule.forEach((m) => { res[m.id] = m.a === abs ? { sa: 20, sb: 0, statut: "termine" } : m.b === abs ? { sa: 0, sb: 20, statut: "termine" } : { sa: 10, sb: 8, statut: "termine" }; });
    const ap = J(j.trnAppliquerAbsentes(g.matchs, g.poules, res, [abs]));
    const f = g.matchs.find((m) => m.label === "Finale"), r = ap.res[f.id], qui = ap.resolus[f.id];
    assert.ok(qui.a === abs || qui.b === abs);
    assert.equal(r.statut, "termine"); assert.equal(r.forfait, qui.a === abs ? "a" : "b");
  });
  it("sans absente : rien ne change", () => {
    const ap = J(j.trnAppliquerAbsentes(g.matchs, g.poules, {}, []));
    assert.deepEqual(ap.res, {});
  });
});
