import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../routing/store_nav_items.dart';
import '../../../state/auth_state.dart';

/// Shell de l'espace BOUTIQUE — utilise un Drawer plutôt qu'une barre de
/// navigation basse : le nombre d'entrées varie selon le rôle (jusqu'à 6
/// pour un Owner), ce qui ne tient pas proprement dans une bottom bar
/// standard. Miroir fonctionnel de frontend/src/layouts/DashboardLayout.jsx.
class StoreShell extends StatelessWidget {
  const StoreShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final activeStore = authState.activeStore;
    final navItems = navForRole(activeStore?.roleCode);
    final matching = navItems.where((i) => i.path == location);
    final currentItem = matching.isEmpty ? null : matching.first;

    return Scaffold(
      appBar: AppBar(
        title: Text(currentItem?.label ?? activeStore?.name ?? ''),
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Boutique active',
                      style: TextStyle(color: Colors.grey.shade500, fontSize: 12),
                    ),
                    Text(
                      activeStore?.name ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                    ),
                    if (authState.stores.length > 1)
                      TextButton(
                        style: TextButton.styleFrom(padding: EdgeInsets.zero),
                        onPressed: () {
                          Navigator.of(context).pop();
                          context.go('/account/store');
                        },
                        child: const Text('Changer de boutique'),
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),
              Expanded(
                child: ListView(
                  padding: EdgeInsets.zero,
                  children: [
                    for (final item in navItems)
                      ListTile(
                        leading: Icon(item.icon),
                        title: Text(item.label),
                        selected: item.path == location,
                        onTap: () {
                          Navigator.of(context).pop();
                          context.go(item.path);
                        },
                      ),
                  ],
                ),
              ),
              const Divider(height: 1),
              ListTile(
                leading: const Icon(Icons.arrow_back),
                title: const Text('Mon compte'),
                onTap: () {
                  Navigator.of(context).pop();
                  context.go('/account');
                },
              ),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Se déconnecter'),
                onTap: () => context.read<AuthState>().logout(),
              ),
              const SizedBox(height: 8),
            ],
          ),
        ),
      ),
      body: child,
    );
  }
}
