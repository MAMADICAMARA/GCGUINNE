import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { COUNTRIES, GUINEE_REGIONS, GUINEE_REGION_NAMES } from '@/data/guineeRegions';

const OTHER = '__AUTRE__';

/**
 * Informations générales de la boutique (§ décidé en conversation) — tout
 * modifiable après création SAUF le type de boutique, qui reste à part
 * (section "Type de boutique" juste au-dessus, définitif une fois choisi
 * — règle déjà établie séparément, pas remise en cause ici). Même patron
 * de sélection pays/région/ville en cascade que la création de boutique
 * (MyStorePage.jsx), pour rester cohérent visuellement et fonctionnellement.
 */
export default function StoreInfoSection({ bare = false }) {
  const activeStore = useAuthStore((s) => s.activeStore);
  const setActiveStore = useAuthStore((s) => s.setActiveStore);

  const [form, setForm] = useState(null);
  const [cityChoice, setCityChoice] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isGuinee = form?.country === 'Guinée';
  const citiesForRegion = isGuinee && form?.region ? GUINEE_REGIONS[form.region] || [] : [];

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get('/stores/info');
        setForm({
          name: data.name || '',
          address: data.address || '',
          phone: data.phone || '',
          region: data.region || '',
          city: data.city || '',
          country: data.country || 'Guinée',
        });
        // Une ville déjà enregistrée qui ne fait pas partie du référentiel
        // (saisie via "Autre..." à l'époque, ou boutique hors Guinée) doit
        // rester visible et modifiable, jamais silencieusement vidée.
        const known = data.region ? (GUINEE_REGIONS[data.region] || []) : [];
        setCityChoice(data.city && !known.includes(data.city) ? OTHER : data.city || '');
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les informations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateCountry(e) {
    const value = e.target.value;
    setForm((f) => ({ ...f, country: value, region: '', city: '' }));
    setCityChoice('');
  }

  function updateRegion(e) {
    const value = e.target.value;
    setForm((f) => ({ ...f, region: value, city: '' }));
    setCityChoice('');
  }

  function updateCityChoice(e) {
    const value = e.target.value;
    setCityChoice(value);
    setForm((f) => ({ ...f, city: value === OTHER ? '' : value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const { data } = await apiClient.put('/stores/info', form);
      setForm({
        name: data.name || '',
        address: data.address || '',
        phone: data.phone || '',
        region: data.region || '',
        city: data.city || '',
        country: data.country || 'Guinée',
      });
      // Reflète immédiatement le nouveau nom dans la sidebar, sans exiger
      // une reconnexion — même principe que StoreLogoSection.
      if (activeStore) {
        setActiveStore({ ...activeStore, name: data.name, region: data.region, city: data.city });
      }
      setSuccess('Informations enregistrées.');
      setTimeout(() => setSuccess(''), 5000);
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
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Informations générales</h3>
          <p className="text-xs text-slate-500 mb-3">
            Nom, coordonnées et localisation de votre boutique — modifiables à tout moment.
          </p>
        </>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">{error}</p>
      )}
      {success && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-3">
          {success}
        </p>
      )}

      {loading || !form ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Nom de la boutique</label>
              <input
                required
                value={form.name}
                onChange={update('name')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Numéro de la boutique</label>
              <input
                required
                value={form.phone}
                onChange={update('phone')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Pays</label>
            <select
              value={form.country}
              onChange={updateCountry}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:w-1/2"
            >
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Région administrative</label>
              {isGuinee ? (
                <select
                  value={form.region}
                  onChange={updateRegion}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Choisir une région</option>
                  {GUINEE_REGION_NAMES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.region}
                  onChange={update('region')}
                  placeholder="Région / province"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Ville</label>
              {isGuinee ? (
                <select
                  value={cityChoice}
                  onChange={updateCityChoice}
                  disabled={!form.region}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50 disabled:text-slate-400"
                >
                  <option value="">{form.region ? 'Choisir une ville' : "Choisissez une région d'abord"}</option>
                  {citiesForRegion.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  <option value={OTHER}>Autre...</option>
                </select>
              ) : (
                <input
                  value={form.city}
                  onChange={update('city')}
                  placeholder="Ville"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              )}
            </div>
          </div>

          {isGuinee && cityChoice === OTHER && (
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Précisez la ville</label>
              <input
                required
                value={form.city}
                onChange={update('city')}
                placeholder="Nom de la ville"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">Adresse (quartier)</label>
            <input
              value={form.address}
              onChange={update('address')}
              placeholder="Ex : Quartier Timbo, non loin du marché central"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
      )}
    </>
  );

  return bare ? content : <section className="rounded-xl border border-slate-200 bg-white p-5">{content}</section>;
}
