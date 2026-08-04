const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Toutes les fonctions de ce module opèrent SANS filtre store_id — c'est
 * la seule zone du backend où cela est légitime, puisqu'elle est réservée
 * au Super Admin (§3.1 du cahier des charges : "Portée : plateforme
 * entière (tous tenants)"). Chaque route qui les expose doit être protégée
 * par le middleware requireSuperAdmin, jamais par requireActiveStore.
 */

async function getPlatformStats() {
  const [storesCount, usersCount, byStatus, byPlan] = await Promise.all([
    pool.query('SELECT COUNT(*) AS count FROM stores'),
    pool.query('SELECT COUNT(*) AS count FROM users'),
    pool.query('SELECT status, COUNT(*) AS count FROM stores GROUP BY status'),
    pool.query(
      `SELECT sp.name AS "planName", COUNT(s.id) AS count
       FROM subscription_plans sp
       LEFT JOIN stores s ON s.plan_id = sp.id
       GROUP BY sp.name
       ORDER BY sp.name`
    ),
  ]);

  return {
    totalStores: parseInt(storesCount.rows[0].count, 10),
    totalUsers: parseInt(usersCount.rows[0].count, 10),
    storesByStatus: byStatus.rows.map((r) => ({ status: r.status, count: parseInt(r.count, 10) })),
    storesByPlan: byPlan.rows.map((r) => ({ planName: r.planName, count: parseInt(r.count, 10) })),
  };
}

/**
 * Liste TOUTES les boutiques de la plateforme, tous propriétaires
 * confondus — à ne jamais confondre avec stores.service.listMyStores
 * (qui, lui, filtre strictement par utilisateur).
 */
async function listAllStores({ page, limit, status, search } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (status && status !== 'ALL') {
    conditions.push(`s.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    conditions.push(`(s.name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count
     FROM stores s
     JOIN users u ON u.id = s.owner_id
     ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT s.id, s.name, s.city, s.category, s.status,
            s.created_at AS "createdAt",
            u.id AS "ownerId", u.full_name AS "ownerName", u.email AS "ownerEmail",
            s.plan_id AS "planId", sp.name AS "planName", s.plan_expires_at AS "planExpiresAt"
     FROM stores s
     JOIN users u ON u.id = s.owner_id
     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
     ${whereClause}
     ORDER BY s.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    stores: result.rows,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

/**
 * Suspend une boutique (§6.4 du cahier des charges : impayé, abus...).
 * Ne bloque que les nouvelles opérations métier (via le statut consulté
 * par le reste de l'application) — ne supprime et ne modifie AUCUNE
 * donnée existante de la boutique.
 */
async function suspendStore(storeId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE stores SET status = 'SUSPENDED' WHERE id = $1
     RETURNING id, name, status`,
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'ADMIN_SUSPEND_STORE', '{}'::jsonb)`,
    [adminUserId, storeId]
  );

  return rows[0];
}

async function reactivateStore(storeId, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE stores SET status = 'ACTIVE' WHERE id = $1
     RETURNING id, name, status`,
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'ADMIN_REACTIVATE_STORE', '{}'::jsonb)`,
    [adminUserId, storeId]
  );

  return rows[0];
}

async function listPlans() {
  const { rows } = await pool.query(
    `SELECT id, name, max_users_per_store AS "maxUsersPerStore",
            allows_supervision AS "allowsSupervision", allows_suppliers AS "allowsSuppliers",
            allows_purchase_orders AS "allowsPurchaseOrders",
            price, created_at AS "createdAt"
     FROM subscription_plans
     ORDER BY price ASC`
  );
  return rows;
}

/**
 * Journal d'audit consolidé, tous utilisateurs et toutes boutiques
 * confondus (§5.5 du cahier des charges — consultable par le Super Admin).
 * Lecture seule stricte, comme au niveau base (triggers d'immutabilité).
 */
async function listAuditLogs({ page, limit, storeId, userId, action } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(200, parseInt(limit, 10) || 50);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  let idx = 1;

  if (storeId) {
    conditions.push(`l.store_id = $${idx++}`);
    params.push(storeId);
  }
  if (userId) {
    conditions.push(`l.user_id = $${idx++}`);
    params.push(userId);
  }
  if (action) {
    conditions.push(`l.action = $${idx++}`);
    params.push(action);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM system_logs l ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT l.id, l.action, l.details, l.ip_address AS "ipAddress",
            l.created_at AS "createdAt",
            u.email AS "userEmail", s.name AS "storeName"
     FROM system_logs l
     LEFT JOIN users u  ON u.id = l.user_id
     LEFT JOIN stores s ON s.id = l.store_id
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

/**
 * Recherche d'utilisateurs à l'échelle de la plateforme (nom ou e-mail) —
 * sert à la fois à choisir qui promouvoir et à choisir un nouveau
 * propriétaire lors d'un transfert de boutique.
 */
async function searchUsers(query) {
  if (!query || !query.trim()) return [];
  const { rows } = await pool.query(
    `SELECT u.id, u.full_name AS "fullName", u.email, u.is_super_admin AS "isSuperAdmin",
            s.id AS "ownedStoreId", s.name AS "ownedStoreName"
     FROM users u
     LEFT JOIN stores s ON s.owner_id = u.id
     WHERE u.full_name ILIKE $1 OR u.email ILIKE $1
     ORDER BY u.full_name
     LIMIT 10`,
    [`%${query.trim()}%`]
  );
  return rows;
}

/**
 * Transfère la propriété réelle d'une boutique (stores.owner_id) vers un
 * autre utilisateur — réservé au Super Admin (cf. §17_transfert_et_promotion.sql).
 * L'ancien propriétaire perd tout rattachement à cette boutique ; le
 * nouveau devient Owner (que ce soit un compte totalement extérieur, ou
 * déjà Vendeur de cette même boutique — auquel cas son rôle est
 * simplement remplacé par OWNER).
 */
async function transferStoreOwnership(storeId, newOwnerUserId, adminUserId) {
  const newOwnerResult = await pool.query(
    'SELECT id, is_super_admin AS "isSuperAdmin" FROM users WHERE id = $1',
    [newOwnerUserId]
  );
  if (newOwnerResult.rows.length === 0) {
    throw new AppError('Nouvel utilisateur introuvable.', 404, 'USER_NOT_FOUND');
  }
  if (newOwnerResult.rows[0].isSuperAdmin) {
    throw new AppError('Un Super Admin ne peut pas devenir propriétaire de boutique.', 400, 'RECIPIENT_IS_ADMIN');
  }

  const alreadyOwns = await pool.query('SELECT id FROM stores WHERE owner_id = $1', [newOwnerUserId]);
  if (alreadyOwns.rows.length > 0) {
    throw new AppError(
      'Cette personne possède déjà une boutique — elle ne peut pas en recevoir une deuxième.',
      409,
      'RECIPIENT_ALREADY_OWNS_STORE'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const storeResult = await client.query(
      'UPDATE stores SET owner_id = $1 WHERE id = $2 RETURNING id, name, owner_id AS "oldCheck"',
      [newOwnerUserId, storeId]
    );
    if (storeResult.rows.length === 0) {
      throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
    }

    const roleResult = await client.query("SELECT id FROM roles WHERE code = 'OWNER'");
    const ownerRoleId = roleResult.rows[0].id;

    // L'ancien propriétaire perd tout rattachement à CETTE boutique
    // précise (mais garde ses éventuels rattachements à d'autres).
    const oldOwnerResult = await client.query(
      'DELETE FROM user_store WHERE store_id = $1 AND role_id = $2 RETURNING user_id AS "userId"',
      [storeId, ownerRoleId]
    );

    // Son jeton déjà émis porte encore storeId=cette boutique, roleCode=OWNER
    // — désormais faux. Invalidation immédiate (§A5 SOLUTIONS_AUDIT_PRODUCTION.md,
    // décidé en conversation) plutôt que d'attendre l'expiration naturelle
    // (jusqu'à 8h) : il devra se reconnecter pour obtenir un jeton à jour.
    if (oldOwnerResult.rows.length > 0) {
      await client.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [
        oldOwnerResult.rows[0].userId,
      ]);
    }

    // Le nouveau devient Owner — s'il avait déjà un rôle (Vendeur)
    // dans cette même boutique, on le remplace par OWNER plutôt que de
    // créer un doublon.
    const existingRow = await client.query(
      'SELECT id FROM user_store WHERE user_id = $1 AND store_id = $2',
      [newOwnerUserId, storeId]
    );
    if (existingRow.rows.length > 0) {
      await client.query('UPDATE user_store SET role_id = $1 WHERE id = $2', [
        ownerRoleId,
        existingRow.rows[0].id,
      ]);
    } else {
      const hasDefaultResult = await client.query(
        'SELECT 1 FROM user_store WHERE user_id = $1 AND is_default_store = TRUE',
        [newOwnerUserId]
      );
      await client.query(
        `INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
         VALUES ($1, $2, $3, $4)`,
        [newOwnerUserId, storeId, ownerRoleId, hasDefaultResult.rows.length === 0]
      );
    }

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'TRANSFER_STORE_OWNERSHIP', $3::jsonb)`,
      [adminUserId, storeId, JSON.stringify({ newOwnerUserId })]
    );

    await client.query('COMMIT');
    return { storeId, newOwnerUserId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Promotion Super Admin — la vérification "ne possède aucune boutique"
 * est appliquée par le trigger PostgreSQL (garde-fou final) ; ici on se
 * contente de traduire son erreur en message clair plutôt que de laisser
 * fuir un message SQL brut.
 */
async function promoteToSuperAdmin(userId) {
  try {
    // token_version incrémenté aussi ici (§A5 SOLUTIONS_AUDIT_PRODUCTION.md,
    // décidé en conversation) : le trigger PostgreSQL de promotion (voir
    // 17_transfert_et_promotion.sql) vide immédiatement user_store pour ce
    // compte — son jeton déjà émis, s'il en a un, porterait encore un
    // storeId/roleCode désormais inexistants.
    const { rows } = await pool.query(
      `UPDATE users SET is_super_admin = TRUE, token_version = token_version + 1 WHERE id = $1
       RETURNING id, full_name AS "fullName", email, is_super_admin AS "isSuperAdmin"`,
      [userId]
    );
    if (rows.length === 0) {
      throw new AppError('Utilisateur introuvable.', 404, 'USER_NOT_FOUND');
    }
    return rows[0];
  } catch (err) {
    if (err.code === 'P0001') {
      throw new AppError(err.message, 409, 'OWNS_STORE');
    }
    throw err;
  }
}

/**
 * Retrait du statut Super Admin (§ suite conversation du 30/07 : demandé
 * après l'incident où un compte avait été promu par erreur). Le compte
 * redevient un utilisateur ordinaire, sans boutique ni rattachement — le
 * trigger de promotion ayant déjà vidé user_store et exigé l'absence de
 * boutique possédée avant promotion, il n'y a rien à restituer ici.
 * Deux garde-fous : on ne peut pas se retirer soi-même, et on ne peut pas
 * retirer le dernier Super Admin restant (la plateforme resterait sans
 * administrateur).
 */
async function revokeSuperAdmin(userId, adminUserId) {
  const targetId = parseInt(userId, 10);
  if (targetId === adminUserId) {
    throw new AppError(
      'Vous ne pouvez pas retirer votre propre statut Super Admin.',
      400,
      'CANNOT_REVOKE_SELF'
    );
  }

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*) AS count FROM users WHERE is_super_admin = TRUE'
  );
  if (parseInt(countRows[0].count, 10) <= 1) {
    throw new AppError(
      'Impossible de retirer le dernier Super Admin de la plateforme.',
      409,
      'LAST_SUPER_ADMIN'
    );
  }

  // token_version incrémenté (§A5 SOLUTIONS_AUDIT_PRODUCTION.md, décidé en
  // conversation) : c'est précisément le cas d'usage visé — un compte dont
  // on retire la confiance doit perdre l'accès immédiatement, pas dans
  // jusqu'à 8h à l'expiration naturelle de son jeton déjà émis.
  const { rows } = await pool.query(
    `UPDATE users SET is_super_admin = FALSE, token_version = token_version + 1
     WHERE id = $1 AND is_super_admin = TRUE
     RETURNING id, full_name AS "fullName", email, is_super_admin AS "isSuperAdmin"`,
    [targetId]
  );
  if (rows.length === 0) {
    throw new AppError('Utilisateur introuvable ou déjà non Super Admin.', 404, 'USER_NOT_FOUND');
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, NULL, 'ADMIN_REVOKE_SUPER_ADMIN', $2::jsonb)`,
    [adminUserId, JSON.stringify({ targetUserId: rows[0].id, targetEmail: rows[0].email })]
  );

  return rows[0];
}

/**
 * Modifie un plan d'abonnement existant (§20_plans_abonnement.sql) — prix
 * et plafonds ne sont plus figés en dur, seul le Super Admin peut les
 * changer. Remplacement complet des champs (pas de fusion partielle,
 * même principe que store_notes.updateNote) : le formulaire d'édition
 * renvoie toujours l'état complet du plan.
 */
async function updatePlan(
  planId,
  { name, price, maxUsersPerStore, allowsSupervision, allowsSuppliers, allowsPurchaseOrders },
  adminUserId
) {
  if (!name || !name.trim()) {
    throw new AppError('Le nom du plan est requis.', 400, 'VALIDATION_ERROR');
  }
  if (price === undefined || Number(price) < 0) {
    throw new AppError('Le prix doit être un nombre positif.', 400, 'VALIDATION_ERROR');
  }
  if (!Number.isInteger(maxUsersPerStore) || maxUsersPerStore < 1) {
    throw new AppError('Le nombre d\'utilisateurs doit être un entier positif.', 400, 'VALIDATION_ERROR');
  }

  try {
    const { rows } = await pool.query(
      `UPDATE subscription_plans
       SET name = $2, price = $3, max_users_per_store = $4,
           allows_supervision = $5, allows_suppliers = $6, allows_purchase_orders = $7
       WHERE id = $1
       RETURNING id, name, max_users_per_store AS "maxUsersPerStore",
                 allows_supervision AS "allowsSupervision", allows_suppliers AS "allowsSuppliers",
                 allows_purchase_orders AS "allowsPurchaseOrders",
                 price, created_at AS "createdAt"`,
      [planId, name.trim(), price, maxUsersPerStore, !!allowsSupervision, !!allowsSuppliers, !!allowsPurchaseOrders]
    );
    if (rows.length === 0) {
      throw new AppError('Plan introuvable.', 404, 'PLAN_NOT_FOUND');
    }

    await pool.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, NULL, 'ADMIN_UPDATE_PLAN', $2::jsonb)`,
      [adminUserId, JSON.stringify({ planId: rows[0].id, planName: rows[0].name })]
    );

    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Un plan porte déjà ce nom.', 409, 'DUPLICATE_NAME');
    }
    throw err;
  }
}

/**
 * Active un plan payant sur une boutique jusqu'à une date donnée
 * (§20_plans_abonnement.sql — gestion 100% manuelle par le Super Admin,
 * aucun paiement automatisé). `plan_expires_at` est la seule donnée
 * temporelle à suivre : le "plan effectif" d'une boutique se recalcule à
 * la volée en comparant cette date à NOW(), jamais mis en cache ailleurs.
 */
async function activateStorePlan(storeId, planId, expiresAt, adminUserId) {
  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
    throw new AppError('La date d\'expiration doit être une date valide dans le futur.', 400, 'VALIDATION_ERROR');
  }

  const planResult = await pool.query('SELECT id, name FROM subscription_plans WHERE id = $1', [planId]);
  if (planResult.rows.length === 0) {
    throw new AppError('Plan introuvable.', 404, 'PLAN_NOT_FOUND');
  }

  const { rows } = await pool.query(
    `UPDATE stores SET plan_id = $1, plan_expires_at = $2 WHERE id = $3
     RETURNING id, name, plan_id AS "planId", plan_expires_at AS "planExpiresAt"`,
    [planId, expiryDate, storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'ADMIN_ACTIVATE_PLAN', $3::jsonb)`,
    [adminUserId, storeId, JSON.stringify({ planId, planName: planResult.rows[0].name, expiresAt: expiryDate })]
  );

  return rows[0];
}

/**
 * Repousse la date d'expiration du plan payant déjà actif sur une
 * boutique — ne change jamais le plan lui-même (utiliser "activer" pour
 * changer d'offre). Refuse si la boutique est en FREEMIUM (rien à
 * renouveler, il faut d'abord l'activer sur un plan payant).
 */
async function renewStorePlan(storeId, expiresAt, adminUserId) {
  const expiryDate = new Date(expiresAt);
  if (Number.isNaN(expiryDate.getTime()) || expiryDate <= new Date()) {
    throw new AppError('La date d\'expiration doit être une date valide dans le futur.', 400, 'VALIDATION_ERROR');
  }

  const storeResult = await pool.query(
    `SELECT s.id, sp.name AS "planName"
     FROM stores s
     LEFT JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE s.id = $1`,
    [storeId]
  );
  if (storeResult.rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  if (!storeResult.rows[0].planName || storeResult.rows[0].planName === 'FREEMIUM') {
    throw new AppError(
      'Cette boutique est en FREEMIUM — activez d\'abord un plan payant plutôt que de le renouveler.',
      409,
      'NOT_ON_PAID_PLAN'
    );
  }

  const { rows } = await pool.query(
    `UPDATE stores SET plan_expires_at = $1 WHERE id = $2
     RETURNING id, name, plan_id AS "planId", plan_expires_at AS "planExpiresAt"`,
    [expiryDate, storeId]
  );

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'ADMIN_RENEW_PLAN', $3::jsonb)`,
    [adminUserId, storeId, JSON.stringify({ expiresAt: expiryDate })]
  );

  return rows[0];
}

/**
 * Désactive l'abonnement payant d'une boutique — retour immédiat en
 * FREEMIUM (décidé en conversation). Ne supprime rien (employés, liens
 * Superviser/Fournisseurs restent en base) : tout redevient utilisable
 * instantanément si un plan payant est réactivé plus tard.
 */
async function deactivateStorePlan(storeId, adminUserId) {
  const freemiumResult = await pool.query("SELECT id FROM subscription_plans WHERE name = 'FREEMIUM'");
  if (freemiumResult.rows.length === 0) {
    throw new AppError('Plan FREEMIUM introuvable — configuration incohérente.', 500, 'FREEMIUM_MISSING');
  }
  const freemiumId = freemiumResult.rows[0].id;

  const { rows } = await pool.query(
    `UPDATE stores SET plan_id = $1, plan_expires_at = NULL WHERE id = $2
     RETURNING id, name, plan_id AS "planId", plan_expires_at AS "planExpiresAt"`,
    [freemiumId, storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'ADMIN_DEACTIVATE_PLAN', '{}'::jsonb)`,
    [adminUserId, storeId]
  );

  return rows[0];
}

/**
 * Active un plan payant pour TOUTES les boutiques actuellement en
 * FREEMIUM sur la plateforme (§ décidé en conversation) — un seul clic
 * plutôt que boutique par boutique. Ne touche jamais une boutique qui a
 * déjà un abonnement payant en cours : "en FREEMIUM" est calculé avec la
 * même définition que getEffectivePlan (plan_id NULL, plan nommé
 * FREEMIUM, OU plan payant expiré) pour rester cohérent avec le reste de
 * la plateforme. Réutilise l'action ADMIN_ACTIVATE_PLAN existante — une
 * entrée par boutique affectée, pour que chaque Owner voie l'activation
 * dans son propre journal d'activité exactement comme une activation
 * individuelle.
 */
async function activatePlanForAllFreemiumStores(planId, days, adminUserId) {
  if (!Number.isInteger(days) || days < 1) {
    throw new AppError('Le nombre de jours doit être un entier positif.', 400, 'VALIDATION_ERROR');
  }

  const planResult = await pool.query('SELECT id, name FROM subscription_plans WHERE id = $1', [planId]);
  if (planResult.rows.length === 0) {
    throw new AppError('Plan introuvable.', 404, 'PLAN_NOT_FOUND');
  }
  const plan = planResult.rows[0];
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const { rows } = await pool.query(
    `WITH updated AS (
       UPDATE stores s
       SET plan_id = $1, plan_expires_at = $2
       WHERE s.plan_id IS NULL
          OR s.plan_id = (SELECT id FROM subscription_plans WHERE name = 'FREEMIUM')
          OR (s.plan_expires_at IS NOT NULL AND s.plan_expires_at <= NOW())
       RETURNING s.id
     )
     INSERT INTO system_logs (user_id, store_id, action, details)
     SELECT $3, id, 'ADMIN_ACTIVATE_PLAN', $4::jsonb FROM updated
     RETURNING store_id`,
    [planId, expiresAt, adminUserId, JSON.stringify({ planId, planName: plan.name, expiresAt })]
  );

  return { planName: plan.name, expiresAt, affectedStores: rows.length };
}

/**
 * Référentiel "types de boutique" (§ cahier-des-charges-types-de-boutique.md)
 * — géré exclusivement par le Super Admin, sans lien direct avec les
 * boutiques existantes. store_type_categories n'est qu'un GABARIT : jamais
 * copié ni synchronisé automatiquement avec la vraie table `categories`
 * d'une boutique (cette copie appartient au flux de création de boutique,
 * hors périmètre ici) — le modifier ou le supprimer n'affecte donc jamais
 * une boutique déjà créée.
 */
async function listStoreTypes() {
  const [typesResult, categoriesResult] = await Promise.all([
    pool.query(
      `SELECT id, code, label, display_order AS "displayOrder"
       FROM store_types ORDER BY display_order ASC, id ASC`
    ),
    pool.query(
      `SELECT id, store_type_id AS "storeTypeId", name, display_order AS "displayOrder"
       FROM store_type_categories ORDER BY display_order ASC, id ASC`
    ),
  ]);

  const categoriesByType = {};
  for (const category of categoriesResult.rows) {
    if (!categoriesByType[category.storeTypeId]) categoriesByType[category.storeTypeId] = [];
    categoriesByType[category.storeTypeId].push(category);
  }

  return typesResult.rows.map((type) => ({
    ...type,
    categories: categoriesByType[type.id] || [],
  }));
}

async function createStoreType({ code, label, displayOrder }) {
  try {
    const { rows } = await pool.query(
      `INSERT INTO store_types (code, label, display_order) VALUES ($1, $2, $3)
       RETURNING id, code, label, display_order AS "displayOrder"`,
      [code.trim(), label.trim(), displayOrder || 0]
    );
    return { ...rows[0], categories: [] };
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Ce code est déjà utilisé par un autre type de boutique.', 409, 'CODE_ALREADY_USED');
    }
    throw err;
  }
}

async function updateStoreType(id, { code, label, displayOrder }) {
  try {
    const { rows } = await pool.query(
      `UPDATE store_types SET code = $1, label = $2, display_order = $3 WHERE id = $4
       RETURNING id, code, label, display_order AS "displayOrder"`,
      [code.trim(), label.trim(), displayOrder || 0, id]
    );
    if (rows.length === 0) {
      throw new AppError('Type de boutique introuvable.', 404, 'STORE_TYPE_NOT_FOUND');
    }
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Ce code est déjà utilisé par un autre type de boutique.', 409, 'CODE_ALREADY_USED');
    }
    throw err;
  }
}

