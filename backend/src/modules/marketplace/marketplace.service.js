const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');

/**
 * Filtre commun à toutes les requêtes MARCHÉ (§ décidé en conversation) :
 * une boutique n'est éligible que si son plan EFFECTIF (jamais `plan_id`
 * brut) autorise `allows_marketplace` — reproduit ici la même logique
 * d'expiration que utils/planContext.js#getEffectivePlan (un plan payant
 * expiré retombe silencieusement sur le gratuit, qui n'a jamais
 * `allows_marketplace`), sans réévaluer plan par plan en boucle : une
 * boutique Premium expirée disparaît donc automatiquement de MARCHÉ, sans
 * action du Super Admin.
 */
const ELIGIBLE_STORE_CONDITION = `
  sp.allows_marketplace = TRUE
  AND (s.plan_expires_at IS NULL OR s.plan_expires_at > NOW())
`;

async function isMarketplaceEnabled() {
  const { rows } = await pool.query(
    `SELECT value FROM platform_settings WHERE key = 'marketplace_enabled'`
  );
  return rows.length > 0 ? rows[0].value : false;
}

/**
 * Grille publique (§7, niveau grille) — projection STRICTEMENT limitée :
 * jamais le propriétaire, l'adresse ou le téléphone de la boutique, qui
 * n'appartiennent qu'au détail authentifié ci-dessous. Renvoie une liste
 * vide (pas une erreur) si l'interrupteur est désactivé — défense en
 * profondeur : même un appel direct à l'API, en contournant l'interface,
 * ne doit jamais exposer de données quand la fonctionnalité est éteinte.
 */
async function listPublicProducts() {
  const enabled = await isMarketplaceEnabled();
  if (!enabled) return [];

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice",
            s.name AS "storeName"
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE p.status = 'ACTIVE' AND ${ELIGIBLE_STORE_CONDITION}
     ORDER BY p.id DESC`
  );
  return rows;
}

/**
 * Détail authentifié (§7, niveau modal) — seul endroit où les coordonnées
 * de la boutique (propriétaire, adresse, téléphone) sont exposées, et
 * uniquement pour un utilisateur authentifié (vérifié par le middleware de
 * la route, pas ici). Revérifie la MÊME éligibilité que la grille : un
 * identifiant de produit deviné ou mis en favori avant l'expiration du
 * plan de la boutique ne doit jamais fuiter après coup — 404 générique,
 * jamais de distinction entre "introuvable" et "plus éligible".
 */
async function getPublicProductDetail(productId) {
  const enabled = await isMarketplaceEnabled();
  if (!enabled) {
    throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
  }

  const productResult = await pool.query(
    `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice",
            s.id AS "storeId", s.name AS "storeName", s.address AS "storeAddress",
            s.phone AS "storePhone", u.full_name AS "ownerName"
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN subscription_plans sp ON sp.id = s.plan_id
     JOIN users u ON u.id = s.owner_id
     WHERE p.id = $1 AND p.status = 'ACTIVE' AND ${ELIGIBLE_STORE_CONDITION}`,
    [productId]
  );
  if (productResult.rows.length === 0) {
    throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
  }
  const product = productResult.rows[0];

  const tiersResult = await pool.query(
    `SELECT min_quantity AS "minQuantity", unit_price AS "unitPrice"
     FROM product_price_tiers WHERE product_id = $1 ORDER BY min_quantity ASC`,
    [productId]
  );

  return {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    sellingPrice: product.sellingPrice,
    priceTiers: tiersResult.rows,
    store: {
      id: product.storeId,
      name: product.storeName,
      ownerName: product.ownerName,
      address: product.storeAddress,
      phone: product.storePhone,
    },
  };
}

/**
 * Aperçu chiffré pour l'écran Super Admin (§ décidé en conversation, "une
 * fois qu'un nombre suffisant de boutiques Premium existe") — jamais
 * filtré par l'état de l'interrupteur lui-même (contrairement aux
 * fonctions publiques ci-dessus) : c'est justement ce qui aide le Super
 * Admin à décider QUAND l'activer.
 */
async function getMarketplaceReadiness() {
  const { rows } = await pool.query(
    `SELECT COUNT(DISTINCT s.id) AS "eligibleStores", COUNT(p.id) FILTER (WHERE p.status = 'ACTIVE') AS "eligibleProducts"
     FROM stores s
     JOIN subscription_plans sp ON sp.id = s.plan_id
     LEFT JOIN products p ON p.store_id = s.id AND p.status = 'ACTIVE'
     WHERE ${ELIGIBLE_STORE_CONDITION}`
  );
  return {
    eligibleStores: parseInt(rows[0].eligibleStores, 10),
    eligibleProducts: parseInt(rows[0].eligibleProducts, 10),
  };
}

module.exports = {
  isMarketplaceEnabled,
  listPublicProducts,
  getPublicProductDetail,
  getMarketplaceReadiness,
};
