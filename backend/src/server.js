const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`API démarrée sur http://localhost:${env.port}${env.apiPrefix}`);
  // eslint-disable-next-line no-console
  console.log(`Environnement : ${env.nodeEnv}`);
});

/**
 * Arrêt propre du serveur (utile en conteneur / orchestrateur).
 */
function shutdown(signal) {
  // eslint-disable-next-line no-console
  console.log(`Signal ${signal} reçu, arrêt du serveur...`);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

/**
 * Filet de sécurité : sans ça, la moindre erreur asynchrone échappant au
 * try/catch d'une route (promesse rejetée non attrapée, callback tardif...)
 * tue tout le process Node instantanément — le serveur "s'arrête tout seul"
 * sans rien logguer d'exploitable, et rien ne le relance puisque `npm start`
 * n'utilise pas nodemon. On logue l'erreur réelle et on garde le serveur en
 * vie plutôt que de le laisser mourir en silence.
 */
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('Promesse rejetée non gérée :', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('Exception non gérée :', err);
});
