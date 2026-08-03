import { useState } from 'react';
import { X } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

export default function PayBalanceModal({ customer, onClose, onSuccess }) {
  const [amount, setAmount] = useState(customer.balanceDue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const numericAmount = parseFloat(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError('Le montant doit être supérieur à 0.');
      return;
    }
    if (numericAmount > customer.balanceDue) {
      setError(`Le montant ne peut pas dépasser le solde dû (${formatGNF(customer.balanceDue)}).`);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post(`/customers/${customer.id}/payments`, { amount: numericAmount });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Erreur lors de l'enregistrement du paiement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-slate-800">Encaisser un paiement</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-slate-500 mb-1">{customer.name}</p>
        <p className="text-sm text-slate-500 mb-4">
          Solde dû :{' '}
          <span className="font-semibold text-red-600">{formatGNF(customer.balanceDue)}</span>
        </p>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Montant à encaisser
          </label>
          <input
            type="number"
            min="1"
            max={customer.balanceDue}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 mb-1"
          />
          <p className="text-xs text-slate-400 mb-4">
            Pré-rempli avec le solde total — modifiable pour un paiement partiel.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-semibold py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : 'Confirmer le paiement'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2.5 hover:bg-slate-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}