import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

const DEFAULTS = {
  defaultTaxPercent: 0,
  legalRccm: '',
  legalNif: '',
  legalTaxRegime: '',
  invoiceNumberingEnabled: false,
  invoicePrefix: 'FACT-',
};

/**
 * Section "Facturation" des Paramètres (§42_facturation_boutique.sql,
 * décidé en conversation) — regroupe taux de taxe par défaut, informations
 * légales et numérotation de facture dédiée dans un même formulaire, même
 * patron que StoreInfoSection/ReceiptSettingsSection.
 */
export default function BillingSettingsSection() {
  const activeStore = useAuthStore((s) => s.activeStore);
  const setActiveStore = useAuthStore((s) => s.setActiveStore);

  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get('/stores/billing-settings');
        setForm({ ...DEFAULTS, ...data });
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les réglages de facturation.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(field) {
    return (e) => {
      const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/stores/billing-settings', form);
      setForm({ ...DEFAULTS, ...data });
      // Reflète immédiatement le nouveau taux dans activeStore (Zustand,
      // persisté) — sans ça, la Caisse continuerait de partir de l'ancien
      // taux jusqu'à la prochaine reconnexion/changement de boutique, même
      // chose que StoreInfoSection pour le nom.
      if (activeStore) {
        setActiveStore({ ...activeStore, defaultTaxPercent: data.defaultTaxPercent });
      }
      setSuccess('Réglages de facturation enregistrés.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-400">Chargement...</p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">{success}</p>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Taxe par défaut</h3>
        <p className="text-xs text-slate-500 mb-3">
          Taux appliqué automatiquement à l'ouverture d'une nouvelle vente en Caisse — toujours
          modifiable au cas par cas pour une vente précise.
        </p>
        <div className="sm:w-56">
          <label className="block text-sm font-medium text-slate-600 mb-1">Taux de taxe par défaut (%)</label>
          <div className="relative">
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.defaultTaxPercent}
              onChange={update('defaultTaxPercent')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Informations légales</h3>
        <p className="text-xs text-slate-500 mb-3">
          Affichées sur la Facture PDF, sous les coordonnées de la boutique.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">RCCM</label>
            <input
              value={form.legalRccm}
              onChange={update('legalRccm')}
              maxLength={60}
              placeholder="Ex : GC-2024-B-1234"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">NIF</label>
            <input
              value={form.legalNif}
              onChange={update('legalNif')}
              maxLength={60}
              placeholder="Ex : 123456789"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Régime fiscal</label>
            <input
              value={form.legalTaxRegime}
              onChange={update('legalTaxRegime')}
              maxLength={60}
              placeholder="Ex : Réel simplifié"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-1">Numérotation de facture</h3>
        <p className="text-xs text-slate-500 mb-3">
          Par défaut, la Facture PDF reprend le numéro de la vente (ex : ORD-2026-000032). Active
          une numérotation dédiée, séquentielle et indépendante, si ta comptabilité en a besoin.
        </p>
        <label className="flex items-center gap-2 text-sm text-slate-600 mb-3">
          <input type="checkbox" checked={form.invoiceNumberingEnabled} onChange={update('invoiceNumberingEnabled')} />
          Activer la numérotation dédiée des factures
        </label>
        {form.invoiceNumberingEnabled && (
          <div className="sm:w-56">
            <label className="block text-sm font-medium text-slate-600 mb-1">Préfixe</label>
            <input
              value={form.invoicePrefix}
              onChange={update('invoicePrefix')}
              maxLength={20}
              placeholder="FACT-"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <p className="text-xs text-slate-400 mt-1">
              Ex : « {form.invoicePrefix || 'FACT-'}000001 », « {form.invoicePrefix || 'FACT-'}000002 »...
            </p>
          </div>
        )}
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
      >
        {saving ? 'Enregistrement...' : 'Enregistrer'}
      </button>
    </form>
  );
}
