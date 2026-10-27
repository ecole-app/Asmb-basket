/* ===== functions/index.js — Cloud Functions (notifications push) =====
   Un seul déclencheur pour l'instant : un nouveau message dans un canal
   Communauté notifie tous les abonnés push du club, sauf son auteur.
   Se déclenche automatiquement à l'écriture Firestore — rien côté client
   n'a besoin d'appeler cette fonction (voir js/22-push.js et sendMsg dans
   js/16-communaute.js). */

const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

// Région proche de la majorité des utilisateurs visés (club basé en France).
setGlobalOptions({ region: "europe-west1", maxInstances: 10 });

// ── Image de droite des notifications : le logo du club ─────────────────
// Le logo est enregistré dans la fiche du club (image intégrée). Une notification a besoin d'une adresse web :
// cette fonction publique renvoie le logo du club (même logo que sur les pages publiques d'inscription).
// Sans logo, 404 : le téléphone affiche alors sa lettre par défaut.
const URL_LOGO_CLUB = "https://europe-west1-asmb-app.cloudfunctions.net/logoClub";
const URL_LOGO_GM = "https://generalmanagerapp.fr/icon-192.png";
function webpushClub(clubId, plus) {
  const w = Object.assign({ fcmOptions: { link: "./" } }, plus || {});
  w.notification = { icon: clubId ? URL_LOGO_CLUB + "?c=" + encodeURIComponent(clubId) : URL_LOGO_GM };
  return w;
}
// ── Langue des notifications ──────────────────────────────────────────────
// Chaque appareil enregistre sa langue avec son abonnement (push_subscriptions/{uid}.langue,
// js/22-push.js). Seuls les textes fixes sont traduits : ce que les gens écrivent (messages,
// noms, postes, titres d'événements) reste tel quel. Langue absente ou inconnue : français.
// Les alertes Plateforme (super admin) restent en français.
const NOTIF_LANGUES = ["en", "ar", "es", "it", "de"];
const NOTIF_TXT = {
  "Nouveau message": ["New message", "رسالة جديدة", "Nuevo mensaje", "Nuovo messaggio", "Neue Nachricht"],
  "Communauté": ["Community", "المجتمع", "Comunidad", "Community", "Community"],
  "Message privé": ["Private message", "رسالة خاصة", "Mensaje privado", "Messaggio privato", "Private Nachricht"],
  "message privé": ["private message", "رسالة خاصة", "mensaje privado", "messaggio privato", "private Nachricht"],
  "📄 a partagé un document": ["📄 shared a document", "📄 شارك مستندًا", "📄 ha compartido un documento", "📄 ha condiviso un documento", "📄 hat ein Dokument geteilt"],
  "📷 a partagé une photo": ["📷 shared a photo", "📷 شارك صورة", "📷 ha compartido una foto", "📷 ha condiviso una foto", "📷 hat ein Foto geteilt"],
  "🎤 Message vocal": ["🎤 Voice message", "🎤 رسالة صوتية", "🎤 Mensaje de voz", "🎤 Messaggio vocale", "🎤 Sprachnachricht"],
  "Championnat": ["Championship", "البطولة", "Campeonato", "Campionato", "Meisterschaft"],
  "Classement": ["Standings", "الترتيب", "Clasificación", "Classifica", "Tabelle"],
  "Votre rôle a changé": ["Your role has changed", "تغيّر دورك", "Tu función ha cambiado", "Il tuo ruolo è cambiato", "Ihre Rolle hat sich geändert"],
  "Vous êtes bénévole": ["You are volunteering", "أنت متطوع", "Eres voluntario", "Sei volontario", "Sie sind als Helfer eingeteilt"],
  "bénévole": ["volunteer", "متطوع", "voluntario", "volontario", "Helfer"],
  "événement du club": ["club event", "فعالية النادي", "evento del club", "evento del club", "Vereinsveranstaltung"],
  "Test de notification": ["Notification test", "اختبار الإشعارات", "Prueba de notificación", "Test di notifica", "Benachrichtigungstest"],
  "Si tu vois ceci, les messages du club t'arriveront.": ["If you can see this, club messages will reach you.", "إذا رأيت هذا، فستصلك رسائل النادي.", "Si ves esto, te llegarán los mensajes del club.", "Se vedi questo, i messaggi del club ti arriveranno.", "Wenn du das siehst, erreichen dich die Nachrichten des Vereins."],
  // rôles, profils du bureau, modules (mêmes mots que l'appli, i18n/<langue>.json)
  "Dirigeant": ["Director", "مسيّر", "Directivo", "Dirigente", "Vorstand"],
  "Coach": ["Coach", "مدرب", "Entrenador", "Allenatore", "Trainer"],
  "Parent": ["Parent", "وليّ أمر", "Padre/Madre", "Genitore", "Elternteil"],
  "Joueur": ["Player", "لاعب", "Jugador", "Giocatore", "Spieler"],
  "Bureau": ["Board", "المكتب", "Junta", "Direttivo", "Vorstand"],
  "Trésorier": ["Treasurer", "أمين المال", "Tesorero/a", "Tesoriere", "Kassenwart"],
  "Secrétaire": ["Secretary", "الكاتب العام", "Secretario/a", "Segretario/a", "Schriftführer/in"],
  "Membre du bureau": ["Board member", "عضو المكتب", "Miembro de la junta", "Membro del direttivo", "Vorstandsmitglied"],
  "Accès & invitations": ["Access & invitations", "الوصول والدعوات", "Accesos e invitaciones", "Accessi e inviti", "Zugänge & Einladungen"],
  "Paramètres": ["Settings", "الإعدادات", "Ajustes", "Impostazioni", "Einstellungen"],
  "Licences": ["Licences", "الرخص", "Licencias", "Tessere", "Lizenzen"],
  "Inscriptions": ["Registrations", "التسجيلات", "Inscripciones", "Iscrizioni", "Anmeldungen"],
  "Équipes": ["Teams", "الفرق", "Equipos", "Squadre", "Mannschaften"],
  "Planning": ["Schedule", "البرنامج", "Planificación", "Programma", "Plan"],
  "Documents": ["Documents", "المستندات", "Documentos", "Documenti", "Dokumente"],
  "Accès coach": ["Coach access", "وصول المدرب", "Acceso entrenador", "Accesso allenatore", "Trainerzugang"],
  "Avis & suggestions": ["Feedback & suggestions", "الآراء والاقتراحات", "Opiniones y sugerencias", "Opinioni e suggerimenti", "Feedback & Vorschläge"],
  "Fiches reçues": ["Forms received", "الاستمارات المستلمة", "Fichas recibidas", "Schede ricevute", "Erhaltene Formulare"],
  "Comptabilité": ["Accounting", "المحاسبة", "Contabilidad", "Contabilità", "Buchhaltung"],
  "Sponsors & Partenaires": ["Sponsors & Partners", "الرعاة والشركاء", "Patrocinadores y socios", "Sponsor e partner", "Sponsoren & Partner"],
  "Notes de frais": ["Expense claims", "المصاريف", "Notas de gastos", "Note spese", "Spesenabrechnungen"],
  "Inventaire": ["Inventory", "الجرد", "Inventario", "Inventario", "Inventar"]
};
const notifLangue = (l) => (NOTIF_LANGUES.includes(l) ? l : "fr");
function tn(lang, fr) {
  const t = NOTIF_TXT[fr], i = NOTIF_LANGUES.indexOf(lang);
  return (t && i >= 0 && t[i]) || fr;
}
const NOTIF_ET = { fr: "et", en: "and", ar: "و", es: "y", it: "e", de: "und" };
function listeLangue(a, lang) {
  if (a.length <= 1) return a[0] || "";
  if (lang === "ar") return a.slice(0, -1).join("، ") + " و" + a[a.length - 1];   // « و » collé au mot suivant
  return a.slice(0, -1).join(", ") + " " + (NOTIF_ET[lang] || "et") + " " + a[a.length - 1];
}
// Rang au classement : 1er/2e (fr), 1st/2nd (en), 1.º (es), 1° (it), 1. (de), 1 (ar).
function rangLangue(n, lang) {
  if (lang === "en") { const d = n % 10, c = n % 100; return n + ((c >= 11 && c <= 13) ? "th" : d === 1 ? "st" : d === 2 ? "nd" : d === 3 ? "rd" : "th"); }
  if (lang === "es") return n + ".º";
  if (lang === "it") return n + "°";
  if (lang === "de") return n + ".";
  if (lang === "ar") return String(n);
  return n + (n === 1 ? "er" : "e");
}
const jetonMort = (c) => c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token";
// Envoi à plusieurs appareils, un envoi par langue (500 jetons max par envoi).
// entrees : [{token, ref, langue}] ; fabrique(langue) → {title, body}.
// Les abonnements dont le jeton est mort (appli désinstallée...) sont supprimés.
async function envoyerParLangue(clubId, entrees, fabrique, data, plus) {
  const groupes = {};
  entrees.forEach((e) => { const l = notifLangue(e.langue); (groupes[l] = groupes[l] || []).push(e); });
  const morts = [];
  for (const l of Object.keys(groupes)) {
    const notification = fabrique(l), g = groupes[l];
    for (let i = 0; i < g.length; i += 500) {
      const lot = g.slice(i, i + 500);
      const r = await admin.messaging().sendEachForMulticast({
        tokens: lot.map((e) => e.token), notification, data, webpush: webpushClub(clubId, plus)
      });
      r.responses.forEach((x, j) => { if (!x.success && jetonMort(x.error && x.error.code)) morts.push(lot[j].ref); });
    }
  }
  if (morts.length) await Promise.all(morts.map((ref) => ref.delete().catch(() => {})));
}

