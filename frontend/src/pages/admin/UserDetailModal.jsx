import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDate, formatDateTime } from '@/utils/format';

const STATUS_LABELS = {
  ACTIVE: 'Actif',
  PENDING_VERIFICATION: 'Non vérifié',
  INACTIVE: 'Inactif',
};

/**
 * Fiche détaillée d'un utilisateur pour le Super Admin (§ décidé en
 * conversation, "tenir compte de la responsabilité") — au-delà de la
 * fiche compte, sa position réelle sur la plateforme : propriétaire,
 * vendeur, superviseur, ou Super Admin. Les actions ne dupliquent aucune
 * logique : ce sont les mêmes handlers déjà utilisés par AdminUsersPage,
 * simplement invoqués d'ici plutôt que depuis un bouton en ligne de tableau.
 */
export default function UserDetailModal({
  user,
  onClose,
  busy,
  onPromote,
  onRevoke,
  onChangeEmail,
  onRelaunchVerification,
}) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await apiClient.get(`/admin/users/${user.id}`);
        setDetail(data);
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger le détail.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user.id]);

  const isBusy = busy === user.id;
  const sellerMemberships = (detail?.memberships || []).filter((m) => m.roleCode === 'SELLER');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 truncate">{user.fullName}</h2>
            <p className="text-xs text-slate-400 truncate">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 space-y-5">
          {error && <p className="text-sm text-red-600 mb-1">{error}</p>}

          {loading ? (
            <p className="text-sm text-slate-400 text-center py-6">Chargement...</p>
          ) : (
            detail && (
              <>
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Compte</p>
                  <dl className="text-sm divide-y divide-slate-100 rounded-lg border border-slate-100">
                    <Row label="Téléphone" value={detail.phone || '—'} />
                    <Row
                      label="Statut"
                      value={STATUS_LABELS[detail.status] || detail.status}
                    />
                    <Row label="Date de naissance" value={detail.birthDate ? formatDate(detail.birthDate) : '—'} />
                    <Row label="Inscrit le" value={formatDateTime(detail.createdAt)} />
                  </dl>
                </div>

                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                    Rôle sur la plateforme
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {detail.isSuperAdmin && <Badge color="amber">Super Admin</Badge>}
                    {detail.ownedStore && (
                      <Badge color="brand">Propriétaire — {detail.ownedStore.name}</Badge>
                    )}
                    {sellerMemberships.map((m) => (
                      <Badge key={m.storeId} color="slate">
                        Vendeur — {m.storeName}
                      </Badge>
                    ))}
                    {detail.supervisedStores.map((s) => (
                      <Badge key={s.storeId} color="indigo">
                        Superviseur — {s.storeName}
                      </Badge>
                    ))}
                    {!detail.isSuperAdmin &&
                      !detail.ownedStore &&
                      sellerMemberships.length === 0 &&
                      detail.supervisedStores.length === 0 && (
                        <p className="text-sm text-slate-400">Aucun rôle actif pour l'instant.</p>
                      )}
                  </div>
                </div>
              </>
            )
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-wrap items-center gap-x-4 gap-y-2 shrink-0">
          <button
            onClick={() => onChangeEmail(user)}
            disabled={isBusy}
            className="text-xs font-medium text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Changer l'e-mail
          </button>
          {user.status !== 'ACTIVE' && (
            <button
              onClick={() => onRelaunchVerification(user)}
              disabled={isBusy}
              className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              Relancer la vérification
            </button>
          )}
          {user.isSuperAdmin ? (
            <button
              onClick={() => onRevoke(user)}
              disabled={isBusy}
              className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
            >
              {isBusy ? 'Patientez...' : 'Retirer Super Admin'}
            </button>
          ) : (
            <button
              onClick={() => onPromote(user)}
              disabled={isBusy}
              className="text-xs font-medium text-brand-500 hover:text-brand-600 disabled:opacity-50"
            >
              {isBusy ? 'Patientez...' : 'Promouvoir Super Admin'}
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium truncate max-w-[60%] text-right">{value}</dd>
    </div>
  );
}

const BADGE_COLORS = {
  amber: 'bg-amber-50 text-amber-700',
  brand: 'bg-brand-50 text-brand-700',
  slate: 'bg-slate-100 text-slate-600',
  indigo: 'bg-indigo-50 text-indigo-700',
};

function Badge({ color, children }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_COLORS[color]}`}>
      {children}
    </span>
  );
}
