import { useEffect, useState } from 'react';
import { Check, ChevronLeft, Sparkles, TrendingUp } from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatGNF } from '@/utils/format';
import { getDurationOptions } from '@/utils/subscriptionPricing';

const PAYMENT_METHODS = [
  { code: 'ORANGE_MONEY', label: 'Orange Money', instructionKey: 'orangeMoneyNumber', requiresPhone: true },
  { code: 'MOBILE_MONEY', label: 'Mobile Money', instructionKey: 'mobileMoneyNumber', requiresPhone: true },
  { code: 'PAYCARD', label: 'PayCard', instructionKey: 'paycardInfo', requiresPhone: false },
];

function hasDurationChoice(plan) {
  return Boolean(plan) && Array.isArray(plan.durationTiers) && plan.durationTiers.length > 0;
}

/**
 * Déclaration de paiement d'abonnement (§27_paiement_abonnement.sql,
 * décidé en conversation) — flux en plusieurs étapes : choisir un plan,
 * choisir une durée (§51_paliers_duree_abonnement.sql — sautée si le plan
 * n'a aucun palier de durée configuré, jamais de choix inutile imposé),
 * choisir un canal de paiement (ou "Contacter l'admin", qui n'est qu'un
 * affichage de coordonnées, jamais une déclaration), puis déclarer la
 * référence de transaction. Le montant n'est jamais saisi ici — toujours
 * calculé côté serveur à la soumission, à partir du plan ET de la durée
 * choisis (l'aperçu affiché ici est purement indicatif).
 */
