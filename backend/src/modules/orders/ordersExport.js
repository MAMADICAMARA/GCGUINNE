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

// Même mapping exact que OrderDetailModal.jsx/SalesHistoryPage.jsx —
// orders.status (§03_clients_et_ventes.sql) ne vaut jamais "COMPLETED".
const STATUS_LABELS = {
  PAID: 'Payée',
  RETURNED: 'Retournée',
  PARTIALLY_RETURNED: 'Partiellement retournée',
  VOIDED: 'Annulée',
};

const COLUMNS = [
  'Numéro',
  'N° Facture',
  'Date',
  'Client',
  'Vendeur',
  'Statut',
  'Mode de paiement',
  'Statut du paiement',
  'Réduction (GNF)',
  'Taxe (GNF)',
  'Total (GNF)',
  'Payé (GNF)',
  'Reste à payer (GNF)',
];

// Caractères qui déclenchent l'interprétation d'une cellule comme formule
// à l'ouverture dans Excel/LibreOffice (§ audit du 2026-08-30, décidé en
// conversation — faille "injection de formule CSV/Excel", MAJEUR).
const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@', '\t', '\r']);

/**
 * Une cellule contenant une virgule, un guillemet ou un retour à la ligne
 * doit être entourée de guillemets (avec les guillemets internes doublés) —
 * format CSV standard (RFC 4180), sinon Excel/LibreOffice découpe la ligne
 * au mauvais endroit.
 *
 * Neutralise AUSSI l'injection de formule CSV/Excel : `order.customerName`
 * et `order.sellerName` sont saisis librement à la création d'un
 * client/employé — un nom commençant par =, +, -, @ (ou tabulation/retour
 * chariot) s'exécuterait comme une formule au moment où le Owner ouvre
 * l'export dans Excel/LibreOffice (ex: `=HYPERLINK("http://...")`), risque
 * réel d'exfiltration/exécution de commande sur le poste du marchand.
 * Mitigation standard OWASP : préfixer d'une apostrophe, qui force Excel à
 * afficher la valeur comme texte brut plutôt que de l'évaluer — appliquée
 * AVANT le test de guillemets ci-dessous, pour que le résultat final reste
 * un CSV valide même après ce préfixe.
 */
function csvCell(value) {
  const str = value === null || value === undefined ? '' : String(value);
  const neutralized = str.length > 0 && FORMULA_TRIGGER_CHARS.has(str[0]) ? `'${str}` : str;
  if (/[",\n]/.test(neutralized)) {
    return `"${neutralized.replace(/"/g, '""')}"`;
  }
  return neutralized;
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

function formatAmount(value) {
  return Math.round(Number(value) || 0).toString();
}

/**
 * Export comptable CSV (§42_facturation_boutique.sql, décidé en
 * conversation) — une ligne par vente, généré à la volée comme la Facture
 * PDF (jamais stocké). Le BOM UTF-8 en tête (﻿) est nécessaire pour
 * qu'Excel affiche correctement les accents français à l'ouverture directe
 * du fichier (sans lui, Excel suppose du Windows-1252 par défaut).
 */
function buildOrdersExportCsv(orders) {
  const lines = [COLUMNS.map(csvCell).join(',')];
  for (const order of orders) {
    const remaining = order.totalAmount - order.amountPaid;
    lines.push(
      [
        order.orderNumber,
        order.invoiceNumber || '',
        formatDate(order.createdAt),
        order.customerName || 'Client anonyme',
        order.sellerName || '—',
        STATUS_LABELS[order.status] || order.status,
        PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod,
        PAYMENT_STATUS_LABELS[order.paymentStatus] || order.paymentStatus,
        formatAmount(order.discountAmount),
        formatAmount(order.taxAmount),
        formatAmount(order.totalAmount),
        formatAmount(order.amountPaid),
        formatAmount(remaining > 0.01 ? remaining : 0),
      ]
        .map(csvCell)
        .join(',')
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

module.exports = { buildOrdersExportCsv };
