const { Router } = require('express');
const { body, validationResult } = require('express-validator');
const storesService = require('./stores.service');
const { requireAuth, requireActiveStore, requireRole } = require('../../middlewares/auth');
const { getEffectivePlan } = require('../../utils/planContext');
const { listStoreAuditLog } = require('../../utils/auditLog');
const { AppError } = require('../../middlewares/errorHandler');
const { listStoreTypes } = require('../admin/admin.service');

const router = Router();

// Important : ces routes n'utilisent PAS requireActiveStore. C'est
// précisément ici qu'un compte sans boutique doit pouvoir agir (lister ses
// boutiques — vide au départ — puis en créer une première).
router.use(requireAuth);

router.get('/mine', async (req, res, next) => {
  try {
    const stores = await storesService.listMyStores(req.auth.userId);
    res.json({ stores });
  } catch (err) {
    next(err);
  }
});

// Référentiel en LECTURE pour tout utilisateur connecté (pas réservé au
// Super Admin, contrairement à /admin/store-types) — nécessaire pour
// remplir la liste déroulante au moment de créer une boutique.
router.get('/types', async (req, res, next) => {
  try {
    const storeTypes = await listStoreTypes();
    res.json({ storeTypes });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/',
  [
    body('name').trim().notEmpty().withMessage('Le nom de la boutique est requis.'),
    body('storeTypeId').isInt().withMessage('Le type de boutique est requis.'),
    body('region').optional({ checkFalsy: true }).trim(),
    body('city').optional({ checkFalsy: true }).trim(),
    body('address').optional({ checkFalsy: true }).trim(),
    body('phone').optional({ checkFalsy: true }).trim(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.createStore(req.auth.userId, req.body);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Personnalisation du reçu (§23_personnalisation_recu.sql) — réservé
// au Owner, comme les autres réglages de la boutique active.
router.get('/receipt-settings', requireActiveStore, requireRole('OWNER'), async (req, res, next) => {
  try {
    const [settings, store] = await Promise.all([
      storesService.getReceiptSettings(req.auth.storeId),
      storesService.getStoreContactInfo(req.auth.storeId),
    ]);
    res.json({ ...settings, store });
  } catch (err) {
    next(err);
  }
});

router.put(
  '/receipt-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [
    body('headerMessage').optional({ checkFalsy: true }).isString().isLength({ max: 200 }),
    body('footerMessage').optional({ checkFalsy: true }).isString().isLength({ max: 200 }),
    body('showAddress').optional().isBoolean(),
    body('showPhone').optional().isBoolean(),
    body('showSellerName').optional().isBoolean(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError('Réglages de reçu invalides.', 422, 'VALIDATION_ERROR');
      }
      const settings = await storesService.updateReceiptSettings(req.auth.storeId, req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }
);

// --- Type de boutique de la boutique ACTIVE (§ cahier des charges types
// de boutique) — réservé au Owner, pour les boutiques créées avant cette
// fonctionnalité (ou pour changer d'avis ensuite).
router.get('/type', requireActiveStore, requireRole('OWNER'), async (req, res, next) => {
  try {
    const result = await storesService.getStoreType(req.auth.storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/type',
  requireActiveStore,
  requireRole('OWNER'),
  [body('storeTypeId').isInt().withMessage('Le type de boutique est requis.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.adoptStoreType(req.auth.storeId, req.body.storeTypeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Code de supervision de la boutique ACTIVE (§12_supervision.sql) ---
// Réservé au Owner : c'est lui qui décide de partager (ou non) une vue en
// lecture seule de sa boutique à un tiers.
router.get(
  '/supervision-code',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getSupervisionCode(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/supervision-code/regenerate',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.regenerateSupervisionCode(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Code fournisseur de la boutique ACTIVE (§18_fournisseurs_inter_boutiques.sql) ---
// Réservé au Owner, même logique que le code de supervision ci-dessus :
// c'est lui qui décide de partager (ou non) l'accès en lecture à son
// catalogue produit à une autre boutique.
router.get(
  '/supplier-code',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getSupplierCode(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/supplier-code/regenerate',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.regenerateSupplierCode(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Bandeau d'alerte "mode gratuit" (§20_plans_abonnement.sql) ---
// Accessible à TOUTE l'équipe (pas requireRole('OWNER')) : un Vendeur
// gelé doit lui aussi comprendre pourquoi il ne peut plus agir.
router.get('/plan-banner', requireActiveStore, async (req, res, next) => {
  try {
    const result = await storesService.getPlanBanner(req.auth.storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// --- Statut de l'abonnement de la boutique ACTIVE (§20_plans_abonnement.sql) ---
// Réservé au Owner : visibilité en lecture seule du plan effectif et de sa
// date d'expiration — la gestion (activer/renouveler/désactiver) reste
// exclusivement manuelle et réservée au Super Admin (cf. admin.routes.js).
router.get(
  '/plan-status',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const plan = await getEffectivePlan(req.auth.storeId);
      res.json(plan);
    } catch (err) {
      next(err);
    }
  }
);

// --- Journal d'activité de la boutique ACTIVE (§ décidé en conversation,
// en même temps que la supervision enrichie) --- Réservé au Owner : voir
// ce que font ses employés (ventes, annulations, ajustements de stock...),
// lecture seule stricte (system_logs est immuable au niveau base).
router.get(
  '/audit-log',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await listStoreAuditLog(req.auth.storeId, req.query);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;