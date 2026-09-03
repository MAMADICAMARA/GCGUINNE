import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';

import '../../../state/auth_state.dart';
import '../../../state/update_state.dart';
import '../../app_update/presentation/update_banner.dart';

class _TabItem {
  const _TabItem(this.path, this.icon, this.label, {this.showBadge = false});
  final String path;
  final IconData icon;
  final String label;
  final bool showBadge;
}

/// Shell de l'espace COMPTE — jusqu'à 6 entrées (§ décidé en conversation :
/// "Superviser" et "Contactez-nous" promus depuis la carte de liens en bas
/// de l'Accueil vers la barre elle-même, juste après "Paramètres"). Miroir
/// de frontend/src/layouts/AccountLayout.jsx.
///
/// Au-delà de 5 items, le widget Material `NavigationBar` standard devient
/// illisible (il répartit toujours ses items également, sans défilement) —
/// remplacé ici par une barre scrollable horizontalement construite à la
/// main. Compromis assumé : moins "découvrable" qu'une barre classique,
/// mais c'est le choix explicitement demandé plutôt qu'un onglet "Plus".
class AccountShell extends StatelessWidget {
  const AccountShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  List<_TabItem> _tabsFor(AuthState authState, UpdateState updateState) {
    // Même critère que côté serveur (supervision.service.js#isEmployeeOnly)
    // et que l'ancien emplacement de ce lien dans account_home_page.dart :
    // un compte purement employé (jamais OWNER nulle part) n'a rien à
    // superviser.
    final isEmployeeOnly =
        authState.stores.isNotEmpty && !authState.stores.any((s) => s.roleCode == 'OWNER');

    return [
      const _TabItem('/account', Icons.home_outlined, 'Accueil'),
      const _TabItem('/account/store', Icons.storefront_outlined, 'Ma Boutique'),
      const _TabItem('/account/profile', Icons.person_outline, 'Profil'),
      // Badge discret niveau OPTIONAL (§5, décidé en conversation) — les
      // niveaux RECOMMENDED/MANDATORY ont déjà leurs propres UI (bandeau,
      // écran bloquant), inutile de dupliquer le signal ici pour eux.
      _TabItem(
        '/account/settings',
        Icons.settings_outlined,
        'Paramètres',
        showBadge: updateState.isOptional,
      ),
      if (!isEmployeeOnly)
        const _TabItem('/account/supervise', Icons.visibility_outlined, 'Superviser'),
      const _TabItem('/account/contact', Icons.help_outline, 'Contact'),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final authState = context.watch<AuthState>();
    final updateState = context.watch<UpdateState>();
    final tabs = _tabsFor(authState, updateState);
    final currentIndex = tabs.indexWhere((t) => t.path == location);

    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const UpdateBanner(),
            Expanded(child: child),
          ],
        ),
      ),
      bottomNavigationBar: _ScrollableBottomNav(
        tabs: tabs,
        currentIndex: currentIndex == -1 ? 0 : currentIndex,
        onSelect: (i) => context.go(tabs[i].path),
      ),
    );
  }
}

class _ScrollableBottomNav extends StatelessWidget {
  const _ScrollableBottomNav({required this.tabs, required this.currentIndex, required this.onSelect});

  final List<_TabItem> tabs;
  final int currentIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;

    return Material(
      elevation: 3,
      color: colorScheme.surface,
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 72,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            itemCount: tabs.length,
            itemBuilder: (context, i) {
              final tab = tabs[i];
              final selected = i == currentIndex;
              final color = selected ? colorScheme.primary : colorScheme.onSurfaceVariant;

              return InkWell(
                onTap: () => onSelect(i),
                borderRadius: BorderRadius.circular(16),
                child: Container(
                  width: 76,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Stack(
                        clipBehavior: Clip.none,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
                            decoration: BoxDecoration(
                              color: selected ? colorScheme.secondaryContainer : Colors.transparent,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Icon(tab.icon, color: color, size: 22),
                          ),
                          if (tab.showBadge)
                            Positioned(
                              top: 2,
                              right: 10,
                              child: Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(
                                  color: Colors.blue.shade600,
                                  shape: BoxShape.circle,
                                  border: Border.all(color: colorScheme.surface, width: 1.5),
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        tab.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11.5,
                          color: color,
                          fontWeight: selected ? FontWeight.w600 : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
