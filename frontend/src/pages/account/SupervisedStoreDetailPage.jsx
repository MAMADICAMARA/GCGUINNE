import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Coins, Wallet, ShoppingBag, AlertCircle, TrendingUp } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDate, formatDateTime } from '@/utils/format';
import AuditLogPanel from '@/components/AuditLogPanel';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Ordre identique à supervised_store_detail_page.dart (Flutter) — les deux
// doivent rester en parité stricte (§ décidé en conversation).
const TABS = [
  { key: 'apercu', label: 'Aperçu' },
  { key: 'recette', label: 'Recette' },
  { key: 'produits', label: 'Produits & Stock' },
  { key: 'ventes', label: 'Historique des ventes' },
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
      {tab === 'recette' && <RecetteTab storeId={storeId} />}
      {tab === 'produits' && <ProductsStockTab storeId={storeId} />}
      {tab === 'ventes' && <SalesTab storeId={storeId} />}
      {tab === 'journal' && <JournalTab storeId={storeId} />}
    </div>
  );
}

function OverviewTab({ storeId }) {
  const [date, setDate] = useState(todayIso());
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/stats`, { params: { date } });
        if (!cancelled) setStats(data.stats);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger les statistiques.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, date]);

  return (
    <div className="max-w-2xl">
      {/* Date consultée (§ décidé en conversation, miroir du Tableau de
          bord et de l'Aperçu paramétrable côté mobile) — jour par défaut :
          aujourd'hui. */}
      <div className="flex items-center gap-3 mb-6">
        <label className="text-sm font-medium text-slate-600">Date :</label>
        <input
          type="date"
          value={date}
          max={todayIso()}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !stats ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <OverviewStats stats={stats} />
      )}
    </div>
  );
}

function OverviewStats({ stats }) {
  const maxTrend = Math.max(1, ...stats.revenueTrend.map((d) => Number(d.revenue)));

  return (
    <div>
      <div className="flex flex-col gap-4 sm:grid sm:grid-cols-4 mb-6">
        <StatCard
          label="Ventes du jour"
          value={formatGNF(stats.today.revenue)}
          icon={Coins}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          label="Bénéfice du jour"
          value={formatGNF(stats.today.profit)}
          icon={Wallet}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-600"
          accent="green"
        />
        <StatCard
          label="Commandes"
          value={stats.today.ordersCount}
          icon={ShoppingBag}
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
        <StatCard
          label="Produits en rupture"
          value={stats.lowStockCount}
          icon={AlertCircle}
          iconBg="bg-rose-50"
          iconColor="text-rose-600"
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

// Même composant que DashboardPage.jsx#StatCard (§ décidé en conversation —
// cartes empilées en colonne sur mobile-web, grille dès sm:, comme le
// Tableau de bord et son miroir dashboard_page.dart côté Flutter).
function StatCard({ label, value, icon: Icon, iconBg, iconColor, accent }) {
  const accentClass = accent === 'green' ? 'text-emerald-700' : accent === 'red' ? 'text-rose-600' : 'text-slate-800';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex items-start justify-between">
      <div>
        <p className="text-xs text-slate-400 uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${accentClass}`}>{value}</p>
      </div>
      <div className={`${iconBg} rounded-xl p-2.5`}>
        <Icon className={`h-5 w-5 ${iconColor}`} strokeWidth={1.75} />
      </div>
    </div>
  );
}

/**
 * Rapport de recette de la boutique supervisée (§ décidé en conversation) —
 * miroir de SalesReportPage.jsx et de _RecetteTab (supervised_store_detail_page.dart
 * côté mobile), mais via /supervision/stores/:storeId/sales-report (lecture
 * seule, aucune écriture).
 */
function RecetteTab({ storeId }) {
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    (async () => {
      try {
        const { data } = await apiClient.get(`/supervision/stores/${storeId}/sales-report`, {
          params: { startDate, endDate },
        });
        if (!cancelled) setReport(data);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error?.message || 'Impossible de charger le rapport.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, startDate, endDate]);

  function setQuickRange(days) {
    const end = todayIso();
    const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-6">
        Chiffre d'affaires total de la boutique, produit par produit, sur la période choisie.
      </p>

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Du</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Au</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayIso()}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setQuickRange(1)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Aujourd'hui
          </button>
          <button
            onClick={() => setQuickRange(7)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            7 jours
          </button>
          <button
            onClick={() => setQuickRange(30)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            30 jours
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
      )}

      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-6 py-5 mb-6 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
          <TrendingUp size={22} className="text-brand-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-brand-700 uppercase tracking-wide">Recette totale</p>
          <p className="text-2xl font-bold text-slate-800">{loading ? '...' : formatGNF(report?.totalRevenue || 0)}</p>
        </div>
      </div>

      <h2 className="text-sm font-semibold text-slate-700 mb-3">Détail par produit</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : !report || report.products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Aucune vente sur cette période.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          {/* Vue mobile : cartes empilées (< md) */}
          <div className="md:hidden divide-y divide-slate-100">
            {report.products.map((p) => (
              <div key={p.productId} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.productName}</p>
                  <p className="text-xs text-slate-400">{p.quantitySold} vendu{p.quantitySold > 1 ? 's' : ''}</p>
                </div>
                <span className="shrink-0 font-semibold text-slate-800">{formatGNF(p.revenue)}</span>
              </div>
            ))}
          </div>

          {/* Vue desktop : tableau complet (dès md) */}
          <table className="hidden md:table w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-right px-4 py-3">Quantité vendue</th>
                <th className="text-right px-4 py-3">Recette générée</th>
              </tr>
            </thead>
            <tbody>
              {report.products.map((p) => (
                <tr key={p.productId} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">{p.productName}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{p.quantitySold}</td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">{formatGNF(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
