import { useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Retour d'articles d'une vente (Historique des ventes, Owner uniquement)
 * — § décidé en conversation (B1). Deux modes :
 *  - "Tout retourner" : retourne d'un coup tout ce qui reste disponible
 *    sur chaque article (rien à saisir).
 *  - "Retour partiel" : une quantité par article, plafonnée à ce qui
 *    reste disponible pour ce produit précis.
 *
 * Chaque article est envoyé au backend séquentiellement (une seule route
 * existante, par article — POST /orders/:id/items/:id/return), jamais en
 * parallèle : le statut de la commande est recalculé côté serveur à
 * chaque appel à partir de l'état courant, un envoi parallèle risquerait
 * une incohérence entre deux requêtes concurrentes sur la même commande.
 */
export default function ReturnOrderModal({ orderId, items, onClose, onSuccess }) {
  const returnableItems = items.filter((item) => item.quantity - item.returnedQuantity > 0);

  const [mode, setMode] = useState('ALL'); // 'ALL' | 'PARTIAL'
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(returnableItems.map((item) => [item.id, '']))
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function availableFor(item) {
    return item.quantity - item.returnedQuantity;
  }

  function updateQuantity(itemId, value) {
    setQuantities((q) => ({ ...q, [itemId]: value }));
  }

  const partialTotal = returnableItems.reduce((sum, item) => {
    const qty = Math.min(Number(quantities[item.id]) || 0, availableFor(item));
    return sum + qty * item.unitPrice;
  }, 0);

  const allTotal = returnableItems.reduce(
    (sum, item) => sum + availableFor(item) * item.unitPrice,
    0
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const toReturn =
      mode === 'ALL'
        ? returnableItems.map((item) => ({ itemId: item.id, qty: availableFor(item) }))
        : returnableItems
            .map((item) => ({
              itemId: item.id,
              qty: Math.min(Number(quantities[item.id]) || 0, availableFor(item)),
            }))
            .filter((entry) => entry.qty > 0);

    if (toReturn.length === 0) {
      setError('Choisissez au moins une quantité à retourner.');
      return;
    }

    if (
      !window.confirm(
        `Retourner ${toReturn.length} article(s) ? Le stock sera remis, et la dette éventuelle du client sera réduite en conséquence. Cette action est irréversible.`
      )
    ) {
      return;
    }

    setSubmitting(true);
    try {
      // Séquentiel et volontaire — voir le commentaire en tête de fichier.
      for (const entry of toReturn) {
        // eslint-disable-next-line no-await-in-loop
        await apiClient.post(`/orders/${orderId}/items/${entry.itemId}/return`, {
          returnedQty: entry.qty,
        });
      }
      onSuccess();
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Retour interrompu — certains articles ont peut-être déjà été retournés avant l'erreur."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Retourner des articles</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setMode('ALL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  mode === 'ALL'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                Tout retourner
              </button>
              <button
                type="button"
                onClick={() => setMode('PARTIAL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  mode === 'PARTIAL'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                Retour partiel
              </button>
            </div>

            {mode === 'ALL' ? (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {returnableItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                    <span className="text-slate-700">{item.productName}</span>
                    <span className="text-slate-500">
                      {availableFor(item)} × {formatGNF(item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
                {returnableItems.map((item) => (
                  <div key={item.id} className="px-3 py-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-slate-700">{item.productName}</span>
                      <span className="text-xs text-slate-400">
                        Disponible : {availableFor(item)}
                      </span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      max={availableFor(item)}
                      step="1"
                      value={quantities[item.id]}
                      onChange={(e) => updateQuantity(item.id, e.target.value)}
                      placeholder="0"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between text-sm font-semibold text-slate-800 mt-4 pt-3 border-t border-slate-100">
              <span>Valeur retournée</span>
              <span>{formatGNF(mode === 'ALL' ? allTotal : partialTotal)}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-amber-600 text-white text-sm font-semibold py-2.5 hover:bg-amber-700 transition disabled:opacity-60"
            >
              {submitting ? 'Traitement...' : 'Confirmer le retour'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
