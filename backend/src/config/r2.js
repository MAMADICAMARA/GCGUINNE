const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

/**
 * Client S3 configuré pour Cloudflare R2 (compatible API S3 — même code
 * fonctionnerait avec AWS S3 ou tout autre fournisseur compatible, seule
 * la configuration changerait). Instancié PARESSEUSEMENT (jamais au
 * chargement du module) : si R2 n'est pas configuré, le reste de
 * l'application démarre quand même normalement (§ cahier des charges
 * "Upload et stockage réel des images", décidé en conversation) — l'erreur
 * n'apparaît que si quelqu'un tente réellement un envoi de fichier.
 */
let cachedClient = null;

function isR2Configured() {
  return Boolean(env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.bucketName && env.r2.publicUrlBase);
}

function getR2Client() {
  if (!isR2Configured()) {
    throw new Error('R2 non configuré — variables R2_* absentes du .env.');
  }
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: 'auto',
      endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.r2.accessKeyId,
        secretAccessKey: env.r2.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

module.exports = { getR2Client, isR2Configured };
