# Notifications push — mise en route (une seule fois)

Le code est prêt (`js/22-push.js`, `sw.js`, `api/send-push.js`). Il manque
3 réglages côté comptes Vercel/Firebase, que je ne peux pas faire à ta place.

## 1. Créer le projet Vercel

1. https://vercel.com → **Add New → Project** → importer `ecole-app/asmb-basket`
   (le même repo GitHub, GitHub Pages n'est pas touché).
2. Framework preset : **Other**. Build command : laisser vide. Output
   directory : laisser vide (racine).
3. Déployer. Tu obtiens une URL du style `https://asmb-basket-xxxx.vercel.app`.

## 2. Récupérer la clé de service Firebase

1. Console Firebase → ⚙️ **Paramètres du projet** → **Comptes de service**.
2. **Générer une nouvelle clé privée** → télécharge le fichier `.json`.
3. Garde ce fichier précieusement, ne le commite JAMAIS dans le repo.

## 3. Variables d'environnement Vercel

Vercel → ton projet → **Settings → Environment Variables** → ajouter :

| Nom | Valeur |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | contenu complet du fichier `.json` de l'étape 2, collé tel quel |
| `VAPID_PUBLIC_KEY` | clé publique VAPID (donnée dans le chat — déjà dans `js/22-push.js`) |
| `VAPID_PRIVATE_KEY` | clé privée VAPID (donnée dans le chat — **jamais** dans le code) |
| `VAPID_SUBJECT` | `mailto:ton-email@exemple.fr` |
| `ALLOWED_ORIGIN` | `https://generalmanagerapp.fr` |

Puis **redeploy** (les variables ne s'appliquent qu'au déploiement suivant).

## 4. Brancher l'app sur cette API

Dans `js/22-push.js`, remplace :

```js
var GM_PUSH_API_URL = "https://REMPLACER-vercel-app.vercel.app/api/send-push";
```

par l'URL réelle du projet Vercel (étape 1) + `/api/send-push`, par exemple :

```js
var GM_PUSH_API_URL = "https://asmb-basket-xxxx.vercel.app/api/send-push";
```

Puis bump la version (`date +%s` → `version.json` + `js/21-main.js`) et
commit/push comme d'habitude.

## 5. Tester

1. Ouvre l'app sur un téléphone, connecte-toi, va dans **Paramètres →
   Notifications → Autoriser les notifications**.
2. Depuis un autre compte du même club, poste un message dans Communauté.
3. La notif doit arriver, même app fermée sur le 1er téléphone.

## Limites actuelles (v1)

- Seuls les **messages texte** déclenchent un push pour l'instant (pas les
  photos/PDF partagés, pas les sondages).
- Pas encore de notif pour les rappels match/entraînement/événement — les
  cases correspondantes dans Paramètres restent pour l'instant des
  préférences locales sans effet réel.
- Un abonnement expiré (téléphone changé, cache vidé) se nettoie tout seul
  à la prochaine tentative d'envoi ratée — rien à faire manuellement.
