import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDate, formatDateTime } from '@/utils/format';
import AuditLogPanel from '@/components/AuditLogPanel';

const TABS = [
  { key: 'apercu', label: 'Aperçu' },
  { key: 'produits', label: 'Produits & Stock' },
  { key: 'ventes', label: 'Ventes' },
  { key: 'journal', label: 'Journal' },
];

const PAYMENT_STATUS_LABELS = { PAID: 'Total', PARTIALLY_PAID: 'Partiel', PENDING: 'Non payé' };

/**
 * Détail en lecture stricte d'une boutique supervisée (§ décidé en
 * conversation) — remplace l'ancienne fenêtre modale (SuperviseStoreDetailModal,
 * supprimée) par une vraie page à onglets, la quantité d'information
 * demandée (produits/stock, ventes avec sélecteur de date, journal
 * d'activité) ne tenant plus dans une modale. Aucune action possible nulle
 * part sur cette page — uniquement des données déjà exposées en lecture
 * par les routes /supervision/stores/:storeId/*.
 */
export default function SupervisedStoreDetailPage() {
  const { storeId } = useParams();
  const [tab, setTab] = useState('apercu');
  const [storeName, setStoreName] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/stats`);
        if (!cancelled) setStoreName(data.store.name);
      } catch {
        // Le nom reste vide si la requête échoue — chaque onglet affiche
        // de toute façon sa propre erreur d'accès le cas échéant.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  return (
    <div>
      <Link
        to="/account/supervise"
        className="inline-flex items-center gap-1 text-sm text-brand-500 hover:underline mb-2"
      >
        <ChevronLeft size={16} /> Superviser
      </Link>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">{storeName || 'Boutique supervisée'}</h1>
      <p className="text-sm text-slate-500 mb-6">
        Vue en lecture seule stricte — aucune action possible depuis cette page.
      </p>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition ${
              tab === t.key
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'apercu' && <OverviewTab storeId={storeId} />}
      {tab === 'produits' && <ProductsStockTab storeId={storeId} />}
      {tab === 'ventes' && <SalesTab storeId={storeId} />}
      {tab === 'journal' && <JournalTab storeId={storeId} />}
    </div>
  );
}

function OverviewTab({ storeId }) {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/stats`);
        if (!cancelled) setStats(data.stats);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger les statistiques.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!stats) return <p className="text-sm text-slate-400">Chargement...</p>;

  const maxTrend = Math.max(1, ...stats.revenueTrend.map((d) => Number(d.revenue)));

  return (
    <div className="max-w-2xl">
      <div className="grid grid-cols-2 gap-3 mb-6">
        <MiniStat label="Ventes du jour" value={formatGNF(stats.today.revenue)} />
        <MiniStat label="Bénéfice du jour" value={formatGNF(stats.today.profit)} accent="green" />
        <MiniStat label="Commandes" value={stats.today.ordersCount} />
        <MiniStat
          label="Produits en rupture"
          value={stats.lowStockCount}
          accent={stats.lowStockCount > 0 ? 'red' : undefined}
        />
      </div>

      <h3 className="text-sm font-semibold text-slate-700 mb-3">Évolution des ventes (7 derniers jours)</h3>
      {stats.revenueTrend.length === 0 ? (
        <p className="text-sm text-slate-400 mb-6">Aucune vente sur cette période.</p>
      ) : (
        <div className="flex items-end gap-2 h-24 mb-6">
          {stats.revenueTrend.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full bg-brand-400 rounded-t"
                style={{ height: `${Math.max(4, (Number(d.revenue) / maxTrend) * 100)}%` }}
                title={formatGNF(d.revenue)}
              />
              <span className="text-[10px] text-slate-400">{formatDate(d.day).slice(0, 5)}</span>
            </div>
          ))}
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-700 mb-2">Produits les plus vendus (30 derniers jours)</h3>
      {stats.topProducts.length === 0 ? (
        <p className="text-sm text-slate-400">Aucune vente sur cette période.</p>
      ) : (
        <ul className="space-y-1.5">
          {stats.topProducts.map((p, i) => (
            <li key={p.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">
                <span className="text-slate-400 mr-2">#{i + 1}</span>
                {p.name}
              </span>
              <span className="font-medium text-slate-800">{p.totalSold} vendus</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  const accentClass = accent === 'green' ? 'text-green-700' : accent === 'red' ? 'text-red-600' : 'text-slate-800';
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold ${accentClass}`}>{value}</p>
    </div>
  );
}

function ProductsStockTab({ storeId }) {
  const [products, setProducts] = useState(null);
  const [movements, setMovements] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productsRes, movementsRes] = await Promise.all([
          apiClient.get(`/supervision/stores/${storeId}/products`, { params: { limit: 100 } }),
          apiClient.get(`/supervision/stores/${storeId}/stock-movements`, { params: { limit: 50 } }),
        ]);
        if (cancelled) return;
        setProducts(productsRes.data.products);
        setMovements(movementsRes.data.movements);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger le catalogue.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Catalogue produits</h3>
      {!products ? (
        <p className="text-sm text-slate-400 mb-8">Chargement...</p>
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm mb-8">
          Aucun produit pour l'instant.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-8">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {products.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{p.reference || '—'}</p>
                  </div>
                  <span className={`shrink-0 font-medium ${p.quantity <= p.lowStockThreshold ? 'text-red-600' : 'text-slate-700'}`}>
                    Stock : {p.quantity}
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  Achat {formatGNF(p.purchasePrice)} · Vente <span className="font-medium text-slate-700">{formatGNF(p.sellingPrice)}</span>
                </p>
              </div>
            ))}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3">Référence</th>
                <th className="text-right px-4 py-3">Prix d'achat</th>
                <th className="text-right px-4 py-3">Prix de vente</th>
                <th className="text-right px-4 py-3">Stock</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500">{p.reference || '—'}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatGNF(p.purchasePrice)}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{formatGNF(p.sellingPrice)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={p.quantity <= p.lowStockThreshold ? 'text-red-600 font-semibold' : 'text-slate-700'}>
                      {p.quantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="text-sm font-semibold text-slate-700 mb-3">Mouvements de stock récents</h3>
      {!movements ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : movements.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
          Aucun mouvement pour l'instant.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {movements.map((m) => (
              <div key={m.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-slate-700 truncate">{m.productName}</p>
                  <p className="text-xs text-slate-400">{m.type} · {formatDateTime(m.createdAt)}</p>
                </div>
                <span className="shrink-0 font-medium text-slate-700">{m.quantity}</span>
              </div>
            ))}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-right px-4 py-3">Quantité</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(m.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-700">{m.productName}</td>
                  <td className="px-4 py-3 text-slate-500">{m.type}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{m.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SalesTab({ storeId }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setOrders(null);
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/orders`, { params: { date } });
        if (!cancelled) setOrders(data.orders);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger les ventes.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, date]);

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-slate-600">Date :</label>
        <input
          type="date"
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {!orders ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
          Aucune vente ce jour-là.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {orders.map((o) => {
              const remaining = Number(o.totalAmount) - Number(o.amountPaid ?? o.totalAmount);
              return (
                <button
                  key={o.id}
                  onClick={() => setSelectedOrderId(o.id)}
                  className="w-full text-left p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-brand-600 truncate">{o.orderNumber}</p>
                      <p className="text-xs text-slate-400">
                        {o.customerName || 'Anonyme'} · {formatDateTime(o.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        o.paymentStatus === 'PAID'
                          ? 'bg-green-50 text-green-700'
                          : o.paymentStatus === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-red-50 text-red-700'
                      }`}
                    >
                      {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 text-sm">
                    {remaining > 0 && (
                      <span className="text-slate-500">Reste : {formatGNF(remaining)}</span>
                    )}
                    <span className="font-medium text-slate-800 ml-auto">{formatGNF(o.totalAmount)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">N° commande</th>
                <th className="text-left px-4 py-3">Heure</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-right px-4 py-3">Total</th>
                <th className="text-left px-4 py-3">Paiement</th>
                <th className="text-right px-4 py-3">Reste à payer</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const remaining = Number(o.totalAmount) - Number(o.amountPaid ?? o.totalAmount);
                return (
                  <tr
                    key={o.id}
                    onClick={() => setSelectedOrderId(o.id)}
                    className="border-t border-slate-100 cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 font-medium text-brand-600">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDateTime(o.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{o.customerName || 'Anonyme'}</td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatGNF(o.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          o.paymentStatus === 'PAID'
                            ? 'bg-green-50 text-green-700'
                            : o.paymentStatus === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[o.paymentStatus] || o.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">
                      {remaining > 0 ? formatGNF(remaining) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrderId && (
        <SupervisedOrderDetailModal
          storeId={storeId}
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}

function SupervisedOrderDetailModal({ storeId, orderId, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/orders/${orderId}`);
        if (!cancelled) setData(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger cette vente.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, orderId]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Détail de la vente</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>
        <div className="px-6 py-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : !data ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <>
              <p className="text-sm text-slate-500 mb-1">Client</p>
              <p className="font-medium text-slate-800 mb-4">{data.order.customerName || 'Anonyme'}</p>
              <ul className="space-y-2 mb-4">
                {data.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">
                      {item.productName} × {item.quantity}
                    </span>
                    <span className="font-medium text-slate-800">{formatGNF(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-slate-100 pt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total</span>
                  <span className="font-semibold text-slate-800">{formatGNF(data.order.totalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payé</span>
                  <span className="text-slate-700">{formatGNF(data.order.amountPaid ?? data.order.totalAmount)}</span>
                </div>
              </div>
            </>
          )}
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

function JournalTab({ storeId }) {
  return <AuditLogPanel endpoint={`/supervision/stores/${storeId}/audit-log`} />;
}
