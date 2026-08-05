const crypto = require('crypto');
const pool = require('../../config/db');

const CODE_VALIDITY_MINUTES = 15;

/**
 * Codes de vérification à 6 chiffres, partagés par la vérification d'e-mail
 * à l'inscription et la réinitialisation de mot de passe (`purpose`
 * distingue les deux usages — voir 32_verification_email_et_mot_de_passe.sql).
 * `crypto.randomInt` (cryptographiquement sûr), jamais `Math.random()` —
 * même principe que `stores.service.js#generateShareCode`.
 */
function generateSixDigitCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

/**
 * Invalide silencieusement tout code actif du même (user, purpose) — jamais
 * supprimé, seulement marqué utilisé, pour garder un historique complet en
 * base — puis en émet un nouveau. Utilisée aussi bien pour le premier envoi
 * (inscription, demande de réinitialisation) que pour un "renvoyer le code".
 */
async function createCode(userId, purpose) {
  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_VALIDITY_MINUTES * 60 * 1000);

  await pool.query(
    `UPDATE user_verification_codes
     SET used_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose]
  );

  await pool.query(
    `INSERT INTO user_verification_codes (user_id, purpose, code, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, purpose, code, expiresAt]
  );

  return code;
}

/**
 * Vérifie ET consomme atomiquement un code en une seule requête — un
 * UPDATE...WHERE...RETURNING plutôt qu'un SELECT suivi d'un UPDATE, pour
 * qu'une double soumission concurrente du même code ne puisse jamais
 * réussir deux fois (la seconde requête ne trouve simplement plus de ligne
 * avec used_at IS NULL). Renvoie true si le code était valide, non expiré,
 * et pas déjà utilisé — false dans tous les autres cas, sans jamais
 * distinguer la raison précise à l'appelant (mauvais code, expiré, déjà
 * utilisé) : cf. §8 du cahier des charges, ne jamais aider à deviner un code.
 */
async function verifyAndConsumeCode(userId, purpose, code) {
  const { rowCount } = await pool.query(
    `UPDATE user_verification_codes
     SET used_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND code = $3
       AND used_at IS NULL AND expires_at > NOW()`,
    [userId, purpose, code]
  );
  return rowCount > 0;
}

module.exports = { createCode, verifyAndConsumeCode };
