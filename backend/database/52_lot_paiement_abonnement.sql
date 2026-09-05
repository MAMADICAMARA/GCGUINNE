-- ============================================================================
-- 52_lot_paiement_abonnement.sql
-- Domaine : Paiement groupé de l'abonnement de plusieurs boutiques
--           supervisées en une seule fois ("Payer pour toutes")
-- ============================================================================
-- Décidé en conversation : le superviseur choisit UN plan + UNE durée, une
-- seule fois, appliqués à TOUTES ses boutiques supervisées d'un coup (un
-- seul virement réel de sa part) — mais chaque boutique garde sa PROPRE
-- ligne dans subscription_payment_requests (montant individuel, jamais
-- multiplié) pour que le Super Admin puisse activer/rejeter chaque
-- boutique indépendamment, exactement comme pour une demande normale.
--
-- `batch_id` relie ces lignes entre elles pour l'affichage groupé côté
-- Super Admin — délibérément un identifiant technique généré côté serveur
-- (crypto.randomUUID(), déjà utilisé ailleurs dans ce backend), PAS un
-- regroupement par transaction_reference : deux paiements réels différents
-- pourraient un jour partager accidentellement le même texte de référence,
-- ce qui mélangerait à tort deux lots distincts. La référence reste de
-- toute façon affichée et sert toujours à la vérification manuelle.
--
-- NULL pour toute demande normale (hors "payer pour toutes") — comportement
-- inchangé pour tout ce qui existe déjà.
-- ============================================================================

ALTER TABLE subscription_payment_requests
  ADD COLUMN batch_id UUID NULL;

CREATE INDEX idx_payment_requests_batch ON subscription_payment_requests (batch_id) WHERE batch_id IS NOT NULL;
