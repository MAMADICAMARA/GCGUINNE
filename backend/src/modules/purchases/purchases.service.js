const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { getEffectivePlan } = require('../../utils/planContext');

/**
 * Commandes d'achat fournisseur (§28_commandes_achat_premium.sql, décidé
 * en conversation) — avantage exclusif du plan PREMIUM face à STANDARD.
 * `supplier_contacts` est un carnet d'adresses texte libre propre à la
 * boutique (fournisseur hors plateforme) — à ne jamais confondre avec
 * `store_supplier_links` (module suppliers/, une autre boutique de la
 * plateforme dont on consulte le catalogue). Consulter ce qui existe déjà
 * (fournisseurs, commandes passées) reste toujours possible quel que soit
 * le plan actuel — seule la CRÉATION d'un nouveau fournisseur ou d'une
 * nouvelle commande exige PREMIUM (vérifié par le middleware
 * requirePlanFeature('allowsPurchaseOrders') au niveau route, même
 * principe que suppliers.routes.js pour allowsSuppliers).
 *
 * Depuis §29_commande_depuis_fournisseur_plateforme.sql (décidé en
 * conversation), une commande a DEUX origines possibles, mutuellement
 * exclusives (contrainte XOR en base) : `supplier_id` (fournisseur externe,
 * ci-dessus) OU `supplier_store_id` (une autre boutique de la plateforme,
 * déjà ajoutée via store_supplier_links) — voir `createOrderFromSupplierStore`
 * plus bas. Toutes les lectures (`listPurchaseOrders`/`getPurchaseOrderById`/
 * `receivePurchaseOrder`) doivent donc toujours faire un LEFT JOIN sur les
 * deux tables possibles, jamais un JOIN strict qui exclurait silencieusement
 * les commandes de l'autre origine.
 */

// --- Contacts fournisseurs -------------------------------------------------

async function listSupplierContacts(storeId) {
  const { rows } = await pool.query(
    `SELECT id, name, phone, email, address, created_at AS "createdAt"
     FROM supplier_contacts WHERE store_id = $1 ORDER BY name ASC`,
    [storeId]
  );
  return rows;
}

async function createSupplierContact(storeId, { name, phone, email, address }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new AppError('Le nom du fournisseur est requis.', 400, 'VALIDATION_ERROR');
  }
  const { rows } = await pool.query(
    `INSERT INTO supplier_contacts (store_id, name, phone, email, address)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, phone, email, address, created_at AS "createdAt"`,
    [storeId, trimmedName, (phone || '').trim() || null, (email || '').trim() || null, (address || '').trim() || null]
  );
  return rows[0];
}

