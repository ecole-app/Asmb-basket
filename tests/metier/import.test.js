// Import des licences CSV / Excel (js/06f-import.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/06f-import.js"], { authEsc: (x) => x, TextDecoder });
const csv = (t) => JSON.parse(JSON.stringify(c.impParseCsv(t))); // recopie hors bac à sable

describe("Lecture CSV", () => {
  it("point-virgule, guillemets et retours Windows", () => {
    const r = csv('Nom;Prénom;Naissance\r\n"DUPONT, Jr";Léa;12/03/2015\r\n');
    assert.deepEqual(r[1], ["DUPONT, Jr", "Léa", "12/03/2015"]);
  });
  it("virgule détectée", () => assert.deepEqual(csv("a,b\n1,2")[1], ["1", "2"]));
});

describe("Valeurs", () => {
  it("dates", () => {
    assert.equal(c.impDate("05/09/2014"), "2014-09-05");
    assert.equal(c.impDate("2014-9-5"), "2014-09-05");
    assert.equal(c.impDate("n'importe quoi"), "");
  });
  it("genre", () => {
    assert.equal(c.impGenre("Féminin"), "F");
    assert.equal(c.impGenre("Garçon"), "M");
    assert.equal(c.impGenre(""), "");
  });
  it("colonnes reconnues malgré accents et casse", () => {
    const m = c.impAutoMap(["NOM", "Prénom", "Date de naissance", "Sexe", "Courriel", "N° de licence"]);
    assert.deepEqual([m.nom, m.prenom, m.naissance, m.genre, m.email, m.numLicence], [0, 1, 2, 3, 4, 5]);
  });
});

describe("Analyse", () => {
  const ent = ["Nom", "Prénom", "Naissance", "Sexe"];
  const map = c.impAutoMap(ent);
  const exist = [{ id: "1", fiche: { nom: "Dupont", prenom: "Léa", naissance: "2015-03-12" } }];
  it("nouvelle, existante, à vérifier, doublon du fichier", () => {
    const r = c.impAnalyser(ent, [
      ["DUPONT", "lea", "12/03/2015", "F"],
      ["Martin", "Tom", "01/02/2012", "M"],
      ["Martin", "Tom", "01/02/2012", "M"],
      ["Sans", "Date", "", "M"],
      ["", "", "", ""],
    ], map, exist);
    assert.equal(r.maj.length, 1);
    assert.equal(r.nouvelles.length, 1);
    assert.equal(r.aVerifier.length, 2);
  });
  it("une fiche existante n'est complétée que sur les cases vides", () => {
    const lic = { id: "1", fiche: { nom: "Dupont", prenom: "Léa", naissance: "2015-03-12", telephone: "0600000000" } };
    c.CATS_LIC = ["U7"]; c.genCode = () => "X";
    c.impAppliquer({ nouvelles: [], maj: [{ licence: lic, donnees: { telephone: "0611111111", email: "a@b.fr", genre: "F" } }] }, [lic], "2026-2027");
    assert.equal(lic.fiche.telephone, "0600000000");
    assert.equal(lic.fiche.emailLic, "a@b.fr");
  });
});

describe("Rôle à l'import et limite du pack", () => {
  it("fonction → rôle", () => {
    assert.equal(c.impRole("Entraîneur"), "coach");
    assert.equal(c.impRole("Technicien"), "coach");
    assert.equal(c.impRole("Arbitre"), "autre");
    assert.equal(c.impRole("Joueur"), "joueur");
    assert.equal(c.impRole(""), "joueur");
  });
  it("les coachs ne comptent pas dans la limite du pack", async () => {
    const { charger: ch } = await import("./contexte.js");
    const a = ch(["js/11-admin.js", "js/20b-plateforme.js"], { BOOTSTRAP_CLUB_ID: "asmb" });
    a.licences = [{ saison: "2026-2027" }, { saison: "2026-2027", role: "coach" }, { saison: "2026-2027", role: "autre" }];
    assert.equal(a.nbLicencesSaison(), 1);
  });
});
