import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Check,
  Crown,
  Eye,
  Package,
  ShoppingBag,
  Sparkles,
  Store,
  Truck,
  Users,
  X,
} from 'lucide-react';
import apiClient from '@/services/apiClient';
import { formatDateTime, formatGNF } from '@/utils/format';
import SubscriptionPaymentModal from './SubscriptionPaymentModal';

/**
 * Page dédiée au choix d'un plan d'abonnement (§ décidé en conversation,
 * "page dédiée, design moderne comme les applications les plus reconnues")
 * — remplace l'ancienne étape "PLAN" imbriquée au fond d'une modale par un
 * vrai écran de tarification en cartes. Les étapes suivantes (moyen de
 * paiement, formulaire, contact) restent dans SubscriptionPaymentModal,
 * ouverte ici avec le plan déjà choisi (voir initialPlan).
 *
 * Toutes les données affichées viennent de GET /subscription-payments/options
 * (déjà utilisé par la modale) et GET /stores/plan-status — aucune nouvelle
 * route backend, ce n'est qu'une nouvelle présentation de données déjà
 * exposées, entièrement pilotées par la configuration Super Admin (prix et
 * plafonds de chaque plan, cf. AdminPlansPage.jsx).
 */
export default function SubscriptionPlansPage() {
  const navigate = useNavigate();
  const [options, setOptions] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentPlan, setPaymentPlan] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [optionsRes, planRes] = await Promise.all([
        apiClient.get('/subscription-payments/options'),
        apiClient.get('/stores/plan-status'),
      ]);
      setOptions(optionsRes.data);
      setCurrentPlan(planRes.data);
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les plans disponibles.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function handlePaymentSuccess() {
    setPaymentPlan(null);
    load();
  }

  const plans = options?.plans || [];
  // Le plan le plus cher sert de mise en avant visuelle ("le plus
  // complet") — un repère commercial usuel, jamais une donnée renvoyée par
  // le serveur : recalculé ici à partir des prix, pour rester correct même
  // si le Super Admin change les plans/leur ordre.
  const highestPriceId = plans.reduce(
    (best, p) => (best === null || p.price > best.price ? p : best),
    null
  )?.id;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <button
        onClick={() => navigate('/settings')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition"
      >
        <ArrowLeft size={16} /> Retour aux paramètres
      </button>

      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-600 text-white shadow-lg shadow-brand-500/25 mb-4">
          <Crown size={22} />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Choisissez votre plan</h1>
        <p className="text-slate-500">
          Des offres pensées pour accompagner la croissance de votre boutique — changez ou renouvelez à
          tout moment.
        </p>
        {currentPlan && !loading && (
          <p className="mt-3 text-sm text-slate-500">
            Plan actuel :{' '}
            <span className={`font-semibold ${currentPlan.isEffectivelyFreemium ? 'text-amber-600' : 'text-brand-600'}`}>
              {currentPlan.planName}
            </span>
            {currentPlan.planExpiresAt && (
              <span>
                {' '}
                — {currentPlan.isEffectivelyFreemium ? 'expiré le' : 'expire le'}{' '}
                {formatDateTime(currentPlan.planExpiresAt)}
              </span>
            )}
          </p>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3 mb-6 max-w-lg mx-auto text-center">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-center text-sm text-slate-400">Chargement des plans...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              renewalDays={options.renewalDays}
              isCurrent={currentPlan?.planName === plan.name}
              isHighlighted={plan.id === highestPriceId && plan.price > 0}
              onChoose={() => setPaymentPlan(plan)}
            />
          ))}
        </div>
      )}

      {paymentPlan && (
        <SubscriptionPaymentModal
          initialPlan={paymentPlan}
          onClose={() => setPaymentPlan(null)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}

function PlanCard({ plan, renewalDays, isCurrent, isHighlighted, onChoose }) {
  const isFree = plan.price === 0;

  const features = [
    { icon: Users, label: `${plan.maxUsersPerStore} utilisateur${plan.maxUsersPerStore > 1 ? 's' : ''} / boutique`, included: true },
    { icon: Package, label: `${plan.maxProductsPerStore} produits actifs / boutique`, included: true },
    { icon: Eye, label: "Superviser d'autres boutiques", included: plan.allowsSupervision },
    { icon: Truck, label: 'Fournisseurs inter-boutiques', included: plan.allowsSuppliers },
    { icon: ShoppingBag, label: "Commandes d'achat", included: plan.allowsPurchaseOrders },
    { icon: Store, label: 'Visible sur le MARCHÉ', included: plan.allowsMarketplace },
    { icon: ArrowLeftRight, label: 'Transfert de stock entre boutiques', included: plan.allowsStockTransfer },
  ];

  return (
    <div
      className={`relative flex flex-col rounded-3xl p-7 transition-all duration-300 ${
        isHighlighted
          ? 'bg-gradient-to-b from-slate-900 to-slate-800 text-white shadow-2xl shadow-slate-900/20 lg:-translate-y-3'
          : 'bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:-translate-y-1'
      }`}
    >
      {isHighlighted && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 text-xs font-bold px-3.5 py-1 shadow-lg shadow-amber-500/30">
          <Sparkles size={12} /> Le plus complet
        </span>
      )}

      <p
        className={`text-xs font-bold uppercase tracking-wider mb-2 ${
          isHighlighted ? 'text-amber-400' : 'text-brand-600'
        }`}
      >
        {plan.name}
      </p>

      <div className="mb-1 flex items-baseline gap-1.5">
        <span className="text-4xl font-extrabold tracking-tight">
          {isFree ? 'Gratuit' : formatGNF(plan.price)}
        </span>
        {!isFree && (
          <span className={`text-sm ${isHighlighted ? 'text-slate-400' : 'text-slate-400'}`}>
            / {renewalDays} j
          </span>
        )}
      </div>
      <p className={`text-sm mb-6 ${isHighlighted ? 'text-slate-400' : 'text-slate-500'}`}>
        {isFree ? 'Pour démarrer sans engagement' : 'Facturation manuelle, renouvelable à tout moment'}
      </p>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((f) => (
          <li key={f.label} className="flex items-start gap-2.5 text-sm">
            {f.included ? (
              <Check
                size={16}
                className={`shrink-0 mt-0.5 ${isHighlighted ? 'text-emerald-400' : 'text-emerald-500'}`}
              />
            ) : (
              <X size={16} className={`shrink-0 mt-0.5 ${isHighlighted ? 'text-slate-600' : 'text-slate-300'}`} />
            )}
            <span
              className={
                f.included
                  ? isHighlighted
                    ? 'text-slate-200'
                    : 'text-slate-700'
                  : isHighlighted
                    ? 'text-slate-600'
                    : 'text-slate-300'
              }
            >
              {f.label}
            </span>
          </li>
        ))}
      </ul>

      {isCurrent ? (
        <div
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold ${
            isHighlighted ? 'bg-white/10 text-white' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <BadgeCheck size={17} /> Votre plan actuel
        </div>
      ) : (
        <button
          onClick={onChoose}
          className={`rounded-xl py-3 text-sm font-semibold transition-all ${
            isHighlighted
              ? 'bg-white text-slate-900 hover:bg-slate-100'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isFree ? 'Choisir ce plan' : 'Passer à ce plan'}
        </button>
      )}
    </div>
  );
}
