import { useState } from 'react';
import apiClient from '@/services/apiClient';

const initialForm = {
  name: '',
  categoryId: '',
  reference: '',
  description: '',
  purchasePrice: '',
  sellingPrice: '',
  quantity: '',
  lowStockThreshold: '5',
  imageUrl: '',
};

/**
 * Modal de création/édition d'un produit.
 * Champs alignés EXACTEMENT sur ce que le backend attend et renvoie
 * (camelCase : purchasePrice, sellingPrice, lowStockThreshold...) —
 * voir backend/src/modules/products/products.service.js.
 *
 * Règle importante (cf. §4.5 du cahier des charges) : la quantité en stock
 * n'est modifiable ici QU'À LA CRÉATION. En édition, elle est affichée en
 * lecture seule — toute variation de stock doit obligatoirement passer par
 * un mouvement typé (vente, achat, ajustement), jamais par une modification
 * silencieuse du produit. Le backend applique déjà cette règle (updateProduct
 * n'accepte pas la quantité) ; ce formulaire se contente de refléter cette
 * contrainte plutôt que de laisser croire qu'un changement serait pris en compte.
 */
export default function ProductForm({ product, categories, onClose }) {
  const isEdit = Boolean(product);

  const [form, setForm] = useState(() =>
    isEdit
      ? {
          name: product.name || '',
          categoryId: product.categoryId || '',
          reference: product.reference || '',
          description: product.description || '',
          purchasePrice: product.purchasePrice ?? '',
          sellingPrice: product.sellingPrice ?? '',
          quantity: product.quantity ?? '',
          lowStockThreshold: product.lowStockThreshold ?? '5',
          imageUrl: product.imageUrl || '',
        }
      : initialForm
  );
  // Attributs libres (clé/valeur) — ex: {"modèle": "BG6", "couleur": "Noir"}.
  // Contrairement à la référence (qui doit rester unique par produit),
  // ces attributs peuvent parfaitement être partagés entre plusieurs
  // produits différents (plusieurs pièces compatibles avec le même modèle
  // de téléphone, par exemple).
  const [attributesList, setAttributesList] = useState(() => {
    const initial = isEdit && product.attributes ? product.attributes : {};
    const entries = Object.entries(initial).map(([key, value]) => ({ key, value: String(value) }));
    return entries.length > 0 ? entries : [{ key: '', value: '' }];
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function updateAttribute(index, field, value) {
    setAttributesList((prev) =>
      prev.map((attr, i) => (i === index ? { ...attr, [field]: value } : attr))
    );
  }

  function addAttributeRow() {
    setAttributesList((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeAttributeRow(index) {
    setAttributesList((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    // On ne garde que les lignes dont la clé est renseignée — une ligne
    // vide laissée par l'utilisateur ne doit pas polluer les attributs.
    const attributes = Object.fromEntries(
      attributesList
        .map((a) => [a.key.trim(), a.value.trim()])
        .filter(([key]) => key.length > 0)
    );

    const payload = {
      name: form.name,
      categoryId: form.categoryId || null,
      reference: form.reference || null,
      description: form.description || null,
      purchasePrice: parseFloat(form.purchasePrice),
      sellingPrice: parseFloat(form.sellingPrice),
      lowStockThreshold: parseInt(form.lowStockThreshold, 10) || 0,
      imageUrl: form.imageUrl.trim() || null,
      attributes,
    };
    // La quantité n'est envoyée qu'à la création — l'API l'ignorerait de
    // toute façon en édition, mais autant ne pas prétendre l'envoyer.
    if (!isEdit) {
      payload.quantity = parseInt(form.quantity, 10) || 0;
    }

    try {
      if (isEdit) {
        await apiClient.put(`/products/${product.id}`, payload);
      } else {
        await apiClient.post('/products', payload);
      }
      onClose();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">
            {isEdit ? 'Modifier le produit' : 'Nouveau produit'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Nom du produit
            </label>
            <input
              required
              value={form.name}
              onChange={update('name')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Écran iPhone 13"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Catégorie</label>
              <select
                value={form.categoryId}
                onChange={update('categoryId')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Aucune</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Référence (optionnel)
              </label>
              <input
                value={form.reference}
                onChange={update('reference')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="SKU-001"
              />
              <p className="text-xs text-slate-400 mt-1">
                Doit être unique à ce produit précis. Pour un modèle partagé
                entre plusieurs pièces (ex : "BG6"), utilisez plutôt un
                attribut ci-dessous.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={form.description}
              onChange={update('description')}
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-600">
                Attributs (optionnel)
              </label>
              <button
                type="button"
                onClick={addAttributeRow}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                + Ajouter
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-2">
              Ex : modèle, couleur, taille... Peuvent être identiques sur
              plusieurs produits (contrairement à la référence).
            </p>
            <div className="space-y-2">
              {attributesList.map((attr, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={attr.key}
                    onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                    placeholder="Clé (ex: modèle)"
                    className="w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    value={attr.value}
                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                    placeholder="Valeur (ex: BG6)"
                    className="w-1/2 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttributeRow(index)}
                    className="text-slate-300 hover:text-red-500 px-1"
                    aria-label="Retirer cet attribut"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Prix d'achat (GNF)
              </label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.purchasePrice}
                onChange={update('purchasePrice')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="350000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Prix de vente (GNF)
              </label>
              <input
                required
                type="number"
                min="0"
                step="1"
                value={form.sellingPrice}
                onChange={update('sellingPrice')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="450000"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Stock initial
              </label>
              {isEdit ? (
                <>
                  <input
                    disabled
                    value={form.quantity}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Non modifiable ici — utilisez un ajustement de stock.
                  </p>
                </>
              ) : (
                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={form.quantity}
                  onChange={update('quantity')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="10"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Seuil d'alerte stock faible
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.lowStockThreshold}
                onChange={update('lowStockThreshold')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">
              URL de l'image (optionnel)
            </label>
            <input
              type="url"
              value={form.imageUrl}
              onChange={update('imageUrl')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="https://exemple.com/mon-image.jpg"
            />
            <p className="text-xs text-slate-400 mt-1">
              Seul le lien est enregistré — l'image elle-même reste hébergée
              là où tu l'as mise en ligne, jamais stockée sur nos serveurs.
            </p>
            {form.imageUrl.trim() && (
              <img
                src={form.imageUrl}
                alt="Aperçu"
                className="mt-2 h-20 w-20 rounded-lg object-cover border border-slate-200"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
                onLoad={(e) => {
                  e.target.style.display = 'block';
                }}
              />
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer le produit'}
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