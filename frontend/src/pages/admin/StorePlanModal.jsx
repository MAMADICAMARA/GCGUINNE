import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';

/**
 * Gestion manuelle de l'abonnement d'une boutique par le Super Admin
 * (§20_plans_abonnement.sql) — activer un plan payant avec une date
 * d'expiration, la repousser (renouveler), ou revenir en FREEMIUM
 * (désactiver). Aucun paiement automatisé : chaque action est une
 * décision manuelle, journalisée côté serveur.
 */
export default function StorePlanModal({ store, onClose, onChanged }) {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isFreemium = !store.planName || store.planName === 'FREEMIUM';

  useEffect(() => {
    (async () => {
      const { data } = await apiClient.get('/admin/plans');
      const paidPlans = data.plans.filter((p) => p.name !== 'FREEMIUM');
      setPlans(paidPlans);
      if (paidPlans.length > 0) setSelectedPlanId(String(paidPlans[0].id));
    })();
  }, []);

  function defaultExpiryDate() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  }

  async function handleActivate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/stores/${store.id}/plan/activate`, {
        planId: Number(selectedPlanId),
        expiresAt: new Date(expiresAt || defaultExpiryDate()).toISOString(),
      });
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Activation impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRenew(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/stores/${store.id}/plan/renew`, {
        expiresAt: new Date(expiresAt || defaultExpiryDate()).toISOString(),
      });
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Renouvellement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!window.confirm(`Repasser "${store.name}" en FREEMIUM ?`)) return;
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post(`/admin/stores/${store.id}/plan/deactivate`);
      onChanged();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Désactivation impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">Abonnement — {store.name}</h2>
            <p className="text-xs text-slate-400">
              Plan actuel : {store.planName || 'FREEMIUM'}
              {store.planExpiresAt && ` (expire le ${formatDateTime(store.planExpiresAt)})`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <form onSubmit={isFreemium ? handleActivate : handleRenew}>
            {isFreemium && (
              <>
                <label className="block text-sm font-medium text-slate-600 mb-1">Nouveau plan</label>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {p.price.toLocaleString('fr-FR')} GNF
                    </option>
                  ))}
                </select>
              </>
            )}

            <label className="block text-sm font-medium text-slate-600 mb-1">
              {isFreemium ? "Expire le" : "Nouvelle date d'expiration"}
            </label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              placeholder={defaultExpiryDate()}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mb-4">
              Laissez vide pour utiliser +30 jours à partir d'aujourd'hui.
            </p>

            <div className="flex items-center justify-between">
              <button
                type="submit"
                disabled={submitting || (isFreemium && plans.length === 0)}
                className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
              >
                {submitting ? 'Enregistrement...' : isFreemium ? 'Activer' : 'Renouveler'}
              </button>

              {!isFreemium && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={submitting}
                  className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
                >
                  Désactiver (retour FREEMIUM)
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
