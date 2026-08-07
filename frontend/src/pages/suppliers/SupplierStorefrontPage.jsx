import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ChevronLeft, ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';
import SupplierStorefrontProductCard from './SupplierStorefrontProductCard';

const PREVIEW_COUNT = 4; // même convention que la Caisse (PosPage.jsx)

/**
 * Vitrine d'un fournisseur DE LA PLATEFORME (§29_commande_depuis_fournisseur_plateforme.sql,
 * décidé en conversation) — même comportement que la Caisse (aperçu limité
 * + "Afficher tout" + panier), mais pour préparer une commande d'achat
 * plutôt qu'une vente : le prix affiché est celui du fournisseur, à titre
 * de référence (exception délibérée et limitée à cet écran à la règle
 * "jamais le prix" du reste du module Fournisseurs) — modifiable ligne par
 * ligne, puisqu'il s'agit d'un prix convenu, pas d'un prix de vente fixe.
 * Le stock du fournisseur, lui, n'est JAMAIS montré ni utilisé ici.
 *
 * Commander exige le plan PREMIUM de L'ACHETEUR (vérifié côté serveur) —
 * parcourir ce catalogue, en revanche, est ouvert à tous les plans (décidé
 * en conversation) : un Owner FREEMIUM/STANDARD peut donc arriver jusqu'ici
 * et voir précisément ce qu'il gagnerait à passer PREMIUM.
 */
