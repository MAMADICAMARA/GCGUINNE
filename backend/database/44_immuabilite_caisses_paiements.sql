-- ============================================================================
-- 44_immuabilite_caisses_paiements.sql
-- Domaine : Immuabilité de cash_drawers/customer_payments + cohérence des
--           suppressions en cascade sur les tables financières liées à
--           stores (§ audit complet du 2026-08-30, constats CRITIQUE)
-- ============================================================================
-- Constat : orders, order_items, stock_movements, system_logs,
-- purchase_orders, purchase_order_items et stock_transfers sont tous
-- protégés par prevent_delete()/prevent_update_delete() — mais
-- cash_drawers (fond de caisse) et customer_payments (encaissements
-- clients) ne l'ont jamais été, alors que ce sont exactement le même genre
-- de registre à valeur de preuve. Un fond de caisse ou un paiement client
-- pouvait jusqu'ici être modifié ou supprimé après coup sans laisser
-- aucune trace.
--
-- customer_payments : jamais UPDATE nulle part dans le code applicatif
-- (vérifié) — même traitement que orders, blocage total UPDATE+DELETE,
-- aucune exception nécessaire.
--
-- cash_drawers : DEUX écritures légitimes existent après l'ouverture et
-- doivent rester possibles :
--   1. L'incrément automatique de expected_balance à chaque vente en
--      espèces (trigger update_cash_drawer_expected_balance, §30_fond_de_
--      caisse.sql) — ne touche QUE expected_balance, caisse encore OPEN.
--   2. La fermeture (cashDrawers.service.js#closeDrawer) — transition
--      OPEN -> CLOSED, ne touche QUE status/closing_time/closing_balance/
--      note. Une fois CLOSED, plus aucune écriture n'est permise (pas de
--      réouverture, pas de correction a posteriori du montant compté).
-- Toute autre tentative de modification (opening_balance, opening_time,
-- user_id, store_id, ou n'importe quel champ après clôture) reste bloquée,
-- même principe exact que l'exception déjà posée pour system_logs/
-- stock_movements dans 37_purge_comptes_non_verifies.sql.
--
-- NOT VALID sur les 3 nouvelles contraintes ci-dessous : en testant cette
-- migration, une ligne orpheline pré-existante a été trouvée en base de
-- dev (orders.id=76, store_id=29 inexistant dans stores — vraisemblablement
-- une donnée de test créée avant l'ajout du CASCADE actuel, ou une
-- suppression faite hors application). ADD CONSTRAINT valide par défaut
-- TOUTES les lignes existantes et aurait échoué sur ce genre d'écart déjà
-- présent (en dev comme potentiellement en prod, jamais vérifié jusqu'ici
-- faute de contrainte). NOT VALID applique la règle à toute nouvelle
-- opération immédiatement (protection recherchée par cette migration),
-- sans bloquer sur un historique déjà incohérent qu'il faudra nettoyer
-- séparément, pas dans une migration de sécurité.
--
-- Cascade de suppression : orders/purchase_orders/cash_drawers étaient en
-- ON DELETE CASCADE sur stores, alors que customer_payments bloque déjà la
-- suppression (NO ACTION). Une boutique sans aucun paiement client
-- pourrait donc aujourd'hui être supprimée avec tout son historique de
-- ventes/achats/caisses effacé silencieusement, malgré les triggers
-- d'immuabilité ligne-à-ligne ci-dessus (qui ne bloquent que le DELETE
-- direct sur une ligne, jamais la cascade FK). Alignement sur RESTRICT
-- pour les trois, cohérent avec « aucune suppression physique des ventes »
-- déjà affirmé dans le schéma. Aucune route applicative ne supprime une
-- boutique aujourd'hui — correctif préventif, pas un correctif de bug
-- actif.
-- ============================================================================

-- ---- customer_payments : immuabilité totale, aucune exception ----
CREATE TRIGGER trg_customer_payments_no_update_delete
  BEFORE UPDATE OR DELETE ON customer_payments
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ---- cash_drawers : immuabilité avec les deux exceptions légitimes ----
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME IN ('system_logs', 'stock_movements') THEN
    IF NEW.user_id IS NULL AND OLD.user_id IS NOT NULL
       AND to_jsonb(NEW) - 'user_id' = to_jsonb(OLD) - 'user_id' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'cash_drawers' THEN
    -- Incrément automatique du solde théorique (vente en espèces), caisse
    -- toujours ouverte : seul expected_balance change.
    IF OLD.status = 'OPEN' AND NEW.status = 'OPEN'
       AND to_jsonb(NEW) - 'expected_balance' = to_jsonb(OLD) - 'expected_balance' THEN
      RETURN NEW;
    END IF;

    -- Fermeture légitime (OPEN -> CLOSED) : seuls status/closing_time/
    -- closing_balance/note changent, tout le reste doit rester identique.
    IF OLD.status = 'OPEN' AND NEW.status = 'CLOSED'
       AND to_jsonb(NEW) - 'status' - 'closing_time' - 'closing_balance' - 'note'
         = to_jsonb(OLD) - 'status' - 'closing_time' - 'closing_balance' - 'note' THEN
      RETURN NEW;
    END IF;
  END IF;

  RAISE EXCEPTION
    'Modification/suppression interdite sur la table % : registre immuable.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_drawers_no_update_delete
  BEFORE UPDATE OR DELETE ON cash_drawers
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ---- Cohérence des suppressions en cascade sur stores ----
ALTER TABLE orders DROP CONSTRAINT orders_store_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE purchase_orders DROP CONSTRAINT purchases_store_id_fkey;
ALTER TABLE purchase_orders ADD CONSTRAINT purchases_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT NOT VALID;

ALTER TABLE cash_drawers DROP CONSTRAINT cash_drawers_store_id_fkey;
ALTER TABLE cash_drawers ADD CONSTRAINT cash_drawers_store_id_fkey
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT NOT VALID;
