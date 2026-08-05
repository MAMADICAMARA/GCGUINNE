import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

/**
 * Détail d'une session de caisse (§30_fond_de_caisse.sql, décidé en
 * conversation) — liste les ventes en espèces rattachées, pour aider à
 * comprendre un écart précis plutôt que de le constater sans explication.
 */
export default function CashDrawerDetailModal({ drawerId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/cash-drawers/${drawerId}`);
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger cette session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Détail de la session de caisse</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <Info label="Vendeur" value={data.drawer.userFullName} />
                <Info label="Statut" value={data.drawer.status === 'OPEN' ? 'Ouverte' : 'Fermée'} />
                <Info label="Ouverte le" value={formatDateTime(data.drawer.openingTime)} />
                {data.drawer.closingTime && <Info label="Fermée le" value={formatDateTime(data.drawer.closingTime)} />}
                <Info label="Fond de départ" value={formatGNF(data.drawer.openingBalance)} />
                <Info label="Solde théorique" value={formatGNF(data.drawer.expectedBalance)} />
                {data.drawer.closingBalance != null && (
                  <Info label="Solde compté" value={formatGNF(data.drawer.closingBalance)} />
                )}
                {data.drawer.discrepancy != null && (
                  <Info
                    label="Écart"
                    value={
                      data.drawer.discrepancy === 0
                        ? 'Aucun'
                        : `${formatGNF(Math.abs(data.drawer.discrepancy))} (${data.drawer.discrepancy > 0 ? 'excédent' : 'manque'})`
                    }
                  />
                )}
              </div>

              {data.drawer.note && (
                <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-md px-3 py-2 mb-4">
                  Note : {data.drawer.note}
                </p>
              )}

              <h3 className="text-sm font-semibold text-slate-700 mb-2">
                Ventes en espèces de cette session ({data.orders.length})
              </h3>
              {data.orders.length === 0 ? (
                <p className="text-sm text-slate-400">Aucune vente en espèces enregistrée durant cette session.</p>
              ) : (
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                      <tr>
                        <th className="text-left px-3 py-2">Commande</th>
                        <th className="text-right px-3 py-2">Encaissé</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.map((o) => (
                        <tr key={o.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-700">{o.orderNumber}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatGNF(o.amountPaid)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
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
