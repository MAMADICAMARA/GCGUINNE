const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const controller = require('./subscriptionPayments.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Réservé au Owner (§27_paiement_abonnement.sql, décidé en conversation) —
// c'est lui qui gère l'abonnement de sa boutique, comme le reste de
// Paramètres.
router.use(requireAuth, requireActiveStore, requireRole('OWNER'));

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/options', controller.getOptions);
router.get('/mine', controller.getMine);

router.post(
  '/',
  [
    body('planId').isInt().withMessage('Plan invalide.'),
    body('paymentMethod')
      .isIn(['ORANGE_MONEY', 'MOBILE_MONEY', 'PAYCARD'])
      .withMessage('Méthode de paiement invalide.'),
    body('transactionReference').trim().notEmpty().withMessage('La référence de transaction est requise.'),
    body('payerPhone').optional({ checkFalsy: true }).trim(),
  ],
  checkValidation,
  controller.submitRequest
);

module.exports = router;
