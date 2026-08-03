const { Router } = require('express');
const { body } = require('express-validator');
const controller = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// Âge minimum requis pour créer un compte (règle métier simple, ajustable
// sans migration puisqu'elle vit ici et non en base — cf. §09_profil_utilisateur.sql
// qui ne contraint que "pas de date dans le futur").
const MIN_AGE_YEARS = 15;

router.post(
  '/register',
  [
    body('fullName').trim().notEmpty().withMessage('Le nom complet est requis.'),
    body('email').isEmail().withMessage('E-mail invalide.'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('Le mot de passe doit contenir au moins 6 caractères.'),
    body('passwordConfirm').custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Les mots de passe ne correspondent pas.');
      }
      return true;
    }),
    body('phone').trim().notEmpty().withMessage('Le numéro de téléphone est requis.'),
    body('gender')
      .isIn(['HOMME', 'FEMME', 'AUTRE'])
      .withMessage('Le sexe doit être HOMME, FEMME ou AUTRE.'),
    body('birthDate')
      .isISO8601()
      .withMessage('Date de naissance invalide.')
      .custom((value) => {
        const birth = new Date(value);
        if (birth > new Date()) {
          throw new Error('La date de naissance ne peut pas être dans le futur.');
        }
        const ageLimitDate = new Date();
        ageLimitDate.setFullYear(ageLimitDate.getFullYear() - MIN_AGE_YEARS);
        if (birth > ageLimitDate) {
          throw new Error(`Vous devez avoir au moins ${MIN_AGE_YEARS} ans pour créer un compte.`);
        }
        return true;
      }),
  ],
  controller.register
);

router.post(
  '/login',
  [
    body('email').isEmail().withMessage('E-mail invalide.'),
    body('password').notEmpty().withMessage('Le mot de passe est requis.'),
  ],
  controller.login
);

router.post(
  '/switch-store',
  requireAuth,
  [body('storeId').isInt().withMessage('Identifiant de boutique invalide.')],
  controller.switchStore
);

module.exports = router;