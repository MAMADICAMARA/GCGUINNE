import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/**
 * Champ mot de passe avec bascule afficher/masquer — même mécanique que
 * celle déjà utilisée dans LoginPage.jsx, extraite ici pour être réutilisée
 * dans tous les formulaires qui saisissent un mot de passe (décidé en
 * conversation : plus facile à taper correctement sur mobile, notamment
 * pour un public peu habitué au numérique).
 */
export default function PasswordInput({ className = '', ...props }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 ${className}`}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
        aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
      </button>
    </div>
  );
}
