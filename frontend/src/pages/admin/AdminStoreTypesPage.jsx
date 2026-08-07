import { useEffect, useState } from 'react';
import { Plus, Tags } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Types de boutique + catégories de produits suggérées (Super Admin) — §
 * cahier-des-charges-types-de-boutique.md. Référentiel administratif pur :
 * ne touche ni le flux de création de boutique ni l'adoption rétroactive
 * d'un type (tous deux hors périmètre, à construire séparément). Les
 * catégories suggérées sont un gabarit, jamais lié aux vraies catégories
 * d'une boutique — les modifier ici n'affecte donc jamais une boutique déjà
 * créée.
 */
export default function AdminStoreTypesPage() {
  const [storeTypes, setStoreTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [editingType, setEditingType] = useState(null); // { storeType } | { isNew: true } | null
  const [editingCategory, setEditingCategory] = useState(null); // { storeTypeId, category } | null

  async function loadStoreTypes() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/admin/store-types');
      setStoreTypes(data.storeTypes);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les types de boutique.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStoreTypes();
  }, []);

  function flashSuccess(message) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 5000);
  }

  async function handleDeleteType(storeType) {
    if (
      !window.confirm(
        `Supprimer le type "${storeType.label}" ? Ses catégories suggérées disparaîtront avec lui. Les boutiques qui l'utilisent déjà ne seront pas affectées, seule leur référence de type sera vidée.`
      )
    ) {
      return;
    }
    try {
      await apiClient.delete(`/admin/store-types/${storeType.id}`);
      flashSuccess(`Type "${storeType.label}" supprimé.`);
      loadStoreTypes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Suppression impossible.');
    }
  }

  async function handleDeleteCategory(category) {
    try {
      await apiClient.delete(`/admin/store-types/categories/${category.id}`);
      loadStoreTypes();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Suppression impossible.');
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <Tags size={18} />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Types de boutique</h1>
            <p className="text-sm text-slate-500">
              Proposés à la création d'une boutique, avec un jeu de catégories de produits suggérées.
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditingType({ isNew: true })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto"
        >
          <Plus size={16} /> Ajouter un type
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}
      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : storeTypes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucun type de boutique pour l'instant.
        </div>
      ) : (
        <div className="space-y-3">
          {storeTypes.map((storeType) => {
            const isExpanded = expandedId === storeType.id;
            return (
              <div key={storeType.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : storeType.id)}
                    className="flex items-center gap-3 text-left flex-1"
                  >
                    <span className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                      ›
                    </span>
                    <div>
                      <p className="font-medium text-slate-800">{storeType.label}</p>
                      <p className="text-xs text-slate-400">
                        {storeType.code} — {storeType.categories.length} catégorie(s) suggérée(s)
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      onClick={() => setEditingType({ storeType })}
                      className="text-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDeleteType(storeType)}
                      className="text-xs font-medium text-slate-400 hover:text-red-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                    {storeType.categories.length === 0 ? (
                      <p className="text-sm text-slate-400 mb-3">Aucune catégorie suggérée.</p>
                    ) : (
                      <ul className="space-y-1.5 mb-3">
                        {storeType.categories.map((category) => (
                          <li key={category.id} className="flex items-center justify-between text-sm bg-white rounded-lg border border-slate-200 px-3 py-2">
                            <span className="text-slate-700">{category.name}</span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => setEditingCategory({ storeTypeId: storeType.id, category })}
                                className="text-xs font-medium text-brand-500 hover:text-brand-600"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => handleDeleteCategory(category)}
                                className="text-xs font-medium text-slate-400 hover:text-red-600"
                              >
                                Supprimer
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <button
                      onClick={() => setEditingCategory({ storeTypeId: storeType.id, category: null })}
                      className="text-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      + Ajouter une catégorie
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editingType && (
        <StoreTypeEditorModal
          storeType={editingType.storeType}
          onClose={() => setEditingType(null)}
          onSaved={() => {
            setEditingType(null);
            flashSuccess(editingType.isNew ? 'Type de boutique créé.' : 'Type de boutique modifié.');
            loadStoreTypes();
          }}
        />
      )}

      {editingCategory && (
        <CategoryEditorModal
          storeTypeId={editingCategory.storeTypeId}
          category={editingCategory.category}
          onClose={() => setEditingCategory(null)}
          onSaved={(result) => {
            setEditingCategory(null);
            if (result?.propagatedToStores > 0) {
              setSuccessMessage(
                `Catégorie "${result.name}" ajoutée et propagée à ${result.propagatedToStores} boutique(s) existante(s).`
              );
              setTimeout(() => setSuccessMessage(''), 6000);
            }
            loadStoreTypes();
          }}
        />
      )}
    </div>
  );
}

function StoreTypeEditorModal({ storeType, onClose, onSaved }) {
  const [code, setCode] = useState(storeType?.code || '');
  const [label, setLabel] = useState(storeType?.label || '');
  const [displayOrder, setDisplayOrder] = useState(String(storeType?.displayOrder ?? 0));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { code: code.trim(), label: label.trim(), displayOrder: Number(displayOrder) || 0 };
      if (storeType) {
        await apiClient.put(`/admin/store-types/${storeType.id}`, payload);
      } else {
        await apiClient.post('/admin/store-types', payload);
      }
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{storeType ? 'Modifier le type' : 'Ajouter un type'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-slate-600 mb-1">Code</label>
          <p className="text-xs text-slate-400 mb-2">Recommandé : majuscules, sans espace (ex : TELEPHONIE).</p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">Libellé</label>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex : Téléphonie & Accessoires"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">Ordre d'affichage</label>
          <input
            required
            type="number"
            step="1"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}

function CategoryEditorModal({ storeTypeId, category, onClose, onSaved }) {
  const [name, setName] = useState(category?.name || '');
  const [displayOrder, setDisplayOrder] = useState(String(category?.displayOrder ?? 0));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { name: name.trim(), displayOrder: Number(displayOrder) || 0 };
      if (category) {
        await apiClient.put(`/admin/store-types/categories/${category.id}`, payload);
        onSaved();
      } else {
        const { data } = await apiClient.post(`/admin/store-types/${storeTypeId}/categories`, payload);
        onSaved(data);
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{category ? 'Modifier la catégorie' : 'Ajouter une catégorie'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          <label className="block text-sm font-medium text-slate-600 mb-1">Nom</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Écrans"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />

          <label className="block text-sm font-medium text-slate-600 mb-1">Ordre d'affichage</label>
          <input
            required
            type="number"
            step="1"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
            Annuler
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
          >
            {submitting ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
