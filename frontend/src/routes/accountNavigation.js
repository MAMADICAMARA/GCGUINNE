import { Eye, Home, Settings, Store, UserCircle } from 'lucide-react';

/**
 * Navigation de l'espace COMPTE — distincte de la navigation "boutique"
 * (routes/navigation.js). Toujours visibles, qu'une boutique soit active
 * ou non : c'est précisément le point de la séparation compte/boutique
 * (§4.1 vs §4.2 du cahier des charges).
 *
 * "Superviser" n'est plus réservé aux Owner (décidé en conversation) :
 * l'accès dépend désormais de l'abonnement de CHAQUE boutique surveillée
 * (via un code de partage), jamais du profil de la personne qui regarde —
 * un utilisateur ne possédant aucune boutique peut donc légitimement
 * superviser celles d'autrui (ex : un investisseur). En revanche, un
 * Vendeur employé (rôle SELLER dans une boutique) reste exclu — cette
 * fonctionnalité n'est pas pensée pour le personnel salarié. Le backend
 * (modules/supervision) applique exactement le même critère
 * indépendamment (403 EMPLOYEE_NOT_ALLOWED) ; ce filtrage n'est qu'un
 * confort d'affichage.
 */
export const ACCOUNT_NAV_ITEMS = [
  { key: 'home', label: 'Accueil', path: '/account', icon: Home },
  { key: 'my-store', label: 'Ma Boutique', path: '/account/store', icon: Store },
  { key: 'supervise', label: 'Superviser', path: '/account/supervise', icon: Eye, excludeEmployees: true },
  { key: 'profile', label: 'Profil', path: '/account/profile', icon: UserCircle },
  { key: 'settings', label: 'Paramètres', path: '/account/settings', icon: Settings },
];

/**
 * @param {Array<{roleCode: string}>} stores - boutiques de l'utilisateur (authStore.stores)
 */
export function getAccountNavItems(stores = []) {
  const isEmployeeOnly = stores.length > 0 && !stores.some((s) => s.roleCode === 'OWNER');
  return ACCOUNT_NAV_ITEMS.filter((item) => !item.excludeEmployees || !isEmployeeOnly);
}