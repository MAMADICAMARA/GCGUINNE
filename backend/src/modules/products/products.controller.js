const { validationResult } = require('express-validator');
const productsService = require('./products.service');
const { AppError } = require('../../middlewares/errorHandler');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
  }
}

async function list(req, res, next) {
  try {
    const result = await productsService.listProducts(req.auth.storeId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const product = await productsService.getProductById(req.auth.storeId, req.params.id);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    checkValidation(req);
    const product = await productsService.createProduct(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    checkValidation(req);
    const product = await productsService.updateProduct(req.auth.storeId, req.params.id, req.body);
    res.json(product);
  } catch (err) {
    next(err);
  }
}

async function deactivate(req, res, next) {
  try {
    const result = await productsService.deactivateProduct(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function reactivate(req, res, next) {
  try {
    const result = await productsService.reactivateProduct(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function adjustStock(req, res, next) {
  try {
    checkValidation(req);
    const result = await productsService.adjustStock(
      req.auth.storeId,
      req.params.id,
      req.body.delta,
      req.auth.userId,
      req.body.note
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function stockHistory(req, res, next) {
  try {
    const history = await productsService.getStockHistory(req.auth.storeId, req.params.id);
    res.json({ history });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, deactivate, reactivate, adjustStock, stockHistory };