# Sauvegarde de la base

- **Quoi** : export complet de Firestore (toutes les collections, tous les clubs), fonction
  `sauvegardeNuit` (functions/index.js), chaque nuit à 2 h 30 (heure de Paris).
- **Où** : bucket Cloud Storage `asmb-app-sauvegardes` (projet asmb-app), un dossier par
  export (`AAAA-MM-JJ_HHMM`, heure UTC). Effacement automatique après **30 jours**.
- **Suivi** : Plateforme › bloc « 💾 Sauvegardes » (état dans `plateforme_config/sauvegarde`),
  bouton « Sauvegarder maintenant ». Échec → alerte push au super admin.

## Restaurer

⚠️ Une restauration **réécrit** les documents présents dans l'export (les documents créés
depuis restent). À faire seulement après accord d'Ahmed, de préférence collection par collection.

```
gcloud firestore import gs://asmb-app-sauvegardes/<dossier> --project asmb-app
# une seule collection :
gcloud firestore import gs://asmb-app-sauvegardes/<dossier> --collection-ids=licences --project asmb-app
```
(Les sous-collections de club `clubs/{id}/licences` ont pour identifiant de collection `licences`.)
