import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

let nextRowId = 1;

/**
 * Création d'une commande d'achat (§28_commandes_achat_premium.sql,
 * décidé en conversation) — le total est purement informatif ici (aperçu
 * client), toujours recalculé côté serveur à partir des lignes envoyées,
 * jamais fait confiance à une valeur transmise par le formulaire.
 */
export default function CreatePurchaseOrderModal({ suppliers, onClose, onCreated }) {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  const [supplierId, setSupplierId] = useState('');
  const [reference, setReference] = useState('');
  const [rows, setRows] = useState([{ rowId: nextRowId++, productId: '', quantity: '1', purchasePrice: '' }]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingProducts(true);
      try {
        const { data } = await apiClient.get('/products', { params: { limit: 200, status: 'ALL' } });
        setProducts(data.products);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les produits.');
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, []);

  function addRow() {
    setRows((r) => [...r, { rowId: nextRowId++, productId: '', quantity: '1', purchasePrice: '' }]);
  }

  function removeRow(rowId) {
    setRows((r) => (r.length > 1 ? r.filter((row) => row.rowId !== rowId) : r));
  }

  function updateRow(rowId, field, value) {
    setRows((r) => r.map((row) => (row.rowId === rowId ? { ...row, [field]: value } : row)));
  }

  function productPriceDefault(productId) {
    const product = products.find((p) => String(p.id) === String(productId));
    return product ? String(product.purchasePrice ?? '') : '';
  }

  const total = rows.reduce((sum, row) => {
    const qty = Number(row.quantity) || 0;
    const price = Number(row.purchasePrice) || 0;
    return sum + qty * price;
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Choisissez un fournisseur.');
      return;
    }
    const items = rows
      .filter((r) => r.productId)
      .map((r) => ({
        productId: Number(r.productId),
        quantity: Number(r.quantity),
        purchasePrice: Number(r.purchasePrice),
      }));
    if (items.length === 0) {
      setError('Ajoutez au moins un article valide.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/purchases/orders', { supplierId: Number(supplierId), reference, items });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Création impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Nouvelle commande d'achat</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
            )}

            {suppliers.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                Ajoutez d'abord un fournisseur (onglet "Fournisseurs") avant de créer une commande.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Fournisseur</label>
                  <select
                    required
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="" disabled>
                      Choisir...
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 mb-1">Référence (optionnel)</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex : BC-2026-014"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>
            )}

            <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles</h3>
            {loadingProducts ? (
              <p className="text-sm text-slate-400">Chargement des produits...</p>
            ) : (
              <div className="space-y-2 mb-3">
                {rows.map((row) => (
                  <div key={row.rowId} className="flex gap-2 items-start">
                    <select
                      value={row.productId}
                      onChange={(e) => {
                        const productId = e.target.value;
                        updateRow(row.rowId, 'productId', productId);
                        if (!row.purchasePrice) {
                          updateRow(row.rowId, 'purchasePrice', productPriceDefault(productId));
                        }
                      }}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      <option value="">Produit...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={row.quantity}
                      onChange={(e) => updateRow(row.rowId, 'quantity', e.target.value)}
                      placeholder="Qté"
                      className="w-20 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.purchasePrice}
                      onChange={(e) => updateRow(row.rowId, 'purchasePrice', e.target.value)}
                      placeholder="P.U. achat"
                      className="w-28 rounded-lg border border-slate-300 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(row.rowId)}
                      disabled={rows.length === 1}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30 px-2 py-2"
                      aria-label="Retirer la ligne"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={addRow}
              className="text-xs font-medium text-brand-500 hover:text-brand-600 mb-4"
            >
              + Ajouter une ligne
            </button>

            <div className="flex justify-between text-sm font-semibold text-slate-800 pt-3 border-t border-slate-100">
              <span>Total estimé</span>
              <span>{formatGNF(total)}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 shrink-0">
            <button
              type="submit"
              disabled={submitting || suppliers.length === 0}
              className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-semibold py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Création...' : 'Créer la commande'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-300 text-slate-600 text-sm font-medium px-4 py-2.5 hover:bg-slate-50 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
