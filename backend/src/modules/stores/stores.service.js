const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../../config/db');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/errorHandler');
const { getEffectivePlan } = require('../../utils/planContext');
const { findConflictingOccupation } = require('../../utils/userOccupancy');

function signToken(payload) {
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

/**
 * Génère un code de partage non-devinable (alphabet sans caractères
 * ambigus 0/O/1/I/L). Jamais l'identifiant numérique séquentiel de la
 * boutique — cf. §12_supervision.sql : un identifiant brut serait
 * énumérable et donc une fuite de données pour toute la plateforme.
 * Utilisé à la fois pour le code de supervision et le code fournisseur
 * (§18_fournisseurs_inter_boutiques.sql) — deux colonnes distinctes, même
 * mécanisme de génération.
 */
function generateShareCode(length = 12) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

function generateSupervisionCode() {
  return generateShareCode(12);
}

function generateSupplierCode() {
  return generateShareCode(12);
}

function generateTransferCode() {
  return generateShareCode(12);
}

/**
 * Liste les boutiques auxquelles un utilisateur est rattaché, avec son rôle
 * dans chacune. Toujours interrogée en base (jamais lue depuis un token
 * potentiellement périmé) — cf. §6.1/§6.2 du cahier des charges.
 */
async function listMyStores(userId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.name, s.category, s.country, s.region, s.city, s.address, s.status,
            s.logo_url AS "logoUrl", s.default_tax_percent AS "defaultTaxPercent",
            r.code AS "roleCode", us.is_default_store AS "isDefaultStore"
     FROM user_store us
     JOIN stores s ON s.id = us.store_id
     JOIN roles r  ON r.id = us.role_id
     WHERE us.user_id = $1
     ORDER BY us.is_default_store DESC, s.name ASC`,
    [userId]
  );
  return rows;
}

/**
 * Création d'une boutique (§4.2 du cahier des charges), déclenchée depuis
 * l'espace "Ma Boutique" — volontairement découplée de l'inscription du
 * compte (§4.1). Le créateur devient automatiquement Owner de la nouvelle
 * boutique. Transaction atomique : boutique + rattachement + audit, ou rien.
 *
 * `is_default_store` n'est posé à TRUE que si l'utilisateur n'a encore
 * aucune boutique par défaut (cf. contrainte uq_user_store_one_default) —
 * la toute première boutique créée devient la boutique par défaut, les
 * suivantes ne le sont pas automatiquement.
 */
async function createStore(
  userId,
  { name, storeTypeId, country, region, city, address, phone, email }
) {
  if (!name || !name.trim()) {
    throw new AppError('Le nom de la boutique est requis.', 400, 'VALIDATION_ERROR');
  } else if ((!phone || !phone.trim())){
    throw new AppError('le numero de la boutique est obligatoir.', 400, 'VALIDATION_ERROR');
  } else if (!storeTypeId) {
    throw new AppError('Le type de boutique est requis.', 400, 'VALIDATION_ERROR');
  }

  // Le type détermine à la fois category (texte libre conservé pour
  // compatibilité, désormais rempli automatiquement) et le jeu de
  // catégories de produits créées d'office pour la boutique (§ cahier des
  // charges types de boutique — décidé en conversation).
  const storeTypeResult = await pool.query(
    'SELECT id, label FROM store_types WHERE id = $1',
    [storeTypeId]
  );
  if (storeTypeResult.rows.length === 0) {
    throw new AppError('Type de boutique introuvable.', 404, 'STORE_TYPE_NOT_FOUND');
  }
  const storeType = storeTypeResult.rows[0];

  // Un Super Admin est un opérateur de la plateforme, pas un client — il
  // ne peut jamais posséder de boutique (cf. §16_admin_sans_boutique.sql).
  const userResult = await pool.query(
    'SELECT is_super_admin AS "isSuperAdmin" FROM users WHERE id = $1',
    [userId]
  );
  if (userResult.rows[0]?.isSuperAdmin) {
    throw new AppError(
      'Un Super Admin ne peut pas posséder de boutique.',
      403,
      'SUPER_ADMIN_CANNOT_OWN_STORE'
    );
  }

  // Un seul poste par utilisateur (§53_desactivation_boutique.sql, décidé
  // en conversation) : "déjà Owner ailleurs" (cf. uq_stores_owner_id) pour
  // suivre d'autres boutiques, il passe par "Superviser", pas par une
  // nouvelle création ; "déjà Vendeur ailleurs" doit d'abord en être
  // retiré. Vérification préalable pour un message clair ; la contrainte
  // UNIQUE en base reste le filet de sécurité final en cas de requêtes
  // concurrentes. Une boutique DÉSACTIVÉE ne compte pas comme occupation :
  // c'est précisément ce qui permet à un Owner de repartir de zéro.
  const conflict = await findConflictingOccupation(userId);
  if (conflict) {
    if (conflict.type === 'SELLER') {
      throw new AppError(
        `Vous êtes déjà Vendeur dans la boutique "${conflict.name}". Demandez à son propriétaire de vous en retirer avant de créer votre propre boutique.`,
        409,
        'ALREADY_RESELLER_ELSEWHERE'
      );
    }
    throw new AppError(
      'Vous possédez déjà une boutique. Pour suivre d\'autres boutiques, utilisez "Superviser".',
      409,
      'ALREADY_OWNS_STORE'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const planResult = await client.query(
      'SELECT id FROM subscription_plans WHERE price = 0 ORDER BY id ASC LIMIT 1'
    );
    const planId = planResult.rows[0]?.id || null;

    const storeResult = await client.query(
      `INSERT INTO stores
         (name, owner_id, plan_id, category, store_type_id, country, region, city, address, phone, email, supervision_code, supplier_code, transfer_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       RETURNING id, name, category, store_type_id AS "storeTypeId", country, region, city, address`,
      [
        name.trim(),
        userId,
        planId,
        storeType.label,
        storeType.id,
        // Le pays n'est jamais laissé vide : à défaut d'une valeur fournie,
        // on force explicitement "Guinée" plutôt que de compter sur la
        // valeur par défaut de la colonne (qui ne s'appliquerait que si la
        // colonne était omise de l'INSERT, pas si on lui passe NULL).
        country || 'Guinée',
        region || null,
        city || null,
        address || null,
        phone || null,
        email || null,
        generateSupervisionCode(),
        generateSupplierCode(),
        generateTransferCode(),
      ]
    );
    const store = storeResult.rows[0];

    // Copie initiale du gabarit vers la vraie table categories — un point
    // de départ, pas un lien vivant : renommer/supprimer une catégorie du
    // gabarit n'affecte jamais rétroactivement cette boutique. Un AJOUT au
    // gabarit, lui, est propagé aux boutiques existantes séparément (cf.
    // admin.service.js#addStoreTypeCategory, décidé en conversation) — ici
    // on ne fait que la copie initiale pour une boutique qui vient de naître.
    await client.query(
      `INSERT INTO categories (store_id, name)
       SELECT $1, name FROM store_type_categories WHERE store_type_id = $2`,
      [store.id, storeType.id]
    );

    const roleResult = await client.query("SELECT id FROM roles WHERE code = 'OWNER' LIMIT 1");
    const ownerRoleId = roleResult.rows[0].id;

    const hasDefaultResult = await client.query(
      'SELECT 1 FROM user_store WHERE user_id = $1 AND is_default_store = TRUE',
      [userId]
    );
    const isFirstStore = hasDefaultResult.rows.length === 0;

    await client.query(
      `INSERT INTO user_store (user_id, store_id, role_id, is_default_store)
       VALUES ($1, $2, $3, $4)`,
      [userId, store.id, ownerRoleId, isFirstStore]
    );

    await client.query(
      `INSERT INTO system_logs (user_id, store_id, action, details)
       VALUES ($1, $2, 'CREATE_STORE', '{}'::jsonb)`,
      [userId, store.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505' && err.constraint === 'uq_stores_owner_id') {
      throw new AppError(
        'Vous possédez déjà une boutique. Pour suivre d\'autres boutiques, utilisez "Superviser".',
        409,
        'ALREADY_OWNS_STORE'
      );
    }
    if (err.code === 'P0001') {
      throw new AppError(err.message, 403, 'SUPER_ADMIN_CANNOT_OWN_STORE');
    }
    throw err;
  } finally {
    client.release();
  }

  // On sort de la transaction avant de relire : la boutique tout juste
  // créée est immédiatement sélectionnée comme boutique active (meilleure
  // expérience que de renvoyer l'utilisateur sur un sélecteur pour un choix
  // qu'il vient de faire).
  const stores = await listMyStores(userId);
  const activeStore = stores.find((s) => s.name === name.trim()) || stores[0];

  const { rows } = await pool.query(
    'SELECT is_super_admin AS "isSuperAdmin", token_version AS "tokenVersion" FROM users WHERE id = $1',
    [userId]
  );

  const token = signToken({
    userId,
    storeId: activeStore.id,
    roleCode: activeStore.roleCode,
    isSuperAdmin: rows[0]?.isSuperAdmin || false,
    tokenVersion: rows[0]?.tokenVersion,
  });

  return { token, activeStore, stores };
}

/**
 * Désactivation volontaire de sa propre boutique par l'Owner
 * (§53_desactivation_boutique.sql, décidé en conversation) — le seul moyen
 * de libérer son "poste" d'Owner pour, par exemple, rejoindre une autre
 * boutique comme Vendeur. Contrairement à suspendStore (Super Admin,
 * punitif), ce statut DEACTIVATED libère réellement owner_id (cf. l'index
 * unique partiel sur stores.owner_id) — voir findConflictingOccupation.
 * Aucune donnée supprimée ni modifiée à part le statut.
 */
async function deactivateOwnStore(storeId, userId) {
  const { rows } = await pool.query(
    `UPDATE stores SET status = 'DEACTIVATED' WHERE id = $1 AND owner_id = $2 AND status = 'ACTIVE'
     RETURNING id, name, status`,
    [storeId, userId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable ou déjà inactive.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'OWNER_DEACTIVATE_STORE', '{}'::jsonb)`,
    [userId, storeId]
  );
  return rows[0];
}

/**
 * Réactivation, par l'Owner lui-même, d'une boutique qu'il avait
 * désactivée (§53_desactivation_boutique.sql, décidé en conversation) —
 * refusée s'il occupe entre-temps un autre poste (Owner ou Vendeur)
 * ailleurs, pour ne jamais violer la règle "un seul poste à la fois".
 * Volontairement hors de requireActiveStore (comme POST /stores et
 * GET /stores/mine) : une boutique désactivée n'est pas sélectionnable
 * comme boutique active, donc cette action ne peut pas en dépendre.
 */
async function reactivateOwnStore(storeId, userId) {
  const conflict = await findConflictingOccupation(userId, { excludeStoreId: storeId });
  if (conflict) {
    throw new AppError(
      `Vous êtes actuellement ${conflict.type === 'OWNER' ? 'propriétaire' : 'Vendeur'} de la boutique "${conflict.name}". Réglez cette situation avant de réactiver celle-ci.`,
      409,
      'ALREADY_OCCUPIED_ELSEWHERE'
    );
  }
  const { rows } = await pool.query(
    `UPDATE stores SET status = 'ACTIVE' WHERE id = $1 AND owner_id = $2 AND status = 'DEACTIVATED'
     RETURNING id, name, status`,
    [storeId, userId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable ou non désactivée.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'OWNER_REACTIVATE_STORE', '{}'::jsonb)`,
    [userId, storeId]
  );
  return rows[0];
}

/**
 * Renvoie le code de supervision actuel de la boutique (§12_supervision.sql)
 * — à afficher dans les paramètres pour que le propriétaire le transmette
 * lui-même à qui il souhaite (aucun envoi automatique, canal au choix du
 * propriétaire : WhatsApp, SMS, etc.).
 */
async function getSupervisionCode(storeId) {
  const { rows } = await pool.query(
    'SELECT supervision_code AS "supervisionCode" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Régénère le code de supervision. N'affecte PAS les superviseurs déjà
 * ajoutés via l'ancien code (cf. décision : pas de révocation individuelle
 * pour l'instant) — seuls les nouveaux ajouts nécessiteront le nouveau code.
 */
async function regenerateSupervisionCode(storeId) {
  const newCode = generateSupervisionCode();
  await pool.query('UPDATE stores SET supervision_code = $1 WHERE id = $2', [newCode, storeId]);
  return { supervisionCode: newCode };
}

/**
 * Renvoie le code fournisseur actuel de la boutique
 * (§18_fournisseurs_inter_boutiques.sql) — à afficher dans les paramètres
 * pour que le propriétaire le transmette lui-même à qui il souhaite.
 */
async function getSupplierCode(storeId) {
  const { rows } = await pool.query(
    'SELECT supplier_code AS "supplierCode" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Régénère le code fournisseur. N'affecte PAS les liens déjà établis via
 * l'ancien code (même décision que pour supervision_code) — seuls les
 * nouveaux ajouts nécessiteront le nouveau code.
 */
async function regenerateSupplierCode(storeId) {
  const newCode = generateSupplierCode();
  await pool.query('UPDATE stores SET supplier_code = $1 WHERE id = $2', [newCode, storeId]);
  return { supplierCode: newCode };
}

/**
 * Renvoie le code de transfert actuel de la boutique
 * (§45_transfert_de_stock.sql) — à afficher dans les paramètres pour que
 * le propriétaire le transmette lui-même à qui il souhaite. Même principe
 * exact que getSupervisionCode/getSupplierCode.
 */
async function getTransferCode(storeId) {
  const { rows } = await pool.query(
    'SELECT transfer_code AS "transferCode" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Régénère le code de transfert. N'affecte aucun transfert déjà effectué
 * (l'historique reste immuable) — seuls les nouveaux transferts nécessitent
 * le nouveau code. Même décision que pour supervision_code/supplier_code.
 */
async function regenerateTransferCode(storeId) {
  const newCode = generateTransferCode();
  await pool.query('UPDATE stores SET transfer_code = $1 WHERE id = $2', [newCode, storeId]);
  return { transferCode: newCode };
}

/**
 * Détermine si le bandeau d'alerte "boutique en mode gratuit" doit
 * s'afficher (§20_plans_abonnement.sql, décidé en conversation) —
 * accessible à TOUS les rôles de la boutique (pas seulement l'Owner),
 * contrairement au reste des routes de ce fichier : l'équipe gelée doit
 * elle aussi comprendre pourquoi. Ne s'affiche que si la boutique est
 * effectivement en FREEMIUM ET qu'elle a au moins un employé
 * (Vendeur) — c'est le seul cas où quelque chose est réellement
 * gelé pour quelqu'un ; une boutique FREEMIUM sans employé n'a rien à
 * signaler.
 */
async function getPlanBanner(storeId) {
  const plan = await getEffectivePlan(storeId);
  if (!plan.isEffectivelyFreemium) {
    return { show: false };
  }

  const { rows } = await pool.query(
    `SELECT 1 FROM user_store us
     JOIN roles r ON r.id = us.role_id
     WHERE us.store_id = $1 AND r.code != 'OWNER'
     LIMIT 1`,
    [storeId]
  );

  return { show: rows.length > 0, planName: plan.planName };
}

/**
 * Type de boutique actuel (§ cahier des charges types de boutique) — pour
 * les boutiques créées avant cette fonctionnalité, storeTypeId/Label sont
 * simplement null : rien à migrer, le bouton "adopter un type" dans
 * Paramètres comble ce vide à la demande du propriétaire.
 */
async function getStoreType(storeId) {
  const { rows } = await pool.query(
    `SELECT s.store_type_id AS "storeTypeId", st.label AS "storeTypeLabel"
     FROM stores s LEFT JOIN store_types st ON st.id = s.store_type_id
     WHERE s.id = $1`,
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Adoption d'un type pour une boutique existante — décidé en conversation :
 * une boutique ne peut avoir qu'un seul type, choisi UNE SEULE FOIS (à la
 * création, ou ici pour les boutiques créées avant cette fonctionnalité).
 * Une fois défini, il devient définitif — pas de re-changement possible,
 * pour éviter d'accumuler sans fin des catégories suggérées de types
 * successifs sans jamais pouvoir "annuler" les précédentes. Les catégories
 * suggérées du type sont copiées dans les vraies catégories de la
 * boutique, en sautant celles dont le nom existe déjà (comparaison
 * insensible à la casse). Ne touche jamais `products` : les produits déjà
 * existants, quelle que soit leur catégorie, restent strictement intacts.
 */
async function adoptStoreType(storeId, storeTypeId) {
  if (!storeTypeId) {
    throw new AppError('Le type de boutique est requis.', 400, 'VALIDATION_ERROR');
  }

  const currentResult = await pool.query('SELECT store_type_id AS "storeTypeId" FROM stores WHERE id = $1', [
    storeId,
  ]);
  if (currentResult.rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  if (currentResult.rows[0].storeTypeId) {
    throw new AppError(
      'Le type de cette boutique est déjà défini et ne peut plus être changé.',
      409,
      'STORE_TYPE_ALREADY_SET'
    );
  }

  const storeTypeResult = await pool.query('SELECT id, label FROM store_types WHERE id = $1', [
    storeTypeId,
  ]);
  if (storeTypeResult.rows.length === 0) {
    throw new AppError('Type de boutique introuvable.', 404, 'STORE_TYPE_NOT_FOUND');
  }
  const storeType = storeTypeResult.rows[0];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Le filtre "store_type_id IS NULL" est le vrai garde-fou (atomique,
    // résiste à une double soumission concurrente) — la vérification
    // au-dessus ne sert qu'à renvoyer un message clair dans le cas normal.
    const updateResult = await client.query(
      `UPDATE stores SET store_type_id = $1, category = $2 WHERE id = $3 AND store_type_id IS NULL RETURNING id`,
      [storeType.id, storeType.label, storeId]
    );
    if (updateResult.rows.length === 0) {
      throw new AppError(
        'Le type de cette boutique est déjà défini et ne peut plus être changé.',
        409,
        'STORE_TYPE_ALREADY_SET'
      );
    }

    const insertedResult = await client.query(
      `INSERT INTO categories (store_id, name)
       SELECT $1, stc.name
       FROM store_type_categories stc
       WHERE stc.store_type_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM categories c WHERE c.store_id = $1 AND LOWER(c.name) = LOWER(stc.name)
         )
       RETURNING id`,
      [storeId, storeType.id]
    );

    await client.query('COMMIT');
    return {
      storeTypeId: storeType.id,
      storeTypeLabel: storeType.label,
      categoriesAdded: insertedResult.rows.length,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Personnalisation du reçu (§23_personnalisation_recu.sql — décidé en
 * conversation) : un formulaire structuré, jamais un éditeur libre type
 * traitement de texte — voir le commentaire de la migration. Les valeurs
 * par défaut ci-dessous reproduisent EXACTEMENT le comportement actuel du
 * reçu tant que rien n'a été configuré, pour ne rien changer par défaut.
 */
const DEFAULT_RECEIPT_SETTINGS = {
  headerMessage: '',
  footerMessage: 'Merci de votre visite !',
  showAddress: false,
  showPhone: false,
  showSellerName: false,
  showSignature: false,
  signatureLabel: 'Signature',
  invoiceTitle: 'FACTURE',
};

/**
 * Nom/adresse/téléphone de la boutique — utilisé par l'écran de
 * personnalisation du reçu pour afficher un aperçu fidèle aux vraies
 * coordonnées de la boutique plutôt qu'un exemple générique.
 */
async function getStoreContactInfo(storeId) {
  const { rows } = await pool.query('SELECT name, address, phone FROM stores WHERE id = $1', [storeId]);
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Informations générales de la boutique (§ décidé en conversation) — tout
 * modifiable après création SAUF le type de boutique, qui reste
 * définitif une fois choisi (voir adoptStoreType ci-dessus, règle déjà
 * établie séparément). Mêmes champs, mêmes règles que createStore() pour
 * le nom et le téléphone (seuls obligatoires) — région/ville/adresse/pays
 * restent optionnels ici comme à la création.
 */
async function getStoreInfo(storeId) {
  const { rows } = await pool.query(
    `SELECT name, address, phone, region, city, country
     FROM stores WHERE id = $1`,
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateStoreInfo(storeId, { name, address, phone, region, city, country }) {
  if (!name || !name.trim()) {
    throw new AppError('Le nom de la boutique est requis.', 400, 'VALIDATION_ERROR');
  }
  if (!phone || !phone.trim()) {
    throw new AppError('Le numéro de la boutique est requis.', 400, 'VALIDATION_ERROR');
  }

  const { rows } = await pool.query(
    `UPDATE stores
     SET name = $1, address = $2, phone = $3, region = $4, city = $5, country = $6
     WHERE id = $7
     RETURNING name, address, phone, region, city, country`,
    [name.trim(), address || null, phone.trim(), region || null, city || null, country || null, storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function getReceiptSettings(storeId) {
  const { rows } = await pool.query('SELECT receipt_settings AS "receiptSettings" FROM stores WHERE id = $1', [
    storeId,
  ]);
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return { ...DEFAULT_RECEIPT_SETTINGS, ...rows[0].receiptSettings };
}

async function updateReceiptSettings(storeId, settings) {
  const merged = {
    headerMessage: (settings.headerMessage || '').trim().slice(0, 200),
    footerMessage: (settings.footerMessage || '').trim().slice(0, 200),
    showAddress: Boolean(settings.showAddress),
    showPhone: Boolean(settings.showPhone),
    showSellerName: Boolean(settings.showSellerName),
    showSignature: Boolean(settings.showSignature),
    signatureLabel: (settings.signatureLabel || '').trim().slice(0, 60) || 'Signature',
    invoiceTitle: (settings.invoiceTitle || '').trim().slice(0, 40) || 'FACTURE',
  };

  const { rows } = await pool.query(
    'UPDATE stores SET receipt_settings = $1 WHERE id = $2 RETURNING id',
    [JSON.stringify(merged), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return merged;
}

/**
 * Réglages "Facturation" (§42_facturation_boutique.sql, décidé en
 * conversation) — regroupe taux de taxe par défaut, informations légales et
 * numérotation de facture dédiée dans un même formulaire (même principe que
 * receipt_settings : un blob JSONB fusionné avec des valeurs par défaut,
 * jamais un éditeur libre). defaultTaxPercent reste une colonne dédiée
 * (pas dans le JSONB) : elle voyage dans listMyStores/getStoresForUser pour
 * être disponible côté Caisse sans appel réseau supplémentaire — mais se
 * règle ici, dans le même geste que le reste de "Facturation".
 *
 * invoiceNumberingEnabled/invoicePrefix pilotent
 * orders.service.js#getInvoiceData (attribution du numéro dédié) ;
 * legalRccm/legalNif/legalTaxRegime sont imprimés sur la Facture PDF (cf.
 * invoicePdf.js) sous les coordonnées de la boutique.
 */
const DEFAULT_BILLING_SETTINGS = {
  legalRccm: '',
  legalNif: '',
  legalTaxRegime: '',
  invoiceNumberingEnabled: false,
  invoicePrefix: 'FACT-',
};

async function getBillingSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT billing_settings AS "billingSettings", default_tax_percent AS "defaultTaxPercent" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return {
    ...DEFAULT_BILLING_SETTINGS,
    ...rows[0].billingSettings,
    defaultTaxPercent: Number(rows[0].defaultTaxPercent),
  };
}

async function updateBillingSettings(storeId, settings) {
  const merged = {
    legalRccm: (settings.legalRccm || '').trim().slice(0, 60),
    legalNif: (settings.legalNif || '').trim().slice(0, 60),
    legalTaxRegime: (settings.legalTaxRegime || '').trim().slice(0, 60),
    invoiceNumberingEnabled: Boolean(settings.invoiceNumberingEnabled),
    invoicePrefix: (settings.invoicePrefix || '').trim().slice(0, 20) || 'FACT-',
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const taxResult = await client.query(
      'UPDATE stores SET default_tax_percent = $1, billing_settings = $2 WHERE id = $3 RETURNING default_tax_percent AS "defaultTaxPercent"',
      [Math.min(100, Math.max(0, Number(settings.defaultTaxPercent) || 0)), JSON.stringify(merged), storeId]
    );
    if (taxResult.rows.length === 0) {
      throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
    }
    await client.query('COMMIT');
    return { ...merged, defaultTaxPercent: taxResult.rows[0].defaultTaxPercent };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Logo de la boutique (§ cahier des charges "Upload et stockage réel des
 * images", décidé en conversation) — `logo_url` existait déjà en base
 * depuis le tout début du projet mais n'était lu ni écrit nulle part.
 * Même principe que `receipt_settings` juste au-dessus : un simple lien,
 * renseigné soit collé à la main, soit via POST /uploads/image côté
 * frontend — cette fonction ne sait pas d'où vient l'URL, elle se contente
 * de la stocker.
 */
async function getStoreLogo(storeId) {
  const { rows } = await pool.query('SELECT logo_url AS "logoUrl" FROM stores WHERE id = $1', [storeId]);
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateStoreLogo(storeId, logoUrl) {
  const trimmed = (logoUrl || '').trim() || null;
  const { rows } = await pool.query('UPDATE stores SET logo_url = $1 WHERE id = $2 RETURNING logo_url AS "logoUrl"', [
    trimmed,
    storeId,
  ]);
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

/**
 * Réglage global "autoriser TOUS les vendeurs à annuler/retourner leurs
 * propres ventes" (§25_autorisation_annulation_retour.sql, décidé en
 * conversation). Vendeur par vendeur, voir plutôt
 * employees.service.js#setSellerVoidReturnPermission.
 */
async function getVoidReturnSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_void_return AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateVoidReturnSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_void_return = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_VOID_RETURN_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut annuler/retourner (ses propres) ventes
 * dans cette boutique ? Owner : toujours. Vendeur : soit le flag global
 * ci-dessus, soit sa permission individuelle
 * (`user_store.permissions->>'canVoidReturn'`). Utilisé à la fois par le
 * contrôle d'accès réel (orders.routes.js) et par l'endpoint que le
 * Vendeur interroge lui-même pour savoir s'il voit "Historique des ventes"
 * dans son menu (GET /stores/my-void-return-permission).
 */
async function canUserVoidReturn(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_void_return AS "allowAllSellers",
            COALESCE((us.permissions->>'canVoidReturn')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

/**
 * Réglage global "autoriser TOUS les vendeurs à modifier le prix de vente à
 * la Caisse" (§39_prix_editable_vente.sql, décidé en conversation). Vendeur
 * par vendeur, voir plutôt employees.service.js#setSellerEditPricePermission.
 * Même principe exact que getVoidReturnSettings ci-dessus.
 */
async function getEditPriceSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_edit_price AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateEditPriceSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_edit_price = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_EDIT_PRICE_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut saisir un prix de vente différent du
 * prix catalogue à la Caisse ? Owner : toujours (et jamais soumis au
 * plancher — voir orders.service.js#createOrder). Vendeur : soit le flag
 * global ci-dessus, soit sa permission individuelle
 * (`user_store.permissions->>'canEditPrice'`) — et dans ce cas, toujours
 * borné par le prix qui serait normalement appliqué (catalogue ou palier
 * de quantité), jamais en dessous.
 */
async function canUserEditPrice(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_edit_price AS "allowAllSellers",
            COALESCE((us.permissions->>'canEditPrice')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

/**
 * Réglage global "autoriser TOUS les vendeurs à ajouter un produit"
 * (§40_autorisation_ajout_produit.sql, décidé en conversation). Vendeur
 * par vendeur, voir plutôt employees.service.js#setSellerAddProductPermission.
 * Même principe exact que getVoidReturnSettings/getEditPriceSettings.
 */
async function getAddProductSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_add_product AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateAddProductSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_add_product = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_ADD_PRODUCT_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut créer un nouveau produit ? Owner :
 * toujours. Vendeur : soit le flag global ci-dessus, soit sa permission
 * individuelle (`user_store.permissions->>'canAddProduct'`). Ne couvre QUE
 * la création (POST /products) — modifier/désactiver/ajuster le stock
 * d'un produit existant reste strictement réservé au Owner, jamais vérifié
 * ici.
 */
async function canUserAddProduct(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_add_product AS "allowAllSellers",
            COALESCE((us.permissions->>'canAddProduct')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

/**
 * Réglage global "autoriser TOUS les vendeurs à ajuster le stock"
 * (§43_autorisation_stock_fournisseurs_achats.sql, décidé en conversation).
 * Vendeur par vendeur, voir plutôt
 * employees.service.js#setSellerManageStockPermission. Même principe exact
 * que getVoidReturnSettings/getEditPriceSettings/getAddProductSettings.
 */
async function getStockSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_manage_stock AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateStockSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_manage_stock = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_STOCK_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut ajuster le stock d'un produit existant
 * (POST /products/:id/adjust-stock) ? Owner : toujours. Vendeur : soit le
 * flag global ci-dessus, soit sa permission individuelle
 * (`user_store.permissions->>'canManageStock'`). La CONSULTATION du stock
 * (GET /products, /products/:id/stock-history) reste ouverte à tout
 * vendeur, indépendamment de ce réglage — inchangé.
 */
async function canUserManageStock(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_manage_stock AS "allowAllSellers",
            COALESCE((us.permissions->>'canManageStock')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

/**
 * Réglage global "autoriser TOUS les vendeurs à utiliser Fournisseurs"
 * (§43_autorisation_stock_fournisseurs_achats.sql, décidé en conversation).
 * Vendeur par vendeur, voir plutôt
 * employees.service.js#setSellerManageSuppliersPermission.
 */
async function getSuppliersSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_manage_suppliers AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updateSuppliersSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_manage_suppliers = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_SUPPLIERS_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut utiliser le module Fournisseurs (jusqu'ici
 * intégralement réservé au Owner, aucun accès vendeur même en lecture) ?
 * Owner : toujours. Vendeur : soit le flag global ci-dessus, soit sa
 * permission individuelle (`user_store.permissions->>'canManageSuppliers'`).
 * Un vendeur autorisé voit le module exactement comme le Owner.
 */
async function canUserManageSuppliers(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_manage_suppliers AS "allowAllSellers",
            COALESCE((us.permissions->>'canManageSuppliers')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

/**
 * Réglage global "autoriser TOUS les vendeurs à utiliser Achats"
 * (§43_autorisation_stock_fournisseurs_achats.sql, décidé en conversation).
 * Vendeur par vendeur, voir plutôt
 * employees.service.js#setSellerManagePurchasesPermission.
 */
async function getPurchasesSettings(storeId) {
  const { rows } = await pool.query(
    'SELECT allow_all_sellers_manage_purchases AS "allowAllSellers" FROM stores WHERE id = $1',
    [storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  return rows[0];
}

async function updatePurchasesSettings(storeId, allowAllSellers, actingUserId) {
  const { rows } = await pool.query(
    'UPDATE stores SET allow_all_sellers_manage_purchases = $1 WHERE id = $2 RETURNING id',
    [Boolean(allowAllSellers), storeId]
  );
  if (rows.length === 0) {
    throw new AppError('Boutique introuvable.', 404, 'STORE_NOT_FOUND');
  }
  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, $2, 'UPDATE_PURCHASES_SETTINGS', $3::jsonb)`,
    [actingUserId, storeId, JSON.stringify({ allowAllSellers: Boolean(allowAllSellers) })]
  );
  return { allowAllSellers: Boolean(allowAllSellers) };
}

