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
