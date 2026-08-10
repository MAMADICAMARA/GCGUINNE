import { useEffect } from 'react';
import apiClient from '@/services/apiClient';
import { formatDateTime } from '@/utils/format';

/**
 * Détail d'un message "Contactez-nous" pour le Super Admin — marque le
 * message comme lu dès l'ouverture (§ décidé en conversation), sans action
 * explicite requise de l'admin.
 */
export default function ContactMessageDetailModal({ message, onClose, onRead }) {
  useEffect(() => {
    if (message.status === 'NEW') {
      apiClient
        .post(`/admin/contact-messages/${message.id}/read`)
        .then(() => onRead?.(message.id))
        .catch(() => {
          // Silencieux : un échec de marquage "lu" ne doit jamais bloquer
          // la simple consultation du message.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id]);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <h2 className="font-semibold text-slate-800 truncate">{message.subject}</h2>
            <p className="text-xs text-slate-400">{formatDateTime(message.createdAt)}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 text-slate-400 hover:text-slate-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0 space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Message</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">
              {message.message}
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Expéditeur</p>
            <dl className="text-sm divide-y divide-slate-100 rounded-lg border border-slate-100">
              <Row label="Nom" value={message.userName} />
              <Row label="E-mail" value={message.userEmail} />
              <Row label="Téléphone" value={message.userPhone || '—'} />
              <Row label="Boutique" value={message.storeName || 'Aucune boutique'} />
            </dl>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2 hover:bg-slate-200 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-slate-800 font-medium truncate max-w-[60%] text-right">{value}</dd>
    </div>
  );
}
