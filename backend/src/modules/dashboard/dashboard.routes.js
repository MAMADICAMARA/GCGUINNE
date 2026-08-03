const { Router } = require('express');
const dashboardService = require('./dashboard.service');
const { requireAuth, requireActiveStore } = require('../../middlewares/auth');

const router = Router();

router.use(requireAuth, requireActiveStore);

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await dashboardService.getDashboardStats(
      req.auth.storeId,
      req.auth.roleCode,
      req.auth.userId
    );
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

module.exports = router;