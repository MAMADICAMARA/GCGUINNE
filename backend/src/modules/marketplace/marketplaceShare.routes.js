const { Router } = require('express');
const env = require('../../config/env');
const marketplaceService = require('./marketplace.service');

const router = Router();

/**
 * Aperçu de partage MARCHÉ (§ partage sur les réseaux sociaux, décidé en
 * conversation) — monté HORS du préfixe /api/v1 (voir app.js), sur le
 * DOMAINE DU BACKEND, pour que ce module contrôle entièrement le HTML
 * renvoyé : le frontend (SPA Vite pure, aucun rendu serveur) ne peut pas,
 * lui, produire de balises Open Graph dynamiques pour les robots
 * WhatsApp/Facebook/Twitter/etc. C'est CE lien (pas celui du frontend)
 * qu'il faut copier/partager.
 *
 * Comportement :
 * - Robot de réseau social détecté par User-Agent -> petit HTML avec les
 *   balises Open Graph déjà remplies (titre, image, prix), jamais de
 *   redirection JS (les robots ne l'exécutent pas).
 * - Visiteur humain -> redirection 302 immédiate vers la vraie page de la
 *   SPA (FRONTEND_URL), qui a tout le confort interactif habituel.
 *
 * Revérifie la MÊME éligibilité que le reste de MARCHÉ (activé, boutique
 * éligible, produit actif, image présente) via getPublicProductDetail —
 * jamais dupliquée ici : un produit qui redevient inéligible après avoir
 * été partagé doit afficher un aperçu générique "introuvable", jamais une
 * vieille donnée périmée.
 */
const BOT_USER_AGENT_PATTERN =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|TelegramBot|Slackbot|LinkedInBot|Discordbot|Pinterest|redditbot|Googlebot|bingbot|Applebot|SkypeUriPreview|Snapchat/i;

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]
  ));
}

function formatGNF(amount) {
  return `${Number(amount).toLocaleString('fr-FR')} GNF`;
}

router.get('/produits/:id', async (req, res, next) => {
  try {
    const targetUrl = `${env.frontendUrl}/marche/produits/${encodeURIComponent(req.params.id)}`;
    const isBot = BOT_USER_AGENT_PATTERN.test(req.get('User-Agent') || '');

    if (!isBot) {
      return res.redirect(302, targetUrl);
    }

    let product = null;
    try {
      product = await marketplaceService.getPublicProductDetail(req.params.id);
    } catch (err) {
      // Produit introuvable / plus éligible — aperçu générique ci-dessous,
      // jamais une erreur : un robot ne doit jamais recevoir un 500 pour un
      // simple lien périmé.
    }

    const title = product
      ? `${product.name} — ${product.store.name}`
      : 'Produit introuvable — Marché Gestion Commerciale';
    const description = product
      ? `${formatGNF(product.sellingPrice)} — en vente chez ${product.store.name} sur le Marché Gestion Commerciale.`
      : "Ce produit n'est plus disponible sur le Marché.";
    // `data:` URI possible côté "coller un lien" (repli sans R2 configuré,
    // cf. .env.example) — jamais utilisable comme og:image, les robots des
    // réseaux sociaux doivent pouvoir la RÉCUPÉRER par HTTP, pas la lire
    // inline. Mieux vaut aucune vignette qu'une balise que personne ne
    // pourra jamais charger.
    const imageTag = product?.imageUrl && !product.imageUrl.startsWith('data:')
      ? `<meta property="og:image" content="${escapeHtml(product.imageUrl)}">`
      : '';

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta property="og:type" content="product">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(targetUrl)}">
${imageTag}
<meta name="twitter:card" content="summary_large_image">
</head>
<body>
<p><a href="${escapeHtml(targetUrl)}">${escapeHtml(title)}</a></p>
</body>
</html>`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
