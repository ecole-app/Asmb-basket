// Stats avancées de match (js/14j-stats-calcul.js). Le risque : un score, un temps
// de jeu ou un +/- faux devant des parents. On rejoue des matchs écrits à la main
// et on compare à des chiffres calculés à la main.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/14j-stats-calcul.js"]);
const T0 = 1_000_000_000_000;   // horloge simulée (ms)

function match(joueurs = ["a", "b", "c", "d", "e", "f"]) {
  return c.msNouveau({ id: "ev1", equipe: "U15", date: "2026-10-17" }, joueurs, "2026-2027", 10);
}
// Ajoute un événement à la seconde de jeu s (chrono simulé en pause à s).
function ev(m, a, p, s) { m.chrono.sec = s; m.chrono.depuis = null; return c.msAjouter(m, a, p, T0); }

describe("Score, quart-temps et points", () => {
  it("compte les points de chaque côté et par quart-temps", () => {
    const m = match();
    ev(m, "in", "a", 0);
    ev(m, "p2", "a", 30); ev(m, "p3", "a", 60); ev(m, "lf1", "a", 70);
    ev(m, "a2", null, 90);
    c.msQuartSuivant(m, T0);
    ev(m, "p2", "a", 700); ev(m, "a3", null, 720);
    const r = c.msCalcul(m, { maintenant: T0 });
    assert.deepEqual({ ...r.score }, { nous: 8, eux: 5 });
    assert.deepEqual(Array.from(r.parQuart.nous).slice(0, 2), [6, 2]);
    assert.deepEqual(Array.from(r.parQuart.eux).slice(0, 2), [2, 3]);
    assert.equal(r.joueurs.a.pts, 8);
  });
  it("ne compte pas un tir raté comme un point", () => {
    const m = match();
    ev(m, "p2x", "a", 10); ev(m, "p3x", "a", 20); ev(m, "lfx", "a", 30);
    assert.equal(c.msCalcul(m, { maintenant: T0 }).score.nous, 0);
  });
});

describe("Temps de jeu et +/-", () => {
  it("minutes d'un joueur entré puis remplacé", () => {
    const m = match();
    ev(m, "in", "a", 0); ev(m, "in", "b", 0);
    ev(m, "out", "a", 300); ev(m, "in", "c", 300);   // a joue 5 min
    c.msTerminer(m, T0);                              // fin à 300 s (chrono en pause)
    m.sFin = 600;
    const r = c.msCalcul(m);
    assert.equal(r.joueurs.a.sec, 300);
    assert.equal(r.joueurs.a.min, 5);
    assert.equal(r.joueurs.b.sec, 600);   // reste jusqu'à la fin
    assert.equal(r.joueurs.c.sec, 300);   // entre à 300, finit à 600
    assert.equal(r.joueurs.d.sec, 0);
  });
  it("+/- : seuls les joueurs sur le terrain sont touchés", () => {
    const m = match();
    ev(m, "in", "a", 0); ev(m, "in", "b", 0);
    ev(m, "p2", "a", 60);              // a +2, b +2
    ev(m, "out", "b", 100); ev(m, "in", "c", 100);
    ev(m, "a3", null, 120);            // a -3, c -3 (b est sorti)
    ev(m, "p3", "c", 150);             // a +3, c +3
    const r = c.msCalcul(m, { maintenant: T0 });
    assert.equal(r.joueurs.a.pm, 2);   // +2 -3 +3
    assert.equal(r.joueurs.b.pm, 2);
    assert.equal(r.joueurs.c.pm, 0);   // -3 +3
    assert.equal(r.joueurs.d.pm, 0);
  });
  it("le chrono en marche compte le temps réel écoulé", () => {
    const m = match();
    c.msChronoDemarre(m, T0);
    ev(m, "in", "a", 0); m.chrono = { sec: 0, depuis: T0 };
    assert.equal(c.msSecJeu(m, T0 + 90_000), 90);
    c.msChronoPause(m, T0 + 90_000);
    assert.equal(m.chrono.sec, 90);
    assert.equal(c.msChronoMarche(m), false);
    assert.equal(c.msSecJeu(m, T0 + 500_000), 90);   // en pause : ne bouge plus
  });
  it("temps restant dans le quart-temps, qui repart de 10:00 au suivant", () => {
    const m = match();
    m.chrono = { sec: 228, depuis: null };
    assert.equal(c.msRestantQuart(m, T0), 600 - 228);
    c.msQuartSuivant(m, T0);
    assert.equal(m.q, 2);
    assert.equal(c.msRestantQuart(m, T0), 600);
    m.q = 5;
    m.qDebut[4] = 2400; m.chrono.sec = 2460;
    assert.equal(c.msRestantQuart(m, T0), 240);       // prolongation : 5 min
  });
  it("correction manuelle des minutes", () => {
    const m = match();
    ev(m, "in", "a", 0); m.chrono.sec = 600;
    m.minCorr = { a: 420 };
    assert.equal(c.msCalcul(m, { maintenant: T0 }).joueurs.a.min, 7);
  });
});

