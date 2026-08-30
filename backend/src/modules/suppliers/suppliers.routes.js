const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./suppliers.controller');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { canUserManageSuppliers } = require('../stores/stores.service');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

/**
 * Remplace l'ancien requireRole('OWNER') statique
 * (§43_autorisation_stock_fournisseurs_achats.sql, décidé en conversation)
 * — un Vendeur peut désormais utiliser tout le module Fournisseurs si le
 * Owner l'a explicitement autorisé, soit tous les vendeurs d'un coup, soit
 * lui individuellement. Jusqu'ici intégralement réservé au Owner, aucun
 * accès vendeur même en lecture — un vendeur autorisé voit le module
 * exactement comme le Owner.
 */
async function requireManageSuppliersPermission(req, res, next) {
  try {
    const allowed = await canUserManageSuppliers(req.auth.storeId, req.auth.userId, req.auth.roleCode);
    if (!allowed) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.use(requireAuth, requireActiveStore, requireManageSuppliersPermission);

// Centralise la vérification des erreurs de validation express-validator —
// une règle isInt()/notEmpty() seule ne bloque rien par elle-même, elle ne
// fait que peupler le résultat ; sans ce middleware, un paramètre invalide
// (ex: linkId non numérique) atteindrait la couche SQL brute et
// remonterait une erreur 500 au lieu d'un 400/422 propre.
function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

// Consulter/gérer les liens déjà établis reste toujours possible, quel
// que soit le plan — même logique que l'équipe (employees.routes.js).
//
// Ajouter un fournisseur est désormais ouvert à TOUS les plans, y compris
// FREEMIUM (décidé en conversation, §29_commande_depuis_fournisseur_plateforme.sql
// — revirement volontaire par rapport à la version précédente) : stratégie
// à deux faces, la DEMANDE (parcourir/ajouter des fournisseurs) reste
// gratuite pour maximiser l'usage, seule L'OFFRE (être soi-même
// trouvable/consultable comme fournisseur) exige STANDARD/PREMIUM — déjà
// garanti indépendamment par `getSupplierCatalog`/`getSupplierCatalogForOrder`
// qui revérifient le plan EFFECTIF du fournisseur consulté, jamais celui de
// l'acheteur. Passer une véritable commande reste, lui, réservé PREMIUM
// (voir purchases.routes.js, allowsPurchaseOrders).
router.get('/', controller.listSuppliers);
router.get('/clients', controller.listClients);

router.post(
  '/',
  [body('code').trim().notEmpty().withMessage('Le code fournisseur est requis.')],
  checkValidation,
  controller.addSupplier
);

router.delete(
  '/clients/:linkId',
  [param('linkId').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.removeClient
);
router.delete(
  '/:linkId',
  [param('linkId').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.removeSupplier
);

router.get(
  '/:storeId/products',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  controller.getCatalog
);

// Variante avec prix de vente (référence), pour construire une commande
// (§29_commande_depuis_fournisseur_plateforme.sql, décidé en conversation) —
// jamais la quantité en stock, voir suppliers.service.js#getSupplierCatalogForOrder.
router.get(
  '/:storeId/order-catalog',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  controller.getOrderCatalog
);

module.exports = router;
