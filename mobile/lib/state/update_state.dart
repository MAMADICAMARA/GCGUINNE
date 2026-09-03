import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../features/app_update/data/app_update_api.dart';
import '../features/app_update/data/app_update_models.dart';

/// État de la vérification de mise à jour (§ cahier des charges "Système
/// de notification de mise à jour", décidé en conversation) — AUCUN état
/// "déjà vu" mémorisé nulle part (§3) : comparaison pure entre le
/// versionCode installé et celui publié côté serveur, à chaque appel de
/// [check]. Dès que l'utilisateur installe la mise à jour, [hasUpdate]
/// redevient naturellement faux au prochain lancement — rien à "marquer
/// comme lu".
///
/// Échec réseau/serveur = échec SILENCIEUX (§ décidé en conversation) :
/// [latestVersion] reste `null`, donc [hasUpdate] reste faux — un
/// problème de connexion ne doit JAMAIS bloquer un utilisateur, y compris
/// si la dernière mise à jour connue était MANDATORY. Seule une réponse
/// serveur reçue avec succès peut déclencher un blocage.
class UpdateState extends ChangeNotifier {
  AppVersionInfo? latestVersion;
  int? installedVersionCode;
  String? installedVersionName;

  bool get hasUpdate =>
      latestVersion != null &&
      installedVersionCode != null &&
      latestVersion!.versionCode > installedVersionCode!;

  bool get isMandatory => hasUpdate && latestVersion!.updateLevel == 'MANDATORY';
  bool get isRecommended => hasUpdate && latestVersion!.updateLevel == 'RECOMMENDED';
  bool get isOptional => hasUpdate && latestVersion!.updateLevel == 'OPTIONAL';

  /// À appeler à chaque lancement de l'app ET à chaque ouverture de
  /// Paramètres (§8 du cahier des charges) — jamais attendu avant runApp
  /// (contrairement à AuthState.restore) : un réseau lent ne doit jamais
  /// retarder l'affichage de l'app elle-même, seul le résultat de cette
  /// vérification s'affiche ensuite, de façon réactive.
  Future<void> check(AppUpdateApi api) async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      installedVersionCode = int.tryParse(packageInfo.buildNumber);
      installedVersionName = packageInfo.version;

      final version = await api.getLatestVersion();
      latestVersion = version;
      notifyListeners();
    } catch (_) {
      // Échec silencieux, voir le commentaire de classe ci-dessus — jamais
      // d'exception qui remonterait jusqu'à l'appelant.
    }
  }
}
