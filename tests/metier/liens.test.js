// Réseaux sociaux et boutique du club (js/01-config.js : normaliserLienClub, clubLiensHtml).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/01-config.js"]);

describe("Liens du club", () => {
  it("accepte un lien complet, un nom de domaine ou un @compte", () => {
    assert.equal(c.normaliserLienClub("instagram", "@asmb.basket"), "https://www.instagram.com/asmb.basket");
    assert.equal(c.normaliserLienClub("tiktok", "asmb"), "https://www.tiktok.com/@asmb");
    assert.equal(c.normaliserLienClub("facebook", "facebook.com/asmb"), "https://facebook.com/asmb");
    assert.equal(c.normaliserLienClub("site", "asmb-basket.fr"), "https://asmb-basket.fr");
    assert.equal(c.normaliserLienClub("boutique", "https://shop.fr/asmb"), "https://shop.fr/asmb");
    assert.equal(c.normaliserLienClub("site", "  "), "");
  });
  it("refuse ce qui n'est pas un lien (javascript:, espaces, nom seul pour site/boutique)", () => {
    assert.equal(c.normaliserLienClub("site", "javascript:alert(1)"), null);
    assert.equal(c.normaliserLienClub("boutique", "notre boutique"), null);
    assert.equal(c.normaliserLienClub("site", "monclub"), null);
    assert.equal(c.normaliserLienClub("instagram", "<script>"), null);
  });
  it("l'espace famille n'affiche que des liens http(s), échappés", () => {
    c.authEsc = (s) => String(s).replace(/[&<>"']/g, (m) => "&#" + m.charCodeAt(0) + ";");
    c.CURRENT_CLUB = { liens: { instagram: "https://www.instagram.com/x", site: "javascript:alert(1)", boutique: 'https://a.fr/"><img>' } };
    const h = c.clubLiensHtml();
    assert.match(h, /instagram\.com\/x/);
    assert.doesNotMatch(h, /javascript:/);
    assert.doesNotMatch(h, /"><img>/);
    c.CURRENT_CLUB = {};
    assert.equal(c.clubLiensHtml(), "");
  });
});
