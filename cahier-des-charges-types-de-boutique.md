# Cahier des charges — Gestion des types de boutique et catégories de produits suggérées

## 1. Objectif

Permettre au **Super Admin** de gérer, depuis l'interface (sans intervention technique/SQL), la liste des **types de boutique** proposés à la création d'une boutique, ainsi que les **catégories de produits suggérées** pour chaque type — le tout en CRUD complet (créer, lire, modifier, supprimer).

## 2. Contexte et problème résolu

Aujourd'hui, à la création d'une boutique, l'utilisateur doit taper lui-même sa catégorie d'activité en texte libre, puis créer une à une toutes ses catégories de produits. Beaucoup d'utilisateurs de la plateforme ne sont pas à l'aise avec la saisie numérique.

**Solution retenue** : l'utilisateur choisit un **type de boutique** dans une liste déroulante (ex : "Téléphonie & Accessoires"). Un jeu de catégories de produits est alors **automatiquement créé** pour sa boutique, lui évitant d'avoir à tout taper. Ces catégories restent ensuite entièrement modifiables par lui (ce n'est qu'un point de départ).

Cette fonctionnalité-ci concerne uniquement la **gestion administrative de ce référentiel** (les types disponibles et leurs catégories suggérées) — pas le flux de création de boutique lui-même, qui sera traité séparément.

## ⚠️ Prérequis avant de commencer

Cette base de données est partagée avec **au moins un autre développeur**, qui a déjà ajouté des tables/colonnes indépendantes (`customer_payments`, `store_notes`, `store_supplier_links`, `suppliers`, `supplier_code` sur `stores`, `plan_expires_at`, etc.) pour d'autres besoins.

Avant d'exécuter `19_types_de_boutique.sql` :
1. Vérifier que le numéro `19` n'est pas déjà pris par un autre chantier en cours (`\dt` sur la base réelle, vérifier les scripts déjà présents dans `backend/database/`).
2. Confirmer qu'aucune table `store_types` / `store_type_categories` n'existe déjà sous un autre nom pour un besoin similaire.
3. Ne jamais supposer le comportement des tables construites par l'autre développeur — cette fonctionnalité n'en a besoin d'aucune, mais si un chantier futur devait les croiser, se référer à son code, pas à des hypothèses.

## 3. Modèle de données

### Table `store_types` (à créer — voir `19_types_de_boutique.sql`, migration écrite mais **pas encore appliquée** sur la base réelle)

| Colonne | Type | Contrainte | Rôle |
|---|---|---|---|
| `id` | SERIAL | PK | Identifiant |
| `code` | VARCHAR(50) | UNIQUE, NOT NULL | Code technique stable (ex: `TELEPHONIE`) |
| `label` | VARCHAR(100) | NOT NULL | Libellé affiché à l'utilisateur (ex: "Téléphonie & Accessoires") |
| `display_order` | INTEGER | NOT NULL, défaut 0 | Ordre d'affichage dans la liste déroulante |

### Table `store_type_categories` (à créer — même migration)

| Colonne | Type | Contrainte | Rôle |
|---|---|---|---|
| `id` | SERIAL | PK | Identifiant |
| `store_type_id` | INTEGER | FK → `store_types(id)`, `ON DELETE CASCADE`, NOT NULL | À quel type appartient cette suggestion |
| `name` | VARCHAR(100) | NOT NULL | Nom de la catégorie suggérée (ex: "Écrans") |
| `display_order` | INTEGER | NOT NULL, défaut 0 | Ordre d'affichage |

### Lien avec l'existant

- `stores.store_type_id` (**à créer par la même migration**) référencera `store_types(id)`, `ON DELETE SET NULL`.
- **État réel de la base au moment de la rédaction** (vérifié directement via `\d stores`, `\dt`) : la table `stores` contient déjà d'autres colonnes ajoutées séparément par un autre développeur pour des besoins distincts (`supplier_code`, `plan_expires_at`), ainsi que plusieurs tables indépendantes (`customer_payments`, `store_notes`, `store_supplier_links`, etc.). **Cette fonctionnalité n'interagit avec aucune d'entre elles** — `store_type_id` est une colonne entièrement nouvelle, sans lien ni collision avec l'existant. Vérifier avant d'exécuter la migration que le numéro `19` n'a pas déjà été pris par un autre chantier en parallèle.
- **Important** : `store_type_categories` n'est qu'un **modèle/gabarit**. Il est copié dans la vraie table `categories` d'une boutique **uniquement au moment de la création de cette boutique** (ou de l'adoption rétroactive d'un type). Modifier ou supprimer une ligne dans `store_type_categories` **n'affecte donc jamais** les boutiques déjà créées — uniquement les futures créations/adoptions.

## 4. Règles métier

