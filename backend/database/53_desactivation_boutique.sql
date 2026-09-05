-- ============================================================================
-- 53_desactivation_boutique.sql
-- Domaine : Désactivation volontaire d'une boutique par son Owner
-- ============================================================================
-- Contexte métier (décidé en conversation) : un utilisateur ne peut occuper
-- qu'UN SEUL poste à la fois — Owner quelque part, Vendeur quelque part, ou
-- aucun des deux. Pour libérer un Owner qui veut devenir Vendeur ailleurs
-- (ou repartir de zéro), il lui faut un moyen de désactiver lui-même sa
-- boutique — jusqu'ici, seul le Super Admin pouvait suspendre une boutique
-- (`status = 'SUSPENDED'`, admin.service.js#suspendStore), et cette
-- suspension est punitive (impayé, abus) : elle ne libère jamais
-- réellement le propriétaire (owner_id n'est jamais touché).
--
-- Nouveau statut DEACTIVATED, volontaire, distinct de SUSPENDED : lui seul
-- libère réellement le "poste" occupé par le propriétaire (et, tant que la
-- boutique reste désactivée, par ses Vendeurs — une boutique fermée ne doit
-- pas retenir son équipe prisonnière).
-- ============================================================================

ALTER TABLE stores DROP CONSTRAINT stores_status_check;
ALTER TABLE stores ADD CONSTRAINT stores_status_check
  CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL', 'DEACTIVATED'));

-- uq_stores_owner_id (UNIQUE global sur owner_id, cf. 24_reparation_schema.sql)
-- empêcherait un Owner désactivé de posséder une nouvelle boutique tant que
-- l'ancienne ligne existe encore (owner_id est NOT NULL, jamais mis à NULL,
-- pour préserver l'historique/l'audit). Remplacé par un index unique
-- PARTIEL qui ignore les boutiques désactivées — même nom conservé, les
-- vérifications existantes sur err.constraint === 'uq_stores_owner_id'
-- (stores.service.js, admin.service.js) continuent de fonctionner
-- sans changement.
ALTER TABLE stores DROP CONSTRAINT uq_stores_owner_id;
CREATE UNIQUE INDEX uq_stores_owner_id ON stores (owner_id) WHERE status <> 'DEACTIVATED';

-- ----------------------------------------------------------------------------
-- prevent_multi_store_reseller() (définie dans 11_invitations_et_exclusivite.sql)
-- exemptait explicitement OWNER — voulu pour Owner-vs-Owner (Superviser
-- existe pour ça), mais laissait passer Owner-vs-Vendeur par erreur : un
-- Owner pouvait être ajouté comme Vendeur ailleurs sans jamais être bloqué
-- par ce filet de sécurité (seule la vérification applicative de
-- employees.service.js#addEmployee protégeait ce cas — désormais corrigée
-- en parallèle). CREATE OR REPLACE ici plutôt qu'édition rétroactive de
-- 11_invitations_et_exclusivite.sql, pour ne pas réécrire une migration
-- déjà appliquée en base réelle.
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

    -- Nouveau : bloque aussi si cette personne est Owner actif ailleurs
    -- (§53_desactivation_boutique.sql, décidé en conversation).
    PERFORM 1 FROM stores WHERE owner_id = NEW.user_id AND status <> 'DEACTIVATED';
    IF FOUND THEN
      RAISE EXCEPTION
        'Cette personne est déjà propriétaire d''une autre boutique. Elle doit d''abord la désactiver.'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF new_role_code = 'OWNER' THEN
    -- Symétrique : bloque si déjà Vendeur actif ailleurs.
    PERFORM 1 FROM user_store us
      JOIN roles r ON r.id = us.role_id
      JOIN stores s ON s.id = us.store_id
      WHERE us.user_id = NEW.user_id
        AND r.code = 'SELLER'
        AND s.id <> NEW.store_id
        AND s.status <> 'DEACTIVATED';
    IF FOUND THEN
      RAISE EXCEPTION
        'Cette personne est déjà Vendeur dans une autre boutique.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
