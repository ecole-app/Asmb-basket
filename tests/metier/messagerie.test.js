// Messagerie façon WhatsApp (js/16b-messagerie.js) : surtout du DOM et des
// écouteurs Firestore, mais quelques fonctions pures portent un vrai risque —
// chatFormatText échappe avant d'insérer dans innerHTML (XSS si l'ordre casse),
// chatCanEdit protège la fenêtre de modification, dmUnreadOf décide le badge
// non-lu.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { charger } from "./contexte.js";

const authEsc = (s) => String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function app(uid = "moi") {
  const c = charger(["js/16b-messagerie.js"], { authEsc });
  c.ASMB_USER = uid ? { uid } : null;
  c.savedPseudo = "moi";
  return c;
}
const ts = (ms) => ({ toDate: () => new Date(ms) });

describe("Message « à moi » (chatIsMine)", () => {
  it("par uid quand il est signé", () => {
    const c = app("moi");
    assert.equal(c.chatIsMine({ senderUid: "moi" }), true);
    assert.equal(c.chatIsMine({ senderUid: "quelquun-dautre" }), false);
  });
  it("vieux message sans uid : retombe sur le pseudo", () => {
    const c = app("moi");
    assert.equal(c.chatIsMine({ pseudo: "moi" }), true);
    assert.equal(c.chatIsMine({ pseudo: "une-autre-personne" }), false);
  });
  it("pas de message : jamais à moi", () => {
    const c = app("moi");
    assert.equal(c.chatIsMine(null), false);
  });
});

describe("Aperçu texte du message (chatMsgPlain)", () => {
  it("texte brut : balises retirées", () => {
    const c = app();
    assert.equal(c.chatMsgPlain({ text: "Salut <b>tout le monde</b>" }), "Salut tout le monde");
  });
  it("média, sondage, convocation, covoiturage : libellé dédié", () => {
    const c = app();
    assert.equal(c.chatMsgPlain({ type: "media", mediaType: "photo" }), "📷 Photo");
    assert.equal(c.chatMsgPlain({ type: "media", mediaType: "pdf", fileName: "feuille.pdf" }), "📄 feuille.pdf");
    assert.equal(c.chatMsgPlain({ type: "media", mediaType: "audio" }), "🎤 Message vocal");
    assert.equal(c.chatMsgPlain({ type: "poll", question: "Covoiturage dimanche ?" }), "📊 Covoiturage dimanche ?");
    assert.equal(c.chatMsgPlain({ type: "convocation", eventTitre: "Match U13" }), "📋 Convocation : Match U13");
  });
});

describe("Mise en forme du texte (chatFormatText) — échappement avant tout", () => {
  it("échappe le HTML injecté avant de poser les liens/mentions", () => {
    const c = app();
    const out = c.chatFormatText('<img src=x onerror="alert(1)">');
    assert.ok(!out.includes("<img"));
    assert.ok(out.includes("&lt;img"));
  });
  it("transforme un vrai lien en <a>, même entouré de texte dangereux", () => {
    const c = app();
    const out = c.chatFormatText("<b>regarde</b> http://exemple.fr/x merci");
    assert.ok(out.includes('<a href="http://exemple.fr/x"'));
    assert.ok(!out.includes("<b>"));
  });
  it("met une mention @prenom en gras", () => {
    const c = app();
    assert.equal(c.chatFormatText("Salut @Léa !"), 'Salut <span style="font-weight:800">@Léa</span> !');
  });
});

describe("Aperçu de lien (chatLinkCard)", () => {
  it("extrait le nom d'hôte, sans www.", () => {
    const c = app();
    assert.ok(c.chatLinkCard("regarde : https://www.exemple.fr/page?x=1").includes(">exemple.fr<"));
  });
  it("pas de lien : aucune carte", () => {
    const c = app();
    assert.equal(c.chatLinkCard("juste du texte"), "");
  });
});

