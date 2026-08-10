-- ============================================================================
-- 35_type_boutique_divers.sql
-- Domaine : Renommage du type de boutique "Autre" en "Divers"
-- ============================================================================
-- Décidé en conversation : "Autre" (§22_types_de_boutique.sql, aucune
-- catégorie suggérée, saisie 100% manuelle) devient "Divers" — même ligne,
-- simple renommage de code et de libellé. Vérifié avant écriture : le code
-- AUTRE n'est référencé nulle part dans le code applicatif (jamais comparé
-- en dur, ni backend ni frontend), le renommage est donc sans risque.
-- ============================================================================

UPDATE store_types SET code = 'DIVERS', label = 'Divers' WHERE code = 'AUTRE';
