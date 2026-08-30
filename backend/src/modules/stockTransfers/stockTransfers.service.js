const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { getEffectivePlan } = require('../../utils/planContext');

/**
 * Transfert de stock entre boutiques (§45_transfert_de_stock.sql, décidé
 * en conversation) — réinterprétation de stock_transfers (existant depuis
 * §06_multi_boutiques.sql, jamais câblé) pour un usage réel : deux
 * boutiques de propriétaires DIFFÉRENTS, reliées par le code de transfert
 * de la boutique destination (même mécanisme que supervision_code/
 * supplier_code), et du MÊME type de boutique (store_type_id) — sinon
 * refusé. Instantané : au clic sur "Confirmer", le stock est retiré de la
 * boutique source et un nouveau produit est créé dans la boutique
 * destination (deux catalogues indépendants, aucun lien automatique entre
 * "le même" produit dans deux boutiques n'existe ailleurs dans le projet).
 */

/**
 * Résout un code de transfert vers sa boutique destination — appelé
 * pendant la saisie (avant confirmation) pour un aperçu clair et une
 * erreur immédiate en cas d'incompatibilité de type de boutique, sans
 * attendre l'échec de la vraie création. Revérifié intégralement dans
 * createTransfer ci-dessous — jamais fait confiance à ce seul aperçu.
 */
async function resolveTransferCode(sourceStoreId, code) {
  const trimmed = (code || '').trim().toUpperCase();
  if (!trimmed) {
    throw new AppError('Code de transfert requis.', 400, 'VALIDATION_ERROR');
  }

  const sourceResult = await pool.query('SELECT store_type_id AS "storeTypeId" FROM stores WHERE id = $1', [
    sourceStoreId,
  ]);
  const sourceStoreTypeId = sourceResult.rows[0]?.storeTypeId;

  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.store_type_id AS "storeTypeId", st.label AS "storeTypeLabel"
     FROM stores s
     LEFT JOIN store_types st ON st.id = s.store_type_id
     WHERE s.transfer_code = $1`,
    [trimmed]
  );
  if (rows.length === 0) {
    throw new AppError('Aucune boutique ne correspond à ce code de transfert.', 404, 'TRANSFER_CODE_NOT_FOUND');
  }
  const destination = rows[0];

  if (destination.id === sourceStoreId) {
    throw new AppError(
      'Vous ne pouvez pas transférer du stock vers votre propre boutique.',
      400,
      'TRANSFER_SELF'
    );
  }
  if (destination.storeTypeId !== sourceStoreTypeId) {
    throw new AppError(
      `Transfert impossible : "${destination.name}" n'est pas du même type de boutique que la vôtre.`,
      400,
      'TRANSFER_STORE_TYPE_MISMATCH'
    );
  }

  return { storeId: destination.id, storeName: destination.name, storeTypeLabel: destination.storeTypeLabel };
}

/**
 * Transfert instantané — toute la logique dans une seule transaction :
 * décrémenter la boutique source, créer le produit dans la boutique
 * destination, tracer les deux mouvements de stock et la ligne
 * stock_transfers elle-même. Tout échec annule tout, jamais de source
 * décrémentée sans destination créée.
 */
