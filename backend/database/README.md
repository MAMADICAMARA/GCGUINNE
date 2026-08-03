# Scripts PostgreSQL — Plateforme SaaS de Gestion Commerciale

Ces scripts implémentent intégralement le modèle de données décrit au chapitre 10
du cahier des charges technique. Ils ont été **testés de bout en bout** sur une
instance PostgreSQL 16 réelle (création complète, flux de vente atomique, et
vérification des 7 règles de gestion critiques listées ci-dessous).

## Ordre d'exécution

| Fichier | Domaine | Priorité CDC |
|---|---|---|
| `00_extensions_et_fonctions.sql` | Extensions PostgreSQL + fonctions utilitaires (triggers génériques) | — |
| `01_plateforme_et_comptes.sql` | Rôles, utilisateurs, plans d'abonnement, boutiques, rattachements | P0 (+P2 pour les plans) |
| `02_catalogue_et_stock.sql` | Catégories, produits, mouvements de stock | P0 |
| `03_clients_et_ventes.sql` | Clients, ventes physiques (parcours critique) | P0 |
| `04_fournisseurs_et_achats.sql` | Fournisseurs, commandes d'achat | P1 |
| `05_caisses.sql` | Sessions de caisse (shifts) | P1 |
| `06_multi_boutiques.sql` | Transferts de stock inter-boutiques | P2 |
| `07_systeme_et_facturation.sql` | Journal d'audit, facturation d'abonnement | P1 / P2 |

Les fichiers doivent être exécutés **dans cet ordre exact** (numérotation
`00` → `07`) : plusieurs tables dépendent de tables créées dans un fichier
précédent (ex. `orders.cash_drawer_id` est rattachée à `cash_drawers` dans le
fichier `05`, via un `ALTER TABLE` après coup, pour résoudre la dépendance
croisée entre ventes et caisses sans dupliquer de logique).

## Exécution

### Option 1 — Script automatisé (recommandé)

```bash
cd backend/database
./run_migrations.sh
```

Ce script lit `DATABASE_URL` depuis `backend/.env` et exécute tous les
fichiers `NN_*.sql` dans l'ordre, en s'arrêtant à la première erreur
(`ON_ERROR_STOP=1`).

### Option 2 — Exécution manuelle

```bash
export PGPASSWORD=votre_mot_de_passe
for f in 0*.sql; do
  psql -h localhost -U postgres -d gestion_commerciale -v ON_ERROR_STOP=1 -f "$f"
done
```

### Réinitialisation (développement uniquement)

```bash
psql "$DATABASE_URL" -f drop_all.sql
```

⚠️ `drop_all.sql` supprime irréversiblement toutes les tables et toutes les
données. À ne jamais exécuter en production.

## Règles de gestion imposées au niveau base de données

Ces scripts n'implémentent pas seulement la structure des tables : ils font
respecter, directement au niveau PostgreSQL, plusieurs règles critiques du
cahier des charges (contraintes `CHECK`, index uniques, triggers), afin
qu'aucune couche applicative ne puisse les contourner par erreur :

- **Aucune survente possible** : la quantité en stock ne peut jamais devenir
  négative (`CHECK (quantity >= 0)` sur `products`).
- **Immutabilité du stock et de l'audit** : `stock_movements` et
  `system_logs` refusent toute `UPDATE`/`DELETE` après écriture.
- **Aucune suppression physique des ventes, achats ou transferts** :
  `orders`, `purchases` et `stock_transfers` refusent tout `DELETE`.
- **Ligne de vente gelée** : `order_items` interdit la modification de la
  quantité, du prix ou du produit d'une ligne déjà enregistrée.
- **Une seule caisse ouverte par vendeur et par boutique** (index unique
  partiel sur `cash_drawers`).
- **Isolation multi-boutiques** : toute table métier référence explicitement
  `store_id`.
- **E-mail insensible à la casse et unique** (index sur `LOWER(email)`).

## Lien avec Prisma

Le backend utilise Prisma comme client d'accès aux données
(`backend/prisma/schema.prisma`). Deux options pour les faire coexister :

1. **Recommandé pour rester fidèle à ces scripts** : exécuter ces fichiers
   SQL comme source de vérité du schéma, puis générer le modèle Prisma à
   partir de la base existante :
   ```bash
   npx prisma db pull
   npx prisma generate
   ```
2. **Alternative** : modéliser directement les mêmes tables dans
   `schema.prisma` et laisser Prisma générer ses propres migrations
   (`prisma migrate dev`). Dans ce cas, ces scripts SQL servent de
   référence/documentation mais ne doivent plus être exécutés en parallèle
   des migrations Prisma, pour éviter toute divergence.
