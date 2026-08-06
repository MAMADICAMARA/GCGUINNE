import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import OrderDetailModal from './OrderDetailModal';

const STATUS_LABELS = {
  PAID: 'Payée',
  RETURNED: 'Retournée',
  PARTIALLY_RETURNED: 'Partiellement retournée',
  VOIDED: 'Annulée',
};

const PAYMENT_STATUS_LABELS = {
  PAID: 'Total',
  PARTIALLY_PAID: 'Partiel',
  PENDING: 'Non payé',
};

const PAYMENT_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  OTHER: 'Autre',
};

/**
 * Historique des ventes (§5.4 du cahier des charges). Visible à l'Owner en
 * permanence ; visible à un Vendeur uniquement si le Owner l'a autorisé à
 * annuler/retourner ses propres ventes (§25_autorisation_annulation_retour.sql,
 * décidé en conversation — voir routes/navigation.js). Dans ce dernier cas,
 * le Vendeur ne voit QUE ses propres ventes (scoping fait côté backend,
 * orders.controller.js#listOrders), jamais celles de ses collègues.
 */
export default function SalesHistoryPage() {
  const roleCode = useAuthStore((s) => s.activeStore?.roleCode);
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [status, setStatus] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  async function loadOrders() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/orders', {
        params: {
          page,
          limit,
          ...(status ? { status } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
        },
      });
      setOrders(data.orders);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de charger l'historique des ventes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, status, startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Historique des ventes</h1>
      <p className="text-sm text-slate-500 mb-6">
        {roleCode === 'OWNER'
          ? 'Toutes les ventes enregistrées dans cette boutique.'
          : 'Vos ventes enregistrées dans cette boutique.'}
      </p>

      {/* Filtres */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap">
        <input
          type="date"
          value={startDate}
          onChange={(e) => {
            setStartDate(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => {
            setEndDate(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Tous les statuts</option>
          <option value="PAID">Payées</option>
          <option value="RETURNED">Retournées</option>
          <option value="PARTIALLY_RETURNED">Partiellement retournées</option>
          <option value="VOIDED">Annulées</option>
        </select>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucune vente trouvée pour ces filtres.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-600 truncate">{order.orderNumber}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(order.createdAt)}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        order.status === 'PAID'
                          ? 'bg-green-50 text-green-700'
                          : order.status === 'VOIDED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 mt-2 truncate">
                    {order.customerName || 'Anonyme'} · {order.sellerName} · {PAYMENT_LABELS[order.paymentMethod]}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        order.paymentStatus === 'PAID'
                          ? 'bg-green-50 text-green-700'
                          : order.paymentStatus === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                    </span>
                    <span className="font-medium text-slate-800">{formatGNF(order.totalAmount)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">N° commande</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Vendeur</th>
                  <th className="text-left px-4 py-3">Client</th>
                  <th className="text-left px-4 py-3">Paiement</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Statut paiement</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-brand-600">{order.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{order.sellerName}</td>
                    <td className="px-4 py-3 text-slate-500">{order.customerName || 'Anonyme'}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {PAYMENT_LABELS[order.paymentMethod]}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatGNF(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.status === 'PAID'
                            ? 'bg-green-50 text-green-700'
                            : order.status === 'VOIDED'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[order.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          order.paymentStatus === 'PAID'
                            ? 'bg-green-50 text-green-700'
                            : order.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="disabled:opacity-40"
            >
              ← Précédent
            </button>
            <span>
              Page {page} / {totalPages} ({total} ventes)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </>
      )}

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
          onChanged={loadOrders}
        />
      )}
    </div>
  );
}