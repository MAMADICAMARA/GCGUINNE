import { useEffect, useState } from 'react';
import { ScrollText } from 'lucide-react';
import apiClient from '@/services/apiClient';
import AuditLogTable from '@/components/AuditLogTable';

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
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <ScrollText size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Journal d'audit</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Actions sensibles de toute la plateforme — lecture seule, jamais modifiable.
      </p>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <AuditLogTable logs={logs} loading={loading} showStore />
    </div>
  );
}