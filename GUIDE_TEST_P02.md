## 🚀 Guide de test — P0.2 Catalogue & Stock

### 📋 Checklist Démarrage

#### 1️⃣ **Vérifier la BD (migrations appliquées)**
```bash
cd backend/database
psql $DATABASE_URL -c "SELECT * FROM categories LIMIT 1;"
psql $DATABASE_URL -c "SELECT * FROM products LIMIT 1;"
psql $DATABASE_URL -c "SELECT * FROM stock_movements LIMIT 1;"
```

✅ Attendu: 3 tables existent (même si vides)

---

#### 2️⃣ **Démarrer le backend**
```bash
cd backend
npm run dev
```

✅ Attendu:
```
API démarrée sur http://localhost:4000/api/v1
Port: 4000
```

---

#### 3️⃣ **Démarrer le frontend**
```bash
cd frontend
npm run dev
```

✅ Attendu:
```
Local:        http://localhost:5173/
```

---

### 🧪 TESTS API (curl / Postman)

#### **Test 1: Authentification (réutiliser P0.1)**

```bash
# 1. Créer un compte propriétaire
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "password": "Password123",
    "storeName": "Test Store"
  }')

TOKEN=$(echo $REGISTER_RESPONSE | jq -r '.token')
STORE_ID=$(echo $REGISTER_RESPONSE | jq -r '.stores[0].id')

echo "Token: $TOKEN"
echo "Store ID: $STORE_ID"
```

✅ Attendu: Token JWT valide + Store ID

---

#### **Test 2: Créer des catégories**

```bash
# Créer "Électronique"
CAT_RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Électronique"
  }')

CAT_ID=$(echo $CAT_RESPONSE | jq -r '.category.id')
echo "Catégorie ID: $CAT_ID"

# Créer "Téléphones" (sous-catégorie)
curl -s -X POST http://localhost:4000/api/v1/categories \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Téléphones",
    "parentId": '$CAT_ID'
  }' | jq .

# Lister les catégories
curl -s -X GET http://localhost:4000/api/v1/categories \
  -H "Authorization: Bearer $TOKEN" | jq .
```

✅ Attendu: Catégories créées et listées sans erreur

---

#### **Test 3: Créer des produits**

```bash
# Produit 1: Samsung Galaxy A10
PROD_1=$(curl -s -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Samsung Galaxy A10",
    "reference": "SGA10-001",
    "description": "Téléphone 4G, 32GB, Android",
    "purchasePrice": 150000,
    "sellingPrice": 180000,
    "lowStockThreshold": 2,
    "categoryId": '$CAT_ID',
    "imageUrl": "https://via.placeholder.com/200",
    "status": "ACTIVE"
  }')

PROD_ID_1=$(echo $PROD_1 | jq -r '.product.id')
echo "Produit 1 créé: $PROD_ID_1"

# Produit 2: iPhone 12 (prix plus cher)
PROD_2=$(curl -s -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "iPhone 12",
    "reference": "IP12-001",
    "purchasePrice": 500000,
    "sellingPrice": 600000,
    "lowStockThreshold": 1,
    "categoryId": '$CAT_ID',
    "status": "ACTIVE"
  }')

PROD_ID_2=$(echo $PROD_2 | jq -r '.product.id')
echo "Produit 2 créé: $PROD_ID_2"
```

✅ Attendu: 2 produits créés avec IDs

---

#### **Test 4: Lister les produits**

```bash
# Lister tous (pagination par défaut: 20 items)
curl -s -X GET "http://localhost:4000/api/v1/products?page=1&limit=20&status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" | jq '.products | length'

# Avec recherche
curl -s -X GET "http://localhost:4000/api/v1/products?search=Samsung&status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" | jq '.products'

# Filtre catégorie
curl -s -X GET "http://localhost:4000/api/v1/products?categoryId=$CAT_ID&status=ACTIVE" \
  -H "Authorization: Bearer $TOKEN" | jq '.total'

# Alerte stock faible
curl -s -X GET "http://localhost:4000/api/v1/products/low-stock/alert?limit=20" \
  -H "Authorization: Bearer $TOKEN" | jq '.'
```

