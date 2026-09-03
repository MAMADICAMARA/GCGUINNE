import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../features/account/presentation/account_home_page.dart';
import '../features/account/presentation/account_settings_page.dart';
import '../features/account/presentation/account_shell.dart';
import '../features/account/presentation/my_store_page.dart';
import '../features/account/presentation/profile_page.dart';
import '../features/account/presentation/supervise_page.dart';
import '../features/account/presentation/supervised_store_detail_page.dart';
import '../features/app_update/presentation/update_required_page.dart';
import '../features/auth/presentation/forgot_password_page.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/presentation/register_page.dart';
import '../features/auth/presentation/verify_email_page.dart';
import '../features/store_workspace/presentation/cash_drawer_history_page.dart';
import '../features/store_workspace/presentation/contact_page.dart';
import '../features/store_workspace/presentation/customers_page.dart';
import '../features/store_workspace/presentation/dashboard_page.dart';
import '../features/store_workspace/presentation/employees_page.dart';
import '../features/store_workspace/presentation/pos_page.dart';
import '../features/store_workspace/presentation/notes_page.dart';
import '../features/store_workspace/presentation/products_page.dart';
import '../features/store_workspace/presentation/purchases_page.dart';
import '../features/store_workspace/presentation/sales_history_page.dart';
import '../features/store_workspace/presentation/sales_report_page.dart';
import '../features/store_workspace/presentation/settings_page.dart';
import '../features/store_workspace/presentation/stock_page.dart';
import '../features/marketplace/data/marketplace_api.dart';
import '../features/marketplace/presentation/marketplace_page.dart';
import '../features/store_workspace/presentation/store_shell.dart';
import '../features/store_workspace/presentation/suppliers/supplier_storefront_page.dart';
import '../features/store_workspace/presentation/suppliers_page.dart';
import '../state/auth_state.dart';
import '../state/update_state.dart';
import 'login_route_extra.dart';

