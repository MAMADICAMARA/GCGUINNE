import { useEffect, useState } from 'react';
import { ShoppingCart, Trash2, Minus, Plus } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore, useIsPlanFrozen } from '@/store/authStore';
import { formatGNF } from '@/utils/format';
import PosProductCard from './PosProductCard';
import ReceiptModal from './ReceiptModal';
import CustomerStepModal from './CustomerStepModal';
import OrderSummaryModal from './OrderSummaryModal';
import CashDrawerBanner from './CashDrawerBanner';

const PREVIEW_COUNT = 4; // une ligne complète sur la plupart des tailles d'écran

// Miroir client du calcul fait par le serveur (products.service.js#getEffectiveUnitPrice) —
// purement pour l'aperçu affiché dans le panier. Le serveur reste seul autorité
// sur le prix réellement facturé, recalculé indépendamment à la création de la vente.
function getEffectiveUnitPrice(product, quantity) {
  if (!product) return 0;
  const tiers = Array.isArray(product.priceTiers) ? product.priceTiers : [];
  let price = product.sellingPrice;
  for (const tier of tiers) {
    if (quantity >= tier.minQuantity) {
      price = tier.unitPrice;
    }
  }
  return price;
}

export default function PosPage() {
  const activeStore = useAuthStore((s) => s.activeStore);
  const isFrozen = useIsPlanFrozen();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);

  const [cart, setCart] = useState([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [taxPercent, setTaxPercent] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [showCustomerStep, setShowCustomerStep] = useState(false);
  const [showSummaryStep, setShowSummaryStep] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [drawerRefreshSignal, setDrawerRefreshSignal] = useState(0);

  async function loadCatalog() {
    if (!activeStore) return;
    setLoadingProducts(true);
    try {
      const [productsRes, categoriesRes] = await Promise.all([
        apiClient.get('/products', { params: { limit: 100, status: 'ACTIVE' } }),
        apiClient.get('/categories'),
      ]);
      setProducts(productsRes.data.products || []);
      setCategories(categoriesRes.data.categories || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors du chargement des produits.');
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    loadCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  // Réinitialise l'aperçu dès que la recherche ou la catégorie change,
  // pour ne jamais afficher un "Afficher tout" incohérent avec le filtre actuel.
  useEffect(() => {
    setShowAllProducts(false);
  }, [searchTerm, selectedCategory]);

  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) || (p.reference || '').toLowerCase().includes(term);
    const matchesCategory = !selectedCategory || p.categoryId === parseInt(selectedCategory, 10);
    return matchesSearch && matchesCategory;
  });

  const visibleProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, PREVIEW_COUNT);
  const hiddenCount = filteredProducts.length - visibleProducts.length;

  function addToCart(product, requestedQty) {
    if (requestedQty <= 0) return;

    const existing = cart.find((item) => item.productId === product.id);
    const currentQtyInCart = existing?.quantity || 0;

    if (currentQtyInCart + requestedQty > product.quantity) {
      setError(
        `Stock insuffisant pour "${product.name}" : ${product.quantity} disponible` +
          (currentQtyInCart > 0 ? `, ${currentQtyInCart} déjà dans le panier.` : '.')
      );
      return;
    }

    setError('');
    setCart((prev) => {
      const newQuantity = currentQtyInCart + requestedQty;
      const unitPrice = getEffectiveUnitPrice(product, newQuantity);
      return existing
        ? prev.map((item) =>
            item.productId === product.id ? { ...item, quantity: newQuantity, unitPrice } : item
          )
        : [
            ...prev,
            {
              productId: product.id,
              productName: product.name,
              quantity: newQuantity,
              unitPrice,
              availableStock: product.quantity,
            },
          ];
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setError('');
  }

  function updateQuantity(productId, rawValue) {
    const newQty = parseInt(rawValue, 10);
    if (Number.isNaN(newQty)) return;
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }
    const product = products.find((p) => p.id === productId);
    if (product && newQty > product.quantity) {
      setError(`Stock insuffisant pour "${product.name}" (disponible : ${product.quantity}).`);
      return;
    }
    setError('');
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId
          ? { ...item, quantity: newQty, unitPrice: product ? getEffectiveUnitPrice(product, newQty) : item.unitPrice }
          : item
      )
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const taxAmount = (subtotal - discountAmount) * (taxPercent / 100);
  const total = subtotal - discountAmount + taxAmount;
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  function handleOpenCustomerStep() {
    if (cart.length === 0) {
      setError('Le panier est vide.');
      return;
    }
    setError('');
    setShowCustomerStep(true);
  }

  function handleCustomerConfirmed(customer) {
    setSelectedCustomer(customer);
    setShowCustomerStep(false);
    setShowSummaryStep(true);
  }

  async function handleConfirmOrder(amountPaid) {
    setError('');
    setSubmitting(true);

    try {
      const { data } = await apiClient.post('/orders', {
        items: cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        paymentMethod,
        discount: discountAmount,
        tax: taxAmount,
        amountPaid,
        ...(selectedCustomer?.isNewCustomer
          ? { newCustomer: { name: selectedCustomer.name, phone: selectedCustomer.phone } }
          : { customerId: selectedCustomer?.id ?? null }),
      });

      setReceipt({
        receiptText: data.receipt,
        order: {
          storeName: data.receiptContext?.store?.name || activeStore?.name,
          storeAddress: data.receiptContext?.store?.address,
          storePhone: data.receiptContext?.store?.phone,
          sellerName: data.receiptContext?.sellerName,
          receiptSettings: data.receiptContext?.receiptSettings,
          orderNumber: data.orderNumber,
          createdAt: data.createdAt,
          items: data.items,
          totalAmount: data.totalAmount,
          discountAmount,
          taxAmount,
          amountPaid,
          customerName: selectedCustomer?.name || null,
        },
      });
      setShowSummaryStep(false);
      setSelectedCustomer(null);
      setCart([]);
      setDiscountPercent(0);
      setTaxPercent(0);
      setPaymentMethod('CASH');
      setDrawerRefreshSignal((s) => s + 1);
      await loadCatalog();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Erreur lors de la validation de la vente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* --- CATALOGUE --- */}
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Caisse</h1>

        <CashDrawerBanner refreshSignal={drawerRefreshSignal} />

        {error && (
          <div className="flex items-start justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
              ×
            </button>
          </div>
        )}

        <div className="flex flex-col gap-3 mb-4 sm:flex-row">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un produit..."
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Toutes catégories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {loadingProducts ? (
          <p className="text-sm text-slate-400">Chargement des produits...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Aucun produit trouvé.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
              {visibleProducts.map((product) => {
                const cartItem = cart.find((item) => item.productId === product.id);
                return (
                  <PosProductCard
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
                  <div
                    key={item.productId}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 leading-tight">
                        {item.productName}
                      </span>
                      <button
                        onClick={() => removeFromCart(item.productId)}
                        className="shrink-0 text-slate-300 hover:text-red-500 transition"
                        aria-label="Retirer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.productId, e.target.value)}
                          className="w-10 text-center rounded border border-slate-300 text-sm py-0.5 bg-white"
                        />
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {formatGNF(item.quantity * item.unitPrice)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 text-sm border-t border-slate-100 pt-3">
              <div className="flex justify-between text-slate-600">
                <span>Sous-total</span>
                <span>{formatGNF(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <span>Réduction (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) =>
                    setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                  }
                  className="w-16 rounded border border-slate-300 text-center text-sm py-0.5"
                />
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-600">
                <span>Taxe (%)</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={taxPercent}
                  onChange={(e) =>
                    setTaxPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))
                  }
                  className="w-16 rounded border border-slate-300 text-center text-sm py-0.5"
                />
              </div>
              <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
                <span>TOTAL</span>
                <span>{formatGNF(total)}</span>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-slate-600 mb-1">
                Méthode de paiement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="CARD">Carte</option>
                <option value="OTHER">Autre</option>
              </select>
            </div>

            <button
              onClick={handleOpenCustomerStep}
              disabled={cart.length === 0 || submitting || isFrozen}
              title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
              className="w-full mt-4 rounded-lg bg-brand-500 text-white text-sm font-semibold py-3 hover:bg-brand-600 transition disabled:opacity-50"
            >
              {isFrozen ? 'Boutique en mode gratuit' : submitting ? 'Validation en cours...' : 'Valider la vente'}
            </button>
          </div>
        </div>
      </div>

      {showCustomerStep && (
        <CustomerStepModal
          onConfirm={handleCustomerConfirmed}
          onBack={() => setShowCustomerStep(false)}
        />
      )}

      {showSummaryStep && (
        <OrderSummaryModal
          cart={cart}
          subtotal={subtotal}
          discountAmount={discountAmount}
          taxAmount={taxAmount}
          total={total}
          paymentMethod={paymentMethod}
          customer={selectedCustomer}
          onConfirm={handleConfirmOrder}
          onBack={() => {
            setShowSummaryStep(false);
            setShowCustomerStep(true);
          }}
          submitting={submitting}
          error={error}
        />
      )}

      {receipt && (
        <ReceiptModal
          receiptText={receipt.receiptText}
          order={receipt.order}
          onClose={() => setReceipt(null)}
        />
      )}
    </div>
  );
}