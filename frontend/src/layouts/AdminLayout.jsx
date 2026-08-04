import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/apiClient';

const NAV_ITEMS = [
  { path: '/admin', label: 'Tableau de bord' },
  { path: '/admin/stores', label: 'Boutiques' },
  { path: '/admin/users', label: 'Utilisateurs' },
  { path: '/admin/audit-log', label: "Journal d'audit" },
  { path: '/admin/plans', label: "Plans d'abonnement" },
  { path: '/admin/payment-requests', label: 'Demandes de paiement' },
  { path: '/admin/store-types', label: 'Types de boutique' },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const [pendingPaymentRequests, setPendingPaymentRequests] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/admin/payment-requests', {
          params: { status: 'PENDING', limit: 1 },
        });
        if (!cancelled) setPendingPaymentRequests(data.total);
      } catch {
        // Silencieux : un badge qui ne charge pas ne doit jamais bloquer
        // le reste de la navigation admin.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col">
        <div className="px-5 py-5 border-b border-white/10">
          <p className="text-xs uppercase tracking-wide text-amber-400 font-semibold">
            Super Admin
          </p>
          <p className="font-semibold truncate">{user?.fullName}</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'
                }`
              }
            >
              <span>{item.label}</span>
              {item.path === '/admin/payment-requests' && pendingPaymentRequests > 0 && (
                <span className="rounded-full bg-amber-500 text-white text-xs font-semibold px-2 py-0.5">
                  {pendingPaymentRequests}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <button onClick={logout} className="text-xs text-slate-300 hover:text-white underline">
            Se déconnecter
          </button>
        </div>
      </aside>

      <main className="flex-1 p-6 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}