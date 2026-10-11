// Tests des règles de sécurité Firestore (firestore.rules).
// Lancement : cd tests && npm run test:rules   (voir tests/README.md)
import { describe, it, beforeEach, after } from "node:test";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, writeBatch, Timestamp,
} from "firebase/firestore";
import { getEnv, seed, as, SUPER_ADMIN, futur, SG_EXP } from "./helpers.js";

beforeEach(async () => { await seed(); });
after(async () => { (await getEnv()).cleanup(); });

// ───────────────────────────────────────────────────────────────
describe("Visiteur non connecté", () => {
  it("ne lit ni les clubs, ni les joueurs, ni les comptes", async () => {
    const db = await as(null);
    await assertFails(getDoc(doc(db, "clubs/A")));
    await assertFails(getDoc(doc(db, "clubs/A/players/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/roster/p1")));
    await assertFails(getDoc(doc(db, "users/dirA")));
  });
  it("lit le menu buvette mais pas le matériel", async () => {
    const db = await as(null);
    await assertSucceeds(getDoc(doc(db, "clubs/A/inventaire/buv1")));
    await assertFails(getDoc(doc(db, "clubs/A/inventaire/mat1")));
  });
  it("lit une invitation par son code, sans pouvoir lister les invitations", async () => {
    const db = await as(null);
    await assertSucceeds(getDoc(doc(db, "club_invites/INVCOACH")));
    await assertFails(getDocs(collection(db, "club_invites")));
  });
  it("ne peut rien écrire à la racine ni dans une collection inconnue", async () => {
    const db = await as(null);
    await assertFails(setDoc(doc(db, "pirate/x"), { a: 1 }));
    await assertFails(setDoc(doc(db, "clubs/A/inconnue/x"), { a: 1 }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Isolation entre clubs", () => {
  it("le dirigeant du club B ne voit rien du club A", async () => {
    const db = await as("dirB");
    await assertFails(getDoc(doc(db, "clubs/A")));
    await assertFails(getDoc(doc(db, "clubs/A/players/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/roster/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/licences/l1")));
    await assertFails(getDoc(doc(db, "clubs/A/comptabilite/c1")));
    await assertFails(getDoc(doc(db, "users/dirA")));
  });
  it("le dirigeant du club B n'écrit rien dans le club A", async () => {
    const db = await as("dirB");
    await assertFails(setDoc(doc(db, "clubs/A/players/x"), { nom: "Intrus" }));
    await assertFails(setDoc(doc(db, "clubs/A/comptabilite/x"), { montant: 1 }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { name: "Piraté" }));
  });
  it("le dirigeant du club B ne peut pas se rattacher au club A", async () => {
    const db = await as("dirB");
    await assertFails(updateDoc(doc(db, "users/dirB"), { clubId: "A" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Rôles à l'intérieur d'un club", () => {
  it("parent : voit l'effectif public, pas les fiches complètes ni les licences ni la compta", async () => {
    const db = await as("parentA");
    await assertSucceeds(getDoc(doc(db, "clubs/A/roster/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/players/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/licences/l1")));
    await assertFails(getDoc(doc(db, "clubs/A/comptabilite/c1")));
    await assertFails(getDoc(doc(db, "clubs/A/sponsors/s1")));
  });
  it("parent : n'écrit ni joueurs, ni licences, ni équipes", async () => {
    const db = await as("parentA");
    await assertFails(setDoc(doc(db, "clubs/A/players/x"), { nom: "X" }));
    await assertFails(setDoc(doc(db, "clubs/A/licences/x"), { nom: "X" }));
    await assertFails(setDoc(doc(db, "clubs/A/teams/x"), { nom: "X" }));
  });
  it("coach : gère joueurs et licences, mais pas la compta", async () => {
    const db = await as("coachA");
    await assertSucceeds(getDoc(doc(db, "clubs/A/players/p1")));
    await assertSucceeds(setDoc(doc(db, "clubs/A/licences/l2"), { nom: "Nouveau" }));
    await assertFails(getDoc(doc(db, "clubs/A/comptabilite/c1")));
    await assertFails(setDoc(doc(db, "clubs/A/comptabilite/x"), { montant: 1 }));
  });
  it("dirigeant : accède à la compta et aux sponsors", async () => {
    const db = await as("dirA");
    await assertSucceeds(getDoc(doc(db, "clubs/A/comptabilite/c1")));
    await assertSucceeds(setDoc(doc(db, "clubs/A/comptabilite/c2"), { type: "depense", montant: 10 }));
    await assertSucceeds(getDoc(doc(db, "clubs/A/sponsors/s1")));
  });
  it("trésorier (bureau + accès compta) : compta oui, sponsors non", async () => {
    const db = await as("tresorierA");
    await assertSucceeds(getDoc(doc(db, "clubs/A/comptabilite/c1")));
    await assertSucceeds(setDoc(doc(db, "clubs/A/comptabilite/c3"), { type: "recette", montant: 5 }));
    await assertFails(getDoc(doc(db, "clubs/A/sponsors/s1")));
  });
  it("un parent ne profite jamais d'un accès compta, même posé par erreur", async () => {
    const db = await as("parentPermA");
    await assertFails(getDoc(doc(db, "clubs/A/comptabilite/c1")));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Club suspendu", () => {
  it("ses membres perdent l'accès à leurs données", async () => {
    const db = await as("dirS");
    await assertFails(getDoc(doc(db, "clubs/S/roster/x")));
    await assertFails(setDoc(doc(db, "clubs/S/roster/y"), { nom: "Y" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Fiche du club (clubs/{id})", () => {
  it("le dirigeant change le nom et la couleur", async () => {
    const db = await as("dirA");
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { name: "Club A+", couleur: "#1f844b" }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { logo: "data:image/png;base64,xx", facturation: { tva: false }, relances: { n: 3 } }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { zone: "A", departement: "42", lienPaiement: null, cerfa: {} }));
  });
  it("le dirigeant ne touche pas au pack, au statut, au propriétaire ni à l'échéance", async () => {
    const db = await as("dirA");
    await assertFails(updateDoc(doc(db, "clubs/A"), { plan: "paid" }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { status: "suspended" }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { ownerUid: "coachA" }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { modulesLimites: { compta: true } }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { aboEcheance: futur() }));
    await assertFails(updateDoc(doc(db, "clubs/A"), { aboAvisPour: "2027-01-01" }));
  });
  it("le dirigeant ne peut pas prolonger lui-même son essai gratuit", async () => {
    const db = await as("dirA");
    await assertFails(updateDoc(doc(db, "clubs/A"), { trialEndsAt: Timestamp.fromMillis(Date.now() + 365 * 86400000) }));
  });
  it("le dirigeant ne peut pas lever lui-même un délai de régularisation", async () => {
    const db = await as("dirA");
    await assertFails(updateDoc(doc(db, "clubs/A"), { graceUntil: futur(), suspendMotif: null }));
  });
  it("le super admin change le pack et l'échéance", async () => {
    const db = await as(SUPER_ADMIN);
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { plan: "standard", aboEcheance: futur() }));
  });
  it("seul le super admin crée ou supprime un club", async () => {
    await assertFails(setDoc(doc(await as("dirA"), "clubs/Z"), { name: "Z" }));
    await assertSucceeds(setDoc(doc(await as(SUPER_ADMIN), "clubs/Z"), { name: "Z" }));
    await assertFails(deleteDoc(doc(await as("dirA"), "clubs/A")));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Super admin (plateforme)", () => {
  it("ne lit pas les données internes d'un club sans session support", async () => {
    const db = await as(SUPER_ADMIN);
    await assertFails(getDoc(doc(db, "clubs/A/players/p1")));
    await assertFails(getDoc(doc(db, "clubs/A/comptabilite/c1")));
  });
  it("lit les données en lecture seule avec un code support valide du club", async () => {
    const db = await as(SUPER_ADMIN);
    await assertSucceeds(setDoc(doc(db, `clubs/A/support_sessions/${SUPER_ADMIN}`), { code: "SGA", expiresAt: SG_EXP }));
    await assertSucceeds(getDoc(doc(db, "clubs/A/players/p1")));
    await assertFails(setDoc(doc(db, "clubs/A/players/p1"), { nom: "Modifié" }));
  });
  it("gère seul la liste des comptes à supprimer", async () => {
    await assertSucceeds(setDoc(doc(await as(SUPER_ADMIN), "comptes_a_supprimer/x"), { fait: false }));
    await assertFails(getDocs(collection(await as("dirA"), "comptes_a_supprimer")));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Comptes utilisateurs", () => {
  it("chacun lit son propre compte, le dirigeant ceux de son club", async () => {
    await assertSucceeds(getDoc(doc(await as("parentA"), "users/parentA")));
    await assertFails(getDoc(doc(await as("parentA"), "users/parent2A")));
    await assertSucceeds(getDoc(doc(await as("dirA"), "users/parentA")));
  });
  it("on ne s'attribue ni rôle, ni club, ni accès, ni titre", async () => {
    const db = await as("parentA");
    await assertFails(updateDoc(doc(db, "users/parentA"), { roles: ["dirigeant"] }));
    await assertFails(updateDoc(doc(db, "users/parentA"), { clubId: "B" }));
    await assertFails(updateDoc(doc(db, "users/parentA"), { permissions: { comptabilite: true } }));
    await assertFails(updateDoc(doc(db, "users/parentA"), { linkedPlayerIds: ["p2"] }));
    await assertFails(updateDoc(doc(db, "users/parentA"), { titre: "Président" }));
  });
  it("on peut changer son e-mail", async () => {
    await assertSucceeds(updateDoc(doc(await as("parentA"), "users/parentA"), { email: "nouveau@test.fr" }));
  });
  it("un parent ne peut pas changer son numéro pour lire les enfants d'une autre famille", async () => {
    const db = await as("parentA");
    await assertFails(getDoc(doc(db, "clubs/A/rattachements/0622222222")));
    await assertFails(updateDoc(doc(db, "users/parentA"), { phone: "0622222222" }));
  });
  it("le dirigeant donne un accès compta à un membre du bureau", async () => {
    await assertSucceeds(updateDoc(doc(await as("dirA"), "users/coachA"), { permissions: { comptabilite: true } }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Invitations", () => {
  async function rejoindre(uid, code, data) {
    const db = await as(uid);
    const b = writeBatch(db);
    b.set(doc(db, `users/${uid}`), { clubId: "A", roles: ["coach"], inviteCode: code, ...data });
    b.update(doc(db, `club_invites/${code}`), { usedBy: uid, usedAt: Timestamp.now() });
    return b.commit();
  }
  it("une invitation valide crée le compte et se consomme", async () => {
    await assertSucceeds(rejoindre("nouveau1", "INVCOACH", {}));
  });
  it("le numéro du compte est celui de l'invitation, pas un numéro choisi", async () => {
    const db = await as("famille1");
    const ok = writeBatch(db);
    ok.set(doc(db, "users/famille1"), { clubId: "A", roles: ["parent"], inviteCode: "INVPARENT", phone: "0633333333" });
    ok.update(doc(db, "club_invites/INVPARENT"), { usedBy: "famille1", usedAt: Timestamp.now() });
    await assertSucceeds(ok.commit());
  });
  it("on ne peut pas rejoindre avec le numéro d'une autre famille", async () => {
    const db = await as("famille2");
    const b = writeBatch(db);
    b.set(doc(db, "users/famille2"), { clubId: "A", roles: ["parent"], inviteCode: "INVPARENT", phone: "0622222222" });
    b.update(doc(db, "club_invites/INVPARENT"), { usedBy: "famille2", usedAt: Timestamp.now() });
    await assertFails(b.commit());
  });
  it("une invitation ne sert qu'une fois", async () => {
    await assertSucceeds(rejoindre("nouveau1", "INVCOACH", {}));
    await assertFails(rejoindre("nouveau2", "INVCOACH", {}));
  });
  it("une invitation expirée est refusée", async () => {
    await assertFails(rejoindre("nouveau1", "INVOLD", {}));
  });
  it("on ne peut pas se donner un autre rôle que celui de l'invitation", async () => {
    await assertFails(rejoindre("nouveau1", "INVCOACH", { roles: ["dirigeant"] }));
  });
  it("on ne peut pas s'ajouter des accès en acceptant l'invitation", async () => {
    await assertFails(rejoindre("nouveau1", "INVCOACH", { permissions: { comptabilite: true } }));
  });
  it("un parent ne peut pas créer une invitation de coach", async () => {
    const db = await as("parentA");
    await assertFails(setDoc(doc(db, "club_invites/PIRATE"), { clubId: "A", role: "coach", usedBy: null, expiresAt: futur(), createdBy: "parentA" }));
  });
  it("un parent ouvre l'accès de son enfant, pas celui d'un autre", async () => {
    const db = await as("parentA");
    const base = { clubId: "A", role: "joueur", usedBy: null, expiresAt: futur(), createdBy: "parentA" };
    await assertSucceeds(setDoc(doc(db, "club_invites/J1"), { ...base, playerId: "p1" }));
    await assertFails(setDoc(doc(db, "club_invites/J2"), { ...base, playerId: "p2" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Caisse buvette (sans compte, avec code du jour)", () => {
  it("avec un code valide : décompte du stock buvette", async () => {
    const db = await as(null);
    await assertSucceeds(updateDoc(doc(db, "clubs/A/inventaire/buv1"), { qte: 9, viaCode: "BUVA" }));
  });
  it("ne peut pas changer un prix ni toucher au matériel", async () => {
    const db = await as(null);
    await assertFails(updateDoc(doc(db, "clubs/A/inventaire/buv1"), { prix: 0, viaCode: "BUVA" }));
    await assertFails(updateDoc(doc(db, "clubs/A/inventaire/mat1"), { qte: 0, viaCode: "BUVA" }));
  });
  it("un code expiré ou d'un autre club est refusé", async () => {
    const db = await as(null);
    await assertFails(updateDoc(doc(db, "clubs/A/inventaire/buv1"), { qte: 9, viaCode: "BUVOLD" }));
    await assertFails(updateDoc(doc(db, "clubs/A/inventaire/buv1"), { qte: 9, viaCode: "BUVL" }));
  });
  it("crée une recette buvette positive, jamais une dépense ni un montant négatif", async () => {
    const db = await as(null);
    const ok = { type: "recette", categorie: "Buvette/Événements", montant: 12, viaCode: "BUVA" };
    await assertSucceeds(setDoc(doc(db, "clubs/A/comptabilite/v1"), ok));
    await assertFails(setDoc(doc(db, "clubs/A/comptabilite/v2"), { ...ok, montant: -12 }));
    await assertFails(setDoc(doc(db, "clubs/A/comptabilite/v3"), { ...ok, type: "depense" }));
    await assertFails(updateDoc(doc(db, "clubs/A/comptabilite/c1"), { montant: 0, viaCode: "BUVA" }));
  });
  it("enregistre une vente dans le journal", async () => {
    const db = await as(null);
    await assertSucceeds(setDoc(doc(db, "clubs/A/buvette_ventes/x"), { id: "x", viaCode: "BUVA", benevole: "Sam", date: "2026-10-11", t: 1, mode: "especes", total: 4, lignes: [] }));
  });
  it("club en accès limité sans module buvette : caisse fermée", async () => {
    const db = await as(null);
    await assertFails(updateDoc(doc(db, "clubs/L/inventaire/buv1"), { qte: 4, viaCode: "BUVL" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Communauté", () => {
  it("un membre écrit dans un canal de son club", async () => {
    const db = await as("parentA");
    await assertSucceeds(addDoc(collection(db, "clubs/A/channels/ch1/messages"), { senderUid: "parentA", text: "Merci" }));
  });
  it("un parent ne peut ni modifier ni supprimer le message d'un coach", async () => {
    const db = await as("parentA");
    await assertFails(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m1"), { text: "Entraînement annulé", edited: true }));
    await assertFails(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m1"), { deleted: true, deletedBy: "vous" }));
  });
  it("un parent réagit au message d'un coach et répond à une convocation", async () => {
    const db = await as("parentA");
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m1"), { reactions: { "👍": ["parentA"] } }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m1"), { "responses.p1": "present" }));
  });
  it("on modifie et supprime son propre message", async () => {
    const db = await as("parentA");
    await assertSucceeds(setDoc(doc(db, "clubs/A/channels/ch1/messages/m2"), { senderUid: "parentA", text: "Coucou" }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m2"), { text: "Bonjour", edited: true }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m2"), { deleted: true, deletedBy: "vous" }));
  });
  it("on ne poste pas au nom de quelqu'un d'autre", async () => {
    const db = await as("parentA");
    await assertFails(setDoc(doc(db, "clubs/A/channels/ch1/messages/m3"), { senderUid: "coachA", text: "Match annulé" }));
  });
  it("le coach modère n'importe quel message", async () => {
    const db = await as("coachA");
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/m1"), { deleted: true, deletedBy: "le coach" }));
  });
  it("un parent ne crée ni ne supprime un canal", async () => {
    const db = await as("parentA");
    await assertFails(setDoc(doc(db, "clubs/A/channels/ch2"), { nom: "Pirate" }));
    await assertFails(deleteDoc(doc(db, "clubs/A/channels/ch1/messages/m1")));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Fiches d'inscription publiques", () => {
  it("dépôt possible avec le code du club, lecture réservée au staff", async () => {
    await assertSucceeds(setDoc(doc(await as(null), "clubs/A/inscription_submissions/f1"), { code: "INSA", nom: "Léa" }));
    await assertFails(setDoc(doc(await as(null), "clubs/B/inscription_submissions/f2"), { code: "INSA", nom: "Léa" }));
    await assertFails(getDoc(doc(await as(null), "clubs/A/inscription_submissions/f1")));
    await assertFails(getDoc(doc(await as("parentA"), "clubs/A/inscription_submissions/f1")));
    await assertSucceeds(getDoc(doc(await as("coachA"), "clubs/A/inscription_submissions/f1")));
  });
});
