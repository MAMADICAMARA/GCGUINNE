const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { activateStorePlan } = require('../admin/admin.service');

const PAYMENT_METHODS = ['ORANGE_MONEY', 'MOBILE_MONEY', 'PAYCARD'];
const RENEWAL_DAYS = 30; // même convention que le +30 jours par défaut de StorePlanModal.jsx

/**
 * Plans payants disponibles (prix inclus, jamais exposé par
 * GET /stores/plan-status) + coordonnées de paiement configurées par le
 * Super Admin (§27_paiement_abonnement.sql, décidé en conversation) — sert
 * à construire l'écran "S'abonner" côté Owner.
 */
async function getSubscriptionOptions() {
  const [plansResult, settingsResult] = await Promise.all([
    pool.query(
      `SELECT id, name, price, max_users_per_store AS "maxUsersPerStore",
              allows_supervision AS "allowsSupervision", allows_suppliers AS "allowsSuppliers"
       FROM subscription_plans
       WHERE name != 'FREEMIUM'
       ORDER BY price ASC`
    ),
    pool.query(
      `SELECT orange_money_number AS "orangeMoneyNumber", mobile_money_number AS "mobileMoneyNumber",
              paycard_info AS "paycardInfo", contact_phone AS "contactPhone",
              contact_whatsapp AS "contactWhatsapp", contact_email AS "contactEmail"
       FROM platform_payment_settings WHERE id = 1`
    ),
  ]);

  return {
    plans: plansResult.rows,
    paymentSettings: settingsResult.rows[0] || {},
    renewalDays: RENEWAL_DAYS,
  };
}

/**
 * Soumission d'une déclaration de paiement par le Owner (§27, décidé en
 * conversation). Le montant n'est JAMAIS fourni par le client — toujours
 * recalculé ici à partir du prix actuel du plan, figé dans la ligne créée
 * (un Owner ne peut pas déclarer un montant arbitraire, et une modification
 * ultérieure du prix par le Super Admin ne change jamais rétroactivement
 * une demande déjà soumise).
 */
async function submitPaymentRequest(storeId, userId, { planId, paymentMethod, payerPhone, transactionReference }) {
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw new AppError('Méthode de paiement invalide.', 400, 'VALIDATION_ERROR');
  }
  const reference = (transactionReference || '').trim();
  if (!reference) {
    throw new AppError('La référence de transaction est requise.', 400, 'VALIDATION_ERROR');
  }

  const planResult = await pool.query(
    "SELECT id, name, price FROM subscription_plans WHERE id = $1 AND name != 'FREEMIUM'",
    [planId]
  );
  if (planResult.rows.length === 0) {
    throw new AppError('Plan introuvable.', 404, 'PLAN_NOT_FOUND');
  }
  const plan = planResult.rows[0];

  const existingPending = await pool.query(
    "SELECT id FROM subscription_payment_requests WHERE store_id = $1 AND status = 'PENDING'",
    [storeId]
  );
  if (existingPending.rows.length > 0) {
    throw new AppError(
      'Une demande est déjà en attente de vérification pour cette boutique.',
      409,
      'REQUEST_ALREADY_PENDING'
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO subscription_payment_requests
     (store_id, requested_by, plan_id, payment_method, payer_phone, transaction_reference, amount_declared)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, status, amount_declared AS "amountDeclared", created_at AS "createdAt"`,
    [storeId, userId, plan.id, paymentMethod, (payerPhone || '').trim() || null, reference, plan.price]
  );

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'SUBMIT_PAYMENT_REQUEST', $3::jsonb)`,
    [userId, storeId, JSON.stringify({ planId: plan.id, planName: plan.name, paymentMethod, amount: plan.price })]
  );

  return rows[0];
}

/**
 * Dernière demande de paiement de la boutique (peu importe son statut) —
 * permet au Owner de voir "en attente de vérification" / le motif d'un
 * refus / rien s'il n'a jamais rien soumis.
 */
async function getLatestPaymentRequest(storeId) {
  const { rows } = await pool.query(
    `SELECT pr.id, pr.status, pr.payment_method AS "paymentMethod",
            pr.transaction_reference AS "transactionReference",
            pr.amount_declared AS "amountDeclared", pr.rejection_reason AS "rejectionReason",
            pr.created_at AS "createdAt", pr.reviewed_at AS "reviewedAt",
            sp.name AS "planName"
     FROM subscription_payment_requests pr
     JOIN subscription_plans sp ON sp.id = pr.plan_id
     WHERE pr.store_id = $1
     ORDER BY pr.created_at DESC
     LIMIT 1`,
    [storeId]
  );
  return rows[0] || null;
}

/**
 * Liste des demandes pour le Super Admin (§27, décidé en conversation) —
 * filtrable par statut, PENDING par défaut (c'est la file de travail).
 */
