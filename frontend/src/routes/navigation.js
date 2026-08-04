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
  { key: 'dashboard', label: 'Tableau de bord', path: '/dashboard', roles: ['OWNER', 'SELLER'] },
  { key: 'pos', label: 'Caisse / Vente', path: '/pos', roles: ['OWNER', 'SELLER'] },
  { key: 'products', label: 'Produits', path: '/products', roles: ['OWNER'] },
  { key: 'stock', label: 'Stock', path: '/stock', roles: ['OWNER'] },
  // Visible au Vendeur uniquement si le Owner l'a autorisé à
  // annuler/retourner ses propres ventes (§25_autorisation_annulation_retour.sql,
  // décidé en conversation) — voir getNavForRole ci-dessous.
  { key: 'sales', label: 'Historique des ventes', path: '/sales', roles: ['OWNER', 'SELLER'] },
  { key: 'customers', label: 'Clients', path: '/customers', roles: ['OWNER', 'SELLER'] },
  { key: 'notes', label: 'Notes', path: '/notes', roles: ['OWNER', 'SELLER'] },
  { key: 'suppliers', label: 'Fournisseurs', path: '/suppliers', roles: ['OWNER'] },
  { key: 'employees', label: 'Équipe', path: '/employees', roles: ['OWNER'] },
  { key: 'audit-log', label: "Journal d'activité", path: '/audit-log', roles: ['OWNER'] },
  { key: 'settings', label: 'Paramètres', path: '/settings', roles: ['OWNER'] },
];

export function getNavForRole(roleCode, canVoidReturn = false) {
  return NAV_ITEMS.filter((item) => {
    if (!item.roles.includes(roleCode)) return false;
    if (item.key === 'sales' && roleCode === 'SELLER') return canVoidReturn;
    return true;
  });
}