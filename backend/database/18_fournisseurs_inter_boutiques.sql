-- ============================================================================
-- 18_fournisseurs_inter_boutiques.sql
-- Domaine : Lien fournisseur entre deux boutiques de la plateforme
-- ============================================================================
-- Contexte métier (décidé en conversation) : un Owner peut être fournisseur
-- d'un autre Owner. Cette étape couvre UNIQUEMENT la consultation du
-- catalogue produit du fournisseur (nom, image, catégorie) — jamais son
-- prix ni sa quantité en stock, qui restent son information commerciale
-- exclusive. La commande d'achat réelle via la plateforme reste hors
-- périmètre pour l'instant (décidé en conversation).
--
-- Le rattachement se fait via un CODE DE PARTAGE aléatoire et non-devinable,
-- jamais l'identifiant numérique brut de la boutique — même principe que
-- §12_supervision.sql : un ID séquentiel serait énumérable et donc une
-- fuite de données pour toute la plateforme.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Code fournisseur, propre à chaque boutique, régénérable par son
-- propriétaire depuis les paramètres. Volontairement DISTINCT de
-- supervision_code : ce code n'ouvre qu'un accès en lecture au catalogue
-- produit, jamais au tableau de bord, aux ventes ni au stock (contrairement
-- à la supervision) — mélanger les deux codes mélangerait deux niveaux de
-- confiance très différents.
-- ----------------------------------------------------------------------------
ALTER TABLE stores ADD COLUMN supplier_code VARCHAR(20);

-- Backfill des boutiques déjà existantes avec un code aléatoire, pour que
-- la colonne puisse ensuite devenir NOT NULL + UNIQUE.
UPDATE stores
SET supplier_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FOR 12))
WHERE supplier_code IS NULL;

ALTER TABLE stores ALTER COLUMN supplier_code SET NOT NULL;
ALTER TABLE stores ADD CONSTRAINT uq_stores_supplier_code UNIQUE (supplier_code);

-- ----------------------------------------------------------------------------
-- STORE_SUPPLIER_LINKS — qui (buyer_store_id) a ajouté quelle boutique
-- (supplier_store_id) comme fournisseur. Table volontairement séparée de
-- `suppliers` (carnet d'adresses texte libre, utilisé pour les achats
-- manuels avec des fournisseurs hors plateforme) : ici les DEUX parties
-- sont des comptes réels de la plateforme, reliés par un code plutôt que
-- saisis à la main.
--
-- Décidé en conversation : le fournisseur voit la liste de qui l'a ajouté
-- (ses "clients") et peut retirer un client précis — contrairement à la
-- supervision, où le supervisé ignore qui le supervise.
-- ----------------------------------------------------------------------------
CREATE TABLE store_supplier_links (
  id                  SERIAL PRIMARY KEY,
  buyer_store_id      INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  supplier_store_id   INTEGER NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_store_supplier_link UNIQUE (buyer_store_id, supplier_store_id),
  -- Garde-fou en base (défense en profondeur, même principe que
  -- l'anti-survente sur products.quantity) : une boutique ne peut jamais
  -- être sa propre fournisseuse, même en cas de bug côté service.
  CONSTRAINT chk_store_supplier_no_self_link CHECK (buyer_store_id <> supplier_store_id)
);

CREATE INDEX idx_store_supplier_links_buyer    ON store_supplier_links (buyer_store_id);
CREATE INDEX idx_store_supplier_links_supplier ON store_supplier_links (supplier_store_id);
