-- ============================================================================
-- 50_fusion_produits_doublons.sql
-- Domaine : Fusion de deux fiches produit en double (même boutique)
-- ============================================================================
-- § décidé en conversation, option "E" de la discussion sur les doublons
-- créés par le module Achats fournisseur (§49_confirmation_livraison_fournisseur.sql
-- et le rapprochement automatique à la commande) — un Owner peut fusionner
-- deux fiches produit qu'il a fini par dupliquer par erreur : le stock du
-- produit fusionné est transféré vers le produit gardé, puis le produit
-- fusionné est désactivé (JAMAIS supprimé — même principe que le reste de
-- l'app, l'historique de mouvements de stock déjà lié à lui reste intact).
--
-- Deux nouveaux types de mouvement, symétriques à TRANSFER_IN/TRANSFER_OUT
-- déjà existants — jamais réutilisé ADJUSTMENT (sémantique différente : un
-- ajustement d'inventaire manuel, pas une fusion de deux fiches).
-- ============================================================================

ALTER TABLE stock_movements DROP CONSTRAINT stock_movements_type_check;
ALTER TABLE stock_movements ADD CONSTRAINT stock_movements_type_check
  CHECK (type IN (
    'PURCHASE_IN', 'SALE_OUT', 'RETURN_IN', 'ADJUSTMENT',
    'TRANSFER_OUT', 'TRANSFER_IN', 'INITIAL_STOCK', 'MERGE_IN', 'MERGE_OUT'
  ));
