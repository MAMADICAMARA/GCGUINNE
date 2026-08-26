import '../../../core/network/api_client.dart';
import 'dashboard_models.dart';
import 'sales_report_models.dart';

/// Miroir des appels réseau de DashboardPage.jsx (GET /dashboard/stats).
class DashboardApi {
  const DashboardApi(this._client);

  final ApiClient _client;

  /// [date] au format AAAA-MM-JJ (optionnel — défaut serveur : aujourd'hui).
  /// Réservé à l'Owner côté UI, mais la restriction réelle est déjà
  /// appliquée côté serveur (voir dashboard.service.js) : rien à revérifier
  /// ici, ce client se contente de relayer la valeur choisie.
  Future<DashboardStats> getStats({String? date}) async {
    final data = await _client.get(
      '/dashboard/stats',
      query: date == null ? null : {'date': date},
    );
    return DashboardStats.fromJson(data);
  }

  /// Rapport de recette (§ décidé en conversation) : total encaissé +
  /// détail par produit sur une période choisie ([startDate]/[endDate] au
  /// format AAAA-MM-JJ, tous deux optionnels — défaut serveur : aujourd'hui).
  Future<SalesReport> getSalesReport({String? startDate, String? endDate}) async {
    final data = await _client.get('/dashboard/sales-report', query: {
      if (startDate != null) 'startDate': startDate,
      if (endDate != null) 'endDate': endDate,
    });
    return SalesReport.fromJson(data);
  }
}