export default function SubscriptionPaymentModal({
  onClose,
  onSuccess,
  initialPlan = null,
  // Généralisé (§ décidé en conversation, "le superviseur peut payer l'abonnement
  // d'une boutique supervisée") — mêmes endpoints par défaut que le Owner sur sa
  // propre boutique, remplacés par les routes /supervision/stores/:storeId/*
  // quand ce composant est ouvert depuis SupervisePage.jsx/SupervisedStoreDetailPage.jsx.
  optionsEndpoint = '/subscription-payments/options',
  submitEndpoint = '/subscription-payments',
  // "Payer pour toutes" (§52_lot_paiement_abonnement.sql, décidé en
  // conversation) — un seul plan/une seule durée choisis ici s'appliquent à
  // plusieurs boutiques à la fois : `priceMultiplier` (nombre de boutiques)
  // multiplie uniquement l'AFFICHAGE du montant total, jamais envoyé au
  // serveur (chaque boutique reste calculée indépendamment côté backend,
  // montant jamais multiplié en base). `extraSubmitPayload` fusionne des
  // champs supplémentaires dans le corps de la requête (ex. `storeIds`).
  // `subjectLabel` affiche un rappel du périmètre ("4 boutiques
  // sélectionnées") sous l'indicateur d'étapes.
  priceMultiplier = 1,
  extraSubmitPayload = {},
  subjectLabel = null,
}) {
  // Ouvert depuis la page dédiée (SubscriptionPlansPage), le plan est déjà
  // choisi — on saute directement à l'étape suivante (durée si le plan a
  // des paliers, sinon moyen de paiement) plutôt que de faire rechoisir un
  // plan déjà sélectionné (§ décidé en conversation). Ouvert depuis
  // ailleurs (aucun plan fourni), le flux reste inchangé : on démarre à
  // l'étape PLAN.
  const [step, setStep] = useState(
    initialPlan ? (hasDurationChoice(initialPlan) ? 'DURATION' : 'METHOD') : 'PLAN'
  ); // PLAN | DURATION | METHOD | FORM | CONTACT
  const [options, setOptions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [selectedMonths, setSelectedMonths] = useState(1);
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
        const { data } = await apiClient.get(optionsEndpoint);
        setOptions(data);
      } catch (err) {
        setLoadError(err.response?.data?.error?.message || 'Impossible de charger les options d\'abonnement.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsEndpoint]);

  function choosePlan(plan) {
    setSelectedPlan(plan);
    setSelectedMonths(1);
    setStep(hasDurationChoice(plan) ? 'DURATION' : 'METHOD');
  }

  function chooseDuration(months) {
    setSelectedMonths(months);
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
      const { data } = await apiClient.post(submitEndpoint, {
        planId: selectedPlan.id,
        months: selectedMonths,
        paymentMethod: selectedMethod,
        transactionReference,
        payerPhone: payerPhone || undefined,
        ...extraSubmitPayload,
      });
      // Le corps de réponse est transmis à onSuccess (ex. le détail par
      // boutique de "Payer pour toutes", { batchId, results } — voir
      // submitBulkSupervisedStorePaymentRequest, supervision.service.js) —
      // ignoré par les appelants qui n'en ont pas besoin.
      onSuccess(data);
    } catch (err) {
      setSubmitError(err.response?.data?.error?.message || 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  }

  const methodMeta = PAYMENT_METHODS.find((m) => m.code === selectedMethod);
  const instructionValue = methodMeta && options?.paymentSettings?.[methodMeta.instructionKey];

  const durationOptions = selectedPlan ? getDurationOptions(selectedPlan) : [];
  const selectedDuration = durationOptions.find((d) => d.months === selectedMonths);
  // priceMultiplier ("Payer pour toutes") ne change QUE cet affichage —
  // jamais envoyé au serveur, qui recalcule toujours par boutique.
  const totalPrice = (selectedDuration?.totalPrice ?? selectedPlan?.price ?? 0) * priceMultiplier;

  // Indicateur d'étapes (§ décidé en conversation — un utilisateur peu à
  // l'aise avec le numérique doit toujours savoir où il en est). CONTACT
  // n'est qu'une bulle d'info greffée sur METHOD, elle ne compte pas comme
  // une étape à part.
  const stepOrder = selectedPlan && hasDurationChoice(selectedPlan)
    ? ['PLAN', 'DURATION', 'METHOD', 'FORM']
    : ['PLAN', 'METHOD', 'FORM'];
  const currentStepIndex = stepOrder.indexOf(step === 'CONTACT' ? 'METHOD' : step);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">
            {step === 'PLAN' && 'Choisir un plan'}
            {step === 'DURATION' && 'Choisir une durée'}
            {step === 'METHOD' && 'Moyen de paiement'}
            {step === 'FORM' && `Payer par ${methodMeta?.label}`}
            {step === 'CONTACT' && 'Contacter l\'administrateur'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none" aria-label="Fermer">
            ×
          </button>
        </div>

        {subjectLabel && (
          <div className="px-6 py-2 bg-brand-50 border-b border-brand-100 shrink-0">
            <p className="text-xs font-medium text-brand-700">{subjectLabel}</p>
          </div>
        )}

        {!loading && !loadError && currentStepIndex >= 0 && (
          <div className="flex items-center gap-1.5 px-6 pt-3 shrink-0">
            {stepOrder.map((s, i) => (
              <div
                key={s}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i <= currentStepIndex ? 'bg-brand-500' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        )}

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

              {step === 'DURATION' && (
                <div>
                  <p className="text-sm text-slate-600 mb-4">
                    Plan choisi : <span className="font-medium">{selectedPlan.name}</span> — pour combien de temps
                    voulez-vous payer ?
                  </p>
                  <div className="space-y-3">
                    {durationOptions.map((d) => {
                      const isSelected = d.months === selectedMonths;
                      const isBestValue =
                        durationOptions.length > 1 &&
                        d.savingsPercent > 0 &&
                        d.savingsPercent === Math.max(...durationOptions.map((o) => o.savingsPercent));
                      return (
                        <button
                          key={d.months}
                          type="button"
                          onClick={() => setSelectedMonths(d.months)}
                          className={`relative w-full text-left rounded-2xl border-2 p-4 transition ${
                            isSelected ? 'border-brand-500 bg-brand-50/40' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {isSelected && (
                            <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-white">
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-lg font-bold text-slate-800">
                              {d.months} mois
                            </span>
                            {d.savingsPercent > 0 && (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold px-2 py-0.5">
                                ÉCONOMISEZ {d.savingsPercent}%
                              </span>
                            )}
                            {isBestValue && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5">
                                <Sparkles size={11} /> Meilleure offre
                              </span>
                            )}
                          </div>
                          <p className="text-base font-semibold text-slate-700">
                            {formatGNF(d.totalPrice * priceMultiplier)}
                            {priceMultiplier > 1 && (
                              <span className="text-xs font-normal text-slate-400"> ({formatGNF(d.totalPrice)} × {priceMultiplier})</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">
                            ≈ {formatGNF(d.pricePerMonth)} / mois{priceMultiplier > 1 ? ' / boutique' : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => chooseDuration(selectedMonths)}
                    className="w-full rounded-lg bg-linear-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold py-3 mt-4 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all"
                  >
                    Continuer
                  </button>
                  <button
                    onClick={() => (initialPlan ? onClose() : setStep('PLAN'))}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mt-3"
                  >
                    <ChevronLeft size={14} /> Changer de plan
                  </button>
                </div>
              )}

              {step === 'METHOD' && (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600 mb-2">
                    Plan choisi : <span className="font-medium">{selectedPlan.name}</span>
                    {hasDurationChoice(selectedPlan) && <> — {selectedMonths} mois</>} —{' '}
                    <span className="font-semibold">{formatGNF(totalPrice)}</span>
                    {priceMultiplier > 1 && <span className="text-slate-400"> ({priceMultiplier} boutiques)</span>}
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
                  <button
                    onClick={() =>
                      hasDurationChoice(selectedPlan)
                        ? setStep('DURATION')
                        : initialPlan
                          ? onClose()
                          : setStep('PLAN')
                    }
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <ChevronLeft size={14} /> {hasDurationChoice(selectedPlan) ? 'Changer de durée' : 'Changer de plan'}
                  </button>
                </div>
              )}

              {step === 'FORM' && (
                <form onSubmit={handleSubmit}>
                  <div className="rounded-2xl border border-brand-100 bg-brand-50 px-5 py-4 mb-4 flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0">
                      <TrendingUp size={18} className="text-brand-600" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-brand-700 uppercase tracking-wide">
                        Montant à payer{hasDurationChoice(selectedPlan) ? ` — ${selectedMonths} mois` : ''}
                        {priceMultiplier > 1 ? ` — ${priceMultiplier} boutiques` : ''}
                      </p>
                      <p className="text-xl font-bold text-slate-800">{formatGNF(totalPrice)}</p>
                    </div>
                  </div>

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
                      className="flex-1 rounded-lg bg-linear-to-r from-brand-500 to-brand-600 text-white text-sm font-semibold py-2.5 shadow-lg shadow-brand-500/30 hover:shadow-xl hover:shadow-brand-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:translate-y-0 disabled:shadow-none"
                    >
                      {submitting ? 'Envoi...' : "J'ai payé — soumettre"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep('METHOD')}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 disabled:opacity-50"
                    >
                      <ChevronLeft size={14} /> Retour
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
                  <button
                    onClick={() => setStep('METHOD')}
                    className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    <ChevronLeft size={14} /> Retour
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
