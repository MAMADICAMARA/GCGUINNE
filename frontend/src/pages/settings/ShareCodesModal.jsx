import { useEffect, useState } from 'react';
import { KeyRound, Copy, RefreshCw, AlertCircle } from 'lucide-react';
import apiClient from '@/services/apiClient';
import SettingsModal from './SettingsModal';

const ICON_CLASSES = {
  violet: 'text-violet-500',
  amber: 'text-amber-500',
};

// Les codes de supervision, fournisseur et transfert partagent exactement
// la même mécanique (afficher, copier, régénérer avec confirmation) — un
// seul composant paramétré plutôt que trois blocs JSX dupliqués. Extrait de
// SettingsPage.jsx (§ décidé en conversation, page Paramètres trop longue).
function ShareCodeCard({ title, description, code, loading, error, copied, regenerating, onCopy, onRegenerate, accent = 'violet' }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className={`h-4 w-4 ${ICON_CLASSES[accent]}`} strokeWidth={1.75} />
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
 * Point d'entrée unique vers les 3 codes de partage (supervision,
 * fournisseur, transfert de stock — §12_supervision.sql,
 * §18_fournisseurs_inter_boutiques.sql, §45_transfert_de_stock.sql) —
 * consolidés dans un seul modal (§ décidé en conversation, même principe
 * que AuthorizationModal) plutôt qu'une grille sur la page.
 */
export default function ShareCodesModal({ onClose }) {
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

  const [transferCode, setTransferCode] = useState('');
  const [transferCodeLoading, setTransferCodeLoading] = useState(true);
  const [transferCodeError, setTransferCodeError] = useState('');
  const [transferCodeCopied, setTransferCodeCopied] = useState(false);
  const [transferCodeRegenerating, setTransferCodeRegenerating] = useState(false);

  useEffect(() => {
    (async () => {
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
    })();
    (async () => {
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
    })();
    (async () => {
      setTransferCodeLoading(true);
      setTransferCodeError('');
      try {
        const { data } = await apiClient.get('/stores/transfer-code');
        setTransferCode(data.transferCode);
      } catch (err) {
        setTransferCodeError(err.response?.data?.error?.message || 'Impossible de charger le code.');
      } finally {
        setTransferCodeLoading(false);
      }
    })();
  }, []);

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

  async function handleRegenerateTransferCode() {
    if (
      !window.confirm("Régénérer le code ? L'ancien ne pourra plus être utilisé pour recevoir de nouveaux transferts de stock.")
    ) {
      return;
    }
    setTransferCodeRegenerating(true);
    try {
      const { data } = await apiClient.post('/stores/transfer-code/regenerate');
      setTransferCode(data.transferCode);
    } catch (err) {
      setTransferCodeError(err.response?.data?.error?.message || 'Régénération impossible.');
    } finally {
      setTransferCodeRegenerating(false);
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

  function handleCopyTransferCode() {
    navigator.clipboard.writeText(transferCode);
    setTransferCodeCopied(true);
    setTimeout(() => setTransferCodeCopied(false), 2000);
  }

  return (
    <SettingsModal
      title="Partage & accès"
      description="Trois codes distincts, trois niveaux de confiance différents."
      onClose={onClose}
    >
      <div className="space-y-6">
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
        <ShareCodeCard
          title="Code de transfert de stock"
          description="À transmettre à une boutique du même type pour qu'elle puisse vous envoyer du stock."
          code={transferCode}
          loading={transferCodeLoading}
          error={transferCodeError}
          copied={transferCodeCopied}
          regenerating={transferCodeRegenerating}
          onCopy={handleCopyTransferCode}
          onRegenerate={handleRegenerateTransferCode}
          accent="amber"
        />
      </div>
    </SettingsModal>
  );
}
