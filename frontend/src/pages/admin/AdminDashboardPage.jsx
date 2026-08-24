import { useEffect, useState } from 'react';
import {
  Ban,
  Clock3,
  Crown,
  Gem,
  LayoutDashboard,
  Sparkles,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';
import apiClient from '@/services/apiClient';

// Même palette que StatCard du Tableau de bord boutique
// (DashboardPage.jsx) — cohérence visuelle entre l'espace Super Admin et
// l'espace boutique, seule la teinte de fond du layout (slate-900) change.
const STATUS_META = {
  ACTIVE: { label: 'Actives', icon: UserCheck, color: 'emerald' },
  SUSPENDED: { label: 'Suspendues', icon: Ban, color: 'rose' },
  TRIAL: { label: "À l'essai", icon: Clock3, color: 'amber' },
};

const PLAN_META = {
  FREEMIUM: { icon: Sparkles, color: 'slate' },
  STANDARD: { icon: Gem, color: 'blue' },
  PROFESSIONNEL: { icon: Crown, color: 'violet' },
};

const COLOR_CLASSES = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-500' },
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
  rose: { bg: 'bg-rose-50', text: 'text-rose-600', bar: 'bg-rose-500' },
  slate: { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-400' },
};

function StatCard({ label, value, icon: Icon, color }) {
  const c = COLOR_CLASSES[color];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 flex items-center gap-4">
      <div className={`h-11 w-11 shrink-0 rounded-lg ${c.bg} ${c.text} flex items-center justify-center`}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-400 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-semibold text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function BreakdownCard({ title, icon: TitleIcon, rows, total }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-4">
        <TitleIcon size={16} className="text-slate-400" />
        {title}
      </h2>
      <ul className="space-y-3.5">
        {rows.map((row) => {
          const c = COLOR_CLASSES[row.color];
          const percent = total > 0 ? Math.round((row.count / total) * 100) : 0;
          return (
            <li key={row.key}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="flex items-center gap-2 text-slate-600">
                  <row.icon size={15} className={c.text} />
                  {row.label}
                </span>
                <span className="font-semibold text-slate-800">{row.count}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

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

  const activeCount = stats.storesByStatus.find((r) => r.status === 'ACTIVE')?.count || 0;
  const suspendedCount = stats.storesByStatus.find((r) => r.status === 'SUSPENDED')?.count || 0;

  const statusRows = stats.storesByStatus.map((row) => {
    const meta = STATUS_META[row.status] || { label: row.status, icon: Store, color: 'slate' };
    return { key: row.status, label: meta.label, icon: meta.icon, color: meta.color, count: row.count };
  });
  const statusTotal = statusRows.reduce((sum, r) => sum + r.count, 0);

  const planRows = stats.storesByPlan.map((row) => {
    const meta = PLAN_META[row.planName] || { icon: Store, color: 'slate' };
    return { key: row.planName, label: row.planName, icon: meta.icon, color: meta.color, count: row.count };
  });
  const planTotal = planRows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-6">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-slate-900 text-white flex items-center justify-center">
          <LayoutDashboard size={17} strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Tableau de bord</h1>
          <p className="text-sm text-slate-500">Vue d'ensemble de la plateforme, tous clients confondus.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Boutiques" value={stats.totalStores} icon={Store} color="blue" />
        <StatCard label="Utilisateurs" value={stats.totalUsers} icon={Users} color="violet" />
        <StatCard label="Actives" value={activeCount} icon={UserCheck} color="emerald" />
        <StatCard label="Suspendues" value={suspendedCount} icon={Ban} color="rose" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BreakdownCard title="Boutiques par statut" icon={Store} rows={statusRows} total={statusTotal} />
        <BreakdownCard title="Boutiques par plan" icon={Crown} rows={planRows} total={planTotal} />
      </div>
    </div>
  );
}
