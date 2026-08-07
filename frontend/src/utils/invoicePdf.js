import apiClient from '@/services/apiClient';

/**
 * Télécharge la facture PDF d'une commande (§ cahier des charges "Facture
 * PDF") — générée à la volée côté serveur (PDFKit), jamais mise en cache.
 * Distincte du reçu texte existant (utils/receiptPdf.js, généré côté
 * client) : les deux coexistent, aucun des deux ne remplace l'autre.
 */
export async function downloadInvoicePdf(orderId, orderNumber) {
  let data;
  try {
    ({ data } = await apiClient.get(`/orders/${orderId}/invoice-pdf`, { responseType: 'blob' }));
  } catch (err) {
    // Avec responseType: 'blob', un corps d'erreur JSON arrive lui aussi
    // sous forme de Blob — err.response.data.error.message est donc
    // toujours undefined tel quel. On le relit en texte pour remonter le
    // vrai message serveur plutôt qu'une erreur générique.
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        const parsed = JSON.parse(text);
        err.response.data = parsed;
      } catch {
        // Corps non-JSON (ex: timeout réseau) — tant pis, l'appelant
        // retombera sur son message générique par défaut.
      }
    }
    throw err;
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `facture-${orderNumber}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
