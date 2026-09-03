import { Smartphone } from 'lucide-react';

/**
 * Bandeau promotionnel "Téléchargez l'application Android" (§ décidé en
 * conversation) — différent du système de notification de mise à jour
 * (UpdateBanner côté mobile) : celui-ci s'adresse aux utilisateurs du SITE
 * WEB qui n'ont peut-être jamais installé l'app, pas aux utilisateurs déjà
 * équipés qu'il faudrait prévenir d'une nouvelle version. Toujours visible
 * dans l'espace connecté (DashboardLayout et AccountLayout), jamais dans
 * l'espace Super Admin (fonctions admin non disponibles sur mobile).
 *
 * Ouvre /telecharger dans un nouvel onglet plutôt qu'une navigation SPA —
 * l'utilisateur ne doit pas perdre l'écran sur lequel il travaillait.
 */
export default function DownloadAppBanner() {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
      <span className="flex items-center gap-2">
        <Smartphone size={16} className="shrink-0 text-blue-600" />
        Gérez votre boutique en déplacement avec l'application Android.
      </span>
      <a
        href="/telecharger"
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 hover:bg-blue-700 transition"
      >
        Télécharger l'application
      </a>
    </div>
  );
}
