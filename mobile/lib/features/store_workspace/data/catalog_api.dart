import '../../../core/network/api_client.dart';
import 'pos_models.dart';

/// GET /products et GET /categories — catalogue partagé par la Caisse et,
/// plus tard, les écrans Produits/Stock.
class CatalogApi {
  const CatalogApi(this._client);

  final ApiClient _client;

  Future<List<Product>> listActiveProducts() async {
    final data = await _client.get('/products', query: {'limit': 100, 'status': 'ACTIVE'});
    final raw = data['products'] as List<dynamic>? ?? [];
    return raw.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<ProductCategory>> listCategories() async {
    final data = await _client.get('/categories');
    final raw = data['categories'] as List<dynamic>? ?? [];
    return raw.map((e) => ProductCategory.fromJson(e as Map<String, dynamic>)).toList();
  }
}
