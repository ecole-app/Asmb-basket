// Règles métier des packs (js/11-admin.js, js/20b-plateforme.js).
// Lancement : cd tests && npm run test:metier
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger, jours, licences } from "./contexte.js";

function app(club) {
  const c = charger(["js/11-admin.js", "js/20b-plateforme.js"], { BOOTSTRAP_CLUB_ID: "asmb" });
  c.CURRENT_CLUB = club;
  return c;
}

describe("Pack du club : modules Premium", () => {
  it("Standard : Premium fermé", () => assert.equal(app({ id: "A", plan: "standard" }).hasPremium(), false));
  it("Premium : ouvert", () => assert.equal(app({ id: "A", plan: "premium" }).hasPremium(), true));
  it("Ancien club payant (paid) : ouvert", () => assert.equal(app({ id: "A", plan: "paid" }).hasPremium(), true));
  it("Essai en cours : tout ouvert", () => assert.equal(app({ id: "A", plan: "trial", trialEndsAt: jours(10) }).hasPremium(), true));
  it("Essai terminé : Premium fermé", () => assert.equal(app({ id: "A", plan: "trial", trialEndsAt: jours(-1) }).hasPremium(), false));
  it("Accès limité : Premium fermé", () => assert.equal(app({ id: "A", plan: "limite" }).hasPremium(), false));
  it("Club d'origine : toujours ouvert", () => assert.equal(app({ id: "asmb", plan: "standard" }).hasPremium(), true));
  it("Session support : ouvert (lecture)", () => { const c = app({ id: "A", plan: "standard" }); c.SUPPORT_MODE = true; assert.equal(c.hasPremium(), true); });
});

describe("Accès limité", () => {
  it("plan limite ou essai terminé = accès limité", () => {
    assert.equal(app({ id: "A", plan: "limite" }).isLimite(), true);
    assert.equal(app({ id: "A", plan: "trial", trialEndsAt: jours(-2) }).isLimite(), true);
  });
  it("essai en cours, Standard, Premium, club d'origine = pas limité", () => {
    assert.equal(app({ id: "A", plan: "trial", trialEndsAt: jours(5) }).isLimite(), false);
    assert.equal(app({ id: "A", plan: "standard" }).isLimite(), false);
    assert.equal(app({ id: "A", plan: "premium" }).isLimite(), false);
    assert.equal(app({ id: "asmb", plan: "limite" }).isLimite(), false);
  });
  it("modules par défaut : licences ouvertes, messagerie et buvette fermées", () => {
    const c = app({ id: "A", plan: "limite" });
    assert.equal(c.limiteOuvert("licences"), true);
    assert.equal(c.limiteOuvert("messagerie"), false);
    assert.equal(c.limiteOuvert("buvette"), false);
  });
  it("les modules gardés par la plateforme sont respectés", () => {
    const c = app({ id: "A", plan: "limite", modulesLimites: { licences: false, messagerie: true } });
    assert.equal(c.limiteOuvert("licences"), false);
    assert.equal(c.limiteOuvert("messagerie"), true);
  });
  it("comptabilité et notes de frais toujours fermées, Paramètres toujours ouverts", () => {
    const c = app({ id: "A", plan: "limite", modulesLimites: { licences: true, inventaire: true } });
    assert.equal(c.adminModuleOuvertLimite("comptabilite"), false);
    assert.equal(c.adminModuleOuvertLimite("notesfrais"), false);
    assert.equal(c.adminModuleOuvertLimite("parametres"), true);
  });
  it("écritures : licences (+ joueurs liés) oui, planning non", () => {
    const c = app({ id: "A", plan: "limite" });
    for (const coll of ["licences", "players", "roster"]) assert.equal(c.limiteEcritureAutorisee(coll), true, coll);
    for (const coll of ["events", "teams", "comptabilite", "sponsors"]) assert.equal(c.limiteEcritureAutorisee(coll), false, coll);
  });
  it("écritures compta automatiques seulement si l'inventaire est gardé", () => {
    assert.equal(app({ id: "A", plan: "limite", modulesLimites: { inventaire: true } }).limiteEcritureAutorisee("comptabilite"), true);
  });
  it("hors accès limité, tout est modifiable", () => {
    assert.equal(app({ id: "A", plan: "standard" }).limiteEcritureAutorisee("events"), true);
  });
});

