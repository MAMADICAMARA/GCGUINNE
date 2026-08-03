/**
 * Navigation de l'espace COMPTE — distincte de la navigation "boutique"
 * (routes/navigation.js). Ces 4 entrées sont toujours visibles, qu'une
 * boutique soit active ou non : c'est précisément le point de la
 * séparation compte/boutique (§4.1 vs §4.2 du cahier des charges).
 */
export const ACCOUNT_NAV_ITEMS = [
  { key: 'home', label: 'Accueil', path: '/account' },
  { key: 'my-store', label: 'Ma Boutique', path: '/account/store' },
  { key: 'supervise', label: 'Superviser', path: '/account/supervise' },
  { key: 'profile', label: 'Profil', path: '/account/profile' },
  { key: 'settings', label: 'Paramètres', path: '/account/settings' },
];