async function createTransfer(sourceStoreId, userId, { transferCode, productId, quantity }) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new AppError('La quantité à transférer doit être un entier positif.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sourceStoreResult = await client.query('SELECT store_type_id AS "storeTypeId" FROM stores WHERE id = $1', [
      sourceStoreId,
    ]);
    const sourceStoreTypeId = sourceStoreResult.rows[0]?.storeTypeId;

    const trimmedCode = (transferCode || '').trim().toUpperCase();
    const destResult = await client.query(
      'SELECT id, name, store_type_id AS "storeTypeId" FROM stores WHERE transfer_code = $1',
      [trimmedCode]
    );
    if (destResult.rows.length === 0) {
      throw new AppError('Aucune boutique ne correspond à ce code de transfert.', 404, 'TRANSFER_CODE_NOT_FOUND');
    }
    const destination = destResult.rows[0];
    if (destination.id === sourceStoreId) {
      throw new AppError(
        'Vous ne pouvez pas transférer du stock vers votre propre boutique.',
        400,
        'TRANSFER_SELF'
      );
    }
    if (destination.storeTypeId !== sourceStoreTypeId) {
      throw new AppError(
        `Transfert impossible : "${destination.name}" n'est pas du même type de boutique que la vôtre.`,
        400,
        'TRANSFER_STORE_TYPE_MISMATCH'
      );
    }

    // Décrémente la boutique source, garde-fou anti-survente atomique —
    // même principe exact que products.service.js#adjustStock.
    const productResult = await client.query(
      `UPDATE products SET quantity = quantity - $1
       WHERE id = $2 AND store_id = $3 AND quantity >= $1
       RETURNING id, category_id AS "categoryId", name, reference, description,
                 purchase_price AS "purchasePrice", selling_price AS "sellingPrice",
                 low_stock_threshold AS "lowStockThreshold", attributes, image_url AS "imageUrl"`,
      [qty, productId, sourceStoreId]
    );
    if (productResult.rows.length === 0) {
      // Distingue "introuvable" de "stock insuffisant" pour un message clair.
      const exists = await client.query('SELECT quantity FROM products WHERE id = $1 AND store_id = $2', [
        productId,
        sourceStoreId,
      ]);
      if (exists.rows.length === 0) {
        throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
      }
      throw new AppError(
        `Stock insuffisant — il ne reste que ${exists.rows[0].quantity} en stock.`,
        400,
        'INSUFFICIENT_STOCK'
      );
    }
    const sourceProduct = productResult.rows[0];

    // Plafond de produits actifs de la boutique destination — même règle
    // que products.service.js#createProduct, jamais contournable par un
    // transfert plutôt qu'une création manuelle.
    const destPlan = await getEffectivePlan(destination.id);
    const destCountResult = await client.query(
      `SELECT COUNT(*) AS count FROM products WHERE store_id = $1 AND status = 'ACTIVE'`,
      [destination.id]
    );
    if (parseInt(destCountResult.rows[0].count, 10) >= destPlan.maxProductsPerStore) {
      throw new AppError(
        `Transfert impossible : le plan ${destPlan.planName} de "${destination.name}" est déjà limité à ${destPlan.maxProductsPerStore} produit(s) actif(s).`,
        403,
        'DEST_PLAN_PRODUCT_LIMIT_REACHED'
      );
    }

    // Catégorie de destination retrouvée par nom — jamais l'id brut de la
    // source (qui appartient à une autre boutique). Les deux boutiques
    // partagent le même gabarit de catégories puisqu'elles sont du même
    // type, mais un Owner a pu renommer/supprimer la sienne : repli sur
    // NULL (non catégorisé) si aucune correspondance.
    let destCategoryId = null;
    if (sourceProduct.categoryId) {
      const catResult = await client.query(
        `SELECT dest.id
         FROM categories src
         JOIN categories dest ON dest.name = src.name AND dest.store_id = $2
         WHERE src.id = $1`,
        [sourceProduct.categoryId, destination.id]
      );
      destCategoryId = catResult.rows[0]?.id || null;
    }

    const newProductResult = await client.query(
      `INSERT INTO products
         (store_id, category_id, name, reference, description,
          purchase_price, selling_price, quantity, low_stock_threshold,
          attributes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
       RETURNING id, name, quantity`,
      [
        destination.id,
        destCategoryId,
        sourceProduct.name,
        sourceProduct.reference,
        sourceProduct.description,
        sourceProduct.purchasePrice,
        sourceProduct.sellingPrice,
        qty,
        sourceProduct.lowStockThreshold,
        JSON.stringify(sourceProduct.attributes || {}),
        sourceProduct.imageUrl,
      ]
    );
    const newProduct = newProductResult.rows[0];

    const transferResult = await client.query(
      `INSERT INTO stock_transfers
         (from_store_id, to_store_id, product_id, to_product_id, quantity, status, created_by, shipped_at, received_at)
       VALUES ($1, $2, $3, $4, $5, 'RECEIVED', $6, NOW(), NOW())
       RETURNING id, created_at AS "createdAt"`,
      [sourceStoreId, destination.id, sourceProduct.id, newProduct.id, qty, userId]
    );
    const transfer = transferResult.rows[0];

    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_table, reference_id, user_id, note)
       VALUES ($1, 'TRANSFER_OUT', $2, 'stock_transfers', $3, $4, $5)`,
      [sourceProduct.id, qty, transfer.id, userId, `Transféré vers ${destination.name}`]
    );
    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_table, reference_id, user_id, note)
       VALUES ($1, 'TRANSFER_IN', $2, 'stock_transfers', $3, $4, 'Reçu par transfert')`,
      [newProduct.id, qty, transfer.id, userId]
    );

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'STOCK_TRANSFER_SENT', $3::jsonb)`,
      [
        userId,
        sourceStoreId,
        JSON.stringify({
          transferId: transfer.id,
          productName: sourceProduct.name,
          quantity: qty,
          toStoreId: destination.id,
          toStoreName: destination.name,
        }),
      ]
    );
    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'STOCK_TRANSFER_RECEIVED', $3::jsonb)`,
      [
        userId,
        destination.id,
        JSON.stringify({ transferId: transfer.id, productName: sourceProduct.name, quantity: qty, fromStoreId: sourceStoreId }),
      ]
    );

    await client.query('COMMIT');
    return {
      transferId: transfer.id,
      createdAt: transfer.createdAt,
      productName: sourceProduct.name,
      quantity: qty,
      toStoreId: destination.id,
      toStoreName: destination.name,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { resolveTransferCode, createTransfer };
