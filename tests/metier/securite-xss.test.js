// Échappement des textes saisis (js/18-auth.js). Un prénom, un titre d'événement ou un identifiant
// écrit par quelqu'un ne doit jamais pouvoir devenir du code dans la page :
//  - authEsc : texte d'une balise ou attribut entre guillemets doubles ;
//  - gmJs    : valeur dans onclick="f('…')" (une apostrophe fermerait la chaîne) ;
//  - gmUrl   : adresse d'un lien (jamais « javascript: »).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../js/18-auth.js", import.meta.url), "utf8");
const ctx = {};
vm.createContext(ctx);
for (const nom of ["authEsc", "gmUrl", "gmJs"]) {
  const m = src.match(new RegExp("function " + nom + "\\(\\w+\\)\\{[\\s\\S]*?\\n\\}|function " + nom + "\\(\\w+\\)\\{.*\\}"));
  assert.ok(m, "fonction " + nom + " introuvable");
  vm.runInContext(m[0], ctx);
}
// Ce que fait le navigateur d'un attribut : il décode les entités avant d'exécuter le JavaScript.
const decode = (h) => h.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#96;/g, "`").replace(/&amp;/g, "&");

describe("authEsc", () => {
  it("neutralise les balises et les guillemets", () => {
    assert.equal(ctx.authEsc('"><img src=x onerror=alert(1)>'), "&quot;&gt;&lt;img src=x onerror=alert(1)&gt;");
    assert.equal(ctx.authEsc("Léa & Tom"), "Léa &amp; Tom");
  });
  it("accepte un nombre, et rien du tout donne une chaîne vide", () => {
    assert.equal(ctx.authEsc(0), "0");
    assert.equal(ctx.authEsc(12.5), "12.5");
    assert.equal(ctx.authEsc(null), "");
    assert.equal(ctx.authEsc(undefined), "");
    assert.equal(ctx.authEsc(false), "");
  });
});

describe("gmJs (valeur dans onclick=\"f('…')\")", () => {
  const hostiles = ["simple", "l'été", "x');alert(1);//", "a\\');alert(1)//", '"><img src=x onerror=alert(1)>', "ligne1\nligne2", "`${1}`", 'x");alert(1);//'];
  for (const q of ["'", '"']) {
    it("la fonction reçoit exactement la valeur, sans rien exécuter (chaîne entre " + q + ")", () => {
      for (const v of hostiles) {
        const bac = { recu: null, alerte: false };
        bac.f = (a) => { bac.recu = a; };
        bac.alert = () => { bac.alerte = true; };
        vm.createContext(bac);
        vm.runInContext(decode("f(" + q + ctx.gmJs(v) + q + ")"), bac);
        assert.equal(bac.alerte, false, "code exécuté pour " + JSON.stringify(v));
        assert.equal(bac.recu, v, "valeur modifiée pour " + JSON.stringify(v));
      }
    });
  }
  it("ne peut pas sortir de l'attribut HTML", () => {
    assert.ok(!/["<>]/.test(ctx.gmJs('"><script>alert(1)</script>')));
    assert.equal(ctx.gmJs(42), "42");
  });
});

describe("gmUrl", () => {
  it("laisse passer les adresses normales", () => {
    for (const u of ["https://www.helloasso.com/x", "http://club.fr", "mailto:a@b.fr", "tel:+33612345678", "data:image/png;base64,AAAA", "data:application/pdf;base64,AAAA", "./index.html", "/buvette/", "#haut"]) {
      assert.equal(ctx.gmUrl(u), u);
    }
  });
  it("remplace tout le reste par #", () => {
    for (const u of ["javascript:alert(1)", " JaVaScRiPt:alert(1)", "vbscript:x", "data:text/html,<script>alert(1)</script>", "data:image/svg+xml,<svg onload=alert(1)>", "//evil.example/x", "evil.example"]) {
      assert.equal(ctx.gmUrl(u), "#", u);
    }
    assert.equal(ctx.gmUrl(""), "");
    assert.equal(ctx.gmUrl(null), "");
  });
});
