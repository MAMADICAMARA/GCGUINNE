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
 *
 * `s.status = 'ACTIVE'` (faille signalée, décidé en conversation) : une
 * boutique SUSPENDUE par le Super Admin restait visible sur la vitrine
 * publique jusqu'ici, aucune requête MARCHÉ ne vérifiait ce statut —
 * corrigé ici une seule fois puisque toutes les requêtes MARCHÉ réutilisent
 * cette même condition. `TRIAL` n'est en pratique jamais attribué nulle
 * part dans le code (valeur historique de la contrainte, jamais utilisée) —
 * volontairement exclu par une liste blanche (`= 'ACTIVE'`) plutôt qu'un
 * `!= 'SUSPENDED'`, pour ne jamais exposer un futur statut par défaut.
 */
const ELIGIBLE_STORE_CONDITION = `
  sp.allows_marketplace = TRUE
  AND s.status = 'ACTIVE'
  AND (s.plan_expires_at IS NULL OR s.plan_expires_at > NOW())
`;

// Un produit sans image n'a rien à faire sur une vitrine PUBLIQUE pensée
// pour être partagée sur les réseaux sociaux (§ décidé en conversation) —
// appliqué aux deux niveaux (grille ET détail) pour qu'un lien copié avant
// ce changement, ou deviné, ne fasse jamais fuiter un produit qui ne
// devrait plus apparaître nulle part.
const HAS_IMAGE_CONDITION = 'p.image_url IS NOT NULL';

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
 *
 * `search` (§ barre de recherche, décidé en conversation, partagée entre
 * /marche et l'Accueil connecté puisque toutes deux rendent ce même
 * composant) : filtre optionnel sur le NOM du produit ou sa RÉFÉRENCE,
 * insensible à la casse (ILIKE). `products.reference` n'était jusqu'ici
 * jamais sélectionné par MARCHÉ (pas affiché dans la grille) — utilisé
 * ici uniquement pour filtrer, jamais renvoyé dans la réponse, pour ne
 * rien changer à la projection publique existante. Une chaîne vide ou
 * absente désactive simplement le filtre (comportement identique à avant
 * cet ajout).
 */
