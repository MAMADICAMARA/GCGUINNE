const { Router } = require('express');
const { body, param } = require('express-validator');
const controller = require('./products.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');

const router = Router();

router.use(requireAuth, requireActiveStore);

// Lecture : accessible à tous les rôles d'une boutique (le vendeur a besoin
// de consulter le catalogue et le stock pour la caisse, cf. §8.1).
router.get('/', controller.list);
router.get('/:id', [param('id').isInt()], controller.getOne);
router.get('/:id/stock-history', [param('id').isInt()], controller.stockHistory);

// Écriture : réservée à l'Owner (§4.3 — un vendeur ne peut pas
// ajouter/modifier/supprimer un produit ; pas de rôle Manager — abandonné,
// contexte guinéen : cf. 21_abandon_role_manager.sql).
router.post(
  '/',
  requireRole('OWNER'),
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