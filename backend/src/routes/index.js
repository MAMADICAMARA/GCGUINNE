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
router.use('/admin', require('../modules/admin/admin.routes'));
router.use('/employees', require('../modules/employees/employees.routes'));
router.use('/dashboard', require('../modules/dashboard/dashboard.routes'));
router.use('/supervision', require('../modules/supervision/supervision.routes'));
router.use('/customers', require('../modules/customers/customers.routes'));
router.use('/suppliers', require('../modules/suppliers/suppliers.routes'));
router.use('/notes', require('../modules/notes/notes.routes'));
router.use('/subscription-payments', require('../modules/subscriptionPayments/subscriptionPayments.routes'));

// router.use('/users', require('../modules/users/users.routes'));
// ----------------------------------------------------------------------

module.exports = router;