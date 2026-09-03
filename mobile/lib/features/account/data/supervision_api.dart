import '../../../core/network/api_client.dart';
import '../../store_workspace/data/dashboard_models.dart';
import '../../store_workspace/data/order_models.dart';
import '../../store_workspace/data/pos_models.dart';
import '../../store_workspace/data/product_detail_models.dart';
import '../../store_workspace/data/sales_report_models.dart';
import 'supervision_models.dart';

/// Miroir complet de supervision.routes.js — lecture stricte, aucune route
/// d'écriture accessible depuis ici hormis addSupervisedStore/remove qui
/// n'affectent que MON lien de supervision, jamais la boutique visée.
class SupervisionApi {
  const SupervisionApi(this._client);

  final ApiClient _client;

  Future<List<SupervisableStore>> listStores() async {
    final data = await _client.get('/supervision/stores');
    final raw = data['stores'] as List<dynamic>? ?? [];
    return raw.map((e) => SupervisableStore.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// Retourne le nom de la boutique ajoutée (message de confirmation, comme
  /// sur le web).
  Future<String> addStore(String code) async {
    final data = await _client.post('/supervision/stores', data: {'code': code.trim()});
    return data['storeName'] as String;
  }

  Future<void> removeStore(int storeId) => _client.delete('/supervision/stores/$storeId');

  /// [date] au format AAAA-MM-JJ (optionnel — défaut serveur : aujourd'hui,
  /// § décidé en conversation, onglet Aperçu paramétrable par date).
  Future<({String storeName, DashboardStats stats})> getStats(int storeId, {String? date}) async {
    final data = await _client.get(
      '/supervision/stores/$storeId/stats',
      query: date == null ? null : {'date': date},
    );
    return (
      storeName: (data['store'] as Map<String, dynamic>)['name'] as String,
      stats: DashboardStats.fromJson(data['stats'] as Map<String, dynamic>),
    );
  }

  /// Rapport de recette (§ décidé en conversation, onglet RECETTE) — miroir
  /// de DashboardApi.getSalesReport, mais pour une boutique supervisée.
  /// [startDate]/[endDate] au format AAAA-MM-JJ, tous deux optionnels et
  /// inclusifs (défaut serveur : aujourd'hui).
  Future<SalesReport> getSalesReport(int storeId, {String? startDate, String? endDate}) async {
    final data = await _client.get(
      '/supervision/stores/$storeId/sales-report',
      query: {
        if (startDate != null) 'startDate': startDate,
        if (endDate != null) 'endDate': endDate,
      },
    );
    return SalesReport.fromJson(data);
  }

  Future<List<dynamic>> _rawProducts(int storeId, {int limit = 100}) async {
    final data = await _client.get('/supervision/stores/$storeId/products', query: {'limit': limit});
    return data['products'] as List<dynamic>? ?? [];
  }

  Future<List<Product>> getProducts(int storeId, {int limit = 100}) async {
    final raw = await _rawProducts(storeId, limit: limit);
    return raw.map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<StockMovement>> getStockMovements(int storeId, {int limit = 50}) async {
    final data = await _client.get('/supervision/stores/$storeId/stock-movements', query: {'limit': limit});
    final raw = data['movements'] as List<dynamic>? ?? [];
    return raw.map((e) => StockMovement.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// [date] au format AAAA-MM-JJ — défaut serveur : aujourd'hui. Un seul
  /// jour à la fois (jamais de plage), comme sur le web.
  Future<List<OrderSummary>> getOrders(int storeId, {String? date}) async {
    final data = await _client.get(
      '/supervision/stores/$storeId/orders',
      query: date == null ? null : {'date': date},
    );
    final raw = data['orders'] as List<dynamic>? ?? [];
    return raw.map((e) => OrderSummary.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<OrderDetail> getOrder(int storeId, int orderId) async {
    final data = await _client.get('/supervision/stores/$storeId/orders/$orderId');
    return OrderDetail.fromJson(data);
  }

  Future<AuditLogListResult> getAuditLog(
    int storeId, {
    int page = 1,
    int limit = 20,
    String? action,
    bool includeLogins = false,
  }) async {
    final data = await _client.get('/supervision/stores/$storeId/audit-log', query: {
      'page': page,
      'limit': limit,
      if (action != null && action.isNotEmpty) 'action': action,
      'includeLogins': includeLogins,
    });
    return AuditLogListResult.fromJson(data);
  }
}
