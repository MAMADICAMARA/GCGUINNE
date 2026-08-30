import { useState } from 'react';
import { ShieldCheck, ChevronRight } from 'lucide-react';
import AuthorizationModal from './AuthorizationModal';

/**
 * Point d'entrée unique vers les 6 autorisations vendeur (annulation/
 * retour, prix modifiable, création produit, ajustement de stock, accès à
 * Fournisseurs, accès à Achats — §25/§39/§40/§43) — consolidées dans un
 * seul modal (§ décidé en conversation) plutôt que des blocs séparés sur la
 * page, pour rester simple à trouver et à comprendre pour un public peu
 * habitué à la tech.
 */
export default function AuthorizationCard() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-5 text-left hover:border-brand-300 hover:shadow-sm transition"
      >
        <div className="rounded-xl p-2.5 shrink-0 bg-violet-50 text-violet-600">
          <ShieldCheck size={20} strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800">Autorisation</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Choisissez ce que vos vendeurs peuvent faire : ventes, stock, produits, fournisseurs,
            achats.
          </p>
        </div>
        <ChevronRight size={18} className="text-slate-300 shrink-0" />
      </button>

      {open && <AuthorizationModal onClose={() => setOpen(false)} />}
    </>
  );
}
