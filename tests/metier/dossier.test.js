// Dossier d'inscription réglable par club (js/06j-dossier.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(club = {}) {
  const c = charger(["js/06j-dossier.js"], { authEsc: (x) => String(x), BOOTSTRAP_CLUB_ID: "asmb" });
  c.CURRENT_CLUB = club;
  return c;
}

describe("Dossier : point de départ", () => {
  it("l'ASMB part de son modèle (santé active, 7 questions, 6 autorisations, tarifs)", () => {
    const d = app({ id: "asmb" }).dossierClub();
    assert.equal(d.sante.actif, true);
    assert.equal(d.sante.questions.length, 7);
    assert.equal(d.autorisations.length, 6);
    assert.equal(d.tarifs.lignes[0].prix, 120);
    assert.ok(d.charte.texte.includes("RÈGLES D'OR"));
  });
  it("un autre club part d'une base vide : rien d'obligatoire en plus", () => {
    const d = app({ id: "autre" }).dossierClub();
    assert.equal(d.sante.actif, false);
    assert.equal(d.autorisations.length, 0);
    assert.equal(d.perso.length, 0);
    assert.equal(d.tarifs.lignes.length, 0);
  });
  it("le réglage enregistré du club remplace le modèle, même pour l'ASMB", () => {
    const d = app({ id: "asmb", dossier: { v: 1, perso: [{ label: "Taille", type: "nombre" }] } }).dossierClub();
    assert.equal(d.perso.length, 1);
    assert.equal(d.autorisations.length, 0);
  });
});

describe("Dossier : nettoyage", () => {
  it("retire les lignes vides, borne les types et les longueurs", () => {
    const c = app();
    const d = c.dossierNormaliser({ v: 1, perso: [{ label: "", type: "texte" }, { label: "x".repeat(200), type: "bizarre" }],
      tarifs: { lignes: [{ label: "U11", prix: "140" }, { label: " ", prix: 5 }] }, autorisations: [{ titre: "A", texte: "t", type: "nimporte" }] });
    assert.equal(d.perso.length, 1);
    assert.equal(d.perso[0].label.length, 60);
    assert.equal(d.perso[0].type, "texte");
    assert.equal(d.tarifs.lignes.length, 1);
    assert.equal(d.tarifs.lignes[0].prix, 140);
    assert.equal(d.autorisations[0].type, "choix");
  });
  it("la version publique ne contient pas l'en-tête (adresse, RNA, SIRET)", () => {
    const c = app({ id: "x", dossier: { v: 1, entete: { adresse: "1 rue", siret: "123" } } });
    assert.equal(c.dossierPourCodes().entete, undefined);
    assert.equal(c.dossierClub().entete.siret, "123");
  });
});

describe("Dossier : lecture des réponses", () => {
  it("rien d'activé : rien à lire, rien de bloquant", () => {
    const c = app({ id: "x" });
    assert.deepEqual({ ...c.dossierLireFiche() }, {});
  });
  it("la fiche affiche les lignes complémentaires et les autorisations dans le détail", () => {
    const c = app();
    const l = c.dossierDetailLignes({ infosPlus: [{ l: "Taille", v: "150" }], charteLue: true, autorisations: [{ t: "Droit à l'image", v: "non" }, { t: "Soins", v: "lu" }] });
    assert.deepEqual([...l.map((x) => x[1])], ["150", "Lue et approuvée", "Refuse", "Lu et approuvé"]);
  });
});
