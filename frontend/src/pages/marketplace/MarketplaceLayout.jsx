import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import AccountLayout from '@/layouts/AccountLayout';

/**
 * Habillage de MARCHÉ (§ décidé en conversation) — MARCHÉ doit rester
 * atteignable sans connexion (jamais derrière ProtectedRoute, qui
 * redirigerait un visiteur anonyme vers /login), mais un utilisateur
 * DÉJÀ connecté qui y navigue ne doit ni perdre le volet latéral/menu
 * (desktop/mobile) du reste de l'application, ni revoir la page MARCHÉ
 * publique (/marche) : elle est strictement redondante avec l'Accueil
 * (/account), qui affiche déjà le même catalogue (MarketplaceGrid) avec
 * la vraie navigation. Un connecté qui atterrit sur /marche (bouton
 * précédent du navigateur, ancien lien) est donc renvoyé vers /account.
 *
 * La fiche produit (/marche/produits/:id) n'a pas d'équivalent dans
 * /account — elle reste atteignable pour un connecté, habillée du même
 * volet de navigation via AccountLayout ci-dessous ; c'est
 * MarketplaceProductPage qui se charge de ne plus jamais renvoyer un
 * connecté vers /marche via son bouton retour.
 */
export default function MarketplaceLayout() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.token));
  const location = useLocation();

  if (isAuthenticated) {
    if (location.pathname === '/marche') {
      return <Navigate to="/account" replace />;
    }
    return <AccountLayout />;
  }

  return <Outlet />;
}

// import { Outlet } from 'react-router-dom';
// import { useAuthStore } from '@/store/authStore';
// import AccountLayout from '@/layouts/AccountLayout';

// /**
//  * Habillage de MARCHÉ (§ décidé en conversation, "le menu de navigation
//  * disparaît, je ne peux plus naviguer vers une autre page") — MARCHÉ doit
//  * rester atteignable sans connexion (jamais derrière ProtectedRoute, qui
//  * redirigerait un visiteur anonyme vers /login), mais un utilisateur DÉJÀ
//  * connecté qui y navigue ne doit jamais perdre le volet latéral (desktop)
//  * / menu hamburger (mobile) du reste de l'application — sans ça, il se
//  * retrouve "coincé" sur une page sans aucun moyen d'en sortir autrement
//  * qu'avec le bouton précédent du navigateur.
//  *
//  * Réutilise LITTÉRALEMENT AccountLayout (même navigation que le reste de
//  * l'espace "compte") plutôt que d'en construire un second — un visiteur
//  * connecté qui arrive sur MARCHÉ est, par définition, dans son espace
//  * compte, pas dans une zone à part.
//  */
// export default function MarketplaceLayout() {
//   const isAuthenticated = useAuthStore((s) => Boolean(s.token));
//   if (isAuthenticated) {
//     return <AccountLayout />;
//   }
//   return <Outlet />;
// }
