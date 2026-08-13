import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import apiClient from '@/services/apiClient';
import TutorialModal from '@/pages/contact/TutorialModal';
import MarketplaceGrid from '@/pages/marketplace/MarketplaceGrid';

export default function AccountHomePage() {
  const { user, stores } = useAuthStore();
  const location = useLocation();
  const [tutorialVideos, setTutorialVideos] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [marketplaceEnabled, setMarketplaceEnabled] = useState(false);

  // MARCHÉ remplace le contenu d'accueil par défaut quand l'interrupteur
  // plateforme est activé (§5 du cahier des charges) — jamais pour un
  // Super Admin, qui n'a pas vocation à parcourir un catalogue produit.
  // La navigation habituelle (volet Compte) reste inchangée autour,
  // fournie par AccountLayout, jamais touchée ici.
  useEffect(() => {
    if (user?.isSuperAdmin) return;
    (async () => {
      try {
        const { data } = await apiClient.get('/marketplace/status');
        setMarketplaceEnabled(data.enabled);
      } catch {
        // Silencieux : en cas d'échec, on reste sur l'accueil habituel —
        // jamais une page qui plante pour une fonctionnalité optionnelle.
      }
    })();
  }, [user?.isSuperAdmin]);

  // Déclenchement automatique du tutoriel (§36_tutoriel.sql, décidé en
  // conversation) — jamais pour un Super Admin. `tutorialTrigger` ('login'
  // ou 'signup') n'est présent que juste après un vrai passage par
  // LoginPage/VerifyEmailPage (state de navigation, jamais persistant) :
  // ce useEffect ne se redéclenche donc pas à chaque re-render, seulement
  // à chaque nouvelle connexion/inscription réelle. Le réglage consulté
  // dépend du type d'événement — les deux sont indépendants, contrôlés
  // séparément par le Super Admin (jamais une seule case à cocher pour
  // les deux).
  useEffect(() => {
    const trigger = location.state?.tutorialTrigger;
    if (!trigger || user?.isSuperAdmin) return;

    (async () => {
      try {
        const { data } = await apiClient.get('/contact/tutorial');
        const shouldShow = trigger === 'signup' ? data.showAfterSignup : data.showOnLogin;
        if (shouldShow && data.videos.length > 0) {
          setTutorialVideos(data.videos);
          setShowTutorial(true);
        }
      } catch {
        // Silencieux : un tutoriel qui ne charge pas ne doit jamais
        // bloquer l'arrivée sur l'espace compte.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">
        Bonjour {user?.fullName?.split(' ')[0] || ''} 👋
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        {marketplaceEnabled
          ? 'Découvrez les produits de nos boutiques partenaires.'
          : 'Bienvenue sur votre espace de gestion.'}
      </p>

      {user?.isSuperAdmin && (
        <Link
          to="/admin"
          className="block rounded-xl border border-amber-200 bg-amber-50 p-4 mb-6 hover:bg-amber-100 transition"
        >
          <p className="text-sm font-semibold text-amber-800">
            Administration de la plateforme
          </p>
          <p className="text-xs text-amber-700">
            Boutiques, journal d'audit, plans d'abonnement — accès Super Admin
          </p>
        </Link>
      )}

      {marketplaceEnabled ? (
        <MarketplaceGrid />
      ) : stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-slate-600 mb-4">
            Vous n'avez pas encore de boutique. Créez-la pour commencer à
            gérer vos produits, votre stock et vos ventes.
          </p>
          <Link
            to="/account/store"
            className="inline-block rounded-lg bg-brand-500 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-600 transition"
          >
            Créer ma boutique
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-slate-600">
            Vous gérez {stores.length} boutique{stores.length > 1 ? 's' : ''}.
            Rendez-vous dans{' '}
            <Link to="/account/store" className="text-brand-500 font-medium hover:underline">
              Ma Boutique
            </Link>{' '}
            pour l'ouvrir ou en créer une autre.
          </p>
        </div>
      )}

      {showTutorial && (
        <TutorialModal videos={tutorialVideos} onClose={() => setShowTutorial(false)} />
      )}
    </div>
  );
}