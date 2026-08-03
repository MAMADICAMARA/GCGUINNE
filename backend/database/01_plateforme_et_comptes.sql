-- ============================================================================
-- 01_plateforme_et_comptes.sql
-- Domaine : Plateforme, abonnements, utilisateurs, boutiques, rattachements
-- Priorité cahier des charges : P0 (roles, users, stores, user_store)
--                                P2 (subscription_plans — facturation SaaS)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ROLES — référentiel fermé (cf. §3 du cahier des charges)
-- ----------------------------------------------------------------------------
-- Pas de rôle MANAGER (décidé en conversation, contexte guinéen : dans une
-- petite boutique, le Vendeur/Caissier gère aussi bien la vente que le
-- stock/produits au quotidien — l'Owner garde pour lui seul équipe,
-- abonnement et paramètres).
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE
              CHECK (code IN ('SUPER_ADMIN', 'OWNER', 'SELLER')),
  label       VARCHAR(50) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO roles (code, label) VALUES
  ('SUPER_ADMIN', 'Super administrateur'),
  ('OWNER',       'Propriétaire'),
  ('SELLER',      'Vendeur / Caissier');

-- ----------------------------------------------------------------------------
-- USERS — comptes utilisateurs, indépendants de toute boutique
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  full_name      VARCHAR(150) NOT NULL,
  email          VARCHAR(150) NOT NULL UNIQUE,
  password_hash  VARCHAR(255) NOT NULL,
  phone          VARCHAR(30),
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
                 CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recherche insensible à la casse sur l'e-mail (connexion)
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));

-- ----------------------------------------------------------------------------
-- SUBSCRIPTION_PLANS — offres commerciales du SaaS (P2, cf. §6.4)
-- Table créée dès P0 car "stores" y fait référence, mais son exploitation
-- fonctionnelle (facturation) n'est développée qu'en P2.
-- ----------------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id                    SERIAL PRIMARY KEY,
  name                  VARCHAR(50) NOT NULL UNIQUE,
  max_stores            INTEGER NOT NULL DEFAULT 1 CHECK (max_stores > 0),
  max_users_per_store   INTEGER NOT NULL DEFAULT 1 CHECK (max_users_per_store > 0),
  features              JSONB NOT NULL DEFAULT '{}'::jsonb,
  price                 NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO subscription_plans (name, max_stores, max_users_per_store, features, price) VALUES
  ('FREEMIUM', 1, 1,  '{"cash_drawer": false, "multi_seller": false}'::jsonb,   0),
  ('STANDARD', 1, 5,  '{"cash_drawer": true,  "multi_seller": true}'::jsonb,   150000),
  ('PREMIUM',  5, 15, '{"cash_drawer": true,  "multi_seller": true, "stock_transfer": true, "consolidated_dashboard": true}'::jsonb, 350000);

-- ----------------------------------------------------------------------------
-- STORES — boutiques (tenants), cf. §4.2
-- ----------------------------------------------------------------------------
CREATE TABLE stores (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  owner_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  plan_id      INTEGER REFERENCES subscription_plans(id) ON DELETE SET NULL,
  category     VARCHAR(100),          -- ex: "Téléphonie", "Pièces moto", "Alimentation"
  logo_url     TEXT,
  phone        VARCHAR(30),
  email        VARCHAR(150),
  address      TEXT,
  city         VARCHAR(100),
  country      VARCHAR(100) NOT NULL DEFAULT 'Guinée',
  status       VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
               CHECK (status IN ('ACTIVE', 'SUSPENDED', 'TRIAL')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_stores_owner ON stores (owner_id);
CREATE INDEX idx_stores_status ON stores (status);

-- ----------------------------------------------------------------------------
-- USER_STORE — rattachement utilisateur <-> boutique avec rôle et permissions
-- fines (table de liaison critique, cf. §3.2, §4.3, §6.1)
-- ----------------------------------------------------------------------------
CREATE TABLE user_store (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  store_id           INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  role_id            INTEGER NOT NULL REFERENCES roles(id)  ON DELETE RESTRICT,
  permissions        JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default_store   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_store UNIQUE (user_id, store_id)
);

CREATE INDEX idx_user_store_composite ON user_store (user_id, store_id);
CREATE INDEX idx_user_store_store     ON user_store (store_id);

-- Un utilisateur ne peut avoir qu'une seule boutique par défaut
CREATE UNIQUE INDEX uq_user_store_one_default
  ON user_store (user_id)
  WHERE is_default_store = TRUE;
