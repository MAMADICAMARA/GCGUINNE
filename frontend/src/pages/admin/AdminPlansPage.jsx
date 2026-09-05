import { useEffect, useState } from 'react';
import { Calendar, Check, CreditCard, X } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Plans d'abonnement (§20_plans_abonnement.sql) — éditables par le Super
 * Admin : prix et plafonds ne sont plus figés en dur dans les migrations.
 */
export default function AdminPlansPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingPlan, setEditingPlan] = useState(null);
  const [activatingPlan, setActivatingPlan] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  async function loadPlans() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/plans');
      setPlans(data.plans);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les plans.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPlans();
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <CreditCard size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Plans d'abonnement</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Offres commerciales disponibles .
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">
                {plan.name}
              </p>
              <p className="text-2xl font-semibold text-slate-800 mb-3">
                {plan.price === 0 ? 'Gratuit' : `${plan.price.toLocaleString('fr-FR')} GNF`}
              </p>
              <ul className="text-sm text-slate-600 space-y-1.5 mb-4">
                <li>{plan.maxUsersPerStore} utilisateur(s) / boutique</li>
                <li>{plan.maxProductsPerStore} produit(s) actif(s) / boutique</li>
                <li
                  className={`flex items-center gap-1.5 ${
                    plan.allowsSupervision ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {plan.allowsSupervision ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <X size={14} className="text-slate-300" />
                  )}
                  Superviser d'autres boutiques
                </li>
                <li
                  className={`flex items-center gap-1.5 ${
                    plan.allowsSuppliers ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {plan.allowsSuppliers ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <X size={14} className="text-slate-300" />
                  )}
                  Fournisseurs
                </li>
                <li
                  className={`flex items-center gap-1.5 ${
                    plan.allowsPurchaseOrders ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {plan.allowsPurchaseOrders ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <X size={14} className="text-slate-300" />
                  )}
                  Commandes d'achat
                </li>
                <li
                  className={`flex items-center gap-1.5 ${
                    plan.allowsMarketplace ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {plan.allowsMarketplace ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <X size={14} className="text-slate-300" />
                  )}
                  Visible sur MARCHÉ
                </li>
                <li
                  className={`flex items-center gap-1.5 ${
                    plan.allowsStockTransfer ? 'text-slate-500' : 'text-slate-300'
                  }`}
                >
                  {plan.allowsStockTransfer ? (
                    <Check size={14} className="text-green-600" />
                  ) : (
                    <X size={14} className="text-slate-300" />
                  )}
                  Transfert de stock entre boutiques
                </li>
              </ul>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setEditingPlan(plan)}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600"
                >
                  Modifier
                </button>
                {plan.price > 0 && (
                  <button
                    onClick={() => setActivatingPlan(plan)}
                    className="text-xs font-medium text-amber-600 hover:text-amber-700"
                  >
                    Activer pour toutes les boutiques en gratuit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingPlan && (
        <PlanEditorModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSaved={() => {
            setEditingPlan(null);
            loadPlans();
          }}
        />
      )}

      {activatingPlan && (
        <BulkActivateModal
          plan={activatingPlan}
          freePlanName={plans.find((p) => p.price === 0)?.name || 'gratuit'}
          onClose={() => setActivatingPlan(null)}
          onActivated={(result) => {
            setActivatingPlan(null);
            setSuccessMessage(
              `Plan ${result.planName} activé pour ${result.affectedStores} boutique(s) — jusqu'au ${new Date(result.expiresAt).toLocaleDateString('fr-FR')}.`
            );
            setTimeout(() => setSuccessMessage(''), 8000);
          }}
        />
      )}
    </div>
  );
}

// Une ligne vide sert de saisie vierge — filtrée avant l'envoi si
// l'utilisateur ne la remplit pas (même convention que ProductForm.jsx).
const emptyDurationTier = { minMonths: '', unitPrice: '' };

