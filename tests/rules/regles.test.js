// Tests des règles de sécurité Firestore (firestore.rules).
// Lancement : cd tests && npm run test:rules   (voir tests/README.md)
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, addDoc, collection, query, where, writeBatch, Timestamp, serverTimestamp,
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
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { name: "Club A+", couleur: "#1f844b", couleur2: "#1A2E5A" }));
    await assertSucceeds(updateDoc(doc(db, "clubs/A"), { liens: { facebook: "https://www.facebook.com/clubA", boutique: "https://boutique.clubA.fr" } }));
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
  it("le dirigeant ou un coach corrige le numéro d'un parent de son club", async () => {
    await assertSucceeds(updateDoc(doc(await as("dirA"), "users/parentA"), { phone: "0644444444" }));
    await assertSucceeds(updateDoc(doc(await as("coachA"), "users/parent2A"), { phone: "0655555555" }));
    await assertFails(updateDoc(doc(await as("coachA"), "users/parentA"), { roles: ["coach"] }));
    await assertFails(updateDoc(doc(await as("dirB"), "users/parentA"), { phone: "0666666666" }));
  });
  it("le dirigeant retire l'accès d'un compte de son club, pas d'un dirigeant, pas d'un autre club", async () => {
    await assertFails(deleteDoc(doc(await as("coachA"), "users/parentA")));
    await assertFails(deleteDoc(doc(await as("parentA"), "users/parent2A")));
    await assertFails(deleteDoc(doc(await as("dirB"), "users/parentA")));
    await assertFails(deleteDoc(doc(await as("dirA"), "users/dirA")));
    await assertFails(deleteDoc(doc(await as("dirA"), "users/dirB")));
    await assertSucceeds(deleteDoc(doc(await as("dirA"), "users/parentA")));
  });
  it("après retrait, la même personne retrouve un accès avec une nouvelle invitation", async () => {
    await assertSucceeds(deleteDoc(doc(await as("dirA"), "users/coachA")));
    const db = await as("coachA");
    const b = writeBatch(db);
    b.set(doc(db, "users/coachA"), { clubId: "A", roles: ["coach"], inviteCode: "INVCOACH" });
    b.update(doc(db, "club_invites/INVCOACH"), { usedBy: "coachA", usedAt: Timestamp.now() });
    await assertSucceeds(b.commit());
  });
  it("un dirigeant ne quitte son rôle que si un autre dirigeant du club est en place", async () => {
    const db = await as("dirA");
    await assertFails(updateDoc(doc(db, "users/dirA"), { roles: ["coach"] }));
    await assertFails(updateDoc(doc(db, "users/dirA"), { roles: ["coach"], remplacePar: "coachA" }));
    await assertFails(updateDoc(doc(db, "users/dirA"), { roles: ["coach"], remplacePar: "dirB" }));
    await assertFails(updateDoc(doc(db, "users/dirA"), { roles: ["coach"], remplacePar: "dirA" }));
    await assertSucceeds(updateDoc(doc(db, "users/coachA"), { roles: ["coach", "dirigeant"] }));
    await assertSucceeds(updateDoc(doc(db, "users/dirA"), { roles: ["coach"], remplacePar: "coachA" }));
  });
  it("le super admin récupère son rôle de dirigeant sur son compte", async () => {
    const env = await getEnv();
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), `users/${SUPER_ADMIN}`), { clubId: "asmb", roles: [] }); });
    await assertSucceeds(updateDoc(doc(await as(SUPER_ADMIN), `users/${SUPER_ADMIN}`), { roles: ["dirigeant"] }));
    await assertFails(updateDoc(doc(await as(SUPER_ADMIN), `users/${SUPER_ADMIN}`), { roles: ["dirigeant"], clubId: "B" }));
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
  async function ajouterRole(uid, code, data) {
    const db = await as(uid);
    const b = writeBatch(db);
    b.update(doc(db, `users/${uid}`), { roles: ["parent", "coach"], permissions: {}, linkedPlayerIds: [], inviteCode: code, ...data });
    b.update(doc(db, `club_invites/${code}`), { usedBy: uid, usedAt: Timestamp.now() });
    return b.commit();
  }
  it("un compte existant du club ajoute le rôle de l'invitation (parent qui devient coach)", async () => {
    await assertSucceeds(ajouterRole("parentA", "INVCOACH", {}));
    const d = await getDoc(doc(await as("parentA"), "users/parentA"));
    assert.deepEqual(d.data().roles, ["parent", "coach"]);
  });
  it("refusé : autre rôle que l'invitation, accès non accordés, élève non rattaché, invitation déjà utilisée", async () => {
    await assertFails(ajouterRole("parentA", "INVCOACH", { roles: ["parent", "dirigeant"] }));
    await assertFails(ajouterRole("parentA", "INVCOACH", { permissions: { comptabilite: true } }));
    await assertFails(ajouterRole("parentA", "INVCOACH", { linkedPlayerIds: ["p2"] }));
    await assertSucceeds(ajouterRole("parentA", "INVCOACH", {}));
    await assertFails(ajouterRole("parent2A", "INVCOACH", {}));
  });
  it("ajouter un rôle sans consommer l'invitation est refusé", async () => {
    const db = await as("parentA");
    await assertFails(updateDoc(doc(db, "users/parentA"), { roles: ["parent", "coach"], permissions: {}, linkedPlayerIds: [], inviteCode: "INVCOACH" }));
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
  it("on modifie son message pendant 2 minutes, pas après", async () => {
    const db = await as("parentA");
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/mRecent"), { text: "Bonjour", edited: true }));
    await assertFails(updateDoc(doc(db, "clubs/A/channels/ch1/messages/mVieux"), { text: "Modifié", edited: true }));
  });
  it("on supprime son propre message à tout moment, contenu effacé", async () => {
    const db = await as("parentA");
    await assertSucceeds(updateDoc(doc(db, "clubs/A/channels/ch1/messages/mVieux"), { deleted: true, deletedBy: "vous", text: "" }));
  });
  it("on ne se fait pas passer pour un admin en supprimant", async () => {
    const db = await as("parentA");
    await assertFails(updateDoc(doc(db, "clubs/A/channels/ch1/messages/mVieux"), { deleted: true, deletedByAdmin: true, text: "" }));
  });
  it("chacun note sa propre lecture, pas celle des autres", async () => {
    const db = await as("parentA");
    await assertSucceeds(setDoc(doc(db, "clubs/A/channels/ch1/reads/parentA"), { uid: "parentA", ts: Timestamp.now() }));
    await assertFails(setDoc(doc(db, "clubs/A/channels/ch1/reads/coachA"), { uid: "coachA", ts: Timestamp.now() }));
    await assertSucceeds(getDoc(doc(db, "clubs/A/channels/ch1/reads/parentA")));
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
describe("Discussions privées", () => {
  it("les deux personnes lisent et écrivent, personne d'autre", async () => {
    await assertSucceeds(getDoc(doc(await as("parentA"), "clubs/A/dms/dirA__parentA/messages/d1")));
    await assertSucceeds(addDoc(collection(await as("parentA"), "clubs/A/dms/dirA__parentA/messages"), { senderUid: "parentA", text: "Merci", ts: Timestamp.now() }));
    await assertFails(getDoc(doc(await as("coachA"), "clubs/A/dms/dirA__parentA/messages/d1")));
    await assertFails(getDoc(doc(await as("parent2A"), "clubs/A/dms/dirA__parentA")));
    await assertFails(addDoc(collection(await as("coachA"), "clubs/A/dms/dirA__parentA/messages"), { senderUid: "coachA", text: "Intrus" }));
  });
  it("on liste ses propres discussions", async () => {
    const db = await as("parentA");
    await assertSucceeds(getDocs(query(collection(db, "clubs/A/dms"), where("memberUids", "array-contains", "parentA"))));
  });
  it("seul le staff ouvre une discussion, à deux et en en faisant partie", async () => {
    await assertSucceeds(setDoc(doc(await as("coachA"), "clubs/A/dms/coachA__parent2A"), { memberUids: ["coachA", "parent2A"] }));
    await assertFails(setDoc(doc(await as("parentA"), "clubs/A/dms/parentA__parent2A"), { memberUids: ["parentA", "parent2A"] }));
    await assertFails(setDoc(doc(await as("coachA"), "clubs/A/dms/dirA__parent2A"), { memberUids: ["dirA", "parent2A"] }));
  });
  it("le staff voit les comptes de son club, pas un parent", async () => {
    await assertSucceeds(getDocs(query(collection(await as("coachA"), "users"), where("clubId", "==", "A"))));
    await assertFails(getDocs(query(collection(await as("parentA"), "users"), where("clubId", "==", "A"))));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Demandes d'essai (formulaire public du site)", () => {
  const ok = () => ({ club: "US Firminy Basket", sport: "basket", ville: "Firminy", licencies: 180, couleur: "#1f844b", couleur2: "#1A2E5A", nom: "Karim B.", tel: "0612345678", email: "", statut: "nouvelle", at: serverTimestamp() });
  it("un visiteur dépose une demande valide", async () => {
    await assertSucceeds(addDoc(collection(await as(null), "demandes_essai"), ok()));
  });
  it("réseaux sociaux et boutique facultatifs, mais rien d'autre dedans", async () => {
    const db = await as(null);
    await assertSucceeds(addDoc(collection(db, "demandes_essai"), { ...ok(), liens: { instagram: "https://www.instagram.com/usfb", boutique: "https://shop.usfb.fr" } }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), liens: { plan: "premium" } }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), liens: { site: "x".repeat(300) } }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), liens: "https://x.fr" }));
  });
  it("champ inconnu, numéro invalide, statut forcé ou date choisie : refusé", async () => {
    const db = await as(null);
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), plan: "premium" }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), tel: "06 12" }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), statut: "validee" }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), at: Timestamp.now() }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), couleur: "red" }));
    await assertFails(addDoc(collection(db, "demandes_essai"), { ...ok(), club: "x".repeat(200) }));
  });
  it("personne d'autre que le super admin ne lit les demandes", async () => {
    await assertFails(getDocs(collection(await as(null), "demandes_essai")));
    await assertFails(getDocs(collection(await as("dirA"), "demandes_essai")));
    await assertSucceeds(getDocs(collection(await as(SUPER_ADMIN), "demandes_essai")));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Avis des dirigeants à la plateforme", () => {
  const avis = (uid, clubId) => ({ clubId, clubName: "Club", uid, email: "", message: "Super appli", statut: "nouveau", ts: serverTimestamp() });
  it("dirigeant et parent envoient un avis pour leur club, jamais pour un autre", async () => {
    await assertSucceeds(addDoc(collection(await as("dirA"), "avis_plateforme"), avis("dirA", "A")));
    await assertSucceeds(addDoc(collection(await as("parentA"), "avis_plateforme"), avis("parentA", "A")));
    await assertFails(addDoc(collection(await as("parentA"), "avis_plateforme"), avis("dirA", "A")));
    await assertFails(addDoc(collection(await as("dirA"), "avis_plateforme"), avis("dirA", "B")));
  });
  it("seul le super admin lit les avis", async () => {
    await assertFails(getDocs(collection(await as("dirA"), "avis_plateforme")));
    await assertSucceeds(getDocs(collection(await as(SUPER_ADMIN), "avis_plateforme")));
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

// ───────────────────────────────────────────────────────────────
describe("Réinscriptions en ligne", () => {
  const demande = (uid, playerId, saison) => ({ auteurUid: uid, playerId, saison, statut: "nouvelle", fiche: { prenom: "Lucas" }, ts: serverTimestamp() });
  const ouvrir = async (ouvert) => setDoc(doc(await as("dirA"), "clubs/A/app_data/reinscriptions"), { ouvert, saison: "2027-2028" });

  it("fermées : aucun parent ne peut réinscrire", async () => {
    await ouvrir(false);
    await assertFails(addDoc(collection(await as("parentA"), "clubs/A/reinscriptions"), demande("parentA", "p1", "2027-2028")));
  });
  it("ouvertes : le parent réinscrit SON enfant, pour la saison annoncée seulement", async () => {
    await ouvrir(true);
    const db = await as("parentA");
    await assertSucceeds(addDoc(collection(db, "clubs/A/reinscriptions"), demande("parentA", "p1", "2027-2028")));
    await assertFails(addDoc(collection(db, "clubs/A/reinscriptions"), demande("parentA", "p2", "2027-2028")));
    await assertFails(addDoc(collection(db, "clubs/A/reinscriptions"), demande("parentA", "p1", "2030-2031")));
    await assertFails(addDoc(collection(db, "clubs/A/reinscriptions"), demande("parent2A", "p1", "2027-2028")));
    await assertFails(addDoc(collection(db, "clubs/A/reinscriptions"), { ...demande("parentA", "p1", "2027-2028"), statut: "importee" }));
    await assertFails(addDoc(collection(await as("dirB"), "clubs/A/reinscriptions"), demande("dirB", "p1", "2027-2028")));
  });
  it("le parent relit ses demandes, pas celles des autres ; le staff les traite", async () => {
    await ouvrir(true);
    await assertSucceeds(setDoc(doc(await as("parentA"), "clubs/A/reinscriptions/r1"), demande("parentA", "p1", "2027-2028")));
    await assertSucceeds(setDoc(doc(await as("parent2A"), "clubs/A/reinscriptions/r2"), demande("parent2A", "p2", "2027-2028")));
    const db = await as("parentA");
    await assertSucceeds(getDocs(query(collection(db, "clubs/A/reinscriptions"), where("auteurUid", "==", "parentA"))));
    await assertFails(getDoc(doc(db, "clubs/A/reinscriptions/r2")));
    await assertFails(getDocs(collection(db, "clubs/A/reinscriptions")));
    await assertFails(updateDoc(doc(db, "clubs/A/reinscriptions/r1"), { statut: "importee" }));
    await assertSucceeds(getDocs(collection(await as("coachA"), "clubs/A/reinscriptions")));
    await assertSucceeds(updateDoc(doc(await as("dirA"), "clubs/A/reinscriptions/r1"), { statut: "importee" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Séances d'essai (page publique du club)", () => {
  const page = (actif) => ({ actif, nom: "Club A", equipes: [{ id: "t1", nom: "U11", creneaux: "Mercredi 14h" }] });
  const demande = () => ({ equipeId: "t1", equipeNom: "U11", prenom: "Léo", naissance: "2016-05-04", parentNom: "Nadia K.", tel: "0612345678", message: "", statut: "nouvelle", at: serverTimestamp() });

  it("seul le dirigeant publie la page ; tout le monde la lit par son lien, personne ne liste", async () => {
    await assertSucceeds(setDoc(doc(await as("dirA"), "essai_pages/A"), page(true)));
    await assertFails(setDoc(doc(await as("coachA"), "essai_pages/A"), page(false)));
    await assertFails(setDoc(doc(await as("dirB"), "essai_pages/A"), page(false)));
    await assertSucceeds(getDoc(doc(await as(null), "essai_pages/A")));
    await assertFails(getDocs(collection(await as(null), "essai_pages")));
  });
  it("page ouverte : un visiteur dépose une demande valide, rien d'autre", async () => {
    await setDoc(doc(await as("dirA"), "essai_pages/A"), page(true));
    const db = await as(null);
    await assertSucceeds(addDoc(collection(db, "clubs/A/essais"), demande()));
    await assertFails(addDoc(collection(db, "clubs/A/essais"), { ...demande(), plan: "x" }));
    await assertFails(addDoc(collection(db, "clubs/A/essais"), { ...demande(), tel: "06" }));
    await assertFails(addDoc(collection(db, "clubs/A/essais"), { ...demande(), naissance: "04/05/2016" }));
    await assertFails(addDoc(collection(db, "clubs/A/essais"), { ...demande(), statut: "planifie" }));
    await assertFails(addDoc(collection(db, "clubs/A/essais"), { ...demande(), message: "x".repeat(400) }));
  });
  it("page fermée, absente ou club suspendu : refus", async () => {
    await setDoc(doc(await as("dirA"), "essai_pages/A"), page(false));
    await assertFails(addDoc(collection(await as(null), "clubs/A/essais"), demande()));
    await assertFails(addDoc(collection(await as(null), "clubs/B/essais"), demande()));
    await assertFails(addDoc(collection(await as(null), "clubs/S/essais"), demande()));
  });
  it("lecture et suivi réservés au staff du club", async () => {
    await setDoc(doc(await as("dirA"), "essai_pages/A"), page(true));
    await assertSucceeds(setDoc(doc(await as(null), "clubs/A/essais/e1"), demande()));
    await assertFails(getDoc(doc(await as(null), "clubs/A/essais/e1")));
    await assertFails(getDoc(doc(await as("parentA"), "clubs/A/essais/e1")));
    await assertSucceeds(getDoc(doc(await as("coachA"), "clubs/A/essais/e1")));
    await assertSucceeds(updateDoc(doc(await as("dirA"), "clubs/A/essais/e1"), { statut: "planifie" }));
    await assertFails(updateDoc(doc(await as("parentA"), "clubs/A/essais/e1"), { statut: "planifie" }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Événements à inscription (stage, tournoi, soirée)", () => {
  const page = (o = {}) => ({ clubId: "A", eventId: "e1", actif: true, titre: "Camp", places: 2, nb: 0,
    tarifs: [{ nom: "Licencié", prix: 40, pour: "lic" }, { nom: "Extérieur", prix: 55, pour: "ext" }], ...o });
  const insc = (o = {}) => ({ eventId: "e1", prenom: "Léo", nom: "Kaci", naissance: "2016-05-04", tel: "0612345678",
    clubOrigine: "", tarifIdx: 1, tarifNom: "Extérieur", montant: 55, mode: "helloasso",
    statut: "inscrit", paye: false, present: false, source: "public", at: serverTimestamp(), ...o });
  async function inscrire(db, code, data, nb) {
    const b = writeBatch(db);
    b.set(doc(db, "clubs/A/evt_inscrits/" + code), data);
    b.update(doc(db, "evt_pages/A__e1"), { nb, dernier: code });
    return b.commit();
  }
  beforeEach(async () => { await setDoc(doc(await as("dirA"), "evt_pages/A__e1"), page()); });

  it("le staff publie la page de son club, pas d'un autre ; tout le monde la lit", async () => {
    await assertFails(setDoc(doc(await as("dirB"), "evt_pages/A__e2"), page({ eventId: "e2" })));
    await assertFails(setDoc(doc(await as("parentA"), "evt_pages/A__e2"), page({ eventId: "e2" })));
    await assertSucceeds(getDoc(doc(await as(null), "evt_pages/A__e1")));
    await assertFails(getDocs(collection(await as(null), "evt_pages")));
  });
  it("un visiteur s'inscrit avec le bon prix et le compteur monte de 1", async () => {
    await assertSucceeds(inscrire(await as(null), "STG-12345", insc(), 1));
  });
  it("refusé : mauvais prix, code mal formé, compteur faux, champ en trop, déjà payé", async () => {
    const db = await as(null);
    await assertFails(inscrire(db, "STG-11111", insc({ montant: 40 }), 1));
    await assertFails(inscrire(db, "XYZ-11111", insc(), 1));
    await assertFails(inscrire(db, "STG-11112", insc(), 2));
    await assertFails(inscrire(db, "STG-11113", insc({ plan: "x" }), 1));
    await assertFails(inscrire(db, "STG-11114", insc({ paye: true }), 1));
    await assertFails(setDoc(doc(db, "clubs/A/evt_inscrits/STG-11115"), insc()));
    await assertFails(updateDoc(doc(db, "evt_pages/A__e1"), { nb: 1, dernier: "STG-99999" }));
  });
  it("e-mail facultatif : accepté s'il est court", async () => {
    const db = await as(null);
    await assertSucceeds(inscrire(db, "STG-12397", insc({ email: "parent@test.fr" }), 1));
    await assertFails(inscrire(db, "STG-12396", insc({ email: "x".repeat(120) + "@test.fr" }), 2));
  });
  it("catégorie de l'enfant : texte court accepté, trop long refusé", async () => {
    const db = await as(null);
    await assertSucceeds(inscrire(db, "STG-12399", insc({ cat: "U13" }), 1));
    await assertFails(inscrire(db, "STG-12398", insc({ cat: "U13-un-texte-beaucoup-trop-long" }), 2));
  });
  it("tarif gratuit : mode « gratuit » seulement si le prix est 0", async () => {
    await updateDoc(doc(await as("dirA"), "evt_pages/A__e1"), { tarifs: [{ nom: "Gratuit", prix: 0, pour: "tous" }, { nom: "Extérieur", prix: 55, pour: "ext" }] });
    const db = await as(null);
    await assertFails(inscrire(db, "SOI-60001", insc({ tarifIdx: 1, mode: "gratuit" }), 1));
    await assertSucceeds(inscrire(db, "SOI-60002", insc({ tarifIdx: 0, tarifNom: "Gratuit", montant: 0, mode: "gratuit" }), 1));
  });
  it("complet : plus d'inscription au-delà des places", async () => {
    const db = await as(null);
    await assertSucceeds(inscrire(db, "STG-20001", insc(), 1));
    await assertSucceeds(inscrire(db, "STG-20002", insc(), 2));
    await assertFails(inscrire(db, "STG-20003", insc(), 3));
  });
  it("page fermée : refus", async () => {
    await updateDoc(doc(await as("dirA"), "evt_pages/A__e1"), { actif: false });
    await assertFails(inscrire(await as(null), "STG-30001", insc(), 1));
  });
  it("un parent inscrit SON enfant (relié à sa fiche), pas celui d'un autre", async () => {
    const db = await as("parentA");
    await assertSucceeds(inscrire(db, "STG-40001", insc({ tarifIdx: 0, tarifNom: "Licencié", montant: 40, playerId: "p1", auteurUid: "parentA", source: "app" }), 1));
    await assertFails(inscrire(db, "STG-40002", insc({ tarifIdx: 0, tarifNom: "Licencié", montant: 40, playerId: "p2", auteurUid: "parentA", source: "app" }), 2));
    await assertSucceeds(getDoc(doc(db, "clubs/A/evt_inscrits/STG-40001")));
  });
  it("seul le staff lit la liste et marque le paiement", async () => {
    await assertSucceeds(inscrire(await as(null), "STG-50001", insc(), 1));
    await assertFails(getDoc(doc(await as(null), "clubs/A/evt_inscrits/STG-50001")));
    await assertFails(getDoc(doc(await as("parent2A"), "clubs/A/evt_inscrits/STG-50001")));
    await assertSucceeds(getDocs(collection(await as("coachA"), "clubs/A/evt_inscrits")));
    await assertSucceeds(updateDoc(doc(await as("dirA"), "clubs/A/evt_inscrits/STG-50001"), { paye: true }));
    await assertFails(updateDoc(doc(await as("parentA"), "clubs/A/evt_inscrits/STG-50001"), { paye: true }));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Événements : jours au choix (prix par jour, forfait)", () => {
  const J = ["2026-10-19", "2026-10-20", "2026-10-21"];
  const page = (o = {}) => ({ clubId: "A", eventId: "e1", actif: true, titre: "Stage", places: 2, nb: 0, nbJ: {},
    parJour: true, jours: J, tarifs: [{ nom: "Extérieur", prix: 20, forfait: 50, pour: "ext" }], ...o });
  const insc = (jours, montant, o = {}) => ({ eventId: "e1", prenom: "Léo", nom: "Kaci", naissance: "2016-05-04", tel: "0612345678",
    clubOrigine: "", tarifIdx: 0, tarifNom: "Extérieur", montant, jours, mode: "cb",
    statut: "inscrit", paye: false, present: false, source: "public", at: serverTimestamp(), ...o });
  async function inscrire(db, code, data, nb, nbJ) {
    const b = writeBatch(db);
    b.set(doc(db, "clubs/A/evt_inscrits/" + code), data);
    b.update(doc(db, "evt_pages/A__e1"), nbJ ? { nb, dernier: code, nbJ } : { nb, dernier: code });
    return b.commit();
  }
  beforeEach(async () => { await setDoc(doc(await as("dirA"), "evt_pages/A__e1"), page()); });

  it("prix = jours × tarif, forfait quand tous les jours sont pris", async () => {
    const db = await as(null);
    await assertSucceeds(inscrire(db, "STG-70001", insc([J[0], J[2]], 40), 1, { [J[0]]: 1, [J[2]]: 1 }));
    await assertSucceeds(inscrire(db, "STG-70002", insc(J, 50), 2, { [J[0]]: 2, [J[1]]: 1, [J[2]]: 2 }));
  });
  it("refusé : mauvais total, jour inconnu, doublon, aucun jour, forfait avec moins de jours", async () => {
    const db = await as(null);
    await assertFails(inscrire(db, "STG-71001", insc([J[0], J[1]], 20), 1, { [J[0]]: 1, [J[1]]: 1 }));
    await assertFails(inscrire(db, "STG-71002", insc(["2026-10-30"], 20), 1, { "2026-10-30": 1 }));
    await assertFails(inscrire(db, "STG-71003", insc([J[0], J[0]], 40), 1, { [J[0]]: 1 }));
    await assertFails(inscrire(db, "STG-71004", insc([], 0), 1));
    await assertFails(inscrire(db, "STG-71005", insc([J[0], J[1]], 50), 1, { [J[0]]: 1, [J[1]]: 1 }));
  });
  it("un billet sans jours est refusé quand le choix des jours est actif", async () => {
    const sansJours = insc([J[0]], 20); delete sansJours.jours;
    await assertFails(inscrire(await as(null), "STG-72001", sansJours, 1));
  });
  it("les compteurs par jour ne bougent que pour les jours du billet", async () => {
    const db = await as(null);
    await assertFails(inscrire(db, "STG-73001", insc([J[0]], 20), 1, { [J[1]]: 1 }));
  });
  it("les places ne bloquent pas le total quand on compte par jour", async () => {
    const db = await as(null);
    await assertSucceeds(inscrire(db, "STG-74001", insc([J[0]], 20), 1, { [J[0]]: 1 }));
    await assertSucceeds(inscrire(db, "STG-74002", insc([J[1]], 20), 2, { [J[0]]: 1, [J[1]]: 1 }));
    await assertSucceeds(inscrire(db, "STG-74003", insc([J[2]], 20), 3, { [J[0]]: 1, [J[1]]: 1, [J[2]]: 1 }));
  });
  it("sans choix des jours, un billet avec des jours est refusé", async () => {
    await updateDoc(doc(await as("dirA"), "evt_pages/A__e1"), { parJour: false, jours: [] });
    await assertFails(inscrire(await as(null), "STG-75001", insc([J[0]], 20), 1));
  });
});

// ───────────────────────────────────────────────────────────────
describe("Entrée d'un événement : code bénévole", () => {
  const fin = (j) => Timestamp.fromMillis(Date.now() + j * 86400000);
  const entree = (o = {}) => ({ clubId: "A", eventId: "e1", titre: "Camp", liste: [{ c: "STG-12345", p: "Léo", n: "Kaci" }],
    presents: {}, payes: {}, expiresAt: fin(1), ...o });
  beforeEach(async () => { await setDoc(doc(await as("dirA"), "evt_entrees/ABCD-EFGH"), entree()); });

  it("seul le staff du club crée un code ; format imposé", async () => {
    await assertSucceeds(setDoc(doc(await as("coachA"), "evt_entrees/WXYZ-2345"), entree()));
    await assertFails(setDoc(doc(await as("dirB"), "evt_entrees/WXYZ-2346"), entree()));
    await assertFails(setDoc(doc(await as("parentA"), "evt_entrees/WXYZ-2347"), entree()));
    await assertFails(setDoc(doc(await as("dirA"), "evt_entrees/court"), entree()));
  });
  it("le bénévole sans compte lit la liste par son code, sans pouvoir lister", async () => {
    const db = await as(null);
    await assertSucceeds(getDoc(doc(db, "evt_entrees/ABCD-EFGH")));
    await assertFails(getDocs(collection(db, "evt_entrees")));
  });
  it("le bénévole coche présents et paiements, rien d'autre", async () => {
    const db = await as(null);
    await assertSucceeds(updateDoc(doc(db, "evt_entrees/ABCD-EFGH"), { "presents.STG-12345": Date.now() }));
    await assertSucceeds(updateDoc(doc(db, "evt_entrees/ABCD-EFGH"), { "payes.STG-12345": Date.now() }));
    await assertFails(updateDoc(doc(db, "evt_entrees/ABCD-EFGH"), { liste: [] }));
    await assertFails(updateDoc(doc(db, "evt_entrees/ABCD-EFGH"), { expiresAt: fin(30) }));
    await assertFails(deleteDoc(doc(db, "evt_entrees/ABCD-EFGH")));
  });
  it("code expiré : plus aucune écriture du bénévole", async () => {
    await updateDoc(doc(await as("dirA"), "evt_entrees/ABCD-EFGH"), { expiresAt: fin(-1) });
    await assertFails(updateDoc(doc(await as(null), "evt_entrees/ABCD-EFGH"), { "presents.STG-12345": Date.now() }));
  });
  it("le staff liste, actualise et révoque les codes de son club", async () => {
    await assertSucceeds(getDocs(query(collection(await as("dirA"), "evt_entrees"), where("clubId", "==", "A"))));
    await assertFails(getDocs(query(collection(await as("dirB"), "evt_entrees"), where("clubId", "==", "A"))));
    await assertSucceeds(updateDoc(doc(await as("coachA"), "evt_entrees/ABCD-EFGH"), { liste: [] }));
    await assertSucceeds(deleteDoc(doc(await as("dirA"), "evt_entrees/ABCD-EFGH")));
  });
});
