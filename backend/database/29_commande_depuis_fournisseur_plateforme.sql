-- ============================================================================
-- 29_commande_depuis_fournisseur_plateforme.sql
-- Domaine : Commande d'achat passée directement depuis le catalogue d'un
--           fournisseur DE LA PLATEFORME (store_supplier_links), pas
--           seulement un fournisseur externe (supplier_contacts)
-- ============================================================================
-- Décidé en conversation, en continuité de §28_commandes_achat_premium.sql :
-- une commande d'achat (`purchase_orders`) peut désormais venir de DEUX
-- origines distinctes, jamais les deux à la fois :
--   - un fournisseur externe (`supplier_id` -> supplier_contacts, déjà
--     existant, inchangé) ;
--   - un fournisseur DE LA PLATEFORME (`supplier_store_id` -> stores),
--     relation déjà établie via store_supplier_links
--     (18_fournisseurs_inter_boutiques.sql).
-- La contrainte XOR ci-dessous garantit qu'une commande a toujours
-- exactement UNE origine, jamais aucune ni les deux — aucune ligne
-- existante n'est affectée (elles ont toutes déjà supplier_id renseigné).
--
-- `purchase_order_items.supplier_product_id` (nullable, NULL pour un
-- fournisseur externe) : quel produit du CATALOGUE DU FOURNISSEUR a donné
-- lieu à cette ligne. Sert à DEUX choses à la réception
-- (purchases.service.js#receivePurchaseOrder) : le stock du BÉNÉFICIAIRE
-- (acheteur) est toujours mis à jour via `product_id`, comme pour un
-- fournisseur externe ; ET, décidé en conversation après coup (la
-- marchandise quitte réellement l'inventaire du fournisseur), le stock du
-- FOURNISSEUR est symétriquement diminué via `supplier_product_id` — donc
-- PAS qu'un simple champ de traçabilité, malgré l'intention initiale.
--
-- `store_supplier_product_links` : la boutique acheteuse n'a pas forcément
-- déjà une fiche produit correspondant à ce que vend le fournisseur — une
-- fiche est créée automatiquement chez l'acheteur à la première commande
-- (décidé en conversation), et cette table retient la correspondance pour
-- que les commandes SUIVANTES du même produit réutilisent la même fiche
-- plutôt que d'en créer une nouvelle à chaque fois.
-- ============================================================================

ALTER TABLE purchase_orders ALTER COLUMN supplier_id DROP NOT NULL;
ALTER TABLE purchase_orders ADD COLUMN supplier_store_id INTEGER REFERENCES stores(id) ON DELETE RESTRICT;
ALTER TABLE purchase_orders ADD CONSTRAINT chk_purchase_orders_supplier_xor
  CHECK ((supplier_id IS NOT NULL) <> (supplier_store_id IS NOT NULL));

ALTER TABLE purchase_order_items ADD COLUMN supplier_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;

CREATE TABLE store_supplier_product_links (
  id                    SERIAL PRIMARY KEY,
  buyer_store_id        INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_product_id   INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  buyer_product_id      INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_store_supplier_product_link UNIQUE (buyer_store_id, supplier_product_id)
);

CREATE INDEX idx_store_supplier_product_links_buyer ON store_supplier_product_links (buyer_store_id);
