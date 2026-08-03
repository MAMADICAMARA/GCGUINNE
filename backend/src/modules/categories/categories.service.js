const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

async function listCategories(storeId) {
  const { rows } = await pool.query(
    `SELECT id, parent_id AS "parentId", name, created_at AS "createdAt"
     FROM categories WHERE store_id = $1 ORDER BY name ASC`,
    [storeId]
  );
  return rows;
}

async function createCategory(storeId, { name, parentId }) {
  if (!name || !name.trim()) {
    throw new AppError('Le nom de la catégorie est requis.', 400, 'VALIDATION_ERROR');
  }

  if (parentId) {
    const parent = await pool.query(
      'SELECT id FROM categories WHERE id = $1 AND store_id = $2',
      [parentId, storeId]
    );
    if (parent.rows.length === 0) {
      throw new AppError('Catégorie parente introuvable.', 404, 'CATEGORY_NOT_FOUND');
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO categories (store_id, parent_id, name)
     VALUES ($1, $2, $3)
     RETURNING id, parent_id AS "parentId", name, created_at AS "createdAt"`,
    [storeId, parentId || null, name.trim()]
  );
  return rows[0];
}

module.exports = { listCategories, createCategory };