export default function SupplierStorefrontPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [supplierName, setSupplierName] = useState('');
  const [products, setProducts] = useState([]);
  const [allowsPurchaseOrders, setAllowsPurchaseOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAllProducts, setShowAllProducts] = useState(false);

  const [cart, setCart] = useState([]);
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [catalogRes, planRes] = await Promise.all([
          apiClient.get(`/suppliers/${storeId}/order-catalog`),
          apiClient.get('/stores/plan-status'),
        ]);
        setSupplierName(catalogRes.data.supplierName);
        setProducts(catalogRes.data.products);
        setAllowsPurchaseOrders(Boolean(planRes.data.allowsPurchaseOrders));
      } catch (err) {
        setLoadError(err.response?.data?.error?.message || 'Impossible de charger ce fournisseur.');
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  useEffect(() => {
    setShowAllProducts(false);
  }, [searchTerm, selectedCategory]);

  const categories = [...new Set(products.map((p) => p.categoryName).filter(Boolean))];

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) || (p.reference || '').toLowerCase().includes(term);
    const matchesCategory = !selectedCategory || p.categoryName === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const visibleProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, PREVIEW_COUNT);
  const hiddenCount = filteredProducts.length - visibleProducts.length;

  function addToCart(product, requestedQty) {
    if (requestedQty <= 0) return;
    setError('');
    setCart((prev) => {
      const existing = prev.find((item) => item.supplierProductId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.supplierProductId === product.id ? { ...item, quantity: item.quantity + requestedQty } : item
        );
      }
      return [
        ...prev,
        {
          supplierProductId: product.id,
          productName: product.name,
          quantity: requestedQty,
          unitPrice: product.sellingPrice,
        },
      ];
    });
  }

  function removeFromCart(supplierProductId) {
    setCart((prev) => prev.filter((item) => item.supplierProductId !== supplierProductId));
  }

  function updateQuantity(supplierProductId, rawValue) {
    const newQty = parseInt(rawValue, 10);
    if (Number.isNaN(newQty)) return;
    if (newQty <= 0) {
      removeFromCart(supplierProductId);
      return;
    }
    setCart((prev) =>
      prev.map((item) => (item.supplierProductId === supplierProductId ? { ...item, quantity: newQty } : item))
    );
  }

  function updatePrice(supplierProductId, rawValue) {
    const newPrice = parseFloat(rawValue);
    setCart((prev) =>
      prev.map((item) =>
        item.supplierProductId === supplierProductId
          ? { ...item, unitPrice: Number.isNaN(newPrice) ? 0 : newPrice }
          : item
      )
    );
  }

  const total = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  async function handleSubmitOrder() {
    if (cart.length === 0) {
      setError('Le panier est vide.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/purchases/orders/from-supplier-store', {
        supplierStoreId: Number(storeId),
        reference,
        items: cart.map((item) => ({
          supplierProductId: item.supplierProductId,
          quantity: item.quantity,
          purchasePrice: item.unitPrice,
        })),
      });
      setSuccessMessage('Commande créée — retrouvez-la dans "Achats" pour la marquer reçue.');
      setCart([]);
      setReference('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Création de la commande impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Chargement...</p>;
  }

  if (loadError) {
    return (
      <div>
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:text-brand-700">
          <ChevronLeft size={16} /> Retour à Fournisseurs
        </Link>
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mt-4">
          {loadError}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* --- CATALOGUE --- */}
      <div className="flex-1 min-w-0">
        <Link to="/suppliers" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
          <ChevronLeft size={14} /> Retour à Fournisseurs
        </Link>
        <h1 className="text-xl font-semibold text-slate-800 mt-1 mb-1">{supplierName}</h1>
        <p className="text-sm text-slate-500 mb-4">
          Prix indiqués à titre de référence — le stock de cette boutique reste privé.
        </p>

        {!allowsPurchaseOrders && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
            Passer commande est réservé au plan PREMIUM — vous pouvez toujours parcourir le catalogue.
          </p>
        )}

        {error && (
          <div className="flex items-start justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}
        {successMessage && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
            {successMessage}{' '}
            <button onClick={() => navigate('/purchases')} className="underline font-medium">
              Voir dans Achats
            </button>
          </p>
        )}

        <div className="flex flex-col gap-3 mb-4 sm:flex-row">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un produit..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Toutes catégories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Aucun produit trouvé.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {visibleProducts.map((product) => {
                const cartItem = cart.find((item) => item.supplierProductId === product.id);
                return (
                  <SupplierStorefrontProductCard
                    key={product.id}
                    product={product}
                    cartQuantity={cartItem?.quantity || 0}
                    onAdd={addToCart}
                  />
                );
              })}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAllProducts(true)}
                className="mt-4 w-full rounded-lg border border-dashed border-slate-300 bg-white py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 transition"
              >
                Afficher tout ({filteredProducts.length} produits)
              </button>
            )}

            {showAllProducts && filteredProducts.length > PREVIEW_COUNT && (
              <button
                onClick={() => setShowAllProducts(false)}
                className="mt-2 w-full text-xs font-medium text-slate-400 hover:text-slate-600 transition"
              >
                Réduire
              </button>
            )}
          </>
        )}
      </div>

      {/* --- PANIER --- */}
      <div className="w-full lg:w-96 shrink-0">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden lg:sticky lg:top-6">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <ShoppingCart size={18} className="text-brand-600" />
              <h2 className="font-semibold text-slate-800">Panier</h2>
            </div>
            <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-0.5">
              {itemCount} article{itemCount > 1 ? 's' : ''}
            </span>
          </div>

          <div className="p-4">
            {cart.length === 0 ? (
              <div className="py-10 text-center">
                <ShoppingCart size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm text-slate-400">Le panier est vide.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto -mx-1 px-1 mb-4">
                {cart.map((item) => (
                  <div key={item.supplierProductId} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 leading-tight">{item.productName}</span>
                      <button
                        onClick={() => removeFromCart(item.supplierProductId)}
                        className="shrink-0 text-slate-300 hover:text-red-500 transition"
                        aria-label="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.supplierProductId, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.supplierProductId, e.target.value)}
                          className="w-10 text-center rounded border border-slate-300 text-sm py-0.5 bg-white"
                        />
                        <button
                          onClick={() => updateQuantity(item.supplierProductId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">×</span>
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updatePrice(item.supplierProductId, e.target.value)}
                          className="w-20 text-right rounded border border-slate-300 text-sm py-0.5 bg-white"
                        />
                      </div>
                    </div>
                    <p className="text-right text-sm font-semibold text-slate-700 mt-1">
                      {formatGNF(item.quantity * item.unitPrice)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-3">
              <label className="block text-sm font-medium text-slate-600 mb-1">Référence (optionnel)</label>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex : BC-2026-014"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-3">
              <span>TOTAL</span>
              <span>{formatGNF(total)}</span>
            </div>

            <button
              onClick={handleSubmitOrder}
              disabled={cart.length === 0 || submitting || !allowsPurchaseOrders}
              title={!allowsPurchaseOrders ? 'Réservé au plan PREMIUM' : undefined}
              className="w-full mt-4 rounded-lg bg-brand-500 text-white text-sm font-semibold py-3 hover:bg-brand-600 transition disabled:opacity-50"
            >
              {!allowsPurchaseOrders ? 'Réservé au plan PREMIUM' : submitting ? 'Envoi...' : 'Commander'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
