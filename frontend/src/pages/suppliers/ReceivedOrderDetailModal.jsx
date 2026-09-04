import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';

const STATUS_LABELS = {
  PENDING: 'En attente',
  DELIVERED: 'Livrée',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/**
 * Détail d'une commande reçue D'UN CLIENT (§29_commande_depuis_fournisseur_plateforme.sql,
 * décidé en conversation) — RÉCEPTION/ANNULATION restent le rôle exclusif
 * du client (acheteur), jamais touché ici. Depuis
 * §49_confirmation_livraison_fournisseur.sql (décidé en conversation), une
 * seule action possible ici : confirmer l'expédition ("Marquer comme
 * livré") — condition désormais requise avant que le client ne puisse
 * marquer sa commande reçue, pour empêcher une fausse commande de
 * décrémenter le stock sans confirmation d'expédition réelle. N'apparaît
 * que si `requiresDeliveryConfirmation` est vrai (commande créée après ce
 * correctif) — une commande plus ancienne garde l'ancien comportement,
 * jamais d'action à faire ici pour elle.
 */
export default function ReceivedOrderDetailModal({ orderId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadOrder() {
    try {
      const res = await apiClient.get(`/purchases/received-orders/${orderId}`);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger la commande.');
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!cancelled) await loadOrder();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handleDeclareDelivered() {
    if (
      !window.confirm(
        "Confirmer l'expédition de cette commande ? Le client pourra alors la marquer reçue et votre stock sera diminué."
      )
    ) {
      return;
    }
    setError('');
    setBusy(true);
    try {
      await apiClient.post(`/purchases/received-orders/${orderId}/deliver`);
      await loadOrder();
      onChanged?.();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de confirmer l'expédition.");
    } finally {
      setBusy(false);
    }
  }

  const canDeclareDelivered = data && data.order.status === 'PENDING' && data.order.requiresDeliveryConfirmation;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Commande reçue d'un client</h2>
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
                <Info label="Boutique cliente" value={data.order.buyerStoreName} />
                <Info label="Référence" value={data.order.reference || '—'} />
                <Info label="Date de la commande" value={formatDateTime(data.order.createdAt)} />
                <Info label="Statut" value={STATUS_LABELS[data.order.status]} />
                {data.order.deliveredAt && (
                  <Info label="Livrée le" value={formatDateTime(data.order.deliveredAt)} />
                )}
                {data.order.receivedAt && (
                  <Info label="Stock diminué le" value={formatDateTime(data.order.receivedAt)} />
                )}
              </div>

              {data.order.status === 'PENDING' && data.order.requiresDeliveryConfirmation && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                  Confirmez l'expédition ci-dessous dès que la commande part réellement — votre stock ne sera
                  diminué qu'une fois que la boutique cliente confirmera avoir reçu la livraison.
                </p>
              )}
              {data.order.status === 'PENDING' && !data.order.requiresDeliveryConfirmation && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                  En attente — votre stock ne sera diminué que lorsque la boutique cliente confirmera avoir
                  reçu la livraison.
                </p>
              )}
              {data.order.status === 'DELIVERED' && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-2 mb-4">
                  Expédition confirmée — en attente que la boutique cliente confirme la réception.
                </p>
              )}

              <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles commandés</h3>
              <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 mb-4">
                {data.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-slate-700">{item.productName}</span>
                    <span className="font-medium text-slate-700">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap gap-2 shrink-0">
          {canDeclareDelivered && (
            <button
              onClick={handleDeclareDelivered}
              disabled={busy}
              className="rounded-lg bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 hover:bg-blue-100 transition disabled:opacity-60"
            >
              {busy ? 'Traitement...' : 'Marquer comme livré'}
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