describe("Limite de 300 licences (Pack Standard)", () => {
  it("299 licences : on peut en ajouter une", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(299);
    assert.equal(c.verifierLimiteLicences(true), true);
  });
  it("270 licences : alerte, mais on peut continuer", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(270);
    assert.equal(c.verifierLimiteLicences(), true);
    assert.equal(c.alertes.length, 1);
  });
  it("300 licences : refus", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(300);
    assert.equal(c.verifierLimiteLicences(), false);
  });
  it("les saisons archivées ne comptent pas", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(250).concat(licences(200, "2025-2026"));
    assert.equal(c.verifierLimiteLicences(true), true);
  });
  it("Premium : pas de limite", () => {
    const c = app({ id: "A", plan: "premium" }); c.licences = licences(450);
    assert.equal(c.verifierLimiteLicences(), true);
  });
  it("accès limité sans le module licences : refus", () => {
    const c = app({ id: "A", plan: "limite", modulesLimites: { licences: false } }); c.licences = licences(10);
    assert.equal(c.verifierLimiteLicences(), false);
  });
  it("dernier verrou à l'enregistrement : 301e refusée", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(300);
    assert.equal(c.licencesDepasseLimite(licences(301)), true);
  });
  it("modifier ou supprimer une licence au-delà de la limite reste possible", () => {
    const c = app({ id: "A", plan: "standard" }); c.licences = licences(310);
    assert.equal(c.licencesDepasseLimite(licences(310)), false);
    assert.equal(c.licencesDepasseLimite(licences(309)), false);
  });
});

describe("Offre gratuite (petits clubs, 60 licences)", () => {
  it("contenu du Standard : Premium fermé, pas d'accès limité", () => {
    const c = app({ id: "A", plan: "gratuit" });
    assert.equal(c.hasPremium(), false);
    assert.equal(c.isLimite(), false);
  });
  it("59 licences : on peut en ajouter une ; 55 : alerte", () => {
    const c = app({ id: "A", plan: "gratuit" }); c.licences = licences(59);
    assert.equal(c.verifierLimiteLicences(true), true);
    const d = app({ id: "A", plan: "gratuit" }); d.licences = licences(55);
    assert.equal(d.verifierLimiteLicences(), true);
    assert.equal(d.alertes.length, 1);
  });
  it("60 licences : refus, avec passage au Standard demandé", () => {
    const c = app({ id: "A", plan: "gratuit" }); c.licences = licences(60);
    assert.equal(c.verifierLimiteLicences(), false);
    assert.match(String(c.alertes[0]), /Standard/);
    assert.equal(c.licencesDepasseLimite(licences(61)), true);
  });
  it("Premium des petits clubs annoncé à 200 €, 300 € pour les autres", () => {
    assert.match(app({ id: "A", plan: "gratuit" }).prixPremium(), /^200/);
    assert.match(app({ id: "A", plan: "standard" }).prixPremium(), /^300/);
  });
});

describe("Fin d'essai (Plateforme)", () => {
  it("essai dépassé → accès limité avec les modules par défaut", async () => {
    const c = app({ id: "P", plan: "premium" });
    const maj = [];
    c.fbDb = {}; c.fbDoc = (db, col, id) => id; c.fbUpdateDoc = (id, data) => { maj.push([id, data]); return Promise.resolve(); };
    const clubs = [
      { id: "fini", plan: "trial", status: "active", trialEndsAt: jours(-1) },
      { id: "encours", plan: "trial", status: "active", trialEndsAt: jours(3) },
      { id: "suspendu", plan: "trial", status: "suspended", trialEndsAt: jours(-5) },
      { id: "paye", plan: "standard", status: "active", trialEndsAt: jours(-40) },
    ];
    const n = await c.expirerEssaisPerimes(clubs);
    assert.equal(n, 1);
    assert.equal(maj.length, 1);
    assert.equal(maj[0][0], "fini");
    assert.equal(maj[0][1].plan, "limite");
    assert.equal(maj[0][1].modulesLimites.licences, true);
    assert.equal(clubs[1].plan, "trial");
  });
  it("jours d'essai restants", () => {
    const c = app({ id: "A" });
    assert.equal(c.joursEssaiRestants({ trialEndsAt: jours(10) }), 10);
    assert.equal(c.joursEssaiRestants({}), null);
  });
});

describe("Échéance d'abonnement et avis de reconduction", () => {
  const c = app({ id: "A" });
  it("rappel entre 3 mois et l'échéance, pas avant", () => {
    assert.equal(c.aboARappeler({ plan: "premium", aboEcheance: jours(200) }), false);
    assert.equal(c.aboARappeler({ plan: "premium", aboEcheance: jours(60) }), true);
  });
  it("plus de rappel une fois l'avis envoyé pour cette échéance", () => {
    const e = jours(60);
    assert.equal(c.aboARappeler({ plan: "standard", aboEcheance: e, aboAvisPour: c.aboCle(e) }), false);
  });
  it("échéance dépassée sans renouvellement : rappel", () => {
    assert.equal(c.aboARappeler({ plan: "standard", aboEcheance: jours(-3) }), true);
  });
  it("pas de rappel pour un essai ou un accès limité", () => {
    assert.equal(c.aboARappeler({ plan: "trial", aboEcheance: jours(10) }), false);
    assert.equal(c.aboARappeler({ plan: "limite", aboEcheance: jours(10) }), false);
  });
  it("renouvellement = même date l'année suivante", () => {
    assert.equal(c.gmPlusUnAn(new Date(2026, 9, 11)).toDateString(), new Date(2027, 9, 11).toDateString());
  });
});
