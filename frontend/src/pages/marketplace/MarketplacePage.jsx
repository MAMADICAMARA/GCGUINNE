import { Link } from 'react-router-dom';
import { Store, LogIn, UserPlus, ShoppingBag } from 'lucide-react';
import MarketplaceGrid from './MarketplaceGrid';

/**
 * Page publique MARCHÉ (§5/§9 du cahier des charges) — atteinte sans
 * connexion, quand l'interrupteur plateforme est activé. Habillage
 * volontairement autonome (pas de barre latérale, rien à apprendre) : un
 * visiteur qui découvre la plateforme pour la première fois doit
 * comprendre en un coup d'œil où il est et quoi faire ensuite — d'où les
 * 3 onglets gros, avec icônes, jamais un petit lien discret.
 */
export default function MarketplacePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="h-9 w-9 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
              GC
            </div>
            <div>
              <p className="font-semibold text-slate-800 leading-tight">Gestion Commerciale</p>
              <p className="text-xs text-slate-400 leading-tight">Le marché de nos boutiques</p>
            </div>
          </div>

          <nav className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500 text-white text-sm font-medium px-4 py-2">
              <ShoppingBag size={16} strokeWidth={2} />
              Marché
            </span>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
            >
              <UserPlus size={16} strokeWidth={2} />
              Inscription
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
            >
              <LogIn size={16} strokeWidth={2} />
              Connexion
            </Link>
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-2 mb-5">
          <Store className="h-5 w-5 text-brand-500" strokeWidth={1.75} />
          <h1 className="text-xl font-semibold text-slate-800">Découvrez nos boutiques</h1>
        </div>
        <MarketplaceGrid />
      </main>
    </div>
  );
}