async function listPublicProducts(search = '') {
  const enabled = await isMarketplaceEnabled();
  if (!enabled) return [];

  const trimmedSearch = (search || '').trim();
  const params = [];
  let searchCondition = '';

  if (trimmedSearch) {
    params.push(`%${trimmedSearch}%`);
    searchCondition = `AND (p.name ILIKE $${params.length} OR p.reference ILIKE $${params.length})`;
  }

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice",
            s.name AS "storeName"
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN subscription_plans sp ON sp.id = s.plan_id
     WHERE p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
       ${searchCondition}
     ORDER BY p.id DESC`,
    params
  );
  return rows;
}

/**
 * Détail PUBLIC (§7, niveau page produit) — accessible sans connexion (§
 * partage MARCHÉ sur les réseaux sociaux, décidé en conversation) : un
 * lien produit copié/partagé doit s'ouvrir pour n'importe quel visiteur,
 * jamais rediriger vers /login. Revérifie la MÊME éligibilité que la
 * grille : un identifiant de produit deviné ou partagé avant l'expiration
 * du plan de la boutique, ou avant la suppression de son image, ne doit
 * jamais fuiter après coup — 404 générique, jamais de distinction entre
 * "introuvable" et "plus éligible".
 *
 * `isAuthenticated` (§ décidé en conversation) : le NOM de la boutique
 * reste toujours visible (déjà affiché dans la grille, sans lui "Vendu
 * par" n'a aucun sens), mais ses coordonnées de contact — propriétaire,
 * adresse, téléphone, et donc les boutons Appeler/WhatsApp qui en
 * dépendent côté frontend — restent réservées à un visiteur connecté.
 * Jamais l'inverse : sans authentifiant valide (optionalAuth côté route),
 * `isAuthenticated` est toujours `false`, jamais fait confiance à autre
 * chose qu'un jeton réellement vérifié.
 */
async function getPublicProductDetail(productId, isAuthenticated = false) {
  const enabled = await isMarketplaceEnabled();
  if (!enabled) {
    throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
  }

  const productResult = await pool.query(
    `SELECT p.id, p.name, p.description, p.attributes, p.image_url AS "imageUrl",
            p.selling_price AS "sellingPrice", c.name AS "categoryName",
            s.id AS "storeId", s.name AS "storeName", s.address AS "storeAddress",
            s.phone AS "storePhone", u.full_name AS "ownerName"
     FROM products p
     JOIN stores s ON s.id = p.store_id
     JOIN subscription_plans sp ON sp.id = s.plan_id
     JOIN users u ON u.id = s.owner_id
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}`,
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

  const relatedProducts = await getRelatedProducts(product.id, product.categoryName);

  return {
    id: product.id,
    name: product.name,
    description: product.description,
    attributes: product.attributes || {},
    imageUrl: product.imageUrl,
    sellingPrice: product.sellingPrice,
    priceTiers: tiersResult.rows,
    store: {
      id: product.storeId,
      name: product.storeName,
      ownerName: isAuthenticated ? product.ownerName : null,
      address: isAuthenticated ? product.storeAddress : null,
      phone: isAuthenticated ? product.storePhone : null,
    },
    relatedProducts,
  };
}

/**
 * Suggestions "vous pourriez aussi aimer" (§ comportement AliExpress/
 * Alibaba, décidé en conversation) — d'abord la MÊME catégorie (comparée
 * par NOM, jamais par category_id brut : les catégories sont propres à
 * chaque boutique, seul le nom est partagé entre boutiques d'un même type,
 * même principe exact que stockTransfers.service.js), puis complété par
 * n'importe quel autre produit éligible si la première catégorie n'en
 * fournit pas assez. Revérifie la MÊME éligibilité que le reste de MARCHÉ
 * (activé, boutique éligible, produit actif, image présente).
 */
async function getRelatedProducts(productId, categoryName, limit = 10) {
  const related = [];

  if (categoryName) {
    const sameCategory = await pool.query(
      `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice", s.name AS "storeName"
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN subscription_plans sp ON sp.id = s.plan_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id != $1 AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
         AND c.name = $2
       ORDER BY p.id DESC
       LIMIT $3`,
      [productId, categoryName, limit]
    );
    related.push(...sameCategory.rows);
  }

  if (related.length < limit) {
    const excludeIds = [productId, ...related.map((r) => r.id)];
    const others = await pool.query(
      `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice", s.name AS "storeName"
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN subscription_plans sp ON sp.id = s.plan_id
       WHERE NOT (p.id = ANY($1::int[])) AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
       ORDER BY p.id DESC
       LIMIT $2`,
      [excludeIds, limit - related.length]
    );
    related.push(...others.rows);
  }

  return related;
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
    `SELECT COUNT(DISTINCT s.id) AS "eligibleStores",
            COUNT(p.id) FILTER (WHERE p.status = 'ACTIVE' AND p.image_url IS NOT NULL) AS "eligibleProducts"
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


// const pool = require('../../config/db');
// const { AppError } = require('../../middlewares/errorHandler');

// /**
//  * Filtre commun à toutes les requêtes MARCHÉ (§ décidé en conversation) :
//  * une boutique n'est éligible que si son plan EFFECTIF (jamais `plan_id`
//  * brut) autorise `allows_marketplace` — reproduit ici la même logique
//  * d'expiration que utils/planContext.js#getEffectivePlan (un plan payant
//  * expiré retombe silencieusement sur le gratuit, qui n'a jamais
//  * `allows_marketplace`), sans réévaluer plan par plan en boucle : une
//  * boutique Premium expirée disparaît donc automatiquement de MARCHÉ, sans
//  * action du Super Admin.
//  */
// const ELIGIBLE_STORE_CONDITION = `
//   sp.allows_marketplace = TRUE
//   AND (s.plan_expires_at IS NULL OR s.plan_expires_at > NOW())
// `;

