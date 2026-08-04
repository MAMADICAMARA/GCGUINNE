const { Router } = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const controller = require('./auth.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

// Âge minimum requis pour créer un compte (règle métier simple, ajustable
// sans migration puisqu'elle vit ici et non en base — cf. §09_profil_utilisateur.sql
// qui ne contraint que "pas de date dans le futur").
const MIN_AGE_YEARS = 15;

/**
 * Limite dédiée, plus stricte que la limite globale de app.js (300/15min,
 * pensée pour l'usage normal de toute l'API) — §A7 SOLUTIONS_AUDIT_PRODUCTION.md.
 * Seules /register et /login sont concernées : ce sont les deux routes où
 * quelqu'un peut essayer de deviner un mot de passe ou créer des comptes en
 * masse. `skipSuccessfulRequests` : seules les tentatives ÉCHOUÉES comptent
 * dans la limite — quelqu'un qui finit par retrouver son mot de passe après
 * plusieurs essais n'est jamais bloqué par ses propres tentatives réussies.
 * Seuil (10) : plusieurs employés d'une même boutique partagent parfois une
 * seule connexion/IP, donc pas un seuil minimal type 3-5, mais resserré par
 * rapport à un premier essai à 20 (décidé en conversation).
 */
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    res.status(429).json({
      error: {
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Trop de tentatives. Réessayez dans quelques minutes.',
      },
    });
  },
});

router.post(
  '/register',
  authRateLimiter,
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
  authRateLimiter,
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