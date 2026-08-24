import '../../../core/network/api_client.dart';
import 'settings_models.dart';

/// Miroir de subscriptionPayments.routes.js — réservé au Owner. Le montant
/// n'est jamais fourni par le client : toujours recalculé côté serveur à
/// partir du prix actuel du plan choisi.
class SubscriptionPaymentsApi {
  const SubscriptionPaymentsApi(this._client);

  final ApiClient _client;

  Future<SubscriptionOptions> getOptions() async {
    final data = await _client.get('/subscription-payments/options');
    return SubscriptionOptions.fromJson(data);
  }

  Future<SubscriptionRequest?> getMine() async {
    final data = await _client.get('/subscription-payments/mine');
    final request = data['request'] as Map<String, dynamic>?;
    return request == null ? null : SubscriptionRequest.fromJson(request);
  }

  Future<void> submit({
    required int planId,
    required String paymentMethod,
    required String transactionReference,
    String? payerPhone,
  }) {
    return _client.post('/subscription-payments', data: {
      'planId': planId,
      'paymentMethod': paymentMethod,
      'transactionReference': transactionReference,
      if (payerPhone != null && payerPhone.isNotEmpty) 'payerPhone': payerPhone,
    });
  }
}
