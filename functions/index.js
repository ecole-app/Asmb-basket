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

    const { clubId } = event.params;
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
      data: { url: "./" },
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
      tokens, notification: { title, body }, data: { url: "./" }, webpush: { fcmOptions: { link: "./" } }
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
