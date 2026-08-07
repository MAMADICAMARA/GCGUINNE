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
 *
 * Réorganisée en groupes thématiques (Abonnement / Boutique / Partage &
 * accès / Ventes) plutôt qu'une liste plate de cartes — les composants
 * importés (SubscriptionSection, ReceiptSettingsSection...) gardent leur
 * implémentation interne intacte, seul leur regroupement change ici.
 */

// Petit en-tête de groupe cohérent avec le style déjà utilisé ailleurs dans
// l'app (libellés en majuscules discrètes) — encode une vraie catégorie de
// réglages, pas une simple décoration entre les cartes.
function SectionGroup({ title, description, children }) {
  return (
    <div className="mb-10">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

// Les codes de supervision et fournisseur partagent exactement la même
// mécanique (afficher, copier, régénérer avec confirmation) — un seul
// composant paramétré plutôt que deux blocs JSX dupliqués.
function ShareCodeCard({ title, description, code, loading, error, copied, regenerating, onCopy, onRegenerate }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{title}</h3>
      <p className="text-xs text-slate-500 mb-3">{description}</p>

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
              onClick={onCopy}
              className="rounded-lg bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-200 transition"
            >
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
          >
            {regenerating ? 'Régénération...' : 'Régénérer le code'}
          </button>
        </>
      )}
    </section>
  );
}

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
      <p className="text-sm text-slate-500 mb-8">Informations boutique, abonnement, facturation.</p>

      <SectionGroup title="Abonnement">
        <SubscriptionSection />
      </SectionGroup>

      <SectionGroup
        title="Boutique"
        description="Identité visuelle et catégorisation de votre activité."
      >
        <StoreLogoSection />

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Type de boutique</h3>
          <p className="text-xs text-slate-500 mb-3">
            Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un
            seul type — le choix est définitif une fois enregistré.
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
      </SectionGroup>

      <SectionGroup
        title="Partage & accès"
        description="Deux codes distincts, deux niveaux de confiance différents."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <ShareCodeCard
            title="Code de supervision"
            description="Donne une vue en lecture seule à un propriétaire multi-boutiques — aucun droit d'action (pas de caisse, pas de gestion produit/équipe)."
            code={code}
            loading={loading}
            error={error}
            copied={copied}
            regenerating={regenerating}
            onCopy={handleCopy}
            onRegenerate={handleRegenerate}
          />
          <ShareCodeCard
            title="Code fournisseur"
            description="Permet à une autre boutique de vous ajouter comme fournisseur — elle voit uniquement votre catalogue (nom, image, catégorie), jamais vos prix ni stocks."
            code={supplierCode}
            loading={supplierCodeLoading}
            error={supplierCodeError}
            copied={supplierCodeCopied}
            regenerating={supplierCodeRegenerating}
            onCopy={handleCopySupplierCode}
            onRegenerate={handleRegenerateSupplierCode}
          />
        </div>
      </SectionGroup>

      <SectionGroup title="Ventes" description="Règles applicables à la caisse et aux reçus.">
        <SalesVoidReturnPermissionSection />
        <ReceiptSettingsSection />
      </SectionGroup>

      <SectionGroup title="Facturation">
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400 text-sm">
          Reste à implémenter.
        </div>
      </SectionGroup>
    </div>
  );
}