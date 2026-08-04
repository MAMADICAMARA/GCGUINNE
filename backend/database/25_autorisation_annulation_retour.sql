-- ============================================================================
-- 25_autorisation_annulation_retour.sql
-- Domaine : Autorisation d'annulation/retour de vente par un Vendeur
-- ============================================================================
-- Décidé en conversation : jusqu'ici, annuler ou retourner une vente
-- (POST /orders/:id/void, POST /orders/:orderId/items/:itemId/return)
-- était strictement réservé au Owner (§B1). Le Owner peut désormais
-- autoriser ses Vendeurs à le faire eux-mêmes, sur LEURS PROPRES ventes
-- uniquement (jamais celles d'un collègue) — soit TOUS les vendeurs d'un
-- coup (ce flag), soit vendeur par vendeur (colonne `permissions` JSONB de
-- `user_store`, déjà présente depuis 01_plateforme_et_comptes.sql mais
-- jamais utilisée jusqu'ici — clé `canVoidReturn`, vérifiée en dernier
-- recours si ce flag global est FALSE).
--
-- FALSE par défaut : une boutique qui n'a jamais rien configuré garde
-- exactement le comportement actuel (Owner seul).
-- ============================================================================

ALTER TABLE stores ADD COLUMN allow_all_sellers_void_return BOOLEAN NOT NULL DEFAULT false;
