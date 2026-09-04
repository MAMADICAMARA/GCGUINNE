-- ============================================================================
-- 49_confirmation_livraison_fournisseur.sql
-- Domaine : Confirmation de livraison par le fournisseur AVANT réception
-- ============================================================================
-- Faille signalée par l'utilisateur, vérifiée dans le code (§ décidé en
-- conversation) : une commande passée auprès d'un fournisseur DE LA
-- PLATEFORME (supplier_store_id) ne connaissait que PENDING/RECEIVED/
-- CANCELLED. `receivePurchaseOrder` (purchases.service.js) n'exigeait que
-- status = 'PENDING' — exactement le statut initial dès la création — donc
-- l'ACHETEUR pouvait créer une commande puis la marquer "reçue"
-- immédiatement, décrémentant le stock du fournisseur sans qu'il n'ait
-- jamais rien confirmé. Le fournisseur n'avait d'ailleurs aucune action
-- possible (route /received-orders strictement en lecture).
--
-- Nouveau statut DELIVERED, entre PENDING et RECEIVED : le FOURNISSEUR
-- confirme l'expédition avant que l'acheteur puisse confirmer réception.
--
-- `requires_delivery_confirmation` (prudence production, décidé en
-- conversation) : n'affecte QUE les commandes créées APRÈS ce correctif.
-- DEFAULT TRUE pour toute nouvelle ligne (donc pour toute commande créée
-- dès que cette migration est appliquée) ; l'UPDATE juste après repasse
-- TOUTES les lignes déjà existantes à FALSE, un instantané pris au moment
-- de la migration — ces commandes déjà en cours gardent l'ancien
-- comportement (réception directe depuis PENDING) pour ne jamais bloquer
-- une commande déjà en vol au moment du déploiement.
--
-- Ne s'applique qu'aux commandes venant d'un fournisseur DE LA PLATEFORME
-- (supplier_store_id) — un fournisseur externe (supplier_contacts, simple
-- carnet d'adresses texte libre) n'a pas de compte sur la plateforme pour
-- confirmer quoi que ce soit ; receivePurchaseOrder ne doit exiger DELIVERED
-- que si supplier_store_id IS NOT NULL, jamais pour supplier_id.
-- ============================================================================

ALTER TABLE purchase_orders DROP CONSTRAINT purchases_status_check;
ALTER TABLE purchase_orders ADD CONSTRAINT purchases_status_check
  CHECK (status IN ('PENDING', 'DELIVERED', 'RECEIVED', 'CANCELLED'));

ALTER TABLE purchase_orders ADD COLUMN requires_delivery_confirmation BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE purchase_orders SET requires_delivery_confirmation = FALSE;

ALTER TABLE purchase_orders ADD COLUMN delivered_at TIMESTAMPTZ;
ALTER TABLE purchase_orders ADD COLUMN delivered_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
