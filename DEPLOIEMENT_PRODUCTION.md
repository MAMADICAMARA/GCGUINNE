# Plan de mise en production — Render

**Date :** 5 août 2026
**Cible d'hébergement :** Render (backend + PostgreSQL managé), sous-domaine `.onrender.com` pour commencer (domaine personnalisé plus tard).
**Portée de ce document :** un plan concret, dans la continuité de `SOLUTIONS_AUDIT_PRODUCTION.md` (dont la plupart des points critiques A1-A7 et B4/B5 sont déjà traités). **Ceci est une proposition — aucun code n'a été modifié.** Je code dès que vous donnez le feu vert, dans l'ordre qui vous convient.

---

## Sommaire

- [Vue d'ensemble — architecture cible](#vue-densemble--architecture-cible)
- [A. Critique — à traiter avant la mise en ligne](#a--critique--à-traiter-avant-la-mise-en-ligne)
- [B. Configuration Render concrète](#b--configuration-render-concrète)
- [C. Important mais pas bloquant](#c--important-mais-pas-bloquant)
- [D. Secondaire](#d--secondaire)
- [Checklist finale avant bascule](#checklist-finale-avant-bascule)
- [Ordre d'exécution recommandé](#ordre-dexécution-recommandé)

---

## Vue d'ensemble — architecture cible

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  Render Static Site  │ ───▶ │   Render Web Service   │ ───▶ │  Render PostgreSQL   │
│  (frontend, build     │      │   (backend Express)   │      │   (plan payant,      │
│   Vite servi tel quel)│      │   node src/server.js  │      │   sauvegardes        │
│  monapp.onrender.com  │      │  monapp-api.onrender  │      │   automatiques)      │
└─────────────────────┘      └──────────────────────┘      └─────────────────────┘
                                        │
                                        ▼
                        ┌───────────────────────────────┐
                        │  Services externes déjà utilisés │
                        │  - Cloudflare R2 (images)        │
                        │  - SMTP Gmail (e-mails)          │
                        └───────────────────────────────┘
```

Trois services Render distincts, un seul tableau de bord. Le frontend et le backend sont déployés indépendamment (chacun redéploie automatiquement sur `git push`), reliés par `VITE_API_URL` (frontend → backend) et `CORS_ORIGIN` (backend → frontend), tous deux déjà supportés par le code actuel — rien à coder pour ce découplage, seulement à configurer.

---

## A. Critique — à traiter avant la mise en ligne

### A1. Secrets de production distincts — ✅ RÉSOLU (2026-08-06)

**Problème :** `JWT_SECRET`, le mot de passe PostgreSQL, les clés R2, le mot de passe SMTP actuellement dans `backend/.env` sont des valeurs de développement — jamais destinées à protéger de vraies données de commerçants.

**Décisions prises :**
1. Nouveau `JWT_SECRET` de production généré (`crypto.randomBytes(48)`, cryptographiquement sûr) — communiqué à l'utilisateur, jamais écrit dans un fichier du projet ni dans le `.env` local (qui garde sa propre valeur de dev). À conserver par l'utilisateur jusqu'à l'étape B (saisie dans Render).
2. Le mot de passe PostgreSQL sera régénéré par Render à la création de la base managée (`DATABASE_URL` fourni automatiquement, jamais saisi à la main) — rien à faire avant l'étape B.
3. **Comptes R2/Gmail** : décision prise de garder les mêmes comptes qu'en test (pas de comptes dédiés séparés dev/prod) — les valeurs `R2_*`/`SMTP_*` actuelles du `.env` seront directement recopiées dans Render à l'étape B, sans rien recréer.
4. **`JWT_EXPIRES_IN` réduit à `2h` en production** (distinct des `8h` du `.env` de dev) — décidé après clarification de la différence entre révocation immédiate (déjà instantanée via `token_version`, pour tout événement explicite : retrait d'employé, révocation Super Admin, reset de mot de passe) et durée de vie passive d'un jeton non révoqué (seul rempart contre un jeton volé sans qu'aucune action de retrait n'ait eu lieu). Pas de renouvellement automatique de session dans ce projet — l'utilisateur devra se reconnecter manuellement après 2h d'inactivité de connexion.
5. Toutes ces valeurs seront saisies directement dans l'onglet "Environment" du service Render à l'étape B — jamais commitées, jamais transmises par un autre canal que le tableau de bord Render lui-même.

**Effort/risque :** trivial, aucun risque — action de configuration pure.

---

### A2. Suivi des migrations — le vrai trou technique actuel — ✅ RÉSOLU (2026-08-06)

**Problème :** les 32 fichiers `backend/database/*.sql` sont appliqués un par un, à la main, via des scripts Node jetables (`_tmp_apply_migration_XX.cjs`, supprimés après usage) ou un script shell (`run_migrations.sh`) qui **rejoue tout depuis le début** — inutilisable pour appliquer seulement les *nouvelles* migrations sur une base déjà à jour. Il n'existe **aucune trace en base** de quelles migrations ont déjà tourné.

**Pourquoi c'est important :** sur Render, chaque déploiement doit pouvoir appliquer automatiquement les migrations manquantes, sans rejouer celles déjà appliquées (qui échoueraient sur des `CREATE TABLE` déjà existants) et sans en oublier une. Sans mécanisme fiable, chaque mise à jour de schéma redevient une opération manuelle risquée sur la base de production.

**Solution proposée :**
1. Nouvelle table `schema_migrations (filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`, créée automatiquement si absente.
2. Un script `backend/database/run-migrations.js` (Node, réutilise le driver `pg` déjà en place) qui : liste les fichiers `.sql` du dossier, ignore ceux déjà présents dans `schema_migrations`, exécute les nouveaux dans l'ordre numérique, chacun dans sa propre transaction, et enregistre son nom après succès.
3. Ce script devient la **seule** façon d'appliquer une migration désormais (dev comme prod) — remplace les scripts `_tmp_apply_migration_XX.cjs` jetables utilisés jusqu'ici pendant cette conversation.
4. Sur Render : configuré comme "Pre-Deploy Command" du Web Service (`node database/run-migrations.js`) — s'exécute automatiquement avant chaque redémarrage du backend, applique uniquement ce qui manque.
5. Première exécution sur la base de prod (vide) : applique les 32 migrations existantes dans l'ordre, exactement comme un `run_migrations.sh` classique, mais en gardant la trace pour la suite.

**Effort/risque :** modéré (un script à écrire et tester soigneusement sur une copie de la base avant de le brancher sur Render) — c'est le morceau technique le plus substantiel de ce document, mais aussi le plus structurant.

**Résolu :** `backend/database/run-migrations.js` créé et testé de bout en bout — une base reconstruite uniquement à partir des fichiers de migration est désormais **structurellement identique** (colonnes, contraintes, index) à la base réelle, vérifié programmatiquement. Au passage, 6 écarts de schéma jamais détectés avant ont été trouvés et corrigés : `users.is_super_admin`/`gender`/`birth_date` restaurés dans deux fichiers `08_super_admin.sql`/`09_profil_utilisateur.sql` retrouvés par l'utilisateur (et corrigés — un index et une contrainte fantômes retirés/ajoutés pour correspondre exactement à la réalité), `customers.balance_due`, `orders.amount_paid`, la valeur `PARTIALLY_PAID` de `orders.payment_status`, et la valeur `INITIAL_STOCK` de `stock_movements.type` ajoutés à `24_reparation_schema.sql`. La base de développement a été migrée vers ce suivi (`--mark-existing`, aucune donnée modifiée). Reste seulement à brancher `node database/run-migrations.js` comme "Pre-Deploy Command" une fois le Web Service Render créé (étape B).

---

### A3. Choix du plan PostgreSQL Render — ✅ RÉSOLU (2026-08-06)

**Problème :** le tier gratuit de Render Postgres expire après 30 jours et n'offre aucune sauvegarde automatique fiable — inutilisable pour de vraies données de commerçants au-delà d'une phase de test.

**Solution proposée :** choisir un plan payant dès la mise en ligne réelle (le moins cher suffit largement au volume actuel) — inclut sauvegardes automatiques quotidiennes et pas de date d'expiration. Vérifier la rétention exacte des sauvegardes offerte par le plan choisi et, si elle est courte, envisager en complément un export manuel périodique (`pg_dump`) stocké ailleurs (ex: le même bucket R2 déjà utilisé pour les images).

**Décision prise, après vérification des tarifs réels sur les sources officielles Render (pas une estimation) :**
- **PostgreSQL Basic-256mb (~6 $/mois)** — sauvegardes automatiques avec 3 jours de rétention (point-in-time recovery), largement suffisant pour le volume actuel (base réelle : 11 Mo). Stockage additionnel à 0,30 $/Go/mois si besoin plus tard, ajustable sans migration.
- **Web Service Starter (~7 $/mois)**, décidé dans le même mouvement bien que hors du périmètre strict de "PostgreSQL" : le plan gratuit du backend se met en veille après 15 min d'inactivité (30-60s de réveil) — inacceptable pour une appli de caisse utilisée en continu.
- **Frontend (Static Site)** : gratuit en permanence chez Render, aucune décision budgétaire nécessaire.
- **Total : ~13 $/mois** pour démarrer.

**Effort/risque :** aucun risque technique — décision de budget, validée avec l'utilisateur.

---

### A4. Jeton de connexion en mémoire seule côté frontend

**Problème :** confirmé dans le code (`authStore.js`) — aucune persistance (`localStorage`, `sessionStorage`, cookie) du token JWT. Un rafraîchissement de page, un onglet fermé par erreur, ou un crash du navigateur déconnecte immédiatement l'utilisateur, qui doit ressaisir son mot de passe.

**Pourquoi c'est important :** en dev/test, ce n'est presque jamais remarqué (on ne recharge pas la page en permanence). En usage réel, un commerçant qui recharge sa page en pleine vente perd sa session — irritant, potentiellement perçu comme un bug plutôt qu'un choix de sécurité.

**Solution proposée — deux options, à trancher ensemble :**
- **Option A (statu quo assumé) :** ne rien changer. C'est objectivement le plus sûr contre le vol de jeton par XSS (rien n'est lisible en JavaScript après un rechargement), au prix de l'UX décrite ci-dessus.
- **Option B (cookie `httpOnly`) :** le backend pose le jeton dans un cookie `httpOnly`+`secure`+`sameSite` au lieu de le renvoyer dans le corps de la réponse JSON ; le frontend n'a plus besoin de le gérer manuellement, la session survit à un rechargement, ET reste inaccessible à un script malveillant (meilleur des deux mondes). Demande de modifier `apiClient.js` (retirer l'injection manuelle du header `Authorization`, passer en `withCredentials`) et chaque endroit qui émet un jeton (`login`, `register`/`verifyEmail`, `switchStore`).

**Effort/risque :** Option A = nul. Option B = modéré (plusieurs points de contact bien identifiés, mais tous déjà listés dans ce projet) — à tester soigneusement (API + navigateur) avant bascule, comme chaque fonctionnalité de ce projet.

---

## B. Configuration Render concrète

### B1. Backend — Web Service

- **Build command :** `npm install` (dans `backend/`)
- **Pre-deploy command :** `node database/run-migrations.js` (une fois A2 en place)
- **Start command :** `npm start` (déjà `node src/server.js`, déjà prêt pour un environnement conteneurisé — arrêt propre sur SIGTERM déjà géré)
- **Health check path :** `/api/v1/health` (endpoint déjà existant, rien à ajouter)
- **Variables d'environnement à définir :** `NODE_ENV=production`, `PORT` (fourni automatiquement par Render, ne pas le fixer en dur), `DATABASE_URL` (fourni automatiquement si la base est créée dans le même projet Render), `CORS_ORIGIN=https://<domaine-du-frontend>.onrender.com`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `BCRYPT_SALT_ROUNDS`, les 5 variables `R2_*`, les 6 variables `SMTP_*`/`EMAIL_FROM_*` — la liste exacte existe déjà dans `backend/.env.example`, à recopier clé par clé (jamais les valeurs) dans le tableau de bord Render.

### B2. Frontend — Static Site

- **Build command :** `npm install && npm run build` (dans `frontend/`)
- **Publish directory :** `dist/`
- **Variable d'environnement :** `VITE_API_URL=https://<domaine-du-backend>.onrender.com/api/v1`
- Render gère nativement le routage SPA (redirection de toutes les routes vers `index.html`) — à vérifier une fois le service créé, sinon une règle de rewrite `/* → /index.html` est à ajouter dans les paramètres du Static Site.

### B3. Base de données — PostgreSQL managé

- Créée directement dans le tableau de bord Render (plan payant, cf. A3).
- `DATABASE_URL` généré automatiquement et injecté dans le Web Service s'ils sont liés dans le même projet Render — aucune valeur à copier-coller à la main.

---

## C. Important mais pas bloquant

### C1. Suivi d'erreurs en production

**Problème :** aucune remontée active des erreurs 500 — actuellement, seule la consultation manuelle des logs Render permettrait de les découvrir.

**Solution proposée :** intégrer un service de suivi d'erreurs (Sentry a un plan gratuit largement suffisant au volume actuel) — quelques lignes dans `middlewares/errorHandler.js` (déjà le point de passage unique pour toute erreur ≥500) pour envoyer chaque erreur serveur à Sentry, sans rien changer au comportement actuel côté client.

**Effort/risque :** faible, isolé à un seul fichier déjà centralisé.

---

### C2. Décision sur les tables orphelines `stock_transfers`/`invoices`

Rappel de B2 dans `SOLUTIONS_AUDIT_PRODUCTION.md`, toujours en attente de votre arbitrage : `cash_drawers` et `purchases`/`purchase_items` ont depuis été construits (cette conversation), mais `stock_transfers` et `invoices` restent des tables sans aucun code applicatif. À trancher avant la mise en ligne pour éviter un flou silencieux dans le schéma de prod : suppression explicite, ou commentaire SQL documentant l'attente.

---

### C3. Fiabilité des e-mails Gmail à surveiller

Déjà couvert dans `project_smtp_gmail_spam.md` (mémoire) — décision actuelle : rester sur Gmail SMTP, vérifier le dossier Spam en cas de signalement. À garder à l'esprit une fois de vrais utilisateurs inscrits : si plusieurs se plaignent de ne pas recevoir leurs codes, c'est le signal pour migrer vers Brevo (le code `nodemailer` resterait identique, seules les variables `SMTP_*` changeraient).

---

## D. Secondaire

### D1. Champ `engines` absent de `backend/package.json`

Rien ne garantit que Render utilise la même version de Node que votre environnement de développement. Solution triviale : ajouter `"engines": { "node": ">=22" }` (ou la version exacte utilisée en dev) — Render la respecte automatiquement.

### D2. Tests automatisés (C1 de l'audit précédent)

Toujours non commencés — non-bloquant pour un lancement, mais rappelé ici pour mémoire. Peut être fait en continu après la mise en ligne.

---

## Checklist finale avant bascule

À cocher juste avant de considérer la plateforme "en production" :

- [ ] `NODE_ENV=production` défini sur le Web Service Render
- [x] `JWT_SECRET` régénéré, distinct de la valeur de dev — généré le 2026-08-06, conservé par l'utilisateur, reste à saisir dans Render (étape B)
- [ ] `JWT_EXPIRES_IN=2h` saisi dans Render (décidé le 2026-08-06, distinct des `8h` du `.env` de dev)
- [ ] `CORS_ORIGIN` pointe vers le vrai domaine du frontend (jamais `*`, jamais localhost)
- [ ] Plan PostgreSQL Basic-256mb actif (~6 $/mois, décidé le 2026-08-06), sauvegardes automatiques (3 jours de rétention) confirmées
- [ ] Web Service sur plan Starter (~7 $/mois, décidé le 2026-08-06) — jamais le plan gratuit (veille après 15 min d'inactivité)
- [x] Script de migrations testé sur une copie de la base avant le premier déploiement réel — `run-migrations.js`, testé et validé le 2026-08-06 (correspondance parfaite avec la base réelle)
- [ ] Les 5 variables `R2_*` et 6 variables `SMTP_*`/`EMAIL_FROM_*` saisies dans Render (mêmes comptes qu'en test, décidé le 2026-08-06)
- [ ] `GET /health` répond correctement une fois déployé
- [ ] Un compte de test réel (inscription → vérification e-mail → connexion → vente) validé sur l'environnement Render, pas seulement en local

---

## Ordre d'exécution recommandé

1. ~~**A2** (suivi des migrations)~~ — ✅ fait et testé le 2026-08-06.
2. ~~**A1 + A3** (secrets + choix du plan Postgres)~~ — ✅ décidés le 2026-08-06.
3. **B1 + B2 + B3** (création effective des 3 services Render) — **prochaine étape**, une fois A2 prêt à être branché en "pre-deploy command" (déjà le cas).
4. **Checklist finale** — validée avant d'annoncer quoi que ce soit à de vrais utilisateurs.
5. **A4** (décision jeton mémoire vs cookie) — peut se faire avant ou après la première mise en ligne, n'affecte pas le déploiement lui-même.
6. **C1 + C2 + C3** — en continu après le lancement, jamais bloquant.
7. **D1 + D2** — quand vous avez du temps disponible.

Dites-moi par où commencer, ou si vous voulez ajuster cet ordre.
