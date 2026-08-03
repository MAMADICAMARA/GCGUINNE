import { useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Modal d'ajustement manuel de stock (§4.5 du cahier des charges —
 * inventaire physique, réservé à l'Owner côté backend).
 *
 * Le motif est obligatoire : toute variation doit rester traçable et
 * compréhensible a posteriori (aucune modification silencieuse tolérée).
 */
export default function AdjustStockModal({ product, onClose, onAdjusted }) {
  const [direction, setDirection] = useState('IN'); // 'IN' (+) ou 'OUT' (-)
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const parsedAmount = parseInt(amount, 10) || 0;
  const delta = direction === 'IN' ? parsedAmount : -parsedAmount;
  const projectedQuantity = product.quantity + delta;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (parsedAmount <= 0) {
      setError('Veuillez saisir une quantité positive.');
      return;
    }
    if (!note.trim()) {
      setError('Le motif est obligatoire (ex : comptage physique, casse, perte...).');
      return;
    }
    if (projectedQuantity < 0) {
      setError(`Cet ajustement ferait passer le stock à ${projectedQuantity} (négatif) : impossible.`);
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await apiClient.post(`/products/${product.id}/adjust-stock`, {
        delta,
        note: note.trim(),
      });
      onAdjusted(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Ajustement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Ajuster le stock</h2>
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
            <p className="text-xs text-slate-400">Stock actuel : {product.quantity}</p>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Sens</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDirection('IN')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  direction === 'IN'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                + Entrée
              </button>
              <button
                type="button"
                onClick={() => setDirection('OUT')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  direction === 'OUT'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                − Sortie
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Quantité</label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ex : 5"
            />
            {parsedAmount > 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Nouveau stock estimé : <span className="font-medium text-slate-600">{projectedQuantity}</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Motif (obligatoire)
            </label>
            <textarea
              required
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Ex : Comptage physique du 25/07 — écart constaté"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : 'Confirmer l\'ajustement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}