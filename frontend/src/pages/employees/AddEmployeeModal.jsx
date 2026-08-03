import { useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Modal d'ajout d'employé (§4.3 du cahier des charges).
 * Toujours en tant que Vendeur/Caissier — pas de rôle Manager (abandonné,
 * contexte guinéen : cf. 21_abandon_role_manager.sql), donc aucun choix de
 * rôle à proposer ici.
 * Le backend distingue deux cas automatiquement :
 * - l'e-mail correspond à un compte existant -> rattachement immédiat
 * - l'e-mail est inconnu -> invitation en attente, consommée
 *   automatiquement à l'inscription de la personne (voir auth.service.js)
 */
export default function AddEmployeeModal({ onClose, onAdded }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/employees', { email: email.trim() });
      onAdded(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'ajouter cette personne.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Ajouter un employé</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <p className="text-sm text-slate-500">
            Si cette personne a déjà un compte, elle est rattachée immédiatement.
            Sinon, elle sera automatiquement ajoutée dès qu'elle créera son compte
            avec cet e-mail.
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
              placeholder="employe@exemple.com"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Envoi...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
