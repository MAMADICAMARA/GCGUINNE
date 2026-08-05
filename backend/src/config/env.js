require('dotenv').config();

/**
 * Point d'accès unique aux variables d'environnement.
 * Toute nouvelle variable d'environnement doit être ajoutée ici, avec une
 * valeur par défaut explicite ou une levée d'erreur si elle est obligatoire.
 */
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name}`);
  }
  return value;
}

// Avertissement bruyant si NODE_ENV n'est pas explicitement défini (§A6
// SOLUTIONS_AUDIT_PRODUCTION.md) : le repli silencieux vers 'development'
// ci-dessous retombe précisément sur le mode le MOINS sûr (CORS ouvert à
// toute origine, traces d'erreur détaillées renvoyées au client — voir
// app.js et middlewares/errorHandler.js). Un oubli de cette variable au
// déploiement ne doit jamais passer inaperçu dans les logs de démarrage.
if (!process.env.NODE_ENV) {
  // eslint-disable-next-line no-console
  console.warn(
    '\n⚠️  NODE_ENV non défini — démarrage en mode "development" par défaut ' +
      '(CORS ouvert à toute origine, erreurs détaillées renvoyées au client).\n' +
      '   Ne jamais lancer ainsi en production : définissez NODE_ENV=production ' +
      'dans le .env du serveur.\n'
  );
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  // Liste d'origines autorisées, séparées par des virgules dans le .env.
  // Ex: CORS_ORIGIN=http://localhost:5173,http://192.168.1.10:5173
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  databaseUrl: process.env.DATABASE_URL,

  jwt: {
    // Jamais de repli silencieux ici (§A2 SOLUTIONS_AUDIT_PRODUCTION.md) :
    // un secret JWT connu à l'avance permettrait de forger un jeton valide
    // pour n'importe quel compte, y compris Super Admin. Mieux vaut un
    // échec bruyant au démarrage qu'une faille silencieuse en production.
    secret: required('JWT_SECRET'),
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  // Stockage d'objets pour l'envoi direct d'images (§ cahier des charges
  // "Upload et stockage réel des images", décidé en conversation) —
  // volontairement PAS `required()` : contrairement au JWT_SECRET, l'envoi
  // de fichiers est une fonctionnalité optionnelle qui ne doit jamais
  // empêcher le reste de l'application de démarrer si elle n'est pas
  // encore configurée (le champ "coller un lien" continue de fonctionner
  // sans ça). `uploads.service.js` vérifie explicitement leur présence au
  // moment de l'appel, pas au démarrage.
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || null,
    accessKeyId: process.env.R2_ACCESS_KEY_ID || null,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || null,
    bucketName: process.env.R2_BUCKET_NAME || null,
    publicUrlBase: process.env.R2_PUBLIC_URL_BASE || null,
  },

  required,
};