/**
 * Est-ce que cet utilisateur peut utiliser le module Achats (jusqu'ici
 * intégralement réservé au Owner, aucun accès vendeur même en lecture) ?
 * Owner : toujours. Vendeur : soit le flag global ci-dessus, soit sa
 * permission individuelle (`user_store.permissions->>'canManagePurchases'`).
 * La restriction PREMIUM sur la création (§28_commandes_achat_premium.sql,
 * requirePlanFeature('allowsPurchaseOrders')) reste entièrement séparée et
 * s'applique de la même façon à un vendeur autorisé qu'au Owner.
 */
async function canUserManagePurchases(storeId, userId, roleCode) {
  if (roleCode === 'OWNER') return true;

  const { rows } = await pool.query(
    `SELECT s.allow_all_sellers_manage_purchases AS "allowAllSellers",
            COALESCE((us.permissions->>'canManagePurchases')::boolean, false) AS "individualPermission"
     FROM stores s
     JOIN user_store us ON us.store_id = s.id
     WHERE s.id = $1 AND us.user_id = $2`,
    [storeId, userId]
  );
  if (rows.length === 0) return false;
  return rows[0].allowAllSellers || rows[0].individualPermission;
}

module.exports = {
  listMyStores,
  createStore,
  deactivateOwnStore,
  reactivateOwnStore,
  getSupervisionCode,
  regenerateSupervisionCode,
  getSupplierCode,
  regenerateSupplierCode,
  getTransferCode,
  regenerateTransferCode,
  getPlanBanner,
  getStoreType,
  adoptStoreType,
  getReceiptSettings,
  updateReceiptSettings,
  getBillingSettings,
  updateBillingSettings,
  getStoreContactInfo,
  getStoreInfo,
  updateStoreInfo,
  getStoreLogo,
  updateStoreLogo,
  getVoidReturnSettings,
  updateVoidReturnSettings,
  canUserVoidReturn,
  getEditPriceSettings,
  updateEditPriceSettings,
  canUserEditPrice,
  getAddProductSettings,
  updateAddProductSettings,
  canUserAddProduct,
  getStockSettings,
  updateStockSettings,
  canUserManageStock,
  getSuppliersSettings,
  updateSuppliersSettings,
  canUserManageSuppliers,
  getPurchasesSettings,
  updatePurchasesSettings,
  canUserManagePurchases,
};