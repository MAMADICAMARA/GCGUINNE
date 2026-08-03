const { validationResult } = require('express-validator');
const stockService = require('./stock.service');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Contrôleur — Gestion des mouvements de stock
 * Traite les requêtes HTTP pour les opérations de stock
 */

// ============================================================================
// POST /stock/movements — Enregistrer un mouvement de stock
// ============================================================================
async function recordMovement(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.user;
    const {
      productId,
      type,
      quantity,
      unitCost,
      referenceTable,
      referenceId,
      note,
    } = req.body;

    const movement = await stockService.recordMovement(productId, type, quantity, {
      unitCost,
      referenceTable,
      referenceId,
      userId,
      note,
    });

    res.status(201).json({
      success: true,
      message: 'Mouvement de stock enregistré',
      movement,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET /stock/history/:productId — Récupérer l'historique stock
// ============================================================================
async function getStockHistory(req, res, next) {
  try {
    const { productId } = req.params;
    const {
      type,
      startDate,
      endDate,
      limit = 100,
    } = req.query;

    const history = await stockService.getStockHistory(parseInt(productId, 10), {
      type,
      startDate,
      endDate,
      limit: Math.min(parseInt(limit, 10) || 100, 500),
    });

    res.json({
      success: true,
      count: history.length,
      movements: history,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// GET /stock/summary — Résumé du stock par type (statistiques)
// ============================================================================
async function getStockSummary(req, res, next) {
  try {
    const { storeId } = req.user;

    const summary = await stockService.getStockSummary(storeId);

    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// POST /stock/verify — Vérifier la disponibilité du stock
// ============================================================================
async function verifyStockAvailable(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantity } = req.body;

    try {
      await stockService.verifyStockAvailable(parseInt(productId, 10), quantity);
      res.json({
        success: true,
        available: true,
        message: 'Stock suffisant',
      });
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 409) {
        return res.status(409).json({
          success: false,
          available: false,
          message: error.message,
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// POST /stock/adjust — Effectuer un ajustement d'inventaire
// ============================================================================
async function adjustStock(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { productId, quantityDelta, note } = req.body;

    const movement = await stockService.adjustStock(
      parseInt(productId, 10),
      parseInt(quantityDelta, 10),
      note
    );

    res.status(201).json({
      success: true,
      message: 'Ajustement d\'inventaire enregistré',
      movement,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  recordMovement,
  getStockHistory,
  getStockSummary,
  verifyStockAvailable,
  adjustStock,
};
