import '../../../core/network/api_client.dart';
import '../../../state/models/store.dart';

/// Miroir de la logique de MyStorePage.jsx côté web.
class StoresApi {
  const StoresApi(this._client);

  final ApiClient _client;

  /// GET /stores/mine — toujours interrogé en base (jamais déduit du
  /// jeton, potentiellement périmé après création d'une boutique ailleurs).
  Future<List<StoreRef>> listMine() async {
    final data = await _client.get('/stores/mine');
    final raw = data['stores'] as List<dynamic>? ?? <dynamic>[];
    return raw.map((e) => StoreRef.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /stores — création d'une boutique (première ou supplémentaire).
  /// Retourne { token, activeStore, stores } : la nouvelle boutique
  /// devient immédiatement active (cf. §4.2 du cahier des charges).
  Future<Map<String, dynamic>> create({
    required String name,
    String? category,
    String? city,
    String? phone,
  }) {
    return _client.post('/stores', data: {
      'name': name,
      if (category != null && category.isNotEmpty) 'category': category,
      if (city != null && city.isNotEmpty) 'city': city,
      if (phone != null && phone.isNotEmpty) 'phone': phone,
    });
  }
}
