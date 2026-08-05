import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { formatGNF, formatDateTime } from '@/utils/format';
import CashDrawerDetailModal from './CashDrawerDetailModal';

/**
 * Historique des sessions de caisse (§30_fond_de_caisse.sql, décidé en
 * conversation — §B2 SOLUTIONS_AUDIT_PRODUCTION.md). Le Owner voit toute
 * l'équipe (supervision des écarts) ; un Vendeur ne voit que ses propres
 * sessions (scoping fait côté serveur, même principe que l'historique des
 * ventes).
 */
export default function CashDrawerHistoryPage() {
  const roleCode = useAuthStore((s) => s.activeStore?.roleCode);
  const [drawers, setDrawers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewingDrawerId, setViewingDrawerId] = useState(null);

  async function loadDrawers() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/cash-drawers', { params: { page, limit } });
      setDrawers(data.drawers);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de charger l'historique des caisses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrawers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Historique des caisses</h1>
      <p className="text-sm text-slate-500 mb-6">
        {roleCode === 'OWNER'
          ? "Sessions de caisse de toute l'équipe."
          : 'Vos sessions de caisse.'}
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : drawers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucune session de caisse pour l'instant.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Vendeur</th>
                  <th className="text-left px-4 py-3">Ouverte le</th>
                  <th className="text-right px-4 py-3">Fond départ</th>
                  <th className="text-right px-4 py-3">Théorique</th>
                  <th className="text-right px-4 py-3">Compté</th>
                  <th className="text-right px-4 py-3">Écart</th>
                  <th className="text-left px-4 py-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {drawers.map((d) => (
                  <tr
                    key={d.id}
                    onClick={() => setViewingDrawerId(d.id)}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">{d.userFullName}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(d.openingTime)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatGNF(d.openingBalance)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatGNF(d.expectedBalance)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {d.closingBalance != null ? formatGNF(d.closingBalance) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {d.discrepancy == null ? (
                        '—'
                      ) : (
                        <span className={d.discrepancy === 0 ? 'text-green-600' : 'text-amber-600 font-medium'}>
                          {d.discrepancy === 0 ? '0' : formatGNF(d.discrepancy)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          d.status === 'OPEN' ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {d.status === 'OPEN' ? 'Ouverte' : 'Fermée'}
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
              Page {page} / {totalPages} ({total} session(s))
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

      {viewingDrawerId && (
        <CashDrawerDetailModal drawerId={viewingDrawerId} onClose={() => setViewingDrawerId(null)} />
      )}
    </div>
  );
}
