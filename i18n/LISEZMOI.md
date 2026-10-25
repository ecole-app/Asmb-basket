# Traductions de l'appli

Langues : français (langue du code), anglais `en`, arabe `ar` (écran de droite à gauche),
espagnol `es`, italien `it`, allemand `de`.

## Comment ça marche
- Le texte reste écrit en français dans le code (`index.html`, `js/*.js`).
- `i18n/<langue>.json` = dictionnaire « texte français exact → traduction ».
- `js/00-i18n.js` (chargé en premier) remplace à l'affichage tout texte de l'écran qui est
  dans le dictionnaire (texte, `placeholder`, `title`, `aria-label`, `alt`), et suit tout ce
  que l'appli affiche ensuite. Les dates écrites en toutes lettres suivent la langue.
- Jamais traduit : champs de saisie, messages (`.msg-bubble`), tout ce qui porte `data-notr`
  ou `class="notr"`. Ce que les gens écrivent n'est donc pas touché.
- Langue choisie : Paramètres › Langue & apparence (dirigeant, coach), Paramètres du parent,
  sélecteur 🌐 sur l'écran de connexion et sur la fiche d'inscription. Par défaut : la langue
  du téléphone si elle est proposée, sinon le français. Enregistrée sur l'appareil
  (`gm_langue`) et sur le compte (`users/{uid}.langue`).
- Texte construit avec une variable (`"Encore "+n+" questions"`) : seuls les morceaux fixes
  sont traduits. Pour un texte important, utiliser `gmT("texte")` ou un nœud séparé.

## À chaque mise à jour (obligatoire)
1. `node outils/i18n.js manquants` → liste les textes du périmètre sans traduction
   (`i18n/_manquants.json`).
2. Traduire dans les 5 langues, puis `node outils/i18n.js fusionner lot.json`
   (format : `{"texte fr": {"en": "...", "ar": "...", "es": "...", "it": "...", "de": "..."}}`).
3. Relancer `manquants` : il doit répondre 0. Le test `tests/metier/i18n.test.js` échoue sinon.
- Un texte qui ne se traduit pas (code, nom propre) va dans `exclus` de `i18n/perimetre.json`.

## Périmètre
`i18n/perimetre.json` liste les fichiers traduits. Étape 1 (fait) : ce que voient les familles
et l'écran de connexion. Étape 2 : écrans dirigeant/coach. Étape 3 : PDF, notifications,
pages publiques (tournoi, buvette, bénévole), contenu pédagogique.
