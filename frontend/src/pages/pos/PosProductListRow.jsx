import { Ban, Lock, Percent, Plus } from 'lucide-react';
import { formatGNF } from '@/utils/format';

/**
 * Mode d'affichage "Liste" de la Caisse (§ décidé en conversation, maquette
 * fournie par l'utilisateur — repensée en version pro/moderne plutôt que
 * suivre le croquis à l'identique) : une ligne compacte SANS image, pensée
 * pour un scan rapide plutôt que la découverte visuelle du mode Grille.
 *
 * Différence volontaire avec PosProductCard : pas de sélecteur de quantité
 * avant l'ajout — un tap sur "+" ajoute 1 unité, la quantité s'ajuste
 * ensuite dans le panier (déjà pourvu de +/-). Garde chaque ligne sur une
 * seule ligne de hauteur, condition même du mode liste.
 */
export default function PosProductListRow({ product, cartQuantity, onAdd }) {
  const isOutOfStock = product.quantity === 0;
  const isLocked = Boolean(product.locked);
  const isLow = product.quantity <= product.lowStockThreshold;
  const hasTiers = Array.isArray(product.priceTiers) && product.priceTiers.length > 0;
  const inCart = cartQuantity > 0;

  const stockColor = isOutOfStock ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500';
  const stockTextColor = isOutOfStock ? 'text-red-600' : isLow ? 'text-amber-700' : 'text-slate-500';

  return (
    <div
      className={`group flex items-center gap-3 rounded-2xl border bg-white px-3.5 py-2.5 sm:px-4 transition-colors ${
        isLocked
          ? 'border-amber-200 bg-amber-50/40'
          : inCart
            ? 'border-brand-300 ring-1 ring-brand-100'
            : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Nom + référence — seule zone qui peut vraiment rétrécir */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-slate-800 truncate">{product.name}</p>
          {hasTiers && (
            <Percent size={12} className="shrink-0 text-brand-500" title="Prix dégressif selon la quantité" />
          )}
        </div>
        <p className="text-xs text-slate-400 truncate">{product.reference || '—'}</p>
      </div>

      {/* Stock */}
      <div className="flex shrink-0 items-center gap-1">
        <span className={`h-1.5 w-1.5 rounded-full ${stockColor}`} />
        <span className={`text-xs font-medium tabular-nums ${stockTextColor}`}>{product.quantity}</span>
      </div>

      {/* Prix */}
      <p className="w-20 shrink-0 whitespace-nowrap text-right text-xs font-bold text-slate-800 tabular-nums sm:w-24 sm:text-sm">
        {formatGNF(product.sellingPrice)}
      </p>

      {/* Ajouter — badge de quantité déjà au panier superposé au coin */}
      <div className="relative shrink-0">
        {inCart && (
          <span className="absolute -top-1.5 -right-1.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white">
            {cartQuantity}
          </span>
        )}
        <button
          onClick={() => onAdd(product, 1)}
          disabled={isOutOfStock}
          title={
            isLocked
              ? 'Verrouillé — passez à un plan supérieur'
              : isOutOfStock
                ? 'Rupture de stock'
                : `Ajouter ${product.name}`
          }
          className={`flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 ${
            isLocked ? 'bg-amber-500 hover:bg-amber-600' : 'bg-brand-500 hover:bg-brand-600 active:scale-95'
          }`}
        >
          {isLocked ? <Lock size={15} /> : isOutOfStock ? <Ban size={15} /> : <Plus size={17} />}
        </button>
      </div>
    </div>
  );
}
