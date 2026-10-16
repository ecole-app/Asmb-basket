/* ===== functions/index.js — Cloud Functions (notifications push) =====
   Un seul déclencheur pour l'instant : un nouveau message dans un canal
   Communauté notifie tous les abonnés push du club, sauf son auteur.
   Se déclenche automatiquement à l'écriture Firestore — rien côté client
   n'a besoin d'appeler cette fonction (voir js/22-push.js et sendMsg dans
   js/16-communaute.js). */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Région proche de la majorité des utilisateurs visés (club basé en France).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

exports.onChannelMessage = onDocumentCreated(
  "clubs/{clubId}/channels/{channelId}/messages/{messageId}",
  async (event) => {
    const msg = event.data && event.data.data();
    if (!msg || msg.deleted) return;

    const { clubId, channelId } = event.params;
    const authorUid = msg.senderUid || null;
    const title = msg.pseudo ? `${msg.pseudo} (Communauté)` : "Nouveau message";
    const body = (msg.type === "media")
      ? (msg.mediaType === "pdf" ? "📄 a partagé un document" : "📷 a partagé une photo")
      : String(msg.text || "").slice(0, 120);
    if (!body) return;

    const subsSnap = await db.collection("clubs").doc(clubId).collection("push_subscriptions").get();
    if (subsSnap.empty) return;

    const tokens = [];
    const tokenToDocId = {};
    subsSnap.forEach((doc) => {
      if (authorUid && doc.id === authorUid) return;
      const token = doc.data() && doc.data().token;
      if (!token) return;
      tokens.push(token);
      tokenToDocId[token] = doc.id;
    });
    if (!tokens.length) return;

    const resp = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { url: "./", conv: channelId },
      webpush: { fcmOptions: { link: "./" } }
    });

    // Nettoie les tokens morts (app désinstallée, cache navigateur vidé...).
    const cleanup = [];
    resp.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        const docId = tokenToDocId[tokens[i]];
        if (docId) cleanup.push(db.collection("clubs").doc(clubId).collection("push_subscriptions").doc(docId).delete());
      }
    });
    if (cleanup.length) await Promise.all(cleanup);
  }
);

// Discussion privée : seule l'autre personne de la discussion est notifiée.
exports.onDmMessage = onDocumentCreated(
  "clubs/{clubId}/dms/{dmId}/messages/{messageId}",
  async (event) => {
    const msg = event.data && event.data.data();
    if (!msg || msg.deleted) return;
    const { clubId, dmId } = event.params;
    const dmSnap = await db.collection("clubs").doc(clubId).collection("dms").doc(dmId).get();
    const uids = (dmSnap.exists && dmSnap.data().memberUids) || [];
    const dest = uids.filter((u) => u !== msg.senderUid);
    if (!dest.length) return;
    const title = msg.pseudo ? `${msg.pseudo} (message privé)` : "Message privé";
    const body = (msg.type === "media")
      ? (msg.mediaType === "audio" ? "🎤 Message vocal" : msg.mediaType === "pdf" ? "📄 a partagé un document" : "📷 a partagé une photo")
      : String(msg.text || "").slice(0, 120);
    if (!body) return;
    const subsCol = db.collection("clubs").doc(clubId).collection("push_subscriptions");
    const docs = await Promise.all(dest.map((u) => subsCol.doc(u).get()));
    const tokens = [], tokenToDocId = {};
    docs.forEach((d) => {
      const t = d.exists && d.data() && d.data().token;
      if (t) { tokens.push(t); tokenToDocId[t] = d.id; }
    });
    if (!tokens.length) return;
    const resp = await admin.messaging().sendEachForMulticast({
      tokens, notification: { title, body }, data: { url: "./", conv: dmId }, webpush: { fcmOptions: { link: "./" } }
    });
    const cleanup = [];
    resp.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error && r.error.code;
      if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
        cleanup.push(subsCol.doc(tokenToDocId[tokens[i]]).delete());
      }
    });
    if (cleanup.length) await Promise.all(cleanup);
  }
);

// Nouvelle demande d'essai déposée depuis le site : notifie le super admin (compte
// General Manager, club d'origine) sur son téléphone. Rien d'autre n'est envoyé.
const SUPER_ADMIN_UID = "7f2br1aTiJVWHTEbqVePbMLD0uc2";
const CLUB_ORIGINE = "asmb";
exports.onDemandeEssai = onDocumentCreated("demandes_essai/{id}", async (event) => {
  const d = event.data && event.data.data();
  if (!d) return;
  // Abonnement Plateforme (global) ; à défaut, ancien abonnement du club d'origine.
  let ref = db.collection("plateforme_push").doc(SUPER_ADMIN_UID);
  let snap = await ref.get();
  if (!(snap.exists && snap.data() && snap.data().token)) {
    ref = db.collection("clubs").doc(CLUB_ORIGINE).collection("push_subscriptions").doc(SUPER_ADMIN_UID);
    snap = await ref.get();
  }
  const token = snap.exists && snap.data() && snap.data().token;
  if (!token) return;
  const quoi = [d.club, d.nom].filter(Boolean).join(" · ").slice(0, 100);
  try {
    await admin.messaging().send({
      token,
      notification: { title: "Nouvelle demande d'essai", body: quoi || "Un club vient de remplir le formulaire" },
      data: { url: "./" },
      webpush: { fcmOptions: { link: "./" } }
    });
  } catch (e) {
    const code = e && e.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
      await ref.delete();
    }
  }
});

