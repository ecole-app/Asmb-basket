// Championnats (js/14p-championnats.js) : lecture de l'export FBI, fusion dans le planning, classement.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/14p-championnats.js"]);
const ASMB = "ASSOCIATION SPORTIVE MAGIQUE BASKET";
const EN_TETE = ["Division", "N° de match ", "Equipe 1", "Equipe 2", "Date de rencontre", "Heure", "Salle", "e-Marque V2", "Score 1", "Forfait 1", "Score 2", "Forfait 2"];
const ligne = (n, e1, e2, d, h, salle, s1, s2, f1 = "Non", f2 = "Non") => ["DFU18-2", String(n), e1, e2, d, h, salle, "XYZ", s1, f1, s2, f2];
const lignes = () => [EN_TETE,
  ligne(5, `${ASMB} (6) `, "BC AUREC - Entente (4) ", "19/09/2026", "17:00", "GYMNASE R. GIRAUDET", "40", "61"),
  ligne(27, "PONTOISE ULR (3) ", `${ASMB} (6) `, "27/09/2026", "15:30", "GYMNASE DES UNCHATS", "57", "34"),
  ligne(88, "ST JUST MALMONT BC - 1 (5) ", `${ASMB} (6) `, "18/10/2026", "13:00", "COMPLEXE G1", "58", "45"),
  ligne(120, `${ASMB} (6) `, "MONTBRISON (2) ", "01/11/2026", "", "", "", ""),
  ligne(121, `${ASMB} (6) `, "ST CHAMOND (1) ", "", "", "", "", ""),
];

describe("Import de l'export FBI", () => {
  it("lit les colonnes, la division, les dates (JJ/MM/AAAA) et les scores", () => {
    const r = c.champLireFbi(lignes());
    assert.equal(r.ok, true);
    assert.equal(r.division, "DFU18-2");
    assert.equal(r.rencontres.length, 5);
    const m = r.rencontres[0];
    assert.equal(m.date, "2026-09-19");
    assert.equal(m.heure, "17:00");
    assert.equal(m.s1, 40);
    assert.equal(m.n1, 6);
    assert.equal(r.rencontres[3].s1, null);   // pas encore joué
    assert.equal(r.rencontres[3].heure, "");
  });
  it("trouve notre équipe : la plus fréquente du fichier", () => {
    const r = c.champLireFbi(lignes());
    assert.equal(r.candidats[0].nom, ASMB);
    assert.equal(r.candidats[0].n, 5);
  });
  it("refuse un fichier qui n'est pas un export FBI", () => {
    assert.equal(c.champLireFbi([["a", "b"], ["1", "2"]]).ok, false);
    assert.equal(c.champLireFbi([]).ok, false);
  });
  it("accepte l'en-tête sur une autre ligne et les heures « 17h00 » ou « 17:00:00 »", () => {
    assert.equal(c.champHeure("17h00"), "17:00");
    assert.equal(c.champHeure("17:00:00"), "17:00");
    assert.equal(c.champHeure(0.5), "12:00");
    const r = c.champLireFbi([["Export"], ...lignes()]);
    assert.equal(r.ok, true);
  });
});

describe("Fusion dans le planning", () => {
  const nous = { nom: ASMB, num: 6 };
  const matchs = () => c.champLireFbi(lignes()).rencontres.map((m) => c.champMatchNous(m, nous)).filter(Boolean);
  it("crée un événement « match » par match daté, avec score, salle et adversaire", () => {
    const f = c.champFusionner([], "DFU18-2_2026", matchs(), "U18 F");
    assert.equal(f.ajoutes, 4);                 // 5 matchs, 1 sans date
    assert.equal(f.sansDate.length, 1);
    const e = f.events.find((x) => x.champKey === "DFU18-2|5");
    assert.equal(e.type, "match");
    assert.equal(e.date, "2026-09-19");
    assert.equal(e.heure, "17:00");
    assert.equal(e.lieu, "GYMNASE R. GIRAUDET");
    assert.equal(e.equipe, "U18 F");
    assert.deepEqual(JSON.parse(JSON.stringify(e.score)), { adversaire: "BC AUREC - Entente", asmb: 40, adv: 61 });
    assert.equal(e.domicile, true);
    const ext = f.events.find((x) => x.champKey === "DFU18-2|27");
    assert.equal(ext.domicile, false);
    assert.equal(ext.score.asmb, 34);          // score vu de notre équipe, même à l'extérieur
    assert.equal(f.events.find((x) => x.champKey === "DFU18-2|120").score, undefined);
  });
  it("réimporter ne duplique rien et ajoute le score d'un match joué depuis", () => {
    const f1 = c.champFusionner([], "D", matchs(), "U18 F");
    const m2 = matchs(); const m120 = m2.find((m) => m.num === "120"); m120.scoreNous = 50; m120.scoreEux = 40; m120.joue = true;
    const f2 = c.champFusionner(f1.events, "D", m2, "U18 F");
    assert.equal(f2.ajoutes, 0);
    assert.equal(f2.majs, 1);
    assert.equal(f2.events.length, f1.events.length);
    assert.equal(f2.events.find((x) => x.champKey === "DFU18-2|120").score.asmb, 50);
  });
  it("une date ou une heure corrigée dans GM n'est jamais écrasée", () => {
    const f1 = c.champFusionner([], "D", matchs(), "U18 F");
    const ev = f1.events.map((e) => (e.champKey === "DFU18-2|120" ? { ...e, date: "2026-11-03", heure: "20:00" } : e));
    const m2 = matchs(); m2.find((m) => m.num === "120").date = "2026-11-02"; m2.find((m) => m.num === "120").heure = "19:00";
    const f2 = c.champFusionner(ev, "D", m2, "U18 F");
    const e = f2.events.find((x) => x.champKey === "DFU18-2|120");
    assert.equal(e.date, "2026-11-03");
    assert.equal(e.heure, "20:00");
    assert.equal(f2.gardes, 1);
  });
  it("sans correction, un changement de la FFBB est repris", () => {
    const f1 = c.champFusionner([], "D", matchs(), "U18 F");
    const m2 = matchs(); m2.find((m) => m.num === "120").heure = "18:30";
    const f2 = c.champFusionner(f1.events, "D", m2, "U18 F");
    assert.equal(f2.events.find((x) => x.champKey === "DFU18-2|120").heure, "18:30");
  });
  it("ne touche pas aux autres événements du planning", () => {
    const autre = { id: "z", type: "entrainement", date: "2026-10-01", titre: "Entraînement" };
    const f = c.champFusionner([autre], "D", matchs(), "");
    assert.equal(f.events[0].id, "z");
  });
});

