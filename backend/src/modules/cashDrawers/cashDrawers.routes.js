const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./cashDrawers.controller');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Owner ET Vendeur (§05_caisses.sql, décidé en conversation) — c'est le
// Vendeur qui manipule physiquement la caisse pendant son service, pas
// seulement le Owner.
router.use(requireAuth, requireActiveStore);

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/current', controller.getCurrent);

router.post(
  '/open',
  [body('openingBalance').isFloat({ min: 0 }).withMessage('Le fond de caisse de départ est invalide.')],
  checkValidation,
  controller.open
);

router.post(
  '/close',
  [
    body('closingBalance').isFloat({ min: 0 }).withMessage('Le montant compté est invalide.'),
    body('note').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
  ],
  checkValidation,
  controller.close
);

router.get('/', controller.list);
router.get(
  '/:id',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.getById
);

module.exports = router;
