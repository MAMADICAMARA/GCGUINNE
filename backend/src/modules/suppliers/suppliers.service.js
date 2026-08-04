const pool = require('../../config/db');
const { AppError } = require('../../middlewares/errorHandler');
const { getEffectivePlan } = require('../../utils/planContext');

/**
 * Liste les fournisseurs (boutiques tierces de la plateforme) ajoutés par
 * la boutique active — jamais ceux d'une autre boutique du même
 * utilisateur (§18_fournisseurs_inter_boutiques.sql).
 */
async function listMySuppliers(buyerStoreId) {
  const { rows } = await pool.query(
    `SELECT l.id AS "linkId", s.id AS "storeId", s.name, s.city, s.category,
            l.created_at AS "linkedAt"
     FROM store_supplier_links l
     JOIN stores s ON s.id = l.supplier_store_id
     WHERE l.buyer_store_id = $1
     ORDER BY s.name ASC`,
    [buyerStoreId]
  );
  return rows;
}

/**
 * Liste les boutiques qui ont ajouté la boutique active comme fournisseur
 * (ses "clients"). Décidé en conversation : contrairement à la
 * supervision, le fournisseur voit qui le suit, pour pouvoir retirer un
 * client précis si besoin plutôt que de devoir régénérer le code pour tout
 * le monde.
 */
async function listMyClients(supplierStoreId) {
  const { rows } = await pool.query(
    `SELECT l.id AS "linkId", s.id AS "storeId", s.name, s.city, s.category,
            l.created_at AS "linkedAt"
     FROM store_supplier_links l
     JOIN stores s ON s.id = l.buyer_store_id
     WHERE l.supplier_store_id = $1
     ORDER BY s.name ASC`,
    [supplierStoreId]
  );
  return rows;
}

/**
 * Ajoute un fournisseur via son code (jamais son ID brut — cf.
 * §18_fournisseurs_inter_boutiques.sql). Lien immédiat, sans validation du
 * fournisseur (décidé en conversation, même comportement que la
 * supervision).
 */
