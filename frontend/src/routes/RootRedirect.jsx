import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import apiClient from '@/services/apiClient';
import { useAuthStore } from '@/store/authStore';

/**
 * Point d'entrée "/" (§5 du cahier des charges MARCHÉ). Le comportement
 * dépend à la fois de l'interrupteur plateforme et de l'état de connexion :
 *  - interrupteur désactivé (ou statut illisible) : comportement strictement
 *    inchangé, on repart sur /account comme avant cette fonctionnalité —
 *    jamais de régression pour la grande majorité du temps où le marché
 *    est éteint.
 *  - interrupteur activé, visiteur déconnecté : atterrit sur /marche.
 *  - interrupteur activé, déjà connecté : atterrit sur /account, qui
 *    affiche lui-même la grille MARCHÉ à la place de l'accueil habituel.
 */
export default function RootRedirect() {
  const token = useAuthStore((s) => s.token);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await apiClient.get('/marketplace/status');
        setStatus(data.enabled);
      } catch {
        setStatus(false);
      }
    })();
  }, []);

  if (status === null) return null;
  if (status && !token) return <Navigate to="/marche" replace />;
  return <Navigate to="/account" replace />;
}
