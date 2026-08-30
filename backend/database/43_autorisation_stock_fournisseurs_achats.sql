-- ============================================================================
-- 43_autorisation_stock_fournisseurs_achats.sql
-- Domaine : Autorisations vendeur — Stock, Fournisseurs, Achats
-- ============================================================================
-- Même principe exact que 25_autorisation_annulation_retour.sql /
-- 39_prix_editable_vente.sql / 40_autorisation_ajout_produit.sql (décidé en
-- conversation) — un flag "tous les vendeurs" par domaine, combiné en OR
-- avec le réglage individuel déjà porté par user_store.permissions (JSONB,
-- créé en 01_plateforme_et_comptes.sql, aucune nouvelle colonne nécessaire
-- pour ça).
--
-- Stock : GET /products et /products/:id/stock-history restent ouverts à
-- tout vendeur comme aujourd'hui (consultation nécessaire pour la Caisse) —
-- seul POST /products/:id/adjust-stock (jusqu'ici Owner uniquement) devient
-- conditionné à ce nouveau flag.
--
-- Fournisseurs et Achats : modules jusqu'ici intégralement réservés au
-- Owner (aucun accès vendeur, même en lecture) — le flag ouvre le module
-- entier à un vendeur autorisé, exactement comme le voit le Owner (la
-- restriction PREMIUM sur la création de commande d'achat,
-- §28_commandes_achat_premium.sql, reste inchangée et s'applique de la
-- même façon à un vendeur autorisé qu'au Owner).
-- ============================================================================

ALTER TABLE stores ADD COLUMN allow_all_sellers_manage_stock BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN allow_all_sellers_manage_suppliers BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN allow_all_sellers_manage_purchases BOOLEAN NOT NULL DEFAULT false;
