import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

const PAYMENT_STATUS_LABELS = {
  PAID: 'Total',
  PARTIALLY_PAID: 'Partiel',
  PENDING: 'Non payé',
};

/**
 * Historique complet des achats d'un client (§4.7 du cahier des charges) —
 * pour chaque vente : produits, quantités, montant payé, date, vendeur.
 * Un seul appel (GET /customers/:id/orders), pas un aller-retour par vente.
 *
 * Affiche aussi la traçabilité des paiements encaissés (§ décidé en
 * conversation) — montant, vendeur, date de chaque versement, y compris
 * les paiements partiels successifs (GET /customers/:id/payments,
 * `customer_payments`, déjà alimentée par PayBalanceModal mais jamais
 * relue nulle part avant cet ajout).
 */
export default function CustomerHistoryModal({ customerId, onClose }) {
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ordersRes, paymentsRes] = await Promise.all([
          apiClient.get(`/customers/${customerId}/orders`),
          apiClient.get(`/customers/${customerId}/payments`),
        ]);
        if (cancelled) return;
        setData(ordersRes.data);
        setPayments(paymentsRes.data.payments);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Impossible de charger l'historique.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-100">
          {error ? (
            <h2 className="font-semibold text-slate-800">Historique des achats</h2>
          ) : !data ? (
            <h2 className="font-semibold text-slate-800">Chargement...</h2>
          ) : (
            <>
              <h2 className="font-semibold text-slate-800">{data.customer.name}</h2>
              <p className="text-xs text-slate-400">
                {data.customer.phone || 'Sans téléphone'} · Total dépensé :{' '}
                {formatGNF(data.customer.totalSpent)}
                {data.customer.balanceDue > 0 && (
                  <span className="text-red-600 font-medium">
                    {' '}
                    · Doit {formatGNF(data.customer.balanceDue)}
                  </span>
                )}
              </p>
            </>
          )}
        </div>

        <div className="px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !data ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <>
              {payments && payments.length > 0 && (
                <div className="mb-5">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Paiements reçus
                  </h3>
                  <div className="rounded-lg border border-slate-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-wide">
                        <tr>
                          <th className="text-left px-4 py-2">Date</th>
                          <th className="text-left px-4 py-2">Vendeur</th>
                          <th className="text-right px-4 py-2">Montant</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="px-4 py-2 text-slate-500 whitespace-nowrap">
                              {formatDateTime(p.createdAt)}
                            </td>
                            <td className="px-4 py-2 text-slate-600">{p.sellerName}</td>
                            <td className="px-4 py-2 text-right font-medium text-slate-800">
                              {formatGNF(p.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {data.orders.length === 0 ? (
                <p className="text-sm text-slate-400">Aucun achat enregistré pour ce client.</p>
              ) : (
                <div className="space-y-4">
                  {data.orders.map((order) => (
                <div key={order.orderId} className="rounded-lg border border-slate-200 overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 px-4 py-2.5">
                    <div>
                      <span className="text-sm font-medium text-brand-600">{order.orderNumber}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        {formatDateTime(order.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">Vendeur : {order.sellerName}</span>
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-green-50 text-green-700'
                            : order.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-4 py-2 text-slate-700">{item.productName}</td>
                          <td className="px-4 py-2 text-right text-slate-500">× {item.quantity}</td>
                          <td className="px-4 py-2 text-right font-medium text-slate-700">
                            {formatGNF(item.quantity * item.unitPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-between px-4 py-2 border-t border-slate-100 text-sm">
                    <span className="text-slate-500">
                      Payé : <span className="font-medium text-slate-700">{formatGNF(order.amountPaid)}</span>
                    </span>
                    <span className="font-semibold text-slate-800">
                      Total : {formatGNF(order.totalAmount)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
              )}
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