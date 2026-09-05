// Miroir client-side de getEffectivePricePerMonth (admin.service.js) — sert
// uniquement à l'aperçu affiché avant soumission (§51_paliers_duree_abonnement.sql,
// décidé en conversation) ; le serveur reste seul décisionnaire du montant
// réel à la confirmation du paiement.

/**
 * Prix par mois pour une durée donnée, selon les paliers du plan (triés par
 * durée minimum croissante, comme renvoyés par le backend).
 */
export function getEffectivePricePerMonth(basePrice, durationTiers, months) {
  if (!durationTiers || durationTiers.length === 0) return basePrice;
  let applicable = basePrice;
  for (const tier of durationTiers) {
    if (months >= tier.minMonths) {
      applicable = tier.unitPrice;
    }
  }
  return applicable;
}

/**
 * Options de durée sélectionnables pour un plan : toujours "1 mois" (le
 * tarif de base), puis une option par palier configuré — jamais de durée
 * arbitraire, pour rester sur les grandes cartes de choix "1 décision, 1
 * geste" plutôt qu'un champ libre à calculer soi-même.
 */
export function getDurationOptions(plan) {
  const months = [1, ...(plan.durationTiers || []).map((t) => t.minMonths)];
  return months.map((m) => {
    const pricePerMonth = getEffectivePricePerMonth(plan.price, plan.durationTiers, m);
    const totalPrice = m * pricePerMonth;
    const savingsPercent = plan.price > 0 ? Math.round((1 - pricePerMonth / plan.price) * 100) : 0;
    return { months: m, pricePerMonth, totalPrice, savingsPercent };
  });
}
