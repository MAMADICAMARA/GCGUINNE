import '../../../core/network/api_client.dart';
import 'purchase_models.dart';
import 'supplier_models.dart';

/// Miroir de purchases.routes.js — réservé au Owner (même périmètre que
/// Produits/Stock).
class PurchasesApi {
  const PurchasesApi(this._client);

  final ApiClient _client;

  // --- Contacts fournisseurs ---------------------------------------------

  Future<List<SupplierContact>> listSupplierContacts() async {
    final data = await _client.get('/purchases/suppliers');
    final raw = data['suppliers'] as List<dynamic>? ?? [];
    return raw.map((e) => SupplierContact.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Création réservée au plan PREMIUM (requirePlanFeature côté serveur).
  Future<void> createSupplierContact({required String name, String? phone, String? email, String? address}) {
    return _client.post('/purchases/suppliers', data: {'name': name, 'phone': phone, 'email': email, 'address': address});
  }

  /// Modifier un fournisseur déjà enregistré reste toujours possible, quel
  /// que soit le plan.
  Future<void> updateSupplierContact(int id, {required String name, String? phone, String? email, String? address}) {
    return _client.put('/purchases/suppliers/$id', data: {'name': name, 'phone': phone, 'email': email, 'address': address});
  }

  Future<void> deleteSupplierContact(int id) => _client.delete('/purchases/suppliers/$id');

  // --- Commandes d'achat ---------------------------------------------------

  Future<List<PurchaseOrderSummary>> listPurchaseOrders() async {
    final data = await _client.get('/purchases/orders');
    final raw = data['orders'] as List<dynamic>? ?? [];
    return raw.map((e) => PurchaseOrderSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PurchaseOrderDetail> getPurchaseOrder(int id) async {
    final data = await _client.get('/purchases/orders/$id');
    return PurchaseOrderDetail.fromJson(data);
  }

  /// Réservé au plan PREMIUM — commande manuelle vers un fournisseur
  /// contact (produits DE CETTE BOUTIQUE, prix d'achat libre par ligne).
  Future<void> createPurchaseOrder({required int supplierId, String? reference, required List<PurchaseOrderDraftItem> items}) {
    return _client.post('/purchases/orders', data: {
      'supplierId': supplierId,
      'reference': reference,
      'items': items.map((item) => {'productId': item.productId, 'quantity': item.quantity, 'purchasePrice': item.purchasePrice}).toList(),
    });
  }

  /// Réservé au plan PREMIUM de L'ACHETEUR (requirePlanFeature côté
  /// serveur) — parcourir le catalogue reste, lui, ouvert à tous les plans.
  Future<void> createOrderFromSupplierStore({
    required int supplierStoreId,
    String? reference,
    required List<SupplierCartItem> items,
  }) {
    return _client.post('/purchases/orders/from-supplier-store', data: {
      'supplierStoreId': supplierStoreId,
      'reference': reference,
      'items': items
          .map((item) => {'supplierProductId': item.supplierProductId, 'quantity': item.quantity, 'purchasePrice': item.unitPrice})
          .toList(),
    });
  }

  /// Finaliser (recevoir/annuler) une commande déjà créée reste toujours
  /// possible, même si la boutique a depuis perdu l'accès PREMIUM.
  Future<void> receivePurchaseOrder(int id) => _client.post('/purchases/orders/$id/receive');

  Future<void> cancelPurchaseOrder(int id) => _client.post('/purchases/orders/$id/cancel');

  // --- Commandes reçues DE MES CLIENTS (je suis le fournisseur) -----------

  /// Commandes que d'autres boutiques ont passées CHEZ MOI (je suis leur
  /// fournisseur) — lecture seule stricte, c'est toujours l'acheteur qui
  /// contrôle le cycle de vie de sa commande.
  Future<List<ReceivedOrder>> listReceivedOrders() async {
    final data = await _client.get('/purchases/received-orders');
    final raw = data['orders'] as List<dynamic>? ?? [];
    return raw.map((e) => ReceivedOrder.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<ReceivedOrderDetail> getReceivedOrder(int id) async {
    final data = await _client.get('/purchases/received-orders/$id');
    return ReceivedOrderDetail.fromJson(data);
  }
}
