import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class _TabItem {
  const _TabItem(this.path, this.icon, this.label);
  final String path;
  final IconData icon;
  final String label;
}

/// Shell de l'espace COMPTE — 4 entrées toujours visibles, qu'une boutique
/// soit active ou non (§4.1 vs §4.2 du cahier des charges). Miroir de
/// frontend/src/layouts/AccountLayout.jsx.
class AccountShell extends StatelessWidget {
  const AccountShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  static const List<_TabItem> _tabs = [
    _TabItem('/account', Icons.home_outlined, 'Accueil'),
    _TabItem('/account/store', Icons.storefront_outlined, 'Ma Boutique'),
    _TabItem('/account/profile', Icons.person_outline, 'Profil'),
    _TabItem('/account/settings', Icons.settings_outlined, 'Paramètres'),
  ];

  int get _currentIndex {
    final index = _tabs.indexWhere((t) => t.path == location);
    return index == -1 ? 0 : index;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(child: child),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _currentIndex,
        onDestinationSelected: (i) => context.go(_tabs[i].path),
        destinations: [
          for (final tab in _tabs)
            NavigationDestination(icon: Icon(tab.icon), label: tab.label),
        ],
      ),
    );
  }
}
