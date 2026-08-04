const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const controller = require('./employees.controller');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Décision retenue : seul le Owner gère l'équipe (cf. §3.1 du cahier des
// charges — "Gérer les employés" ne figure que dans les droits Owner).
router.use(requireAuth, requireActiveStore, requireRole('OWNER'));

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/', controller.list);
router.get('/invitations', controller.listInvitations);

// Toujours en tant que Vendeur/Caissier — pas de rôle Manager (abandonné,
// contexte guinéen : cf. 21_abandon_role_manager.sql), donc pas de choix
// de rôle à faire ici.
router.post(
  '/',
  [body('email').isEmail().withMessage('E-mail invalide.')],
  checkValidation,
  controller.add
);

router.delete(
  '/invitations/:invitationId',
  [param('invitationId').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.cancelInvitation
);

router.delete(
  '/:userId',
  [param('userId').isInt().withMessage('Identifiant invalide.')],
  checkValidation,
  controller.remove
);

// Autorisation individuelle d'annulation/retour de vente
// (§25_autorisation_annulation_retour.sql, décidé en conversation) —
// indépendant du flag global "tous les vendeurs" (stores.routes.js).
router.patch(
  '/:userId/permissions',
  [
    param('userId').isInt().withMessage('Identifiant invalide.'),
    body('canVoidReturn').isBoolean().withMessage('Valeur invalide.'),
  ],
  checkValidation,
  controller.updatePermissions
);

module.exports = router;
