import { formatDate } from '@/utils/format';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Pastille de statut d'abonnement (§ décidé en conversation, "payer
 * l'abonnement depuis Superviser") — réutilisée par SupervisePage.jsx et
 * SupervisedStoreDetailPage.jsx (DRY, même esprit que StatCard/AuditLogTable
 * déjà partagés ailleurs). `supervisionAllowed` prime sur tout le reste :
 * c'est la donnée qui bloque réellement l'accès, jamais recalculée ici à
 * partir de la seule date (une boutique peut être bloquée pour d'autres
 * raisons que l'expiration).
 */
export default function PlanStatusBadge({ supervisionAllowed, planExpiresAt }) {
  if (supervisionAllowed === false) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-1">
        Accès bloqué — abonnement expiré
      </span>
    );
  }

  if (!planExpiresAt) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1">
        Gratuit
      </span>
    );
  }

  const expiresSoon = new Date(planExpiresAt).getTime() - Date.now() < SEVEN_DAYS_MS;
  if (expiresSoon) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1">
        Expire bientôt — {formatDate(planExpiresAt)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1">
      Actif jusqu'au {formatDate(planExpiresAt)}
    </span>
  );
}
