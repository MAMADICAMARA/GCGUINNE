import '../../../core/network/api_client.dart';

/// Miroir de la partie "auth" de frontend/src/services/apiClient.js.
class AuthApi {
  const AuthApi(this._client);

  final ApiClient _client;

  /// Inscription (compte seul, sans boutique — cf. §4.1 du cahier des
  /// charges). Retourne { token, user, stores: [] }.
  Future<Map<String, dynamic>> register({
    required String fullName,
    required String email,
    required String password,
  }) {
    return _client.post('/auth/register', data: {
      'fullName': fullName,
      'email': email,
      'password': password,
    });
  }

  /// Connexion. Retourne { token, user, stores }.
  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) {
    return _client.post('/auth/login', data: {
      'email': email,
      'password': password,
    });
  }

  /// Change la boutique active. Retourne { token, activeStore }.
  Future<Map<String, dynamic>> switchStore(int storeId) {
    return _client.post('/auth/switch-store', data: {'storeId': storeId});
  }
}
