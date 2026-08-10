import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  CreditCard,
  LayoutDashboard,
  Menu,
  MessageCircleQuestion,
  ScrollText,
  Store,
  Tags,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/apiClient';

const NAV_ITEMS = [
  { path: '/admin', label: 'Tableau de bord', icon: LayoutDashboard },
  { path: '/admin/stores', label: 'Boutiques', icon: Store },
  { path: '/admin/users', label: 'Utilisateurs', icon: Users },
  { path: '/admin/audit-log', label: "Journal d'audit", icon: ScrollText },
  { path: '/admin/plans', label: "Plans d'abonnement", icon: CreditCard },
  { path: '/admin/payment-requests', label: 'Demandes de paiement', icon: Wallet },
  { path: '/admin/store-types', label: 'Types de boutique', icon: Tags },
  { path: '/admin/contact-messages', label: 'Messages', icon: MessageCircleQuestion },
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();
  const [pendingPaymentRequests, setPendingPaymentRequests] = useState(0);
  const [newContactMessages, setNewContactMessages] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
    (async () => {
      try {
        const { data } = await apiClient.get('/admin/contact-messages', {
          params: { status: 'NEW', limit: 1 },
        });
        if (!cancelled) setNewContactMessages(data.total);
      } catch {
        // Silencieux, même raison que ci-dessus.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Fond semi-transparent visible uniquement sur mobile, quand le menu est ouvert */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-max min-w-56 max-w-80 h-screen shrink-0 bg-slate-900 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:sticky md:top-0 md:self-start md:translate-x-0
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-amber-400 font-semibold">
              Super Admin
            </p>
            <p className="font-semibold truncate">{user?.fullName}</p>
          </div>
          {/* Bouton fermer, visible uniquement sur mobile */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden text-slate-300 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/admin'}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  isActive ? 'bg-white text-slate-900' : 'text-slate-300 hover:bg-white/10'
                }`
              }
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <item.icon size={17} className="shrink-0" />
                {item.label}
              </span>
              {item.path === '/admin/payment-requests' && pendingPaymentRequests > 0 && (
                <span className="rounded-full bg-amber-500 text-white text-xs font-semibold px-2 py-0.5">
                  {pendingPaymentRequests}
                </span>
              )}
              {item.path === '/admin/contact-messages' && newContactMessages > 0 && (
                <span className="rounded-full bg-brand-500 text-white text-xs font-semibold px-2 py-0.5">
                  {newContactMessages}
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

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure mobile avec bouton hamburger */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button onClick={() => setIsMenuOpen(true)} className="text-slate-700">
            <Menu size={24} />
          </button>
          <p className="font-semibold text-slate-800 truncate">Super Admin</p>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}