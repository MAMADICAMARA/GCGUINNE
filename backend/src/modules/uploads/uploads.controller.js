const { AppError } = require('../../middlewares/errorHandler');
const { uploadImage } = require('./uploads.service');

// Organise seulement le préfixe de la clé dans le bucket (aucune
// conséquence fonctionnelle) — liste fermée pour ne jamais laisser un
// champ texte arbitraire du client influencer le chemin de stockage.
const ALLOWED_CONTEXTS = new Set(['products', 'stores/logos']);

async function uploadImageController(req, res, next) {
  try {
    if (!req.file) {
      throw new AppError('Aucun fichier reçu.', 400, 'VALIDATION_ERROR');
    }
    const context = ALLOWED_CONTEXTS.has(req.body.context) ? req.body.context : 'misc';
    const url = await uploadImage(req.file.buffer, context);
    res.status(201).json({ url });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadImageController };
