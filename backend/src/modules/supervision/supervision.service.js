const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const dashboardService = require('../dashboard/dashboard.service');
const productsService = require('../products/products.service');
const ordersService = require('../orders/orders.service');
const { listStoreAuditLog } = require('../../utils/auditLog');
const { getEffectivePlan } = require('../../utils/planContext');

/**
 * Un Vendeur employé (rôle SELLER) n'a pas vocation à utiliser Superviser —
 * décidé en conversation : cette fonctionnalité vise les propriétaires et
 * les tiers sans rattachement (ex : un investisseur qui ne possède ni ne
 * travaille dans aucune boutique), pas le personnel salarié d'une boutique.
 * Distinction importante : "aucune boutique du tout" n'est PAS considéré
 * comme employé — seul un rattachement effectif en tant que SELLER (et
 * jamais OWNER par ailleurs) exclut la personne. Toujours vérifié en base,
 * jamais depuis le rôle de la boutique ACTIVE porté par le token (un Owner
 * travaillant temporairement ailleurs comme Vendeur doit quand même
 * garder accès).
 */
async function isEmployeeOnly(userId) {
  const { rows } = await pool.query(
    `SELECT r.code AS "roleCode" FROM user_store us JOIN roles r ON r.id = us.role_id WHERE us.user_id = $1`,
    [userId]
  );
  if (rows.length === 0) return false;
  return !rows.some((r) => r.roleCode === 'OWNER');
}

/**
 * Vérifie qu'un utilisateur a accès à une boutique en tant que propriétaire
 * OU superviseur, et — décidé en conversation — que c'est désormais
 * l'abonnement de la boutique SURVEILLÉE qui autorise la supervision,
 * jamais celui du superviseur. Raison : un superviseur peut très bien ne
 * posséder AUCUNE boutique lui-même (ex : un investisseur qui ne gère rien
 * en propre mais veut un œil sur plusieurs affaires tenues par d'autres) —
 * il n'y aurait alors rien dont vérifier "son" abonnement. À l'inverse,
 * faire reposer la règle sur la boutique surveillée ne coûte rien de plus
 * à vérifier (son plan est déjà chargé pour d'autres besoins) et reste
 * cohérent avec le principe "toujours revérifié en direct, jamais mis en
 * cache" déjà appliqué partout ailleurs : si la boutique surveillée
 * rétrograde en FREEMIUM, l'accès se coupe immédiatement, même si le lien
 * de supervision existe toujours en base.
 *
 * Le propriétaire de la boutique n'est jamais concerné par cette
 * vérification — voir SES PROPRES données ne dépend que de sa présence
 * comme owner_id, jamais d'un abonnement (la limitation par plan porte sur
 * la capacité d'un TIERS à le regarder, pas sur lui-même).
 */
async function verifyAccess(userId, storeId) {
  const ownerResult = await pool.query('SELECT 1 FROM stores WHERE id = $1 AND owner_id = $2', [
    storeId,
    userId,
  ]);
  if (ownerResult.rows.length > 0) return;

  const supervisorResult = await pool.query(
    'SELECT 1 FROM store_supervisors WHERE store_id = $1 AND supervisor_user_id = $2',
    [storeId, userId]
  );
  if (supervisorResult.rows.length === 0) {
    throw new AppError("Vous n'avez pas accès à cette boutique.", 403, 'FORBIDDEN');
  }

  const plan = await getEffectivePlan(storeId);
  if (!plan.allowsSupervision) {
    throw new AppError(
      "L'abonnement actuel de cette boutique n'autorise plus la supervision.",
      403,
      'PLAN_FEATURE_LOCKED'
    );
  }
}

/**
 * Liste les boutiques de tiers que cet utilisateur supervise via un code de
 * partage (store_supervisors), en lecture seule stricte. Les boutiques
 * qu'il POSSÈDE lui-même n'apparaissent volontairement pas ici (décidé en
 * conversation) — il y a déjà un accès complet à sa propre boutique via
 * "Ma Boutique"/le tableau de bord, l'afficher aussi ici serait une
 * duplication sans valeur ajoutée.
 *
 * Chaque boutique est renvoyée avec un aperçu du jour (chiffre d'affaires,
 * bénéfice, ruptures de stock) pour un coup d'œil rapide sans devoir entrer
 * dans chacune.
 */
