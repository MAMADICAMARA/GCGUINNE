const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const env = require('../config/env');
const { AppError } = require('./errorHandler');
const { getEffectivePlan } = require('../utils/planContext');

const SESSION_INVALID_ERROR = () =>
  new AppError('Session invalide ou expirée.', 401, 'INVALID_TOKEN');

/**
 * Vérifie la présence et la validité du jeton de session, PUIS que son
 * numéro de version correspond toujours à celui en base
 * (§A5 SOLUTIONS_AUDIT_PRODUCTION.md, décidé en conversation) — sans ça, un
 * compte dont on retire la confiance (retrait Super Admin, retrait d'un
 * employé, transfert de propriété) garderait un accès valide jusqu'à
 * l'expiration naturelle du jeton (jusqu'à 8h, cf. JWT_EXPIRES_IN). Une
 * lecture indexée sur la clé primaire de `users`, donc rapide — même
 * principe que le statut de plan déjà revérifié en base à chaque requête
 * dans requireActiveStore plus bas, jamais fait confiance à une donnée
 * embarquée dans le jeton pour ce qui touche à l'identité/aux droits.
 *
 * Le jeton doit porter : l'identité de l'utilisateur ET, une fois choisie,
 * la boutique active (cf. cahier des charges §6.1 et §9.1).
 *
 * req.auth sera de la forme : { userId, storeId, roleCode, isSuperAdmin, tokenVersion }
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwt.secret);
  } catch (err) {
    return next(SESSION_INVALID_ERROR());
  }

  try {
    const { rows } = await pool.query(
      'SELECT token_version AS "tokenVersion" FROM users WHERE id = $1',
      [payload.userId]
    );
    if (rows.length === 0 || rows[0].tokenVersion !== payload.tokenVersion) {
      return next(SESSION_INVALID_ERROR());
    }
    req.auth = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Vérifie que le rôle porté par le jeton fait partie des rôles autorisés
 * pour la route. Ceci est un premier filtre grossier ; les permissions
 * fines (JSON dans user_store) devront être vérifiées au cas par cas dans
 * la couche service, jamais uniquement ici.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.auth) {
      return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
    }
    if (!allowedRoles.includes(req.auth.roleCode)) {
      return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
    }
    next();
  };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Vérifie qu'une boutique active est bien présente dans le jeton.
 * Nécessaire pour toute route métier (produits, ventes, stock...) : un
 * propriétaire multi-boutiques dont le jeton ne porte pas encore de
 * storeId (avant l'appel à /auth/switch-store) ne doit pas pouvoir
 * atteindre ces routes (cf. §6.1 du cahier des charges).
 *
 * Point d'entrée unique du gel en lecture seule (§20_plans_abonnement.sql,
 * décidé en conversation) : si la boutique est retombée en FREEMIUM
 * (expiration ou désactivation par le Super Admin) et que le rôle courant
 * n'est pas Owner, toute écriture (méthode non GET/HEAD/OPTIONS) est
 * bloquée — la lecture reste intacte. L'Owner n'est jamais concerné
 * (FREEMIUM garantit toujours un accès complet solo). Branché ici plutôt
 * que dans chaque module boutique : requireActiveStore est déjà le point
 * de passage commun à tous (produits, ventes, stock, clients, notes...).
 */
async function requireActiveStore(req, res, next) {
  if (!req.auth) {
    return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
  }
  if (!req.auth.storeId) {
    return next(new AppError('Veuillez sélectionner une boutique active.', 400, 'NO_ACTIVE_STORE'));
  }

  if (SAFE_METHODS.has(req.method) || req.auth.roleCode === 'OWNER') {
    return next();
  }

  try {
    const plan = await getEffectivePlan(req.auth.storeId);
    if (plan.isEffectivelyFreemium) {
      return next(
        new AppError(
          'Cette boutique fonctionne actuellement en mode gratuit — contactez votre responsable.',
          403,
          'PLAN_READ_ONLY_MODE'
        )
      );
    }
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Réserve une route au Super Admin de la plateforme (§3.1 du cahier des
 * charges). Rôle indépendant de toute boutique — porté par un attribut
 * direct sur users (is_super_admin), jamais via user_store.
 */
function requireSuperAdmin(req, res, next) {
  if (!req.auth) {
    return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
  }
  if (!req.auth.isSuperAdmin) {
    return next(new AppError('Réservé au Super Admin de la plateforme.', 403, 'FORBIDDEN'));
  }
  next();
}

module.exports = { requireAuth, requireRole, requireActiveStore, requireSuperAdmin };


// const jwt = require('jsonwebtoken');
// const env = require('../config/env');
// const { AppError } = require('./errorHandler');

// /**
//  * Vérifie la présence et la validité du jeton de session.
//  * Le jeton doit porter : l'identité de l'utilisateur ET, une fois choisie,
//  * la boutique active (cf. cahier des charges §6.1 et §9.1).
//  *
//  * req.auth sera de la forme : { userId, storeId, roleCode }
//  */
// function requireAuth(req, res, next) {
//   const header = req.headers.authorization || '';
//   const token = header.startsWith('Bearer ') ? header.slice(7) : null;

//   if (!token) {
//     return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
//   }

//   try {
//     req.auth = jwt.verify(token, env.jwt.secret);
//     next();
//   } catch (err) {
//     next(new AppError('Session invalide ou expirée.', 401, 'INVALID_TOKEN'));
//   }
// }

// /**
//  * Vérifie que le rôle porté par le jeton fait partie des rôles autorisés
//  * pour la route. Ceci est un premier filtre grossier ; les permissions
//  * fines (JSON dans user_store) devront être vérifiées au cas par cas dans
//  * la couche service, jamais uniquement ici.
//  */
// function requireRole(...allowedRoles) {
//   return (req, res, next) => {
//     if (!req.auth) {
//       return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
//     }
//     if (!allowedRoles.includes(req.auth.roleCode)) {
//       return next(new AppError("Vous n'avez pas la permission d'effectuer cette action.", 403, 'FORBIDDEN'));
//     }
//     next();
//   };
// }

// /**
//  * Vérifie qu'une boutique active est bien présente dans le jeton.
//  * Nécessaire pour toute route métier (produits, ventes, stock...) : un
//  * propriétaire multi-boutiques dont le jeton ne porte pas encore de
//  * storeId (avant l'appel à /auth/switch-store) ne doit pas pouvoir
//  * atteindre ces routes (cf. §6.1 du cahier des charges).
//  */
// function requireActiveStore(req, res, next) {
//   if (!req.auth) {
//     return next(new AppError('Authentification requise.', 401, 'UNAUTHENTICATED'));
//   }
//   if (!req.auth.storeId) {
//     return next(new AppError('Veuillez sélectionner une boutique active.', 400, 'NO_ACTIVE_STORE'));
//   }
//   next();
// }

// module.exports = { requireAuth, requireRole, requireActiveStore };