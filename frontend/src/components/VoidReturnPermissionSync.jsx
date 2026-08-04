import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Ne rend rien — peuple juste `authStore.canVoidReturn` une fois au montage
 * de DashboardLayout (§25_autorisation_annulation_retour.sql, décidé en
 * conversation), même précédent que PlanStatusBanner pour planBanner.
 * Seul un Vendeur a besoin de cette information (l'Owner peut toujours
 * annuler/retourner, sans avoir à interroger le réglage) — évite un appel
 * réseau inutile à chaque connexion Owner.
 */
export default function VoidReturnPermissionSync({ roleCode }) {
  const setCanVoidReturn = useAuthStore((s) => s.setCanVoidReturn);

  useEffect(() => {
    if (roleCode !== 'SELLER') return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/my-void-return-permission');
        if (!cancelled) setCanVoidReturn(Boolean(data.allowed));
      } catch {
        // Silencieux, même logique que PlanStatusBanner : ne doit jamais
        // bloquer le reste de la page — par défaut canVoidReturn reste false.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleCode]);

  return null;
}