async function listSupervisableStores(userId) {
  const storesResult = await pool.query(
    `SELECT s.id, s.name, s.city, s.category
     FROM stores s
     WHERE s.id IN (SELECT store_id FROM store_supervisors WHERE supervisor_user_id = $1)
     ORDER BY s.name ASC`,
    [userId]
  );
  const stores = storesResult.rows;
  if (stores.length === 0) return [];

  const storeIds = stores.map((s) => s.id);

  const [revenueResult, profitResult, lowStockResult, plans] = await Promise.all([
    pool.query(
      `SELECT store_id AS "storeId", COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE status != 'VOIDED' AND created_at >= CURRENT_DATE AND store_id = ANY($1::int[])
       GROUP BY store_id`,
      [storeIds]
    ),
    pool.query(
      `SELECT o.store_id AS "storeId",
              COALESCE(SUM((oi.unit_price - p.purchase_price) * oi.quantity), 0) AS profit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.status != 'VOIDED' AND o.created_at >= CURRENT_DATE AND o.store_id = ANY($1::int[])
       GROUP BY o.store_id`,
      [storeIds]
    ),
    pool.query(
      `SELECT store_id AS "storeId", COUNT(*) AS count
       FROM products
       WHERE status = 'ACTIVE' AND quantity <= low_stock_threshold AND store_id = ANY($1::int[])
       GROUP BY store_id`,
      [storeIds]
    ),
    // Un appel par boutique, mais réutilise la logique canonique de
    // getEffectivePlan (jamais dupliquée) plutôt que de recalculer
    // FREEMIUM/expiration à la main ici — le nombre de boutiques
    // supervisées par une même personne reste toujours modeste.
    Promise.all(storeIds.map((id) => getEffectivePlan(id))),
  ]);

  const revenueByStore = Object.fromEntries(revenueResult.rows.map((r) => [r.storeId, r.revenue]));
  const profitByStore = Object.fromEntries(profitResult.rows.map((r) => [r.storeId, r.profit]));
  const lowStockByStore = Object.fromEntries(
    lowStockResult.rows.map((r) => [r.storeId, parseInt(r.count, 10)])
  );
  const supervisionAllowedByStore = Object.fromEntries(
    stores.map((s, i) => [s.id, plans[i].allowsSupervision])
  );

  return stores.map((s) => {
    const supervisionAllowed = supervisionAllowedByStore[s.id];
    return {
      ...s,
      // Le lien de supervision existe toujours en base même si la boutique
      // a depuis rétrogradé — on continue de l'afficher (transparence :
      // "vous suivez toujours cette boutique") mais ni son aperçu chiffré
      // ni son détail (voir verifyAccess) ne restent visibles tant que son
      // abonnement ne le permet plus : les chiffres seraient sinon une
      // fuite qui contournerait exactement le blocage qu'on vient de poser.
      supervisionAllowed,
      todayRevenue: supervisionAllowed ? revenueByStore[s.id] || 0 : null,
      todayProfit: supervisionAllowed ? profitByStore[s.id] || 0 : null,
      lowStockCount: supervisionAllowed ? lowStockByStore[s.id] || 0 : null,
    };
  });
}

/**
 * Ajoute une boutique à ma liste de supervision, via son code de partage
 * (jamais son identifiant brut — cf. §12_supervision.sql). Rejette
 * d'emblée si l'abonnement ACTUEL de cette boutique n'autorise pas la
 * supervision — plutôt que de créer un lien qui ne servirait à rien tant
 * que son propriétaire n'aurait pas upgradé (cohérent avec verifyAccess,
 * qui revérifiera de toute façon ce même plan à chaque lecture).
 */
async function addSupervisedStore(userId, code) {
  if (!code || !code.trim()) {
    throw new AppError('Le code de supervision est requis.', 400, 'VALIDATION_ERROR');
  }

  const storeResult = await pool.query(
    'SELECT id, name, owner_id AS "ownerId" FROM stores WHERE supervision_code = $1',
    [code.trim().toUpperCase()]
  );
  if (storeResult.rows.length === 0) {
    throw new AppError('Code de supervision invalide.', 404, 'INVALID_CODE');
  }
  const store = storeResult.rows[0];

  if (store.ownerId === userId) {
    throw new AppError('Cette boutique est déjà la vôtre — elle apparaît automatiquement.', 400, 'ALREADY_OWNED');
  }

  const plan = await getEffectivePlan(store.id);
  if (!plan.allowsSupervision) {
    throw new AppError(
      "L'abonnement actuel de cette boutique n'autorise pas la supervision.",
      403,
      'PLAN_FEATURE_LOCKED'
    );
  }

  try {
    await pool.query(
      'INSERT INTO store_supervisors (store_id, supervisor_user_id) VALUES ($1, $2)',
      [store.id, userId]
    );
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Vous supervisez déjà cette boutique.', 409, 'ALREADY_SUPERVISING');
    }
    throw err;
  }

  return { storeId: store.id, storeName: store.name };
}

