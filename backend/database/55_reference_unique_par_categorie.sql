-- ============================================================================
-- 55_reference_unique_par_categorie.sql
-- Domaine : Référence produit unique par catégorie (plutôt que par boutique)
-- ============================================================================
-- La référence produit était unique par boutique ; elle doit maintenant
-- l'être seulement par (boutique, catégorie) — décidé en conversation :
-- plusieurs pièces différentes pour un même modèle d'appareil (écran,
-- batterie, plaquette de charge...) partagent souvent le même code
-- constructeur, mais sont des produits distincts dans des catégories
-- distinctes.
-- ============================================================================

DROP INDEX uq_products_store_reference;

CREATE UNIQUE INDEX uq_products_store_category_reference
  ON products (store_id, category_id, reference)
  WHERE reference IS NOT NULL;
-- category_id étant NULLable, deux produits SANS catégorie ne sont plus
-- protégés entre eux contre les doublons de référence (NULL n'est jamais
-- égal à NULL dans un index unique) — comportement cohérent avec le
-- principe demandé ("catégories différentes ⇒ pas de conflit"), effet de
-- bord mineur et accepté.
