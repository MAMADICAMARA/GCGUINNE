-- ============================================================================
-- 03_fournisseurs_et_achats.sql
-- Domaine : Fournisseurs, commandes d'achat
-- Priorité cahier des charges : P1 (§5.2)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SUPPLIERS — fournisseurs, propres à chaque boutique
-- ----------------------------------------------------------------------------
CREATE TABLE suppliers (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        VARCHAR(150) NOT NULL,
  phone       VARCHAR(30),
  email       VARCHAR(150),
  address     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_suppliers_store ON suppliers (store_id);

-- ----------------------------------------------------------------------------
-- PURCHASES — commandes d'achat auprès d'un fournisseur
-- ----------------------------------------------------------------------------
CREATE TABLE purchases (
  id            SERIAL PRIMARY KEY,
  store_id      INTEGER NOT NULL REFERENCES stores(id)    ON DELETE CASCADE,
  supplier_id   INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  reference     VARCHAR(50),
  total_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status        VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'RECEIVED', 'CANCELLED')),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_purchases_store_reference
  ON purchases (store_id, reference)
  WHERE reference IS NOT NULL;

CREATE INDEX idx_purchases_store_status ON purchases (store_id, status);

-- Une commande d'achat est un document formel : jamais de suppression
-- physique, seul un changement de statut (CANCELLED) est autorisé.
CREATE TRIGGER trg_purchases_no_delete
  BEFORE DELETE ON purchases
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- ----------------------------------------------------------------------------
-- PURCHASE_ITEMS — lignes d'une commande d'achat
-- ----------------------------------------------------------------------------
CREATE TABLE purchase_items (
  id               SERIAL PRIMARY KEY,
  purchase_id      INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id       INTEGER NOT NULL REFERENCES products(id)  ON DELETE RESTRICT,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  purchase_price   NUMERIC(15, 2) NOT NULL CHECK (purchase_price >= 0)
);

CREATE INDEX idx_purchase_items_purchase ON purchase_items (purchase_id);
CREATE INDEX idx_purchase_items_product  ON purchase_items (product_id);
