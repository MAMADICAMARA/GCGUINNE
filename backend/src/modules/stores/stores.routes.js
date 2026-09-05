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

// Réactivation d'une boutique désactivée par son propre Owner
// (§53_desactivation_boutique.sql, décidé en conversation). Doit rester
// hors de requireActiveStore, comme /mine et POST / ci-dessus : une
// boutique désactivée n'est jamais sélectionnable comme boutique active,
// donc cette action ne peut pas en dépendre. L'appartenance est vérifiée
// dans le service via owner_id = userId, pas via un rôle de boutique active.
router.post('/:storeId/reactivate', async (req, res, next) => {
  try {
    const storeId = parseInt(req.params.storeId, 10);
    if (!Number.isInteger(storeId)) {
      throw new AppError('Boutique invalide.', 400, 'VALIDATION_ERROR');
    }
    const result = await storesService.reactivateOwnStore(storeId, req.auth.userId);
    res.json(result);
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

// --- Facturation (§42_facturation_boutique.sql, décidé en conversation) —
// taux de taxe par défaut, informations légales, numérotation de facture
// dédiée. Réservé au Owner, comme les autres réglages de la boutique.
router.get('/billing-settings', requireActiveStore, requireRole('OWNER'), async (req, res, next) => {
  try {
    const settings = await storesService.getBillingSettings(req.auth.storeId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/billing-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [
    body('defaultTaxPercent').isFloat({ min: 0, max: 100 }).withMessage('Taux de taxe invalide (0 à 100).'),
    body('legalRccm').optional({ checkFalsy: true }).isString().isLength({ max: 60 }),
    body('legalNif').optional({ checkFalsy: true }).isString().isLength({ max: 60 }),
    body('legalTaxRegime').optional({ checkFalsy: true }).isString().isLength({ max: 60 }),
    body('invoiceNumberingEnabled').optional().isBoolean(),
    body('invoicePrefix').optional({ checkFalsy: true }).isString().isLength({ max: 20 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const settings = await storesService.updateBillingSettings(req.auth.storeId, req.body);
      res.json(settings);
    } catch (err) {
      next(err);
    }
  }
);

// --- Informations générales de la boutique ACTIVE (§ décidé en
// conversation) — nom, adresse, téléphone, région, ville, pays,
// modifiables après création par le Owner (le type de boutique reste à
// part, voir /type ci-dessous : lui seul est définitif une fois choisi).
router.get('/info', requireActiveStore, requireRole('OWNER'), async (req, res, next) => {
  try {
    const result = await storesService.getStoreInfo(req.auth.storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/info',
  requireActiveStore,
  requireRole('OWNER'),
  [
    body('name').trim().notEmpty().withMessage('Le nom de la boutique est requis.'),
    body('phone').trim().notEmpty().withMessage('Le numéro de la boutique est requis.'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateStoreInfo(req.auth.storeId, req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Logo de la boutique (§ cahier des charges "Upload et stockage réel
// des images", décidé en conversation) — réservé au Owner, comme les
// autres réglages de la boutique active.
router.get('/logo', requireActiveStore, requireRole('OWNER'), async (req, res, next) => {
  try {
    const result = await storesService.getStoreLogo(req.auth.storeId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.put(
  '/logo',
  requireActiveStore,
  requireRole('OWNER'),
  [body('logoUrl').optional({ checkFalsy: true }).isURL().withMessage('Lien du logo invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateStoreLogo(req.auth.storeId, req.body.logoUrl);
      res.json(result);
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

// --- Code de transfert de la boutique ACTIVE (§45_transfert_de_stock.sql) ---
// Réservé au Owner, même logique que les deux codes ci-dessus : c'est lui
// qui décide de partager (ou non) la possibilité de lui envoyer du stock.
router.get(
  '/transfer-code',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getTransferCode(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/transfer-code/regenerate',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.regenerateTransferCode(req.auth.storeId);
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
// date d'expiration — l'activation/le renouvellement/la suspension
// restent exclusivement manuels et réservés au Super Admin (cf.
// admin.routes.js), à l'exception de la désactivation VOLONTAIRE par
// l'Owner lui-même ci-dessous (§53_desactivation_boutique.sql).
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

// --- Désactivation volontaire de la boutique ACTIVE par son Owner
// (§53_desactivation_boutique.sql, décidé en conversation) — le seul
// moyen de libérer son "poste" d'Owner (par ex. pour rejoindre une autre
// boutique comme Vendeur). Voir POST /:storeId/reactivate plus haut pour
// le chemin inverse.
router.post(
  '/deactivate',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.deactivateOwnStore(req.auth.storeId, req.auth.userId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// --- Autorisation d'annulation/retour de vente par un Vendeur
// (§25_autorisation_annulation_retour.sql, décidé en conversation) ---
router.get(
  '/void-return-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getVoidReturnSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/void-return-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateVoidReturnSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe (pas requireRole('OWNER')) — c'est ce que le
// Vendeur interroge lui-même pour savoir s'il voit "Historique des ventes"
// dans son menu. Ne renvoie qu'un booléen, jamais le détail du réglage.
router.get('/my-void-return-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserVoidReturn(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

// --- Prix de vente modifiable à la Caisse par un Vendeur
// (§39_prix_editable_vente.sql, décidé en conversation) — même schéma
// exact que l'autorisation d'annulation/retour ci-dessus.
router.get(
  '/edit-price-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getEditPriceSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/edit-price-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateEditPriceSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe — c'est ce que le Vendeur interroge lui-même
// pour savoir s'il peut modifier le prix à la Caisse.
router.get('/my-edit-price-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserEditPrice(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

// --- Ajout de produit par un Vendeur (§40_autorisation_ajout_produit.sql,
// décidé en conversation) — même schéma exact que les deux autorisations
// ci-dessus.
router.get(
  '/add-product-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getAddProductSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/add-product-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateAddProductSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe — c'est ce que le Vendeur interroge lui-même
// pour savoir s'il peut ajouter un produit.
router.get('/my-add-product-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserAddProduct(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

// --- Ajustement de stock par un Vendeur (§43_autorisation_stock_
// fournisseurs_achats.sql, décidé en conversation) — même schéma exact que
// les trois autorisations ci-dessus. La consultation du stock (GET
// /products, /products/:id/stock-history) reste ouverte à tout vendeur,
// indépendamment de ce réglage.
router.get(
  '/stock-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getStockSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/stock-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateStockSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe — c'est ce que le Vendeur interroge lui-même
// pour savoir s'il voit "Stock" dans son menu et peut ajuster une quantité.
router.get('/my-stock-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserManageStock(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

// --- Accès au module Fournisseurs par un Vendeur (§43_autorisation_stock_
// fournisseurs_achats.sql, décidé en conversation) — jusqu'ici
// intégralement réservé au Owner (aucun accès même en lecture) ; un
// vendeur autorisé voit le module exactement comme le Owner.
router.get(
  '/suppliers-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getSuppliersSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/suppliers-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updateSuppliersSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe — c'est ce que le Vendeur interroge lui-même
// pour savoir s'il voit "Fournisseurs" dans son menu.
router.get('/my-suppliers-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserManageSuppliers(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

// --- Accès au module Achats par un Vendeur (§43_autorisation_stock_
// fournisseurs_achats.sql, décidé en conversation) — même schéma exact que
// Fournisseurs ci-dessus. La restriction PREMIUM sur la création
// (§28_commandes_achat_premium.sql) reste entièrement séparée et
// s'applique de la même façon à un vendeur autorisé qu'au Owner.
router.get(
  '/purchases-settings',
  requireActiveStore,
  requireRole('OWNER'),
  async (req, res, next) => {
    try {
      const result = await storesService.getPurchasesSettings(req.auth.storeId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/purchases-settings',
  requireActiveStore,
  requireRole('OWNER'),
  [body('allowAllSellers').isBoolean().withMessage('Valeur invalide.')],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        throw new AppError(errors.array()[0].msg, 422, 'VALIDATION_ERROR');
      }
      const result = await storesService.updatePurchasesSettings(
        req.auth.storeId,
        req.body.allowAllSellers,
        req.auth.userId
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// Accessible à TOUTE l'équipe — c'est ce que le Vendeur interroge lui-même
// pour savoir s'il voit "Achats" dans son menu.
router.get('/my-purchases-permission', requireActiveStore, async (req, res, next) => {
  try {
    const allowed = await storesService.canUserManagePurchases(
      req.auth.storeId,
      req.auth.userId,
      req.auth.roleCode
    );
    res.json({ allowed });
  } catch (err) {
    next(err);
  }
});

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