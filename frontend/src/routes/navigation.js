import {
  Boxes,
  LayoutDashboard,
  MessageCircleQuestion,
  NotebookText,
  Package,
  Receipt,
  ScrollText,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UserSquare2,
  Users,
  Wallet,
} from 'lucide-react';

/**
 * Définition centralisée de la navigation, filtrée par rôle.
 *
 * Rappel critique (cahier des charges §8.1) : ce filtrage côté client
 * améliore seulement l'expérience utilisateur. Il ne constitue JAMAIS
 * la barrière de sécurité réelle — chaque route de l'API revérifie
 * indépendamment le rôle et les permissions fines côté serveur.
 */
// Pas de rôle MANAGER (décidé en conversation, contexte guinéen) — deux
// rôles seulement dans une boutique : OWNER et SELLER.
export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard', icon: LayoutDashboard, roles: ['OWNER', 'SELLER'] },
  { key: 'pos', label: 'Caisse / Vente', path: '/pos', icon: ShoppingCart, roles: ['OWNER', 'SELLER'] },
  // Owner ET Vendeur (§30_fond_de_caisse.sql, décidé en conversation) —
  // c'est le Vendeur qui ouvre/ferme sa propre caisse ; le Owner voit en
  // plus l'historique de toute l'équipe (scoping fait côté serveur).
  { key: 'cash-drawers', label: 'Historique des caisses', path: '/cash-drawers', icon: Wallet, roles: ['OWNER', 'SELLER'] },
  { key: 'products', label: 'Produits', path: '/products', icon: Package, roles: ['OWNER'] },
  { key: 'stock', label: 'Stock', path: '/stock', icon: Boxes, roles: ['OWNER'] },
  // Visible au Vendeur uniquement si le Owner l'a autorisé à
  // annuler/retourner ses propres ventes (§25_autorisation_annulation_retour.sql,
  // décidé en conversation) — voir getNavForRole ci-dessous.
  { key: 'sales', label: 'Historique des ventes', path: '/sales', icon: Receipt, roles: ['OWNER', 'SELLER'] },
  { key: 'customers', label: 'Clients', path: '/customers', icon: Users, roles: ['OWNER', 'SELLER'] },
  { key: 'notes', label: 'Notes', path: '/notes', icon: NotebookText, roles: ['OWNER', 'SELLER'] },
  { key: 'suppliers', label: 'Fournisseurs', path: '/suppliers', icon: Truck, roles: ['OWNER'] },
  // Toujours visible à l'Owner (même logique que Fournisseurs) — seule la
  // création d'un fournisseur/commande à l'intérieur exige le plan PREMIUM
  // (§28_commandes_achat_premium.sql, décidé en conversation), pas la page
  // elle-même : un upsell s'affiche dans la page si le plan ne le permet pas.
  { key: 'purchases', label: 'Achats', path: '/purchases', icon: ShoppingBag, roles: ['OWNER'] },
  { key: 'employees', label: 'Équipe', path: '/employees', icon: UserSquare2, roles: ['OWNER'] },
  { key: 'audit-log', label: "Journal d'activité", path: '/audit-log', icon: ScrollText, roles: ['OWNER'] },
  { key: 'settings', label: 'Paramètres', path: '/settings', icon: Settings, roles: ['OWNER'] },
  { key: 'contact', label: 'Contactez-nous', path: '/contact', icon: MessageCircleQuestion, roles: ['OWNER', 'SELLER'] },
];

export function getNavForRole(roleCode, canVoidReturn = false) {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(roleCode)) return false;
    if (item.key === 'sales' && roleCode === 'SELLER') return canVoidReturn;
    return true;
  });
}