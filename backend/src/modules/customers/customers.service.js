const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Module Clients (§4.7 du cahier des charges).
 *
 * Volontairement réduit à deux champs (nom, téléphone) — décision prise en
 * conversation : les ventes physiques passent avant tout, et une bonne
 * partie de la clientèle est non lettrée. Un formulaire long serait un
 * frein réel en caisse. email/adresse restent disponibles en base pour un
 * usage futur, mais ne sont jamais demandés ici.
 *
 * balance_due (§15_paiement_partiel.sql) suit le solde dû après un
 * paiement partiel en caisse — maintenu de façon incrémentale par
 * orders.service.js, jamais recalculé ici.
 */

async function searchCustomers(storeId, query) {
  if (!query || !query.trim()) return [];
  const { rows } = await pool.query(
    `SELECT id, name, phone, total_spent AS "totalSpent", balance_due AS "balanceDue"
     FROM customers
     WHERE store_id = $1 AND (name ILIKE $2 OR phone ILIKE $2)
     ORDER BY name ASC
     LIMIT 10`,
    [storeId, `%${query.trim()}%`]
  );
  return rows;
}

async function listCustomers(storeId, { page, limit, search, owingOnly } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = ['store_id = $1'];
  const params = [storeId];
  let idx = 2;

  if (search) {
    conditions.push(`(name ILIKE $${idx} OR phone ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx++;
  }
  if (owingOnly === true || owingOnly === 'true') {
    conditions.push('balance_due > 0');
  }
  const whereClause = conditions.join(' AND ');

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM customers WHERE ${whereClause}`,
    params
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT id, name, phone, total_spent AS "totalSpent", balance_due AS "balanceDue",
            created_at AS "createdAt"
     FROM customers
     WHERE ${whereClause}
     ORDER BY balance_due DESC, created_at DESC
     LIMIT $${idx++} OFFSET $${idx++}`,
    dataParams
  );

  return {
    customers: result.rows,
    total,
    page: pageNum,
    pages: Math.max(1, Math.ceil(total / limitNum)),
  };
}

async function createCustomer(storeId, { name, phone }) {
  if (!name || !name.trim()) {
    throw new AppError('Le nom du client est requis.', 400, 'VALIDATION_ERROR');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO customers (store_id, name, phone)
       VALUES ($1, $2, $3)
       RETURNING id, name, phone, total_spent AS "totalSpent", balance_due AS "balanceDue",
                 created_at AS "createdAt"`,
      [storeId, name.trim(), phone?.trim() || null]
    );
    return rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Un client avec ce numéro existe déjà dans cette boutique.', 409, 'PHONE_ALREADY_USED');
    }
    throw err;
  }
}

async function getCustomerById(storeId, customerId) {
  const { rows } = await pool.query(
    `SELECT id, name, phone, total_spent AS "totalSpent", balance_due AS "balanceDue",
            created_at AS "createdAt"
     FROM customers WHERE store_id = $1 AND id = $2`,
    [storeId, customerId]
  );
  if (rows.length === 0) {
    throw new AppError('Client introuvable.', 404, 'CUSTOMER_NOT_FOUND');
  }
  return rows[0];
}

async function getCustomerOrderHistory(storeId, customerId) {
  const customer = await getCustomerById(storeId, customerId);

  const { rows } = await pool.query(
    `SELECT o.id AS "orderId", o.order_number AS "orderNumber", o.created_at AS "createdAt",
            o.total_amount AS "totalAmount", o.amount_paid AS "amountPaid",
            o.payment_status AS "paymentStatus", o.status,
            u.full_name AS "sellerName",
            oi.quantity, oi.unit_price AS "unitPrice", p.name AS "productName"
     FROM orders o
     JOIN users u ON u.id = o.seller_id
     JOIN order_items oi ON oi.order_id = o.id
     JOIN products p ON p.id = oi.product_id
     WHERE o.store_id = $1 AND o.customer_id = $2
       AND o.id IN (
         SELECT id FROM orders WHERE customer_id = $2 AND store_id = $1
         ORDER BY created_at DESC LIMIT 50
       )
     ORDER BY o.created_at DESC, oi.id ASC`,
    [storeId, customerId]
  );

  const ordersById = new Map();
  for (const row of rows) {
    if (!ordersById.has(row.orderId)) {
      ordersById.set(row.orderId, {
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        createdAt: row.createdAt,
        totalAmount: row.totalAmount,
        amountPaid: row.amountPaid,
        paymentStatus: row.paymentStatus,
        status: row.status,
        sellerName: row.sellerName,
        items: [],
      });
    }
    ordersById.get(row.orderId).items.push({
      productName: row.productName,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
    });
  }

  return { customer, orders: Array.from(ordersById.values()) };
}

