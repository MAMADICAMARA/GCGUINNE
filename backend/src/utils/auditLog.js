const pool = require('../config/db');

/**
 * Journal d'activité d'UNE boutique précise (storeId toujours obligatoire
 * ici, contrairement à admin.service.js#listAuditLogs qui couvre toute la
 * plateforme pour le Super Admin) — même table `system_logs`, lecture
 * seule stricte (immuable au niveau base). Utilisé par deux points
 * d'entrée : la boutique propre de l'Owner (stores.routes.js) et une
 * boutique supervisée (supervision.routes.js), décidés ensemble en
 * conversation puisqu'ils partagent la même logique de fond.
 */
async function listStoreAuditLog(storeId, { page, limit, userId, action, includeLogins } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, parseInt(limit, 10) || 50);
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['l.store_id = $1'];
  const params = [storeId];
  let idx = 2;

  if (userId) {
    conditions.push(`l.user_id = $${idx++}`);
    params.push(userId);
  }
  if (action) {
    conditions.push(`l.action = $${idx++}`);
    params.push(action);
  } else if (includeLogins !== 'true' && includeLogins !== true) {
    // Par défaut, les connexions (largement majoritaires en volume et peu
    // informatives au quotidien) sont masquées — décidé en conversation
    // pour garder le journal exploitable. Rien n'est supprimé en base,
    // uniquement filtré à l'affichage ; includeLogins=true les réaffiche.
    conditions.push(`l.action != 'LOGIN'`);
  }
  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM system_logs l ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT l.id, l.action, l.details, l.ip_address AS "ipAddress",
            l.created_at AS "createdAt",
            u.full_name AS "userFullName", u.email AS "userEmail"
     FROM system_logs l
     LEFT JOIN users u ON u.id = l.user_id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    logs: result.rows,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

module.exports = { listStoreAuditLog };
