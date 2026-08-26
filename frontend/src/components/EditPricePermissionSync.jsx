import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Ne rend rien — peuple juste `authStore.canEditPrice` une fois au montage
 * de DashboardLayout (§39_prix_editable_vente.sql, décidé en conversation),
 * même précédent exact que VoidReturnPermissionSync. Seul un Vendeur a
 * besoin de cette information (l'Owner peut toujours modifier le prix,
 * sans avoir à interroger le réglage).
 */
export default function EditPricePermissionSync({ roleCode }) {
  const setCanEditPrice = useAuthStore((s) => s.setCanEditPrice);

  useEffect(() => {
    if (roleCode !== 'SELLER') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/my-edit-price-permission');
        if (!cancelled) setCanEditPrice(Boolean(data.allowed));
      } catch {
        // Silencieux, même logique que VoidReturnPermissionSync : ne doit
        // jamais bloquer le reste de la page — par défaut canEditPrice
        // reste false.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  return null;
}
