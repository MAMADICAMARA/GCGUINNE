import { useState } from 'react';
import { downloadReceiptPdf, getReceiptPdfFile } from '@/utils/receiptPdf';
import { downloadInvoicePdf } from '@/utils/invoicePdf';

/**
 * Reçu affiché juste après une vente. Corrigé (décidé en conversation) :
 * quand le panier contient beaucoup d'articles, le texte du reçu ne doit
 * plus pousser les boutons (Télécharger/Imprimer/Partager/Fermer) hors de
 * l'écran sans aucun moyen de les atteindre — le contenu défile maintenant
 * dans sa propre zone, les boutons restent fixes en bas de la modale,
 * quelle que soit la longueur du reçu.
 *
 * "Télécharger" génère un vrai PDF (utils/receiptPdf.js) — auparavant un
 * fichier texte brut, illisible pour beaucoup de commerçants. "Télécharger
 * la facture (PDF)" est une fonctionnalité distincte (§ cahier des charges
 * "Facture PDF") : mise en page formelle façon formulaire, générée côté
 * serveur (PDFKit) — les deux coexistent, aucune ne remplace l'autre.
 *
 * "Partager" utilise le partage natif du téléphone (Web Share API) —
 * pratique pour envoyer le reçu par WhatsApp directement depuis la caisse.
 * N'apparaît que si le navigateur le supporte réellement (peu répandu sur
 * desktop) : pas de bouton mort plutôt qu'un clic qui ne fait rien.
 */
export default function ReceiptModal({ receiptText, order, onClose }) {
  const [sharing, setSharing] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  function handleDownload() {
    downloadReceiptPdf(order);
  }

  async function handleDownloadInvoice() {
    setDownloadingInvoice(true);
    setInvoiceError('');
    try {
      await downloadInvoicePdf(order.orderId, order.orderNumber);
    } catch (err) {
      setInvoiceError(err.response?.data?.error?.message || 'Impossible de générer la facture.');
    } finally {
      setDownloadingInvoice(false);
    }
  }

  async function handleShare() {
    setSharing(true);
    try {
      const file = getReceiptPdfFile(order);
      const shareData =
        navigator.canShare && navigator.canShare({ files: [file] })
          ? { files: [file], title: `Reçu ${order.orderNumber}` }
          : { title: `Reçu ${order.orderNumber}`, text: receiptText };
      await navigator.share(shareData);
    } catch (err) {
      // AbortError : l'utilisateur a simplement annulé le partage — rien à signaler.
      if (err?.name !== 'AbortError') {
        // eslint-disable-next-line no-console
        console.error('Partage impossible :', err);
      }
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <h2 className="font-semibold text-slate-800">Vente validée</h2>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 min-h-0">
          <pre className="text-xs font-mono whitespace-pre-wrap bg-slate-50 rounded-lg p-3 text-slate-700">
            {receiptText}
          </pre>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex flex-col gap-2 shrink-0">
          {invoiceError && <p className="text-xs text-red-600">{invoiceError}</p>}
          {order.orderId && (
            <button
              onClick={handleDownloadInvoice}
              disabled={downloadingInvoice}
              className="w-full rounded-lg bg-brand-50 text-brand-700 text-sm font-medium py-2 hover:bg-brand-100 transition disabled:opacity-60"
            >
              {downloadingInvoice ? 'Génération...' : 'Télécharger la facture (PDF)'}
            </button>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownload}
              className="flex-1 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium py-2 hover:bg-slate-200 transition"
            >
              Télécharger
            </button>
            <button
              onClick={() => window.print()}
              className="flex-1 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium py-2 hover:bg-slate-200 transition"
            >
              Imprimer
            </button>
            {canShare && (
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex-1 rounded-lg bg-slate-100 text-slate-700 text-sm font-medium py-2 hover:bg-slate-200 transition disabled:opacity-60"
              >
                {sharing ? '...' : 'Partager'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-brand-500 text-white text-sm font-medium py-2 hover:bg-brand-600 transition"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
