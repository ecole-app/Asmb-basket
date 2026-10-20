// Argent de l'indépendant (js/24b-independant-argent.js) : une présence pointée devient une
// ligne « à payer » ou une séance prise sur un pass, jamais en double, jamais perdue.
// Une erreur ici = un client qui paie deux fois, ou un pass qui ne se décompte pas.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app({ plan = "premium", lignes = {}, clients = {} } = {}) {
  const c = charger(["js/24-independant.js", "js/24b-independant-argent.js"]);
  c.ops = [];
  c.fbDb = {};
  c.fbDoc = (_db, ...segs) => segs.join("/");
  c.fbServerTimestamp = () => "TS";
  c.fbArrayUnion = (v) => ({ union: v });
  c.fbArrayRemove = (v) => ({ retire: v });
  c.fbWriteBatch = () => {
    const b = {
      set: (ref, d) => { c.ops.push(["set", ref, d]); return b; },
      update: (ref, d) => { c.ops.push(["update", ref, d]); return b; },
      delete: (ref) => { c.ops.push(["delete", ref]); return b; },
      commit: () => Promise.resolve(),
    };
    return b;
  };
  c.requestAnimationFrame = () => {};
  const I = c.IND;
  I.role = "coach"; I.uid = "dir"; I.club = { plan }; I.lignes = lignes; I.clients = clients;
  return c;
}
// Les objets créés dans le bac à sable n'ont pas les mêmes prototypes : on compare leur contenu.
const plat = (v) => JSON.parse(JSON.stringify(v));
const seance = (o = {}) => Object.assign({ id: "cr1_2026-10-20", date: "2026-10-20", titre: "Cross", prix: 25 }, o);
const pass = (o = {}) => Object.assign({ type: "pass", uid: "cli", compte: "cli", debut: "2026-10-01", fin: "2027-04-01", seances: 10, usages: [], montant: 200, statut: "paye" }, o);

describe("Dates et montants", () => {
  it("un pass de 6 mois : même jour 6 mois après, ou fin de mois si le mois est plus court", () => {
    const c = app();
    assert.equal(c.indAjoutMois("2026-10-17", 6), "2027-04-17");
    assert.equal(c.indAjoutMois("2026-08-31", 6), "2027-02-28");
    assert.equal(c.indAjoutMois("2027-08-31", 6), "2028-02-29");
  });
  it("montants arrondis au centime et affichés en euros", () => {
    const c = app();
    assert.equal(c.indEuros(25), "25 €");
    assert.equal(c.indEuros(12.5), "12,50 €");
    assert.equal(c.indSomme([{ montant: 0.1 }, { montant: 0.2 }]), 0.3);
  });
});

describe("Pass : lequel est utilisé ?", () => {
  it("prend celui qui expire en premier, parmi ceux de la personne et valables ce jour-là", () => {
    const c = app({ lignes: {
      a: pass({ fin: "2027-04-01" }), b: pass({ fin: "2026-12-01" }),
      expire: pass({ fin: "2026-10-10" }), vide: pass({ seances: 1, usages: ["x"] }),
      autre: pass({ uid: "autre", fin: "2026-11-01" }), futur: pass({ debut: "2026-11-01", fin: "2026-11-30" }),
    } });
    assert.equal(c.indPassPour("cli", "2026-10-20").id, "b");
    assert.equal(c.indPassPour("cli", "2026-12-15").id, "a");
    assert.equal(c.indPassPour("inconnu", "2026-10-20"), null);
  });
});

