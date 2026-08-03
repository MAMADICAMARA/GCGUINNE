/**
 * Formate un montant en Francs Guinéens.
 * Le GNF n'a pas de sous-unité utilisée en pratique — pas de décimales,
 * mais un séparateur de milliers pour rester lisible (450000 -> "450 000 GNF").
 */
export function formatGNF(amount) {
  const value = Number(amount);
  if (Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} GNF`;
}

export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR');
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR');
}