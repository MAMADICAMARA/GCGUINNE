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

module.exports = { list, listInvitations, add, cancelInvitation, remove };