import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import apiClient from '@/services/apiClient';

/**
 * Étape 1 du transfert de stock (§45_transfert_de_stock.sql) — choix du
 * produit à envoyer. Liste tous les produits actifs de la boutique, avec
 * recherche, comme la section "Ajuster le stock d'un autre produit" déjà
 * présente sur cette page.
 */
export default function StockTransferProductModal({ onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/products', {
          params: { search: search.trim() || undefined, status: 'ACTIVE', limit: 50 },
        });
        setProducts(data.products);
        setError('');
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les produits.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Transférer le stock — choisir un produit</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="relative w-full mb-3">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un produit par nom ou référence..."
              className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        <div className="px-6 pb-6 overflow-y-auto flex-1">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">Aucun produit trouvé.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              {products.map((product) => (
                <button
                  key={product.id}
                  onClick={() => onSelect(product)}
                  disabled={product.quantity <= 0}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0 text-left hover:bg-slate-50 transition disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                  title={product.quantity <= 0 ? 'Aucun stock disponible pour ce produit' : undefined}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                    {product.reference && (
                      <p className="text-xs text-slate-400 truncate">Réf. {product.reference}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-sm font-medium text-slate-600 ml-3">
                    {product.quantity} en stock
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
