-- ============================================================================
-- 24_reparation_schema.sql
-- Domaine : Réparation d'écarts entre la base réelle et les migrations
-- ============================================================================
-- Décidé en conversation (§A3/A4 de SOLUTIONS_AUDIT_PRODUCTION.md, suite à
-- AUDIT_PRODUCTION.md) : écarts confirmés entre la base réelle et les
-- fichiers de migration existants, qui empêchaient de recréer la base à
-- l'identique à partir de zéro. Ce fichier documente rétroactivement ce qui
-- existe déjà en base — il n'invente rien de nouveau.
--
-- Points 4-7 ajoutés le 2026-08-06 : trouvés en comparant, colonne par
-- colonne et contrainte par contrainte, une base reconstruite à partir des
-- seules migrations contre la base réelle (§A2 de DEPLOIEMENT_PRODUCTION.md)
-- — méthode qui a aussi permis de repérer et corriger 08_super_admin.sql/
-- 09_profil_utilisateur.sql (voir ces fichiers). Ces quatre éléments-ci
-- existent déjà sur la base réelle, rien à y exécuter — seulement à
-- documenter pour qu'une future base neuve (Render) les reproduise aussi.
--
-- Écrit pour être sûr à rejouer sur la base actuelle sans erreur
-- (idempotent) : chaque instruction vérifie d'abord que l'élément n'existe
-- pas avant de l'ajouter, donc sans effet sur l'environnement où ces
-- éléments existent déjà.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. customer_payments — table déjà utilisée par
--    backend/src/modules/customers/customers.service.js (recordPayment,
--    listCustomerPayments) mais absente de tout fichier de migration.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_payments (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments (customer_id);

-- ----------------------------------------------------------------------------
-- 2. uq_stores_owner_id — "un compte ne possède qu'une seule boutique",
--    règle centrale (Superviser, transfert de propriété), déjà active en
--    base réelle mais jamais déclarée dans 01_plateforme_et_comptes.sql.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_stores_owner_id'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT uq_stores_owner_id UNIQUE (owner_id);
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Valeur par défaut corrompue de stores.country — une migration
--    historique a été appliquée avec un mauvais encodage client, laissant
--    'GuinÃ©e' au lieu de 'Guinée' comme défaut de colonne. Sans
--    conséquence pratique aujourd'hui (le code applicatif fournit toujours
--    explicitement la valeur), mais corrigé pour ne pas propager l'erreur
--    à une insertion directe qui s'appuierait sur ce défaut.
-- ----------------------------------------------------------------------------
ALTER TABLE stores ALTER COLUMN country SET DEFAULT 'Guinée';

-- ----------------------------------------------------------------------------
-- 4. customers.balance_due — solde dû par le client (paiement partiel),
--    déjà utilisée par customers.service.js mais absente de tout fichier
--    de migration.
-- ----------------------------------------------------------------------------
ALTER TABLE customers ADD COLUMN IF NOT EXISTS balance_due NUMERIC(15, 2) NOT NULL DEFAULT 0
  CHECK (balance_due >= 0);
CREATE INDEX IF NOT EXISTS idx_customers_balance_due ON customers (store_id, balance_due)
  WHERE (balance_due > 0);

-- ----------------------------------------------------------------------------
-- 5. orders.amount_paid — montant réellement encaissé à la vente (distinct
--    de total_amount depuis l'introduction du paiement partiel), déjà
--    utilisée par orders.service.js mais absente de tout fichier de
--    migration.
-- ----------------------------------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(15, 2) NOT NULL DEFAULT 0
  CHECK (amount_paid >= 0);

-- ----------------------------------------------------------------------------
-- 6. orders.payment_status — 'PARTIALLY_PAID' manquant de la contrainte
--    d'origine (03_clients_et_ventes.sql ne connaît que 'PAID'/'PENDING'),
--    alors que le paiement partiel est une fonctionnalité déjà en
--    production. DROP + ADD plutôt qu'un simple ajout : une contrainte
--    CHECK ne peut pas être "élargie" en place.
-- ----------------------------------------------------------------------------
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('PAID', 'PARTIALLY_PAID', 'PENDING'));

-- ----------------------------------------------------------------------------
-- 7. stock_movements.type — 'INITIAL_STOCK' manquant de la contrainte
--    d'origine (02_catalogue_et_stock.sql), alors que products.service.js
--    l'utilise déjà pour tracer le stock de départ à la création d'un
--    produit.
-- ----------------------------------------------------------------------------
ALTER TABLE stock_movements DROP CONSTRAINT IF EXISTS stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT',
    'TRANSFER_OUT', 'TRANSFER_IN', 'INITIAL_STOCK'
  ));