describe("Fenêtre de modification (chatCanEdit)", () => {
  it("message à moi, texte, récent : modifiable", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "moi", ts: ts(Date.now() - 10000) }), true);
  });
  it("message d'une autre personne : jamais modifiable", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "quelquun-dautre", ts: ts(Date.now()) }), false);
  });
  it("message déjà supprimé : jamais modifiable", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "moi", ts: ts(Date.now()), deleted: true }), false);
  });
  it("média : jamais modifiable, seulement le texte", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "moi", ts: ts(Date.now()), type: "media" }), false);
  });
  it("au-delà des 2 minutes (moins la marge de 5 s) : fermé", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "moi", ts: ts(Date.now() - 116000) }), false);
  });
  it("juste avant la limite : encore modifiable", () => {
    const c = app("moi");
    assert.equal(c.chatCanEdit({ senderUid: "moi", ts: ts(Date.now() - 100000) }), true);
  });
});

describe("Discussion privée non lue (dmUnreadOf)", () => {
  it("jamais de badge si c'est moi le dernier à avoir écrit", () => {
    const c = app("moi");
    c.localStorage.setItem("asmb_lastread_dm_d1", "0");
    assert.equal(c.dmUnreadOf({ id: "d1", lastSender: "moi", lastTs: ts(Date.now()) }), false);
  });
  it("pas encore lu : non lu", () => {
    const c = app("moi");
    c.localStorage.setItem("asmb_lastread_dm_d1", String(Date.now() - 10000));
    assert.equal(c.dmUnreadOf({ id: "d1", lastSender: "quelquun-dautre", lastTs: ts(Date.now()) }), true);
  });
  it("déjà lu après le dernier message : pas de badge", () => {
    const c = app("moi");
    c.localStorage.setItem("asmb_lastread_dm_d1", String(Date.now() + 10000));
    assert.equal(c.dmUnreadOf({ id: "d1", lastSender: "quelquun-dautre", lastTs: ts(Date.now()) }), false);
  });
  it("aucun message dans la discussion : rien à lire", () => {
    const c = app("moi");
    assert.equal(c.dmUnreadOf({ id: "d1", lastSender: null, lastTs: null }), false);
  });
});

describe("Libellé de l'autre personne (dmOtherLabel)", () => {
  it("prend le nom à jour du compte quand il est connu", () => {
    const c = app("moi");
    c.__dmNoms = { autre: "Karim Benali" };
    assert.equal(c.dmOtherLabel({ members: [{ uid: "moi" }, { uid: "autre", label: "ancien@email.fr" }] }), "Karim Benali");
  });
  it("sinon retombe sur le label enregistré à la création", () => {
    const c = app("moi");
    c.__dmNoms = {};
    assert.equal(c.dmOtherLabel({ members: [{ uid: "moi" }, { uid: "autre", label: "ancien@email.fr" }] }), "ancien@email.fr");
  });
  it("aucun autre membre trouvé : libellé générique", () => {
    const c = app("moi");
    assert.equal(c.dmOtherLabel({ members: [{ uid: "moi" }] }), "Discussion privée");
  });
});

describe("Messages masqués pour moi (chatHiddenIds / chatHideForMe)", () => {
  it("masquer ajoute l'id une seule fois", () => {
    const c = app();
    c.chatHideForMe("m1"); c.chatHideForMe("m1");
    assert.deepEqual([...c.chatHiddenIds()], ["m1"]);
  });
  it("plafonné aux 500 derniers masqués", () => {
    const c = app();
    for (let i = 0; i < 510; i++) c.chatHideForMe("m" + i);
    const h = c.chatHiddenIds();
    assert.equal(h.length, 500);
    assert.equal(h[0], "m10"); // les 10 plus anciens sont tombés
  });
});

describe("Libellé du jour (chatDayLabel)", () => {
  it("aujourd'hui et hier", () => {
    const c = app();
    assert.equal(c.chatDayLabel(new Date()), "Aujourd'hui");
    assert.equal(c.chatDayLabel(new Date(Date.now() - 86400000)), "Hier");
  });
  it("cette semaine : jour de la semaine en toutes lettres", () => {
    const c = app();
    const l = c.chatDayLabel(new Date(Date.now() - 3 * 86400000));
    assert.notEqual(l, "Aujourd'hui"); assert.notEqual(l, "Hier");
    assert.ok(/^[A-ZÉ]/.test(l)); // majuscule initiale
  });
});
