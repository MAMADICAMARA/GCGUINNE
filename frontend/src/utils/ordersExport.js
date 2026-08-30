import apiClient from '@/services/apiClient';

/**
 * Télécharge l'export comptable CSV des ventes sur une période
 * (§42_facturation_boutique.sql, décidé en conversation) — généré à la
 * volée côté serveur, même patron exact que downloadInvoicePdf
 * (utils/invoicePdf.js).
 */
export async function downloadOrdersExportCsv({ startDate, endDate } = {}) {
  let data;
  try {
    ({ data } = await apiClient.get('/orders/export', {
      params: { startDate, endDate },
      responseType: 'blob',
    }));
  } catch (err) {
    if (err.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text();
        err.response.data = JSON.parse(text);
      } catch {
        // Corps non-JSON — tant pis, l'appelant retombera sur son message générique.
      }
    }
    throw err;
  }

  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `export-ventes-${startDate || 'debut'}_${endDate || 'fin'}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
