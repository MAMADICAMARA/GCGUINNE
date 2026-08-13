const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

const SUBJECT_CATEGORIES = [
  'Problème technique',
  'Question sur mon abonnement',
  'Signaler un bug',
  'Suggestion d\'amélioration',
];

/**
 * Enregistre un message envoyé depuis la page "Contactez-nous" (§ décidé
 * en conversation). `storeId` peut être NULL (utilisateur sans boutique
 * active au moment de l'envoi) — jamais bloquant, contrairement aux
 * routes métier qui exigent `requireActiveStore`.
 */
async function createMessage(userId, storeId, subject, message) {
  const trimmedSubject = (subject || '').trim();
  const trimmedMessage = (message || '').trim();

  if (!trimmedSubject) {
    throw new AppError("L'objet du message est requis.", 400, 'VALIDATION_ERROR');
  }
  if (!trimmedMessage) {
    throw new AppError('Décrivez votre demande avant de l\'envoyer.', 400, 'VALIDATION_ERROR');
  }

  const { rows } = await pool.query(
    `INSERT INTO contact_messages (user_id, store_id, subject, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, created_at AS "createdAt"`,
    [userId, storeId || null, trimmedSubject, trimmedMessage]
  );
  return rows[0];
}

/**
 * Boîte de réception Super Admin — tout est déjà projeté ici (expéditeur,
 * boutique éventuelle) : pas de second aller-retour "détail" quand
 * l'admin ouvre un message, la ligne déjà chargée dans la liste suffit.
 */
