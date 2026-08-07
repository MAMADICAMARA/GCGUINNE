const dns = require('node:dns').promises;
const PDFDocument = require('pdfkit');

const COLORS = {
  blue: '#2563eb',
  dark: '#1e293b',
  gray: '#64748b',
  border: '#cbd5e1',
  tint: '#f8fafc',
  red: '#dc2626',
  white: '#ffffff',
};

const PAYMENT_METHOD_LABELS = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  CARD: 'Carte',
  OTHER: 'Autre',
};

const PAYMENT_STATUS_LABELS = {
  PAID: 'Total',
  PARTIALLY_PAID: 'Partiel',
  PENDING: 'Non payé',
};

// Formatage manuel plutôt que Intl.NumberFormat('fr-FR') : ce dernier
// insère une espace fine insécable (U+202F) comme séparateur de milliers,
// glyphe absent de l'encodage WinAnsi des polices standard de PDFKit — elle
// s'affichait comme un "/" au rendu. Une espace ASCII normale ne pose ce
// problème dans aucune police.
function formatGNF(amount) {
  const value = Math.round(Number(amount) || 0);
  const withSpaces = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${withSpaces} GNF`;
}

/**
 * Refuse de récupérer un logo hébergé sur une adresse privée/interne
 * (garde-fou SSRF) — `stores.logo_url` est un lien collé librement par le
 * Owner (cf. StoreLogoSection.jsx, "collez un lien existant"), donc jamais
 * fait confiance aveuglément : sans ce contrôle, un Owner pourrait pointer
 * son logo vers `http://169.254.169.254/...` ou une adresse `127.0.0.1`/
 * réseau interne et faire faire une requête au SERVEUR vers une cible qu'il
 * ne pourrait pas atteindre lui-même. Best-effort (résolution DNS unique,
 * pas de protection contre le DNS-rebinding), mais bloque l'attaque
 * naïve/courante sans casser le cas légitime (une vraie image publique).
 */
function isPrivateOrLoopbackAddress(address) {
  const a = address.toLowerCase();
  if (a === '::1' || a.startsWith('fe80:') || a.startsWith('fc') || a.startsWith('fd')) return true;
  const parts = a.split('.').map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a1, a2] = parts;
  return (
    a1 === 127 || // loopback
    a1 === 10 || // 10.0.0.0/8
    (a1 === 172 && a2 >= 16 && a2 <= 31) || // 172.16.0.0/12
    (a1 === 192 && a2 === 168) || // 192.168.0.0/16
    (a1 === 169 && a2 === 254) || // link-local / métadonnées cloud
    a1 === 0
  );
}

/**
 * Récupère le logo de la boutique en Buffer, pour l'intégrer dans le PDF —
 * PDFKit ne sait pas charger une image depuis une URL distante directement.
 * Ne jamais faire échouer la génération de la facture pour un logo
 * indisponible (URL cassée, R2 lent, cible bloquée...) : on retombe
 * silencieusement sur le nom de la boutique en texte (§ cahier des charges,
 * critère 4).
 */
