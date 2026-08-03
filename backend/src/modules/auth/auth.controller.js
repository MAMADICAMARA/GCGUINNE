const { validationResult } = require('express-validator');
const authService = require('./auth.service');
const { AppError } = require('../../middlewares/errorHandler');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
  }
}

async function register(req, res, next) {
  try {
    checkValidation(req);
    const result = await authService.register(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    checkValidation(req);
    const result = await authService.login(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function switchStore(req, res, next) {
  try {
    checkValidation(req);
    const result = await authService.switchStore({
      userId: req.auth.userId,
      storeId: req.body.storeId,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, switchStore };