# App Check — mise en place (anti-bot / anti-brute-force)

Protège Firestore contre les scripts qui n'exécutent pas l'appli réelle :
brute-force des codes buvette/invitation/inscription, spam du formulaire
d'inscription public, spam de Communauté (donc du coût Cloud Functions).
Gratuit (plan Spark comme Blaze), basé sur reCAPTCHA v3.

Le code est déjà en place dans `js/firebase-init.js` et `buvette/index.html`,
mais désactivé tant que la clé n'est pas configurée. 3 étapes restent à faire
côté console, dans l'ordre :

## 1. Créer la clé reCAPTCHA v3 et l'enregistrer dans App Check

1. [Firebase Console](https://console.firebase.google.com/) > projet `asmb-app`
   > **App Check** (dans le menu Build).
2. Onglet **Apps** > sélectionner l'appli web (celle utilisée par
   `generalmanagerapp.fr`) > **Enregistrer**.
3. Choisir le fournisseur **reCAPTCHA v3**. La console propose de créer la clé
   directement (sinon : [console reCAPTCHA](https://www.google.com/recaptcha/admin),
   créer une clé v3, domaines `generalmanagerapp.fr` + `localhost` pour tester).
4. Copier la clé de site obtenue.

## 2. Coller la clé dans le code

Remplacer `"REMPLACER_PAR_LA_CLE_RECAPTCHA_V3"` par la clé, dans **2 fichiers** :
- `js/firebase-init.js`
- `buvette/index.html`

Puis commit + push (la clé de site reCAPTCHA v3 est publique par nature,
comme l'`apiKey` Firebase — pas un secret à cacher).

## 3. Activer l'enforcement — en 2 temps, pas en une fois

**Ne pas activer "Enforced" tout de suite.** Juste après le déploiement du
code ci-dessus :

1. Dans App Check > Firestore (et Storage si besoin), laisser en mode
   **Monitor** quelques jours.
2. Dans App Check > onglet **Requests metrics**, vérifier que la quasi-totalité
   du trafic apparaît comme "Verified" (vient bien de l'appli). Un reste de
   trafic non vérifié dans les premiers jours est normal (anciens onglets
   ouverts, cache navigateur pas encore à jour).
3. Une fois rassuré, repasser Firestore (et Storage) en **Enforced**.

Passer direct en Enforced sans la phase Monitor casserait l'accès à tout
utilisateur dont le cache n'a pas encore la nouvelle version de l'appli.

## Limites à connaître

- Ça ne protège **que** les appels Firestore faits avec la clé/app configurée
  (donc GM + la caisse buvette, une fois les 2 clés en place). Un appel direct
  à l'API Firestore REST avec juste l'`apiKey` reste bloqué par les règles
  Firestore comme avant — App Check est une couche en plus, pas un remplacement.
- Les Cloud Functions déclenchées par Firestore (`onChannelMessage`) ne sont
  pas protégées directement par App Check : elles profitent de la protection
  indirectement, puisqu'un message ne peut être créé sans passer l'App Check
  côté Firestore.
