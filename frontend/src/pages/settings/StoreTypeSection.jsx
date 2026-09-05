import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Type de boutique (§ cahier des charges types de boutique) — détermine les
 * catégories de produits suggérées. Définitif une fois enregistré (pas de
 * re-changement possible côté serveur, cf. stores.service.js#adoptStoreType).
 * Extrait de SettingsPage.jsx (§ décidé en conversation, page Paramètres
 * trop longue) pour devenir sa propre carte cliquable.
 */
export default function StoreTypeSection({ bare = false }) {
  const [storeType, setStoreType] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [allStoreTypes, setAllStoreTypes] = useState([]);
  const [selectedStoreTypeId, setSelectedStoreTypeId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [typeRes, allTypesRes] = await Promise.all([
          apiClient.get('/stores/type'),
          apiClient.get('/stores/types'),
        ]);
        setStoreType(typeRes.data);
        setAllStoreTypes(allTypesRes.data.storeTypes);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le type de boutique.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/stores/type', { storeTypeId: Number(selectedStoreTypeId) });
      setStoreType({ storeTypeId: data.storeTypeId, storeTypeLabel: data.storeTypeLabel });
      setSelectedStoreTypeId('');
      setSuccess(
        data.categoriesAdded > 0
          ? `Type "${data.storeTypeLabel}" enregistré — ${data.categoriesAdded} catégorie(s) de produits ajoutée(s).`
          : `Type "${data.storeTypeLabel}" enregistré — aucune nouvelle catégorie à ajouter, tout existait déjà.`
      );
      setTimeout(() => setSuccess(''), 8000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <>
      {!bare && (
        <>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Type de boutique</h3>
          <p className="text-xs text-slate-500 mb-3">
            Détermine les catégories de produits suggérées. Une boutique ne peut avoir qu'un seul type
            — le choix est définitif une fois enregistré.
          </p>
        </>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-1.5 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2 mb-3">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : storeType?.storeTypeId ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span>Type actuel :</span>
          <span className="font-medium text-sky-700 bg-sky-50 px-3 py-1 rounded-full">{storeType.storeTypeLabel}</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <p className="text-sm text-slate-600">Aucun type défini pour l'instant.</p>
          <select
            required
            value={selectedStoreTypeId}
            onChange={(e) => setSelectedStoreTypeId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
          >
            <option value="" disabled>
              Choisir un type…
            </option>
            {allStoreTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving || !selectedStoreTypeId}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-sky-600 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Définir le type
              </>
            )}
          </button>
        </form>
      )}
    </>
  );

  return bare ? content : <section className="rounded-xl border border-slate-200 bg-white p-5">{content}</section>;
}
