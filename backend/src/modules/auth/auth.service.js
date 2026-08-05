const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/errorHandler');
const verificationCodes = require('./verificationCodes.service');
const mailer = require('../mailer/mailer.service');
const emailTemplates = require('../mailer/templates');

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
 *
 * Statut initial `PENDING_VERIFICATION` (§ cahier des charges "Système
 * d'envoi d'e-mails transactionnels", décidé en conversation) : le compte
 * est inutilisable tant que le code de vérification reçu par e-mail n'a pas
 * été validé via `verifyEmail` — aucun jeton de connexion n'est renvoyé ici.
 * La réinitialisation de mot de passe (§6.2) ne fonctionne que si l'e-mail
 * du compte est réellement accessible ; bloquer dès l'inscription évite un
 * compte définitivement perdu le jour où son mot de passe l'est aussi.
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
     VALUES ($1, $2, $3, $4, $5, $6, 'PENDING_VERIFICATION')
     RETURNING id, full_name AS "fullName", email, phone, gender,
               birth_date AS "birthDate", is_super_admin AS "isSuperAdmin",
               token_version AS "tokenVersion"`,
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
  // opérationnel dès que son compte sera vérifié. Échec silencieux et non
  // bloquant : si cette étape échoue pour une raison quelconque (course
  // concurrente, etc.), le compte est quand même créé normalement,
  // simplement sans boutique.
  try {
    const invitationResult = await pool.query(
      `SELECT si.id, si.store_id AS "storeId", si.role_id AS "roleId", si.invited_by AS "invitedBy"
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

      // E-mail à la personne qui a invité (§6.4 du cahier des charges) —
      // jamais awaité, un échec d'envoi ne doit jamais remettre en cause
      // l'inscription qui vient de réussir.
      pool
        .query(
          `SELECT (SELECT email FROM users WHERE id = $1) AS "inviterEmail",
                  (SELECT name FROM stores WHERE id = $2) AS "storeName"`,
          [invitation.invitedBy, invitation.storeId]
        )
        .then(({ rows }) => {
          if (!rows[0]?.inviterEmail || !rows[0]?.storeName) return;
          const { subject, html } = emailTemplates.invitationAcceptedEmail({
            inviteeName: user.fullName,
            storeName: rows[0].storeName,
          });
          mailer.sendEmail({ to: rows[0].inviterEmail, subject, html });
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error("Échec de l'envoi de l'e-mail de confirmation à l'inviteur :", err.message);
        });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Échec de la consommation d'invitation à l'inscription :", err.message);
  }

  // Code de vérification (§6.1 du cahier des charges) — jamais awaité,
  // l'envoi se fait en tâche de fond (§9) : un échec d'envoi est journalisé
  // sans jamais faire échouer l'inscription elle-même (l'utilisateur peut
  // toujours demander un renvoi depuis l'écran de vérification).
  verificationCodes
    .createCode(user.id, 'EMAIL_VERIFICATION')
    .then((code) => {
      const { subject, html } = emailTemplates.verificationCodeEmail({ code });
      mailer.sendEmail({ to: user.email, subject, html });
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("Échec de la génération/envoi du code de vérification :", err.message);
    });

  return { email: user.email, message: 'Compte créé — vérifiez votre e-mail pour activer votre compte.' };
}

/**
 * Valide le code de vérification reçu par e-mail (§6.1.4) — seul point
 * d'entrée qui fait réellement passer un compte de PENDING_VERIFICATION à
 * ACTIVE. En cas de succès, connecte automatiquement (renvoie un vrai
 * jeton), exactement comme `login()` — jamais besoin de ressaisir le mot
 * de passe juste après avoir prouvé la possession de l'e-mail.
 */
async function verifyEmail({ email, code }) {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, phone, gender, birth_date AS "birthDate",
            status, is_super_admin AS "isSuperAdmin", token_version AS "tokenVersion"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  const user = rows[0];

  // Message générique unique, quelle que soit la raison précise (compte
  // introuvable, déjà vérifié, code invalide/expiré/déjà utilisé) — cf. §8,
  // jamais aider à deviner un code ou révéler l'état exact d'un compte.
  const genericError = () => new AppError('Code invalide ou expiré.', 400, 'INVALID_CODE');

  if (!user || user.status !== 'PENDING_VERIFICATION') {
    throw genericError();
  }

  const valid = await verificationCodes.verifyAndConsumeCode(user.id, 'EMAIL_VERIFICATION', code);
  if (!valid) {
    throw genericError();
  }

  await pool.query("UPDATE users SET status = 'ACTIVE' WHERE id = $1", [user.id]);

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, NULL, 'VERIFY_EMAIL', '{}'::jsonb)`,
    [user.id]
  );

  const stores = await getStoresForUser(user.id);
  const activeStore =
    stores.length === 1 && stores[0].status !== 'SUSPENDED' ? stores[0] : null;

  const token = signToken({
    userId: user.id,
    storeId: activeStore?.id || null,
    roleCode: activeStore?.roleCode || null,
    isSuperAdmin: user.isSuperAdmin,
    tokenVersion: user.tokenVersion,
  });

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
 * Renvoie un nouveau code de vérification (§6.1.5) — invalide silencieusement
 * tout code encore actif (verificationCodes.service.js#createCode). Réponse
 * volontairement générique dans tous les cas (compte introuvable, déjà
 * vérifié, ou renvoi réussi) : même prudence qu'en §6.2.2, réduit la surface
 * d'énumération de comptes même si ce n'est pas strictement exigé ici.
 */
async function resendVerificationCode({ email }) {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, status FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  const user = rows[0];

  if (user && user.status === 'PENDING_VERIFICATION') {
    verificationCodes
      .createCode(user.id, 'EMAIL_VERIFICATION')
      .then((code) => {
        const { subject, html } = emailTemplates.verificationCodeEmail({ code });
        mailer.sendEmail({ to: user.email, subject, html });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Échec du renvoi du code de vérification :', err.message);
      });
  }

  return { message: 'Si un compte non vérifié existe avec cet e-mail, un nouveau code a été envoyé.' };
}

/**
 * Demande de réinitialisation de mot de passe (§6.2.1). Règle de sécurité
 * centrale (§6.2.2) : la réponse est STRICTEMENT identique que l'e-mail
 * existe ou non — jamais de branche observable côté client qui permettrait
 * de deviner quels e-mails ont un compte.
 */
async function requestPasswordReset({ email }) {
  const { rows } = await pool.query(
    `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  const user = rows[0];

  if (user) {
    verificationCodes
      .createCode(user.id, 'PASSWORD_RESET')
      .then((code) => {
        const { subject, html } = emailTemplates.passwordResetEmail({ code });
        mailer.sendEmail({ to: user.email, subject, html });
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Échec de la génération/envoi du code de réinitialisation :', err.message);
      });
  }

  return { message: 'Si ce compte existe, un code de réinitialisation a été envoyé.' };
}

