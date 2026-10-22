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
| `03b-bureau.js` | Version ordinateur (≥ 1024 px) : menu latéral du dirigeant (`html.gm-desk`), rubriques reliées aux écrans existants ; menu personnalisable par appareil (ordre dans chaque groupe, rubriques masquées, `gm_desk_prefs`) et repliable en icônes (`html.gm-desk-mini`) ; messagerie sur 2 colonnes (`html.gm-chat2`, canaux à gauche de la discussion). Thèmes ordinateur (`gm_desk_theme`, `html[data-desk-theme]`, `GM_DESK_THEMES`) : ne changent que les neutres et le menu (variables `--gs-*`), la couleur du club reste l'accent (classe `html.gm-clubcolor`, `--club-dk` posés par `applyClubColor`) ; sélecteur dans Paramètres › Apparence (`gmDeskThemeBuild`). Équipes en cartes : CSS + `gmDeskOuvrirEquipes()` (js/12). |
| `03c-bureau-accueil.js` | Version ordinateur : accueil du dirigeant en tableau de bord (chiffres clés, À faire, inscriptions en cours, prochains rendez-vous, raccourcis) |
| `04-formation-ui.js` | Affichage et édition des cycles et séances |
| `05-animations.js` | Moteur d'animation canvas des situations pédagogiques |
| `06-licences.js` | Licences, codes d'inscription, fiche publique, paiement |
| `06c-essais.js` | Séances d'essai : page publique « Venir essayer » (`?essai=clubId`, `essai_pages`), demandes (`essais`), réponse SMS, inscription, vue coach |
| `06d-cheques.js` | Licences payées par chèque : 1 à 4 chèques (n°, banque, émetteur, date d'encaissement), « À déposer » → « Déposé », remise en banque avec bordereau PDF, recette en compta au dépôt ; paiement prévu choisi par la famille sur la fiche |
| `06e-aides.js` | Aides Pass'Sport / Pass'Région : champs de la fiche publique (selon `clubs/{id}.aides`, recopié dans `inscription_codes`), aide = part du paiement (`lic.aides`), ligne compta avec le n°, liste des codes à saisir, alertes 10 j / 5 j avant le 31/12 |
| `06f-import.js` | Import des licences depuis un CSV / Excel / PDF texte (pdf.js à la demande ; dont export FBI) : colonnes reconnues + corrigeables, aperçu, doublon = nom + prénom + naissance, fiches créées en « reçue » |
| `06i-activation.js` | Activation des accès famille : liste des licences dont l'accès a été envoyé (`accesEnvoyeLe`, `accesCode`) sans compte du club avec le même numéro ; rappel conseillé à 3 jours, lien expiré à 7 jours (renvoi d'une nouvelle invitation) ; bandeau sur l'accueil du dirigeant (`actBandeau`) et écran de relance par SMS pré-rempli (jamais d'envoi automatique). |
| `06j-adherent.js` | Fiche adhérent remplie par le dirigeant (« + Nouvelle fiche » › « Je remplis la fiche moi-même ») : rôle joueur / bénévole / coach / autre, statut `recue` (`fiche.creeParClub`) ; un non-joueur n'a ni catégorie ni limite de licences, un bénévole reçoit son pass (`licPassBenevole`). |
| `06g-photos.js` | Import en lot des photos (images ou ZIP, ex. FBI) : rattachement par n° de licence ou nom dans le nom du fichier, aperçu, réduction à 320 px |
| `06h-roles.js` | Rôle d'une fiche licence (joueur / coach / bénévole / autre : ni joueur, ni compté dans la limite du pack) et suppression de fiche ; `licEstJoueur()` est dans 11-admin.js. Rôle bénévole = pass bénévole créé dans le carnet (`licPassBenevole`). « Sa licence » (non-joueur seulement) : `lic.priseEnCharge` = `club` (offerte, `coutClub` → dépense compta `pec_{code}`, `horsPremium` si Standard) ou `ailleurs` (`clubAilleurs`, `numAilleurs`) : aucun reste à payer ni relance |
| `06i-trombi-pdf.js` | Lecture d'un trombinoscope PDF FBI (une carte par licencié) : texte de chaque carte + photo découpée ; alimente l'import 06f |
| `06b-reinscription.js` | Réinscription en ligne : ouverture par le club, carte et fiche pré-remplie côté parent, import auto en licence |
| `07-presences.js` | Pointage des présences, envoi groupé aux familles |
| `08-parametres.js` | Écran Paramètres et sa personnalisation |
| `08b-abonnement.js` | Paramètres › Abonnement (dirigeant) : geler 1 à 3 mois (= accès limité, `aboGelActif()` lu par `isLimite()`), relancer, résilier à l'échéance, avec double confirmation (dialogue + mot à taper). Champs `aboGels`/`aboGelFin`/`aboResiliation`/`aboNotif` sur `clubs/{id}` (liste blanche dirigeant). Côté Plateforme : bandeau des changements (`renderAboNotifs`), report de l'échéance après un gel (`aboTraiterGels`). |
| `08c-couleur-roue.js` | Couleur du club : roue libre (teinte/intensité + curseur de luminosité) en plus de la palette de 50 ; la teinte est assombrie jusqu'à un contraste >= 4,5:1 avec le blanc (`gmCouleurLisible`), `enregistrerCouleursClub` accepte donc palette ou couleur libre lisible. |
| `09-ui-modales.js` | Modales maison : `askConfirm`, `askPrompt`, `askAlert` | Aussi `gmVide({icone,titre,texte,bouton})` : écran vide explicatif (ce qu'on met dans l'écran + premier geste), utilisé par équipes, planning, joueurs, licences, compta, inventaire, sponsors.
| `09b-saisie-dates.js` | Saisie libre des dates : chaque `<input type="date">` reçoit un champ texte « JJ/MM/AAAA » (barres automatiques, collage ISO accepté) + un bouton calendrier | L'input d'origine reste la source de vérité, caché : `.value` reste « AAAA-MM-JJ » (lecture, écriture, événements input/change, min/max). Date incomplète ou inexistante = valeur vide + champ rouge. Les inputs ajoutés plus tard sont repris par un MutationObserver. Helpers : `gmDateFr2Iso`, `gmDateIso2Fr`. |
| `10-annuaire-galerie.js` | Annuaire, bénévoles, galerie photos, sauvegarde, données démo |
| `11-admin.js` | Espace Admin, accès coach, fiches reçues, notes de frais, reclassement |
| `12-equipes-planning.js` | Équipes, effectifs, planning, historique de présence. Pastilles de type d'événement en tête du planning (liste et calendrier) : filtre `planTypeFiltrer`, retenu par appareil (`gm_plan_type`), affichées dès 2 types présents |
| `13-firestore-sync.js` | Synchronisation temps réel et migration Firestore |
| `14-evenements.js` | Événements, créneaux, convocations, météo du match |
| `14b-billetterie.js` | Événements à inscription (stage/camp, tournoi, soirée) : tarifs licencié/extérieur, modes de paiement, places ; page publique sans compte (`?evt=clubId__eventId`, `evt_pages`), billets QR (`evt_inscrits`, codes STG-/TRN-/SOI-), inscription d'un enfant par le parent, suivi et paiement → compta |
| `14n-eval-stage.js` | Évaluation en direct d'un stage : qui évaluer (joueurs cochés + invités externes + tous les inscrits non annulés de `evt_inscrits`, licenciés et extérieurs ; sur un stage « jours au choix » seulement ceux inscrits ce jour-là) et évaluation jour par jour (clé `evaluations/{eventId}__{AAAA-MM-JJ}`, un stage d'un seul jour garde `{eventId}`). L'écran lui-même (`buildLiveEval`) est dans 13. |
| `14o-responsable-evt.js` | Responsable d'un événement (`ev.responsableUid/Nom`, choisi dans la fiche parmi les comptes dirigeant/coach) : bandeau d'accueil (dirigeant et coach) « Entrées du jour » + « Inscrits » du jour J jusqu'à la dernière date (`respMesEvenements`, `respBandeau`). Aucun droit nouveau : il passe par les règles staff existantes. |
| `14p-championnats.js` | Compétition : championnats suivis (`championnats/{division_saison}`), import de l'export FBI « Rechercher rencontre » (Excel, SheetJS à la demande) → matchs de notre équipe = événements « match » du planning (`champId`, `champKey` = division\|n°, `fbi` = dernière valeur FBI : une date/heure/salle retouchée dans GM n'est jamais écrasée), scores `ev.score`, matchs sans date « à confirmer », classement calculé (`champClassement`, victoire 2 / défaite 1 / forfait 0) quand le fichier couvre la poule. Calcul pur : `champLireFbi`, `champFusionner`, `champClassement` (tests/metier/championnats.test.js). Bouton « 🏆 Championnats » du pôle Compétition (dirigeant et coachs) | Synchro FFBB : demande dans `ffbb_demandes` → Function `onFfbbDemande` (+ `ffbbSyncNuit`), `champSyncPlanning`, `champParentBloc` (classement côté parents).
| `14q-tirage-table.js` | Tirage au sort de la table de marque et de l'arbitrage des matchs à domicile (Planning › 🎲 Tirage table, dirigeant) : un appui tire une période (phase ou saison) ; vivier = parents de l'équipe qui joue, sinon autres parents et bénévoles du club ; équité sur l'historique de la saison ; pas de tirage pendant les vacances de la zone du club (`TIR_VACANCES`, à compléter chaque saison) ; écrit des missions de bénévoles sur l'événement (`m.tirage`, `m.cle` = empreinte du numéro, jamais le numéro) ; SMS récapitulatif par personne ; annulation du tirage. |
| `14c-entree.js` | Entrée d'un événement : liste à cocher + scan des billets (BarcodeDetector, sinon jsQR à la demande), code bénévole sans compte (`?entree=CODE`, `evt_entrees`), lien d'un billet (`?billet=`) |
| `14d-affiche.js` | Éditeur d'affiche d'un événement, dessinée en Canvas 2D : 6 modèles, post carré / story / PDF A4, intervenants avec photo, sponsors sous l'affiche, places en temps réel et « Complet », partage WhatsApp |
| `14e-tournoi.js` | Tournois : équipes (saisies ou du club), journée (horaires, pause, terrains, battement, repos), format par catégorie (poules puis finale / demis / classement), générateur de planning, PDF grille horaires × terrains, page publique `?trn=clubId__eventId` (`trn_pages`) |
| `14f-tournoi-jourj.js` | Tournois, le jour J : un code par match (`trn_matchs/{CODE}`, jamais public), table de marque sans compte `?marque` (score +1/+2/+3, clôture en retapant le code), classements FIBA (2/1/0, départage aux confrontations), équipes qualifiées des phases finales, écran Jour J du staff qui recopie scores et classements sur `trn_pages`, codes en PDF par terrain, inscription des équipes par le lien (`trn_inscriptions`) |
| `14g-benevoles.js` | Bénévoles : le dirigeant/coach place des personnes (comptes du club ou sans compte) sur des postes (buvette, table de marque…) d'un événement (`e.benevoles`, sans numéro stocké) ; SMS pré-rempli commençant par le nom du club ; bandeau « Tu es bénévole cette semaine » sur l'accueil parent, coach et dirigeant (`benBandeau`). Bouton « 🙋 Bénévoles » dans le planning. **Pass bénévole** : carnet `clubs/{id}/benevoles/{benId}` (staff) + pass public `ben_pass/{CODE}` (collection globale, sans téléphone : missions à venir recopiées depuis les événements par `benSyncTous`, réponses oui/non écrites par le bénévole) lu par la page statique `benevole/index.html` (`?p=CODE`, lien ou QR). |
| `14h-tournoi-plan.js` | Plan du site d'un tournoi : recherche d'adresse (géocodage Géoplateforme → api-adresse → Nominatim), carte Leaflet chargée à la demande (photo aérienne / plan IGN), le club place terrains, buvette, accueil, toilettes… (`e.trn.plan`, publié dans `trn_pages.plan`, affiché sur /tournoi). |
| `14i-tournoi-joueurs.js` | Joueurs des équipes d'un tournoi (numéro + prénom, jamais le nom) : saisis à l'inscription par le lien, code « Mon équipe » (`trn_equipes/{CODE}`, page `?trnequipe=`) modifiable jusqu'au premier match (verrou posé par le Jour J), effectifs du club repris des numéros de maillot, édition par le staff ; envoyés à la table de marque (points et fautes par joueur, `trn_matchs.stats`) et publiés sur `trn_pages`. |
| `14j-stats-calcul.js` | Stats avancées de match, calcul pur (sans DOM) : un match = liste d'événements `{a, p, q, s}` (`match_stats/{eventId}`), tout est recalculé depuis cette liste (`msCalcul` : score par quart-temps, minutes, +/-, évaluation FIBA, adresse au tir ; `msFicheJoueur` : moyennes, tendance, meilleur match). Annuler = retirer le dernier événement. `msLignesJoueurs` / `msFicheDepuisLignes` : la même fiche depuis les seules lignes d'un joueur (vue parent). Testé dans `tests/metier/stats-match.test.js`. |
| `14k-stats-saisie.js` | Stats de match, écrans du coach (plein écran `#ms-overlay`, bouton « Stats » du planning) : choix des joueurs et des 5 de départ, saisie en direct (chrono par quart-temps, 14 actions, points adverses), remplacements horodatés, feuille de match, export PDF. Standard : score, points, fautes, feuille ; Premium (`hasPremium()`) : toutes les actions, chrono, remplacements, temps de jeu, +/-, évaluation, PDF, fiche joueur. Collection `match_stats` synchronisée pour le staff seulement. |
| `14l-stats-fiche.js` | Fiche d'un joueur sur la saison (Premium) : moyennes, tendance sur 3 matchs, adresse au tir, évaluation match par match, meilleur match, PDF (`statsFichePdf`). Vue joueur / parent : le staff publie `stats_joueurs/{pid}` (ses lignes seulement, `msLignesJoueurs` + `statsJoueursPublier` appelé par `saveMatchStats`), lu par le compte rattaché à ce joueur ; carte dans l'onglet Stats du parent (`statsMesJoueursBloc`), fiche complète en Premium, points/fautes par match en Standard. |
| `14m-stats-ecrans.js` | Stats de match, grands écrans (Premium) : **écran de la salle** (`statsSalleOuvrir`, plein écran sombre pour TV, relit le match chaque seconde ; un 2e appareil connecté en coach reçoit la saisie par la synchro, rien n'est public) et **Stats équipe** (`statsEquipeOuvrir`, bouton du planning : bilan, leaders, tableau par joueur avec courbe d'évaluation, filtre saison / 3 derniers / équipe, via `msEquipeSaison`). La feuille de match à 2 colonnes sur ordinateur est dans 14k + `css/style.css`. |
| `../tournoi/index.html` | Page publique autonome d'un tournoi (`/tournoi/?t=CLUB__EVENT`, comme `buvette/`) : matchs en cours / à venir / résultats, classements, « Mon équipe », mode grand écran (`#ecran`). Lit `trn_pages` + `trn_live` ; `trnClassement`/`trnResoudre` y sont recopiés de 14f (à garder identiques). |
| `15-compta-inventaire.js` | Comptabilité, documents, inventaire buvette/matériel |
| `15b-compta-plan.js` | Compta « façon Dolibarr » déduite des lignes : plan comptable associatif (compte par catégorie, réglable par club ou par ligne), trésorerie 512/53x, journaux BQ/CA/OD, n° de pièce continu par journal et exercice, exercice civil ou saison (`compta_reglages/plan`) ; comptes annuels : compte de résultat ANC 2018-06 (PDF, comparatif N-1) et export FEC (ISO-8859-15) ; rapprochement bancaire : relevé CSV/OFX lu sur l’appareil, lignes « Banque » proposées (montant, date ±20 j, libellé), pointage avec `releveId` (jamais deux fois), lignes manquantes créées |
| `15c-compta-ticket.js` | Photo de ticket → ligne de compta pré-remplie : photo réduite (1280 px JPEG, jointe en justificatif), lue par OpenRouter (modèles gratuits rapides, `openrouter/free` en secours), réponse JSON vérifiée (date, montant TTC, fournisseur, catégorie, moyen). Rien n'est enregistré sans validation. |
| `15d-compta-bilan.js` | Premium. Bilan simplifié (actif / passif) et annexe, depuis Comptes annuels : disponibilités = solde de chaque banque/caisse à la clôture (lignes + solde de départ du compte), créances et dettes pré-remplies pour l'exercice en cours (licences restant dues, notes de frais en attente, stock buvette) puis ajustables, fonds associatifs déduits par différence. Annexe : méthodes (ANC 2018-06, trésorerie), faits marquants, bénévolat valorisé. Saisies dans `compta_reglages/plan` (`bilans`, `soldesInit`). |
| `15e-documents-club.js` | Documents du club : le fichier est stocké (`club_docs/{id}` = fiche avec `publie`, `club_docs_parts/{id}_{n}` = morceaux base64 de 600 Ko, 3 Mo max). Le dirigeant (ou le bureau avec l'accès « Documents ») choisit pour chaque document « publié aux parents » ou « réservé au bureau » ; les autres comptes ne reçoivent que les publiés (`docsClubSync` filtre sur `publie == true`, la règle l'impose). Écran parents / coachs : bouton « 📄 Documents du club » (`docsParentsOuvrir`). L'écran admin `buildDocs` est dans 15. |
| `15f-projets.js` | Projets du club avec budget prévisionnel (Premium, en haut de « 📊 Budget » de la comptabilité) : charges, subventions (statuts de `BUDGET_SUBV_STATUTS`), autres financements ; acquis / en attente / à demander / reste à financer (`projetTotaux`), budget équilibré (`projetEquilibre`), PDF charges/produits pour les dossiers de subvention (`projetPdf`). Stocké dans `budgetPrev.projets` |
| `16-communaute.js` | Canaux de discussion, messages, réactions, sondages |
| `16b-messagerie.js` | Messagerie façon WhatsApp : affichage des messages, menu appui long, modif 2 min, suppression, coches de lecture, transfert, discussions privées (`dms`), convocations reliées aux présences (`checkins`) |
| `17-poles.js` | Pages génériques des pôles du club |
| `17b-poles-joueurs.js` | Pôles : le dirigeant choisit les coachs de chaque pôle (`clubs/{id}.polesCoachs`), les coachs du pôle y mettent leurs joueurs avec 1-2 infos propres (`players/{id}.poles`) ; pastilles sur la fiche joueur, filtre par pôle dans Joueurs. Formation et Événements : coachs seulement |
| `17c-poles-fiche.js` | Fiche « profil sportif » d'un joueur dans un pôle, en 4 onglets : Général (assiduité 90 j, séances, matchs, ancienneté, équipes), Paiements (licence du club + cotisation propre au pôle et versements, recette en compta si l'utilisateur y a accès), Infos (champs du pôle, notes du coach, contacts appel/SMS), Réglages (pause, date d'entrée, retrait). Données dans `players/{id}.poles[poleId]`. |
| `17-sponsors.js` | Sponsors & partenaires, conventions, factures PDF numérotées |
| `17b-factures.js` | Tableau des factures sponsors (`clubs/{id}/factures`, Premium) : chaque facture générée est gardée (`getFactures`/`saveFactures`), statuts à envoyer / envoyée / en retard (échéance 30 j) / payée / annulée ; PDF refait à partir de la facture (`factTelechargerPdf`), e-mail et relance en `mailto:` pré-rempli, « payée » crée la ligne de comptabilité (catégorie Sponsors/Partenaires, id `fact<id>`). Droit `sponsors`. |
| `18-auth.js` | Authentification, comptes, changement d'e-mail |
| `19-profils.js` | Profils parent/coach/joueur, thèmes animés |
| `20-parent-tabs.js` | Onglets événements et statistiques côté parent |
| `20b-plateforme.js` | Espace plateforme (super admin), invitations staff, accès support |
| `20c-pf-compta.js` | Comptabilité de la micro-entreprise (Plateforme › Comptabilité, super admin) : lignes abonnements / indépendants, livre des recettes CSV, facture PDF (collection globale `pf_compta`) |
| `22-push.js` | Notifications push (inscription de l'appareil) |
| `23-export.js` | Exports Excel (.xlsx) : compta, licences, sponsors, inventaire |
| `23b-bilan-saison.js` | Bilan de saison en PDF (subventions ANS/mairie, AG) : licenciés par catégorie × genre, tranche d'âge et commune (tirée de l'adresse), équipes, pôles, événements avec participants (evt_pages), compta de l'exercice en Premium. Bouton « 📊 Bilan » de l'écran Licences. |
| `24-independant.js` | Version Indépendant (micro-entreprise) : structure `clubs/{id}` avec `type:"independant"` (créée depuis la Plateforme, « + Créer un indépendant »), appli à part plein écran (`#scr-indep`, `SCR_PUBLICS`). `indRoute()` est appelé par `finishAuthedUser` avant le routage club (type mis en cache `gm_type_<clubId>`). Indépendant (compte `dirigeant`) : Accueil, Séances (créneaux hebdo `indep_creneaux` avec habitués, exceptions et séances ponctuelles `indep_seances`, présences et annulation), Clients (lien d'invitation réutilisable `indep_liens/{CODE}` global + QR, fiche, notes privées `indep_notes`), réglages (nom, couleur). Client (rôle `client`, compte créé par `?rejoindre=CODE`, fiche `indep_clients/{uid}`) : Accueil « Je viens / Je ne peux pas », Réserver (séances ouvertes, places). Réservations `indep_resas/{seance__uid}`. Discussions privées (onglet Messages) : un fil par client `indep_discussions/{uid du compte}` + sous-collection `messages` (texte et/ou photo JPEG réduite stockée dans le message, 350 000 car. max), pastilles « non lu » via `luClient`/`luCoach` ; un parent écrit pour ses enfants dans son propre fil. Annonces (onglet Messages) : l'indépendant publie `indep_annonces/{id}` (tous, ou habitués d'un créneau, séance jointe en option) ; chaque client répond 👍🏼/👎🏼 par personne dans `indep_reactions/{annonce__personne}` (sans toucher aux réservations, qui restent « Je viens / Je ne peux pas ») ; pastille « non lu » côté client via localStorage. Enfants mineurs : fiche `indep_clients/e_xxx` (`mineur`, `parentUid`, `autorisation`) créée par le parent, sans compte ; l'id de l'enfant sert d'habitué et de réservation (`seance__e_xxx`) ; compte parent sans participation = `parentSeul` ; `indPersonnes()` liste les personnes d'un compte client. |
| `24b-independant-argent.js` | Argent de l'indépendant (Premium, `indPremium()`) : suivi des paiements et pass, **sans jamais encaisser** (l'indépendant encaisse lui-même : espèces, virement, chèque, en ligne) | Onglet Argent (à encaisser, encaissé du mois, pass en cours, vendre un pass), fiche argent d'un compte (`indArgentFiche`), encart « Mes paiements » côté client. Données `indep_lignes/{id}` (écrites par l'indépendant, lues par le compte payeur `compte`) : `type:"seance"` (id `s_<séance>__<personne>`, statut `du`/`paye`/`pass`) et `type:"pass"` (`seances`, `usages:[séances]`, valable 6 mois par défaut). Pointer une présence (`indPresence` → `indArgentPresence`) crée la ligne à payer ou prend la séance sur le pass qui expire en premier ; la retirer supprime la ligne sauf si elle est déjà payée. Reçus et livre des recettes : à venir sur ces mêmes lignes. Chargé après 24. |
| `24c-independant-abonnement.js` | Abonnement de l'indépendant (Mon activité › Mon abonnement) : Standard 15 €/mois ou 150 €/an, Premium 20 €/mois ou 200 €/an. Mensuel = engagement 12 mois la 1re année (`aboEcheance`) puis sans engagement (résiliation effet fin de mois) ; annuel = toujours engagé jusqu'à l'échéance. `aboRythme` écrit par le super admin ; gel (1 à 3 mois, ferme l'onglet Argent), résiliation, relance par l'indépendant (mêmes champs `abo*` que les clubs, double confirmation). Chargé après 24b. |
| `24d-independant-recus.js` | Reçus numérotés (`R-AAAA-0001`, PDF jsPDF, mention art. 293 B) et livre des recettes (par mois/trimestre, PDF et Excel) de l'indépendant, sur les lignes `indep_lignes` payées. Reçu attribué à la 1re génération (écrit sur les lignes : `recuNum`, `recuLe`, `recuNom`, `recuPour`), partagé par les lignes payées ensemble ; annuler un paiement annule le reçu (numéro gardé dans `recusAnnules`). Identité de l'émetteur et compteur : `indep_reglages/recus`. Chargé après 24c. |
| `24e-independant-stats.js` | Stats perso de l'indépendant (Premium) : chaque présence pointée laisse une trace `indep_presences/{séance}__{personne}` {pid, compte, date, seance} (toutes formules, lue par l'indépendant seul, 120 jours chargés) ; écran « Stats » : séances, présents en moyenne et encaissé du mois vs mois précédent, clients à relancer (21 jours sans venir) avec SMS pré-rempli. Chargé après 24d. |
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