describe("Bilan et classement", () => {
  it("le classement n'est proposé que si le fichier couvre la poule (pas seulement nos matchs)", () => {
    const r = c.champLireFbi(lignes()).rencontres, nous = { nom: ASMB, num: 6 };
    assert.equal(c.champPouleComplete({ rencontres: r, nous }), false);
    const autres = [0, 1, 2].map((i) => ({ e1: "X" + i, n1: i, e2: "Y" + i, n2: i, s1: 50, s2: 40, f1: false, f2: false }));
    assert.equal(c.champPouleComplete({ rencontres: r.concat(autres), nous }), true);
  });
  it("bilan de notre équipe : victoires et défaites des matchs joués", () => {
    const nous = { nom: ASMB, num: 6 };
    const mn = c.champLireFbi(lignes()).rencontres.map((m) => c.champMatchNous(m, nous)).filter(Boolean);
    const b = c.champBilan(mn);
    assert.equal(b.j, 3); assert.equal(b.g, 0); assert.equal(b.p, 3);   // 40-61, 34-57 (ext.) et 45-58 (ext.) : trois défaites
  });
  it("classement : victoire 2 pts, défaite 1, forfait 0, tri par points puis différence", () => {
    const R = (e1, e2, s1, s2, f1 = false, f2 = false) => ({ e1, n1: null, e2, n2: null, s1, s2, f1, f2 });
    const cl = c.champClassement([R("A", "B", 70, 60), R("B", "C", 50, 40), R("C", "A", 30, 80), R("A", "B", null, null), R("C", "B", 0, 0, true, false)]);
    // A : 2 victoires (4 pts, 2 matchs) · B : défaite 1 + victoire 2 + victoire par forfait de C 2 = 5 pts · C : 1 + 1 + forfait 0 = 2 pts
    assert.deepEqual(Array.from(cl.map((t) => t.nom)), ["B", "A", "C"]);
    assert.deepEqual(Array.from(cl.map((t) => t.pts)), [5, 4, 2]);
    assert.equal(cl.find((t) => t.nom === "A").j, 2);
    assert.equal(cl.find((t) => t.nom === "C").f, 1);
    assert.deepEqual(Array.from(cl.map((t) => t.rang)), [1, 2, 3]);
  });
});

describe("Synchro FFBB (côté appli)", () => {
  it("extrait le numéro de poule d'un lien ou d'un nombre", () => {
    assert.equal(c.champPouleDepuisTexte("200000012345678"), "200000012345678");
    assert.equal(c.champPouleDepuisTexte("https://competitions.ffbb.com/ligues/ara/comites/0069/poule/1234567"), "1234567");
    assert.equal(c.champPouleDepuisTexte("abc"), "");
  });
  it("préfère le classement officiel FFBB au classement calculé", () => {
    const off = [1, 2, 3].map((r) => ({ rang: r, nom: "E" + r, num: null, pts: 10 - r, j: 5, g: 3, p: 2, diff: 0 }));
    const a = c.champClassementAffiche({ classementFfbb: off, rencontres: [] });
    assert.equal(a.officiel, true);
    assert.equal(c.champClassementAffiche({ rencontres: [] }), null);
  });
});
