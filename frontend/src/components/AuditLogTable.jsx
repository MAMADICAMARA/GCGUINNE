import { formatDateTime } from '@/utils/format';
import { actionLabel, formatLogDetails } from '@/utils/auditLogLabels';

/**
 * Tableau du journal d'activité — partagé entre la boutique propre de
 * l'Owner et une boutique supervisée, tous deux via AuditLogPanel qui
 * appelle le même utilitaire backend (backend/src/utils/auditLog.js) et
 * affiche le même format de résultat. Lecture seule stricte (system_logs
 * est immuable).
 */
export default function AuditLogTable({ logs, loading }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Action</th>
            <th className="text-left px-4 py-3">Détails</th>
            <th className="text-left px-4 py-3">Utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                Chargement...
              </td>
            </tr>
          ) : logs.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                Aucune activité pour l'instant.
              </td>
            </tr>
          ) : (
            logs.map((log) => {
              const details = formatLogDetails(log.action, log.details);
              return (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                      {actionLabel(log.action)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{details || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {log.userFullName || log.userEmail || '—'}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