Quand le changement est visible par un dirigeant/coach/parent (pas une correction
interne ou un ajout de contenu de formation), ajouter une entrée en tête de
`changelog.json` (`{v, titre, points}`, phrases simples, sans jargon technique) :
c'est ce que "Voir le contenu de la mise à jour" affiche depuis la bannière.
Chaque point a un `roles` (`["dirigeant","coach","parent"]` etc.) : seuls les
rôles concernés le voient (le profil actif vient de `asmb_profile`). Un point
sans `roles` s'affiche à tout le monde. Un changement plateforme (super admin
seul) n'a pas sa place ici — personne d'autre ne le verrait de toute façon.

## Multi-club

Toutes les données d'un club vivent sous `clubs/{clubId}/...` dans Firestore.

**Le cloisonnement est automatique** : `window.fbCollection` et `window.fbDoc`
(définis dans `firebase-init.js`) préfixent eux-mêmes le chemin avec le club actif
(`window.CURRENT_CLUB_ID`). Dans le code applicatif, on continue d'écrire
`fbCollection(window.fbDb, "players")` : ça cible `clubs/{clubId}/players`.
Il est donc impossible d'oublier de cloisonner un nouvel appel.

- **Collections globales** (non préfixées) : `users`, `clubs`,
  `inscription_codes`, `club_invites`, `support_grants`. Toute autre
  collection est une donnée de club.
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
- **Comptes** : parents et joueurs rejoignent uniquement par invitation
  (`club_invites`), jamais par numéro de téléphone. Le dirigeant/coach génère
  le code depuis la fiche licence (parent) ou le parent depuis son espace
  (joueur) — voir `creerAccesParentDepuisLicence` (`06-licences.js`) et
  `creerAccesEnfant` (`20-parent-tabs.js`). Le champ `phone` d'un compte
  parent n'est plus qu'un contact recopié de la fiche : il ne sert plus à se
  connecter ni n'est exposé publiquement (`phone_index` a été retiré).

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
