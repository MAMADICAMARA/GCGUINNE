import { create } from 'zustand';

/**
 * État global d'authentification et de contexte boutique.
 *
 * Rappel d'architecture (cf. cahier des charges section 6.1) :
 * - Un utilisateur peut être rattaché à plusieurs boutiques.
 * - `activeStore` représente la boutique actuellement sélectionnée ;
 *   TOUTE donnée affichée doit dépendre de cette valeur.
 * - Un changement de boutique active doit être suivi d'un rechargement
 *   complet des données affichées (jamais un mélange avec l'état précédent).
 *
 * Ce store est volontairement minimal : la vérité sur les permissions
 * reste toujours contrôlée côté serveur (voir services/apiClient.js).
 */
export const useAuthStore = create((set) => ({
  token: null,
  user: null, // { id, fullName, email }
  stores: [], // liste des boutiques auxquelles l'utilisateur est rattaché
  activeStore: null, // { id, name, roleCode }
  // { show, planName } | null — statut du bandeau d'abonnement
  // (§20_plans_abonnement.sql), peuplé une fois par PlanStatusBanner au
  // montage de DashboardLayout, plutôt que chaque page ne le récupère
  // séparément (cf. GET /stores/plan-banner).
  planBanner: null,

  setSession: ({ token, user, stores }) =>
    set({
      token,
      user,
      stores,
      activeStore: stores?.length === 1 ? stores[0] : null,
    }),

  setActiveStore: (store) => set({ activeStore: store }),

  setStores: (stores) => set({ stores }),

  setPlanBanner: (planBanner) => set({ planBanner }),

  /**
   * Applique le résultat d'une création de boutique ou d'un changement de
   * boutique active (réponses de POST /stores ou POST /auth/switch-store) :
   * met à jour le token (qui porte le nouveau storeId/roleCode) ainsi que
   * la boutique active et, si fournie, la liste complète des boutiques.
   */
  applyStoreSwitch: ({ token, activeStore, stores }) =>
    set((state) => ({
      token,
      activeStore,
      stores: stores || state.stores,
      planBanner: null,
    })),

  logout: () =>
    set({ token: null, user: null, stores: [], activeStore: null, planBanner: null }),

  isAuthenticated: () => {
    return Boolean(useAuthStore.getState().token);
  },
}));

/**
 * Un employé (Vendeur, jamais l'Owner) est en lecture seule quand
 * la boutique active est effectivement en FREEMIUM avec une équipe
 * (§20_plans_abonnement.sql, décidé en conversation). Sert à désactiver
 * proprement les actions d'écriture côté UI plutôt que de laisser
 * l'employé cliquer dans le vide — le vrai verrou reste toujours le
 * backend (middlewares/auth.js#requireActiveStore).
 */
export function useIsPlanFrozen() {
  const roleCode = useAuthStore((s) => s.activeStore?.roleCode);
  const planBanner = useAuthStore((s) => s.planBanner);
  return Boolean(planBanner?.show) && roleCode !== 'OWNER';
}