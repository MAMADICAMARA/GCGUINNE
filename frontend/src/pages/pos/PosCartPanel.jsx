import { ShoppingCart, Trash2, Minus, Plus, X } from 'lucide-react';
import { formatGNF } from '@/utils/format';

/**
 * Corps du panier — extrait de PosPage.jsx (§ décidé en conversation) pour
 * être partagé entre deux emplacements SANS dupliquer la logique :
 * - Desktop (≥ lg) : colonne latérale collante (sticky), toujours visible.
 * - Mobile (< lg) : caché en ligne, ouvert à la demande depuis la barre
 *   persistante en bas d'écran (PosPage.jsx) — sans cette extraction, le
 *   panier n'était atteignable qu'après avoir défilé tout le catalogue.
 *
 * `onClose` n'est fourni que par l'emplacement mobile (bouton "×" dans
 * l'en-tête) ; le panneau desktop reste toujours ouvert, jamais fermable.
 */
export default function PosCartPanel({
  cart,
  itemCount,
  subtotal,
  discountPercent,
  setDiscountPercent,
  taxPercent,
  setTaxPercent,
  total,
  paymentMethod,
  setPaymentMethod,
  canEditPrice,
  activeStore,
  isFrozen,
  cartHasPriceBelowFloor,
  submitting,
  removeFromCart,
  updateQuantity,
  updateUnitPrice,
  normalUnitPriceFor,
  handleOpenCustomerStep,
  clearCart,
  onClose,
}) {
  function handleClearCart() {
    if (cart.length === 0) return;
    if (window.confirm('Vider le panier ? Tous les articles ajoutés seront retirés.')) {
      clearCart();
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <ShoppingCart size={18} className="text-brand-600" />
          <h2 className="font-semibold text-slate-800">Panier</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-500 bg-white border border-slate-200 rounded-full px-2.5 py-0.5">
            {itemCount} article{itemCount > 1 ? 's' : ''}
          </span>
          {cart.length > 0 && (
            <button
              onClick={handleClearCart}
              title="Vider le panier"
              aria-label="Vider le panier"
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 transition"
            >
              <Trash2 size={13} />
              <span className="hidden sm:inline">Vider</span>
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fermer le panier"
              className="text-slate-400 hover:text-slate-600 transition"
            >
              <X size={18} />
            </button>
          )}
        </div>
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
              <div key={item.productId} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800 leading-tight">{item.productName}</span>
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
                {canEditPrice && (
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <span className="text-xs text-slate-400">Prix unitaire négocié</span>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => updateUnitPrice(item.productId, e.target.value)}
                      className={`w-24 text-right rounded border text-xs py-0.5 px-1.5 bg-white ${
                        activeStore?.roleCode !== 'OWNER' &&
                        item.priceEdited &&
                        item.unitPrice < normalUnitPriceFor(item)
                          ? 'border-red-300 text-red-600'
                          : 'border-slate-300'
                      }`}
                    />
                  </div>
                )}
                {activeStore?.roleCode !== 'OWNER' &&
                  item.priceEdited &&
                  item.unitPrice < normalUnitPriceFor(item) && (
                    <p className="text-[11px] text-red-500 mt-1">
                      Minimum : {formatGNF(normalUnitPriceFor(item))}
                    </p>
                  )}
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
              onChange={(e) => setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
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
              onChange={(e) => setTaxPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
              className="w-16 rounded border border-slate-300 text-center text-sm py-0.5"
            />
          </div>
          <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
            <span>TOTAL</span>
            <span>{formatGNF(total)}</span>
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-600 mb-1">Méthode de paiement</label>
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
          disabled={cart.length === 0 || submitting || isFrozen || cartHasPriceBelowFloor}
          title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
          className="w-full mt-4 rounded-lg bg-brand-500 text-white text-sm font-semibold py-3 hover:bg-brand-600 transition disabled:opacity-50"
        >
          {isFrozen ? 'Boutique en mode gratuit' : submitting ? 'Validation en cours...' : 'Valider la vente'}
        </button>
      </div>
    </div>
  );
}
