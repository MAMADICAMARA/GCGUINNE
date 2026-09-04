import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

const STATUS_LABELS = {
  PENDING: 'En attente',
  DELIVERED: 'Livrée par le fournisseur',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/**
 * Détail d'une commande d'achat — "Marquer reçue" met à jour le stock de
 * tous les articles en un seul geste (§28_commandes_achat_premium.sql,
 * décidé en conversation) ; "Annuler" reste possible tant que rien n'a
 * encore été reçu. Ces deux actions restent disponibles même si la
 * boutique a depuis perdu l'accès PREMIUM — seule la création d'une
 * nouvelle commande est verrouillée par le plan.
 *
 * §49_confirmation_livraison_fournisseur.sql (décidé en conversation) :
 * pour une commande passée auprès d'un fournisseur DE LA PLATEFORME et
 * créée après ce correctif (`requiresDeliveryConfirmation`), le fournisseur
 * doit d'abord confirmer l'expédition (statut DELIVERED) avant que
 * "Marquer reçue" ne soit disponible ici — sans ça, une fausse commande
 * immédiatement "reçue" décrémentait le stock du fournisseur sans qu'il
 * n'ait jamais rien confirmé. Une commande antérieure à ce correctif, ou
 * venant d'un fournisseur externe (simple carnet d'adresses), garde
 * l'ancien comportement : réception directe depuis PENDING.
 */
export default function PurchaseOrderDetailModal({ orderId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Prix de vente modifiable par ligne, uniquement pour un fournisseur DE LA
  // PLATEFORME (§ décidé en conversation) — le prix d'achat, lui, n'est
  // jamais éditable ici : il reste celui négocié à la création de la
  // commande (`item.purchasePrice`), affiché en lecture seule.
  const [sellingPriceEdits, setSellingPriceEdits] = useState({});

  async function loadOrder() {
    try {
      const res = await apiClient.get(`/purchases/orders/${orderId}`);
      setData(res.data);
      setSellingPriceEdits(
        Object.fromEntries(res.data.items.map((item) => [item.id, String(item.currentSellingPrice ?? '')]))
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger la commande.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      await loadOrder();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleReceive() {
    if (
      !window.confirm(
        'Marquer cette commande comme reçue ? Le stock de chaque article sera immédiatement augmenté de la quantité commandée. Cette action est irréversible.'
      )
    ) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      const items =
        data.order.supplierType === 'PLATFORM'
          ? data.items
              .map((item) => ({ itemId: item.id, sellingPrice: Number(sellingPriceEdits[item.id]) }))
              .filter((entry) => Number.isFinite(entry.sellingPrice) && entry.sellingPrice >= 0)
          : undefined;
      await apiClient.post(`/purchases/orders/${orderId}/receive`, { items });
      await loadOrder();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de marquer cette commande reçue.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!window.confirm('Annuler cette commande ? Cette action est irréversible.')) return;
    setError('');
    setBusy(true);
    try {
      await apiClient.post(`/purchases/orders/${orderId}/cancel`);
      await loadOrder();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'annuler cette commande.");
    } finally {
      setBusy(false);
    }
  }

  const needsDeliveryFirst = data && data.order.supplierType === 'PLATFORM' && data.order.requiresDeliveryConfirmation;
  const canReceive = data && (needsDeliveryFirst ? data.order.status === 'DELIVERED' : data.order.status === 'PENDING');
  const canCancel = data && data.order.status === 'PENDING';
  const waitingOnSupplier = needsDeliveryFirst && data.order.status === 'PENDING';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Détail de la commande</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : error && !data ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 text-sm">
                <Info label="Fournisseur" value={data.order.supplierName} />
                <Info label="Référence" value={data.order.reference || '—'} />
                <Info label="Créée par" value={data.order.createdByName} />
                <Info label="Date" value={formatDateTime(data.order.createdAt)} />
                <Info label="Statut" value={STATUS_LABELS[data.order.status]} />
                {data.order.deliveredAt && <Info label="Livrée le" value={formatDateTime(data.order.deliveredAt)} />}
                {data.order.receivedAt && <Info label="Reçue le" value={formatDateTime(data.order.receivedAt)} />}
                {data.order.receivedByName && <Info label="Reçue par" value={data.order.receivedByName} />}
              </div>

              <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles</h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-4">
                {data.items.map((item) => (
                  <div key={item.id} className="px-3 py-2 flex gap-3">
                    {item.productImageUrl && (
                      <img
                        src={item.productImageUrl}
                        alt=""
                        className="h-10 w-10 rounded-md object-cover shrink-0 border border-slate-100"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{item.productName}</p>
                      {item.reference && <p className="text-xs text-slate-400">Réf. {item.reference}</p>}
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-slate-500">
                          {item.quantity} × {formatGNF(item.purchasePrice)} (achat)
                        </span>
                        <span className="text-sm font-medium text-slate-800">
                          {formatGNF(item.quantity * item.purchasePrice)}
                        </span>
                      </div>
                      {canReceive && data.order.supplierType === 'PLATFORM' && (
                        <label className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                          Prix de vente
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={sellingPriceEdits[item.id] ?? ''}
                            onChange={(e) =>
                              setSellingPriceEdits((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="w-28 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          GNF
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
                <span>Total</span>
                <span>{formatGNF(data.order.totalAmount)}</span>
              </div>

              {waitingOnSupplier && (
                <p className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                  En attente que le fournisseur confirme l'expédition de cette commande.
                </p>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2 shrink-0">
          {canReceive && (
            <button
              onClick={handleReceive}
              disabled={busy}
              className="rounded-lg bg-green-50 text-green-700 text-sm font-medium px-4 py-2 hover:bg-green-100 transition disabled:opacity-60"
            >
              {busy ? 'Traitement...' : 'Marquer reçue'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={busy}
              className="rounded-lg bg-red-50 text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-100 transition disabled:opacity-60"
            >
              Annuler la commande
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition ml-auto"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-slate-800 font-medium">{value}</p>
    </div>
  );
}
