-- ============================================================================
-- 38_marketplace.sql
-- Domaine : Page publique "MARCHÉ" (catalogue multi-boutiques Premium)
-- ============================================================================
-- Décidé en conversation : catalogue public regroupant les produits de
-- toutes les boutiques dont le plan effectif le permet — construit
-- maintenant, désactivé par défaut (interrupteur plateforme), activable
-- plus tard par le Super Admin.
--
-- ----------------------------------------------------------------------------
-- PLATFORM_SETTINGS — interrupteurs plateforme génériques (clé/valeur),
-- volontairement conçue pour en accueillir d'autres à l'avenir, pas
-- seulement celui-ci.
-- ----------------------------------------------------------------------------
CREATE TABLE platform_settings (
  key    VARCHAR(50) PRIMARY KEY,
  value  BOOLEAN NOT NULL DEFAULT FALSE
);

INSERT INTO platform_settings (key, value) VALUES ('marketplace_enabled', FALSE);

-- ----------------------------------------------------------------------------
-- subscription_plans.allows_marketplace — même principe que
-- allows_supervision / allows_suppliers / allows_purchase_orders
-- (§20_plans_abonnement.sql, §28_commandes_achat_premium.sql) : jamais une
-- boutique identifiée par le NOM de son plan (renommable depuis Admin >
-- Plans, cf. le bug déjà corrigé sur le plan gratuit identifié à tort par
-- son nom), toujours par une capacité explicite attachée au plan. FALSE
-- par défaut pour tous les plans existants — le Super Admin l'active
-- explicitement sur le plan de son choix (aujourd'hui PROFESSIONNEL).
-- ----------------------------------------------------------------------------
ALTER TABLE subscription_plans ADD COLUMN allows_marketplace BOOLEAN NOT NULL DEFAULT FALSE;
