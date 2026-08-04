const service = require('./purchases.service');

async function listSupplierContacts(req, res, next) {
  try {
    const suppliers = await service.listSupplierContacts(req.auth.storeId);
    res.json({ suppliers });
  } catch (err) {
    next(err);
  }
}

async function createSupplierContact(req, res, next) {
  try {
    const supplier = await service.createSupplierContact(req.auth.storeId, req.body);
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
}

async function updateSupplierContact(req, res, next) {
  try {
    const supplier = await service.updateSupplierContact(req.auth.storeId, req.params.id, req.body);
    res.json(supplier);
  } catch (err) {
    next(err);
  }
}

async function deleteSupplierContact(req, res, next) {
  try {
    const result = await service.deleteSupplierContact(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listPurchaseOrders(req, res, next) {
  try {
    const result = await service.listPurchaseOrders(req.auth.storeId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getPurchaseOrder(req, res, next) {
  try {
    const result = await service.getPurchaseOrderById(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function createPurchaseOrder(req, res, next) {
  try {
    const order = await service.createPurchaseOrder(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function createOrderFromSupplierStore(req, res, next) {
  try {
    const order = await service.createOrderFromSupplierStore(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
}

async function receivePurchaseOrder(req, res, next) {
  try {
    const result = await service.receivePurchaseOrder(req.auth.storeId, req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function cancelPurchaseOrder(req, res, next) {
  try {
    const result = await service.cancelPurchaseOrder(req.auth.storeId, req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listReceivedOrders(req, res, next) {
  try {
    const result = await service.listOrdersFromMyClients(req.auth.storeId, req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getReceivedOrder(req, res, next) {
  try {
    const result = await service.getReceivedOrderById(req.auth.storeId, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSupplierContacts,
  createSupplierContact,
  updateSupplierContact,
  deleteSupplierContact,
  listPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  createOrderFromSupplierStore,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  listReceivedOrders,
  getReceivedOrder,
};