/**
 * La suppression CASCADE ses catégories suggérées et met NULL la référence
 * des boutiques qui utilisaient ce type (contraintes DB — voir migration
 * 22_types_de_boutique.sql) : aucune boutique existante n'est autrement
 * affectée, rien d'autre à faire ici.
 */
async function deleteStoreType(id) {
  const { rows } = await pool.query('DELETE FROM store_types WHERE id = $1 RETURNING id', [id]);
  if (rows.length === 0) {
    throw new AppError('Type de boutique introuvable.', 404, 'STORE_TYPE_NOT_FOUND');
  }
  return { id: rows[0].id, deleted: true };
}

async function addStoreTypeCategory(storeTypeId, { name, displayOrder }) {
  const typeExists = await pool.query('SELECT 1 FROM store_types WHERE id = $1', [storeTypeId]);
  if (typeExists.rows.length === 0) {
    throw new AppError('Type de boutique introuvable.', 404, 'STORE_TYPE_NOT_FOUND');
  }

  const { rows } = await pool.query(
    `INSERT INTO store_type_categories (store_type_id, name, display_order) VALUES ($1, $2, $3)
     RETURNING id, store_type_id AS "storeTypeId", name, display_order AS "displayOrder"`,
    [storeTypeId, name.trim(), displayOrder || 0]
  );
  return rows[0];
}

