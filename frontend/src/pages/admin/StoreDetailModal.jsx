import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';

const ROLE_LABELS = { OWNER: 'Propriétaire', SELLER: 'Vendeur' };

/**
 * Fiche détaillée d'une boutique pour le Super Admin (§ décidé en
 * conversation) : effectif produit/équipe/fournisseurs et statut de
 * supervision, en lecture seule. "Gérer" et "Suspendre" ne dupliquent
 * aucune logique — ils délèguent respectivement à StorePlanModal et au
 * toggleStatus déjà utilisés directement depuis la liste des boutiques.
 */
export default function StoreDetailModal({ store, onClose, onManagePlan, onToggleStatus }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get(`/admin/stores/${store.id}/detail`);
        setDetail(data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le détail.');
      } finally {
        setLoading(false);
      }
    })();
  }, [store.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 truncate">{store.name}</h2>
            <p className="text-xs text-slate-400 truncate">
              {store.ownerName} — {store.ownerEmail}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-6">Chargement...</p>
          ) : (
            detail && (
              <div className="space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg bg-slate-50 px-3 py-3 text-center">
                    <p className="text-lg font-semibold text-slate-800">{detail.productCount}</p>
                    <p className="text-xs text-slate-500">Produits</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-3 text-center">
                    <p className="text-lg font-semibold text-slate-800">{detail.team.length}</p>
                    <p className="text-xs text-slate-500">Utilisateurs</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 px-3 py-3 text-center">
                    <p className="text-lg font-semibold text-slate-800">
                      {detail.externalSuppliersCount + detail.platformSuppliersCount}
                    </p>
                    <p className="text-xs text-slate-500">Fournisseurs</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Équipe (propriétaire + employés)
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {detail.team.map((member) => (
                      <li key={member.userId} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="text-slate-800 truncate">{member.fullName}</p>
                          <p className="text-xs text-slate-400 truncate">{member.email}</p>
                        </div>
                        <span
                          className={`shrink-0 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            member.roleCode === 'OWNER'
                              ? 'bg-brand-50 text-brand-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ROLE_LABELS[member.roleCode] || member.roleCode}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Fournisseurs</p>
                  <p className="text-sm text-slate-600">
                    {detail.externalSuppliersCount} externe{detail.externalSuppliersCount > 1 ? 's' : ''} (carnet
                    d'adresses) · {detail.platformSuppliersCount} de la plateforme
                  </p>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Supervision</p>
                  {detail.supervisors.length === 0 ? (
                    <p className="text-sm text-slate-600">Non — aucun superviseur rattaché.</p>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Oui — par {detail.supervisors.map((s) => s.fullName).join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={onManagePlan}
              className="rounded-lg bg-brand-50 text-brand-700 text-sm font-medium px-4 py-2 hover:bg-brand-100 transition"
            >
              Gérer
            </button>
            <button
              onClick={onToggleStatus}
              className="rounded-lg bg-red-50 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-100 transition"
            >
              {store.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
            </button>
          </div>
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
