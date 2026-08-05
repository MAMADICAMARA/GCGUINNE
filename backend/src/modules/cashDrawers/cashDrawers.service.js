const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Sessions de caisse (§05_caisses.sql, activé par §30_fond_de_caisse.sql,
 * décidé en conversation — §B2 SOLUTIONS_AUDIT_PRODUCTION.md). Un
 * vendeur ouvre sa caisse en déclarant un fond de départ, chaque vente en
 * espèces qu'il encaisse s'ajoute automatiquement au solde théorique (voir
 * le trigger `update_cash_drawer_expected_balance`, jamais dupliqué ici) —
 * à la fermeture, il compte l'argent réel et l'écart éventuel (théorique
 * moins compté) devient immédiatement visible, attribuable à SA session
 * précise plutôt qu'un flou de fin de journée mélangeant plusieurs
 * vendeurs. Fonctionnalité entièrement optionnelle : une vente en espèces
 * sans caisse ouverte fonctionne exactement comme avant (orders.service.js
 * ne rattache `cash_drawer_id` que si une caisse est ouverte).
 *
 * Ne touche jamais à l'annulation/au retour de vente (§B1, décidé en
 * conversation) : ce système ne modélise pas les remboursements en
 * espèces, un remboursement physique éventuel se verra simplement comme un
 * écart à la fermeture.
 */

async function getMyCurrentDrawer(storeId, userId) {
  const { rows } = await pool.query(
    `SELECT id, opening_time AS "openingTime", opening_balance AS "openingBalance",
            expected_balance AS "expectedBalance", status
     FROM cash_drawers
     WHERE store_id = $1 AND user_id = $2 AND status = 'OPEN'`,
    [storeId, userId]
  );
  return rows[0] || null;
}

async function openDrawer(storeId, userId, openingBalance) {
  if (typeof openingBalance !== 'number' || openingBalance < 0) {
    throw new AppError('Le fond de caisse de départ est invalide.', 400, 'VALIDATION_ERROR');
  }

  const existing = await getMyCurrentDrawer(storeId, userId);
  if (existing) {
    throw new AppError(
      'Vous avez déjà une caisse ouverte — fermez-la avant d\'en ouvrir une nouvelle.',
      409,
      'DRAWER_ALREADY_OPEN'
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO cash_drawers (store_id, user_id, opening_balance, expected_balance, status)
     VALUES ($1, $2, $3, $3, 'OPEN')
     RETURNING id, opening_time AS "openingTime", opening_balance AS "openingBalance",
               expected_balance AS "expectedBalance", status`,
    [storeId, userId, openingBalance]
  );

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'OPEN_CASH_DRAWER', $3::jsonb)`,
    [userId, storeId, JSON.stringify({ drawerId: rows[0].id, openingBalance })]
  );

  return rows[0];
}

/**
 * Ferme LA caisse actuellement ouverte de cet utilisateur — jamais besoin
 * de fournir un identifiant, un seul index unique en base garantit qu'il
 * n'y en a jamais plus d'une à la fois (`uq_cash_drawers_one_open_per_user`).
 * L'écart (théorique moins compté) est calculé et renvoyé immédiatement,
 * jamais stocké séparément — toujours dérivable de `expectedBalance`/
 * `closingBalance`, déjà conservés.
 */
async function closeDrawer(storeId, userId, closingBalance, note) {
  if (typeof closingBalance !== 'number' || closingBalance < 0) {
    throw new AppError('Le montant compté est invalide.', 400, 'VALIDATION_ERROR');
  }

  const current = await getMyCurrentDrawer(storeId, userId);
  if (!current) {
    throw new AppError('Aucune caisse ouverte à fermer.', 404, 'NO_OPEN_DRAWER');
  }

  const trimmedNote = (note || '').trim() || null;

  const { rows } = await pool.query(
    `UPDATE cash_drawers
     SET status = 'CLOSED', closing_time = NOW(), closing_balance = $1, note = $2
     WHERE id = $3
     RETURNING id, opening_time AS "openingTime", closing_time AS "closingTime",
               opening_balance AS "openingBalance", expected_balance AS "expectedBalance",
               closing_balance AS "closingBalance", note, status`,
    [closingBalance, trimmedNote, current.id]
  );
  const drawer = rows[0];

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'CLOSE_CASH_DRAWER', $3::jsonb)`,
    [
      userId,
      storeId,
      JSON.stringify({
        drawerId: drawer.id,
        expectedBalance: drawer.expectedBalance,
        closingBalance: drawer.closingBalance,
        discrepancy: drawer.closingBalance - drawer.expectedBalance,
      }),
    ]
  );

  return { ...drawer, discrepancy: drawer.closingBalance - drawer.expectedBalance };
}

/**
 * Historique des sessions — un Vendeur ne voit que les siennes (scoping
 * fait par le contrôleur, même principe que l'historique des ventes §B1),
 * un Owner voit celles de toute l'équipe.
 */
async function listDrawers(storeId, { userId, page, limit } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['cd.store_id = $1'];
  const params = [storeId];
  if (userId) {
    conditions.push(`cd.user_id = $${params.length + 1}`);
    params.push(userId);
  }
  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM cash_drawers cd WHERE ${whereClause}`,
    params
  );

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT cd.id, cd.opening_time AS "openingTime", cd.closing_time AS "closingTime",
            cd.opening_balance AS "openingBalance", cd.expected_balance AS "expectedBalance",
            cd.closing_balance AS "closingBalance", cd.note, cd.status,
            u.full_name AS "userFullName"
     FROM cash_drawers cd
     JOIN users u ON u.id = cd.user_id
     WHERE ${whereClause}
     ORDER BY cd.opening_time DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return {
    drawers: result.rows.map((d) => ({
      ...d,
      discrepancy: d.closingBalance != null ? d.closingBalance - d.expectedBalance : null,
    })),
    total: parseInt(countResult.rows[0].count, 10),
    page: pageNum,
    pages: Math.max(1, Math.ceil(parseInt(countResult.rows[0].count, 10) / limitNum)),
  };
}

