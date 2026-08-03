-- ============================================================================
-- drop_all.sql
-- Supprime l'intégralité des tables, triggers et fonctions du schéma.
-- ⚠️  USAGE STRICTEMENT RÉSERVÉ À L'ENVIRONNEMENT DE DÉVELOPPEMENT.
--     Cette opération est irréversible et détruit toutes les données.
-- ============================================================================

DROP TABLE IF EXISTS invoices          CASCADE;
DROP TABLE IF EXISTS system_logs       CASCADE;
DROP TABLE IF EXISTS stock_transfers   CASCADE;
DROP TABLE IF EXISTS cash_drawers      CASCADE;
DROP TABLE IF EXISTS purchase_items    CASCADE;
DROP TABLE IF EXISTS purchases         CASCADE;
DROP TABLE IF EXISTS suppliers         CASCADE;
DROP TABLE IF EXISTS order_items       CASCADE;
DROP TABLE IF EXISTS orders            CASCADE;
DROP TABLE IF EXISTS customers         CASCADE;
DROP TABLE IF EXISTS stock_movements   CASCADE;
DROP TABLE IF EXISTS products          CASCADE;
DROP TABLE IF EXISTS categories        CASCADE;
DROP TABLE IF EXISTS user_store        CASCADE;
DROP TABLE IF EXISTS stores            CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS users             CASCADE;
DROP TABLE IF EXISTS roles             CASCADE;

DROP FUNCTION IF EXISTS update_cash_drawer_expected_balance() CASCADE;
DROP FUNCTION IF EXISTS prevent_order_item_core_update()      CASCADE;
DROP FUNCTION IF EXISTS prevent_update_delete()                CASCADE;
DROP FUNCTION IF EXISTS prevent_delete()                       CASCADE;
DROP FUNCTION IF EXISTS set_updated_at()                       CASCADE;
