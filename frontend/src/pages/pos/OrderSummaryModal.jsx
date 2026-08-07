import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { formatGNF } from '@/utils/format';

const PAYMENT_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  OTHER: 'Autre',
};

/**
 * Troisième et dernière étape de la validation d'une vente : récapitulatif
 * complet (articles, client, paiement, totaux) avant l'appel réel à
 * l'API. C'est ici, et seulement ici, que la vente est effectivement
 * soumise — les deux étapes précédentes (panier, client) ne font que
 * rassembler l'information.
 *
 * Inclut le paiement partiel (décidé en conversation) : le montant donné
 * peut être inférieur au total, la différence devient une dette suivie
 * sur la fiche du client — qui doit donc être identifié (le backend
 * refuse un paiement partiel pour une vente anonyme).
 */
export default function OrderSummaryModal({
  cart,
  subtotal,
  discountAmount,
  taxAmount,
  total,
  paymentMethod,
  customer,
  onConfirm,
  onBack,
  submitting,
  error,
}) {
  const [paymentMode, setPaymentMode] = useState('TOTAL'); // 'TOTAL' | 'PARTIAL'
  const [amountPaidInput, setAmountPaidInput] = useState(String(total));

  const amountPaid =
    paymentMode === 'TOTAL' ? total : Math.min(total, Math.max(0, parseFloat(amountPaidInput) || 0));
  const remaining = total - amountPaid;
  const isPartial = remaining > 0;
  const hasIdentifiedCustomer = Boolean(customer?.id) || Boolean(customer?.isNewCustomer);
  const canConfirm = !isPartial || hasIdentifiedCustomer;

  function handleSelectMode(mode) {
    setPaymentMode(mode);
    if (mode === 'TOTAL') {
      setAmountPaidInput(String(total));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Récapitulatif de la vente</h2>
          <p className="text-xs text-slate-400">Vérifiez avant de confirmer.</p>
        </div>

        <div className="px-6 py-5">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Client</p>
              <p className="font-medium text-slate-800">{customer?.name || 'Client anonyme'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 uppercase tracking-wide">Paiement</p>
              <p className="font-medium text-slate-800">{PAYMENT_LABELS[paymentMethod]}</p>
            </div>
          </div>

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles</h3>
          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-4">
            {cart.map((item) => (
              <div key={item.productId} className="px-3 py-2">
                <p className="text-sm text-slate-700">{item.productName}</p>
                <div className="flex items-center justify-between mt-0.5">
                  <span className="text-xs text-slate-500">
                    {item.quantity} × {formatGNF(item.unitPrice)}
                  </span>
                  <span className="text-sm font-medium text-slate-800">
                    {formatGNF(item.quantity * item.unitPrice)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between text-slate-500">
              <span>Sous-total</span>
              <span>{formatGNF(subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Réduction</span>
              <span>-{formatGNF(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Taxe</span>
              <span>+{formatGNF(taxAmount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
              <span>TOTAL</span>
              <span>{formatGNF(total)}</span>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <label className="block text-sm font-medium text-slate-600 mb-2">Paiement</label>

            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => handleSelectMode('TOTAL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  paymentMode === 'TOTAL'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => handleSelectMode('PARTIAL')}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  paymentMode === 'PARTIAL'
                    ? 'border-amber-500 bg-amber-50 text-amber-700'
                    : 'border-slate-300 text-slate-500'
                }`}
              >
                Partiel
              </button>
            </div>

            <label className="block text-sm font-medium text-slate-600 mb-1">
              Montant donné
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={amountPaidInput}
              disabled={paymentMode === 'TOTAL'}
              onChange={(e) => setAmountPaidInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
            />
            {parseFloat(amountPaidInput) > total && (
              <p className="text-xs text-red-600 mt-1">
                Ne peut pas dépasser le total ({formatGNF(total)}).
              </p>
            )}

            {paymentMode === 'PARTIAL' && (
              <div className="mt-2">
                <p className="text-sm text-amber-700 font-medium">
                  Reste à payer : {formatGNF(remaining)}
                </p>
                {!hasIdentifiedCustomer ? (
                  <p className="text-xs text-red-600 mt-1">
                    Un paiement partiel nécessite un client identifié — revenez à
                    l'étape précédente pour en choisir ou en créer un.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-1">
                    Cette dette sera enregistrée sur la fiche de{' '}
                    <span className="font-medium">{customer.name}</span>.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => onConfirm(amountPaid)}
            disabled={submitting || !canConfirm}
            className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-semibold py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Validation en cours...' : 'Confirmer la vente'}
          </button>
          <button
            onClick={onBack}
            disabled={submitting}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
          >
            <ChevronLeft size={16} /> Retour
          </button>
        </div>
      </div>
    </div>
  );
}