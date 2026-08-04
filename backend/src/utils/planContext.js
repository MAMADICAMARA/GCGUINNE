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
 * Si le plan payant de la boutique est expiré (ou qu'aucun plan n'est
 * défini), retombe silencieusement sur FREEMIUM — sans jamais modifier
 * `stores.plan_id` en base : la "désactivation" explicite reste un acte
 * du Super Admin (cf. admin.service.js#deactivateStorePlan), l'expiration
 * naturelle ne fait que changer le comportement observé.
 */
async function getEffectivePlan(storeId) {
  const { rows } = await pool.query(
    `SELECT s.plan_expires_at AS "planExpiresAt",
            sp.name AS "planName", sp.max_users_per_store AS "maxUsersPerStore",
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
    const freemiumResult = await pool.query(
      `SELECT name, max_users_per_store AS "maxUsersPerStore",
              allows_supervision AS "allowsSupervision", allows_suppliers AS "allowsSuppliers",
              allows_purchase_orders AS "allowsPurchaseOrders"
       FROM subscription_plans WHERE name = 'FREEMIUM'`
    );
    const freemium = freemiumResult.rows[0];
    return {
      planName: freemium.name,
      maxUsersPerStore: freemium.maxUsersPerStore,
      allowsSupervision: freemium.allowsSupervision,
      allowsSuppliers: freemium.allowsSuppliers,
      allowsPurchaseOrders: freemium.allowsPurchaseOrders,
      planExpiresAt: store.planExpiresAt,
      isEffectivelyFreemium: true,
    };
  }

  return {
    planName: store.planName,
    maxUsersPerStore: store.maxUsersPerStore,
    allowsSupervision: store.allowsSupervision,
    allowsSuppliers: store.allowsSuppliers,
    allowsPurchaseOrders: store.allowsPurchaseOrders,
    planExpiresAt: store.planExpiresAt,
    isEffectivelyFreemium: store.planName === 'FREEMIUM',
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
