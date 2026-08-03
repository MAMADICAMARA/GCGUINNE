const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const supervisionService = require('./supervision.service');
const { requireAuth } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Aucune de ces routes ne dépend d'une "boutique active" : la supervision
// porte par nature sur plusieurs boutiques à la fois, indépendamment de
// celle sur laquelle l'utilisateur travaille en ce moment (§4.1 vs §4.2).
//
// Décidé en conversation : plus aucune condition "être Owner de quelque
// chose" pour accéder à ce module — un superviseur peut très bien ne
// posséder aucune boutique lui-même (ex : un investisseur qui ne gère rien
// en propre). Ce qui autorise réellement la supervision, c'est désormais
// l'abonnement de CHAQUE boutique surveillée (vérifié dans
// supervision.service.js#verifyAccess et #addSupervisedStore), jamais un
// abonnement que le superviseur possèderait lui-même.
router.use(requireAuth);

/**
 * En revanche, un Vendeur employé (rôle SELLER dans une boutique) reste
 * exclu — cette fonctionnalité n'est pas pensée pour le personnel salarié.
 * Ne bloque PAS quelqu'un sans aucune boutique du tout (l'investisseur
 * ci-dessus) : seul un rattachement effectif en tant que SELLER (jamais
 * OWNER par ailleurs) déclenche le refus. Reflété côté affichage dans
 * frontend/src/routes/accountNavigation.js, avec exactement le même
 * critère.
 */
async function blockEmployees(req, res, next) {
  try {
    const employeeOnly = await supervisionService.isEmployeeOnly(req.auth.userId);
    if (employeeOnly) {
      return next(
        new AppError(
          "Réservé aux propriétaires de boutique et aux personnes sans rattachement — pas au personnel employé.",
          403,
          'EMPLOYEE_NOT_ALLOWED'
        )
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

router.use(blockEmployees);

// Centralise la vérification des erreurs de validation express-validator —
// une règle isInt()/notEmpty() seule ne bloque rien par elle-même ; sans ce
// middleware, un storeId non numérique atteindrait la couche SQL brute et
// remonterait une erreur 500 au lieu d'un 422 propre.
function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/stores', async (req, res, next) => {
  try {
    const stores = await supervisionService.listSupervisableStores(req.auth.userId);
    res.json({ stores });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/stores',
  [body('code').trim().notEmpty().withMessage('Le code de supervision est requis.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await supervisionService.addSupervisedStore(req.auth.userId, req.body.code);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/stores/:storeId',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await supervisionService.removeSupervisedStore(
        req.auth.userId,
        req.params.storeId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/stats',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await supervisionService.getSupervisedStoreStats(
        req.auth.userId,
        req.params.storeId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/products',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const products = await supervisionService.getSupervisedStoreProducts(
        req.auth.userId,
        req.params.storeId,
        req.query
      );
      res.json(products);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/orders',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const orders = await supervisionService.getSupervisedStoreOrders(
        req.auth.userId,
        req.params.storeId,
        req.query
      );
      res.json(orders);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/orders/:orderId',
  [
    param('storeId').isInt().withMessage('Identifiant de boutique invalide.'),
    param('orderId').isInt().withMessage('Identifiant de vente invalide.'),
  ],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await supervisionService.getSupervisedStoreOrder(
        req.auth.userId,
        req.params.storeId,
        req.params.orderId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/stock-movements',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const movements = await supervisionService.getSupervisedStoreStockMovements(
        req.auth.userId,
        req.params.storeId,
        req.query
      );
      res.json({ movements });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/stores/:storeId/audit-log',
  [param('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await supervisionService.getSupervisedStoreAuditLog(
        req.auth.userId,
        req.params.storeId,
        req.query
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
