const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const customersService = require('./customers.service');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

router.use(requireAuth, requireActiveStore);

router.get('/search', async (req, res, next) => {
  try {
    const customers = await customersService.searchCustomers(req.auth.storeId, req.query.q);
    res.json({ customers });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const result = await customersService.listCustomers(req.auth.storeId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', [param('id').isInt()], async (req, res, next) => {
  try {
    const customer = await customersService.getCustomerById(req.auth.storeId, req.params.id);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/orders', [param('id').isInt()], async (req, res, next) => {
  try {
    const result = await customersService.getCustomerOrderHistory(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id/payments', [param('id').isInt()], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
    }
    const payments = await customersService.listCustomerPayments(req.auth.storeId, req.params.id);
    res.json({ payments });
  } catch (err) {
    next(err);
  }
});

// ✅ nouvelle route, placée avec les autres routes /:id
router.post(
  '/:id/payments',
  [
    param('id').isInt(),
    body('amount').isFloat({ gt: 0 }).withMessage('Le montant doit être un nombre supérieur à 0.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const customer = await customersService.recordPayment(
        req.auth.storeId,
        req.params.id,
        req.body.amount,
        req.auth.userId
      );
      res.status(200).json({ customer });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Le nom du client est requis.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const customer = await customersService.createCustomer(req.auth.storeId, req.body);
      res.status(201).json(customer);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;