const service = require('./cashDrawers.service');

async function getCurrent(req, res, next) {
  try {
    const drawer = await service.getMyCurrentDrawer(req.auth.storeId, req.auth.userId);
    res.json({ drawer });
  } catch (err) {
    next(err);
  }
}

async function open(req, res, next) {
  try {
    const drawer = await service.openDrawer(req.auth.storeId, req.auth.userId, req.body.openingBalance);
    res.status(201).json(drawer);
  } catch (err) {
    next(err);
  }
}

async function close(req, res, next) {
  try {
    const drawer = await service.closeDrawer(
      req.auth.storeId,
      req.auth.userId,
      req.body.closingBalance,
      req.body.note
    );
    res.json(drawer);
  } catch (err) {
    next(err);
  }
}

async function list(req, res, next) {
  try {
    // Un Vendeur ne voit que ses propres sessions — jamais celles d'un
    // collègue (même principe que l'historique des ventes, §B1) ; le
    // paramètre userId éventuellement fourni par le client est ignoré
    // dans ce cas, jamais fait confiance.
    const options =
      req.auth.roleCode === 'OWNER' ? req.query : { ...req.query, userId: req.auth.userId };
    const result = await service.listDrawers(req.auth.storeId, options);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const restrictToUserId = req.auth.roleCode === 'OWNER' ? null : req.auth.userId;
    const result = await service.getDrawerById(req.auth.storeId, req.params.id, restrictToUserId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = { getCurrent, open, close, list, getById };
