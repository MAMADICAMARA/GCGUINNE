const { Router } = require('express');
const { body, param } = require('express-validator');
const controller = require('./orders.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');

const router = Router();

// Toutes les routes ci-dessous nécessitent une session valide ET une
// boutique active sélectionnée dans le jeton.
router.use(requireAuth, requireActiveStore);

router.post(
  '/',
  [
    body('items').isArray({ min: 1 }).withMessage('Veuillez ajouter au moins un article.'),
    body('paymentMethod')
      .isIn(['CASH', 'MOBILE_MONEY', 'CARD', 'OTHER'])
      .withMessage('Méthode de paiement invalide.'),
  ],
  controller.createOrder
);

router.get('/', controller.listOrders);

router.get('/:id', [param('id').isInt()], controller.getOrder);

// Annulation et retours réservés à l'Owner (pas de rôle Manager —
// abandonné, contexte guinéen : cf. 21_abandon_role_manager.sql).
router.post(
  '/:id/void',
  requireRole('OWNER'),
  [param('id').isInt()],
  controller.voidOrder
);

router.post(
  '/:orderId/items/:itemId/return',
  requireRole('OWNER'),
  [
    param('orderId').isInt(),
    param('itemId').isInt(),
    body('returnedQty').isInt({ min: 1 }).withMessage('Quantité de retour invalide.'),
  ],
  controller.returnOrderItem
);

module.exports = router;