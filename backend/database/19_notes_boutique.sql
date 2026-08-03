-- ============================================================================
-- 19_notes_boutique.sql
-- Domaine : Bloc-note partagé de la boutique
-- ============================================================================
-- Contexte métier (décidé en conversation) : un carnet de notes libres sur
-- l'activité de la boutique, partagé par TOUTE l'équipe (Owner, Manager,
-- Vendeur) — pas seulement l'Owner. N'importe quel membre peut créer,
-- modifier, épingler ou supprimer n'importe quelle note de sa boutique
-- (carnet partagé, pas un espace personnel par utilisateur).
-- ============================================================================

CREATE TABLE store_notes (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  -- Auteur conservé pour affichage ("écrit par ...") mais jamais requis pour
  -- l'autorisation : la note reste lisible/modifiable par l'équipe même si
  -- l'auteur quitte la boutique (ON DELETE SET NULL, jamais CASCADE ici).
  author_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title       VARCHAR(150),
  content     TEXT NOT NULL CHECK (LENGTH(TRIM(content)) > 0),
  color       VARCHAR(10) NOT NULL DEFAULT 'yellow'
              CHECK (color IN ('yellow', 'blue', 'green', 'pink', 'gray')),
  is_pinned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_store_notes_updated_at
  BEFORE UPDATE ON store_notes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Épinglées d'abord, puis les plus récemment modifiées — ordre d'affichage
-- direct depuis l'index, pas de tri applicatif nécessaire.
CREATE INDEX idx_store_notes_store_order ON store_notes (store_id, is_pinned DESC, updated_at DESC);
