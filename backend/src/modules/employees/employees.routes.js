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

// Autorisations individuelles d'un vendeur — annulation/retour de vente
// (§25_autorisation_annulation_retour.sql), modification du prix à la
// Caisse (§39_prix_editable_vente.sql), ajout de produit
// (§40_autorisation_ajout_produit.sql), ajustement de stock, module
// Fournisseurs et module Achats (§43_autorisation_stock_fournisseurs_
// achats.sql), toutes décidées en conversation, indépendantes des flags
// globaux "tous les vendeurs" (stores.routes.js). Les six champs sont
// optionnels mais au moins l'un doit être fourni — sinon cet appel ne
// changerait rien.
router.patch(
  '/:userId/permissions',
  [
    param('userId').isInt().withMessage('Identifiant invalide.'),
    body('canVoidReturn').optional().isBoolean().withMessage('Valeur invalide.'),
    body('canEditPrice').optional().isBoolean().withMessage('Valeur invalide.'),
    body('canAddProduct').optional().isBoolean().withMessage('Valeur invalide.'),
    body('canManageStock').optional().isBoolean().withMessage('Valeur invalide.'),
    body('canManageSuppliers').optional().isBoolean().withMessage('Valeur invalide.'),
    body('canManagePurchases').optional().isBoolean().withMessage('Valeur invalide.'),
    body().custom((_, { req }) => {
      if (
        req.body.canVoidReturn === undefined &&
        req.body.canEditPrice === undefined &&
        req.body.canAddProduct === undefined &&
        req.body.canManageStock === undefined &&
        req.body.canManageSuppliers === undefined &&
        req.body.canManagePurchases === undefined
      ) {
        throw new Error('Aucune permission à mettre à jour.');
      }
      return true;
    }),
  ],
  checkValidation,
  controller.updatePermissions
);

module.exports = router;
