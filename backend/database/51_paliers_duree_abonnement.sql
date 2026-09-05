-- ============================================================================
-- 51_paliers_duree_abonnement.sql
-- Domaine : Paiement d'abonnement sur plusieurs mois + paliers dégressifs
--           par durée
-- ============================================================================
-- Décidé en conversation : le Owner peut payer plusieurs mois (ou une année)
-- d'un coup plutôt que mois par mois, et le Super Admin configure des
-- remises selon la durée choisie — miroir EXACT de
-- 31_prix_degressif_grossiste.sql (product_price_tiers), appliqué à la
-- durée d'abonnement au lieu de la quantité de produit.
--
-- subscription_plans.price reste le prix "1 mois" (comme
-- products.selling_price est le prix "1 unité") — un palier à
-- min_months = 1 n'a donc pas de sens, même raison que min_quantity > 1
-- côté produits : ce cas est déjà couvert par le prix de base.
--
-- La validation "le prix par mois baisse strictement à mesure que la durée
-- minimum augmente" et "aucun palier ne dépasse le prix de base" est faite
-- côté service (admin.service.js), jamais en base — même convention que
-- product_price_tiers.
-- ============================================================================

CREATE TABLE subscription_plan_duration_tiers (
  id          SERIAL PRIMARY KEY,
  plan_id     INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE CASCADE,
  min_months  INTEGER NOT NULL CHECK (min_months > 1),
  unit_price  NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0), -- prix / mois à partir de min_months
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_subscription_plan_duration_tiers UNIQUE (plan_id, min_months)
);

CREATE INDEX idx_subscription_plan_duration_tiers_plan ON subscription_plan_duration_tiers (plan_id);

-- Nombre de mois payés par une demande (§27_paiement_abonnement.sql).
-- DEFAULT 1 = comportement actuel inchangé pour toute demande déjà
-- soumise/existante.
ALTER TABLE subscription_payment_requests
  ADD COLUMN months INTEGER NOT NULL DEFAULT 1 CHECK (months >= 1);
