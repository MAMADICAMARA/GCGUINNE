const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Valide et normalise une liste de paliers de prix dégressif
 * (§31_prix_degressif_grossiste.sql, décidé en conversation) — utilisé par
 * `createProduct`/`updateProduct` avant toute écriture en base. Vérifie :
 * quantité minimum entière > 1, prix >= 0, jamais deux paliers à la même
 * quantité, jamais un palier plus cher que le prix de vente normal, et
 * surtout que le prix BAISSE strictement à mesure que la quantité minimum
 * AUGMENTE (sinon un palier "plus grand" serait plus cher que le
 * précédent — contraire au principe même du prix dégressif, presque
 * certainement une erreur de saisie plutôt qu'une intention réelle).
 * Retourne la liste triée par quantité croissante, prête à insérer.
 */
function validateAndNormalizeTiers(tiers, sellingPrice) {
  if (tiers == null) return [];
  if (!Array.isArray(tiers)) {
    throw new AppError('Les paliers de prix sont invalides.', 400, 'VALIDATION_ERROR');
  }
  if (tiers.length === 0) return [];

  const seenQuantities = new Set();
  const normalized = tiers.map((t) => {
    const minQuantity = parseInt(t.minQuantity, 10);
    const unitPrice = Number(t.unitPrice);
    if (!Number.isInteger(minQuantity) || minQuantity <= 1) {
      throw new AppError(
        "La quantité minimum d'un palier doit être un entier supérieur à 1.",
        400,
        'VALIDATION_ERROR'
      );
    }
    if (typeof unitPrice !== 'number' || Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new AppError("Le prix d'un palier est invalide.", 400, 'VALIDATION_ERROR');
    }
    if (unitPrice > sellingPrice) {
      throw new AppError(
        'Le prix d\'un palier ne peut pas dépasser le prix de vente normal.',
        400,
        'VALIDATION_ERROR'
      );
    }
    if (seenQuantities.has(minQuantity)) {
      throw new AppError('Deux paliers ne peuvent pas avoir la même quantité minimum.', 400, 'VALIDATION_ERROR');
    }
    seenQuantities.add(minQuantity);
    return { minQuantity, unitPrice };
  });

  normalized.sort((a, b) => a.minQuantity - b.minQuantity);
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i].unitPrice >= normalized[i - 1].unitPrice) {
      throw new AppError(
        'Le prix doit diminuer à chaque palier de quantité supérieure.',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  return normalized;
}

/**
 * Prix unitaire réellement applicable pour une quantité donnée — le plus
 * grand palier dont la quantité minimum est atteinte, sinon le prix de
 * vente normal. `tiers` doit être trié par quantité croissante (déjà
 * garanti par `validateAndNormalizeTiers` et par le tri en base des
 * lectures ci-dessous). Utilisé ici ET par orders.service.js#createOrder —
 * jamais recalculé différemment à deux endroits.
 */
function getEffectiveUnitPrice(basePrice, tiers, quantity) {
  if (!tiers || tiers.length === 0) return basePrice;
  let applicable = basePrice;
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) {
      applicable = tier.unitPrice;
    }
  }
  return applicable;
}

async function replaceProductPriceTiers(client, productId, tiers) {
  await client.query('DELETE FROM product_price_tiers WHERE product_id = $1', [productId]);
  for (const tier of tiers) {
    await client.query(
      `INSERT INTO product_price_tiers (product_id, min_quantity, unit_price) VALUES ($1, $2, $3)`,
      [productId, tier.minQuantity, tier.unitPrice]
    );
  }
}

const PRICE_TIERS_SUBQUERY = `
  COALESCE(
    (SELECT json_agg(json_build_object('id', pt.id, 'minQuantity', pt.min_quantity, 'unitPrice', pt.unit_price) ORDER BY pt.min_quantity)
     FROM product_price_tiers pt WHERE pt.product_id = p.id),
    '[]'::json
  ) AS "priceTiers"
`;

/**
 * Liste paginée des produits d'une boutique, avec recherche et filtres
 * (cf. §4.4 du cahier des charges — recherche rapide pensée pour la caisse).
 * @param {number} storeId
 * @param {object} options - {page, limit, search, status, categoryId, lowStockOnly}
 */