// Un dirigeant valide son compte avec le lien d'invitation : alerte Plateforme.
exports.onInviteDirigeantUtilisee = onDocumentUpdated("club_invites/{code}", async (event) => {
  const avant = event.data && event.data.before.data();
  const apres = event.data && event.data.after.data();
  if (!avant || !apres || avant.usedBy || !apres.usedBy || apres.role !== "dirigeant") return;
  let ref = db.collection("plateforme_push").doc(SUPER_ADMIN_UID);
  let snap = await ref.get();
  if (!(snap.exists && snap.data() && snap.data().token)) {
    ref = db.collection("clubs").doc(CLUB_ORIGINE).collection("push_subscriptions").doc(SUPER_ADMIN_UID);
    snap = await ref.get();
  }
  const token = snap.exists && snap.data() && snap.data().token;
  if (!token) return;
  try {
    await admin.messaging().send({
      token,
      notification: { title: "Compte dirigeant validé", body: String(apres.clubName || "Un club") + " : le dirigeant vient de créer son compte" },
      data: { url: "./" },
      webpush: { fcmOptions: { link: "./" } }
    });
  } catch (e) {
    const code = e && e.code;
    if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") await ref.delete();
  }
});

// Test d'alerte demandé depuis la Plateforme (bouton « Tester ») : envoie une vraie notif
// à l'appareil enregistré et écrit le résultat sur le document, pour le diagnostic.
exports.onPlateformePing = onDocumentCreated("plateforme_ping/{id}", async (event) => {
  const ref = event.data && event.data.ref;
  if (!ref) return;
  const sub = await db.collection("plateforme_push").doc(SUPER_ADMIN_UID).get();
  const token = sub.exists && sub.data() && sub.data().token;
  if (!token) { await ref.update({ ok: false, erreur: "aucun appareil enregistré" }); return; }
  try {
    await admin.messaging().send({
      token,
      notification: { title: "Test d'alerte", body: "Si tu vois ceci, les alertes Plateforme fonctionnent." },
      data: { url: "./" },
      webpush: { fcmOptions: { link: "./" } }
    });
    await ref.update({ ok: true });
  } catch (e) {
    await ref.update({ ok: false, erreur: String((e && (e.code || e.message)) || e).slice(0, 200) });
  }
});

// Une personne modifie son prénom, son nom ou son e-mail : message privé au(x)
// dirigeant(s) du club (la première saisie du nom, elle, ne prévient personne).
exports.onCompteModifie = onDocumentUpdated("users/{uid}", async (event) => {
  const avant = event.data && event.data.before.data();
  const apres = event.data && event.data.after.data();
  if (!avant || !apres || !apres.clubId) return;
  const roles = apres.roles || [];
  if (roles.includes("dirigeant") || roles.includes("joueur") || roles.includes("client")) return;
  const uid = event.params.uid;
  const nomDe = (u) => `${u.prenom || ""} ${u.nom || ""}`.trim();
  const ancienNom = nomDe(avant), nouveauNom = nomDe(apres);
  const nomChange = ancienNom !== nouveauNom && !!ancienNom;
  const mailChange = !!avant.email && !!apres.email && avant.email !== apres.email;
  if (!nomChange && !mailChange) return;
  const lignes = [];
  if (nomChange) lignes.push(`Nom : ${ancienNom} → ${nouveauNom}`);
  if (mailChange) lignes.push(`E-mail : ${avant.email} → ${apres.email}`);
  const texte = `J'ai modifié mon compte.\n${lignes.join("\n")}`;
  const dirs = await db.collection("users").where("clubId", "==", apres.clubId).where("roles", "array-contains", "dirigeant").get();
  const clubRef = db.collection("clubs").doc(apres.clubId);
  const label = nouveauNom || apres.email || "Compte";
  for (const d of dirs.docs) {
    if (d.id === uid) continue;
    const dmId = [uid, d.id].sort().join("__");
    const dmRef = clubRef.collection("dms").doc(dmId);
    const now = admin.firestore.FieldValue.serverTimestamp();
    await dmRef.set({
      memberUids: [uid, d.id],
      members: [{ uid, label }, { uid: d.id, label: nomDe(d.data()) || d.data().email || "Dirigeant" }],
      createdBy: uid, lastMsg: texte.slice(0, 80), lastTs: now, lastSender: uid
    }, { merge: true });
    await dmRef.collection("messages").add({ senderUid: uid, pseudo: label, text: texte, ts: now });
  }
});

// Chaque nuit : une discussion privée n'est effacée pour de bon que si TOUS ses
// participants l'ont « supprimée » (masquée) et que son dernier message a plus de
// 12 mois. Tant qu'un participant la garde, rien n'est supprimé.
const { onSchedule } = require("firebase-functions/v2/scheduler");
exports.purgeDiscussionsMasquees = onSchedule("every day 03:30", async () => {
  const limite = admin.firestore.Timestamp.fromMillis(Date.now() - 365 * 24 * 3600 * 1000);
  const clubs = await db.collection("clubs").get();
  for (const club of clubs.docs) {
    const vieux = await club.ref.collection("dms").where("lastTs", "<", limite).get();
    for (const dm of vieux.docs) {
      const uids = dm.data().memberUids || [];
      const reads = await Promise.all(uids.map((u) => dm.ref.collection("reads").doc(u).get()));
      if (!uids.length || !reads.every((r) => r.exists && r.data().masque === true)) continue;
      await db.recursiveDelete(dm.ref);
    }
  }
});
