const { PrismaClient } = require('@prisma/client');
const env = require('./env');

/**
 * Instance unique du client Prisma, partagée par toute l'application.
 * Ne jamais instancier PrismaClient ailleurs dans le code.
 */
const prisma = new PrismaClient({
  log: env.nodeEnv === 'development' ? ['warn', 'error'] : ['error'],
});

module.exports = prisma;
