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
    secret: process.env.JWT_SECRET || 'dev_secret_do_not_use_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  },

  bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12,

  required,
};