const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./purchases.controller');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { requirePlanFeature } = require('../../middlewares/plan');
const { canUserManagePurchases } = require('../stores/stores.service');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

/**
 * Remplace l'ancien requireRole('OWNER') statique
 * (§43_autorisation_stock_fournisseurs_achats.sql, décidé en conversation)
 * — un Vendeur peut désormais utiliser tout le module Achats si le Owner
 * l'a explicitement autorisé, soit tous les vendeurs d'un coup, soit lui
 * individuellement. La restriction PREMIUM ci-dessous
 * (§28_commandes_achat_premium.sql, requirePlanFeature) reste entièrement
 * séparée et continue de s'appliquer, y compris à un vendeur autorisé.
 */
async function requireManagePurchasesPermission(req, res, next) {
  try {
    const allowed = await canUserManagePurchases(req.auth.storeId, req.auth.userId, req.auth.roleCode);
    if (!allowed) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.use(requireAuth, requireActiveStore, requireManagePurchasesPermission);

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

// Consulter ce qui existe déjà (fournisseurs, commandes passées) reste
// toujours possible quel que soit le plan actuel — seule la création
// d'un nouveau fournisseur ou d'une nouvelle commande exige PREMIUM,
// même logique que suppliers.routes.js pour allowsSuppliers.
router.get('/suppliers', controller.listSupplierContacts);
router.post(
  '/suppliers',
  [body('name').trim().notEmpty().withMessage('Le nom du fournisseur est requis.')],
  checkValidation,
  requirePlanFeature('allowsPurchaseOrders'),
  controller.createSupplierContact
);
router.put(
  '/suppliers/:id',
  [
    param('id').isInt().withMessage('Identifiant invalide.'),
    body('name').trim().notEmpty().withMessage('Le nom du fournisseur est requis.'),
  ],
  checkValidation,
  controller.updateSupplierContact
);
router.delete(
  '/suppliers/:id',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.deleteSupplierContact
);

router.get('/orders', controller.listPurchaseOrders);
router.get(
  '/orders/:id',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.getPurchaseOrder
);
router.post(
  '/orders',
  [
    body('supplierId').isInt().withMessage('Fournisseur invalide.'),
    body('items').isArray({ min: 1 }).withMessage('Ajoutez au moins un article.'),
    body('items.*.productId').isInt().withMessage('Produit invalide.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide.'),
    body('items.*.purchasePrice').isFloat({ min: 0 }).withMessage("Prix d'achat invalide."),
  ],
  checkValidation,
  requirePlanFeature('allowsPurchaseOrders'),
  controller.createPurchaseOrder
);

// Commande directement depuis le catalogue d'un fournisseur DE LA
// PLATEFORME (§29_commande_depuis_fournisseur_plateforme.sql, décidé en
// conversation) — même exigence de plan que ci-dessus (PREMIUM), même si
// parcourir le catalogue du fournisseur (module suppliers/) est, lui,
// ouvert à tous les plans.
router.post(
  '/orders/from-supplier-store',
  [
    body('supplierStoreId').isInt().withMessage('Fournisseur invalide.'),
    body('items').isArray({ min: 1 }).withMessage('Ajoutez au moins un article.'),
    body('items.*.supplierProductId').isInt().withMessage('Produit invalide.'),
    body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantité invalide.'),
    body('items.*.purchasePrice').isFloat({ min: 0 }).withMessage("Prix d'achat invalide."),
  ],
  checkValidation,
  requirePlanFeature('allowsPurchaseOrders'),
  controller.createOrderFromSupplierStore
);

// Finaliser (recevoir/annuler) une commande déjà créée reste toujours
// possible, même si la boutique a depuis perdu l'accès PREMIUM — seule la
// création d'une nouvelle commande est verrouillée.
router.post(
  '/orders/:id/receive',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.receivePurchaseOrder
);
router.post(
  '/orders/:id/cancel',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.cancelPurchaseOrder
);

// Commandes reçues DE MES CLIENTS — je suis le fournisseur
// (§29_commande_depuis_fournisseur_plateforme.sql, décidé en conversation).
// Lecture seule stricte : jamais de confirmer/annuler depuis ce côté, c'est
// toujours l'acheteur qui contrôle le cycle de vie de sa commande. Jamais
// verrouillé par le plan : c'est de l'historique déjà arrivé, pas une
// nouvelle création.
router.get('/received-orders', controller.listReceivedOrders);
router.get(
  '/received-orders/:id',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.getReceivedOrder
);

module.exports = router;