function PlanEditorModal({ plan, onClose, onSaved }) {
  const [name, setName] = useState(plan.name);
  const [price, setPrice] = useState(String(plan.price));
  const [maxUsersPerStore, setMaxUsersPerStore] = useState(String(plan.maxUsersPerStore));
  const [maxProductsPerStore, setMaxProductsPerStore] = useState(String(plan.maxProductsPerStore));
  const [allowsSupervision, setAllowsSupervision] = useState(plan.allowsSupervision);
  const [allowsSuppliers, setAllowsSuppliers] = useState(plan.allowsSuppliers);
  const [allowsPurchaseOrders, setAllowsPurchaseOrders] = useState(plan.allowsPurchaseOrders);
  const [allowsMarketplace, setAllowsMarketplace] = useState(plan.allowsMarketplace);
  const [allowsStockTransfer, setAllowsStockTransfer] = useState(plan.allowsStockTransfer);
  // Paliers de durée (§51_paliers_duree_abonnement.sql, décidé en
  // conversation) — miroir exact des paliers de prix produit
  // (ProductForm.jsx), appliqués à la durée d'abonnement.
  const [durationTiersList, setDurationTiersList] = useState(() =>
    Array.isArray(plan.durationTiers) && plan.durationTiers.length > 0
      ? plan.durationTiers.map((t) => ({ minMonths: String(t.minMonths), unitPrice: String(t.unitPrice) }))
      : []
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateDurationTier(index, field, value) {
    setDurationTiersList((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  }

  function addDurationTierRow() {
    setDurationTiersList((prev) => [...prev, { ...emptyDurationTier }]);
  }

  function removeDurationTierRow(index) {
    setDurationTiersList((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // Même convention que ProductForm.jsx : une ligne dont un des deux
    // champs est vide n'est pas envoyée — le serveur reste de toute façon
    // l'autorité finale sur la validation.
    const durationTiers = durationTiersList
      .filter((t) => t.minMonths.trim() !== '' && t.unitPrice.trim() !== '')
      .map((t) => ({ minMonths: parseInt(t.minMonths, 10), unitPrice: parseFloat(t.unitPrice) }));

    try {
      await apiClient.put(`/admin/plans/${plan.id}`, {
        name: name.trim(),
        price: Number(price),
        maxUsersPerStore: Number(maxUsersPerStore),
        maxProductsPerStore: Number(maxProductsPerStore),
        allowsSupervision,
        allowsSuppliers,
        allowsPurchaseOrders,
        allowsMarketplace,
        allowsStockTransfer,
        durationTiers,
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Modifier le plan</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">Prix (GNF)</label>
          <input
            required
            type="number"
            min="0"
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">
            Utilisateurs / boutique
          </label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={maxUsersPerStore}
            onChange={(e) => setMaxUsersPerStore(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">
            Produits actifs / boutique
          </label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={maxProductsPerStore}
            onChange={(e) => setMaxProductsPerStore(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Calendar size={14} />
                </div>
                <label className="text-sm font-medium text-slate-700">Paliers de durée (optionnel)</label>
              </div>
              <button
                type="button"
                onClick={addDurationTierRow}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                + Ajouter un palier
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Ex : à partir de 6 mois, 80 000 GNF/mois au lieu du tarif normal — incite un client à payer
              plusieurs mois d'avance. Le prix baisse à chaque palier, jamais le contraire.
            </p>
            <div className="space-y-3">
              {durationTiersList.map((tier, index) => {
                const basePrice = Number(price) || 0;
                const monthsNum = parseInt(tier.minMonths, 10);
                const unitPriceNum = parseFloat(tier.unitPrice);
                const hasPreview =
                  Number.isInteger(monthsNum) && monthsNum > 1 && !Number.isNaN(unitPriceNum) && unitPriceNum >= 0;
                const totalPrice = hasPreview ? monthsNum * unitPriceNum : 0;
                const savingsPercent =
                  hasPreview && basePrice > 0 ? Math.round((1 - unitPriceNum / basePrice) * 100) : null;

                return (
                  <div key={index} className="rounded-lg bg-white border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 whitespace-nowrap">À partir de</span>
                      <input
                        type="number"
                        min="2"
                        step="1"
                        value={tier.minMonths}
                        onChange={(e) => updateDurationTier(index, 'minMonths', e.target.value)}
                        placeholder="6"
                        className="w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">mois →</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={tier.unitPrice}
                        onChange={(e) => updateDurationTier(index, 'unitPrice', e.target.value)}
                        placeholder="80000"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      <span className="text-xs text-slate-400 whitespace-nowrap">GNF/mois</span>
                      <button
                        type="button"
                        onClick={() => removeDurationTierRow(index)}
                        className="text-slate-300 hover:text-red-500 px-1"
                        aria-label="Retirer ce palier"
                      >
                        ×
                      </button>
                    </div>
                    {hasPreview && (
                      <p className="text-xs text-slate-500 mt-2 pl-1">
                        → Un client qui choisit ce palier paiera{' '}
                        <span className="font-semibold text-slate-700">{formatGNF(totalPrice)}</span> au total
                        {savingsPercent !== null && savingsPercent > 0 && (
                          <>
                            {' '}
                            , soit{' '}
                            <span className="font-semibold text-emerald-600">-{savingsPercent}%</span> vs. tarif
                            normal
                          </>
                        )}
                        .
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allowsSupervision}
                onChange={(e) => setAllowsSupervision(e.target.checked)}
              />
              Autorise "Superviser" d'autres boutiques
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allowsSuppliers}
                onChange={(e) => setAllowsSuppliers(e.target.checked)}
              />
              Autorise "Fournisseurs"
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allowsPurchaseOrders}
                onChange={(e) => setAllowsPurchaseOrders(e.target.checked)}
              />
              Autorise "Commandes d'achat" (avantage PREMIUM)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allowsMarketplace}
                onChange={(e) => setAllowsMarketplace(e.target.checked)}
              />
              Visible sur MARCHÉ (catalogue public)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allowsStockTransfer}
                onChange={(e) => setAllowsStockTransfer(e.target.checked)}
              />
              Autorise le transfert de stock entre boutiques
            </label>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Activation en masse d'un plan payant pour toutes les boutiques
 * actuellement en plan gratuit (§ décidé en conversation) — n'affecte
 * jamais une boutique ayant déjà un abonnement payant en cours (vérifié
 * côté backend). Action à large impact potentiel (toute la plateforme en
 * un clic) : confirmation explicite exigée en plus du formulaire, comme
 * les autres actions irréversibles de l'espace Super Admin.
 */
function BulkActivateModal({ plan, freePlanName, onClose, onActivated }) {
  const [days, setDays] = useState('30');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (
      !window.confirm(
        `Activer le plan ${plan.name} pour TOUTES les boutiques actuellement en ${freePlanName} sur la plateforme, pour ${days} jour(s) ? Cette action est irréversible depuis cet écran (une désactivation reste possible boutique par boutique).`
      )
    ) {
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/admin/plans/${plan.id}/activate-freemium-stores`, {
        days: Number(days),
      });
      onActivated(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Activation impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Activer {plan.name} pour toutes les boutiques en {freePlanName}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          <p className="text-sm text-slate-500 mb-4">
            Concerne uniquement les boutiques sans abonnement payant en cours ({freePlanName}, ou plan
            payant expiré) — jamais une boutique qui a déjà un abonnement payant en cours.
          </p>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-slate-600 mb-1">Durée (jours)</label>
          <input
            required
            type="number"
            min="1"
            step="1"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-amber-600 text-white text-sm font-medium px-4 py-2 hover:bg-amber-700 transition disabled:opacity-60"
          >
            {submitting ? 'Activation...' : `Activer pour tous les ${freePlanName}`}
          </button>
        </div>
      </form>
    </div>
  );
}
