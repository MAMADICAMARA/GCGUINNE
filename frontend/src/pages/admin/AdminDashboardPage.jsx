import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/admin/stats');
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Impossible de charger les statistiques.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!stats) {
    return <p className="text-sm text-slate-400">Chargement...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Tableau de bord</h1>
      <p className="text-sm text-slate-500 mb-6">Vue d'ensemble de la plateforme, tous clients confondus.</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Boutiques</p>
          <p className="text-2xl font-semibold text-slate-800">{stats.totalStores}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs text-slate-400 uppercase tracking-wide">Utilisateurs</p>
          <p className="text-2xl font-semibold text-slate-800">{stats.totalUsers}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Boutiques par statut</h2>
          <ul className="space-y-1.5">
            {stats.storesByStatus.map((row) => (
              <li key={row.status} className="flex justify-between text-sm">
                <span className="text-slate-600">{row.status}</span>
                <span className="font-medium text-slate-800">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Boutiques par plan</h2>
          <ul className="space-y-1.5">
            {stats.storesByPlan.map((row) => (
              <li key={row.planName} className="flex justify-between text-sm">
                <span className="text-slate-600">{row.planName}</span>
                <span className="font-medium text-slate-800">{row.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}