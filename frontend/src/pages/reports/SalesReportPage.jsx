import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';
import { useAuthStore } from '@/store/authStore';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Rapport de recette (§ décidé en conversation) : total encaissé + détail
 * par produit (quantité vendue, recette générée) sur une période choisie.
 * Contrairement au Tableau de bord (aujourd'hui + top 5 sur 30 jours
 * glissants), ici la période est libre et TOUS les produits apparaissent.
 *
 * Un Vendeur ne voit que SES PROPRES ventes (scoping fait côté backend,
 * dashboard.service.js#getSalesReport, même règle que le Tableau de bord)
 * — jamais un total ni un détail trafiqué côté client.
 */
export default function SalesReportPage() {
  const roleCode = useAuthStore((s) => s.activeStore?.roleCode);
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReport() {
    setLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/dashboard/sales-report', {
        params: { startDate, endDate },
      });
      setReport(data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger le rapport.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  function setQuickRange(days) {
    const end = todayIso();
    const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setStartDate(start);
    setEndDate(end);
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Recette</h1>
      <p className="text-sm text-slate-500 mb-6">
        {roleCode === 'OWNER'
          ? 'Chiffre d\'affaires total de la boutique, produit par produit, sur la période choisie.'
          : 'Vos propres ventes, produit par produit, sur la période choisie.'}
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
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-2xl border border-brand-100 bg-brand-50 px-6 py-5 mb-6 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center shrink-0">
          <TrendingUp size={22} className="text-brand-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-brand-700 uppercase tracking-wide">Recette totale</p>
          <p className="text-2xl font-bold text-slate-800">
            {loading ? '...' : formatGNF(report?.totalRevenue || 0)}
          </p>
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
