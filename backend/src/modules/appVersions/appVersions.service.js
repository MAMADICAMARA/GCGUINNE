const crypto = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { fileTypeFromBuffer } = require('file-type');
const pool = require('../../config/db');
const { getR2Client, isR2Configured } = require('../../config/r2');
const env = require('../../config/env');
const { AppError } = require('../../middlewares/errorHandler');

const UPDATE_LEVELS = ['OPTIONAL', 'RECOMMENDED', 'MANDATORY'];

// APK uniquement — vérifié sur le contenu réel du fichier (magic bytes),
// jamais l'extension déclarée (même principe que uploads.service.js).
const ALLOWED_APK_MIME_TYPES = { 'application/vnd.android.package-archive': 'apk' };

// 250 Mo (décidé en conversation).
const MAX_APK_FILE_SIZE_BYTES = 250 * 1024 * 1024;

/**
 * Version PUBLIQUE la plus récente d'une plateforme — seule source de
 * vérité (§ décidé en conversation), interrogée à la fois par l'app
 * Flutter et par la page web publique de téléchargement, jamais deux
 * valeurs codées séparément.
 *
 * `AND EXISTS (... app_version_links ...)` : une version sans AUCUN lien
 * n'est jamais renvoyée ici, même si sa ligne existe déjà en base — c'est
 * ce qui rend "publier une version sans lien" concrètement sans effet
 * (§ critère d'acceptation 10) : le Super Admin peut créer la ligne pour
 * pouvoir y attacher un fichier/lien juste après (createVersion ci-dessous
 * ne prend pas les liens en paramètre, l'upload est un appel séparé, cf.
 * §7 du cahier des charges), mais tant qu'aucun lien n'existe, cette
 * version reste invisible pour tout le monde — jamais "à moitié publiée".
 */
async function getLatestVersion(platform = 'android') {
  const { rows } = await pool.query(
    `SELECT v.id, v.version_code AS "versionCode", v.version_name AS "versionName",
            v.release_notes AS "releaseNotes", v.update_level AS "updateLevel"
     FROM app_versions v
     WHERE v.platform = $1
       AND EXISTS (SELECT 1 FROM app_version_links l WHERE l.app_version_id = v.id)
     ORDER BY v.version_code DESC
     LIMIT 1`,
    [platform]
  );
  if (rows.length === 0) return null;
  const version = rows[0];
  const links = await getLinksForVersion(version.id);
  return { ...version, links };
}

async function getLinksForVersion(appVersionId) {
  const { rows } = await pool.query(
    `SELECT id, label, url, is_direct_upload AS "isDirectUpload", display_order AS "displayOrder"
     FROM app_version_links WHERE app_version_id = $1 ORDER BY display_order ASC, id ASC`,
    [appVersionId]
  );
  return rows;
}

/**
 * Historique complet (Super Admin) — TOUTES les versions, y compris celles
 * sans encore aucun lien (pour que l'admin puisse reprendre une
 * publication en cours), chacune avec la liste complète de ses liens
 * (une version n'en a jamais des dizaines, deux requêtes plutôt qu'une
 * jointure agrégée reste largement suffisant et plus lisible).
 */
async function listVersions() {
  const versionsResult = await pool.query(
    `SELECT id, platform, version_code AS "versionCode", version_name AS "versionName",
            release_notes AS "releaseNotes", update_level AS "updateLevel",
            published_at AS "publishedAt"
     FROM app_versions
     ORDER BY platform ASC, version_code DESC`
  );
  const versions = versionsResult.rows;
  if (versions.length === 0) return [];

  const linksResult = await pool.query(
    `SELECT app_version_id AS "appVersionId", id, label, url,
            is_direct_upload AS "isDirectUpload", display_order AS "displayOrder"
     FROM app_version_links
     WHERE app_version_id = ANY($1::int[])
     ORDER BY display_order ASC, id ASC`,
    [versions.map((v) => v.id)]
  );
  const linksByVersion = new Map();
  for (const link of linksResult.rows) {
    const list = linksByVersion.get(link.appVersionId) || [];
    list.push({ id: link.id, label: link.label, url: link.url, isDirectUpload: link.isDirectUpload, displayOrder: link.displayOrder });
    linksByVersion.set(link.appVersionId, list);
  }

  return versions.map((v) => ({ ...v, links: linksByVersion.get(v.id) || [] }));
}

async function createVersion(
  adminUserId,
  { platform, versionCode, versionName, releaseNotes, updateLevel }
) {
  const finalPlatform = (platform || 'android').trim();
  if (!Number.isInteger(versionCode) || versionCode <= 0) {
    throw new AppError('Le numéro de version (code) doit être un entier positif.', 400, 'VALIDATION_ERROR');
  }
  if (!versionName || !versionName.trim()) {
    throw new AppError('Le nom de version est requis.', 400, 'VALIDATION_ERROR');
  }
  if (!UPDATE_LEVELS.includes(updateLevel)) {
    throw new AppError('Niveau de mise à jour invalide.', 400, 'VALIDATION_ERROR');
  }

  let version;
  try {
    const { rows } = await pool.query(
      `INSERT INTO app_versions (platform, version_code, version_name, release_notes, update_level, published_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, platform, version_code AS "versionCode", version_name AS "versionName",
                 release_notes AS "releaseNotes", update_level AS "updateLevel", published_at AS "publishedAt"`,
      [finalPlatform, versionCode, versionName.trim(), releaseNotes ? releaseNotes.trim() : null, updateLevel, adminUserId]
    );
    version = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw new AppError('Ce numéro de version existe déjà pour cette plateforme.', 409, 'DUPLICATE_VERSION_CODE');
    }
    throw err;
  }

  await pool.query(
    `INSERT INTO system_logs (user_id, store_id, action, details)
     VALUES ($1, NULL, 'ADMIN_PUBLISH_APP_VERSION', $2::jsonb)`,
    [
      adminUserId,
      JSON.stringify({
        versionId: version.id,
        platform: finalPlatform,
        versionCode,
        versionName: version.versionName,
        updateLevel,
      }),
    ]
  );

  return { ...version, links: [] };
}

