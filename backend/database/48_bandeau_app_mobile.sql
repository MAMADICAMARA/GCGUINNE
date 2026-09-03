-- ============================================================================
-- 48_bandeau_app_mobile.sql
-- Domaine : Bandeau web "Téléchargez l'application Android"
-- ============================================================================
-- Décidé en conversation : le bandeau promotionnel affiché dans l'espace
-- Compte/Boutique du site web (DownloadAppBanner.jsx) doit pouvoir être
-- désactivé par le Super Admin — même page d'administration que le
-- tutoriel (AdminContactMessagesPage.jsx), même principe de ligne
-- singleton que platform_tutorial_settings (§36_tutoriel.sql).
-- ============================================================================

CREATE TABLE platform_download_banner_settings (
  id          SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  is_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_download_banner_settings_updated_at
  BEFORE UPDATE ON platform_download_banner_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO platform_download_banner_settings (id) VALUES (1);
