// Origine du backend, dérivée de VITE_API_URL (ex: https://api.exemple.com/api/v1
// -> https://api.exemple.com) — c'est CE domaine qu'il faut partager pour un
// produit MARCHÉ, jamais celui du frontend : seul le backend sait générer les
// balises Open Graph pour les robots des réseaux sociaux (le frontend est une
// SPA pure, sans rendu serveur). Voir backend/src/modules/marketplace/
// marketplaceShare.routes.js.
const API_ORIGIN = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1').replace(/\/api\/v1\/?$/, '');

export function getProductShareUrl(productId) {
  return `${API_ORIGIN}/marche/produits/${productId}`;
}
