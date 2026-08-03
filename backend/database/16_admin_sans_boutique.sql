-- ============================================================================
-- 16_admin_sans_boutique.sql
-- Domaine : Un Super Admin ne peut jamais posséder de boutique
-- ============================================================================
-- Décidé en conversation : le Super Admin est un opérateur de la
-- plateforme, pas un client/tenant. Mélanger les deux rôles brouillerait
-- la distinction "contrôle la plateforme" vs "utilise la plateforme".
--
-- Double protection, comme pour les autres règles d'exclusivité du
-- projet : vérification applicative (message clair) + trigger (garde-fou
-- final, y compris contre un futur code qui insérerait directement en
-- base sans passer par stores.service.js).
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_super_admin_owning_store()
RETURNS TRIGGER AS $$
DECLARE
  owner_is_admin BOOLEAN;
BEGIN
  SELECT is_super_admin INTO owner_is_admin FROM users WHERE id = NEW.owner_id;

  IF owner_is_admin THEN
    RAISE EXCEPTION 'Un Super Admin ne peut pas posséder de boutique.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_stores_no_super_admin_owner
  BEFORE INSERT OR UPDATE OF owner_id ON stores
  FOR EACH ROW EXECUTE FUNCTION prevent_super_admin_owning_store();