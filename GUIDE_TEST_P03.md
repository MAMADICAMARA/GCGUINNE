## 🧪 GUIDE DE TEST — P0.3 Vente Physique (POS)

**Date**: 2026-07-22  
**Version**: 1.0 (Implémentation complète)  
**Prérequis**: P0.1 ✅ + P0.2 ✅ + Migration database ✅

---

### 📋 Checklist Pre-Test

- [ ] Backend démarré : `npm run dev` dans `/backend` (port 4000)
- [ ] Frontend démarré : `npm run dev` dans `/frontend` (port 5173)
- [ ] Database PostgreSQL active avec schéma complet
- [ ] Utilisateur créé et authentifié (via P0.1)
- [ ] Au moins 1 boutique active
- [ ] Au moins 5 produits créés en P0.2
- [ ] Produits avec stock > 0

---

### 🔍 TESTS API — Backend

#### Setup Initial

```bash
# Récupérer le token JWT
RESPONSE=$(curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "Test@123"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.data.token')
STORE_ID=$(echo $RESPONSE | jq -r '.data.activeStore')

echo "TOKEN: $TOKEN"
echo "STORE_ID: $STORE_ID"
```

#### Test 1: Créer une commande simple (1 item, panier minimal)

```bash
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 2
      }
    ],
    "paymentMethod": "CASH",
    "discount": 0,
    "tax": 0
  }'

# ✅ Attendu: 201 Created
# {
#   "success": true,
#   "data": {
#     "orderId": <id>,
#     "orderNumber": "ORD-2026-000001",
#     "totalAmount": <prix>,
#     "items": [
#       {
#         "productId": 1,
#         "quantity": 2,
#         "unitPrice": <prix>,
#         "productName": <nom>
#       }
#     ],
#     "receipt": "<formatted receipt>"
#   }
# }
```

**Vérifications:**
- [ ] Order créée avec ID unique
- [ ] OrderNumber au format ORD-YYYY-NNNNNN
- [ ] Stock du produit decrementé (quantity - 2)
- [ ] Mouvement de stock créé (type: SALE_OUT)
- [ ] Reçu généré

---

#### Test 2: Créer une commande avec réduction et taxes

```bash
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 2,
        "quantity": 1
      },
      {
        "productId": 3,
        "quantity": 3
      }
    ],
    "paymentMethod": "MOBILE_MONEY",
    "discount": 1000,
    "tax": 500
  }'

# ✅ Attendu: 201 Created
# totalAmount = (price1*1 + price3*3) - 1000 + 500
```

**Vérifications:**
- [ ] Deux lignes créées (order_items)
- [ ] Discount appliqué
- [ ] Taxes appliquées
- [ ] Total final calculé correctement
- [ ] Deux mouvements de stock créés

---

#### Test 3: Erreur — Stock insuffisant

```bash
# Créer un produit avec stock insuffisant
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {
        "productId": 1,
        "quantity": 999999
      }
    ],
    "paymentMethod": "CASH"
  }'

# ❌ Attendu: 409 Conflict
# {
#   "error": {
#     "message": "Stock insuffisant pour \"<produit>\": <dispo> disponible, 999999 demandé"
#   }
# }
```

**Vérifications:**
- [ ] Erreur 409 retournée
- [ ] Message explicite
- [ ] Pas d'ordre créée (rollback transaction)
- [ ] Stock inchangé

---

#### Test 4: Erreur — Panier vide

```bash
curl -X POST http://localhost:4000/api/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [],
    "paymentMethod": "CASH"
  }'

# ❌ Attendu: 400 Bad Request
```

---

#### Test 5: Lister les commandes (pagination + filtres)

```bash
# Lister tous les ordres, page 1
curl -X GET "http://localhost:4000/api/v1/orders?page=1&limit=10" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Attendu: 200 OK
# {
#   "success": true,
#   "data": {
#     "orders": [...],
#     "total": <count>,
#     "page": 1,
#     "pages": <pages>
#   }
# }
```

**Vérifications:**
- [ ] Pagination fonctionne
- [ ] Total affiché

---

#### Test 6: Lister avec filtres (par vendeur, par période)

```bash
# Filtrer par seller_id
curl -X GET "http://localhost:4000/api/v1/orders?sellerId=1" \
  -H "Authorization: Bearer $TOKEN"

# Filtrer par statut
curl -X GET "http://localhost:4000/api/v1/orders?status=PAID" \
  -H "Authorization: Bearer $TOKEN"

# Filtrer par date
curl -X GET "http://localhost:4000/api/v1/orders?startDate=2026-07-01T00:00:00Z&endDate=2026-07-31T23:59:59Z" \
  -H "Authorization: Bearer $TOKEN"
```

