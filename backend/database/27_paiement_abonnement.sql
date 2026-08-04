-- ============================================================================
-- 27_paiement_abonnement.sql
-- Domaine : Paiement déclaratif d'abonnement (Orange Money / Mobile Money /
--           PayCard) avec vérification Super Admin
-- ============================================================================
-- Décidé en conversation, suite à §B2/§B3 SOLUTIONS_AUDIT_PRODUCTION.md (la
-- table `invoices` existante ne convient pas à cet usage — pas de statut
-- "en attente", pas de méthode/référence/preuve, pas de notion de demande
-- soumise par le Owner ; laissée intacte et inutilisée) :
--
-- Aucun identifiant d'API réel (Orange Money/Mobile Money/carte) n'étant
-- disponible pour ce projet, le paiement est DÉCLARATIF : le Owner indique
-- avoir payé (méthode + référence de transaction), la demande passe en
-- attente, et le Super Admin la confirme après vérification manuelle de son
-- propre relevé — la confirmation appelle alors EXACTEMENT
-- `activateStorePlan` (admin.service.js), déjà existante et déjà utilisée
-- par l'activation 100% manuelle actuelle, jamais dupliquée. Cette dernière
-- reste intacte et fonctionne en parallèle, indépendamment de ce chantier.
--
-- `amount_declared` : jamais saisi par le Owner, toujours calculé côté
-- serveur à partir du prix du plan au moment de la soumission (immuable
-- ensuite même si le prix du plan est modifié plus tard) — empêche un Owner
-- de déclarer un montant arbitraire.
--
-- Un seul index unique partiel garantit qu'une boutique n'a jamais plus
-- d'une demande PENDING simultanée (anti-spam simple, pas besoin de plus).
--
-- `platform_payment_settings` : ligne singleton (id toujours 1) où le
-- Super Admin configure ses VRAIS numéros/coordonnées — jamais de valeur
-- inventée dans le code, la ligne démarre vide (NULL) et le Owner voit
-- "non configuré" tant qu'elle ne l'est pas.
-- ============================================================================

CREATE TABLE subscription_payment_requests (
  id                     SERIAL PRIMARY KEY,
  store_id               INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  requested_by           INTEGER NOT NULL REFERENCES users(id),
  plan_id                INTEGER NOT NULL REFERENCES subscription_plans(id),
  payment_method         VARCHAR(20) NOT NULL
                         CHECK (payment_method IN ('ORANGE_MONEY', 'MOBILE_MONEY', 'PAYCARD')),
  payer_phone            VARCHAR(30),
  transaction_reference  VARCHAR(100) NOT NULL,
  amount_declared        NUMERIC(10, 2) NOT NULL CHECK (amount_declared > 0),
  status                 VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                         CHECK (status IN ('PENDING', 'CONFIRMED', 'REJECTED')),
  rejection_reason       TEXT,
  reviewed_by            INTEGER REFERENCES users(id),
  reviewed_at            TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_payment_requests_one_pending_per_store
  ON subscription_payment_requests (store_id)
  WHERE status = 'PENDING';

CREATE INDEX idx_payment_requests_status ON subscription_payment_requests (status, created_at DESC);
CREATE INDEX idx_payment_requests_store  ON subscription_payment_requests (store_id, created_at DESC);

CREATE TABLE platform_payment_settings (
  id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  orange_money_number   VARCHAR(30),
  mobile_money_number   VARCHAR(30),
  paycard_info          TEXT,
  contact_phone         VARCHAR(30),
  contact_whatsapp      VARCHAR(30),
  contact_email         VARCHAR(150),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_payment_settings (id) VALUES (1);
