import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // TODO: endpoint réel à brancher sur le backend (POST /auth/login)
      const { data } = await apiClient.post('/auth/login', { email, password });
      setSession(data);
      // On atterrit toujours dans l'espace "compte" ; c'est depuis "Ma
      // Boutique" que l'utilisateur choisit/crée une boutique et entre
      // ensuite dans l'espace opérationnel (§4.1 vs §4.2 du cahier des
      // charges — les deux espaces sont volontairement découplés).
      navigate('/account');
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          'Connexion impossible. Vérifiez vos identifiants.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Connexion</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          E-mail
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="vous@boutique.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Mot de passe
        </label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
      >
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Pas encore de compte ?{' '}
        <Link to="/register" className="text-brand-500 font-medium hover:underline">
          Créer mon compte
        </Link>
      </p>
    </form>
  );
}