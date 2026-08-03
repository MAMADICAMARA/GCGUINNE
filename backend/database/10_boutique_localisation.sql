-- ============================================================================
-- 10_boutique_localisation.sql
-- Domaine : Localisation précise de la boutique
-- ============================================================================
-- Pays, ville, adresse et téléphone existent déjà dans stores depuis
-- 01_plateforme_et_comptes.sql (jamais exploités jusqu'ici dans le
-- formulaire de création). Seule la région administrative est nouvelle.
-- ============================================================================

ALTER TABLE stores
  ADD COLUMN region VARCHAR(100);

CREATE INDEX idx_stores_region ON stores (region);