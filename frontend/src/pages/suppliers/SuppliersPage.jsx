import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PackageSearch, Plus, Truck } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';
import ReceivedOrderDetailModal from './ReceivedOrderDetailModal';

const RECEIVED_ORDER_STATUS_LABELS = {
  PENDING: 'En attente',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/**
 * Page Fournisseurs (§18_fournisseurs_inter_boutiques.sql) — un Owner peut
 * ajouter une autre boutique de la plateforme comme fournisseur via son
 * code (jamais son ID brut), consulter son catalogue et y passer commande
 * (§29_commande_depuis_fournisseur_plateforme.sql), et voir/retirer les
 * boutiques qui l'ont, elle, ajoutée comme fournisseur (ses "clients").
 *
 * Ajouter/parcourir un fournisseur est ouvert à TOUS les plans, y compris
 * FREEMIUM (décidé en conversation — revirement stratégique : la demande
 * reste gratuite, seule l'offre — être soi-même fournisseur — exige
 * STANDARD/PREMIUM, déjà vérifié côté serveur sur le fournisseur consulté,
 * jamais sur l'acheteur). Seule la commande elle-même reste réservée
 * PREMIUM (vérifié dans la page vitrine du fournisseur).
 */
export default function SuppliersPage() {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [clients, setClients] = useState([]);
  const [receivedOrders, setReceivedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [busyLinkId, setBusyLinkId] = useState(null);
  const [viewingOrderId, setViewingOrderId] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [suppliersRes, clientsRes, receivedOrdersRes] = await Promise.all([
        apiClient.get('/suppliers'),
        apiClient.get('/suppliers/clients'),
        apiClient.get('/purchases/received-orders'),
      ]);
      setSuppliers(suppliersRes.data.suppliers);
      setClients(clientsRes.data.clients);
      setReceivedOrders(receivedOrdersRes.data.orders);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger vos fournisseurs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleAddCode(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/suppliers', { code: code.trim() });
      setSuccessMessage(`"${data.name}" a été ajoutée à vos fournisseurs.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      setCode('');
      setShowAddForm(false);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Code invalide.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveSupplier(supplier) {
    if (!window.confirm(`Retirer "${supplier.name}" de vos fournisseurs ?`)) return;
    setBusyLinkId(supplier.linkId);
    try {
      await apiClient.delete(`/suppliers/${supplier.linkId}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusyLinkId(null);
    }
  }

  async function handleRemoveClient(client) {
    if (!window.confirm(`Retirer "${client.name}" de vos clients ? Elle perdra l'accès à votre catalogue.`)) return;
    setBusyLinkId(client.linkId);
    try {
      await apiClient.delete(`/suppliers/clients/${client.linkId}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusyLinkId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Truck size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Fournisseurs</h1>
            <p className="text-sm text-slate-500">
              Boutiques de la plateforme dont vous consultez le catalogue, et boutiques qui vous ont ajouté.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto"
        >
          <Plus size={16} /> Ajouter via un code
        </button>
      </div>

      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddCode}
          className="rounded-xl border border-slate-200 bg-white p-5 mb-6 max-w-md"
        >
          <label className="block text-sm font-medium text-slate-600 mb-1">Code fournisseur</label>
          <p className="text-xs text-slate-400 mb-2">
            Demandez ce code au propriétaire de la boutique fournisseur — il se trouve dans ses Paramètres.
            Sa quantité en stock reste toujours privée ; son prix de vente n'est visible qu'au moment de
            préparer une commande.
          </p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex : F5Q8N3Z3SCHW"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Vérification...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Mes fournisseurs</h2>
            {suppliers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
                <Truck size={24} className="mx-auto mb-2 text-slate-300" />
                Aucun fournisseur ajouté pour l'instant.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suppliers.map((s) => (
                  <div key={s.linkId} className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 mb-3">
                      {[s.category, s.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => navigate(`/suppliers/${s.storeId}/order`)}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        Voir le catalogue
                      </button>
                      <button
                        onClick={() => handleRemoveSupplier(s)}
                        disabled={busyLinkId === s.linkId}
                        className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Mes clients</h2>
            <p className="text-xs text-slate-400 mb-3">
              Boutiques qui vous ont ajoutée comme fournisseur — elles voient votre catalogue et votre prix de
              vente à titre de référence lorsqu'elles préparent une commande, mais jamais votre stock.
            </p>
            {clients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
                <Truck size={24} className="mx-auto mb-2 text-slate-300" />
                Aucune boutique ne vous a ajoutée comme fournisseur pour l'instant.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Vue mobile : cartes empilées (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {clients.map((c) => (
                    <div key={c.linkId} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.name}</p>
                        <p className="text-xs text-slate-400">
                          {[c.category, c.city].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveClient(c)}
                        disabled={busyLinkId === c.linkId}
                        className="shrink-0 text-xs font-medium text-red-500 disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  ))}
                </div>

                {/* Vue desktop : tableau complet (dès md) */}
                <table className="hidden md:table w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Boutique</th>
                      <th className="text-left px-4 py-3">Ville / catégorie</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.linkId} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {[c.category, c.city].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveClient(c)}
                            disabled={busyLinkId === c.linkId}
                            className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Commandes reçues de mes clients</h2>
            <p className="text-xs text-slate-400 mb-3">
              Ce que vos clients ont commandé chez vous — votre stock est diminué automatiquement dès qu'ils
              confirment avoir reçu la livraison, jamais avant. Lecture seule : c'est toujours votre client qui
              contrôle sa commande.
            </p>
            {receivedOrders.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
                <PackageSearch size={24} className="mx-auto mb-2 text-slate-300" />
                Aucune commande reçue pour l'instant.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                {/* Vue mobile : cartes empilées (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {receivedOrders.map((o) => (
                    <button
                      key={o.id}
                      onClick={() => setViewingOrderId(o.id)}
                      className="w-full text-left p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-brand-600 truncate">{o.buyerStoreName}</p>
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
                          {RECEIVED_ORDER_STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <p className="text-right font-medium text-slate-800 mt-2">{formatGNF(o.totalAmount)}</p>
                    </button>
                  ))}
                </div>

                {/* Vue desktop : tableau complet (dès md) */}
                <table className="hidden md:table w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Boutique cliente</th>
                      <th className="text-left px-4 py-3">Référence</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th className="text-left px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedOrders.map((o) => (
                      <tr
                        key={o.id}
                        onClick={() => setViewingOrderId(o.id)}
                        className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 font-medium text-brand-600">{o.buyerStoreName}</td>
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
                            {RECEIVED_ORDER_STATUS_LABELS[o.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {viewingOrderId && (
        <ReceivedOrderDetailModal orderId={viewingOrderId} onClose={() => setViewingOrderId(null)} />
      )}
    </div>
  );
}
