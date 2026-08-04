import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';
import ReturnOrderModal from './ReturnOrderModal';

const STATUS_LABELS = {
  PAID: 'Payée',
  RETURNED: 'Retournée',
  PARTIALLY_RETURNED: 'Partiellement retournée',
  VOIDED: 'Annulée',
};

const PAYMENT_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  OTHER: 'Autre',
};

const PAYMENT_STATUS_LABELS = {
  PAID: 'Total',
  PARTIALLY_PAID: 'Partiel',
  PENDING: 'Non payé',
};

/**
 * Détail d'une vente (Historique des ventes) — actions (Annuler/Retourner)
 * réservées à l'Owner, ou à un Vendeur explicitement autorisé par le Owner
 * (§25_autorisation_annulation_retour.sql, décidé en conversation), et
 * dans ce dernier cas uniquement sur ses propres ventes (déjà garanti côté
 * backend : un Vendeur ne peut même pas charger la commande d'un
 * collègue). § décidé en conversation (B1) : "Annuler" annule la commande
 * en entier (stock remis, dette client annulée si elle en avait une) ;
 * "Retourner" ouvre un second modal pour un retour total ou partiel,
 * article par article. Les deux s'appuient sur des routes déjà
 * fonctionnelles (POST /orders/:id/void, POST /orders/:id/items/:id/return).
 */
export default function OrderDetailModal({ orderId, onClose, onChanged }) {
  const roleCode = useAuthStore((s) => s.activeStore?.roleCode);
  const canVoidReturn = useAuthStore((s) => s.canVoidReturn);
  const isAuthorized = roleCode === 'OWNER' || canVoidReturn;

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [voiding, setVoiding] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);

  async function loadOrder() {
    try {
      const res = await apiClient.get(`/orders/${orderId}`);
      setData(res.data);
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

  async function handleVoid() {
    if (
      !window.confirm(
        "Annuler cette vente ? Le stock des articles sera remis, et la dette éventuelle du client sur cette vente sera annulée. Cette action est irréversible."
      )
    ) {
      return;
    }
    setError('');
    setVoiding(true);
    try {
      await apiClient.post(`/orders/${orderId}/void`);
      await loadOrder();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'annuler cette vente.");
    } finally {
      setVoiding(false);
    }
  }

  const canAct =
    isAuthorized && data && data.order.status !== 'VOIDED' && data.order.status !== 'RETURNED';
  const hasReturnableItems =
    data && data.items.some((item) => item.quantity - item.returnedQuantity > 0);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Détail de la vente</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
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
                <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
                  {error}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <Info label="Numéro" value={data.order.orderNumber} />
                <Info label="Date" value={formatDateTime(data.order.createdAt)} />
                <Info label="Vendeur" value={data.order.sellerName} />
                <Info label="Client" value={data.order.customerName || 'Anonyme'} />
                <Info label="Paiement" value={PAYMENT_LABELS[data.order.paymentMethod]} />
                <Info label="Statut" value={STATUS_LABELS[data.order.status]} />
                <Info label="Statut du paiement" value={PAYMENT_STATUS_LABELS[data.order.paymentStatus]} />
              </div>

              <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles</h3>
              <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Produit</th>
                      <th className="text-right px-3 py-2">Qté</th>
                      <th className="text-right px-3 py-2">P.U.</th>
                      <th className="text-right px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">
                          {item.productName}
                          {item.returnedQuantity > 0 && (
                            <span className="block text-xs text-amber-600">
                              {item.returnedQuantity} retourné(s)
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                        <td className="px-3 py-2 text-right">{formatGNF(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatGNF(item.quantity * item.unitPrice)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>Réduction</span>
                  <span>-{formatGNF(data.order.discountAmount)}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Taxe</span>
                  <span>+{formatGNF(data.order.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold text-slate-800 border-t border-slate-100 pt-2">
                  <span>Total</span>
                  <span>{formatGNF(data.order.totalAmount)}</span>
                </div>

                {data.order.amountPaid < data.order.totalAmount && (
                  <>
                    <div className="flex justify-between text-slate-500 pt-1">
                      <span>Montant payé</span>
                      <span>{formatGNF(data.order.amountPaid)}</span>
                    </div>
                    <div className="flex justify-between text-base font-semibold text-red-600">
                      <span>Reste à payer (cette vente)</span>
                      <span>{formatGNF(data.order.totalAmount - data.order.amountPaid)}</span>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2 shrink-0">
          {canAct && (
            <button
              onClick={handleVoid}
              disabled={voiding}
              className="rounded-lg bg-red-50 text-red-700 text-sm font-medium px-4 py-2 hover:bg-red-100 transition disabled:opacity-60"
            >
              {voiding ? 'Annulation...' : 'Annuler la vente'}
            </button>
          )}
          {canAct && hasReturnableItems && (
            <button
              onClick={() => setShowReturnModal(true)}
              className="rounded-lg bg-amber-50 text-amber-700 text-sm font-medium px-4 py-2 hover:bg-amber-100 transition"
            >
              Retourner
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

      {showReturnModal && data && (
        <ReturnOrderModal
          orderId={orderId}
          items={data.items}
          onClose={() => setShowReturnModal(false)}
          onSuccess={async () => {
            setShowReturnModal(false);
            await loadOrder();
            onChanged?.();
          }}
        />
      )}
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