✅ Attendu: Liste complète, comptage correct, filtres applicables

---

#### **Test 5: Récupérer un produit (avec mouvements stock)**

```bash
curl -s -X GET "http://localhost:4000/api/v1/products/$PROD_ID_1?includeMovements=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.product'
```

✅ Attendu: Détails produit + tableau movements vide (pas encore de mouvements)

---

#### **Test 6: Modifier un produit**

```bash
curl -s -X PATCH http://localhost:4000/api/v1/products/$PROD_ID_1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "sellingPrice": 200000,
    "status": "ACTIVE"
  }' | jq '.product | {name, sellingPrice: .selling_price, status}'
```

✅ Attendu: Prix de vente mis à jour à 200000

---

#### **Test 7: Enregistrer un mouvement de stock (PURCHASE_IN)**

```bash
# Réception d'achat: 50 Samsung Galaxy A10
MOVEMENT=$(curl -s -X POST http://localhost:4000/api/v1/stock/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": '$PROD_ID_1',
    "type": "PURCHASE_IN",
    "quantity": 50,
    "unitCost": 150000,
    "referenceTable": "purchases",
    "referenceId": 1,
    "note": "Achat auprès de Samsung France"
  }')

echo $MOVEMENT | jq '.movement'
```

✅ Attendu:
- Mouvement créé avec ID
- Quantité produit augmentée de 50 (vérifier GET /products/$PROD_ID_1)

---

#### **Test 8: Vérifier que la quantité du produit a augmenté**

```bash
curl -s -X GET "http://localhost:4000/api/v1/products/$PROD_ID_1" \
  -H "Authorization: Bearer $TOKEN" | jq '.product | {name, quantity}'
```

✅ Attendu: `quantity: 50`

---

#### **Test 9: Enregistrer une vente (SALE_OUT)**

```bash
# Vente de 3 Samsung
SALE=$(curl -s -X POST http://localhost:4000/api/v1/stock/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": '$PROD_ID_1',
    "type": "SALE_OUT",
    "quantity": 3,
    "referenceTable": "orders",
    "referenceId": 1001,
    "note": "Vente comptoir client A"
  }')

echo $SALE | jq '.movement'
```

✅ Attendu: Mouvement créé, quantity produit maintenant = 47

---

#### **Test 10: Vérifier SALE_OUT engendre alerte stock faible**

```bash
# Vendre tous les stock sauf 2 (pour atteindre le seuil de 2)
# Currently 47, threshold=2 → vendre 46 (reste 1)
curl -s -X POST http://localhost:4000/api/v1/stock/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": '$PROD_ID_1',
    "type": "SALE_OUT",
    "quantity": 46
  }' | jq '.message'

# Vérifier alerte
curl -s -X GET "http://localhost:4000/api/v1/products/low-stock/alert" \
  -H "Authorization: Bearer $TOKEN" | jq '.products[] | {name, quantity, low_stock_threshold}'
```

✅ Attendu: Samsung Galaxy A10 apparaît dans alertCount avec quantity: 1

---

#### **Test 11: Récupérer l'historique stock (IMMUABLE)**

```bash
curl -s -X GET "http://localhost:4000/api/v1/stock/history/$PROD_ID_1?limit=10" \
  -H "Authorization: Bearer $TOKEN" | jq '.movements | map({type, quantity, created_at})'
```

✅ Attendu:
```json
[
  {"type": "SALE_OUT", "quantity": 46, "created_at": "..."},
  {"type": "SALE_OUT", "quantity": 3, "created_at": "..."},
  {"type": "PURCHASE_IN", "quantity": 50, "created_at": "..."}
]
```

---

#### **Test 12: Vérifier immuabilité (tenter UPDATE/DELETE sur movements)**

```bash
# Les mouvements stock_movements NE DOIVENT PAS pouvoir être modifiés
# (Les triggers prevent_update_delete sont en place)

# Essayer de modifier directement en BD (pour vérifier les triggers):
psql $DATABASE_URL -c "UPDATE stock_movements SET quantity = 999 WHERE id = 1;"
# → Attendu: ERROR - trigger prevent_update_delete bloque la modification

psql $DATABASE_URL -c "DELETE FROM stock_movements WHERE id = 1;"
# → Attendu: ERROR - trigger prevent_update_delete bloque la suppression
```

