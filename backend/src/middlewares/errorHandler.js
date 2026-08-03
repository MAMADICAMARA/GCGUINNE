const env = require('../config/env');

/**
 * Erreur métier normalisée. À utiliser dans toute la couche services/
 * pour que le frontend reçoive toujours un code et un message exploitables
 * (cf. cahier des charges §14 : "codes d'erreur métier normalisés").
 */
class AppError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}


function notFoundHandler(req, res, next) {
  next(new AppError(`Route non trouvée : 
    ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  if (statusCode >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'Une erreur inattendue est survenue.',
      ...(env.nodeEnv === 'development' ? { stack: err.stack } : {}),
    },
  });
  
}

module.exports = { AppError, notFoundHandler, errorHandler };
