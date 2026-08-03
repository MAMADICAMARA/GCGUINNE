import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

const STATUS_LABELS = {
  PAID: 'Payée',
  RETURNED: 'Retournée',
  PARTIALLY_RETURNED: 'Partiellement retournée',
  VOIDED: 'Annulée',
};

const PAYMENT_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  OTHER: 'Autre',
};

const PAYMENT_STATUS_LABELS = {
  PAID: 'Total',
  PARTIALLY_PAID: 'Partiel',
  PENDING: 'Non payé',
};

export default function OrderDetailModal({ orderId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.get(`/orders/${orderId}`);
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Impossible de charger la commande.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Détail de la vente</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <Info label="Numéro" value={data.order.orderNumber} />
                <Info label="Date" value={formatDateTime(data.order.createdAt)} />
                <Info label="Vendeur" value={data.order.sellerName} />
                <Info label="Client" value={data.order.customerName || 'Anonyme'} />
                <Info label="Paiement" value={PAYMENT_LABELS[data.order.paymentMethod]} />
                <Info label="Statut" value={STATUS_LABELS[data.order.status]} />
                <Info label="Statut du paiement" value={PAYMENT_STATUS_LABELS[data.order.paymentStatus]} />
              </div>

              <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles</h3>
              <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Produit</th>
                      <th className="text-right px-3 py-2">Qté</th>
                      <th className="text-right px-3 py-2">P.U.</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGNF(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatGNF(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Réduction</span>
                  <span>-{formatGNF(data.order.discountAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxe</span>
                  <span>+{formatGNF(data.order.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
                  <span>Total</span>
                  <span>{formatGNF(data.order.totalAmount)}</span>
                </div>

                {data.order.amountPaid < data.order.totalAmount && (
                  <>
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Montant payé</span>
                      <span>{formatGNF(data.order.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-red-600">
                      <span>Reste à payer (cette vente)</span>
                      <span>{formatGNF(data.order.totalAmount - data.order.amountPaid)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-slate-800 font-medium">{value}</p>
    </div>
  );
}