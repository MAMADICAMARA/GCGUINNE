-- ============================================================================
-- 07_systeme_et_facturation.sql
-- Domaine : Journal d'audit, facturation d'abonnement
-- Priorité cahier des charges : P1 (system_logs, §5.5) / P2 (invoices, §6.4)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SYSTEM_LOGS — journal d'audit des actions sensibles (§5.5)
-- ----------------------------------------------------------------------------
CREATE TABLE system_logs (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id)  ON DELETE SET NULL,
  store_id    INTEGER REFERENCES stores(id) ON DELETE SET NULL, -- NULL si action globale (Super Admin)
  action      VARCHAR(50) NOT NULL,   -- ex: LOGIN, VOID_SALE, CASH_CLOSE, STOCK_TRANSFER
  ip_address  INET,
  details     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_store_date ON system_logs (store_id, created_at DESC);
CREATE INDEX idx_system_logs_user_date  ON system_logs (user_id, created_at DESC);
CREATE INDEX idx_system_logs_action     ON system_logs (action);

-- Registre d'audit totalement immuable : ni modification, ni suppression.
CREATE TRIGGER trg_system_logs_no_update_delete
  BEFORE UPDATE OR DELETE ON system_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();

-- ----------------------------------------------------------------------------
-- INVOICES — facturation d'abonnement SaaS (§6.4)
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
  id                       SERIAL PRIMARY KEY,
  store_id                 INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  period_start             DATE NOT NULL,
  period_end               DATE NOT NULL,
  subscription_amount      NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (subscription_amount >= 0),
  transaction_fees_amount  NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (transaction_fees_amount >= 0),
  sms_usage_amount         NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (sms_usage_amount >= 0),
  total_due                NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total_due >= 0),
  status                   VARCHAR(20) NOT NULL DEFAULT 'UNPAID'
                           CHECK (status IN ('UNPAID', 'PAID', 'OVERDUE')),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_invoice_period CHECK (period_end >= period_start)
);

CREATE INDEX idx_invoices_store_status ON invoices (store_id, status);
CREATE UNIQUE INDEX uq_invoices_store_period ON invoices (store_id, period_start, period_end);
