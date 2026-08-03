import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Garde de route "compte" : exige uniquement une session valide, PAS de
 * boutique active. Protège l'espace /account/* (Accueil, Profil,
 * Paramètres, Ma Boutique) — un compte sans boutique doit pouvoir y
 * accéder normalement (§4.1 du cahier des charges).
 *
 * Un Super Admin n'y a PAS accès : décidé en conversation, il ne doit
 * voir que l'espace Super Admin (cf. §17_transfert_et_promotion.sql, qui
 * garantit côté backend qu'un Super Admin ne possède ni ne rejoint jamais
 * aucune boutique — cette redirection n'est qu'un confort de navigation
 * cohérent avec cette réalité, pas une barrière de sécurité en soi).
 */
export default function ProtectedRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (user?.isSuperAdmin) return <Navigate to="/admin" replace />;
  return <Outlet />;
}