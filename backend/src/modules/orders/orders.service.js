const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { getReceiptSettings } = require('../stores/stores.service');
const { getEffectiveUnitPrice } = require('../products/products.service');

/**
 * Crée une commande de vente atomique
 * - Valide le stock de tous les items
 * - Crée l'ordre, les items, les mouvements de stock
 * - Transaction : all-or-nothing
 * @param {number} storeId - Identifiant de la boutique
 * @param {number} userId - Identifiant du vendeur
 * @param {object} orderData - {customerId?, newCustomer?: {name, phone}, items: [{productId, quantity}], discount, paymentMethod, tax, amountPaid?}
 * @returns {object} {orderId, orderNumber, totalAmount, items, receipt}
 */
async function createOrder(storeId, userId, orderData) {
  const client = await pool.connect();

  // Ces deux variables ne survivent qu'à la portée de la transaction ;
  // le reçu (pur JS, sans accès base) est généré APRÈS, une fois la
  // transaction terminée et le client relâché (voir plus bas).
  let committedOrder = null;
  let committedItems = null;

  try {
    // Validation basique
    if (!orderData.items || orderData.items.length === 0) {
      throw new AppError('Veuillez ajouter au moins un article', 400);
    }
    if (!['CASH', 'MOBILE_MONEY', 'CARD', 'OTHER'].includes(orderData.paymentMethod)) {
      throw new AppError('Méthode de paiement invalide', 400);
    }
    if (
      orderData.amountPaid != null &&
      (typeof orderData.amountPaid !== 'number' || orderData.amountPaid < 0)
    ) {
      throw new AppError('Le montant payé est invalide.', 400);
    }
    if (orderData.items.some((i) => !Number.isInteger(i.quantity) || i.quantity <= 0)) {
      throw new AppError('Quantité invalide', 400);
    }

    // Récupérer les produits et vérifier le stock (première vérification,
    // "à titre indicatif" pour renvoyer un message clair le plus tôt
    // possible ; la vérification qui compte réellement contre la
    // concurrence est celle faite plus bas, DANS la transaction, au moment
    // du UPDATE atomique — cf. cahier des charges §9.2 / §11.1).
    const productIds = orderData.items.map((i) => i.productId);
    const productsResult = await client.query(
      `SELECT id, name, selling_price, quantity FROM products
       WHERE store_id = $1 AND id = ANY($2::int[])
       ORDER BY id`,
      [storeId, productIds]
    );

    const productsMap = {};
    productsResult.rows.forEach((p) => {
      productsMap[p.id] = p;
    });

    // Prix dégressif par palier de quantité (§31_prix_degressif_grossiste.sql,
    // décidé en conversation) — le prix appliqué est TOUJOURS recalculé ici,
    // côté serveur, à partir des paliers réellement enregistrés pour chaque
    // produit ; jamais fait confiance à un prix envoyé par le client (qui
    // n'en envoie d'ailleurs aucun, seulement productId/quantity).
    const tiersResult = await client.query(
      `SELECT product_id AS "productId", min_quantity AS "minQuantity", unit_price AS "unitPrice"
       FROM product_price_tiers WHERE product_id = ANY($1::int[]) ORDER BY min_quantity ASC`,
      [productIds]
    );
    const tiersByProduct = {};
    tiersResult.rows.forEach((t) => {
      (tiersByProduct[t.productId] ||= []).push(t);
    });

    let totalAmount = 0;
    const preparedItems = [];

    for (const item of orderData.items) {
      const product = productsMap[item.productId];
      if (!product) {
        throw new AppError(`Produit ID ${item.productId} introuvable`, 404);
      }
      if (item.quantity > product.quantity) {
        throw new AppError(
          `Stock insuffisant pour "${product.name}": ${product.quantity} disponible, ${item.quantity} demandé`,
          409
        );
      }

      const unitPrice = getEffectiveUnitPrice(product.selling_price, tiersByProduct[item.productId], item.quantity);
      const lineTotal = item.quantity * unitPrice;
      totalAmount += lineTotal;
      preparedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        productName: product.name,
      });
    }

    // Appliquer réduction et taxes
    const discountAmount = orderData.discount || 0;
    const taxAmount = orderData.tax || 0;
    const finalTotal = totalAmount - discountAmount + taxAmount;

    if (finalTotal < 0) {
      throw new AppError('Montant total invalide', 400);
    }

    // Par défaut (champ omis), on suppose un paiement intégral — comporte-
    // ment inchangé pour tout appelant qui ne connaît pas encore le
    // paiement partiel.
    const amountPaid = orderData.amountPaid != null ? orderData.amountPaid : finalTotal;

    if (amountPaid > finalTotal) {
      throw new AppError('Le montant payé ne peut pas dépasser le total de la vente.', 400);
    }

    const hasCustomer = Boolean(orderData.customerId) || Boolean(orderData.newCustomer);
    if (amountPaid < finalTotal && !hasCustomer) {
      throw new AppError(
        'Un paiement partiel nécessite un client identifié (impossible de suivre une dette envers "personne").',
        400,
        'PARTIAL_PAYMENT_REQUIRES_CUSTOMER'
      );
    }

    if (orderData.newCustomer && (!orderData.newCustomer.name || !orderData.newCustomer.name.trim())) {
      throw new AppError('Le nom du nouveau client est requis.', 400);
    }

    // Vérifier que le client existe s'il est spécifié
    if (orderData.customerId) {
      const customerResult = await client.query(
        'SELECT id FROM customers WHERE id = $1 AND store_id = $2',
        [orderData.customerId, storeId]
      );
      if (customerResult.rows.length === 0) {
        throw new AppError('Client introuvable', 404);
      }
    }

    // ------------------------------------------------------------------
    // BEGIN TRANSACTION — tout ce qui suit doit réussir intégralement ou
    // être entièrement annulé (cf. §9.2 du cahier des charges).
    // ------------------------------------------------------------------
    await client.query('BEGIN');

    try {
      // Si un NOUVEAU client est fourni (plutôt qu'un customerId existant),
      // on le crée ICI, à l'intérieur de la transaction — jamais avant.
      // Décidé en conversation : créer le client dès la saisie (avant que
      // la vente soit confirmée) laisserait des clients "fantômes" en base
      // si la vente était finalement abandonnée ou échouait. Client et
      // vente réussissent ensemble, ou aucun des deux.
      let resolvedCustomerId = orderData.customerId || null;
      if (!resolvedCustomerId && orderData.newCustomer) {
        try {
          const newCustomerResult = await client.query(
            `INSERT INTO customers (store_id, name, phone) VALUES ($1, $2, $3) RETURNING id`,
            [
              storeId,
              orderData.newCustomer.name.trim(),
              orderData.newCustomer.phone?.trim() || null,
            ]
          );
          resolvedCustomerId = newCustomerResult.rows[0].id;
        } catch (err) {
          if (err.code === '23505') {
            throw new AppError(
              'Un client avec ce numéro existe déjà dans cette boutique.',
              409,
              'PHONE_ALREADY_USED'
            );
          }
          throw err;
        }
      }

      // Générer un numéro de commande unique.
      // Extraction par expression régulière (suite de chiffres en fin de
      // chaîne) plutôt que par position fixe : SUBSTRING(order_number, 6)
      // coupait au milieu de l'année sur le format "ORD-2026-000001" et
      // provoquait une erreur "invalid input syntax for type integer".
      const orderNumberResult = await client.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM '\\d+$') AS INTEGER)), 0) + 1 as next_num
         FROM orders WHERE store_id = $1 AND order_number LIKE $2`,
        [storeId, `ORD-${new Date().getFullYear()}%`]
      );
      const nextNum = orderNumberResult.rows[0].next_num;
      const orderNumber = `ORD-${new Date().getFullYear()}-${String(nextNum).padStart(6, '0')}`;

      const paymentStatus =
        amountPaid >= finalTotal ? 'PAID' : amountPaid === 0 ? 'PENDING' : 'PARTIALLY_PAID';

      // Rattache la vente à la caisse ouverte du vendeur, si elle existe
      // (§30_fond_de_caisse.sql, décidé en conversation) — entièrement
      // optionnel : une vente en espèces sans caisse ouverte fonctionne
      // exactement comme avant (cash_drawer_id reste NULL, le trigger de
      // calcul du solde théorique ne se déclenche alors jamais). Seul le
      // paiement en espèces est concerné, jamais Mobile Money/carte/autre.
      let cashDrawerId = null;
      if (orderData.paymentMethod === 'CASH') {
        const drawerResult = await client.query(
          `SELECT id FROM cash_drawers WHERE store_id = $1 AND user_id = $2 AND status = 'OPEN'`,
          [storeId, userId]
        );
        cashDrawerId = drawerResult.rows[0]?.id || null;
      }

      // Créer l'ordre
      const orderResult = await client.query(
        `INSERT INTO orders
         (store_id, customer_id, seller_id, order_number, total_amount, discount_amount, tax_amount, payment_method, amount_paid, payment_status, status, cash_drawer_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PAID', $11)
         RETURNING id, order_number, total_amount, amount_paid, created_at`,
        [
          storeId,
          resolvedCustomerId,
          userId,
          orderNumber,
          finalTotal,
          discountAmount,
          taxAmount,
          orderData.paymentMethod,
          amountPaid,
          paymentStatus,
          cashDrawerId,
        ]
      );
      const order = orderResult.rows[0];

      // Créer les lignes de commande, décrémenter le stock de façon
      // atomique et enregistrer les mouvements de stock.
      const itemsResult = [];
      for (const item of preparedItems) {
        // Décrémentation ATOMIQUE : la condition "AND quantity >= $1" fait
        // partie intégrante de la requête. Si un autre vendeur a vendu le
        // même produit entre-temps, rowCount sera 0 et on lève une erreur
        // métier propre au lieu de laisser la contrainte CHECK de la base
        // remonter une erreur SQL brute et peu lisible pour l'utilisateur.
        // Désactivation automatique si le stock atteint 0 (décidé en
        // conversation) — jamais de réactivation automatique en sens
        // inverse : un produit peut être désactivé pour une tout autre
        // raison (arrêt de gamme), et un réapprovisionnement ne doit pas
        // annuler silencieusement cette décision. La réactivation reste un
        // choix explicite (POST /products/:id/reactivate).
        const stockUpdate = await client.query(
          `UPDATE products
           SET quantity = quantity - $1,
               status = CASE WHEN quantity - $1 = 0 THEN 'INACTIVE' ELSE status END
           WHERE id = $2 AND quantity >= $1`,
          [item.quantity, item.productId]
        );
        if (stockUpdate.rowCount === 0) {
          throw new AppError(
            `Stock insuffisant pour "${item.productName}" (vendu entre-temps par un autre poste de caisse).`,
            409
          );
        }

        const itemResult = await client.query(
          `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
           VALUES ($1, $2, $3, $4)
           RETURNING id, product_id, quantity, unit_price`,
          [order.id, item.productId, item.quantity, item.unitPrice]
        );
        itemsResult.push(itemResult.rows[0]);

        await client.query(
          `INSERT INTO stock_movements
           (product_id, type, quantity, reference_table, reference_id, user_id)
           VALUES ($1, 'SALE_OUT', $2, 'orders', $3, $4)`,
          [item.productId, item.quantity, order.id, userId]
        );
      }

      // Si client rattaché (existant ou tout juste créé), mettre à jour
      // total_spent (valeur totale des achats, peu importe le paiement)
      // et balance_due (uniquement la part non payée de CETTE vente).
      if (resolvedCustomerId) {
        const unpaidAmount = finalTotal - amountPaid;
        await client.query(
          `UPDATE customers SET total_spent = total_spent + $1, balance_due = balance_due + $2 WHERE id = $3`,
          [finalTotal, unpaidAmount, resolvedCustomerId]
        );
      }

      await client.query('COMMIT');

      // On garde les résultats pour construire la réponse UNE FOIS sortis
      // du bloc transactionnel (voir plus bas).
      committedOrder = {
        ...order,
        discountAmount,
        taxAmount,
        finalTotal,
        amountPaid: order.amount_paid,
      };
      committedItems = preparedItems;
    } catch (err) {
      // Ce ROLLBACK n'intervient que pour des erreurs survenues AVANT le
      // COMMIT ci-dessus (validation du stock, contrainte SQL, etc.) —
      // jamais après, puisque plus aucun code pouvant échouer ne s'exécute
      // entre COMMIT et la sortie de ce bloc.
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }

  // ----------------------------------------------------------------------
  // Génération du reçu — opération purement JavaScript (formatage), sans
  // accès base. Volontairement placée APRÈS la libération du client et en
  // dehors de tout bloc pouvant déclencher un ROLLBACK, pour ne jamais
  // risquer d'annuler une transaction déjà validée en base à cause d'une
  // erreur de formatage (cf. bug corrigé : generateReceipt() était
  // auparavant appelé À L'INTÉRIEUR du try contenant le COMMIT).
  //
  // Personnalisation du reçu (§23_personnalisation_recu.sql, décidé en
  // conversation) : lues ici, une fois la vente déjà actée en base — un
  // Owner qui change ses réglages entre-temps n'affecte jamais une vente
  // déjà validée, seulement les prochaines.
  // ----------------------------------------------------------------------
  const [storeResult, sellerResult, receiptSettings] = await Promise.all([
    pool.query('SELECT name, address, phone FROM stores WHERE id = $1', [storeId]),
    pool.query('SELECT full_name AS "fullName" FROM users WHERE id = $1', [userId]),
    getReceiptSettings(storeId),
  ]);
  const store = storeResult.rows[0];
  const sellerName = sellerResult.rows[0].fullName;

  const receipt = generateReceipt(
    {
      ...committedOrder,
      items: committedItems,
    },
    { store, sellerName, receiptSettings }
  );

  return {
    orderId: committedOrder.id,
    receiptContext: { store, sellerName, receiptSettings },
    orderNumber: committedOrder.order_number,
    totalAmount: committedOrder.finalTotal,
    items: committedItems,
    receipt,
    createdAt: committedOrder.created_at,
  };
}

/**
 * Lister les commandes avec filtres et pagination.
 * Champs renvoyés en camelCase, avec le nom du vendeur et du client déjà
 * joints (évite un aller-retour supplémentaire côté frontend pour
 * l'historique des ventes).
 * @param {number} storeId
 * @param {object} options - {page, limit, sellerId, customerId, status, startDate, endDate}
 * @returns {object} {orders, total, page, pages}
 */
async function getOrders(storeId, options = {}) {
  const page = Math.max(1, parseInt(options.page, 10) || 1);
  const limit = Math.min(100, parseInt(options.limit, 10) || 20);
  const offset = (page - 1) * limit;

  const conditions = ['o.store_id = $1'];
  const params = [storeId];
  let idx = 2;

  if (options.sellerId) {
    conditions.push(`o.seller_id = $${idx++}`);
    params.push(options.sellerId);
  }
  if (options.customerId) {
    conditions.push(`o.customer_id = $${idx++}`);
    params.push(options.customerId);
  }
  if (options.status) {
    conditions.push(`o.status = $${idx++}`);
    params.push(options.status);
  }
  if (options.startDate) {
    conditions.push(`o.created_at >= $${idx++}`);
    params.push(options.startDate);
  }
  if (options.endDate) {
    conditions.push(`o.created_at < $${idx++}`);
    params.push(options.endDate);
  }

  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM orders o WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limit, offset];
  const result = await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.total_amount AS "totalAmount",
            o.discount_amount AS "discountAmount", o.tax_amount AS "taxAmount",
            o.status, o.payment_method AS "paymentMethod", o.amount_paid AS "amountPaid", o.payment_status AS "paymentStatus",
            o.created_at AS "createdAt",
            o.seller_id AS "sellerId", u.full_name AS "sellerName",
            o.customer_id AS "customerId", c.name AS "customerName"
     FROM orders o
     LEFT JOIN users u ON u.id = o.seller_id
     LEFT JOIN customers c ON c.id = o.customer_id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    orders: result.rows,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/**
 * Récupérer une commande avec ses lignes — champs en camelCase.
 * @param {number} storeId
 * @param {number} orderId
 * @param {number|null} ownSellerId - Si fourni (Vendeur non-Owner), la
 *   commande n'est renvoyée que si elle lui appartient — sinon 404 (jamais
 *   403, pour ne pas révéler qu'une commande d'un collègue existe). `null`
 *   pour l'Owner : aucune restriction.
 * @returns {object} {order, items}
 */
async function getOrderById(storeId, orderId, ownSellerId = null) {
  const conditions = ['o.store_id = $1', 'o.id = $2'];
  const params = [storeId, orderId];
  if (ownSellerId) {
    conditions.push(`o.seller_id = $${params.length + 1}`);
    params.push(ownSellerId);
  }

  const orderResult = await pool.query(
    `SELECT o.id, o.order_number AS "orderNumber", o.total_amount AS "totalAmount",
            o.discount_amount AS "discountAmount", o.tax_amount AS "taxAmount",
            o.status, o.payment_method AS "paymentMethod", o.amount_paid AS "amountPaid", o.payment_status AS "paymentStatus",
            o.created_at AS "createdAt",
            o.seller_id AS "sellerId", u.full_name AS "sellerName",
            o.customer_id AS "customerId", c.name AS "customerName"
     FROM orders o
     LEFT JOIN customers c ON o.customer_id = c.id
     LEFT JOIN users u ON o.seller_id = u.id
     WHERE ${conditions.join(' AND ')}`,
    params
  );

  if (orderResult.rows.length === 0) {
    throw new AppError('Commande introuvable', 404);
  }

  const order = orderResult.rows[0];

  const itemsResult = await pool.query(
    `SELECT oi.id, oi.product_id AS "productId", oi.quantity,
            oi.unit_price AS "unitPrice", oi.returned_quantity AS "returnedQuantity",
            p.name AS "productName", p.reference
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.id`,
    [orderId]
  );

  return {
    order,
    items: itemsResult.rows,
  };
}

/**
 * Réunit tout ce qu'il faut pour générer la facture PDF d'une commande
 * (§ cahier des charges "Facture PDF") — réutilise `getOrderById` telle
 * quelle (mêmes règles d'accès Owner/Vendeur, jamais dupliquées) et ajoute
 * uniquement ce qui manque : les infos boutique (nom, adresse, téléphone,
 * logo) et les réglages de personnalisation du reçu, pour que la facture
 * respecte exactement les mêmes réglages que le reçu texte existant.
 * @param {number} storeId
 * @param {number} orderId
 * @param {number|null} ownSellerId - cf. getOrderById
 */
async function getInvoiceData(storeId, orderId, ownSellerId = null) {
  const [{ order, items }, storeResult, receiptSettings] = await Promise.all([
    getOrderById(storeId, orderId, ownSellerId),
    pool.query('SELECT name, address, phone, logo_url AS "logoUrl" FROM stores WHERE id = $1', [storeId]),
    getReceiptSettings(storeId),
  ]);

  return { order, items, store: storeResult.rows[0], receiptSettings };
}

/**
 * Annuler une commande (void) — reverse les mouvements de stock et,
 * décidé en conversation (§B1), la contribution de cette commande à la
 * fiche du client si elle en avait un.
 *
 * Une commande `PARTIALLY_RETURNED` peut être annulée (seules `VOIDED` et
 * `RETURNED` sont bloquées, cf. plus bas) — il faut donc composer avec ce
 * qui a déjà été retourné AVANT cette annulation, sur les deux plans :
 *  - Stock : ne remettre que ce qui n'était PAS déjà revenu
 *    (`quantity - returned_quantity`), jamais la quantité d'origine en
 *    entier — sinon les articles déjà restockés par un retour précédent
 *    seraient comptés deux fois.
 *  - Client : `remainingEffectiveTotal` = total d'origine moins la valeur
 *    déjà retournée (`SUM(returned_quantity * unit_price)`) — c'est ce qui
 *    "restait" sur cette commande juste avant l'annulation. `total_spent`
 *    perd exactement cette valeur (le retour précédent avait déjà retiré
 *    sa propre part) ; `balance_due` perd ce qui restait dû dessus
 *    (`remainingEffectiveTotal - amountPaid`, jamais négatif). Sans retour
 *    préalable, `remainingEffectiveTotal` vaut simplement le total
 *    d'origine — le calcul se réduit alors au cas simple.
 * @param {number} storeId
 * @param {number} orderId
 * @param {number} userId - Utilisateur qui annule
 * @param {string} roleCode - 'OWNER' ou 'SELLER' ; un Vendeur ne peut
 *   annuler que SES PROPRES ventes, même s'il est autorisé
 *   (§25_autorisation_annulation_retour.sql, décidé en conversation) —
 *   vérifié ici, jamais uniquement côté route.
 * @returns {object} {orderId, status}
 */
async function voidOrder(storeId, orderId, userId, roleCode) {
  const client = await pool.connect();
  try {
    const orderResult = await client.query(
      `SELECT id, status, order_number AS "orderNumber", customer_id AS "customerId",
              total_amount AS "totalAmount", amount_paid AS "amountPaid", seller_id AS "sellerId"
       FROM orders WHERE store_id = $1 AND id = $2`,
      [storeId, orderId]
    );

    if (orderResult.rows.length === 0) {
      throw new AppError('Commande introuvable', 404);
    }

    const order = orderResult.rows[0];
    if (roleCode !== 'OWNER' && order.sellerId !== userId) {
      throw new AppError('Vous ne pouvez annuler que vos propres ventes.', 403, 'FORBIDDEN');
    }
    if (order.status === 'VOIDED') {
      throw new AppError('Cette commande a déjà été annulée', 400);
    }
    if (order.status === 'RETURNED') {
      throw new AppError('Les commandes complètement retournées ne peuvent pas être annulées', 400);
    }

    await client.query('BEGIN');
    try {
      const itemsResult = await client.query(
        `SELECT product_id, quantity, returned_quantity AS "returnedQuantity",
                unit_price AS "unitPrice"
         FROM order_items WHERE order_id = $1`,
        [orderId]
      );

      const note = `Annulation de la commande ${order.orderNumber}`;
      let alreadyReturnedValue = 0;
      for (const item of itemsResult.rows) {
        const remainingQty = item.quantity - item.returnedQuantity;
        alreadyReturnedValue += item.returnedQuantity * item.unitPrice;

        if (remainingQty > 0) {
          await client.query(
            `INSERT INTO stock_movements
             (product_id, type, quantity, reference_table, reference_id, user_id, note)
             VALUES ($1, 'RETURN_IN', $2, 'orders', $3, $4, $5)`,
            [item.product_id, remainingQty, orderId, userId, note]
          );

          await client.query(
            `UPDATE products SET quantity = quantity + $1 WHERE id = $2`,
            [remainingQty, item.product_id]
          );
        }
      }

      await client.query(`UPDATE orders SET status = 'VOIDED' WHERE id = $1`, [orderId]);

      if (order.customerId) {
        const remainingEffectiveTotal = order.totalAmount - alreadyReturnedValue;
        const stillOwedOnOrder = Math.max(0, remainingEffectiveTotal - order.amountPaid);
        await client.query(
          `UPDATE customers
           SET total_spent = GREATEST(0, total_spent - $1),
               balance_due = GREATEST(0, balance_due - $2)
           WHERE id = $3`,
          [remainingEffectiveTotal, stillOwedOnOrder, order.customerId]
        );
      }

      await client.query(
        `INSERT INTO system_logs (user_id, store_id, action, details)
         VALUES ($1, $2, 'VOID_ORDER', $3::jsonb)`,
        [userId, storeId, JSON.stringify({ orderId, orderNumber: order.orderNumber })]
      );

      await client.query('COMMIT');

      return { orderId, status: 'VOIDED' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

/**
 * Enregistrer un retour partiel d'item — décidé en conversation (§B1) :
 * ajuste aussi la fiche du client s'il y en a un. `total_spent` perd la
 * valeur retournée (quantité × prix unitaire d'origine) ; `balance_due`
 * perd la même valeur, mais jamais plus que ce qui restait dû SUR CETTE
 * COMMANDE précisément (`LEAST`) — une cliente qui avait déjà tout payé et
 * retourne un article ne se retrouve jamais avec un solde négatif, elle
 * garde simplement 0 (ce système ne modélise pas les remboursements en
 * espèces, seule la dette peut s'annuler).
 * @param {number} storeId
 * @param {number} orderId
 * @param {number} itemId
 * @param {number} returnedQty
 * @param {number} userId
 * @param {string} roleCode - 'OWNER' ou 'SELLER' ; un Vendeur ne peut
 *   retourner que SES PROPRES ventes, même s'il est autorisé
 *   (§25_autorisation_annulation_retour.sql, décidé en conversation).
 * @returns {object} {itemId, returnedQty, remainingQty, orderStatus}
 */
async function returnOrderItem(storeId, orderId, itemId, returnedQty, userId, roleCode) {
  const client = await pool.connect();
  try {
    const itemResult = await client.query(
      `SELECT oi.id, oi.quantity, oi.returned_quantity, oi.product_id, oi.unit_price AS "unitPrice",
              o.store_id, o.order_number AS "orderNumber", o.customer_id AS "customerId",
              o.total_amount AS "totalAmount", o.amount_paid AS "amountPaid", o.seller_id AS "sellerId"
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE oi.id = $1 AND o.id = $2`,
      [itemId, orderId]
    );

    if (itemResult.rows.length === 0) {
      throw new AppError('Item de commande introuvable', 404);
    }

    const item = itemResult.rows[0];
    if (item.store_id !== storeId) {
      throw new AppError('Non autorisé', 403);
    }
    if (roleCode !== 'OWNER' && item.sellerId !== userId) {
      throw new AppError('Vous ne pouvez retourner que vos propres ventes.', 403, 'FORBIDDEN');
    }

    const availableForReturn = item.quantity - item.returned_quantity;
    if (returnedQty > availableForReturn) {
      throw new AppError(
        `Quantité invalide. Disponible pour retour: ${availableForReturn}`,
        400
      );
    }

    await client.query('BEGIN');
    try {
      await client.query(
        `INSERT INTO stock_movements
         (product_id, type, quantity, reference_table, reference_id, user_id, note)
         VALUES ($1, 'RETURN_IN', $2, 'order_items', $3, $4, $5)`,
        [item.product_id, returnedQty, itemId, userId, `Retour sur la commande ${item.orderNumber}`]
      );

      await client.query(
        `UPDATE products SET quantity = quantity + $1 WHERE id = $2`,
        [returnedQty, item.product_id]
      );

      const newReturnedQty = item.returned_quantity + returnedQty;
      await client.query(
        `UPDATE order_items SET returned_quantity = $1 WHERE id = $2`,
        [newReturnedQty, itemId]
      );

      // Grâce aux type parsers configurés dans config/db.js, total_qty et
      // total_returned sont désormais de vrais Number (et non des strings
      // issues de SUM()), donc cette comparaison est bien numérique.
      const totalReturnedResult = await client.query(
        `SELECT SUM(quantity) as total_qty, SUM(returned_quantity) as total_returned
         FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      const totals = totalReturnedResult.rows[0];

      let newStatus = 'PAID';
      if (totals.total_returned > 0 && totals.total_returned >= totals.total_qty) {
        newStatus = 'RETURNED';
      } else if (totals.total_returned > 0) {
        newStatus = 'PARTIALLY_RETURNED';
      }

      await client.query(`UPDATE orders SET status = $1 WHERE id = $2`, [newStatus, orderId]);

      if (item.customerId) {
        const returnedValue = returnedQty * item.unitPrice;
        const stillOwedOnOrder = item.totalAmount - item.amountPaid;
        await client.query(
          `UPDATE customers
           SET total_spent = GREATEST(0, total_spent - $1),
               balance_due = GREATEST(0, balance_due - LEAST($1, $2))
           WHERE id = $3`,
          [returnedValue, stillOwedOnOrder, item.customerId]
        );
      }

      await client.query(
        `INSERT INTO system_logs (user_id, store_id, action, details)
         VALUES ($1, $2, 'RETURN_ORDER_ITEM', $3::jsonb)`,
        [userId, storeId, JSON.stringify({ orderId, itemId, orderNumber: item.orderNumber, returnedQty })]
      );

      await client.query('COMMIT');

      return {
        itemId,
        returnedQty,
        remainingQty: availableForReturn - returnedQty,
        orderStatus: newStatus,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    client.release();
  }
}