**Vérifications:**
- [ ] Filtres appliqués correctement
- [ ] Résultats filtrés

---

#### Test 7: Récupérer une commande avec ses items

```bash
ORDER_ID=1  # Remplacer par ID réel

curl -X GET "http://localhost:4000/api/v1/orders/$ORDER_ID" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Attendu: 200 OK
# {
#   "success": true,
#   "data": {
#     "order": {
#       "id": <id>,
#       "order_number": "ORD-2026-000001",
#       "total_amount": <montant>,
#       "discount_amount": <reduction>,
#       "tax_amount": <taxes>,
#       "payment_method": "CASH",
#       "status": "PAID",
#       "created_at": <timestamp>,
#       "seller_name": <nom>,
#       "customer_name": <nom_client_ou_null>
#     },
#     "items": [
#       {
#         "id": <id>,
#         "product_id": <id>,
#         "product_name": <nom>,
#         "reference": <ref>,
#         "quantity": <qty>,
#         "unit_price": <prix>,
#         "returned_quantity": 0
#       }
#     ]
#   }
# }
```

**Vérifications:**
- [ ] Commande récupérée
- [ ] Tous les items inclus
- [ ] Prix unitaire figé (pas lié à produit.selling_price)

---

#### Test 8: Télécharger le reçu

```bash
ORDER_ID=1

curl -X GET "http://localhost:4000/api/v1/orders/$ORDER_ID/receipt" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Attendu: 200 OK, text/plain
# (Affiche reçu formaté)
```

**Vérifications:**
- [ ] Reçu en format texte
- [ ] Contient order_number, date, items, totals
- [ ] Formatage lisible

---

#### Test 9: Annuler une commande (void)

```bash
ORDER_ID=1

curl -X POST "http://localhost:4000/api/v1/orders/$ORDER_ID/void" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Attendu: 200 OK
# {
#   "success": true,
#   "data": {
#     "orderId": <id>,
#     "status": "VOIDED"
#   }
# }
```

**Vérifications:**
- [ ] Statut changé à "VOIDED"
- [ ] Mouvements de stock inversés (RETURN_IN créés)
- [ ] Stock du produit restauré
- [ ] Commande ne peut pas être re-void

---

#### Test 10: Annuler — Erreur (commande déjà annulée)

```bash
ORDER_ID=1  # Supposé déjà voidé du test précédent

curl -X POST "http://localhost:4000/api/v1/orders/$ORDER_ID/void" \
  -H "Authorization: Bearer $TOKEN"

# ❌ Attendu: 400 Bad Request
# {
#   "error": {
#     "message": "Cette commande a déjà été annulée"
#   }
# }
```

---

#### Test 11: Retour partiel d'item

```bash
ORDER_ID=2
ITEM_ID=1

curl -X POST "http://localhost:4000/api/v1/orders/$ORDER_ID/items/$ITEM_ID/return" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "returnedQuantity": 1
  }'

# ✅ Attendu: 200 OK
# {
#   "success": true,
#   "data": {
#     "itemId": <id>,
#     "returnedQty": 1,
#     "remainingQty": <qty - 1>,
#     "orderStatus": "PARTIALLY_RETURNED"
#   }
# }
```

**Vérifications:**
- [ ] returned_quantity incrémenté
- [ ] Mouvement RETURN_IN créé
- [ ] Stock du produit restauré (qty + 1)
- [ ] Statut commande changé à "PARTIALLY_RETURNED"
- [ ] Ordre ne peut pas être re-void si status = PARTIALLY_RETURNED

---

#### Test 12: Retour complet (tous les items)

```bash
# Retourner toutes les quantités de tous les items
# Après tous les retours, le statut doit être "RETURNED"

# ✅ Attendu: orderStatus = "RETURNED"
```

---

#### Test 13: Test Concurrence (20+ commandes simultanées)

```bash
# Script pour tester concurrence
# Créer 20 commandes en parallèle du même produit

#!/bin/bash

for i in {1..20}; do
  curl -X POST http://localhost:4000/api/v1/orders \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "items": [
        {
          "productId": 1,
          "quantity": 1
        }
      ],
      "paymentMethod": "CASH"
    }' &
done

wait

# Vérifier que toutes les commandes ont réussi
curl -X GET "http://localhost:4000/api/v1/orders?limit=100" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.data.total'

# ✅ Attendu: total = 20
# ✅ Attendu: Pas d'erreur "deadlock" ou "lock timeout"
```

