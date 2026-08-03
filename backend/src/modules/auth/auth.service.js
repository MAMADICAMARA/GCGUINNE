const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Récupère la liste des boutiques auxquelles un utilisateur est rattaché,
 * avec le rôle correspondant dans chacune (cf. §6.1 du cahier des charges).
 */
async function getStoresForUser(userId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.category, s.country, s.region, s.city, s.address, s.status,
            r.code AS "roleCode", us.is_default_store AS "isDefaultStore"
     FROM user_store us
     JOIN stores s ON s.id = us.store_id
     JOIN roles r  ON r.id = us.role_id
     WHERE us.user_id = $1
     ORDER BY us.is_default_store DESC, s.name ASC`,
    [userId]
  );
  return rows;
}

function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/**
 * Inscription d'un nouvel utilisateur (§4.1 du cahier des charges).
 * Ne crée QUE le compte — la création de boutique est volontairement
 * découplée (voir modules/stores) : un utilisateur peut exister sans
 * posséder de boutique (ex : employé invité, ou propriétaire qui n'a pas
 * encore créé sa première boutique). Rien dans le schéma n'impose l'inverse
 * : `stores.owner_id` référence `users.id`, jamais le contraire.
 */
async function register({ fullName, email, password, phone, gender, birthDate }) {
  const existing = await pool.query(
    'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  if (existing.rows.length > 0) {
    throw new AppError('Un compte existe déjà avec cet e-mail.', 409, 'EMAIL_ALREADY_USED');
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptSaltRounds);

  const userResult = await pool.query(
    `INSERT INTO users (full_name, email, password_hash, phone, gender, birth_date, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
     RETURNING id, full_name AS "fullName", email, phone, gender,
               birth_date AS "birthDate", is_super_admin AS "isSuperAdmin"`,
    [fullName, email, passwordHash, phone, gender, birthDate]
  );
  const user = userResult.rows[0];

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, NULL, 'REGISTER_ACCOUNT', $2::jsonb)`,
    [user.id, JSON.stringify({ email })]
  );

  // Si cet e-mail avait été invité par un Owner avant même l'inscription
  // (§4.3 du cahier des charges), on rattache automatiquement le nouveau
  // compte à cette boutique, avec le rôle prévu — pas d'étape "Ma Boutique"
  // vide à traverser, la personne atterrit directement dans son espace
  // opérationnel. Échec silencieux et non bloquant : si cette étape
  // échoue pour une raison quelconque (course concurrente, etc.), le
  // compte est quand même créé normalement, simplement sans boutique.
  try {
    const invitationResult = await pool.query(
      `SELECT si.id, si.store_id AS "storeId", si.role_id AS "roleId"
       FROM store_invitations si
       WHERE LOWER(si.email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (invitationResult.rows.length > 0) {
      const invitation = invitationResult.rows[0];
      await pool.query(
        `INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
         VALUES ($1, $2, $3, TRUE)`,
        [user.id, invitation.storeId, invitation.roleId]
      );
      await pool.query('DELETE FROM store_invitations WHERE id = $1', [invitation.id]);
      await pool.query(
        `INSERT INTO system_logs (user_id, store_id, action, details)
         VALUES ($1, $2, 'ACCEPT_INVITATION', '{}'::jsonb)`,
        [user.id, invitation.storeId]
      );
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Échec de la consommation d'invitation à l'inscription :", err.message);
  }

  const stores = await getStoresForUser(user.id);
  const activeStore =
    stores.length === 1 && stores[0].status !== 'SUSPENDED' ? stores[0] : null;

  // is_super_admin ne peut être positionné que directement en base —
  // jamais via cette route publique, même en présence d'une invitation.
  const token = signToken({
    userId: user.id,
    storeId: activeStore?.id || null,
    roleCode: activeStore?.roleCode || null,
    isSuperAdmin: user.isSuperAdmin,
  });

  return { token, user, stores };
}

/**
 * Connexion d'un utilisateur existant (§4.1).
 */
async function login({ email, password }) {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, password_hash AS "passwordHash",
            phone, gender, birth_date AS "birthDate",
            status, is_super_admin AS "isSuperAdmin"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  const user = rows[0];

  // Message volontairement générique : ne jamais indiquer si c'est l'e-mail
  // ou le mot de passe qui est incorrect (cf. bonnes pratiques de sécurité).
  if (!user || user.status !== 'ACTIVE') {
    throw new AppError('E-mail ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    throw new AppError('E-mail ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
  }

  const stores = await getStoresForUser(user.id);
  // Une boutique suspendue n'est jamais auto-sélectionnée comme active —
  // sinon un utilisateur avec une seule boutique (suspendue) contournerait
  // entièrement le blocage de switchStore, en atterrissant directement
  // dedans dès la connexion.
  const activeStore =
    stores.length === 1 && stores[0].status !== 'SUSPENDED' ? stores[0] : null;

  const token = signToken({
    userId: user.id,
    storeId: activeStore?.id || null,
    roleCode: activeStore?.roleCode || null,
    isSuperAdmin: user.isSuperAdmin,
  });

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'LOGIN', '{}'::jsonb)`,
    [user.id, activeStore?.id || null]
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      birthDate: user.birthDate,
      isSuperAdmin: user.isSuperAdmin,
    },
    stores,
  };
}

/**
 * Changement de boutique active pour un propriétaire multi-boutiques
 * (§6.1). Régénère un jeton portant le nouveau contexte.
 */
async function switchStore({ userId, storeId }) {
  const stores = await getStoresForUser(userId);
  const target = stores.find((s) => s.id === storeId);

  if (!target) {
    throw new AppError("Vous n'êtes pas rattaché à cette boutique.", 403, 'STORE_ACCESS_DENIED');
  }

  // Une boutique suspendue par le Super Admin reste visible dans la liste
  // (le compte reste utilisable normalement), mais ne peut plus être
  // ouverte tant qu'elle n'est pas réactivée — décidé en conversation.
  if (target.status === 'SUSPENDED') {
    throw new AppError(
      'Cette boutique a été suspendue. Contactez l\'administrateur de la plateforme.',
      403,
      'STORE_SUSPENDED'
    );
  }

  const { rows } = await pool.query(
    'SELECT is_super_admin AS "isSuperAdmin" FROM users WHERE id = $1',
    [userId]
  );

  const token = signToken({
    userId,
    storeId: target.id,
    roleCode: target.roleCode,
    isSuperAdmin: rows[0]?.isSuperAdmin || false,
  });

  return { token, activeStore: target };
}

module.exports = { register, login, switchStore, getStoresForUser };