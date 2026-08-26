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
/// Pas de rôle MANAGER (§21_abandon_role_manager.sql, décidé en
/// conversation, contexte guinéen) — deux rôles seulement dans une
/// boutique : OWNER et SELLER. Cette liste ne reprend pour l'instant que
/// les écrans déjà migrés côté mobile ; les entrées manquantes
/// (Journal d'activité) sera ajoutée au fil de sa migration,
/// dans le même ordre que le menu web, pour ne jamais pointer vers un
/// écran qui n'existe pas encore.
///
/// Rappel critique (comme côté web) : ce filtrage est un confort de
/// navigation, jamais la barrière de sécurité réelle — chaque route de
/// l'API revérifie indépendamment le rôle côté serveur.
const List<StoreNavItem> kStoreNavItems = [
  StoreNavItem('/workspace', Icons.dashboard_outlined, 'Tableau de bord',
      ['OWNER', 'SELLER']),
  StoreNavItem('/workspace/pos', Icons.point_of_sale_outlined, 'Caisse',
      ['OWNER', 'SELLER']),
  // Visible au Owner ET au Vendeur (§30_fond_de_caisse.sql, décidé en
  // conversation) — c'est le Vendeur qui ouvre/ferme sa propre caisse ; le
  // Owner voit en plus l'historique de toute l'équipe (scoping côté serveur).
  StoreNavItem('/workspace/cash-drawers', Icons.account_balance_wallet_outlined,
      'Historique des caisses', ['OWNER', 'SELLER']),
  // Visible au Vendeur seulement si le Owner l'a autorisé à créer des
  // produits (§40_autorisation_ajout_produit.sql, décidé en conversation)
  // — filtre appliqué dans navForRole ci-dessous. Un Vendeur qui accède à
  // cet écran n'y voit que la création, jamais modifier/désactiver un
  // produit existant (products_page.dart, réservé au Owner).
  StoreNavItem('/workspace/products', Icons.inventory_2_outlined, 'Produits',
      ['OWNER', 'SELLER']),
  StoreNavItem('/workspace/stock', Icons.warehouse_outlined, 'Stock',
      ['OWNER']),
  // Visible au Vendeur seulement si le Owner l'a autorisé à
  // annuler/retourner — filtre appliqué dans navForRole ci-dessous, cf.
  // frontend/src/routes/navigation.js#getNavForRole.
  StoreNavItem('/workspace/sales', Icons.receipt_long_outlined,
      'Historique des ventes', ['OWNER', 'SELLER']),
  // Visible à toute l'équipe (§ décidé en conversation) — le backend
  // scope déjà les données à SES PROPRES ventes pour un Vendeur, même
  // règle que le Tableau de bord (dashboard.service.js#getSalesReport).
  StoreNavItem('/workspace/reports/sales', Icons.trending_up,
      'Recette', ['OWNER', 'SELLER']),
  StoreNavItem('/workspace/customers', Icons.people_outline, 'Clients',
      ['OWNER', 'SELLER']),
  // Carnet partagé — ouvert à toute l'équipe, contrairement à la plupart
  // des autres écrans (§19_notes_boutique.sql, décidé en conversation).
  StoreNavItem('/workspace/notes', Icons.notes_outlined, 'Notes',
      ['OWNER', 'SELLER']),
  StoreNavItem('/workspace/suppliers', Icons.local_shipping_outlined,
      'Fournisseurs', ['OWNER']),
  StoreNavItem('/workspace/purchases', Icons.shopping_bag_outlined, 'Achats', ['OWNER']),
  StoreNavItem('/workspace/employees', Icons.badge_outlined, 'Équipe', ['OWNER']),
  StoreNavItem('/workspace/settings', Icons.settings_outlined, 'Paramètres', ['OWNER']),
  StoreNavItem('/workspace/contact', Icons.help_outline, 'Contactez-nous',
      ['OWNER', 'SELLER']),
];

/// Miroir de frontend/src/routes/navigation.js#getNavForRole.
List<StoreNavItem> navForRole(
  String? roleCode, {
  bool canVoidReturn = false,
  bool canAddProduct = false,
}) {
  if (roleCode == null) return const [];
  return kStoreNavItems.where((item) {
    if (!item.roles.contains(roleCode)) return false;
    if (item.path == '/workspace/sales' && roleCode == 'SELLER') return canVoidReturn;
    if (item.path == '/workspace/products' && roleCode == 'SELLER') return canAddProduct;
    return true;
  }).toList();
}