describe("Annuler", () => {
  it("retire la dernière action", () => {
    const m = match();
    ev(m, "p2", "a", 10); ev(m, "p3", "a", 20);
    c.msAnnuler(m);
    assert.equal(c.msCalcul(m, { maintenant: T0 }).score.nous, 2);
  });
  it("un changement s'annule en entier (sortie + entrée)", () => {
    const m = match();
    ev(m, "in", "a", 0);
    ev(m, "out", "a", 100); ev(m, "in", "b", 100);
    c.msAnnuler(m);
    assert.deepEqual(Array.from(c.msTerrain(m)), ["a"]);
  });
  it("sur un match vide, ne plante pas", () => {
    assert.equal(c.msAnnuler(match()), null);
  });
});

describe("Statistiques individuelles", () => {
  const m = () => {
    const x = match();
    ev(x, "p2", "a", 10); ev(x, "p2x", "a", 20); ev(x, "p3", "a", 30); ev(x, "p3x", "a", 40);
    ev(x, "lf1", "a", 50); ev(x, "lfx", "a", 60);
    ev(x, "ro", "a", 70); ev(x, "rd", "a", 80); ev(x, "pd", "a", 90);
    ev(x, "int", "a", 100); ev(x, "ct", "a", 110); ev(x, "bp", "a", 120);
    ev(x, "fc", "a", 130); ev(x, "fp", "a", 140);
    return x;
  };
  it("totaux et pourcentages", () => {
    const L = c.msCalcul(m(), { maintenant: T0 }).joueurs.a;
    assert.equal(L.pts, 6);                        // 2 + 3 + 1
    assert.equal(L.reb, 2);
    assert.deepEqual({ ...L.tirs }, { r: 2, t: 4 });
    const ad = c.msAdresse(L);
    assert.equal(ad.tirs, 50);
    assert.equal(ad.p3, 50);
    assert.equal(ad.lf, 50);
    assert.equal(ad.efg, 63);                      // (2 + 0,5 × 1) / 4 = 62,5 % → 63
  });
  it("évaluation = positifs − négatifs (formule FIBA)", () => {
    // positifs : 6 pts + 2 reb + 1 pd + 1 int + 1 ct + 1 fp = 12
    // négatifs : 2 tirs ratés + 1 LF raté + 1 balle perdue + 1 faute = 5
    assert.equal(c.msCalcul(m(), { maintenant: T0 }).joueurs.a.eval, 7);
  });
  it("ratio passes / pertes, sans division par zéro", () => {
    const x = match(); ev(x, "pd", "a", 10); ev(x, "pd", "a", 20);
    assert.equal(c.msAdresse(c.msCalcul(x, { maintenant: T0 }).joueurs.a).ratio, 2);
    ev(x, "bp", "a", 30);
    assert.equal(c.msAdresse(c.msCalcul(x, { maintenant: T0 }).joueurs.a).ratio, 2);
    ev(x, "bp", "a", 40); ev(x, "bp", "a", 50); ev(x, "bp", "a", 60);
    assert.equal(c.msAdresse(c.msCalcul(x, { maintenant: T0 }).joueurs.a).ratio, 0.5);
    assert.equal(c.msAdresse(c.msLigneVide()).tirs, null);
  });
  it("fautes d'équipe par quart-temps", () => {
    const x = match();
    ev(x, "fc", "a", 10); ev(x, "fc", "b", 20);
    c.msQuartSuivant(x, T0);
    ev(x, "fc", "a", 700);
    const r = c.msCalcul(x, { maintenant: T0 });
    assert.deepEqual(Array.from(r.fautesEq).slice(0, 2), [2, 1]);
  });
  it("un joueur du match sans aucune action figure quand même sur la feuille", () => {
    const r = c.msCalcul(match(), { maintenant: T0 });
    assert.equal(r.ids.length, 6);
    assert.equal(r.joueurs.f.pts, 0);
  });
});

