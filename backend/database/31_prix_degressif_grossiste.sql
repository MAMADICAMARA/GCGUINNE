-- ============================================================================
-- 31_prix_degressif_grossiste.sql
-- Domaine : Prix dégressif par palier de quantité (vente en gros)
-- ============================================================================
-- Décidé en conversation : le Owner peut définir, PAR PRODUIT, un ou
-- plusieurs paliers "à partir de N unités, prix unitaire réduit à P" — par
-- exemple 1 pneu = 100 000 GNF, mais à partir de 10 pneus, 85 000 GNF/pneu.
-- Modèle retenu délibérément PAR QUANTITÉ (universel, s'applique à
-- n'importe quel client dès qu'il achète assez d'un coup), PAS par type de
-- client — aucune notion de "client grossiste" n'est introduite ici.
--
-- Fonctionnalité entièrement optionnelle et ouverte à TOUS les plans, y
-- compris FREEMIUM (décidé en conversation) : aucune vérification de plan
-- nulle part, cohérent avec le reste du module Produits qui n'a jamais été
-- verrouillé par palier d'abonnement.
--
-- `min_quantity > 1` (jamais 1) : un palier à quantité 1 remplacerait tout
-- simplement `products.selling_price`, qui couvre déjà ce cas par défaut —
-- l'autoriser créerait une source de confusion inutile.
--
-- La validation "le prix baisse strictement à mesure que la quantité
-- minimum augmente" et "aucun palier ne dépasse le prix de vente normal"
-- est faite côté service (products.service.js), jamais en base : elle
-- porte sur PLUSIEURS lignes à la fois (comparaison entre paliers, et avec
-- products.selling_price), ce qu'un simple CHECK ne peut pas exprimer.
-- ============================================================================

CREATE TABLE product_price_tiers (
  id            SERIAL PRIMARY KEY,
  product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  min_quantity  INTEGER NOT NULL CHECK (min_quantity > 1),
  unit_price    NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_product_price_tiers_qty UNIQUE (product_id, min_quantity)
);

CREATE INDEX idx_product_price_tiers_product ON product_price_tiers (product_id);