✅ Attendu: Erreurs triggers (registre immuable)

---

#### **Test 13: Ajustement d'inventaire**

```bash
# Ajustement +5 (écart d'inventaire positif)
curl -s -X POST http://localhost:4000/api/v1/stock/adjust \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": '$PROD_ID_1',
    "quantityDelta": 5,
    "note": "Correction comptage physique"
  }' | jq '.message'

# Vérifier que la quantité augmente
curl -s -X GET "http://localhost:4000/api/v1/products/$PROD_ID_1" \
  -H "Authorization: Bearer $TOKEN" | jq '.product.quantity'
```

✅ Attendu: quantity augmente de 5

---

#### **Test 14: Résumé statistiques (STOCK_SUMMARY)**

```bash
curl -s -X GET "http://localhost:4000/api/v1/stock/summary" \
  -H "Authorization: Bearer $TOKEN" | jq '.summary'
```

✅ Attendu:
```json
{
  "PURCHASE_IN": {"count": 1, "totalQty": 50, "totalCost": ...},
  "SALE_OUT": {"count": 2, "totalQty": 49, "totalCost": null},
  "ADJUSTMENT": {"count": 1, "totalQty": 5, "totalCost": null}
}
```

---

#### **Test 15: Vérification de stock insuffisant (ERREUR 409)**

```bash
# Tenter de vendre plus que disponible
curl -s -X POST http://localhost:4000/api/v1/stock/movements \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "productId": '$PROD_ID_1',
    "type": "SALE_OUT",
    "quantity": 999999
  }' | jq '.message'
```

✅ Attendu: Erreur 409 "Stock insuffisant"

---

#### **Test 16: Soft Delete produit**

```bash
curl -s -X DELETE "http://localhost:4000/api/v1/products/$PROD_ID_1" \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

# Vérifier statut = INACTIVE
curl -s -X GET "http://localhost:4000/api/v1/products/$PROD_ID_1" \
  -H "Authorization: Bearer $TOKEN" | jq '.product.status'
```

✅ Attendu: Status devenu "INACTIVE" (soft delete)

---

#### **Test 17: Hard Delete sur produit SANS mouvements**

```bash
# Créer un produit temporaire
TEMP_PROD=$(curl -s -X POST http://localhost:4000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "Produit Temp",
    "purchasePrice": 100,
    "sellingPrice": 150
  }')

TEMP_ID=$(echo $TEMP_PROD | jq -r '.product.id')

# Hard delete (pas de mouvements stock)
curl -s -X DELETE "http://localhost:4000/api/v1/products/$TEMP_ID?hard=true" \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

# Vérifier que le produit est complètement supprimé
curl -s -X GET "http://localhost:4000/api/v1/products/$TEMP_ID" \
  -H "Authorization: Bearer $TOKEN"
```

✅ Attendu: 404 "Produit introuvable" (hard delete réussi)

---

### 🎨 TESTS FRONTEND (http://localhost:5173)

#### **Test 1: Navigation vers /products**

```
1. Se connecter (login)
2. Sélectionner la boutique
3. Cliquer sur "Produits" (ou accéder http://localhost:5173/products)
4. Voir tableau vide ou avec produits existants
```

✅ Attendu: Page ProductsPage chargée, tableau visible

---

#### **Test 2: Créer un produit (frontend)**

```
1. Cliquer "➕ Ajouter un produit"
2. Remplir le formulaire:
   - Nom: "Nokia 3310"
   - Référence: "NK3310"
   - Prix achat: 50000
   - Prix vente: 70000
   - Seuil stock: 3
   - Catégorie: "Électronique"
3. Cliquer "Créer"
4. Voir le produit dans le tableau
```

✅ Attendu: Produit créé et affiché, modal fermée

---

#### **Test 3: Rechercher un produit**