async function fetchLogoBuffer(logoUrl) {
  if (!logoUrl) return null;
  try {
    const { hostname, protocol } = new URL(logoUrl);
    if (protocol !== 'https:' && protocol !== 'http:') return null;
    if (hostname === 'localhost') return null;

    const { address } = await dns.lookup(hostname);
    if (isPrivateOrLoopbackAddress(address)) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(logoUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/**
 * Génère la facture PDF d'une commande, façon formulaire structuré (§ cahier
 * des charges "Facture PDF", maquette validée) — à la demande, jamais mise
 * en cache ni stockée, même principe que le reçu texte existant
 * (orders.service.js#generateReceipt), qu'elle complète sans le remplacer.
 *
 * @param {import('http').ServerResponse} res - la facture est écrite
 *   directement dans la réponse HTTP (doc.pipe(res)), jamais sur disque.
 * @param {object} order - ligne `orders` (camelCase, cf. getOrderById)
 * @param {Array} items - lignes `order_items` (camelCase, cf. getOrderById)
 * @param {object} context - { store: {name, address, phone, logoUrl}, receiptSettings }
 */
async function streamInvoicePdf(res, order, items, context) {
  const { store = {}, receiptSettings = {} } = context;
  const logoBuffer = await fetchLogoBuffer(store.logoUrl);

  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 40, left: 40, right: 40 } });
  doc.pipe(res);

  const contentLeft = doc.page.margins.left;
  const contentRight = doc.page.width - doc.page.margins.right;
  const contentWidth = contentRight - contentLeft;

  // ---- En-tête : logo/nom à gauche, bandeau "FACTURE" à droite ----
  const headerTop = doc.y;
  const invoiceBoxWidth = 150;
  const invoiceBoxHeight = 40;
  const invoiceBoxX = contentRight - invoiceBoxWidth;
  const leftBlockWidth = invoiceBoxX - contentLeft - 20;

  let leftY = headerTop;
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, contentLeft, leftY, { fit: [140, 40] });
      leftY += 46;
    } catch {
      doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.dark).text(store.name || 'Boutique', contentLeft, leftY, {
        width: leftBlockWidth,
      });
      leftY = doc.y + 2;
    }
  } else {
    doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.dark).text(store.name || 'Boutique', contentLeft, leftY, {
      width: leftBlockWidth,
    });
    leftY = doc.y + 2;
  }

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray);
  if (receiptSettings.showAddress && store.address) {
    doc.text(store.address, contentLeft, leftY, { width: leftBlockWidth });
    leftY = doc.y;
  }
  if (receiptSettings.showPhone && store.phone) {
    doc.text(store.phone, contentLeft, leftY, { width: leftBlockWidth });
    leftY = doc.y;
  }

  doc.rect(invoiceBoxX, headerTop, invoiceBoxWidth, invoiceBoxHeight).fill(COLORS.blue);
  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(COLORS.white)
    .text('FACTURE', invoiceBoxX, headerTop + 13, { width: invoiceBoxWidth, align: 'center' });

  let cursorY = Math.max(leftY, headerTop + invoiceBoxHeight) + 20;

  if (receiptSettings.headerMessage) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(receiptSettings.headerMessage, contentLeft, cursorY, {
      width: contentWidth,
    });
    cursorY = doc.y + 15;
  }

  // ---- Grille de champs (3 lignes x 2 colonnes) ----
  const paymentStatusLabel = PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus;
  const paymentMethodLabel = PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod;
  const sellerDisplay = receiptSettings.showSellerName && order.sellerName ? order.sellerName : '—';

  const fieldRows = [
    ['N° DE FACTURE', order.orderNumber, "DATE D'ÉMISSION", formatDate(order.createdAt)],
    ['CLIENT', order.customerName || 'Client anonyme', 'VENDEUR', sellerDisplay],
    ['STATUT DU PAIEMENT', paymentStatusLabel, 'MODE DE PAIEMENT', paymentMethodLabel],
  ];

  const gridTop = cursorY;
  const gridRowHeight = 38;
  const gridColWidth = contentWidth / 2;
  const cellPad = 10;

  fieldRows.forEach((row, i) => {
    const rowY = gridTop + i * gridRowHeight;
    doc.rect(contentLeft, rowY, gridColWidth, gridRowHeight).fillAndStroke(COLORS.tint, COLORS.border);
    doc.rect(contentLeft + gridColWidth, rowY, gridColWidth, gridRowHeight).fillAndStroke(COLORS.tint, COLORS.border);

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(COLORS.gray)
      .text(row[0], contentLeft + cellPad, rowY + 8, { width: gridColWidth - cellPad * 2 });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.dark)
      .text(String(row[1]), contentLeft + cellPad, rowY + 19, {
        width: gridColWidth - cellPad * 2,
        height: 12,
        ellipsis: true,
      });

    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(COLORS.gray)
      .text(row[2], contentLeft + gridColWidth + cellPad, rowY + 8, { width: gridColWidth - cellPad * 2 });
    doc
      .font('Helvetica')
      .fontSize(10)
      .fillColor(COLORS.dark)
      .text(String(row[3]), contentLeft + gridColWidth + cellPad, rowY + 19, {
        width: gridColWidth - cellPad * 2,
        height: 12,
        ellipsis: true,
      });
  });

  cursorY = gridTop + fieldRows.length * gridRowHeight + 25;

  // ---- Tableau des articles ----
  const colArticleW = contentWidth * 0.46;
  const colQtyW = contentWidth * 0.14;
  const colPriceW = contentWidth * 0.2;
  const colTotalW = contentWidth - colArticleW - colQtyW - colPriceW;
  const headerRowH = 24;
  const dataRowH = 22;
  const bottomSafe = doc.page.height - doc.page.margins.bottom - 130;

  function drawTableHeader(y) {
    doc.rect(contentLeft, y, contentWidth, headerRowH).fill(COLORS.dark);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
    doc.text('Article', contentLeft + 8, y + 7, { width: colArticleW - 8 });
    doc.text('Qté', contentLeft + colArticleW, y + 7, { width: colQtyW - 8, align: 'right' });
    doc.text('Prix unit.', contentLeft + colArticleW + colQtyW, y + 7, { width: colPriceW - 8, align: 'right' });
    doc.text('Total', contentLeft + colArticleW + colQtyW + colPriceW, y + 7, { width: colTotalW - 8, align: 'right' });
    return y + headerRowH;
  }

  let tableTop = cursorY;
  let rowY = drawTableHeader(tableTop);
  let subtotal = 0;

  items.forEach((item, idx) => {
    if (rowY + dataRowH > bottomSafe) {
      doc.addPage();
      tableTop = doc.page.margins.top;
      rowY = drawTableHeader(tableTop);
    }
    const lineTotal = item.quantity * item.unitPrice;
    subtotal += lineTotal;
    const bg = idx % 2 === 0 ? COLORS.white : COLORS.tint;
    doc.rect(contentLeft, rowY, contentWidth, dataRowH).fillAndStroke(bg, COLORS.border);
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.dark);
    doc.text(item.productName, contentLeft + 8, rowY + 6, {
      width: colArticleW - 8,
      height: 12,
      ellipsis: true,
    });
    doc.text(String(item.quantity), contentLeft + colArticleW, rowY + 6, { width: colQtyW - 8, align: 'right' });
    doc.text(formatGNF(item.unitPrice), contentLeft + colArticleW + colQtyW, rowY + 6, {
      width: colPriceW - 8,
      align: 'right',
    });
    doc.text(formatGNF(lineTotal), contentLeft + colArticleW + colQtyW + colPriceW, rowY + 6, {
      width: colTotalW - 8,
      align: 'right',
    });
    rowY += dataRowH;
  });

  cursorY = rowY + 20;

  // ---- Bloc de totaux (aligné à droite, largeur réduite) ----
  const totalsWidth = 220;
  const totalsX = contentRight - totalsWidth;
  let totalsY = cursorY;

  function totalsLine(label, value, color) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.gray).text(label, totalsX, totalsY, { width: totalsWidth * 0.5 });
    doc
      .font('Helvetica-Bold')
      .fontSize(9)
      .fillColor(color || COLORS.dark)
      .text(value, totalsX + totalsWidth * 0.5, totalsY, { width: totalsWidth * 0.5, align: 'right' });
    totalsY += 16;
    doc
      .moveTo(totalsX, totalsY - 3)
      .lineTo(totalsX + totalsWidth, totalsY - 3)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    totalsY += 4;
  }

  totalsLine('Sous-total', formatGNF(subtotal));
  if (order.discountAmount > 0) totalsLine('Réduction', `- ${formatGNF(order.discountAmount)}`);
  if (order.taxAmount > 0) totalsLine('Taxes', `+ ${formatGNF(order.taxAmount)}`);

  const remaining = order.totalAmount - order.amountPaid;
  const isPartial = remaining > 0.01;
  if (isPartial) {
    totalsLine('Montant payé', formatGNF(order.amountPaid));
    totalsLine('RESTE À PAYER', formatGNF(remaining), COLORS.red);
  }

  const totalBandH = 30;
  doc.rect(totalsX, totalsY, totalsWidth, totalBandH).fill(COLORS.blue);
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.white)
    .text('TOTAL', totalsX + 10, totalsY + 9, { width: totalsWidth * 0.5 - 10 });
  doc.text(formatGNF(order.totalAmount), totalsX + totalsWidth * 0.5, totalsY + 9, {
    width: totalsWidth * 0.5 - 10,
    align: 'right',
  });

  cursorY = totalsY + totalBandH + 40;

  // ---- Pied de page ----
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor(COLORS.gray)
    .text(receiptSettings.footerMessage, contentLeft, cursorY, { width: contentWidth, align: 'center' });

  doc.end();
}

function formatDate(value) {
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

module.exports = { streamInvoicePdf };
