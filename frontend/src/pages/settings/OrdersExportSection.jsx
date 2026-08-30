import { useState } from 'react';
import { downloadOrdersExportCsv } from '@/utils/ordersExport';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthIso() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

/**
 * Export comptable CSV (§42_facturation_boutique.sql, décidé en
 * conversation) — une période choisie, téléchargée directement (pas de
 * formulaire à enregistrer, contrairement au reste de "Facturation").
 * `endDate` est envoyée au serveur comme borne EXCLUSIVE (< plutôt que <=,
 * même convention que getOrders) : on ajoute donc un jour à la date choisie
 * pour que le jour de fin sélectionné soit bien inclus dans l'export.
 */
export default function OrdersExportSection() {
  const [startDate, setStartDate] = useState(firstOfMonthIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleExport() {
    setError('');
    setDownloading(true);
    try {
      const endExclusive = new Date(`${endDate}T00:00:00`);
      endExclusive.setDate(endExclusive.getDate() + 1);
      await downloadOrdersExportCsv({ startDate, endDate: endExclusive.toISOString().slice(0, 10) });
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible de générer l'export.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">Export comptable</h3>
      <p className="text-xs text-slate-500 mb-3">
        Télécharge les ventes de la période choisie au format CSV (compatible Excel), à donner à
        ton comptable.
      </p>

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">{error}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Du</label>
          <input
            type="date"
            value={startDate}
            max={endDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1">Au</label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={todayIso()}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={downloading}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
        >
          {downloading ? 'Génération...' : 'Exporter (CSV)'}
        </button>
      </div>
    </section>
  );
}
