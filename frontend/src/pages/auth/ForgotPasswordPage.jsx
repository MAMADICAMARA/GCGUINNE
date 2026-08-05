import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '@/services/apiClient';

/**
 * Mot de passe oublié, en 2 étapes (§6.2 du cahier des charges "Système
 * d'envoi d'e-mails transactionnels", décidé en conversation).
 *
 * Règle de sécurité centrale (§6.2.2) : la réponse de l'étape 1 est
 * strictement identique que l'e-mail existe ou non — l'écran passe donc
 * TOUJOURS à l'étape 2 après un envoi réussi, sans jamais indiquer si un
 * code a réellement été envoyé ou non. Pas de connexion automatique à la
 * fin (contrairement à VerifyEmailPage) : l'utilisateur doit se reconnecter
 * avec son nouveau mot de passe, cf. §6.2.3.
 */
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('REQUEST'); // 'REQUEST' | 'RESET' | 'DONE'
  const [email, setEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequest(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await apiClient.post('/auth/request-password-reset', { email });
      setRequestMessage(data.message);
      setStep('RESET');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Une erreur est survenue. Réessayez.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== newPasswordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/auth/reset-password', {
        email,
        code,
        newPassword,
        newPasswordConfirm,
      });
      setStep('DONE');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'DONE') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold text-slate-800">Mot de passe mis à jour</h2>
        <p className="text-sm text-slate-500">Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.</p>
        <Link
          to="/login"
          className="inline-block rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (step === 'RESET') {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">Réinitialiser le mot de passe</h2>
        {requestMessage && <p className="text-sm text-slate-500">{requestMessage}</p>}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Code reçu par e-mail</label>
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

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Nouveau mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Au moins 6 caractères"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Confirmer le mot de passe</label>
          <input
            type="password"
            required
            minLength={6}
            value={newPasswordConfirm}
            onChange={(e) => setNewPasswordConfirm(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Retapez le mot de passe"
          />
        </div>

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
        >
          {loading ? 'Validation...' : 'Réinitialiser le mot de passe'}
        </button>

        <button
          type="button"
          onClick={() => setStep('REQUEST')}
          className="w-full text-sm text-slate-400 hover:text-slate-600"
        >
          ← Utiliser un autre e-mail
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleRequest} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Mot de passe oublié</h2>
      <p className="text-sm text-slate-500">
        Entrez votre adresse e-mail — si un compte y est associé, un code de réinitialisation vous sera envoyé.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
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

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
      >
        {loading ? 'Envoi...' : 'Envoyer le code'}
      </button>

      <p className="text-center text-sm text-slate-500">
        <Link to="/login" className="text-brand-500 font-medium hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
