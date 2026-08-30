-- ============================================================================
-- 46_transfert_stock_plan.sql
-- Domaine : Transfert de stock (§45_transfert_de_stock.sql), réservé aux
-- plans STANDARD et PROFESSIONNEL, décidé en conversation.
-- ============================================================================
-- `allows_stock_transfer` : même mécanisme exact que allows_supervision /
-- allows_suppliers / allows_purchase_orders (20_plans_abonnement.sql,
-- 28_commandes_achat_premium.sql) — un booléen par plan, vérifié à chaque
-- requête via getEffectivePlan (jamais mis en cache), middleware
-- `requirePlanFeature` réutilisé tel quel. FALSE par défaut pour tous les
-- plans existants (donc FREEMIUM reste exclu), activé explicitement pour
-- STANDARD et PROFESSIONNEL ci-dessous.
-- ============================================================================

ALTER TABLE subscription_plans ADD COLUMN allows_stock_transfer BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE subscription_plans SET allows_stock_transfer = TRUE WHERE name IN ('STANDARD', 'PROFESSIONNEL');
