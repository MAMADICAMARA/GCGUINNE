import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import PasswordInput from '@/components/PasswordInput';

const GENDER_LABELS = { HOMME: 'Homme', FEMME: 'Femme', AUTRE: 'Autre' };

// Palette dérivée de la charte existante (brand = bleu) + tons complémentaires
// harmonieux, pour donner un avatar coloré et distinctif à chaque personne
// sans jamais sortir de l'identité visuelle déjà établie dans l'app.
const AVATAR_PALETTE = [
  { bg: 'bg-brand-50', text: 'text-brand-600', ring: 'ring-brand-100' },
  { bg: 'bg-teal-50', text: 'text-teal-600', ring: 'ring-teal-100' },
  { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
];

function getInitials(fullName) {
  if (!fullName) return '?';
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] || '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// Couleur stable pour une même personne (basée sur son nom, pas aléatoire à
// chaque rendu) — un simple hash de caractères suffit ici.
function getAvatarStyle(fullName) {
  if (!fullName) return AVATAR_PALETTE[0];
  const hash = fullName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

// AAAA-MM-JJ tel qu'attendu par <input type="date"> — birthDate arrive du
// backend en ISO complet (2026-01-01T00:00:00.000Z).
function toDateInputValue(isoDate) {
  if (!isoDate) return '';
  return String(isoDate).slice(0, 10);
}

const MAIL_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

/**
 * Profil personnel (§ décidé en conversation) — tout modifiable SAUF
 * l'e-mail (identifiant de connexion, affiché en lecture seule ci-dessous
 * avec une explication). Deux formulaires distincts : informations
 * (nom/téléphone/sexe/naissance) et mot de passe (nécessite l'actuel),
 * chacun avec son propre état de chargement/erreur — jamais couplés,
 * une erreur sur l'un ne doit jamais bloquer l'autre.
 */
export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setToken = useAuthStore((s) => s.setToken);

  const initials = getInitials(user?.fullName);
  const avatar = getAvatarStyle(user?.fullName);

  const [form, setForm] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    gender: user?.gender || '',
    birthDate: toDateInputValue(user?.birthDate),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSaveProfile(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/auth/profile', form);
      setUser(data);
      setSuccess('Profil mis à jour.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Profil</h1>
      <p className="text-sm text-slate-500 mb-6">Vos informations personnelles.</p>

      <div className="max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white mb-6">
        {/* En-tête signature : avatar à initiales, coloré de façon stable
            selon le nom — donne une identité visuelle à chaque personne
            sans jamais sortir de la palette déjà établie dans l'app. */}
        <div className="flex items-center gap-4 border-b border-slate-100 bg-slate-50/60 px-6 py-6">
          <div
            className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-xl font-semibold ring-4 ${avatar.bg} ${avatar.text} ${avatar.ring}`}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-800">
              {user?.fullName || 'Utilisateur'}
            </p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="px-6 py-5 space-y-3">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
              {success}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">E-mail</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
              <span className="text-slate-400">{MAIL_ICON}</span>
              <span className="truncate">{user?.email}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">Non modifiable — c'est votre identifiant de connexion.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nom complet</label>
            <input
              required
              value={form.fullName}
              onChange={update('fullName')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Téléphone</label>
              <input
                required
                value={form.phone}
                onChange={update('phone')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Sexe</label>
              <select
                required
                value={form.gender}
                onChange={update('gender')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="" disabled>
                  Choisir...
                </option>
                {Object.entries(GENDER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Date de naissance</label>
            <input
              required
              type="date"
              value={form.birthDate}
              onChange={update('birthDate')}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-1/2"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      </div>

      <ChangePasswordCard onTokenRefreshed={setToken} />
    </div>
  );
}

function ChangePasswordCard({ onTokenRefreshed }) {
  const email = useAuthStore((s) => s.user?.email);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  // true dès que le mot de passe actuel saisi est refusé — propose alors
  // l'option "recevoir un code par e-mail" plutôt que de laisser la
  // personne bloquée (§ décidé en conversation).
  const [wrongCurrentPassword, setWrongCurrentPassword] = useState(false);

  // Repli par e-mail (réutilise le même mécanisme que "mot de passe
  // oublié" — ForgotPasswordPage.jsx — plutôt qu'un second système de
  // vérification). L'e-mail est déjà connu (celui du compte connecté),
  // jamais resaisi.
  const [emailStep, setEmailStep] = useState('IDLE'); // 'IDLE' | 'SENDING' | 'CODE_SENT'
  const [resetForm, setResetForm] = useState({ code: '', newPassword: '', newPasswordConfirm: '' });
  const [resetError, setResetError] = useState('');
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateReset(field) {
    return (e) => setResetForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setWrongCurrentPassword(false);

    if (form.newPassword !== form.newPasswordConfirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }

    setSaving(true);
    try {
      const { data } = await apiClient.put('/auth/password', form);
      // La session en cours continue avec le nouveau jeton — les AUTRES
      // sessions ouvertes ailleurs sont invalidées côté serveur, jamais
      // celle-ci (cf. auth.service.js#changePassword).
      onTokenRefreshed(data.token);
      setForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      setSuccess('Mot de passe modifié. Vos autres sessions ont été déconnectées.');
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Modification impossible.');
      if (err.response?.data?.error?.code === 'INVALID_CURRENT_PASSWORD') {
        setWrongCurrentPassword(true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSendCode() {
    setResetError('');
    setEmailStep('SENDING');
    try {
      await apiClient.post('/auth/request-password-reset', { email });
      setEmailStep('CODE_SENT');
    } catch (err) {
      setResetError(err.response?.data?.error?.message || "Envoi impossible. Réessayez.");
      setEmailStep('IDLE');
    }
  }

  async function handleResetViaCode(e) {
    e.preventDefault();
    setResetError('');
    if (resetForm.newPassword !== resetForm.newPasswordConfirm) {
      setResetError('Les mots de passe ne correspondent pas.');
      return;
    }
    setResetSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { email, ...resetForm });
      // Le code par e-mail invalide la session en cours (aucun nouveau
      // jeton renvoyé, contrairement au changement via mot de passe actuel
      // — cf. auth.service.js#resetPassword) : reconnexion obligatoire,
      // même comportement que ForgotPasswordPage.jsx.
      setRedirecting(true);
      setTimeout(() => {
        logout();
        navigate('/login', { state: { prefillEmail: email } });
      }, 1800);
    } catch (err) {
      setResetError(err.response?.data?.error?.message || 'Code invalide ou expiré.');
    } finally {
      setResetSubmitting(false);
    }
  }

  return (
    <section className="max-w-md rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Mot de passe</h2>
      <p className="text-xs text-slate-500 mb-3">
        Changer votre mot de passe déconnecte automatiquement vos autres sessions ouvertes.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {redirecting ? (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2">
          Mot de passe mis à jour. Reconnexion nécessaire — redirection...
        </p>
      ) : emailStep === 'CODE_SENT' ? (
        <form onSubmit={handleResetViaCode} className="space-y-3">
          <p className="text-xs text-slate-500">
            Un code a été envoyé à <span className="font-medium text-slate-700">{email}</span> — vérifiez aussi vos
            courriers indésirables.
          </p>
          {resetError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{resetError}</p>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Code reçu par e-mail</label>
            <input
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={resetForm.code}
              onChange={(e) => setResetForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-[0.3em] focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="000000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Nouveau mot de passe</label>
            <PasswordInput
              required
              minLength={6}
              value={resetForm.newPassword}
              onChange={updateReset('newPassword')}
              placeholder="Au moins 6 caractères"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Confirmer le nouveau mot de passe</label>
            <PasswordInput
              required
              minLength={6}
              value={resetForm.newPasswordConfirm}
              onChange={updateReset('newPasswordConfirm')}
              placeholder="Retapez le mot de passe"
            />
          </div>
          <button
            type="submit"
            disabled={resetSubmitting || resetForm.code.length !== 6}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {resetSubmitting ? 'Validation...' : 'Réinitialiser le mot de passe'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEmailStep('IDLE');
              setResetError('');
            }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <ChevronLeft size={14} /> Retour
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Mot de passe actuel</label>
              <PasswordInput required value={form.currentPassword} onChange={update('currentPassword')} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nouveau mot de passe</label>
              <PasswordInput
                required
                minLength={6}
                value={form.newPassword}
                onChange={update('newPassword')}
                placeholder="Au moins 6 caractères"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Confirmer le nouveau mot de passe</label>
              <PasswordInput
                required
                minLength={6}
                value={form.newPasswordConfirm}
                onChange={update('newPasswordConfirm')}
                placeholder="Retapez le mot de passe"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {saving ? 'Modification...' : 'Changer le mot de passe'}
            </button>
          </form>

          {wrongCurrentPassword && (
            <div className="mt-3 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
              <p className="text-xs text-amber-800 mb-1.5">Mot de passe actuel oublié ?</p>
              <button
                type="button"
                onClick={handleSendCode}
                disabled={emailStep === 'SENDING'}
                className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-60"
              >
                {emailStep === 'SENDING' ? 'Envoi du code...' : 'Recevoir un code par e-mail'}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
