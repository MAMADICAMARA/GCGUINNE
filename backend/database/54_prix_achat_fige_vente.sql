-- ============================================================================
-- 54_prix_achat_fige_vente.sql
-- Domaine : Fige le prix d'achat au moment de la vente
-- ============================================================================
-- Le bénéfice affiché (dashboard.service.js, supervision.service.js) était
-- recalculé avec le prix d'achat ACTUEL de la fiche produit plutôt que
-- celui en vigueur au moment de la vente — unit_price est déjà figé
-- (§03_clients_et_ventes.sql), purchase_price ne l'était pas. Conséquence
-- réelle : une hausse ultérieure du prix d'achat (édition manuelle, ou
-- réception d'une commande fournisseur, cf. purchases.service.js) rendait
-- rétroactivement négatives des ventes passées qui étaient pourtant
-- bénéficiaires au moment où elles ont eu lieu.
-- ============================================================================

ALTER TABLE order_items ADD COLUMN purchase_price NUMERIC(15, 2);
-- NULL pour les ventes déjà existantes (impossible de reconstituer leur
-- coût historique réel) — dashboard.service.js et supervision.service.js
-- font un COALESCE(oi.purchase_price, p.purchase_price) pour ces
-- anciennes lignes uniquement, qui gardent l'ancien comportement (limite
-- connue et inévitable pour les données déjà en base).

-- CREATE OR REPLACE : ajoute purchase_price à la liste des colonnes figées,
-- message d'erreur original conservé à l'identique (§03_clients_et_ventes.sql).
CREATE OR REPLACE FUNCTION prevent_order_item_core_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <> OLD.quantity
     OR NEW.unit_price <> OLD.unit_price
     OR NEW.purchase_price IS DISTINCT FROM OLD.purchase_price
     OR NEW.product_id <> OLD.product_id
     OR NEW.order_id <> OLD.order_id THEN
    RAISE EXCEPTION
      'Une ligne de vente validée ne peut pas être modifiée sur sa quantité, son prix ou son produit (order_items.id=%).',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
