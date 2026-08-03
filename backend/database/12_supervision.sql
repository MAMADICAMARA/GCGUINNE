-- ============================================================================
-- 12_supervision.sql
-- Domaine : Supervision en lecture seule de boutiques gérées par des tiers
-- ============================================================================
-- Contexte métier (décidé en conversation) : un propriétaire multi-boutiques
-- veut voir l'activité de boutiques qu'il NE possède PAS lui-même (gérées
-- par un tiers), sans aucun droit d'action dessus — juste une vue.
--
-- Le rattachement se fait via un CODE DE PARTAGE aléatoire et non-devinable
-- (jamais l'identifiant numérique brut de la boutique, qui serait énumérable
-- et donc une fuite de données pour toute la plateforme).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Code de partage, propre à chaque boutique, régénérable par son
-- propriétaire depuis les paramètres.
-- ----------------------------------------------------------------------------
ALTER TABLE stores ADD COLUMN supervision_code VARCHAR(20);

-- Backfill des boutiques déjà existantes (le cas échéant) avec un code
-- aléatoire, pour que la colonne puisse ensuite devenir NOT NULL + UNIQUE.
UPDATE stores
SET supervision_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FOR 12))
WHERE supervision_code IS NULL;

ALTER TABLE stores ALTER COLUMN supervision_code SET NOT NULL;
ALTER TABLE stores ADD CONSTRAINT uq_stores_supervision_code UNIQUE (supervision_code);

-- ----------------------------------------------------------------------------
-- STORE_SUPERVISORS — qui supervise quelle boutique, en lecture seule.
-- Table volontairement séparée de user_store : la supervision ne porte
-- AUCUN droit d'action (pas de caisse, pas de gestion produit/équipe) et
-- n'est jamais soumise à la règle d'exclusivité "une seule boutique à la
-- fois" (qui ne concerne que les rôles opérationnels Manager/Vendeur).
-- ----------------------------------------------------------------------------
CREATE TABLE store_supervisors (
  id                   SERIAL PRIMARY KEY,
  store_id             INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supervisor_user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_store_supervisor UNIQUE (store_id, supervisor_user_id)
);

CREATE INDEX idx_store_supervisors_supervisor ON store_supervisors (supervisor_user_id);