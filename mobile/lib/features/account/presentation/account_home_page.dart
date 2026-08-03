import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../state/auth_state.dart';

class AccountHomePage extends StatelessWidget {
  const AccountHomePage({super.key});

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final firstName = authState.user?.fullName.split(' ').first ?? '';

    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Bonjour $firstName 👋', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: 4),
          Text(
            'Bienvenue sur votre espace de gestion.',
            style: TextStyle(color: Colors.grey.shade600),
          ),
          const SizedBox(height: 24),
          if (authState.stores.isEmpty)
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
                            '${authState.stores.length > 1 ? "s" : ""}. ',
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
        ],
      ),
    );
  }
}
