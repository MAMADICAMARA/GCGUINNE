import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'core/auth/quick_unlock_service.dart';
import 'core/config/app_config.dart';
import 'core/network/api_client.dart';
import 'core/storage/quick_unlock_storage.dart';
import 'core/storage/token_storage.dart';
import 'features/account/data/stores_api.dart';
import 'features/account/data/supervision_api.dart';
import 'features/app_update/data/app_update_api.dart';
import 'features/auth/data/auth_api.dart';
import 'features/store_workspace/data/cash_drawers_api.dart';
import 'features/store_workspace/data/catalog_api.dart';
import 'features/store_workspace/data/contact_api.dart';
import 'features/store_workspace/data/customers_api.dart';
import 'features/store_workspace/data/dashboard_api.dart';
import 'features/marketplace/data/marketplace_api.dart';
import 'features/store_workspace/data/employees_api.dart';
import 'features/store_workspace/data/notes_api.dart';
import 'features/store_workspace/data/orders_api.dart';
import 'features/store_workspace/data/products_api.dart';
import 'features/store_workspace/data/purchases_api.dart';
import 'features/store_workspace/data/stock_transfers_api.dart';
import 'features/store_workspace/data/subscription_payments_api.dart';
import 'features/store_workspace/data/suppliers_api.dart';
import 'features/store_workspace/data/uploads_api.dart';
import 'state/auth_state.dart';
import 'state/update_state.dart';

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

  final appUpdateApi = AppUpdateApi(apiClient);
  final updateState = UpdateState();
  // JAMAIS attendu avant runApp (contrairement à authState.restore ci-
  // dessus) — un appel réseau lent ne doit jamais retarder l'affichage de
  // l'app ; le routeur/les bandeaux réagissent dès que le résultat arrive
  // (§ décidé en conversation, échec silencieux si hors-ligne).
  unawaited(updateState.check(appUpdateApi));

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<AuthState>.value(value: authState),
        ChangeNotifierProvider<UpdateState>.value(value: updateState),
        Provider<ApiClient>.value(value: apiClient),
        Provider<QuickUnlockStorage>(create: (_) => const QuickUnlockStorage()),
        Provider<QuickUnlockService>(create: (_) => const QuickUnlockService()),
        Provider<AppUpdateApi>.value(value: appUpdateApi),
        Provider<AuthApi>(create: (_) => AuthApi(apiClient)),
        Provider<StoresApi>(create: (_) => StoresApi(apiClient)),
        Provider<SupervisionApi>(create: (_) => SupervisionApi(apiClient)),
        Provider<MarketplaceApi>(create: (_) => MarketplaceApi(apiClient)),
        Provider<DashboardApi>(create: (_) => DashboardApi(apiClient)),
        Provider<CatalogApi>(create: (_) => CatalogApi(apiClient)),
        Provider<CustomersApi>(create: (_) => CustomersApi(apiClient)),
        Provider<ContactApi>(create: (_) => ContactApi(apiClient)),
        Provider<CashDrawersApi>(create: (_) => CashDrawersApi(apiClient)),
        Provider<OrdersApi>(create: (_) => OrdersApi(apiClient)),
        Provider<ProductsApi>(create: (_) => ProductsApi(apiClient)),
        Provider<UploadsApi>(create: (_) => UploadsApi(apiClient)),
        Provider<NotesApi>(create: (_) => NotesApi(apiClient)),
        Provider<EmployeesApi>(create: (_) => EmployeesApi(apiClient)),
        Provider<SuppliersApi>(create: (_) => SuppliersApi(apiClient)),
        Provider<PurchasesApi>(create: (_) => PurchasesApi(apiClient)),
        Provider<StockTransfersApi>(
            create: (_) => StockTransfersApi(apiClient)),
        Provider<SubscriptionPaymentsApi>(
            create: (_) => SubscriptionPaymentsApi(apiClient)),
      ],
      child: const App(),
    ),
  );
}
