const { Router } = require('express');
const { param, validationResult } = require('express-validator');
const marketplaceService = require('./marketplace.service');
const { requireAuth } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

// Public — la page racine (§ décidé en conversation) doit savoir si MARCHÉ
// est activé AVANT même qu'un visiteur soit connecté, donc avant de
// pouvoir appeler la moindre route protégée. Jamais /admin/platform-settings
// ici : celle-ci reste réservée au Super Admin pour la gestion réelle.
router.get('/status', async (req, res, next) => {
  try {
    const enabled = await marketplaceService.isMarketplaceEnabled();
    res.json({ enabled });
  } catch (err) {
    next(err);
  }
});

// Public — grille (§7, niveau grille). Projection volontairement limitée,
// contrôlée dans le service, jamais ici.
router.get('/products', async (req, res, next) => {
  try {
    const products = await marketplaceService.listPublicProducts();
    res.json({ products });
  } catch (err) {
    next(err);
  }
});

// Authentification requise — n'importe quel rôle, n'importe quelle
// boutique (§6) : requireAuth seul, jamais requireActiveStore.
router.get(
  '/products/:id',
  requireAuth,
  [param('id').isInt().withMessage('Identifiant de produit invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const product = await marketplaceService.getPublicProductDetail(req.params.id);
      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
