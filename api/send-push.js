// ===== api/send-push.js — Envoi des notifications push (Vercel serverless) =====
// Appelée par js/22-push.js juste après l'écriture d'un message en base
// (clubs/{clubId}/channels/{channelId}/messages). Lit les abonnements du
// club via le SDK Admin (ignore les règles Firestore, c'est voulu : seule
// cette fonction, détentrice de la clé privée, a besoin d'y accéder), et
// pousse la notif à chaque abonné sauf l'auteur du message.
//
// Variables d'environnement requises (Vercel → Project Settings → Environment
// Variables) :
//   FIREBASE_SERVICE_ACCOUNT  = JSON complet de la clé de service Firebase
//                                (Firebase Console → Paramètres du projet →
//                                Comptes de service → Générer une nouvelle clé
//                                privée), collé tel quel (une seule ligne).
//   VAPID_PUBLIC_KEY          = clé publique générée (voir PUSH_SETUP.md)
//   VAPID_PRIVATE_KEY         = clé privée générée (jamais côté client)
//   VAPID_SUBJECT             = "mailto:contact@generalmanagerapp.fr" (ou autre)
//   ALLOWED_ORIGIN             = "https://generalmanagerapp.fr" (CORS)

const webpush = require('web-push');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
  });
}
const db = admin.firestore();

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || 'mailto:contact@generalmanagerapp.fr',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

module.exports = async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Méthode non autorisée' }); return; }

  try {
    const { clubId, excludeUid, title, body } = req.body || {};
    if (!clubId || !title) { res.status(400).json({ error: 'clubId et title requis' }); return; }

    const snap = await db.collection('clubs').doc(clubId).collection('push_subscriptions').get();
    if (snap.empty) { res.status(200).json({ sent: 0 }); return; }

    const payload = JSON.stringify({ title, body: body || '', url: './' });
    let sent = 0, removed = 0;
    const jobs = [];
    snap.forEach(doc => {
      if (excludeUid && doc.id === excludeUid) return;
      const sub = doc.data() && doc.data().subscription;
      if (!sub) return;
      jobs.push(
        webpush.sendNotification(sub, payload)
          .then(() => { sent++; })
          .catch(err => {
            // 404/410 = abonnement expiré/révoqué côté navigateur : on nettoie.
            if (err && (err.statusCode === 404 || err.statusCode === 410)) {
              removed++;
              return doc.ref.delete().catch(() => {});
            }
            console.log('send-push', doc.id, err && err.statusCode, err && err.body);
          })
      );
    });
    await Promise.all(jobs);
    res.status(200).json({ sent, removed });
  } catch (e) {
    console.log('send-push error:', e);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
