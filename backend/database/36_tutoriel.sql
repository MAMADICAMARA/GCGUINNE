-- ============================================================================
-- 36_tutoriel.sql
-- Domaine : Vidéos tutoriel configurables + déclenchement automatique
-- ============================================================================
-- Décidé en conversation : le Super Admin configure une ou plusieurs
-- vidéos tutoriel (titre + lien), sur le même principe générique et
-- extensible que platform_social_links (§34_contact_et_communaute.sql) —
-- ajouter une vidéo ne demande jamais de migration, juste une ligne
-- insérée depuis l'écran d'administration.
--
-- `platform_tutorial_settings` (singleton, même principe que
-- platform_payment_settings) porte DEUX réglages INDÉPENDANTS, décidés
-- explicitement en conversation pour ne jamais être contrôlés par une
-- seule case à cocher : l'un pour l'affichage automatique juste après
-- l'inscription (vérification d'e-mail réussie), l'autre pour l'affichage
-- automatique à CHAQUE connexion normale — activé par défaut pour ce
-- second cas (contexte : public peu habitué à la technologie, un rappel
-- répété est voulu par défaut, pas une exception).
-- ============================================================================

CREATE TABLE platform_tutorial_videos (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(150) NOT NULL,
  url            TEXT NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_tutorial_videos_updated_at
  BEFORE UPDATE ON platform_tutorial_videos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_platform_tutorial_videos_active_order ON platform_tutorial_videos (is_active, display_order);

CREATE TABLE platform_tutorial_settings (
  id                 SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  show_after_signup  BOOLEAN NOT NULL DEFAULT TRUE,
  show_on_login      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_tutorial_settings_updated_at
  BEFORE UPDATE ON platform_tutorial_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO platform_tutorial_settings (id) VALUES (1);
