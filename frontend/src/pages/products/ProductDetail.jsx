import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

const MOVEMENT_LABELS = {
  INITIAL_STOCK: 'Stock initial',
  PURCHASE_IN: 'Achat reçu',
  SALE_OUT: 'Vente',
  RETURN_IN: 'Retour',
  ADJUSTMENT: 'Ajustement',
  TRANSFER_OUT: 'Transfert sortant',
  TRANSFER_IN: 'Transfert entrant',
};

/**
 * Modal détail produit + historique de stock.
 * Endpoint corrigé : /products/:id/stock-history (et non /stock/history/:id
 * qui n'existe pas côté backend — voir products.routes.js).
 */
export default function ProductDetail({ product, onClose }) {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(`/products/${product.id}/stock-history`);
        if (!cancelled) setMovements(data.history || []);
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || "Erreur lors du chargement de l'historique.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product.id]);

  const margin = product.sellingPrice - product.purchasePrice;
  const marginPercent = product.purchasePrice ? ((margin / product.purchasePrice) * 100).toFixed(0) : '—';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Détails du produit</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{product.name}</h3>
            <p className="text-sm text-slate-400">Référence : {product.reference || '—'}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <InfoCard label="Prix d'achat" value={formatGNF(product.purchasePrice)} />
            <InfoCard label="Prix de vente" value={formatGNF(product.sellingPrice)} />
            <InfoCard label="Marge brute" value={`${formatGNF(margin)} (${marginPercent}%)`} />
            <InfoCard label="Stock actuel" value={product.quantity} />
            <InfoCard label="Seuil d'alerte" value={product.lowStockThreshold} />
            <InfoCard
              label="Statut"
              value={
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    product.status === 'ACTIVE'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {product.status}
                </span>
              }
            />
          </div>

          {product.description && (
            <div>
              <h4 className="text-sm font-semibold text-slate-700 mb-1">Description</h4>
              <p className="text-sm text-slate-600">{product.description}</p>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-3">
              Historique de stock (mouvements immuables)
            </h3>

            {loading ? (
              <p className="text-sm text-slate-400">Chargement...</p>
            ) : error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : movements.length === 0 ? (
              <p className="text-sm text-slate-400">Aucun mouvement de stock.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-3 py-2">Date</th>
                      <th className="text-left px-3 py-2">Type</th>
                      <th className="text-right px-3 py-2">Quantité</th>
                      <th className="text-left px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mvt) => (
                      <tr key={mvt.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                          {formatDateTime(mvt.createdAt)}
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-block rounded-full bg-slate-100 text-slate-700 px-2 py-0.5 text-xs font-medium">
                            {MOVEMENT_LABELS[mvt.type] || mvt.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-slate-700">
                          {mvt.quantity}
                        </td>
                        <td className="px-3 py-2 text-slate-500">{mvt.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end">
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

function InfoCard({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}