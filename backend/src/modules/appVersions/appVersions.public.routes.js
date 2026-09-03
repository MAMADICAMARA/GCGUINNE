const { Router } = require('express');
const appVersionsService = require('./appVersions.service');

const router = Router();

// Public, sans authentification (§7 du cahier des charges "Système de
// notification de mise à jour", décidé en conversation) — seule source de
// vérité, appelée à la fois par l'app Flutter et par la page web publique
// de téléchargement (/telecharger) : jamais deux valeurs codées
// séparément. `platform` par défaut 'android' (seule plateforme
// distribuée hors store pour l'instant, cf. hors périmètre iOS).
router.get('/version', async (req, res, next) => {
  try {
    const platform = req.query.platform || 'android';
    const version = await appVersionsService.getLatestVersion(platform);
    // Objet vide plutôt que `null` (décidé en conversation) : un corps JSON
    // `null` racine est un cas ambigu pour certains clients typés (le
    // client Dio de l'app Flutter attend un Map, pas une valeur nullable) —
    // `{}` reste un objet valide dans tous les cas, les deux consommateurs
    // (app Flutter, page /telecharger) détectent "aucune version" par
    // l'absence de `versionCode`, jamais par la forme de la racine.
    res.json(version || {});
  } catch (err) {
    next(err);
  }
});

module.exports = router;
