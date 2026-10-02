/* ===== functions/index.js — Cloud Functions (notifications push) =====
   Un seul déclencheur pour l'instant : un nouveau message dans un canal
   Communauté notifie tous les abonnés push du club, sauf son auteur.
   Se déclenche automatiquement à l'écriture Firestore — rien côté client
   n'a besoin d'appeler cette fonction (voir js/22-push.js et sendMsg dans
   js/16-communaute.js). */

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
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
