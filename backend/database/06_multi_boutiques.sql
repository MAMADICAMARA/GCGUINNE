-- ============================================================================
-- 06_multi_boutiques.sql
-- Domaine : Transferts de stock entre boutiques d'un même propriétaire
-- Priorité cahier des charges : P2 (§6.3)
-- ============================================================================

CREATE TABLE stock_transfers (
  id             SERIAL PRIMARY KEY,
  from_store_id  INTEGER NOT NULL REFERENCES stores(id)   ON DELETE RESTRICT,
  to_store_id    INTEGER NOT NULL REFERENCES stores(id)   ON DELETE RESTRICT,
  product_id     INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  status         VARCHAR(20) NOT NULL DEFAULT 'INITIATED'
                 CHECK (status IN ('INITIATED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED')),
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  shipped_at     TIMESTAMPTZ,
  received_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_transfer_different_stores CHECK (from_store_id <> to_store_id)
);

CREATE INDEX idx_stock_transfers_from ON stock_transfers (from_store_id, status);
CREATE INDEX idx_stock_transfers_to   ON stock_transfers (to_store_id, status);

-- Document formel de traçabilité inter-boutiques : pas de suppression
-- physique, seul un passage au statut CANCELLED est permis (§12).
CREATE TRIGGER trg_stock_transfers_no_delete
  BEFORE DELETE ON stock_transfers
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();
