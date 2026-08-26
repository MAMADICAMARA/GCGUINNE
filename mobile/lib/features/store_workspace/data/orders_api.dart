import '../../../core/network/api_client.dart';
import 'order_models.dart';
import 'pos_models.dart';

/// Miroir de orders.routes.js — création de vente (Caisse) et historique
/// complet (Historique des ventes : liste, détail, annulation, retour).
class OrdersApi {
  const OrdersApi(this._client);

  final ApiClient _client;

  Future<OrderListResult> list({
    int page = 1,
    int limit = 20,
    String? status,
    String? startDate,
    String? endDate,
  }) async {
    final data = await _client.get('/orders', query: {
      'page': page,
      'limit': limit,
      if (status != null && status.isNotEmpty) 'status': status,
      if (startDate != null && startDate.isNotEmpty) 'startDate': startDate,
      if (endDate != null && endDate.isNotEmpty) 'endDate': endDate,
    });
    return OrderListResult.fromJson(data);
  }

  Future<OrderDetail> getDetail(int id) async {
    final data = await _client.get('/orders/$id');
    return OrderDetail.fromJson(data);
  }

  /// Annule la commande entière : stock remis, dette éventuelle du client
  /// annulée. Irréversible (confirmé côté UI avant l'appel).
  Future<void> voidOrder(int id) => _client.post('/orders/$id/void');

  /// Un seul article à la fois (seule route disponible côté backend) —
  /// pour un retour multi-articles, appeler séquentiellement, jamais en
  /// parallèle : le statut de la commande est recalculé à chaque appel à
  /// partir de l'état courant côté serveur.
  Future<void> returnItem({required int orderId, required int itemId, required int returnedQty}) =>
      _client.post('/orders/$orderId/items/$itemId/return', data: {'returnedQty': returnedQty});

  Future<OrderResult> createOrder({
    required List<CartItem> items,
    required String paymentMethod,
    required num discount,
    required num tax,
    required num amountPaid,
    SelectedCustomer? customer,
  }) async {
    final data = await _client.post('/orders', data: {
      'items': items
          .map((item) => {
                'productId': item.productId,
                'quantity': item.quantity,
                if (item.priceEdited) 'unitPrice': item.unitPrice,
              })
          .toList(),
      'paymentMethod': paymentMethod,
      'discount': discount,
      'tax': tax,
      'amountPaid': amountPaid,
      if (customer?.isNewCustomer == true)
        'newCustomer': {'name': customer!.name, 'phone': customer.phone}
      else
        'customerId': customer?.id,
    });
    return OrderResult.fromJson(data);
  }
}
