// Compta « façon Dolibarr » (js/15b-compta-plan.js) : exercice, plan comptable, n° de pièce.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(reglages) {
  const c = charger(["js/15-compta-inventaire.js", "js/15b-compta-plan.js"], { fsWriteCollection() {} });
  if (reglages) c.localStorage.setItem("asmb_compta_reglages", JSON.stringify(reglages));
  return c;
}

describe("Exercice comptable", () => {
  it("année civile par défaut", () => {
    const c = app();
    assert.deepEqual(JSON.parse(JSON.stringify(c.comptaExercice("2026-10-13"))), { cle: "2026", debut: "2026-01-01", fin: "2026-12-31", label: "2026" });
  });
  it("saison septembre → août", () => {
    const c = app({ debutMois: 9 });
    const e = c.comptaExercice("2027-03-02");
    assert.equal(e.label, "2026-2027"); assert.equal(e.debut, "2026-09-01"); assert.equal(e.fin, "2027-08-31");
    assert.equal(c.comptaExercice("2026-09-01").cle, "2026");
    assert.equal(c.comptaExercice("2026-08-31").cle, "2025");
  });
  it("fin de février bissextile correcte (exercice mars → février)", () => {
    const c = app({ debutMois: 3 });
    assert.equal(c.comptaExercice("2027-06-01").fin, "2028-02-29");
  });
});

describe("Plan comptable associatif", () => {
  it("catégories → comptes par défaut, y compris celles des écritures automatiques", () => {
    const c = app();
    assert.equal(c.comptaCompteNum({ type: "recette", categorie: "Cotisations/Licences" }), "756");
    assert.equal(c.comptaCompteNum({ type: "recette", categorie: "Licence" }), "756");
    assert.equal(c.comptaCompteNum({ type: "recette", categorie: "Buvette/Événements" }), "707");
    assert.equal(c.comptaCompteNum({ type: "depense", categorie: "Location salle" }), "613");
    assert.equal(c.comptaCompteNum({ type: "depense", categorie: "Note de frais" }), "625");
    assert.equal(c.comptaCompteNum({ type: "depense", categorie: "Inconnue" }), "658");
    assert.equal(c.comptaCompteNum({ type: "recette" }), "758");
  });
  it("réglage du club, puis choix sur la ligne, priment", () => {
    const c = app({ comptes: { "recette|Dons": "7541" } });
    assert.equal(c.comptaCompteNum({ type: "recette", categorie: "Dons" }), "7541");
    assert.equal(c.comptaCompteNum({ type: "recette", categorie: "Dons", compteNum: "755" }), "755");
  });
  it("trésorerie et journal suivent le compte/caisse (ou le moyen pour les vieilles lignes)", () => {
    const c = app();
    assert.equal(c.comptaTresoNum({ compte: "Banque" }), "512");
    assert.equal(c.comptaJournal({ compte: "Banque" }), "BQ");
    assert.equal(c.comptaJournal({ compte: "Caisse buvette" }), "CA");
    assert.equal(c.comptaJournal({ moyen: "Espèces" }), "CA");
    assert.equal(c.comptaJournal({ moyen: "Virement" }), "BQ");
    assert.equal(c.comptaJournal({ compte: "Autre" }), "OD");
  });
  it("libellé d'un sous-compte inconnu : celui du compte parent", () => {
    const c = app();
    assert.equal(c.comptaLibCompte("61351"), "Locations");
  });
});

describe("Numéros de pièce", () => {
  it("continus par journal et par exercice, dans l'ordre des dates", () => {
    const c = app();
    const l = [
      { id: "3", date: "2026-03-01", type: "recette", compte: "Banque" },
      { id: "1", date: "2026-01-05", type: "recette", compte: "Banque" },
      { id: "2", date: "2026-02-01", type: "depense", compte: "Caisse espèces" },
      { id: "4", date: "2025-12-31", type: "depense", compte: "Banque" },
    ];
    assert.equal(c.comptaNumeroter(l), 4);
    assert.deepEqual(l.map((x) => x.piece), ["BQ26-0002", "BQ26-0001", "CA26-0001", "BQ25-0001"]);
  });
  it("donnés une fois : une nouvelle ligne prend la suite, sans renuméroter", () => {
    const c = app();
    const l = [{ id: "1", date: "2026-05-01", compte: "Banque", piece: "BQ26-0007" }, { id: "2", date: "2026-01-01", compte: "Banque" }];
    assert.equal(c.comptaNumeroter(l), 1);
    assert.equal(l[0].piece, "BQ26-0007");
    assert.equal(l[1].piece, "BQ26-0008");
    assert.equal(c.comptaNumeroter(l), 0);
  });
  it("une ligne passée de la caisse à la banque change de journal", () => {
    const c = app();
    const l = [{ id: "1", date: "2026-05-01", compte: "Banque", piece: "CA26-0001" }];
    c.comptaNumeroter(l);
    assert.equal(l[0].piece, "BQ26-0001");
  });
  it("doublon (deux appareils hors ligne) : la seconde ligne est renumérotée", () => {
    const c = app();
    const l = [{ id: "1", date: "2026-05-01", compte: "Banque", piece: "BQ26-0001" }, { id: "2", date: "2026-05-02", compte: "Banque", piece: "BQ26-0001" }];
    assert.equal(c.comptaDedoublonnerPieces(l), 1);
    c.comptaNumeroter(l);
    assert.deepEqual(l.map((x) => x.piece), ["BQ26-0001", "BQ26-0002"]);
  });
  it("exercice saison : le préfixe suit l'année de début", () => {
    const c = app({ debutMois: 9 });
    const l = [{ id: "1", date: "2027-02-01", compte: "Banque" }];
    c.comptaNumeroter(l);
    assert.equal(l[0].piece, "BQ26-0001");
  });
});