async function updateStoreTypeCategory(categoryId, { name, displayOrder }) {
  const { rows } = await pool.query(
    `UPDATE store_type_categories SET name = $1, display_order = $2 WHERE id = $3
     RETURNING id, store_type_id AS "storeTypeId", name, display_order AS "displayOrder"`,
    [name.trim(), displayOrder || 0, categoryId]
  );
  if (rows.length === 0) {
    throw new AppError('Catégorie suggérée introuvable.', 404, 'CATEGORY_NOT_FOUND');
  }
  return rows[0];
}

async function deleteStoreTypeCategory(categoryId) {
  const { rows } = await pool.query(
    'DELETE FROM store_type_categories WHERE id = $1 RETURNING id',
    [categoryId]
  );
  if (rows.length === 0) {
    throw new AppError('Catégorie suggérée introuvable.', 404, 'CATEGORY_NOT_FOUND');
  }
  return { id: rows[0].id, deleted: true };
}

module.exports = {
  getPlatformStats,
  listAllStores,
  suspendStore,
  reactivateStore,
  listPlans,
  updatePlan,
  activateStorePlan,
  renewStorePlan,
  deactivateStorePlan,
  activatePlanForAllFreemiumStores,
  listAuditLogs,
  searchUsers,
  transferStoreOwnership,
  promoteToSuperAdmin,
  revokeSuperAdmin,
  listStoreTypes,
  createStoreType,
  updateStoreType,
  deleteStoreType,
  addStoreTypeCategory,
  updateStoreTypeCategory,
  deleteStoreTypeCategory,
};