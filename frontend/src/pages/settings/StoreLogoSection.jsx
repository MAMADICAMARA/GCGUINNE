import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import ImageUploadField from '@/components/ImageUploadField';

/**
 * Logo de la boutique (§ cahier des charges "Upload et stockage réel des
 * images", décidé en conversation) — `stores.logo_url` existait déjà en
 * base depuis le début du projet mais n'avait jamais eu d'interface. Même
 * principe que le reste de Paramètres : coller un lien OU envoyer un
 * fichier, au choix, jamais l'un sans l'autre.
 */
export default function StoreLogoSection() {
  const [logoUrl, setLogoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/stores/logo');
        setLogoUrl(data.logoUrl || '');
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le logo.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/stores/logo', { logoUrl });
      setLogoUrl(data.logoUrl || '');
      setSuccess('Logo enregistré.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Logo de la boutique</h2>
      <p className="text-xs text-slate-500 mb-3">
        Collez un lien existant, ou envoyez directement un fichier depuis votre appareil.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">{error}</p>}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://exemple.com/mon-logo.png"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <ImageUploadField context="stores/logos" onUploaded={(url) => setLogoUrl(url)} />

          {logoUrl.trim() && (
            <img
              src={logoUrl}
              alt="Aperçu du logo"
              className="mt-3 h-20 w-20 rounded-lg object-cover border border-slate-200"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
              onLoad={(e) => {
                e.target.style.display = 'block';
              }}
            />
          )}

          <button
            type="submit"
            disabled={saving}
            className="mt-4 rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </form>
      )}
    </section>
  );
}
