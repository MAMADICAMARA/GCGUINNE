-- ============================================================================
-- 23_personnalisation_recu.sql
-- Domaine : Personnalisation du reçu de vente
-- ============================================================================
-- Décidé en conversation : le Owner peut personnaliser un sous-ensemble
-- structuré du reçu généré après une vente (message d'en-tête, message de
-- pied de page, affichage ou non de l'adresse/téléphone/vendeur) — pas un
-- éditeur libre type traitement de texte (positionnement/polices/logo),
-- jugé disproportionné et fragile pour un reçu de petite boutique : il
-- faudrait sinon garder trois rendus (écran, PDF, impression thermique
-- 80mm) fidèles à une mise en page arbitraire.
--
-- '{}'::jsonb par défaut : une boutique qui n'a jamais rien configuré
-- garde exactement le comportement actuel du reçu (les valeurs par défaut
-- sont appliquées en code, jamais stockées en base tant qu'inchangées).
-- ============================================================================

ALTER TABLE stores ADD COLUMN receipt_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
