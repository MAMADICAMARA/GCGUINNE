import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Panier de la Caisse (§ décidé en conversation) — survit à la navigation
 * entre pages ET à un rafraîchissement du navigateur, mais PAS à sa
 * fermeture : sessionStorage plutôt que localStorage (celui déjà utilisé
 * par authStore.js pour la session), volontairement, pour qu'un panier
 * oublié ne réapparaisse jamais des jours plus tard à la prochaine
 * ouverture du navigateur.
 *
 * `forStoreId` accompagne le panier pour qu'un changement de boutique
 * active (produits/prix différents) le vide automatiquement — voir
 * PosPage.jsx, qui compare ce champ à activeStore.id au montage plutôt que
 * de coupler ce store à authStore.js.
 */
export const usePosCartStore = create(
  persist(
    (set) => ({
      cart: [],
      forStoreId: null,

      // Même signature que le setState de useState (valeur directe OU
      // fonction de mise à jour) pour rester un remplacement direct du
      // useState local qu'il remplace dans PosPage.jsx.
      setCart: (updater) =>
        set((state) => ({
          cart: typeof updater === 'function' ? updater(state.cart) : updater,
        })),

      setForStoreId: (storeId) => set({ forStoreId: storeId }),

      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'pos-cart-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
