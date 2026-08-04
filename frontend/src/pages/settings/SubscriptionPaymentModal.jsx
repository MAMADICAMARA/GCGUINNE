import { useEffect, useState } from 'react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';

const PAYMENT_METHODS = [
  { code: 'ORANGE_MONEY', label: 'Orange Money', instructionKey: 'orangeMoneyNumber', requiresPhone: true },
  { code: 'MOBILE_MONEY', label: 'Mobile Money', instructionKey: 'mobileMoneyNumber', requiresPhone: true },
  { code: 'PAYCARD', label: 'PayCard', instructionKey: 'paycardInfo', requiresPhone: false },
];

/**
 * Déclaration de paiement d'abonnement (§27_paiement_abonnement.sql,
 * décidé en conversation) — flux en 3 étapes : choisir un plan, choisir un
 * canal de paiement (ou "Contacter l'admin", qui n'est qu'un affichage de
 * coordonnées, jamais une déclaration), puis déclarer la référence de
 * transaction. Le montant n'est jamais saisi ici — toujours celui du plan,
 * calculé côté serveur à la soumission.
 */
export default function SubscriptionPaymentModal({ onClose, onSuccess }) {
  const [step, setStep] = useState('PLAN'); // PLAN | METHOD | FORM | CONTACT
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [transactionReference, setTransactionReference] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await apiClient.get('/subscription-payments/options');
        setOptions(data);
      } catch (err) {
        setLoadError(err.response?.data?.error?.message || 'Impossible de charger les options d\'abonnement.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function choosePlan(plan) {
    setSelectedPlan(plan);
    setStep('METHOD');
  }

  function chooseMethod(methodCode) {
    if (methodCode === 'CONTACT') {
      setStep('CONTACT');
      return;
    }
    setSelectedMethod(methodCode);
    setStep('FORM');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiClient.post('/subscription-payments', {
        planId: selectedPlan.id,
        paymentMethod: selectedMethod,
        transactionReference,
        payerPhone: payerPhone || undefined,
      });
      onSuccess();
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const methodMeta = PAYMENT_METHODS.find((m) => m.code === selectedMethod);
  const instructionValue = methodMeta && options?.paymentSettings?.[methodMeta.instructionKey];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">
            {step === 'PLAN' && 'Choisir un plan'}
            {step === 'METHOD' && 'Moyen de paiement'}
            {step === 'FORM' && `Payer par ${methodMeta?.label}`}
            {step === 'CONTACT' && 'Contacter l\'administrateur'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {loading ? (
            <p className="text-sm text-slate-400">Chargement...</p>
          ) : loadError ? (
            <p className="text-sm text-red-600">{loadError}</p>
          ) : (
            <>
              {step === 'PLAN' && (
                <div className="space-y-3">
                  {options.plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => choosePlan(plan)}
                      className="w-full text-left rounded-lg border border-slate-200 hover:border-brand-400 hover:bg-brand-50/40 transition px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800">{plan.name}</span>
                        <span className="font-semibold text-brand-600">
                          {formatGNF(plan.price)} / {options.renewalDays} j
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        {plan.maxUsersPerStore} utilisateur(s) · Supervision {plan.allowsSupervision ? 'incluse' : 'non incluse'} ·
                        Fournisseurs {plan.allowsSuppliers ? 'inclus' : 'non inclus'}
                      </p>
                      {plan.allowsPurchaseOrders && (
                        <p className="text-xs text-brand-600 font-medium mt-1">
                          + Commandes d'achat fournisseur (exclusif PREMIUM)
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {step === 'METHOD' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-2">
                    Plan choisi : <span className="font-medium">{selectedPlan.name}</span> —{' '}
                    {formatGNF(selectedPlan.price)}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map((m) => (
                      <button
                        key={m.code}
                        onClick={() => chooseMethod(m.code)}
                        className="rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50/40 transition"
                      >
                        {m.label}
                      </button>
                    ))}
                    <button
                      onClick={() => chooseMethod('CONTACT')}
                      className="col-span-2 rounded-lg border border-slate-300 px-3 py-3 text-sm font-medium text-slate-700 hover:border-brand-400 hover:bg-brand-50/40 transition"
                    >
                      Contacter l'admin
                    </button>
                  </div>
                  <button onClick={() => setStep('PLAN')} className="text-xs text-slate-400 hover:text-slate-600">
                    ← Changer de plan
                  </button>
                </div>
              )}

              {step === 'FORM' && (
                <form onSubmit={handleSubmit}>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 mb-4 text-sm">
                    {instructionValue ? (
                      <>
                        <p className="text-slate-500 text-xs uppercase tracking-wide mb-1">
                          {methodMeta.code === 'PAYCARD' ? 'Informations de paiement' : 'Numéro à créditer'}
                        </p>
                        <p className="font-medium text-slate-800">{instructionValue}</p>
                      </>
                    ) : (
                      <p className="text-amber-700">
                        Ce moyen de paiement n'est pas encore configuré par l'administrateur — utilisez
                        "Contacter l'admin" à la place, ou réessayez plus tard.
                      </p>
                    )}
                    <p className="text-slate-500 mt-2">
                      Montant à payer : <span className="font-semibold text-slate-800">{formatGNF(selectedPlan.price)}</span>
                    </p>
                  </div>

                  {submitError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 mb-3">
                      {submitError}
                    </p>
                  )}

                  {methodMeta.requiresPhone && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-600 mb-1">Numéro utilisé pour payer</label>
                      <input
                        value={payerPhone}
                        onChange={(e) => setPayerPhone(e.target.value)}
                        placeholder="Ex : 620 00 00 00"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-slate-600 mb-1">Référence de la transaction</label>
                    <input
                      required
                      value={transactionReference}
                      onChange={(e) => setTransactionReference(e.target.value)}
                      placeholder="Ex : code reçu par SMS après paiement"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-semibold py-2.5 hover:bg-brand-600 transition disabled:opacity-60"
                    >
                      {submitting ? 'Envoi...' : "J'ai payé — soumettre"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('METHOD')}
                      disabled={submitting}
                      className="text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      ← Retour
                    </button>
                  </div>
                </form>
              )}

              {step === 'CONTACT' && (
                <div className="space-y-3 text-sm">
                  {options.paymentSettings?.contactPhone ||
                  options.paymentSettings?.contactWhatsapp ||
                  options.paymentSettings?.contactEmail ? (
                    <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-3 space-y-2">
                      {options.paymentSettings.contactPhone && (
                        <p>
                          Téléphone :{' '}
                          <a href={`tel:${options.paymentSettings.contactPhone}`} className="text-brand-600 font-medium">
                            {options.paymentSettings.contactPhone}
                          </a>
                        </p>
                      )}
                      {options.paymentSettings.contactWhatsapp && (
                        <p>
                          WhatsApp :{' '}
                          <a
                            href={`https://wa.me/${options.paymentSettings.contactWhatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-brand-600 font-medium"
                          >
                            {options.paymentSettings.contactWhatsapp}
                          </a>
                        </p>
                      )}
                      {options.paymentSettings.contactEmail && (
                        <p>
                          E-mail :{' '}
                          <a href={`mailto:${options.paymentSettings.contactEmail}`} className="text-brand-600 font-medium">
                            {options.paymentSettings.contactEmail}
                          </a>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
                      Aucune coordonnée de contact n'est configurée pour le moment.
                    </p>
                  )}
                  <button onClick={() => setStep('METHOD')} className="text-xs text-slate-400 hover:text-slate-600">
                    ← Retour
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
