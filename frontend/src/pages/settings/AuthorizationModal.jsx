import { useEffect, useState } from 'react';
import { X, Undo2, Tag, PackagePlus, Boxes, Truck, ShoppingBag } from 'lucide-react';
import apiClient from '@/services/apiClient';
import Switch from '@/components/Switch';

// Un seul endroit pour décrire les 6 actions autorisables (§25/§39/§40/§43,
// consolidées ici en un seul modal, décidé en conversation) — évite que la
// description d'une action diverge entre les blocs répétitifs.
const PERMISSIONS = [
  {
    key: 'canVoidReturn',
    settingsPath: 'void-return-settings',
    icon: Undo2,
    color: 'rose',
    title: 'Annulation / retour de vente',
    description:
      "Annuler une vente ou accepter le retour d'un article. Un vendeur autorisé ne peut agir que sur ses propres ventes, jamais celles d'un collègue.",
  },
  {
    key: 'canEditPrice',
    settingsPath: 'edit-price-settings',
    icon: Tag,
    color: 'teal',
    title: 'Modification du prix à la Caisse',
    description:
      "Négocier un prix différent avec le client au moment de la vente — jamais en dessous du prix normal, toujours vérifié automatiquement.",
  },
  {
    key: 'canAddProduct',
    settingsPath: 'add-product-settings',
    icon: PackagePlus,
    color: 'emerald',
    title: 'Création de produit',
    description: 'Ajouter une nouvelle fiche produit au catalogue. Modifier ou désactiver un produit existant reste réservé à vous.',
  },
  {
    key: 'canManageStock',
    settingsPath: 'stock-settings',
    icon: Boxes,
    color: 'amber',
    title: 'Accès à Stock',
    description:
      "Ouvrir la page Stock et ajuster une quantité (casse, inventaire...). Consulter le stock ailleurs (Produits, Caisse) reste toujours possible pour tous.",
  },
  {
    key: 'canManageSuppliers',
    settingsPath: 'suppliers-settings',
    icon: Truck,
    color: 'sky',
    title: 'Accès à Fournisseurs',
    description: 'Ouvrir la page Fournisseurs — voir/ajouter des fournisseurs, consulter leur catalogue. Réservé au Owner tant que non autorisé.',
  },
  {
    key: 'canManagePurchases',
    settingsPath: 'purchases-settings',
    icon: ShoppingBag,
    color: 'violet',
    title: 'Accès à Achats',
    description:
      'Ouvrir la page Achats — créer et suivre des commandes auprès de vos fournisseurs. Réservé au Owner tant que non autorisé.',
  },
];

const COLOR_CLASSES = {
  rose: 'bg-rose-50 text-rose-600',
  teal: 'bg-teal-50 text-teal-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  sky: 'bg-sky-50 text-sky-600',
  violet: 'bg-violet-50 text-violet-600',
};

function initials(fullName) {
  const parts = fullName.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

export default function AuthorizationModal({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [allowAll, setAllowAll] = useState({});
  const [sellers, setSellers] = useState([]);
  const [savingAllKey, setSavingAllKey] = useState(null);
  const [savingSeller, setSavingSeller] = useState(null); // `${userId}:${key}`

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [settingsResults, employeesRes] = await Promise.all([
          Promise.all(PERMISSIONS.map((p) => apiClient.get(`/stores/${p.settingsPath}`))),
          apiClient.get('/employees'),
        ]);
        setAllowAll(
          Object.fromEntries(
            PERMISSIONS.map((p, i) => [p.key, Boolean(settingsResults[i].data.allowAllSellers)])
          )
        );
        setSellers(employeesRes.data.employees.filter((e) => e.roleCode === 'SELLER'));
      } catch (err) {
        setError(err.response?.data?.error?.message || 'Impossible de charger les autorisations.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleToggleAll(permission, value) {
    setSavingAllKey(permission.key);
    setError('');
    try {
      const { data } = await apiClient.put(`/stores/${permission.settingsPath}`, { allowAllSellers: value });
      setAllowAll((prev) => ({ ...prev, [permission.key]: data.allowAllSellers }));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSavingAllKey(null);
    }
  }

  async function handleToggleSeller(permission, userId, value) {
    const savingId = `${userId}:${permission.key}`;
    setSavingSeller(savingId);
    setError('');
    try {
      await apiClient.patch(`/employees/${userId}/permissions`, { [permission.key]: value });
      setSellers((list) => list.map((s) => (s.userId === userId ? { ...s, [permission.key]: value } : s)));
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Enregistrement impossible.');
    } finally {
      setSavingSeller(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">Autorisations des vendeurs</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choisissez ce que vos vendeurs peuvent faire sans vous demander à chaque fois.
            </p>
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 transition shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-4">{error}</p>
          )}

          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : (
            <div className="space-y-5">
              {PERMISSIONS.map((permission, i) => {
                const Icon = permission.icon;
                const allOn = Boolean(allowAll[permission.key]);
                return (
                  <div key={permission.key} className={i > 0 ? 'pt-5 border-t border-slate-100' : ''}>
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2.5 shrink-0 ${COLOR_CLASSES[permission.color]}`}>
                        <Icon size={18} strokeWidth={1.75} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{permission.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{permission.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pl-[52px]">
                      <span className="text-sm font-medium text-slate-700">Autoriser tous les vendeurs</span>
                      <Switch
                        checked={allOn}
                        disabled={savingAllKey === permission.key}
                        onChange={(value) => handleToggleAll(permission, value)}
                        label={`Autoriser tous les vendeurs — ${permission.title}`}
                      />
                    </div>

                    <div className="pl-[52px] mt-2">
                      {sellers.length === 0 ? (
                        <p className="text-xs text-slate-400">Aucun vendeur dans l'équipe pour l'instant.</p>
                      ) : (
                        <>
                          <p className="text-xs text-slate-400 mb-1.5">
                            {allOn ? 'Déjà autorisés (tous les vendeurs ci-dessus) :' : 'Ou choisissez qui, individuellement :'}
                          </p>
                          <div className="space-y-1 rounded-lg bg-slate-50 p-2">
                            {sellers.map((seller) => {
                              const savingId = `${seller.userId}:${permission.key}`;
                              return (
                                <div key={seller.userId} className="flex items-center justify-between gap-3 px-1.5 py-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 text-[10px] font-semibold flex items-center justify-center shrink-0">
                                      {initials(seller.fullName)}
                                    </span>
                                    <span className={`text-sm truncate ${allOn ? 'text-slate-400' : 'text-slate-700'}`}>
                                      {seller.fullName}
                                    </span>
                                  </div>
                                  <Switch
                                    checked={allOn || Boolean(seller[permission.key])}
                                    disabled={allOn || savingSeller === savingId}
                                    onChange={(value) => handleToggleSeller(permission, seller.userId, value)}
                                    label={`Autoriser ${seller.fullName} — ${permission.title}`}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 text-slate-700 text-sm font-medium py-2.5 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