async function listMessages({ page, limit, status } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  let idx = 1;
  if (status && status !== 'ALL') {
    conditions.push(`m.status = $${idx++}`);
    params.push(status);
  }
  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM contact_messages m ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT m.id, m.subject, m.message, m.status, m.created_at AS "createdAt",
            u.full_name AS "userName", u.email AS "userEmail", u.phone AS "userPhone",
            s.id AS "storeId", s.name AS "storeName"
     FROM contact_messages m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN stores s ON s.id = m.store_id
     ${whereClause}
     ORDER BY m.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    messages: result.rows,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

async function markMessageAsRead(id) {
  const { rows } = await pool.query(
    `UPDATE contact_messages SET status = 'READ' WHERE id = $1
     RETURNING id, status`,
    [id]
  );
  if (rows.length === 0) {
    throw new AppError('Message introuvable.', 404, 'MESSAGE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Section "Rejoignez la communauté" — `activeOnly` distingue la lecture
 * publique (page Contactez-nous, ne montre que les liens actifs) de la
 * lecture Super Admin (voit aussi les liens désactivés, pour pouvoir les
 * réactiver sans les recréer).
 */
async function listSocialLinks({ activeOnly } = {}) {
  const whereClause = activeOnly ? 'WHERE is_active = TRUE' : '';
  const { rows } = await pool.query(
    `SELECT id, label, url, icon_key AS "iconKey", display_order AS "displayOrder", is_active AS "isActive"
     FROM platform_social_links
     ${whereClause}
     ORDER BY display_order ASC, id ASC`
  );
  return rows;
}

function validateSocialLinkInput({ label, url, iconKey }) {
  if (!label || !label.trim()) {
    throw new AppError('Le libellé est requis.', 400, 'VALIDATION_ERROR');
  }
  if (!url || !url.trim()) {
    throw new AppError('Le lien est requis.', 400, 'VALIDATION_ERROR');
  }
  const allowedIcons = ['WHATSAPP', 'TELEGRAM', 'PHONE', 'EMAIL', 'OTHER'];
  if (iconKey && !allowedIcons.includes(iconKey)) {
    throw new AppError('Icône invalide.', 400, 'VALIDATION_ERROR');
  }
}

async function createSocialLink({ label, url, iconKey, displayOrder }) {
  validateSocialLinkInput({ label, url, iconKey });
  const { rows } = await pool.query(
    `INSERT INTO platform_social_links (label, url, icon_key, display_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, label, url, icon_key AS "iconKey", display_order AS "displayOrder", is_active AS "isActive"`,
    [label.trim(), url.trim(), iconKey || 'OTHER', displayOrder || 0]
  );
  return rows[0];
}

async function updateSocialLink(id, { label, url, iconKey, displayOrder, isActive }) {
  validateSocialLinkInput({ label, url, iconKey });
  const { rows } = await pool.query(
    `UPDATE platform_social_links
     SET label = $1, url = $2, icon_key = $3, display_order = $4, is_active = $5
     WHERE id = $6
     RETURNING id, label, url, icon_key AS "iconKey", display_order AS "displayOrder", is_active AS "isActive"`,
    [label.trim(), url.trim(), iconKey || 'OTHER', displayOrder || 0, isActive !== false, id]
  );
  if (rows.length === 0) {
    throw new AppError('Lien introuvable.', 404, 'LINK_NOT_FOUND');
  }
  return rows[0];
}

async function deleteSocialLink(id) {
  const { rowCount } = await pool.query('DELETE FROM platform_social_links WHERE id = $1', [id]);
  if (rowCount === 0) {
    throw new AppError('Lien introuvable.', 404, 'LINK_NOT_FOUND');
  }
  return { deleted: true };
}

/**
 * Vidéos tutoriel (§36_tutoriel.sql, décidé en conversation) — même
 * principe générique que les liens communauté ci-dessus. `activeOnly`
 * distingue la lecture publique (modal tutoriel, ne montre que les
 * vidéos actives) de la lecture Super Admin (voit aussi les vidéos
 * désactivées).
 */
async function listTutorialVideos({ activeOnly } = {}) {
  const whereClause = activeOnly ? 'WHERE is_active = TRUE' : '';
  const { rows } = await pool.query(
    `SELECT id, title, url, display_order AS "displayOrder", is_active AS "isActive"
     FROM platform_tutorial_videos
     ${whereClause}
     ORDER BY display_order ASC, id ASC`
  );
  return rows;
}

function validateTutorialVideoInput({ title, url }) {
  if (!title || !title.trim()) {
    throw new AppError('Le titre est requis.', 400, 'VALIDATION_ERROR');
  }
  if (!url || !url.trim()) {
    throw new AppError('Le lien de la vidéo est requis.', 400, 'VALIDATION_ERROR');
  }
}

async function createTutorialVideo({ title, url, displayOrder }) {
  validateTutorialVideoInput({ title, url });
  const { rows } = await pool.query(
    `INSERT INTO platform_tutorial_videos (title, url, display_order)
     VALUES ($1, $2, $3)
     RETURNING id, title, url, display_order AS "displayOrder", is_active AS "isActive"`,
    [title.trim(), url.trim(), displayOrder || 0]
  );
  return rows[0];
}

async function updateTutorialVideo(id, { title, url, displayOrder, isActive }) {
  validateTutorialVideoInput({ title, url });
  const { rows } = await pool.query(
    `UPDATE platform_tutorial_videos
     SET title = $1, url = $2, display_order = $3, is_active = $4
     WHERE id = $5
     RETURNING id, title, url, display_order AS "displayOrder", is_active AS "isActive"`,
    [title.trim(), url.trim(), displayOrder || 0, isActive !== false, id]
  );
  if (rows.length === 0) {
    throw new AppError('Vidéo introuvable.', 404, 'VIDEO_NOT_FOUND');
  }
  return rows[0];
}

async function deleteTutorialVideo(id) {
  const { rowCount } = await pool.query('DELETE FROM platform_tutorial_videos WHERE id = $1', [id]);
  if (rowCount === 0) {
    throw new AppError('Vidéo introuvable.', 404, 'VIDEO_NOT_FOUND');
  }
  return { deleted: true };
}

/**
 * Les deux réglages d'affichage automatique (§36_tutoriel.sql) — ligne
 * singleton, jamais NULL une fois la migration appliquée (INSERT initial).
 */
async function getTutorialSettings() {
  const { rows } = await pool.query(
    `SELECT show_after_signup AS "showAfterSignup", show_on_login AS "showOnLogin"
     FROM platform_tutorial_settings WHERE id = 1`
  );
  return rows[0];
}

async function updateTutorialSettings({ showAfterSignup, showOnLogin }) {
  const { rows } = await pool.query(
    `UPDATE platform_tutorial_settings
     SET show_after_signup = $1, show_on_login = $2
     WHERE id = 1
     RETURNING show_after_signup AS "showAfterSignup", show_on_login AS "showOnLogin"`,
    [!!showAfterSignup, !!showOnLogin]
  );
  return rows[0];
}

module.exports = {
  SUBJECT_CATEGORIES,
  createMessage,
  listMessages,
  markMessageAsRead,
  listSocialLinks,
  createSocialLink,
  updateSocialLink,
  deleteSocialLink,
  listTutorialVideos,
  createTutorialVideo,
  updateTutorialVideo,
  deleteTutorialVideo,
  getTutorialSettings,
  updateTutorialSettings,
};
