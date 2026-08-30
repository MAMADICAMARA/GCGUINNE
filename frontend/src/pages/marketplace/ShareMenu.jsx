import { useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

/**
 * Feuille de partage MARCHÉ (§ le bouton "Partager" ne fonctionnait pas de
 * façon fiable, décidé en conversation) — `navigator.share` n'est pas
 * disponible ou n'ouvre rien d'utile sur beaucoup de navigateurs de bureau,
 * et `navigator.clipboard` échoue silencieusement hors contexte sécurisé
 * (ex: accès par IP locale en http, cf. commentaire CORS_ORIGIN côté
 * backend). Cette feuille ne dépend d'AUCUNE de ces deux API pour
 * fonctionner : les icônes WhatsApp/Facebook/X ouvrent une simple URL
 * (toujours fiable), et le lien reste affiché en clair dans un champ —
 * copiable à la main même si l'API Presse-papiers échoue.
 */
const WhatsAppIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12.001 2C6.478 2 2 6.477 2 12c0 1.892.526 3.66 1.437 5.168L2 22l4.958-1.395A9.945 9.945 0 0 0 12 22c5.523 0 10-4.477 10-10S17.524 2 12 2zm0 18.09a8.06 8.06 0 0 1-4.267-1.222l-.306-.183-3.032.853.86-2.955-.2-.312A8.078 8.078 0 1 1 12 20.09z" />
  </svg>
);

const FacebookIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06C2 17.08 5.66 21.24 10.44 22v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.78l-.44 2.91h-2.34V22C18.34 21.24 22 17.08 22 12.06z" />
  </svg>
);

const XIcon = (props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export default function ShareMenu({ url, title, onClose }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        // Repli pour un contexte non sécurisé (ex: IP locale en http) où
        // l'API Presse-papiers n'existe pas — méthode historique, mais
        // fonctionne partout, contrairement à `navigator.clipboard`.
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Le champ ci-dessous reste sélectionnable/copiable à la main même
      // si tout le reste échoue — jamais un bouton qui "ne fait rien".
    }
  }

  const shareLinks = [
    {
      label: 'WhatsApp',
      Icon: WhatsAppIcon,
      color: 'bg-[#25D366]',
      href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
    },
    {
      label: 'Facebook',
      Icon: FacebookIcon,
      color: 'bg-[#1877F2]',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
    {
      label: 'X',
      Icon: XIcon,
      color: 'bg-slate-900',
      href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] animate-[sheet-up_0.25s_ease-out]"
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-800">Partager ce produit</h3>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-around mb-6">
          {shareLinks.map(({ label, Icon, color, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 group"
            >
              <span
                className={`h-14 w-14 rounded-2xl ${color} text-white flex items-center justify-center shadow-md group-hover:scale-105 group-active:scale-95 transition-transform`}
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="text-xs font-medium text-slate-600">{label}</span>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1.5">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 min-w-0 bg-transparent px-2.5 py-1.5 text-xs text-slate-600 truncate focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold px-3 py-2 transition ${
              copied ? 'bg-green-500 text-white' : 'bg-brand-500 text-white hover:bg-brand-600'
            }`}
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>
    </div>
  );
}
