-- ============================================================================
-- fix-revoke-super-admin.sql
-- Retire le statut Super Admin d'un compte et lui restitue normalement la
-- boutique qu'il possédait déjà — sans rien perdre (produits, ventes,
-- clients, historique restent intacts, seul le rattachement quotidien est
-- restauré si besoin).
--
-- ⚠️ Remplace l'e-mail ci-dessous avant d'exécuter.
-- ============================================================================

\set target_email 'albercamus621@gmail.com'


-- 1. Retirer le statut Super Admin.
UPDATE users SET is_super_admin = FALSE WHERE email = :'target_email';

-- 2. Restaurer son rattachement Owner à SA boutique (celle dont il est déjà
--    owner_id) — seulement s'il manque, ne crée jamais de doublon.
--    is_default_store n'est mis à TRUE que s'il n'a pas déjà une autre
--    boutique par défaut ailleurs.
INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
SELECT
  u.id,
  s.id,
  (SELECT id FROM roles WHERE code = 'OWNER'),
  NOT EXISTS (
    SELECT 1 FROM user_store WHERE user_id = u.id AND is_default_store = TRUE
  )
FROM users u
JOIN stores s ON s.owner_id = u.id
WHERE u.email = :'target_email'
  AND NOT EXISTS (
    SELECT 1 FROM user_store us2 WHERE us2.user_id = u.id AND us2.store_id = s.id
  );

-- 3. Vérification finale — doit montrer is_super_admin = false, et une
--    ligne avec role_code = 'OWNER' pour sa boutique.
SELECT
  u.id, u.email, u.is_super_admin,
  s.id AS store_id, s.name AS store_name,
  r.code AS role_code, us.is_default_store
FROM users u
LEFT JOIN stores s ON s.owner_id = u.id
LEFT JOIN user_store us ON us.user_id = u.id AND us.store_id = s.id
LEFT JOIN roles r ON r.id = us.role_id
WHERE u.email = :'target_email';