const pool = require('../../config/db');
const { getEffectivePlan } = require('../../utils/planContext');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Produits "verrouillés" au-delà du plafond du plan effectif de la
 * boutique (§ décidé en conversation — ex : une boutique PROFESSIONNEL
 * avec 200 produits qui retombe en FREEMIUM à l'expiration, plafonné à
 * 50). Les plus ANCIENS restent déverrouillés (ORDER BY created_at ASC) —
 * ce sur quoi le commerce s'est construit — le reste se verrouille.
 * Complètement gelé : ni consultable, ni modifiable, ni vendable, tant
 * que le plan n'est pas remonté (ou que le marchand désactive un produit
 * plus ancien pour faire de la place — la désactivation reste toujours
 * possible, jamais bloquée par cette règle).
 *
 * Réutilisé par listProducts (affichage), getProductById (blocage
 * consultation/édition), adjustStock (blocage ajustement) et
 * orders.service.js#createOrder (blocage vente) — une seule requête,
 * jamais une logique de rang dupliquée à plusieurs endroits.
 */
async function getLockedProductIds(storeId, plan) {
  const { rows } = await pool.query(
    `SELECT id FROM products
     WHERE store_id = $1 AND status = 'ACTIVE'
     ORDER BY created_at ASC, id ASC
     OFFSET $2`,
    [storeId, plan.maxProductsPerStore]
  );
  return new Set(rows.map((r) => r.id));
}

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
    // plutôt qu'en référence (qui, elle, ne doit rester unique QUE par
    // catégorie — §55_reference_unique_par_categorie.sql, décidé en
    // conversation : deux pièces de catégories différentes peuvent
    // partager la même référence constructeur).
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

  // Verrouillage par plafond de plan (§ décidé en conversation) — calculé
  // sur l'ensemble des produits ACTIFS de la boutique, jamais seulement
  // sur la page affichée (sinon un filtre/une recherche fausserait le
  // rang). `planName`/`maxProductsPerStore` remontés en plus pour que le
  // front puisse composer un message d'upgrade sans requête séparée.
  const plan = await getEffectivePlan(storeId);
  const lockedIds = await getLockedProductIds(storeId, plan);
  const products = result.rows.map((row) => ({ ...row, locked: lockedIds.has(row.id) }));

  return {
    products,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    planName: plan.planName,
    maxProductsPerStore: plan.maxProductsPerStore,
  };
}

