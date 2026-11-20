// Plaquette du coach (js/14w-plaquette.js) : bouton des cartes, joueurs présents.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

function app(sport, joueurs = []) {
  return charger(["js/01-config.js", "js/14w-plaquette.js"], {
    gmJs: (x) => x, CURRENT_CLUB: sport === undefined ? {} : { sport },
    getPlayersForEvent: () => joueurs,
  });
}
const ev = (over = {}) => ({ id: "e1", type: "match", ...over });

describe("Plaquette du coach", () => {
  it("bouton sur les matchs et entraînements d'un club de basket", () => {
    const c = app("basket");
    assert.match(c.plqBoutonCarte(ev()), /Plaquette/);
    assert.match(c.plqBoutonCarte(ev({ type: "entrainement" })), /Plaquette/);
  });
  it("club sans sport renseigné = basket (club d'origine)", () => {
    assert.match(app(undefined).plqBoutonCarte(ev()), /Plaquette/);
  });
  it("pas de bouton : autre sport, match annulé, autre type d'événement", () => {
    assert.equal(app("foot").plqBoutonCarte(ev()), "");
    assert.equal(app("basket").plqBoutonCarte(ev({ cancelled: true })), "");
    assert.equal(app("basket").plqBoutonCarte(ev({ type: "tournoi" })), "");
  });
  it("joueurs présents : convoqués sans les absents, les 5 de la composition d'abord", () => {
    const js = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, prenom: id }));
    const c = app("basket", js);
    const r = c.plqJoueurs(ev({
      convocations: ["a", "b", "c", "d", "e", "f"], presences: { b: "absent" },
      compo: { pos: { f: {}, e: {} } },
    }));
    assert.deepEqual(Array.from(r, (p) => p.id), ["f", "e", "a", "c", "d"]);
  });
});
