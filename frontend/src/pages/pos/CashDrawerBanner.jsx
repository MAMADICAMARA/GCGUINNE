import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF, formatDateTime } from '@/utils/format';

/**
 * Bandeau d'ouverture/fermeture de caisse (§30_fond_de_caisse.sql, décidé
 * en conversation — §B2 SOLUTIONS_AUDIT_PRODUCTION.md). Entièrement
 * optionnel : un vendeur qui n'ouvre jamais de caisse continue à
 * encaisser normalement, sans aucun changement de comportement. Le solde
 * théorique augmente automatiquement à chaque vente en espèces (calculé
 * côté serveur) — `refreshSignal` (bumpé par PosPage après chaque vente)
 * ne sert qu'à réafficher la valeur à jour, jamais à la recalculer ici.
 */
export default function CashDrawerBanner({ refreshSignal }) {
  const [drawer, setDrawer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showOpenForm, setShowOpenForm] = useState(false);
  const [openingBalance, setOpeningBalance] = useState('');

  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closingBalance, setClosingBalance] = useState('');
  const [note, setNote] = useState('');
  const [closeResult, setCloseResult] = useState(null);

  const [submitting, setSubmitting] = useState(false);

  async function loadCurrent() {
    setLoading(true);
    try {
      const { data } = await apiClient.get('/cash-drawers/current');
      setDrawer(data.drawer);
    } catch {
      // Silencieux : un bandeau qui ne charge pas ne doit jamais bloquer
      // la Caisse elle-même.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCurrent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

  async function handleOpen(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiClient.post('/cash-drawers/open', { openingBalance: Number(openingBalance) });
      setShowOpenForm(false);
      setOpeningBalance('');
      await loadCurrent();
    } catch (err) {
      setError(err.response?.data?.error?.message || "Impossible d'ouvrir la caisse.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/cash-drawers/close', {
        closingBalance: Number(closingBalance),
        note,
      });
      setCloseResult(data);
      setShowCloseForm(false);
      setClosingBalance('');
      setNote('');
      await loadCurrent();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de fermer la caisse.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;

  return (
    <div className="mb-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-2">{error}</p>
      )}

      {closeResult && (
        <div
          className={`text-sm rounded-md px-3 py-2 mb-2 border ${
            closeResult.discrepancy === 0
              ? 'bg-green-50 border-green-100 text-green-700'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}
        >
          Caisse fermée — solde théorique {formatGNF(closeResult.expectedBalance)}, compté{' '}
          {formatGNF(closeResult.closingBalance)}
          {closeResult.discrepancy === 0
            ? ' — aucun écart.'
            : ` — écart de ${formatGNF(Math.abs(closeResult.discrepancy))} (${closeResult.discrepancy > 0 ? 'excédent' : 'manque'}).`}
          <button onClick={() => setCloseResult(null)} className="ml-3 underline">
            Fermer
          </button>
        </div>
      )}

      {!drawer ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <span className="text-sm text-slate-500">Caisse fermée</span>
          {!showOpenForm ? (
            <button
              onClick={() => setShowOpenForm(true)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Ouvrir la caisse
            </button>
          ) : (
            <form onSubmit={handleOpen} className="flex items-center gap-2">
              <input
                required
                type="number"
                min="0"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="Fond de départ (GNF)"
                className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-brand-500 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-600 transition disabled:opacity-60"
              >
                {submitting ? '...' : 'Ouvrir'}
              </button>
              <button
                type="button"
                onClick={() => setShowOpenForm(false)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Annuler
              </button>
            </form>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-brand-200 bg-brand-50/40 px-4 py-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm text-slate-700">
              Caisse ouverte depuis {formatDateTime(drawer.openingTime)} — solde théorique{' '}
              <span className="font-semibold">{formatGNF(drawer.expectedBalance)}</span>
            </span>
            {!showCloseForm && (
              <button
                onClick={() => setShowCloseForm(true)}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Fermer la caisse
              </button>
            )}
          </div>

          {showCloseForm && (
            <form onSubmit={handleClose} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                required
                type="number"
                min="0"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
                placeholder="Montant compté (GNF)"
                className="w-full sm:w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="w-full sm:w-48 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-brand-500 text-white text-sm font-medium px-3 py-1.5 hover:bg-brand-600 transition disabled:opacity-60"
                >
                  {submitting ? '...' : 'Confirmer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCloseForm(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
