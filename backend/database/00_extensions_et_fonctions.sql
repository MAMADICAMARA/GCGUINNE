-- ============================================================================
-- 00_extensions_et_fonctions.sql
-- Plateforme SaaS de Gestion Commerciale Multi-Boutiques
-- ============================================================================
-- Extensions PostgreSQL et fonctions utilitaires réutilisées par plusieurs
-- tables (mise à jour automatique de "updated_at").
-- ============================================================================

-- Utile pour générer des identifiants lisibles (référence, numéro de facture...)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Recherche texte rapide et tolérante aux fautes de frappe sur les noms de
-- produits (utilisée par l'index idx_products_name_trgm, cf. §4.4/§8.2).
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Fonction générique : met à jour automatiquement la colonne updated_at
-- à chaque UPDATE sur une table qui la possède.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Interdit toute suppression physique sur une table (historique immuable :
-- mouvements de stock, journal d'audit). Cf. cahier des charges §10.1/§10.9 :
-- "aucune suppression physique n'est autorisée sur les données ayant une
-- valeur d'historique ou de preuve".
CREATE OR REPLACE FUNCTION prevent_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Suppression interdite sur la table % : cette donnée a une valeur d''historique et ne peut pas être supprimée physiquement.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Interdit toute modification ET suppression physique (registre totalement
-- immuable, ex. mouvements de stock, journal d'audit).
CREATE OR REPLACE FUNCTION prevent_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'Modification/suppression interdite sur la table % : registre immuable.',
    TG_TABLE_NAME;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
