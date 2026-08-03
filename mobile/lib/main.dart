import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/config/app_config.dart';
import 'core/network/api_client.dart';
import 'core/storage/token_storage.dart';
import 'features/account/data/stores_api.dart';
import 'features/auth/data/auth_api.dart';
import 'state/auth_state.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const tokenStorage = TokenStorage();
  final authState = AuthState(tokenStorage);

  // On attend la restauration de la session AVANT de lancer l'app plutôt
  // que d'afficher un écran de chargement géré par le routeur : plus
  // simple à garder correct, et l'attente est de toute façon très brève
  // (lecture locale du stockage sécurisé, pas d'appel réseau).
  await authState.restore();

  final apiClient = ApiClient(
    baseUrl: AppConfig.apiBaseUrl,
    getToken: () => authState.token,
    onUnauthorized: () => authState.logout(),
  );

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthState>.value(value: authState),
        Provider<ApiClient>.value(value: apiClient),
        Provider<AuthApi>(create: (_) => AuthApi(apiClient)),
        Provider<StoresApi>(create: (_) => StoresApi(apiClient)),
      ],
      child: const App(),
    ),
  );
}