// // Un produit sans image n'a rien à faire sur une vitrine PUBLIQUE pensée
// // pour être partagée sur les réseaux sociaux (§ décidé en conversation) —
// // appliqué aux deux niveaux (grille ET détail) pour qu'un lien copié avant
// // ce changement, ou deviné, ne fasse jamais fuiter un produit qui ne
// // devrait plus apparaître nulle part.
// const HAS_IMAGE_CONDITION = 'p.image_url IS NOT NULL';

// async function isMarketplaceEnabled() {
//   const { rows } = await pool.query(
//     `SELECT value FROM platform_settings WHERE key = 'marketplace_enabled'`
//   );
//   return rows.length > 0 ? rows[0].value : false;
// }

// /**
//  * Grille publique (§7, niveau grille) — projection STRICTEMENT limitée :
//  * jamais le propriétaire, l'adresse ou le téléphone de la boutique, qui
//  * n'appartiennent qu'au détail authentifié ci-dessous. Renvoie une liste
//  * vide (pas une erreur) si l'interrupteur est désactivé — défense en
//  * profondeur : même un appel direct à l'API, en contournant l'interface,
//  * ne doit jamais exposer de données quand la fonctionnalité est éteinte.
//  */
// async function listPublicProducts() {
//   const enabled = await isMarketplaceEnabled();
//   if (!enabled) return [];

//   const { rows } = await pool.query(
//     `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice",
//             s.name AS "storeName"
//      FROM products p
//      JOIN stores s ON s.id = p.store_id
//      JOIN subscription_plans sp ON sp.id = s.plan_id
//      WHERE p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
//      ORDER BY p.id DESC`
//   );
//   return rows;
// }

// /**
//  * Détail PUBLIC (§7, niveau page produit) — accessible sans connexion (§
//  * partage MARCHÉ sur les réseaux sociaux, décidé en conversation) : un
//  * lien produit copié/partagé doit s'ouvrir pour n'importe quel visiteur,
//  * jamais rediriger vers /login. Revérifie la MÊME éligibilité que la
//  * grille : un identifiant de produit deviné ou partagé avant l'expiration
//  * du plan de la boutique, ou avant la suppression de son image, ne doit
//  * jamais fuiter après coup — 404 générique, jamais de distinction entre
//  * "introuvable" et "plus éligible".
//  *
//  * `isAuthenticated` (§ décidé en conversation) : le NOM de la boutique
//  * reste toujours visible (déjà affiché dans la grille, sans lui "Vendu
//  * par" n'a aucun sens), mais ses coordonnées de contact — propriétaire,
//  * adresse, téléphone, et donc les boutons Appeler/WhatsApp qui en
//  * dépendent côté frontend — restent réservées à un visiteur connecté.
//  * Jamais l'inverse : sans authentifiant valide (optionalAuth côté route),
//  * `isAuthenticated` est toujours `false`, jamais fait confiance à autre
//  * chose qu'un jeton réellement vérifié.
//  */
// async function getPublicProductDetail(productId, isAuthenticated = false) {
//   const enabled = await isMarketplaceEnabled();
//   if (!enabled) {
//     throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
//   }

//   const productResult = await pool.query(
//     `SELECT p.id, p.name, p.description, p.attributes, p.image_url AS "imageUrl",
//             p.selling_price AS "sellingPrice", c.name AS "categoryName",
//             s.id AS "storeId", s.name AS "storeName", s.address AS "storeAddress",
//             s.phone AS "storePhone", u.full_name AS "ownerName"
//      FROM products p
//      JOIN stores s ON s.id = p.store_id
//      JOIN subscription_plans sp ON sp.id = s.plan_id
//      JOIN users u ON u.id = s.owner_id
//      LEFT JOIN categories c ON c.id = p.category_id
//      WHERE p.id = $1 AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}`,
//     [productId]
//   );
//   if (productResult.rows.length === 0) {
//     throw new AppError('Produit introuvable.', 404, 'PRODUCT_NOT_FOUND');
//   }
//   const product = productResult.rows[0];

//   const tiersResult = await pool.query(
//     `SELECT min_quantity AS "minQuantity", unit_price AS "unitPrice"
//      FROM product_price_tiers WHERE product_id = $1 ORDER BY min_quantity ASC`,
//     [productId]
//   );

