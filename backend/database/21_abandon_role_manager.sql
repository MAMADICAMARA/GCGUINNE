-- ============================================================================
-- 21_abandon_role_manager.sql
-- Domaine : Abandon du rôle MANAGER
-- ============================================================================
-- Décidé en conversation, contexte guinéen : dans une petite boutique, le
-- Vendeur/Caissier gère aussi bien la vente que le stock/produits au
-- quotidien — pas besoin d'un palier intermédiaire entre Owner et Vendeur.
-- Produits, Stock, Catégories, Historique des ventes et Annulation/retour
-- de commande, qui étaient accessibles à Manager, redeviennent réservés à
-- l'Owner seul (décision explicite : pas transférés au Vendeur).
--
-- Aucune ligne MANAGER n'existe plus dans `roles` (déjà constaté en
-- conversation — retirée de la base à un moment non documenté). Cette
-- migration ne fait donc que resserrer la contrainte pour qu'elle ne
-- puisse plus être réintroduite par erreur.
-- ============================================================================

ALTER TABLE roles DROP CONSTRAINT roles_code_check;
ALTER TABLE roles ADD CONSTRAINT roles_code_check
  CHECK (code IN ('SUPER_ADMIN', 'OWNER', 'SELLER'));

-- ----------------------------------------------------------------------------
-- Règle d'exclusivité (§11_invitations_et_exclusivite.sql) — simplifiée de
-- IN ('MANAGER', 'SELLER') à = 'SELLER', MANAGER n'existant plus.
-- CREATE OR REPLACE : mêmes noms de fonctions, pas de nouveau trigger.
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

CREATE OR REPLACE FUNCTION prevent_conflicting_invitation()
RETURNS TRIGGER AS $$
DECLARE
  new_role_code VARCHAR(20);
  conflict_count INT;
BEGIN
  SELECT code INTO new_role_code FROM roles WHERE id = NEW.role_id;

  IF new_role_code = 'SELLER' THEN
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
