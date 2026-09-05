import { ChevronRight } from 'lucide-react';

/**
 * Ligne résumé cliquable qui ouvre le contenu complet d'une section dans un
 * modal (§ décidé en conversation, page Paramètres trop longue à parcourir
 * pour un public peu à l'aise avec le numérique) — extrait du markup exact
 * de AuthorizationCard.jsx, généralisé pour toutes les sections.
 */
export default function SettingsEntryCard({ icon: Icon, accentClass, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-brand-300 hover:shadow-sm transition"
    >
      <div className={`rounded-xl p-2.5 shrink-0 ${accentClass}`}>
        <Icon size={20} strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
      <ChevronRight size={18} className="text-slate-300 shrink-0" />
    </button>
  );
}
