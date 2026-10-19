// Documents du club (js/15e-documents-club.js) : le fichier est découpé en morceaux pour tenir
// dans un document Firestore (1 Mo), puis recollé à l'ouverture. Un morceau perdu ou coupé au
// mauvais endroit = un PDF illisible. On teste aussi qui voit quels documents.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const c = charger(["js/15e-documents-club.js"]);

describe("Découpage du fichier en morceaux", () => {
  it("recolle exactement le contenu d'origine (base64)", () => {
    const octets = Buffer.alloc(2_000_000); for (let i = 0; i < octets.length; i++) octets[i] = (i * 7) % 251;
    const b64 = octets.toString("base64");
    const parts = c.docsDecouper(b64);
    assert.ok(parts.length >= 3);
    assert.equal(Array.from(parts).join(""), b64);
    assert.deepEqual(Buffer.from(Array.from(parts).join(""), "base64"), octets);
  });
  it("chaque morceau reste sous la limite d'un document Firestore et se décode seul", () => {
    const b64 = Buffer.alloc(3 * 1024 * 1024, 1).toString("base64");
    for (const p of c.docsDecouper(b64)) {
      assert.ok(p.length <= 900000, "morceau trop gros : " + p.length);
      assert.equal(p.length % 4, 0);          // coupé sur une frontière de 4 caractères
    }
  });
  it("un petit fichier = un seul morceau, un fichier vide ne plante pas", () => {
    assert.equal(c.docsDecouper("QUJD").length, 1);
    assert.deepEqual(Array.from(c.docsDecouper("")), [""]);
  });
});

describe("Qui voit quels documents", () => {
  const docs = [{ id: "a", publie: true }, { id: "b", publie: false }, { id: "c" }];
  it("un parent ne voit que les documents publiés", () => {
    assert.deepEqual(c.docsVisibles(docs, false).map((d) => d.id), ["a"]);
  });
  it("le bureau voit tout", () => {
    assert.equal(c.docsVisibles(docs, true).length, 3);
  });
  it("liste vide ou absente sans plantage", () => {
    assert.deepEqual(Array.from(c.docsVisibles(null, false)), []);
  });
});

describe("Type et taille affichés", () => {
  it("reconnaît le type par le nom ou le type MIME", () => {
    assert.equal(c.docsTypeDe("Règlement.PDF", ""), "pdf");
    assert.equal(c.docsTypeDe("photo", "image/png"), "image");
    assert.equal(c.docsTypeDe("charte.docx", ""), "word");
    assert.equal(c.docsTypeDe("budget.xlsx", ""), "excel");
    assert.equal(c.docsTypeDe("notes.txt", "text/plain"), "autre");
  });
  it("taille lisible", () => {
    assert.equal(c.docsTaille(500), "1 Ko");
    assert.equal(c.docsTaille(150 * 1024), "150 Ko");
    assert.equal(c.docsTaille(2.5 * 1024 * 1024), "2,5 Mo");
  });
});
