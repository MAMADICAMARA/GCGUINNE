const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Service métier — Gestion des mouvements de stock
 * Cahier des charges §4.5 — Historique immuable des variations de stock
 *
 * Principes:
 * - stock_movements est une table IMMUABLE (triggers prevent_update_delete)
 * - Chaque modification de quantité doit être précédée d'une ligne stock_movements
 * - Types autorisés: PURCHASE_IN, SALE_OUT, RETURN_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN
 * - Traçabilité complète: reference_table + reference_id pour lier l'origine
 */

// ============================================================================
// CREATE — Enregistrer un mouvement de stock
// ============================================================================

/**
 * recordMovement(productId, type, quantity, options)
 * Enregistrer un mouvement de stock immutable.
 *
 * @param {number} productId — ID du produit concerné
 * @param {string} type — Type de mouvement (PURCHASE_IN, SALE_OUT, etc.)
 * @param {number} quantity — Quantité (doit être > 0)
 * @param {object} options — {unitCost?, referenceTable?, referenceId?, userId?, note?, updateProductQty=true}
 * @returns {Promise<object>} — Mouvement créé {id, product_id, type, quantity, ...}
 * @throws {AppError} — Validation ou erreur métier
 */
async function recordMovement(productId, type, quantity, options = {}) {
  const {
    unitCost,
    referenceTable,
    referenceId,
    userId,
    note,
    updateProductQty = true, // Mettre à jour la quantité du produit?
  } = options;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Validation métier
    const validTypes = [
      'PURCHASE_IN',
      'SALE_OUT',
      'RETURN_IN',
      'ADJUSTMENT',
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ];
    if (!validTypes.includes(type)) {
      throw new AppError(`Type de mouvement invalide: ${type}`, 400);
    }

    if (quantity <= 0) {
      throw new AppError('La quantité doit être > 0', 400);
    }

    // Vérifier que le produit existe
    const productCheck = await client.query('SELECT quantity FROM products WHERE id = $1', [
      productId,
    ]);
    if (productCheck.rows.length === 0) {
      throw new AppError('Produit introuvable', 404);
    }

    const currentQty = productCheck.rows[0].quantity;

    // Insérer le mouvement immuable
    const movementResult = await client.query(
      `INSERT INTO stock_movements (
         product_id, type, quantity, unit_cost,
         reference_table, reference_id, user_id, note
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [productId, type, quantity, unitCost || null, referenceTable || null, referenceId || null, userId || null, note || null]
    );

    const movement = movementResult.rows[0];

    // Mettre à jour la quantité du produit selon le type
    if (updateProductQty) {
      let newQty = currentQty;

      if (type === 'PURCHASE_IN' || type === 'RETURN_IN' || type === 'TRANSFER_IN') {
        // Augmenter le stock
        newQty = currentQty + quantity;
      } else if (
        type === 'SALE_OUT' ||
        type === 'ADJUSTMENT' ||
        type === 'TRANSFER_OUT'
      ) {
        // Diminuer le stock
        newQty = currentQty - quantity;

        // Vérifier que le stock ne devient pas négatif
        if (newQty < 0) {
          throw new AppError(
            `Stock insuffisant: ${currentQty} disponible, ${quantity} demandé (${type})`,
            409
          );
        }
      }

      await client.query(
        'UPDATE products SET quantity = $1 WHERE id = $2',
        [newQty, productId]
      );
    }

    await client.query('COMMIT');
    return movement;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ============================================================================
// READ — Récupérer l'historique stock
// ============================================================================

/**
 * getStockHistory(productId, options)
 * Récupérer l'historique des mouvements de stock pour un produit.
 *
 * @param {number} productId — ID du produit
 * @param {object} options — {type?, startDate?, endDate?, limit=100}
 * @returns {Promise<array>} — Mouvements [...]
 */
async function getStockHistory(productId, options = {}) {
  const {
    type,
    startDate,
    endDate,
    limit = 100,
  } = options;

  let query = `
    SELECT id, product_id, type, quantity, unit_cost,
           reference_table, reference_id, user_id, note, created_at
    FROM stock_movements
    WHERE product_id = $1
  `;
  const params = [productId];
  let paramIndex = 2;

  // Filtrer par type si fourni
  if (type) {
    query += ` AND type = $${paramIndex}`;
    params.push(type);
    paramIndex++;
  }

  // Filtrer par date de début
  if (startDate) {
    query += ` AND created_at >= $${paramIndex}`;
    params.push(new Date(startDate));
    paramIndex++;
  }

  // Filtrer par date de fin
  if (endDate) {
    query += ` AND created_at <= $${paramIndex}`;
    params.push(new Date(endDate));
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
  params.push(limit);

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * getStockSummary(storeId)
 * Récupérer un résumé du stock par type de mouvement (statistiques).
 * Utile pour les dashboards.
 *
 * @param {number} storeId — ID boutique
 * @returns {Promise<object>} — {total_purchased, total_sold, total_returned, ...}
 */
async function getStockSummary(storeId) {
  const result = await pool.query(
    `SELECT
       type,
       COUNT(*) as count,
       SUM(quantity) as total_qty,
       SUM(unit_cost * quantity) as total_cost
     FROM stock_movements sm
     JOIN products p ON sm.product_id = p.id
     WHERE p.store_id = $1
     GROUP BY type
     ORDER BY type`,
    [storeId]
  );

  const summary = {};
  result.rows.forEach(row => {
    summary[row.type] = {
      count: parseInt(row.count, 10),
      totalQty: parseInt(row.total_qty, 10),
      totalCost: parseFloat(row.total_cost || 0),
    };
  });

  return summary;
}

// ============================================================================
// UTILITAIRES — Vérifications et validations
// ============================================================================

/**
 * verifyStockAvailable(productId, quantityRequired)
 * Vérifier si la quantité demandée est disponible en stock.
 *
 * @param {number} productId — ID du produit
 * @param {number} quantityRequired — Quantité à vérifier
 * @returns {Promise<boolean>} — true si stock suffisant
 * @throws {AppError} — Si produit introuvable ou stock insuffisant
 */
async function verifyStockAvailable(productId, quantityRequired) {
  const result = await pool.query(
    'SELECT quantity FROM products WHERE id = $1',
    [productId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Produit introuvable', 404);
  }

  const available = result.rows[0].quantity;

  if (available < quantityRequired) {
    throw new AppError(
      `Stock insuffisant pour ce produit: ${available} disponible, ${quantityRequired} demandé`,
      409
    );
  }

  return true;
}

/**
 * adjustStock(productId, quantityDelta, note)
 * Effectuer un ajustement d'inventaire (ADJUSTMENT type).
 * Utilisé pour corriger les écarts de comptage physique.
 *
 * @param {number} productId — ID du produit
 * @param {number} quantityDelta — Écart (+/-) par rapport à la BD
 * @param {string} note — Raison de l'ajustement
 * @returns {Promise<object>} — Mouvement créé
 */
async function adjustStock(productId, quantityDelta, note = '') {
  const absDelta = Math.abs(quantityDelta);
  const type = quantityDelta > 0 ? 'ADJUSTMENT' : 'ADJUSTMENT';

  return recordMovement(productId, type, absDelta, {
    note: `${quantityDelta > 0 ? 'Augmentation' : 'Diminution'} d'inventaire: ${note}`,
    updateProductQty: true,
  });
}

module.exports = {
  recordMovement,
  getStockHistory,
  getStockSummary,
  verifyStockAvailable,
  adjustStock,
};