```
1. Taper "Samsung" dans la search box
2. Voir les produits Samsung uniquement
3. Taper autre caractère, résultats changeant en temps réel
```

✅ Attendu: Recherche fonctionne, pagination réinitialisée (page=1)

---

#### **Test 4: Filtrer par catégorie**

```
1. Sélectionner "Électronique" dans le dropdown catégorie
2. Voir uniquement produits de cette catégorie
3. Changer à une autre catégorie ou "Toutes"
```

✅ Attendu: Filtres appliquées correctement

---

#### **Test 5: Filtrer stock faible**

```
1. Cocher "Stock faible" (products avec qty ≤ threshold)
2. Voir uniquement produits alerte
3. Décocher → voir tous les produits
```

✅ Attendu: Checkbox fonctionne

---

#### **Test 6: Voir détails d'un produit**

```
1. Cliquer l'icon 👁️ sur une ligne produit
2. Voir modal avec:
   - Infos: nom, prix achat/vente, marge %, stock, seuil
   - Onglet "Historique stock" avec mouvements immuables
   - Tableau avec: Date, Type (PURCHASE_IN/SALE_OUT/...), Quantité, Coût
3. Voir messages "Aucun mouvement" si pas d'historique
```

✅ Attendu: ProductDetail modal ouverte, historique visible

---

#### **Test 7: Modifier un produit (frontend)**

```
1. Cliquer l'icon ✏️ sur une ligne
2. Modal s'ouvre avec formulaire pré-rempli
3. Changer "Prix de vente" de 70000 à 75000
4. Cliquer "Modifier"
5. Voir le prix mis à jour dans le tableau
```

✅ Attendu: Modification réussie, modal fermée, page refreshed

---

#### **Test 8: Supprimer un produit (frontend)**

```
1. Cliquer l'icon 🗑️ sur une ligne
2. Confirm: "Êtes-vous sûr?"
3. Annuler: produit reste
4. Confirmer: produit disparaît du tableau (soft delete)
```

✅ Attendu: Confirmation demandée, suppression ok

---

#### **Test 9: Pagination**

```
1. Créer 25+ produits
2. Voir tableau affiche 20 (limite défaut)
3. Cliquer "Suivant" → page 2
4. Cliquer "Précédent" → page 1
5. Bouton "Précédent" disabled si page=1, "Suivant" si page=pages
```

✅ Attendu: Pagination fonctionne correctement

---

#### **Test 10: Responsive**

```
1. Ouvrir DevTools (F12) → Mode device mobile
2. Voir formulaire et tableau reformatés
3. Boutons et input accessible au doigt
```

✅ Attendu: Interface responsive, usable sur mobile

---

### 📊 Checklist Finale

- [ ] Backend endpoints 13 testés (curl ou Postman)
- [ ] Stock mouvements immuables (vérifier triggers)
- [ ] Quantité produit sync avec mouvements
- [ ] Alerte stock faible fonctionne
- [ ] Recherche et filtres OK
- [ ] Soft delete (INACTIVE)
- [ ] Hard delete (produit sans mouvements)
- [ ] Frontend: Create/Read/Update/Delete complets
- [ ] Pagination, search, filtres
- [ ] Modales: ProductForm, ProductDetail
- [ ] Historique stock affiche mouvements immuables
- [ ] Responsive OK
- [ ] Aucune erreur console (F12)

---

### 🚨 Si erreurs

**Erreur 401/403 (Unauthorized)**
→ Token expiré ou mauvais format
→ Vérifier: Bearer token injecté, JWT_SECRET cohérent

**Erreur 404 (Not Found)**
→ Produit/catégorie n'existe pas
→ Vérifier IDs utilisés

**Erreur 409 (Conflict)**
→ Stock insuffisant, référence doublonnée
→ Courant et attendu pour certains cas

**Erreur 500 (Internal Server Error)**
→ Vérifier logs backend, DB connection
→ Vérifier database migrations appliquées

---

✅ Tous les tests passés → **P0.2 PRÊT POUR PRODUCTION**

Prochain: **P0.3 Vente physique (POS)** — la partie CRITIQUE du produit
