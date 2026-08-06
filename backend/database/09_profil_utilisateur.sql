-- ============================================================================
-- 09_profil_utilisateur.sql
-- Domaine : Informations de profil complémentaires
-- ============================================================================
-- Ajout des champs de profil demandés à l'inscription (§4.1 du cahier des
-- charges) : sexe et date de naissance, avec validation d'âge minimum (15
-- ans) appliquée côté service (auth.service.js), pas en contrainte base —
-- une contrainte CHECK sur la date du jour ne serait pas fiable dans le
-- temps (elle figerait l'âge au moment de la création de la ligne). Seule
-- règle imposée ici : pas de date de naissance dans le futur.
-- ============================================================================

ALTER TABLE users ADD COLUMN gender VARCHAR(10) CHECK (gender IN ('HOMME', 'FEMME', 'AUTRE'));
ALTER TABLE users ADD COLUMN birth_date DATE CHECK (birth_date IS NULL OR birth_date <= CURRENT_DATE);
