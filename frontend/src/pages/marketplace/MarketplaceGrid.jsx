import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Package, Sparkles } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';
import { formatGNF } from '@/utils/format';
import MarketplaceProductModal from './MarketplaceProductModal';

/**
 * Grille de produits MARCHÉ (§ cahier des charges §7/§9) — composant
 * PARTAGÉ entre la page publique (visiteur non connecté) et
 * AccountHomePage (utilisateur connecté, cf. §5) : même contenu, même
 * comportement au clic, seul le cadre autour change. Grande image, peu de
 * texte, gros repères visuels — pensé pour un public peu habitué à la
 * technologie, qui parcourt par les yeux plutôt que par la lecture.
 */
export default function MarketplaceGrid() {
  const navigate = useNavigate();
  const token = useAuthStore((s) => s.token);
  const [products, setProducts] = useState(null);
  const [error, setError] = useState('');
  const [selectedProductId, setSelectedProductId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/marketplace/products');
        setProducts(data.products);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le catalogue.');
      }
    })();
  }, []);

  function handleProductClick(product) {
    if (!token) {
      navigate('/login');
      return;
    }
    setSelectedProductId(product.id);
  }

  if (error) {
    return <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>;
  }

  if (!products) {
    return <p className="text-sm text-slate-400 text-center py-12">Chargement du catalogue...</p>;
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 px-6 text-center">
        <Sparkles className="h-10 w-10 text-slate-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-slate-600 font-medium">Aucun produit pour l'instant.</p>
        <p className="text-sm text-slate-400 mt-1">Revenez bientôt — de nouvelles boutiques arrivent régulièrement.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
        {products.map((product) => (
          <button
            key={product.id}
            onClick={() => handleProductClick(product)}
            className="group text-left rounded-2xl border border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="relative aspect-square bg-slate-100">
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-slate-300" strokeWidth={1.5} />
                </div>
              )}
              {!token && (
                <div className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-slate-900/80 backdrop-blur text-white text-[11px] font-medium px-2.5 py-1">
                  <Lock size={11} strokeWidth={2.25} />
                  Connexion pour voir plus
                </div>
              )}
            </div>
            <div className="p-3">
              <p className="text-sm font-medium text-slate-800 truncate group-hover:text-brand-600 transition-colors">
                {product.name}
              </p>
              <p className="text-base font-semibold text-brand-600 mt-0.5">{formatGNF(product.sellingPrice)}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{product.storeName}</p>
            </div>
          </button>
        ))}
      </div>

      {selectedProductId && (
        <MarketplaceProductModal productId={selectedProductId} onClose={() => setSelectedProductId(null)} />
      )}
    </>
  );
}
