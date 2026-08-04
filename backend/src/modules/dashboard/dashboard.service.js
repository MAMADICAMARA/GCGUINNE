const pool = require('../../config/db');

/**
 * Statistiques du tableau de bord d'une boutique (§5.4 du cahier des
 * charges). Le bénéfice n'est calculé et renvoyé QUE pour le rôle OWNER —
 * ni Manager ni Vendeur n'ont accès aux bénéfices (cf. §3.1 : "voir les
 * bénéfices" ne figure que dans les droits Owner). Cette restriction est
 * appliquée ICI, côté serveur — jamais seulement cachée dans l'écran.
 *
 * Décidé en conversation : au-delà du bénéfice, TOUTE l'activité de vente
 * (chiffre d'affaires, commandes, articles vendus, top produits, tendance)
 * est désormais filtrée sur les propres ventes du Vendeur (o.seller_id)
 * quand roleCode n'est pas OWNER — l'Owner seul voit les totaux de toute
 * la boutique. Seul `lowStockCount` reste toujours à l'échelle de la
 * boutique : c'est un état du stock, pas une activité personnelle, il n'y
 * a pas de notion de "rupture de stock d'un vendeur en particulier".
 *
 * Décidé en conversation (§B1, annulation/retour de vente) : une commande
 * `VOIDED` est déjà exclue partout (elle n'a jamais compté). Mais une
 * commande `RETURNED`/`PARTIALLY_RETURNED` restait comptée EN ENTIER avant
 * ce correctif — un vrai trou, pas juste cosmétique : le chiffre d'affaires,
 * le bénéfice et les articles vendus doivent refléter uniquement ce que le
 * client a réellement gardé. `order_items.returned_quantity` (jamais
 * touché par une simple vente, incrémenté uniquement par un retour) porte
 * cette information ligne par ligne ; `orders.total_amount` n'est lui
 * jamais modifié (reste l'historique fidèle de la vente d'origine, cohérent
 * avec l'immuabilité déjà appliquée ailleurs — triggers prevent_delete /
 * prevent_order_item_core_update). Le montant retourné est donc toujours
 * recalculé à la volée (jamais stocké), en soustrayant la valeur retournée
 * (`returned_quantity * unit_price`) du total d'origine.
 */
async function getDashboardStats(storeId, roleCode, userId) {
  const includeProfit = roleCode === 'OWNER';
  const sellerFilter = roleCode === 'OWNER' ? '' : 'AND o.seller_id = $2';
  const sellerParams = roleCode === 'OWNER' ? [storeId] : [storeId, userId];

  // Sous-requête réutilisée par toutes les statistiques agrégées AU NIVEAU
  // COMMANDE (chiffre d'affaires) : valeur retournée par commande, 0 si
  // rien n'a jamais été retourné dessus.
  const returnedValueJoin = `
    LEFT JOIN (
      SELECT order_id, SUM(returned_quantity * unit_price) AS "returnedValue"
      FROM order_items GROUP BY order_id
    ) ret ON ret.order_id = o.id`;

  const [todayResult, itemsSoldResult, lowStockResult, topProductsResult, revenueTrendResult] =
    await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(o.total_amount - COALESCE(ret."returnedValue", 0)), 0) AS revenue,
                COUNT(*) AS "ordersCount"
         FROM orders o
         ${returnedValueJoin}
         WHERE o.store_id = $1 AND o.status != 'VOIDED' AND o.created_at >= CURRENT_DATE ${sellerFilter}`,
        sellerParams
      ),
      pool.query(
        `SELECT COALESCE(SUM(oi.quantity - oi.returned_quantity), 0) AS "itemsSold"
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.store_id = $1 AND o.status != 'VOIDED' AND o.created_at >= CURRENT_DATE ${sellerFilter}`,
        sellerParams
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM products
         WHERE store_id = $1 AND status = 'ACTIVE' AND quantity <= low_stock_threshold`,
        [storeId]
      ),
      pool.query(
        `SELECT p.id, p.name, SUM(oi.quantity - oi.returned_quantity) AS "totalSold"
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         JOIN products p ON p.id = oi.product_id
         WHERE o.store_id = $1 AND o.status != 'VOIDED'
           AND o.created_at >= NOW() - INTERVAL '30 days' ${sellerFilter}
         GROUP BY p.id, p.name
         HAVING SUM(oi.quantity - oi.returned_quantity) > 0
         ORDER BY "totalSold" DESC
         LIMIT 5`,
        sellerParams
      ),
      pool.query(
        `SELECT DATE(o.created_at) AS day,
                COALESCE(SUM(o.total_amount - COALESCE(ret."returnedValue", 0)), 0) AS revenue
         FROM orders o
         ${returnedValueJoin}
         WHERE o.store_id = $1 AND o.status != 'VOIDED'
           AND o.created_at >= NOW() - INTERVAL '6 days' ${sellerFilter}
         GROUP BY DATE(o.created_at)
         ORDER BY day`,
        sellerParams
      ),
    ]);

  let profitToday = null;
  if (includeProfit) {
    const profitResult = await pool.query(
      `SELECT COALESCE(SUM((oi.unit_price - p.purchase_price) * (oi.quantity - oi.returned_quantity)), 0) AS profit
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       WHERE o.store_id = $1 AND o.status != 'VOIDED' AND o.created_at >= CURRENT_DATE`,
      [storeId]
    );
    profitToday = profitResult.rows[0].profit;
  }

  const stats = {
    today: {
      revenue: todayResult.rows[0].revenue,
      ordersCount: parseInt(todayResult.rows[0].ordersCount, 10),
      itemsSold: parseInt(itemsSoldResult.rows[0].itemsSold, 10),
      profit: profitToday, // null si le rôle n'y a pas droit
    },
    lowStockCount: parseInt(lowStockResult.rows[0].count, 10),
    topProducts: topProductsResult.rows.map((r) => ({
      id: r.id,
      name: r.name,
      totalSold: parseInt(r.totalSold, 10),
    })),
    revenueTrend: revenueTrendResult.rows.map((r) => ({
      day: r.day,
      revenue: r.revenue,
    })),
  };

  // Statistiques par vendeur — réservées à l'Owner (cf. §5.4 : "visibles
  // uniquement par Manager/Owner" à l'origine, mais pas de rôle Manager —
  // abandonné, contexte guinéen), jamais renvoyées à un Vendeur.
  if (roleCode === 'OWNER') {
    const bySellerResult = await pool.query(
      `SELECT u.id AS "sellerId", u.full_name AS "sellerName",
              COUNT(o.id) AS "ordersCount",
              COALESCE(SUM(o.total_amount - COALESCE(ret."returnedValue", 0)), 0) AS revenue
       FROM orders o
       JOIN users u ON u.id = o.seller_id
       ${returnedValueJoin}
       WHERE o.store_id = $1 AND o.status != 'VOIDED'
         AND o.created_at >= NOW() - INTERVAL '30 days'
       GROUP BY u.id, u.full_name
       ORDER BY revenue DESC`,
      [storeId]
    );
    stats.bySeller = bySellerResult.rows.map((r) => ({
      sellerId: r.sellerId,
      sellerName: r.sellerName,
      ordersCount: parseInt(r.ordersCount, 10),
      revenue: r.revenue,
    }));
  }

  return stats;
}

module.exports = { getDashboardStats };