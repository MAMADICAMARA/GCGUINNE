import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';

const initialForm = {
  fullName: '',
  email: '',
  password: '',
  passwordConfirm: '',
  phone: '',
  gender: '',
  birthDate: '',
};

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Vérification côté client, en plus de celle du serveur (qui reste la
    // seule qui compte réellement) : évite un aller-retour réseau inutile
    // pour une erreur de saisie évidente.
    if (form.password !== form.passwordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    try {
      // Le compte est créé PENDING_VERIFICATION (§6.1 du cahier des
      // charges "Système d'envoi d'e-mails transactionnels", décidé en
      // conversation) — /auth/register ne renvoie plus de jeton de
      // connexion, juste une confirmation. La connexion réelle n'a lieu
      // qu'après validation du code sur VerifyEmailPage.
      await apiClient.post('/auth/register', form);
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setError(
        err.response?.data?.error?.message ||
          "Inscription impossible. Vérifiez les informations saisies."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Créer votre compte</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Nom complet</label>
        <input
          required
          value={form.fullName}
          onChange={update('fullName')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Mamadi Camara"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
        <input
          type="email"
          required
          value={form.email}
          onChange={update('email')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="vous@exemple.com"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Téléphone</label>
        <input
          type="tel"
          required
          value={form.phone}
          onChange={update('phone')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="622 00 00 00"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Sexe</label>
          <select
            required
            value={form.gender}
            onChange={update('gender')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="" disabled>
              Choisir
            </option>
            <option value="HOMME">Homme</option>
            <option value="FEMME">Femme</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Date de naissance
          </label>
          <input
            type="date"
            required
            value={form.birthDate}
            onChange={update('birthDate')}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">Mot de passe</label>
        <input
          type="password"
          required
          minLength={6}
          value={form.password}
          onChange={update('password')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Au moins 6 caractères"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-600 mb-1">
          Confirmer le mot de passe
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={form.passwordConfirm}
          onChange={update('passwordConfirm')}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Retapez le mot de passe"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-brand-500 text-white text-sm font-medium py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
      >
        {loading ? 'Création en cours...' : 'Créer mon compte'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <Link to="/login" className="text-brand-500 font-medium hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}