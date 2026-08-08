import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-700 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-white font-bold text-lg mb-3">
            GC
          </div>
          <h1 className="text-white text-xl font-semibold">
            Gestion Commerciale
          </h1>
          <p className="text-brand-100 text-sm">
            Connectez-vous pour accéder à votre tableau de bord
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
