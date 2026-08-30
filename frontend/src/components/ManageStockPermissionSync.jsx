import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Ne rend rien — peuple juste `authStore.canManageStock` une fois au
 * montage de DashboardLayout (§43_autorisation_stock_fournisseurs_achats.sql,
 * décidé en conversation), même précédent exact que VoidReturnPermissionSync.
 * Seul un Vendeur a besoin de cette information (l'Owner peut toujours
 * ajuster le stock, sans avoir à interroger le réglage).
 */
export default function ManageStockPermissionSync({ roleCode }) {
  const setCanManageStock = useAuthStore((s) => s.setCanManageStock);

  useEffect(() => {
    if (roleCode !== 'SELLER') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/my-stock-permission');
        if (!cancelled) setCanManageStock(Boolean(data.allowed));
      } catch {
        // Silencieux, même logique que PlanStatusBanner : ne doit jamais
        // bloquer le reste de la page — par défaut canManageStock reste false.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  return null;
}
