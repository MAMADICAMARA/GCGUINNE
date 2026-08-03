const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./suppliers.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { requirePlanFeature } = require('../../middlewares/plan');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Réservé à l'Owner (décidé en conversation, cohérent avec le code de
// supervision déjà restreint à l'Owner) — nécessite une boutique active,
// contrairement à la supervision qui porte sur plusieurs boutiques à la
// fois indépendamment de la boutique active.
router.use(requireAuth, requireActiveStore, requireRole('OWNER'));

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
// que soit le plan — même logique que l'équipe (employees.routes.js) : on
// ne bloque jamais l'accès à ce qui existe déjà, seulement la création de
// nouveaux liens. Seul l'ajout d'un nouveau fournisseur exige le plan
// (§20_plans_abonnement.sql, décidé en conversation).
router.get('/', controller.listSuppliers);
router.get('/clients', controller.listClients);

router.post(
  '/',
  [body('code').trim().notEmpty().withMessage('Le code fournisseur est requis.')],
  checkValidation,
  requirePlanFeature('allowsSuppliers'),
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

module.exports = router;
