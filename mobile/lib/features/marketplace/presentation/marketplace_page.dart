import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import 'marketplace_grid.dart';

/// Miroir de MarketplacePage.jsx — page publique MARCHÉ, atteignable sans
/// connexion (routing : voir app_router.dart, exempt du garde
/// d'authentification, au même titre que /login/register). Habillage
/// volontairement autonome : un visiteur qui découvre l'appli pour la
/// première fois doit comprendre en un coup d'œil où il est et quoi faire
/// ensuite.
class MarketplacePage extends StatelessWidget {
  const MarketplacePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              decoration: BoxDecoration(
                color: Colors.white,
                border: Border(bottom: BorderSide(color: Colors.grey.shade200)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 34,
                        height: 34,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.primary,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('GC', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Gestion Commerciale', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
                          Text('Le marché de nos boutiques', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(999)),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.shopping_bag_outlined, size: 15, color: Colors.white),
                            SizedBox(width: 6),
                            Text('Marché', style: TextStyle(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
                          ],
                        ),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.push('/register'),
                        icon: const Icon(Icons.person_add_alt_outlined, size: 15),
                        label: const Text('Inscription', style: TextStyle(fontSize: 12.5)),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.push('/login'),
                        icon: const Icon(Icons.login, size: 15),
                        label: const Text('Connexion', style: TextStyle(fontSize: 12.5)),
                        style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  Row(
                    children: [
                      Icon(Icons.storefront_outlined, color: Theme.of(context).colorScheme.primary, size: 20),
                      const SizedBox(width: 8),
                      const Text('Découvrez nos boutiques', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                    ],
                  ),
                  const SizedBox(height: 16),
                  const MarketplaceGrid(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
