const service = require('./subscriptionPayments.service');

async function getOptions(req, res, next) {
  try {
    const result = await service.getSubscriptionOptions();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function submitRequest(req, res, next) {
  try {
    const result = await service.submitPaymentRequest(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMine(req, res, next) {
  try {
    const result = await service.getLatestPaymentRequest(req.auth.storeId);
    res.json({ request: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { getOptions, submitRequest, getMine };