async function listPaymentRequests({ status = 'PENDING', page, limit } = {}) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, parseInt(limit, 10) || 20);
  const offset = (pageNum - 1) * limitNum;

  const conditions = [];
  const params = [];
  if (status && status !== 'ALL') {
    conditions.push(`pr.status = $${params.length + 1}`);
    params.push(status);
  }
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = await pool.query(
    `SELECT COUNT(*) AS count FROM subscription_payment_requests pr ${whereClause}`,
    params
  );

  const dataParams = [...params, limitNum, offset];
  const result = await pool.query(
    `SELECT pr.id, pr.status, pr.payment_method AS "paymentMethod", pr.payer_phone AS "payerPhone",
            pr.transaction_reference AS "transactionReference", pr.amount_declared AS "amountDeclared",
            pr.rejection_reason AS "rejectionReason", pr.created_at AS "createdAt",
            pr.reviewed_at AS "reviewedAt",
            s.id AS "storeId", s.name AS "storeName",
            sp.id AS "planId", sp.name AS "planName",
            u.full_name AS "requestedByName", u.email AS "requestedByEmail",
            rv.full_name AS "reviewedByName"
     FROM subscription_payment_requests pr
     JOIN stores s ON s.id = pr.store_id
     JOIN subscription_plans sp ON sp.id = pr.plan_id
     JOIN users u ON u.id = pr.requested_by
     LEFT JOIN users rv ON rv.id = pr.reviewed_by
     ${whereClause}
     ORDER BY pr.created_at DESC
     LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    dataParams
  );

  return {
    requests: result.rows,
    total: parseInt(countResult.rows[0].count, 10),
    page: pageNum,
    pages: Math.max(1, Math.ceil(parseInt(countResult.rows[0].count, 10) / limitNum)),
  };
}

/**
 * Confirmation d'une demande (§27, décidé en conversation) — appelle
 * EXACTEMENT `activateStorePlan` (admin.service.js), jamais dupliquée ni
 * modifiée : c'est la même fonction que l'activation 100% manuelle
 * existante utilise déjà. La date d'expiration est toujours calculée à
 * partir d'aujourd'hui (+30 jours), jamais cumulée avec un reliquat
 * éventuel d'un plan déjà actif — même logique que le Super Admin manuel,
 * qui choisit toujours une date absolue plutôt qu'un cumul.
 */
async function confirmPaymentRequest(requestId, adminUserId) {
  const { rows } = await pool.query(
    `SELECT id, store_id AS "storeId", plan_id AS "planId", status
     FROM subscription_payment_requests WHERE id = $1`,
    [requestId]
  );
  if (rows.length === 0) {
    throw new AppError('Demande introuvable.', 404, 'REQUEST_NOT_FOUND');
  }
  const request = rows[0];
  if (request.status !== 'PENDING') {
    throw new AppError('Cette demande a déjà été traitée.', 409, 'REQUEST_ALREADY_PROCESSED');
  }

  const expiresAt = new Date(Date.now() + RENEWAL_DAYS * 24 * 60 * 60 * 1000);

  // Fonction existante, non modifiée — voir commentaire ci-dessus. Si cette
  // étape échoue, la demande reste PENDING (rien n'est marqué confirmé à
  // tort) et peut être retentée.
  await activateStorePlan(request.storeId, request.planId, expiresAt.toISOString(), adminUserId);

  const { rows: updatedRows } = await pool.query(
    `UPDATE subscription_payment_requests
     SET status = 'CONFIRMED', reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2
     RETURNING id, status`,
    [adminUserId, requestId]
  );

  return updatedRows[0];
}

async function rejectPaymentRequest(requestId, adminUserId, reason) {
  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    throw new AppError('Le motif du refus est requis.', 400, 'VALIDATION_ERROR');
  }

  const { rows } = await pool.query(
    `UPDATE subscription_payment_requests
     SET status = 'REJECTED', reviewed_by = $1, reviewed_at = NOW(), rejection_reason = $2
     WHERE id = $3 AND status = 'PENDING'
     RETURNING id, status, store_id AS "storeId"`,
    [adminUserId, trimmedReason, requestId]
  );
  if (rows.length === 0) {
    throw new AppError('Demande introuvable ou déjà traitée.', 404, 'REQUEST_NOT_FOUND');
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'REJECT_PAYMENT_REQUEST', $3::jsonb)`,
    [adminUserId, rows[0].storeId, JSON.stringify({ requestId, reason: trimmedReason })]
  );

  return { id: rows[0].id, status: rows[0].status };
}

async function getPaymentSettings() {
  const { rows } = await pool.query(
    `SELECT orange_money_number AS "orangeMoneyNumber", mobile_money_number AS "mobileMoneyNumber",
            paycard_info AS "paycardInfo", contact_phone AS "contactPhone",
            contact_whatsapp AS "contactWhatsapp", contact_email AS "contactEmail",
            updated_at AS "updatedAt"
     FROM platform_payment_settings WHERE id = 1`
  );
  return rows[0] || {};
}

async function updatePaymentSettings(settings) {
  const merged = {
    orangeMoneyNumber: (settings.orangeMoneyNumber || '').trim() || null,
    mobileMoneyNumber: (settings.mobileMoneyNumber || '').trim() || null,
    paycardInfo: (settings.paycardInfo || '').trim() || null,
    contactPhone: (settings.contactPhone || '').trim() || null,
    contactWhatsapp: (settings.contactWhatsapp || '').trim() || null,
    contactEmail: (settings.contactEmail || '').trim() || null,
  };

  await pool.query(
    `UPDATE platform_payment_settings
     SET orange_money_number = $1, mobile_money_number = $2, paycard_info = $3,
         contact_phone = $4, contact_whatsapp = $5, contact_email = $6, updated_at = NOW()
     WHERE id = 1`,
    [
      merged.orangeMoneyNumber,
      merged.mobileMoneyNumber,
      merged.paycardInfo,
      merged.contactPhone,
      merged.contactWhatsapp,
      merged.contactEmail,
    ]
  );

  return merged;
}

module.exports = {
  getSubscriptionOptions,
  submitPaymentRequest,
  getLatestPaymentRequest,
  listPaymentRequests,
  confirmPaymentRequest,
  rejectPaymentRequest,
  getPaymentSettings,
  updatePaymentSettings,
};
