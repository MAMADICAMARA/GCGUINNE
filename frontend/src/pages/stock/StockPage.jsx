import { useEffect, useState } from 'react';
import { AlertTriangle, Boxes, CheckCircle2, Search } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { useAuthStore, useIsPlanFrozen } from '@/store/authStore';
import AdjustStockModal from './AdjustStockModal';

/**
 * Page Stock (§4.5 du cahier des charges) — vue transversale, distincte du
 * catalogue produit :
 * 1. Alertes de rupture / stock faible — repérer quoi réapprovisionner.
 * 2. Recherche + ajustement de stock — corriger après un comptage physique.
 *
 * L'historique détaillé par produit reste sur la fiche produit (page
 * Produits) ; cette page-ci est orientée surveillance et action rapide.
 */
export default function StockPage() {
  const activeStore = useAuthStore((s) => s.activeStore);
  const isFrozen = useIsPlanFrozen();

  const [alerts, setAlerts] = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertsError, setAlertsError] = useState('');

  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  const [adjustingProduct, setAdjustingProduct] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  async function loadAlerts() {
    if (!activeStore) return;
    setLoadingAlerts(true);
    setAlertsError('');
    try {
      const { data } = await apiClient.get('/products', {
        params: { lowStockOnly: true, status: 'ACTIVE', limit: 100 },
      });
      setAlerts(data.products);
    } catch (err) {
      setAlertsError(err.response?.data?.error?.message || 'Impossible de charger les alertes.');
    } finally {
      setLoadingAlerts(false);
    }
  }

  useEffect(() => {
    loadAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStore]);

  // Recherche avec un léger délai pour éviter une requête à chaque frappe.
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const { data } = await apiClient.get('/products', {
          params: { search, status: 'ACTIVE', limit: 10 },
        });
        setSearchResults(data.products);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  function handleAdjusted({ newQuantity, newStatus }) {
    const deactivationNote =
      newStatus === 'INACTIVE' ? ' Le produit a été automatiquement désactivé (stock à 0).' : '';
    setSuccessMessage(
      `Stock de "${adjustingProduct.name}" mis à jour : ${newQuantity}.${deactivationNote}`
    );
    setAdjustingProduct(null);
    loadAlerts();
    setSearchResults((prev) =>
      prev.map((p) => (p.id === adjustingProduct.id ? { ...p, quantity: newQuantity } : p))
    );
    setTimeout(() => setSuccessMessage(''), 5000);
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-1">
        <div className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Boxes size={18} />
        </div>
        <h1 className="text-xl font-semibold text-slate-800">Stock</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Surveillance des ruptures et ajustement après comptage physique.
      </p>

      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}

      {/* --- Section 1 : alertes de rupture / stock faible --- */}
      <section className="mb-8">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3">
          <AlertTriangle size={15} className="text-amber-500" />
          Produits en stock faible ou en rupture
        </h2>

        {alertsError && <p className="text-sm text-red-600 mb-3">{alertsError}</p>}

        {loadingAlerts ? (
          <p className="text-sm text-slate-400">Chargement...</p>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-green-400" />
            Aucune alerte — tous les stocks sont au-dessus de leur seuil.
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {/* Vue mobile : cartes empilées (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {alerts.map((product) => (
                <div key={product.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">{product.name}</p>
                    <p className="text-xs text-slate-400">Seuil d'alerte : {product.lowStockThreshold}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span
                      className={`font-medium ${product.quantity === 0 ? 'text-red-600' : 'text-amber-600'}`}
                    >
                      {product.quantity}
                    </span>
                    <button
                      onClick={() => setAdjustingProduct(product)}
                      disabled={isFrozen}
                      className="text-xs font-medium text-brand-500 disabled:opacity-40"
                    >
                      Ajuster
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Vue desktop : tableau complet (dès md) */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-3">Produit</th>
                  <th className="text-right px-4 py-3">Stock actuel</th>
                  <th className="text-right px-4 py-3">Seuil d'alerte</th>
                  <th className="text-right px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">{product.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`font-medium ${
                          product.quantity === 0 ? 'text-red-600' : 'text-amber-600'
                        }`}
                      >
                        {product.quantity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {product.lowStockThreshold}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setAdjustingProduct(product)}
                        disabled={isFrozen}
                        title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Ajuster
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* --- Section 2 : rechercher n'importe quel produit à ajuster --- */}
      <section>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          Ajuster le stock d'un autre produit
        </h2>
        <div className="relative w-full max-w-md mb-3">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit par nom ou référence..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {searching && <p className="text-sm text-slate-400">Recherche...</p>}

        {searchResults.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden max-w-md">
            {searchResults.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between px-4 py-3 border-b border-slate-100 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">{product.name}</p>
                  <p className="text-xs text-slate-400">Stock : {product.quantity}</p>
                </div>
                <button
                  onClick={() => setAdjustingProduct(product)}
                  disabled={isFrozen}
                  title={isFrozen ? 'Boutique en mode gratuit — action indisponible' : undefined}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Ajuster
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {adjustingProduct && (
        <AdjustStockModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onAdjusted={handleAdjusted}
        />
      )}
    </div>
  );
}