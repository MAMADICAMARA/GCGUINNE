const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { fileTypeFromBuffer } = require('file-type');
const { getR2Client, isR2Configured } = require('../../config/r2');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/errorHandler');

// Correspond exactement à §7.1 du cahier des charges — jamais élargi sans
// décision explicite (ex: SVG serait un vecteur XSS si jamais affiché
// directement, GIF poserait la question de l'animation, etc.).
const ALLOWED_MIME_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo, §7.2

/**
 * Envoie un fichier image vers R2 et renvoie son URL publique — jamais son
 * nom original (§7.3 : risque de collision/traversée de chemin), toujours
 * un identifiant aléatoire. Le type est déterminé par lecture des premiers
 * octets du fichier lui-même (§7.4), jamais par l'extension ou le
 * Content-Type déclaré par le navigateur — les deux peuvent être
 * falsifiés, la détection par contenu réel ne peut pas l'être aussi
 * facilement (ex: un PDF renommé en .jpg est détecté comme PDF, refusé).
 *
 * `context` ('products' | 'stores/logos') ne sert qu'à organiser le
 * préfixe de la clé dans le bucket — aucune conséquence fonctionnelle,
 * juste un bucket plus lisible si un nettoyage manuel est un jour
 * nécessaire.
 */
async function uploadImage(buffer, context) {
  if (!isR2Configured()) {
    throw new AppError(
      "L'envoi d'images n'est pas configuré sur ce serveur — utilisez le champ lien.",
      500,
      'UPLOAD_NOT_CONFIGURED'
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  const extension = detected && ALLOWED_MIME_TYPES[detected.mime];
  if (!extension) {
    throw new AppError(
      "Ce fichier n'est pas une image reconnue (JPEG, PNG ou WebP uniquement).",
      400,
      'INVALID_FILE_TYPE'
    );
  }

  const key = `${context}/${crypto.randomUUID()}.${extension}`;

  try {
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: detected.mime,
      })
    );
  } catch (err) {
    // Jamais renvoyer le détail de l'erreur SDK au client (peut contenir
    // des informations sur la configuration interne) — même principe que
    // le reste de l'app en production (middlewares/errorHandler.js).
    // eslint-disable-next-line no-console
    console.error('Échec de l\'envoi vers R2 :', err.message);
    throw new AppError("L'envoi de l'image a échoué — réessayez.", 500, 'UPLOAD_FAILED');
  }

  return `${env.r2.publicUrlBase}/${key}`;
}

module.exports = { uploadImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES };
