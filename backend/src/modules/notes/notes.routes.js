const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./notes.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Carnet partagé par toute l'équipe de la boutique (décidé en conversation)
// — pas réservé à l'Owner, contrairement aux fournisseurs/employés.
router.use(requireAuth, requireActiveStore, requireRole('OWNER', 'SELLER'));

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/', controller.list);

router.post(
  '/',
  [body('content').trim().notEmpty().withMessage('Le contenu de la note est requis.')],
  checkValidation,
  controller.create
);

router.put(
  '/:id',
  [
    param('id').isInt().withMessage('Identifiant invalide.'),
    body('content').trim().notEmpty().withMessage('Le contenu de la note est requis.'),
  ],
  checkValidation,
  controller.update
);

router.post(
  '/:id/toggle-pin',
  [param('id').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.togglePin
);

router.delete('/:id', [param('id').isInt().withMessage('Identifiant invalide.')], checkValidation, controller.remove);

module.exports = router;
