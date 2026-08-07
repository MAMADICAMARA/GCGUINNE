import { useEffect, useState } from 'react';
import { Store } from 'lucide-react';
import apiClient from '@/services/apiClient';
import StorePlanModal from './StorePlanModal';

export default function AdminStoresPage() {
  const [stores, setStores] = useState([]);
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState(null);
  const [managingPlanStore, setManagingPlanStore] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/stores', {
        params: { status, search },
      });
      setStores(data.stores);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les boutiques.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function toggleStatus(store) {
    setActingId(store.id);
    try {
      const action = store.status === 'SUSPENDED' ? 'reactivate' : 'suspend';
      await apiClient.post(`/admin/stores/${store.id}/${action}`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action impossible.');
    } finally {
      setActingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Store size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Boutiques</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Toutes les boutiques de la plateforme, tous clients confondus.
      </p>

      <div className="flex flex-wrap gap-3 mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Rechercher (nom boutique ou e-mail propriétaire)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-80 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ALL">Tous les statuts</option>
          <option value="ACTIVE">Actives</option>
          <option value="SUSPENDED">Suspendues</option>
          <option value="TRIAL">Essai</option>
        </select>
        <button
          onClick={load}
          className="rounded-lg bg-slate-800 text-white text-sm font-medium px-4 py-2 hover:bg-slate-900"
        >
          Filtrer
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Chargement...</p>
        ) : stores.length === 0 ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Aucune boutique trouvée.</p>
        ) : (
          <>
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {stores.map((store) => (
                <div key={store.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{store.name}</p>
                      <p className="text-xs text-slate-400">{store.city || '—'}</p>
                    </div>
                    <span
                      className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        store.status === 'ACTIVE'
                          ? 'bg-green-50 text-green-700'
                          : store.status === 'SUSPENDED'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {store.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 mt-2 truncate">{store.ownerName}</p>
                  <p className="text-xs text-slate-400 truncate">{store.ownerEmail}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-sm text-slate-600">
                      {store.planName || '—'}{' '}
                      <button
                        onClick={() => setManagingPlanStore(store)}
                        className="text-xs font-medium text-brand-500"
                      >
                        Gérer
                      </button>
                    </span>
                    <button
                      onClick={() => toggleStatus(store)}
                      disabled={actingId === store.id}
                      className="text-xs font-medium text-slate-600 underline disabled:opacity-50"
                    >
                      {actingId === store.id
                        ? '...'
                        : store.status === 'SUSPENDED'
                          ? 'Réactiver'
                          : 'Suspendre'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Boutique</th>
                  <th className="text-left px-4 py-3">Propriétaire</th>
                  <th className="text-left px-4 py-3">Plan</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {stores.map((store) => (
                  <tr key={store.id} className="border-t border-slate-100">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{store.name}</p>
                      <p className="text-xs text-slate-400">{store.city || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-700">{store.ownerName}</p>
                      <p className="text-xs text-slate-400">{store.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <p>{store.planName || '—'}</p>
                      <button
                        onClick={() => setManagingPlanStore(store)}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        Gérer
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          store.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700'
                            : store.status === 'SUSPENDED'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {store.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(store)}
                        disabled={actingId === store.id}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 underline disabled:opacity-50"
                      >
                        {actingId === store.id
                          ? '...'
                          : store.status === 'SUSPENDED'
                            ? 'Réactiver'
                            : 'Suspendre'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {managingPlanStore && (
        <StorePlanModal
          store={managingPlanStore}
          onClose={() => setManagingPlanStore(null)}
          onChanged={() => {
            setManagingPlanStore(null);
            load();
          }}
        />
      )}
    </div>
  );
}