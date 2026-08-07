const { Router } = require('express');
const { body, param } = require('express-validator');
const controller = require('./orders.controller');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { canUserVoidReturn } = require('../stores/stores.service');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Toutes les routes ci-dessous nécessitent une session valide ET une
// boutique active sélectionnée dans le jeton.
router.use(requireAuth, requireActiveStore);

/**
 * Remplace l'ancien requireRole('OWNER') statique — désormais un Vendeur
 * peut aussi annuler/retourner (ses propres ventes, vérifié plus loin dans
 * le service) si le Owner l'a explicitement autorisé
 * (§25_autorisation_annulation_retour.sql, décidé en conversation) : soit
 * tous les vendeurs d'un coup, soit lui individuellement. Async/DB-backed,
 * même précédent que requireActiveStore ci-dessus pour le mode FREEMIUM.
 */
async function requireVoidReturnPermission(req, res, next) {
  try {
    const allowed = await canUserVoidReturn(req.auth.storeId, req.auth.userId, req.auth.roleCode);
    if (!allowed) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

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

// Mêmes règles d'accès que GET /:id ci-dessus (vérifié dans le service, pas
// ici) — génère la facture PDF à la volée, jamais stockée ni mise en cache
// (§ cahier des charges "Facture PDF", décidé en conversation).
router.get('/:id/invoice-pdf', [param('id').isInt()], controller.getInvoicePdf);

// Annulation et retours — Owner toujours, Vendeur seulement si autorisé
// (voir requireVoidReturnPermission ci-dessus) et uniquement sur SES
// PROPRES ventes (vérifié dans orders.service.js, jamais côté route).
router.post(
  '/:id/void',
  requireVoidReturnPermission,
  [param('id').isInt()],
  controller.voidOrder
);

router.post(
  '/:orderId/items/:itemId/return',
  requireVoidReturnPermission,
  [
    param('orderId').isInt(),
    param('itemId').isInt(),
    body('returnedQty').isInt({ min: 1 }).withMessage('Quantité de retour invalide.'),
  ],
  controller.returnOrderItem
);

module.exports = router;