-- ============================================================================
-- reset-data.sql
-- Vide TOUTES les données de test, en gardant intact :
--   - le schéma (tables, contraintes, triggers, index)
--   - les tables de référence : roles, subscription_plans
--
-- À utiliser avant un vrai lancement, pour repartir avec une base propre
-- sans avoir à rejouer les migrations 00 → 15.
--
-- ⚠️ IRRÉVERSIBLE. Faire une sauvegarde avant si le moindre doute :
--   pg_dump "postgresql://..." -f sauvegarde_avant_reset.sql
-- ============================================================================

TRUNCATE TABLE
  store_notes,
  store_supplier_links,
  store_supervisors,
  store_invitations,
  invoices,
  system_logs,
  stock_transfers,
  cash_drawers,
  purchase_items,
  purchases,
  suppliers,
  order_items,
  orders,
  customers,
  stock_movements,
  products,
  categories,
  user_store,
  stores,
  users
RESTART IDENTITY CASCADE;

-- Vérification : roles et subscription_plans doivent toujours contenir
-- leurs valeurs de référence (4 rôles, 3 plans).
SELECT 'roles' AS table_name, COUNT(*) AS count FROM roles
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM subscription_plans;