-- ============================================================================
-- 47_versions_app.sql
-- Domaine : Notification de mise à jour de l'application mobile (§ cahier
-- des charges "Système de notification de mise à jour", décidé en
-- conversation) — l'app est distribuée en APK direct (hors Play Store, le
-- temps de résoudre le problème de paiement du compte développeur), donc
-- aucun mécanisme de mise à jour automatique n'existe : celui-ci le
-- remplace.
-- ============================================================================

-- Une ligne par publication, jamais modifiée en place (historique complet
-- conservé) — la version "actuelle" pour une plateforme donnée est celle
-- au version_code le plus élevé, jamais published_at (une date ne garantit
-- pas un ordre de version fiable).
CREATE TABLE app_versions (
  id             SERIAL PRIMARY KEY,
  platform       VARCHAR(20) NOT NULL DEFAULT 'android',
  version_code   INTEGER NOT NULL,
  version_name   VARCHAR(20) NOT NULL,
  release_notes  TEXT,
  update_level   VARCHAR(20) NOT NULL DEFAULT 'OPTIONAL'
                 CHECK (update_level IN ('OPTIONAL', 'RECOMMENDED', 'MANDATORY')),
  published_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_by   INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- Un même (platform, version_code) publié deux fois serait ambigu — lequel
-- des deux est "la" version actuelle ? Empêché à la source plutôt que
-- laissé au hasard de l'ordre de tri en cas d'égalité.
CREATE UNIQUE INDEX uq_app_versions_platform_code ON app_versions (platform, version_code);
CREATE INDEX idx_app_versions_platform_code_desc ON app_versions (platform, version_code DESC);

-- Liste OUVERTE de sources de téléchargement pour une version donnée
-- (décidé en conversation) : upload direct R2 et/ou n'importe quel nombre
-- de liens externes (Mega, Mediafire, Google Drive, Uptodown...), jamais
-- une seule URL figée. Chaque nouvelle version a ses PROPRES liens —
-- jamais un chemin réécrit à chaque publication, l'historique des liens
-- de versions précédentes reste donc consultable.
CREATE TABLE app_version_links (
  id               SERIAL PRIMARY KEY,
  app_version_id   INTEGER NOT NULL REFERENCES app_versions(id) ON DELETE CASCADE,
  label            VARCHAR(50) NOT NULL,
  url              TEXT NOT NULL,
  is_direct_upload BOOLEAN NOT NULL DEFAULT FALSE,
  display_order    INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_version_links_version ON app_version_links (app_version_id, display_order);
