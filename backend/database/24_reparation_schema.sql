-- ============================================================================
-- 24_reparation_schema.sql
-- Domaine : Réparation d'écarts entre la base réelle et les migrations
-- ============================================================================
-- Décidé en conversation (§A3/A4 de SOLUTIONS_AUDIT_PRODUCTION.md, suite à
-- AUDIT_PRODUCTION.md) : trois écarts confirmés entre la base réelle et les
-- fichiers de migration existants, qui empêchaient de recréer la base à
-- l'identique à partir de zéro. Ce fichier documente rétroactivement ce qui
-- existe déjà en base — il n'invente rien de nouveau.
--
-- Écrit pour être sûr à rejouer sur la base actuelle sans erreur
-- (idempotent) : chaque instruction vérifie d'abord que l'élément n'existe
-- pas avant de l'ajouter, donc sans effet sur l'environnement où ces trois
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
