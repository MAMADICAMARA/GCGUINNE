import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Écran de vérification d'e-mail après inscription (§6.1 du cahier des
 * charges "Système d'envoi d'e-mails transactionnels", décidé en
 * conversation) — le compte reste PENDING_VERIFICATION tant que ce code
 * n'est pas validé ici, `login()` le refuse explicitement entre-temps.
 *
 * L'e-mail est pré-rempli depuis `location.state` (passé par RegisterPage
 * juste après l'inscription), mais reste modifiable : un rafraîchissement
 * de page perd cet état React, ce champ garantit que la page fonctionne
 * quand même plutôt que de dépendre uniquement de la navigation d'origine.
 */
export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [verifying, setVerifying] = useState(false);

  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleVerify(e) {
    e.preventDefault();
    setError('');
    setVerifying(true);
    try {
      const { data } = await apiClient.post('/auth/verify-email', { email, code });
      setSession(data);
      navigate('/account');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Code invalide ou expiré.');
    } finally {
      setVerifying(false);
    }
  }

  async function handleResend() {
    setError('');
    setResendMessage('');
    setResending(true);
    try {
      const { data } = await apiClient.post('/auth/resend-verification-code', { email });
      setResendMessage(data.message);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Renvoi impossible pour le moment.');
    } finally {
      setResending(false);
    }
  }

  return (
    <form onSubmit={handleVerify} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Vérifiez votre e-mail</h2>
      <p className="text-sm text-slate-500">
        Entrez le code à 6 chiffres envoyé à votre adresse e-mail pour activer votre compte.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}
      {resendMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
          {resendMessage}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="vous@exemple.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Code de vérification</label>
        <input
          required
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="000000"
        />
      </div>

      <button
        type="submit"
        disabled={verifying || code.length !== 6}
        className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
      >
        {verifying ? 'Vérification...' : 'Vérifier'}
      </button>

      <button
        type="button"
        onClick={handleResend}
        disabled={resending || cooldown > 0 || !email}
        className="w-full text-sm text-brand-500 font-medium hover:underline disabled:opacity-50 disabled:no-underline"
      >
        {cooldown > 0 ? `Renvoyer le code (${cooldown}s)` : resending ? 'Envoi...' : 'Renvoyer le code'}
      </button>

      <p className="text-center text-sm text-slate-500">
        <Link to="/login" className="text-brand-500 font-medium hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
