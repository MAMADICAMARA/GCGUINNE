const { Router } = require('express');
const dashboardService = require('./dashboard.service');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

router.use(requireAuth, requireActiveStore);

// ?date=YYYY-MM-DD (optionnel) — consulte le récapitulatif d'un jour précis
// plutôt que celui d'aujourd'hui (§ décidé en conversation). Format
// contrôlé ici pour ne jamais laisser une valeur arbitraire atteindre le
// ::date de la requête SQL ; aucune date future acceptée (rien à récapituler).
router.get('/stats', async (req, res, next) => {
  try {
    const { date } = req.query;
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        throw new AppError('Date invalide (format attendu : AAAA-MM-JJ).', 400, 'VALIDATION_ERROR');
      }
      if (date > new Date().toISOString().slice(0, 10)) {
        throw new AppError('La date ne peut pas être dans le futur.', 400, 'VALIDATION_ERROR');
      }
    }

    const stats = await dashboardService.getDashboardStats(
      req.auth.storeId,
      req.auth.roleCode,
      req.auth.userId,
      date
    );
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Rapport de recette (§ décidé en conversation) : total encaissé + détail
// par produit sur une période choisie (startDate/endDate, AAAA-MM-JJ,
// tous deux optionnels et inclusifs — défaut : aujourd'hui). Même contrôle
// de format que ?date ci-dessus, appliqué aux deux bornes.
function validateReportDate(value, label) {
  if (value === undefined) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(`${label} invalide (format attendu : AAAA-MM-JJ).`, 400, 'VALIDATION_ERROR');
  }
  if (value > new Date().toISOString().slice(0, 10)) {
    throw new AppError(`${label} ne peut pas être dans le futur.`, 400, 'VALIDATION_ERROR');
  }
}

// Réservé au Owner (décidé en conversation — masqué et bloqué côté
// employé, jamais seulement caché dans le menu comme le reste de l'appli).
router.get('/sales-report', requireRole('OWNER'), async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    validateReportDate(startDate, 'Date de début');
    validateReportDate(endDate, 'Date de fin');
    if (startDate && endDate && startDate > endDate) {
      throw new AppError('La date de début doit précéder la date de fin.', 400, 'VALIDATION_ERROR');
    }

    const report = await dashboardService.getSalesReport(
      req.auth.storeId,
      req.auth.roleCode,
      req.auth.userId,
      { startDate, endDate }
    );
    res.json(report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;