exports.logoClub = onRequest({ cors: false, memory: "256MiB" }, async (req, res) => {
  try {
    const id = String(req.query.c || "");
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) { res.status(404).end(); return; }
    const snap = await db.collection("clubs").doc(id).get();
    const logo = snap.exists && snap.data() && snap.data().logo;
    const m = typeof logo === "string" && /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+\/=]+)$/.exec(logo);
    if (!m) { res.status(404).end(); return; }
    res.set("Content-Type", "image/" + m[1]);
    res.set("Cache-Control", "public, max-age=86400");
    res.status(200).send(Buffer.from(m[2], "base64"));
  } catch (e) { res.status(404).end(); }
});

// Extérieurs d'un événement (sans compte) qui ont activé les notifications sur la page /fil :
// ils reçoivent chaque message du fil jusqu'à la fin de l'événement, avec leur propre lien.
async function notifierExternes(clubId, channelId, ch, msg, fabrique) {
  const eventId = String(ch.eventId || channelId.replace(/^evt_/, ""));
  const pid = clubId + "__" + eventId;
  const col = db.collection("clubs").doc(clubId).collection("fil_acces");
  const r = await col.where("pid", "==", pid).get();
  const cibles = [];
  r.forEach((d) => {
    const x = d.data() || {};
    if (!x.token || (x.code || d.id) === msg.extCode) return;
    cibles.push({ ref: d.ref, token: x.token, code: x.code || d.id, ben: !!x.ben, langue: x.langue });
  });
  if (!cibles.length) return;
  const messages = cibles.map((c) => {
    const f = fabrique(notifLangue(c.langue));
    const lien = "https://generalmanagerapp.fr/fil/?e=" + encodeURIComponent(pid) + (c.ben ? "&p=" : "&c=") + encodeURIComponent(c.code);
    const w = webpushClub(clubId, { headers: { Urgency: "high" }, fcmOptions: { link: lien } });
    return { token: c.token, notification: { title: String(ch.name || f.title).slice(0, 80), body: ((msg.pseudo ? msg.pseudo + " : " : "") + f.body).slice(0, 160) }, data: { url: lien }, webpush: w };
  });
  const rep = await admin.messaging().sendEach(messages);
  const morts = [];
  rep.responses.forEach((x, i) => { if (!x.success && jetonMort(x.error && x.error.code)) morts.push(cibles[i].ref); });
  await Promise.all(morts.map((ref) => ref.update({ token: admin.firestore.FieldValue.delete() }).catch(() => {})));
}

exports.onChannelMessage = onDocumentCreated(
  "clubs/{clubId}/channels/{channelId}/messages/{messageId}",
  async (event) => {
    const msg = event.data && event.data.data();
    if (!msg || msg.deleted) return;

    const { clubId, channelId } = event.params;
    const authorUid = msg.senderUid || null;
    const texte = String(msg.text || "").slice(0, 120);
    if (msg.type !== "media" && !texte) return;
    // Le canal « remonte » en tête de liste, avec l'aperçu du dernier message (comme WhatsApp).
    // Écrit ici (compte serveur) car une famille n'a pas le droit de modifier la fiche d'un canal.
    try {
      await db.collection("clubs").doc(clubId).collection("channels").doc(channelId).set({
        lastTs: admin.firestore.FieldValue.serverTimestamp(),
        lastMsg: msg.type === "media" ? (msg.mediaType === "pdf" ? "📄 Document" : "📷 Photo") : texte.replace(/\s+/g, " ").slice(0, 80),
        lastPseudo: String(msg.pseudo || "").slice(0, 40)
      }, { merge: true });
    } catch (e) { /* l'aperçu est un confort : on ne bloque pas les notifications */ }
    const fabrique = (l) => ({
      title: msg.pseudo ? `${msg.pseudo} (${tn(l, "Communauté")})` : tn(l, "Nouveau message"),
      body: (msg.type === "media")
        ? tn(l, msg.mediaType === "pdf" ? "📄 a partagé un document" : "📷 a partagé une photo")
        : texte
    });

    // Destinataires : seulement les personnes qui voient ce canal.
    //  - canal réservé (liste de membres par téléphone) : ces membres + les dirigeants ;
    //  - canal d'équipe : tout le monde sauf les coachs d'une autre équipe ;
    //  - canal ouvert : tout le club.
    const clubRef = db.collection("clubs").doc(clubId);
    const subsCol = clubRef.collection("push_subscriptions");
    const chSnap = await clubRef.collection("channels").doc(channelId).get();
    const ch = (chSnap.exists && chSnap.data()) || {};
    const membres = Array.isArray(ch.members) ? ch.members : [];
    // Fil d'événement : jamais « tout le club » ; une fois l'événement fini, seuls les dirigeants sont prévenus.
    const evtFini = !!ch.evt && !!ch.fin && new Date().toISOString().slice(0, 10) > ch.fin;
    if (ch.evt && !evtFini) { try { await notifierExternes(clubId, channelId, ch, msg, fabrique); } catch (e) { console.error("notifierExternes", e); } }
    let docs = [];
    if (membres.length || ch.evt) {
      const tels = evtFini ? [] : [...new Set(membres.map((m) => String(typeof m === "string" ? m : (m && m.phone) || "").replace(/\s+/g, "")).filter(Boolean))];
      const uids = new Set();
      for (let i = 0; i < tels.length; i += 30) {
        const r = await db.collection("users").where("clubId", "==", clubId).where("phone", "in", tels.slice(i, i + 30)).get();
        r.forEach((d) => uids.add(d.id));
      }
      const dirs = await db.collection("users").where("clubId", "==", clubId).where("roles", "array-contains", "dirigeant").get();
      dirs.forEach((d) => uids.add(d.id));
      if (!uids.size) return;
      docs = await db.getAll(...[...uids].map((u) => subsCol.doc(u)));
    } else {
      const subsSnap = await subsCol.get();
      docs = subsSnap.docs;
      if (ch.teamId && !ch.clubWide) {
        const coachs = await db.collection("users").where("clubId", "==", clubId).where("roles", "array-contains", "coach").get();
        const exclus = new Set();
        coachs.forEach((d) => {
          const u = d.data() || {};
          if (!(u.roles || []).includes("dirigeant") && !(u.linkedTeamIds || []).includes(ch.teamId)) exclus.add(d.id);
        });
        docs = docs.filter((d) => !exclus.has(d.id));
      }
    }

    const entrees = [];
    docs.forEach((doc) => {
      if (!doc.exists) return;
      if (authorUid && doc.id === authorUid) return;
      const d = doc.data() || {};
      if (d.token) entrees.push({ token: d.token, ref: subsCol.doc(doc.id), langue: d.langue });
    });
    if (!entrees.length) return;
    // Un envoi par langue ; les tokens morts (app désinstallée, cache vidé...) sont nettoyés.
    await envoyerParLangue(clubId, entrees, fabrique, { url: "./", conv: channelId }, { headers: { Urgency: "high" } });
  }
);

