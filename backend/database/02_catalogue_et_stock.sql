-- ============================================================================
-- 02_catalogue_et_stock.sql
-- Domaine : Catégories, produits, mouvements de stock
-- Priorité cahier des charges : P0 (§4.4, §4.5)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- CATEGORIES — propres à chaque boutique, hiérarchie optionnelle
-- ----------------------------------------------------------------------------
CREATE TABLE categories (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  parent_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name        VARCHAR(100) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_store ON categories (store_id);

-- ----------------------------------------------------------------------------
-- PRODUCTS — catalogue produit, cœur du système (§4.4)
-- Les attributs spécifiques par secteur (marque, couleur, dimension...) sont
-- stockés en JSONB pour éviter une table dédiée par type de commerce.
-- ----------------------------------------------------------------------------
CREATE TABLE products (
  id                    SERIAL PRIMARY KEY,
  store_id              INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id           INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  name                  VARCHAR(200) NOT NULL,
  reference             VARCHAR(50),                 -- SKU interne, optionnel
  description           TEXT,
  purchase_price        NUMERIC(15, 2) NOT NULL CHECK (purchase_price >= 0),
  selling_price         NUMERIC(15, 2) NOT NULL CHECK (selling_price >= 0),
  quantity              INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  low_stock_threshold   INTEGER NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  attributes            JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_url             TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Référence unique par boutique (seulement si renseignée)
CREATE UNIQUE INDEX uq_products_store_reference
  ON products (store_id, reference)
  WHERE reference IS NOT NULL;

-- Index de performance (cf. §6.3 / §10.10 du cahier des charges)
CREATE INDEX idx_products_store_qty       ON products (store_id, quantity);
CREATE INDEX idx_products_store_category  ON products (store_id, category_id);
CREATE INDEX idx_products_store_status    ON products (store_id, status);
CREATE INDEX idx_products_name_trgm       ON products USING GIN (name gin_trgm_ops);
CREATE INDEX idx_products_attributes      ON products USING GIN (attributes);

-- ----------------------------------------------------------------------------
-- STOCK_MOVEMENTS — historique immuable de toute variation de stock (§4.5)
-- Aucune quantité en stock ne doit être modifiée directement sans qu'un
-- mouvement correspondant ne soit inséré ici.
-- ----------------------------------------------------------------------------
CREATE TABLE stock_movements (
  id               SERIAL PRIMARY KEY,
  product_id       INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  type             VARCHAR(20) NOT NULL CHECK (type IN (
                     'PURCHASE_IN',   -- réception d'un achat fournisseur
                     'SALE_OUT',      -- vente physique
                     'RETURN_IN',     -- retour client
                     'ADJUSTMENT',    -- ajustement d'inventaire
                     'TRANSFER_OUT',  -- transfert sortant vers une autre boutique
                     'TRANSFER_IN'    -- transfert entrant depuis une autre boutique
                   )),
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost        NUMERIC(15, 2),
  reference_table  VARCHAR(30),   -- ex: 'orders', 'purchases', 'stock_transfers'
  reference_id     INTEGER,       -- id de l'enregistrement d'origine
  user_id          INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_movements_product ON stock_movements (product_id, created_at DESC);
CREATE INDEX idx_stock_movements_ref     ON stock_movements (reference_table, reference_id);

-- Registre immuable : ni modification, ni suppression après écriture.
CREATE TRIGGER trg_stock_movements_no_update_delete
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
