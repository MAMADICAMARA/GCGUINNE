const { validationResult } = require('express-validator');
const ordersService = require('./orders.service');
const { streamInvoicePdf } = require('./invoicePdf');
const { buildOrdersExportCsv } = require('./ordersExport');
const { AppError } = require('../../middlewares/errorHandler');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
  }
}

/**
 * Toutes les routes de ce contrôleur supposent qu'un middleware en amont
 * (requireAuth + requireActiveStore) a déjà peuplé req.auth avec :
 *   { userId, storeId, roleCode }
 * Aucune route ici ne doit jamais faire confiance à un store_id fourni
 * par le client (body/query/params) — toujours req.auth.storeId.
 */

async function createOrder(req, res, next) {
  try {
    checkValidation(req);
    const result = await ordersService.createOrder(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode,
      req.body
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    // Un Vendeur (même autorisé à annuler/retourner) ne voit que SES
    // PROPRES ventes ici — jamais celles de ses collègues, décidé en
    // conversation (§25_autorisation_annulation_retour.sql). Le paramètre
    // sellerId éventuellement fourni par le client est ignoré dans ce cas,
    // jamais fait confiance.
    const options =
      req.auth.roleCode === 'OWNER'
        ? req.query
        : { ...req.query, sellerId: req.auth.userId };
    const result = await ordersService.getOrders(req.auth.storeId, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const ownSellerId = req.auth.roleCode === 'OWNER' ? null : req.auth.userId;
    const result = await ordersService.getOrderById(req.auth.storeId, req.params.id, ownSellerId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getInvoicePdf(req, res, next) {
  try {
    const ownSellerId = req.auth.roleCode === 'OWNER' ? null : req.auth.userId;
    const { order, items, store, receiptSettings, billingSettings } = await ordersService.getInvoiceData(
      req.auth.storeId,
      req.params.id,
      ownSellerId
    );

    // Tout ce qui peut échouer (accès refusé, commande introuvable) doit se
    // produire AVANT d'écrire quoi que ce soit dans la réponse — une fois
    // les en-têtes envoyés, une erreur ne peut plus jamais devenir un JSON
    // d'erreur propre côté client.
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="facture-${order.invoiceNumber || order.orderNumber}.pdf"`);
    await streamInvoicePdf(res, order, items, { store, receiptSettings, billingSettings });
  } catch (err) {
    next(err);
  }
}

// --- Export comptable (§42_facturation_boutique.sql, décidé en
// conversation) — CSV généré à la volée sur la période choisie, réservé au
// Owner (requireRole('OWNER'), cf. orders.routes.js) : une donnée
// financière consolidée, pas un usage quotidien de Vendeur.
async function exportOrders(req, res, next) {
  try {
    const orders = await ordersService.exportOrdersData(req.auth.storeId, {
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    const csv = buildOrdersExportCsv(orders);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="export-ventes.csv"');
    res.send(csv);
  } catch (err) {
    next(err);
  }
}

async function voidOrder(req, res, next) {
  try {
    checkValidation(req);
    const result = await ordersService.voidOrder(
      req.auth.storeId,
      req.params.id,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function returnOrderItem(req, res, next) {
  try {
    checkValidation(req);
    const result = await ordersService.returnOrderItem(
      req.auth.storeId,
      req.params.orderId,
      req.params.itemId,
      req.body.returnedQty,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listOrders, getOrder, getInvoicePdf, exportOrders, voidOrder, returnOrderItem };