// Discussion privée : seule l'autre personne de la discussion est notifiée.
// ── Fil d'un événement pour une personne SANS compte (billet d'inscription) ──
// Page : generalmanagerapp.fr/fil/?e=<clubId>__<eventId>&c=<code du billet>. Le code du billet est la clé.
// Tout passe par cette fonction (compte serveur) : le visiteur ne touche jamais Firestore.
//  - arrivée = première ouverture du lien (fil_acces/{code}.depuis) ; il lit de son arrivée à la fin de l'événement ;
//  - il écrit jusqu'à la fin de l'événement (23 h 59, heure de Paris), puis lecture seule ;
//  - sa réponse n'est jamais plus longue que FIL_MAX_TEXTE, et pas plus d'un message toutes les 1,5 s.
const FIL_MAX_TEXTE = 500;
function parisFinDeJour(jour) {
  const base = Date.parse(String(jour || "") + "T23:59:59.999Z");
  if (isNaN(base)) return 0;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "shortOffset" }).formatToParts(new Date(base));
  const z = (parts.find((x) => x.type === "timeZoneName") || {}).value || "GMT+1";
  const m = /GMT([+-])(\d+)(?::(\d+))?/.exec(z);
  const dec = m ? (m[1] === "-" ? -1 : 1) * (parseInt(m[2], 10) * 60 + parseInt(m[3] || "0", 10)) : 60;
  return base - dec * 60000;
}
// Seuils anti-devinette de filEvenement (codes faux par heure).
const FIL_ESSAIS_FENETRE = 60 * 60 * 1000;
const FIL_ESSAIS_MAX_IP = 20;
const FIL_ESSAIS_MAX_EVT = 200;
exports.filEvenement = onRequest({ cors: ["https://generalmanagerapp.fr", "https://www.generalmanagerapp.fr"], memory: "256MiB" }, async (req, res) => {
  res.set("Cache-Control", "no-store");
  if (req.method !== "POST") { res.status(405).json({ erreur: "methode" }); return; }
  const b = (req.body && typeof req.body === "object") ? req.body : {};
  const pid = String(b.pid || "");
  const code = String(b.code || "").toUpperCase().trim();
  const ben = b.ben === true; // bénévole sans compte : le code est celui de son pass (ben_pass/{CODE})
  const i = pid.indexOf("__");
  const clubId = i > 0 ? pid.slice(0, i) : "", eventId = i > 0 ? pid.slice(i + 2) : "";
  if (!/^[A-Za-z0-9_-]{2,60}$/.test(clubId) || !/^[A-Za-z0-9_-]{1,40}$/.test(eventId) || !(ben ? /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/ : /^[A-Z]{3}-\d{5}(-[A-HJ-NP-Z2-9]{4})?$/).test(code)) {
    res.status(400).json({ erreur: "lien" }); return;
  }
  // Anti-devinette : un code faux compte comme un échec, par appareil (IP hachée,
  // jamais stockée en clair) et par événement. Au-delà du seuil sur l'heure, on refuse
  // sans même regarder le code. Les personnes déjà entrées dans le fil (fil_acces)
  // ne sont jamais bloquées par le seuil de l'événement.
  // Dernière adresse de X-Forwarded-For = celle ajoutée par Google (la première peut être inventée par le client).
  const xff = String(req.headers["x-forwarded-for"] || "").split(",").map((x) => x.trim()).filter(Boolean);
  const ipBrute = xff.length ? xff[xff.length - 1] : String(req.ip || "");
  const ipRef = db.collection("fil_essais").doc("ip_" + crypto.createHash("sha256").update("gm-fil|" + ipBrute).digest("hex").slice(0, 32));
  const evtEssaisRef = db.collection("fil_essais").doc("evt_" + crypto.createHash("sha256").update(pid).digest("hex").slice(0, 32));
  try {
    const clubRef = db.collection("clubs").doc(clubId);
    const canalRef = clubRef.collection("channels").doc("evt_" + eventId);
    const accRef = clubRef.collection("fil_acces").doc(ben ? code + "~" + eventId : code);
    const [bSnap, pSnap, cSnap, aSnap, ipSnap, evSnap] = await Promise.all([
      ben ? db.collection("ben_pass").doc(code).get() : clubRef.collection("evt_inscrits").doc(code).get(),
      db.collection("evt_pages").doc(pid).get(),
      canalRef.get(),
      accRef.get(),
      ipRef.get(),
      evtEssaisRef.get()
    ]);
    const maintenant = Date.now();
    const essais = (sn) => { const d = sn.exists ? sn.data() : null; return d && maintenant - (d.depuis || 0) < FIL_ESSAIS_FENETRE ? (d.n || 0) : 0; };
    const dejaEntre = aSnap.exists && aSnap.data() && aSnap.data().depuis;
    if (essais(ipSnap) >= FIL_ESSAIS_MAX_IP || (!dejaEntre && essais(evSnap) >= FIL_ESSAIS_MAX_EVT)) {
      res.status(429).json({ erreur: "trop" }); return;
    }
    const echec = async () => {
      await Promise.all([[ipRef, ipSnap], [evtEssaisRef, evSnap]].map(([ref, sn]) => {
        const n = essais(sn);
        return ref.set(n === 0
          ? { n: 1, depuis: maintenant, expire: new Date(maintenant + 2 * FIL_ESSAIS_FENETRE) }
          : { n: admin.firestore.FieldValue.increment(1) }, { merge: true }).catch(() => {});
      }));
    };
    const bil = bSnap.exists ? bSnap.data() : null;
    const page = pSnap.exists ? pSnap.data() : null;
    const canal = cSnap.exists ? cSnap.data() : null;
    if (ben) {
      // Le pass doit être celui de ce club, actif, avec une mission sur cet événement.
      const missions = bil && Array.isArray(bil.missions) ? bil.missions : [];
      if (!bil || bil.clubId !== clubId || bil.actif === false || !missions.some((m) => m && String(m.eid) === eventId)) { await echec(); res.status(403).json({ erreur: "billet" }); return; }
      if (!canal || !canal.evt || canal.deleted) { res.status(404).json({ erreur: "pas_de_fil" }); return; }
    } else {
      if (!bil || String(bil.eventId) !== eventId || bil.statut === "annule") { await echec(); res.status(403).json({ erreur: "billet" }); return; }
      if (!page || !canal || !canal.evt || canal.deleted) { res.status(404).json({ erreur: "pas_de_fil" }); return; }
    }

    const now = Date.now();
    const finMs = parisFinDeJour(ben ? canal.fin : (page.dateFin || page.date));
    const prenom = ben ? String(bil.nom || "").trim().split(/\s+/)[0] : String(bil.prenom || "").trim();
    const nom = ben ? String(bil.nom || "").trim().split(/\s+/).slice(1).join(" ") : String(bil.nom || "").trim();
    const pseudo = (prenom + (nom ? " " + nom.charAt(0).toUpperCase() + "." : "")).trim() || "Invité";
    let acc = aSnap.exists ? aSnap.data() : null;
    if (!acc || !acc.depuis) {
      acc = { depuis: now, pseudo, pid, creeLe: now };
      if (ben) { acc.ben = true; acc.code = code; }
      await accRef.set(acc, { merge: true });
    }
    const fini = !!finMs && now > finMs;

    // Notifications d'un extérieur : son appareil enregistre/retire son jeton (stocké côté serveur seulement).
    if (b.action === "notifs" || b.action === "notifs_off") {
      if (b.action === "notifs_off") { await accRef.update({ token: admin.firestore.FieldValue.delete() }).catch(() => {}); res.json({ ok: true }); return; }
      const token = String(b.token || "");
      if (token.length < 20 || token.length > 4096 || /\s/.test(token)) { res.status(400).json({ erreur: "jeton" }); return; }
      await accRef.set({ token, langue: notifLangue(b.langue), notifLe: now }, { merge: true });
      res.json({ ok: true });
      return;
    }

    if (b.action === "ecrire") {
      if (fini) { res.status(403).json({ erreur: "fini" }); return; }
      const texte = String(b.text || "").replace(/\r/g, "").trim().slice(0, FIL_MAX_TEXTE);
      if (!texte) { res.status(400).json({ erreur: "vide" }); return; }
      if (acc.dernier && now - acc.dernier < 1500) { res.status(429).json({ erreur: "trop_vite" }); return; }
      await canalRef.collection("messages").add({
        text: texte, pseudo, senderUid: null, ext: true, extCode: code,
        ts: admin.firestore.FieldValue.serverTimestamp()
      });
      await accRef.set({ dernier: now }, { merge: true });
      res.json({ ok: true });
      return;
    }

    // Lecture : de son arrivée à la fin de l'événement (jamais au-delà), par morceaux si « apres » est donné.
    const apres = Number(b.apres) > 0 ? Number(b.apres) + 1 : 0;
    const de = Math.max(acc.depuis, apres), a = finMs ? Math.min(now, finMs) : now;
    const T = admin.firestore.Timestamp;
    const msgs = [];
    if (de <= a) {
      const r = await canalRef.collection("messages").where("ts", ">=", T.fromMillis(de)).where("ts", "<=", T.fromMillis(a)).orderBy("ts").limit(200).get();
      r.forEach((d) => {
        const m = d.data();
        if (!m || m.deleted) return;
        const ts = m.ts && m.ts.toMillis ? m.ts.toMillis() : 0;
        msgs.push({
          id: d.id, pseudo: String(m.pseudo || ""), text: m.type === "media" ? "" : String(m.text || ""),
          media: m.type === "media" ? String(m.mediaUrl || "") : "", ts, mine: m.extCode === code
        });
      });
    }
    res.json({ ok: true, notifs: !!acc.token, titre: String(ben ? canal.name : page.titre || ""), club: String(ben ? bil.clubName : page.nom || ""), fin: ben ? canal.fin || "" : page.dateFin || page.date || "", fini, moi: pseudo, messages: msgs });
  } catch (e) {
    console.error("filEvenement", e);
    res.status(500).json({ erreur: "serveur" });
  }
});

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
    const texte = String(msg.text || "").slice(0, 120);
    if (msg.type !== "media" && !texte) return;
    const fabrique = (l) => ({
      title: msg.pseudo ? `${msg.pseudo} (${tn(l, "message privé")})` : tn(l, "Message privé"),
      body: (msg.type === "media")
        ? tn(l, msg.mediaType === "audio" ? "🎤 Message vocal" : msg.mediaType === "pdf" ? "📄 a partagé un document" : "📷 a partagé une photo")
        : texte
    });
    const subsCol = db.collection("clubs").doc(clubId).collection("push_subscriptions");
    const docs = await Promise.all(dest.map((u) => subsCol.doc(u).get()));
    const entrees = [];
    docs.forEach((d) => {
      const x = (d.exists && d.data()) || {};
      if (x.token) entrees.push({ token: x.token, ref: d.ref, langue: x.langue });
    });
    if (!entrees.length) return;
    await envoyerParLangue(clubId, entrees, fabrique, { url: "./", conv: dmId }, { headers: { Urgency: "high" } });
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
      webpush: webpushClub(null, { headers: { Urgency: "high" } })
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
      webpush: webpushClub(null, { headers: { Urgency: "high" } })
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
      webpush: webpushClub(null, { headers: { Urgency: "high" } })
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
  const uid = event.params.uid;
  const nomDe = (u) => `${u.prenom || ""} ${u.nom || ""}`.trim();
  const ancienNom = nomDe(avant), nouveauNom = nomDe(apres);
  // Le nom affiché dans les discussions privées existantes suit le compte
  // (y compris la toute première saisie du nom).
  if (nouveauNom && ancienNom !== nouveauNom) {
    const dms = await db.collection("clubs").doc(apres.clubId).collection("dms").where("memberUids", "array-contains", uid).get();
    for (const dm of dms.docs) {
      const membres = (dm.data().members || []).map((m) => (m.uid === uid ? { uid, label: nouveauNom } : m));
      await dm.ref.update({ members: membres });
    }
  }
  // Pas de message au dirigeant pour un dirigeant, un joueur ou un client.
  if (roles.includes("dirigeant") || roles.includes("joueur") || roles.includes("client")) return;
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

