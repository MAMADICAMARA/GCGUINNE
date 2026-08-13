import { useEffect, useState } from 'react';
import { ShoppingBag, Store, Package, CheckCircle2 } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Interrupteur plateforme MARCHÉ (§4/§38_marketplace.sql) — désactivé par
 * défaut, aucun changement de comportement tant qu'il n'est pas activé
 * manuellement (§ décidé en conversation : jamais d'activation automatique,
 * même quand des boutiques deviennent éligibles). Les compteurs
 * d'éligibilité aident le Super Admin à juger "quand il y a assez de
 * boutiques PROFESSIONNEL" avant d'activer — ils sont affichés qu'importe
 * l'état de l'interrupteur, pour permettre de décider avant d'activer.
 */
export default function AdminMarketplacePage() {
  const [enabled, setEnabled] = useState(false);
  const [readiness, setReadiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, readinessRes] = await Promise.all([
        apiClient.get('/admin/platform-settings'),
        apiClient.get('/admin/marketplace-readiness'),
      ]);
      setEnabled(settingsRes.data.marketplaceEnabled);
      setReadiness(readinessRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les réglages.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleToggle() {
    const next = !enabled;
    setSaving(true);
    setError('');
    try {
      const { data } = await apiClient.put('/admin/platform-settings', { marketplaceEnabled: next });
      setEnabled(data.marketplaceEnabled);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <ShoppingBag size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">MARCHÉ</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Catalogue public réunissant les produits des boutiques en plan PROFESSIONNEL.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="space-y-4 max-w-xl">
          <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-800">Activer MARCHÉ sur la plateforme</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {enabled
                  ? 'Le catalogue est visible publiquement, sans connexion requise.'
                  : "Éteint : la page d'accueil et le comportement actuels sont inchangés."}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggle}
              disabled={saving}
              role="switch"
              aria-checked={enabled}
              className={`shrink-0 relative inline-flex h-7 w-12 items-center rounded-full transition-colors disabled:opacity-60 ${
                enabled ? 'bg-brand-500' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {enabled && (
            <div className="flex items-center gap-2 text-sm text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-4 py-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              MARCHÉ est actif et visible par tous les visiteurs.
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
              Éligibilité actuelle
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Store size={17} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-800">{readiness?.eligibleStores ?? 0}</p>
                  <p className="text-xs text-slate-500">Boutique(s) éligible(s)</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                  <Package size={17} />
                </div>
                <div>
                  <p className="text-lg font-semibold text-slate-800">{readiness?.eligibleProducts ?? 0}</p>
                  <p className="text-xs text-slate-500">Produit(s) affichable(s)</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4">
              Une boutique devient éligible avec un plan autorisant MARCHÉ (voir Plans d'abonnement),
              actif et non expiré.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