async function ensureVersionExists(appVersionId) {
  const { rows } = await pool.query('SELECT 1 FROM app_versions WHERE id = $1', [appVersionId]);
  if (rows.length === 0) {
    throw new AppError('Version introuvable.', 404, 'VERSION_NOT_FOUND');
  }
}

async function nextDisplayOrder(appVersionId) {
  const { rows } = await pool.query(
    'SELECT COALESCE(MAX(display_order), -1) + 1 AS next FROM app_version_links WHERE app_version_id = $1',
    [appVersionId]
  );
  return rows[0].next;
}

async function insertLink(appVersionId, label, url, isDirectUpload) {
  const displayOrder = await nextDisplayOrder(appVersionId);
  const { rows } = await pool.query(
    `INSERT INTO app_version_links (app_version_id, label, url, is_direct_upload, display_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, label, url, is_direct_upload AS "isDirectUpload", display_order AS "displayOrder"`,
    [appVersionId, label, url, isDirectUpload, displayOrder]
  );
  return rows[0];
}

/**
 * Lien externe collé à la main (Mega, Mediafire, Google Drive, Uptodown,
 * ou tout autre site) — `is_direct_upload = FALSE`, aucun envoi de fichier
 * impliqué.
 */
async function addExternalLink(appVersionId, { label, url }) {
  if (!label || !label.trim()) {
    throw new AppError('Le libellé du lien est requis.', 400, 'VALIDATION_ERROR');
  }
  if (!url || !/^https?:\/\//i.test(url.trim())) {
    throw new AppError('Le lien doit être une URL valide (http/https).', 400, 'VALIDATION_ERROR');
  }
  await ensureVersionExists(appVersionId);
  return insertLink(appVersionId, label.trim(), url.trim(), false);
}

/**
 * Envoi direct d'un fichier .apk vers R2 (§6 du cahier des charges) — même
 * mécanisme exact que uploads.service.js#uploadImage (multer mémoire en
 * amont, détection par contenu réel du fichier, jamais par extension),
 * étendu à 250 Mo et au seul type APK. Crée directement la ligne
 * app_version_links correspondante (`is_direct_upload = TRUE`).
 */
async function uploadApk(appVersionId, buffer, label) {
  if (!isR2Configured()) {
    throw new AppError("L'envoi de fichiers n'est pas configuré sur ce serveur.", 500, 'UPLOAD_NOT_CONFIGURED');
  }
  await ensureVersionExists(appVersionId);

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !ALLOWED_APK_MIME_TYPES[detected.mime]) {
    throw new AppError("Ce fichier n'est pas un APK Android valide.", 400, 'INVALID_FILE_TYPE');
  }

  const key = `app-releases/${crypto.randomUUID()}.apk`;
  try {
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: env.r2.bucketName,
        Key: key,
        Body: buffer,
        ContentType: detected.mime,
      })
    );
  } catch (err) {
    // Jamais renvoyer le détail de l'erreur SDK au client — même principe
    // que uploads.service.js#uploadImage.
    // eslint-disable-next-line no-console
    console.error("Échec de l'envoi de l'APK vers R2 :", err.message);
    throw new AppError("L'envoi du fichier a échoué — réessayez.", 500, 'UPLOAD_FAILED');
  }

  const url = `${env.r2.publicUrlBase}/${key}`;
  const finalLabel = label && label.trim() ? label.trim() : 'Téléchargement direct';
  return insertLink(appVersionId, finalLabel, url, true);
}

/**
 * Retire un lien précis d'une version déjà publiée (ex: un lien Mega
 * expiré, § critère d'acceptation 11) — scopé à la fois par son id ET son
 * app_version_id, jamais un id de lien seul (empêche un id deviné/erroné
 * de toucher la mauvaise version). Ne supprime jamais le fichier sur R2
 * lui-même si c'était un envoi direct — même choix que le reste du projet
 * pour les images produits, un objet R2 orphelin est sans conséquence
 * (jamais réutilisé), contrairement à une suppression physique qu'on ne
 * pourrait pas annuler en cas d'erreur.
 */
async function removeLink(appVersionId, linkId) {
  const { rowCount } = await pool.query(
    'DELETE FROM app_version_links WHERE id = $1 AND app_version_id = $2',
    [linkId, appVersionId]
  );
  if (rowCount === 0) {
    throw new AppError('Lien introuvable.', 404, 'LINK_NOT_FOUND');
  }
  return { removed: true };
}

module.exports = {
  UPDATE_LEVELS,
  ALLOWED_APK_MIME_TYPES,
  MAX_APK_FILE_SIZE_BYTES,
  getLatestVersion,
  listVersions,
  createVersion,
  addExternalLink,
  uploadApk,
  removeLink,
};
