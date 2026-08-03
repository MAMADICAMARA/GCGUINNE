const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

const VALID_COLORS = ['yellow', 'blue', 'green', 'pink', 'gray'];

/**
 * Liste les notes de la boutique active — épinglées en premier, puis les
 * plus récemment modifiées (§19_notes_boutique.sql). `search` filtre sur le
 * titre ET le contenu, pour rester utile dès que le carnet grossit.
 */
async function listNotes(storeId, search) {
  const conditions = ['n.store_id = $1'];
  const params = [storeId];

  if (search && search.trim()) {
    conditions.push(`(n.title ILIKE $2 OR n.content ILIKE $2)`);
    params.push(`%${search.trim()}%`);
  }

  const { rows } = await pool.query(
    `SELECT n.id, n.title, n.content, n.color, n.is_pinned AS "isPinned",
            n.created_at AS "createdAt", n.updated_at AS "updatedAt",
            u.full_name AS "authorName"
     FROM store_notes n
     LEFT JOIN users u ON u.id = n.author_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY n.is_pinned DESC, n.updated_at DESC`,
    params
  );
  return rows;
}

function validateColor(color) {
  if (color !== undefined && !VALID_COLORS.includes(color)) {
    throw new AppError('Couleur de note invalide.', 400, 'INVALID_COLOR');
  }
}

async function createNote(storeId, authorId, { title, content, color }) {
  if (!content || !content.trim()) {
    throw new AppError('Le contenu de la note est requis.', 400, 'VALIDATION_ERROR');
  }
  validateColor(color);

  const { rows } = await pool.query(
    `INSERT INTO store_notes (store_id, author_id, title, content, color)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, content, color, is_pinned AS "isPinned",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [storeId, authorId, title?.trim() || null, content.trim(), color || 'yellow']
  );
  return rows[0];
}

/**
 * Modifie une note — n'importe quel membre de l'équipe peut modifier
 * n'importe quelle note (carnet partagé, décidé en conversation), toujours
 * filtré par store_id pour ne jamais toucher une note d'une autre boutique.
 *
 * Remplacement complet de titre/contenu (pas de fusion partielle) : le
 * formulaire d'édition renvoie toujours l'état complet de la note, ce qui
 * évite toute ambiguïté entre "champ non fourni" et "champ vidé
 * volontairement" (ex: effacer un titre existant). Seule `color` reste
 * facultative (conserve l'ancienne si omise).
 */
async function updateNote(storeId, noteId, { title, content, color }) {
  if (!content || !content.trim()) {
    throw new AppError('Le contenu de la note est requis.', 400, 'VALIDATION_ERROR');
  }
  validateColor(color);

  const { rows } = await pool.query(
    `UPDATE store_notes
     SET title = $3, content = $4, color = COALESCE($5, color)
     WHERE id = $1 AND store_id = $2
     RETURNING id, title, content, color, is_pinned AS "isPinned",
               created_at AS "createdAt", updated_at AS "updatedAt"`,
    [noteId, storeId, title?.trim() || null, content.trim(), color]
  );
  if (rows.length === 0) {
    throw new AppError('Note introuvable.', 404, 'NOTE_NOT_FOUND');
  }
  return rows[0];
}

async function togglePin(storeId, noteId) {
  const { rows } = await pool.query(
    `UPDATE store_notes SET is_pinned = NOT is_pinned
     WHERE id = $1 AND store_id = $2
     RETURNING id, is_pinned AS "isPinned"`,
    [noteId, storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Note introuvable.', 404, 'NOTE_NOT_FOUND');
  }
  return rows[0];
}

async function deleteNote(storeId, noteId) {
  const { rowCount } = await pool.query(
    'DELETE FROM store_notes WHERE id = $1 AND store_id = $2',
    [noteId, storeId]
  );
  if (rowCount === 0) {
    throw new AppError('Note introuvable.', 404, 'NOTE_NOT_FOUND');
  }
  return { removed: true };
}

module.exports = {
  listNotes,
  createNote,
  updateNote,
  togglePin,
  deleteNote,
};
