import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { formatGNF, formatDate } from '@/utils/format';
import {
  LayoutDashboard,
  CalendarDays,
  Coins,            // ← remplace DollarSign
  Wallet,
  ShoppingBag,
  Package,
  AlertCircle,
  BarChart3,
  Crown,
  Users,
  Store,
} from 'lucide-react';

export default function DashboardPage() {
  const activeStore = useAuthStore((s) => s.activeStore);
  const isOwner = activeStore?.roleCode === 'OWNER';
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/dashboard/stats');
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
  }, [activeStore]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-400">Chargement…</p>;

  const maxTrend = Math.max(1, ...stats.revenueTrend.map((d) => Number(d.revenue)));

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="h-6 w-6 text-brand-500" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold text-slate-800">Tableau de bord</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-200/60">
          <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
          <span>Aujourd'hui</span>
          <span className="w-px h-4 bg-slate-200 mx-2" />
          <Store className="h-4 w-4" strokeWidth={1.5} />
          <span className="font-medium text-slate-700">{activeStore?.name}</span>
        </div>
      </div>

      {/* Cartes indicateurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label={isOwner ? 'Ventes du jour' : 'Mes ventes du jour'}
          value={formatGNF(stats.today.revenue)}
          icon={Coins}                 // ← icône neutre
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        {stats.today.profit !== null && (
          <StatCard
            label="Bénéfice du jour"
            value={formatGNF(stats.today.profit)}
            icon={Wallet}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-600"
            accent="green"
          />
        )}
        <StatCard
          label={isOwner ? 'Commandes' : 'Mes commandes'}
          value={stats.today.ordersCount}
          icon={ShoppingBag}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          label={isOwner ? 'Articles vendus' : 'Mes articles vendus'}
          value={stats.today.itemsSold}
          icon={Package}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          label="Produits en rupture"
          value={stats.lowStockCount}
          icon={AlertCircle}
          iconBg={stats.lowStockCount > 0 ? 'bg-rose-50' : 'bg-slate-50'}
          iconColor={stats.lowStockCount > 0 ? 'text-rose-600' : 'text-slate-400'}
          accent={stats.lowStockCount > 0 ? 'red' : undefined}
        />
      </div>

      {/* Graphiques et listes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution des ventes */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-brand-500" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-slate-700">
              {isOwner ? 'Évolution des ventes' : 'Évolution de mes ventes'}{' '}
              <span className="font-normal text-slate-400">(7 derniers jours)</span>
            </h2>
          </div>
          {stats.revenueTrend.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
          ) : (
            <div className="flex items-end gap-2 h-32">
              {stats.revenueTrend.map((d) => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-gradient-to-t from-brand-400 to-brand-300 rounded-t-md transition-all duration-300 hover:opacity-80"
                    style={{ height: `${Math.max(4, (Number(d.revenue) / maxTrend) * 100)}%` }}
                    title={formatGNF(d.revenue)}
                  />
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide">
                    {formatDate(d.day).slice(0, 5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Produits les plus vendus */}
        <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
          <div className="flex items-center gap-2 mb-4">
            <Crown className="h-5 w-5 text-amber-500" strokeWidth={1.75} />
            <h2 className="text-sm font-semibold text-slate-700">
              {isOwner ? 'Produits les plus vendus' : 'Mes produits les plus vendus'}{' '}
              <span className="font-normal text-slate-400">(30 derniers jours)</span>
            </h2>
          </div>
          {stats.topProducts.length === 0 ? (
            <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
          ) : (
            <ul className="space-y-2">
              {stats.topProducts.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                  <span className="text-slate-600 flex items-center gap-2">
                    <span className="text-slate-300 font-mono text-xs w-5 text-right">#{i + 1}</span>
                    {p.name}
                  </span>
                  <span className="font-medium text-slate-800 bg-slate-100 px-3 py-0.5 rounded-full text-xs">
                    {p.totalSold} vendus
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Performance par vendeur */}
        {stats.bySeller && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm hover:shadow-md transition-shadow duration-200 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-indigo-500" strokeWidth={1.75} />
              <h2 className="text-sm font-semibold text-slate-700">
                Performance par vendeur <span className="font-normal text-slate-400">(30 derniers jours)</span>
              </h2>
            </div>
            {stats.bySeller.length === 0 ? (
              <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
            ) : (
              <>
                {/* Vue mobile : cartes empilées (< md) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {stats.bySeller.map((s) => (
                    <div key={s.sellerId} className="flex items-center justify-between py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-semibold shrink-0">
                          {s.sellerName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-slate-700 truncate">{s.sellerName}</span>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium text-slate-800">{formatGNF(s.revenue)}</p>
                        <p className="text-xs text-slate-400">
                          {s.ordersCount} commande{s.ordersCount > 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vue desktop : tableau complet (dès md) */}
                <table className="hidden md:table w-full text-sm">
                  <thead className="text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="text-left py-3 font-medium">Vendeur</th>
                      <th className="text-right py-3 font-medium">Commandes</th>
                      <th className="text-right py-3 font-medium">Chiffre d'affaires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.bySeller.map((s) => (
                      <tr key={s.sellerId} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 text-slate-700 flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 text-xs font-semibold">
                            {s.sellerName.charAt(0).toUpperCase()}
                          </div>
                          {s.sellerName}
                        </td>
                        <td className="py-3 text-right text-slate-600">{s.ordersCount}</td>
                        <td className="py-3 text-right font-medium text-slate-800">
                          {formatGNF(s.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, accent }) {
  const accentClass =
    accent === 'green'
      ? 'text-emerald-700'
      : accent === 'red'
      ? 'text-rose-600'
      : 'text-slate-800';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-start justify-between">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</p>
      </div>
      <div className={`${iconBg} rounded-xl p-2.5`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.75} />
      </div>
    </div>
  );
}