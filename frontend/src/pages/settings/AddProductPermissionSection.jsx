import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

/**
 * Autorisation de création de produit par un Vendeur
 * (§40_autorisation_ajout_produit.sql, décidé en conversation) — couvre
 * UNIQUEMENT la création d'un nouveau produit ; modifier, désactiver ou
 * réactiver un produit existant reste strictement réservé au Owner, quel
 * que soit ce réglage. Même structure exacte que
 * SalesVoidReturnPermissionSection / SalesEditPricePermissionSection.
 */
export default function AddProductPermissionSection() {
  const [allowAllSellers, setAllowAllSellers] = useState(false);
  const [sellers, setSellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingAll, setSavingAll] = useState(false);
  const [savingSellerId, setSavingSellerId] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [settingsRes, employeesRes] = await Promise.all([
          apiClient.get('/stores/add-product-settings'),
          apiClient.get('/employees'),
        ]);
        setAllowAllSellers(Boolean(settingsRes.data.allowAllSellers));
        setSellers(employeesRes.data.employees.filter((e) => e.roleCode === 'SELLER'));
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger ces réglages.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggleAll(e) {
    const value = e.target.checked;
    setSavingAll(true);
    setError('');
    try {
      const { data } = await apiClient.put('/stores/add-product-settings', { allowAllSellers: value });
      setAllowAllSellers(data.allowAllSellers);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSavingAll(false);
    }
  }

  async function handleToggleSeller(userId, e) {
    const value = e.target.checked;
    setSavingSellerId(userId);
    setError('');
    try {
      await apiClient.patch(`/employees/${userId}/permissions`, { canAddProduct: value });
      setSellers((list) =>
        list.map((s) => (s.userId === userId ? { ...s, canAddProduct: value } : s))
      );
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSavingSellerId(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Création de produit par un vendeur</h2>
      <p className="text-xs text-slate-500 mb-3">
        Par défaut, seul vous pouvez ajouter un produit au catalogue. Vous pouvez autoriser vos
        vendeurs à créer eux-mêmes de nouveaux produits — modifier ou désactiver une fiche
        existante reste toujours réservé à vous seul.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={allowAllSellers}
              disabled={savingAll}
              onChange={handleToggleAll}
            />
            Autoriser tous les vendeurs
          </label>

          {sellers.length === 0 ? (
            <p className="text-xs text-slate-400 pl-6">Aucun vendeur dans l'équipe pour l'instant.</p>
          ) : (
            <div className="pl-6 space-y-1.5 border-l border-slate-100">
              {sellers.map((seller) => (
                <label
                  key={seller.userId}
                  className={`flex items-center gap-2 text-sm ${
                    allowAllSellers ? 'text-slate-400' : 'text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={allowAllSellers || seller.canAddProduct}
                    disabled={allowAllSellers || savingSellerId === seller.userId}
                    onChange={(e) => handleToggleSeller(seller.userId, e)}
                  />
                  {seller.fullName}
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
