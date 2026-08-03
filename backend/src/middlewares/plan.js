const { getEffectivePlan } = require('../utils/planContext');
const { AppError } = require('./errorHandler');

/**
 * Verrouille une route derrière une capacité de plan (Superviser,
 * Fournisseurs...) — même esprit que requireRole, mais pour l'abonnement
 * plutôt que le rôle. `featureKey` doit correspondre à un champ booléen
 * renvoyé par getEffectivePlan (ex: "allowsSupervision", "allowsSuppliers").
 * Exige une boutique active dans le token (req.auth.storeId).
 */
function requirePlanFeature(featureKey) {
  return async (req, res, next) => {
    try {
      if (!req.auth?.storeId) {
        return next(new AppError('Veuillez sélectionner une boutique active.', 400, 'NO_ACTIVE_STORE'));
      }
      const plan = await getEffectivePlan(req.auth.storeId);
      if (!plan[featureKey]) {
        return next(
          new AppError(
            "Cette fonctionnalité n'est pas incluse dans votre abonnement actuel.",
            403,
            'PLAN_FEATURE_LOCKED'
          )
        );
      }
      req.planContext = plan;
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requirePlanFeature };
