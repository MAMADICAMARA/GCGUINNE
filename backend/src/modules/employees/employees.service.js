const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { getEffectivePlan } = require('../../utils/planContext');
const mailer = require('../mailer/mailer.service');
const emailTemplates = require('../mailer/templates');

// Même libellé que frontend/src/pages/employees/EmployeesPage.jsx —
// aucun rôle autre que SELLER n'est jamais utilisé par addEmployee (cf.
// commentaire de la fonction), mais garder une table plutôt qu'un
// littéral en dur évite une désynchronisation si un rôle est ajouté un jour.
const ROLE_LABELS = { SELLER: 'Vendeur' };

/**
 * Traduit une exception levée par les triggers PostgreSQL de la règle
 * d'exclusivité (voir 11_invitations_et_exclusivite.sql) en erreur métier
 * propre, plutôt que de laisser fuir un message SQL brut. Ces triggers
 * sont un filet de sécurité de dernier recours : le service vérifie déjà
 * la règle lui-même avant chaque écriture.
 */
function wrapExclusivityError(err) {
  if (err.code === 'P0001') {
    return new AppError(err.message, 409, 'ALREADY_RESELLER_ELSEWHERE');
  }
  return err;
}

/**
 * Liste les membres RÉELS (comptes déjà créés) de la boutique.
 */
async function listEmployees(storeId) {
  const { rows } = await pool.query(
    `SELECT u.id AS "userId", u.full_name AS "fullName", u.email, u.phone,
            r.code AS "roleCode", us.is_default_store AS "isDefaultStore",
            us.created_at AS "joinedAt",
            COALESCE((us.permissions->>'canVoidReturn')::boolean, false) AS "canVoidReturn"
     FROM user_store us
     JOIN users u ON u.id = us.user_id
     JOIN roles r ON r.id = us.role_id
     WHERE us.store_id = $1
     ORDER BY r.code, u.full_name`,
    [storeId]
  );
  return rows;
}

/**
 * Liste les invitations en attente (personnes pas encore inscrites).
 */
async function listPendingInvitations(storeId) {
  const { rows } = await pool.query(
    `SELECT si.id, si.email, r.code AS "roleCode", si.created_at AS "createdAt"
     FROM store_invitations si
     JOIN roles r ON r.id = si.role_id
     WHERE si.store_id = $1
     ORDER BY si.created_at DESC`,
    [storeId]
  );
  return rows;
}

/**
 * Ajoute un employé à la boutique (§4.3 du cahier des charges). Toujours
 * en tant que Vendeur/Caissier — pas de rôle Manager (abandonné, contexte
 * guinéen : cf. 21_abandon_role_manager.sql), et un Owner ne se rattache
 * jamais par ce chemin.
 *
 * - E-mail déjà utilisé par un compte existant -> rattachement immédiat
 *   (user_store), sans jamais toucher à son mot de passe.
 * - E-mail inconnu -> création d'une invitation en attente
 *   (store_invitations). Rien n'est créé dans `users` : c'est la personne
 *   elle-même qui s'inscrira plus tard avec son propre mot de passe. Voir
 *   auth.service.js#register(), qui consomme automatiquement l'invitation
 *   à ce moment-là et l'attache directement à cette boutique.
 *
 * Dans les deux cas, la règle "un seul poste de Vendeur à la fois" est
 * vérifiée ici (message clair) ET par un trigger PostgreSQL (garde-fou).
 *
 * Le plafond d'utilisateurs du plan effectif est aussi vérifié ici
 * (§20_plans_abonnement.sql, décidé en conversation) : en FREEMIUM
 * (1 utilisateur = l'Owner seul), aucune invitation n'est possible tant
 * que la boutique n'est pas passée à un plan payant. Compte les membres
 * réels ET les invitations déjà en attente, pour ne pas pouvoir
 * contourner la limite en accumulant des invitations non consommées.
 */