describe("Fiche d'un joueur sur la saison", () => {
  function m(date, pts) {
    const x = c.msNouveau({ id: "e" + date, date }, ["a"], "2026-2027", 10);
    x.date = date;
    for (let i = 0; i < pts; i++) { x.chrono.sec = i; x.evts.push({ a: "p2", p: "a", q: 1, s: i }); }
    return x;
  }
  it("moyennes, meilleur match et tendance", () => {
    const matchs = [m("2026-10-03", 2), m("2026-10-10", 4), m("2026-10-17", 6), m("2026-10-24", 8)];
    const f = c.msFicheJoueur("a", matchs, { maintenant: T0 });
    assert.equal(f.n, 4);
    assert.equal(f.moyennes.pts, 10);              // (4 + 8 + 12 + 16) / 4
    assert.equal(f.meilleur.pts, 16);
    assert.equal(f.meilleur.nom, "M4");
    assert.equal(f.tendances.pts, 8);              // moyenne des 3 derniers (12) − celle des matchs d'avant (4)
  });
  it("pas de tendance avant 4 matchs, et aucun match = pas de plantage", () => {
    assert.equal(c.msFicheJoueur("a", [m("2026-10-03", 1)]).tendances.pts, null);
    const vide = c.msFicheJoueur("zzz", [m("2026-10-03", 1)]);
    assert.equal(vide.n, 0);
    assert.equal(vide.moyennes.pts, null);
    assert.equal(vide.meilleur, null);
  });
  it("les matchs sont classés par date, pas par ordre d'enregistrement", () => {
    const f = c.msFicheJoueur("a", [m("2026-10-24", 1), m("2026-10-03", 3)]);
    assert.equal(f.matchs[0].date, "2026-10-03");
  });
});

describe("Libellés", () => {
  it("quart-temps et prolongations", () => {
    assert.equal(c.msLibQuart(1), "Q1");
    assert.equal(c.msLibQuart(4), "Q4");
    assert.equal(c.msLibQuart(5), "P1");
  });
  it("mm:ss", () => { assert.equal(c.msMMSS(372), "06:12"); assert.equal(c.msMMSS(-5), "00:00"); });
});

