import 'package:go_router/go_router.dart';

import '../features/account/presentation/account_home_page.dart';
import '../features/account/presentation/account_settings_page.dart';
import '../features/account/presentation/account_shell.dart';
import '../features/account/presentation/my_store_page.dart';
import '../features/account/presentation/profile_page.dart';
import '../features/auth/presentation/login_page.dart';
import '../features/auth/presentation/register_page.dart';
import '../features/store_workspace/presentation/customers_page.dart';
import '../features/store_workspace/presentation/dashboard_page.dart';
import '../features/store_workspace/presentation/employees_page.dart';
import '../features/store_workspace/presentation/pos_page.dart';
import '../features/store_workspace/presentation/products_page.dart';
import '../features/store_workspace/presentation/stock_page.dart';
import '../features/store_workspace/presentation/store_shell.dart';
import '../state/auth_state.dart';

/// Construit le routeur applicatif.
///
/// La logique de [redirect] est le miroir exact des deux gardes de route
/// côté web :
/// - frontend/src/routes/ProtectedRoute.jsx    -> exige une session
/// - frontend/src/routes/RequireStoreRoute.jsx -> exige une boutique active
///
/// [refreshListenable] fait réévaluer cette logique à chaque changement de
/// AuthState (connexion, déconnexion, changement de boutique...), sans quoi
/// go_router ne recalculerait la redirection qu'au changement d'URL.
GoRouter buildAppRouter(AuthState authState) {
  return GoRouter(
    initialLocation: authState.isAuthenticated ? '/account' : '/login',
    refreshListenable: authState,
    redirect: (context, state) {
      final location = state.matchedLocation;
      final onAuthPages = location == '/login' || location == '/register';

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
      GoRoute(path: '/login', builder: (context, state) => const LoginPage()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterPage()),

      ShellRoute(
        builder: (context, state, child) =>
            AccountShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/account', builder: (context, state) => const AccountHomePage()),
          GoRoute(path: '/account/store', builder: (context, state) => const MyStorePage()),
          GoRoute(path: '/account/profile', builder: (context, state) => const ProfilePage()),
          GoRoute(
            path: '/account/settings',
            builder: (context, state) => const AccountSettingsPage(),
          ),
        ],
      ),

      ShellRoute(
        builder: (context, state, child) =>
            StoreShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(path: '/workspace', builder: (context, state) => const DashboardPage()),
          GoRoute(path: '/workspace/pos', builder: (context, state) => const PosPage()),
          GoRoute(path: '/workspace/products', builder: (context, state) => const ProductsPage()),
          GoRoute(path: '/workspace/stock', builder: (context, state) => const StockPage()),
          GoRoute(
            path: '/workspace/customers',
            builder: (context, state) => const CustomersPage(),
          ),
          GoRoute(
            path: '/workspace/employees',
            builder: (context, state) => const EmployeesPage(),
          ),
        ],
      ),
    ],
  );
}
