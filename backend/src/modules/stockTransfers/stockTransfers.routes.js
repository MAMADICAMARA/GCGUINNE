const { Router } = require('express');
const { body, query, validationResult } = require('express-validator');
const controller = require('./stockTransfers.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { requirePlanFeature } = require('../../middlewares/plan');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Réservé au Owner (§45_transfert_de_stock.sql, décidé en conversation) —
// même périmètre que l'ajustement de stock, un envoi de stock hors de la
// boutique est une décision plus lourde qu'une simple correction. Réservé
// en plus aux plans STANDARD et PROFESSIONNEL (§46_transfert_stock_plan.sql,
// décidé en conversation) — même mécanisme que allowsSuppliers/
// allowsPurchaseOrders, y compris pour l'aperçu (resolve-code) : pas
// d'utilité à prévisualiser une action qu'on ne pourra pas confirmer.
router.use(requireAuth, requireActiveStore, requireRole('OWNER'), requirePlanFeature('allowsStockTransfer'));

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

// Aperçu avant confirmation — voir stockTransfers.service.js#resolveTransferCode.
router.get(
  '/resolve-code',
  [query('code').trim().notEmpty().withMessage('Code de transfert requis.')],
  checkValidation,
  controller.resolveCode
);

router.post(
  '/',
  [
    body('transferCode').trim().notEmpty().withMessage('Code de transfert requis.'),
    body('productId').isInt().withMessage('Produit invalide.'),
    body('quantity').isInt({ min: 1 }).withMessage('Quantité invalide.'),
  ],
  checkValidation,
  controller.create
);

module.exports = router;
