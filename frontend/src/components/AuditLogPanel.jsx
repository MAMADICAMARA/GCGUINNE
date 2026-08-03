import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import AuditLogTable from '@/components/AuditLogTable';
import { ACTION_GROUPS, actionLabel } from '@/utils/auditLogLabels';

/**
 * Panneau complet du journal d'activité (filtre, pagination, case à
 * cocher "afficher les connexions") — un seul composant, deux points
 * d'entrée : AuditLogPage.jsx (boutique propre) et l'onglet Journal de
 * SupervisedStoreDetailPage.jsx (boutique supervisée). Seule différence
 * entre les deux : l'URL interrogée, passée en prop. Décidé en
 * conversation pour ne pas dupliquer cette logique à deux endroits.
 */
export default function AuditLogPanel({ endpoint }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState('');
  const [includeLogins, setIncludeLogins] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { data } = await apiClient.get(endpoint, {
          params: { page, limit: 20, action: action || undefined, includeLogins },
        });
        if (cancelled) return;
        setLogs(data.logs);
        setPages(data.pages);
        setTotal(data.total);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger le journal.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [endpoint, page, action, includeLogins]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={action}
          onChange={(e) => {
            setPage(1);
            setAction(e.target.value);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Toutes les actions</option>
          {ACTION_GROUPS.filter((g) => includeLogins || g.label !== 'Connexion').map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.actions.map((a) => (
                <option key={a} value={a}>
                  {actionLabel(a)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={includeLogins}
            onChange={(e) => {
              setPage(1);
              setIncludeLogins(e.target.checked);
              if (!e.target.checked && action === 'LOGIN') setAction('');
            }}
            className="rounded border-slate-300"
          />
          Afficher les connexions
        </label>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <AuditLogTable logs={logs} loading={loading} />

      {!loading && total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
          <span>
            Page {page} / {pages} ({total} entrée{total > 1 ? 's' : ''})
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              ← Précédent
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40 hover:bg-slate-50 transition"
            >
              Suivant →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
