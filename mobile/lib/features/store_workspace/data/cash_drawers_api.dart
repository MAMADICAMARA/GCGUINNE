import '../../../core/network/api_client.dart';
import 'cash_drawer_history_models.dart';
import 'pos_models.dart';

/// Miroir de cashDrawers.routes.js (§30_fond_de_caisse.sql).
class CashDrawersApi {
  const CashDrawersApi(this._client);

  final ApiClient _client;

  Future<CashDrawer?> getCurrent() async {
    final data = await _client.get('/cash-drawers/current');
    final raw = data['drawer'];
    if (raw == null) return null;
    return CashDrawer.fromJson(raw as Map<String, dynamic>);
  }

  Future<CashDrawer> open(num openingBalance) async {
    final data = await _client.post('/cash-drawers/open', data: {'openingBalance': openingBalance});
    return CashDrawer.fromJson(data);
  }

  Future<CashDrawerCloseResult> close({required num closingBalance, String? note}) async {
    final data = await _client.post('/cash-drawers/close', data: {
      'closingBalance': closingBalance,
      'note': note ?? '',
    });
    return CashDrawerCloseResult.fromJson(data);
  }

  /// Le Owner voit toute l'équipe ; un Vendeur ne voit que ses propres
  /// sessions (scoping fait côté serveur, même principe que l'historique
  /// des ventes).
  Future<CashDrawerListResult> list({int page = 1, int limit = 20}) async {
    final data = await _client.get('/cash-drawers', query: {'page': page, 'limit': limit});
    return CashDrawerListResult.fromJson(data);
  }

  Future<CashDrawerDetail> getById(int id) async {
    final data = await _client.get('/cash-drawers/$id');
    return CashDrawerDetail.fromJson(data);
  }
}
