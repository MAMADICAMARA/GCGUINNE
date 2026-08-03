# Plateforme SaaS de Gestion Commerciale Multi-Boutiques

Initialisation du projet — Frontend React (Vite) + Backend Node.js/Express + PostgreSQL (Prisma).
Cette structure suit le cahier des charges technique v1.0.0 (priorisation P0 → P3).

## Structure du dépôt

```
gestion-commerciale-saas/
├── backend/                 API Node.js / Express
│   ├── database/             Scripts SQL PostgreSQL (schéma complet, testé)
│   │   ├── 00_extensions_et_fonctions.sql
│   │   ├── 01_plateforme_et_comptes.sql
│   │   ├── 02_catalogue_et_stock.sql
│   │   ├── 03_clients_et_ventes.sql
│   │   ├── 04_fournisseurs_et_achats.sql
│   │   ├── 05_caisses.sql
│   │   ├── 06_multi_boutiques.sql
│   │   ├── 07_systeme_et_facturation.sql
│   │   ├── run_migrations.sh
│   │   ├── drop_all.sql
│   │   └── README.md
│   ├── prisma/
│   │   └── schema.prisma    Connexion PostgreSQL (à synchroniser via `prisma db pull`)
│   ├── src/
│   │   ├── config/          Variables d'environnement, client Prisma
│   │   ├── middlewares/     Authentification, permissions, gestion d'erreurs
│   │   ├── modules/         Modules métiers (auth, stores, products, stock, orders...)
│   │   ├── routes/          Routeur principal versionné (/api/v1)
│   │   ├── jobs/            Tâches planifiées (facturation, agrégats...)
│   │   ├── app.js           Configuration Express (middlewares globaux)
│   │   └── server.js        Point d'entrée
│   ├── .env.example
│   └── package.json
│
└── frontend/                 Application React (Vite + Tailwind v4)
    ├── src/
    │   ├── layouts/          AuthLayout, DashboardLayout (navigation filtrée par rôle)
    │   ├── pages/             Un dossier par module fonctionnel
    │   ├── routes/            Routage protégé + configuration de navigation par rôle
    │   ├── services/          Client API centralisé (axios)
    │   ├── store/              État global (zustand) : session, boutique active
    │   └── App.jsx
    ├── .env.example
    └── package.json
```

## Prérequis

- Node.js ≥ 18 (testé avec Node 22)
- Une instance PostgreSQL accessible (locale ou distante)

## Démarrage — Backend

```bash
cd backend
cp .env.example .env        # renseigner DATABASE_URL, JWT_SECRET, etc.
npm install                 # déjà fait lors de l'initialisation

# Créer la base de données PostgreSQL et appliquer le schéma complet
# (scripts testés de bout en bout — voir backend/database/README.md)
createdb gestion_commerciale
cd database && ./run_migrations.sh && cd ..

npm run dev                 # démarre l'API en mode développement (http://localhost:4000)
```

> **Note d'environnement :** `npm run prisma:generate` / `prisma:migrate`
> téléchargent des binaires depuis `binaries.prisma.sh`. Si votre réseau
> restreint les domaines sortants, autorisez ce domaine, ou utilisez
> `npx prisma db pull` après avoir appliqué les scripts SQL de
> `backend/database/` pour synchroniser Prisma sur le schéma existant.

## Démarrage — Frontend

```bash
cd frontend
cp .env.example .env         # VITE_API_URL doit pointer vers l'API backend
npm install                  # déjà fait lors de l'initialisation
npm run dev                  # démarre l'application (http://localhost:5173)
```

## État actuel de l'initialisation

- ✅ Structure de dossiers backend/frontend conforme à l'architecture cible.
- ✅ Dépendances de production et de développement installées et vérifiées.
- ✅ Serveur Express fonctionnel (route `/api/v1/health` testée avec succès).
- ✅ Build frontend fonctionnel (Vite + Tailwind v4 + routage protégé par rôle).
- ✅ Squelettes des écrans P0/P1 en place (voir cahier des charges §8).
- ✅ Schéma PostgreSQL complet (18 tables, toutes priorités P0→P2), **testé de
  bout en bout** sur une instance PostgreSQL 16 réelle : flux de vente
  atomique validé, ainsi que les 7 règles de gestion critiques (anti-survente,
  immutabilité des ventes/mouvements de stock/audit, unicité de caisse
  ouverte, etc.). Voir `backend/database/README.md`.
- ✅ Module d'authentification fonctionnel de bout en bout (backend + frontend) :
  - `POST /api/v1/auth/register` — création d'un compte propriétaire + sa
    première boutique (transaction atomique), avec écriture dans le journal
    d'audit.
  - `POST /api/v1/auth/login` — connexion, émission d'un jeton JWT portant
    l'identité et, si une seule boutique, le contexte boutique actif.
  - `POST /api/v1/auth/switch-store` — changement de boutique active pour un
    propriétaire multi-boutiques (régénère le jeton).
  - Pages frontend `/register` et `/login` branchées sur ces routes.
  - **Testé** : inscription, connexion, mauvais mot de passe (401), e-mail en
    doublon insensible à la casse (409).
- ⏳ Synchronisation du client Prisma sur ce schéma (optionnel — le backend
  utilise directement le driver `pg`, sans dépendre des binaires Prisma).
- ⏳ Implémentation des modules métiers restants (produits, stock, ventes...).

## Créer votre premier compte

1. Démarrez le backend (`npm run dev` dans `backend/`) et le frontend
   (`npm run dev` dans `frontend/`).
2. Ouvrez `http://localhost:5173/register`.
3. Renseignez votre nom, e-mail, mot de passe, et les informations de votre
   première boutique. Vous serez automatiquement connecté et redirigé vers
   le tableau de bord.

## Prochaines étapes recommandées

1. Implémenter le parcours de vente (POS) côté backend en respectant la règle
   d'atomicité décrite au §9.2 du cahier des charges (déjà validée au niveau SQL).
2. Implémenter la gestion des produits, catégories et du stock.
3. Brancher les autres pages frontend correspondantes sur l'API réelle.
4. Ajouter les middlewares de vérification systématique du `store_id` actif
   sur chaque route métier (isolation multi-boutiques, cf. §9.1).
