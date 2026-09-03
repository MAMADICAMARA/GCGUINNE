const { Router } = require('express');

const router = Router();

/**
 * Vérification de disponibilité du service (health check).
 * Utilisé par les orchestrateurs / superviseurs, ne doit jamais dépendre
 * d'une ressource lourde (ex. requête base de données complexe).
 */
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ----------------------------------------------------------------------
// Modules métiers — montés au fur et à mesure de leur implémentation,
// en respectant l'ordre de priorité du cahier des charges (P0 -> P3) :
router.use('/auth', require('../modules/auth/auth.routes'));
router.use('/stores', require('../modules/stores/stores.routes'));
router.use('/orders', require('../modules/orders/orders.routes'));
router.use('/products', require('../modules/products/products.routes'));
router.use('/categories', require('../modules/categories/categories.routes'));
// Monté AVANT le '/admin' générique juste en dessous — un préfixe plus
// spécifique doit toujours être enregistré en premier, jamais compté sur
// la retombée (fallthrough) d'un routeur générique qui ne trouverait pas
// de route correspondante (fragile si ce dernier gagne un jour une route
// générique/wildcard).
router.use('/admin/app-versions', require('../modules/appVersions/appVersions.admin.routes'));
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/employees', require('../modules/employees/employees.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/supervision', require('../modules/supervision/supervision.routes'));
router.use('/customers', require('../modules/customers/customers.routes'));
router.use('/suppliers', require('../modules/suppliers/suppliers.routes'));
router.use('/notes', require('../modules/notes/notes.routes'));
router.use('/subscription-payments', require('../modules/subscriptionPayments/subscriptionPayments.routes'));
router.use('/purchases', require('../modules/purchases/purchases.routes'));
router.use('/cash-drawers', require('../modules/cashDrawers/cashDrawers.routes'));
router.use('/uploads', require('../modules/uploads/uploads.routes'));
router.use('/contact', require('../modules/contact/contact.routes'));
router.use('/marketplace', require('../modules/marketplace/marketplace.routes'));
router.use('/stock-transfers', require('../modules/stockTransfers/stockTransfers.routes'));
// /app/version est PUBLIC (pas de requireAuth) — seule source de vérité
// pour l'app Flutter ET la page web publique /telecharger (décidé en
// conversation). Le pendant Super Admin (/admin/app-versions) est monté
// plus haut, avec le reste des préfixes /admin/*.
router.use('/app', require('../modules/appVersions/appVersions.public.routes'));
// ----------------------------------------------------------------------

module.exports = router;