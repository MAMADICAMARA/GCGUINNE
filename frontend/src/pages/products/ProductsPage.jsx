import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { useAuthStore, useIsPlanFrozen } from '@/store/authStore';
import { formatGNF } from '@/utils/format';
import ProductForm from './ProductForm';
import ProductDetail from './ProductDetail';

/**
 * ProductsPage — Gestion du catalogue produits (§4.4 du cahier des charges)
 *
 * Champs de réponse en camelCase, alignés sur products.service.js :
 * purchasePrice, sellingPrice, categoryId, lowStockThreshold, createdAt...
 * (le backend ne renvoie jamais purchase_price / low_stock_threshold).
 */
export default function ProductsPage() {
  const activeStore = useAuthStore((s) => s.activeStore);
  const isFrozen = useIsPlanFrozen();

  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  const [categories, setCategories] = useState([]);
  

  async function loadProducts() {
    if (!activeStore) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/products', {
        params: {
          page,
          limit,
          search,
          status: statusFilter,
          lowStockOnly,
          ...(selectedCategory ? { categoryId: selectedCategory } : {}),
        },
      });
      setProducts(data.products);
      setTotal(data.total);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors du chargement des produits.');
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const { data } = await apiClient.get('/categories');
      setCategories(data.categories || []);
    } catch {
      // Non bloquant : le filtre catégorie sera juste vide.
    }
  }

  useEffect(() => {
    loadProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, search, selectedCategory, statusFilter, lowStockOnly, activeStore]);

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  function handleCreate() {
    setSelectedProduct(null);
    setShowForm(true);
  }

  function handleEdit(product) {
    setSelectedProduct(product);
    setShowForm(true);
  }

  function handleViewDetail(product) {
    setSelectedProduct(product);
    setShowDetail(true);
  }

  /**
   * Désactive le produit — jamais de suppression physique (§12 du cahier
   * des charges : un produit déjà vendu doit conserver son historique).
   * Le backend n'expose d'ailleurs aucune route DELETE /products/:id.
   */
  async function handleDeactivate(product) {
    if (!window.confirm(`Désactiver "${product.name}" ? Il n'apparaîtra plus en caisse.`)) {
      return;
    }
    try {
      await apiClient.post(`/products/${product.id}/deactivate`);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action impossible.');
    }
  }

  async function handleReactivate(product) {
    try {
      await apiClient.post(`/products/${product.id}/reactivate`);
      loadProducts();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Action impossible.');
    }
  }

  function handleFormClose() {
    setShowForm(false);
    setSelectedProduct(null);
    loadProducts();
  }

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Produits</h1>
          <p className="text-sm text-slate-500">Catalogue, catégories et stock.</p>
        </div>
        <button
          onClick={handleCreate}
          disabled={isFrozen}
          title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Ajouter un produit
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {/* Filtres — empilés sur mobile, en ligne à partir de sm: */}
      <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:flex-wrap">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Rechercher par nom ou référence..."
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="ACTIVE">Actifs</option>
          <option value="INACTIVE">Inactifs</option>
          <option value="ALL">Tous</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => {
              setLowStockOnly(e.target.checked);
              setPage(1);
            }}
          />
          Stock faible uniquement
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucun produit trouvé.
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {products.map((product) => {
                const isLow = product.quantity <= product.lowStockThreshold;
                return (
                  <div key={product.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{product.name}</p>
                        <p className="text-xs text-slate-400">{product.reference || '—'}</p>
                      </div>
                      <span
                        className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          product.status === 'ACTIVE'
                            ? 'bg-green-50 text-green-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {product.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-slate-500">
                        Vente : <span className="font-medium text-slate-700">{formatGNF(product.sellingPrice)}</span>
                      </span>
                      <span className={`font-medium ${isLow ? 'text-red-600' : 'text-slate-700'}`}>
                        Stock : {product.quantity}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-3 text-xs font-medium">
                      <button onClick={() => handleViewDetail(product)} className="text-slate-500">
                        Détails
                      </button>
                      <button
                        onClick={() => handleEdit(product)}
                        disabled={isFrozen}
                        className="text-brand-500 disabled:opacity-40"
                      >
                        Modifier
                      </button>
                      {product.status === 'ACTIVE' ? (
                        <button
                          onClick={() => handleDeactivate(product)}
                          disabled={isFrozen}
                          className="text-red-500 disabled:opacity-40"
                        >
                          Désactiver
                        </button>
                      ) : (
                        <button
                          onClick={() => handleReactivate(product)}
                          disabled={isFrozen}
                          className="text-green-600 disabled:opacity-40"
                        >
                          Réactiver
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Nom</th>
                  <th className="text-left px-4 py-3">Référence</th>
                  <th className="text-right px-4 py-3">P.U. Achat</th>
                  <th className="text-right px-4 py-3">P.U. Vente</th>
                  <th className="text-right px-4 py-3">Stock</th>
                  <th className="text-left px-4 py-3">Statut</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const isLow = product.quantity <= product.lowStockThreshold;
                  return (
                    <tr key={product.id} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                      <td className="px-4 py-3 text-slate-500">{product.reference || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatGNF(product.purchasePrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {formatGNF(product.sellingPrice)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`font-medium ${isLow ? 'text-red-600' : 'text-slate-700'}`}
                        >
                          {product.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            product.status === 'ACTIVE'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetail(product)}
                          className="text-xs font-medium text-slate-500 hover:text-slate-800 mr-3"
                        >
                          Détails
                        </button>
                        <button
                          onClick={() => handleEdit(product)}
                          disabled={isFrozen}
                          title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                          className="text-xs font-medium text-brand-500 hover:text-brand-600 mr-3 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Modifier
                        </button>
                        {product.status === 'ACTIVE' ? (
                          <button
                            onClick={() => handleDeactivate(product)}
                            disabled={isFrozen}
                            title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                            className="text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Désactiver
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(product)}
                            disabled={isFrozen}
                            title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                            className="text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            Réactiver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-sm text-slate-500">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="disabled:opacity-40"
            >
              ← Précédent
            </button>
            <span>
              Page {page} / {totalPages} ({total} produits)
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="disabled:opacity-40"
            >
              Suivant →
            </button>
          </div>
        </>
      )}

      {showForm && (
        <ProductForm product={selectedProduct} categories={categories} onClose={handleFormClose} />
      )}

      {showDetail && selectedProduct && (
        <ProductDetail product={selectedProduct} onClose={() => setShowDetail(false)} />
      )}
    </div>
  );
}