/// Construit le routeur applicatif.
///
/// La logique de [redirect] est le miroir exact des gardes de route côté
/// web :
/// - frontend/src/routes/ProtectedRoute.jsx    -> exige une session
/// - frontend/src/routes/RequireStoreRoute.jsx -> exige une boutique active
/// - frontend/src/routes/RootRedirect.jsx      -> "/" : /marche si MARCHÉ
///   est activé et le visiteur n'est pas connecté, /account sinon.
///
/// [refreshListenable] fait réévaluer cette logique à chaque changement de
/// AuthState (connexion, déconnexion, changement de boutique...), sans quoi
/// go_router ne recalculerait la redirection qu'au changement d'URL.
GoRouter buildAppRouter(
  AuthState authState,
  MarketplaceApi marketplaceApi,
  UpdateState updateState,
) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: Listenable.merge([authState, updateState]),
    redirect: (context, state) async {
      final location = state.matchedLocation;

      // Mise à jour MANDATORY (§5, décidé en conversation) : passe AVANT
      // toute autre logique, y compris l'état de connexion — un blocage
      // obligatoire s'applique qu'on soit authentifié ou non. Seule une
      // réponse serveur reçue avec succès peut déclencher ce blocage
      // (échec réseau = échec silencieux, voir UpdateState).
      if (updateState.isMandatory) {
        return location == '/update-required' ? null : '/update-required';
      }
      if (location == '/update-required') return '/';

      // MARCHÉ (§5/§9) : route publique, jamais soumise au garde de
      // session ci-dessous — atteignable qu'on soit connecté ou non,
      // contrairement aux pages d'authentification qui renvoient vers
      // /account une fois connecté.
      if (location == '/marche') return null;

      if (location == '/') {
        if (authState.isAuthenticated) return '/account';
        final enabled = await marketplaceApi.getStatus().catchError((_) => false);
        return enabled ? '/marche' : '/login';
      }

      final onAuthPages = location == '/login' ||
          location == '/register' ||
          location == '/verify-email' ||
          location == '/forgot-password';

      if (!authState.isAuthenticated) {
        return onAuthPages ? null : '/login';
      }

      if (onAuthPages) {
        return '/account';
      }

      // Espace boutique : exige une boutique active. Un compte qui n'en a
      // pas encore choisi/créé une est renvoyé vers "Ma Boutique" plutôt
      // que bloqué sans explication (cf. §4.2 / §6.1 du cahier des charges).
      if (location.startsWith('/workspace') && authState.activeStore == null) {
        return '/account/store';
      }

      return null;
    },
    routes: [
      GoRoute(path: '/', builder: (context, state) => const SizedBox.shrink()),
      GoRoute(
        path: '/marche',
        builder: (context, state) => MarketplacePage(initialProductId: state.extra as int?),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) {
          final extra = state.extra as LoginRouteExtra?;
          return LoginPage(prefillEmail: extra?.prefillEmail, redirectProductId: extra?.redirectProductId);
        },
      ),
      GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),
      GoRoute(
        path: '/verify-email',
        builder: (context, state) => VerifyEmailPage(initialEmail: state.extra as String?),
      ),
      GoRoute(path: '/forgot-password', builder: (context, state) => const ForgotPasswordPage()),
      GoRoute(path: '/update-required', builder: (context, state) => const UpdateRequiredPage()),

      ShellRoute(
        builder: (context, state, child) =>
            AccountShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/account', builder: (context, state) => const AccountHomePage()),
          GoRoute(path: '/account/store', builder: (context, state) => const MyStorePage()),
          GoRoute(path: '/account/supervise', builder: (context, state) => const SupervisePage()),
          GoRoute(
            path: '/account/supervise/:storeId',
            builder: (context, state) => SupervisedStoreDetailPage(
              storeId: int.parse(state.pathParameters['storeId']!),
            ),
          ),
          GoRoute(path: '/account/profile', builder: (context, state) => const ProfilePage()),
          GoRoute(
            path: '/account/settings',
            builder: (context, state) => const AccountSettingsPage(),
          ),
          GoRoute(path: '/account/contact', builder: (context, state) => const ContactPage()),
        ],
      ),

      ShellRoute(
        builder: (context, state, child) =>
            StoreShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/workspace', builder: (context, state) => const DashboardPage()),
          GoRoute(path: '/workspace/pos', builder: (context, state) => const PosPage()),
          GoRoute(path: '/workspace/cash-drawers', builder: (context, state) => const CashDrawerHistoryPage()),
          GoRoute(path: '/workspace/products', builder: (context, state) => const ProductsPage()),
          GoRoute(path: '/workspace/stock', builder: (context, state) => const StockPage()),
          GoRoute(path: '/workspace/sales', builder: (context, state) => const SalesHistoryPage()),
          GoRoute(path: '/workspace/reports/sales', builder: (context, state) => const SalesReportPage()),
          GoRoute(
            path: '/workspace/customers',
            builder: (context, state) => const CustomersPage(),
          ),
          GoRoute(path: '/workspace/notes', builder: (context, state) => const NotesPage()),
          GoRoute(path: '/workspace/suppliers', builder: (context, state) => const SuppliersPage()),
          GoRoute(
            path: '/workspace/suppliers/:storeId/order',
            builder: (context, state) => SupplierStorefrontPage(
              storeId: int.parse(state.pathParameters['storeId']!),
            ),
          ),
          GoRoute(path: '/workspace/purchases', builder: (context, state) => const PurchasesPage()),
          GoRoute(
            path: '/workspace/employees',
            builder: (context, state) => const EmployeesPage(),
          ),
          GoRoute(path: '/workspace/settings', builder: (context, state) => const SettingsPage()),
          GoRoute(path: '/workspace/contact', builder: (context, state) => const ContactPage()),
        ],
      ),
    ],
  );
}
