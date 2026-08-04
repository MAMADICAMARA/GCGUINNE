import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';

const STATUS_LABELS = {
  PENDING: 'En attente',
  RECEIVED: 'Reçue',
  CANCELLED: 'Annulée',
};

/**
 * Détail d'une commande reçue D'UN CLIENT (§29_commande_depuis_fournisseur_plateforme.sql,
 * décidé en conversation) — lecture seule stricte : aucune action possible
 * ici, c'est toujours le client (acheteur) qui contrôle le cycle de vie de
 * sa commande (confirmer la réception, annuler). Cette boutique constate
 * seulement ce qui a été commandé chez elle, et si son stock a déjà été
 * diminué en conséquence (statut "Reçue").
 */
export default function ReceivedOrderDetailModal({ orderId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiClient.get(`/purchases/received-orders/${orderId}`);
        if (!cancelled) setData(res.data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger la commande.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

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
          ) : error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-5 text-sm">
                <Info label="Boutique cliente" value={data.order.buyerStoreName} />
                <Info label="Référence" value={data.order.reference || '—'} />
                <Info label="Date de la commande" value={formatDateTime(data.order.createdAt)} />
                <Info label="Statut" value={STATUS_LABELS[data.order.status]} />
                {data.order.receivedAt && (
                  <Info label="Stock diminué le" value={formatDateTime(data.order.receivedAt)} />
                )}
              </div>

              {data.order.status === 'PENDING' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
                  En attente — votre stock ne sera diminué que lorsque la boutique cliente confirmera avoir
                  reçu la livraison.
                </p>
              )}

              <h3 className="text-sm font-semibold text-slate-700 mb-2">Articles commandés</h3>
              <div className="rounded-lg border border-slate-200 overflow-hidden mb-4">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                    <tr>
                      <th className="text-left px-3 py-2">Produit</th>
                      <th className="text-right px-3 py-2">Qté</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{item.productName}</td>
                        <td className="px-3 py-2 text-right">{item.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
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
