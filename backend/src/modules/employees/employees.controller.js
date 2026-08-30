const employeesService = require('./employees.service');

async function list(req, res, next) {
  try {
    const employees = await employeesService.listEmployees(req.auth.storeId);
    res.json({ employees });
  } catch (err) {
    next(err);
  }
}

async function listInvitations(req, res, next) {
  try {
    const invitations = await employeesService.listPendingInvitations(req.auth.storeId);
    res.json({ invitations });
  } catch (err) {
    next(err);
  }
}

async function add(req, res, next) {
  try {
    const result = await employeesService.addEmployee(req.auth.storeId, req.auth.userId, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function cancelInvitation(req, res, next) {
  try {
    const result = await employeesService.cancelInvitation(req.auth.storeId, req.params.invitationId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await employeesService.removeEmployee(
      req.auth.storeId,
      req.params.userId,
      req.auth.userId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updatePermissions(req, res, next) {
  try {
    // Les deux permissions sont indépendantes et optionnelles côté route
    // (voir employees.routes.js) — on n'applique que celles réellement
    // fournies dans cet appel, jamais l'autre par effet de bord.
    const result = { userId: Number(req.params.userId) };
    if (req.body.canVoidReturn !== undefined) {
      const r = await employeesService.setSellerVoidReturnPermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canVoidReturn,
        req.auth.userId
      );
      result.canVoidReturn = r.canVoidReturn;
    }
    if (req.body.canEditPrice !== undefined) {
      const r = await employeesService.setSellerEditPricePermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canEditPrice,
        req.auth.userId
      );
      result.canEditPrice = r.canEditPrice;
    }
    if (req.body.canAddProduct !== undefined) {
      const r = await employeesService.setSellerAddProductPermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canAddProduct,
        req.auth.userId
      );
      result.canAddProduct = r.canAddProduct;
    }
    if (req.body.canManageStock !== undefined) {
      const r = await employeesService.setSellerManageStockPermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canManageStock,
        req.auth.userId
      );
      result.canManageStock = r.canManageStock;
    }
    if (req.body.canManageSuppliers !== undefined) {
      const r = await employeesService.setSellerManageSuppliersPermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canManageSuppliers,
        req.auth.userId
      );
      result.canManageSuppliers = r.canManageSuppliers;
    }
    if (req.body.canManagePurchases !== undefined) {
      const r = await employeesService.setSellerManagePurchasesPermission(
        req.auth.storeId,
        req.params.userId,
        req.body.canManagePurchases,
        req.auth.userId
      );
      result.canManagePurchases = r.canManagePurchases;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, listInvitations, add, cancelInvitation, remove, updatePermissions };