async function listProducts(storeId, options = {}) {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(200, parseInt(options.limit, 10) || 20);
  const offset = (page - 1) * limit;

  const conditions = ['store_id = $1'];
  const params = [storeId];
  let idx = 2;

  // Par défaut on n'affiche que les produits actifs, sauf demande explicite
  const status = options.status || 'ACTIVE';
  if (status !== 'ALL') {
    conditions.push(`status = $${idx++}`);
    params.push(status);
  }

  if (options.categoryId) {
    conditions.push(`category_id = $${idx++}`);
    params.push(options.categoryId);
  }

  if (options.search) {
    // La recherche porte aussi sur les attributs (attributes::text) — ex:
    // un modèle de téléphone comme "BG6" partagé entre plusieurs pièces
    // différentes (écran, plaquette, batterie...), stocké en attribut
    // plutôt qu'en référence (qui, elle, doit rester unique par produit).
    conditions.push(`(name ILIKE $${idx} OR reference ILIKE $${idx} OR attributes::text ILIKE $${idx})`);
    params.push(`%${options.search}%`);
    idx++;
  }

  if (options.lowStockOnly === true || options.lowStockOnly === 'true') {
    conditions.push('quantity <= low_stock_threshold');
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM products WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limit, offset];
  const result = await pool.query(
    `SELECT id, category_id AS "categoryId", name, reference, description,
            purchase_price AS "purchasePrice", selling_price AS "sellingPrice",
            quantity, low_stock_threshold AS "lowStockThreshold",
            attributes, image_url AS "imageUrl", status,
            created_at AS "createdAt", updated_at AS "updatedAt",
            ${PRICE_TIERS_SUBQUERY}
     FROM products p
     WHERE ${whereClause}
     ORDER BY name ASC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    products: result.rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

async function getProductById(storeId, productId) {
  const { rows } = await pool.query(
    `SELECT id, category_id AS "categoryId", name, reference, description,
            purchase_price AS "purchasePrice", selling_price AS "sellingPrice",
            quantity, low_stock_threshold AS "lowStockThreshold",
            attributes, image_url AS "imageUrl", status,
            created_at AS "createdAt", updated_at AS "updatedAt",
            ${PRICE_TIERS_SUBQUERY}
     FROM products p WHERE store_id = $1 AND id = $2`,
    [storeId, productId]
  );
  if (rows.length === 0) {
    throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
  }
  return rows[0];
}

async function createProduct(storeId, userId, data) {
  if (!data.name || !data.name.trim()) {
    throw new AppError('Le nom du produit est requis.', 400, 'VALIDATION_ERROR');
  }
  if (data.purchasePrice == null || data.purchasePrice < 0) {
    throw new AppError('Le prix d\'achat est invalide.', 400, 'VALIDATION_ERROR');
  }
  if (data.sellingPrice == null || data.sellingPrice < 0) {
    throw new AppError('Le prix de vente est invalide.', 400, 'VALIDATION_ERROR');
  }
  const priceTiers = validateAndNormalizeTiers(data.priceTiers, data.sellingPrice);

  const initialQuantity = data.quantity || 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO products
         (store_id, category_id, name, reference, description,
          purchase_price, selling_price, quantity, low_stock_threshold,
          attributes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
       RETURNING id, category_id AS "categoryId", name, reference, description,
                 purchase_price AS "purchasePrice", selling_price AS "sellingPrice",
                 quantity, low_stock_threshold AS "lowStockThreshold",
                 attributes, image_url AS "imageUrl", status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        storeId,
        data.categoryId || null,
        data.name.trim(),
        data.reference || null,
        data.description || null,
        data.purchasePrice,
        data.sellingPrice,
        initialQuantity,
        data.lowStockThreshold ?? 5,
        JSON.stringify(data.attributes || {}),
        data.imageUrl || null,
      ]
    );
    const product = rows[0];

    if (priceTiers.length > 0) {
      await replaceProductPriceTiers(client, product.id, priceTiers);
    }
    product.priceTiers = priceTiers;

    // Toute quantité initiale non nulle doit être tracée, exactement comme
    // n'importe quelle autre variation de stock (§4.5 du cahier des
    // charges) — sans ce mouvement, l'historique du produit serait vide
    // alors même qu'il a démarré avec du stock.
    if (initialQuantity > 0) {
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, user_id, note)
         VALUES ($1, 'INITIAL_STOCK', $2, $3, 'Stock initial à la création du produit')`,
        [product.id, initialQuantity, userId]
      );
    }

    await client.query('COMMIT');
    return product;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateProduct(storeId, productId, data) {
  // On vérifie d'abord l'existence pour renvoyer un 404 propre plutôt
  // qu'un UPDATE silencieusement sans effet.
  await getProductById(storeId, productId);

  const priceTiers = validateAndNormalizeTiers(data.priceTiers, data.sellingPrice);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `UPDATE products SET
         category_id = $1,
         name = $2,
         reference = $3,
         description = $4,
         purchase_price = $5,
         selling_price = $6,
         low_stock_threshold = $7,
         attributes = $8::jsonb,
         image_url = $9
       WHERE store_id = $10 AND id = $11
       RETURNING id, category_id AS "categoryId", name, reference, description,
                 purchase_price AS "purchasePrice", selling_price AS "sellingPrice",
                 quantity, low_stock_threshold AS "lowStockThreshold",
                 attributes, image_url AS "imageUrl", status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        data.categoryId || null,
        data.name.trim(),
        data.reference || null,
        data.description || null,
        data.purchasePrice,
        data.sellingPrice,
        data.lowStockThreshold ?? 5,
        JSON.stringify(data.attributes || {}),
        data.imageUrl || null,
        storeId,
        productId,
      ]
    );
    const product = rows[0];

    // Remplace TOUJOURS l'ensemble des paliers par celui envoyé (jamais un
    // patch partiel) — le formulaire produit gère la liste complète à
    // chaque enregistrement, donc la base doit refléter exactement ce
    // qu'il a soumis, y compris "aucun palier" si la liste est vide.
    await replaceProductPriceTiers(client, productId, priceTiers);
    product.priceTiers = priceTiers;

    await client.query('COMMIT');
    return product;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Désactivation (jamais de suppression physique — cf. §12 du cahier des
 * charges : un produit déjà vendu doit conserver son historique).
 */
async function deactivateProduct(storeId, productId) {
  await getProductById(storeId, productId);
  await pool.query(
    `UPDATE products SET status = 'INACTIVE' WHERE store_id = $1 AND id = $2`,
    [storeId, productId]
  );
  return { productId, status: 'INACTIVE' };
}

async function reactivateProduct(storeId, productId) {
  await getProductById(storeId, productId);
  await pool.query(
    `UPDATE products SET status = 'ACTIVE' WHERE store_id = $1 AND id = $2`,
    [storeId, productId]
  );
  return { productId, status: 'ACTIVE' };
}

/**
 * Ajustement manuel de stock (inventaire physique), réservé à
 * Owner (§4.5). Toute variation passe par un mouvement typé.
 */
async function adjustStock(storeId, productId, delta, userId, note) {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new AppError('La quantité d\'ajustement doit être un entier non nul.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      'SELECT id, quantity FROM products WHERE store_id = $1 AND id = $2 FOR UPDATE',
      [storeId, productId]
    );
    if (productResult.rows.length === 0) {
      throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
    }

    // Même règle que pour la vente : désactivation automatique si le
    // stock atteint 0, jamais de réactivation automatique en sens inverse.
    const updateResult = await client.query(
      `UPDATE products
       SET quantity = quantity + $1,
           status = CASE WHEN quantity + $1 = 0 THEN 'INACTIVE' ELSE status END
       WHERE id = $2 AND quantity + $1 >= 0
       RETURNING quantity, status`,
      [delta, productId]
    );
    if (updateResult.rowCount === 0) {
      throw new AppError('Cet ajustement rendrait le stock négatif.', 409, 'NEGATIVE_STOCK');
    }

    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, reference_table, user_id, note)
       VALUES ($1, 'ADJUSTMENT', $2, 'manual', $3, $4)`,
      [productId, Math.abs(delta), userId, note || null]
    );

    await client.query('COMMIT');
    return {
      productId,
      newQuantity: updateResult.rows[0].quantity,
      newStatus: updateResult.rows[0].status,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Historique des mouvements de stock d'un produit (§4.5).
 */
async function getStockHistory(storeId, productId) {
  await getProductById(storeId, productId);
  const { rows } = await pool.query(
    `SELECT id, type, quantity, unit_cost AS "unitCost", reference_table AS "referenceTable",
            reference_id AS "referenceId", user_id AS "userId", note,
            created_at AS "createdAt"
     FROM stock_movements
     WHERE product_id = $1
     ORDER BY created_at DESC
     LIMIT 200`,
    [productId]
  );
  return rows;
}

/**
 * Historique des mouvements de stock à l'échelle de TOUTE la boutique
 * (contrairement à getStockHistory, qui est limité à un seul produit) —
 * même modèle, avec le nom du produit joint. Utilisé par la supervision
 * enrichie (§ décidé en conversation : "ajustements de stock, date,
 * quantité" pour la boutique supervisée dans son ensemble).
 */
async function getStoreStockMovements(storeId, options = {}) {
  const limit = Math.min(200, parseInt(options.limit, 10) || 100);
  const { rows } = await pool.query(
    `SELECT sm.id, sm.type, sm.quantity, sm.unit_cost AS "unitCost",
            sm.reference_table AS "referenceTable", sm.reference_id AS "referenceId",
            sm.user_id AS "userId", sm.note, sm.created_at AS "createdAt",
            p.id AS "productId", p.name AS "productName"
     FROM stock_movements sm
     JOIN products p ON p.id = sm.product_id
     WHERE p.store_id = $1
     ORDER BY sm.created_at DESC
     LIMIT $2`,
    [storeId, limit]
  );
  return rows;
}

module.exports = {
  listProducts,
  getProductById,
  createProduct,
  updateProduct,
  deactivateProduct,
  reactivateProduct,
  adjustStock,
  getStoreStockMovements,
  getStockHistory,
  getEffectiveUnitPrice,
};