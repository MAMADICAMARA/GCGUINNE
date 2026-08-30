/**
 * Interrupteur (on/off) accessible — remplace les cases à cocher brutes
 * pour tout réglage de permission (§ décidé en conversation, modal
 * "Autorisation") : plus lisible d'un coup d'œil pour un public peu
 * habitué à la tech qu'une case à cocher classique.
 */
export default function Switch({ checked, onChange, disabled = false, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-brand-500' : 'bg-slate-200'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.75'
        }`}
      />
    </button>
  );
}