**Vérifications:**
- [ ] Toutes les 20 commandes créées
- [ ] Aucun deadlock (< 5s total)
- [ ] Stock final = 0 (si produit avait 20 initial)
- [ ] Validation < 300ms par commande

---

### 🎨 TESTS FRONTEND — React/Vite

#### Test 1: Accéder à la page POS

1. Connectez-vous (`/login`)
2. Allez à la page POS (`/pos`)
3. Vérifiez le chargement du catalogue

**Vérifications:**
- [ ] Page charge sans erreur
- [ ] Catalogue de produits visible
- [ ] Panier vide à droite
- [ ] Pas d'erreur console

---

#### Test 2: Recherche de produit

1. Dans la barre "Rechercher produit", tapez le nom d'un produit
2. Observez le filtrage en real-time

**Vérifications:**
- [ ] La liste se filtre immédiatement
- [ ] Seuls les produits matching s'affichent
- [ ] La recherche fonctionne sur nom ET référence

---

#### Test 3: Filtrer par catégorie

1. Ouvrez le dropdown "Toutes catégories"
2. Sélectionnez une catégorie

**Vérifications:**
- [ ] Produits filtrés par catégorie
- [ ] Les filtres se cumulent (recherche + catégorie)

---

#### Test 4: Ajouter un produit au panier

1. Sur une carte produit, entrez une quantité (ex: 2)
2. Cliquez "+ Ajouter"

**Vérifications:**
- [ ] Le produit apparaît dans le panier
- [ ] La quantité est correcte
- [ ] Le compteur "Articles" augmente
- [ ] Le total se recalcule

---

#### Test 5: Augmenter/Diminuer quantité dans le panier

1. Dans le panier, à côté d'un item, cliquez "+" ou "−"

**Vérifications:**
- [ ] La quantité change immédiatement
- [ ] Le total se recalcule
- [ ] Si quantité tombe à 0, l'item est supprimé

---

#### Test 6: Supprimer un item du panier

1. Cliquez sur le bouton 🗑️ d'un item

**Vérifications:**
- [ ] L'item disparaît du panier
- [ ] Le total se recalcule
- [ ] Le compteur "Articles" diminue

---

#### Test 7: Appliquer une réduction

1. Dans la section "Réduction %", entrez 10 (pour 10%)

**Vérifications:**
- [ ] Le montant de réduction s'affiche (ex: -50.00)
- [ ] Le TOTAL FINAL diminue

---

#### Test 8: Appliquer une taxe

1. Dans la section "Taxe %", entrez 5 (pour 5%)

**Vérifications:**
- [ ] Le montant de taxe s'affiche (ex: +10.00)
- [ ] Le TOTAL FINAL augmente

---

#### Test 9: Changer la méthode de paiement

1. Ouvrez le dropdown "Méthode de paiement"
2. Sélectionnez "💳 Carte"

**Vérifications:**
- [ ] La méthode change (affichée dans le select)
- [ ] Le total ne change pas

---

#### Test 10: Valider une vente

1. Remplissez le panier avec 2-3 produits
2. Cliquez "✔️ Valider la vente"

**Vérifications:**
- [ ] Un modal "Reçu de vente" s'affiche
- [ ] Le reçu affiche tous les items, quantités, prix
- [ ] Le reçu affiche les totals (sous-total, réduction, taxe, total)
- [ ] Le panier se vide après succès

---

#### Test 11: Télécharger le reçu

1. Dans le modal du reçu, cliquez "📥 Télécharger"

**Vérifications:**
- [ ] Un fichier `receipt.txt` est téléchargé
- [ ] Le contenu est identique au reçu affiché

---

#### Test 12: Imprimer le reçu

1. Dans le modal du reçu, cliquez "🖨️ Imprimer"

**Vérifications:**
- [ ] La boîte de dialogue d'impression s'ouvre
- [ ] Le reçu s'affiche en format texte

---

#### Test 13: Fermer le modal et revenir au catalogue

1. Cliquez "✔️ Fermer" dans le modal du reçu

**Vérifications:**
- [ ] Le modal se ferme
- [ ] On revient au catalogue
- [ ] Le panier est vide
- [ ] Les produits sont rechargés (stock mis à jour)

---

#### Test 14: Stock insuffisant (validation real-time)