// Test des notifications du club (bouton de Communauté › réglages) : envoie une
// vraie notification à l'abonnement de la personne et note le résultat.
exports.onClubPushPing = onDocumentCreated("clubs/{clubId}/push_ping/{id}", async (event) => {
  const ref = event.data && event.data.ref;
  const d = event.data && event.data.data();
  if (!ref || !d || !d.uid) return;
  const sub = await db.collection("clubs").doc(event.params.clubId).collection("push_subscriptions").doc(d.uid).get();
  const token = sub.exists && sub.data() && sub.data().token;
  if (!token) { await ref.update({ ok: false, erreur: "aucun abonnement pour ce compte dans ce club (active les notifications dans les réglages)" }); return; }
  const l = notifLangue(sub.data().langue);
  try {
    await admin.messaging().send({
      token,
      notification: { title: tn(l, "Test de notification"), body: tn(l, "Si tu vois ceci, les messages du club t'arriveront.") },
      data: { url: "./" },
      webpush: webpushClub(event.params.clubId, { headers: { Urgency: "high" } })
    });
    await ref.update({ ok: true });
  } catch (e) {
    await ref.update({ ok: false, erreur: String((e && (e.code || e.message)) || e).slice(0, 200) });
  }
});

/* ===== Synchro FFBB (classement + résultats de la poule) =====
   API NON officielle de la FFBB (celle de l'appli mobile) : jetons publics lus
   dans api.ffbb.app/items/configuration, poule dans items/ffbbserver_poules/{id},
   recherche dans Meilisearch. Elle peut changer sans prévenir : en cas d'échec
   on garde les données déjà en base et on le dit, on ne casse rien. */
// Adresses connues de l'API (la première qui répond est utilisée).
const FFBB_APIS = ["https://api.ffbb.app/", "https://bo.ffbb.com/", "https://bo.ffbb.app/"];
const FFBB_MS = "https://meilisearch-prod.ffbb.app/multi-search";
const FFBB_UA = "okhttp/4.12.0";