async function addEmployee(storeId, actingUserId, { email }) {
  if (!email || !email.trim()) {
    throw new AppError("L'e-mail est requis.", 400, 'VALIDATION_ERROR');
  }
  const trimmedEmail = email.trim();
  const roleCode = 'SELLER';

  const plan = await getEffectivePlan(storeId);
  const countResult = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM user_store WHERE store_id = $1) +
       (SELECT COUNT(*) FROM store_invitations WHERE store_id = $1) AS total`,
    [storeId]
  );
  if (parseInt(countResult.rows[0].total, 10) >= plan.maxUsersPerStore) {
    throw new AppError(
      plan.isEffectivelyFreemium
        ? 'Le plan FREEMIUM ne permet aucun employé — passez à un plan payant pour inviter votre équipe.'
        : `Le plan ${plan.planName} est limité à ${plan.maxUsersPerStore} utilisateur(s) par boutique.`,
      403,
      'PLAN_USER_LIMIT_REACHED'
    );
  }

  const existingUserResult = await pool.query(
    'SELECT id, full_name AS "fullName" FROM users WHERE LOWER(email) = LOWER($1)',
    [trimmedEmail]
  );

  if (existingUserResult.rows.length > 0) {
    // --- Cas 1 : compte déjà existant -> rattachement immédiat ---
    const userId = existingUserResult.rows[0].id;

    const alreadyMember = await pool.query(
      'SELECT 1 FROM user_store WHERE user_id = $1 AND store_id = $2',
      [userId, storeId]
    );
    if (alreadyMember.rows.length > 0) {
      throw new AppError('Cette personne fait déjà partie de la boutique.', 409, 'ALREADY_MEMBER');
    }

    // Vérification préalable (message clair) — le trigger reste le
    // garde-fou final en cas de course entre deux requêtes concurrentes.
    const conflict = await pool.query(
      `SELECT s.name FROM user_store us
       JOIN roles r ON r.id = us.role_id
       JOIN stores s ON s.id = us.store_id
       WHERE us.user_id = $1 AND r.code = 'SELLER'`,
      [userId]
    );
    if (conflict.rows.length > 0) {
      throw new AppError(
        `Cette personne est déjà Vendeur dans la boutique "${conflict.rows[0].name}". Elle doit d'abord en être retirée.`,
        409,
        'ALREADY_RESELLER_ELSEWHERE'
      );
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const hasDefaultResult = await client.query(
        'SELECT 1 FROM user_store WHERE user_id = $1 AND is_default_store = TRUE',
        [userId]
      );
      const isFirstStoreForUser = hasDefaultResult.rows.length === 0;

      const roleResult = await client.query('SELECT id FROM roles WHERE code = $1', [roleCode]);

      await client.query(
        `INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
         VALUES ($1, $2, $3, $4)`,
        [userId, storeId, roleResult.rows[0].id, isFirstStoreForUser]
      );

      await client.query(
        `INSERT INTO system_logs (user_id, store_id, action, details)
         VALUES ($1, $2, 'ADD_EMPLOYEE_EXISTING_ACCOUNT', $3::jsonb)`,
        [actingUserId, storeId, JSON.stringify({ targetUserId: userId, roleCode })]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw wrapExclusivityError(err);
    } finally {
      client.release();
    }

    return {
      email: trimmedEmail,
      fullName: existingUserResult.rows[0].fullName,
      roleCode,
      wasExistingAccount: true,
      invitationPending: false,
    };
  }

  // --- Cas 2 : personne pas encore inscrite -> invitation en attente ---
  const roleResult = await pool.query('SELECT id FROM roles WHERE code = $1', [roleCode]);

  try {
    await pool.query(
      `INSERT INTO store_invitations (store_id, email, role_id, invited_by)
       VALUES ($1, $2, $3, $4)`,
      [storeId, trimmedEmail, roleResult.rows[0].id, actingUserId]
    );
  } catch (err) {
    if (err.code === '23505') {
      // uq_store_invitation (store_id, email)
      throw new AppError('Une invitation est déjà en attente pour cet e-mail dans cette boutique.', 409, 'ALREADY_INVITED');
    }
    throw wrapExclusivityError(err);
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'INVITE_EMPLOYEE', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ email: trimmedEmail, roleCode })]
  );

  // E-mail à la personne invitée (§6.3 du cahier des charges, décidé en
  // conversation) — en complément du message manuel que l'Owner envoie
  // déjà de son côté (WhatsApp, téléphone), jamais un remplacement. Jamais
  // awaité (§9) : un échec d'envoi ne doit jamais faire échouer l'invitation
  // elle-même, déjà enregistrée en base à ce stade.
  pool
    .query('SELECT name FROM stores WHERE id = $1', [storeId])
    .then(({ rows }) => {
      if (rows.length === 0) return;
      const { subject, html } = emailTemplates.employeeInvitedEmail({
        storeName: rows[0].name,
        roleLabel: ROLE_LABELS[roleCode] || roleCode,
      });
      mailer.sendEmail({ to: trimmedEmail, subject, html });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Échec de l'envoi de l'e-mail d'invitation :", err.message);
    });

  return {
    email: trimmedEmail,
    fullName: null,
    roleCode,
    wasExistingAccount: false,
    invitationPending: true,
  };
}

