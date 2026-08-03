-- ============================================================================
-- 11_invitations_et_exclusivite.sql
-- Domaine : Invitation d'employés par e-mail + exclusivité opérationnelle
-- ============================================================================
-- Contexte métier (décidé en conversation) : un Vendeur est une présence
-- physique dans UNE boutique — contrairement à un Owner, qui peut
-- légitimement posséder plusieurs boutiques sans y être physiquement.
-- Un même utilisateur ne peut donc jamais être Vendeur dans deux
-- boutiques différentes en même temps. Aucune exception : tentative
-- refusée avec un message clair ; il faut d'abord être retiré de la
-- première boutique pour pouvoir rejoindre une autre.
-- (Pas de rôle Manager — abandonné, contexte guinéen : cf. 01_plateforme_et_comptes.sql)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STORE_INVITATIONS — invitation en attente, avant que le compte existe.
-- Table volontairement minimale et temporaire : une ligne disparaît dès
-- qu'elle est consommée (inscription de la personne invitée) ou annulée.
-- ----------------------------------------------------------------------------
CREATE TABLE store_invitations (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email        VARCHAR(150) NOT NULL,
  role_id      INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  invited_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_store_invitation UNIQUE (store_id, email)
);

CREATE INDEX idx_store_invitations_email ON store_invitations (LOWER(email));

-- ----------------------------------------------------------------------------
-- Règle d'exclusivité — appliquée à DEUX niveaux (défense en profondeur,
-- même principe que l'anti-survente sur products.quantity) :
--   1. user_store : bloque si un compte réel est déjà Vendeur
--      ailleurs.
--   2. store_invitations : bloque une invitation Vendeur si la
--      personne (par e-mail) est déjà Vendeur ailleurs, ou a déjà
--      une invitation en attente ailleurs.
-- Le rôle OWNER est explicitement exempté : posséder plusieurs boutiques
-- reste autorisé.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION prevent_multi_store_reseller()
RETURNS TRIGGER AS $$
DECLARE
  new_role_code VARCHAR(20);
  conflict_count INT;
BEGIN
  SELECT code INTO new_role_code FROM roles WHERE id = NEW.role_id;

  IF new_role_code = 'SELLER' THEN
    SELECT COUNT(*) INTO conflict_count
    FROM user_store us
    JOIN roles r ON r.id = us.role_id
    WHERE us.user_id = NEW.user_id
      AND us.store_id <> NEW.store_id
      AND r.code = 'SELLER'
      AND us.id <> NEW.id;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION
        'Cette personne est déjà Vendeur dans une autre boutique. Elle doit d''abord en être retirée.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_store_one_reseller_store
  BEFORE INSERT OR UPDATE ON user_store
  FOR EACH ROW EXECUTE FUNCTION prevent_multi_store_reseller();


CREATE OR REPLACE FUNCTION prevent_conflicting_invitation()
RETURNS TRIGGER AS $$
DECLARE
  new_role_code VARCHAR(20);
  conflict_count INT;
BEGIN
  SELECT code INTO new_role_code FROM roles WHERE id = NEW.role_id;

  IF new_role_code = 'SELLER' THEN
    -- Compte déjà existant, déjà Vendeur dans une autre boutique ?
    SELECT COUNT(*) INTO conflict_count
    FROM users u
    JOIN user_store us ON us.user_id = u.id
    JOIN roles r ON r.id = us.role_id
    WHERE LOWER(u.email) = LOWER(NEW.email)
      AND us.store_id <> NEW.store_id
      AND r.code = 'SELLER';

    IF conflict_count > 0 THEN
      RAISE EXCEPTION
        'Cette personne est déjà Vendeur dans une autre boutique.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Une autre invitation Vendeur déjà en attente ailleurs ?
    SELECT COUNT(*) INTO conflict_count
    FROM store_invitations si
    JOIN roles r ON r.id = si.role_id
    WHERE LOWER(si.email) = LOWER(NEW.email)
      AND si.store_id <> NEW.store_id
      AND r.code = 'SELLER'
      AND si.id <> NEW.id;

    IF conflict_count > 0 THEN
      RAISE EXCEPTION
        'Une invitation est déjà en attente pour cette personne dans une autre boutique.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_invitations_one_reseller
  BEFORE INSERT OR UPDATE ON store_invitations
  FOR EACH ROW EXECUTE FUNCTION prevent_conflicting_invitation();