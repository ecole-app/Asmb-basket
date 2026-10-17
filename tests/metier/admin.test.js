// js/11-admin.js : déjà couvert pour la famille accès limité/Premium
// (packs.test.js, ecriture.test.js, import.test.js). Ici, ce qui ne l'était
// pas encore : la catégorie déduite de la date de naissance (affecte
// l'équipe et les effectifs d'un joueur), le tri catégorie/genre/nom, le
// prix Premium affiché, et surtout rosterDepuisJoueurs — qui ne doit
// JAMAIS laisser passer une photo sans consentement dans le roster partagé
// avec les autres comptes (bug réel déjà corrigé une fois sur ce point).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(opts = {}) {
  const c = charger(["js/11-admin.js"]);
  c.CURRENT_CLUB = opts.club || {};
  c.SUPPORT_MODE = opts.support || false;
  c.licences = opts.licences || [];
  c.getLicences = () => c.licences;
  c.getCurrentSeason = () => opts.season || "2026-2027";
  return c;
}
// Reproduit indépendamment la référence de saison (sept. → juin) utilisée
// par categorieFromNaissance, pour construire des dates de naissance à un
// âge exact sans dépendre du mois d'exécution du test.
function seasonRefYear() {
  const n = new Date();
  return n.getMonth() >= 8 ? n.getFullYear() + 1 : n.getFullYear();
}
const naissPourAge = (age) => (seasonRefYear() - age) + "-06-15";

describe("Catégorie déduite de la naissance (categorieFromNaissance)", () => {
  it("les paliers U7 à U18, indépendants du genre", () => {
    const c = app();
    assert.equal(c.categorieFromNaissance(naissPourAge(5)), "U7");
    assert.equal(c.categorieFromNaissance(naissPourAge(6)), "U7");
    assert.equal(c.categorieFromNaissance(naissPourAge(7)), "U9");
    assert.equal(c.categorieFromNaissance(naissPourAge(8)), "U9");
    assert.equal(c.categorieFromNaissance(naissPourAge(9)), "U11");
    assert.equal(c.categorieFromNaissance(naissPourAge(10)), "U11");
    assert.equal(c.categorieFromNaissance(naissPourAge(11)), "U13");
    assert.equal(c.categorieFromNaissance(naissPourAge(12)), "U13");
    assert.equal(c.categorieFromNaissance(naissPourAge(13)), "U15");
    assert.equal(c.categorieFromNaissance(naissPourAge(14)), "U15");
    assert.equal(c.categorieFromNaissance(naissPourAge(15)), "U18");
    assert.equal(c.categorieFromNaissance(naissPourAge(17)), "U18");
  });
  it("U21 réservée aux garçons : les filles passent directement en Senior", () => {
    const c = app();
    assert.equal(c.categorieFromNaissance(naissPourAge(18), "M"), "U21");
    assert.equal(c.categorieFromNaissance(naissPourAge(20), "M"), "U21");
    assert.equal(c.categorieFromNaissance(naissPourAge(18), "F"), "Senior");
    assert.equal(c.categorieFromNaissance(naissPourAge(18)), "Senior"); // genre non renseigné
  });
  it("au-delà de 20 ans, tout le monde est Senior", () => {
    const c = app();
    assert.equal(c.categorieFromNaissance(naissPourAge(21), "M"), "Senior");
    assert.equal(c.categorieFromNaissance(naissPourAge(40), "F"), "Senior");
  });
  it("pas de date, ou année illisible : aucune catégorie", () => {
    const c = app();
    assert.equal(c.categorieFromNaissance(""), null);
    assert.equal(c.categorieFromNaissance(null), null);
    assert.equal(c.categorieFromNaissance("abcd-01-01"), null);
  });
});

describe("Tri catégorie puis genre puis nom", () => {
  it("catRank respecte l'ordre U6 → Senior, catégorie inconnue en dernier", () => {
    const c = app();
    assert.ok(c.catRank("U9") < c.catRank("U13"));
    assert.ok(c.catRank("U18") < c.catRank("Senior"));
    assert.equal(c.catRank("Inconnue"), 99);
  });
  it("genreNorm ramène tout ce qui n'est pas F/M à « NR »", () => {
    const c = app();
    assert.equal(c.genreNorm("F"), "F");
    assert.equal(c.genreNorm("M"), "M");
    assert.equal(c.genreNorm(""), "NR");
    assert.equal(c.genreNorm(undefined), "NR");
  });
  it("genreMatch : filtre vide ou « all » accepte tout, sinon exact", () => {
    const c = app();
    assert.equal(c.genreMatch("F", ""), true);
    assert.equal(c.genreMatch("F", "all"), true);
    assert.equal(c.genreMatch("F", "F"), true);
    assert.equal(c.genreMatch("F", "M"), false);
    assert.equal(c.genreMatch(undefined, "F"), false); // non renseigné != NR demandé explicitement... voir genreNorm
  });
  it("compareCatGenreNom : catégorie d'abord, puis filles avant garçons, puis nom", () => {
    const c = app();
    assert.ok(c.compareCatGenreNom("U13", "F", "Z", "U15", "F", "A") < 0); // catégorie prime sur le nom
    assert.ok(c.compareCatGenreNom("U13", "F", "A", "U13", "M", "A") < 0); // filles avant garçons
    assert.ok(c.compareCatGenreNom("U13", "F", "Amel", "U13", "F", "Zoé") < 0); // puis le nom
  });
});

