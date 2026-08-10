const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const contactService = require('./contact.service');
const { requireAuth } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Uniquement requireAuth — jamais requireActiveStore : un utilisateur sans
// boutique active (ex. Owner qui n'a pas encore créé la sienne) doit quand
// même pouvoir contacter la plateforme (§ décidé en conversation).
router.use(requireAuth);

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/subject-categories', (req, res) => {
  res.json({ categories: contactService.SUBJECT_CATEGORIES });
});

router.post(
  '/messages',
  [
    body('subject').trim().notEmpty().withMessage("L'objet du message est requis."),
    body('message').trim().notEmpty().withMessage('Décrivez votre demande avant de l\'envoyer.'),
  ],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await contactService.createMessage(
        req.auth.userId,
        req.auth.storeId,
        req.body.subject,
        req.body.message
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Liens "Rejoignez la communauté" — lecture publique (tout utilisateur
// authentifié), ne montre que les liens actifs. La gestion (créer/modifier/
// supprimer) est réservée au Super Admin, exposée sous /admin (voir
// admin.routes.js), jamais ici.
router.get('/social-links', async (req, res, next) => {
  try {
    const links = await contactService.listSocialLinks({ activeOnly: true });
    res.json({ links });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