async function ffbbJson(url, opt) {
  const r = await fetch(url, Object.assign({ headers: {} }, opt));
  if (!r.ok) {
    // Début de la réponse : permet de distinguer un champ refusé (Directus) d'un blocage réseau (CDN).
    let corps = "";
    try { corps = (await r.text()).replace(/\s+/g, " ").slice(0, 1600); } catch (e) { /* ignoré */ }
    throw new Error("FFBB " + r.status + (corps ? " : " + corps : ""));
  }
  return r.json();
}
// Chemin relatif (« items/... ») essayé sur chaque adresse de FFBB_APIS.
async function ffbbApi(chemin, opt) {
  // Essaie chaque adresse, d'abord avec l'identité de l'appli mobile, puis comme un navigateur.
  const navigateur = { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    accept: "application/json, text/plain, */*", "accept-language": "fr-FR,fr;q=0.9", origin: "https://competitions.ffbb.com", referer: "https://competitions.ffbb.com/" };
  const essais = [opt || {}, Object.assign({}, opt || {}, { headers: Object.assign({}, (opt && opt.headers) || {}, navigateur) })];
  const erreurs = [];
  for (const o of essais) {
    for (const base of FFBB_APIS) {
      try { return await ffbbJson(base + chemin, o); } catch (e) {
        erreurs.push(base.replace(/^https:\/\//, "").replace(/\/$/, "") + " " + String(e.message).slice(0, 60));
      }
    }
  }
  throw new Error(chemin.split("?")[0] + " -> " + erreurs.join(" | "));
}
async function ffbbTokens() {
  const j = await ffbbApi("items/configuration", { headers: { "user-agent": FFBB_UA } });
  const d = (j && j.data) || j || {};
  if (!d.key_dh || !d.key_ms) throw new Error("jetons FFBB introuvables");
  return { dh: d.key_dh, ms: d.key_ms };
}
// « ASSOCIATION SPORTIVE MAGIQUE BASKET (6) » → {nom, num}
function ffbbEquipe(s) {
  const t = String(s == null ? "" : s).trim(), m = t.match(/^(.*?)\s*\((\d+)\)\s*$/);
  return m ? { nom: m[1].trim(), num: parseInt(m[2], 10) } : { nom: t, num: null };
}
function ffbbHeure(v) {
  const m = String(v == null ? "" : v).trim().match(/^(\d{1,2})\s*[:hH]?\s*(\d{2})/);
  return m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "";
}
// Recherche d'une poule à partir de numéros de match (ceux de l'export FBI).
async function ffbbTrouverPoule(numeros) {
  const tk = await ffbbTokens();
  const votes = {};
  for (const n of numeros.slice(0, 4)) {
    const j = await ffbbJson(FFBB_MS, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + tk.ms, "user-agent": FFBB_UA },
      body: JSON.stringify({ queries: [{ indexUid: "ffbbserver_rencontres", q: String(n), limit: 20 }] })
    });
    const hits = (j && j.results && j.results[0] && j.results[0].hits) || [];
    hits.forEach((h) => {
      if (String(h.numero) !== String(n)) return;
      const id = h.idPoule && (h.idPoule.id || h.idPoule);
      if (id) votes[id] = (votes[id] || 0) + 1;
    });
  }
  return Object.keys(votes).sort((a, b) => votes[b] - votes[a]).map((id) => ({ id, votes: votes[id] }));
}
// Lit la poule : {nom, rencontres:[...], classement:[...]} au format de l'appli.
// Deux appels, comme le fait le client open source de l'API : la poule (avec son classement)
// puis ses rencontres. Demander des champs de rencontres imbriqués dans la poule est refusé (403).
async function ffbbLirePoule(pouleId, numeros) {
  try { return await ffbbLirePouleDirectus(pouleId); } catch (e) {
    // Directus (api.ffbb.app) refuse parfois les serveurs Google : on lit alors via la recherche (Meilisearch), qui répond.
    try { return await ffbbLirePouleMeili(pouleId, numeros); } catch (e2) { throw new Error("recherche : " + String(e2.message).slice(0, 520) + " || directus : " + String(e.message).slice(0, 90)); }
  }
}
// Deux noms d'équipe désignent la même équipe : sans accents ni ponctuation, « ST » = « SAINT »,
// et le suffixe « - 1 » / « (1) » (numéro d'équipe du club) est facultatif d'un côté comme de l'autre.
function ffbbNomNorm(t) {
  return String(t == null ? "" : t).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\(\s*\d+\s*\)\s*$/, " ").replace(/\s+-\s*\d+\s*$/, " ").replace(/[^a-z0-9]+/g, " ").trim()
    .replace(/\bst\b/g, "saint").replace(/\bste\b/g, "sainte");
}
function ffbbMemeEquipe(a, b) {
  const x = ffbbNomNorm(a), y = ffbbNomNorm(b);
  return !!x && !!y && (x === y || x.startsWith(y + " ") || y.startsWith(x + " "));
}
// Même résultat via Meilisearch : classement recalculé (2 pts victoire, 1 défaite ; pénalités et forfaits non connus).
async function ffbbLirePouleMeili(pouleId, numeros) {
  const tk = await ffbbTokens();
  const lire = (requete) => ffbbJson(FFBB_MS, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + tk.ms, "user-agent": FFBB_UA },
    body: JSON.stringify({ queries: [Object.assign({ indexUid: "ffbbserver_rencontres" }, requete)] })
  }).then((j) => (j && j.results && j.results[0] && j.results[0].hits) || []);
  let idPoule = String(pouleId);
  const dePoule = (h) => String((h.idPoule && (h.idPoule.id || h.idPoule)) || "") === idPoule;
  let hits = [];
  const erreurs = [];
  // 1) filtre direct (refusé si l'index n'a pas cet attribut filtrable) ; 2) recherche du numéro de poule, puis tri ici.
  let candidats = ["idPoule.id"];
  let attrsFiltrables = [];
  const essaiFiltre = async (champ) => {
    for (const val of ['"' + idPoule + '"', idPoule]) {
      try { const h = await lire({ q: "", filter: champ + " = " + val, limit: 1000 }); if (h.length) return h; }
      catch (e) {
        const m = String(e.message);
        const i = m.indexOf("Available");
        erreurs.push("filtre " + champ + ": " + (i >= 0 ? m.slice(i, i + 220) : m.slice(0, 150)));
        // Le message de Meilisearch donne la liste des attributs filtrables : on retient ceux qui parlent de poule.
        const noms = (m.slice(i >= 0 ? i : 0).match(/`([^`]+)`/g) || []).map((x) => x.replace(/`/g, ""));
        if (noms.length > attrsFiltrables.length) attrsFiltrables = noms;
        noms.filter((n) => /poule/i.test(n) && candidats.indexOf(n) < 0).forEach((n) => candidats.push(n));
        break;
      }
    }
    return [];
  };
  for (let k = 0; k < candidats.length && k < 6 && !hits.length; k++) hits = await essaiFiltre(candidats[k]);
  // 2) Aucun filtre « poule » possible : on part d'un match connu de l'équipe (recherche par numéro), on lit sa compétition
  // par un des attributs filtrables, puis on ne garde ici que les matchs de la poule.
  // (Les numéros de match de l'export FBI ne sont pas uniques : on retrouve le match par les deux équipes.)
  if (!hits.length && attrsFiltrables.length && (numeros || []).length) {
    try {
      let modele = null, diag = "";
      for (const r of numeros.slice(0, 8)) {
        // Plusieurs recherches (les deux équipes, puis chacune) : l'index peut écrire un nom autrement que l'export FBI.
        let h = [];
        for (const qq of [r.e1 + " " + r.e2, r.e1, r.e2]) {
          const part = await lire({ q: qq, limit: 100 });
          h = h.concat(part);
          if (!diag) diag = r.e1 + " / " + r.e2 + ": " + part.length + " résultats" + (part[0] ? ", 1er=" + part[0].nomEquipe1 + " vs " + part[0].nomEquipe2 + " idPoule=" + String(JSON.stringify(part[0].idPoule)).slice(0, 50) : "");
          if (part.some((x) => x.idPoule && ffbbMemeEquipe(x.nomEquipe1, r.e1) && ffbbMemeEquipe(x.nomEquipe2, r.e2) || x.idPoule && ffbbMemeEquipe(x.nomEquipe1, r.e2) && ffbbMemeEquipe(x.nomEquipe2, r.e1))) break;
        }
        // L'identifiant de poule de l'export FBI peut différer de celui de l'index : on se fie au match des deux équipes.
        const ok = h.filter((x) => x.idPoule && ((ffbbMemeEquipe(x.nomEquipe1, r.e1) && ffbbMemeEquipe(x.nomEquipe2, r.e2)) || (ffbbMemeEquipe(x.nomEquipe1, r.e2) && ffbbMemeEquipe(x.nomEquipe2, r.e1))));
        ok.sort((x, y) => String(y.date_rencontre || "").localeCompare(String(x.date_rencontre || "")));
        // On préfère les matchs où le numéro d'équipe (« - 1 ») est identique des deux côtés.
        const brut = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const stricts = ok.filter((x) => (brut(x.nomEquipe1) === brut(r.e1) && brut(x.nomEquipe2) === brut(r.e2)) || (brut(x.nomEquipe1) === brut(r.e2) && brut(x.nomEquipe2) === brut(r.e1)));
        const choix = stricts.length ? stricts : ok;
        modele = choix.filter(dePoule)[0] || choix[0] || null;
        if (modele) { const np = String(modele.idPoule.id || modele.idPoule); if (np !== idPoule) { erreurs.push("poule corrigée " + idPoule + " → " + np); idPoule = np; } break; }
      }
      if (!modele) erreurs.push("aucun match connu trouvé (" + diag + ")");
      else {
        const valeur = (o, chemin) => chemin.split(".").reduce((a, k) => (a && a[k] !== undefined ? a[k] : undefined), o);
        const ordre = attrsFiltrables.filter((a) => /^competitionId\./.test(a)).concat(attrsFiltrables.filter((a) => !/^competitionId\./.test(a) && a !== "_geo" && !/^commune\./.test(a)));
        for (const a of ordre.slice(0, 14)) {
          const v = valeur(modele, a);
          if (v === undefined || v === null || typeof v === "object") continue;
          let h;
          try { h = await lire({ q: "", filter: a + " = " + JSON.stringify(String(v)), limit: 1000 }); } catch (e) { erreurs.push(a + ": " + String(e.message).slice(0, 80)); continue; }
          const mien = h.filter(dePoule);
          if (mien.length >= 2) { hits = mien; break; }
        }
        if (!hits.length) erreurs.push("compétition: aucun attribut utilisable (" + ordre.slice(0, 14).join(",") + ")");
      }
    } catch (e) { erreurs.push("compétition: " + String(e.message).slice(0, 150)); }
  }
  if (!hits.length) {
    try { const h = await lire({ q: idPoule, limit: 1000 }); hits = h.filter(dePoule);
      if (!hits.length) erreurs.push("recherche: " + h.length + " résultats, exemple idPoule=" + String(JSON.stringify(h[0] && h[0].idPoule)).slice(0, 80)); }
    catch (e) { erreurs.push("recherche: " + String(e.message).slice(0, 150)); }
  }
  if (!hits.length) throw new Error("aucune rencontre" + (erreurs.length ? " (" + erreurs.join(" ; ") + ")" : ""));
  hits.sort((x, y) => String(x.date_rencontre || "").localeCompare(String(y.date_rencontre || "")));
  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const rencontres = hits.map((r) => {
    const a = ffbbEquipe(r.nomEquipe1), b = ffbbEquipe(r.nomEquipe2);
    const s1 = num(r.resultatEquipe1), s2 = num(r.resultatEquipe2);
    const joue = r.joue === true || (s1 !== null && s2 !== null && s1 + s2 > 0);
    return { num: String(r.numero), e1: a.nom, n1: a.num, e2: b.nom, n2: b.num,
      date: String(r.date_rencontre || "").slice(0, 10), heure: ffbbHeure(r.horaire),
      s1: joue ? s1 : null, s2: joue ? s2 : null, f1: false, f2: false };
  });
  const eq = {};
  const get = (nom, n) => (eq[nom] = eq[nom] || { nom, num: n, pts: 0, j: 0, g: 0, p: 0, f: 0, pp: 0, pc: 0, diff: 0 });
  rencontres.forEach((r) => {
    const A = get(r.e1, r.n1), B = get(r.e2, r.n2);
    if (r.s1 === null || r.s2 === null) return;
    A.j++; B.j++; A.pp += r.s1; A.pc += r.s2; B.pp += r.s2; B.pc += r.s1;
    if (r.s1 > r.s2) { A.g++; A.pts += 2; B.p++; B.pts += 1; } else if (r.s2 > r.s1) { B.g++; B.pts += 2; A.p++; A.pts += 1; }
  });
  const classement = Object.keys(eq).map((k) => { const e = eq[k]; e.diff = e.pp - e.pc; return e; })
    .sort((x, y) => y.pts - x.pts || y.diff - x.diff).map((e, i) => Object.assign({ rang: i + 1 }, e));
  const p = hits[0].idPoule;
  return { nom: (p && p.nom) || "", rencontres, classement };
}
async function ffbbLirePouleDirectus(pouleId) {
  const tk = await ffbbTokens();
  const h = { authorization: "Bearer " + tk.dh, "user-agent": FFBB_UA };
  const q = new URLSearchParams();
  ["id", "nom", "classements.id", "classements.position", "classements.points", "classements.matchJoues", "classements.gagnes",
    "classements.perdus", "classements.nombreForfaits", "classements.paniersMarques", "classements.paniersEncaisses",
    "classements.difference", "classements.horsClassement", "classements.organisme_nom"].forEach((f) => q.append("fields[]", f));
  q.set("deep[classements][_limit]", "1000");
  const j = await ffbbApi("items/ffbbserver_poules/" + encodeURIComponent(pouleId) + "?" + q.toString(), { headers: h });
  const d = (j && j.data) || j;
  if (!d) throw new Error("poule introuvable");
  const qr = new URLSearchParams();
  ["numero", "nomEquipe1", "nomEquipe2", "resultatEquipe1", "resultatEquipe2", "joue", "date_rencontre", "horaire",
    "forfaitEquipe1", "forfaitEquipe2"].forEach((f) => qr.append("fields[]", f));
  qr.set("filter", JSON.stringify({ idPoule: { _eq: String(pouleId) } }));
  qr.set("limit", "1000");
  qr.set("sort[]", "date_rencontre");
  const jr = await ffbbApi("items/ffbbserver_rencontres?" + qr.toString(), { headers: h });
  const lignes = (jr && jr.data) || [];
  if (!Array.isArray(lignes) || !lignes.length) throw new Error("aucune rencontre pour cette poule");
  const rencontres = lignes.map((r) => {
    const a = ffbbEquipe(r.nomEquipe1), b = ffbbEquipe(r.nomEquipe2);
    const joue = r.joue === true || (r.resultatEquipe1 != null && r.resultatEquipe2 != null && (r.resultatEquipe1 + r.resultatEquipe2) > 0);
    return {
      num: String(r.numero), e1: a.nom, n1: a.num, e2: b.nom, n2: b.num,
      date: String(r.date_rencontre || "").slice(0, 10), heure: ffbbHeure(r.horaire),
      s1: joue ? r.resultatEquipe1 : null, s2: joue ? r.resultatEquipe2 : null,
      f1: !!r.forfaitEquipe1, f2: !!r.forfaitEquipe2
    };
  });
  const classement = (d.classements || []).filter((c) => !c.horsClassement).map((c) => {
    const e = ffbbEquipe(c.organisme_nom);
    return { rang: c.position, nom: e.nom, num: e.num, pts: c.points, j: c.matchJoues, g: c.gagnes, p: c.perdus,
      f: c.nombreForfaits || 0, pp: c.paniersMarques, pc: c.paniersEncaisses, diff: c.difference };
  }).sort((x, y) => (x.rang || 99) - (y.rang || 99));
  return { nom: d.nom || "", rencontres, classement };
}
// Applique la poule FFBB à un championnat : met à jour scores/dates des rencontres connues
// (par numéro), garde les autres. Renvoie {champ, changements:[texte]}.
function ffbbAppliquer(champ, poule) {
  const anc = champ.rencontres || [];
  const parNum = {};
  poule.rencontres.forEach((r) => { parNum[r.num] = r; });
  const vus = {};
  const out = anc.map((m) => {
    const n = parNum[String(m.num)];
    if (!n) return m;
    vus[String(m.num)] = 1;
    return Object.assign({}, m, {
      date: n.date || m.date, heure: n.heure || m.heure,
      s1: n.s1, s2: n.s2, f1: n.f1, f2: n.f2
    });
  });
  poule.rencontres.forEach((n) => {
    if (vus[n.num]) return;
    out.push(Object.assign({ key: champ.division + "|" + n.num, division: champ.division, salle: "", emarque: "" }, n));
  });
  const nous = champ.nous || {};
  const rangDe = (cl) => { const t = (cl || []).find((x) => x.nom === nous.nom && (nous.num == null || x.num === nous.num)); return t ? t.rang : null; };
  const changements = [];
  const r0 = rangDe(champ.classementFfbb), r1 = rangDe(poule.classement);
  let rang = null;   // pour la notification, rédigée dans la langue de chaque appareil
  if (r1 && r0 && r1 !== r0) { changements.push(`Classement : ${r0}${r0 === 1 ? "er" : "e"} → ${r1}${r1 === 1 ? "er" : "e"} (${champ.division})`); rang = { avant: r0, apres: r1, division: champ.division }; }
  else if (r1 && !r0 && champ.ffbb && champ.ffbb.maj) { changements.push(`Classement : ${r1}${r1 === 1 ? "er" : "e"} (${champ.division})`); rang = { avant: null, apres: r1, division: champ.division }; }
  const joues = (arr) => (arr || []).filter((m) => m.s1 != null && m.s2 != null).length;
  if (joues(out) > joues(anc)) changements.push(`Nouveaux résultats dans la poule (${champ.division})`);
  return {
    champ: Object.assign({}, champ, { rencontres: out, classementFfbb: poule.classement, pouleNom: poule.nom, maj: Date.now() }),
    changements, rang
  };
}
// Notification à tout le club ; fabrique(langue) → {title, body}.
async function ffbbPush(clubId, fabrique) {
  const subs = await db.collection("clubs").doc(clubId).collection("push_subscriptions").get();
  const entrees = [];
  subs.forEach((s) => { const d = s.data() || {}; if (d.token) entrees.push({ token: d.token, ref: s.ref, langue: d.langue }); });
  if (!entrees.length) return;
  await envoyerParLangue(clubId, entrees, fabrique, { url: "./" });
}
// « Classement : 3e → 2e (U15 M Régionale) » dans la langue de l'appareil.
function texteRang(x, l) {
  const r = (n) => rangLangue(n, l);
  return `${tn(l, "Classement")}${l === "fr" ? " :" : ":"} ${x.avant ? r(x.avant) + " → " : ""}${r(x.apres)} (${x.division})`;
}
// Matchs de NOTRE équipe dont la date/heure a changé ou dont le score vient d'arriver.
function ffbbDiffNous(anc, nouv, nous) {
  if (!nous || !nous.nom) return [];
  const estNous = (m) => {
    const a = m.e1 === nous.nom && (nous.num == null || m.n1 === nous.num);
    const b = m.e2 === nous.nom && (nous.num == null || m.n2 === nous.num);
    return a ? 1 : (b ? 2 : 0);
  };
  const avant = {};
  (anc || []).forEach((m) => { avant[String(m.num)] = m; });
  const out = [];
  (nouv || []).forEach((m) => {
    const cote = estNous(m); if (!cote) return;
    const a = avant[String(m.num)]; if (!a) return;
    const dom = cote === 1, adv = dom ? m.e2 : m.e1;
    if (m.date && a.date && (m.date !== a.date || (m.heure || "") !== (a.heure || ""))) {
      out.push({ type: "deplace", num: String(m.num), adv, dom, date: m.date, heure: m.heure || "" });
    }
    const joueAvant = a.s1 != null && a.s2 != null, joue = m.s1 != null && m.s2 != null;
    if ((joue && !joueAvant) || (!a.f1 && !a.f2 && (m.f1 || m.f2))) {
      const nousS = dom ? m.s1 : m.s2, euxS = dom ? m.s2 : m.s1;
      const forfaitNous = dom ? m.f1 : m.f2, forfaitEux = dom ? m.f2 : m.f1;
      out.push({ type: "resultat", num: String(m.num), adv, dom, nous: nousS, eux: euxS, forfaitNous: !!forfaitNous, forfaitEux: !!forfaitEux });
    }
  });
  return out;
}
const dateFr = (d) => String(d || "").split("-").reverse().join("/");
function texteResultat(x) {
  if (x.forfaitNous && !x.forfaitEux) return `Défaite par forfait contre ${x.adv}`;
  if (x.forfaitEux && !x.forfaitNous) return `Victoire par forfait contre ${x.adv}`;
  if (x.nous == null || x.eux == null) return `Match contre ${x.adv} : forfait`;
  const quoi = x.nous > x.eux ? "Victoire" : (x.nous < x.eux ? "Défaite" : "Match nul");
  return `${quoi} ${x.nous}-${x.eux} ${x.dom ? "contre" : "à"} ${x.adv}`;
}
// Message dans le canal de l'équipe → la Function onChannelMessage notifie les familles.
async function ffbbAlertesEquipe(clubId, champ, diffs) {
  if (!diffs.length || !champ.equipe) return;
  const clubRef = db.collection("clubs").doc(clubId);
  const teams = await clubRef.collection("teams").where("name", "==", champ.equipe).limit(1).get();
  if (teams.empty) return;
  const canal = clubRef.collection("channels").doc(teams.docs[0].id);
  if (!(await canal.get()).exists) return;    // canal supprimé volontairement : on ne le recrée pas
  const club = (await clubRef.get()).data() || {};
  for (const x of diffs) {
    const evSnap = await clubRef.collection("events").doc("champ-" + champ.id + "-" + x.num).get();
    const ev = evSnap.exists ? evSnap.data() : null;
    let texte = "";
    if (x.type === "deplace") {
      // Date/heure retouchées dans GM : le planning ne suit pas la FFBB, on ne prévient pas.
      if (ev && ev.fbi && ((ev.date || "") !== (ev.fbi.date || "") || (ev.heure || "") !== (ev.fbi.heure || ""))) continue;
      texte = `Match déplacé (FFBB)\n${champ.equipe} ${x.dom ? "contre" : "à"} ${x.adv} : nouveau rendez-vous le ${dateFr(x.date)}${x.heure ? " à " + x.heure : ""}`;
    } else {
      if (ev && ev.score && ev.score.asmb === x.nous && ev.score.adv === x.eux) continue;   // déjà saisi dans GM
      texte = `Résultat\n${champ.equipe} : ${texteResultat(x)}`;
    }
    await canal.collection("messages").add({
      text: texte, pseudo: club.name || "Club", ts: admin.firestore.FieldValue.serverTimestamp(), likeUsers: [], heartUsers: []
    });
  }
}
async function ffbbSyncChamp(clubId, ref, champ, notifier) {
  const poule = await ffbbLirePoule(champ.ffbb.pouleId, (champ.rencontres || []).filter((r) => r && r.e1 && r.e2).slice(0, 40).map((r) => ({ e1: r.e1, e2: r.e2, date: r.date || "" })));
  const r = ffbbAppliquer(champ, poule);
  r.champ.ffbb = Object.assign({}, champ.ffbb, { maj: Date.now(), erreur: "" });
  await ref.set(JSON.parse(JSON.stringify(r.champ)));
  if (notifier) {
    try { await ffbbAlertesEquipe(clubId, r.champ, ffbbDiffNous(champ.rencontres, r.champ.rencontres, champ.nous)); } catch (e) { /* l'alerte ne bloque jamais la synchro */ }
    // Seul le classement est notifié : les résultats partent déjà dans le canal de l'équipe.
    if (r.rang) { const x = r.rang; await ffbbPush(clubId, (l) => ({ title: tn(l, "Championnat"), body: texteRang(x, l) })); }
  }
  return r.changements;
}

