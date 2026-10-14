// Environnement de test des règles Firestore (émulateur local, jamais la vraie base).
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, setDoc, Timestamp } from "firebase/firestore";

export const SUPER_ADMIN = "7f2br1aTiJVWHTEbqVePbMLD0uc2";
export const futur = () => Timestamp.fromMillis(Date.now() + 86400000);
export const passe = () => Timestamp.fromMillis(Date.now() - 86400000);
// Échéance fixe du code support : la session doit reprendre exactement la même.
export const SG_EXP = Timestamp.fromMillis(Date.now() + 86400000);

let env;
export async function getEnv() {
  if (env) return env;
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080").split(":");
  env = await initializeTestEnvironment({
    projectId: "demo-gm",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host, port: Number(port) },
  });
  return env;
}

// Base de départ, remise à zéro avant chaque test.
//  Club A : club normal (Premium). Club B : autre club. Club S : suspendu.
//  Club L : accès limité sans buvette. Club ASMB : club d'origine.
export async function seed() {
  const e = await getEnv();
  await e.clearFirestore();
  await e.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const set = (p, d) => setDoc(doc(db, p), d);
    await set("clubs/A", { name: "Club A", status: "active", plan: "premium", ownerUid: "dirA", trialEndsAt: futur() });
    await set("clubs/B", { name: "Club B", status: "active", plan: "standard" });
    await set("clubs/S", { name: "Club S", status: "suspended", plan: "standard" });
    await set("clubs/L", { name: "Club L", status: "active", plan: "limite", modulesLimites: { buvette: false } });
    await set("clubs/G", { name: "Club G", status: "active", plan: "standard", aboGelFin: Date.now() + 30 * 86400000 });
    await set("clubs/asmb", { name: "ASMB", status: "active" });
    // Indépendant (micro-entreprise) : son compte « dirigeant » et deux clients.
    await set("clubs/I", { name: "KS Training", type: "independant", status: "active", plan: "trial" });
    await set("users/dirI", { clubId: "I", roles: ["dirigeant"] });
    await set("users/cliI", { clubId: "I", roles: ["client"] });
    await set("users/cli2I", { clubId: "I", roles: ["client"] });
    await set("indep_liens/ABCD-EFGH", { clubId: "I", clubName: "KS Training", actif: true, createdBy: "dirI" });
    await set("indep_liens/KPQR-STUV", { clubId: "I", clubName: "KS Training", actif: false, createdBy: "dirI" });
    await set("indep_liens/AAAA-BBBB", { clubId: "A", clubName: "Club A", actif: true, createdBy: "dirA" });
    await set("clubs/I/indep_clients/cli2I", { prenom: "Nadia", nom: "A", tel: "0612345678" });
    await set("clubs/I/indep_creneaux/cr1", { titre: "Cross-training", jour: 2, heure: "18:30", places: 12, habitues: ["cliI"], actif: true });
    await set("clubs/I/indep_resas/cr1_2026-10-20__cli2I", { seance: "cr1_2026-10-20", date: "2026-10-20", uid: "cli2I", statut: "vient", nom: "Nadia A." });

    await set("users/dirA", { clubId: "A", roles: ["dirigeant"], phone: "0600000001" });
    await set("users/coachA", { clubId: "A", roles: ["coach"], phone: "0600000002" });
    await set("users/parentA", { clubId: "A", roles: ["parent"], phone: "0611111111" });
    await set("users/parent2A", { clubId: "A", roles: ["parent"], phone: "0622222222" });
    await set("users/tresorierA", { clubId: "A", roles: ["bureau"], permissions: { comptabilite: true } });
    await set("users/parentPermA", { clubId: "A", roles: ["parent"], permissions: { comptabilite: true } });
    await set("users/dirB", { clubId: "B", roles: ["dirigeant"] });
    await set("users/dirS", { clubId: "S", roles: ["dirigeant"] });
    await set("users/dirL", { clubId: "L", roles: ["dirigeant"] });
    await set(`users/${SUPER_ADMIN}`, { clubId: "asmb", roles: ["dirigeant"] });

    await set("clubs/A/players/p1", { nom: "Martin", naissance: "2014-03-02" });
    await set("clubs/A/roster/p1", { nom: "Martin" });
    await set("clubs/A/licences/l1", { nom: "Martin", adresse: "1 rue X" });
    await set("clubs/A/comptabilite/c1", { type: "recette", montant: 50 });
    await set("clubs/A/sponsors/s1", { nom: "Boulangerie" });
    await set("clubs/A/inventaire/buv1", { categorie: "buvette", nom: "Coca", prix: 2, qte: 10 });
    await set("clubs/A/inventaire/mat1", { categorie: "materiel", nom: "Ballons", qte: 20 });
    await set("clubs/A/rattachements/0611111111", { playerIds: ["p1"] });
    await set("clubs/A/rattachements/0622222222", { playerIds: ["p2"] });
    await set("clubs/A/channels/ch1", { nom: "U13" });
    await set("clubs/A/channels/ch1/messages/m1", { senderUid: "coachA", text: "RDV 14h", reactions: {} });
    await set("clubs/A/channels/ch1/messages/mRecent", { senderUid: "parentA", text: "Coucou", ts: Timestamp.now() });
    await set("clubs/A/channels/ch1/messages/mVieux", { senderUid: "parentA", text: "Hier", ts: Timestamp.fromMillis(Date.now() - 10 * 60000) });
    await set("clubs/A/dms/dirA__parentA", { memberUids: ["dirA", "parentA"], members: [], lastMsg: "" });
    await set("clubs/A/dms/dirA__parentA/messages/d1", { senderUid: "dirA", text: "Bonjour", ts: Timestamp.now() });
    await set("clubs/S/roster/x", { nom: "X" });
    await set("clubs/G/inventaire/buv1", { categorie: "buvette", nom: "Eau", prix: 1, qte: 5 });
    await set("clubs/L/inventaire/buv1", { categorie: "buvette", nom: "Eau", prix: 1, qte: 5 });

    await set("buvette_codes/BUVA", { clubId: "A", expiresAt: futur() });
    await set("buvette_codes/BUVOLD", { clubId: "A", expiresAt: passe() });
    await set("buvette_codes/BUVL", { clubId: "L", expiresAt: futur() });
    await set("buvette_codes/BUVG", { clubId: "G", expiresAt: futur() });
    await set("club_invites/INVCOACH", { clubId: "A", role: "coach", usedBy: null, expiresAt: futur(), createdBy: "dirA" });
    await set("club_invites/INVPARENT", { clubId: "A", role: "parent", tel: "0633333333", usedBy: null, expiresAt: futur(), createdBy: "dirA" });
    await set("club_invites/INVOLD", { clubId: "A", role: "coach", usedBy: null, expiresAt: passe(), createdBy: "dirA" });
    await set("support_grants/SGA", { clubId: "A", expiresAt: SG_EXP });
    await set("inscription_codes/INSA", { clubId: "A" });
  });
  return e;
}

// Base vue par un compte donné (null = visiteur non connecté).
export async function as(uid) {
  const e = await getEnv();
  return uid ? e.authenticatedContext(uid).firestore() : e.unauthenticatedContext().firestore();
}
