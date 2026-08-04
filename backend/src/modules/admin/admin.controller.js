const adminService = require('./admin.service');
const subscriptionPaymentsService = require('../subscriptionPayments/subscriptionPayments.service');

async function stats(req, res, next) {
  try {
    const result = await adminService.getPlatformStats();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listStores(req, res, next) {
  try {
    const result = await adminService.listAllStores(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function suspendStore(req, res, next) {
  try {
    const result = await adminService.suspendStore(req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function reactivateStore(req, res, next) {
  try {
    const result = await adminService.reactivateStore(req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listPlans(req, res, next) {
  try {
    const plans = await adminService.listPlans();
    res.json({ plans });
  } catch (err) {
    next(err);
  }
}

async function updatePlan(req, res, next) {
  try {
    const plan = await adminService.updatePlan(req.params.id, req.body, req.auth.userId);
    res.json(plan);
  } catch (err) {
    next(err);
  }
}

async function activateStorePlan(req, res, next) {
  try {
    const result = await adminService.activateStorePlan(
      req.params.id,
      req.body.planId,
      req.body.expiresAt,
      req.auth.userId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function renewStorePlan(req, res, next) {
  try {
    const result = await adminService.renewStorePlan(req.params.id, req.body.expiresAt, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function deactivateStorePlan(req, res, next) {
  try {
    const result = await adminService.deactivateStorePlan(req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function activatePlanForAllFreemiumStores(req, res, next) {
  try {
    const result = await adminService.activatePlanForAllFreemiumStores(
      req.params.id,
      req.body.days,
      req.auth.userId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const result = await adminService.listAuditLogs(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function searchUsers(req, res, next) {
  try {
    const users = await adminService.searchUsers(req.query.q);
    res.json({ users });
  } catch (err) {
    next(err);
  }
}

async function transferStore(req, res, next) {
  try {
    const result = await adminService.transferStoreOwnership(
      req.params.id,
      req.body.newOwnerUserId,
      req.auth.userId
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function promoteUser(req, res, next) {
  try {
    const result = await adminService.promoteToSuperAdmin(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function revokeUser(req, res, next) {
  try {
    const result = await adminService.revokeSuperAdmin(req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function listStoreTypes(req, res, next) {
  try {
    const storeTypes = await adminService.listStoreTypes();
    res.json({ storeTypes });
  } catch (err) {
    next(err);
  }
}

async function createStoreType(req, res, next) {
  try {
    const storeType = await adminService.createStoreType(req.body);
    res.status(201).json(storeType);
  } catch (err) {
    next(err);
  }
}

async function updateStoreType(req, res, next) {
  try {
    const storeType = await adminService.updateStoreType(req.params.id, req.body);
    res.json(storeType);
  } catch (err) {
    next(err);
  }
}

async function deleteStoreType(req, res, next) {
  try {
    const result = await adminService.deleteStoreType(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function addStoreTypeCategory(req, res, next) {
  try {
    const category = await adminService.addStoreTypeCategory(req.params.storeTypeId, req.body);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
}

async function updateStoreTypeCategory(req, res, next) {
  try {
    const category = await adminService.updateStoreTypeCategory(req.params.categoryId, req.body);
    res.json(category);
  } catch (err) {
    next(err);
  }
}

async function deleteStoreTypeCategory(req, res, next) {
  try {
    const result = await adminService.deleteStoreTypeCategory(req.params.categoryId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// --- Demandes de paiement d'abonnement (§27_paiement_abonnement.sql,
// décidé en conversation) — délègue à subscriptionPayments.service.js,
// jamais à admin.service.js : la confirmation appelle en interne
// adminService.activateStorePlan sans jamais la modifier.
async function listPaymentRequests(req, res, next) {
  try {
    const result = await subscriptionPaymentsService.listPaymentRequests(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function confirmPaymentRequest(req, res, next) {
  try {
    const result = await subscriptionPaymentsService.confirmPaymentRequest(req.params.id, req.auth.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function rejectPaymentRequest(req, res, next) {
  try {
    const result = await subscriptionPaymentsService.rejectPaymentRequest(
      req.params.id,
      req.auth.userId,
      req.body.reason
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getPaymentSettings(req, res, next) {
  try {
    const result = await subscriptionPaymentsService.getPaymentSettings();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function updatePaymentSettings(req, res, next) {
  try {
    const result = await subscriptionPaymentsService.updatePaymentSettings(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  stats,
  listStores,
  suspendStore,
  reactivateStore,
  listPlans,
  updatePlan,
  activateStorePlan,
  renewStorePlan,
  deactivateStorePlan,
  activatePlanForAllFreemiumStores,
  listAuditLogs,
  searchUsers,
  transferStore,
  promoteUser,
  revokeUser,
  listStoreTypes,
  createStoreType,
  updateStoreType,
  deleteStoreType,
  addStoreTypeCategory,
  updateStoreTypeCategory,
  deleteStoreTypeCategory,
  listPaymentRequests,
  confirmPaymentRequest,
  rejectPaymentRequest,
  getPaymentSettings,
  updatePaymentSettings,
};