describe("Compte de résultat et FEC", () => {
  const lignes = [
    { id: "1", date: "2026-09-05", montant: 120, type: "recette", categorie: "Licence", compte: "Banque", piece: "BQ26-0001", motif: "Licence Léo" },
    { id: "2", date: "2026-09-12", montant: 300, type: "depense", categorie: "Location salle", compte: "Banque", piece: "BQ26-0002", motif: "Gymnase\tseptembre" },
    { id: "3", date: "2026-10-01", montant: 45.5, type: "recette", categorie: "Buvette/Événements", compte: "Caisse buvette", piece: "CA26-0001", motif: "Buvette" },
    { id: "4", date: "2026-10-02", montant: 200, type: "recette", categorie: "Dons", compte: "Banque", piece: "BQ26-0003", motif: "Don", tiers: "Mme X" },
    { id: "5", date: "2026-10-03", montant: -20, type: "depense", categorie: "Matériel", compte: "Banque", piece: "BQ26-0004", motif: "Avoir ballons" },
  ];
  it("rubriques du plan associatif, total et résultat", () => {
    const c = app();
    const cr = c.comptaCompteResultat(lignes);
    const p = Object.fromEntries(cr.produits.filter((r) => r.total).map((r) => [r.lib.split(" ")[0], r.total]));
    assert.deepEqual(p, { Cotisations: 120, Ventes: 45.5, "Dons,": 200 });
    assert.equal(cr.totalProduits, 365.5);
    // avoir de 20 € : réduit les achats (60), sans devenir un produit
    assert.equal(cr.charges.find((r) => r.re.test("613")).total, 300);
    assert.equal(cr.charges.find((r) => r.re.test("6063")).total, -20);
    assert.equal(cr.totalCharges, 280);
    assert.equal(cr.resultat, 85.5);
  });
  it("FEC : 18 colonnes, écritures équilibrées, tabulations nettoyées", () => {
    const c = app();
    const f = c.comptaFecTexte(lignes);
    const rows = f.texte.replace(/\r\n$/, "").split("\r\n").map((r) => r.split("\t"));
    assert.equal(rows[0].length, 18);
    assert.equal(rows[0][0], "JournalCode");
    assert.ok(rows.every((r) => r.length === 18));
    assert.equal(f.ecritures, 5);
    assert.equal(rows.length, 1 + 10);
    assert.equal(f.debit, f.credit);
    const loc = rows.filter((r) => r[2] === "BQ26-0002");
    assert.deepEqual(loc.map((r) => [r[4], r[11], r[12]]), [["613", "300,00", "0,00"], ["512", "0,00", "300,00"]]);
    assert.equal(loc[0][3], "20260912");
    assert.equal(loc[0][10], "Gymnase septembre");
    const buv = rows.filter((r) => r[2] === "CA26-0001");
    assert.deepEqual(buv.map((r) => [r[0], r[4], r[11], r[12]]), [["CA", "531", "45,50", "0,00"], ["CA", "707", "0,00", "45,50"]]);
    const avoir = rows.filter((r) => r[2] === "BQ26-0004");
    assert.deepEqual(avoir.map((r) => [r[4], r[11], r[12]]), [["512", "20,00", "0,00"], ["6063", "0,00", "20,00"]]);
    assert.match(rows.find((r) => r[2] === "BQ26-0003")[10], /Don - Mme X/);
  });
  it("encodage ISO-8859-15 : accents et euro sur un octet", () => {
    const c = app();
    assert.deepEqual(Array.from(c.comptaIso885915("é€’")), [0xe9, 0xa4, 0x27]);
  });
});