// Demande du dirigeant/coach (écran Championnats) : action "trouver" (cherche la poule
// d'après des numéros de match) ou "actualiser" (relit la poule d'un championnat).
exports.onFfbbDemande = onDocumentCreated("clubs/{clubId}/ffbb_demandes/{id}", async (event) => {
  const ref = event.data && event.data.ref;
  const d = event.data && event.data.data();
  if (!ref || !d) return;
  const clubId = event.params.clubId;
  try {
    if (d.action === "trouver") {
      const poules = await ffbbTrouverPoule((d.numeros || []).map(String));
      await ref.update({ ok: true, poules });
    } else if (d.action === "actualiser") {
      const cref = db.collection("clubs").doc(clubId).collection("championnats").doc(String(d.champId));
      const snap = await cref.get();
      const champ = snap.exists && snap.data();
      if (!champ) throw new Error("championnat introuvable");
      if (d.pouleId) champ.ffbb = Object.assign({}, champ.ffbb, { pouleId: String(d.pouleId) });
      if (!champ.ffbb || !champ.ffbb.pouleId) throw new Error("championnat pas encore lié à la FFBB");
      const ch = await ffbbSyncChamp(clubId, cref, champ, true);
      await ref.update({ ok: true, changements: ch });
    } else {
      await ref.update({ ok: false, erreur: "action inconnue" });
    }
  } catch (e) {
    await ref.update({ ok: false, erreur: String((e && e.message) || e).slice(0, 600) });
  }
});

