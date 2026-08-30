import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Étape 2 du transfert de stock (§45_transfert_de_stock.sql) — saisie du
 * code de transfert de la boutique destination + quantité, avec aperçu en
 * direct (nom + type de la boutique visée) avant confirmation. Le code est
 * revérifié intégralement côté serveur à la confirmation — cet aperçu sert
 * uniquement à guider la saisie.
 */
export default function StockTransferConfirmModal({ product, onClose, onBack, onTransferred }) {
  const [code, setCode] = useState('');
  const [quantity, setQuantity] = useState('');

  const [resolved, setResolved] = useState(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const trimmed = code.trim();
    setResolved(null);
    setResolveError('');
    if (trimmed.length < 6) return;

    setResolving(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/stock-transfers/resolve-code', { params: { code: trimmed } });
        setResolved(data);
      } catch (err) {
        setResolveError(err.response?.data?.error?.message || 'Code invalide.');
      } finally {
        setResolving(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [code]);

  const parsedQuantity = parseInt(quantity, 10) || 0;
  const canSubmit = resolved && parsedQuantity > 0 && parsedQuantity <= product.quantity;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/stock-transfers', {
        transferCode: code.trim(),
        productId: product.id,
        quantity: parsedQuantity,
      });
      onTransferred(data);
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || 'Transfert impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Transférer le stock</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-800">{product.name}</p>
            <p className="text-xs text-slate-400">Stock disponible : {product.quantity}</p>
          </div>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {submitError}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Code de transfert de la boutique destination
            </label>
            <input
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Ex : 8EFE3A973646"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            {resolving && <p className="text-xs text-slate-400 mt-1.5">Vérification du code...</p>}

            {resolveError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {resolveError}
              </p>
            )}

            {resolved && (
              <p className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-100 rounded-md px-2.5 py-1.5 mt-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span className="flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" />
                  {resolved.storeName}
                  {resolved.storeTypeLabel && (
                    <span className="text-green-600/80">({resolved.storeTypeLabel})</span>
                  )}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Quantité à transférer</label>
            <input
              type="number"
              min="1"
              max={product.quantity}
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ex : 5"
            />
            {parsedQuantity > product.quantity && (
              <p className="text-xs text-red-600 mt-1">
                Quantité supérieure au stock disponible ({product.quantity}).
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Transfert en cours...' : 'Confirmer le transfert'}
            </button>
            <button type="button" onClick={onBack} className="text-sm text-slate-500 hover:text-slate-700">
              Retour
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
