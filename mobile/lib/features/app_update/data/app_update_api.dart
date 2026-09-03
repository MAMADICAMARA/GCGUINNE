import '../../../core/network/api_client.dart';
import 'app_update_models.dart';

/// Miroir de appVersions.public.routes.js — public, aucune authentification
/// requise (le client attache quand même le jeton s'il existe, sans
/// conséquence : la route ne le vérifie jamais).
class AppUpdateApi {
  const AppUpdateApi(this._client);

  final ApiClient _client;

  Future<AppVersionInfo?> getLatestVersion({String platform = 'android'}) async {
    final data = await _client.get('/app/version', query: {'platform': platform});
    return AppVersionInfo.fromJsonOrNull(data);
  }
}
