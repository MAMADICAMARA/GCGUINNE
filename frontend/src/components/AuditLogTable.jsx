import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { formatDateTime } from '@/utils/format';
import { actionLabel, formatLogDetails } from '@/utils/auditLogLabels';

/**
 * Tableau du journal d'activité — partagé entre la boutique propre de
 * l'Owner et une boutique supervisée, tous deux via AuditLogPanel qui
 * appelle le même utilitaire backend (backend/src/utils/auditLog.js) et
 * affiche le même format de résultat. Lecture seule stricte (system_logs
 * est immuable).
 *
 * Responsive : tableau complet dès md:, accordéon sur mobile
 * (Utilisateur + Action visibles, Date + Détails révélés au clic).
 */
export default function AuditLogTable({ logs, loading }) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-400 text-sm">
        Chargement...
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-center text-slate-400 text-sm">
        Aucune activité pour l'instant.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Vue mobile : accordéon (< md) */}
      <div className="md:hidden divide-y divide-slate-100">
        {logs.map((log) => {
          const details = formatLogDetails(log.action, log.details);
          const isOpen = expandedIds.has(log.id);
          return (
            <div key={log.id}>
              <button
                type="button"
                onClick={() => toggleExpanded(log.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <p className="text-sm text-slate-700 truncate">
                    {log.userFullName || log.userEmail || '—'}
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
                    {actionLabel(log.action)}
                  </span>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isOpen && (
                <div className="px-4 pb-3 -mt-1 space-y-1.5 text-sm">
                  <p className="text-slate-500">
                    <span className="text-slate-400">Date : </span>
                    {formatDateTime(log.createdAt)}
                  </p>
                  <p className="text-slate-500">
                    <span className="text-slate-400">Détails : </span>
                    {details || '—'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Vue desktop : tableau complet (dès md) */}
      <table className="hidden md:table w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
          <tr>
            <th className="text-left px-4 py-3">Date</th>
            <th className="text-left px-4 py-3">Action</th>
            <th className="text-left px-4 py-3">Détails</th>
            <th className="text-left px-4 py-3">Utilisateur</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
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
          })}
        </tbody>
      </table>
    </div>
  );
}


// import { formatDateTime } from '@/utils/format';
// import { actionLabel, formatLogDetails } from '@/utils/auditLogLabels';

// /**
//  * Tableau du journal d'activité — partagé entre la boutique propre de
//  * l'Owner et une boutique supervisée, tous deux via AuditLogPanel qui
//  * appelle le même utilitaire backend (backend/src/utils/auditLog.js) et
//  * affiche le même format de résultat. Lecture seule stricte (system_logs
//  * est immuable).
//  */
// export default function AuditLogTable({ logs, loading }) {
//   return (
//     <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
//       <table className="w-full text-sm">
//         <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
//           <tr>
//             <th className="text-left px-4 py-3">Date</th>
//             <th className="text-left px-4 py-3">Action</th>
//             <th className="text-left px-4 py-3">Détails</th>
//             <th className="text-left px-4 py-3">Utilisateur</th>
//           </tr>
//         </thead>
//         <tbody>
//           {loading ? (
//             <tr>
//               <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
//                 Chargement...
//               </td>
//             </tr>
//           ) : logs.length === 0 ? (
//             <tr>
//               <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
//                 Aucune activité pour l'instant.
//               </td>
//             </tr>
//           ) : (
//             logs.map((log) => {
//               const details = formatLogDetails(log.action, log.details);
//               return (
//                 <tr key={log.id} className="border-t border-slate-100">
//                   <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
//                     {formatDateTime(log.createdAt)}
//                   </td>
//                   <td className="px-4 py-3">
//                     <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-xs font-medium">
//                       {actionLabel(log.action)}
//                     </span>
//                   </td>
//                   <td className="px-4 py-3 text-slate-500">{details || '—'}</td>
//                   <td className="px-4 py-3 text-slate-600">
//                     {log.userFullName || log.userEmail || '—'}
//                   </td>
//                 </tr>
//               );
//             })
//           )}
//         </tbody>
//       </table>
//     </div>
//   );
// }
