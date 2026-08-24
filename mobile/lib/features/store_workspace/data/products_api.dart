import '../../../core/network/api_client.dart';
import 'pos_models.dart';
import 'product_detail_models.dart';

/// Miroir complet de products.routes.js — CRUD catalogue (réservé à
/// l'Owner côté écriture, cf. §4.3 du cahier des charges ; la Caisse, elle,
/// n'utilise que la lecture allégée de CatalogApi).
class ProductsApi {
  const ProductsApi(this._client);

  final ApiClient _client;

  Future<ProductListResult> list({
    int page = 1,
    int limit = 20,
    String? search,
    String status = 'ACTIVE',
    bool lowStockOnly = false,
    int? categoryId,
  }) async {
    final data = await _client.get('/products', query: {
      'page': page,
      'limit': limit,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      'status': status,
      if (lowStockOnly) 'lowStockOnly': true,
      if (categoryId != null) 'categoryId': categoryId,
    });
    return ProductListResult.fromJson(data);
  }

  Future<Product> getOne(int id) async {
    final data = await _client.get('/products/$id');
    return Product.fromJson(data);
  }

  Future<List<StockMovement>> getStockHistory(int id) async {
    final data = await _client.get('/products/$id/stock-history');
    final raw = data['history'] as List<dynamic>? ?? [];
    return raw.map((e) => StockMovement.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Product> create({
    required String name,
    int? categoryId,
    String? reference,
    String? description,
    required num purchasePrice,
    required num sellingPrice,
    required int quantity,
    required int lowStockThreshold,
    String? imageUrl,
    Map<String, String> attributes = const {},
    List<PriceTier> priceTiers = const [],
  }) async {
    final data = await _client.post('/products', data: {
      'name': name,
      'categoryId': categoryId,
      'reference': reference,
      'description': description,
      'purchasePrice': purchasePrice,
      'sellingPrice': sellingPrice,
      'quantity': quantity,
      'lowStockThreshold': lowStockThreshold,
      'imageUrl': imageUrl,
      'attributes': attributes,
      'priceTiers': priceTiers.map((t) => {'minQuantity': t.minQuantity, 'unitPrice': t.unitPrice}).toList(),
    });
    return Product.fromJson(data);
  }

  /// La quantité n'est jamais modifiable ici — un ajustement de stock passe
  /// obligatoirement par adjustStock(), jamais par une mise à jour
  /// silencieuse du produit (même règle que côté web, appliquée aussi côté
  /// serveur : updateProduct ignore toute quantité envoyée).
  Future<Product> update({
    required int id,
    required String name,
    int? categoryId,
    String? reference,
    String? description,
    required num purchasePrice,
    required num sellingPrice,
    required int lowStockThreshold,
    String? imageUrl,
    Map<String, String> attributes = const {},
    List<PriceTier> priceTiers = const [],
  }) async {
    final data = await _client.put('/products/$id', data: {
      'name': name,
      'categoryId': categoryId,
      'reference': reference,
      'description': description,
      'purchasePrice': purchasePrice,
      'sellingPrice': sellingPrice,
      'lowStockThreshold': lowStockThreshold,
      'imageUrl': imageUrl,
      'attributes': attributes,
      'priceTiers': priceTiers.map((t) => {'minQuantity': t.minQuantity, 'unitPrice': t.unitPrice}).toList(),
    });
    return Product.fromJson(data);
  }

  /// Jamais de suppression physique (§12 du cahier des charges) — un
  /// produit déjà vendu doit garder son historique. Pas de route DELETE
  /// côté backend.
  Future<void> deactivate(int id) => _client.post('/products/$id/deactivate');

  Future<void> reactivate(int id) => _client.post('/products/$id/reactivate');

  /// Ajustement manuel de stock (comptage physique, casse, perte...) —
  /// jamais une modification silencieuse : le motif est obligatoire, et
  /// chaque ajustement laisse une trace immuable dans stock_movements
  /// (voir products.service.js#adjustStock). Désactive automatiquement le
  /// produit si le stock retombe à 0 — ne le réactive jamais tout seul en
  /// sens inverse.
  Future<StockAdjustmentResult> adjustStock({required int productId, required int delta, required String note}) async {
    final data = await _client.post('/products/$productId/adjust-stock', data: {'delta': delta, 'note': note});
    return StockAdjustmentResult.fromJson(data);
  }
}

class StockAdjustmentResult {
  const StockAdjustmentResult({required this.newQuantity, required this.newStatus});

  factory StockAdjustmentResult.fromJson(Map<String, dynamic> json) => StockAdjustmentResult(
        newQuantity: (json['newQuantity'] as num).toInt(),
        newStatus: json['newStatus'] as String,
      );

  final int newQuantity;
  final String newStatus;
}
