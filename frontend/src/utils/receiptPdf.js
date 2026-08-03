import jsPDF from 'jspdf';
import { formatGNF, formatDateTime } from '@/utils/format';

const DEFAULT_RECEIPT_SETTINGS = {
  headerMessage: '',
  footerMessage: 'Merci de votre visite !',
  showAddress: false,
  showPhone: false,
  showSellerName: false,
};

/**
 * Construit le PDF du reçu de vente — format ticket 80mm (largeur d'un
 * rouleau de caisse thermique standard), hauteur calculée dynamiquement
 * selon le nombre d'articles. Factorisé pour être réutilisé à la fois par
 * le téléchargement et le partage natif (§ décidé en conversation).
 *
 * Applique les mêmes réglages de personnalisation que le reçu texte généré
 * côté serveur (§23_personnalisation_recu.sql) — en-tête/pied de page,
 * afficher/masquer adresse/téléphone/vendeur — pour que PDF et texte
 * restent toujours cohérents entre eux.
 */
function buildReceiptDoc(order) {
  const {
    storeName,
    storeAddress,
    storePhone,
    sellerName,
    orderNumber,
    createdAt,
    items,
    totalAmount,
    discountAmount = 0,
    taxAmount = 0,
    amountPaid,
    customerName,
    receiptSettings = {},
  } = order;
  const settings = { ...DEFAULT_RECEIPT_SETTINGS, ...receiptSettings };

  const width = 80;
  const marginX = 6;
  const lineHeight = 5;
  const estimatedLines = 16 + items.length * 2 + 8;
  const height = Math.max(120, estimatedLines * lineHeight);

  const doc = new jsPDF({ unit: 'mm', format: [width, height] });
  let y = 10;

  doc.setFont('courier', 'bold');
  doc.setFontSize(12);
  doc.text(storeName || 'Boutique', width / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.setFont('courier', 'normal');
  if (settings.showAddress && storeAddress) {
    doc.text(storeAddress, width / 2, y, { align: 'center' });
    y += lineHeight;
  }
  if (settings.showPhone && storePhone) {
    doc.text(storePhone, width / 2, y, { align: 'center' });
    y += lineHeight;
  }
  if (settings.headerMessage) {
    doc.text(settings.headerMessage, width / 2, y, { align: 'center' });
    y += lineHeight;
  }

  doc.text('REÇU DE VENTE', width / 2, y, { align: 'center' });
  y += 6;

  doc.text(`Commande : ${orderNumber}`, marginX, y);
  y += lineHeight;
  doc.text(`Date : ${formatDateTime(createdAt)}`, marginX, y);
  y += lineHeight;
  if (customerName) {
    doc.text(`Client : ${customerName}`, marginX, y);
    y += lineHeight;
  }
  if (settings.showSellerName && sellerName) {
    doc.text(`Vendeur : ${sellerName}`, marginX, y);
    y += lineHeight;
  }

  y += 1;
  doc.line(marginX, y, width - marginX, y);
  y += 5;

  for (const item of items) {
    doc.text(item.productName.slice(0, 28), marginX, y);
    y += 4.5;
    const lineTotal = item.quantity * item.unitPrice;
    doc.text(`  ${item.quantity} x ${formatGNF(item.unitPrice)} = ${formatGNF(lineTotal)}`, marginX, y);
    y += lineHeight;
  }

  doc.line(marginX, y, width - marginX, y);
  y += 5;

  if (discountAmount > 0) {
    doc.text(`Réduction : -${formatGNF(discountAmount)}`, marginX, y);
    y += lineHeight;
  }
  if (taxAmount > 0) {
    doc.text(`Taxe : +${formatGNF(taxAmount)}`, marginX, y);
    y += lineHeight;
  }

  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text(`TOTAL : ${formatGNF(totalAmount)}`, marginX, y);
  y += 7;
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);

  const remaining = totalAmount - (amountPaid ?? totalAmount);
  if (remaining > 0) {
    doc.text(`Payé : ${formatGNF(amountPaid)}`, marginX, y);
    y += lineHeight;
    doc.setFont('courier', 'bold');
    doc.text(`RESTE À PAYER : ${formatGNF(remaining)}`, marginX, y);
    y += 7;
    doc.setFont('courier', 'normal');
  }

  y += 3;
  doc.text(settings.footerMessage || 'Merci de votre visite !', width / 2, y, { align: 'center' });

  return doc;
}

export function downloadReceiptPdf(order) {
  buildReceiptDoc(order).save(`recu-${order.orderNumber}.pdf`);
}

/**
 * Fichier PDF prêt à être partagé via l'API Web Share (§ décidé en
 * conversation) — même document que le téléchargement, juste encapsulé en
 * `File` pour être passé à `navigator.share({ files: [...] })`.
 */
export function getReceiptPdfFile(order) {
  const blob = buildReceiptDoc(order).output('blob');
  return new File([blob], `recu-${order.orderNumber}.pdf`, { type: 'application/pdf' });
}
