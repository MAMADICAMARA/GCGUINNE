import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

const DEFAULTS = {
  headerMessage: '',
  footerMessage: 'Merci de votre visite !',
  showAddress: false,
  showPhone: false,
  showSellerName: false,
};

/**
 * Construit un aperçu texte fidèle au vrai reçu (même gabarit que
 * orders.service.js#generateReceipt côté backend) — avec des données
 * d'exemple (produit, vendeur), mais les vraies coordonnées de la
 * boutique. Décidé en conversation : un formulaire structuré avec aperçu
 * en direct, pas un éditeur libre type traitement de texte — l'aperçu
 * existe pour que le Owner voie exactement ce qu'il obtient sans avoir à
 * enregistrer une vente réelle pour vérifier.
 */
function buildPreview(form, store) {
  const lines = ['═══════════════════════════════'];
  if (store?.name) lines.push(store.name);
  if (form.showAddress && store?.address) lines.push(store.address);
  if (form.showPhone && store?.phone) lines.push(store.phone);
  if (form.headerMessage) lines.push(form.headerMessage);
  lines.push('═══════════════════════════════', 'REÇU DE VENTE', '═══════════════════════════════', '');
  lines.push('Commande: ORD-2026-000123');
  lines.push('Date: 03/08/2026 15:00:00');
  if (form.showSellerName) lines.push('Vendeur: nom complet');
  lines.push('', '───────────────────────────────', 'ARTICLES', '───────────────────────────────');
  lines.push('Produit exemple');
  lines.push(`  2 x ${formatGNF(5000)} = ${formatGNF(10000)}`);
  lines.push('───────────────────────────────');
  lines.push(`Sous-total:        ${formatGNF(10000)}`);
  lines.push(`Réduction:        -${formatGNF(0)}`);
  lines.push(`Taxes:            +${formatGNF(0)}`);
  lines.push('═══════════════════════════════');
  lines.push(`TOTAL:             ${formatGNF(10000)}`);
  lines.push('═══════════════════════════════');
  lines.push('Paiement:          TOTAL');
  lines.push('───────────────────────────────', '');
  lines.push(form.footerMessage || 'Merci de votre visite !');
  return lines.join('\n');
}

export default function ReceiptSettingsSection() {
  const [store, setStore] = useState(null);
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
        const { data } = await apiClient.get('/stores/receipt-settings');
        const { store: storeInfo, ...settings } = data;
        setStore(storeInfo);
        setForm({ ...DEFAULTS, ...settings });
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les réglages du reçu.');
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
      const { data } = await apiClient.put('/stores/receipt-settings', form);
      setForm({ ...DEFAULTS, ...data });
      setSuccess('Réglages du reçu enregistrés.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Personnaliser le reçu</h2>
      <p className="text-xs text-slate-500 mb-3">
        Message d'en-tête/pied de page et informations affichées sur le reçu remis après une
        vente — l'aperçu ci-dessous se met à jour pendant que vous modifiez les réglages.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">{error}</p>}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Message d'en-tête (optionnel)
              </label>
              <input
                value={form.headerMessage}
                onChange={update('headerMessage')}
                maxLength={200}
                placeholder="Ex : Bienvenue chez nous !"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Message de pied de page
              </label>
              <input
                value={form.footerMessage}
                onChange={update('footerMessage')}
                maxLength={200}
                placeholder="Merci de votre visite !"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.showAddress} onChange={update('showAddress')} />
                Afficher l'adresse de la boutique
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.showPhone} onChange={update('showPhone')} />
                Afficher le numéro de téléphone
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={form.showSellerName} onChange={update('showSellerName')} />
                Afficher le nom du vendeur
              </label>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Aperçu</p>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-slate-700 border border-slate-200">
              {buildPreview(form, store)}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
