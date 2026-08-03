const { Router } = require('express');
const { body, query, param } = require('express-validator');
const controller = require('./stock.controller');
const { requireAuth } = require('../../middlewares/auth');

const router = Router();

/**
 * Routes — Gestion des mouvements de stock
 * Base: /api/v1/stock
 * Cahier des charges §4.5 — Historique immuable des variations de stock
 */

// Middlewares de validation partagés
const validateRecordMovement = [
  body('productId')
    .notEmpty()
    .withMessage('L\'ID du produit est obligatoire')
    .isInt()
    .withMessage('L\'ID du produit doit être un entier'),

  body('type')
    .notEmpty()
    .withMessage('Le type de mouvement est obligatoire')
    .isIn(['PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT', 'TRANSFER_OUT', 'TRANSFER_IN'])
    .withMessage('Type de mouvement invalide'),

  body('quantity')
    .notEmpty()
    .withMessage('La quantité est obligatoire')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être un entier > 0'),

  body('unitCost')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le coût unitaire doit être un nombre >= 0'),

  body('referenceTable')
    .optional()
    .trim()
    .isLength({ max: 30 })
    .withMessage('referenceTable ne doit pas dépasser 30 caractères'),

  body('referenceId')
    .optional()
    .isInt()
    .withMessage('referenceId doit être un entier'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La note ne doit pas dépasser 500 caractères'),
];

const validateVerifyStock = [
  body('productId')
    .notEmpty()
    .withMessage('L\'ID du produit est obligatoire')
    .isInt()
    .withMessage('L\'ID du produit doit être un entier'),

  body('quantity')
    .notEmpty()
    .withMessage('La quantité est obligatoire')
    .isInt({ min: 1 })
    .withMessage('La quantité doit être un entier > 0'),
];

const validateAdjustStock = [
  body('productId')
    .notEmpty()
    .withMessage('L\'ID du produit est obligatoire')
    .isInt()
    .withMessage('L\'ID du produit doit être un entier'),

  body('quantityDelta')
    .notEmpty()
    .withMessage('L\'écart de quantité est obligatoire')
    .isInt()
    .withMessage('L\'écart doit être un entier (+ ou -)'),

  body('note')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('La note ne doit pas dépasser 500 caractères'),
];

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /stock/movements — Enregistrer un mouvement de stock
 * Requête: {productId, type, quantity, unitCost?, referenceTable?, referenceId?, note?}
 * Types: PURCHASE_IN, SALE_OUT, RETURN_IN, ADJUSTMENT, TRANSFER_OUT, TRANSFER_IN
 * Réponse: {success, message, movement}
 */
router.post('/movements', requireAuth, validateRecordMovement, controller.recordMovement);

/**
 * GET /stock/history/:productId — Récupérer l'historique stock
 * Query: ?type=SALE_OUT&startDate=2024-01-01&endDate=2024-01-31&limit=100
 * Réponse: {success, count, movements: [{id, type, quantity, created_at, ...}]}
 */
router.get(
  '/history/:productId',
  requireAuth,
  param('productId').isInt().withMessage('L\'ID du produit doit être un entier'),
  controller.getStockHistory
);

/**
 * GET /stock/summary — Résumé du stock par type (statistiques)
 * Réponse: {success, summary: {PURCHASE_IN: {count, totalQty, totalCost}, ...}}
 */
router.get('/summary', requireAuth, controller.getStockSummary);

/**
 * POST /stock/verify — Vérifier la disponibilité du stock
 * Requête: {productId, quantity}
 * Réponse: {success, available: true|false, message}
 */
router.post('/verify', requireAuth, validateVerifyStock, controller.verifyStockAvailable);

/**
 * POST /stock/adjust — Effectuer un ajustement d'inventaire
 * Requête: {productId, quantityDelta (+/-), note?}
 * Réponse: {success, message, movement}
 */
router.post('/adjust', requireAuth, validateAdjustStock, controller.adjustStock);

module.exports = router;
