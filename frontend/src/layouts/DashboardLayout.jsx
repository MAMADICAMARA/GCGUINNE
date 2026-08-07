import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { getNavForRole } from '@/routes/navigation';
import PlanStatusBanner from '@/components/PlanStatusBanner';
import VoidReturnPermissionSync from '@/components/VoidReturnPermissionSync';

export default function DashboardLayout() {
  const { user, activeStore, stores, logout, canVoidReturn } = useAuthStore();
  const navItems = getNavForRole(activeStore?.roleCode, canVoidReturn);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
        className={`fixed inset-y-0 left-0 z-40 w-60 h-screen shrink-0 bg-brand-700 text-white flex flex-col
          transform transition-transform duration-200 ease-in-out
          md:sticky md:top-0 md:self-start md:translate-x-0
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="px-5 py-5 border-b border-white/10 flex items-start justify-between">
          <div>
            <p className="text-sm text-brand-100">Boutique active</p>
            <p className="font-semibold truncate">{activeStore?.name || '—'}</p>
            {stores.length > 1 && (
              <Link
                to="/account/store"
                className="mt-1 inline-block text-xs text-brand-100 hover:text-white underline"
                onClick={() => setIsMenuOpen(false)}
              >
                Changer de boutique
              </Link>
            )}
          </div>
          {/* Bouton fermer, visible uniquement sur mobile */}
          <button
            onClick={() => setIsMenuOpen(false)}
            className="md:hidden text-brand-100 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'bg-white text-brand-700'
                    : 'text-brand-100 hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10">
          <Link
            to="/account"
            className="text-xs text-brand-100 hover:text-white underline block mb-2"
            onClick={() => setIsMenuOpen(false)}
          >
            ← Mon compte
          </Link>
          <p className="text-sm font-medium">{user?.fullName}</p>
          <p className="text-xs text-brand-100">{activeStore?.roleCode}</p>
          <button
            onClick={logout}
            className="mt-2 text-xs text-brand-100 hover:text-white underline"
          >
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barre supérieure mobile avec bouton hamburger */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200">
          <button
            onClick={() => setIsMenuOpen(true)}
            className="text-slate-700"
          >
            <Menu size={24} />
          </button>
          <p className="font-semibold text-slate-800 truncate">
            {activeStore?.name || '—'}
          </p>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <VoidReturnPermissionSync roleCode={activeStore?.roleCode} />
          <PlanStatusBanner roleCode={activeStore?.roleCode} />
          <Outlet />
        </main>
      </div>
    </div>
  );
}