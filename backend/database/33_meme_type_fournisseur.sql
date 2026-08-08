-- ============================================================================
-- 33_meme_type_fournisseur.sql
-- Domaine : Restriction du lien fournisseur inter-boutiques au même secteur
-- ============================================================================
-- Décidé en conversation : une boutique de téléphonie n'a pas de raison
-- métier de devenir fournisseur d'une boutique de pièces moto — le lien
-- store_supplier_links (§18_fournisseurs_inter_boutiques.sql) n'est
-- désormais autorisé qu'entre deux boutiques du même store_type_id
-- (§22_types_de_boutique.sql), toutes deux déjà pourvues d'un type.
--
-- Défense en profondeur, même principe que prevent_multi_store_reseller
-- (§11_invitations_et_exclusivite.sql) : la règle est déjà vérifiée côté
-- service AVANT toute insertion (suppliers.service.js#addSupplier), ce
-- trigger est le garde-fou final, au cas où une insertion la contournerait.
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_store_supplier_type_mismatch()
RETURNS TRIGGER AS $$
DECLARE
  buyer_type_id INTEGER;
  supplier_type_id INTEGER;
BEGIN
  SELECT store_type_id INTO buyer_type_id FROM stores WHERE id = NEW.buyer_store_id;
  SELECT store_type_id INTO supplier_type_id FROM stores WHERE id = NEW.supplier_store_id;

  IF buyer_type_id IS NULL OR supplier_type_id IS NULL THEN
    RAISE EXCEPTION
      'Les deux boutiques doivent avoir choisi leur secteur d''activité avant de pouvoir être liées comme fournisseur.'
      USING ERRCODE = 'P0001';
  END IF;

  IF buyer_type_id <> supplier_type_id THEN
    RAISE EXCEPTION
      'Le lien fournisseur n''est possible qu''entre boutiques du même secteur d''activité.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_supplier_links_same_type
  BEFORE INSERT ON store_supplier_links
  FOR EACH ROW EXECUTE FUNCTION prevent_store_supplier_type_mismatch();
