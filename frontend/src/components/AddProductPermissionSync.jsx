import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Ne rend rien — peuple juste `authStore.canAddProduct` une fois au
 * montage de DashboardLayout (§40_autorisation_ajout_produit.sql, décidé
 * en conversation), même précédent exact que VoidReturnPermissionSync /
 * EditPricePermissionSync. Seul un Vendeur a besoin de cette information
 * (l'Owner peut toujours créer un produit, sans avoir à interroger le
 * réglage).
 */
export default function AddProductPermissionSync({ roleCode }) {
  const setCanAddProduct = useAuthStore((s) => s.setCanAddProduct);

  useEffect(() => {
    if (roleCode !== 'SELLER') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/my-add-product-permission');
        if (!cancelled) setCanAddProduct(Boolean(data.allowed));
      } catch {
        // Silencieux, même logique que les autres synchros de permission.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  return null;
}