/**
 * Utilisée à la fois pour "voir le détail" (GET /products/:id) ET comme
 * pré-vérification d'existence par updateProduct — le blocage "produit
 * verrouillé" ci-dessous s'applique donc naturellement aux deux : ni
 * consultable, ni modifiable, tant que le plan ne le permet pas. Jamais
 * utilisée par deactivate/reactivate (qui font leur propre vérification
 * minimale) : désactiver un produit verrouillé reste toujours possible,
 * c'est justement l'échappatoire qui fait de la place pour un autre.
 */
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
  const product = rows[0];

  if (product.status === 'ACTIVE') {
    const plan = await getEffectivePlan(storeId);
    const lockedIds = await getLockedProductIds(storeId, plan);
    if (lockedIds.has(product.id)) {
      throw new AppError(
        `Ce produit est verrouillé — le plan ${plan.planName} est limité à ${plan.maxProductsPerStore} produit(s) actif(s). Passez à un plan supérieur pour le débloquer.`,
        403,
        'PLAN_PRODUCT_LOCKED'
      );
    }
  }

  return product;
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
  // Plafond de produits actifs par plan (§41_max_products_per_store.sql,
  // décidé en conversation) — même principe que le plafond d'utilisateurs
  // (employees.service.js#addEmployee) : on compte, on compare, on refuse
  // AVANT toute écriture. Seuls les produits ACTIVE comptent : désactiver
  // un produit libère de la place dans le plan.
  const plan = await getEffectivePlan(storeId);
  const productCountResult = await pool.query(
    `SELECT COUNT(*) AS count FROM products WHERE store_id = $1 AND status = 'ACTIVE'`,
    [storeId]
  );
  const currentProductCount = parseInt(productCountResult.rows[0].count, 10);
  if (currentProductCount >= plan.maxProductsPerStore) {
    throw new AppError(
      `Le plan ${plan.planName} est limité à ${plan.maxProductsPerStore} produit(s) actif(s) par boutique.`,
      403,
      'PLAN_PRODUCT_LIMIT_REACHED'
    );
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
    // Référence en double DANS LA MÊME catégorie (§55_reference_unique_
    // par_categorie.sql, décidé en conversation) — message clair plutôt
    // que de laisser fuir l'erreur Postgres brute.
    if (err.code === '23505' && err.constraint === 'uq_products_store_category_reference') {
      throw new AppError(
        'Cette référence est déjà utilisée par un autre produit de cette catégorie.',
        409,
        'DUPLICATE_REFERENCE'
      );
    }
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
    // Référence en double DANS LA MÊME catégorie (§55_reference_unique_
    // par_categorie.sql, décidé en conversation) — message clair plutôt
    // que de laisser fuir l'erreur Postgres brute.
    if (err.code === '23505' && err.constraint === 'uq_products_store_category_reference') {
      throw new AppError(
        'Cette référence est déjà utilisée par un autre produit de cette catégorie.',
        409,
        'DUPLICATE_REFERENCE'
      );
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Vérification d'existence minimale, sans le blocage "produit verrouillé"
 * de getProductById ci-dessus — utilisée uniquement par deactivate/
 * reactivate : désactiver un produit doit TOUJOURS rester possible, même
 * verrouillé, puisque c'est justement l'échappatoire qui libère une place
 * pour qu'un autre produit redevienne déverrouillé (les plus anciens
 * ACTIFS priment — voir getLockedProductIds).
 */
async function assertProductExists(storeId, productId) {
  const { rows } = await pool.query('SELECT id FROM products WHERE store_id = $1 AND id = $2', [
    storeId,
    productId,
  ]);
  if (rows.length === 0) {
    throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
  }
}

/**
 * Désactivation (jamais de suppression physique — cf. §12 du cahier des
 * charges : un produit déjà vendu doit conserver son historique).
 */
async function deactivateProduct(storeId, productId) {
  await assertProductExists(storeId, productId);
  await pool.query(
    `UPDATE products SET status = 'INACTIVE' WHERE store_id = $1 AND id = $2`,
    [storeId, productId]
  );
  return { productId, status: 'INACTIVE' };
}

async function reactivateProduct(storeId, productId) {
  await assertProductExists(storeId, productId);
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

  // Un produit verrouillé (plafond de plan dépassé) ne peut pas non plus
  // voir son stock ajusté — même règle que consulter/modifier. Number()
  // ici est important : productId arrive en chaîne depuis la route
  // (req.params.id), alors que le Set contient des entiers PostgreSQL —
  // sans cette conversion, .has() ne trouverait jamais de correspondance.
  const plan = await getEffectivePlan(storeId);
  const lockedIds = await getLockedProductIds(storeId, plan);
  if (lockedIds.has(Number(productId))) {
    throw new AppError(
      `Ce produit est verrouillé — le plan ${plan.planName} est limité à ${plan.maxProductsPerStore} produit(s) actif(s). Passez à un plan supérieur pour le débloquer.`,
      403,
      'PLAN_PRODUCT_LOCKED'
    );
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
 * Suggestions de doublons probables au sein du catalogue DE LA BOUTIQUE
 * (§50_fusion_produits_doublons.sql, décidé en conversation) — même
 * technique de similarité de nom (pg_trgm) que
 * purchases.service.js#suggestMatchingProducts, mais en auto-jointure sur
 * les produits ACTIFS d'une même boutique plutôt qu'une recherche par nom
 * donné. `a.id < b.id` évite les doublons de paires (A,B) et (B,A).
 * Simple suggestion à vérifier/confirmer par l'Owner, jamais une fusion
 * automatique.
 */
async function suggestDuplicateProducts(storeId) {
  const { rows } = await pool.query(
    `SELECT a.id AS "productAId", a.name AS "productAName", a.quantity AS "productAQuantity",
            b.id AS "productBId", b.name AS "productBName", b.quantity AS "productBQuantity"
     FROM products a
     JOIN products b ON b.store_id = a.store_id AND b.id > a.id AND b.status = 'ACTIVE'
     WHERE a.store_id = $1 AND a.status = 'ACTIVE' AND similarity(a.name, b.name) > 0.3
     ORDER BY similarity(a.name, b.name) DESC
     LIMIT 20`,
    [storeId]
  );
  return rows;
}

/**
 * Fusionne un produit en double (`mergeProductId`) dans le produit gardé
 * (`keepProductId`) — §50_fusion_produits_doublons.sql, décidé en
 * conversation, en réponse à une faille signalée : un acheteur peut se
 * retrouver avec deux fiches pour le même article (une créée manuellement,
 * une auto-créée par une commande fournisseur où il a répondu "non, pas le
 * même" à la suggestion automatique). Le stock du produit fusionné est
 * entièrement transféré vers le produit gardé, puis le produit fusionné
 * est DÉSACTIVÉ (jamais supprimé — l'historique de mouvements déjà lié à
 * lui reste intact et immuable, comme partout ailleurs dans l'app).
 * `store_supplier_product_links` est repointée vers le produit gardé, pour
 * que les PROCHAINES commandes de ce produit fournisseur réutilisent
 * directement la bonne fiche.
 */
async function mergeProducts(storeId, keepProductId, mergeProductId, userId) {
  if (Number(keepProductId) === Number(mergeProductId)) {
    throw new AppError('Impossible de fusionner un produit avec lui-même.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productsResult = await client.query(
      `SELECT id, name, quantity FROM products WHERE store_id = $1 AND id = ANY($2::int[]) FOR UPDATE`,
      [storeId, [keepProductId, mergeProductId]]
    );
    if (productsResult.rows.length !== 2) {
      throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
    }
    const keepProduct = productsResult.rows.find((p) => p.id === Number(keepProductId));
    const mergeProduct = productsResult.rows.find((p) => p.id === Number(mergeProductId));

    if (mergeProduct.quantity > 0) {
      await client.query('UPDATE products SET quantity = quantity + $1 WHERE id = $2', [
        mergeProduct.quantity,
        keepProductId,
      ]);
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reference_table, reference_id, user_id, note)
         VALUES ($1, 'MERGE_IN', $2, 'products', $3, $4, $5)`,
        [keepProductId, mergeProduct.quantity, mergeProductId, userId, `Fusion depuis "${mergeProduct.name}" (#${mergeProductId})`]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, reference_table, reference_id, user_id, note)
         VALUES ($1, 'MERGE_OUT', $2, 'products', $3, $4, $5)`,
        [mergeProductId, mergeProduct.quantity, keepProductId, userId, `Fusionné dans "${keepProduct.name}" (#${keepProductId})`]
      );
    }

    await client.query(`UPDATE products SET quantity = 0, status = 'INACTIVE' WHERE id = $1`, [mergeProductId]);

    await client.query(
      `UPDATE store_supplier_product_links SET buyer_product_id = $1 WHERE buyer_product_id = $2`,
      [keepProductId, mergeProductId]
    );

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'MERGE_DUPLICATE_PRODUCTS', $3::jsonb)`,
      [
        userId,
        storeId,
        JSON.stringify({ keepProductId, mergeProductId, transferredQuantity: mergeProduct.quantity }),
      ]
    );

    await client.query('COMMIT');
    return {
      keepProductId: Number(keepProductId),
      mergeProductId: Number(mergeProductId),
      newQuantity: Number(keepProduct.quantity) + Number(mergeProduct.quantity),
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
  suggestDuplicateProducts,
  mergeProducts,
  getStoreStockMovements,
  getStockHistory,
  getEffectiveUnitPrice,
  getLockedProductIds,
};