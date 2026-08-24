import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../core/network/api_exception.dart';
import '../../marketplace/data/marketplace_api.dart';
import '../../marketplace/presentation/marketplace_grid.dart';
import '../../../state/auth_state.dart';

/// Miroir de AccountHomePage.jsx — y compris le remplacement du contenu
/// d'accueil habituel par la grille MARCHÉ quand l'interrupteur plateforme
/// est activé (§5 du cahier des charges).
class AccountHomePage extends StatefulWidget {
  const AccountHomePage({super.key});

  @override
  State<AccountHomePage> createState() => _AccountHomePageState();
}

class _AccountHomePageState extends State<AccountHomePage> {
  bool _marketplaceEnabled = false;

  @override
  void initState() {
    super.initState();
    _loadMarketplaceStatus();
  }

  Future<void> _loadMarketplaceStatus() async {
    try {
      final enabled = await context.read<MarketplaceApi>().getStatus();
      if (mounted) setState(() => _marketplaceEnabled = enabled);
    } on ApiException catch (_) {
      // Silencieux : en cas d'échec, on reste sur l'accueil habituel —
      // jamais une page qui plante pour une fonctionnalité optionnelle.
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final firstName = authState.user?.fullName.split(' ').first ?? '';
    // Miroir de accountNavigation.js#getAccountNavItems : "Superviser" est
    // exclu pour un compte purement employé (rôle SELLER dans au moins une
    // boutique, jamais OWNER nulle part) — même critère que côté serveur
    // (supervision.service.js#isEmployeeOnly), ce filtrage n'étant qu'un
    // confort d'affichage.
    final isEmployeeOnly =
        authState.stores.isNotEmpty && !authState.stores.any((s) => s.roleCode == 'OWNER');

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
          Text('Bonjour $firstName 👋', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            _marketplaceEnabled
                ? 'Découvrez les produits de nos boutiques partenaires.'
                : 'Bienvenue sur votre espace de gestion.',
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          if (_marketplaceEnabled)
            const MarketplaceGrid()
          else if (authState.stores.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Text(
                      "Vous n'avez pas encore de boutique. Créez-la pour "
                      'commencer à gérer vos produits, votre stock et vos ventes.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey.shade700),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () => context.go('/account/store'),
                      child: const Text('Créer ma boutique'),
                    ),
                  ],
                ),
              ),
            )
          else
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text.rich(
                  TextSpan(
                    style: TextStyle(color: Colors.grey.shade700),
                    children: [
                      TextSpan(
                        text: 'Vous gérez ${authState.stores.length} boutique'
                            '${authState.stores.length > 1 ? 's' : ''}. ',
                      ),
                      const TextSpan(text: "Rendez-vous dans "),
                      const TextSpan(
                        text: 'Ma Boutique',
                        style: TextStyle(fontWeight: FontWeight.w600),
                      ),
                      const TextSpan(text: ' pour l\'ouvrir ou en créer une autre.'),
                    ],
                  ),
                ),
              ),
            ),
          const SizedBox(height: 24),
          Card(
            margin: EdgeInsets.zero,
            child: Column(
              children: [
                if (!isEmployeeOnly)
                  ListTile(
                    leading: const Icon(Icons.visibility_outlined),
                    title: const Text('Superviser'),
                    subtitle: const Text('Boutiques de tiers en lecture seule', style: TextStyle(fontSize: 12)),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/account/supervise'),
                  ),
                if (!isEmployeeOnly) const Divider(height: 1),
                ListTile(
                  leading: const Icon(Icons.help_outline),
                  title: const Text('Contactez-nous'),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () => context.push('/account/contact'),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
