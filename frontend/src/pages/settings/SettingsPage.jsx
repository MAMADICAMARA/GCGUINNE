import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import ReceiptSettingsSection from './ReceiptSettingsSection';
import BillingSettingsSection from './BillingSettingsSection';
import OrdersExportSection from './OrdersExportSection';
import SalesVoidReturnPermissionSection from './SalesVoidReturnPermissionSection';
import SalesEditPricePermissionSection from './SalesEditPricePermissionSection';
import AddProductPermissionSection from './AddProductPermissionSection';
import SubscriptionSection from './SubscriptionSection';
import StoreLogoSection from './StoreLogoSection';
import StoreInfoSection from './StoreInfoSection';
import {
  SlidersHorizontal,
  Crown,
  Store,
  Share2,
  ShoppingBag,
  FileText,
  KeyRound,
  Tag,
  Copy,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

// Une teinte par groupe (au lieu d'un bleu unique partout) — repère visuel
// rapide entre Abonnement / Boutique / Partage / Ventes, cohérent avec la
// palette déjà utilisée ailleurs dans l'app (ProfilePage.jsx notamment).
const ACCENTS = {
  amber: { icon: 'bg-amber-50 text-amber-600', ring: 'focus:ring-amber-500 focus:border-amber-500', chip: 'bg-amber-50 text-amber-700', solidBtn: 'bg-amber-500 hover:bg-amber-600' },
  sky: { icon: 'bg-sky-50 text-sky-600', ring: 'focus:ring-sky-500 focus:border-sky-500', chip: 'bg-sky-50 text-sky-700', solidBtn: 'bg-sky-500 hover:bg-sky-600' },
  violet: { icon: 'bg-violet-50 text-violet-600', ring: 'focus:ring-violet-500 focus:border-violet-500', chip: 'bg-violet-50 text-violet-700', solidBtn: 'bg-violet-500 hover:bg-violet-600' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', ring: 'focus:ring-emerald-500 focus:border-emerald-500', chip: 'bg-emerald-50 text-emerald-700', solidBtn: 'bg-emerald-500 hover:bg-emerald-600' },
  slate: { icon: 'bg-slate-100 text-slate-500', ring: 'focus:ring-slate-400 focus:border-slate-400', chip: 'bg-slate-100 text-slate-600', solidBtn: 'bg-slate-500 hover:bg-slate-600' },
};

function SectionHeader({ icon: Icon, title, description, accent = 'sky' }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className={`rounded-xl p-2.5 shrink-0 ${ACCENTS[accent].icon}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
    </div>
  );
}

// Les codes de supervision et fournisseur partagent exactement la même
// mécanique (afficher, copier, régénérer avec confirmation) — un seul
// composant paramétré plutôt que deux blocs JSX dupliqués.
function ShareCodeCard({ title, description, code, loading, error, copied, regenerating, onCopy, onRegenerate, accent = 'violet' }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className={`h-4 w-4 ${ACCENTS[accent].icon.split(' ')[1]}`} strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">{description}</p>

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <code className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800 truncate">
              {code}
            </code>
            <button
              onClick={onCopy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium px-3 py-2 hover:bg-slate-200 transition"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              {copied ? 'Copié !' : 'Copier'}
            </button>
          </div>
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} strokeWidth={1.75} />
            {regenerating ? 'Régénération…' : 'Régénérer le code'}
          </button>
        </>
      )}
    </section>
  );
}

/**
 * Paramètres de la boutique active (§8 du cahier des charges).
 * Statut de l'abonnement (§20_plans_abonnement.sql, lecture seule — seul le
 * Super Admin active/renouvelle/désactive), code de supervision
 * (§12_supervision.sql, lecture seule sur toute la boutique) et code
 * fournisseur (§18_fournisseurs_inter_boutiques.sql, lecture seule du
 * catalogue produit uniquement — deux codes volontairement distincts, deux
 * niveaux de confiance différents).
 *
 * Groupée en sections thématiques, chacune avec sa propre teinte d'accent
 * (voir ACCENTS ci-dessus) plutôt qu'une liste plate de cartes bleu uniforme.
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-10">
      {/* En-tête général */}
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 p-3 text-white shadow-sm">
          <SlidersHorizontal className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paramètres</h1>
          <p className="text-sm text-slate-500">Informations boutique, abonnement, facturation.</p>
        </div>
      </div>

      {/* Abonnement */}
      <div className="space-y-4">
        <SectionHeader icon={Crown} title="Abonnement" description="Gérez votre plan et vos factures." accent="amber" />
        <SubscriptionSection />
      </div>

      {/* Boutique */}
      <div className="space-y-4">
        <SectionHeader icon={Store} title="Boutique" description="Identité visuelle et catégorisation de votre activité." accent="sky" />
        <div className="grid gap-6">
          <StoreLogoSection />
          <StoreInfoSection />

          {/* Type de boutique */}
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
            <div className="flex items-center gap-2 mb-1">
              <Tag className="h-4 w-4 text-sky-500" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-slate-800">Type de boutique</h3>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un seul type — le choix est définitif une fois enregistré.
            </p>

            {storeTypeError && (
              <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {storeTypeError}
              </div>
            )}
            {storeTypeSuccess && (
              <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {storeTypeSuccess}
              </div>
            )}

            {storeTypeLoading ? (
              <p className="text-sm text-slate-400">Chargement…</p>
            ) : storeType?.storeTypeId ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <span>Type actuel :</span>
                <span className="font-medium text-sky-700 bg-sky-50 px-3 py-1 rounded-full">
                  {storeType.storeTypeLabel}
                </span>
              </div>
            ) : (
              <form onSubmit={handleSaveStoreType} className="space-y-3">
                <p className="text-sm text-slate-600">Aucun type défini pour l'instant.</p>
                <select
                  required
                  value={selectedStoreTypeId}
                  onChange={(e) => setSelectedStoreTypeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                >
                  <option value="" disabled>Choisir un type…</option>
                  {allStoreTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={savingStoreType || !selectedStoreTypeId}
                  className="inline-flex items-center gap-2 rounded-lg bg-sky-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-sky-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {savingStoreType ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Enregistrement…
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Définir le type
                    </>
                  )}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>

      {/* Partage & accès */}
      <div className="space-y-4">
        <SectionHeader
          icon={Share2}
          title="Partage & accès"
          description="Deux codes distincts, deux niveaux de confiance différents."
          accent="violet"
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <ShareCodeCard
            title="Code de supervision"
            description="Donne une vue en lecture seule à un propriétaire multi-boutiques — aucun droit d'action."
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
            description="Permet à une autre boutique de vous ajouter comme fournisseur — elle voit uniquement votre catalogue."
            code={supplierCode}
            loading={supplierCodeLoading}
            error={supplierCodeError}
            copied={supplierCodeCopied}
            regenerating={supplierCodeRegenerating}
            onCopy={handleCopySupplierCode}
            onRegenerate={handleRegenerateSupplierCode}
          />
        </div>
      </div>

      {/* Ventes */}
      <div className="space-y-4">
        <SectionHeader
          icon={ShoppingBag}
          title="Ventes"
          description="Règles applicables à la caisse et aux reçus."
          accent="emerald"
        />
        <div className="grid gap-6">
          <SalesVoidReturnPermissionSection />
          <SalesEditPricePermissionSection />
          <AddProductPermissionSection />
          <ReceiptSettingsSection />
        </div>
      </div>

      {/* Facturation */}
      <div className="space-y-4">
        <SectionHeader icon={FileText} title="Facturation" description="Gestion des factures et documents." accent="slate" />
        <div className="grid gap-6">
          <BillingSettingsSection />
          <OrdersExportSection />
        </div>
      </div>
    </div>
  );
}
