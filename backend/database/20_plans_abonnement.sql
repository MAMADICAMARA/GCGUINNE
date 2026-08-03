-- ============================================================================
-- 20_plans_abonnement.sql
-- Domaine : Application réelle des plans d'abonnement (P2 → activé)
-- ============================================================================
-- Décidé en conversation, après analyse approfondie :
--  - max_stores n'a plus de sens : un Owner ne peut posséder qu'une seule
--    boutique (contrainte déjà en place) — le multi-boutique par
--    propriétaire a été remplacé par "Superviser" (§12_supervision.sql).
--  - Le JSONB `features` ne correspondait à aucune fonctionnalité réelle du
--    code (cash_drawer/multi_seller/stock_transfer/consolidated_dashboard
--    n'étaient vérifiés nulle part). Remplacé par des colonnes booléennes
--    explicites, correspondant aux deux capacités réellement gérables par
--    un plan aujourd'hui : Superviser et Fournisseurs.
--  - Gestion 100% manuelle par le Super Admin (pas de facturation
--    automatisée) : une simple date d'expiration sur la boutique suffit,
--    pas de statut d'abonnement séparé à synchroniser.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- subscription_plans — abandon de max_stores/features, ajout des capacités
-- réelles.
-- ----------------------------------------------------------------------------
ALTER TABLE subscription_plans DROP COLUMN max_stores;
ALTER TABLE subscription_plans DROP COLUMN features;

ALTER TABLE subscription_plans ADD COLUMN allows_supervision BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE subscription_plans ADD COLUMN allows_suppliers   BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE subscription_plans SET max_users_per_store = 1,  allows_supervision = FALSE, allows_suppliers = FALSE WHERE name = 'FREEMIUM';
UPDATE subscription_plans SET max_users_per_store = 5,  allows_supervision = TRUE,  allows_suppliers = TRUE  WHERE name = 'STANDARD';
UPDATE subscription_plans SET max_users_per_store = 15, allows_supervision = TRUE,  allows_suppliers = TRUE  WHERE name = 'PREMIUM';

-- ----------------------------------------------------------------------------
-- stores — date d'expiration du plan payant. NULL = pas d'expiration à
-- suivre (boutique en FREEMIUM, gratuite par nature). Le "plan effectif"
-- d'une boutique se calcule à la volée (plan_id si non expiré, sinon
-- FREEMIUM) — jamais une valeur mise en cache côté token JWT.
-- ----------------------------------------------------------------------------
ALTER TABLE stores ADD COLUMN plan_expires_at TIMESTAMPTZ;
