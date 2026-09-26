# Architecture JS — General Manager

## Principe

Pas de bundler, pas d'`import`/`export` : tous les fichiers sont chargés par des balises
`<script src="...">` classiques dans `index.html`. Ils partagent donc **une seule portée
globale** — une fonction définie dans `06-licences.js` est directement appelable depuis
`11-admin.js`, sans rien importer.

## L'ordre de chargement compte

Les fichiers sont numérotés et **doivent être chargés dans cet ordre**. Les déclarations de
fonctions sont remontées (hoisting) à l'intérieur d'un même fichier, mais pas entre fichiers :
si du code s'exécute au chargement (hors d'une fonction), ce qu'il appelle doit déjà être défini.

Cas concret dans ce projet : `ELITE_CATS` (dans `01-config.js`) appelle `getCurrentSeason()`
dès sa déclaration. C'est pourquoi les deux helpers de saison sont placés tout en haut de
`01-config.js`, et non dans le module licences où se trouve le reste de la gestion de saison.

**Règle pratique** : si vous ajoutez du code exécuté immédiatement (pas dans une fonction),
vérifiez que ses dépendances sont dans un fichier au numéro inférieur.

## Les modules

| Fichier | Contenu |
|---|---|
| `firebase-init.js` | Init Firebase (seul vrai module ES6, chargé avec `type="module"`) |
| `sw-register.js` | Enregistrement du service worker (hors-ligne) |
| `01-config.js` | Constantes globales : pôles, catégories, couleurs, helpers de saison |
| `02-formation-cycles.js` | Données et accesseurs des cycles du Pôle Formation |
| `03-nav-portal.js` | Navigation, routage entre écrans, portail d'accueil |
| `04-formation-ui.js` | Affichage et édition des cycles et séances |
| `05-animations.js` | Moteur d'animation canvas des situations pédagogiques |
| `06-licences.js` | Licences, codes d'inscription, fiche publique, paiement |
| `07-presences.js` | Pointage des présences, envoi groupé aux familles |
| `08-parametres.js` | Écran Paramètres et sa personnalisation |
| `09-ui-modales.js` | Modales maison : `askConfirm`, `askPrompt`, `askAlert` |
| `10-annuaire-galerie.js` | Annuaire, bénévoles, galerie photos, sauvegarde, données démo |
| `11-admin.js` | Espace Admin, accès coach, fiches reçues, notes de frais, reclassement |
| `12-equipes-planning.js` | Équipes, effectifs, planning, historique de présence |
| `13-firestore-sync.js` | Synchronisation temps réel et migration Firestore |
| `14-evenements.js` | Événements, créneaux, convocations, météo du match |
| `15-compta-inventaire.js` | Comptabilité, documents, inventaire buvette/matériel |
| `16-communaute.js` | Canaux de discussion, messages, réactions, sondages |
| `17-poles.js` | Pages génériques des pôles du club |
| `18-auth.js` | Authentification, comptes, changement d'e-mail |
| `19-profils.js` | Profils parent/coach/joueur, thèmes animés |
| `20-parent-tabs.js` | Onglets événements et statistiques côté parent |
| `20b-plateforme.js` | Espace plateforme (super admin), invitations staff, accès support |
| `21-main.js` | Thème, initialisation, **démarrage de l'app** (doit rester en dernier) |

## Points d'attention connus

- **`21-main.js` doit rester le dernier fichier** : il contient le code de démarrage
  (`buildPortal()`, `initAuthGate`, les `setInterval` de rappels…) qui suppose que
  tout le reste est déjà défini.

- **`refreshCurrentScreen()` est défini deux fois**, dans `13-firestore-sync.js` et dans
  `21-main.js`, avec deux implémentations différentes. C'est un héritage du fichier
  d'origine : comme `21` est chargé après `13`, c'est la version de `21` qui s'applique.
  Comportement inchangé par le découpage, mais à nettoyer un jour.

- **Ajouter une nouvelle collection Firestore** implique de mettre à jour les règles de
  sécurité côté Firebase, en plus du code.

- **Le service worker** (`sw.js`) précharge la liste des fichiers : si vous ajoutez un
  nouveau module JS, pensez à l'ajouter à la fois dans `index.html` et dans `PRECACHE`.

## Déploiement

Site statique servi par GitHub Pages depuis la racine du dépôt. Aucune étape de build.
Après un push, bump `version.json` (et `APP_VERSION` dans `21-main.js`) pour déclencher
la bannière de mise à jour côté utilisateurs et purger l'ancien cache.

## Multi-club

Toutes les données d'un club vivent sous `clubs/{clubId}/...` dans Firestore.

**Le cloisonnement est automatique** : `window.fbCollection` et `window.fbDoc`
(définis dans `firebase-init.js`) préfixent eux-mêmes le chemin avec le club actif
(`window.CURRENT_CLUB_ID`). Dans le code applicatif, on continue d'écrire
`fbCollection(window.fbDb, "players")` : ça cible `clubs/{clubId}/players`.
Il est donc impossible d'oublier de cloisonner un nouvel appel.

- **Collections globales** (non préfixées) : `users`, `clubs`, `phone_index`,
  `inscription_codes`. Toute autre collection est une donnée de club.
- **Sans club actif**, un accès à une donnée de club lève une erreur au lieu
  d'écrire au mauvais endroit (échec volontairement bruyant).
- **Club actif** : défini à la connexion depuis `users/{uid}.clubId`
  (`setActiveClub()` dans `18-auth.js`). Sur la page d'inscription publique
  (visiteur non connecté), il vient du code d'inscription saisi.
- **Tâches de démarrage** qui touchent des données : les lancer via
  `whenClubReady(fn)`, jamais avec un `setTimeout` direct au chargement.
- **Cache local** : quand le club change sur un appareil, toutes les clés
  `asmb_*` sont purgées sauf les préférences de l'appareil
  (`DEVICE_PREF_PREFIXES` dans `18-auth.js`). Une nouvelle préférence propre à
  l'appareil (et non au club) doit être ajoutée à cette liste.
- **Sécurité** : la vraie barrière est côté serveur, dans `firestore.rules`
  (à la racine du dépôt, à publier dans la console Firebase). Toute nouvelle
  collection doit y être ajoutée sous `match /clubs/{clubId}`.

**Limite connue** : l'index téléphone (`phone_index`) a une entrée par numéro.
Un même numéro inscrit dans deux clubs différents n'est rattaché qu'à un seul.

## Niveaux d'accès (plateforme)

1. **Super admin** (éditeur de General Manager, UID fixe dans les règles) :
   crée les clubs, invite leur dirigeant, peut suspendre un club
   (`clubs/{id}.status = "suspended"`). Espace « Plateforme » en tête de l'Espace Admin.
2. **Dirigeant** : module « Accès & invitations » — invite coachs et co-dirigeants.
3. **Membres** : coachs (invités), parents (auto-inscription via leur numéro).

**Invitations** (`club_invites/{code}`) : lien `?invite=CODE`, usage unique, 7 jours.
La création du compte et la consommation de l'invitation se font dans une seule
écriture groupée (`fbWriteBatch`) ; les règles vérifient les deux ensemble, une
invitation ne peut donc pas servir deux fois.

**Accès support** : le super admin ne voit AUCUNE donnée interne d'un club par
défaut. Le dirigeant génère un code (`support_grants/{code}`, 48 h, révocable).
Le super admin l'entre dans « Plateforme » → session `clubs/{id}/support_sessions/{uid}`
→ accès en **lecture seule**, garanti par les règles (et `window.SUPPORT_MODE`
côté app). Révoquer = supprimer le code : l'accès tombe immédiatement.
