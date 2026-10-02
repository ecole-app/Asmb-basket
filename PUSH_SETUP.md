# Notifications push — mise en route (une seule fois)

Le code est prêt (`js/22-push.js`, `sw.js`, `functions/index.js`). Tout reste
dans Firebase — pas de Vercel, pas de 2e compte à gérer. Il reste 3 étapes
que je ne peux pas faire à ta place (accès à ton compte Firebase/CLI).

## 1. Passer le projet Firebase en plan Blaze

Cloud Functions nécessite le plan **Blaze** (pay-as-you-go) au lieu du
Spark (gratuit) actuel.

1. Console Firebase → ⚙️ en bas à gauche → **Modifier le forfait** → Blaze.
2. Une carte bancaire est demandée (anti-abus Google), mais le palier
   gratuit (2M invocations/mois) couvre très largement un club : ça reste
   à 0€ dans ton usage.

## 2. Générer la clé "Web Push certificate"

1. Console Firebase → ⚙️ **Paramètres du projet** → onglet **Cloud Messaging**.
2. Section **Web configuration** → **Générer une paire de clés**.
3. Copie la clé générée (commence par `B...`).
4. Colle-la dans `js/22-push.js`, à la place de :
   ```js
   var GM_FCM_VAPID_KEY = "REMPLACER_PAR_LA_CLE_WEB_PUSH_FIREBASE";
   ```

## 3. Déployer la Cloud Function

Depuis ta machine, dans le dossier du repo :

```bash
firebase login              # une seule fois
firebase deploy --only functions
```

(`firebase.json` et `.firebaserc` sont déjà dans le repo, pointent sur le
projet `asmb-app`.)

## 4. Publier le code client

Une fois l'étape 2 faite (clé collée dans `js/22-push.js`) :

```bash
date +%s   # bump APP_VERSION dans js/21-main.js + version.json
git add -A && git commit -m "Active les notifications push" && git push
```

## 5. Tester

1. Ouvre l'app sur un téléphone, connecte-toi, va dans **Paramètres →
   Notifications → Autoriser les notifications**.
2. Depuis un autre compte du même club, poste un message dans Communauté.
3. La notif doit arriver, même app fermée sur le 1er téléphone — la Cloud
   Function se déclenche automatiquement à l'écriture du message, sans
   rien à appeler côté client.

## Limites actuelles (v1)

- Toute la logique "qui notifier" est **club-wide** : tous les abonnés du
  club reçoivent la notif (sauf l'auteur), pas de ciblage par canal pour
  l'instant.
- Pas encore de notif pour les rappels match/entraînement/événement — les
  cases correspondantes dans Paramètres restent pour l'instant des
  préférences locales sans effet réel.
- Un token expiré (téléphone changé, cache vidé) se nettoie tout seul à
  la prochaine tentative d'envoi ratée — rien à faire manuellement.
