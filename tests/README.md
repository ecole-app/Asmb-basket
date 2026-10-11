# Tests automatiques

Tout lancer : `cd tests && npm ci && npm test`.

## Règles métier (`tests/metier/`)

35 tests sur les vrais fichiers de l'appli (chargés dans Node, sans navigateur ni
Firebase) : packs (essai, Standard, Premium, accès limité), modules gardés,
limite de 300 licences, fin d'essai, échéance d'abonnement, écritures bloquées
en accès limité et en session support. `npm run test:metier` (quelques secondes).

## Règles de sécurité Firestore (`tests/rules/`)

51 tests (115 vérifications) sur `firestore.rules` : visiteur non connecté, isolation
entre clubs, rôles (dirigeant, coach, parent, bureau), club suspendu, fiche club,
super admin et accès support, comptes, invitations, caisse buvette, Communauté,
fiches d'inscription publiques.

Ils tournent sur l'**émulateur Firestore** (fausse base locale), jamais sur la vraie.

**Automatique** : GitHub relance les deux séries à chaque push qui touche `firestore.rules`,
`js/` ou `tests/` (`.github/workflows/tests.yml`). Résultat : coche verte/croix rouge sur le
commit, détail dans l'onglet Actions (annotation « Tests des règles »).

**À la main** (Node 22 + Java 21) :

```
cd tests
npm ci
npm run test:rules
```

Quand on modifie les règles : ajouter ou adapter le test correspondant dans
`rules/regles.test.js`. Un nouveau champ de la fiche club modifiable par le
dirigeant doit être ajouté à la liste blanche de `clubs/{clubId}` (sinon refusé).
