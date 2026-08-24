import '../../../core/network/api_client.dart';
import 'supplier_models.dart';

/// Miroir de suppliers.routes.js (§18_fournisseurs_inter_boutiques.sql) —
/// réservé à l'Owner (déjà appliqué côté serveur). Ajouter/parcourir un
/// fournisseur reste ouvert à tous les plans ; seule la commande elle-même
/// (PurchasesApi) exige le plan PREMIUM de l'acheteur.
class SuppliersApi {
  const SuppliersApi(this._client);

  final ApiClient _client;

  Future<List<StoreLink>> listSuppliers() async {
    final data = await _client.get('/suppliers');
    final raw = data['suppliers'] as List<dynamic>? ?? [];
    return raw.map((e) => StoreLink.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StoreLink>> listClients() async {
    final data = await _client.get('/suppliers/clients');
    final raw = data['clients'] as List<dynamic>? ?? [];
    return raw.map((e) => StoreLink.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Retourne le nom de la boutique ajoutée — utilisé pour le message de
  /// confirmation ("X a été ajoutée à vos fournisseurs").
  Future<String> addSupplier(String code) async {
    final data = await _client.post('/suppliers', data: {'code': code});
    return data['name'] as String;
  }

  Future<void> removeSupplier(int linkId) => _client.delete('/suppliers/$linkId');

  Future<void> removeClient(int linkId) => _client.delete('/suppliers/clients/$linkId');

  Future<SupplierOrderCatalog> getOrderCatalog(int supplierStoreId) async {
    final data = await _client.get('/suppliers/$supplierStoreId/order-catalog');
    return SupplierOrderCatalog.fromJson(data);
  }
}
