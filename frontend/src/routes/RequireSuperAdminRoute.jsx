import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

/**
 * Garde de route "Super Admin" : exige une session valide ET
 * user.isSuperAdmin === true. Protège /admin/*.
 *
 * Rappel : ce filtrage est un confort de navigation, jamais la barrière de
 * sécurité réelle — chaque route /api/v1/admin/* revérifie indépendamment
 * isSuperAdmin côté serveur (middleware requireSuperAdmin).
 */
export default function RequireSuperAdminRoute() {
  const { token, user } = useAuthStore();
  if (!token) return <Navigate to="/login" replace />;
  if (!user?.isSuperAdmin) return <Navigate to="/account" replace />;
  return <Outlet />;
}