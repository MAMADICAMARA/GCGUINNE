import { useEffect, useState } from 'react';
import { Merge } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

/**
 * Fusion de produits en double (§50_fusion_produits_doublons.sql, décidé
 * en conversation) — option "E" de la discussion sur les doublons créés
 * par le module Achats fournisseur (une commande dont l'acheteur a
 * répondu "non, pas le même produit" à la suggestion automatique, alors
 * qu'il s'agissait bien du même article). Deux façons de fusionner :
 * suggestions automatiques (même technique de similarité de nom que le
 * rapprochement à la commande) OU sélection manuelle si l'automatique ne
 * trouve rien. Le stock du produit fusionné est transféré vers celui
 * gardé, qui est ensuite désactivé — jamais supprimé.
 */
export default function MergeDuplicateProductsModal({ onClose, onMerged }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [allProducts, setAllProducts] = useState([]);
  const [manualKeepId, setManualKeepId] = useState('');
  const [manualMergeId, setManualMergeId] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [busyPairKey, setBusyPairKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadSuggestions() {
    setLoadingSuggestions(true);
    try {
      const { data } = await apiClient.get('/products/duplicate-suggestions');
      setSuggestions(data.suggestions);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les suggestions.');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function loadAllProducts() {
    try {
      const { data } = await apiClient.get('/products', { params: { status: 'ACTIVE', limit: 500 } });
      setAllProducts(data.products);
    } catch {
      // Non bloquant : la fusion manuelle sera juste vide.
    }
  }

  useEffect(() => {
    loadSuggestions();
    loadAllProducts();
  }, []);

  async function doMerge(keepProductId, mergeProductId, pairKey) {
    setError('');
    if (pairKey) setBusyPairKey(pairKey);
    else setSubmitting(true);
    try {
      await apiClient.post('/products/merge', { keepProductId, mergeProductId });
      setSuccessMessage('Produits fusionnés — le stock a été transféré.');
      setSuggestions((prev) =>
        prev.filter((s) => s.productAId !== mergeProductId && s.productBId !== mergeProductId)
      );
      setManualKeepId('');
      setManualMergeId('');
      onMerged?.();
      loadAllProducts();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Fusion impossible.');
    } finally {
      setBusyPairKey(null);
      setSubmitting(false);
    }
  }

  function handleManualMerge(e) {
    e.preventDefault();
    if (!manualKeepId || !manualMergeId) return;
    if (manualKeepId === manualMergeId) {
      setError('Choisissez deux produits différents.');
      return;
    }
    doMerge(Number(manualKeepId), Number(manualMergeId), null);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Merge size={16} className="text-brand-500" /> Fusionner des doublons
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          <p className="text-xs text-slate-500 mb-4">
            Le stock du produit fusionné est ajouté à celui gardé, puis le produit fusionné est désactivé —
            jamais supprimé, son historique reste intact.
          </p>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
          )}
          {successMessage && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
              {successMessage}
            </p>
          )}

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Doublons probables</h3>
          {loadingSuggestions ? (
            <p className="text-sm text-slate-400 mb-4">Chargement...</p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-slate-400 mb-4">Aucun doublon probable détecté.</p>
          ) : (
            <div className="space-y-2 mb-5">
              {suggestions.map((s) => {
                const pairKey = `${s.productAId}-${s.productBId}`;
                const busy = busyPairKey === pairKey;
                return (
                  <div key={pairKey} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs text-slate-500 mb-2">Ces deux produits se ressemblent :</p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        disabled={busy}
                        onClick={() => doMerge(s.productAId, s.productBId, pairKey)}
                        className="flex-1 text-left rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50 px-3 py-2 transition disabled:opacity-60"
                        title="Garder ce produit, fusionner l'autre dedans"
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{s.productAName}</p>
                        <p className="text-xs text-slate-400">Stock : {s.productAQuantity}</p>
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => doMerge(s.productBId, s.productAId, pairKey)}
                        className="flex-1 text-left rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50 px-3 py-2 transition disabled:opacity-60"
                        title="Garder ce produit, fusionner l'autre dedans"
                      >
                        <p className="text-sm font-medium text-slate-800 truncate">{s.productBName}</p>
                        <p className="text-xs text-slate-400">Stock : {s.productBQuantity}</p>
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {busy ? 'Fusion en cours...' : 'Cliquez sur le produit à GARDER — l\'autre y sera fusionné.'}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="text-sm font-semibold text-slate-700 mb-2">Fusion manuelle</h3>
          <p className="text-xs text-slate-500 mb-2">
            Si la suggestion automatique n'a rien trouvé pour vos deux produits.
          </p>
          <form onSubmit={handleManualMerge} className="space-y-2.5">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Produit à garder</label>
              <select
                value={manualKeepId}
                onChange={(e) => setManualKeepId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choisir...</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stock {p.quantity}, {formatGNF(p.sellingPrice)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Produit à fusionner (sera désactivé)</label>
              <select
                value={manualMergeId}
                onChange={(e) => setManualMergeId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Choisir...</option>
                {allProducts
                  .filter((p) => String(p.id) !== manualKeepId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (stock {p.quantity}, {formatGNF(p.sellingPrice)})
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={!manualKeepId || !manualMergeId || submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Fusion...' : 'Fusionner'}
            </button>
          </form>
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