/**
 * Historique des paiements encaissés pour un client (§ décidé en
 * conversation) — traçabilité montant/vendeur/date de chaque versement,
 * y compris les paiements partiels successifs. `customer_payments` était
 * déjà alimentée par recordPayment ci-dessous, mais jamais relue nulle
 * part avant cette fonction.
 */
async function listCustomerPayments(storeId, customerId) {
  await getCustomerById(storeId, customerId);

  const { rows } = await pool.query(
    `SELECT cp.id, cp.amount, cp.created_at AS "createdAt",
            u.full_name AS "sellerName"
     FROM customer_payments cp
     JOIN users u ON u.id = cp.user_id
     WHERE cp.store_id = $1 AND cp.customer_id = $2
     ORDER BY cp.created_at DESC`,
    [storeId, customerId]
  );
  return rows;
}

/**
 * Enregistre un paiement (total ou partiel) du solde dû d'un client.
 * Répartit le montant sur les commandes impayées de la plus ancienne à la
 * plus récente (FIFO), pour garder orders.amount_paid/payment_status
 * cohérents commande par commande — pas seulement le solde agrégé.
 * Transaction verrouillée (FOR UPDATE) pour éviter une double mise à jour
 * concurrente si deux caisses encaissent en même temps.
 */
async function recordPayment(storeId, customerId, amount, userId) {
  if (typeof amount !== 'number' || amount <= 0) {
    throw new AppError('Le montant doit être supérieur à 0.', 400, 'VALIDATION_ERROR');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const customerResult = await client.query(
      `SELECT id, balance_due AS "balanceDue" FROM customers
       WHERE store_id = $1 AND id = $2 FOR UPDATE`,
      [storeId, customerId]
    );
    if (customerResult.rows.length === 0) {
      throw new AppError('Client introuvable.', 404, 'CUSTOMER_NOT_FOUND');
    }
    const customer = customerResult.rows[0];

    if (amount > customer.balanceDue) {
      throw new AppError(
        `Le montant dépasse le solde dû (${customer.balanceDue}).`,
        400,
        'AMOUNT_EXCEEDS_BALANCE'
      );
    }

    const unpaidOrders = await client.query(
      `SELECT id, total_amount AS "totalAmount", amount_paid AS "amountPaid"
       FROM orders
       WHERE store_id = $1 AND customer_id = $2
         AND payment_status != 'PAID' AND status != 'VOIDED'
       ORDER BY created_at ASC
       FOR UPDATE`,
      [storeId, customerId]
    );

    let remaining = amount;
    for (const order of unpaidOrders.rows) {
      if (remaining <= 0) break;
      const orderDue = order.totalAmount - order.amountPaid;
      const applied = Math.min(orderDue, remaining);
      const newAmountPaid = order.amountPaid + applied;
      const newPaymentStatus = newAmountPaid >= order.totalAmount ? 'PAID' : 'PARTIALLY_PAID';

      await client.query(
        `UPDATE orders SET amount_paid = $1, payment_status = $2 WHERE id = $3`,
        [newAmountPaid, newPaymentStatus, order.id]
      );
      remaining -= applied;
    }

    await client.query(
      `UPDATE customers SET balance_due = balance_due - $1 WHERE id = $2`,
      [amount, customerId]
    );

    await client.query(
      `INSERT INTO customer_payments (store_id, customer_id, amount, user_id)
       VALUES ($1, $2, $3, $4)`,
      [storeId, customerId, amount, userId]
    );

    await client.query('COMMIT');

    const updated = await client.query(
      `SELECT id, name, phone, total_spent AS "totalSpent", balance_due AS "balanceDue"
       FROM customers WHERE id = $1`,
      [customerId]
    );
    return updated.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  searchCustomers,
  listCustomers,
  createCustomer,
  getCustomerById,
  getCustomerOrderHistory,
  listCustomerPayments,
  recordPayment,
};