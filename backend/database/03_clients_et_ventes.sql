-- ============================================================================
-- 03_clients_et_ventes.sql
-- Domaine : Clients, ventes physiques (parcours critique)
-- Priorité cahier des charges : P0 (§4.6, §4.7)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CUSTOMERS — fiches clients, propres à chaque boutique (§4.7)
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
  id           SERIAL PRIMARY KEY,
  store_id     INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         VARCHAR(150) NOT NULL,
  phone        VARCHAR(30),
  email        VARCHAR(150),
  address      TEXT,
  total_spent  NUMERIC(15, 2) NOT NULL DEFAULT 0,  -- valeur dérivée, maintenue par trigger
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Un même numéro de téléphone peut exister dans deux boutiques différentes
-- (deux fiches distinctes, cf. §4.7), mais pas deux fois dans la même boutique.
CREATE UNIQUE INDEX uq_customers_store_phone
  ON customers (store_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX idx_customers_store_name ON customers (store_id, name);

-- ----------------------------------------------------------------------------
-- ORDERS — ventes physiques (§4.6). Table centrale du parcours critique.
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
  id               SERIAL PRIMARY KEY,
  store_id         INTEGER NOT NULL REFERENCES stores(id)    ON DELETE CASCADE,
  customer_id      INTEGER REFERENCES customers(id)          ON DELETE SET NULL,
  seller_id        INTEGER NOT NULL REFERENCES users(id)     ON DELETE RESTRICT,
  cash_drawer_id   INTEGER,  -- FK ajoutée dans 05_caisses.sql (dépendance croisée)
  order_number     VARCHAR(50) NOT NULL,
  total_amount     NUMERIC(15, 2) NOT NULL CHECK (total_amount >= 0),
  discount_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_amount       NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  status           VARCHAR(20) NOT NULL DEFAULT 'PAID'
                   CHECK (status IN ('PAID', 'RETURNED', 'PARTIALLY_RETURNED', 'VOIDED')),
  payment_method   VARCHAR(20) NOT NULL
                   CHECK (payment_method IN ('CASH', 'MOBILE_MONEY', 'CARD', 'OTHER')),
  payment_status   VARCHAR(20) NOT NULL DEFAULT 'PAID'
                   CHECK (payment_status IN ('PAID', 'PENDING')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_orders_store_number ON orders (store_id, order_number);

-- Index de performance (cf. §6.4/§10.10 : reporting par vendeur, par période)
CREATE INDEX idx_orders_store_created       ON orders (store_id, created_at DESC);
CREATE INDEX idx_orders_store_seller_date   ON orders (store_id, seller_id, created_at DESC);
CREATE INDEX idx_orders_customer            ON orders (customer_id);
CREATE INDEX idx_orders_cash_drawer         ON orders (cash_drawer_id);

-- Aucune vente validée ne peut être supprimée physiquement (§5.3/§12) :
-- seul un changement de statut (RETURNED / VOIDED) est permis via un flux
-- métier dédié et tracé (retours/avoirs), jamais une suppression.
CREATE TRIGGER trg_orders_no_delete
  BEFORE DELETE ON orders
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();

-- ----------------------------------------------------------------------------
-- ORDER_ITEMS — lignes de vente. Le prix est figé au moment de la transaction.
-- ----------------------------------------------------------------------------
CREATE TABLE order_items (
  id           SERIAL PRIMARY KEY,
  order_id     INTEGER NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
  product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  returned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (returned_quantity >= 0),

  CONSTRAINT chk_returned_not_exceed_quantity CHECK (returned_quantity <= quantity)
);

CREATE INDEX idx_order_items_order   ON order_items (order_id);
CREATE INDEX idx_order_items_product ON order_items (product_id);

-- Une ligne de vente ne doit jamais être modifiable a posteriori dans son
-- prix ou sa quantité d'origine (§4.6) ; seule la colonne returned_quantity
-- peut évoluer, dans le cadre du flux de retour (§5.3).
CREATE OR REPLACE FUNCTION prevent_order_item_core_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantity <> OLD.quantity
     OR NEW.unit_price <> OLD.unit_price
     OR NEW.product_id <> OLD.product_id
     OR NEW.order_id <> OLD.order_id THEN
    RAISE EXCEPTION
      'Une ligne de vente validée ne peut pas être modifiée sur sa quantité, son prix ou son produit (order_items.id=%).',
      OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_order_items_no_core_update
  BEFORE UPDATE ON order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_order_item_core_update();

CREATE TRIGGER trg_order_items_no_delete
  BEFORE DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_delete();