async function cancelInvitation(storeId, invitationId) {
  const { rowCount } = await pool.query(
    'DELETE FROM store_invitations WHERE id = $1 AND store_id = $2',
    [invitationId, storeId]
  );
  if (rowCount === 0) {
    throw new AppError('Invitation introuvable.', 404, 'INVITATION_NOT_FOUND');
  }
  return { invitationId, cancelled: true };
}

/**
 * Retire un employé de la boutique — c'est aussi le SEUL moyen de libérer
 * quelqu'un pour qu'il puisse rejoindre une autre boutique en tant que
 * Vendeur (règle d'exclusivité, décidée en conversation).
 */
async function removeEmployee(storeId, targetUserId, actingUserId) {
  const membership = await pool.query(
    `SELECT r.code AS "roleCode"
     FROM user_store us JOIN roles r ON r.id = us.role_id
     WHERE us.user_id = $1 AND us.store_id = $2`,
    [targetUserId, storeId]
  );
  if (membership.rows.length === 0) {
    throw new AppError('Employé introuvable dans cette boutique.', 404, 'EMPLOYEE_NOT_FOUND');
  }
  if (membership.rows[0].roleCode === 'OWNER') {
    throw new AppError('Le propriétaire ne peut pas être retiré de sa propre boutique.', 400, 'CANNOT_REMOVE_OWNER');
  }

  await pool.query('DELETE FROM user_store WHERE user_id = $1 AND store_id = $2', [
    targetUserId,
    storeId,
  ]);

  // token_version incrémenté (§A5 SOLUTIONS_AUDIT_PRODUCTION.md, décidé en
  // conversation) : sans ça, l'employé retiré garderait un accès valide à
  // cette boutique jusqu'à l'expiration naturelle de son jeton déjà émis
  // (jusqu'à 8h) — précisément le scénario qu'un retrait est censé
  // empêcher immédiatement.
  await pool.query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [
    targetUserId,
  ]);

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'REMOVE_EMPLOYEE', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ targetUserId })]
  );

  return { userId: targetUserId, removed: true };
}

/**
 * Autorise (ou pas) UN vendeur précis à annuler/retourner ses propres
 * ventes (§25_autorisation_annulation_retour.sql, décidé en conversation)
 * — indépendant du flag global "tous les vendeurs"
 * (stores.service.js#updateVoidReturnSettings). Stocké dans la colonne
 * `permissions` JSONB de `user_store`, déjà présente mais jamais utilisée
 * jusqu'ici. Réservé aux comptes Vendeur de cette boutique — jamais
 * applicable à l'Owner (déjà tout-puissant) ni à un compte d'une autre
 * boutique.
 */
async function setSellerVoidReturnPermission(storeId, targetUserId, canVoidReturn, actingUserId) {
  const membership = await pool.query(
    `SELECT r.code AS "roleCode"
     FROM user_store us JOIN roles r ON r.id = us.role_id
     WHERE us.user_id = $1 AND us.store_id = $2`,
    [targetUserId, storeId]
  );
  if (membership.rows.length === 0) {
    throw new AppError('Employé introuvable dans cette boutique.', 404, 'EMPLOYEE_NOT_FOUND');
  }
  if (membership.rows[0].roleCode !== 'SELLER') {
    throw new AppError("Cette autorisation ne s'applique qu'aux vendeurs.", 400, 'NOT_A_SELLER');
  }

  await pool.query(
    `UPDATE user_store
     SET permissions = jsonb_set(permissions, '{canVoidReturn}', $1::jsonb)
     WHERE user_id = $2 AND store_id = $3`,
    [JSON.stringify(Boolean(canVoidReturn)), targetUserId, storeId]
  );

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'SET_SELLER_VOID_RETURN_PERMISSION', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ targetUserId, canVoidReturn: Boolean(canVoidReturn) })]
  );

  return { userId: targetUserId, canVoidReturn: Boolean(canVoidReturn) };
}

module.exports = {
  listEmployees,
  listPendingInvitations,
  addEmployee,
  cancelInvitation,
  removeEmployee,
  setSellerVoidReturnPermission,
};
