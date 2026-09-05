const stockTransfersService = require('./stockTransfers.service');

async function resolveCode(req, res, next) {
  try {
    const result = await stockTransfersService.resolveTransferCode(req.auth.storeId, req.query.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const result = await stockTransfersService.createTransfer(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function listRecentDestinations(req, res, next) {
  try {
    const result = await stockTransfersService.listRecentDestinations(req.auth.storeId);
    res.json({ destinations: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { resolveCode, create, listRecentDestinations };
