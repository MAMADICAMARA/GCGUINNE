# Solutions proposées — suite à l'audit de production

**Date :** 3 août 2026
**Base :** `AUDIT_PRODUCTION.md`
**Portée de ce document :** pour chaque problème relevé (majeur ou mineur), une solution concrète et applicable — pensée pour rester cohérente avec l'esprit du projet (plateforme légère pour petits commerces guinéens, pas une architecture d'entreprise), pour renforcer réellement la protection des comptes/données, et pour ne jamais casser ce qui fonctionne déjà et a été testé. **Ceci est une proposition — aucun code n'a été modifié.** Je code dès que vous donnez le feu vert, dans l'ordre qui vous convient.

Chaque fiche suit le même format : **Problème** (rappel bref) → **Pourquoi c'est important** → **Solution proposée** → **Effort/risque**.

---

## Sommaire

- [A. Critique — à traiter avant toute mise en production](#a--critique--à-traiter-avant-toute-mise-en-production)
- [B. Majeur — fonctionnalités et cohérence](#b--majeur--fonctionnalités-et-cohérence)
- [C. Mineur — hygiène et robustesse à long terme](#c--mineur--hygiène-et-robustesse-à-long-terme)
- [Ordre d'exécution recommandé](#ordre-dexécution-recommandé)

---

## A. Critique — à traiter avant toute mise en production

### A1. Aucun dépôt Git

**Pourquoi c'est important :** sans versionnement, chaque correction qui suit dans ce document — y compris les corrections de sécurité — se ferait "à l'aveugle", sans possibilité de revenir en arrière si quelque chose casse. C'est le seul point de ce document qui doit être traité avant tous les autres, car il conditionne la sécurité de tout le reste du travail.

**Solution proposée :**
1. `git init` à la racine du projet (les `.gitignore` déjà présents à la racine et dans `backend/` sont corrects, aucun changement nécessaire).
2. Premier commit capturant l'état actuel tel quel — y compris ce fichier et `AUDIT_PRODUCTION.md`, pour que le "avant correctifs" reste consultable.
3. À partir de là, chaque correctif de ce document devient un commit séparé et nommé, jamais un mélange de plusieurs correctifs dans un seul commit — pour qu'un correctif problématique puisse être annulé individuellement sans perdre les autres.
4. Vérification immédiate après le premier commit : `git status` doit confirmer que `.env` n'apparaît pas dans les fichiers suivis.

**Effort/risque :** trivial, aucun risque — action purement locale, aucune conséquence sur le code qui tourne.

---

### A2. Secret JWT avec repli codé en dur

**Problème :** `env.js` contient `secret: process.env.JWT_SECRET || 'dev_secret_do_not_use_in_production'`. Si `JWT_SECRET` n'est pas défini au démarrage, l'application démarre quand même avec un secret public, visible dans ce fichier.

**Pourquoi c'est important :** un secret JWT connu permet de forger un jeton valide pour n'importe quel compte, y compris Super Admin, sans avoir besoin du mot de passe. C'est la clé qui protège absolument toutes les identités de la plateforme.

**Solution proposée :**
1. Remplacer le repli silencieux par le mécanisme `required()` déjà présent dans le même fichier (utilisé pour d'autres variables) : `secret: required('JWT_SECRET')`. L'application refuse alors de démarrer si la variable est absente — un échec bruyant et immédiat plutôt qu'une faille silencieuse.
2. Avant la mise en production réelle, générer une nouvelle valeur aléatoire longue (ex. `openssl rand -base64 48`) et remplacer la valeur actuellement dans `.env` — celle utilisée en développement ne doit jamais être réutilisée telle quelle en production, même si elle n'a jamais fuité à notre connaissance.
3. Documenter cette étape dans une checklist de déploiement (voir A6) pour qu'elle ne soit jamais oubliée sur un futur serveur.

**Effort/risque :** trivial (un changement d'une ligne) ; aucun risque pour le code existant tant que `.env` local garde une vraie valeur (déjà le cas aujourd'hui).

---

### A3. Table `customer_payments` et contrainte `UNIQUE(owner_id)` absentes des fichiers de migration

**Problème :** confirmé dans l'audit — ces deux éléments existent en base réelle mais ne seraient pas recréés à partir des fichiers de migration seuls.

**Pourquoi c'est important :** en cas de nouvel environnement (serveur de recette, nouveau serveur de production, reconstruction après incident), l'application casserait dès le premier paiement partiel enregistré, et la règle "un compte ne possède qu'une seule boutique" — centrale à plusieurs fonctionnalités — ne serait plus appliquée du tout.

**Solution proposée :** un nouveau fichier `backend/database/24_reparation_schema.sql`, écrit pour être **sûr à rejouer sur la base actuelle sans erreur** (donc sans casser l'environnement de développement en cours) :

```sql
-- customer_payments : recréée seulement si absente (idempotent).
CREATE TABLE IF NOT EXISTS customer_payments (
  id          SERIAL PRIMARY KEY,
  store_id    INTEGER NOT NULL REFERENCES stores(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  amount      NUMERIC NOT NULL CHECK (amount > 0),
  user_id     INTEGER NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON customer_payments (customer_id);

-- uq_stores_owner_id : ajoutée seulement si absente.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_stores_owner_id'
  ) THEN
    ALTER TABLE stores ADD CONSTRAINT uq_stores_owner_id UNIQUE (owner_id);
  END IF;
END $$;
```

Ce fichier documente rétroactivement ce qui existe déjà en base réelle — il ne modifie rien sur l'environnement actuel (les `IF NOT EXISTS`/vérification préalable le garantissent), mais rend la base reproductible à l'identique pour la première fois depuis le début du projet.

**Effort/risque :** faible. Le seul risque serait d'exécuter cette migration sur un environnement où ces éléments n'existent pas encore ET où des données incompatibles avec la contrainte `UNIQUE` existent déjà (deux boutiques avec le même `owner_id`) — peu probable vu que la contrainte est déjà active en production actuelle, mais à vérifier une fois avant d'appliquer ce fichier sur un futur environnement.

---

### A4. Valeur par défaut corrompue (`stores.country`)

**Problème :** le défaut de colonne stocké en base est `'GuinÃ©e'` (mauvais encodage) au lieu de `'Guinée'`.

**Pourquoi c'est important :** risque limité aujourd'hui (le code applicatif fournit toujours explicitement la valeur), mais toute insertion directe en base qui s'appuierait sur ce défaut produirait une donnée corrompue visible par les commerçants.

**Solution proposée :** ajouter dans le même fichier `24_reparation_schema.sql` :

```sql
ALTER TABLE stores ALTER COLUMN country SET DEFAULT 'Guinée';
```

Exécuté depuis Node.js (comme toutes les migrations de ce projet, via le driver `pg` qui force l'UTF-8 côté client — cf. `config/db.js`), cette instruction ne peut pas reproduire l'erreur d'encodage d'origine (probablement une exécution `psql` historique avec un mauvais encodage de terminal).

**Effort/risque :** trivial, aucun risque — n'affecte que les futures lignes qui s'appuieraient sur ce défaut, jamais les lignes existantes.

---

### A5. Aucune révocation immédiate de session (JWT valable 8h, rôle non revérifié)

**Problème :** `requireRole`/`requireSuperAdmin` font confiance au contenu du jeton JWT (`roleCode`, `isSuperAdmin`), jamais revérifié en base à chaque requête. Un jeton émis avant une révocation (retrait d'un Super Admin, retrait d'un employé) reste valide jusqu'à 8h après.

**Pourquoi c'est important :** dans un contexte où on retire l'accès à quelqu'un précisément parce qu'on ne lui fait plus confiance (ex. un employé malhonnête, un Super Admin compromis), une fenêtre de 8h où l'accès reste actif est un vrai risque — pas théorique.

**Solution proposée — un "numéro de version" par utilisateur, léger et cohérent avec le reste du projet :**

1. Nouvelle colonne `users.token_version INTEGER NOT NULL DEFAULT 1`.
2. À la connexion (`login`) et au changement de boutique (`switch-store`), le jeton JWT embarque ce `tokenVersion` en plus des champs actuels.
3. `requireAuth` (le point de passage unique déjà utilisé par toutes les routes) vérifie, en une requête indexée sur `users.id` (donc très rapide), que `tokenVersion` du jeton correspond bien à la valeur actuelle en base. Sinon : 401, jeton considéré comme périmé.
4. Toute action qui doit invalider immédiatement les sessions actives d'un utilisateur (révocation Super Admin, retrait d'un employé, changement de mot de passe) **incrémente** simplement `token_version` — tous ses jetons déjà émis deviennent invalides instantanément, sans avoir besoin de liste noire ni de stockage de session externe (Redis, etc.), donc sans rien ajouter à l'infrastructure.

C'est exactement le même principe déjà appliqué ailleurs dans ce projet (statut de plan, appartenance à une boutique) : **ne jamais faire confiance à une donnée mise en cache, toujours revérifier en base** — appliqué ici à l'identité elle-même plutôt qu'à une permission dérivée.

**Effort/risque :** modéré (une migration, un ajustement de `requireAuth` et des deux endroits qui émettent un jeton, plus les 2-3 endroits qui doivent désormais incrémenter `token_version`). Risque de régression faible si testé comme le reste du projet (API puis navigateur) avant mise en place — n'affecte que la validité des jetons, pas leur contenu métier.

**Mesure complémentaire, immédiate et sans code :** réduire `JWT_EXPIRES_IN` (actuellement 8h) à une durée plus courte (ex. 2h) réduit mécaniquement la fenêtre d'exposition en attendant la solution ci-dessus — un changement de configuration, pas de code.

---

### A6. `NODE_ENV`/`CORS_ORIGIN` : deux protections importantes dépendent d'un seul réglage silencieux

**Problème :** `nodeEnv: process.env.NODE_ENV || 'development'` retombe silencieusement sur le mode **le moins sûr** si la variable est absente — un oubli au déploiement repasserait discrètement en CORS ouvert à tout le monde ET en exposition des traces d'erreur techniques.

**Solution proposée :**
1. Ajouter un avertissement bruyant au démarrage (`console.warn`) si `process.env.NODE_ENV` n'est pas explicitement défini, du type : `"⚠️ NODE_ENV non défini — démarrage en mode development (CORS ouvert, erreurs détaillées). Ne jamais lancer ainsi en production."` — impossible à manquer dans les logs de démarrage.
2. Rédiger une checklist de déploiement courte (un fichier `DEPLOIEMENT.md`, quelques lignes) listant explicitement : `NODE_ENV=production`, `CORS_ORIGIN=<domaine réel>`, `JWT_SECRET=<valeur générée dédiée>`, à vérifier avant chaque mise en ligne. Peu séduisant mais c'est la protection la plus fiable contre un oubli humain — plus fiable qu'une logique de code qui devine les intentions.

**Effort/risque :** trivial, aucun risque.

---

### A7. Limitation de débit générique uniquement (pas de protection dédiée sur la connexion)

**Problème :** 300 requêtes/15 min par IP, appliqué globalement — pas de limite spécifique et plus stricte sur `/auth/login`/`/auth/register`.

**Solution proposée :** une seconde instance de `express-rate-limit` (déjà une dépendance du projet, aucun ajout nécessaire), montée uniquement sur `/auth/login` et `/auth/register`, avec un seuil bien plus bas (ex. 10 tentatives/15 min par IP) et un message d'erreur clair. Les deux limiteurs coexistent sans conflit (Express applique les deux middlewares dans l'ordre).

**Effort/risque :** faible, quelques lignes dans `auth.routes.js`. Attention à choisir un seuil qui n'empêche pas un usage légitime (plusieurs employés se connectant depuis la même boutique/même box internet) — à valider avec un seuil généreux plutôt que trop strict au premier passage.

---

## B. Majeur — fonctionnalités et cohérence

### B1. Annulation/retour de vente : backend prêt, aucun déclencheur dans l'interface

**Solution proposée :** ajouter, dans `OrderDetailModal.jsx` (et/ou `SalesHistoryPage.jsx`), pour l'Owner uniquement et avec confirmation explicite (`window.confirm`, cohérent avec le reste de l'application) :
- Un bouton "Annuler la vente" appelant `POST /orders/:id/void` (déjà protégé `OWNER`) — visible seulement si le statut le permet (pas déjà annulée/entièrement retournée).
- Un bouton "Retourner cet article" par ligne de commande, appelant `POST /orders/:orderId/items/:itemId/return` avec une quantité saisie.

Aucun changement backend nécessaire — la logique métier et la sécurité existent déjà et sont déjà couvertes par les contraintes/triggers d'immuabilité vus dans l'audit. C'est le correctif du présent document au meilleur rapport effort/valeur.

**Effort/risque :** faible — uniquement du câblage frontend vers une API déjà fonctionnelle.

---

### B2. Tables orphelines (`cash_drawers`, `invoices`, `purchases`/`purchase_items`, `stock_transfers`)

**Ce n'est pas qu'un problème technique — c'est une décision produit.** Je ne recommande pas de tout construire d'un coup ; voici mon évaluation, boutique par boutique, pour trancher au cas par cas :

| Table | Pertinence pour le contexte guinéen visé | Effort estimé | Ma recommandation |
|---|---|---|---|
| `cash_drawers` | Élevée — plusieurs vendeurs partagent souvent une même caisse physique ; ouverture/fermeture avec comptage attendu vs réel est une vraie protection contre les écarts de caisse, un souci concret pour un petit commerce | Modéré (le schéma et les triggers de calcul existent déjà, il "ne reste que" le module applicatif + l'interface) | À construire en priorité si des commerçants réels demandent ce suivi |
| `purchases`/`purchase_items` + `suppliers` | Moyenne — utile pour un commerçant qui veut tracer précisément ses achats et réceptions, mais `stock_movements` (déjà utilisé) couvre déjà l'essentiel du suivi de stock au quotidien | Élevé (vrai flux métier : commande → réception → mise à jour stock) | À différer sauf demande explicite |
| `stock_transfers` | Faible pour la majorité des utilisateurs — pertinent uniquement pour un propriétaire ayant plusieurs boutiques actives simultanément, un profil minoritaire d'après tout ce qui a été construit cette conversation (un compte ne possède qu'une seule boutique) | Modéré | Basse priorité |
| `invoices` | Concerne la facturation de la plateforme elle-même (pas les commerçants) — pertinent seulement quand la facturation cessera d'être gérée manuellement par le Super Admin | Modéré | À construire quand le volume de boutiques payantes rendra la gestion manuelle réellement contraignante |

**Solution proposée pour celles qui resteraient non construites à court terme :** ne pas les laisser dans un flou silencieux — soit les supprimer explicitement de la base (avec une migration de suppression documentée, réversible via une sauvegarde), soit ajouter un commentaire SQL directement sur chacune (`COMMENT ON TABLE cash_drawers IS 'Schéma prêt, aucun code applicatif — décision produit en attente'`) pour qu'un futur développeur comprenne immédiatement l'état réel sans devoir refaire cet audit.

---

### B3. Deux systèmes "fournisseurs" distincts portant le même nom

**Solution proposée :** ne pas fusionner (ce sont deux besoins réellement différents), mais lever l'ambiguïté par le nommage dès qu'on retouche l'un des deux systèmes :
- Garder `store_supplier_links` tel quel (fonctionnel, testé, ne pas y toucher).
- Si `purchases`/`purchase_items`/`suppliers` sont un jour construits (cf. B2), les renommer à cette occasion pour éviter la confusion définitivement — par exemple `supplier_contacts`/`purchase_orders`/`purchase_order_items` — plutôt que de garder deux concepts "fournisseur" différents sous des noms trop proches.
- En attendant, ajouter le commentaire SQL mentionné en B2 pour documenter cette distinction directement dans le schéma.

---

### B4. Module backend `stock` mort et dangereux s'il était réactivé

**Solution proposée :** suppression pure et simple du dossier `backend/src/modules/stock/` (fichiers `stock.routes.js`, `stock.controller.js`, `stock.service.js`). Il est déjà débranché (ligne commentée dans `routes/index.js`, à retirer aussi) et intégralement remplacé par les routes du module `products` (`stock-history`, `adjust-stock`), déjà en production et testées tout au long de cette conversation. Le garder "au cas où" n'apporte rien et représente un vrai risque si quelqu'un le remonte un jour sans relire cet audit (absence totale d'isolation multi-boutique dans son code).

**Effort/risque :** trivial — suppression de fichiers déjà inutilisés, aucune route ni aucun frontend n'en dépend (vérifié dans l'audit).

---

### B5. Fichier frontend orphelin et non fonctionnel (`fournisors/fournisseur.page.jsx`)

**Solution proposée :** suppression du fichier (et du dossier `fournisors/` s'il ne contient que celui-ci). Non importé nulle part, ne compilerait de toute façon pas s'il l'était (syntaxe invalide constatée dans l'audit).

**Effort/risque :** nul.

---

## C. Mineur — hygiène et robustesse à long terme

### C1. Absence totale de tests automatisés

**Ce n'est pas réaliste de viser une couverture exhaustive d'un coup** — disproportionné pour la taille de l'équipe, et pas dans l'esprit "léger" du projet. Proposition volontairement ciblée sur ce qui protège le plus, en priorité :

1. **Isolation multi-boutique** (le risque le plus grave si violé) : un test qui vérifie qu'un Vendeur/Owner de la boutique A ne peut ni lire ni modifier une ressource (produit, commande, client) de la boutique B, même en devinant un identifiant numérique valide.
2. **Calcul du solde client / paiement partiel** : la logique FIFO de répartition d'un paiement sur plusieurs commandes impayées, déjà vérifiée manuellement cette conversation — mérite un test automatisé pour ne plus jamais devoir la re-tester à la main à chaque changement.
3. **Verrouillage par plan** (gel en lecture seule quand une boutique repasse en FREEMIUM) — logique centrale et transversale (`requireActiveStore`), donc à très haut risque si un futur changement la casse sans qu'on s'en aperçoive.

Outil proposé : le testeur intégré à Node.js (`node:test`, disponible nativement depuis longtemps, aucune dépendance supplémentaire à ajouter) plutôt que Jest — cohérent avec la philosophie du projet ("pas de dépendance qui n'est pas nécessaire", déjà le principe suivi pour préférer `pg` natif à un ORM).

**Effort/risque :** modéré pour la mise en place initiale (config + 5-10 premiers tests), nul pour le code existant — des tests ne modifient jamais le comportement, seulement sa vérification.

---

### C2. Dépendances installées mais jamais utilisées (`@prisma/client`, `prisma`)

**Solution proposée :** confirmé dans le code (`pool` du driver `pg` utilisé partout, jamais un client Prisma) — les retirer de `backend/package.json` (`npm uninstall @prisma/client prisma`) et supprimer `backend/prisma/` s'il ne contient qu'un schéma non utilisé. Moins de dépendances à surveiller pour des failles de sécurité futures (chaque paquet est une surface d'attaque potentielle), sans aucun impact fonctionnel puisque rien ne les utilise.

**Effort/risque :** nul à vérifier (juste confirmer qu'aucun script `package.json` n'y fait référence avant suppression).

---

### C3. Trou de numérotation dans les migrations (08/09 absents)

**Solution proposée :** aucune action corrective nécessaire — purement cosmétique, sans conséquence sur `run_migrations.sh` (qui exécute les fichiers présents dans l'ordre numérique, peu importe les trous). Continuer la numérotation à partir de `24` pour les prochaines migrations, ne pas tenter de "combler" `08`/`09` a posteriori.

---

## Ordre d'exécution recommandé

Si vous me donnez le feu vert, voici l'ordre dans lequel je propose d'avancer — chaque étape testée (API puis navigateur, comme pour chaque fonctionnalité de cette conversation) avant de passer à la suivante :

1. **A1** (Git) — préalable à tout le reste.
2. **A2 + A6** (secret JWT obligatoire + avertissement NODE_ENV) — changements de configuration, aucun risque, gain de sécurité immédiat.
3. **A3 + A4** (migration de réparation du schéma) — rend la base reproductible.
4. **B4 + B5** (suppression du module `stock` mort et du fichier frontend orphelin) — nettoyage sans risque.
5. **A7** (rate limiting dédié à la connexion) — petit ajout ciblé.
6. **B1** (bouton annulation/retour) — la fonctionnalité manquante la plus simple à livrer, forte valeur immédiate.
7. **A5** (révocation de session via `token_version`) — le chantier le plus substantiel de la liste critique, à traiter une fois les fondations (1-4) posées.
8. **B2 + B3** (décision sur les tables orphelines et le renommage) — nécessite votre arbitrage produit avant toute écriture de code.
9. **C1 + C2** (tests automatisés ciblés, nettoyage des dépendances) — en continu, pas bloquant pour un lancement.

Dites-moi par où commencer, ou si vous voulez ajuster cet ordre.
