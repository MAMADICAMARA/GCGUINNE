## 🚀 Guide de démarrage — P0.1 Authentification

### 📋 Checklist de démarrage

#### 1️⃣ **Initialiser la base de données**
```bash
cd backend/database

# Réinitialiser (développement uniquement)
bash drop_all.sh

# Créer le schéma et les données de référence
bash run_migrations.sh
```

✅ Vérification :
```sql
-- Vérifier que les tables existent
\dt public.*

-- Vérifier les rôles et plans
SELECT * FROM roles;
SELECT * FROM subscription_plans;
```

---

#### 2️⃣ **Démarrer le backend**
```bash
cd backend

# Variables d'environnement (déjà présentes dans .env)
# Vérifier: DATABASE_URL, JWT_SECRET, PORT=4000

npm install  # si pas fait
npm run dev
```

✅ Vérification :
```
API démarrée sur http://localhost:4000/api/v1
Environnement : development
```

Tester health check:
```bash
curl http://localhost:4000/api/v1/health
# Réponse: {"status":"ok","timestamp":"..."}
```

---

#### 3️⃣ **Démarrer le frontend**
```bash
cd frontend

npm install  # si pas fait
npm run dev
```

✅ Vérification :
```
Local:        http://localhost:5173/
```

Accéder à http://localhost:5173 → redirection vers `/login` ✅

---

### 🧪 Tests d'intégration

#### Test 1: Inscription (Register)

**Frontend** : http://localhost:5173/register
```
1. Remplir le formulaire :
   - Nom complet: "Test User"
   - Email: "test@example.com"
   - Mot de passe: "Password123"
   - Boutique: "Test Store"
   - Catégorie: "Téléphonie"
   - Ville: "Conakry"
   - Téléphone: "+224600000000"
2. Cliquer "Créer ma boutique"
3. ✅ Redirection vers /dashboard
```

**Backend (curl)**:
```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "Password123",
    "storeName": "Test Store",
    "storeCity": "Conakry"
  }'

# Réponse attendue: { token, user, stores }
```

---

#### Test 2: Connexion (Login)

**Frontend** : http://localhost:5173/login
```
1. Email: "test@example.com"
2. Mot de passe: "Password123"
3. Cliquer "Se connecter"
4. ✅ Redirection vers /dashboard
```

**Backend (curl)**:
```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Password123"
  }'
```

---

#### Test 3: Multi-boutiques

**Scénario** : L'utilisateur possède 2 boutiques
```
1. Créer 2 boutiques via inscription (2 comptes) OU directement en BD
2. Affecter le même utilisateur à 2 boutiques en BD :
   INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
   VALUES (1, 1, 1, true), (1, 2, 2, false);
3. Se connecter → voir /select-store
4. Choisir une boutique → voir le sélecteur dans la barre latérale
5. Changer de boutique → page se recharge automatiquement
```

---

#### Test 4: Permissions par rôle

**Navigation filtrée** :
```
- OWNER: Tous les menus
- MANAGER: Tout sauf "Équipe" et "Paramètres"
- SELLER: Seulement "Caisse/Vente" et "Clients"
```

Tester en changeant le rôle en BD:
```sql
UPDATE user_store SET role_id = 4 WHERE user_id = 1;  -- SELLER
```

Puis rafraîchir → navigation simplifiée ✅

---

#### Test 5: Isolation des boutiques

**Vérifier qu'aucune fuite de données** :

1. Créer 2 boutiques (Boutique A et B)
2. Se connecter à Boutique A
3. Modifier l'ID boutique dans les requêtes XHR (dev tools)
4. ✅ Vérifier que l'API refuse l'accès (401/403)

---

### 📊 Checklist de validation P0.1

- [ ] Base de données initialisée sans erreur
- [ ] Backend démarré et health check OK
- [ ] Frontend démarré et accessible
- [ ] Inscription crée utilisateur + boutique en BD
- [ ] Connexion régénère token valide
- [ ] Token JWT contient { userId, storeId, roleCode }
- [ ] Boutique unique → accès direct au /dashboard
- [ ] Boutiques multiples → /select-store s'affiche
- [ ] SelectStorePage peut changer de boutique (switch-store)
- [ ] DashboardLayout affiche navigation filtrée par rôle
- [ ] Logout() revient à /login
- [ ] Erreurs métier affichées correctement (email existant, credentials invalides)
- [ ] Audit logs: REGISTER, LOGIN, SWITCH_STORE en BD

---

### 🐛 Troubleshooting

**Erreur: "DATABASE_URL invalide"**
```
→ Vérifier .env backend : DATABASE_URL
→ Format: postgresql://user:password@host:port/database?schema=public
→ Tester: psql $DATABASE_URL -c "SELECT 1"
```

**Erreur: "CORS error" frontend**
```
→ Vérifier .env backend : CORS_ORIGIN=http://localhost:5173
→ Vérifier que le frontend est sur le bon port
```

**Erreur 401 "Token invalide"**
```
→ Token expiré? Vérifier JWT_EXPIRES_IN (.env)
→ Secret changé? Même secret dans les deux instances
```

**Boutique n'apparaît pas après inscription**
```
→ Vérifier user_store créée en BD
→ Vérifier role_id exists (SELECT * FROM roles)
→ Vérifier subscription_plan FREEMIUM existe
```

---

### 📝 Prochaines étapes

✅ P0.1 Complétée

🔄 **Passer à P0.2** — Catalogue et Stock :
- Module products (CRUD, recherche)
- Module stock (mouvements, historique)
- Attributs dynamiques par secteur

🚨 **Ou P0.3** — Vente physique (CRITIQUE) :
- Validation atomique stock
- Gestion concurrence multi-vendeurs
- Tests de charge (20+ caisses)

Commandement recommandé: **P0.3 immédiatement** (cœur du produit)
