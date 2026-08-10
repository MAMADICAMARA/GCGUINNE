import { useEffect, useState } from 'react';
import { Store, Tag, Package, Users, Truck, Eye, Settings, Ban, Crown, UserRound } from 'lucide-react';
import apiClient from '@/services/apiClient';

const ROLE_LABELS = { OWNER: 'Propriétaire', SELLER: 'Vendeur' };

const STATUS_STYLES = {
  ACTIVE: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700' },
  SUSPENDED: { label: 'Suspendue', classes: 'bg-rose-50 text-rose-700' },
  TRIAL: { label: 'Essai', classes: 'bg-amber-50 text-amber-700' },
};

/**
 * Fiche détaillée d'une boutique pour le Super Admin (§ décidé en
 * conversation) : secteur d'activité, effectif produit/équipe/fournisseurs
 * et statut de supervision, en lecture seule. "Gérer" et "Suspendre" ne
 * dupliquent aucune logique — ils délèguent respectivement à StorePlanModal
 * et au toggleStatus déjà utilisés directement depuis la liste des boutiques.
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

  const statusStyle = STATUS_STYLES[store.status] || { label: store.status, classes: 'bg-slate-100 text-slate-600' };
  const isSupervised = detail?.supervisors?.length > 0;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* En-tête */}
        <div className="px-6 pt-6 pb-5 bg-linear-to-br from-brand-50 to-white border-b border-slate-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <div className="h-11 w-11 shrink-0 rounded-xl bg-brand-500 text-white flex items-center justify-center shadow-sm">
                <Store size={20} strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-semibold text-slate-800 truncate">{store.name}</h2>
                  <span className={`shrink-0 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle.classes}`}>
                    {statusStyle.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">
                  {store.ownerName} — {store.ownerEmail}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none"
              aria-label="Fermer"
            >
              ×
            </button>
          </div>

          {detail?.storeTypeLabel && (
            <div className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 text-indigo-700 pl-2 pr-3 py-1 text-xs font-medium">
              <Tag size={13} strokeWidth={2} />
              {detail.storeTypeLabel}
            </div>
          )}
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-6">Chargement...</p>
          ) : (
            detail && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-3">
                  <StatTile icon={Package} value={detail.productCount} label="Produits" color="blue" />
                  <StatTile icon={Users} value={detail.team.length} label="Équipe" color="violet" />
                  <StatTile
                    icon={Truck}
                    value={detail.externalSuppliersCount + detail.platformSuppliersCount}
                    label="Fournisseurs"
                    color="amber"
                  />
                </div>

                <div>
                  <SectionTitle>Équipe (propriétaire + employés)</SectionTitle>
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                    {detail.team.map((member) => (
                      <li key={member.userId} className="px-3 py-2.5 flex items-center gap-3 text-sm">
                        <div
                          className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center ${
                            member.roleCode === 'OWNER' ? 'bg-brand-50 text-brand-600' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {member.roleCode === 'OWNER' ? <Crown size={15} /> : <UserRound size={15} />}
                        </div>
                        <div className="min-w-0 flex-1">
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
                  <SectionTitle>Fournisseurs</SectionTitle>
                  <p className="text-sm text-slate-600">
                    {detail.externalSuppliersCount} externe{detail.externalSuppliersCount > 1 ? 's' : ''} (carnet
                    d'adresses) · {detail.platformSuppliersCount} de la plateforme
                  </p>
                </div>

                <div>
                  <SectionTitle>Supervision</SectionTitle>
                  <div
                    className={`flex items-start gap-2.5 rounded-xl px-3.5 py-2.5 text-sm ${
                      isSupervised ? 'bg-teal-50 text-teal-800' : 'bg-slate-50 text-slate-500'
                    }`}
                  >
                    <Eye size={16} strokeWidth={1.75} className="shrink-0 mt-0.5" />
                    <span>
                      {isSupervised
                        ? `Supervisée par ${detail.supervisors.map((s) => s.fullName).join(', ')}`
                        : 'Aucun superviseur rattaché.'}
                    </span>
                  </div>
                </div>
              </div>
            )
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 shrink-0 bg-slate-50/60">
          <div className="flex gap-2">
            <button
              onClick={onManagePlan}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 text-brand-700 text-sm font-medium px-4 py-2 hover:bg-brand-100 transition"
            >
              <Settings size={15} strokeWidth={2} />
              Gérer
            </button>
            <button
              onClick={onToggleStatus}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium px-4 py-2 hover:bg-red-100 transition"
            >
              <Ban size={15} strokeWidth={2} />
              {store.status === 'SUSPENDED' ? 'Réactiver' : 'Suspendre'}
            </button>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-white text-slate-700 text-sm font-medium px-4 py-2 border border-slate-200 hover:bg-slate-100 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

const TILE_COLORS = {
  blue: 'bg-blue-50 text-blue-600',
  violet: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
};

function StatTile({ icon: Icon, value, label, color }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white px-3 py-3.5 text-center shadow-sm">
      <div className={`mx-auto mb-2 h-8 w-8 rounded-lg flex items-center justify-center ${TILE_COLORS[color]}`}>
        <Icon size={16} strokeWidth={1.75} />
      </div>
      <p className="text-lg font-semibold text-slate-800 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">{children}</p>;
}
