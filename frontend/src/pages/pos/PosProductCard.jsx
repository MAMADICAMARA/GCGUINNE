import { useState } from 'react';
import { Plus } from 'lucide-react';
import { formatGNF } from '@/utils/format';

export default function PosProductCard({ product, cartQuantity, onAdd }) {
  const [quantity, setQuantity] = useState(1);
  const isOutOfStock = product.quantity === 0;
  const isLow = product.quantity <= product.lowStockThreshold;

  const stockBadge = (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
        isOutOfStock
          ? 'bg-red-50 text-red-600'
          : isLow
            ? 'bg-amber-50 text-amber-700'
            : 'bg-slate-50 text-slate-500'
      }`}
    >
      Stock : {product.quantity}
    </span>
  );

  return (
    <div
      className={`rounded-xl border bg-white p-2 md:p-3 flex flex-col gap-2 ${
        cartQuantity > 0 ? 'border-brand-400 ring-1 ring-brand-100' : 'border-slate-200'
      }`}
    >
      {/* ---- Version mobile : rangée horizontale compacte ---- */}
      <div className="flex md:hidden items-center gap-3">
        <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xl">📦</span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-slate-400 truncate">{product.reference || '—'}</span>
            <span className="text-slate-300 text-xs">•</span>
            {stockBadge}
          </div>
          {cartQuantity > 0 && (
            <span className="text-xs font-medium text-brand-600 block mt-0.5">
              Panier : {cartQuantity}
            </span>
          )}
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="text-sm font-semibold text-slate-800">{formatGNF(product.sellingPrice)}</p>
          <button
            onClick={() => onAdd(product, 1)}
            disabled={isOutOfStock}
            className="rounded-full bg-brand-500 text-white p-1.5 hover:bg-brand-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={16} />
          </button>
        </div>
      </div>

      {/* ---- Version desktop : card verticale (inchangée) ---- */}
      <div className="hidden md:flex md:flex-col gap-2">
        <div className="h-20 rounded-lg bg-slate-50 flex items-center justify-center overflow-hidden">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl">📦</span>
          )}
        </div>

        <div>
          <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
          <p className="text-xs text-slate-400">{product.reference || '—'}</p>
        </div>

        <div className="flex items-center justify-between">
          {stockBadge}
          {cartQuantity > 0 && (
            <span className="text-xs font-medium text-brand-600">Panier : {cartQuantity}</span>
          )}
        </div>

        <p className="text-sm font-semibold text-slate-800">{formatGNF(product.sellingPrice)}</p>

        <div className="flex gap-2">
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              setQuantity(Number.isNaN(v) ? 1 : Math.max(1, v));
            }}
            className="w-14 rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button
            onClick={() => {
              onAdd(product, quantity);
              setQuantity(1);
            }}
            disabled={isOutOfStock}
            className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-medium py-1.5 hover:bg-brand-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}