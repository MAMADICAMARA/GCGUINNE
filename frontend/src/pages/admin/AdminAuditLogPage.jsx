import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

export default function AdminAuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/admin/audit-log', { params: { limit: 50 } });
        if (!cancelled) setLogs(data.logs);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Impossible de charger le journal.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Journal d'audit</h1>
      <p className="text-sm text-slate-500 mb-6">
        Actions sensibles de toute la plateforme — lecture seule, jamais modifiable.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Chargement...</p>
        ) : logs.length === 0 ? (
          <p className="px-4 py-6 text-center text-slate-400 text-sm">Aucune entrée.</p>
        ) : (
          <>
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {logs.map((log) => (
                <div key={log.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                      {log.action}
                    </span>
                    <span className="shrink-0 text-xs text-slate-400 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    {log.userEmail || '—'} · {log.storeName || '—'}
                  </p>
                </div>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Utilisateur</th>
                  <th className="text-left px-4 py-3">Boutique</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('fr-FR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{log.userEmail || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{log.storeName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}