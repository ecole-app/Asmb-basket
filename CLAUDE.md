# General Manager (repo `asmb-basket`) — conventions du projet

PWA multi-clubs (test client : ASMB Basket). Vanilla JS sans bundler, Firebase Firestore
(projet `asmb-app`), déployée sur GitHub Pages (`generalmanagerapp.fr`).
Architecture JS et ordre de chargement : voir `js/README.md` (à lire avant d'ajouter un module).
L'utilisateur (Ahmed, dirigeant du club) écrit en français décontracté : réponses directes,
peu d'explications, et on **présente l'idée avant de coder** les fonctionnalités non triviales.

## Avant chaque push

1. `node --check` sur chaque fichier JS modifié. Pour `js/firebase-init.js` (module ES) :
   `cp js/firebase-init.js /tmp/x.mjs && node --check /tmp/x.mjs`.
2. Après toute modif de `firestore.rules` : le nombre de `{` et de `}` doit être identique
   (`python3 -c "s=open('firestore.rules').read(); print(s.count('{'), s.count('}'))"`).
3. Après toute modif d'`index.html` : nombre de `<div` = nombre de `</div>`.
4. JSON valides : `changelog.json` et `version.json`.

## Version et changelog (seulement si du code client change)

- `date +%s` → mettre la même valeur dans `js/21-main.js` (`APP_VERSION`) **et** `version.json`.
- Ajouter en tête de `changelog.json` : `{v, titre, points:[{roles:[...], texte:"..."}]}`.
- Pas de bump pour un changement de règles Firestore seul ou de doc.

## Git

Toujours de **nouveaux commits** (jamais d'amend), puis `git push origin main`.
Le push affiche « repository moved » : normal, il réussit quand même.
Messages en français, sans casser le style des commits existants.

## Sécurité et données

- **Tout texte saisi par un utilisateur** passe par `authEsc()` avant d'aller dans `innerHTML`
  ou dans un attribut (`src`, `onclick`...). Les fiches d'inscription viennent d'un formulaire public.
- Collections Firestore : le code utilise `window.fbCollection` / `window.fbDoc`, qui préfixent
  automatiquement `clubs/{clubId}/...`. Seules les collections de `GLOBAL_COLLECTIONS`
  (`js/firebase-init.js`) sont globales. Une nouvelle collection de club = une règle dans
  `firestore.rules`.
- Pattern de stockage : `getXxx()` / `saveXxx()` écrivent dans `localStorage` **et** appellent
  `fsWriteCollection(nom, tableau)` ; la synchro temps réel est enregistrée dans
  `initFirestoreSync()` (`js/13-firestore-sync.js`).
- **Seul le dirigeant** peut écrire dans le document `clubs/{clubId}`. Une donnée qu'un
  trésorier/bureau délégué doit pouvoir modifier ne doit donc pas y vivre : sous-collection
  à part avec sa propre règle (exemple : `facturation_compteur`).

## Accès délégué (comptabilité, inventaire, sponsors)

Le dirigeant peut donner l'accès à un module admin à un compte bureau/coach
(`users/{uid}.permissions.<id>=true`). Toute nouvelle fonction d'un de ces modules doit
respecter ça des deux côtés : `hasPermission(clubId,'<id>')` dans `firestore.rules` **et**
`hasModulePermission('<id>')` côté client, et la synchro live (`fsStartSync`) doit démarrer
pour ces comptes, pas seulement pour le rôle `dirigeant`.

## Décisions produit à respecter

- La validation d'une licence n'est **jamais** bloquée par le paiement. Les impayés passent par
  le suivi (montant attendu, relances manuelles SMS/email, suspension **proposée** au dirigeant
  après N relances, jamais automatique ; suspendue = non convocable + accès famille coupé).
- Pas d'envoi d'emails automatiques (pas de Resend) : `mailto:` / `sms:` pré-remplis.
- Email/newsletter : explicitement mis de côté, ne pas le proposer.
- TVA des factures : « non applicable, art. 293 B du CGI » par défaut, activable par club.
- Packs (`clubs/{id}.plan`, écrit par le super admin seul) : `standard` / `premium` ; `trial` = tout ouvert pendant 30 j puis Premium verrouillé ; `paid` (ancien) et club d'origine = tout ouvert. Helper `hasPremium()` (js/11-admin.js). Premium : compta complète (+ CERFA, bilan PDF, exports, lien buvette/inventaire→compta), factures sponsors, formations animées. Compta verrouillée = données conservées + archive PDF toujours téléchargeable. Standard : 300 licences/saison max (`verifierLimiteLicences()` + verrou dans `saveLicences`).
- Facturation de la plateforme : manuelle (RIB) pour l'instant, Stripe plus tard.
- Couleur du club : par défaut couleurs GM ; le dirigeant choisit dans une palette de 50 teintes (`CLUB_PALETTE`, contraste ≥ 4,5:1 avec le blanc), champ `couleur` sur `clubs/{clubId}`. Elle s'applique à tous les thèmes visuels via `clubThemeVars()` (js/03-nav-portal.js : chaque thème n'a que sa teinte de marque remplacée, jamais ses neutres) et aux PDF (`clubPdfRgb()`). Si un thème a des couleurs en dur dans `css/style.css`, les passer en variables (comme `--carnet-body`, ou le `body` de Bento via `--hdrgrad`). Un nouveau thème visuel doit être ajouté à `clubThemeVars()`. Le logo GM (marine/doré, `icon-192.png`) est réservé à la plateforme.

## Pièges connus

- Pas de `import`/`export` : tout partage la portée globale, l'ordre des `<script>` compte,
  `21-main.js` reste le dernier.
- Un nouveau fichier JS doit être ajouté dans `index.html` **et** décrit dans `js/README.md`.
- jsPDF est déjà chargé globalement (`window.jspdf.jsPDF`) ; l'export Excel charge SheetJS à la
  demande (`js/23-export.js`).
- App Check (Fraud Defense) : clé de site en place dans `js/firebase-init.js` et
  `buvette/index.html`. Firestore doit rester en mode **Monitor** quelques jours avant de passer
  en **Enforced** dans la console Firebase (voir `APP_CHECK_SETUP.md`), jamais directement.
