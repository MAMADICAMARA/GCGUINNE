const { validationResult } = require('express-validator');
const ordersService = require('./orders.service');
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
    const result = await ordersService.createOrder(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listOrders(req, res, next) {
  try {
    const result = await ordersService.getOrders(req.auth.storeId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOrder(req, res, next) {
  try {
    const result = await ordersService.getOrderById(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function voidOrder(req, res, next) {
  try {
    const result = await ordersService.voidOrder(req.auth.storeId, req.params.id, req.auth.userId);
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
      req.auth.userId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, listOrders, getOrder, voidOrder, returnOrderItem };