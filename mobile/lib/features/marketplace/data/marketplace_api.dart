import '../../../core/network/api_client.dart';
import 'marketplace_models.dart';

/// Miroir de marketplace.routes.js. /status et /products sont publics
/// (aucune session requise, cf. RootRedirect.jsx côté web) ; le détail
/// exige une session (n'importe quel rôle, n'importe quelle boutique).
class MarketplaceApi {
  const MarketplaceApi(this._client);

  final ApiClient _client;

  Future<bool> getStatus() async {
    final data = await _client.get('/marketplace/status');
    return data['enabled'] as bool? ?? false;
  }

  Future<List<MarketplaceProduct>> listProducts() async {
    final data = await _client.get('/marketplace/products');
    final raw = data['products'] as List<dynamic>? ?? [];
    return raw.map((e) => MarketplaceProduct.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<MarketplaceProductDetail> getProductDetail(int id) async {
    final data = await _client.get('/marketplace/products/$id');
    return MarketplaceProductDetail.fromJson(data);
  }
}
