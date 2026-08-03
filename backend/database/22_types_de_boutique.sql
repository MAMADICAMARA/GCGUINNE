-- ============================================================================
-- 22_types_de_boutique.sql
-- Domaine : Types de boutique + catégories de produits suggérées
-- ============================================================================
-- Décidé en conversation : à la création, l'utilisateur choisit un TYPE de
-- boutique (liste de référence, pas du texte libre) plutôt que de tout
-- taper lui-même. Selon ce type, un jeu de catégories de produits est
-- automatiquement créé pour sa boutique — un point de départ, jamais une
-- contrainte : tout reste modifiable ensuite (ajouter, renommer, supprimer).
--
-- stores.category (texte libre) est conservé pour compatibilité — il est
-- désormais rempli automatiquement à partir du type choisi, mais le champ
-- brut continue d'exister pour ne rien casser de l'existant.
--
-- Portée de CE fichier : uniquement le référentiel (store_types /
-- store_type_categories) et le CRUD Super Admin dessus. Le remplissage
-- automatique de stores.category et la copie des catégories suggérées vers
-- la vraie table categories() appartiennent au flux de création de
-- boutique, traité séparément (hors périmètre ici).
-- ============================================================================

CREATE TABLE store_types (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(50) UNIQUE NOT NULL,
  label          VARCHAR(100) NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE store_type_categories (
  id             SERIAL PRIMARY KEY,
  store_type_id  INTEGER NOT NULL REFERENCES store_types(id) ON DELETE CASCADE,
  name           VARCHAR(100) NOT NULL,
  display_order  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE stores ADD COLUMN store_type_id INTEGER REFERENCES store_types(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- Référentiel de départ (ajustable plus tard sans toucher au code — juste
-- des lignes de table).
-- ----------------------------------------------------------------------------
INSERT INTO store_types (code, label, display_order) VALUES
  ('TELEPHONIE',    'Téléphonie & Accessoires',          1),
  ('ALIMENTATION',  'Alimentation générale / Épicerie',  2),
  ('VETEMENTS',     'Vêtements & Mode',                  3),
  ('QUINCAILLERIE', 'Quincaillerie / Matériaux',         4),
  ('PHARMACIE',     'Pharmacie / Parapharmacie',         5),
  ('ELECTRONIQUE',  'Électronique & Électroménager',     6),
  ('COSMETIQUE',    'Cosmétique & Beauté',               7),
  ('AUTRE',         'Autre',                             99);

INSERT INTO store_type_categories (store_type_id, name, display_order) VALUES
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Écrans', 1),
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Batteries', 2),
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Chargeurs', 3),
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Coques', 4),
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Écouteurs & Casques', 5),
  ((SELECT id FROM store_types WHERE code = 'TELEPHONIE'), 'Cartes SIM & Crédit', 6),

  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Riz & Céréales', 1),
  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Huiles', 2),
  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Boissons', 3),
  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Conserves', 4),
  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Produits laitiers', 5),
  ((SELECT id FROM store_types WHERE code = 'ALIMENTATION'), 'Hygiène', 6),

  ((SELECT id FROM store_types WHERE code = 'VETEMENTS'), 'Homme', 1),
  ((SELECT id FROM store_types WHERE code = 'VETEMENTS'), 'Femme', 2),
  ((SELECT id FROM store_types WHERE code = 'VETEMENTS'), 'Enfant', 3),
  ((SELECT id FROM store_types WHERE code = 'VETEMENTS'), 'Chaussures', 4),
  ((SELECT id FROM store_types WHERE code = 'VETEMENTS'), 'Accessoires', 5),

  ((SELECT id FROM store_types WHERE code = 'QUINCAILLERIE'), 'Outillage', 1),
  ((SELECT id FROM store_types WHERE code = 'QUINCAILLERIE'), 'Peinture', 2),
  ((SELECT id FROM store_types WHERE code = 'QUINCAILLERIE'), 'Plomberie', 3),
  ((SELECT id FROM store_types WHERE code = 'QUINCAILLERIE'), 'Électricité', 4),
  ((SELECT id FROM store_types WHERE code = 'QUINCAILLERIE'), 'Visserie & Fixations', 5),

  ((SELECT id FROM store_types WHERE code = 'PHARMACIE'), 'Médicaments', 1),
  ((SELECT id FROM store_types WHERE code = 'PHARMACIE'), 'Hygiène & Beauté', 2),
  ((SELECT id FROM store_types WHERE code = 'PHARMACIE'), 'Matériel médical', 3),
  ((SELECT id FROM store_types WHERE code = 'PHARMACIE'), 'Compléments alimentaires', 4),

  ((SELECT id FROM store_types WHERE code = 'ELECTRONIQUE'), 'TV & Son', 1),
  ((SELECT id FROM store_types WHERE code = 'ELECTRONIQUE'), 'Réfrigération', 2),
  ((SELECT id FROM store_types WHERE code = 'ELECTRONIQUE'), 'Petit électroménager', 3),
  ((SELECT id FROM store_types WHERE code = 'ELECTRONIQUE'), 'Câbles & Accessoires', 4),

  ((SELECT id FROM store_types WHERE code = 'COSMETIQUE'), 'Soins visage', 1),
  ((SELECT id FROM store_types WHERE code = 'COSMETIQUE'), 'Soins cheveux', 2),
  ((SELECT id FROM store_types WHERE code = 'COSMETIQUE'), 'Parfums', 3),
  ((SELECT id FROM store_types WHERE code = 'COSMETIQUE'), 'Maquillage', 4);
  -- 'AUTRE' : volontairement aucune catégorie suggérée — saisie 100% manuelle.
