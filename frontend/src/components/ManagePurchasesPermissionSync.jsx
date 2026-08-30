import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Ne rend rien — peuple juste `authStore.canManagePurchases` une fois au
 * montage de DashboardLayout (§43_autorisation_stock_fournisseurs_achats.sql,
 * décidé en conversation), même précédent exact que VoidReturnPermissionSync.
 */
export default function ManagePurchasesPermissionSync({ roleCode }) {
  const setCanManagePurchases = useAuthStore((s) => s.setCanManagePurchases);

  useEffect(() => {
    if (roleCode !== 'SELLER') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/my-purchases-permission');
        if (!cancelled) setCanManagePurchases(Boolean(data.allowed));
      } catch {
        // Silencieux, même logique que PlanStatusBanner.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  return null;
}
