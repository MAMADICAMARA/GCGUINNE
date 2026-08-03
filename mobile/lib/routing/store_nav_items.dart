import 'package:flutter/material.dart';

class StoreNavItem {
  const StoreNavItem(this.path, this.icon, this.label, this.roles);
  final String path;
  final IconData icon;
  final String label;
  final List<String> roles;
}

/// Miroir de frontend/src/routes/navigation.js.
///
/// Rappel critique (comme côté web) : ce filtrage est un confort de
/// navigation, jamais la barrière de sécurité réelle — chaque route de
/// l'API revérifie indépendamment le rôle côté serveur.
const List<StoreNavItem> kStoreNavItems = [
  StoreNavItem('/workspace', Icons.dashboard_outlined, 'Tableau de bord',
      ['OWNER', 'MANAGER', 'SELLER']),
  StoreNavItem('/workspace/pos', Icons.point_of_sale_outlined, 'Caisse',
      ['OWNER', 'MANAGER', 'SELLER']),
  StoreNavItem('/workspace/products', Icons.inventory_2_outlined, 'Produits',
      ['OWNER', 'MANAGER']),
  StoreNavItem('/workspace/stock', Icons.warehouse_outlined, 'Stock',
      ['OWNER', 'MANAGER']),
  StoreNavItem('/workspace/customers', Icons.people_outline, 'Clients',
      ['OWNER', 'MANAGER', 'SELLER']),
  StoreNavItem('/workspace/employees', Icons.badge_outlined, 'Équipe', ['OWNER']),
];

List<StoreNavItem> navForRole(String? roleCode) {
  if (roleCode == null) return const [];
  return kStoreNavItems.where((item) => item.roles.contains(roleCode)).toList();
}
