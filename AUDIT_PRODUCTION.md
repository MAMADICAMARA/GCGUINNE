# Audit de préparation à la production — Gestion Commerciale SaaS

**Date de l'audit :** 3 août 2026
**Méthode :** connexion directe à la base de données réelle (PostgreSQL, via le driver `pg` du projet) et lecture directe du code source — aucune affirmation de ce document ne repose sur une supposition non vérifiée. Quand quelque chose n'a pas pu être vérifié avec certitude, c'est dit explicitement.

---

## Sommaire

1. [Cartographie de la base de données réelle](#1--cartographie-de-la-base-de-données-réelle)
2. [Inventaire du code](#2--inventaire-du-code)
3. [Sécurité](#3--sécurité)
4. [Fonctionnalités attendues vs construites](#4--fonctionnalités-attendues-vs-construites)
5. [Estimation chiffrée de préparation à la production](#5--estimation-chiffrée-de-préparation-à-la-production)
6. [Recommandations finales](#6--recommandations-finales)

---

## 1 — Cartographie de la base de données réelle

### 1.1 Tables réellement présentes

La base réelle contient **25 tables** :

```
cash_drawers, categories, customer_payments, customers, invoices, order_items, orders,
products, purchase_items, purchases, roles, stock_movements, stock_transfers,
store_invitations, store_notes, store_supervisors, store_supplier_links,
store_type_categories, store_types, stores, subscription_plans, suppliers,
system_logs, user_store, users
```

Chaque table a été inspectée en détail (colonnes, types, contraintes CHECK/UNIQUE/FK, index, triggers). Points marquants :

- La base utilise abondamment des **triggers PostgreSQL comme garde-fous métier réels** (pas seulement du code applicatif) : `prevent_delete`/`prevent_update_delete` sur `orders`, `order_items`, `stock_movements`, `system_logs`, `purchases`, `stock_transfers` (immuabilité de l'historique) ; `prevent_multi_store_reseller` et `prevent_conflicting_invitation` (exclusivité d'un Vendeur à une seule boutique) ; `prevent_super_admin_owning_store` et `prevent_promoting_store_owner_to_admin` + `strip_store_access_on_admin_promotion` (étanchéité Super Admin / propriétaire de boutique) ; `update_cash_drawer_expected_balance` (calcul auto du solde de caisse attendu). C'est un vrai point fort structurel : ces règles ne dépendent pas de la discipline du code applicatif.
- `stores.receipt_settings` (JSONB) et `stores.store_type_id` sont récents (chantiers de cette conversation, migrations 22 et 23).

### 1.2 Fichiers de migration présents (dans l'ordre)

```
00_extensions_et_fonctions.sql        02_catalogue_et_stock.sql        05_caisses.sql
01_plateforme_et_comptes.sql          03_clients_et_ventes.sql         06_multi_boutiques.sql
                                       04_fournisseurs_et_achats.sql    07_systeme_et_facturation.sql
10_boutique_localisation.sql          12_supervision.sql               17_transfert_et_promotion.sql
11_invitations_et_exclusivite.sql     16_admin_sans_boutique.sql       18_fournisseurs_inter_boutiques.sql
19_notes_boutique.sql  20_plans_abonnement.sql  21_abandon_role_manager.sql
22_types_de_boutique.sql  23_personnalisation_recu.sql
```

**Anomalie mineure constatée :** la numérotation saute de `07` à `10` — aucun fichier `08` ou `09` n'existe. Sans historique Git (voir §3.4), impossible de savoir si ces fichiers ont été supprimés ou si la numérotation a toujours eu ce trou. Sans conséquence fonctionnelle (le script `run_migrations.sh` exécute les fichiers présents dans l'ordre, peu importe les trous), mais à clarifier.

### 1.3 Comparaison base réelle vs fichiers de migration — écarts confirmés

**Écart n°1 — table non documentée :** `customer_payments` existe dans la base réelle (colonnes `id, store_id, customer_id, amount, user_id, created_at`, avec sa contrainte `CHECK (amount > 0)` et son index) mais **n'apparaît dans aucun des 19 fichiers de migration numérotés, ni dans aucun autre fichier `.sql` du dossier** (recherche exhaustive effectuée). Cette table est activement utilisée par `backend/src/modules/customers/customers.service.js` (fonctions `recordPayment` et `listCustomerPayments`, cette dernière ajoutée durant cette conversation) et contient aujourd'hui 8 lignes réelles. **Conséquence concrète : recréer la base de zéro à partir des seuls fichiers de migration ne reproduirait pas cette table — l'application casserait dès le premier paiement partiel enregistré.**

**Écart n°2 — contrainte non documentée :** la contrainte `UNIQUE (owner_id)` sur `stores` (nommée `uq_stores_owner_id` en base, qui impose qu'un utilisateur ne possède qu'une seule boutique — règle métier centrale de toute l'application, notamment pour "Superviser" et le transfert de propriété) existe réellement en base mais le fichier `01_plateforme_et_comptes.sql` ne définit `owner_id` que comme `NOT NULL REFERENCES users(id)`, **sans `UNIQUE`**. Même conséquence que l'écart n°1 : une base recréée à partir des fichiers autoriserait un utilisateur à posséder plusieurs boutiques, ce qui casserait plusieurs fonctionnalités qui supposent cette contrainte.

**Écart n°3 — donnée corrompue au niveau du schéma :** la valeur par défaut de `stores.country` est stockée en base comme `'GuinÃ©e'` (mauvais encodage, confirmé en lisant `information_schema.columns` directement) alors que le fichier source `01_plateforme_et_comptes.sql` contient bien `'Guinée'` correctement encodé en UTF-8. Cela indique que cette migration a été exécutée un jour contre la base avec un encodage client incorrect (probablement `psql` en `LATIN1` au lieu d'`UTF8`). **Impact pratique aujourd'hui limité** : le code applicatif (`stores.service.js#createStore`) fournit toujours explicitement `country || 'Guinée'` depuis une chaîne JavaScript correctement encodée, donc ce défaut de colonne n'est en pratique jamais utilisé — mais c'est un signal qu'au moins une migration a été appliquée dans de mauvaises conditions d'encodage, et le défaut lui-même resterait corrompu pour quiconque insérerait directement en base sans passer par l'application.

**Toutes les autres tables** (22 sur 25) sont correctement tracées à un fichier de migration précis (voir tableau en annexe implicite : chaque `CREATE TABLE` a été localisé nommément).

### 1.4 Tables orphelines — aucun code applicatif ne les utilise

Recherche exhaustive (`grep` du nom de chaque table dans tout `backend/src/modules/` et `backend/src/utils/`) :

| Table | Lignes en base | Code applicatif trouvé |
|---|---|---|
| `cash_drawers` | 0 | **Aucun** |
| `invoices` | 0 | **Aucun** |
| `purchases` | 0 | **Aucun** |
| `purchase_items` | 0 | **Aucun** |
| `stock_transfers` | 0 | **Aucun** |
| `suppliers` | 0 | **Aucun** (voir précision ci-dessous) |

**Précision importante sur `suppliers`** : il existe bien un module `backend/src/modules/suppliers/`, mais en lisant son code (`suppliers.service.js`), il n'interroge **jamais** la table `suppliers` — il travaille exclusivement sur `store_supplier_links` et `stores`. Ce module implémente une fonctionnalité conçue durant cette conversation ("Fournisseurs inter-boutiques" : une boutique autorise une autre boutique à consulter son catalogue en lecture seule via un code de partage), **conceptuellement différente** de ce que la table `suppliers` (avec ses propres colonnes `name, phone, email, address`) et les tables `purchases`/`purchase_items` (avec statut `PENDING/RECEIVED/CANCELLED`, `received_at`) semblent avoir été conçues pour : un carnet de fournisseurs externes classique avec bons de commande et réception de stock. **Ce sont deux systèmes de "fournisseurs" distincts qui partagent le même mot** — celui qui existe en base et code (migration 04) n'est câblé nulle part ; celui qui fonctionne (migration 18) ne s'appelle pas pareil dans le modèle de données. Point de confusion réel pour un futur développeur.

Ces 6 tables représentent un schéma entièrement prêt (contraintes, index, triggers d'immuabilité pour `purchases`/`stock_transfers`) pour des fonctionnalités P1/P2 attendues (gestion des caisses, achats fournisseurs, transferts de stock, facturation) — **mais dont aucune ligne de code métier n'existe**. Voir §4 pour l'impact sur le calcul de préparation.

### 1.5 Code référençant une table/colonne inexistante

Aucun cas trouvé où le code interroge une table ou colonne absente de la base réelle — sauf le module `stock` détaillé au §2.1, qui référence bien des tables existantes (`stock_movements`) mais qui est structurellement cassé pour une tout autre raison (voir ci-dessous).

---

## 2 — Inventaire du code

### 2.1 Backend — modules et routes

13 modules dans `backend/src/modules/` : `admin`, `auth`, `categories`, `customers`, `dashboard`, `employees`, `notes`, `orders`, `products`, `stock`, `stores`, `supervision`, `suppliers`.

**Découverte majeure : le module `stock` est mort et cassé.**

- `backend/src/routes/index.js` monte explicitement 11 modules, mais la ligne correspondante est **commentée** :
  ```js
  // router.use('/stock', require('../modules/stock/stock.routes'));
  ```
  Le module est donc **totalement inaccessible** depuis l'extérieur — aucune requête HTTP ne peut jamais l'atteindre.
- Même s'il était remonté, il ne fonctionnerait pas : son contrôleur (`stock.controller.js`) lit systématiquement `req.user` (`const { userId } = req.user`, `const { storeId } = req.user`), alors que **tout le reste de l'application** (middleware `requireAuth` dans `middlewares/auth.js`, et les 12 autres modules sans exception) pose l'identité sur `req.auth`. `req.user` est `undefined` sur chaque requête : chaque appel provoquerait un plantage (`TypeError: Cannot destructure property 'userId' of 'req.user' as it is undefined`).
- Plus grave encore si jamais quelqu'un corrigeait ce détail sans y prêter attention : **aucune des fonctions de service (`recordMovement`, `getStockHistory`, `verifyStockAvailable`, `adjustStock`) ne reçoit ni ne vérifie de `storeId`.** Un `productId` est accepté tel quel, sans jamais vérifier qu'il appartient à la boutique de l'appelant. Réactiver ce module sans corriger ce point ouvrirait une faille d'isolation multi-tenant totale (n'importe quel compte pourrait modifier le stock de n'importe quelle boutique).

La bonne nouvelle : **la gestion du stock au sens P0 fonctionne réellement**, mais via le module `products` (`GET /products/:id/stock-history`, `POST /products/:id/adjust-stock`), qui lui vérifie correctement l'appartenance à la boutique active. Le module `stock` est un vestige d'une implémentation antérieure ou parallèle, jamais nettoyé.

**Tableau des autres modules** (rôles vérifiés en lisant chaque fichier `*.routes.js` ligne par ligne) :

| Module | Portée | Rôles requis |
|---|---|---|
| `auth` | Inscription, connexion, changement de boutique active | Public (register/login), session valide (switch-store) |
| `stores` | Création boutique, codes de partage, type de boutique, personnalisation du reçu, statut de plan | Session valide ; la plupart des écritures réservées à `OWNER` |
| `products` | CRUD produits, historique de stock, ajustement, désactivation | Lecture : toute l'équipe. Écriture : `OWNER` uniquement |
| `categories` | CRUD catégories | Lecture : toute l'équipe. Création : `OWNER` |
| `customers` | CRUD clients, historique achats, paiements (total/partiel), traçabilité paiements | Toute l'équipe (`requireActiveStore`, pas de restriction de rôle visible sur les routes elles-mêmes) |
| `orders` | Vente en caisse, historique, annulation, retour d'article | Vente/lecture : toute l'équipe. Annulation/retour : `OWNER` |
| `employees` | Invitation, liste, retrait d'employé | `OWNER` exclusivement (routeur entier) |
| `dashboard` | Statistiques (désormais scindées Owner/Vendeur, voir §4) | Toute l'équipe |
| `notes` | Bloc-notes partagé de boutique | `OWNER` et `SELLER` |
| `suppliers` | Fournisseurs inter-boutiques (catalogue en lecture) | `OWNER` exclusivement (routeur entier) |
| `supervision` | Vue en lecture seule de boutiques tierces via code | Toute personne authentifiée **sauf** un Vendeur employé (`blockEmployees`, ajouté durant cette conversation) ; accès réel conditionné par l'abonnement de la boutique *surveillée* |
| `admin` | Espace Super Admin (stats, boutiques, utilisateurs, plans, types de boutique) | `requireSuperAdmin` sur tout le routeur |

Aucune route sensible identifiée sans protection `requireAuth` au minimum. Aucune route d'écriture métier trouvée sans au moins un contrôle de rôle explicite (hormis les cas déjà connus et volontaires : `customers` et `orders` en lecture/vente sont ouverts à toute l'équipe par conception).

### 2.2 Frontend — pages et correspondance avec les routes API

15 dossiers dans `frontend/src/pages/` : `account`, `admin`, `audit-log`, `auth`, `customers`, `dashboard`, `employees`, `fournisors`, `notes`, `pos`, `products`, `sales`, `settings`, `stock`, `suppliers`.

**Découverte : `frontend/src/pages/fournisors/fournisseur.page.jsx` est un fichier orphelin et inachevé.**
- Non importé, non référencé nulle part dans `App.jsx` (vérifié).
- 17 lignes, code manifestement inachevé : `const response = await` suivi directement d'un `catch` — **syntaxe JavaScript invalide** (un `await` sans expression ne compilerait pas). Ce fichier ne peut techniquement pas être importé sans casser le build ; le seul fait qu'il ne soit jamais importé est ce qui permet au reste de l'application de fonctionner.
- Nom de dossier lui-même mal orthographié (`fournisors` au lieu de `fournisseurs`), signe supplémentaire d'un brouillon abandonné.

**Recensement des appels API** (extraction automatique de tous les appels `apiClient.*` du frontend, recoupée avec les routes backend réellement montées) :
- **Aucun appel frontend vers une route backend inexistante** n'a été trouvé.
- Routes backend existantes mais jamais appelées par le frontend web (repérées par différence) : `GET /customers/:id` (la fiche client seule ; le frontend récupère les informations client via `GET /customers/:id/orders`, qui les renvoie déjà imbriquées — cette route reste donc inutilisée mais inoffensive, potentiellement prévue pour un usage futur ou mobile).
- **Fonctionnalité présente côté backend mais sans déclencheur dans l'interface** : `POST /orders/:id/void` (annuler une vente) et `POST /orders/:orderId/items/:itemId/return` (retour d'article) existent et sont protégées `OWNER`, mais **aucun bouton "Annuler" ou "Retourner" n'existe** dans `SalesHistoryPage.jsx` ni `OrderDetailModal.jsx` — seuls les statuts `VOIDED`/`RETURNED`/`PARTIALLY_RETURNED` sont affichés en lecture. Un Owner ne peut donc pas déclencher ces actions depuis l'application aujourd'hui, malgré un backend fonctionnel. Voir §4.

Le module `frontend/src/pages/stock/StockPage.jsx` est bien référencé dans `App.jsx` (route `/stock`) — c'est une page réelle et utilisée, mais elle s'appuie sur les routes du module backend `products` (`stock-history`, `adjust-stock`), **pas** sur le module backend mort `stock` décrit au §2.1 (simple collision de nom, pas de lien réel).

### 2.3 Application mobile (Flutter)

Le dossier `mobile/` est un vrai projet Flutter multi-plateforme (Android/iOS/Web/Windows/macOS/Linux généré), avec **29 fichiers Dart** organisés en architecture par fonctionnalités (`lib/features/...`), et un client HTTP (`lib/core/network/api_client.dart`) explicitement commenté comme "miroir de frontend/src/services/apiClient.js".

**Fonctionnalités couvertes côté mobile** : authentification (connexion/inscription), espace compte (accueil, paramètres, ma boutique, profil), et un espace boutique basique (tableau de bord, caisse/POS, produits, stock, clients, employés).

**Très en retard par rapport au frontend web**, qui a considérablement grandi durant cette conversation. **Absents côté mobile** : Fournisseurs (inter-boutiques), Notes, Superviser, Journal d'audit, Types de boutique, Personnalisation du reçu, Historique des ventes détaillé, tout l'espace Super Admin, la bannière/gestion de plan d'abonnement. Le mobile correspond grossièrement à l'état du frontend web d'une étape antérieure du projet, pas à son état actuel.

---

## 3 — Sécurité

### 3.1 Authentification et vérification de rôle

- `requireAuth` vérifie systématiquement un jeton JWT valide ; aucune route métier trouvée sans ce filtre (hormis `/auth/register`, `/auth/login`, `/health`, volontairement publiques).
- `requireRole`/`requireSuperAdmin` fonctionnent en lisant `roleCode`/`isSuperAdmin` **directement depuis le contenu du jeton JWT**, jamais revérifiés en base à chaque requête. **Constat concret** : `JWT_EXPIRES_IN=8h` (fichier `.env` réel). Si un Super Admin est révoqué, ou qu'un Vendeur est retiré d'une boutique, **son jeton déjà émis reste valide et continue de donner accès jusqu'à 8h après la révocation** — il n'existe aucun mécanisme de révocation immédiate de session (pas de liste noire de jetons, pas de "déconnexion forcée"). Ce n'est pas une faille exploitable de l'extérieur, mais une fenêtre d'exposition réelle après une décision de sécurité (ex: retrait d'un employé malhonnête) qui ne prend pas effet immédiatement.
- À l'inverse, plusieurs vérifications *métier* fines (statut d'abonnement, appartenance à une boutique en tant que superviseur, rôle réel dans `user_store`) sont bien **revérifiées en base à chaque requête**, jamais depuis le jeton — cohérent et appliqué dans plusieurs modules (`planContext.js`, `supervision.service.js`).

### 3.2 Injection SQL

Recherche systématique de toute concaténation de chaîne dans une requête SQL (`.query()` avec interpolation `${...}` directement dans le texte de la requête). **Aucune occurrence dangereuse trouvée** dans les fichiers examinés (`orders`, `customers`, `dashboard`, `admin`, `products`, `employees`, `notes`, `utils/auditLog.js`) : chaque usage de `${...}` sert soit à construire dynamiquement un texte de message d'erreur (pas du SQL), soit à injecter la **syntaxe de placeholder** (`$${idx++}` → produit la chaîne `"$3"`, pas une valeur), la vraie valeur passant toujours par le tableau de paramètres lié (`params.push(...)`). Toutes les requêtes utilisent des paramètres liés (`$1, $2...`). C'est une base de code disciplinée sur ce point précis.

### 3.3 Secrets et configuration

- `.gitignore` (racine et `backend/`) exclut correctement `.env`, `node_modules/`, `*.log`.
- **`backend/src/config/env.js` contient un secret JWT de repli codé en dur** : `secret: process.env.JWT_SECRET || 'dev_secret_do_not_use_in_production'`. Aujourd'hui, le `.env` réel contient bien une vraie valeur (23 caractères, non vide) — donc **pas d'exploitation active actuellement**. Mais ce repli silencieux est un risque latent réel : si un futur déploiement oublie de définir `JWT_SECRET`, l'application démarrerait quand même, silencieusement, avec un secret public et connu de quiconque lit ce fichier — permettant de forger des jetons valides pour n'importe quel compte, y compris Super Admin.
- `NODE_ENV=development` dans l'environnement actuel (vérifié).

### 3.4 Absence totale de contrôle de version

**Constat le plus significatif de cet audit, hors code lui-même** : `git status` échoue avec `fatal: not a git repository`. **Ce projet n'est pas — et n'a peut-être jamais été — un dépôt Git.** Conséquences concrètes :
- Aucun historique, donc impossible de vérifier "un secret a-t-il été commité un jour" — la question est sans objet, mais seulement parce qu'il n'y a aucune trace de rien.
- Aucune capacité de retour arrière si un déploiement casse quelque chose.
- Aucune revue de code possible, aucune branche, aucune sauvegarde versionnée du travail.

C'est un manque fondamental d'hygiène d'ingénierie, indépendant de la qualité du code lui-même, et **à corriger avant absolument tout le reste** (voir §6).

### 3.5 Mots de passe

`bcryptjs` (implémentation JS pure de bcrypt, pas le binding natif — cryptographiquement équivalent, juste plus lent, sans conséquence à cette échelle) utilisé correctement : `bcrypt.hash` à l'inscription, `bcrypt.compare` à la connexion. Aucun mot de passe en clair trouvé dans les logs ou réponses API (recherche `console.log`/`console.error` contenant `password` : aucune occurrence).

### 3.6 Exposition d'informations techniques

`middlewares/errorHandler.js` n'inclut la pile d'erreur (`stack`) dans la réponse JSON **que si `env.nodeEnv === 'development'`** — correctement implémenté et vérifié dans le code. **Tous les exemples de réponses d'erreur avec `"stack": "Error: ..."` observés pendant les tests de cette conversation s'expliquent uniquement par le fait que l'environnement de développement tourne actuellement en `NODE_ENV=development`** — pas un bug, un comportement voulu, à condition que `NODE_ENV=production` soit bien positionné en réel (voir §6 — ce réglage conditionne aussi le CORS, point suivant).

### 3.7 Limitation de débit (rate limiting)

`express-rate-limit` est bien présent et actif globalement (`app.js`) : 300 requêtes / 15 minutes par IP. **Il n'existe pas de limite plus stricte spécifiquement sur `/auth/login` ou `/auth/register`** — un attaquant dispose donc de 300 tentatives de mot de passe par tranche de 15 minutes et par IP avant blocage, ce qui reste généreux pour une attaque par force brute ciblée sur un compte précis.

### 3.8 CORS

`app.js` : en développement (`NODE_ENV=development`), **toute origine est acceptée sans restriction** (`callback(null, true)` inconditionnel). En production, la liste stricte `CORS_ORIGIN` (depuis `.env`) serait appliquée — le mécanisme est correctement conçu, mais entièrement **conditionné à ce que `NODE_ENV` soit bien positionné à `production` au déploiement**, exactement comme pour l'exposition des stack traces (§3.6). Un seul oubli de configuration lèverait les deux protections à la fois.

### 3.9 En-têtes de sécurité et autres bonnes pratiques déjà en place

`helmet()` est utilisé (en-têtes HTTP de sécurité standard), `compression()` activé, taille de corps JSON limitée à 1 Mo (`express.json({ limit: '1mb' })`) — réduit un vecteur de déni de service basique par gros payloads.

---

## 4 — Fonctionnalités attendues vs construites

### P0 — Socle indispensable

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Authentification | **Fait** | `modules/auth/*`, bcrypt, JWT, `switch-store` |
| Gestion des boutiques | **Fait** | `modules/stores/*` (création, types, codes de partage, personnalisation reçu) |
| Employés / rôles | **Fait** | `modules/employees/*`, exclusivité vendeur (trigger `prevent_multi_store_reseller`) |
| Catalogue produits | **Fait** | `modules/products/*`, `modules/categories/*` |
| Gestion du stock | **Fait** (via `products`, pas le module `stock` mort) | `products.routes.js` (`stock-history`, `adjust-stock`) |
| Vente en caisse (POS) | **Fait** | `modules/orders/*`, `frontend/pages/pos/*`, reçu PDF/impression/partage personnalisable |
| Gestion des clients | **Fait** | `modules/customers/*`, paiement partiel + traçabilité (`customer_payments`) |

### P1 — Renforcement opérationnel

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Tableau de bord et statistiques | **Fait** | `modules/dashboard/*` — désormais scindé Owner (totaux boutique) / Vendeur (ses propres ventes uniquement) |
| Journal d'audit (plateforme ET par boutique) | **Fait** | `utils/auditLog.js`, `admin.service.js#listAuditLogs`, pages `AuditLogPage`/`SupervisedStoreDetailPage` |
| Annulations/retours de vente | **Partiel** | Backend complet et protégé (`POST /orders/:id/void`, `POST /orders/:orderId/items/:itemId/return`, réservés `OWNER`) — **mais aucun bouton dans l'interface** pour les déclencher |
| Gestion des caisses (ouverture/fermeture) | **Absent** | Table `cash_drawers` complète en base (contraintes, trigger de calcul de solde) — **zéro ligne de code applicatif** |
| Fournisseurs et achats | **Absent** (au sens du cahier des charges d'origine) / **Fait** (au sens réinterprété) | `suppliers`/`purchases`/`purchase_items` (bons de commande classiques) : schéma seul, aucun code. À la place : `store_supplier_links` (catalogue en lecture entre boutiques) est fonctionnel et testé — une fonctionnalité différente qui porte le même nom |

### P2 — Multi-boutiques et pilotage

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Bascule multi-boutiques | **Fait** | `POST /auth/switch-store` |
| Vue consolidée / supervision | **Fait** | `modules/supervision/*` — accès basé sur l'abonnement de la boutique surveillée (pas du superviseur), employés exclus |
| Transferts de stock entre boutiques | **Absent** | Table `stock_transfers` complète (contraintes, trigger d'immuabilité) — **zéro ligne de code applicatif** |
| Facturation d'abonnement / plans | **Partiel** | `subscription_plans` + activation/désactivation manuelle par Super Admin **fonctionnels et testés** ; mais table `invoices` (facturation réelle, montants dus, statut payé/impayé) **jamais utilisée par aucun code** |

### Espace Super Admin

| Fonctionnalité | Statut | Preuve |
|---|---|---|
| Statistiques plateforme | **Fait** | `GET /admin/stats` |
| Suspendre/réactiver une boutique | **Fait** | `POST /admin/stores/:id/suspend`\|`reactivate` |
| Gestion des utilisateurs (recherche, promotion/rétrogradation) | **Fait** | `GET /admin/users/search`, `POST /admin/users/:id/promote`\|`revoke` |
| Transfert de propriété de boutique | **Fait** | `POST /admin/stores/:id/transfer` |

### Fonctionnalités non listées dans le cahier des charges d'origine, trouvées dans le code

Toutes construites et testées durant cette conversation :

- **Traçabilité des paiements clients** (`customer_payments`) — historique montant/vendeur/date de chaque versement, y compris paiements partiels successifs.
- **Notes de boutique** (`store_notes`) — bloc-notes partagé par toute l'équipe (épingler, couleur).
- **Liens fournisseurs inter-boutiques** (`store_supplier_links`) — une boutique consulte le catalogue en lecture seule d'une autre via un code de partage (sans prix ni stock).
- **Types de boutique et catégories suggérées** (`store_types`, `store_type_categories`) — référentiel géré par le Super Admin, choix obligatoire et définitif à la création d'une boutique, copie automatique des catégories suggérées.
- **Personnalisation du reçu** (`stores.receipt_settings`) — en-tête/pied de page, affichage conditionnel adresse/téléphone/vendeur, avec aperçu en direct.

---

## 5 — Estimation chiffrée de préparation à la production

### Méthode

Chaque grande catégorie reçoit d'abord une note interne (moyenne des sous-éléments qui la composent, détaillée ci-dessous), puis une pondération globale reflétant son importance réelle pour un lancement avec de vrais commerçants et de vraies transactions.

### Détail par catégorie

**Fonctionnalités P0 + Espace Super Admin (poids 35%)** — regroupés car les deux sont indispensables au fonctionnement quotidien et à l'exploitation sûre de la plateforme, pas seulement "utiles".
7 éléments P0 à ~100% (avec un ajustement global de -5% pour la dette technique découverte : module `stock` mort à nettoyer, aucun test automatisé derrière ces fonctionnalités) + 4 éléments Super Admin à 100% → **≈ 97%**

**Fonctionnalités P1 (poids 20%)**
Dashboard 100%, Journal d'audit 100%, Annulations/retours 40% (backend seul, inutilisable en pratique), Caisses 0% (rien), Fournisseurs/achats 30% (substitut partiel, pas l'original) → moyenne **≈ 54%**

**Fonctionnalités P2 (poids 10%)**
Supervision 100%, Transferts de stock 0% (rien), Facturation/plans 55% (gestion des plans oui, facturation réelle non) → moyenne **≈ 52%**

**Sécurité (poids 20%)**
Auth/rôles 75% (pas de révocation de session immédiate), Injection SQL 95% (rien trouvé), Secrets/.env 80% (bien géré mais aucun dépôt Git derrière), Mots de passe 100%, Exposition d'erreurs 85% (correct mais conditionné à la config), Rate limiting 60% (global seulement), CORS 70% (correct mais conditionné à la config), Secret JWT de repli 60% (risque latent) → moyenne **≈ 78%**

**Cohérence base de données (poids 10%)**
2 écarts confirmés (table et contrainte non documentées) + 1 donnée de schéma corrompue (encodage) sur 25 tables, sinon cohérent → **≈ 65%**

**Tests automatisés (poids 5%)**
Aucun fichier de test trouvé (`*.test.js`, `*.spec.js`), aucun framework configuré, script `npm test` du backend renvoie une erreur volontaire ("no test specified"). Test manuel réel et approfondi effectué tout au long du développement (API + navigateur), mais ça ne remplace pas une suite de tests automatisés pour la non-régression → **5%**

### Calcul pondéré

| Catégorie | Note | Poids | Contribution |
|---|---|---|---|
| P0 + Super Admin | 97% | 35% | 33,95 |
| P1 | 54% | 20% | 10,80 |
| P2 | 52% | 10% | 5,20 |
| Sécurité | 78% | 20% | 15,60 |
| Cohérence base de données | 65% | 10% | 6,50 |
| Tests automatisés | 5% | 5% | 0,25 |
| **Total** | | **100%** | **≈ 72,3%** |

## **Estimation globale : ≈ 72 % prêt pour la production**

Ce chiffre reflète une base P0 solide et réellement testée manuellement, freinée principalement par : des fonctionnalités P1/P2 significatives à l'état de schéma seul sans aucun code, une absence totale de tests automatisés, et l'absence de tout contrôle de version — ce dernier point n'étant même pas capturé numériquement ci-dessus tant il est transverse (voir §6, recommandation n°1).

---

## 6 — Recommandations finales

Par ordre de priorité réelle (ce qui bloquerait ou mettrait en danger un lancement avec de vrais commerçants) :

1. **Initialiser un dépôt Git immédiatement, avant tout autre changement.** Aucun filet de sécurité n'existe aujourd'hui (pas d'historique, pas de retour arrière possible, pas de revue de code). C'est la seule recommandation à traiter *avant* même de corriger le reste — pour que tout ce qui suit soit lui-même versionné et réversible.

2. **Corriger les deux écarts de schéma confirmés** avant toute tentative de recréation d'environnement : ajouter `customer_payments` à un fichier de migration, et ajouter `UNIQUE (owner_id)` à la définition de `stores` dans `01_plateforme_et_comptes.sql`. Sans ça, un nouvel environnement (recette, nouveau serveur) ne reproduira pas fidèlement la production.

3. **Vérifier explicitement `NODE_ENV=production` et `CORS_ORIGIN`** avant le déploiement réel — deux protections importantes (masquage des stack traces, restriction CORS) dépendent silencieusement de ce seul réglage.

4. **Supprimer le repli silencieux du secret JWT** (`|| 'dev_secret_do_not_use_in_production'`) — le rendre obligatoire (échec au démarrage si absent), comme c'est déjà le cas pour `databaseUrl`.

5. **Décider explicitement du sort des fonctionnalités à schéma-seul** (`cash_drawers`, `invoices`, `purchases`/`purchase_items`, `stock_transfers`) : soit les construire si elles sont réellement attendues au lancement, soit les retirer de la base pour ne pas laisser une dette silencieuse. Une décision produit, pas seulement technique.

6. **Câbler l'annulation/le retour de vente dans l'interface** — le backend existe et est protégé, il ne manque qu'un bouton. Rapport effort/valeur très favorable vu que le plus dur (logique métier, sécurité) est déjà fait.

7. **Nettoyer le module `stock` mort** (`backend/src/modules/stock/`) et le fichier frontend orphelin `fournisors/fournisseur.page.jsx` — aucun des deux n'est dangereux tel quel (l'un est débranché, l'autre ne compile pas), mais les laisser en l'état est un risque futur si quelqu'un les remonte sans comprendre pourquoi ils sont là.

8. **Ajouter au moins une suite de tests automatisés minimale** sur les parcours critiques (vente en caisse, calcul de solde client, permissions par rôle) — la rigueur de test manuel démontrée pendant le développement est réelle, mais elle ne protège pas contre une régression future si personne ne repasse manuellement sur les mêmes scénarios à chaque changement.

9. **Renforcer le rate limiting spécifiquement sur `/auth/login` et `/auth/register`**, en plus de la limite globale déjà en place.

10. **Documenter la distinction entre les deux systèmes "fournisseurs"** (`suppliers`/`purchases` non utilisés vs `store_supplier_links` fonctionnel) pour éviter qu'un futur développeur ne les confonde ou ne tente de "réparer" le mauvais système.
