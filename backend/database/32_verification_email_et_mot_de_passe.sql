-- ============================================================================
-- 32_verification_email_et_mot_de_passe.sql
-- Domaine : Vérification d'e-mail bloquante à l'inscription + réinitialisation
--           de mot de passe en libre-service (décidé en conversation, cahier
--           des charges "Système d'envoi d'e-mails transactionnels")
-- ============================================================================
-- Une seule table sert les deux usages (EMAIL_VERIFICATION et
-- PASSWORD_RESET) plutôt que d'en dupliquer une identique deux fois — même
-- format de code (6 chiffres), même durée de vie (15 minutes), même règle
-- d'usage unique. `purpose` distingue les deux contextes sans jamais les
-- mélanger (un code de vérification ne peut pas servir à réinitialiser un
-- mot de passe, et inversement — toujours filtré par `purpose` côté service).
--
-- Pas de contrainte UNIQUE empêchant plusieurs codes par (user_id, purpose) :
-- un "resend" insère une nouvelle ligne après avoir invalidé (used_at = NOW())
-- toute ligne encore active du même purpose, côté service — l'historique des
-- anciens codes reste donc en base (jamais supprimé), utile pour un futur
-- audit de sécurité si nécessaire.
-- ============================================================================

CREATE TABLE user_verification_codes (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose     VARCHAR(30) NOT NULL CHECK (purpose IN ('EMAIL_VERIFICATION', 'PASSWORD_RESET')),
  code        VARCHAR(6) NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accélère la requête de vérification (user_id + purpose + code, toujours
-- filtrée aussi sur used_at IS NULL côté service) et le "invalide tout code
-- actif avant d'en émettre un nouveau" du resend.
CREATE INDEX idx_user_verification_codes_lookup
  ON user_verification_codes (user_id, purpose, used_at);

-- Nouveau statut initial d'un compte fraîchement inscrit : le compte existe
-- mais reste inutilisable (login() refuse déjà tout statut ≠ 'ACTIVE',
-- logique existante réutilisée telle quelle, rien à modifier côté trigger
-- ou contrainte pour ça) tant que le code de vérification n'a pas été validé.
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING_VERIFICATION'));