// Chaque nuit : relit les poules liées (sauf les clubs suspendus / hors saison, on ne filtre pas ici).
exports.ffbbSyncNuit = onSchedule({ schedule: "every day 05:15", timeoutSeconds: 540 }, async () => {
  const clubs = await db.collection("clubs").get();
  let tentes = 0, echecs = 0, derniere = "";
  for (const club of clubs.docs) {
    const champs = await club.ref.collection("championnats").get();
    for (const c of champs.docs) {
      const champ = c.data();
      if (!champ.ffbb || !champ.ffbb.pouleId) continue;
      tentes++;
      try { await ffbbSyncChamp(club.id, c.ref, champ, true); }
      catch (e) {
        echecs++; derniere = String((e && e.message) || e).slice(0, 600);
        await c.ref.update({ "ffbb.erreur": derniere });
      }
    }
  }
  if (!tentes) return;
  // Alerte Plateforme : tout a échoué 3 nuits de suite → la synchro est probablement cassée.
  const etatRef = db.collection("plateforme_config").doc("ffbb_etat");
  const etat = (await etatRef.get()).data() || {};
  const toutKo = echecs === tentes;
  const n = toutKo ? (etat.echecs || 0) + 1 : 0;
  await etatRef.set({ echecs: n, erreur: toutKo ? derniere : "", maj: Date.now() });
  if (n === 3) {
    const snap = await db.collection("plateforme_push").doc(SUPER_ADMIN_UID).get();
    const token = snap.exists && snap.data() && snap.data().token;
    if (token) {
      try {
        await admin.messaging().send({
          token, notification: { title: "Synchro FFBB en panne", body: "3 nuits sans réponse (" + derniere + "). L'API a peut-être changé." },
          data: { url: "./" }, webpush: webpushClub(null)
        });
      } catch (e) { /* jeton périmé : le bandeau Plateforme reste */ }
    }
  }
});

