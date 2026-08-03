const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const env = require('./config/env');
const routes = require('./routes');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

// --- Sécurité et bonnes pratiques transverses ---
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      // Requêtes sans en-tête Origin (ex: curl, Postman, health check interne)
      if (!origin) return callback(null, true);

      // En développement, on accepte toute origine locale ou réseau (ex:
      // accès depuis une IP LAN/WSL, un autre appareil du même réseau) pour
      // ne pas bloquer inutilement le travail de l'équipe. La liste stricte
      // définie par CORS_ORIGIN reste appliquée en production.
      if (env.nodeEnv === 'development') return callback(null, true);

      if (env.corsOrigins.includes(origin)) return callback(null, true);

      return callback(new Error(`Origine non autorisée par CORS : ${origin}`));
    },
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv === 'development') {
  app.use(morgan('dev'));
}

// Limite le nombre de requêtes par IP pour se prémunir des abus /
// attaques par force brute, notamment sur les routes d'authentification.
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

// --- Routes applicatives ---
app.use(env.apiPrefix, routes);

// --- Gestion des erreurs (toujours en dernier) ---
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;