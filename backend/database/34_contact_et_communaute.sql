-- ============================================================================
-- 34_contact_et_communaute.sql
-- Domaine : Formulaire "Contactez-nous" + liens communauté (WhatsApp,
--           Telegram, extensible plus tard)
-- ============================================================================
-- Décidé en conversation : tout utilisateur authentifié non-admin (Owner,
-- Vendeur) peut envoyer un message à la plateforme. Le Super Admin les
-- consulte dans une boîte de réception, avec un statut lu/non-lu.
-- ============================================================================

CREATE TABLE contact_messages (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  store_id    INTEGER REFERENCES stores(id)          ON DELETE SET NULL,
  subject     VARCHAR(150) NOT NULL,
  message     TEXT NOT NULL CHECK (LENGTH(TRIM(message)) > 0),
  status      VARCHAR(20) NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'READ')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_status_date ON contact_messages (status, created_at DESC);
CREATE INDEX idx_contact_messages_user ON contact_messages (user_id);

-- ----------------------------------------------------------------------------
-- PLATFORM_SOCIAL_LINKS — section "Rejoignez la communauté" de la page
-- Contactez-nous, entièrement gérée par le Super Admin (§ décidé en
-- conversation : "possibilité d'ajouter d'autres réseaux sociaux plus
-- tard"). Table générique plutôt que des colonnes fixes whatsapp_url/
-- telegram_url : ajouter un nouveau réseau ne demandera jamais de
-- migration, juste une ligne insérée depuis l'écran d'administration.
-- `icon_key` référence une petite liste fermée d'icônes disponibles côté
-- frontend (lucide-react n'a pas d'icônes de marque) — jamais un nom de
-- composant React stocké tel quel en base.
-- ----------------------------------------------------------------------------
CREATE TABLE platform_social_links (
  id             SERIAL PRIMARY KEY,
  label          VARCHAR(100) NOT NULL,
  url            TEXT NOT NULL,
  icon_key       VARCHAR(20) NOT NULL DEFAULT 'OTHER'
                 CHECK (icon_key IN ('WHATSAPP', 'TELEGRAM', 'PHONE', 'EMAIL', 'OTHER')),
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_platform_social_links_updated_at
  BEFORE UPDATE ON platform_social_links
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_platform_social_links_active_order ON platform_social_links (is_active, display_order);