/**
 * Détail d'une session, avec les ventes en espèces qui lui sont
 * rattachées — utile pour comprendre un écart précis. `restrictToUserId`
 * (passé par le contrôleur pour un Vendeur, jamais pour un Owner) empêche
 * de consulter la session d'un collègue en devinant son ID.
 */
async function getDrawerById(storeId, drawerId, restrictToUserId) {
  const conditions = ['cd.store_id = $1', 'cd.id = $2'];
  const params = [storeId, drawerId];
  if (restrictToUserId) {
    conditions.push(`cd.user_id = $${params.length + 1}`);
    params.push(restrictToUserId);
  }

  const drawerResult = await pool.query(
    `SELECT cd.id, cd.opening_time AS "openingTime", cd.closing_time AS "closingTime",
            cd.opening_balance AS "openingBalance", cd.expected_balance AS "expectedBalance",
            cd.closing_balance AS "closingBalance", cd.note, cd.status,
            u.full_name AS "userFullName"
     FROM cash_drawers cd
     JOIN users u ON u.id = cd.user_id
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  if (drawerResult.rows.length === 0) {
    throw new AppError('Session de caisse introuvable.', 404, 'DRAWER_NOT_FOUND');
  }
  const drawer = drawerResult.rows[0];

  const ordersResult = await pool.query(
    `SELECT id, order_number AS "orderNumber", total_amount AS "totalAmount",
            amount_paid AS "amountPaid", status, created_at AS "createdAt"
     FROM orders WHERE cash_drawer_id = $1 ORDER BY created_at ASC`,
    [drawerId]
  );

  return {
    drawer: { ...drawer, discrepancy: drawer.closingBalance != null ? drawer.closingBalance - drawer.expectedBalance : null },
    orders: ordersResult.rows,
  };
}

module.exports = {
  getMyCurrentDrawer,
  openDrawer,
  closeDrawer,
  listDrawers,
  getDrawerById,
};
