import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Bandeau d'alerte "boutique en mode gratuit" (§20_plans_abonnement.sql,
 * décidé en conversation) — ne s'affiche que si la boutique est
 * effectivement en FREEMIUM ET qu'elle a au moins un employé
 * (Vendeur), calculé côté serveur (GET /stores/plan-banner,
 * accessible à toute l'équipe). Message différent selon le rôle courant :
 * l'Owner voit qu'il doit agir, le reste de l'équipe comprend juste
 * pourquoi elle ne peut plus écrire.
 *
 * Peuple aussi `authStore.planBanner` (une seule requête par session
 * boutique, au montage de DashboardLayout) — consommé ailleurs par
 * `useIsPlanFrozen()` pour désactiver proprement les actions d'écriture
 * côté employé plutôt que chaque page ne refasse cet appel.
 */
export default function PlanStatusBanner({ roleCode }) {
  const navigate = useNavigate();
  const banner = useAuthStore((s) => s.planBanner);
  const setPlanBanner = useAuthStore((s) => s.setPlanBanner);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/plan-banner');
        if (!cancelled) setPlanBanner(data);
      } catch {
        // Silencieux : un bandeau qui ne charge pas ne doit jamais bloquer
        // le reste de la page.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!banner?.show) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {roleCode === 'OWNER' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Votre abonnement est en {banner.planName} — votre équipe est actuellement en lecture seule.
          </span>
          <button
            onClick={() => navigate('/settings/plans')}
            className="shrink-0 rounded-lg bg-amber-500 text-white text-xs font-semibold px-3 py-1.5 hover:bg-amber-600 transition"
          >
            Passer au plan supérieur
          </button>
        </div>
      ) : (
        <>Cette boutique fonctionne actuellement en mode gratuit — contactez votre responsable.</>
      )}
    </div>
  );
}