//   const relatedProducts = await getRelatedProducts(product.id, product.categoryName);

//   return {
//     id: product.id,
//     name: product.name,
//     description: product.description,
//     attributes: product.attributes || {},
//     imageUrl: product.imageUrl,
//     sellingPrice: product.sellingPrice,
//     priceTiers: tiersResult.rows,
//     store: {
//       id: product.storeId,
//       name: product.storeName,
//       ownerName: isAuthenticated ? product.ownerName : null,
//       address: isAuthenticated ? product.storeAddress : null,
//       phone: isAuthenticated ? product.storePhone : null,
//     },
//     relatedProducts,
//   };
// }

// /**
//  * Suggestions "vous pourriez aussi aimer" (§ comportement AliExpress/
//  * Alibaba, décidé en conversation) — d'abord la MÊME catégorie (comparée
//  * par NOM, jamais par category_id brut : les catégories sont propres à
//  * chaque boutique, seul le nom est partagé entre boutiques d'un même type,
//  * même principe exact que stockTransfers.service.js), puis complété par
//  * n'importe quel autre produit éligible si la première catégorie n'en
//  * fournit pas assez. Revérifie la MÊME éligibilité que le reste de MARCHÉ
//  * (activé, boutique éligible, produit actif, image présente).
//  */
// async function getRelatedProducts(productId, categoryName, limit = 10) {
//   const related = [];

//   if (categoryName) {
//     const sameCategory = await pool.query(
//       `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice", s.name AS "storeName"
//        FROM products p
//        JOIN stores s ON s.id = p.store_id
//        JOIN subscription_plans sp ON sp.id = s.plan_id
//        LEFT JOIN categories c ON c.id = p.category_id
//        WHERE p.id != $1 AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
//          AND c.name = $2
//        ORDER BY p.id DESC
//        LIMIT $3`,
//       [productId, categoryName, limit]
//     );
//     related.push(...sameCategory.rows);
//   }

//   if (related.length < limit) {
//     const excludeIds = [productId, ...related.map((r) => r.id)];
//     const others = await pool.query(
//       `SELECT p.id, p.name, p.image_url AS "imageUrl", p.selling_price AS "sellingPrice", s.name AS "storeName"
//        FROM products p
//        JOIN stores s ON s.id = p.store_id
//        JOIN subscription_plans sp ON sp.id = s.plan_id
//        WHERE NOT (p.id = ANY($1::int[])) AND p.status = 'ACTIVE' AND ${HAS_IMAGE_CONDITION} AND ${ELIGIBLE_STORE_CONDITION}
//        ORDER BY p.id DESC
//        LIMIT $2`,
//       [excludeIds, limit - related.length]
//     );
//     related.push(...others.rows);
//   }

//   return related;
// }

// /**
//  * Aperçu chiffré pour l'écran Super Admin (§ décidé en conversation, "une
//  * fois qu'un nombre suffisant de boutiques Premium existe") — jamais
//  * filtré par l'état de l'interrupteur lui-même (contrairement aux
//  * fonctions publiques ci-dessus) : c'est justement ce qui aide le Super
//  * Admin à décider QUAND l'activer.
//  */
// async function getMarketplaceReadiness() {
//   const { rows } = await pool.query(
//     `SELECT COUNT(DISTINCT s.id) AS "eligibleStores",
//             COUNT(p.id) FILTER (WHERE p.status = 'ACTIVE' AND p.image_url IS NOT NULL) AS "eligibleProducts"
//      FROM stores s
//      JOIN subscription_plans sp ON sp.id = s.plan_id
//      LEFT JOIN products p ON p.store_id = s.id AND p.status = 'ACTIVE'
//      WHERE ${ELIGIBLE_STORE_CONDITION}`
//   );
//   return {
//     eligibleStores: parseInt(rows[0].eligibleStores, 10),
//     eligibleProducts: parseInt(rows[0].eligibleProducts, 10),
//   };
// }

// module.exports = {
//   isMarketplaceEnabled,
//   listPublicProducts,
//   getPublicProductDetail,
//   getMarketplaceReadiness,
// };
