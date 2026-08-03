-- ============================================================================
-- 05_caisses.sql
-- Domaine : Sessions de caisse (shifts), fonds de caisse
-- Priorité cahier des charges : P1 (§5.1)
-- ============================================================================

CREATE TABLE cash_drawers (
  id                 SERIAL PRIMARY KEY,
  store_id           INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  user_id            INTEGER NOT NULL REFERENCES users(id)  ON DELETE RESTRICT,
  opening_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closing_time       TIMESTAMPTZ,
  opening_balance    NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (opening_balance >= 0),
  expected_balance   NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- calculé automatiquement (trigger)
  closing_balance    NUMERIC(15, 2),
  status             VARCHAR(20) NOT NULL DEFAULT 'OPEN'
                      CHECK (status IN ('OPEN', 'CLOSED')),

  CONSTRAINT chk_closing_consistency
    CHECK (
      (status = 'OPEN'  AND closing_time IS NULL) OR
      (status = 'CLOSED' AND closing_time IS NOT NULL)
    )
);

CREATE INDEX idx_cash_drawers_store_status ON cash_drawers (store_id, status);

-- Un vendeur ne peut avoir qu'une seule caisse ouverte à la fois, dans une
-- boutique donnée (§5.1 / §12 : "refus si tentative d'ouverture d'une
-- deuxième caisse sans avoir fermé la précédente").
CREATE UNIQUE INDEX uq_cash_drawers_one_open_per_user
  ON cash_drawers (user_id, store_id)
  WHERE status = 'OPEN';

-- Rattache maintenant la vente à la caisse active du vendeur qui encaisse
-- (table orders créée en amont dans 03_clients_et_ventes.sql).
ALTER TABLE orders
  ADD CONSTRAINT fk_orders_cash_drawer
  FOREIGN KEY (cash_drawer_id) REFERENCES cash_drawers(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Mise à jour automatique du montant théorique attendu (expected_balance)
-- à chaque vente encaissée en espèces sur une caisse ouverte (§5.1).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_cash_drawer_expected_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cash_drawer_id IS NOT NULL AND NEW.payment_method = 'CASH' THEN
    UPDATE cash_drawers
    SET expected_balance = expected_balance + NEW.total_amount
    WHERE id = NEW.cash_drawer_id AND status = 'OPEN';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_update_cash_drawer
  AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_cash_drawer_expected_balance();
