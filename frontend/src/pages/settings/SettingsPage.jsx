import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import ReceiptSettingsSection from './ReceiptSettingsSection';
import SalesVoidReturnPermissionSection from './SalesVoidReturnPermissionSection';
import SubscriptionSection from './SubscriptionSection';
import StoreLogoSection from './StoreLogoSection';

/**
 * Paramètres de la boutique active (§8 du cahier des charges).
 * Statut de l'abonnement (§20_plans_abonnement.sql, lecture seule — seul le
 * Super Admin active/renouvelle/désactive), code de supervision
 * (§12_supervision.sql, lecture seule sur toute la boutique) et code
 * fournisseur (§18_fournisseurs_inter_boutiques.sql, lecture seule du
 * catalogue produit uniquement — deux codes volontairement distincts, deux
 * niveaux de confiance différents). Le reste (infos boutique, facturation)
 * reste à construire.
 */
export default function SettingsPage() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const [supplierCode, setSupplierCode] = useState('');
  const [supplierCodeLoading, setSupplierCodeLoading] = useState(true);
  const [supplierCodeError, setSupplierCodeError] = useState('');
  const [supplierCodeCopied, setSupplierCodeCopied] = useState(false);
  const [supplierCodeRegenerating, setSupplierCodeRegenerating] = useState(false);

  const [storeType, setStoreType] = useState(null);
  const [storeTypeLoading, setStoreTypeLoading] = useState(true);
  const [storeTypeError, setStoreTypeError] = useState('');
  const [storeTypeSuccess, setStoreTypeSuccess] = useState('');
  const [allStoreTypes, setAllStoreTypes] = useState([]);
  const [selectedStoreTypeId, setSelectedStoreTypeId] = useState('');
  const [savingStoreType, setSavingStoreType] = useState(false);

  async function loadCode() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/stores/supervision-code');
      setCode(data.supervisionCode);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger le code.');
    } finally {
      setLoading(false);
    }
  }

  async function loadSupplierCode() {
    setSupplierCodeLoading(true);
    setSupplierCodeError('');
    try {
      const { data } = await apiClient.get('/stores/supplier-code');
      setSupplierCode(data.supplierCode);
    } catch (err) {
      setSupplierCodeError(err.response?.data?.error?.message || 'Impossible de charger le code.');
    } finally {
      setSupplierCodeLoading(false);
    }
  }

  async function loadStoreType() {
    setStoreTypeLoading(true);
    setStoreTypeError('');
    try {
      const [typeRes, allTypesRes] = await Promise.all([
        apiClient.get('/stores/type'),
        apiClient.get('/stores/types'),
      ]);
      setStoreType(typeRes.data);
      setAllStoreTypes(allTypesRes.data.storeTypes);
    } catch (err) {
      setStoreTypeError(err.response?.data?.error?.message || 'Impossible de charger le type de boutique.');
    } finally {
      setStoreTypeLoading(false);
    }
  }

  useEffect(() => {
    loadCode();
    loadSupplierCode();
    loadStoreType();
  }, []);

  async function handleSaveStoreType(e) {
    e.preventDefault();
    setStoreTypeError('');
    setSavingStoreType(true);
    try {
      const { data } = await apiClient.put('/stores/type', { storeTypeId: Number(selectedStoreTypeId) });
      setStoreType({ storeTypeId: data.storeTypeId, storeTypeLabel: data.storeTypeLabel });
      setSelectedStoreTypeId('');
      setStoreTypeSuccess(
        data.categoriesAdded > 0
          ? `Type "${data.storeTypeLabel}" enregistré — ${data.categoriesAdded} catégorie(s) de produits ajoutée(s).`
          : `Type "${data.storeTypeLabel}" enregistré — aucune nouvelle catégorie à ajouter, tout existait déjà.`
      );
      setTimeout(() => setStoreTypeSuccess(''), 8000);
    } catch (err) {
      setStoreTypeError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSavingStoreType(false);
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Régénérer le code ? L'ancien ne pourra plus être utilisé pour ajouter de nouveaux superviseurs (ceux déjà ajoutés gardent leur accès)."
      )
    ) {
      return;
    }
    setRegenerating(true);
    try {
      const { data } = await apiClient.post('/stores/supervision-code/regenerate');
      setCode(data.supervisionCode);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Régénération impossible.');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleRegenerateSupplierCode() {
    if (
      !window.confirm(
        "Régénérer le code ? L'ancien ne pourra plus être utilisé pour ajouter de nouveaux clients (ceux déjà ajoutés gardent leur accès à votre catalogue)."
      )
    ) {
      return;
    }
    setSupplierCodeRegenerating(true);
    try {
      const { data } = await apiClient.post('/stores/supplier-code/regenerate');
      setSupplierCode(data.supplierCode);
    } catch (err) {
      setSupplierCodeError(err.response?.data?.error?.message || 'Régénération impossible.');
    } finally {
      setSupplierCodeRegenerating(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleCopySupplierCode() {
    navigator.clipboard.writeText(supplierCode);
    setSupplierCodeCopied(true);
    setTimeout(() => setSupplierCodeCopied(false), 2000);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Paramètres</h1>
      <p className="text-sm text-slate-500 mb-6">Informations boutique, abonnement, facturation.</p>

      <SubscriptionSection />

      <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Code de supervision</h2>
        <p className="text-xs text-slate-500 mb-3">
          Transmettez ce code à un propriétaire multi-boutiques pour lui
          donner une vue en lecture seule sur cette boutique — aucun droit
          d'action de sa part (pas de caisse, pas de gestion produit/équipe).
        </p>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {loading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800">
                {code}
              </code>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-200 transition"
              >
                {copied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {regenerating ? 'Régénération...' : 'Régénérer le code'}
            </button>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Code fournisseur</h2>
        <p className="text-xs text-slate-500 mb-3">
          Transmettez ce code à une autre boutique pour qu'elle puisse vous
          ajouter comme fournisseur — elle ne verra que votre catalogue
          (nom, image, catégorie), jamais vos prix ni vos quantités en stock.
        </p>

        {supplierCodeError && <p className="text-sm text-red-600 mb-3">{supplierCodeError}</p>}

        {supplierCodeLoading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <code className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800">
                {supplierCode}
              </code>
              <button
                onClick={handleCopySupplierCode}
                className="rounded-lg bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-200 transition"
              >
                {supplierCodeCopied ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <button
              onClick={handleRegenerateSupplierCode}
              disabled={supplierCodeRegenerating}
              className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {supplierCodeRegenerating ? 'Régénération...' : 'Régénérer le code'}
            </button>
          </>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-1">Type de boutique</h2>
        <p className="text-xs text-slate-500 mb-3">
          Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un seul
          type — le choix est définitif une fois enregistré.
        </p>

        {storeTypeError && <p className="text-sm text-red-600 mb-3">{storeTypeError}</p>}
        {storeTypeSuccess && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
            {storeTypeSuccess}
          </p>
        )}

        {storeTypeLoading ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : storeType?.storeTypeId ? (
          <p className="text-sm text-slate-600">
            Type : <span className="font-medium text-slate-800">{storeType.storeTypeLabel}</span>
          </p>
        ) : (
          <form onSubmit={handleSaveStoreType}>
            <p className="text-sm text-slate-600 mb-2">Aucun type défini pour l'instant.</p>
            <select
              required
              value={selectedStoreTypeId}
              onChange={(e) => setSelectedStoreTypeId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="" disabled>
                Choisir un type...
              </option>
              {allStoreTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={savingStoreType || !selectedStoreTypeId}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {savingStoreType ? 'Enregistrement...' : 'Définir le type'}
            </button>
          </form>
        )}
      </section>

      <SalesVoidReturnPermissionSection />

      <ReceiptSettingsSection />

      <StoreLogoSection />

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 text-sm">
        Le reste (facturation) reste à implémenter.
      </div>
    </div>
  );
}