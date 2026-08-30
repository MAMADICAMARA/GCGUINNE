-- ============================================================================
-- 45_transfert_de_stock.sql
-- Domaine : Transfert de stock entre boutiques (§ décidé en conversation)
-- ============================================================================
-- stock_transfers existe depuis §06_multi_boutiques.sql avec un commentaire
-- d'origine « transferts entre boutiques d'un même propriétaire » — jamais
-- possible depuis que owner_id est UNIQUE sur stores (un compte ne possède
-- qu'une seule boutique, §uq_stores_owner_id). Cette table n'a donc jamais
-- eu de code applicatif. Réinterprétée ici pour un usage réellement
-- possible : un transfert entre boutiques de propriétaires DIFFÉRENTS,
-- reliées par un code de partage — même principe que supervision_code
-- (§12) et supplier_code (§18), un troisième niveau de confiance
-- volontairement DISTINCT des deux autres (mélanger les codes mélangerait
-- des relations de nature différente : superviser en lecture seule,
-- acheter à un fournisseur, ou ici, envoyer physiquement du stock).
--
-- Le transfert est instantané (pas de statut IN_TRANSIT/étape de
-- réception séparée, décidé en conversation) : au clic sur "Confirmer",
-- le stock est immédiatement retiré de la boutique source et un nouveau
-- produit est créé dans la boutique destination (les deux catalogues sont
-- indépendants, aucun lien automatique entre "le même" produit dans deux
-- boutiques n'existe ailleurs dans le projet). status passe directement à
-- 'RECEIVED', shipped_at = received_at = NOW(). Les statuts 'INITIATED'/
-- 'IN_TRANSIT' du schéma d'origine restent inutilisés pour l'instant (non
-- retirés du CHECK : réutilisables si un jour un vrai flux d'expédition
-- est demandé, sans nouvelle migration).
--
-- N'est permis qu'entre deux boutiques du MÊME store_type_id (décidé en
-- conversation) — vérifié à la fois côté lecture (résolution du code) et
-- côté écriture (création du transfert), jamais confié au seul frontend.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Code de transfert, propre à chaque boutique, régénérable par son
-- propriétaire depuis les paramètres — même mécanisme exact que
-- supervision_code/supplier_code (alphabet non-ambigu, généré côté
-- application par generateShareCode()).
-- ----------------------------------------------------------------------------
ALTER TABLE stores ADD COLUMN transfer_code VARCHAR(20);

UPDATE stores
SET transfer_code = UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FOR 12))
WHERE transfer_code IS NULL;

ALTER TABLE stores ALTER COLUMN transfer_code SET NOT NULL;
ALTER TABLE stores ADD CONSTRAINT uq_stores_transfer_code UNIQUE (transfer_code);

-- ----------------------------------------------------------------------------
-- to_product_id : le produit créé côté boutique DESTINATION (product_id,
-- existant depuis §06, reste le produit de la boutique SOURCE — celui
-- réellement décrémenté). Sans cette colonne, impossible de retrouver
-- depuis un transfert la fiche produit nouvellement créée chez le
-- destinataire. ON DELETE SET NULL (pas RESTRICT) : un Owner reste libre
-- de désactiver/modifier son produit reçu sans que ça bloque quoi que ce
-- soit sur l'historique du transfert lui-même — seule la ligne
-- stock_transfers a une valeur de preuve immuable, pas le lien vers l'état
-- courant du produit.
-- ----------------------------------------------------------------------------
ALTER TABLE stock_transfers ADD COLUMN to_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL;
