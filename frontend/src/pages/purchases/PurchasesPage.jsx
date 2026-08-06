import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';
import SupplierContactModal from './SupplierContactModal';
import CreatePurchaseOrderModal from './CreatePurchaseOrderModal';
import PurchaseOrderDetailModal from './PurchaseOrderDetailModal';

const STATUS_LABELS = {
  PENDING: 'En attente',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/**
 * Achats fournisseur (§28_commandes_achat_premium.sql, décidé en
 * conversation) — avantage exclusif du plan PREMIUM face à STANDARD.
 * Consulter fournisseurs/commandes déjà créés reste toujours possible quel
 * que soit le plan actuel (même logique que la page Fournisseurs
 * existante) — seule la création d'un nouveau fournisseur ou d'une
 * nouvelle commande est verrouillée, avec un message clair plutôt qu'un
 * bouton silencieusement absent.
 */
export default function PurchasesPage() {
  const [tab, setTab] = useState('orders'); // 'orders' | 'suppliers'
  const [planStatus, setPlanStatus] = useState(null);

  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const [busySupplierId, setBusySupplierId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [ordersRes, suppliersRes, planRes] = await Promise.all([
        apiClient.get('/purchases/orders'),
        apiClient.get('/purchases/suppliers'),
        apiClient.get('/stores/plan-status'),
      ]);
      setOrders(ordersRes.data.orders);
      setSuppliers(suppliersRes.data.suppliers);
      setPlanStatus(planRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les achats.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const canCreate = Boolean(planStatus?.allowsPurchaseOrders);

  async function handleRemoveSupplier(supplier) {
    if (!window.confirm(`Retirer "${supplier.name}" de vos fournisseurs ?`)) return;
    setBusySupplierId(supplier.id);
    try {
      await apiClient.delete(`/purchases/suppliers/${supplier.id}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusySupplierId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Achats</h1>
          <p className="text-sm text-slate-500">
            Fournisseurs et commandes d'achat — la réception met à jour le stock automatiquement.
          </p>
        </div>
        {tab === 'orders' ? (
          <button
            onClick={() => setShowCreateOrder(true)}
            disabled={!canCreate}
            title={!canCreate ? 'Fonctionnalité PREMIUM — passez à ce plan pour créer des commandes' : undefined}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Nouvelle commande
          </button>
        ) : (
          <button
            onClick={() => setShowAddSupplier(true)}
            disabled={!canCreate}
            title={!canCreate ? 'Fonctionnalité PREMIUM — passez à ce plan pour ajouter des fournisseurs' : undefined}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Ajouter un fournisseur
          </button>
        )}
      </div>

      {!loading && !canCreate && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
          Les commandes d'achat sont réservées au plan PREMIUM — passez à ce plan pour en créer. La
          consultation de ce qui existe déjà reste possible.
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTab('orders')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            tab === 'orders' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Commandes
        </button>
        <button
          onClick={() => setTab('suppliers')}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
            tab === 'suppliers' ? 'bg-brand-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Fournisseurs
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : tab === 'orders' ? (
        orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Aucune commande d'achat pour l'instant.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setViewingOrderId(o.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-600 truncate">
                        {o.supplierName}
                        {o.supplierType === 'PLATFORM' && (
                          <span className="block text-xs font-normal text-slate-400">fournisseur plateforme</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {o.reference || '—'} · {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        o.status === 'RECEIVED'
                          ? 'bg-green-50 text-green-700'
                          : o.status === 'CANCELLED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    <span className="text-slate-500">{o.createdByName}</span>
                    <span className="font-medium text-slate-800">{formatGNF(o.totalAmount)}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Fournisseur</th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-left px-4 py-3">Créée par</th>
                  <th className="text-left px-4 py-3">Date</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setViewingOrderId(o.id)}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-brand-600">
                      {o.supplierName}
                      {o.supplierType === 'PLATFORM' && (
                        <span className="block text-xs font-normal text-slate-400">fournisseur plateforme</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{o.reference || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatGNF(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.status === 'RECEIVED'
                            ? 'bg-green-50 text-green-700'
                            : o.status === 'CANCELLED'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[o.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{o.createdByName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucun fournisseur enregistré pour l'instant.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="font-medium text-slate-800">{s.name}</p>
              <p className="text-xs text-slate-400 mb-3">
                {[s.phone, s.email].filter(Boolean).join(' · ') || '—'}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingSupplier(s)}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleRemoveSupplier(s)}
                  disabled={busySupplierId === s.id}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddSupplier && (
        <SupplierContactModal
          onClose={() => setShowAddSupplier(false)}
          onSaved={() => {
            setShowAddSupplier(false);
            loadAll();
          }}
        />
      )}

      {editingSupplier && (
        <SupplierContactModal
          supplier={editingSupplier}
          onClose={() => setEditingSupplier(null)}
          onSaved={() => {
            setEditingSupplier(null);
            loadAll();
          }}
        />
      )}

      {showCreateOrder && (
        <CreatePurchaseOrderModal
          suppliers={suppliers}
          onClose={() => setShowCreateOrder(false)}
          onCreated={() => {
            setShowCreateOrder(false);
            loadAll();
          }}
        />
      )}

      {viewingOrderId && (
        <PurchaseOrderDetailModal
          orderId={viewingOrderId}
          onClose={() => setViewingOrderId(null)}
          onChanged={loadAll}
        />
      )}
    </div>
  );
}
