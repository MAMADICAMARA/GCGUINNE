import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import SupplierCatalogModal from './SupplierCatalogModal';

/**
 * Page Fournisseurs (§18_fournisseurs_inter_boutiques.sql) — un Owner peut
 * ajouter une autre boutique de la plateforme comme fournisseur via son
 * code (jamais son ID brut), consulter son catalogue en lecture stricte
 * (jamais prix ni stock), et voir/retirer les boutiques qui l'ont, elle,
 * ajoutée comme fournisseur (ses "clients").
 */
export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [busyLinkId, setBusyLinkId] = useState(null);
  const [viewingSupplier, setViewingSupplier] = useState(null);
  const [planStatus, setPlanStatus] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [suppliersRes, clientsRes, planRes] = await Promise.all([
        apiClient.get('/suppliers'),
        apiClient.get('/suppliers/clients'),
        apiClient.get('/stores/plan-status'),
      ]);
      setSuppliers(suppliersRes.data.suppliers);
      setClients(clientsRes.data.clients);
      setPlanStatus(planRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger vos fournisseurs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Consulter/gérer les liens déjà établis reste toujours possible, quel
  // que soit le plan (même logique que la page Équipe) — seul l'ajout
  // d'un nouveau fournisseur exige le plan (§20_plans_abonnement.sql,
  // décidé en conversation).
  const canAddSupplier = Boolean(planStatus?.allowsSuppliers);

  async function handleAddCode(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const { data } = await apiClient.post('/suppliers', { code: code.trim() });
      setSuccessMessage(`"${data.name}" a été ajoutée à vos fournisseurs.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      setCode('');
      setShowAddForm(false);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Code invalide.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveSupplier(supplier) {
    if (!window.confirm(`Retirer "${supplier.name}" de vos fournisseurs ?`)) return;
    setBusyLinkId(supplier.linkId);
    try {
      await apiClient.delete(`/suppliers/${supplier.linkId}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusyLinkId(null);
    }
  }

  async function handleRemoveClient(client) {
    if (!window.confirm(`Retirer "${client.name}" de vos clients ? Elle perdra l'accès à votre catalogue.`)) return;
    setBusyLinkId(client.linkId);
    try {
      await apiClient.delete(`/suppliers/clients/${client.linkId}`);
      loadAll();
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Retrait impossible.');
    } finally {
      setBusyLinkId(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Fournisseurs</h1>
          <p className="text-sm text-slate-500">
            Boutiques de la plateforme dont vous consultez le catalogue, et boutiques qui vous ont ajouté.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          disabled={!canAddSupplier}
          title={!canAddSupplier ? 'Plan FREEMIUM — passez à un plan payant pour ajouter des fournisseurs' : undefined}
          className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition self-start sm:self-auto disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Ajouter via un code
        </button>
      </div>

      {!loading && !canAddSupplier && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mb-4">
          Votre plan FREEMIUM ne permet pas d'ajouter de fournisseur — passez à un plan payant.
        </p>
      )}

      {successMessage && (
        <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 mb-4">
          {successMessage}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddCode}
          className="rounded-xl border border-slate-200 bg-white p-5 mb-6 max-w-md"
        >
          <label className="block text-sm font-medium text-slate-600 mb-1">Code fournisseur</label>
          <p className="text-xs text-slate-400 mb-2">
            Demandez ce code au propriétaire de la boutique fournisseur — il se trouve dans ses Paramètres.
            Vous ne verrez jamais ses prix ni ses quantités en stock.
          </p>
          <input
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ex : F5Q8N3Z3SCHW"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition disabled:opacity-60"
            >
              {submitting ? 'Vérification...' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Mes fournisseurs</h2>
            {suppliers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
                Aucun fournisseur ajouté pour l'instant.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {suppliers.map((s) => (
                  <div key={s.linkId} className="rounded-xl border border-slate-200 bg-white p-5">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-400 mb-3">
                      {[s.category, s.city].filter(Boolean).join(' · ') || '—'}
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setViewingSupplier(s)}
                        className="text-xs font-medium text-brand-500 hover:text-brand-600"
                      >
                        Voir le catalogue
                      </button>
                      <button
                        onClick={() => handleRemoveSupplier(s)}
                        disabled={busyLinkId === s.linkId}
                        className="text-xs font-medium text-slate-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Retirer
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Mes clients</h2>
            <p className="text-xs text-slate-400 mb-3">
              Boutiques qui vous ont ajoutée comme fournisseur — elles voient votre catalogue, jamais vos prix ni votre stock.
            </p>
            {clients.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-400 text-sm">
                Aucune boutique ne vous a ajoutée comme fournisseur pour l'instant.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left px-4 py-3">Boutique</th>
                      <th className="text-left px-4 py-3">Ville / catégorie</th>
                      <th className="text-right px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => (
                      <tr key={c.linkId} className="border-t border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-800">{c.name}</td>
                        <td className="px-4 py-3 text-slate-500">
                          {[c.category, c.city].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleRemoveClient(c)}
                            disabled={busyLinkId === c.linkId}
                            className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {viewingSupplier && (
        <SupplierCatalogModal
          storeId={viewingSupplier.storeId}
          storeName={viewingSupplier.name}
          onClose={() => setViewingSupplier(null)}
        />
      )}
    </div>
  );
}
