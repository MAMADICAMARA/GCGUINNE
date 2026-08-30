const { Router } = require('express');
const { param, query, validationResult } = require('express-validator');
const marketplaceService = require('./marketplace.service');
const { optionalAuth } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

// Public — la page racine (§ décidé en conversation) doit savoir si MARCHÉ
// est activé AVANT même qu'un visiteur soit connecté, donc avant de
// pouvoir appeler la moindre route protégée. Jamais /admin/platform-settings
// ici : celle-ci reste réservée au Super Admin pour la gestion réelle.
router.get('/status', async (req, res, next) => {
  try {
    const enabled = await marketplaceService.isMarketplaceEnabled();
    res.json({ enabled });
  } catch (err) {
    next(err);
  }
});

// Public — grille (§7, niveau grille). Projection volontairement limitée,
// contrôlée dans le service, jamais ici.
// `search` (§ barre de recherche, décidé en conversation) : paramètre de
// requête optionnel, transmis tel quel au service qui l'utilise pour
// filtrer par nom/référence — jamais interprété ici, aucune logique de
// recherche dans la couche route.
router.get(
  '/products',
  [query('search').optional().isString().trim().isLength({ max: 200 }).withMessage('Recherche invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const products = await marketplaceService.listPublicProducts(req.query.search);
      res.json({ products });
    } catch (err) {
      next(err);
    }
  }
);

// Public — page produit (§7, niveau page). Volontairement sans requireAuth
// (§ partage MARCHÉ sur les réseaux sociaux, décidé en conversation) : un
// lien de produit partagé doit s'ouvrir pour n'importe quel visiteur.
// optionalAuth (jamais requireAuth) : peuple req.auth SI une session est
// présente, sans jamais bloquer un visiteur anonyme — sert uniquement à
// décider, dans le service, si les coordonnées de la boutique
// (propriétaire/adresse/téléphone) doivent être incluses ou masquées.
router.get(
  '/products/:id',
  optionalAuth,
  [param('id').isInt().withMessage('Identifiant de produit invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      const product = await marketplaceService.getPublicProductDetail(req.params.id, Boolean(req.auth));
      res.json(product);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;

// const { Router } = require('express');
// const { param, validationResult } = require('express-validator');
// const marketplaceService = require('./marketplace.service');
// const { optionalAuth } = require('../../middlewares/auth');
// const { AppError } = require('../../middlewares/errorHandler');

// const router = Router();

// function checkValidation(req, res, next) {
//   const errors = validationResult(req);
//   if (!errors.isEmpty()) {
//     return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
//   }
//   next();
// }

// // Public — la page racine (§ décidé en conversation) doit savoir si MARCHÉ
// // est activé AVANT même qu'un visiteur soit connecté, donc avant de
// // pouvoir appeler la moindre route protégée. Jamais /admin/platform-settings
// // ici : celle-ci reste réservée au Super Admin pour la gestion réelle.
// router.get('/status', async (req, res, next) => {
//   try {
//     const enabled = await marketplaceService.isMarketplaceEnabled();
//     res.json({ enabled });
//   } catch (err) {
//     next(err);
//   }
// });

// // Public — grille (§7, niveau grille). Projection volontairement limitée,
// // contrôlée dans le service, jamais ici.
// router.get('/products', async (req, res, next) => {
//   try {
//     const products = await marketplaceService.listPublicProducts();
//     res.json({ products });
//   } catch (err) {
//     next(err);
//   }
// });

// // Public — page produit (§7, niveau page). Volontairement sans requireAuth
// // (§ partage MARCHÉ sur les réseaux sociaux, décidé en conversation) : un
// // lien de produit partagé doit s'ouvrir pour n'importe quel visiteur.
// // optionalAuth (jamais requireAuth) : peuple req.auth SI une session est
// // présente, sans jamais bloquer un visiteur anonyme — sert uniquement à
// // décider, dans le service, si les coordonnées de la boutique
// // (propriétaire/adresse/téléphone) doivent être incluses ou masquées.
// router.get(
//   '/products/:id',
//   optionalAuth,
//   [param('id').isInt().withMessage('Identifiant de produit invalide.')],
//   checkValidation,
//   async (req, res, next) => {
//     try {
//       const product = await marketplaceService.getPublicProductDetail(req.params.id, Boolean(req.auth));
//       res.json(product);
//     } catch (err) {
//       next(err);
//     }
//   }
// );

// module.exports = router;
