import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime, formatGNF } from '@/utils/format';
import SubscriptionPaymentModal from './SubscriptionPaymentModal';

const PAYMENT_METHOD_LABELS = {
  ORANGE_MONEY: 'Orange Money',
  MOBILE_MONEY: 'Mobile Money',
  PAYCARD: 'PayCard',
};

/**
 * Statut de l'abonnement + paiement déclaratif (§27_paiement_abonnement.sql,
 * décidé en conversation). L'activation 100% manuelle par le Super Admin
 * (contactez le support) reste toujours possible en parallèle — ce panneau
 * ajoute simplement une manière pour le Owner de déclarer un paiement
 * lui-même plutôt que d'attendre une action manuelle du Super Admin.
 */
export default function SubscriptionSection() {
  const [plan, setPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planError, setPlanError] = useState('');

  const [latestRequest, setLatestRequest] = useState(null);
  const [requestLoading, setRequestLoading] = useState(true);

  const [showPaymentModal, setShowPaymentModal] = useState(false);

  async function loadPlan() {
    setPlanLoading(true);
    setPlanError('');
    try {
      const { data } = await apiClient.get('/stores/plan-status');
      setPlan(data);
    } catch (err) {
      setPlanError(err.response?.data?.error?.message || "Impossible de charger le statut de l'abonnement.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function loadLatestRequest() {
    setRequestLoading(true);
    try {
      const { data } = await apiClient.get('/subscription-payments/mine');
      setLatestRequest(data.request);
    } catch {
      // Silencieux : l'historique de demande est secondaire, ne doit
      // jamais bloquer l'affichage du statut du plan lui-même.
    } finally {
      setRequestLoading(false);
    }
  }

  useEffect(() => {
    loadPlan();
    loadLatestRequest();
  }, []);

  function handlePaymentSuccess() {
    setShowPaymentModal(false);
    loadPlan();
    loadLatestRequest();
  }

  const hasPendingRequest = latestRequest?.status === 'PENDING';

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 max-w-md mb-6">
      <h2 className="text-sm font-semibold text-slate-700 mb-1">Abonnement</h2>
      <p className="text-xs text-slate-500 mb-3">
        Activation/renouvellement manuel possible en contactant le support, ou déclarez vous-même
        un paiement ci-dessous (Orange Money, Mobile Money, PayCard) — vérifié par la plateforme
        avant activation.
      </p>

      {planError && <p className="text-sm text-red-600 mb-3">{planError}</p>}

      {planLoading ? (
        <p className="text-sm text-slate-400">Chargement...</p>
      ) : plan ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Plan actuel</span>
            <span className={`font-medium ${plan.isEffectivelyFreemium ? 'text-amber-700' : 'text-slate-800'}`}>
              {plan.planName}
            </span>
          </div>
          {plan.planExpiresAt && (
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{plan.isEffectivelyFreemium ? 'Expiré le' : 'Expire le'}</span>
              <span className="font-medium text-slate-800">{formatDateTime(plan.planExpiresAt)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Utilisateurs / boutique</span>
            <span className="font-medium text-slate-800">{plan.maxUsersPerStore}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Superviser d'autres boutiques</span>
            <span className="font-medium text-slate-800">{plan.allowsSupervision ? 'Oui' : 'Non'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Fournisseurs</span>
            <span className="font-medium text-slate-800">{plan.allowsSuppliers ? 'Oui' : 'Non'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-500">Commandes d'achat (PREMIUM)</span>
            <span className="font-medium text-slate-800">{plan.allowsPurchaseOrders ? 'Oui' : 'Non'}</span>
          </div>
          {plan.isEffectivelyFreemium && plan.planName !== 'FREEMIUM' && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2 mt-2">
              Votre abonnement {plan.planName} a expiré — la boutique fonctionne actuellement en FREEMIUM.
            </p>
          )}

          <div className="pt-3 mt-1 border-t border-slate-100">
            {requestLoading ? null : hasPendingRequest ? (
              <div className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded-md px-3 py-2 space-y-1">
                <p className="font-medium">Demande en attente de vérification</p>
                <p>
                  {latestRequest.planName} — {PAYMENT_METHOD_LABELS[latestRequest.paymentMethod]} —{' '}
                  {formatGNF(latestRequest.amountDeclared)}
                </p>
                <p className="text-blue-600">Référence : {latestRequest.transactionReference}</p>
                <p className="text-blue-600">Soumise le {formatDateTime(latestRequest.createdAt)}</p>
              </div>
            ) : (
              <>
                {latestRequest?.status === 'REJECTED' && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-2">
                    Votre dernière demande ({latestRequest.planName}) a été refusée
                    {latestRequest.rejectionReason ? ` : ${latestRequest.rejectionReason}` : ''}. Vous pouvez en
                    soumettre une nouvelle.
                  </p>
                )}
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="rounded-lg bg-brand-500 text-white text-sm font-medium px-4 py-2 hover:bg-brand-600 transition"
                >
                  {plan.isEffectivelyFreemium ? "S'abonner" : 'Renouveler / changer de plan'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {showPaymentModal && (
        <SubscriptionPaymentModal onClose={() => setShowPaymentModal(false)} onSuccess={handlePaymentSuccess} />
      )}
    </section>
  );
}
