import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Garde de route "boutique" : exige une session valide ET une boutique
 * active. Protège /dashboard, /pos, /products, /stock, /customers,
 * /employees — tout l'espace opérationnel qui n'a de sens que rattaché à
 * une boutique précise (§4.2 du cahier des charges).
 *
 * Un compte sans boutique (ou qui n'en a pas encore sélectionné une) est
 * renvoyé vers "Ma Boutique" plutôt que bloqué sans explication.
 */
export default function RequireStoreRoute() {
  const { token, activeStore } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!activeStore) return <Navigate to="/account/store" replace />;
  return <Outlet />;
}