describe("Présence pointée → ligne", () => {
  it("séance payante sans pass : une ligne « à payer » au prix de la séance, pour le parent si c'est un enfant", () => {
    const c = app({ clients: { e_lina: { mineur: true, parentUid: "par" } } });
    c.indArgentPresence(seance(), "e_lina", true);
    assert.equal(c.ops.length, 1);
    const [type, ref, d] = c.ops[0];
    assert.equal(type, "set");
    assert.equal(ref, "indep_lignes/s_cr1_2026-10-20__e_lina");
    assert.deepEqual([d.statut, d.montant, d.compte, d.uid], ["du", 25, "par", "e_lina"]);
  });
  it("avec un pass valable : ligne « pass » à 0 € et la séance est ajoutée au pass", () => {
    const c = app({ lignes: { p1: pass() } });
    c.indArgentPresence(seance(), "cli", true);
    assert.equal(c.ops.length, 2);
    assert.deepEqual([c.ops[0][2].statut, c.ops[0][2].montant, c.ops[0][2].passId], ["pass", 0, "p1"]);
    assert.deepEqual(plat(c.ops[1]), ["update", "indep_lignes/p1", { usages: { union: "cr1_2026-10-20" } }]);
  });
  it("séance gratuite sans pass : aucune ligne", () => {
    const c = app();
    c.indArgentPresence(seance({ prix: 0 }), "cli", true);
    assert.equal(c.ops.length, 0);
  });
  it("jamais en double : pointer deux fois la même présence n'écrit rien de plus", () => {
    const c = app({ lignes: { "s_cr1_2026-10-20__cli": { statut: "du", montant: 25 } } });
    c.indArgentPresence(seance(), "cli", true);
    assert.equal(c.ops.length, 0);
  });
  it("retirer la présence supprime la ligne à payer ; une ligne payée est conservée", () => {
    const du = app({ lignes: { "s_cr1_2026-10-20__cli": { statut: "du", montant: 25 } } });
    du.indArgentPresence(seance(), "cli", false);
    assert.deepEqual(plat(du.ops), [["delete", "indep_lignes/s_cr1_2026-10-20__cli"]]);
    const paye = app({ lignes: { "s_cr1_2026-10-20__cli": { statut: "paye", montant: 25 } } });
    paye.indArgentPresence(seance(), "cli", false);
    assert.equal(paye.ops.length, 0);
  });
  it("retirer une présence prise sur un pass rend la séance au pass", () => {
    const c = app({ lignes: { p1: pass({ usages: ["cr1_2026-10-20"] }), "s_cr1_2026-10-20__cli": { statut: "pass", passId: "p1", montant: 0 } } });
    c.indArgentPresence(seance(), "cli", false);
    assert.deepEqual(plat(c.ops), [["delete", "indep_lignes/s_cr1_2026-10-20__cli"], ["update", "indep_lignes/p1", { usages: { retire: "cr1_2026-10-20" } }]]);
  });
  it("formule Standard : pas de ligne « à payer », mais le pass se décompte", () => {
    const c = app({ plan: "standard" });
    c.indArgentPresence(seance(), "cli", true);
    assert.equal(c.ops.length, 0);
    assert.equal(c.indPremium(), false);
    const c2 = app({ plan: "standard", lignes: { p1: pass({ id: "p1" }) } });
    c2.indArgentPresence(seance(), "cli", true);
    assert.deepEqual(plat(c2.ops.map((o) => [o[0], o[1]])), [["set", "indep_lignes/s_cr1_2026-10-20__cli"], ["update", "indep_lignes/p1"]]);
  });
  it("formule Standard : un pass vendu est enregistré payé (sans suivi des paiements)", () => {
    const c = app({ plan: "standard" });
    c.IND.clients = { cli: { prenom: "Julie", nom: "D" } };
    c.fbSetDoc = (ref, d) => { c.ops.push(["set", ref, d]); return Promise.resolve(); };
    c.indId = () => "p_x";
    c.indVendrePass({ pid: "cli", n: 10, prix: 200, mois: 6, paye: false });
    const d = plat(c.ops[0][2]);
    assert.equal(d.statut, "paye"); assert.equal(d.montant, 200); assert.equal(d.mode, ""); assert.equal(d.datePaiement, d.debut);
  });
});

describe("Soldes", () => {
  it("le solde dû d'un compte additionne seulement les lignes « à payer »", () => {
    const c = app({ lignes: {
      a: { compte: "cli", statut: "du", montant: 25, date: "2026-10-01" }, b: { compte: "cli", statut: "du", montant: 12.5, date: "2026-10-02" },
      c: { compte: "cli", statut: "paye", montant: 25, date: "2026-10-03" }, d: { compte: "cli", statut: "pass", montant: 0, date: "2026-10-04" },
      e: { compte: "autre", statut: "du", montant: 99, date: "2026-10-05" },
    } });
    assert.equal(c.indSomme(c.indDuLignes(c.indLignesCompte("cli"))), 37.5);
  });
  it("pass en cours : encore des séances et pas expiré", () => {
    const c = app();
    const l = [pass({ fin: "2099-01-01" }), pass({ fin: "2020-01-01" }), pass({ fin: "2099-01-01", seances: 1, usages: ["x"] })];
    assert.equal(c.indPassEnCours(l).length, 1);
  });
});
