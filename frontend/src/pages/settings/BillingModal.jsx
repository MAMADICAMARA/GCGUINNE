import BillingSettingsSection from './BillingSettingsSection';
import OrdersExportSection from './OrdersExportSection';
import SettingsModal from './SettingsModal';

/**
 * Point d'entrée unique vers la Facturation (taxe par défaut, informations
 * légales, numérotation de facture, export comptable —
 * §42_facturation_boutique.sql) — consolidés dans un seul modal (§ décidé
 * en conversation, même principe que AuthorizationModal) plutôt que deux
 * blocs séparés sur la page.
 */
export default function BillingModal({ onClose }) {
  return (
    <SettingsModal title="Facturation" description="Gestion des factures et documents." onClose={onClose}>
      <div className="space-y-6">
        <BillingSettingsSection />
        <OrdersExportSection />
      </div>
    </SettingsModal>
  );
}
