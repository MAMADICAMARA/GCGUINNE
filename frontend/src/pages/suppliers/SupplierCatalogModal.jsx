import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Catalogue en lecture stricte d'un fournisseur lié — jamais de prix ni de
 * quantité en stock, qui restent l'information commerciale exclusive du
 * fournisseur (décidé en conversation, cf. §18_fournisseurs_inter_boutiques.sql).
 * Le backend applique la même restriction indépendamment de cet affichage.
 */
export default function SupplierCatalogModal({ storeId, storeName, onClose }) {
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(`/suppliers/${storeId}/products`);
        if (!cancelled) setProducts(data.products);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'Impossible de charger le catalogue.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800">{storeName}</h2>
            <p className="text-xs text-slate-400">Catalogue — prix et stock non communiqués</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !products ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : products.length === 0 ? (
            <p className="text-sm text-slate-400">Ce fournisseur n'a aucun produit actif pour l'instant.</p>
          ) : (
            <ul className="space-y-2">
              {products.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
                >
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-slate-100 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {p.categoryName || 'Sans catégorie'}
                      {p.reference && ` · Réf. ${p.reference}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
