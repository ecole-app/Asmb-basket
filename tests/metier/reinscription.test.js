// Réinscription en ligne (js/06b-reinscription.js) : transforme les demandes
// envoyées par les familles en licences "Reçue". Le vrai risque est la
// duplication — un double clic, un retry réseau ou une fiche déjà créée à la
// main par le staff ne doivent jamais donner deux licences pour le même enfant.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function flush() { return new Promise((r) => setTimeout(r, 0)); }

function app(opts = {}) {
  const c = charger(["js/06b-reinscription.js"], {
    isStaffUser: () => opts.staff !== false,
    FS_PREV: { licences: opts.licencesSync !== false },
    normNomPrenom: (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().replace(/\s+/g, " ").toLowerCase(),
    genCode: () => "NEWCODE",
    getCurrentSeason: () => opts.currentSeason || "2026-2027",
    computeNaturalSeason: () => opts.naturalSeason || "2026-2027",
  });
  c.players = opts.players || [];
  c.getPlayers = () => c.players;
  c.licences = opts.licences || [];
  c.getLicences = () => c.licences;
  c.saveLicences = opts.saveLicences || ((l) => { c.licences = l; return true; });
  c.fbDb = {}; c.fbCollection = (...a) => a.join("/"); c.fbDoc = (_db, ...s) => s.join("/");
  c.fbQuery = (...a) => a; c.fbWhere = (...a) => a;
  c.ecritures = [];
  c.fbUpdateDoc = (ref, maj) => { c.ecritures.push({ ref, maj }); return Promise.resolve(); };
  c.demandes = opts.demandes || [];
  c.fbGetDocs = () => Promise.resolve({
    forEach(fn) { c.demandes.filter((d) => (d.statut || "nouvelle") === "nouvelle").forEach((d) => fn({ id: d._id, data: () => d })); },
  });
  return c;
}

describe("Saison ciblée (saisonReinscriptionCible)", () => {
  it("prend la saison naturelle si elle est plus récente", () => {
    const c = app({ currentSeason: "2025-2026", naturalSeason: "2026-2027" });
    assert.equal(c.saisonReinscriptionCible(), "2026-2027");
  });
  it("sinon reste sur la saison en cours (jamais en arrière)", () => {
    const c = app({ currentSeason: "2026-2027", naturalSeason: "2025-2026" });
    assert.equal(c.saisonReinscriptionCible(), "2026-2027");
  });
});

describe("Import des demandes (importerReinscriptions)", () => {
  it("nouvel enfant : licence créée, demande marquée importée", async () => {
    const c = app({ demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: { prenom: "Léa", nom: "Martin" } }] });
    c.importerReinscriptions();
    await flush();
    assert.equal(c.licences.length, 1);
    assert.equal(c.licences[0].statut, "recue");
    assert.equal(c.licences[0].reinscriptionEnLigne, true);
    assert.equal(c.ecritures.length, 1);
    assert.equal(c.ecritures[0].maj.statut, "importee");
    assert.equal(c.ecritures[0].maj.licenceId, c.licences[0].id);
  });
  it("enfant déjà licencié la saison dernière : fiche reprise, code de l'ancienne tracé", async () => {
    const c = app({
      players: [{ id: "p1", prenom: "Léa", nom: "Martin" }],
      licences: [{ id: "old1", code: "OLD1", saison: "2025-2026", fiche: { prenom: "Léa", nom: "Martin", telephone: "0600000000" } }],
      demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: { prenom: "Léa", nom: "Martin", telephone: "0611111111" } }],
    });
    c.importerReinscriptions();
    await flush();
    const nouvelle = c.licences.find((l) => l.id === "re_d1");
    assert.ok(nouvelle);
    assert.equal(nouvelle.renouveleeDeCode, "OLD1");
    assert.equal(nouvelle.fiche.telephone, "0611111111"); // le champ mis à jour par la famille l'emporte
  });
  it("demande déjà importée (même id) : pas de doublon, la demande est juste re-marquée", async () => {
    const c = app({
      licences: [{ id: "re_d1", code: "X", saison: "2026-2027", fiche: {} }],
      demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: {} }],
    });
    c.importerReinscriptions();
    await flush();
    assert.equal(c.licences.length, 1); // pas de nouvelle licence
    assert.equal(c.ecritures[0].maj.licenceId, "re_d1");
  });
  it("licence déjà créée à la main par le staff pour le même enfant et la même saison : pas de doublon", async () => {
    const c = app({
      players: [{ id: "p1", prenom: "Léa", nom: "Martin" }],
      licences: [{ id: "manuelle1", code: "MAN1", saison: "2026-2027", fiche: { prenom: "Léa", nom: "Martin" } }],
      demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: { prenom: "Léa", nom: "Martin" } }],
    });
    c.importerReinscriptions();
    await flush();
    assert.equal(c.licences.length, 1);
    assert.equal(c.ecritures[0].maj.licenceId, "manuelle1");
  });
  it("aucune demande en attente : rien n'est écrit", async () => {
    const c = app({ demandes: [] });
    c.importerReinscriptions();
    await flush();
    assert.equal(c.licences.length, 0);
    assert.equal(c.ecritures.length, 0);
  });
  it("limite de licences atteinte (saveLicences refuse) : la demande n'est pas marquée, pour réessayer plus tard", async () => {
    const c = app({
      demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: {} }],
      saveLicences: () => false,
    });
    c.importerReinscriptions();
    await flush();
    assert.equal(c.ecritures.length, 0);
  });
  it("pas un compte staff : ne lit même pas les demandes", async () => {
    const c = app({ staff: false, demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: {} }] });
    let appele = false;
    c.fbGetDocs = () => { appele = true; return Promise.resolve({ forEach() {} }); };
    c.importerReinscriptions();
    await flush();
    assert.equal(appele, false);
  });
  it("licences pas encore synchronisées localement : n'importe rien pour ne pas écraser du plus récent", async () => {
    const c = app({ licencesSync: false, demandes: [{ _id: "d1", statut: "nouvelle", playerId: "p1", saison: "2026-2027", fiche: {} }] });
    let appele = false;
    c.fbGetDocs = () => { appele = true; return Promise.resolve({ forEach() {} }); };
    c.importerReinscriptions();
    await flush();
    assert.equal(appele, false);
  });
});
