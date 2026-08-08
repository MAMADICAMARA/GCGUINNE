const { Router } = require('express');
const dashboardService = require('./dashboard.service');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
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

module.exports = router;