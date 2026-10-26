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
   Adapter/ajouter le test dans `tests/rules/regles.test.js` ; GitHub les relance au push
   (workflow « Tests automatiques », résultat lisible via l'API check-runs/annotations).
   La fiche `clubs/{clubId}` est en liste blanche pour le dirigeant : tout nouveau champ
   qu'il doit pouvoir modifier y est ajouté.
   Règles métier (packs, licences, accès limité) : `tests/metier/` (`cd tests && npm run test:metier`),
   à compléter quand on touche à ces règles.
3. Après toute modif d'`index.html` : nombre de `<div` = nombre de `</div>`.
4. JSON valides : `changelog.json` et `version.json`.

## Traductions (à chaque mise à jour)

L'appli est traduite en anglais, arabe (droite à gauche), espagnol, italien, allemand
(`js/00-i18n.js`, dictionnaires `i18n/<langue>.json`, mode d'emploi `i18n/LISEZMOI.md`).
**Tout texte ajouté ou modifié dans le périmètre (`i18n/perimetre.json`) doit être traduit
dans les 5 langues avant le push** : `node outils/i18n.js manquants` → traduire →
`node outils/i18n.js fusionner lot.json` → `manquants` doit répondre 0
(le test `tests/metier/i18n.test.js` échoue sinon). Ce que les gens écrivent n'est jamais
traduit (`data-notr`, messages). Les dates « fr-FR » en toutes lettres suivent la langue ;
les formats chiffrés restent français (données enregistrées).
Pages publiques (tournoi, buvette, bénévole) : `window.GM_I18N_BASE="../"` puis `../js/00-i18n.js`.
Notifications push : l'appareil enregistre sa langue dans `push_subscriptions/{uid}.langue`
(js/22-push.js) ; `functions/index.js` traduit les textes fixes (`NOTIF_TXT`, `tn()`,
`envoyerParLangue()`), jamais ce que les gens écrivent. Alertes Plateforme : en français.
PDF : restent en français pour l'instant (décision du 25/10/2026 : clubs en France ; à traduire
si l'appli part à l'étranger, sauf documents officiels ; l'arabe demandera une police dédiée).
Contenu pédagogique (js/02*-formation-*, 04-formation-ui, 05*-anim-*, ~450 Ko) : reste en français tant qu'aucun club/coach non francophone n'en a besoin (décision du 25/10/2026) ; à traduire en 6-8 lots si le besoin arrive, vocabulaire basket à faire relire par un coach.

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

Profils du bureau (`BUREAU_TITRES`, js/11-admin.js) : Trésorier et Secrétaire (un seul par club), Membre du bureau (plusieurs). Attribués par le dirigeant seul (`users/{uid}.titre`) ; ils pré-cochent des accès de départ tirés de la grille « Qui fait quoi », l'accès réel reste celui des cases. Seuls comptabilité, inventaire et sponsors ont une barrière côté règles ; les autres cases pilotent l'affichage.

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
- Packs (`clubs/{id}.plan`, écrit par le super admin seul) : `standard` / `premium` ; `trial` = tout ouvert pendant 30 j puis Premium verrouillé ; `paid` (ancien) et club d'origine = tout ouvert. Helper `hasPremium()` (js/11-admin.js). Premium : compta complète (+ CERFA, bilan PDF, exports, lien buvette/inventaire→compta), factures sponsors, formations animées, et pour les événements (`evtPrem()`, js/14b) : jour J du tournoi (table de marque, scores en direct, grand écran, absences ; `trnJourJPremium`), HelloAsso + suivi « payé » (donc écriture compta), plus de 2 tarifs, jours au choix, participants dans le bilan de saison. Standard garde : créer l'événement, affiche, inscriptions/réservations avec billet QR, entrée, bénévoles, équipes/poules/planning et page /tournoi. Compta verrouillée = données conservées + archive PDF toujours téléchargeable (lignes saisies avant le verrou) ; les écritures automatiques (licences, notes de frais, buvette, stock) continuent en arrière-plan avec `horsPremium:true` et apparaissent au passage en Premium. Standard : 300 licences/saison max (`verifierLimiteLicences()` + verrou dans `saveLicences`). Offre gratuite (`plan:"gratuit"`, petits clubs) : contenu Standard, 60 licences/saison max (`limiteLicencesClub()`), au-delà passage au Standard 200 € ; Premium proposé à 200 € à ces clubs (`prixPremium()`).
- Accès limité (`plan:"limite"` + `modulesLimites`, écrits par le super admin ; aussi un essai expiré) : `isLimite()`, `limiteOuvert(clé)`, `adminModuleOuvertLimite(id)` (js/11-admin.js). Consultation seule, sauf licences (saisie/modif/suppression, + `players`/`roster` mis à jour par la validation) : `fsWriteCollection` refuse toute écriture hors `GM_LIMITE_ECRITURE`. « Exporter mes données » toujours ouvert. Sans « familles », parents/coachs voient `showClubLimiteFamilles()`. Buvette bloquée côté règles (`buvetteOuverte`) sauf module gardé. Fin d'essai = accès limité, plus de suspension automatique.
- Facturation de la plateforme : manuelle (RIB) pour l'instant, Stripe plus tard.
- Abonnement géré par le dirigeant (Paramètres › Abonnement, `js/08b-abonnement.js`) : il gèle (1 à 3 mois, = accès limité, échéance repoussée de la durée réelle du gel), relance ou résilie (effet à l'échéance) **seul**, sans validation du super admin, avec double confirmation (dialogue + mot à taper). Le super admin est seulement prévenu (bandeau Plateforme, push plus tard).
- Version Indépendant (micro-entreprise, `js/24-independant.js`) : appli **à part** de la version club (demande différente), qui remplace le groupe WhatsApp de l'indépendant. Créée par le super admin (Plateforme › « + Créer un indépendant », `clubs/{id}.type:"independant"`). Clients adultes **et mineurs** (le compte est toujours celui d'un adulte ; un enfant n'a pas de compte, son parent l'inscrit avec autorisation parentale et réserve pour lui : fiche `indep_clients/e_xxx`), habitués + inscriptions à la séance, accès client par lien réutilisable (`?rejoindre=`) avec e-mail/mot de passe. À venir : messages de groupe/privés, argent (séance, pass, reçus, livre des recettes), tarif décidé le 15/10/2026 : Standard 15 €/mois ou 150 €/an, Premium 20 €/mois ou 200 €/an (annuel = 2 mois offerts) ; le contenu de chaque formule reste à définir (stats perso avancées, argent = Premium).
- Aides Pass'Sport / Pass'Région (`js/06e-aides.js`) : réglage `clubs/{id}.aides` (dirigeant), recopié dans `inscription_codes/{code}.aides` pour la fiche publique. Pass'Région visible seulement si le club est partenaire, âge ~14-25 et case « lycéen/apprenti AURA » cochée ; on ne stocke jamais le code secret de la carte. L'aide est une part du paiement (`lic.aides`, compte dans `licenceMontantPaye`), statut à saisir → saisi → remboursé, ligne compta avec le n° (`horsPremium` si Standard). Alerte à 10 j et 5 j avant le 31/12/2026. Ne bloque jamais une validation.
- Fils d'événements : un seul canal « Événements » (`evenements`), un fil par événement hors matchs/entraînements = canal caché `channels/evt_<eventId>` (`evt:true`, `members`, `tels`, `depuisT{tel}`, `finT`), créé/mis à jour par `evtCanalSynchro()` (js/14-evenements.js), affiché en liste « Fils des événements » dans le canal Événements (js/16-communaute.js) et jamais dans la liste des canaux. Un participant lit de son arrivée à la fin de l'événement (23 h 59) et écrit jusqu'à la fin (règles Firestore `evtLecture`/`evtEcriture` + requête bornée côté client) ; dirigeant et coachs voient tout. Sans compte (extérieur inscrit) : page `fil/index.html` (`?e=<clubId>__<eventId>&c=<code du billet>`, lien sur le billet) qui passe uniquement par la Cloud Function `filEvenement` (jamais Firestore ; arrivée = première ouverture, `clubs/{id}/fil_acces/{code}`, serveur seul). Notifications push des extérieurs : bouton sur `fil/index.html` (SW `fil/sw.js`, guide iPhone), jeton envoyé à `filEvenement` (action `notifs`/`notifs_off`) et stocké dans `fil_acces/{code}.token` ; `notifierExternes()` (functions/index.js) les prévient à chaque message du fil jusqu'à la fin de l'événement, avec leur propre lien. Bénévoles sans compte : chaque mission du pass (`ben_pass.missions[].fil`, `eid`) a un bouton « Discussion de l'événement » → `fil/?e=<clubId>__<eventId>&p=<code du pass>` ; `filEvenement` reçoit `ben:true`, vérifie que le pass est actif, du même club, avec une mission sur cet événement (accès `fil_acces/{code}~{eventId}`) ; pseudo = prénom + initiale. Accès tant que la mission est dans le pass (retirée à la synchro qui suit le jour de l'événement). À venir : bénévole avec compte dans la Communauté (Général/Événements).
- Pass bénévole (`js/14g-benevoles.js`, page `benevole/index.html`) : un lien/QR par bénévole du carnet (`clubs/{id}/benevoles`), sans compte ; collection globale `ben_pass/{CODE}` (get public, le visiteur ne peut modifier que `reponses` oui/non, jamais de téléphone dedans). Désactivable (`actif:false`). Si on ajoute des outils au pass (entrée, table de marque, buvette), garder cette règle de champs minimale.
- Version ordinateur (`js/03b-bureau.js`, `03c-bureau-accueil.js`) : menu latéral du dirigeant (≥ 1024 px), personnalisable et repliable, 5 thèmes par appareil (`gm_desk_theme`). Un écran sans données utilise `gmVide()` (js/09) : titre, à quoi sert l'écran, bouton du premier geste. Paramètres : blocs repliables (`PARAMS_GROUPES`, js/08), le bloc « Zone dangereuse » a été supprimé (les boutons resetAllData/resetComptabilite restent dans le code), 2 colonnes sur ordinateur (`.pgrp.ouvert` = pleine largeur). `paramsOuvrirGroupe(id, section)` ouvre Paramètres sur un bloc (utilisé par « Boutique & réseaux » du menu).
- Couleur du club : par défaut couleurs GM ; le dirigeant choisit 2 couleurs sur une roue HSV (`js/08c-couleur-roue.js`, centre blanc, barre vers le noir), n'importe quelle teinte, champs `couleur`/`couleur2` sur `clubs/{clubId}`. Couleur claire (contraste < 4,5 avec le blanc) : `clubNormaliserCouleurs` garde la vraie couleur en `couleurBrute` (fond de l'en-tête et du bandeau, texte noir, classe `gm-club-clair` + `--club-fond`) et met dans `couleur` une version foncée de la même teinte (`gmEncreLisible`) pour boutons, accents et PDF ; blanc pur = graphite. Elle s'applique à tous les thèmes visuels via `clubThemeVars()` (js/03-nav-portal.js : chaque thème n'a que sa teinte de marque remplacée, jamais ses neutres) et aux PDF (`clubPdfRgb()`). Si un thème a des couleurs en dur dans `css/style.css`, les passer en variables (comme `--carnet-body`, ou le `body` de Bento via `--hdrgrad`). Un nouveau thème visuel doit être ajouté à `clubThemeVars()`. Le logo GM (marine/doré, `icon-192.png`) est réservé à la plateforme.

## Pièges connus

- Pas de `import`/`export` : tout partage la portée globale, l'ordre des `<script>` compte,
  `21-main.js` reste le dernier.
- Un nouveau fichier JS doit être ajouté dans `index.html` **et** décrit dans `js/README.md`.
- jsPDF est déjà chargé globalement (`window.jspdf.jsPDF`) ; l'export Excel charge SheetJS à la
  demande (`js/23-export.js`).
- App Check (Fraud Defense) : clé de site en place dans `js/firebase-init.js` et
  `buvette/index.html` (et `tournoi/index.html`). Firestore doit rester en mode **Monitor** quelques jours avant de passer
  en **Enforced** dans la console Firebase (voir `APP_CHECK_SETUP.md`), jamais directement.
