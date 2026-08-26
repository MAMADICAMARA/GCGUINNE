const { Router } = require('express');
const { body, param } = require('express-validator');
const controller = require('./products.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { canUserAddProduct } = require('../stores/stores.service');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

router.use(requireAuth, requireActiveStore);

// Lecture : accessible à tous les rôles d'une boutique (le vendeur a besoin
// de consulter le catalogue et le stock pour la caisse, cf. §8.1).
router.get('/', controller.list);
router.get('/:id', [param('id').isInt()], controller.getOne);
router.get('/:id/stock-history', [param('id').isInt()], controller.stockHistory);

/**
 * Remplace l'ancien requireRole('OWNER') statique pour la SEULE création
 * (§40_autorisation_ajout_produit.sql, décidé en conversation) — un
 * Vendeur peut désormais créer un produit si le Owner l'a explicitement
 * autorisé, soit tous les vendeurs d'un coup, soit lui individuellement.
 * Modifier/désactiver/réactiver/ajuster le stock d'un produit EXISTANT
 * reste strictement réservé au Owner, inchangé (cf. plus bas).
 */
async function requireAddProductPermission(req, res, next) {
  try {
    const allowed = await canUserAddProduct(req.auth.storeId, req.auth.userId, req.auth.roleCode);
    if (!allowed) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

// Modifier/désactiver/réactiver un produit existant, ajuster son stock :
// toujours réservé au Owner (§4.3 ; pas de rôle Manager — abandonné,
// contexte guinéen : cf. 21_abandon_role_manager.sql).
router.post(
  '/',
  requireAddProductPermission,
  [
    body('name').trim().notEmpty().withMessage('Le nom du produit est requis.'),
    body('purchasePrice').isFloat({ min: 0 }).withMessage('Prix d\'achat invalide.'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('Prix de vente invalide.'),
  ],
  controller.create
);

router.put(
  '/:id',
  requireRole('OWNER'),
  [
    param('id').isInt(),
    body('name').trim().notEmpty().withMessage('Le nom du produit est requis.'),
    body('purchasePrice').isFloat({ min: 0 }).withMessage('Prix d\'achat invalide.'),
    body('sellingPrice').isFloat({ min: 0 }).withMessage('Prix de vente invalide.'),
  ],
  controller.update
);

router.post('/:id/deactivate', requireRole('OWNER'), [param('id').isInt()], controller.deactivate);
router.post('/:id/reactivate', requireRole('OWNER'), [param('id').isInt()], controller.reactivate);

router.post(
  '/:id/adjust-stock',
  requireRole('OWNER'),
  [
    param('id').isInt(),
    body('delta').isInt().withMessage('La quantité d\'ajustement doit être un entier.'),
  ],
  controller.adjustStock
);

module.exports = router;