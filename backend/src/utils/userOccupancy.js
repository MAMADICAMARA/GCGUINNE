const pool = require('../config/db');

/**
 * Résout l'occupation actuelle d'un utilisateur — Owner d'une boutique
 * active, Vendeur d'une boutique active, ou libre (§53_desactivation_boutique.sql,
 * décidé en conversation : un utilisateur occupe exactement un poste,
 * jamais deux). Une boutique DEACTIVATED (désactivation volontaire de son
 * Owner) ne compte jamais comme occupation, ni pour son Owner ni pour ses
 * Vendeurs — une boutique fermée ne doit pas retenir son monde prisonnier.
 * SUSPENDED (Super Admin, punitif) reste occupant : ce n'est pas un abandon
 * de propriété.
 */
async function findConflictingOccupation(userId, { excludeStoreId = null } = {}) {
  const { rows } = await pool.query(
    `SELECT 'OWNER' AS type, id AS "storeId", name FROM stores
       WHERE owner_id = $1 AND status <> 'DEACTIVATED' AND id <> COALESCE($2, -1)
     UNION ALL
     SELECT 'SELLER' AS type, s.id AS "storeId", s.name FROM user_store us
       JOIN roles r ON r.id = us.role_id
       JOIN stores s ON s.id = us.store_id
       WHERE us.user_id = $1 AND r.code = 'SELLER' AND s.status <> 'DEACTIVATED' AND s.id <> COALESCE($2, -1)
     LIMIT 1`,
    [userId, excludeStoreId]
  );
  return rows[0] || null;
}

module.exports = { findConflictingOccupation };
