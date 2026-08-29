import '../../../core/network/api_client.dart';
import 'pos_models.dart';

/// GET /products et GET /categories — catalogue partagé par la Caisse et,
/// plus tard, les écrans Produits/Stock.
class CatalogApi {
  const CatalogApi(this._client);

  final ApiClient _client;

  Future<CatalogResult> listActiveProducts() async {
    final data = await _client.get('/products', query: {'limit': 100, 'status': 'ACTIVE'});
    final raw = data['products'] as List<dynamic>? ?? [];
    return CatalogResult(
      products: raw.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList(),
      planName: data['planName'] as String?,
      maxProductsPerStore: (data['maxProductsPerStore'] as num?)?.toInt(),
    );
  }

  Future<List<ProductCategory>> listCategories() async {
    final data = await _client.get('/categories');
    final raw = data['categories'] as List<dynamic>? ?? [];
    return raw.map((e) => ProductCategory.fromJson(e as Map<String, dynamic>)).toList();
  }
}

/// Même réponse que GET /products, mais scopée à la Caisse (produits actifs
/// uniquement) — planName/maxProductsPerStore accompagnent la liste pour
/// que PosPage puisse expliquer un verrou sans second appel réseau, même
/// principe que ProductListResult côté écran Produits.
class CatalogResult {
  const CatalogResult({required this.products, this.planName, this.maxProductsPerStore});

  final List<Product> products;
  final String? planName;
  final int? maxProductsPerStore;
}