async function addSupplier(buyerStoreId, code) {
  if (!code || !code.trim()) {
    throw new AppError('Le code fournisseur est requis.', 400, 'VALIDATION_ERROR');
  }

  const storeResult = await pool.query(
    'SELECT id, name, city, category FROM stores WHERE supplier_code = $1',
    [code.trim().toUpperCase()]
  );
  if (storeResult.rows.length === 0) {
    throw new AppError('Code fournisseur invalide.', 404, 'INVALID_CODE');
  }
  const supplierStore = storeResult.rows[0];

  if (supplierStore.id === buyerStoreId) {
    throw new AppError('Une boutique ne peut pas être son propre fournisseur.', 400, 'SELF_LINK');
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO store_supplier_links (buyer_store_id, supplier_store_id)
       VALUES ($1, $2) RETURNING id AS "linkId", created_at AS "linkedAt"`,
      [buyerStoreId, supplierStore.id]
    );
    return {
      linkId: rows[0].linkId,
      linkedAt: rows[0].linkedAt,
      storeId: supplierStore.id,
      name: supplierStore.name,
      city: supplierStore.city,
      category: supplierStore.category,
    };
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Cette boutique est déjà dans vos fournisseurs.', 409, 'ALREADY_LINKED');
    }
    throw err;
  }
}

/**
 * Retire un fournisseur de MA liste (côté acheteur) — n'affecte pas les
 * autres boutiques qui l'auraient également ajouté.
 */
async function removeSupplier(buyerStoreId, linkId) {
  const { rowCount } = await pool.query(
    'DELETE FROM store_supplier_links WHERE id = $1 AND buyer_store_id = $2',
    [linkId, buyerStoreId]
  );
  if (rowCount === 0) {
    throw new AppError('Fournisseur introuvable.', 404, 'LINK_NOT_FOUND');
  }
  return { removed: true };
}

/**
 * Retire un client de MA liste (côté fournisseur) — coupe son accès au
 * catalogue immédiatement, sans devoir régénérer le code pour tout le
 * monde.
 */
async function removeClient(supplierStoreId, linkId) {
  const { rowCount } = await pool.query(
    'DELETE FROM store_supplier_links WHERE id = $1 AND supplier_store_id = $2',
    [linkId, supplierStoreId]
  );
  if (rowCount === 0) {
    throw new AppError('Client introuvable.', 404, 'LINK_NOT_FOUND');
  }
  return { removed: true };
}

/**
 * Vérifie qu'un lien fournisseur existe ET que le fournisseur a toujours un
 * plan qui le permet — factorisé, réutilisé par les deux lectures de
 * catalogue ci-dessous (avec et sans prix). Une boutique ne peut consulter
 * QUE ses fournisseurs déjà ajoutés, jamais une boutique arbitraire par son
 * ID. Le plan EFFECTIF du fournisseur (pas seulement celui de l'acheteur)
 * est revérifié à chaque appel, jamais mis en cache : si le fournisseur est
 * retombé en FREEMIUM, son catalogue devient inaccessible même à un
 * acheteur qui l'avait déjà ajoutée (décidé en conversation,
 * §20_plans_abonnement.sql).
 */
async function verifySupplierAccess(buyerStoreId, supplierStoreId) {
  const linkResult = await pool.query(
    'SELECT 1 FROM store_supplier_links WHERE buyer_store_id = $1 AND supplier_store_id = $2',
    [buyerStoreId, supplierStoreId]
  );
  if (linkResult.rows.length === 0) {
    throw new AppError("Cette boutique n'est pas dans vos fournisseurs.", 403, 'NOT_A_SUPPLIER');
  }

  const supplierPlan = await getEffectivePlan(supplierStoreId);
  if (!supplierPlan.allowsSuppliers) {
    throw new AppError(
      "Cette boutique n'a plus accès à la fonctionnalité Fournisseurs.",
      403,
      'SUPPLIER_PLAN_LOCKED'
    );
  }
}

/**
 * Catalogue en lecture seule d'un fournisseur lié — projection strictement
 * limitée : jamais le prix (achat ou vente) ni la quantité en stock, qui
 * appartiennent exclusivement à la boutique fournisseur (décidé en
 * conversation).
 */
async function getSupplierCatalog(buyerStoreId, supplierStoreId) {
  await verifySupplierAccess(buyerStoreId, supplierStoreId);

  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.reference, p.image_url AS "imageUrl", c.name AS "categoryName"
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.store_id = $1 AND p.status = 'ACTIVE'
     ORDER BY p.name ASC`,
    [supplierStoreId]
  );
  return rows;
}

/**
 * Variante du catalogue ci-dessus, réservée au parcours d'achat
 * (§29_commande_depuis_fournisseur_plateforme.sql, décidé en conversation) :
 * expose en plus le prix de vente du fournisseur, à titre de RÉFÉRENCE pour
 * l'acheteur qui construit sa commande (exception délibérée et limitée à ce
 * seul écran à la règle "jamais le prix" ci-dessus — jamais la quantité en
 * stock, qui reste cachée). Retourne aussi le nom de la boutique fournisseur
 * pour l'en-tête de la page (évite un aller-retour séparé).
 */
async function getSupplierCatalogForOrder(buyerStoreId, supplierStoreId) {
  await verifySupplierAccess(buyerStoreId, supplierStoreId);

  const [storeResult, productsResult] = await Promise.all([
    pool.query('SELECT name FROM stores WHERE id = $1', [supplierStoreId]),
    pool.query(
      `SELECT p.id, p.name, p.reference, p.image_url AS "imageUrl", c.name AS "categoryName",
              p.selling_price AS "sellingPrice"
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.store_id = $1 AND p.status = 'ACTIVE'
       ORDER BY p.name ASC`,
      [supplierStoreId]
    ),
  ]);

  return {
    supplierName: storeResult.rows[0]?.name || '',
    products: productsResult.rows,
  };
}

module.exports = {
  listMySuppliers,
  listMyClients,
  addSupplier,
  removeSupplier,
  removeClient,
  getSupplierCatalog,
  getSupplierCatalogForOrder,
};
