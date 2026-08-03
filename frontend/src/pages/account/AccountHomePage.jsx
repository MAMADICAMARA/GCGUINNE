import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

export default function AccountHomePage() {
  const { user, stores } = useAuthStore();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        Bonjour {user?.fullName?.split(' ')[0] || ''} 👋
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Bienvenue sur votre espace de gestion.
      </p>

      {user?.isSuperAdmin && (
        <Link
          to="/admin"
          className="block rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 hover:bg-amber-100 transition"
        >
          <p className="text-sm font-semibold text-amber-800">
            Administration de la plateforme
          </p>
          <p className="text-xs text-amber-700">
            Boutiques, journal d'audit, plans d'abonnement — accès Super Admin
          </p>
        </Link>
      )}

      {stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600 mb-4">
            Vous n'avez pas encore de boutique. Créez-la pour commencer à
            gérer vos produits, votre stock et vos ventes.
          </p>
          <Link
            to="/account/store"
            className="inline-block rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition"
          >
            Créer ma boutique
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">
            Vous gérez {stores.length} boutique{stores.length > 1 ? 's' : ''}.
            Rendez-vous dans{' '}
            <Link to="/account/store" className="text-brand-500 font-medium hover:underline">
              Ma Boutique
            </Link>{' '}
            pour l'ouvrir ou en créer une autre.
          </p>
        </div>
      )}
    </div>
  );
}