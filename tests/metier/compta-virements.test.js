// Virements entre comptes et circuit des notes de frais (js/15h-compta-virements.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(notes = []) {
  const st = { notes, ecrit: 0 };
  const c = charger(["js/15-compta-inventaire.js", "js/15b-compta-plan.js", "js/15d-compta-bilan.js", "js/15h-compta-virements.js"], {
    authEsc: (x) => x, gmJs: (x) => x, fsWriteCollection: () => { st.ecrit++; },
    hasPremium: () => true, hasModulePermission: () => true, GM_DEMO: true,
    getNotesFrais: () => JSON.parse(JSON.stringify(st.notes)), saveNotesFrais: (n) => { st.notes = JSON.parse(JSON.stringify(n)); },
  });
  c.st = st; return c;
}
const J = (x) => JSON.parse(JSON.stringify(x));
const solde = (c, compte) => c.getComptabiliteTout().filter((l) => c.comptaLigneCompte(l) === compte)
  .reduce((s, l) => s + (l.type === "depense" ? -1 : 1) * l.montant, 0);

describe("Virement entre comptes", () => {
  it("2 lignes liées, invisibles pour les recettes/dépenses, soldes justes", () => {
    const c = app();
    c.saveComptabilite([{ id: "a", date: "2026-11-01", montant: 100, type: "recette", categorie: "Dons", compte: "Caisse espèces" }]);
    const vid = c.comptaVirementCreer({ de: "Caisse espèces", vers: "Banque", montant: 60, date: "2026-11-02" });
    assert.equal(c.getComptabiliteTout().length, 3);
    assert.equal(c.getComptabilite().length, 1);
    assert.equal(solde(c, "Caisse espèces"), 40);
    assert.equal(solde(c, "Banque"), 60);
    const ex = c.comptaExercice("2026-11-02");
    assert.equal(c.comptaCompteResultat(c.comptaLignesPeriode(c.getComptabilite(), ex)).resultat, 100);
    // FEC : une seule écriture, banque au débit, caisse au crédit
    const e = J(c.getComptabiliteTout().filter((l) => l.virement).map((l) => c.comptaEcritures(l)).flat());
    assert.deepEqual(e.map((x) => [x.compte, x.debit, x.credit]), [["512", 60, 0], ["530", 0, 60]]);
    // saveComptabilite (sans les virements) ne les efface pas
    c.saveComptabilite(c.getComptabilite());
    assert.equal(c.getComptabiliteTout().length, 3);
    c.comptaVirementSupprimer(vid);
    assert.equal(c.getComptabiliteTout().length, 1);
  });
});

describe("Notes de frais", () => {
  const note = { id: "n1", date: "2026-11-05", montant: 30, motif: "Essence", demandeurNom: "Coach", statut: "soumise" };
  it("reçue → dépense sur « Notes de frais à rembourser », puis remboursée par virement", () => {
    const c = app([note]);
    assert.equal(c.ndfSynchroCompta(), 1);
    assert.equal(c.st.notes[0].statut, "arembourser");
    assert.equal(solde(c, "Notes de frais à rembourser"), -30);
    assert.equal(c.ndfSynchroCompta(), 0);
    const vid = c.comptaVirementCreer({ de: "Banque", vers: c.COMPTA_NDF, montant: 30, date: "2026-11-10", ndfId: "n1" });
    assert.equal(solde(c, "Notes de frais à rembourser"), 0);
    assert.equal(solde(c, "Banque"), -30);
    const ex = c.comptaExercice("2026-11-10");
    assert.equal(c.comptaCompteResultat(c.comptaLignesPeriode(c.getComptabilite(), ex)).resultat, -30);
    assert.ok(vid);
  });
  it("le compte de dette n'est pas une disponibilité du bilan", () => {
    const c = app([note]); c.ndfSynchroCompta();
    assert.ok(!J(c.comptaBilanComptesTreso(c.getComptabiliteTout())).includes("Notes de frais à rembourser"));
  });
  it("suppression de la note : toutes ses lignes partent", () => {
    const c = app([note]); c.ndfSynchroCompta();
    const n = c.st.notes[0]; n.virementId = c.comptaVirementCreer({ de: "Banque", vers: c.COMPTA_NDF, montant: 30, date: "2026-11-10", ndfId: "n1" });
    c.ndfSupprimerCompta(n);
    assert.equal(c.getComptabiliteTout().length, 0);
  });
});
