import { useEffect, useState } from 'react';
import { ShoppingCart, ChevronUp, LayoutGrid, List, Trash2 } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore, useIsPlanFrozen } from '@/store/authStore';
import { usePosCartStore } from '@/store/posCartStore';
import { formatGNF } from '@/utils/format';
import UpgradePlanModal from '@/components/UpgradePlanModal';
import PosProductCard from './PosProductCard';
import PosProductListRow from './PosProductListRow';
import PosCartPanel from './PosCartPanel';
import ReceiptModal from './ReceiptModal';
import CustomerStepModal from './CustomerStepModal';
import OrderSummaryModal from './OrderSummaryModal';
import CashDrawerBanner from './CashDrawerBanner';

const PREVIEW_COUNT = 4; // une ligne complète sur la plupart des tailles d'écran
const PREVIEW_COUNT_LIST = 10; // lignes bien plus compactes qu'une carte avec image

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
  const authCanEditPrice = useAuthStore((s) => s.canEditPrice);
  const isFrozen = useIsPlanFrozen();
  // Owner : toujours. Vendeur : seulement si autorisé
  // (§39_prix_editable_vente.sql, décidé en conversation) — même
  // précédent que canVoidReturn, revérifié de toute façon côté serveur.
  const canEditPrice = activeStore?.roleCode === 'OWNER' || authCanEditPrice;

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showAllProducts, setShowAllProducts] = useState(false);
  // Sous lg, le panier n'est plus affiché en ligne (il obligeait à défiler
  // tout le catalogue pour l'atteindre, § décidé en conversation) — une
  // barre persistante en bas d'écran l'ouvre à la demande, dans une
  // fenêtre superposée plutôt que dans le flux normal de la page.
  const [showMobileCart, setShowMobileCart] = useState(false);

  // Panier persisté (§ décidé en conversation : "survivre à la navigation
  // et au rafraîchissement, mais pas à la fermeture") — voir
  // posCartStore.js. Le reste (réduction/taxe/paiement) reste un simple
  // useState : seul le CONTENU du panier a été demandé comme persistant.
  const cart = usePosCartStore((s) => s.cart);
  const setCart = usePosCartStore((s) => s.setCart);
  const cartForStoreId = usePosCartStore((s) => s.forStoreId);
  const setCartForStoreId = usePosCartStore((s) => s.setForStoreId);
  const clearCart = usePosCartStore((s) => s.clearCart);
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
  // Produit verrouillé par plafond de plan (§ décidé en conversation) sur
  // lequel le marchand vient de cliquer "Ajouter" — jamais ajouté au
  // panier, un message d'upgrade s'affiche à la place. planInfo vient de
  // la même réponse que le catalogue, jamais une requête séparée.
  const [upgradeModalProduct, setUpgradeModalProduct] = useState(null);
  const [planInfo, setPlanInfo] = useState(null);
  // Mode d'affichage du catalogue (§ décidé en conversation) — "Grille"
  // (défaut, historique) avec image, ou "Liste" sans image pour un scan
  // rapide. Persisté par appareil (localStorage) : un choix qu'on ne veut
  // pas refaire à chaque visite de la Caisse, mais qui reste local à ce
  // poste plutôt que synchronisé (pas une donnée métier).
  const [viewMode, setViewMode] = useState(() => {
    try {
      return localStorage.getItem('pos-view-mode') === 'list' ? 'list' : 'grid';
    } catch {
      return 'grid';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('pos-view-mode', viewMode);
    } catch {
      // Stockage indisponible (navigation privée...) — le mode reste
      // simplement non mémorisé, sans bloquer l'usage de la Caisse.
    }
  }, [viewMode]);

  // Un panier laissé pour une autre boutique (produits/prix différents) ne
  // doit jamais réapparaître ici — comparé à activeStore.id plutôt que de
  // coupler posCartStore.js à authStore.js pour un vidage automatique.
  useEffect(() => {
    if (!activeStore) return;
    if (cartForStoreId !== activeStore.id) {
      clearCart();
      setCartForStoreId(activeStore.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore?.id]);

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
      setPlanInfo({
        planName: productsRes.data.planName,
        maxProductsPerStore: productsRes.data.maxProductsPerStore,
      });
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

  // Réinitialise l'aperçu dès que la recherche, la catégorie ou le mode
  // d'affichage change (chacun a son propre seuil, cf. previewCount plus
  // bas), pour ne jamais afficher un "Afficher tout" incohérent.
  useEffect(() => {
    setShowAllProducts(false);
  }, [searchTerm, selectedCategory, viewMode]);

  const filteredProducts = products
    .filter((p) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        p.name.toLowerCase().includes(term) || (p.reference || '').toLowerCase().includes(term);
      const matchesCategory = !selectedCategory || p.categoryId === parseInt(selectedCategory, 10);
      return matchesSearch && matchesCategory;
    })
    // Les produits verrouillés (plafond du plan, § décidé en conversation)
    // passent tous après les produits utilisables — tri stable, l'ordre
    // relatif à l'intérieur de chaque groupe reste celui du serveur.
    .sort((a, b) => Number(a.locked) - Number(b.locked));

  // Une ligne "Liste" tient en une fraction de la hauteur d'une carte
  // "Grille" — un même seuil de 4 y paraîtrait bien trop restrictif,
  // obligeant presque toujours un clic sur "Afficher tout".
  const previewCount = viewMode === 'list' ? PREVIEW_COUNT_LIST : PREVIEW_COUNT;
  const visibleProducts = showAllProducts ? filteredProducts : filteredProducts.slice(0, previewCount);
  const hiddenCount = filteredProducts.length - visibleProducts.length;

  function addToCart(product, requestedQty) {
    if (requestedQty <= 0) return;
    if (product.locked) {
      setUpgradeModalProduct(product);
      return;
    }

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
      const normalUnitPrice = getEffectiveUnitPrice(product, newQuantity);
      return existing
        ? prev.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: newQuantity,
                  // Si un prix négocié a déjà été saisi pour cet article,
                  // on le garde — sauf s'il retombe sous le nouveau
                  // plancher (le palier de quantité a pu changer avec la
                  // quantité), auquel cas on le relève juste ce qu'il faut.
                  unitPrice: item.priceEdited ? Math.max(item.unitPrice, normalUnitPrice) : normalUnitPrice,
                }
              : item
          )
        : [
            ...prev,
            {
              productId: product.id,
              productName: product.name,
              quantity: newQuantity,
              unitPrice: normalUnitPrice,
              priceEdited: false,
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
      prev.map((item) => {
        if (item.productId !== productId) return item;
        const normalUnitPrice = product ? getEffectiveUnitPrice(product, newQty) : item.unitPrice;
        return {
          ...item,
          quantity: newQty,
          unitPrice: item.priceEdited ? Math.max(item.unitPrice, normalUnitPrice) : normalUnitPrice,
        };
      })
    );
  }

  // Prix négocié à la vente (§39_prix_editable_vente.sql, décidé en
  // conversation) — jamais en dessous du prix normal (catalogue ou palier
  // de quantité en vigueur) pour un Vendeur ; l'Owner n'a lui aucun
  // plancher. Volontairement PAS clampé au fil de la saisie ici (ça
  // empêcherait de taper "15000" si le plancher est "12000" — le premier
  // "1" serait aussitôt remonté à 12000) : on laisse taper librement, et
  // on n'empêche que la validation finale si le prix retombe sous le
  // plancher (voir cartHasPriceBelowFloor plus bas). Le serveur revérifie
  // de toute façon ce même plancher indépendamment à la création de la
  // vente — seule autorité réelle.
  function updateUnitPrice(productId, rawValue) {
    const parsed = Math.max(0, parseFloat(rawValue) || 0);
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, unitPrice: parsed, priceEdited: true } : item
      )
    );
  }

  function normalUnitPriceFor(item) {
    const product = products.find((p) => p.id === item.productId);
    return product ? getEffectiveUnitPrice(product, item.quantity) : item.unitPrice;
  }

  // Vider le panier (§ décidé en conversation) — un seul point d'entrée,
  // partagé par le panneau (desktop + feuille mobile) ET la barre
  // persistante mobile, pour ne jamais dupliquer la confirmation.
  function handleClearCart() {
    if (cart.length === 0) return;
    if (window.confirm('Vider le panier ? Tous les articles ajoutés seront retirés.')) {
      clearCart();
    }
  }

  const cartHasPriceBelowFloor =
    activeStore?.roleCode !== 'OWNER' &&
    cart.some((item) => item.priceEdited && item.unitPrice < normalUnitPriceFor(item));

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
    if (cartHasPriceBelowFloor) {
      setError('Un prix saisi est inférieur au prix minimum autorisé — corrigez-le avant de continuer.');
      return;
    }
    setError('');
    setShowMobileCart(false);
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
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          ...(item.priceEdited ? { unitPrice: item.unitPrice } : {}),
        })),
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
          orderId: data.orderId,
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
      clearCart();
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
      <div className="flex-1 min-w-0 pb-20 lg:pb-0">
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
          <button
            onClick={() => setViewMode((m) => (m === 'grid' ? 'list' : 'grid'))}
            title={viewMode === 'grid' ? 'Passer en affichage liste' : 'Passer en affichage grille'}
            aria-label={viewMode === 'grid' ? 'Passer en affichage liste' : 'Passer en affichage grille'}
            className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition"
          >
            {viewMode === 'grid' ? <List size={17} /> : <LayoutGrid size={17} />}
          </button>
        </div>

        {loadingProducts ? (
          <p className="text-sm text-slate-400">Chargement des produits...</p>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
            Aucun produit trouvé.
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
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
            ) : (
              <div className="space-y-2">
                {visibleProducts.map((product) => {
                  const cartItem = cart.find((item) => item.productId === product.id);
                  return (
                    <PosProductListRow
                      key={product.id}
                      product={product}
                      cartQuantity={cartItem?.quantity || 0}
                      onAdd={addToCart}
                    />
                  );
                })}
              </div>
            )}

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

      {/* --- PANIER : colonne latérale collante sur desktop --- */}
      <div className="hidden lg:block lg:w-96 shrink-0">
        <div className="lg:sticky lg:top-6">
          <PosCartPanel
            cart={cart}
            itemCount={itemCount}
            subtotal={subtotal}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            taxPercent={taxPercent}
            setTaxPercent={setTaxPercent}
            total={total}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            canEditPrice={canEditPrice}
            activeStore={activeStore}
            isFrozen={isFrozen}
            cartHasPriceBelowFloor={cartHasPriceBelowFloor}
            submitting={submitting}
            removeFromCart={removeFromCart}
            updateQuantity={updateQuantity}
            updateUnitPrice={updateUnitPrice}
            normalUnitPriceFor={normalUnitPriceFor}
            handleOpenCustomerStep={handleOpenCustomerStep}
            clearCart={clearCart}
          />
        </div>
      </div>

      {/* --- Barre panier persistante sous lg : le panier reste toujours
          atteignable en un tap, sans jamais devoir défiler tout le
          catalogue pour y arriver (§ décidé en conversation). Espace
          réservé en bas de la colonne catalogue (pb-20) pour qu'elle ne
          recouvre jamais le dernier produit. "Vider" est un bouton séparé
          au coin droit — visible sans devoir ouvrir le panier, jamais
          gêné par le tap sur le reste de la barre (stopPropagation). --- */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-slate-200 bg-white shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setShowMobileCart(true)}
          className="flex flex-1 min-w-0 items-center gap-3 px-4 py-3"
        >
          <div className="relative shrink-0">
            <ShoppingCart size={20} className={itemCount > 0 ? 'text-brand-600' : 'text-slate-300'} />
            {itemCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </div>
          <span className={`flex-1 min-w-0 truncate text-left text-sm font-semibold ${itemCount > 0 ? 'text-slate-800' : 'text-slate-400'}`}>
            {itemCount > 0 ? formatGNF(total) : 'Panier vide'}
          </span>
          <ChevronUp size={18} className="shrink-0 text-slate-400" />
        </button>
        {itemCount > 0 && (
          <button
            onClick={handleClearCart}
            title="Vider le panier"
            aria-label="Vider le panier"
            className="shrink-0 flex items-center px-4 border-l border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {showMobileCart && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/60 flex items-end justify-center z-50"
          onClick={() => setShowMobileCart(false)}
        >
          <div
            className="w-full max-h-[88vh] overflow-y-auto rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <PosCartPanel
              cart={cart}
              itemCount={itemCount}
              subtotal={subtotal}
              discountPercent={discountPercent}
              setDiscountPercent={setDiscountPercent}
              taxPercent={taxPercent}
              setTaxPercent={setTaxPercent}
              total={total}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              canEditPrice={canEditPrice}
              activeStore={activeStore}
              isFrozen={isFrozen}
              cartHasPriceBelowFloor={cartHasPriceBelowFloor}
              submitting={submitting}
              removeFromCart={removeFromCart}
              updateQuantity={updateQuantity}
              updateUnitPrice={updateUnitPrice}
              normalUnitPriceFor={normalUnitPriceFor}
              handleOpenCustomerStep={handleOpenCustomerStep}
              clearCart={clearCart}
              onClose={() => setShowMobileCart(false)}
            />
          </div>
        </div>
      )}

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

      {upgradeModalProduct && planInfo && (
        <UpgradePlanModal
          planName={planInfo.planName}
          maxProductsPerStore={planInfo.maxProductsPerStore}
          productName={upgradeModalProduct.name}
          onClose={() => setUpgradeModalProduct(null)}
        />
      )}
    </div>
  );
}