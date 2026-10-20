// Stats perso de l'indépendant (js/24e-independant-stats.js).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/24-independant.js", "js/24e-independant-stats.js"]);
const plat = (v) => JSON.parse(JSON.stringify(v));
const P = (pid, date, seance) => ({ pid, date, seance: seance || "s_" + date });

describe("Stats du mois", () => {
  it("mois précédent : janvier ramène décembre de l'année d'avant", () => {
    assert.equal(c.indStatsMoisPrec("2026-01-15"), "2025-12");
    assert.equal(c.indStatsMoisPrec("2026-10-20"), "2026-09");
  });
  it("séances = séances distinctes, présents = pointages, moyenne arrondie", () => {
    const pres = [P("a", "2026-10-05"), P("b", "2026-10-05"), P("c", "2026-10-05"), P("a", "2026-10-12"), P("a", "2026-09-28")];
    const r = plat(c.indStatsMois(pres, [], "2026-10-20"));
    assert.equal(r.mois.seances, 2); assert.equal(r.mois.presents, 4); assert.equal(r.mois.moyenne, 2);
    assert.equal(r.prec.seances, 1);
  });
  it("encaissé : paiements du mois par date de paiement, hors lignes à payer", () => {
    const l = [{ statut: "paye", datePaiement: "2026-10-03", montant: 25 }, { statut: "paye", datePaiement: "2026-09-30", montant: 10 }, { statut: "du", montant: 99 }, { statut: "pass", montant: 5 }];
    const r = plat(c.indStatsMois([], l, "2026-10-20"));
    assert.equal(r.mois.encaisse, 25); assert.equal(r.prec.encaisse, 10);
  });
});

describe("Clients à relancer", () => {
  it("21 jours sans venir ou plus, les plus anciens d'abord ; ceux revenus récemment ne sortent pas", () => {
    const pres = [P("a", "2026-09-01"), P("a", "2026-09-20"), P("b", "2026-10-01"), P("c", "2026-10-15"), P("d", "2026-08-01")];
    const r = plat(c.indStatsARelancer(pres, "2026-10-20", 21));
    assert.deepEqual(r.map((x) => x.pid), ["d", "a"]);
    assert.equal(r[1].derniere, "2026-09-20"); assert.equal(r[1].jours, 30);
  });
  it("le seuil est inclusif (exactement 21 jours)", () => {
    const r = plat(c.indStatsARelancer([P("a", "2026-09-29")], "2026-10-20", 21));
    assert.equal(r.length, 1);
  });
});
