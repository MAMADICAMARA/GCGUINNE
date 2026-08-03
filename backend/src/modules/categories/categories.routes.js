const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const categoriesService = require('./categories.service');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { AppError } = require('../../middlewares/errorHandler');

const router = Router();

router.use(requireAuth, requireActiveStore);

router.get('/', async (req, res, next) => {
  try {
    const categories = await categoriesService.listCategories(req.auth.storeId);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  requireRole('OWNER'),
  [body('name').trim().notEmpty().withMessage('Le nom de la catégorie est requis.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const category = await categoriesService.createCategory(req.auth.storeId, req.body);
      res.status(201).json(category);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;