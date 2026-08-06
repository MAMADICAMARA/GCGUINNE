-- ============================================================================
-- 08_super_admin.sql
-- Domaine : Statut Super Admin
-- ============================================================================
-- Le Super Admin est un opérateur de la plateforme, distinct des rôles
-- boutique (Owner/Manager/Vendeur). Ce statut ne peut JAMAIS être positionné
-- via l'API publique — uniquement par une intervention directe en base
-- (voir backend/src/modules/admin, qui vérifie ce champ sans jamais
-- permettre de le modifier via une route accessible aux comptes normaux).
-- ============================================================================

ALTER TABLE users ADD COLUMN is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;
