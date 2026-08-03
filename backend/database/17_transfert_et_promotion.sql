-- ============================================================================
-- 17_transfert_et_promotion.sql
-- Domaine : Transfert de propriété de boutique + promotion Super Admin
-- ============================================================================
-- Décidé en conversation :
--  1. Un Owner ne peut PAS devenir Super Admin tant qu'il possède une
--     boutique — il doit d'abord la transférer à quelqu'un d'autre.
--  2. Dès qu'une promotion réussit (donc la personne ne possède plus rien),
--     tous ses rattachements restants (Manager/Vendeur ailleurs) sont
--     retirés automatiquement — un Super Admin ne voit plus que son espace.
--  3. Le transfert de propriété n'est déclenchable QUE par un Super Admin
--     (appliqué côté service, cf. admin.service.js).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Bloque la promotion tant qu'une boutique est possédée.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prevent_promoting_store_owner_to_admin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_super_admin = TRUE AND OLD.is_super_admin = FALSE THEN
    IF EXISTS (SELECT 1 FROM stores WHERE owner_id = NEW.id) THEN
      RAISE EXCEPTION
        'Cette personne possède une boutique — elle doit d''abord être transférée à quelqu''un d''autre avant de pouvoir devenir Super Admin.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_no_promote_store_owner
  BEFORE UPDATE OF is_super_admin ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_promoting_store_owner_to_admin();

-- ----------------------------------------------------------------------------
-- 2. Une fois la promotion effectuée (donc garantie sans boutique possédée,
--    grâce au trigger ci-dessus), retire tout rattachement restant
--    (Manager/Vendeur dans une boutique d'un tiers).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION strip_store_access_on_admin_promotion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_super_admin = TRUE AND OLD.is_super_admin = FALSE THEN
    DELETE FROM user_store WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_strip_access_on_promotion
  AFTER UPDATE OF is_super_admin ON users
  FOR EACH ROW EXECUTE FUNCTION strip_store_access_on_admin_promotion();