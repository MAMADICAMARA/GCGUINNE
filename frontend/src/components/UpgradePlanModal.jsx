import { useNavigate } from 'react-router-dom';
import { Lock, Sparkles, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

/**
 * Message d'upgrade affiché quand un marchand touche un produit verrouillé
 * par le plafond de son plan (§ décidé en conversation — ex: boutique
 * retombée en FREEMIUM avec plus de produits que la nouvelle limite,
 * gelés jusqu'à upgrade). Réutilisé par ProductsPage.jsx et PosPage.jsx —
 * un seul composant, jamais deux messages différents pour la même règle.
 *
 * Le bouton renvoie vers la page dédiée des plans (§ décidé en
 * conversation, "partout où le message plan gratuit/limité apparaît, un
 * bouton vers l'abonnement"). Ce modal peut s'afficher pour un Vendeur
 * autorisé (POS/Produits) — seul le Owner gère la facturation, donc le
 * Vendeur voit un message sans lien plutôt qu'un bouton qui échouerait
 * (page réservée au Owner côté serveur).
 */
export default function UpgradePlanModal({ planName, maxProductsPerStore, productName, onClose }) {
  const navigate = useNavigate();
  const isOwner = useAuthStore((s) => s.activeStore?.roleCode) === 'OWNER';

  function handleUpgrade() {
    onClose();
    navigate('/settings/plans');
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 px-6 pt-8 pb-10 text-center">
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-3 right-3 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
          <div className="mx-auto w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-3">
            <Lock size={24} className="text-amber-400" />
          </div>
          <h2 className="text-white font-semibold text-base">
            {productName ? `"${productName}" est verrouillé` : 'Produit verrouillé'}
          </h2>
          <p className="text-slate-300 text-xs mt-1.5 leading-relaxed">
            Votre plan {planName} est limité à {maxProductsPerStore} produit(s) actif(s) par boutique.
          </p>
        </div>

        <div className="px-6 py-6">
          <p className="text-sm text-slate-600 text-center mb-5">
            {isOwner
              ? "Passez à un plan supérieur pour débloquer ce produit — et tous les autres au-delà de votre limite actuelle."
              : "Demandez au propriétaire de la boutique de passer à un plan supérieur pour débloquer ce produit."}
          </p>

          {isOwner && (
            <button
              onClick={handleUpgrade}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold py-3 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all"
            >
              <Sparkles size={16} />
              Voir les plans disponibles
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full text-center text-xs text-slate-400 hover:text-slate-600 mt-3 transition"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