describe("Effectifs par catégorie et genre (effectifsParCatGenre)", () => {
  it("compte par catégorie/genre, cumule une ligne « tous », trie par catégorie", () => {
    const c = app();
    const items = [
      { cat: "U13", genre: "F" }, { cat: "U13", genre: "M" }, { cat: "U13", genre: "F" },
      { cat: "U9", genre: "M" },
    ];
    const r = c.effectifsParCatGenre(items, (x) => x.cat, (x) => x.genre);
    assert.deepEqual([...r.rows.map((x) => x.cat)], ["U9", "U13"]); // U9 avant U13
    const u13 = r.rows.find((x) => x.cat === "U13");
    assert.deepEqual({ F: u13.F, M: u13.M, total: u13.total }, { F: 2, M: 1, total: 3 });
    assert.equal(r.all.total, 4);
  });
  it("catégorie absente : regroupée sous « Non classée »", () => {
    const c = app();
    const r = c.effectifsParCatGenre([{ cat: null, genre: "F" }], (x) => x.cat, (x) => x.genre);
    assert.equal(r.rows[0].cat, "Non classée");
  });
});

describe("Prix et plafond selon la formule", () => {
  it("prixPremium : 200€ pour un club en offre gratuite, 300€ sinon", () => {
    const c1 = app({ club: { plan: "gratuit" } });
    assert.equal(c1.prixPremium(), "200 €/an");
    const c2 = app({ club: { plan: "standard" } });
    assert.equal(c2.prixPremium(), "300 €/an");
  });
  it("limiteLicencesClub : 60 en offre gratuite, 300 en Standard, illimité en Premium", () => {
    assert.equal(app({ club: { plan: "gratuit" } }).limiteLicencesClub(), 60);
    assert.equal(app({ club: { plan: "standard" } }).limiteLicencesClub(), 300);
    assert.equal(app({ club: { plan: "premium" } }).limiteLicencesClub(), Infinity);
  });
  it("nbLicencesSaison : ne compte que les joueurs de la saison en cours", () => {
    const c = app({
      season: "2026-2027",
      licences: [
        { role: "joueur", saison: "2026-2027" },
        { role: "joueur", saison: "2025-2026" }, // saison passée, pas comptée
        { role: "coach", saison: "2026-2027" },  // pas un joueur
        { saison: "2026-2027" }, // role absent = joueur par défaut
      ],
    });
    assert.equal(c.nbLicencesSaison(), 2);
  });
  it("messageLimiteLicences : oriente vers Standard pour le gratuit, Premium sinon", () => {
    const gratuit = app({ club: { plan: "gratuit" } }).messageLimiteLicences();
    assert.ok(gratuit.includes("Pack Standard"));
    const standard = app({ club: { plan: "standard" } }).messageLimiteLicences();
    assert.ok(standard.includes("Pack Premium"));
  });
});

describe("Roster partagé — jamais de photo sans consentement (rosterDepuisJoueurs)", () => {
  it("photo retirée si l'autorisation n'a pas été cochée", () => {
    const c = app();
    const r = c.rosterDepuisJoueurs([{ id: "p1", prenom: "Léa", photo: "data:image/...", photoAutorisee: false }]);
    assert.equal(r[0].photo, null);
  });
  it("photo conservée seulement si l'autorisation est cochée", () => {
    const c = app();
    const r = c.rosterDepuisJoueurs([{ id: "p1", photo: "data:image/...", photoAutorisee: true }]);
    assert.equal(r[0].photo, "data:image/...");
  });
  it("pas de champ photoAutorisee du tout : traité comme non autorisé", () => {
    const c = app();
    const r = c.rosterDepuisJoueurs([{ id: "p1", photo: "data:image/..." }]);
    assert.equal(r[0].photo, null);
  });
  it("joueur sans id : exclu du roster", () => {
    const c = app();
    const r = c.rosterDepuisJoueurs([{ prenom: "SansId" }, { id: "p1", prenom: "AvecId" }]);
    assert.equal(r.length, 1);
    assert.equal(r[0].prenom, "AvecId");
  });
  it("marqué _roster pour empêcher une réécriture accidentelle des fiches complètes", () => {
    const c = app();
    assert.equal(c.rosterDepuisJoueurs([{ id: "p1" }])[0]._roster, true);
  });
});

describe("Nom affiché d'un compte (compteNom)", () => {
  it("prénom + nom, sans espace en trop", () => {
    const c = app();
    assert.equal(c.compteNom({ prenom: "Karim", nom: "Benali" }), "Karim Benali");
    assert.equal(c.compteNom({ prenom: "Karim" }), "Karim");
    assert.equal(c.compteNom({}), "");
  });
  it("pas de compte : chaîne vide", () => {
    const c = app();
    assert.equal(c.compteNom(null), "");
  });
});
