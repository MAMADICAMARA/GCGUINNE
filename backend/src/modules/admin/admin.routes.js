const { Router } = require('express');
const { param, body, validationResult } = require('express-validator');
const controller = require('./admin.controller');
const { requireAuth, requireSuperAdmin } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Aucune de ces routes n'utilise requireActiveStore : le Super Admin agit
// sur la plateforme entière, jamais dans le contexte d'une boutique
// particulière (§3.1 du cahier des charges).
router.use(requireAuth, requireSuperAdmin);

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/stats', controller.stats);
router.get('/stores', controller.listStores);
router.post('/stores/:id/suspend', [param('id').isInt()], controller.suspendStore);
router.post('/stores/:id/reactivate', [param('id').isInt()], controller.reactivateStore);
router.get('/plans', controller.listPlans);
router.put(
  '/plans/:id',
  [
    param('id').isInt().withMessage('Identifiant de plan invalide.'),
    body('name').trim().notEmpty().withMessage('Le nom du plan est requis.'),
    body('price').isFloat({ min: 0 }).withMessage('Le prix doit être un nombre positif.'),
    body('maxUsersPerStore').isInt({ min: 1 }).withMessage('Le nombre d\'utilisateurs doit être un entier positif.'),
  ],
  checkValidation,
  controller.updatePlan
);
router.get('/audit-log', controller.listAuditLogs);
router.get('/users/search', controller.searchUsers);
router.post('/stores/:id/transfer', [param('id').isInt(), body('newOwnerUserId').isInt()], controller.transferStore);
router.post('/users/:id/promote', [param('id').isInt()], controller.promoteUser);
router.post('/users/:id/revoke', [param('id').isInt()], controller.revokeUser);

router.post(
  '/stores/:id/plan/activate',
  [
    param('id').isInt().withMessage('Identifiant de boutique invalide.'),
    body('planId').isInt().withMessage('Identifiant de plan invalide.'),
    body('expiresAt').isISO8601().withMessage('Date d\'expiration invalide.'),
  ],
  checkValidation,
  controller.activateStorePlan
);
router.post(
  '/stores/:id/plan/renew',
  [
    param('id').isInt().withMessage('Identifiant de boutique invalide.'),
    body('expiresAt').isISO8601().withMessage('Date d\'expiration invalide.'),
  ],
  checkValidation,
  controller.renewStorePlan
);
router.post(
  '/stores/:id/plan/deactivate',
  [param('id').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  controller.deactivateStorePlan
);

// Activation en masse — décidée en conversation, réservée aux boutiques
// en FREEMIUM (jamais celles ayant déjà un abonnement payant en cours).
router.post(
  '/plans/:id/activate-freemium-stores',
  [
    param('id').isInt().withMessage('Identifiant de plan invalide.'),
    body('days').isInt({ min: 1 }).withMessage('Le nombre de jours doit être un entier positif.'),
  ],
  checkValidation,
  controller.activatePlanForAllFreemiumStores
);

// Référentiel "types de boutique" (§ cahier-des-charges-types-de-boutique.md)
router.get('/store-types', controller.listStoreTypes);
router.post(
  '/store-types',
  [
    body('code').trim().notEmpty().withMessage('Le code est requis.'),
    body('label').trim().notEmpty().withMessage('Le libellé est requis.'),
    body('displayOrder').optional().isInt().withMessage("L'ordre d'affichage doit être un entier."),
  ],
  checkValidation,
  controller.createStoreType
);
router.put(
  '/store-types/:id',
  [
    param('id').isInt().withMessage('Identifiant de type invalide.'),
    body('code').trim().notEmpty().withMessage('Le code est requis.'),
    body('label').trim().notEmpty().withMessage('Le libellé est requis.'),
    body('displayOrder').optional().isInt().withMessage("L'ordre d'affichage doit être un entier."),
  ],
  checkValidation,
  controller.updateStoreType
);
router.delete(
  '/store-types/:id',
  [param('id').isInt().withMessage('Identifiant de type invalide.')],
  checkValidation,
  controller.deleteStoreType
);

router.post(
  '/store-types/:storeTypeId/categories',
  [
    param('storeTypeId').isInt().withMessage('Identifiant de type invalide.'),
    body('name').trim().notEmpty().withMessage('Le nom est requis.'),
    body('displayOrder').optional().isInt().withMessage("L'ordre d'affichage doit être un entier."),
  ],
  checkValidation,
  controller.addStoreTypeCategory
);
router.put(
  '/store-types/categories/:categoryId',
  [
    param('categoryId').isInt().withMessage('Identifiant de catégorie invalide.'),
    body('name').trim().notEmpty().withMessage('Le nom est requis.'),
    body('displayOrder').optional().isInt().withMessage("L'ordre d'affichage doit être un entier."),
  ],
  checkValidation,
  controller.updateStoreTypeCategory
);
router.delete(
  '/store-types/categories/:categoryId',
  [param('categoryId').isInt().withMessage('Identifiant de catégorie invalide.')],
  checkValidation,
  controller.deleteStoreTypeCategory
);

// --- Demandes de paiement d'abonnement (§27_paiement_abonnement.sql,
// décidé en conversation) — la confirmation réutilise l'activation
// manuelle existante (routes /stores/:id/plan/... ci-dessus), qui reste
// intacte et disponible en parallèle pour toute activation directe.
router.get('/payment-requests', controller.listPaymentRequests);
router.post(
  '/payment-requests/:id/confirm',
  [param('id').isInt().withMessage('Identifiant de demande invalide.')],
  checkValidation,
  controller.confirmPaymentRequest
);
router.post(
  '/payment-requests/:id/reject',
  [
    param('id').isInt().withMessage('Identifiant de demande invalide.'),
    body('reason').trim().notEmpty().withMessage('Le motif du refus est requis.'),
  ],
  checkValidation,
  controller.rejectPaymentRequest
);

router.get('/payment-settings', controller.getPaymentSettings);
router.put(
  '/payment-settings',
  [
    body('orangeMoneyNumber').optional({ checkFalsy: true }).trim(),
    body('mobileMoneyNumber').optional({ checkFalsy: true }).trim(),
    body('paycardInfo').optional({ checkFalsy: true }).trim(),
    body('contactPhone').optional({ checkFalsy: true }).trim(),
    body('contactWhatsapp').optional({ checkFalsy: true }).trim(),
    body('contactEmail').optional({ checkFalsy: true }).isEmail().withMessage('E-mail de contact invalide.'),
  ],
  checkValidation,
  controller.updatePaymentSettings
);

module.exports = router;
