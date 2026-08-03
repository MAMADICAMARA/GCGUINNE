import AuditLogPanel from '@/components/AuditLogPanel';

/**
 * Journal d'activité de la boutique active (§ décidé en conversation, en
 * même temps que la supervision enrichie) — réservée à l'Owner
 * (routes/navigation.js), voir ce que font ses employés (ventes,
 * annulations, ajustements de stock...). Lecture seule stricte, comme la
 * table system_logs elle-même (immuable au niveau base).
 */
export default function AuditLogPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Journal d'activité</h1>
      <p className="text-sm text-slate-500 mb-6">
        Actions de votre équipe dans cette boutique — lecture seule.
      </p>

      <AuditLogPanel endpoint="/stores/audit-log" />
    </div>
  );
}
