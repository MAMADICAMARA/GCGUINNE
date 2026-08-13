import { useEffect, useState } from 'react';
import { Package, Store, User, MapPin, Phone } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Détail complet d'un produit MARCHÉ (§7, niveau modal) — accessible
 * uniquement à un utilisateur déjà authentifié (MarketplaceGrid ne
 * l'ouvre jamais sans jeton, et le backend revérifie de toute façon).
 * Seul endroit où les coordonnées de la boutique apparaissent.
 */
export default function MarketplaceProductModal({ productId, onClose }) {
  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get(`/marketplace/products/${productId}`);
        setProduct(data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger ce produit.');
      } finally {
        setLoading(false);
      }
    })();
  }, [productId]);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Détail du produit</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 px-6 py-4">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-12">Chargement...</p>
          ) : (
            product && (
              <div>
                <div className="aspect-video bg-slate-100">
                  {product.imageUrl ? (
                    <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-14 w-14 text-slate-300" strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                <div className="p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800">{product.name}</h3>
                    <p className="text-2xl font-bold text-brand-600 mt-1">{formatGNF(product.sellingPrice)}</p>
                  </div>

                  {product.priceTiers.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                        Prix par quantité
                      </p>
                      <ul className="rounded-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden">
                        {product.priceTiers.map((tier, i) => (
                          <li key={i} className="flex items-center justify-between px-3.5 py-2 text-sm">
                            <span className="text-slate-600">À partir de {tier.minQuantity} unités</span>
                            <span className="font-medium text-slate-800">{formatGNF(tier.unitPrice)} / unité</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Vendu par
                    </p>
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 shrink-0 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                          <Store size={15} strokeWidth={1.75} />
                        </div>
                        <span className="text-sm font-medium text-slate-800">{product.store.name}</span>
                      </div>
                      {product.store.ownerName && (
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                          <User size={15} className="text-slate-400 shrink-0" strokeWidth={1.75} />
                          {product.store.ownerName}
                        </div>
                      )}
                      {product.store.address && (
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                          <MapPin size={15} className="text-slate-400 shrink-0" strokeWidth={1.75} />
                          {product.store.address}
                        </div>
                      )}
                      {product.store.phone && (
                        <div className="flex items-center gap-2.5 text-sm text-slate-600">
                          <Phone size={15} className="text-slate-400 shrink-0" strokeWidth={1.75} />
                          {product.store.phone}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
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
