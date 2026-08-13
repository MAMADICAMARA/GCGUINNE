import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNeedsVerification(false);
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/login', { email, password });
      setSession(data);
      // On atterrit toujours dans l'espace "compte" ; c'est depuis "Ma
      // Boutique" que l'utilisateur choisit/crée une boutique et entre
      // ensuite dans l'espace opérationnel (§4.1 vs §4.2 du cahier des
      // charges — les deux espaces sont volontairement découplés).
      // `tutorialTrigger: 'login'` (§36_tutoriel.sql, décidé en
      // conversation) : signal éphémère, jamais persistant, qui permet à
      // AccountHomePage de proposer le tutoriel après CHAQUE connexion
      // normale (si le Super Admin l'a activé) — sans lui, la page ne
      // saurait pas distinguer une vraie connexion d'une simple navigation
      // interne vers /account.
      navigate('/account', { state: { tutorialTrigger: 'login' } });
    } catch (err) {
      // Compte existant mais pas encore vérifié (§ cahier des charges
      // "Système d'envoi d'e-mails transactionnels", décidé en
      // conversation) — redirige directement vers l'écran de code plutôt
      // que de laisser un message d'erreur sans issue.
      if (err.response?.data?.error?.code === 'EMAIL_NOT_VERIFIED') {
        setNeedsVerification(true);
      }
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
        <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          <p>{error}</p>
          {needsVerification && (
            <Link
              to="/verify-email"
              state={{ email }}
              className="inline-flex items-center gap-1 font-medium underline hover:no-underline"
            >
              Entrer le code de vérification <ChevronRight size={14} />
            </Link>
          )}
        </div>
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
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
            aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
          </button>
        </div>
        <div className="text-right mt-1">
          <Link to="/forgot-password" className="text-xs text-brand-500 hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>
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