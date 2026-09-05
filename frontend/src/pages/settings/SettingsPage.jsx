import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import SettingsEntryCard from './SettingsEntryCard';
import SettingsModal from './SettingsModal';
import ShareCodesModal from './ShareCodesModal';
import BillingModal from './BillingModal';
import ReceiptSettingsSection from './ReceiptSettingsSection';
import AuthorizationCard from './AuthorizationCard';
import SubscriptionSection from './SubscriptionSection';
import StoreLogoSection from './StoreLogoSection';
import StoreInfoSection from './StoreInfoSection';
import StoreTypeSection from './StoreTypeSection';
import {
  SlidersHorizontal,
  Crown,
  Image,
  Store,
  Tag,
  Share2,
  Receipt,
  FileText,
  AlertCircle,
  PowerOff,
} from 'lucide-react';

/**
 * Paramètres de la boutique active (§8 du cahier des charges).
 *
 * Restructurée en cartes cliquables (§ décidé en conversation, "cette page
 * est trop longue") — chaque section s'ouvre dans un modal à la demande,
 * exactement comme "Autorisation" le faisait déjà (AuthorizationCard.jsx),
 * plutôt que de tout afficher en clair sur une page interminable. La "Zone
 * dangereuse" reste volontairement à part et toujours visible (décision
 * explicite de l'utilisateur), pas cachée derrière un clic.
 */
export default function SettingsPage() {
  const navigate = useNavigate();
  const [openModal, setOpenModal] = useState(null); // 'subscription' | 'logo' | 'info' | 'type' | 'share' | 'receipt' | 'billing'

  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  async function handleDeactivateStore() {
    if (
      !window.confirm(
        'Désactiver votre boutique ? Elle deviendra inaccessible (à vous et à votre équipe) jusqu\'à ce que vous la réactiviez depuis "Mes boutiques". Aucune donnée ne sera supprimée.'
      )
    ) {
      return;
    }
    setDeactivateError('');
    setDeactivating(true);
    try {
      await apiClient.post('/stores/deactivate');
      navigate('/account/store');
    } catch (err) {
      setDeactivateError(err.response?.data?.error?.message || 'Désactivation impossible.');
      setDeactivating(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* En-tête général */}
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-linear-to-br from-slate-800 to-slate-700 p-3 text-white shadow-sm">
          <SlidersHorizontal className="h-6 w-6" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Paramètres</h1>
          <p className="text-sm text-slate-500">Informations boutique, abonnement, facturation.</p>
        </div>
      </div>

      <div className="space-y-3">
        <SettingsEntryCard
          icon={Crown}
          accentClass="bg-amber-50 text-amber-600"
          title="Abonnement"
          description="Statut de votre plan, et déclaration de paiement."
          onClick={() => setOpenModal('subscription')}
        />
        <SettingsEntryCard
          icon={Image}
          accentClass="bg-sky-50 text-sky-600"
          title="Logo de la boutique"
          description="L'image affichée sur vos reçus et dans l'application."
          onClick={() => setOpenModal('logo')}
        />
        <SettingsEntryCard
          icon={Store}
          accentClass="bg-sky-50 text-sky-600"
          title="Informations générales"
          description="Nom, coordonnées et localisation de votre boutique."
          onClick={() => setOpenModal('info')}
        />
        <SettingsEntryCard
          icon={Tag}
          accentClass="bg-sky-50 text-sky-600"
          title="Type de boutique"
          description="Détermine les catégories de produits suggérées."
          onClick={() => setOpenModal('type')}
        />
        <SettingsEntryCard
          icon={Share2}
          accentClass="bg-violet-50 text-violet-600"
          title="Partage & accès"
          description="Codes de supervision, fournisseur et transfert de stock."
          onClick={() => setOpenModal('share')}
        />
        <AuthorizationCard />
        <SettingsEntryCard
          icon={Receipt}
          accentClass="bg-emerald-50 text-emerald-600"
          title="Personnaliser le reçu"
          description="Message d'en-tête/pied de page et informations affichées."
          onClick={() => setOpenModal('receipt')}
        />
        <SettingsEntryCard
          icon={FileText}
          accentClass="bg-slate-100 text-slate-500"
          title="Facturation"
          description="Taxe par défaut, informations légales, export comptable."
          onClick={() => setOpenModal('billing')}
        />
      </div>

      {/* Zone dangereuse — désactivation volontaire de la boutique
          (§53_desactivation_boutique.sql, décidé en conversation). Reste à
          part et toujours visible (décision explicite de l'utilisateur),
          jamais cachée derrière un clic. Réactivable plus tard depuis "Mes
          boutiques" (MyStorePage.jsx), tant qu'on n'a pas pris un autre
          poste (Owner/Vendeur) entre-temps. */}
      <div className="pt-4 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <PowerOff className="h-4 w-4 text-red-500" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-slate-800">Zone dangereuse</h2>
        </div>
        <section className="rounded-xl border border-red-200 bg-red-50/40 p-5">
          <h3 className="text-sm font-semibold text-slate-800">Désactiver ma boutique</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Rend votre boutique inaccessible (à vous et à votre équipe) jusqu'à réactivation. Aucune
            donnée n'est supprimée. Utile si vous souhaitez, par exemple, rejoindre une autre boutique
            en tant que Vendeur — un même compte ne peut pas occuper les deux rôles à la fois.
          </p>
          {deactivateError && (
            <div className="flex items-center gap-1.5 text-sm text-red-600 bg-white border border-red-100 rounded-lg px-3 py-2 mb-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {deactivateError}
            </div>
          )}
          <button
            onClick={handleDeactivateStore}
            disabled={deactivating}
            className="inline-flex items-center gap-2 rounded-lg bg-white border border-red-300 text-red-600 text-sm font-medium px-5 py-2.5 hover:bg-red-500 hover:text-white hover:border-red-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <PowerOff className="h-4 w-4" strokeWidth={1.75} />
            {deactivating ? 'Désactivation…' : 'Désactiver ma boutique'}
          </button>
        </section>
      </div>

      {openModal === 'subscription' && (
        <SettingsModal title="Abonnement" onClose={() => setOpenModal(null)}>
          <SubscriptionSection bare />
        </SettingsModal>
      )}
      {openModal === 'logo' && (
        <SettingsModal title="Logo de la boutique" onClose={() => setOpenModal(null)}>
          <StoreLogoSection bare />
        </SettingsModal>
      )}
      {openModal === 'info' && (
        <SettingsModal title="Informations générales" onClose={() => setOpenModal(null)}>
          <StoreInfoSection bare />
        </SettingsModal>
      )}
      {openModal === 'type' && (
        <SettingsModal title="Type de boutique" onClose={() => setOpenModal(null)}>
          <StoreTypeSection bare />
        </SettingsModal>
      )}
      {openModal === 'share' && <ShareCodesModal onClose={() => setOpenModal(null)} />}
      {openModal === 'receipt' && (
        <SettingsModal title="Personnaliser le reçu" onClose={() => setOpenModal(null)}>
          <ReceiptSettingsSection bare />
        </SettingsModal>
      )}
      {openModal === 'billing' && <BillingModal onClose={() => setOpenModal(null)} />}
    </div>
  );
}