async function updateSupplierContact(storeId, contactId, { name, phone, email, address }) {
  const trimmedName = (name || '').trim();
  if (!trimmedName) {
    throw new AppError('Le nom du fournisseur est requis.', 400, 'VALIDATION_ERROR');
  }
  const { rows } = await pool.query(
    `UPDATE supplier_contacts
     SET name = $1, phone = $2, email = $3, address = $4
     WHERE id = $5 AND store_id = $6
     RETURNING id, name, phone, email, address, created_at AS "createdAt"`,
    [trimmedName, (phone || '').trim() || null, (email || '').trim() || null, (address || '').trim() || null, contactId, storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Fournisseur introuvable.', 404, 'SUPPLIER_CONTACT_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Retrait toujours possible, quel que soit le plan (même logique que
 * suppliers.routes.js#removeSupplier) — seule la création exige PREMIUM.
 * Bloqué par la base (FK RESTRICT sur purchase_orders.supplier_id) si des
 * commandes existent déjà pour ce fournisseur — jamais de suppression en
 * cascade qui effacerait un historique d'achat.
 */
async function deleteSupplierContact(storeId, contactId) {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM supplier_contacts WHERE id = $1 AND store_id = $2',
      [contactId, storeId]
    );
    if (rowCount === 0) {
      throw new AppError('Fournisseur introuvable.', 404, 'SUPPLIER_CONTACT_NOT_FOUND');
    }
    return { id: contactId, deleted: true };
  } catch (err) {
    // 23503 = foreign_key_violation (cas général) ; 23001 = restrict_violation
    // (code réellement renvoyé par Postgres pour un FK ON DELETE RESTRICT
    // comme purchase_orders.supplier_id — vérifié empiriquement lors des
    // tests de cette fonctionnalité, pas une supposition).
    if (err.code === '23503' || err.code === '23001') {
      throw new AppError(
        'Ce fournisseur a des commandes enregistrées — impossible de le supprimer.',
        409,
        'SUPPLIER_CONTACT_HAS_ORDERS'
      );
    }
    throw err;
  }
}

// --- Commandes d'achat ------------------------------------------------------

/**
 * Liste des commandes d'achat, filtrable par statut/fournisseur — même
 * pagination que le reste du projet (SalesHistoryPage, employees...).
 */
async function listPurchaseOrders(storeId, { status, supplierId, page, limit } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['po.store_id = $1'];
  const params = [storeId];
  if (status) {
    conditions.push(`po.status = $${params.length + 1}`);
    params.push(status);
  }
  if (supplierId) {
    conditions.push(`po.supplier_id = $${params.length + 1}`);
    params.push(supplierId);
  }
  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM purchase_orders po WHERE ${whereClause}`,
    params
  );

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT po.id, po.reference, po.total_amount AS "totalAmount", po.status,
            po.created_at AS "createdAt", po.received_at AS "receivedAt",
            po.delivered_at AS "deliveredAt", po.requires_delivery_confirmation AS "requiresDeliveryConfirmation",
            COALESCE(sc.id, ss.id) AS "supplierId", COALESCE(sc.name, ss.name) AS "supplierName",
            CASE WHEN po.supplier_id IS NOT NULL THEN 'EXTERNAL' ELSE 'PLATFORM' END AS "supplierType",
            cu.full_name AS "createdByName"
     FROM purchase_orders po
     LEFT JOIN supplier_contacts sc ON sc.id = po.supplier_id
     LEFT JOIN stores ss ON ss.id = po.supplier_store_id
     JOIN users cu ON cu.id = po.created_by
     WHERE ${whereClause}
     ORDER BY po.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return {
    orders: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: pageNum,
    pages: Math.max(1, Math.ceil(parseInt(countResult.rows[0].count, 10) / limitNum)),
  };
}

async function getPurchaseOrderById(storeId, orderId) {
  const orderResult = await pool.query(
    `SELECT po.id, po.reference, po.total_amount AS "totalAmount", po.status,
            po.created_at AS "createdAt", po.received_at AS "receivedAt",
            po.delivered_at AS "deliveredAt", po.requires_delivery_confirmation AS "requiresDeliveryConfirmation",
            COALESCE(sc.id, ss.id) AS "supplierId", COALESCE(sc.name, ss.name) AS "supplierName",
            sc.phone AS "supplierPhone",
            CASE WHEN po.supplier_id IS NOT NULL THEN 'EXTERNAL' ELSE 'PLATFORM' END AS "supplierType",
            cu.full_name AS "createdByName", ru.full_name AS "receivedByName"
     FROM purchase_orders po
     LEFT JOIN supplier_contacts sc ON sc.id = po.supplier_id
     LEFT JOIN stores ss ON ss.id = po.supplier_store_id
     JOIN users cu ON cu.id = po.created_by
     LEFT JOIN users ru ON ru.id = po.received_by
     WHERE po.store_id = $1 AND po.id = $2`,
    [storeId, orderId]
  );
  if (orderResult.rows.length === 0) {
    throw new AppError('Commande introuvable.', 404, 'PURCHASE_ORDER_NOT_FOUND');
  }

  const itemsResult = await pool.query(
    `SELECT poi.id, poi.product_id AS "productId", poi.quantity,
            poi.purchase_price AS "purchasePrice", p.name AS "productName", p.reference,
            p.image_url AS "productImageUrl", p.selling_price AS "currentSellingPrice",
            sp.name AS "supplierProductName"
     FROM purchase_order_items poi
     JOIN products p ON p.id = poi.product_id
     LEFT JOIN products sp ON sp.id = poi.supplier_product_id
     WHERE poi.purchase_id = $1
     ORDER BY poi.id`,
    [orderId]
  );

  return { order: orderResult.rows[0], items: itemsResult.rows };
}

/**
 * Crée une commande d'achat (statut PENDING, aucun impact sur le stock —
 * décidé en conversation : le stock ne bouge qu'à la réception). Le total
 * n'est jamais fourni par le client, toujours recalculé à partir des
 * lignes pour éviter toute incohérence entre les lignes et le total
 * affiché.
 */
async function createPurchaseOrder(storeId, userId, { supplierId, reference, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Ajoutez au moins un article à la commande.', 400, 'VALIDATION_ERROR');
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError('Quantité invalide sur au moins une ligne.', 400, 'VALIDATION_ERROR');
    }
    if (typeof item.purchasePrice !== 'number' || item.purchasePrice < 0) {
      throw new AppError("Prix d'achat invalide sur au moins une ligne.", 400, 'VALIDATION_ERROR');
    }
  }

  const supplierResult = await pool.query(
    'SELECT id FROM supplier_contacts WHERE id = $1 AND store_id = $2',
    [supplierId, storeId]
  );
  if (supplierResult.rows.length === 0) {
    throw new AppError('Fournisseur introuvable.', 404, 'SUPPLIER_CONTACT_NOT_FOUND');
  }

  const productIds = items.map((i) => i.productId);
  const productsResult = await pool.query(
    'SELECT id FROM products WHERE store_id = $1 AND id = ANY($2::int[])',
    [storeId, productIds]
  );
  if (productsResult.rows.length !== new Set(productIds).size) {
    throw new AppError("Au moins un produit n'appartient pas à cette boutique.", 404, 'PRODUCT_NOT_FOUND');
  }

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.purchasePrice, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `INSERT INTO purchase_orders (store_id, supplier_id, reference, total_amount, status, created_by)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING id, reference, total_amount AS "totalAmount", status, created_at AS "createdAt"`,
      [storeId, supplierId, (reference || '').trim() || null, totalAmount, userId]
    );
    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_order_items (purchase_id, product_id, quantity, purchase_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.productId, item.quantity, item.purchasePrice]
      );
    }

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'CREATE_PURCHASE_ORDER', $3::jsonb)`,
      [userId, storeId, JSON.stringify({ orderId: order.id, totalAmount, itemCount: items.length })]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Crée une commande d'achat directement depuis le catalogue d'un
 * fournisseur DE LA PLATEFORME (§29_commande_depuis_fournisseur_plateforme.sql,
 * décidé en conversation) — pendant de `createPurchaseOrder` ci-dessus,
 * jamais fusionnée avec elle pour ne rien risquer sur le flux externe déjà
 * testé. Chaque `supplierProductId` (un produit du catalogue DU FOURNISSEUR)
 * est résolu vers un produit du catalogue DE L'ACHETEUR (jamais l'inverse) :
 * réutilise la correspondance déjà connue (`store_supplier_product_links`)
 * si l'acheteur a déjà commandé ce produit une fois, sinon crée
 * automatiquement une nouvelle fiche chez lui (nom/référence repris du
 * fournisseur, prix d'achat = prix convenu, prix de vente = celui du
 * fournisseur à titre de départ, stock à 0 tant que rien n'est reçu) et
 * mémorise la correspondance pour la prochaine fois. La réception qui suit
 * (voir `receivePurchaseOrder` plus bas) met à jour le stock des DEUX
 * côtés : celui de l'acheteur (`product_id`, comme pour un fournisseur
 * externe) ET, symétriquement, celui du fournisseur (`supplierProductId`,
 * conservé sur chaque ligne pour cet usage).
 */
/**
 * Suggestion automatique de rapprochement (§ décidé en conversation, pour
 * éviter les doublons quand l'acheteur a déjà ce produit dans son propre
 * catalogue avant même sa première commande chez ce fournisseur) —
 * recherche par similarité de nom (`pg_trgm`, déjà activé en base, jamais
 * utilisé nulle part ailleurs avant cette fonction) parmi les produits
 * ACTIFS de L'ACHETEUR uniquement. Seuil 0.3 = seuil par défaut de
 * pg_trgm, un compromis raisonnable entre bruit et silence.
 *
 * Volontairement une SIMPLE SUGGESTION, jamais un rapprochement
 * automatique/silencieux : c'est `createOrderFromSupplierStore` (via
 * `item.matchedProductId`) qui applique réellement le choix, uniquement
 * après confirmation explicite de l'acheteur côté client.
 */
async function suggestMatchingProducts(storeId, name) {
  const { rows } = await pool.query(
    `SELECT id, name, reference, image_url AS "imageUrl", selling_price AS "sellingPrice", quantity
     FROM products
     WHERE store_id = $1 AND status = 'ACTIVE' AND similarity(name, $2) > 0.3
     ORDER BY similarity(name, $2) DESC
     LIMIT 5`,
    [storeId, name]
  );
  return rows;
}

async function createOrderFromSupplierStore(storeId, userId, { supplierStoreId, reference, items }) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError('Ajoutez au moins un article à la commande.', 400, 'VALIDATION_ERROR');
  }
  for (const item of items) {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new AppError('Quantité invalide sur au moins une ligne.', 400, 'VALIDATION_ERROR');
    }
    if (typeof item.purchasePrice !== 'number' || item.purchasePrice < 0) {
      throw new AppError("Prix d'achat invalide sur au moins une ligne.", 400, 'VALIDATION_ERROR');
    }
  }

  const linkResult = await pool.query(
    'SELECT 1 FROM store_supplier_links WHERE buyer_store_id = $1 AND supplier_store_id = $2',
    [storeId, supplierStoreId]
  );
  if (linkResult.rows.length === 0) {
    throw new AppError("Cette boutique n'est pas dans vos fournisseurs.", 403, 'NOT_A_SUPPLIER');
  }

  // Revérifie l'égalité des secteurs d'activité à CHAQUE commande, pas
  // seulement une fois à la création du lien (suppliers.service.js#addSupplier) :
  // store_type_id est immuable une fois défini, donc un lien déjà validé ne
  // peut normalement plus devenir incompatible — sauf le seul cas où l'une
  // des deux boutiques n'avait pas encore de type au moment du lien, et en
  // a adopté un différent depuis. Ce contrôle ferme ce cas limite.
  const typesResult = await pool.query(
    `SELECT
       (SELECT store_type_id FROM stores WHERE id = $1) AS "buyerTypeId",
       (SELECT store_type_id FROM stores WHERE id = $2) AS "supplierTypeId"`,
    [storeId, supplierStoreId]
  );
  const { buyerTypeId, supplierTypeId } = typesResult.rows[0];
  if (!buyerTypeId || !supplierTypeId || buyerTypeId !== supplierTypeId) {
    throw new AppError(
      "Cette boutique n'est plus du même secteur d'activité que la vôtre — impossible de passer commande.",
      409,
      'STORE_TYPE_MISMATCH'
    );
  }

  const supplierPlan = await getEffectivePlan(supplierStoreId);
  if (!supplierPlan.allowsSuppliers) {
    throw new AppError(
      "Cette boutique n'a plus accès à la fonctionnalité Fournisseurs.",
      403,
      'SUPPLIER_PLAN_LOCKED'
    );
  }

  const supplierProductIds = items.map((i) => i.supplierProductId);
  const supplierProductsResult = await pool.query(
    `SELECT id, name, reference, image_url AS "imageUrl", selling_price AS "sellingPrice"
     FROM products WHERE store_id = $1 AND status = 'ACTIVE' AND id = ANY($2::int[])`,
    [supplierStoreId, supplierProductIds]
  );
  if (supplierProductsResult.rows.length !== new Set(supplierProductIds).size) {
    throw new AppError("Au moins un produit n'appartient pas au catalogue de ce fournisseur.", 404, 'PRODUCT_NOT_FOUND');
  }
  const supplierProductsById = new Map(supplierProductsResult.rows.map((p) => [p.id, p]));

  const totalAmount = items.reduce((sum, i) => sum + i.quantity * i.purchasePrice, 0);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Résout (ou crée) le produit BÉNÉFICIAIRE correspondant à chaque
    // produit du fournisseur — jamais modifié une fois résolu, la table de
    // correspondance n'a qu'un INSERT, aucun UPDATE.
    const resolvedProductIds = [];
    for (const item of items) {
      const existingLink = await client.query(
        'SELECT buyer_product_id AS "buyerProductId" FROM store_supplier_product_links WHERE buyer_store_id = $1 AND supplier_product_id = $2',
        [storeId, item.supplierProductId]
      );

      let buyerProductId;
      if (existingLink.rows.length > 0) {
        buyerProductId = existingLink.rows[0].buyerProductId;
      } else if (item.matchedProductId) {
        // L'acheteur a confirmé, au moment de construire son panier, que ce
        // produit du fournisseur correspond à un produit qu'il a DÉJÀ dans
        // son catalogue (§ décidé en conversation — suggestion automatique
        // par similarité de nom, jamais un rapprochement silencieux : voir
        // suggestMatchingProducts ci-dessous, toujours confirmé par un clic
        // explicite côté client) — jamais de nouvelle fiche créée, le stock
        // ira sur celle-ci. Revérifié ici côté serveur (jamais fait
        // confiance à un id fourni par le client sans validation) : doit
        // appartenir à CETTE boutique et être actif.
        const matchResult = await client.query(
          `SELECT id FROM products WHERE id = $1 AND store_id = $2 AND status = 'ACTIVE'`,
          [item.matchedProductId, storeId]
        );
        if (matchResult.rows.length === 0) {
          throw new AppError('Le produit sélectionné pour le rapprochement est introuvable.', 404, 'PRODUCT_NOT_FOUND');
        }
        buyerProductId = item.matchedProductId;

        await client.query(
          `INSERT INTO store_supplier_product_links (buyer_store_id, supplier_product_id, buyer_product_id)
           VALUES ($1, $2, $3)`,
          [storeId, item.supplierProductId, buyerProductId]
        );
      } else {
        // Reprend aussi la référence et l'image du fournisseur (§ décidé en
        // conversation, faille signalée : jusqu'ici seuls name/sellingPrice
        // étaient copiés) — uniquement à la CRÉATION du lien, jamais
        // rejoué ensuite (même principe que le reste de ce bloc) : ne
        // s'applique qu'aux nouveaux produits créés à partir d'aujourd'hui,
        // jamais rétroactif sur un produit déjà lié.
        const supplierProduct = supplierProductsById.get(item.supplierProductId);
        const newProductResult = await client.query(
          `INSERT INTO products (store_id, name, reference, image_url, purchase_price, selling_price, quantity, status)
           VALUES ($1, $2, $3, $4, $5, $6, 0, 'ACTIVE')
           RETURNING id`,
          [
            storeId,
            supplierProduct.name,
            supplierProduct.reference,
            supplierProduct.imageUrl,
            item.purchasePrice,
            supplierProduct.sellingPrice,
          ]
        );
        buyerProductId = newProductResult.rows[0].id;

        await client.query(
          `INSERT INTO store_supplier_product_links (buyer_store_id, supplier_product_id, buyer_product_id)
           VALUES ($1, $2, $3)`,
          [storeId, item.supplierProductId, buyerProductId]
        );
      }
      resolvedProductIds.push(buyerProductId);
    }

    const orderResult = await client.query(
      `INSERT INTO purchase_orders (store_id, supplier_store_id, reference, total_amount, status, created_by)
       VALUES ($1, $2, $3, $4, 'PENDING', $5)
       RETURNING id, reference, total_amount AS "totalAmount", status, created_at AS "createdAt"`,
      [storeId, supplierStoreId, (reference || '').trim() || null, totalAmount, userId]
    );
    const order = orderResult.rows[0];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      await client.query(
        `INSERT INTO purchase_order_items (purchase_id, product_id, supplier_product_id, quantity, purchase_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, resolvedProductIds[i], item.supplierProductId, item.quantity, item.purchasePrice]
      );
    }

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'CREATE_PURCHASE_ORDER', $3::jsonb)`,
      [userId, storeId, JSON.stringify({ orderId: order.id, totalAmount, itemCount: items.length, supplierStoreId })]
    );

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Réception d'une commande — décidé en conversation : un seul geste met à
 * jour le stock de tous les produits de la commande, plutôt qu'un ajustement
 * manuel par produit. Chaque ligne devient un mouvement de stock PURCHASE_IN
 * distinct côté BÉNÉFICIAIRE (traçabilité produit par produit déjà utilisée
 * partout ailleurs dans l'app), avec `unit_cost` renseigné pour garder
 * l'historique réel des prix d'achat. Ne réactive JAMAIS un produit
 * INACTIVE (même règle que l'ajustement manuel de stock,
 * products.service.js#adjustStock) — la réactivation reste un choix
 * explicite du Owner.
 *
 * Si la commande vient d'un fournisseur DE LA PLATEFORME (`supplier_store_id`
 * non NULL), le stock du FOURNISSEUR est symétriquement DIMINUÉ pour chaque
 * produit d'origine (`supplier_product_id`) — décidé en conversation : la
 * marchandise a réellement quitté son inventaire. Mouvement `TRANSFER_OUT`
 * (jamais `PURCHASE_IN`, réservé à un achat) enregistré du côté du
 * fournisseur. `GREATEST(0, ...)` en défense : l'acheteur ne voit jamais le
 * stock réel du fournisseur au moment de commander (règle de confidentialité,
 * §18_fournisseurs_inter_boutiques.sql), un léger décalage est donc normal
 * et ne doit jamais bloquer la confirmation de réception de l'acheteur, qui
 * constate un événement déjà arrivé dans la réalité.
 */
/**
 * `itemOverrides` (§ décidé en conversation, faille signalée : produit
 * copié du fournisseur sans jamais pouvoir ajuster le prix de vente au
 * moment de la réception) : liste optionnelle `[{ itemId, sellingPrice }]`
 * — seul le prix de VENTE du produit BÉNÉFICIAIRE peut être ajusté ici, le
 * prix d'ACHAT reste TOUJOURS celui négocié avec le fournisseur
 * (`item.purchasePrice`, jamais modifiable via ce paramètre, jamais lu
 * depuis `itemOverrides`) — la plateforme retient le prix d'achat réel,
 * seul le prix de revente est à la discrétion de l'acheteur.
 */
async function receivePurchaseOrder(storeId, orderId, userId, itemOverrides = []) {
  const sellingPriceByItemId = new Map();
  for (const override of Array.isArray(itemOverrides) ? itemOverrides : []) {
    if (Number.isInteger(override?.itemId) && typeof override?.sellingPrice === 'number' && override.sellingPrice >= 0) {
      sellingPriceByItemId.set(override.itemId, override.sellingPrice);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    try {
      // FOR UPDATE à l'intérieur de la transaction (jamais avant BEGIN,
      // sinon le verrou serait relâché immédiatement après le SELECT et ne
      // protégerait plus rien) : empêche une double réception concurrente
      // de la même commande.
      // LEFT JOIN sur les deux origines possibles (jamais un JOIN strict, qui
      // exclurait silencieusement les commandes venant d'un fournisseur de
      // la plateforme, supplier_id NULL dans ce cas — bug détecté et corrigé
      // avant tout test, §29_commande_depuis_fournisseur_plateforme.sql).
      // `FOR UPDATE OF po` (jamais un FOR UPDATE global) : Postgres refuse de
      // verrouiller le côté potentiellement NULL d'une jointure externe —
      // seule la ligne purchase_orders elle-même a besoin d'être verrouillée,
      // les tables jointes ne sont que des données de référence en lecture.
      const orderResult = await client.query(
        `SELECT po.id, po.status, po.reference, po.supplier_store_id AS "supplierStoreId",
                po.requires_delivery_confirmation AS "requiresDeliveryConfirmation",
                COALESCE(sc.name, ss.name) AS "supplierName"
         FROM purchase_orders po
         LEFT JOIN supplier_contacts sc ON sc.id = po.supplier_id
         LEFT JOIN stores ss ON ss.id = po.supplier_store_id
         WHERE po.store_id = $1 AND po.id = $2
         FOR UPDATE OF po`,
        [storeId, orderId]
      );
      if (orderResult.rows.length === 0) {
        throw new AppError('Commande introuvable.', 404, 'PURCHASE_ORDER_NOT_FOUND');
      }
      const order = orderResult.rows[0];

      // §49_confirmation_livraison_fournisseur.sql, décidé en conversation :
      // pour une commande créée APRÈS ce correctif auprès d'un fournisseur
      // DE LA PLATEFORME, le fournisseur doit avoir confirmé l'expédition
      // (DELIVERED) avant que l'acheteur ne puisse confirmer réception —
      // sans ça, une fausse commande immédiatement "reçue" décrémentait le
      // stock du fournisseur sans qu'il n'ait jamais rien confirmé. Un
      // fournisseur EXTERNE (supplier_id, simple carnet d'adresses) n'a pas
      // de compte plateforme pour confirmer quoi que ce soit — jamais
      // concerné, quelle que soit la valeur de `requiresDeliveryConfirmation`.
      const needsDeliveryFirst = order.supplierStoreId && order.requiresDeliveryConfirmation;
      if (needsDeliveryFirst) {
        if (order.status !== 'DELIVERED') {
          throw new AppError(
            order.status === 'PENDING'
              ? "Le fournisseur n'a pas encore confirmé l'expédition de cette commande."
              : 'Seules les commandes livrées peuvent être marquées reçues.',
            409,
            'NOT_DELIVERED'
          );
        }
      } else if (order.status !== 'PENDING') {
        throw new AppError('Seules les commandes en attente peuvent être marquées reçues.', 409, 'NOT_PENDING');
      }

      const itemsResult = await client.query(
        `SELECT id AS "itemId", product_id AS "productId", supplier_product_id AS "supplierProductId",
                quantity, purchase_price AS "purchasePrice"
         FROM purchase_order_items WHERE purchase_id = $1`,
        [orderId]
      );

      const note = `Réception commande ${order.reference || `#${orderId}`} — ${order.supplierName}`;
      for (const item of itemsResult.rows) {
        const sellingPriceOverride = sellingPriceByItemId.get(item.itemId);
        if (sellingPriceOverride !== undefined) {
          await client.query(
            'UPDATE products SET quantity = quantity + $1, purchase_price = $2, selling_price = $3 WHERE id = $4',
            [item.quantity, item.purchasePrice, sellingPriceOverride, item.productId]
          );
        } else {
          await client.query('UPDATE products SET quantity = quantity + $1, purchase_price = $2 WHERE id = $3', [
            item.quantity,
            item.purchasePrice,
            item.productId,
          ]);
        }
        await client.query(
          `INSERT INTO stock_movements
           (product_id, type, quantity, unit_cost, reference_table, reference_id, user_id, note)
           VALUES ($1, 'PURCHASE_IN', $2, $3, 'purchase_orders', $4, $5, $6)`,
          [item.productId, item.quantity, item.purchasePrice, orderId, userId, note]
        );

        if (order.supplierStoreId && item.supplierProductId) {
          const supplierNote = `Commande #${orderId} livrée à un client de la plateforme`;
          await client.query('UPDATE products SET quantity = GREATEST(0, quantity - $1) WHERE id = $2', [
            item.quantity,
            item.supplierProductId,
          ]);
          await client.query(
            `INSERT INTO stock_movements
             (product_id, type, quantity, unit_cost, reference_table, reference_id, user_id, note)
             VALUES ($1, 'TRANSFER_OUT', $2, $3, 'purchase_orders', $4, $5, $6)`,
            [item.supplierProductId, item.quantity, item.purchasePrice, orderId, userId, supplierNote]
          );
        }
      }

      const { rows } = await client.query(
        `UPDATE purchase_orders SET status = 'RECEIVED', received_at = NOW(), received_by = $1
         WHERE id = $2
         RETURNING id, status, received_at AS "receivedAt"`,
        [userId, orderId]
      );

      await client.query(
        `INSERT INTO system_logs (user_id, store_id, action, details)
         VALUES ($1, $2, 'RECEIVE_PURCHASE_ORDER', $3::jsonb)`,
        [userId, storeId, JSON.stringify({ orderId, itemCount: itemsResult.rows.length })]
      );

      // Trace côté FOURNISSEUR aussi (Journal d'activité de sa propre
      // boutique) — décidé en conversation : B doit pouvoir voir que son
      // stock a bougé et pourquoi, même si l'action a été déclenchée par A.
      if (order.supplierStoreId) {
        await client.query(
          `INSERT INTO system_logs (user_id, store_id, action, details)
           VALUES ($1, $2, 'SUPPLIER_STOCK_DECREASED', $3::jsonb)`,
          [userId, order.supplierStoreId, JSON.stringify({ orderId, buyerStoreId: storeId, itemCount: itemsResult.rows.length })]
        );
      }

      await client.query('COMMIT');
      return rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

async function cancelPurchaseOrder(storeId, orderId, userId) {
  const { rows } = await pool.query(
    `UPDATE purchase_orders SET status = 'CANCELLED'
     WHERE id = $1 AND store_id = $2 AND status = 'PENDING'
     RETURNING id, status`,
    [orderId, storeId]
  );
  if (rows.length === 0) {
    throw new AppError(
      "Commande introuvable ou déjà traitée — seules les commandes en attente peuvent être annulées.",
      409,
      'NOT_PENDING'
    );
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'CANCEL_PURCHASE_ORDER', $3::jsonb)`,
    [userId, storeId, JSON.stringify({ orderId })]
  );

  return rows[0];
}

// --- Commandes reçues DE MES CLIENTS (je suis le fournisseur) -------------
// (§29_commande_depuis_fournisseur_plateforme.sql, décidé en conversation)
// B ne confirme/annule jamais l'ANNULATION ni ne force la RÉCEPTION — ça
// reste le rôle exclusif de A (l'acheteur). Depuis
// §49_confirmation_livraison_fournisseur.sql (décidé en conversation), B a
// UNE action possible : confirmer qu'il a expédié (declareOrderDelivered
// ci-dessous), étape désormais requise avant que A puisse marquer reçu.

/**
 * Le FOURNISSEUR (boutique de la plateforme) confirme avoir expédié une
 * commande passée chez lui — §49_confirmation_livraison_fournisseur.sql,
 * décidé en conversation, en réponse à une faille signalée : sans cette
 * étape, l'acheteur pouvait faire décrémenter le stock du fournisseur avec
 * une commande jamais réellement expédiée. UPDATE atomique avec toutes les
 * conditions dans le WHERE (même patron que cancelPurchaseOrder) : si la
 * commande n'appartient pas à ce fournisseur, n'est plus PENDING, ou ne
 * nécessite pas cette confirmation (commande créée avant ce correctif),
 * aucune ligne ne correspond et un message générique est renvoyé — jamais
 * de distinction fine qui laisserait deviner l'état exact d'une commande
 * qui ne serait pas la sienne.
 */
async function declareOrderDelivered(supplierStoreId, orderId, userId) {
  const { rows } = await pool.query(
    `UPDATE purchase_orders
     SET status = 'DELIVERED', delivered_at = NOW(), delivered_by = $1
     WHERE id = $2 AND supplier_store_id = $3 AND status = 'PENDING' AND requires_delivery_confirmation = TRUE
     RETURNING id, status, delivered_at AS "deliveredAt"`,
    [userId, orderId, supplierStoreId]
  );
  if (rows.length === 0) {
    throw new AppError(
      'Commande introuvable, déjà traitée, ou ne nécessitant pas de confirmation de livraison.',
      409,
      'NOT_DELIVERABLE'
    );
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'DECLARE_ORDER_DELIVERED', $3::jsonb)`,
    [userId, supplierStoreId, JSON.stringify({ orderId })]
  );

  return rows[0];
}

async function listOrdersFromMyClients(supplierStoreId, { status, page, limit } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['po.supplier_store_id = $1'];
  const params = [supplierStoreId];
  if (status) {
    conditions.push(`po.status = $${params.length + 1}`);
    params.push(status);
  }
  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM purchase_orders po WHERE ${whereClause}`,
    params
  );

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT po.id, po.reference, po.total_amount AS "totalAmount", po.status,
            po.created_at AS "createdAt", po.received_at AS "receivedAt",
            po.delivered_at AS "deliveredAt", po.requires_delivery_confirmation AS "requiresDeliveryConfirmation",
            bs.id AS "buyerStoreId", bs.name AS "buyerStoreName"
     FROM purchase_orders po
     JOIN stores bs ON bs.id = po.store_id
     WHERE ${whereClause}
     ORDER BY po.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return {
    orders: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: pageNum,
    pages: Math.max(1, Math.ceil(parseInt(countResult.rows[0].count, 10) / limitNum)),
  };
}

async function getReceivedOrderById(supplierStoreId, orderId) {
  const orderResult = await pool.query(
    `SELECT po.id, po.reference, po.total_amount AS "totalAmount", po.status,
            po.created_at AS "createdAt", po.received_at AS "receivedAt",
            po.delivered_at AS "deliveredAt", po.requires_delivery_confirmation AS "requiresDeliveryConfirmation",
            bs.id AS "buyerStoreId", bs.name AS "buyerStoreName"
     FROM purchase_orders po
     JOIN stores bs ON bs.id = po.store_id
     WHERE po.supplier_store_id = $1 AND po.id = $2`,
    [supplierStoreId, orderId]
  );
  if (orderResult.rows.length === 0) {
    throw new AppError('Commande introuvable.', 404, 'PURCHASE_ORDER_NOT_FOUND');
  }

  // Les lignes utilisent explicitement `supplier_product_id` (le produit
  // DU FOURNISSEUR, donc de la boutique qui appelle ici) — jamais
  // `product_id`, qui appartient au catalogue de L'ACHETEUR et ne
  // signifierait rien pour B.
  const itemsResult = await pool.query(
    `SELECT poi.id, poi.quantity, poi.purchase_price AS "purchasePrice",
            p.name AS "productName", p.reference
     FROM purchase_order_items poi
     JOIN products p ON p.id = poi.supplier_product_id
     WHERE poi.purchase_id = $1
     ORDER BY poi.id`,
    [orderId]
  );

  return { order: orderResult.rows[0], items: itemsResult.rows };
}

module.exports = {
  listSupplierContacts,
  createSupplierContact,
  updateSupplierContact,
  deleteSupplierContact,
  listPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  suggestMatchingProducts,
  createOrderFromSupplierStore,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  declareOrderDelivered,
  listOrdersFromMyClients,
  getReceivedOrderById,
};
