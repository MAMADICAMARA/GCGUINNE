import '../../../core/network/api_client.dart';
import 'customer_models.dart';
import 'pos_models.dart';

/// Miroir complet de customers.routes.js — recherche (Caisse), liste
/// paginée, fiche/historique, encaissement de paiement (page Clients).
class CustomersApi {
  const CustomersApi(this._client);

  final ApiClient _client;

  Future<List<CustomerSearchResult>> search(String query) async {
    if (query.trim().isEmpty) return [];
    final data = await _client.get('/customers/search', query: {'q': query});
    final raw = data['customers'] as List<dynamic>? ?? [];
    return raw.map((e) => CustomerSearchResult.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<CustomerListResult> list({int page = 1, int limit = 20, String? search, bool owingOnly = false}) async {
    final data = await _client.get('/customers', query: {
      'page': page,
      'limit': limit,
      if (search != null && search.trim().isNotEmpty) 'search': search.trim(),
      if (owingOnly) 'owingOnly': true,
    });
    return CustomerListResult.fromJson(data);
  }

  Future<CustomerOrderHistory> getOrderHistory(int id) async {
    final data = await _client.get('/customers/$id/orders');
    return CustomerOrderHistory.fromJson(data);
  }

  Future<List<CustomerPayment>> getPayments(int id) async {
    final data = await _client.get('/customers/$id/payments');
    final raw = data['payments'] as List<dynamic>? ?? [];
    return raw.map((e) => CustomerPayment.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Volontairement réduit à nom + téléphone (§4.7 du cahier des charges,
  /// décidé en conversation) : les ventes physiques passent avant tout, et
  /// une bonne partie de la clientèle est non lettrée.
  Future<Customer> create({required String name, String? phone}) async {
    final data = await _client.post('/customers', data: {'name': name, 'phone': phone});
    return Customer.fromJson(data);
  }

  /// Retourne le client mis à jour (nouveau solde dû) — l'appelant recharge
  /// la liste séparément pour rester cohérent avec le reste de l'app.
  Future<Customer> recordPayment({required int customerId, required num amount}) async {
    final data = await _client.post('/customers/$customerId/payments', data: {'amount': amount});
    return Customer.fromJson(data['customer'] as Map<String, dynamic>);
  }
}
