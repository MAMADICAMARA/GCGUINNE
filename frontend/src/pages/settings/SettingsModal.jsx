import { X } from 'lucide-react';

/**
 * Squelette de modal générique pour les sections de Paramètres (§ décidé en
 * conversation) — extrait du markup exact de AuthorizationModal.jsx, pour
 * que chaque nouvelle section (Abonnement, Logo, Informations générales...)
 * s'ouvre dans le même habillage plutôt que de dupliquer l'overlay/en-tête/
 * pied de page à chaque fois.
 */
export default function SettingsModal({ title, description, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-800">{title}</h2>
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 transition shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">{children}</div>

        <div className="px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 text-slate-700 text-sm font-medium py-2.5 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
