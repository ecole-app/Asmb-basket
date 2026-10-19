// Abonnement de l'indépendant (js/24c-independant-abonnement.js) : engagement 12 mois la première
// année (mensuel), annuel toujours engagé, effet d'une résiliation.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/24-independant.js", "js/24c-independant-abonnement.js"], {
  aboEcheanceMs: (cl) => (cl && cl.aboEcheance ? new Date(cl.aboEcheance).getTime() : null),
});
const plat = (v) => JSON.parse(JSON.stringify(v));
const J = (s) => new Date(s + "T12:00:00").getTime();

describe("Abonnement indépendant", () => {
  it("prix : Standard 15/150, Premium 20/200", () => {
    assert.equal(c.indAboFormule({ plan: "standard" }).prixTxt, "15 €/mois");
    assert.equal(c.indAboFormule({ plan: "standard", aboRythme: "annuel" }).prixTxt, "150 €/an");
    assert.equal(c.indAboFormule({ plan: "premium" }).prixTxt, "20 €/mois");
    assert.equal(c.indAboFormule({ plan: "premium", aboRythme: "annuel" }).prixTxt, "200 €/an");
  });
  it("mensuel : engagé avant l'échéance, sans engagement après", () => {
    const cl = { plan: "premium", aboEcheance: "2027-03-01T12:00:00" };
    assert.equal(c.indAboFormule(cl, J("2026-10-19")).engage, true);
    assert.equal(c.indAboFormule(cl, J("2027-03-02")).engage, false);
  });
  it("annuel : toujours engagé", () => {
    const cl = { plan: "standard", aboRythme: "annuel", aboEcheance: "2027-03-01T12:00:00" };
    assert.equal(c.indAboFormule(cl, J("2027-06-01")).engage, true);
  });
  it("résiliation : échéance si engagé, fin du mois sinon", () => {
    const cl = { plan: "premium", aboEcheance: "2027-03-01T12:00:00" };
    assert.equal(c.indAboEffet(cl, J("2026-10-19")), new Date("2027-03-01T12:00:00").getTime());
    const fin = new Date(c.indAboEffet(cl, J("2027-04-10")));
    assert.equal(fin.getMonth(), 3); assert.equal(fin.getDate(), 30);
  });
  it("pas de formule payante (essai, limité) : aucun prix", () => {
    assert.equal(c.indAboFormule({ plan: "trial" }).plan, null);
    assert.equal(plat(c.indAboFormule({ plan: "limite" })).prix, null);
  });
  it("gel actif détecté", () => {
    const cl = { plan: "standard", aboGels: [{ debut: J("2026-10-01"), fin: J("2026-12-01") }] };
    assert.ok(c.indAboFormule(cl, J("2026-10-19")).gel);
    assert.equal(c.indAboFormule(cl, J("2027-01-01")).gel, null);
  });
});