/**
 * Retire une boutique de MA liste de supervision (n'affecte que ma propre
 * ligne — n'importe qui avec le code peut se retirer à tout moment sans
 * intervention du propriétaire de la boutique supervisée).
 */
async function removeSupervisedStore(userId, storeId) {
  const { rowCount } = await pool.query(
    'DELETE FROM store_supervisors WHERE store_id = $1 AND supervisor_user_id = $2',
    [storeId, userId]
  );
  if (rowCount === 0) {
    throw new AppError('Vous ne supervisez pas cette boutique.', 404, 'NOT_SUPERVISING');
  }
  return { storeId, removed: true };
}

/**
 * Statistiques détaillées d'une boutique supervisée (ou possédée), en
 * lecture seule stricte. Vérifie l'autorisation directement en base
 * (propriétaire OU superviseur) — n'a rien à voir avec le mécanisme de
 * "boutique active" du token JWT, puisque la supervision porte justement
 * sur des boutiques qui ne sont PAS la boutique active de l'utilisateur.
 */
async function getSupervisedStoreStats(userId, storeId) {
  await verifyAccess(userId, storeId);

  const storeResult = await pool.query('SELECT id, name FROM stores WHERE id = $1', [storeId]);

  // roleCode forcé à 'OWNER' : quiconque a accès ici (propriétaire ou
  // superviseur muni du code) est, par construction, habilité à voir le
  // détail complet — y compris le bénéfice.
  const stats = await dashboardService.getDashboardStats(storeId, 'OWNER');

  return { store: storeResult.rows[0], stats };
}

/**
 * Catalogue produits d'une boutique supervisée — prix et quantités inclus
 * (décidé en conversation : contrairement à Fournisseurs, qui masque les
 * prix parce que c'est une entreprise tierce, le superviseur voit déjà le
 * bénéfice global de la boutique via getSupervisedStoreStats, donc les
 * prix ne sont pas une information supplémentaire sensible ici). Réutilise
 * directement productsService.listProducts, déjà strictement paramétré
 * par storeId.
 */
async function getSupervisedStoreProducts(userId, storeId, options) {
  await verifyAccess(userId, storeId);
  return productsService.listProducts(storeId, options);
}

/**
 * Historique des ventes d'une boutique supervisée — un jour précis à la
 * fois (§ décidé en conversation : sélecteur de date, pas une plage).
 * `date` (YYYY-MM-DD) par défaut sur aujourd'hui si absent. Réutilise
 * directement ordersService.getOrders, qui accepte déjà startDate/endDate
 * et renvoie client + statut de paiement + montant payé.
 */
async function getSupervisedStoreOrders(userId, storeId, options = {}) {
  await verifyAccess(userId, storeId);
  const day = options.date || new Date().toISOString().slice(0, 10);
  const startDate = `${day}T00:00:00.000Z`;
  const endDate = new Date(new Date(startDate).getTime() + 24 * 60 * 60 * 1000).toISOString();
  return ordersService.getOrders(storeId, { ...options, startDate, endDate });
}

/**
 * Détail d'une vente précise (avec ses produits) dans une boutique
 * supervisée — réutilise ordersService.getOrderById tel quel.
 */
async function getSupervisedStoreOrder(userId, storeId, orderId) {
  await verifyAccess(userId, storeId);
  return ordersService.getOrderById(storeId, orderId);
}

/**
 * Mouvements de stock (ajustements, ventes, achats...) d'une boutique
 * supervisée, à l'échelle de toute la boutique — réutilise
 * productsService.getStoreStockMovements (§20250801_stock_movements).
 */
async function getSupervisedStoreStockMovements(userId, storeId, options) {
  await verifyAccess(userId, storeId);
  return productsService.getStoreStockMovements(storeId, options);
}

/**
 * Journal d'activité d'une boutique supervisée — réutilise le même
 * utilitaire que la boutique propre de l'Owner (backend/src/utils/auditLog.js).
 */
async function getSupervisedStoreAuditLog(userId, storeId, options) {
  await verifyAccess(userId, storeId);
  return listStoreAuditLog(storeId, options);
}

module.exports = {
  isEmployeeOnly,
  listSupervisableStores,
  addSupervisedStore,
  removeSupervisedStore,
  getSupervisedStoreStats,
  getSupervisedStoreProducts,
  getSupervisedStoreOrders,
  getSupervisedStoreOrder,
  getSupervisedStoreStockMovements,
  getSupervisedStoreAuditLog,
};