1. **`code`** doit être unique sur toute la table `store_types` (contrainte déjà en base). Le format recommandé : majuscules, sans espace (ex: `TELEPHONIE`).
2. **Suppression d'un type** (`store_types`) :
   - Ses catégories suggérées (`store_type_categories`) sont supprimées automatiquement (`ON DELETE CASCADE`).
   - Les boutiques déjà créées avec ce type gardent leur fonctionnement intact ; seule leur référence de type devient vide (`store_type_id = NULL`), sans aucun autre effet.
   - Aucune confirmation métier supplémentaire n'est requise côté base — mais l'interface doit demander une confirmation explicite avant suppression (irréversible du point de vue de l'utilisateur, même si techniquement sans danger pour les boutiques existantes).
3. **Suppression d'une catégorie suggérée** (`store_type_categories`) : aucun effet sur les boutiques existantes (voir §3).
4. **Le champ `code` ne doit pas pouvoir être vide ou dupliqué** — validation à la fois côté formulaire et côté API (la contrainte UNIQUE en base est le filet de sécurité final).
5. **`display_order`** n'a pas de contrainte d'unicité — deux lignes peuvent partager le même ordre (l'ordre exact en cas d'égalité n'a pas d'importance fonctionnelle).

## 5. Fonctionnalités attendues (Super Admin uniquement)

### 5.1 Types de boutique

| Action | Détail |
|---|---|
| **Lister** | Voir tous les types existants, triés par `display_order`, chacun avec ses catégories suggérées visibles (par ex. dépliables) |
| **Créer** | Formulaire : code, libellé, ordre d'affichage |
| **Modifier** | Changer code, libellé ou ordre d'un type existant |
| **Supprimer** | Avec confirmation explicite (voir règle §4.2) |

### 5.2 Catégories suggérées (rattachées à un type)

| Action | Détail |
|---|---|
| **Lister** | Affichées sous leur type parent |
| **Ajouter** | Nom + ordre d'affichage, rattachés à un type précis |
| **Modifier** | Changer le nom ou l'ordre d'une suggestion existante |
| **Supprimer** | Retire la suggestion de la liste (sans confirmation obligatoire, l'effet est mineur — voir §4.3) |

## 6. Endpoints API à construire

Tous réservés au Super Admin (middleware d'authentification équivalent à celui déjà utilisé pour `/admin/*`).

```
GET    /admin/store-types                              Liste tous les types + leurs catégories suggérées
POST   /admin/store-types                               Créer un type       { code, label, displayOrder }
PUT    /admin/store-types/:id                           Modifier un type    { code, label, displayOrder }
DELETE /admin/store-types/:id                           Supprimer un type

POST   /admin/store-types/:storeTypeId/categories       Ajouter une suggestion  { name, displayOrder }
PUT    /admin/store-types/categories/:categoryId        Modifier une suggestion { name, displayOrder }
DELETE /admin/store-types/categories/:categoryId        Supprimer une suggestion
```

**Réponses attendues** :
- Les listes/objets renvoyés utilisent des clés en camelCase (`displayOrder`, `storeTypeId`), cohérent avec le reste de l'API.
- Codes d'erreur explicites en cas de conflit : `CODE_ALREADY_USED` (409), `STORE_TYPE_NOT_FOUND` / `CATEGORY_NOT_FOUND` (404), `VALIDATION_ERROR` (400).

## 7. Interface utilisateur attendue (Super Admin)

Nouvelle page dans l'espace Super Admin (ex: **"Types de boutique"**), listée dans le menu de navigation admin.

- Liste des types (carte ou tableau), affichant pour chacun : libellé, code, nombre de catégories suggérées.
- Chaque type peut être **déplié** pour voir/gérer ses catégories suggérées.
- Boutons **Ajouter un type**, **Modifier**, **Supprimer** (avec confirmation) au niveau type.
- Boutons **Ajouter une catégorie**, **Modifier**, **Supprimer** au niveau catégorie suggérée, dans la section dépliée du type concerné.
- Messages de succès/erreur cohérents avec le style déjà utilisé sur les autres pages Super Admin (bandeau vert/rouge en haut de page).

## 8. Hors périmètre (explicitement exclu de cette fonctionnalité)

- Le flux de **création de boutique** avec sélection du type et copie automatique des catégories suggérées — c'est une fonctionnalité **distincte**, dépendante de celle-ci mais à spécifier/construire séparément.
- Le bouton **"Adopter un type"** pour les boutiques déjà existantes — également distinct, à traiter séparément.
- Toute limitation de plan d'abonnement liée aux types de boutique (aucune prévue à ce stade).

## 9. Critères d'acceptation (scénarios de test)

1. Créer un nouveau type de boutique avec un code déjà utilisé → doit être refusé avec un message clair.
2. Créer un type, ajouter 3 catégories suggérées, les voir apparaître dans le bon ordre.
3. Modifier le libellé d'un type existant → la liste affichée reflète immédiatement le changement.
4. Supprimer un type qui a des catégories suggérées → les catégories disparaissent avec lui, aucune erreur.
5. Supprimer un type déjà utilisé par une boutique existante (simuler une boutique avec ce `store_type_id`) → la suppression réussit, la boutique reste pleinement fonctionnelle, seule sa référence de type devient vide.
6. Modifier/supprimer une catégorie suggérée déjà "copiée" dans une boutique existante → la boutique existante ne voit **aucun changement** dans ses propres catégories.
