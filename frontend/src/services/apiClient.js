import axios from 'axios';
import { useAuthStore } from '@/store/authStore';

/**
 * Client HTTP centralisé.
 * - Injecte automatiquement le jeton d'authentification (porteur de l'identité
 *   utilisateur ET de la boutique active) dans chaque requête.
 * - Centralise la gestion des erreurs d'authentification (401) en forçant
 *   une déconnexion propre côté client.
 *
 * Toute future règle transverse (retry, logging, etc.) doit être ajoutée ici,
 * jamais dupliquée dans chaque appel individuel.
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