/**
 * Générer un reçu lisible.
 * Fonction pure (aucun accès base) : toutes les valeurs numériques reçues
 * ici sont déjà de vrais Number grâce aux type parsers de config/db.js.
 *
 * `context` porte la personnalisation (§23_personnalisation_recu.sql,
 * décidé en conversation) — un formulaire structuré (en-tête/pied de page,
 * afficher/masquer adresse/téléphone/vendeur), jamais un éditeur libre.
 * @param {object} orderData
 * @param {object} context - {store: {name, address, phone}, sellerName, receiptSettings}
 * @returns {string} reçu formaté
 */
function generateReceipt(orderData, context = {}) {
  const { store = {}, sellerName, receiptSettings = {} } = context;
  const date = new Date(orderData.created_at).toLocaleString('fr-FR');

  const lines = ['═══════════════════════════════'];
  if (store.name) lines.push(store.name);
  if (receiptSettings.showAddress && store.address) lines.push(store.address);
  if (receiptSettings.showPhone && store.phone) lines.push(store.phone);
  if (receiptSettings.headerMessage) lines.push(receiptSettings.headerMessage);
  lines.push(
    '═══════════════════════════════',
    'REÇU DE VENTE',
    '═══════════════════════════════',
    ``,
    `Commande: ${orderData.order_number}`,
    `Date: ${date}`,
  );
  if (receiptSettings.showSellerName && sellerName) {
    lines.push(`Vendeur: ${sellerName}`);
  }
  lines.push(
    ``,
    '───────────────────────────────',
    'ARTICLES',
    '───────────────────────────────',
  );

  let subtotal = 0;
  for (const item of orderData.items) {
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    lines.push(`${item.productName.substring(0, 20)}`);
    lines.push(`  ${item.quantity} x ${item.unitPrice.toFixed(2)} = ${lineTotal.toFixed(2)}`);
  }

  lines.push(
    '───────────────────────────────',
    `Sous-total:        ${subtotal.toFixed(2)}`,
    `Réduction:        -${orderData.discountAmount.toFixed(2)}`,
    `Taxes:            +${orderData.taxAmount.toFixed(2)}`,
    '═══════════════════════════════',
    `TOTAL:             ${orderData.finalTotal.toFixed(2)}`,
    '═══════════════════════════════',
  );

  // Le mode de paiement (Total/Partiel) est toujours mentionné explicitement
  // — décidé en conversation — pas seulement déduit implicitement de la
  // présence ou non des lignes de détail.
  const remaining = orderData.finalTotal - orderData.amountPaid;
  const isPartial = remaining > 0;
  lines.push(`Paiement:          ${isPartial ? 'PARTIEL' : 'TOTAL'}`);
  if (isPartial) {
    lines.push(
      `Montant payé:      ${orderData.amountPaid.toFixed(2)}`,
      `RESTE À PAYER:     ${remaining.toFixed(2)}`,
    );
  }
  lines.push('───────────────────────────────');

  lines.push('', receiptSettings.footerMessage || 'Merci de votre visite !');

  return lines.join('\n');
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  getInvoiceData,
  voidOrder,
  returnOrderItem,
  generateReceipt,
};