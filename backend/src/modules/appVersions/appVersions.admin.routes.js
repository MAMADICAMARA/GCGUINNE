const { Router } = require('express');
const multer = require('multer');
const { body, param, validationResult } = require('express-validator');
const appVersionsService = require('./appVersions.service');
const { requireAuth, requireSuperAdmin } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

// Réservé au Super Admin (§ cahier des charges "Système de notification de
// mise à jour", décidé en conversation) — même garde exacte que le reste
// de l'espace admin (admin.routes.js).
router.use(requireAuth, requireSuperAdmin);

function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR'));
  }
  next();
}

router.get('/', async (req, res, next) => {
  try {
    const versions = await appVersionsService.listVersions();
    res.json({ versions });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  [
    body('versionCode').isInt({ min: 1 }).withMessage('Le numéro de version (code) doit être un entier positif.'),
    body('versionName').trim().notEmpty().withMessage('Le nom de version est requis.'),
    body('updateLevel')
      .isIn(appVersionsService.UPDATE_LEVELS)
      .withMessage('Niveau de mise à jour invalide.'),
  ],
  checkValidation,
  async (req, res, next) => {
    try {
      const version = await appVersionsService.createVersion(req.auth.userId, req.body);
      res.status(201).json(version);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/:id/links',
  [
    param('id').isInt().withMessage('Identifiant de version invalide.'),
    body('label').trim().notEmpty().withMessage('Le libellé du lien est requis.'),
    body('url').trim().notEmpty().withMessage('Le lien est requis.'),
  ],
  checkValidation,
  async (req, res, next) => {
    try {
      const link = await appVersionsService.addExternalLink(req.params.id, req.body);
      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }
);

// Mémoire uniquement, jamais disque (même principe que uploads.routes.js) —
// le fichier part directement vers R2 depuis le buffer. 250 Mo (décidé en
// conversation) — nettement plus volumineux que les images produits,
// `limits.fileSize` rejette PENDANT la réception, jamais après avoir tout
// accumulé en mémoire pour rien.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: appVersionsService.MAX_APK_FILE_SIZE_BYTES },
});

router.post(
  '/upload-apk',
  // multer DOIT tourner avant la validation express-validator ci-dessous —
  // req.body n'est peuplé pour un multipart/form-data qu'une fois multer
  // passé (les parseurs json/urlencoded d'app.js ne le font pas), sans
  // quoi `body('appVersionId')` valide un champ toujours vide.
  (req, res, next) => {
    upload.single('apk')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('Le fichier dépasse la taille maximale autorisée (250 Mo).', 400, 'FILE_TOO_LARGE'));
      }
      return next(new AppError('Fichier invalide.', 400, 'INVALID_FILE_TYPE'));
    });
  },
  [body('appVersionId').isInt().withMessage('Identifiant de version invalide.')],
  checkValidation,
  async (req, res, next) => {
    try {
      if (!req.file) {
        throw new AppError('Aucun fichier reçu.', 400, 'VALIDATION_ERROR');
      }
      const link = await appVersionsService.uploadApk(req.body.appVersionId, req.file.buffer, req.body.label);
      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }
);

router.delete(
  '/:id/links/:linkId',
  [
    param('id').isInt().withMessage('Identifiant de version invalide.'),
    param('linkId').isInt().withMessage('Identifiant de lien invalide.'),
  ],
  checkValidation,
  async (req, res, next) => {
    try {
      const result = await appVersionsService.removeLink(req.params.id, req.params.linkId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