/* ===== Notifications « on vous a donné un rôle / un accès / un poste » ===== */
const NOTIF_ROLES = { dirigeant: "Dirigeant", coach: "Coach", parent: "Parent", joueur: "Joueur", bureau: "Bureau" };
const NOTIF_TITRES = { tresorier: "Trésorier", secretaire: "Secrétaire", bureau: "Membre du bureau" };
const NOTIF_MODULES = {
  invitations: "Accès & invitations", parametres: "Paramètres", communaute: "Communauté", licences: "Licences",
  inscriptions: "Inscriptions", equipes: "Équipes", planning: "Planning", documents: "Documents", acces: "Accès coach",
  avis: "Avis & suggestions", fiches: "Fiches reçues", comptabilite: "Comptabilité", sponsors: "Sponsors & Partenaires",
  notesfrais: "Notes de frais", inventaire: "Inventaire"
};
// Envoie une notification à un compte du club (rien si pas d'abonnement push).
// fabrique(langue) → {titre, corps} ; langue de l'appareil, sinon celle du compte (langueCompte).
async function notifierCompte(clubId, uid, fabrique, langueCompte) {
  const ref = db.collection("clubs").doc(clubId).collection("push_subscriptions").doc(uid);
  const snap = await ref.get();
  const token = snap.exists && snap.data() && snap.data().token;
  if (!token) return;
  const { titre, corps } = fabrique(notifLangue(snap.data().langue || langueCompte));
  try {
    await admin.messaging().send({
      token, notification: { title: titre, body: corps }, data: { url: "./" },
      webpush: webpushClub(clubId, { headers: { Urgency: "high" } })
    });
  } catch (e) {
    const c = e && e.code;
    if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token") await ref.delete();
  }
}
// Phrases de la notification « Votre rôle a changé », par langue.
const NOTIF_ROLE_TPL = {
  fr: { role: "rôle", profil: "profil", attribue: (l) => `Le club vous a attribué le ${l}.`, acces: (l) => `Nouvel accès : ${l}.` },
  en: { role: "role", profil: "profile", attribue: (l) => `The club has given you: ${l}.`, acces: (l) => `New access: ${l}.` },
  ar: { role: "دور", profil: "صفة", attribue: (l) => `منحك النادي: ${l}.`, acces: (l) => `وصول جديد: ${l}.` },
  es: { role: "función", profil: "perfil", attribue: (l) => `El club te ha asignado: ${l}.`, acces: (l) => `Nuevo acceso: ${l}.` },
  it: { role: "ruolo", profil: "profilo", attribue: (l) => `Il club ti ha assegnato: ${l}.`, acces: (l) => `Nuovo accesso: ${l}.` },
  de: { role: "Rolle", profil: "Profil", attribue: (l) => `Der Verein hat Ihnen zugewiesen: ${l}.`, acces: (l) => `Neuer Zugang: ${l}.` }
};
// Phrase de la notification « Vous êtes bénévole » (poste, jour JJ/MM, heure, événement).
const NOTIF_BENEVOLE_TPL = {
  fr: (p, j, h, t) => `Poste « ${p} »${j ? " le " + j : ""}${h ? " à " + h : ""} : ${t}.`,
  en: (p, j, h, t) => `Post “${p}”${j ? " on " + j : ""}${h ? " at " + h : ""}: ${t}.`,
  ar: (p, j, h, t) => `منصب «${p}»${j ? " يوم " + j : ""}${h ? " على الساعة " + h : ""}: ${t}.`,
  es: (p, j, h, t) => `Puesto «${p}»${j ? " el " + j : ""}${h ? " a las " + h : ""}: ${t}.`,
  it: (p, j, h, t) => `Postazione «${p}»${j ? " il " + j : ""}${h ? " alle " + h : ""}: ${t}.`,
  de: (p, j, h, t) => `Posten „${p}“${j ? " am " + j : ""}${h ? " um " + h : ""}: ${t}.`
};

// Le dirigeant change le rôle, le profil du bureau ou les accès d'une personne du club.
// (Un compte qui vient d'être créé ou rattaché au club n'a pas d'« avant » : pas de notification.)
exports.onRoleAttribue = onDocumentUpdated("users/{uid}", async (event) => {
  const avant = event.data && event.data.before.data();
  const apres = event.data && event.data.after.data();
  if (!avant || !apres || !avant.clubId || avant.clubId !== apres.clubId) return;
  const rolesAvant = avant.roles || [], rolesApres = apres.roles || [];
  const nouveauxRoles = rolesApres.filter((r) => !rolesAvant.includes(r) && NOTIF_ROLES[r]).map((r) => NOTIF_ROLES[r]);
  const titre = (apres.titre && apres.titre !== avant.titre && NOTIF_TITRES[apres.titre]) ? NOTIF_TITRES[apres.titre] : "";
  const pAvant = avant.permissions || {}, pApres = apres.permissions || {};
  const modules = Object.keys(pApres).filter((k) => pApres[k] === true && pAvant[k] !== true && NOTIF_MODULES[k]).map((k) => NOTIF_MODULES[k]);
  if (!nouveauxRoles.length && !titre && !modules.length) return;
  const fabrique = (l) => {
    const t = NOTIF_ROLE_TPL[l] || NOTIF_ROLE_TPL.fr;
    const lignes = [];
    if (nouveauxRoles.length) lignes.push(t.role + " " + listeLangue(nouveauxRoles.map((r) => tn(l, r)), l));
    if (titre) lignes.push(t.profil + " " + tn(l, titre));
    let corps = "";
    if (lignes.length) corps += t.attribue(listeLangue(lignes, l)) + " ";
    if (modules.length) corps += t.acces(listeLangue(modules.map((m) => tn(l, m)), l));
    return { titre: tn(l, "Votre rôle a changé"), corps: corps.trim() };
  };
  await notifierCompte(apres.clubId, event.params.uid, fabrique, apres.langue);
});

// Un bénévole avec compte est placé sur un poste d'un événement.
exports.onBenevolePlace = onDocumentUpdated("clubs/{clubId}/events/{eventId}", async (event) => {
  const avant = event.data && event.data.before.data();
  const apres = event.data && event.data.after.data();
  if (!avant || !apres || apres.cancelled) return;
  const dejaIds = new Set((avant.benevoles || []).map((m) => m.id));
  const nouveaux = (apres.benevoles || []).filter((m) => m.uid && !dejaIds.has(m.id));
  for (const m of nouveaux) {
    const jour = String(m.jour || apres.date || "");
    const jourFr = jour ? jour.split("-").reverse().join("/") : "";
    await notifierCompte(event.params.clubId, m.uid, (l) => ({
      titre: tn(l, "Vous êtes bénévole"),
      corps: (NOTIF_BENEVOLE_TPL[l] || NOTIF_BENEVOLE_TPL.fr)(m.poste || tn(l, "bénévole"), jourFr, m.heure || "", apres.titre || tn(l, "événement du club"))
    }));
  }
});

// ── Dossiers des participants aux événements : fiche santé effacée 10 jours après ──
// purgeLe (AAAA-MM-JJ) est posé à l'inscription depuis la page publique (fin de l'événement + 10 jours).
// On efface la fiche santé seulement ; le reste du dossier (documents acceptés, signature) est gardé.
exports.dossiersPurge = onSchedule({ schedule: "every day 04:40", timeZone: "Europe/Paris", timeoutSeconds: 300 }, async () => {
  const auj = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" }); // AAAA-MM-JJ
  const clubs = await db.collection("clubs").get();
  let n = 0;
  for (const club of clubs.docs) {
    const q = await club.ref.collection("evt_dossiers").where("purgeLe", "<=", auj).get();
    let batch = db.batch(), k = 0;
    for (const d of q.docs) {
      if (!d.get("sante")) continue;
      batch.update(d.ref, { sante: admin.firestore.FieldValue.delete(), santePurgee: true });
      k++; n++;
      if (k >= 400) { await batch.commit(); batch = db.batch(); k = 0; }
    }
    if (k) await batch.commit();
  }
  console.log("dossiersPurge : fiches santé effacées", n);
});