describe("Tableau de saison d'une équipe (msEquipeSaison)", () => {
  function termine(date, nous, eux, pid = "a") {
    const x = c.msNouveau({ id: "e" + date, date }, [pid, "b"], "2026-2027", 10);
    x.date = date; x.statut = "termine"; x.sFin = 600;
    for (let i = 0; i < nous / 2; i++) x.evts.push({ a: "p2", p: pid, q: 1, s: i });
    for (let i = 0; i < eux; i++) x.evts.push({ a: "a1", p: null, q: 1, s: i });
    return x;
  }
  it("bilan, séries et moyennes de points", () => {
    const r = c.msEquipeSaison([termine("2026-10-03", 40, 50), termine("2026-10-10", 60, 50), termine("2026-10-17", 70, 40)], { maintenant: T0 });
    assert.equal(r.n, 3); assert.equal(r.v, 2); assert.equal(r.d, 1);
    assert.deepEqual({ ...r.suite }, { type: "V", n: 2 });
    assert.equal(r.pour, 56.7);      // (40 + 60 + 70) / 3
    assert.equal(r.contre, 46.7);    // (50 + 50 + 40) / 3
  });
  it("ignore les matchs non terminés et ne plante pas sans match", () => {
    const enCours = termine("2026-10-24", 10, 10); enCours.statut = "en_cours";
    assert.equal(c.msEquipeSaison([enCours], { maintenant: T0 }).n, 0);
    const vide = c.msEquipeSaison([], { maintenant: T0 });
    assert.equal(vide.pour, null); assert.equal(vide.joueurs.length, 0); assert.equal(vide.suite.n, 0);
  });
  it("leaders et ligne par joueur", () => {
    const m1 = termine("2026-10-03", 20, 10, "a");
    const m2 = termine("2026-10-10", 10, 10, "b");
    const r = c.msEquipeSaison([m1, m2], { maintenant: T0 });
    assert.equal(r.leaders.pts[0].id, "a");
    assert.equal(r.leaders.pts[0].pts, 20);      // « a » ne figure que dans le 1er match : 20 pts sur 1 match
    assert.equal(r.leaders.pts[0].n, 1);
    assert.ok(r.joueurs.every((j) => j.evals.length === j.n));
  });
});

describe("Vue joueur / parent : ses lignes seulement", () => {
  function termine(id, date, actions) {
    const m = c.msNouveau({ id, equipe: "U15", date }, ["a", "b"], "2026-2027", 10);
    actions.forEach(([a, p, s]) => ev(m, a, p, s));
    c.msTerminer(m, T0);
    return m;
  }
  const m1 = termine("e1", "2026-10-10", [["p2", "a", 10], ["p3", "b", 20], ["a2", null, 30]]);
  const m2 = termine("e2", "2026-10-17", [["p2", "a", 10], ["p2", "a", 20], ["rd", "a", 25]]);
  const enCours = c.msNouveau({ id: "e3", equipe: "U15", date: "2026-10-24" }, ["a"], "2026-2027", 10);
  it("une liste par joueur, matchs terminés seulement, triés par date", () => {
    const l = c.msLignesJoueurs([m2, enCours, m1], { maintenant: T0 });
    assert.equal(l.a.length, 2);
    assert.deepEqual(Array.from(l.a, (x) => x.eventId), ["e1", "e2"]);
    assert.equal(l.a[0].ligne.pts, 2);
    assert.equal(l.a[0].nous, 5);
    assert.equal(l.a[0].eux, 2);
  });
  it("la ligne du joueur a ne contient rien de b", () => {
    const l = c.msLignesJoueurs([m1], { maintenant: T0 });
    assert.equal(l.a[0].ligne.pts, 2);
    assert.equal(l.b[0].ligne.pts, 3);
    assert.equal(JSON.stringify(l.a).includes('"b"'), false);
  });
  it("même fiche que la vue staff", () => {
    const staff = c.msFicheJoueur("a", [m1, m2], { maintenant: T0 });
    const parent = c.msFicheDepuisLignes(c.msLignesJoueurs([m1, m2], { maintenant: T0 }).a);
    assert.equal(parent.n, staff.n);
    assert.equal(parent.moyennes.pts, staff.moyennes.pts);
    assert.equal(parent.moyennes.reb, staff.moyennes.reb);
    assert.equal(parent.moyennes.eval, staff.moyennes.eval);
  });
});
