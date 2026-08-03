import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { COUNTRIES, GUINEE_REGIONS, GUINEE_REGION_NAMES } from '@/data/guineeRegions';

const OTHER = '__AUTRE__';

const initialForm = {
  name: '',
  storeTypeId: '',
  country: 'Guinée',
  region: '',
  city: '',
  address: '',
  phone: '',
};

export default function MyStorePage() {
  const navigate = useNavigate();
  const { stores, setStores, applyStoreSwitch } = useAuthStore();

  const [loadingList, setLoadingList] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [cityChoice, setCityChoice] = useState(''); // valeur du <select> ville : nom connu, ou OTHER
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [openingId, setOpeningId] = useState(null);
  const [suspendedStoreName, setSuspendedStoreName] = useState(null);

  const [storeTypes, setStoreTypes] = useState([]);
  const [storeTypesLoading, setStoreTypesLoading] = useState(true);

  const isGuinee = form.country === 'Guinée';
  const citiesForRegion = isGuinee && form.region ? GUINEE_REGIONS[form.region] || [] : [];

  // Un utilisateur ne peut posséder (owner_id) qu'une seule boutique (cf.
  // §13_un_seul_owner_par_boutique.sql) — pas seulement la boutique
  // active : on regarde s'il est OWNER de N'IMPORTE LAQUELLE de ses
  // boutiques, y compris s'il est par ailleurs juste employé ailleurs.
  const alreadyOwnsStore = stores.some((s) => s.roleCode === 'OWNER');

  // La liste des boutiques peut avoir changé depuis la connexion (ex :
  // création depuis un autre onglet) — on la rafraîchit toujours ici plutôt
  // que de se fier uniquement à ce qui était présent au login.
  //
  // Une seule boutique -> on y entre directement (réutilise handleOpen,
  // même logique que le bouton "Ouvrir") plutôt que d'imposer un clic
  // supplémentaire sur un choix qu'il n'a pas à faire. handleOpen gère déjà
  // le cas d'une boutique suspendue (affiche la modale), donc ce cas reste
  // couvert même en automatique.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/mine');
        if (cancelled) return;
        setStores(data.stores);
        if (data.stores.length === 1) {
          await handleOpen(data.stores[0]);
          if (!cancelled) setLoadingList(false);
        } else {
          setLoadingList(false);
        }
      } catch {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setStores]);

  // Référentiel géré par le Super Admin (§ cahier des charges types de
  // boutique) — le choix détermine les catégories de produits créées
  // automatiquement pour la nouvelle boutique.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get('/stores/types');
        if (!cancelled) setStoreTypes(data.storeTypes);
      } catch {
        // Silencieux : le formulaire affichera juste une liste vide, la
        // validation "required" empêchera de toute façon une soumission
        // sans type choisi.
      } finally {
        if (!cancelled) setStoreTypesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedStoreType = storeTypes.find((t) => String(t.id) === String(form.storeTypeId));

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateCountry(e) {
    const value = e.target.value;
    // Changer de pays invalide région/ville déjà choisies (le référentiel
    // de régions n'existe que pour la Guinée).
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

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/stores', form);
      // La nouvelle boutique devient immédiatement active — pas d'étape
      // de sélection superflue pour une boutique qu'on vient de créer.
      applyStoreSwitch(data);
      navigate('/dashboard');
    } catch (err) {
      setError(
        err.response?.data?.error?.message || 'Création impossible. Vérifiez les informations saisies.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleOpen(store) {
    setOpeningId(store.id);
    try {
      const { data } = await apiClient.post('/auth/switch-store', { storeId: store.id });
      applyStoreSwitch(data);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.error?.code === 'STORE_SUSPENDED') {
        setSuspendedStoreName(store.name);
      } else {
        setError(err.response?.data?.error?.message || "Impossible d'ouvrir cette boutique.");
      }
      setOpeningId(null);
    }
  }

  if (loadingList) {
    return <p className="text-sm text-slate-400">Chargement...</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Ma Boutique</h1>
      <p className="text-sm text-slate-500 mb-6">
        {alreadyOwnsStore
          ? 'Gérez votre boutique.'
          : 'Gérez vos boutiques ou créez-en une nouvelle.'}
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4 max-w-2xl">
          {error}
        </p>
      )}

      {/* --- Cas 1 : aucune boutique du tout --- */}
      {stores.length === 0 && !showForm && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center max-w-2xl">
          <p className="text-slate-600 mb-5">
            Vous n'avez pas encore de boutique. Créez-la pour commencer à
            vendre, gérer votre stock et suivre vos clients.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-6 py-3 hover:bg-brand-600 transition"
          >
            + Créer ma boutique
          </button>
        </div>
      )}

      {/* --- Cas 2 : une ou plusieurs boutiques ---
          Empilé verticalement sur mobile (nom/infos puis bouton en dessous),
          aligné horizontalement à partir de sm: (infos à gauche, bouton à
          droite) — cf. flex-col sm:flex-row ci-dessous. */}
      {stores.length > 0 && (
        <div className="space-y-3 max-w-2xl mb-6">
          {stores.map((store) => (
            <div
              key={store.id}
              className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            >
              <div>
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  {store.name}
                  {store.status === 'SUSPENDED' && (
                    <span className="inline-block rounded-full bg-red-50 text-red-600 px-2 py-0.5 text-xs font-medium">
                      Suspendue
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {store.roleCode}
                  {store.region ? ` · ${store.region}` : ''}
                  {store.city ? ` · ${store.city}` : ''}
                  {store.isDefaultStore ? ' · Boutique par défaut' : ''}
                </p>
              </div>
              <button
                onClick={() => handleOpen(store)}
                disabled={openingId === store.id}
                className="self-start rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60 sm:self-auto"
              >
                {openingId === store.id ? 'Ouverture...' : 'Ouvrir'}
              </button>
            </div>
          ))}

          {/* Un Owner ne peut posséder qu'une seule boutique — on ne
              propose "Créer" que s'il n'en possède encore aucune (il peut
              être simple employé ailleurs sans jamais avoir créé la
              sienne). Pour suivre d'autres boutiques, direction Superviser. */}
          {!showForm && !alreadyOwnsStore && (
            <button
              onClick={() => setShowForm(true)}
              className="text-sm text-brand-500 font-medium hover:underline"
            >
              + Créer ma boutique
            </button>
          )}

          {alreadyOwnsStore && (
            <p className="text-xs text-slate-400">
              Vous possédez déjà une boutique. Pour suivre d'autres boutiques
              gérées par des tiers, rendez-vous dans{' '}
              <Link to="/account/supervise" className="text-brand-500 font-medium hover:underline">
                Superviser
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {/* --- Formulaire de création (affiché à la demande) ---
          Chaque groupe de champs est empilé sur mobile (grid-cols-1) et
          passe en ligne à partir de sm: (sm:grid-cols-2) — vertical sur
          téléphone, horizontal sur tablette/desktop. */}
      {showForm && !alreadyOwnsStore && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-6 max-w-2xl space-y-4"
        >
          <h2 className="font-semibold text-slate-800">Nouvelle boutique</h2>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Nom de la boutique
              </label>
              <input
                required
                value={form.name}
                onChange={update('name')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Camara Mobile Store"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Type de boutique</label>
              <select
                required
                value={form.storeTypeId}
                onChange={update('storeTypeId')}
                disabled={storeTypesLoading}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">
                  {storeTypesLoading ? 'Chargement...' : 'Choisir un type...'}
                </option>
                {storeTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
              {selectedStoreType && (
                <p className="text-xs text-slate-400 mt-1">
                  {selectedStoreType.categories.length > 0
                    ? `${selectedStoreType.categories.length} catégorie(s) de produits seront créées automatiquement : ${selectedStoreType.categories.map((c) => c.name).join(', ')}.`
                    : 'Aucune catégorie prédéfinie pour ce type — vous les créerez vous-même.'}
                </p>
              )}
            </div>
          </div>

          <hr className="border-slate-100" />
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Localisation
          </p>

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
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Région administrative
              </label>
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
                  <option value="">
                    {form.region ? 'Choisir une ville' : 'Choisissez une région d\'abord'}
                  </option>
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
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Précisez la ville
              </label>
              <input
                required
                value={form.city}
                onChange={update('city')}
                placeholder="Nom de la ville"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Adresse (quartier)
              </label>
              <input
                value={form.address}
                onChange={update('address')}
                placeholder="Ex : Quartier Timbo, non loin du marché central"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Numéro de la boutique
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="622 00 00 00"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer la boutique'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {suspendedStoreName && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="px-6 py-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
                <span className="text-2xl">⛔</span>
              </div>
              <h2 className="font-semibold text-slate-800 mb-1">Boutique suspendue</h2>
              <p className="text-sm text-slate-500">
                <span className="font-medium">"{suspendedStoreName}"</span> a été suspendue par
                l'administrateur de la plateforme. Contactez l'administrateur pour en savoir plus
                ou pour la réactiver.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setSuspendedStoreName(null)}
                className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}