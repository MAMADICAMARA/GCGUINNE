const { Router } = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');
const { MAX_FILE_SIZE_BYTES } = require('./uploads.service');
const { uploadImageController } = require('./uploads.controller');

const router = Router();

// Aucun envoi anonyme (§8 du cahier des charges "Upload et stockage réel
// des images", décidé en conversation) — même protection que le reste de
// l'API, pas d'exception pour cet endpoint.
router.use(requireAuth, requireActiveStore);

// Mémoire uniquement, jamais disque (§3 du cahier des charges) : le
// fichier ne doit jamais toucher le disque éphémère du serveur, il part
// directement vers R2 depuis le buffer. `limits.fileSize` rejette un
// fichier trop volumineux PENDANT la réception, pas après l'avoir
// entièrement accumulé en mémoire.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
});

// Dédiée, plus stricte que la limite globale de app.js — même principe
// que authRateLimiter (auth.routes.js, §A7 SOLUTIONS_AUDIT_PRODUCTION.md) :
// empêche de saturer le stockage/la bande passante par des envois répétés.
// Authentifié uniquement (contrairement à l'auth), seuil plus généreux.
const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      error: { code: 'TOO_MANY_UPLOADS', message: 'Trop d\'envois. Réessayez dans quelques minutes.' },
    });
  },
});

router.post(
  '/image',
  uploadRateLimiter,
  (req, res, next) => {
    upload.single('image')(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new AppError('Le fichier dépasse la taille maximale autorisée (2 Mo).', 400, 'FILE_TOO_LARGE')
        );
      }
      return next(new AppError('Fichier invalide.', 400, 'INVALID_FILE_TYPE'));
    });
  },
  uploadImageController
);

module.exports = router;