1. Supposons un produit avec stock = 5
2. Augmentez la quantité du panier à 6 (via le bouton + ou l'input)

**Vérifications:**
- [ ] Un message d'erreur s'affiche: "Stock insuffisant pour..."
- [ ] La quantité ne change pas
- [ ] L'item reste dans le panier

---

#### Test 15: Panier vide (validation au checkout)

1. Vider le panier (supprimer tous les items)
2. Cliquez "✔️ Valider la vente"

**Vérifications:**
- [ ] Un message d'erreur s'affiche: "Le panier est vide"
- [ ] Pas de requête API envoyée

---

#### Test 16: Responsive Design — Tablette (768px)

1. Ouvrir les DevTools (F12)
2. Sélectionner une dimension tablette (iPad, 768x1024)
3. Naviguer dans la page POS

**Vérifications:**
- [ ] Catalogue et panier s'empilent (full width)
- [ ] Les boutons sont accessibles
- [ ] Les polices restent lisibles
- [ ] Pas d'overflow horizontal

---

#### Test 17: Responsive Design — Mobile (375px)

1. Ouvrir les DevTools
2. Sélectionner une dimension mobile (iPhone, 375x667)
3. Naviguer dans la page POS

**Vérifications:**
- [ ] La grille de produits se réduit (2 colonnes)
- [ ] Le panier est lisible
- [ ] Les inputs ont une bonne taille (tapables)

---

### 🔄 TESTS D'INTÉGRATION — API + Frontend

#### Test 1: Circuit complet (E2E)

```
1. Frontend: Charger la page POS → Requête GET /products
2. Frontend: Charger catégories → Requête GET /categories
3. Frontend: Ajouter 3 produits au panier
4. Frontend: Appliquer réduction (10%)
5. Frontend: Valider la vente → POST /orders
6. Backend: Créer ordre atomique (transaction)
7. Backend: Creer order_items (2 requêtes)
8. Backend: Enregistrer mouvements de stock (3 SALE_OUT)
9. Backend: Générer reçu
10. Frontend: Afficher reçu modal
11. Frontend: Télécharger reçu (txt)
12. Frontend: Fermer modal, panier vide
13. Vérifier: Stock mis à jour dans DB
```

**Vérifications:**
- [ ] Pas d'erreur à chaque étape
- [ ] Stock décrémenté
- [ ] Mouvements enregistrés
- [ ] Reçu généré
- [ ] Total correct

---

#### Test 2: Annulation de vente (Void via API)

```
1. Créer une vente (Frontend)
2. Récupérer l'order_id
3. Via curl ou API : POST /orders/:id/void
4. Vérifier: Stock restauré, statut = VOIDED
5. Recharger le catalogue (Frontend)
6. Vérifier: Stock affiché correct
```

---

### ✅ CHECKLIST FINALE

- [ ] Test 1-13 (API) passed
- [ ] Aucune erreur 500 (backend logs clean)
- [ ] Aucune erreur console (frontend)
- [ ] Stock vérifié en DB (SELECT * FROM products WHERE id = ...)
- [ ] Mouvements vérifiés en DB (SELECT * FROM stock_movements WHERE type = 'SALE_OUT')
- [ ] Performance < 300ms par commande
- [ ] Concurrence 20+ OK (sans deadlock)
- [ ] Responsive design OK (mobile, tablet, desktop)
- [ ] Reçu générés et imprimables
- [ ] Test 1-17 (Frontend) passed

---

### 🚨 TROUBLESHOOTING

**Erreur: "Cannot read property 'token' of undefined"**
→ Vérifier que authStore est correctement setup (check P0.1)

**Erreur: "Request failed with status code 401"**
→ Vérifier le token est valide, qu'il n'a pas expiré

**Erreur: "Stock insuffisant" mais stock semble OK**
→ Vérifier la requête : quantity total du panier vs stock actual (SELECT quantity FROM products WHERE id = ...)

**Erreur: "Deadlock detected"** (lors du test concurrence)
→ Revoir la requête SELECT ... FOR UPDATE dans orders.service.js
→ Peut être que les locks sont mal ordonnés

**Reçu n'affiche pas correctement les accents (é, è, ç)**
→ Vérifier charset UTF-8 dans les headers API (Content-Type: application/json; charset=utf-8)

---

**État**: 🟢 **TOUS LES TESTS PRÊTS À EXÉCUTER**

Lancer:
```bash
cd backend && npm run dev &
cd frontend && npm run dev &

# Puis exécuter les tests curl et manuel
```
