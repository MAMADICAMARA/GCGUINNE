import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDate } from '@/utils/format';
import { useIsPlanFrozen } from '@/store/authStore';
import CustomerHistoryModal from './CustomerHistoryModal';
import PayBalanceModal from './PayBalanceModal';

export default function CustomersPage() {
  const isFrozen = useIsPlanFrozen();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [owingOnly, setOwingOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [payingCustomer, setPayingCustomer] = useState(null);

  async function loadCustomers() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/customers', {
        params: { page, limit, search, owingOnly },
      });
      setCustomers(data.customers);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, owingOnly]);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/customers', { name: newName.trim(), phone: newPhone.trim() || null });
      setNewName('');
      setNewPhone('');
      setShowForm(false);
      setPage(1);
      loadCustomers();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Clients</h1>
          <p className="text-sm text-slate-500">Recherche, fiche client, historique d'achats.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={isFrozen}
          title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Ajouter un client
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 mb-6 max-w-md"
        >
          <h2 className="font-semibold text-slate-800 mb-3">Nouveau client</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nom</label>
              <input
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Mamadou Diallo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="622 00 00 00"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Ajout...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par nom ou téléphone..."
          className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <label className="flex items-center gap-2 text-sm text-slate-600 whitespace-nowrap">
          <input
            type="checkbox"
            checked={owingOnly}
            onChange={(e) => {
              setOwingOnly(e.target.checked);
              setPage(1);
            }}
          />
          Clients qui doivent uniquement
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          {owingOnly ? 'Aucun client ne doit d\'argent actuellement.' : 'Aucun client trouvé.'}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {customers.map((customer) => (
                <div
                  key={customer.id}
                  onClick={() => setSelectedCustomerId(customer.id)}
                  className="p-4 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{customer.name}</p>
                      <p className="text-xs text-slate-400">
                        {customer.phone || '—'} · depuis le {formatDate(customer.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium text-slate-700 text-sm">
                      {formatGNF(customer.totalSpent)}
                    </span>
                  </div>
                  {customer.balanceDue > 0 && (
                    <div className="flex items-center justify-between mt-2">
                      <span className="inline-block rounded-full bg-red-50 text-red-700 px-2.5 py-0.5 text-xs font-semibold">
                        Doit {formatGNF(customer.balanceDue)}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayingCustomer(customer);
                        }}
                        disabled={isFrozen}
                        className="text-xs font-medium text-brand-600 underline disabled:opacity-40 disabled:no-underline"
                      >
                        Payer le reste
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Nom</th>
                  <th className="text-left px-4 py-3">Téléphone</th>
                  <th className="text-right px-4 py-3">Total dépensé</th>
                  <th className="text-right px-4 py-3">Solde dû</th>
                  <th className="text-left px-4 py-3">Client depuis</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    onClick={() => setSelectedCustomerId(customer.id)}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{customer.name}</td>
                    <td className="px-4 py-3 text-slate-500">{customer.phone || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-700">
                      {formatGNF(customer.totalSpent)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {customer.balanceDue > 0 ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-block rounded-full bg-red-50 text-red-700 px-2.5 py-0.5 text-xs font-semibold">
                            {formatGNF(customer.balanceDue)}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPayingCustomer(customer);
                            }}
                            disabled={isFrozen}
                            title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                            className="text-xs font-medium text-brand-600 hover:text-brand-700 underline disabled:opacity-40 disabled:cursor-not-allowed disabled:no-underline"
                          >
                            Payer le reste
                          </button>
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(customer.createdAt)}</td>
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
              Page {page} / {totalPages} ({total} clients)
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

      {selectedCustomerId && (
        <CustomerHistoryModal
          customerId={selectedCustomerId}
          onClose={() => setSelectedCustomerId(null)}
        />
      )}

      {payingCustomer && (
        <PayBalanceModal
          customer={payingCustomer}
          onClose={() => setPayingCustomer(null)}
          onSuccess={() => {
            setPayingCustomer(null);
            loadCustomers();
          }}
        />
      )}
    </div>
  );
}