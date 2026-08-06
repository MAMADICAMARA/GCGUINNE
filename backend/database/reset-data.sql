-- ============================================================================
-- reset-data.sql
-- Vide TOUTES les données de test, en gardant intact :
--   - le schéma (tables, contraintes, triggers, index)
--   - les tables de référence/configuration plateforme : roles,
--     subscription_plans, store_types, store_type_categories,
--     platform_payment_settings, schema_migrations
--   - UN SEUL compte utilisateur : le SuperAdmin réel désigné ci-dessous
--     (jamais un compte de test) — tous les autres comptes, y compris les
--     autres SuperAdmin de test, sont supprimés.
--
-- Mis à jour le 2026-08-06 : la version précédente référençait des tables
-- renommées depuis (purchases/purchase_items/suppliers →
-- purchase_orders/purchase_order_items/supplier_contacts, cf. migration 28)
-- et était donc obsolète — corrigée pour refléter le schéma réel.
--
-- Ordre des opérations important : `users` n'est PAS tronquée avec le
-- reste — TRUNCATE viderait aussi le SuperAdmin à garder. À la place,
-- toutes les autres tables sont vidées D'ABORD (via TRUNCATE, qui
-- contourne les triggers d'immuabilité de system_logs/order_items/
-- stock_movements — ces triggers ne réagissent qu'aux UPDATE/DELETE ligne
-- par ligne, jamais à TRUNCATE), PUIS les utilisateurs superflus sont
-- retirés par un DELETE ciblé — à ce stade, plus aucune table ne référence
-- ces comptes (stores, user_store, system_logs... déjà vides), donc ni
-- contrainte RESTRICT (stores.owner_id) ni trigger d'immuabilité
-- (system_logs.user_id ON DELETE SET NULL) ne peut plus bloquer l'opération.
--
-- ⚠️ IRRÉVERSIBLE. Sauvegarde recommandée avant exécution :
--   "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" "postgresql://postgres:MOT_DE_PASSE@localhost:5432/MonApplication" -f sauvegarde_avant_reset.sql
-- ============================================================================

-- Adresse du SEUL compte à conserver — à vérifier/adapter avant exécution.
-- (Utilisé deux fois plus bas : ne le changer qu'à un seul endroit ne suffit
-- pas, penser aux deux occurrences si cette adresse doit changer.)

TRUNCATE TABLE
  cash_drawers,
  categories,
  customer_payments,
  customers,
  invoices,
  order_items,
  orders,
  product_price_tiers,
  products,
  purchase_order_items,
  purchase_orders,
  stock_movements,
  stock_transfers,
  store_invitations,
  store_notes,
  store_supervisors,
  store_supplier_links,
  store_supplier_product_links,
  stores,
  subscription_payment_requests,
  supplier_contacts,
  system_logs,
  user_store,
  user_verification_codes
RESTART IDENTITY CASCADE;

-- Retire tous les comptes SAUF le SuperAdmin désigné — possible seulement
-- maintenant que plus aucune table ci-dessus ne les référence.
DELETE FROM users WHERE email != 'mamadicamara566@gmail.com';

-- Vérification : les tables de référence/config doivent être intactes, et
-- users ne doit contenir plus qu'une seule ligne (le SuperAdmin conservé).
SELECT 'roles' AS table_name, COUNT(*) AS count FROM roles
UNION ALL
SELECT 'subscription_plans', COUNT(*) FROM subscription_plans
UNION ALL
SELECT 'store_types', COUNT(*) FROM store_types
UNION ALL
SELECT 'store_type_categories', COUNT(*) FROM store_type_categories
UNION ALL
SELECT 'platform_payment_settings', COUNT(*) FROM platform_payment_settings
UNION ALL
SELECT 'users (doit être 1)', COUNT(*) FROM users;
