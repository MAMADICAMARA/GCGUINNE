-- ============================================================================
-- 28_commandes_achat_premium.sql
-- Domaine : Commandes d'achat fournisseur, exclusif au plan PREMIUM
-- ============================================================================
-- Active enfin les tables `suppliers`/`purchases`/`purchase_items`
-- (04_fournisseurs_et_achats.sql), créées dès le début du projet mais
-- jamais reliées à aucun code applicatif jusqu'ici (§B2 SOLUTIONS_AUDIT_PRODUCTION.md).
--
-- Renommage (§B3 SOLUTIONS_AUDIT_PRODUCTION.md, décidé en conversation) :
-- `suppliers` devient `supplier_contacts` et `purchases`/`purchase_items`
-- deviennent `purchase_orders`/`purchase_order_items`, pour ne plus jamais
-- confondre avec `store_supplier_links` (§18_fournisseurs_inter_boutiques.sql)
-- — un système totalement différent (lien entre deux boutiques de la
-- plateforme, jamais un carnet d'adresses texte libre). Aucun code
-- applicatif ne référençait encore ces tables (vérifié), le renommage ne
-- casse donc rien.
--
-- `allows_purchase_orders` (décidé en conversation) : avantage exclusif du
-- plan PREMIUM face à STANDARD — FALSE par défaut pour tous les plans
-- existants, activé explicitement seulement pour PREMIUM ci-dessous. Suit
-- exactement le même mécanisme que `allows_supervision`/`allows_suppliers`
-- (20_plans_abonnement.sql) : un booléen par plan, vérifié à chaque requête
-- via getEffectivePlan (jamais mis en cache), middleware `requirePlanFeature`
-- réutilisé tel quel.
--
-- `purchase_orders.received_by` : qui a marqué la commande reçue (manquant
-- dans le schéma d'origine) — cohérent avec la traçabilité déjà exigée
-- partout ailleurs cette session (annulation/retour de vente, etc.).
--
-- `purchase_order_items` immuable (comme `order_items` pour les ventes,
-- dans l'esprit, mais ici sans équivalent de "retour partiel" : une ligne
-- de commande d'achat ne change jamais après création) — aucune UPDATE/DELETE
-- possible, seul le statut de la commande elle-même évolue
-- (PENDING -> RECEIVED/CANCELLED, déjà protégé en écriture par le service,
-- jamais exposé en édition libre).
-- ============================================================================

ALTER TABLE suppliers RENAME TO supplier_contacts;
ALTER TABLE purchases RENAME TO purchase_orders;
ALTER TABLE purchase_items RENAME TO purchase_order_items;

ALTER TABLE purchase_orders ADD COLUMN received_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE subscription_plans ADD COLUMN allows_purchase_orders BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE subscription_plans SET allows_purchase_orders = TRUE WHERE name = 'PREMIUM';

CREATE TRIGGER trg_purchase_order_items_immutable
  BEFORE UPDATE OR DELETE ON purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION prevent_update_delete();
  
