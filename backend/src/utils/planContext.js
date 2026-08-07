const pool = require('../config/db');
const { AppError } = require('../middlewares/errorHandler');

/**
 * Calcule le plan RÉELLEMENT actif d'une boutique à l'instant présent
 * (§20_plans_abonnement.sql). Jamais mis en cache (token JWT ou ailleurs) :
 * toujours recalculé en base à chaque appel, car un abonnement peut
 * expirer à tout moment pendant qu'une session est ouverte — même
 * principe que le reste du projet (rôle/boutiques toujours relus en base,
 * jamais fait confiance à un token périmé).
 *
 * Le plan gratuit n'est JAMAIS identifié par son nom (modifiable par le
 * Super Admin depuis Admin > Plans) mais par `price = 0`, seul identifiant
 * stable — un renommage en base ne doit jamais casser cette logique.
 *
 * Si le plan payant de la boutique est expiré (ou qu'aucun plan n'est
 * défini), retombe silencieusement sur le plan gratuit — sans jamais
 * modifier `stores.plan_id` en base : la "désactivation" explicite reste
 * un acte du Super Admin (cf. admin.service.js#deactivateStorePlan),
 * l'expiration naturelle ne fait que changer le comportement observé.
 */
async function getEffectivePlan(storeId) {
  const { rows } = await pool.query(
    `SELECT s.plan_expires_at AS "planExpiresAt",
            sp.name AS "planName", sp.price AS "planPrice",
            sp.max_users_per_store AS "maxUsersPerStore",
            sp.allows_supervision AS "allowsSupervision", sp.allows_suppliers AS "allowsSuppliers",
            sp.allows_purchase_orders AS "allowsPurchaseOrders"
     FROM stores s
     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.id = $1`,
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  const store = rows[0];
  const isExpired = store.planExpiresAt && new Date(store.planExpiresAt) <= new Date();

  if (!store.planName || isExpired) {
    const freeResult = await pool.query(
      `SELECT name, max_users_per_store AS "maxUsersPerStore",
              allows_supervision AS "allowsSupervision", allows_suppliers AS "allowsSuppliers",
              allows_purchase_orders AS "allowsPurchaseOrders"
       FROM subscription_plans WHERE price = 0 ORDER BY id ASC LIMIT 1`
    );
    if (freeResult.rows.length === 0) {
      throw new AppError('Plan gratuit introuvable — configuration incohérente.', 500, 'FREE_PLAN_MISSING');
    }
    const freePlan = freeResult.rows[0];
    return {
      planName: freePlan.name,
      maxUsersPerStore: freePlan.maxUsersPerStore,
      allowsSupervision: freePlan.allowsSupervision,
      allowsSuppliers: freePlan.allowsSuppliers,
      allowsPurchaseOrders: freePlan.allowsPurchaseOrders,
      planExpiresAt: store.planExpiresAt,
      isEffectivelyFreemium: true,
      expired: Boolean(isExpired),
      previousPlanName: isExpired ? store.planName : null,
    };
  }

  return {
    planName: store.planName,
    maxUsersPerStore: store.maxUsersPerStore,
    allowsSupervision: store.allowsSupervision,
    allowsSuppliers: store.allowsSuppliers,
    allowsPurchaseOrders: store.allowsPurchaseOrders,
    planExpiresAt: store.planExpiresAt,
    isEffectivelyFreemium: Number(store.planPrice) === 0,
    expired: false,
    previousPlanName: null,
  };
}

/**
 * Variante pour les modules non "scoped boutique active" (ex: Superviser,
 * qui porte par nature sur plusieurs boutiques indépendamment de celle
 * choisie dans le token) — résout la boutique que l'utilisateur POSSÈDE
 * (owner_id), pas une boutique active.
 */
async function getEffectivePlanForOwnedStore(userId) {
  const { rows } = await pool.query('SELECT id FROM stores WHERE owner_id = $1', [userId]);
  if (rows.length === 0) {
    throw new AppError('Vous ne possédez aucune boutique.', 403, 'NOT_AN_OWNER');
  }
  return getEffectivePlan(rows[0].id);
}

module.exports = { getEffectivePlan, getEffectivePlanForOwnedStore };
