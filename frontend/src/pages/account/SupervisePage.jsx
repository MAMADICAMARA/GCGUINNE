import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Page Superviser (espace Compte) — vue d'ensemble sur les boutiques de
 * tiers ajoutées via un code de partage, en lecture seule stricte. Les
 * boutiques possédées par l'utilisateur n'apparaissent volontairement pas
 * ici (décidé en conversation) : il y a déjà un accès complet à sa propre
 * boutique via "Ma Boutique"/le tableau de bord, les afficher aussi ici
 * serait une duplication sans valeur ajoutée.
 */
export default function SupervisePage() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [removingId, setRemovingId] = useState(null);

  async function loadStores() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/supervision/stores');
      setStores(data.stores);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger vos boutiques.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStores();
  }, []);

  async function handleAddCode(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/supervision/stores', { code: code.trim() });
      setSuccessMessage(`"${data.storeName}" a été ajoutée à votre supervision.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      setCode('');
      setShowAddForm(false);
      loadStores();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Code invalide.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(store) {
    if (!window.confirm(`Retirer "${store.name}" de votre supervision ?`)) return;
    setRemovingId(store.id);
    try {
      await apiClient.delete(`/supervision/stores/${store.id}`);
      loadStores();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Superviser</h1>
          <p className="text-sm text-slate-500">
            Boutiques d'autres personnes que vous supervisez en lecture seule.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto"
        >
          + Ajouter via un code
        </button>
      </div>

      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddCode}
          className="rounded-xl border border-slate-200 bg-white p-5 mb-6 max-w-md"
        >
          <label className="block text-sm font-medium text-slate-600 mb-1">
            Code de supervision
          </label>
          <p className="text-xs text-slate-400 mb-2">
            Demandez ce code à la personne qui gère la boutique — il se trouve
            dans ses Paramètres.
          </p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex : SYS3PJ556RT8"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Vérification...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucune boutique supervisée pour l'instant.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stores.map((store) => (
            <div key={store.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="font-medium text-slate-800">{store.name}</p>
              </div>

              {store.supervisionAllowed ? (
                <div className="grid grid-cols-3 gap-1.5 mb-4 text-center sm:gap-2">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">CA du jour</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {formatGNF(store.todayRevenue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Bénéfice</p>
                    <p className="text-sm font-semibold text-green-700">
                      {formatGNF(store.todayProfit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase">Ruptures</p>
                    <p
                      className={`text-sm font-semibold ${
                        store.lowStockCount > 0 ? 'text-red-600' : 'text-slate-800'
                      }`}
                    >
                      {store.lowStockCount}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                  L'abonnement actuel de cette boutique n'autorise plus la supervision — vous
                  restez lié(e), mais ses données ne sont plus accessibles pour l'instant.
                </p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/account/supervise/${store.id}`)}
                  disabled={!store.supervisionAllowed}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:text-slate-300 disabled:hover:text-slate-300"
                >
                  Voir le détail
                </button>
                <button
                  onClick={() => handleRemove(store)}
                  disabled={removingId === store.id}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
                >
                  Retirer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}