/**
 * Finalise la réinitialisation (§6.2.3) — même message d'erreur générique
 * que `verifyEmail`, pour les mêmes raisons (§8). Le mot de passe validé
 * (correspondance + longueur minimale) est vérifié en amont par
 * auth.routes.js, cette fonction reçoit déjà `newPassword` de confiance.
 *
 * `token_version` incrémenté (même principe que removeEmployee/
 * revokeSuperAdmin, §A5 SOLUTIONS_AUDIT_PRODUCTION.md) : un mot de passe
 * réinitialisé — souvent signe qu'il a pu fuiter — doit invalider toute
 * session déjà ouverte ailleurs, pas seulement empêcher une future
 * connexion avec l'ancien mot de passe.
 */
async function resetPassword({ email, code, newPassword }) {
  const { rows } = await pool.query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
  const user = rows[0];

  const genericError = () => new AppError('Code invalide ou expiré.', 400, 'INVALID_CODE');
  if (!user) {
    throw genericError();
  }

  const valid = await verificationCodes.verifyAndConsumeCode(user.id, 'PASSWORD_RESET', code);
  if (!valid) {
    throw genericError();
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
  await pool.query(
    'UPDATE users SET password_hash = $1, token_version = token_version + 1 WHERE id = $2',
    [passwordHash, user.id]
  );

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, NULL, 'PASSWORD_RESET', '{}'::jsonb)`,
    [user.id]
  );

  return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
}

/**
 * Connexion d'un utilisateur existant (§4.1).
 */
async function login({ email, password }) {
  const { rows } = await pool.query(
    `SELECT id, full_name AS "fullName", email, password_hash AS "passwordHash",
            phone, gender, birth_date AS "birthDate",
            status, is_super_admin AS "isSuperAdmin", token_version AS "tokenVersion"
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  const user = rows[0];

  // Message volontairement générique : ne jamais indiquer si c'est l'e-mail
  // ou le mot de passe qui est incorrect (cf. bonnes pratiques de sécurité).
  if (!user) {
    throw new AppError('E-mail ou mot de passe incorrect.', 401, 'INVALID_CREDENTIALS');
  }

  // Exception délibérée et limitée (décidé en conversation, § cahier des
  // charges "Système d'envoi d'e-mails transactionnels") : un compte non
  // vérifié obtient un message distinct plutôt que le message générique
  // ci-dessous — jamais évalué avant d'avoir confirmé que le compte existe
  // réellement, donc ceci ne révèle jamais rien sur un e-mail inconnu ; et
  // comme le mot de passe n'est jamais vérifié dans cette branche, ça ne
  // révèle pas non plus si le mot de passe saisi était correct. Sans ce
  // message, quelqu'un revenant finir sa vérification des jours plus tard
  // se heurterait au même message qu'un mot de passe erroné, sans indice
  // pour se rediriger vers l'écran de code.
  if (user.status === 'PENDING_VERIFICATION') {
    throw new AppError(
      "Ce compte n'est pas encore vérifié. Consultez votre e-mail pour le code de vérification.",
      403,
      'EMAIL_NOT_VERIFIED'
    );
  }

  if (user.status !== 'ACTIVE') {
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
    tokenVersion: user.tokenVersion,
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
    'SELECT is_super_admin AS "isSuperAdmin", token_version AS "tokenVersion" FROM users WHERE id = $1',
    [userId]
  );

  const token = signToken({
    userId,
    storeId: target.id,
    roleCode: target.roleCode,
    isSuperAdmin: rows[0]?.isSuperAdmin || false,
    tokenVersion: rows[0]?.tokenVersion,
  });

  return { token, activeStore: target };
}

module.exports = {
  register,
  login,
  switchStore,
  getStoresForUser,
  verifyEmail,
  resendVerificationCode,
  requestPasswordReset,
  resetPassword,
};