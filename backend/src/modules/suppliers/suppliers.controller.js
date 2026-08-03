const suppliersService = require('./suppliers.service');

async function listSuppliers(req, res, next) {
  try {
    const suppliers = await suppliersService.listMySuppliers(req.auth.storeId);
    res.json({ suppliers });
  } catch (err) {
    next(err);
  }
}

async function listClients(req, res, next) {
  try {
    const clients = await suppliersService.listMyClients(req.auth.storeId);
    res.json({ clients });
  } catch (err) {
    next(err);
  }
}

async function addSupplier(req, res, next) {
  try {
    const result = await suppliersService.addSupplier(req.auth.storeId, req.body.code);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function removeSupplier(req, res, next) {
  try {
    const result = await suppliersService.removeSupplier(req.auth.storeId, req.params.linkId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function removeClient(req, res, next) {
  try {
    const result = await suppliersService.removeClient(req.auth.storeId, req.params.linkId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCatalog(req, res, next) {
  try {
    const products = await suppliersService.getSupplierCatalog(req.auth.storeId, req.params.storeId);
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listSuppliers,
  listClients,
  addSupplier,
  removeSupplier,
  removeClient,
  getCatalog,
};
